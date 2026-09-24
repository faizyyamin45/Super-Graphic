import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:3001", "/media-files": "http://127.0.0.1:3001" } },
  build: {
    outDir: "dist",
    // Vite 8 bundles with rolldown, which takes manualChunks as a function.
    // The animation library is the biggest dependency and changes far less
    // often than app code, so splitting it keeps it cached across deploys.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("framer-motion") || id.includes("motion-dom") || id.includes("motion-utils")) return "motion";
          if (id.includes("react-router") || id.includes("/react-dom/") || id.includes("/react/")) return "react";
        },
      },
    },
  },
});
