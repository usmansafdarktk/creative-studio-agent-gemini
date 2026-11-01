"use client";

import {
  ArrowDown,
  ArrowUp,
  Code2,
  Copy,
  Download,
  FileDown,
  Loader2,
  Palette,
  Play,
  Redo2,
  Trash2,
  Undo2,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildPrintDeck, buildStandaloneDeck } from "@/lib/slide-html";
import type { Deck, Theme } from "@/lib/types";
import { SelectionToolbar } from "./SelectionToolbar";
import { SlideFrame, type FrameMessage } from "./SlideFrame";
import { ThemePanel } from "./ThemePanel";

export interface Selection {
  slideId: string;
  eid?: string;
  tag?: string;
  text?: string;
  selectedText?: string;
  outerHtml?: string;
  isRoot?: boolean;
  rect?: { x: number; y: number; w: number; h: number };
}

interface SlideOps {
  move: (id: string, dir: -1 | 1) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  setHtml: (id: string, html: string) => void;
  redesign: (id: string) => void;
}

interface Props {
  deck: Deck;
  busy: boolean;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  elementBusy: boolean;
  onRewrite: (instruction: string) => void;
  onEditElement: (instruction: string) => void;
  onDeleteElement: () => void;
  onAskInChat: (s: Selection) => void;
  onTextEdited: (slideId: string, eid: string, html: string) => void;
  editingEid: string | null;
  onStartTextEdit: (eid: string | null) => void;
  slideOps: SlideOps;
  onTitle: (t: string) => void;
  onTheme: (t: Theme) => void;
  onPresent: (index: number) => void;
  onUndo: () => void;
  onRedo: () => void;
}

function download(name: string, content: string, type = "text/html") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function Canvas(p: Props) {
  const { deck } = p;
  const [themeOpen, setThemeOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const frames = useRef(new Map<string, HTMLIFrameElement>());
  const cards = useRef(new Map<string, HTMLDivElement>());
  const [scales, setScales] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track which slide is in view for the thumbnail rail.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            const i = deck.slides.findIndex((s) => s.id === (e.target as HTMLElement).dataset.slide);
            if (i >= 0) setActive(i);
          }
      },
      { root, threshold: 0.6 },
    );
    cards.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [deck.slides]);

  const onFrameMessage = useCallback(
    (slideId: string, m: FrameMessage) => {
      if (m.type === "select") {
        p.onSelect({ slideId, eid: m.eid, tag: m.tag, text: m.text, selectedText: m.selectedText, outerHtml: m.outerHtml, isRoot: m.isRoot, rect: m.rect });
      } else if (m.type === "deselect") {
        p.onSelect(null);
      } else if (m.type === "text" && m.eid && m.html !== undefined) {
        p.onTextEdited(slideId, m.eid, m.html);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.onSelect, p.onTextEdited],
  );

  const startTextEdit = () => {
    if (!p.selection?.eid) return;
    frames.current.get(p.selection.slideId)?.contentWindow?.postMessage({ type: "edit-text", eid: p.selection.eid }, "*");
    p.onStartTextEdit(p.selection.eid);
  };

  const exportHtml = () => download(`${deck.title || "deck"}.html`, buildStandaloneDeck(deck.title, deck.theme, deck.slides.map((s) => s.html), deck.assets));
  const exportPdf = () => {
    const url = URL.createObjectURL(new Blob([buildPrintDeck(deck.title, deck.theme, deck.slides.map((s) => s.html), deck.assets)], { type: "text/html" }));
    window.open(url, "_blank");
  };

  const generatingCount = deck.slides.filter((s) => s.generating).length;

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-canvas">
      {/* Top bar */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-paper px-5">
        <input
          value={deck.title}
          onChange={(e) => p.onTitle(e.target.value)}
          placeholder="Untitled deck"
          className="min-w-0 max-w-md flex-1 rounded-xl bg-transparent px-2.5 py-1.5 text-[17px] font-bold tracking-[-0.02em] placeholder:text-faint hover:bg-mist focus:bg-mist focus:outline-none"
        />
        {p.busy && (
          <span className="flex items-center gap-2 rounded-xl bg-ember-50 px-3 py-1.5 text-[13px] font-semibold text-ember-600">
            <Loader2 className="size-3.5 animate-spin" />
            {generatingCount ? `Designing ${generatingCount} slide${generatingCount > 1 ? "s" : ""}` : "Thinking"}
          </span>
        )}
        <div className="flex-1" />
        <div className="flex items-center rounded-xl bg-mist p-0.5">
          <IconBtn title="Undo (⌘Z)" onClick={p.onUndo}>
            <Undo2 className="size-4" />
          </IconBtn>
          <IconBtn title="Redo (⇧⌘Z)" onClick={p.onRedo}>
            <Redo2 className="size-4" />
          </IconBtn>
        </div>
        <div className="relative">
          <button onClick={() => setThemeOpen((v) => !v)} className="flex items-center gap-2 rounded-xl bg-mist px-3 py-2 text-[14px] font-medium hover:bg-mist-2">
            <span className="flex -space-x-1">
              {[deck.theme.colors.bg, deck.theme.colors.accent, deck.theme.colors.accent2].map((c, i) => (
                <span key={i} className="size-3.5 rounded-full ring-2 ring-mist" style={{ background: c }} />
              ))}
            </span>
            <Palette className="size-4 text-ink-2" /> Theme
          </button>
          {themeOpen && <ThemePanel theme={deck.theme} onChange={p.onTheme} onClose={() => setThemeOpen(false)} />}
        </div>
        <div className="relative">
          <button onClick={() => setExportOpen((v) => !v)} className="flex items-center gap-2 rounded-xl bg-mist px-3 py-2 text-[14px] font-medium hover:bg-mist-2">
            <Download className="size-4 text-ink-2" /> Export
          </button>
          {exportOpen && (
            <div
              className="absolute right-0 top-12 z-40 w-64 rounded-2xl border border-line bg-paper p-1.5 shadow-[0_20px_60px_-20px_rgba(12,12,13,.3)]"
              onMouseLeave={() => setExportOpen(false)}
            >
              <MenuItem
                onClick={() => {
                  exportHtml();
                  setExportOpen(false);
                }}
                icon={<Code2 className="size-4" />}
                label="HTML presentation"
                hint="Single file, works offline"
              />
              <MenuItem
                onClick={() => {
                  exportPdf();
                  setExportOpen(false);
                }}
                icon={<FileDown className="size-4" />}
                label="PDF"
                hint="Opens print → Save as PDF"
              />
            </div>
          )}
        </div>
        <button
          onClick={() => p.onPresent(active)}
          disabled={!deck.slides.length}
          className="ml-1 flex items-center gap-2.5 rounded-xl bg-ink py-1.5 pl-4 pr-1.5 text-[14px] font-semibold text-white transition hover:bg-black disabled:opacity-30"
        >
          Present
          <span className="grid size-7 place-items-center rounded-[10px] bg-ember">
            <Play className="size-3.5 fill-current" />
          </span>
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Thumbnail rail */}
        <nav className="w-[176px] shrink-0 space-y-3 overflow-y-auto border-r border-line bg-paper p-3">
          {deck.slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => cards.current.get(s.id)?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="group flex w-full gap-2 text-left"
            >
              <span className={`w-4 pt-0.5 text-right text-[11px] font-semibold tabular-nums ${i === active ? "text-ember" : "text-faint"}`}>{i + 1}</span>
              <div
                className={`relative flex-1 overflow-hidden rounded-lg transition ${
                  i === active ? "ring-2 ring-ember ring-offset-2 ring-offset-paper" : "ring-1 ring-line group-hover:ring-ink/20"
                }`}
              >
                {s.html ? <SlideFrame html={s.html} theme={deck.theme} assets={deck.assets} /> : <div className="aspect-video animate-pulse bg-mist" />}
                {s.generating && <div className="absolute inset-0 animate-pulse bg-ember/10" />}
              </div>
            </button>
          ))}
        </nav>

        {/* Slides */}
        <div
          ref={scrollRef}
          className="canvas-bg min-w-0 flex-1 overflow-y-auto px-10 py-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) p.onSelect(null);
          }}
        >
          {!deck.slides.length && (
            <div className="grid h-full place-items-center">
              <div className="text-center">
                <div className="mx-auto flex w-fit gap-1.5">
                  {["#F26A21", "#F7C531", "#F2507B", "#2F6BFF"].map((c, i) => (
                    <span key={c} className="size-3 animate-bounce rounded-full" style={{ background: c, animationDelay: `${i * 110}ms` }} />
                  ))}
                </div>
                <p className="mt-5 text-[22px] tracking-[-0.02em]">
                  <span className="font-light">Planning your </span>
                  <span className="font-extrabold">deck.</span>
                </p>
                <p className="mt-1 text-[14px] text-muted">Outline, theme and layouts first — slides stream in next.</p>
              </div>
            </div>
          )}
          <div className="mx-auto max-w-[1180px] space-y-10">
            {deck.slides.map((s, i) => {
              const sel = p.selection?.slideId === s.id ? p.selection : null;
              const scale = scales[s.id] ?? 0.5;
              return (
                <div key={s.id} data-slide={s.id} ref={(el) => void (el ? cards.current.set(s.id, el) : cards.current.delete(s.id))} className="group/card">
                  <div className="mb-2.5 flex items-center gap-2.5 px-1">
                    <span className="grid h-6 min-w-6 place-items-center rounded-lg bg-paper px-1.5 text-[12px] font-bold tabular-nums shadow-sm ring-1 ring-line">
                      {i + 1}
                    </span>
                    <span className="truncate text-[14px] font-medium text-ink-2">{s.title}</span>
                    {s.generating && (
                      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ember-600">
                        <Loader2 className="size-3.5 animate-spin" /> designing
                      </span>
                    )}
                    <div className="flex-1" />
                    <div className="flex items-center gap-0.5 rounded-xl bg-paper p-0.5 opacity-0 shadow-sm ring-1 ring-line transition group-hover/card:opacity-100">
                      <IconBtn small title="Redesign with AI" onClick={() => p.slideOps.redesign(s.id)} disabled={p.busy}>
                        <Wand2 className="size-3.5" />
                      </IconBtn>
                      <IconBtn small title="View / edit code" onClick={() => setCodeFor(codeFor === s.id ? null : s.id)} active={codeFor === s.id}>
                        <Code2 className="size-3.5" />
                      </IconBtn>
                      <IconBtn small title="Move up" onClick={() => p.slideOps.move(s.id, -1)} disabled={i === 0}>
                        <ArrowUp className="size-3.5" />
                      </IconBtn>
                      <IconBtn small title="Move down" onClick={() => p.slideOps.move(s.id, 1)} disabled={i === deck.slides.length - 1}>
                        <ArrowDown className="size-3.5" />
                      </IconBtn>
                      <IconBtn small title="Duplicate" onClick={() => p.slideOps.duplicate(s.id)}>
                        <Copy className="size-3.5" />
                      </IconBtn>
                      <IconBtn small title="Delete slide" onClick={() => p.slideOps.remove(s.id)}>
                        <Trash2 className="size-3.5" />
                      </IconBtn>
                    </div>
                  </div>

                  <div
                    className={`relative rounded-2xl shadow-[0_24px_60px_-28px_rgba(12,12,13,.35)] transition ${sel ? "ring-2 ring-ember" : "ring-1 ring-black/5"} ${
                      s.generating ? "generating" : ""
                    }`}
                  >
                    <div className="overflow-hidden rounded-2xl">
                      {s.html ? (
                        <SlideFrame
                          html={s.html}
                          theme={deck.theme}
                          assets={deck.assets}
                          interactive={!s.generating}
                          selectedEid={sel?.eid ?? null}
                          onMessage={(m) => onFrameMessage(s.id, m)}
                          onScale={(sc) => setScales((x) => (x[s.id] === sc ? x : { ...x, [s.id]: sc }))}
                          frameRef={(el) => void (el ? frames.current.set(s.id, el) : frames.current.delete(s.id))}
                        />
                      ) : (
                        <div className="relative aspect-video overflow-hidden" style={{ background: deck.theme.colors.bg }}>
                          <div className="skeleton absolute inset-0" />
                          <div className="absolute bottom-8 left-10 text-[15px] font-medium" style={{ color: deck.theme.colors.muted }}>
                            {s.title || "Designing…"}
                          </div>
                        </div>
                      )}
                    </div>

                    {sel && sel.rect && !s.generating && (
                      <SelectionToolbar
                        key={sel.eid}
                        selection={sel}
                        scale={scale}
                        busy={p.elementBusy}
                        onRewrite={p.onRewrite}
                        onEdit={p.onEditElement}
                        onEditText={startTextEdit}
                        onDelete={p.onDeleteElement}
                        onAskInChat={() => p.onAskInChat(sel)}
                        onRedesign={() => p.slideOps.redesign(s.id)}
                        onClose={() => p.onSelect(null)}
                      />
                    )}
                  </div>

                  {codeFor === s.id && <CodeEditor html={s.html} onApply={(h) => p.slideOps.setHtml(s.id, h)} />}
                </div>
              );
            })}
          </div>
          <div className="h-24" />
        </div>
      </div>
    </main>
  );
}

function CodeEditor({ html, onApply }: { html: string; onApply: (h: string) => void }) {
  const [val, setVal] = useState(html);
  const [prev, setPrev] = useState(html);
  if (prev !== html) {
    setPrev(html);
    setVal(html);
  }
  return (
    <div className="mt-3 overflow-hidden rounded-2xl bg-ink shadow-lg">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[12.5px] text-white/50">
        <span className="font-mono">slide.html</span>
        <button disabled={val === html} onClick={() => onApply(val)} className="rounded-lg bg-ember px-3 py-1 font-semibold text-white disabled:opacity-30">
          Apply
        </button>
      </div>
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        spellCheck={false}
        className="block h-80 w-full resize-y bg-transparent p-4 font-mono text-[12px] leading-relaxed text-white/85 focus:outline-none"
      />
    </div>
  );
}

function IconBtn(props: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; small?: boolean; active?: boolean }) {
  return (
    <button
      title={props.title}
      onClick={props.onClick}
      disabled={props.disabled}
      className={`grid place-items-center rounded-[10px] text-ink-2 transition hover:bg-paper hover:text-ink disabled:opacity-30 ${props.small ? "size-7 hover:bg-mist" : "size-8"} ${
        props.active ? "bg-ember-50 text-ember-600" : ""
      }`}
    >
      {props.children}
    </button>
  );
}

function MenuItem(props: { onClick: () => void; icon: React.ReactNode; label: string; hint: string }) {
  return (
    <button onClick={props.onClick} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-mist">
      <span className="mt-0.5 grid size-8 place-items-center rounded-lg bg-mist text-ink-2">{props.icon}</span>
      <span>
        <span className="block text-[14px] font-semibold">{props.label}</span>
        <span className="block text-[12.5px] text-muted">{props.hint}</span>
      </span>
    </button>
  );
}
