import process from "node:process";
import { fileURLToPath } from "node:url";
import { createLogger, defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const viteLogger = createLogger();

const isMutedSseProxyReset = (message, options) => {
  const text =
    typeof message === "string" ? message : String(message?.message || message);
  const errorCode = options?.error?.code;

  return (
    text.includes("http proxy error: /api/events/stream") &&
    (errorCode === "ECONNRESET" || text.includes("read ECONNRESET"))
  );
};

const customLogger = {
  ...viteLogger,
  error(message, options) {
    if (isMutedSseProxyReset(message, options)) return;
    viteLogger.error(message, options);
  },
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Loads the correct .env file based on mode:
  //   dev  → .env.development (or .env.development.local for personal overrides)
  //   prod → .env.production
  const env = loadEnv(mode, process.cwd(), "");

  // VITE_API_URL is only the dev-server proxy target. Built bundles call the
  // API same-origin via VITE_API_BASE_URL (default `/api`).
  const isDev = mode === "development";
  const apiUrl = env.VITE_API_URL || "http://localhost:3001";
  const apiBase = env.VITE_API_BASE_URL || "/api";

  console.log(`\n🔧 Vite Mode: ${mode.toUpperCase()}`);
  console.log(
    isDev
      ? `🌐 API Target (dev proxy): ${apiUrl}\n`
      : `🌐 API Base (bundle): ${apiBase}\n`,
  );

  return {
    customLogger,
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
