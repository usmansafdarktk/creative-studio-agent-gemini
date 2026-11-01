"use client";

import { ArrowRight, ArrowUp, ChevronDown, ImagePlus, Link2, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import type { DeckMeta } from "@/lib/store";
import { THEME_PRESETS } from "@/lib/theme";
import type { Theme } from "@/lib/types";
import { Logo } from "./Logo";

const EXAMPLES = [
  { tag: "Board update", text: "Board update on Q3 upstream production: output vs target, key risks, and 2027 priorities. 10 slides, executive tone." },
  { tag: "Pitch", text: "Pitch deck for an AI assistant that helps field engineers diagnose equipment faults from photos." },
  { tag: "Training", text: "Training deck: 7 golden rules of workplace safety, with a quiz slide at the end." },
  { tag: "Brand", text: "A deck about our company using the brand from https://www.kockw.com" },
];

interface Props {
  onStart: (text: string, files: File[], theme?: Theme) => void;
  decks: DeckMeta[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function Landing({ onStart, decks, onOpen, onDelete }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [style, setStyle] = useState<string>("auto");
  const [count, setCount] = useState<string>("auto");
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!text.trim()) return;
    const preset = THEME_PRESETS.find((t) => t.name === style);
    const extras = [
      count !== "auto" && `Make exactly ${count} slides.`,
      preset && `Use the "${preset.name}" theme exactly as currently set (don't return a new theme).`,
    ].filter(Boolean);
    onStart([text.trim(), ...extras].join("\n\n"), files, preset);
  };

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-paper text-ink">
      {/* Nav */}
      <header className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-6 md:px-10">
        <Logo />
        <nav className="hidden items-center gap-1 rounded-2xl bg-mist p-1 text-[14px] md:flex">
          <button onClick={() => taRef.current?.focus()} className="rounded-xl bg-paper px-4 py-2 font-semibold shadow-sm">
            Create
          </button>
          <button onClick={() => document.getElementById("ideas")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl px-4 py-2 text-ink-2 hover:text-ink">
            Ideas
          </button>
          {decks.length > 0 && (
            <button onClick={() => document.getElementById("recent")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl px-4 py-2 text-ink-2 hover:text-ink">
              Your decks
            </button>
          )}
        </nav>
        <button
          onClick={() => taRef.current?.focus()}
          className="flex items-center gap-3 rounded-2xl bg-mist py-1.5 pl-4 pr-1.5 text-[14px] font-semibold hover:bg-mist-2"
        >
          New deck
          <span className="grid size-8 place-items-center rounded-xl bg-ember text-white">
            <ArrowRight className="size-4" />
          </span>
        </button>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1240px] px-6 pt-10 text-center md:px-10 md:pt-16">
        <div className="fade-up mx-auto mb-7 flex w-fit items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3.5 text-[13px] text-ink-2">
          <span className="rounded-full bg-ember-50 px-2.5 py-0.5 font-semibold text-ember-600">New</span>
          Gemini 3.1 Pro on Vertex AI
        </div>
        <h1 className="fade-up text-[44px] leading-[1.02] tracking-[-0.035em] md:text-[84px]" style={{ animationDelay: "60ms" }}>
          <span className="font-light">Slides that look</span>
          <br />
          <span className="font-extrabold">
            designed<span className="text-ember">.</span> Not generated<span className="text-ember">.</span>
          </span>
        </h1>
        <p className="fade-up mx-auto mt-6 max-w-[620px] text-[17px] leading-relaxed text-muted md:text-[19px]" style={{ animationDelay: "120ms" }}>
          Describe the story, borrow a brand from any website, drop in your images — then refine any slide or sentence just by
          clicking on it.
        </p>

        {/* Composer */}
        <div
          className="fade-up mx-auto mt-10 max-w-[820px] rounded-[28px] border border-line bg-paper p-2 text-left shadow-[0_24px_80px_-28px_rgba(12,12,13,.22)] transition focus-within:border-ember/50 focus-within:shadow-[0_24px_80px_-28px_rgba(242,106,33,.35)]"
          style={{ animationDelay: "180ms" }}
        >
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-3">
              {files.map((f, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded-xl bg-mist py-1 pl-2.5 pr-1 text-[13px] text-ink-2">
                  <ImagePlus className="size-3.5" /> {f.name}
                  <button onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="rounded-lg p-0.5 hover:bg-mist-2">
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            ref={taRef}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={3}
            placeholder="What's your presentation about?"
            className="block w-full resize-none bg-transparent px-4 py-3.5 text-[17px] leading-relaxed placeholder:text-faint focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-1 px-1.5 pb-1">
            <PillBtn onClick={() => fileRef.current?.click()}>
              <ImagePlus className="size-4" /> Images
            </PillBtn>
            <PillBtn onClick={() => setText((t) => (t ? t + "\n" : "") + "Use the brand from https://")}>
              <Link2 className="size-4" /> Brand from URL
            </PillBtn>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && setFiles((x) => [...x, ...e.target.files!])} />
            <label className="relative flex items-center rounded-xl text-[14px] text-ink-2 hover:bg-mist">
              <select value={count} onChange={(e) => setCount(e.target.value)} className="appearance-none bg-transparent py-2 pl-3 pr-7 focus:outline-none">
                <option value="auto">Auto length</option>
                {[5, 8, 10, 12, 15].map((n) => (
                  <option key={n} value={n}>
                    {n} slides
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted" />
            </label>
            <div className="flex-1" />
            <button
              onClick={submit}
              disabled={!text.trim()}
              className="flex items-center gap-2 rounded-2xl bg-ink py-2 pl-5 pr-2 text-[15px] font-semibold text-white transition hover:bg-black disabled:opacity-25"
            >
              Generate
              <span className="grid size-7 place-items-center rounded-xl bg-ember">
                <ArrowUp className="size-4" />
              </span>
            </button>
          </div>
        </div>

        {/* Styles */}
        <div className="fade-up mt-6 flex flex-wrap items-center justify-center gap-2" style={{ animationDelay: "240ms" }}>
          <span className="mr-1 text-[13px] text-faint">Style</span>
          <StyleChip active={style === "auto"} onClick={() => setStyle("auto")} label="Auto" />
          {THEME_PRESETS.map((t) => (
            <StyleChip key={t.name} active={style === t.name} onClick={() => setStyle(t.name)} label={t.name} swatch={[t.colors.bg, t.colors.accent, t.colors.accent2]} />
          ))}
        </div>
      </section>

      {/* Slide fan */}
      <SlideFan />

      {/* Examples + recents */}
      <section id="ideas" className="mx-auto max-w-[1240px] scroll-mt-8 px-6 pb-24 md:px-10">
        <h2 className="text-[28px] tracking-[-0.03em] md:text-[36px]">
          <span className="font-light">Start from an </span>
          <span className="font-extrabold">idea.</span>
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.tag}
              onClick={() => {
                setText(ex.text);
                taRef.current?.focus();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="group flex flex-col justify-between rounded-3xl bg-mist p-5 text-left transition hover:bg-mist-2"
            >
              <span className="text-[13px] font-semibold text-ember-600">{ex.tag}</span>
              <span className="mt-3 text-[15px] leading-relaxed text-ink-2">{ex.text}</span>
              <span className="mt-5 grid size-8 place-items-center rounded-xl bg-paper text-ink transition group-hover:bg-ember group-hover:text-white">
                <ArrowRight className="size-4" />
              </span>
            </button>
          ))}
        </div>

        {decks.length > 0 && (
          <div id="recent" className="mt-16 scroll-mt-8">
            <h2 className="text-[28px] tracking-[-0.03em] md:text-[36px]">
              <span className="font-light">Pick up </span>
              <span className="font-extrabold">where you left off.</span>
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {decks.map((d, i) => (
                <div key={d.id} className="group flex items-center gap-4 rounded-3xl border border-line p-4 transition hover:border-ink/15 hover:shadow-[0_12px_40px_-20px_rgba(12,12,13,.25)]">
                  <span
                    className="grid size-12 shrink-0 place-items-center rounded-2xl text-[15px] font-extrabold text-white"
                    style={{ background: FAMILY[i % FAMILY.length] }}
                  >
                    {d.slideCount}
                  </span>
                  <button onClick={() => onOpen(d.id)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[15px] font-semibold">{d.title}</div>
                    <div className="text-[13px] text-muted">
                      {d.slideCount} slides · {new Date(d.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                  <button onClick={() => onDelete(d.id)} className="rounded-xl p-2 text-faint opacity-0 hover:bg-mist hover:text-ink group-hover:opacity-100">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

const FAMILY = ["#F26A21", "#F2507B", "#F7C531", "#2F6BFF", "#9A5CF0", "#20B37A"];

/** A playful fan of sample slides — the "cast" of the product. */
function SlideFan() {
  const cards = [
    { bg: "#F2507B", fg: "#fff", r: -9, y: 40, kind: "kpi" },
    { bg: "#F7C531", fg: "#0C0C0D", r: -4, y: 12, kind: "title" },
    { bg: "#F26A21", fg: "#fff", r: 0, y: 0, kind: "hero" },
    { bg: "#9A5CF0", fg: "#fff", r: 4, y: 12, kind: "chart" },
    { bg: "#2F6BFF", fg: "#fff", r: 9, y: 40, kind: "cards" },
  ] as const;
  return (
    <section className="relative mx-auto mt-16 h-[230px] max-w-[1240px] overflow-hidden px-6 md:mt-20 md:h-[330px]">
      <div className="flex items-start justify-center">
        {cards.map((c, i) => (
          <div
            key={i}
            className="fan-card -mx-6 aspect-[16/10] w-[38vw] max-w-[340px] shrink-0 rounded-[22px] p-5 shadow-[0_30px_60px_-25px_rgba(12,12,13,.45)] md:-mx-5 md:p-7"
            style={{ background: c.bg, color: c.fg, ["--r" as string]: `${c.r}deg`, marginTop: c.y, zIndex: i === 2 ? 5 : 5 - Math.abs(2 - i), animationDelay: `${300 + i * 80}ms` }}
          >
            <FanContent kind={c.kind} />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-paper to-transparent" />
    </section>
  );
}

function FanContent({ kind }: { kind: string }) {
  const line = (w: string, o = 0.35) => <div className="h-2 rounded-full bg-current" style={{ width: w, opacity: o }} />;
  if (kind === "hero")
    return (
      <div className="flex h-full flex-col justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">Q3 Review</div>
        <div>
          <div className="text-[22px] font-light leading-none md:text-[30px]">Growth that</div>
          <div className="text-[22px] font-extrabold leading-tight md:text-[30px]">compounds.</div>
        </div>
        <div className="space-y-1.5">{line("60%")}{line("40%")}</div>
      </div>
    );
  if (kind === "kpi")
    return (
      <div className="flex h-full flex-col justify-between">
        {line("40%", 0.5)}
        <div className="text-[40px] font-extrabold leading-none md:text-[56px]">38%</div>
        <div className="space-y-1.5">{line("70%")}{line("50%")}</div>
      </div>
    );
  if (kind === "chart")
    return (
      <div className="flex h-full flex-col justify-between">
        {line("50%", 0.6)}
        <div className="flex h-[55%] items-end gap-2">
          {[40, 55, 48, 72, 90].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-md bg-current" style={{ height: `${h}%`, opacity: i === 4 ? 1 : 0.4 }} />
          ))}
        </div>
      </div>
    );
  if (kind === "cards")
    return (
      <div className="flex h-full flex-col justify-between">
        {line("55%", 0.6)}
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-square rounded-xl bg-white/20 p-2">
              <div className="size-3 rounded-full bg-white/80" />
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <div className="flex h-full flex-col justify-end gap-2">
      <div className="text-[24px] font-extrabold leading-none md:text-[32px]">Hello,</div>
      <div className="text-[24px] font-light leading-none md:text-[32px]">world.</div>
    </div>
  );
}

function PillBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[14px] text-ink-2 hover:bg-mist">
      {children}
    </button>
  );
}

function StyleChip({ active, onClick, label, swatch }: { active: boolean; onClick: () => void; label: string; swatch?: string[] }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13.5px] transition ${
        active ? "bg-ink font-semibold text-white" : "bg-mist text-ink-2 hover:bg-mist-2"
      }`}
    >
      {swatch && (
        <span className="flex -space-x-1">
          {swatch.map((c, i) => (
            <span key={i} className="size-3 rounded-full ring-2 ring-white/80" style={{ background: c }} />
          ))}
        </span>
      )}
      {label}
    </button>
  );
}
