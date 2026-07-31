import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

const srcPath = fileURLToPath(new URL("./src", import.meta.url));

export default {
  plugins: [react()],
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
  server: {
    port: 5174,
  },
  preview: {
    port: 4173,
  },
};
