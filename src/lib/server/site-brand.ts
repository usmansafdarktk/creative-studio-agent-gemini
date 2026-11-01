import "server-only";
import { nanoid } from "nanoid";
import type { Asset } from "@/lib/types";

export interface SiteBrand {
  url: string;
  title?: string;
  description?: string;
  themeColor?: string;
  cssVariables: string[];
  topColors: string[];
  fonts: string[];
  text: string;
  logo?: Asset;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function isPublicHttpUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return false;
    const h = u.hostname;
    return !(
      h === "localhost" ||
      h.endsWith(".internal") ||
      h.endsWith(".local") ||
      /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h) ||
      h === "::1" ||
      h.startsWith("[")
    );
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, ms = 8000) {
  if (!isPublicHttpUrl(url)) throw new Error(`Blocked URL: ${url}`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { "user-agent": UA, accept: "*/*" }, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

export function extractUrls(text: string) {
  return [...new Set(text.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [])].slice(0, 3);
}

const attr = (tag: string, name: string) => new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1];

function normalizeHex(hex: string) {
  let h = hex.toLowerCase();
  if (h.length === 4) h = "#" + [...h.slice(1)].map((c) => c + c).join("");
  return h.slice(0, 7);
}

export async function analyzeSite(url: string): Promise<SiteBrand> {
  const res = await fetchWithTimeout(url);
  const html = (await res.text()).slice(0, 1_500_000);
  const base = res.url || url;
  const abs = (href: string) => {
    try {
      return new URL(href, base).toString();
    } catch {
      return null;
    }
  };

  const tags = html.match(/<(meta|link|img)\b[^>]*>/gi) ?? [];
  const meta = (key: string) =>
    tags.find((t) => /^<meta/i.test(t) && new RegExp(`(name|property)=["']${key}["']`, "i").test(t));
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();
  const description = attr(meta("description") ?? meta("og:description") ?? "", "content");
  const themeColor = attr(meta("theme-color") ?? "", "content");

  // Collect CSS: inline <style> blocks + up to 4 linked stylesheets.
  let css = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []).join("\n");
  css += "\n" + (html.match(/style=["'][^"']*["']/gi) ?? []).join("\n");
  const sheetHrefs = tags
    .filter((t) => /^<link/i.test(t) && /rel=["'][^"']*stylesheet/i.test(t))
    .map((t) => attr(t, "href"))
    .filter(Boolean)
    .map((h) => abs(h!))
    .filter(Boolean)
    .slice(0, 4) as string[];
  const sheets = await Promise.allSettled(sheetHrefs.map(async (h) => (await fetchWithTimeout(h, 6000)).text()));
  for (const s of sheets) if (s.status === "fulfilled") css += "\n" + s.value.slice(0, 600_000);

  const colorCounts = new Map<string, number>();
  for (const m of css.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? []) {
    const c = normalizeHex(m);
    colorCounts.set(c, (colorCounts.get(c) ?? 0) + 1);
  }
  const topColors = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([c, n]) => `${c} (×${n})`);

  const cssVariables = [
    ...new Set(
      (css.match(/--[a-zA-Z0-9-_]*(color|primary|secondary|accent|brand|bg|background|text|font)[a-zA-Z0-9-_]*\s*:\s*[^;}{]{1,60}/gi) ?? []).map(
        (v) => v.replace(/\s+/g, " ").trim(),
      ),
    ),
  ].slice(0, 30);

  const fontCounts = new Map<string, number>();
  for (const m of css.match(/font-family\s*:\s*([^;}"]+)/gi) ?? []) {
    const first = m.split(":")[1].split(",")[0].replace(/['"]/g, "").trim();
    if (first && !first.startsWith("var(") && !/inherit|initial/i.test(first)) fontCounts.set(first, (fontCounts.get(first) ?? 0) + 1);
  }
  for (const m of html.match(/fonts\.googleapis\.com\/css2?\?[^"']+/gi) ?? []) {
    for (const fam of m.matchAll(/family=([^:&]+)/g)) {
      const f = decodeURIComponent(fam[1].replace(/\+/g, " "));
      fontCounts.set(f, (fontCounts.get(f) ?? 0) + 50);
    }
  }
  const fonts = [...fontCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([f]) => f);

  const text = html
    .replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3500);

  // Logo: <img> mentioning "logo", then apple-touch-icon / icon, then og:image.
  const logoCandidates: string[] = [];
  for (const t of tags) {
    if (/^<img/i.test(t) && /logo/i.test(t)) {
      const src = attr(t, "src");
      if (src && !src.startsWith("data:")) logoCandidates.push(src);
    }
  }
  for (const t of tags) if (/^<link/i.test(t) && /rel=["'](apple-touch-icon|icon)["']/i.test(t)) logoCandidates.push(attr(t, "href") ?? "");
  const og = attr(meta("og:image") ?? "", "content");
  if (og) logoCandidates.push(og);

  let logo: Asset | undefined;
  for (const cand of logoCandidates.filter(Boolean).slice(0, 4)) {
    const u = abs(cand);
    if (!u) continue;
    try {
      const r = await fetchWithTimeout(u, 6000);
      const mime = (r.headers.get("content-type") ?? "").split(";")[0];
      if (!r.ok || !mime.startsWith("image/")) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 1_500_000 || buf.length < 100) continue;
      logo = {
        id: `site-${nanoid(6)}`,
        name: `Logo from ${new URL(base).hostname}`,
        mime,
        dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
        source: "website",
      };
      break;
    } catch {
      /* try next */
    }
  }

  return { url: base, title, description, themeColor, cssVariables, topColors, fonts, text, logo };
}

export function brandToPrompt(b: SiteBrand) {
  return [
    `Website: ${b.url}`,
    b.title && `Title: ${b.title}`,
    b.description && `Description: ${b.description}`,
    b.themeColor && `Declared theme-color: ${b.themeColor}`,
    b.cssVariables.length && `CSS variables: ${b.cssVariables.join("; ")}`,
    b.topColors.length && `Most used colors: ${b.topColors.join(", ")}`,
    b.fonts.length && `Fonts used: ${b.fonts.join(", ")}`,
    b.logo && `Logo asset id: ${b.logo.id} (${b.logo.mime})`,
    `Page text excerpt: ${b.text}`,
  ]
    .filter(Boolean)
    .join("\n");
}
