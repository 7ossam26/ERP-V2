import process from "node:process";
import { fileURLToPath } from "node:url";
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
    resolve: {
      alias: {
        fontkit: fileURLToPath(
          new URL("./src/vendor/fontkitPatched.js", import.meta.url)
        ),
      },
    },
    // define makes VITE_ENV available in the app at build time
    define: {
      __APP_ENV__: JSON.stringify(mode),
    },
    build: {
      // Output directly to backend/client_dist so the server serves fresh builds
      outDir: "../backend/client_dist",
      emptyOutDir: true,
    },
    worker: {
      format: "es",
    },
    server: {
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true,
          // SSE connections (long-lived) must not time out at the proxy layer.
          proxyTimeout: 0,
          timeout: 0,
          configure: (proxy) => {
            proxy.on("error", (err, req) => {
              // ECONNRESET on SSE streams is expected whenever the backend
              // restarts — the browser EventSource reconnects automatically.
              if (req.url?.includes("/events/stream")) return;
              console.error("[proxy]", err.message);
            });
          },
        },
      },
    },
  };
});
