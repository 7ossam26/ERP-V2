/**
 * Ramex Store — Editorial Retail Design Tokens
 * Phase 12b-UI: Visual identity overhaul
 *
 * Accent: Emerald #0D5F4A
 * Canvas: Warm bone #FAF7F2
 * Typography: Cairo (Arabic body + display)
 */

export const colors = {
  // --- Light mode ---
  canvas: "#FAF7F2",
  surface: "#FFFFFF",
  ink: "#1A1613",
  muted: "#8A8178",
  line: "#E8E2D8",

  accent: "#0D5F4A",
  "accent-hover": "#0A4D3C",
  "accent-light": "rgba(13, 95, 74, 0.08)",
  "accent-ring": "rgba(13, 95, 74, 0.25)",

  success: "#2F7A5A",
  warning: "#B8861B",
  danger: "#A83232",

  // --- Dark mode ---
  "canvas-dark": "#141210",
  "surface-dark": "#1E1C19",
  "ink-dark": "#E8E2D8",
  "muted-dark": "#8A8178",
  "line-dark": "#2E2A25",

  "accent-dark": "#2D9B78",
  "accent-hover-dark": "#35B08A",
  "accent-light-dark": "rgba(45, 155, 120, 0.12)",

  "success-dark": "#3DA873",
  "warning-dark": "#D4A02A",
  "danger-dark": "#D44848",
};

export const typography = {
  fontFamily: {
    display: ["Cairo", "sans-serif"],
    body: ["Cairo", "sans-serif"],
  },
  fontSize: {
    base: "15px",
  },
};

export const geometry = {
  radii: {
    card: "10px",
    button: "8px",
    input: "8px",
    pill: "9999px",
  },
  spacing: {
    cardPadding: "16px",
    inputPadding: "12px",
    gridGap: "8px",
  },
  sidebar: {
    collapsed: "64px",
    expanded: "240px",
  },
  topBar: "56px",
  pageHeader: "72px",
  contentMax: "1440px",
};

export default { colors, typography, geometry };
