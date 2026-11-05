import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Read PORT from the project-root .env so the proxy follows the API's port.
  // loadEnv with prefix "PORT" loads ONLY that variable — the API key is never
  // read here and could not end up in the browser bundle.
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "PORT");
  const apiPort = env.PORT || "3001";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // Browser calls /api/... on the Vite dev server, which forwards them to Express.
      // The browser never talks to the Claude API and never sees the API key.
      proxy: { "/api": `http://localhost:${apiPort}` },
    },
  };
});
