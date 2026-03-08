import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Loads the correct .env file based on mode:
  //   dev  → .env.development (or .env.development.local for personal overrides)
  //   prod → .env.production
  const env = loadEnv(mode, process.cwd(), "");

  const isDev = mode === "development";
  const apiUrl =
    env.VITE_API_URL ||
    (isDev ? "http://localhost:3001" : "https://elghonemy.kiko-tech.com");

  console.log(`\n🔧 Vite Mode: ${mode.toUpperCase()}`);
  console.log(`🌐 API Target: ${apiUrl}\n`);

  return {
    plugins: [react({ jsxRuntime: "automatic" })],
    // define makes VITE_ENV available in the app at build time
    define: {
      __APP_ENV__: JSON.stringify(mode),
    },
    build: {
      // Output directly to backend/client_dist so the server serves fresh builds
      outDir: "../backend/client_dist",
      emptyOutDir: true,
    },
    server: {
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
