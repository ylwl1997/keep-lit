import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      three: resolve(root, "node_modules/three"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5175,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4175,
    strictPort: true,
  },
  build: {
    target: "es2020",
    assetsInlineLimit: 4096,
  },
});
