import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  server: {
    proxy: {
      "/api/realtime": {
        target: "ws://localhost:8787",
        ws: true,
      },
      "/api": "http://localhost:8787",
      "/health": "http://localhost:8787",
    },
  },
});
