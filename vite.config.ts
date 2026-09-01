import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages publishes this project at
  // https://<username>.github.io/Stranded2/.
  base: "/Stranded2/",
  build: {
    target: "es2022",
    sourcemap: false,
    assetsInlineLimit: 0,
    // Rapier's self-contained compatibility build includes its WASM payload.
    // It is lazy-loaded after the menu, but intentionally remains one cacheable chunk.
    chunkSizeWarningLimit: 3_000,
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
