import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  publicDir: ".web-static",
  build: {
    outDir: "site",
    emptyOutDir: true,
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react-vendor", test: /node_modules/ },
            { name: "buffer-model", test: /models\/buffer-risk\.json/ },
          ],
        },
      },
    },
  },
});
