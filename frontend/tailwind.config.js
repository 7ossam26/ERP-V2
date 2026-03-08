/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#6F4E37",
        "primary-hover": "#5D4037",
        "primary-dark": "#5D4037", // Added for compatibility
        "background-light": "#F5F5F0",
        "background-dark": "#1F1B18",
        "surface-light": "#FFFFFF",
        "surface-dark": "#2C2522",
        "card-light": "#FFFFFF", // Added for compatibility
        "card-dark": "#27272a", // Added for compatibility (Zinc 800)
        "text-light": "#3E2723",
        "text-dark": "#EFEBE9",
        accent: "#D7CCC8",
        "accent-dark": "#4a4a4e", // Added for compatibility
        "border-light": "#E7E5E4",
        "border-dark": "#44403C",
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
        soft: "0 4px 20px -2px rgba(111, 78, 55, 0.05)",
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
