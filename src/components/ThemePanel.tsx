"use client";

import { X } from "lucide-react";
import { THEME_PRESETS } from "@/lib/theme";
import type { Theme, ThemeColors } from "@/lib/types";

const COLOR_LABELS: [keyof ThemeColors, string][] = [
  ["bg", "Background"],
  ["surface", "Surface"],
  ["text", "Text"],
  ["muted", "Muted"],
  ["accent", "Accent"],
  ["accent2", "Accent 2"],
  ["border", "Border"],
];

const FONTS = [
  "Inter",
  "Inter Tight",
  "Plus Jakarta Sans",
  "DM Sans",
  "Manrope",
  "Space Grotesk",
  "Sora",
  "Outfit",
  "IBM Plex Sans",
  "Fraunces",
  "Playfair Display",
  "DM Serif Display",
  "Instrument Serif",
  "Cormorant Garamond",
  "Noto Kufi Arabic",
  "Cairo",
  "Tajawal",
  "IBM Plex Sans Arabic",
];

/** Instant, local restyling — slides use theme tokens so no regeneration is needed. */
export function ThemePanel({ theme, onChange, onClose }: { theme: Theme; onChange: (t: Theme) => void; onClose: () => void }) {
  const fonts = [...new Set([theme.headingFont, theme.bodyFont, ...FONTS])];
  return (
    <div className="absolute right-0 top-12 z-40 w-[360px] rounded-3xl border border-line bg-paper p-5 shadow-[0_24px_70px_-20px_rgba(12,12,13,.35)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[18px] tracking-[-0.02em]"><span className="font-light">Deck </span><span className="font-extrabold">theme.</span></h3>
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-mist">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {THEME_PRESETS.map((t) => (
          <button
            key={t.name}
            title={t.name}
            onClick={() => onChange({ ...t })}
            className={`overflow-hidden rounded-xl transition ${t.name === theme.name ? "ring-2 ring-ember ring-offset-2" : "ring-1 ring-line hover:ring-ink/25"}`}
          >
            <div className="flex h-10 flex-col justify-end gap-0.5 p-1.5" style={{ background: t.colors.bg }}>
              <div className="h-1 w-5 rounded-full" style={{ background: t.colors.accent }} />
              <div className="h-1 w-7 rounded-full" style={{ background: t.colors.text, opacity: 0.8 }} />
            </div>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12.5px] font-medium text-muted">{theme.name}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {COLOR_LABELS.map(([k, label]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 rounded-xl bg-mist px-2.5 py-2 text-[12.5px] text-ink-2 hover:bg-mist-2">
            <input
              type="color"
              value={theme.colors[k].slice(0, 7)}
              onChange={(e) => onChange({ ...theme, name: "Custom", colors: { ...theme.colors, [k]: e.target.value } })}
              className="size-5 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            {label}
          </label>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-[12.5px] text-ink-2">
        {(["headingFont", "bodyFont"] as const).map((k) => (
          <label key={k} className="space-y-1">
            <span>{k === "headingFont" ? "Heading font" : "Body font"}</span>
            <select
              value={theme[k]}
              onChange={(e) => onChange({ ...theme, [k]: e.target.value })}
              className="w-full rounded-xl bg-mist px-2.5 py-2 text-ink focus:outline-none"
            >
              {fonts.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <label className="mt-4 block text-[12.5px] text-ink-2">
        Corner radius · {theme.radius}px
        <input type="range" min={0} max={40} value={theme.radius} onChange={(e) => onChange({ ...theme, radius: +e.target.value })} className="mt-1 w-full accent-[#F26A21]" />
      </label>
      <p className="mt-3 rounded-xl bg-ember-50 px-3 py-2 text-[12px] leading-relaxed text-ember-600">Tip: ask in chat — e.g. “use the colors from https://kockw.com” — to derive a theme from a website.</p>
    </div>
  );
}
