# Falcon Studio — AI slide generation on Vertex AI (Gemini)

Chat on the left, live slides on the right. Each slide is real **HTML/CSS** (not an image), so anything can be
edited precisely: click an element → *Rewrite with Gemini* / *Edit with AI* / double-click to type, or ask in chat.

## Run locally

```bash
gcloud auth login                       # any account with Vertex AI access on koc-dev-app-falcon-0
npm install
npm run dev                             # http://localhost:3000
```

The server gets a token from the `gcloud` CLI (`GOOGLE_AUTH_MODE=adc` switches to Application Default Credentials).
Project/models are configurable — see `.env.example`.

## What it does

| Capability | How |
|---|---|
| Generate a deck from a short or detailed prompt | Planner (Gemini 3.1 Pro) → outline + theme + per-slide briefs → slides written **in parallel**, streamed live |
| Iterate by chat | Planner decides create / update / delete / move ops; only affected slides are rewritten |
| Theme from a website | Paste a URL — the server extracts colors, CSS variables, fonts, text and logo, then derives a theme |
| Place uploaded images on a specific slide | Attach (button, paste or drag-drop) + "put this on slide 3" |
| Rewrite selected text | Click an element (or highlight part of it) → *Rewrite with Gemini* with presets (shorter, formal, Arabic, …) |
| Restyle an element | *Edit with AI* → returns new HTML for just that element |
| Instant restyle | Theme panel (presets, colors, fonts, radius) — slides use CSS tokens, so no regeneration |
| Generated imagery | Planner can request images (`gemini-2.5-flash-image`) when useful |
| Code view, undo/redo, present, export | Per-slide HTML editor, ⌘Z / ⇧⌘Z, fullscreen presenter, standalone HTML and PDF (print) |

Decks are saved in the browser (IndexedDB).

## Architecture

```
src/
  app/api/agent/route.ts      NDJSON stream of agent events (status, theme, slide-partial, slide, …)
  app/api/edit/route.ts       fast element-scoped rewrite/edit (Gemini 3.5 Flash)
  lib/server/agent.ts         planner → image gen → parallel slide writers (+ plan repair)
  lib/server/design-skill.ts  the "design skill": canvas contract, typography, 13 layout archetypes, craft rules
  lib/server/site-brand.ts    website → brand tokens + logo
  lib/server/gemini.ts        Vertex client, auth, retries
  lib/slide-html.ts           sandboxed iframe shell + selection bridge, export builders
  components/                 Studio, ChatPanel, Canvas, SelectionToolbar, ThemePanel, PresentMode, Landing
```

**Slide contract:** one `<section class="slide">` at 1920×1080, styled only through theme tokens
(`var(--accent)`, `var(--font-heading)` …). Images use `asset:ID` placeholders that are resolved client-side. Every
element gets a `data-eid`, which is what makes click-to-edit and element-scoped AI edits possible.

**Quality lever:** `design-skill.ts`. Add brand-specific rules or new layout archetypes there.

## Deploy (Cloud Run)

```bash
gcloud run deploy falcon-studio --source . --project koc-dev-app-falcon-0 --region me-central1 \
  --no-allow-unauthenticated --timeout 300 --memory 1Gi
```

The Cloud Run service account needs `roles/aiplatform.user`. On Cloud Run, ADC is used automatically.
