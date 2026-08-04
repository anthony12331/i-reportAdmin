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
  
  // ADD THIS BLOCK BELOW to fix the Chart.js crash:
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
});