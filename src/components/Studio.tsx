"use client";

import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureEids, getElement, htmlText, removeElement, replaceElement, setElementInner } from "@/lib/slide-html";
import { deleteDeck, fileToAsset, listDecks, loadDeck, saveDeck, type DeckMeta } from "@/lib/store";
import { DEFAULT_THEME } from "@/lib/theme";
import type { AgentEvent, Asset, ChatMessage, Deck, ModelTier, SelectionContext, Slide, Theme } from "@/lib/types";
import { Canvas, type Selection } from "./Canvas";
import { ChatPanel } from "./ChatPanel";
import { Landing } from "./Landing";
import { PresentMode } from "./PresentMode";

type Snapshot = Pick<Deck, "slides" | "theme" | "title" | "assets">;

function newDeck(theme: Theme = DEFAULT_THEME): Deck {
  const now = Date.now();
  return { id: nanoid(10), title: "", theme, slides: [], assets: [], messages: [], createdAt: now, updatedAt: now };
}

export function Studio() {
  const [deck, setDeckState] = useState<Deck | null>(null);
  const [decks, setDecks] = useState<DeckMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [tier, setTier] = useState<ModelTier>("pro");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [chatContext, setChatContext] = useState<SelectionContext | null>(null);
  const [presenting, setPresenting] = useState<number | null>(null);
  const [editingEid, setEditingEid] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const abortRef = useRef<AbortController | null>(null);
  const undoRef = useRef<Snapshot[]>([]);
  const redoRef = useRef<Snapshot[]>([]);
  const deckRef = useRef<Deck | null>(null);
  deckRef.current = deck;

  const refreshDecks = useCallback(() => listDecks().then(setDecks), []);
  useEffect(() => {
    refreshDecks();
  }, [refreshDecks]);

  // Persist (debounced) whenever the deck changes and nothing is streaming.
  useEffect(() => {
    if (!deck || busy || (!deck.slides.length && !deck.messages.length)) return;
    const t = setTimeout(() => saveDeck(deck).then(refreshDecks), 600);
    return () => clearTimeout(t);
  }, [deck, busy, refreshDecks]);

  const setDeck = useCallback((fn: (d: Deck) => Deck) => {
    setDeckState((d) => (d ? { ...fn(d), updatedAt: Date.now() } : d));
  }, []);

  const snapshot = useCallback(() => {
    const d = deckRef.current;
    if (!d) return;
    undoRef.current = [...undoRef.current.slice(-40), { slides: d.slides, theme: d.theme, title: d.title, assets: d.assets }];
    redoRef.current = [];
  }, []);

  const undo = useCallback(() => {
    const d = deckRef.current;
    const prev = undoRef.current.pop();
    if (!d || !prev) return;
    redoRef.current.push({ slides: d.slides, theme: d.theme, title: d.title, assets: d.assets });
    setDeck((x) => ({ ...x, ...prev }));
    setSelection(null);
  }, [setDeck]);

  const redo = useCallback(() => {
    const d = deckRef.current;
    const next = redoRef.current.pop();
    if (!d || !next) return;
    undoRef.current.push({ slides: d.slides, theme: d.theme, title: d.title, assets: d.assets });
    setDeck((x) => ({ ...x, ...next }));
  }, [setDeck]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,[contenteditable]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const updateSlide = useCallback(
    (id: string, fn: (s: Slide) => Slide) => setDeck((d) => ({ ...d, slides: d.slides.map((s) => (s.id === id ? fn(s) : s)) })),
    [setDeck],
  );

  // ---------- Agent ----------
  const applyEvent = useCallback(
    (ev: AgentEvent, msgId: string) => {
      const addActivity = (line: string) =>
        setDeck((d) => ({
          ...d,
          messages: d.messages.map((m) => (m.id === msgId ? { ...m, activity: [...(m.activity ?? []), line] } : m)),
        }));
      switch (ev.type) {
        case "status":
          addActivity(ev.text);
          break;
        case "reply":
          setDeck((d) => ({ ...d, messages: d.messages.map((m) => (m.id === msgId ? { ...m, text: ev.text } : m)) }));
          break;
        case "title":
          setDeck((d) => ({ ...d, title: ev.title }));
          break;
        case "theme":
          setDeck((d) => ({ ...d, theme: ev.theme }));
          addActivity(`Theme → ${ev.theme.name}`);
          break;
        case "asset":
          setDeck((d) => ({ ...d, assets: [...d.assets.filter((a) => a.id !== ev.asset.id), ev.asset] }));
          if (ev.asset.source === "generated") addActivity(`Generated image: ${ev.asset.name}`);
          if (ev.asset.source === "website") addActivity(`Found logo on website`);
          break;
        case "slide-placeholder":
          setDeck((d) => {
            const slides = [...d.slides];
            slides.splice(ev.index, 0, { id: ev.id, html: "", title: ev.title, generating: true });
            return { ...d, slides };
          });
          break;
        case "slide-partial":
          updateSlide(ev.id, (s) => ({ ...s, html: ev.html, generating: true }));
          break;
        case "slide":
          updateSlide(ev.id, (s) => ({ ...s, html: ensureEids(ev.html), title: ev.title ?? s.title, generating: false }));
          setDeck((d) => {
            const i = d.slides.findIndex((s) => s.id === ev.id);
            return {
              ...d,
              messages: d.messages.map((m) =>
                m.id === msgId ? { ...m, activity: [...(m.activity ?? []), `✓ Slide ${i + 1}${ev.title ? ` · ${ev.title}` : ""}`] } : m,
              ),
            };
          });
          break;
        case "slide-delete":
          setDeck((d) => ({ ...d, slides: d.slides.filter((s) => s.id !== ev.id) }));
          break;
        case "slide-move":
          setDeck((d) => {
            const slides = [...d.slides];
            const i = slides.findIndex((s) => s.id === ev.id);
            if (i < 0) return d;
            const [s] = slides.splice(i, 1);
            slides.splice(ev.index, 0, s);
            return { ...d, slides };
          });
          break;
        case "error":
          setDeck((d) => ({ ...d, messages: d.messages.map((m) => (m.id === msgId ? { ...m, error: ev.text } : m)) }));
          break;
      }
    },
    [setDeck, updateSlide],
  );

  const send = useCallback(
    async (text: string, attachments: Asset[], startDeck?: Deck) => {
      const base = startDeck ?? deckRef.current;
      if (!base || busy) return;
      const ctx = chatContext;
      const userMsg: ChatMessage = { id: nanoid(8), role: "user", text, attachments: attachments.map((a) => a.id), context: ctx, createdAt: Date.now() };
      const botMsg: ChatMessage = { id: nanoid(8), role: "assistant", text: "", activity: [], createdAt: Date.now() };
      const assets = [...base.assets, ...attachments];
      const history = base.messages.filter((m) => m.text).map((m) => ({ role: m.role, text: m.text }));

      if (!startDeck) snapshot();
      setDeckState({ ...base, assets, messages: [...base.messages, userMsg, botMsg], updatedAt: Date.now() });
      setChatContext(null);
      setBusy(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deck: { title: base.title, theme: base.theme, slides: base.slides.filter((s) => s.html && !s.generating), assets },
            message: text,
            history,
            attachmentIds: attachments.map((a) => a.id),
            context: ctx,
            tier,
            isNew: base.slides.length === 0,
          }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`Agent request failed (${res.status})`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) if (line.trim()) applyEvent(JSON.parse(line) as AgentEvent, botMsg.id);
        }
      } catch (e) {
        if (!ctrl.signal.aborted) applyEvent({ type: "error", text: (e as Error).message }, botMsg.id);
        else applyEvent({ type: "status", text: "Stopped." }, botMsg.id);
      } finally {
        // Drop slides that never finished.
        setDeck((d) => ({
          ...d,
          slides: d.slides.filter((s) => !s.generating || s.html.includes("</section>")).map((s) => (s.generating ? { ...s, html: ensureEids(s.html), generating: false } : s)),
          messages: d.messages.map((m) => (m.id === botMsg.id && !m.text && !m.error ? { ...m, text: "Done." } : m)),
        }));
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, chatContext, tier, snapshot, applyEvent, setDeck],
  );

  const stop = () => abortRef.current?.abort();

  const start = useCallback(
    async (text: string, files: File[], theme?: Theme) => {
      const d = newDeck(theme);
      const assets = await Promise.all(files.map((f) => fileToAsset(f, `up-${nanoid(6)}`)));
      setDeckState(d);
      undoRef.current = [];
      send(text, assets, d);
    },
    [send],
  );

  // ---------- Element-level editing ----------
  const [elementBusy, setElementBusy] = useState(false);

  const elementEdit = useCallback(
    async (mode: "rewrite" | "edit", instruction: string) => {
      const d = deckRef.current;
      if (!d || !selection?.eid) return;
      const slide = d.slides.find((s) => s.id === selection.slideId);
      const el = slide && getElement(slide.html, selection.eid);
      if (!slide || !el) return;
      setElementBusy(true);
      try {
        const res = await fetch("/api/edit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode,
            instruction,
            elementHtml: mode === "rewrite" ? el.inner : el.outer,
            selectedText: selection.selectedText,
            slideText: htmlText(slide.html),
            theme: d.theme,
            tier,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Edit failed");
        snapshot();
        const eid = selection.eid;
        updateSlide(slide.id, (s) => ({
          ...s,
          html: ensureEids(mode === "rewrite" ? setElementInner(s.html, eid, json.html) : replaceElement(s.html, eid, json.html)),
        }));
      } catch (e) {
        setToast((e as Error).message.slice(0, 300));
      } finally {
        setElementBusy(false);
      }
    },
    [selection, tier, snapshot, updateSlide],
  );

  const onTextEdited = useCallback(
    (slideId: string, eid: string, html: string) => {
      const slide = deckRef.current?.slides.find((s) => s.id === slideId);
      if (!slide || getElement(slide.html, eid)?.inner === html) return;
      snapshot();
      updateSlide(slideId, (s) => ({ ...s, html: setElementInner(s.html, eid, html) }));
      setEditingEid(null);
    },
    [snapshot, updateSlide],
  );

  const deleteSelected = useCallback(() => {
    if (!selection?.eid) return;
    snapshot();
    updateSlide(selection.slideId, (s) => ({ ...s, html: removeElement(s.html, selection.eid!) }));
    setSelection(null);
  }, [selection, snapshot, updateSlide]);

  const askInChat = useCallback(
    (sel: Selection) => {
      const d = deckRef.current;
      const i = d?.slides.findIndex((s) => s.id === sel.slideId) ?? -1;
      setChatContext({
        slideId: sel.slideId,
        slideIndex: i,
        eid: sel.isRoot ? undefined : sel.eid,
        tag: sel.tag,
        text: sel.text,
        selectedText: sel.selectedText,
      });
      document.getElementById("composer")?.focus();
    },
    [],
  );

  // ---------- Deck-level ops ----------
  const slideOps = {
    move: (id: string, dir: -1 | 1) => {
      snapshot();
      setDeck((d) => {
        const slides = [...d.slides];
        const i = slides.findIndex((s) => s.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= slides.length) return d;
        [slides[i], slides[j]] = [slides[j], slides[i]];
        return { ...d, slides };
      });
    },
    duplicate: (id: string) => {
      snapshot();
      setDeck((d) => {
        const i = d.slides.findIndex((s) => s.id === id);
        const copy = { ...d.slides[i], id: `s${nanoid(8)}` };
        const slides = [...d.slides];
        slides.splice(i + 1, 0, copy);
        return { ...d, slides };
      });
    },
    remove: (id: string) => {
      snapshot();
      setDeck((d) => ({ ...d, slides: d.slides.filter((s) => s.id !== id) }));
      setSelection(null);
    },
    setHtml: (id: string, html: string) => {
      snapshot();
      updateSlide(id, (s) => ({ ...s, html: ensureEids(html) }));
    },
    redesign: (id: string) => {
      const d = deckRef.current!;
      const i = d.slides.findIndex((s) => s.id === id);
      setChatContext({ slideId: id, slideIndex: i });
      setTimeout(() => {
        sendRef.current?.(`Redesign slide ${i + 1} with a fresh, more striking layout. Keep the content.`, []);
      }, 0);
    },
  };
  const sendRef = useRef(send);
  sendRef.current = send;

  const setTheme = (theme: Theme) => {
    snapshot();
    setDeck((d) => ({ ...d, theme }));
  };

  const openDeck = async (id: string) => {
    const d = await loadDeck(id);
    if (d) {
      undoRef.current = [];
      setSelection(null);
      setDeckState(d);
    }
  };

  const removeDeck = async (id: string) => {
    await deleteDeck(id);
    if (deckRef.current?.id === id) setDeckState(null);
    refreshDecks();
  };

  if (!deck) return <Landing onStart={start} decks={decks} onOpen={openDeck} onDelete={removeDeck} />;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-paper text-ink">
      <ChatPanel
        deck={deck}
        busy={busy}
        tier={tier}
        onTier={setTier}
        onSend={send}
        onStop={stop}
        context={chatContext}
        onClearContext={() => setChatContext(null)}
        decks={decks}
        onOpenDeck={openDeck}
        onNewDeck={() => {
          setSelection(null);
          setDeckState(null);
        }}
      />
      <Canvas
        deck={deck}
        busy={busy}
        selection={selection}
        onSelect={setSelection}
        elementBusy={elementBusy}
        onRewrite={(instr) => elementEdit("rewrite", instr)}
        onEditElement={(instr) => elementEdit("edit", instr)}
        onDeleteElement={deleteSelected}
        onAskInChat={askInChat}
        onTextEdited={onTextEdited}
        editingEid={editingEid}
        onStartTextEdit={setEditingEid}
        slideOps={slideOps}
        onTitle={(title) => setDeck((d) => ({ ...d, title }))}
        onTheme={setTheme}
        onPresent={(i) => setPresenting(i)}
        onUndo={undo}
        onRedo={redo}
      />
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[90] max-w-lg -translate-x-1/2 rounded-2xl bg-ink px-4 py-3 text-[13px] text-white shadow-2xl">
          {toast}
        </div>
      )}
      {presenting !== null && <PresentMode deck={deck} start={presenting} onClose={() => setPresenting(null)} />}
    </div>
  );
}
