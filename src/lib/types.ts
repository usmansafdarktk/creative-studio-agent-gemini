// Shared types between the studio (client) and the agent (server).

export interface ThemeColors {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  border: string;
}

export interface Theme {
  name: string;
  headingFont: string;
  bodyFont: string;
  colors: ThemeColors;
  /** Corner radius in px used for cards/images. */
  radius: number;
  /** Optional extra CSS (classes, decorative motifs) shared by every slide. */
  extraCss?: string;
}

export interface Slide {
  id: string;
  /** A single <section class="slide">…</section> fragment, 1920×1080. */
  html: string;
  title?: string;
  notes?: string;
  /** True while the agent is still writing this slide. */
  generating?: boolean;
}

export interface Asset {
  id: string;
  name: string;
  mime: string;
  dataUrl: string;
  width?: number;
  height?: number;
  source?: "upload" | "generated" | "website";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachments?: string[]; // asset ids
  context?: SelectionContext | null;
  activity?: string[]; // progress lines shown under assistant messages
  error?: string;
  createdAt: number;
}

export interface SelectionContext {
  slideId: string;
  slideIndex: number;
  eid?: string;
  tag?: string;
  text?: string;
  selectedText?: string;
  outerHtml?: string;
}

export interface Deck {
  id: string;
  title: string;
  theme: Theme;
  slides: Slide[];
  assets: Asset[];
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export type ModelTier = "pro" | "fast";

export interface AgentRequest {
  deck: Pick<Deck, "title" | "theme" | "slides" | "assets">;
  message: string;
  history: { role: "user" | "assistant"; text: string }[];
  attachmentIds: string[];
  context?: SelectionContext | null;
  tier: ModelTier;
  isNew: boolean;
}

export type AgentEvent =
  | { type: "status"; text: string }
  | { type: "reply"; text: string }
  | { type: "title"; title: string }
  | { type: "theme"; theme: Theme }
  | { type: "asset"; asset: Asset }
  | { type: "slide-placeholder"; id: string; index: number; title: string }
  | { type: "slide-partial"; id: string; html: string }
  | { type: "slide"; id: string; html: string; title?: string; notes?: string }
  | { type: "slide-delete"; id: string }
  | { type: "slide-move"; id: string; index: number }
  | { type: "error"; text: string }
  | { type: "done" };
