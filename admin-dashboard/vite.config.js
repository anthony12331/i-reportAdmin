import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Your existing Cloudflare tunnel setup:
  server: {
    host: "127.0.0.1",
    allowedHosts: [".trycloudflare.com"],
  },

  // Chart.js duplicate module fix:
  resolve: {
    dedupe: ["react", "react-dom"],
  },

  // ADD THIS BLOCK BELOW to make production/preview errors readable:
  build: {
    sourcemap: true,
  },
});
