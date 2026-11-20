import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/widget.ts",
      name: "VeriTrustWidget",
      formats: ["es"],
      fileName: "veritrust-widget",
      cssFileName: "veritrust-widget",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
    },
    outDir: "dist-widget",
    emptyOutDir: true,
  },
});
