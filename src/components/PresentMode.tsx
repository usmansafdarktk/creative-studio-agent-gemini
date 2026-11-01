"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Deck } from "@/lib/types";
import { SlideFrame } from "./SlideFrame";

export function PresentMode({ deck, start, onClose }: { deck: Deck; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const ref = useRef<HTMLDivElement>(null);
  const n = deck.slides.length;

  useEffect(() => {
    ref.current?.requestFullscreen?.().catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(e.key)) setI((x) => Math.min(n - 1, x + 1));
      if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) setI((x) => Math.max(0, x - 1));
      if (e.key === "Escape") onClose();
    };
    const onFs = () => {
      if (!document.fullscreenElement) onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [n, onClose]);

  const slide = deck.slides[i];
  return (
    <div ref={ref} className="group fixed inset-0 z-[100] flex items-center justify-center bg-black">
      <div className="flex h-full w-full items-center justify-center">
        {slide && <SlideFrame key={slide.id} html={slide.html} theme={deck.theme} assets={deck.assets} contain />}
      </div>
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-900/80 px-2 py-1 text-xs text-zinc-300 opacity-0 backdrop-blur transition group-hover:opacity-100">
        <button onClick={() => setI((x) => Math.max(0, x - 1))} className="rounded-full p-1.5 hover:bg-white/10">
          <ChevronLeft className="size-4" />
        </button>
        <span className="tabular-nums">
          {i + 1} / {n}
        </span>
        <button onClick={() => setI((x) => Math.min(n - 1, x + 1))} className="rounded-full p-1.5 hover:bg-white/10">
          <ChevronRight className="size-4" />
        </button>
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-white/10">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
