"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildShell, resolveAssets } from "@/lib/slide-html";
import { SLIDE_H, SLIDE_W } from "@/lib/theme";
import type { Asset, Theme } from "@/lib/types";

export interface FrameMessage {
  type: "ready" | "select" | "deselect" | "text";
  eid?: string;
  tag?: string;
  text?: string;
  html?: string;
  outerHtml?: string;
  selectedText?: string;
  isRoot?: boolean;
  rect?: { x: number; y: number; w: number; h: number };
}

interface Props {
  html: string;
  theme: Theme;
  assets: Asset[];
  interactive?: boolean;
  selectedEid?: string | null;
  onMessage?: (m: FrameMessage) => void;
  onScale?: (scale: number) => void;
  frameRef?: (el: HTMLIFrameElement | null) => void;
  className?: string;
  /** Fit inside both dimensions of the parent (present mode) instead of filling the width. */
  contain?: boolean;
}

/** Renders one 1920×1080 slide, scaled to its container, in an isolated sandboxed iframe. */
export function SlideFrame({ html, theme, assets, interactive, selectedEid, onMessage, onScale, frameRef, className, contain }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0);
  const [readyShell, setReadyShell] = useState<string | null>(null);
  const themeKey = JSON.stringify(theme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shell = useMemo(() => buildShell(theme, !!interactive), [themeKey, interactive]);
  const ready = readyShell === shell;
  const onMessageRef = useRef(onMessage);
  const onScaleRef = useRef(onScale);
  const shellRef = useRef(shell);
  useEffect(() => {
    onMessageRef.current = onMessage;
    onScaleRef.current = onScale;
    shellRef.current = shell;
  });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const box = contain ? el.parentElement! : el;
      const s = contain ? Math.min(box.clientWidth / SLIDE_W, box.clientHeight / SLIDE_H) : el.clientWidth / SLIDE_W;
      setScale(s);
      onScaleRef.current?.(s);
    });
    ro.observe(contain ? el.parentElement! : el);
    return () => ro.disconnect();
  }, [contain]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow || !e.data?.__slide) return;
      if (e.data.type === "ready") setReadyShell(shellRef.current);
      else onMessageRef.current?.(e.data as FrameMessage);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const resolved = useMemo(() => resolveAssets(html, assets), [html, assets]);
  useEffect(() => {
    if (!ready) return;
    iframeRef.current?.contentWindow?.postMessage({ type: "render", html: resolved, selected: selectedEid ?? null }, "*");
    // selectedEid intentionally excluded: selection highlight is managed inside the frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, resolved]);

  useEffect(() => {
    if (ready && !selectedEid) iframeRef.current?.contentWindow?.postMessage({ type: "clear" }, "*");
  }, [ready, selectedEid]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={
        contain
          ? { width: SLIDE_W * scale, height: SLIDE_H * scale, position: "relative", overflow: "hidden" }
          : { width: "100%", aspectRatio: `${SLIDE_W} / ${SLIDE_H}`, position: "relative", overflow: "hidden" }
      }
    >
      <iframe
        ref={(el) => {
          iframeRef.current = el;
          frameRef?.(el);
        }}
        title="slide"
        sandbox="allow-scripts"
        srcDoc={shell}
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          inset: 0,
          pointerEvents: interactive ? "auto" : "none",
          background: theme.colors.bg,
          opacity: scale ? 1 : 0,
        }}
      />
    </div>
  );
}
