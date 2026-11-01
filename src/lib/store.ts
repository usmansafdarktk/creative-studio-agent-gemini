"use client";

import { del, get, set } from "idb-keyval";
import type { Deck } from "./types";

export interface DeckMeta {
  id: string;
  title: string;
  updatedAt: number;
  slideCount: number;
}

const INDEX_KEY = "decks:index";

export async function listDecks(): Promise<DeckMeta[]> {
  try {
    return ((await get<DeckMeta[]>(INDEX_KEY)) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function loadDeck(id: string) {
  try {
    return (await get<Deck>(`deck:${id}`)) ?? null;
  } catch {
    return null;
  }
}

export async function saveDeck(deck: Deck) {
  try {
    // Never persist half-written slides.
    const clean: Deck = { ...deck, slides: deck.slides.filter((s) => s.html).map((s) => ({ ...s, generating: false })) };
    await set(`deck:${deck.id}`, clean);
    const index = (await get<DeckMeta[]>(INDEX_KEY)) ?? [];
    const meta = { id: deck.id, title: deck.title || "Untitled deck", updatedAt: deck.updatedAt, slideCount: clean.slides.length };
    await set(INDEX_KEY, [meta, ...index.filter((d) => d.id !== deck.id)]);
  } catch (e) {
    console.warn("Could not save deck", e);
  }
}

export async function deleteDeck(id: string) {
  try {
    await del(`deck:${id}`);
    const index = (await get<DeckMeta[]>(INDEX_KEY)) ?? [];
    await set(INDEX_KEY, index.filter((d) => d.id !== id));
  } catch {}
}

/** Downscale an uploaded image so prompts and storage stay small. */
export async function fileToAsset(file: File, id: string) {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  if (file.type === "image/svg+xml") return { id, name: file.name, mime: file.type, dataUrl, source: "upload" as const };

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const max = 1800;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  if (scale === 1 && file.size < 1_200_000) return { id, name: file.name, mime: file.type, dataUrl, width: w, height: h, source: "upload" as const };
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  const keepAlpha = file.type === "image/png" || file.type === "image/webp";
  const mime = keepAlpha ? "image/webp" : "image/jpeg";
  return { id, name: file.name, mime, dataUrl: canvas.toDataURL(mime, 0.88), width: w, height: h, source: "upload" as const };
}
