"use client";

import { ArrowUp, Check, ChevronDown, Crosshair, ImagePlus, Link2, Plus, Sparkles, Square, X, Zap } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { fileToAsset, type DeckMeta } from "@/lib/store";
import type { Asset, Deck, ModelTier, SelectionContext } from "@/lib/types";
import { LogoMark } from "./Logo";

interface Props {
  deck: Deck;
  busy: boolean;
  tier: ModelTier;
  onTier: (t: ModelTier) => void;
  onSend: (text: string, attachments: Asset[]) => void;
  onStop: () => void;
  context: SelectionContext | null;
  onClearContext: () => void;
  decks: DeckMeta[];
  onOpenDeck: (id: string) => void;
  onNewDeck: () => void;
}

const SUGGESTIONS = [
  "Make the whole deck feel more premium and minimal",
  "Add a slide with a bar chart comparing the key numbers",
  "Translate the deck to Arabic (RTL)",
  "Use the theme from https://www.apple.com",
];

export function ChatPanel(p: Props) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Asset[]>([]);
  const [deckMenu, setDeckMenu] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const assetsById = new Map(p.deck.assets.map((a) => [a.id, a]));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [p.deck.messages]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 220) + "px";
  }, [text]);

  const addFiles = async (files: FileList | File[]) => {
    const imgs = [...files].filter((f) => f.type.startsWith("image/"));
    const assets = await Promise.all(imgs.map((f) => fileToAsset(f, `up-${nanoid(6)}`)));
    setPending((x) => [...x, ...assets]);
  };

  const submit = () => {
    if (!text.trim() || p.busy) return;
    p.onSend(text.trim(), pending);
    setText("");
    setPending([]);
  };

  return (
    <aside
      className="relative flex h-full w-[420px] shrink-0 flex-col border-r border-line bg-paper"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      {/* Header */}
      <header className="flex h-16 items-center gap-2.5 px-4">
        <button onClick={p.onNewDeck} title="Home" className="shrink-0">
          <LogoMark size={30} />
        </button>
        <div className="relative min-w-0 flex-1">
          <button onClick={() => setDeckMenu((v) => !v)} className="flex max-w-full items-center gap-1 rounded-xl px-2 py-1.5 text-left hover:bg-mist">
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{p.deck.title || "New deck"}</span>
            <ChevronDown className="size-4 shrink-0 text-muted" />
          </button>
          {deckMenu && (
            <div
              className="absolute left-0 top-11 z-40 w-80 rounded-2xl border border-line bg-paper p-1.5 shadow-[0_20px_60px_-20px_rgba(12,12,13,.3)]"
              onMouseLeave={() => setDeckMenu(false)}
            >
              <button
                onClick={() => {
                  setDeckMenu(false);
                  p.onNewDeck();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-semibold hover:bg-mist"
              >
                <span className="grid size-6 place-items-center rounded-lg bg-ember text-white">
                  <Plus className="size-3.5" />
                </span>
                New deck
              </button>
              <div className="my-1 h-px bg-line" />
              <div className="max-h-72 overflow-y-auto">
                {p.decks.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setDeckMenu(false);
                      p.onOpenDeck(d.id);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[14px] hover:bg-mist ${d.id === p.deck.id ? "bg-mist" : ""}`}
                  >
                    <span className="truncate">{d.title}</span>
                    <span className="shrink-0 text-[12px] text-muted">{d.slideCount} slides</span>
                  </button>
                ))}
                {!p.decks.length && <p className="px-3 py-2 text-[13px] text-muted">No saved decks yet</p>}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-2">
        {p.deck.messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-10 space-y-2">
              {m.context && (
                <div className="ml-auto flex w-fit items-center gap-1 rounded-lg bg-ember-50 px-2 py-0.5 text-[12px] font-medium text-ember-600">
                  <Crosshair className="size-3" />
                  Slide {m.context.slideIndex + 1}
                  {m.context.tag ? ` · <${m.context.tag}>` : ""}
                </div>
              )}
              {!!m.attachments?.length && (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {m.attachments.map((id) => {
                    const a = assetsById.get(id);
                    // eslint-disable-next-line @next/next/no-img-element
                    return a ? <img key={id} src={a.dataUrl} alt={a.name} className="size-16 rounded-2xl object-cover ring-1 ring-line" /> : null;
                  })}
                </div>
              )}
              <div className="ml-auto w-fit max-w-full whitespace-pre-wrap rounded-[20px] rounded-br-md bg-ink px-4 py-2.5 text-[14.5px] leading-relaxed text-white">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="space-y-3">
              {!!m.activity?.length && (
                <div className="space-y-1.5 rounded-2xl bg-mist/70 p-3">
                  {m.activity.map((a, i) => {
                    const done = a.startsWith("✓");
                    return (
                      <div key={i} className={`flex items-start gap-2 text-[13px] ${done ? "text-ink-2" : "text-muted"}`}>
                        {done ? (
                          <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-ember text-white">
                            <Check className="size-2.5" strokeWidth={3} />
                          </span>
                        ) : (
                          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-faint" />
                        )}
                        <span>{done ? a.slice(2) : a}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {m.text ? (
                <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">{m.text}</p>
              ) : (
                p.busy &&
                m.id === p.deck.messages.at(-1)?.id && (
                  <div className="flex items-center gap-2.5 text-[14px]">
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="size-1.5 animate-bounce rounded-full bg-ember" style={{ animationDelay: `${i * 120}ms` }} />
                      ))}
                    </span>
                    <span className="shimmer-text font-medium">Working on it</span>
                  </div>
                )
              )}
              {m.error && <p className="rounded-2xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{m.error}</p>}
            </div>
          ),
        )}
        {!p.busy && p.deck.slides.length > 0 && p.deck.messages.length <= 2 && (
          <div className="space-y-2 pt-2">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-faint">Try next</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => setText(s)} className="block w-full rounded-2xl bg-mist px-4 py-2.5 text-left text-[13.5px] text-ink-2 transition hover:bg-mist-2 hover:text-ink">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="p-3 pt-0">
        <div className="rounded-[22px] border border-line bg-paper shadow-[0_8px_30px_-12px_rgba(12,12,13,.15)] transition focus-within:border-ember/50">
          {(p.context || pending.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 px-3 pt-3">
              {p.context && (
                <span className="flex items-center gap-1 rounded-lg bg-ember-50 py-0.5 pl-2 pr-1 text-[12.5px] font-medium text-ember-600">
                  <Crosshair className="size-3" />
                  Slide {p.context.slideIndex + 1}
                  {p.context.tag ? ` · ${p.context.selectedText ? `"${p.context.selectedText.slice(0, 24)}…"` : `<${p.context.tag}>`}` : ""}
                  <button onClick={p.onClearContext} className="rounded-md p-0.5 hover:bg-ember-100">
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {pending.map((a) => (
                <span key={a.id} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.dataUrl} alt={a.name} className="size-12 rounded-xl object-cover ring-1 ring-line" />
                  <button
                    onClick={() => setPending((x) => x.filter((y) => y.id !== a.id))}
                    className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-ink p-0.5 text-white group-hover:block"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            id="composer"
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            onPaste={(e) => {
              const files = [...e.clipboardData.files];
              if (files.length) {
                e.preventDefault();
                addFiles(files);
              }
            }}
            rows={1}
            placeholder={p.context ? "What should change here?" : "Ask for changes, paste a link, drop images…"}
            className="block max-h-[220px] w-full resize-none bg-transparent px-4 py-3.5 text-[14.5px] leading-relaxed placeholder:text-faint focus:outline-none"
          />
          <div className="flex items-center gap-0.5 px-2 pb-2">
            <button onClick={() => fileRef.current?.click()} title="Add images" className="rounded-xl p-2 text-muted hover:bg-mist hover:text-ink">
              <ImagePlus className="size-[18px]" />
            </button>
            <button
              onClick={() => {
                setText((t) => (t ? t + " " : "") + "Use the theme from https://");
                taRef.current?.focus();
              }}
              title="Theme from a website"
              className="rounded-xl p-2 text-muted hover:bg-mist hover:text-ink"
            >
              <Link2 className="size-[18px]" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
            <div className="ml-1 flex rounded-xl bg-mist p-0.5 text-[12.5px]">
              {(["pro", "fast"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => p.onTier(t)}
                  className={`flex items-center gap-1 rounded-[10px] px-2.5 py-1 font-medium transition ${p.tier === t ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink"}`}
                  title={t === "pro" ? "Gemini 3.1 Pro — best quality" : "Gemini 3.5 Flash — faster"}
                >
                  {t === "pro" ? <Sparkles className="size-3" /> : <Zap className="size-3" />}
                  {t === "pro" ? "Pro" : "Fast"}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            {p.busy ? (
              <button onClick={p.onStop} className="grid size-9 place-items-center rounded-xl bg-ink text-white hover:bg-black" title="Stop">
                <Square className="size-3 fill-current" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!text.trim()}
                className="grid size-9 place-items-center rounded-xl bg-ember text-white transition hover:bg-ember-600 disabled:bg-mist-2 disabled:text-faint"
              >
                <ArrowUp className="size-[18px]" />
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-[11.5px] text-faint">Click anything on a slide to rewrite or restyle it · ⌘Z undo</p>
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-50 grid place-items-center rounded-3xl border-2 border-dashed border-ember/60 bg-ember-50/90 text-[15px] font-semibold text-ember-600">
          Drop images to attach
        </div>
      )}
    </aside>
  );
}
