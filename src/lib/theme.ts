import type { Theme } from "./types";

export const SLIDE_W = 1920;
export const SLIDE_H = 1080;

export const THEME_PRESETS: Theme[] = [
  {
    name: "Midnight Editorial",
    headingFont: "Fraunces",
    bodyFont: "Inter",
    colors: { bg: "#0E1116", surface: "#171B22", text: "#F4F1EA", muted: "#9AA3AF", accent: "#E8B44A", accent2: "#5EC2B7", border: "#2A303A" },
    radius: 20,
  },
  {
    name: "Swiss Clean",
    headingFont: "Inter Tight",
    bodyFont: "Inter",
    colors: { bg: "#FAFAF7", surface: "#FFFFFF", text: "#111111", muted: "#6B6B6B", accent: "#E5372B", accent2: "#1F3BFF", border: "#E4E4E0" },
    radius: 4,
  },
  {
    name: "Corporate Navy",
    headingFont: "Plus Jakarta Sans",
    bodyFont: "Plus Jakarta Sans",
    colors: { bg: "#FFFFFF", surface: "#F3F6FB", text: "#0B1F3A", muted: "#5B6B82", accent: "#0A5BD3", accent2: "#00A389", border: "#DCE3EE" },
    radius: 16,
  },
  {
    name: "Warm Studio",
    headingFont: "DM Serif Display",
    bodyFont: "DM Sans",
    colors: { bg: "#F5EFE6", surface: "#FFFaf3", text: "#2B211B", muted: "#80705F", accent: "#C8553D", accent2: "#3D6E5A", border: "#E2D6C6" },
    radius: 24,
  },
  {
    name: "Neon Tech",
    headingFont: "Space Grotesk",
    bodyFont: "Inter",
    colors: { bg: "#07070C", surface: "#12121C", text: "#EDEDF7", muted: "#8B8BA7", accent: "#8B5CF6", accent2: "#22D3EE", border: "#26263A" },
    radius: 18,
  },
];

export const DEFAULT_THEME = THEME_PRESETS[0];

const SYSTEM_FONTS = new Set(["system-ui", "serif", "sans-serif", "monospace", "Arial", "Helvetica", "Georgia", "Times New Roman"]);

export function googleFontsHref(theme: Theme) {
  const fams = [...new Set([theme.headingFont, theme.bodyFont])].filter((f) => f && !SYSTEM_FONTS.has(f));
  if (!fams.length) return null;
  const q = fams.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@300;400;500;600;700;800`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

/** The CSS shared by every slide: reset, theme tokens and a few helper classes. */
export function themeCss(theme: Theme) {
  const c = theme.colors;
  return `
:root{
  --bg:${c.bg};--surface:${c.surface};--text:${c.text};--muted:${c.muted};
  --accent:${c.accent};--accent-2:${c.accent2};--border:${c.border};
  --radius:${theme.radius}px;
  --font-heading:'${theme.headingFont}',ui-sans-serif,system-ui,sans-serif;
  --font-body:'${theme.bodyFont}',ui-sans-serif,system-ui,sans-serif;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.slide{position:relative;width:${SLIDE_W}px;height:${SLIDE_H}px;overflow:hidden;background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:28px;line-height:1.45}
.slide h1,.slide h2,.slide h3,.slide h4{font-family:var(--font-heading);font-weight:700;line-height:1.05;letter-spacing:-0.02em}
.slide img{display:block;max-width:100%}
.slide svg{display:block}
${theme.extraCss ?? ""}
`;
}
