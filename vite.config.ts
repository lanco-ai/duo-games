import { defineConfig } from "vite";
export default defineConfig({
  root: "web",
  base: process.env.BASE_PATH || "/",
  build: { manifest: true, outDir: "../dist/web", emptyOutDir: true },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8790",
      "/ws": { target: "ws://127.0.0.1:8790", ws: true },
    },
  },
});
