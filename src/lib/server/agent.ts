import "server-only";
import { nanoid } from "nanoid";
import type { AgentEvent, AgentRequest, Asset, Slide, Theme } from "@/lib/types";
import { DESIGN_SKILL, PLANNER_SKILL } from "./design-skill";
import { dataUrlToPart, friendlyError, getGenAI, MODELS, modelFor, stripFences, withRetry } from "./gemini";
import { analyzeSite, brandToPrompt, extractUrls } from "./site-brand";

type Emit = (ev: AgentEvent) => void;
type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

interface PlanOp {
  action: "create" | "update" | "delete" | "move";
  slideId?: string;
  position?: number;
  title?: string;
  brief?: string;
  assetIds?: string[];
  imagePrompt?: string;
}

interface Plan {
  reply: string;
  deckTitle?: string;
  theme?: Omit<Theme, "extraCss">;
  operations: PlanOp[];
}

const THEME_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    headingFont: { type: "string", description: "Google Fonts family name" },
    bodyFont: { type: "string", description: "Google Fonts family name" },
    radius: { type: "integer" },
    colors: {
      type: "object",
      properties: {
        bg: { type: "string" },
        surface: { type: "string" },
        text: { type: "string" },
        muted: { type: "string" },
        accent: { type: "string" },
        accent2: { type: "string" },
        border: { type: "string" },
      },
      required: ["bg", "surface", "text", "muted", "accent", "accent2", "border"],
    },
  },
  required: ["name", "headingFont", "bodyFont", "radius", "colors"],
};

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    deckTitle: { type: "string" },
    theme: THEME_SCHEMA,
    operations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "delete", "move"] },
          slideId: { type: "string", description: "Existing slide id (update/delete/move)" },
          position: { type: "integer", description: "1-based target position (create/move)" },
          brief: { type: "string", description: "Detailed design + content brief for the designer (create/update)" },
          assetIds: {
            type: "array",
            items: { type: "string" },
            description: "Ids of images (uploaded/website/generated) that must appear on this slide",
          },
          imagePrompt: { type: "string" },
          title: { type: "string", description: "Short slide label, 2–5 words only (e.g. \"Market opportunity\")" },
        },
        required: ["action", "brief"],
      },
    },
  },
  required: ["reply", "operations"],
};

export function slideText(html: string) {
  return html
    .replace(/<(style|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assetLine(a: Asset) {
  const dims = a.width && a.height ? `${a.width}×${a.height}px, aspect ${(a.width / a.height).toFixed(2)}` : "unknown size";
  return `- asset id "${a.id}" — ${a.name} (${a.mime}, ${dims}, ${a.source ?? "upload"})`;
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift()!);
    }),
  );
}

export async function runAgent(req: AgentRequest, emit: Emit, signal: AbortSignal) {
  const assets = [...req.deck.assets];
  let theme = req.deck.theme;
  const slides: Slide[] = req.deck.slides.map((s) => ({ ...s }));

  // 1) Website references → brand info (+ logo asset)
  const brandNotes: string[] = [];
  for (const url of extractUrls(req.message)) {
    emit({ type: "status", text: `Reading ${new URL(url).hostname}…` });
    try {
      const brand = await analyzeSite(url);
      if (brand.logo) {
        assets.push(brand.logo);
        emit({ type: "asset", asset: brand.logo });
      }
      brandNotes.push(brandToPrompt(brand));
    } catch (e) {
      const err = e as Error & { cause?: { code?: string } };
      const reason = err.name === "AbortError" ? "timed out" : (err.cause?.code ?? err.message).slice(0, 80);
      console.warn(`[site-brand] ${url} failed:`, reason);
      brandNotes.push(`Could not load ${url} (${reason}). Infer a fitting theme from the site name and your knowledge of the brand.`);
      emit({ type: "status", text: `Couldn't read ${new URL(url).hostname} (${reason}) — using what I know about the brand` });
    }
  }

  // 2) Plan
  emit({ type: "status", text: req.isNew ? "Planning the deck…" : "Thinking…" });
  const attachments = assets.filter((a) => req.attachmentIds.includes(a.id));
  const deckSummary = slides.length
    ? slides.map((s, i) => `${i + 1}. [id ${s.id}] ${s.title ?? ""} — ${slideText(s.html).slice(0, 260)}`).join("\n")
    : "(empty deck — no slides yet)";

  const ctx = req.context;
  const plannerText = [
    `DECK TITLE: ${req.deck.title || "(untitled)"}`,
    `CURRENT THEME: ${JSON.stringify(theme)}`,
    `SLIDES:\n${deckSummary}`,
    assets.length ? `ASSETS AVAILABLE:\n${assets.map(assetLine).join("\n")}` : "ASSETS AVAILABLE: none",
    attachments.length ? `NEWLY ATTACHED BY USER THIS TURN: ${attachments.map((a) => a.id).join(", ")} (images shown below)` : "",
    brandNotes.length ? `BRAND REFERENCE FROM WEBSITE(S):\n${brandNotes.join("\n---\n")}` : "",
    ctx
      ? `SELECTION CONTEXT: the user has selected slide ${ctx.slideIndex + 1} (id ${ctx.slideId})${
          ctx.eid ? `, element data-eid="${ctx.eid}" <${ctx.tag}> with text "${(ctx.text ?? "").slice(0, 300)}"` : ""
        }${ctx.selectedText ? `, highlighted text: "${ctx.selectedText}"` : ""}.`
      : "",
    req.history.length
      ? `RECENT CONVERSATION:\n${req.history.slice(-8).map((m) => `${m.role}: ${m.text.slice(0, 600)}`).join("\n")}`
      : "",
    `USER MESSAGE:\n${req.message}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const plannerParts: Part[] = [{ text: plannerText }];
  for (const a of attachments) {
    const p = dataUrlToPart(a.dataUrl);
    if (p) plannerParts.push({ text: `Image ${a.id}:` }, p);
  }

  const planRes = await withRetry(async () =>
    (await getGenAI()).models.generateContent({
      model: modelFor(req.tier),
      contents: [{ role: "user", parts: plannerParts }],
      config: {
        systemInstruction: PLANNER_SKILL,
        responseMimeType: "application/json",
        responseJsonSchema: PLAN_SCHEMA,
        thinkingConfig: { thinkingLevel: "LOW" as never },
        abortSignal: signal,
      },
    }),
  );
  const plan = JSON.parse(stripFences(planRes.text ?? "{}")) as Plan;
  plan.operations ??= [];
  if (process.env.NODE_ENV !== "production") console.log("[plan]", JSON.stringify(plan).slice(0, 3000));
  normalizeOps(plan.operations, assets, req.attachmentIds);

  if (plan.deckTitle && (req.isNew || !req.deck.title)) emit({ type: "title", title: plan.deckTitle });
  if (plan.theme?.colors) {
    theme = { ...plan.theme, extraCss: undefined };
    emit({ type: "theme", theme });
  }
  if (plan.reply) emit({ type: "reply", text: plan.reply });

  // 3) Structural ops first (delete / move), then create placeholders.
  for (const op of plan.operations) {
    if (op.action === "delete" && op.slideId) {
      const i = slides.findIndex((s) => s.id === op.slideId);
      if (i >= 0) {
        slides.splice(i, 1);
        emit({ type: "slide-delete", id: op.slideId });
      }
    }
  }
  for (const op of plan.operations) {
    if (op.action === "move" && op.slideId && op.position) {
      const i = slides.findIndex((s) => s.id === op.slideId);
      if (i < 0) continue;
      const [s] = slides.splice(i, 1);
      const to = Math.max(0, Math.min(slides.length, op.position - 1));
      slides.splice(to, 0, s);
      emit({ type: "slide-move", id: s.id, index: to });
    }
  }

  const jobs: { op: PlanOp; slide: Slide; existing: boolean }[] = [];
  for (const op of plan.operations) {
    if (op.action === "create") {
      const slide: Slide = { id: `s${nanoid(8)}`, html: "", title: op.title, generating: true };
      const to = op.position ? Math.max(0, Math.min(slides.length, op.position - 1)) : slides.length;
      slides.splice(to, 0, slide);
      emit({ type: "slide-placeholder", id: slide.id, index: to, title: op.title ?? "" });
      jobs.push({ op, slide, existing: false });
    } else if (op.action === "update" && op.slideId) {
      const slide = slides.find((s) => s.id === op.slideId);
      if (slide) jobs.push({ op, slide, existing: true });
    }
  }
  if (!jobs.length) return;

  // 4) Generated imagery
  const imageJobs = jobs.filter((j) => j.op.imagePrompt).slice(0, 3);
  if (imageJobs.length) {
    emit({ type: "status", text: `Generating ${imageJobs.length} image${imageJobs.length > 1 ? "s" : ""}…` });
    await Promise.all(
      imageJobs.map(async (j) => {
        try {
          const asset = await generateImage(j.op.imagePrompt!, theme, signal);
          if (!asset) return;
          assets.push(asset);
          emit({ type: "asset", asset });
          j.op.assetIds = [...(j.op.assetIds ?? []), asset.id];
        } catch (e) {
          emit({ type: "status", text: `Image generation failed: ${friendlyError(e)}` });
        }
      }),
    );
  }

  // 5) Write slides in parallel, streaming partial HTML.
  emit({ type: "status", text: `Designing ${jobs.length} slide${jobs.length > 1 ? "s" : ""}…` });
  const outline = () => slides.map((s, i) => `${i + 1}. ${s.title ?? slideText(s.html).slice(0, 60)}`).join("\n");

  await pool(jobs, 6, async ({ op, slide, existing }) => {
    if (signal.aborted) return;
    const index = slides.indexOf(slide);
    const scope = `s-${slide.id.slice(1, 6).toLowerCase()}`;
    const slideAssets = assets.filter((a) => op.assetIds?.includes(a.id));
    const parts: Part[] = [
      {
        text: [
          `THEME "${theme.name}": heading font ${theme.headingFont}, body font ${theme.bodyFont}, colors ${JSON.stringify(theme.colors)}, radius ${theme.radius}px.`,
          `DECK: ${req.deck.title || plan.deckTitle || ""}\nOUTLINE:\n${outline()}`,
          `YOU ARE DESIGNING SLIDE ${index + 1} of ${slides.length}${slide.title ? ` — "${slide.title}"` : ""}.`,
          `BRIEF:\n${op.brief ?? req.message}`,
          existing
            ? `CURRENT HTML OF THIS SLIDE (modify it per the brief; keep everything the brief doesn't mention; preserve existing data-eid attributes on untouched elements):\n${slide.html}`
            : "",
          existing && ctx?.slideId === slide.id && ctx.eid
            ? `The user selected the element with data-eid="${ctx.eid}". Focus the change there.`
            : "",
          existing ? `USER'S ORIGINAL REQUEST: ${req.message}` : "",
          slideAssets.length
            ? `IMAGES THAT MUST APPEAR ON THIS SLIDE — include each one as <img src="asset:ID"> (or background-image:url(asset:ID)), sized prominently per the brief:\n${slideAssets.map(assetLine).join("\n")}`
            : "No images for this slide — use typography, shapes, SVG graphics and color instead.",
          `Use the scope class "${scope}" on the root section for any <style> rules. Return ONLY the <section class="slide ${scope}">…</section> HTML.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ];
    for (const a of slideAssets) {
      const p = dataUrlToPart(a.dataUrl);
      if (p) parts.push({ text: `Preview of ${a.id}:` }, p);
    }

    try {
      const html = await withRetry(async () => {
        const stream = await (await getGenAI()).models.generateContentStream({
          model: modelFor(req.tier),
          contents: [{ role: "user", parts }],
          config: { systemInstruction: DESIGN_SKILL, thinkingConfig: { thinkingLevel: "LOW" as never }, abortSignal: signal },
        });
        let acc = "";
        let last = 0;
        for await (const chunk of stream) {
          acc += chunk.text ?? "";
          if (Date.now() - last > 300) {
            last = Date.now();
            emit({ type: "slide-partial", id: slide.id, html: stripFences(acc) });
          }
        }
        return acc;
      });
      const clean = sanitizeSlideHtml(stripFences(html), scope);
      slide.html = clean;
      emit({ type: "slide", id: slide.id, html: clean, title: op.title ?? slide.title });
    } catch (e) {
      if (signal.aborted) return;
      emit({ type: "error", text: `Slide ${index + 1} failed: ${friendlyError(e)}` });
      if (!existing) emit({ type: "slide-delete", id: slide.id });
    }
  });
}

/** Repairs common planner slips so briefs, titles and image placements reach the slide writer. */
function normalizeOps(ops: PlanOp[], assets: Asset[], attachmentIds: string[]) {
  const known = new Set(assets.map((a) => a.id));
  for (const op of ops) {
    if (op.title && (!op.brief || op.title.length > 80)) {
      op.brief = [op.brief, op.title].filter(Boolean).join("\n");
      op.title = op.title.split(/\n|\s+[-–—:]\s+/)[0];
    }
    if (op.title) op.title = op.title.slice(0, 60);
    const mentioned = [...(op.brief ?? "").matchAll(/[A-Za-z]+-[A-Za-z0-9_-]{4,}/g)].map((m) => m[0]).filter((id) => known.has(id));
    op.assetIds = [...new Set([...(op.assetIds ?? []), ...mentioned])].filter((id) => known.has(id));
  }
  // Uploaded this turn but not placed anywhere, with a single obvious target → place it there.
  const targets = ops.filter((o) => o.action === "create" || o.action === "update");
  const unplaced = attachmentIds.filter((id) => !targets.some((o) => o.assetIds?.includes(id)));
  if (unplaced.length && targets.length === 1) targets[0].assetIds = [...(targets[0].assetIds ?? []), ...unplaced];
}

export function sanitizeSlideHtml(html: string, scope: string) {
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(iframe|link|meta|object|embed)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "");
  const start = out.search(/<section\b/i);
  const end = out.toLowerCase().lastIndexOf("</section>");
  if (start >= 0 && end > start) out = out.slice(start, end + "</section>".length);
  else out = `<section class="slide ${scope}">${out}</section>`;
  // Guarantee the root has the slide class.
  out = out.replace(/^<section\b([^>]*)>/i, (m, attrs: string) =>
    /class\s*=\s*["'][^"']*\bslide\b/.test(attrs) ? m : /class\s*=/.test(attrs) ? m.replace(/class\s*=\s*(["'])/, "class=$1slide ") : `<section class="slide"${attrs}>`,
  );
  return out;
}

async function generateImage(prompt: string, theme: Theme, signal: AbortSignal): Promise<Asset | null> {
  const res = await withRetry(async () =>
    (await getGenAI()).models.generateContent({
      model: MODELS.image,
      contents: `${prompt}\n\nStyle: premium editorial presentation imagery, cohesive with a palette of ${theme.colors.accent}, ${theme.colors.accent2} and ${theme.colors.bg}. No text, no letters, no watermarks. 16:9 composition.`,
      config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" }, abortSignal: signal },
    }),
  );
  const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) return null;
  const mime = part.inlineData.mimeType ?? "image/png";
  return {
    id: `img-${nanoid(6)}`,
    name: prompt.slice(0, 60),
    mime,
    dataUrl: `data:${mime};base64,${part.inlineData.data}`,
    width: 1344,
    height: 768,
    source: "generated",
  };
}
