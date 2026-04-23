/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--theme-primary) / <alpha-value>)",
        "primary-hover": "rgb(var(--theme-primary-hover) / <alpha-value>)",
        "primary-dark": "rgb(var(--theme-primary-dark) / <alpha-value>)",
        "background-light": "rgb(var(--theme-background-light) / <alpha-value>)",
        "background-dark": "rgb(var(--theme-background-dark) / <alpha-value>)",
        "surface-light": "rgb(var(--theme-surface-light) / <alpha-value>)",
        "surface-dark": "rgb(var(--theme-surface-dark) / <alpha-value>)",
        "card-light": "rgb(var(--theme-card-light) / <alpha-value>)",
        "card-dark": "rgb(var(--theme-card-dark) / <alpha-value>)",
        "text-light": "rgb(var(--theme-text-light) / <alpha-value>)",
        "text-dark": "rgb(var(--theme-text-dark) / <alpha-value>)",
        accent: "rgb(var(--theme-accent) / <alpha-value>)",
        "accent-dark": "rgb(var(--theme-accent-dark) / <alpha-value>)",
        "border-light": "rgb(var(--theme-border-light) / <alpha-value>)",
        "border-dark": "rgb(var(--theme-border-dark) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Cairo", "sans-serif"],
        body: ["Cairo", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.75rem",
        xl: "1rem",
      },
      boxShadow: {
        soft: "0 18px 38px -28px rgba(50, 81, 99, 0.28)",
        "soft-dark": "0 4px 20px -2px rgba(0, 0, 0, 0.4)",
      },
      keyframes: {
        "slide-down": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "slide-down": "slide-down 0.3s ease-out",
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
