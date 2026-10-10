/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // BerryModa brand palette — berry (primary), violet (secondary),
      // coral (highlight) on a soft blush canvas.
      colors: {
        primary: "#C0266D",
        "primary-hover": "#9E1C59",
        "primary-dark": "#9E1C59", // Added for compatibility
        secondary: "#7C3AED",
        "secondary-hover": "#6D28D9",
        coral: "#FF6F61",
        citrus: "#F5A524",
        "background-light": "#FBF6F9",
        "background-dark": "#140D16",
        "surface-light": "#FFFFFF",
        "surface-dark": "#1F1622",
        "surface-raised": "#FDF4F9",
        "card-light": "#FFFFFF", // Added for compatibility
        "card-dark": "#251A29", // Added for compatibility
        "text-light": "#2B1631",
        "text-dark": "#F7EEF4",
        "text-secondary": "#6B5A70", // Muted body text
        accent: "#F3C6DD",
        "accent-dark": "#4A2D45", // Added for compatibility
        "border-light": "#EFE2EA",
        "border-dark": "#3A2A3F",
        stock: {
          ok: "#16A34A",
          low: "#D97706",
          out: "#DC2626",
        },
      },
      fontFamily: {
        display: ["Cairo", "sans-serif"],
        body: ["Cairo", "sans-serif"],
        brand: ['"Playfair Display"', "Georgia", "serif"],
      },
      borderRadius: {
        DEFAULT: "0.75rem",
        xl: "1rem",
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(192, 38, 109, 0.08)",
        card: "0 1px 2px rgba(43, 22, 49, 0.04), 0 8px 24px -12px rgba(192, 38, 109, 0.18)",
        glow: "0 10px 30px -10px rgba(192, 38, 109, 0.45)",
        "soft-dark": "0 4px 20px -2px rgba(0, 0, 0, 0.4)",
      },
      keyframes: {
        "slide-down": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "cart-pulse": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.06)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "slide-down": "slide-down 0.3s ease-out",
        "cart-pulse": "cart-pulse 200ms ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.25s ease-out",
      },
      // Mobile-friendly touch target utilities
      spacing: {
        touch: "44px", // Minimum touch target size (44x44px)
      },
      minHeight: {
        touch: "44px", // Minimum touch target height
      },
      minWidth: {
        touch: "44px", // Minimum touch target width
      },
    },
  },
  plugins: [],
};
