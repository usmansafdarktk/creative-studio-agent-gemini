"use client";

import { ArrowRight, Loader2, MessageSquarePlus, PenLine, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Selection } from "./Canvas";

const REWRITE_PRESETS = [
  "Make it shorter",
  "Make it more compelling",
  "More formal & executive",
  "Simplify the language",
  "Fix grammar",
  "Translate to Arabic",
  "Translate to English",
];

interface Props {
  selection: Selection;
  scale: number;
  busy: boolean;
  onRewrite: (instruction: string) => void;
  onEdit: (instruction: string) => void;
  onEditText: () => void;
  onDelete: () => void;
  onAskInChat: () => void;
  onRedesign: () => void;
  onClose: () => void;
}

/** Floating toolbar anchored to the selected element inside a slide. */
export function SelectionToolbar(p: Props) {
  const [mode, setMode] = useState<"none" | "rewrite" | "edit">("none");
  const [instr, setInstr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const r = p.selection.rect!;
  const hasText = !!p.selection.text && !p.selection.isRoot;

  useEffect(() => {
    if (mode !== "none") inputRef.current?.focus();
  }, [mode]);

  // Position above the element, or below it if there's no room.
  const top = r.y * p.scale;
  const placeBelow = top < 64;
  const style: React.CSSProperties = p.selection.isRoot
    ? { top: 12, left: 12 }
    : {
        left: Math.max(8, r.x * p.scale),
        top: placeBelow ? (r.y + r.h) * p.scale + 10 : top - 10,
        transform: placeBelow ? undefined : "translateY(-100%)",
      };

  const submit = () => {
    if (mode === "rewrite") p.onRewrite(instr);
    else if (mode === "edit" && instr.trim()) p.onEdit(instr);
  };

  return (
    <div className="absolute z-30 w-max max-w-[min(560px,90%)]" style={style} onClick={(e) => e.stopPropagation()}>
      <div className="rounded-2xl border border-line bg-paper/95 p-1 text-[13px] text-ink shadow-[0_18px_50px_-14px_rgba(12,12,13,.35)] backdrop-blur-xl">
        <div className="flex items-center gap-0.5">
          {p.busy ? (
            <span className="flex items-center gap-2 px-3 py-1.5 font-medium text-ember-600">
              <Loader2 className="size-3.5 animate-spin" />
              <span className="shimmer-text">Gemini is editing…</span>
            </span>
          ) : (
            <>
              <span className="mx-1 rounded-md bg-mist px-1.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-muted">{p.selection.isRoot ? "slide" : p.selection.tag}</span>
              {hasText && (
                <Btn active={mode === "rewrite"} onClick={() => setMode(mode === "rewrite" ? "none" : "rewrite")}>
                  <Sparkles className="size-3.5 text-ember" />
                  {p.selection.selectedText ? "Rewrite selection" : "Rewrite with Gemini"}
                </Btn>
              )}
              {!p.selection.isRoot && (
                <Btn active={mode === "edit"} onClick={() => setMode(mode === "edit" ? "none" : "edit")}>
                  <Wand2 className="size-3.5 text-fam-blue" /> Edit with AI
                </Btn>
              )}
              {hasText && (
                <Btn onClick={p.onEditText} title="Edit text directly (or double-click)">
                  <PenLine className="size-3.5" />
                </Btn>
              )}
              {p.selection.isRoot && (
                <Btn onClick={p.onRedesign}>
                  <Wand2 className="size-3.5 text-fam-blue" /> Redesign slide
                </Btn>
              )}
              <Btn onClick={p.onAskInChat} title="Use as chat context">
                <MessageSquarePlus className="size-3.5" />
                {p.selection.isRoot && "Ask in chat"}
              </Btn>
              {!p.selection.isRoot && (
                <Btn onClick={p.onDelete} title="Delete element">
                  <Trash2 className="size-3.5" />
                </Btn>
              )}
              <Btn onClick={p.onClose} title="Close">
                <X className="size-3.5 text-muted" />
              </Btn>
            </>
          )}
        </div>

        {mode !== "none" && !p.busy && (
          <div className="mt-1 border-t border-line p-1.5">
            {p.selection.selectedText && mode === "rewrite" && (
              <p className="mb-1.5 line-clamp-2 px-1 text-[12px] italic text-muted">“{p.selection.selectedText}”</p>
            )}
            <div className="flex items-center gap-1.5 rounded-xl bg-mist px-2">
              <input
                ref={inputRef}
                value={instr}
                onChange={(e) => setInstr(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") setMode("none");
                }}
                placeholder={mode === "rewrite" ? "How should Gemini rewrite it? (optional)" : "e.g. make it accent colored, bigger, add an icon"}
                className="h-9 w-[340px] bg-transparent text-[13px] placeholder:text-faint focus:outline-none"
              />
              <button onClick={submit} className="rounded-lg bg-ember p-1.5 text-white hover:bg-ember-600">
                <ArrowRight className="size-3.5" />
              </button>
            </div>
            {mode === "rewrite" && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {REWRITE_PRESETS.map((pr) => (
                  <button key={pr} onClick={() => p.onRewrite(pr)} className="rounded-lg bg-mist px-2.5 py-1 text-[12px] text-ink-2 transition hover:bg-ember-50 hover:text-ember-600">
                    {pr}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Btn(props: { children: React.ReactNode; onClick: () => void; title?: string; active?: boolean }) {
  return (
    <button
      title={props.title}
      onClick={props.onClick}
      className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 font-medium hover:bg-mist ${props.active ? "bg-mist" : ""}`}
    >
      {props.children}
    </button>
  );
}
