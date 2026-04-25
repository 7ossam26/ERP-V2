/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // --- Editorial Retail palette (Emerald accent) ---
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

        // Dark mode overrides
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

        // Legacy aliases (keeps existing pages working during migration)
        primary: "#0D5F4A",
        "primary-hover": "#0A4D3C",
        "primary-dark": "#0A4D3C",
        "background-light": "#FAF7F2",
        "background-dark": "#141210",
        "surface-light": "#FFFFFF",
        "card-light": "#FFFFFF",
        "card-dark": "#1E1C19",
        "text-light": "#1A1613",
        "text-dark": "#E8E2D8",
        "border-light": "#E8E2D8",
        "border-dark": "#2E2A25",
        "accent-legacy": "#E8E2D8",
        "accent-dark-legacy": "#2E2A25",
      },
      fontFamily: {
        display: ["Cairo", "sans-serif"],
        body: ["Cairo", "sans-serif"],
      },
      fontVariantNumeric: {
        tabular: "tabular-nums",
      },
      borderRadius: {
        DEFAULT: "10px",
        lg: "10px",
        md: "8px",
        sm: "6px",
        pill: "9999px",
      },
      boxShadow: {
        soft: "0 2px 8px rgba(26, 22, 19, 0.06)",
        "soft-dark": "0 2px 8px rgba(0, 0, 0, 0.3)",
        none: "none",
      },
      maxWidth: {
        content: "1440px",
      },
      width: {
        sidebar: "240px",
        "sidebar-collapsed": "64px",
      },
      height: {
        topbar: "56px",
        "page-header": "72px",
      },
      keyframes: {
        "slide-down": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "slide-down": "slide-down 0.3s ease-out",
        "fade-in": "fade-in 0.15s ease-out",
      },
      spacing: {
        touch: "44px",
      },
      minHeight: {
        touch: "44px",
      },
      minWidth: {
        touch: "44px",
      },
    },
  },
  plugins: [],
};
