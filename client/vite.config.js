import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Target modern browsers — skips unnecessary legacy polyfill transforms
    target: "esnext",
    // Split CSS per chunk so each lazy page only loads its own CSS
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Stable vendor chunks that rarely change → long-lived browser cache
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-lucide": ["lucide-react"],
          // Heavy map dependencies split so they load only when map mounts
          "vendor-leaflet": ["leaflet", "react-leaflet"],
          "vendor-maplibre": ["maplibre-gl"],
          // Analytics-only chunks — only downloaded on /reports page
          "vendor-chartjs": ["chart.js", "react-chartjs-2"],
          "vendor-jspdf": ["jspdf", "jspdf-autotable"],
          // Agora RTC (~1.6MB) — isolated chunk, only loads when camera button clicked
          "vendor-agora": ["agora-rtc-sdk-ng"],
        },
      },
    },
  },
});