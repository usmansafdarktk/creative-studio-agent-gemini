import "server-only";
import { GoogleGenAI } from "@google/genai";
import { OAuth2Client } from "google-auth-library";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ModelTier } from "@/lib/types";

const execFileAsync = promisify(execFile);

export const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "koc-dev-app-falcon-0";
export const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? "global";

export const MODELS = {
  pro: process.env.GEMINI_PRO_MODEL ?? "gemini-3.1-pro-preview",
  fast: process.env.GEMINI_FAST_MODEL ?? "gemini-3.5-flash",
  image: process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image",
} as const;

export function modelFor(tier: ModelTier) {
  return tier === "fast" ? MODELS.fast : MODELS.pro;
}

/**
 * Auth strategy:
 *  - On Cloud Run (K_SERVICE set) or GOOGLE_AUTH_MODE=adc → Application Default Credentials.
 *  - Locally (default) → short-lived token from the gcloud CLI, so `gcloud auth login` is enough.
 */
const useAdc = !!process.env.K_SERVICE || process.env.GOOGLE_AUTH_MODE === "adc";

let cached: { client: GoogleGenAI; expires: number } | null = null;

export async function getGenAI(): Promise<GoogleGenAI> {
  if (useAdc) {
    if (!cached) cached = { client: new GoogleGenAI({ vertexai: true, project: PROJECT, location: LOCATION }), expires: Infinity };
    return cached.client;
  }
  if (cached && cached.expires > Date.now()) return cached.client;
  const { stdout } = await execFileAsync("gcloud", ["auth", "print-access-token"]);
  const authClient = new OAuth2Client();
  // gcloud returns its own cached token (refreshing when close to expiry), so re-ask often.
  const expires = Date.now() + 5 * 60 * 1000;
  authClient.setCredentials({ access_token: stdout.trim(), expiry_date: expires + 10 * 60 * 1000 });
  cached = {
    client: new GoogleGenAI({ vertexai: true, project: PROJECT, location: LOCATION, googleAuthOptions: { authClient: authClient as never } }),
    expires,
  };
  return cached.client;
}

/** Retries transient Vertex errors (429 / 5xx) with exponential backoff. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String((err as Error)?.message ?? err);
      if (/\b401\b|UNAUTHENTICATED/.test(msg) && !useAdc) cached = null; // force a fresh token
      const retryable = /401|UNAUTHENTICATED|429|RESOURCE_EXHAUSTED|500|502|503|504|UNAVAILABLE|INTERNAL|fetch failed|ECONNRESET/i.test(msg);
      if (!retryable || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** i + Math.random() * 500));
    }
  }
  throw lastErr;
}

export function stripFences(text: string) {
  return text.replace(/^\s*```[a-zA-Z]*\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
}

/** Turn a data URL into an inline-data part Gemini understands. */
export function dataUrlToPart(dataUrl: string) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  // SVG isn't accepted as an image input; skip it (it's still usable on slides).
  if (m[1].includes("svg")) return null;
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

/** Human-readable error text for the UI (Vertex errors arrive as raw JSON strings). */
export function friendlyError(err: unknown) {
  const raw = String((err as Error)?.message ?? err);
  if (/401|UNAUTHENTICATED|invalid_grant|reauth/i.test(raw))
    return "Your Google Cloud session has expired. Run `gcloud auth login`, then try again.";
  if (/429|RESOURCE_EXHAUSTED/i.test(raw)) return "Gemini is busy right now (rate limit). Give it a few seconds and try again.";
  if (/403|PERMISSION_DENIED/i.test(raw)) return "This account doesn't have Vertex AI access on the project.";
  if (/abort/i.test(raw)) return "Stopped.";
  const m = /"message"\s*:\s*"([^"]+)"/.exec(raw);
  return (m?.[1] ?? raw).slice(0, 240);
}
