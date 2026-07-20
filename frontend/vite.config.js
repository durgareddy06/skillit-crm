import { fileURLToPath } from "node:url";

const srcPath = fileURLToPath(new URL("./src", import.meta.url));

export default {
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
};
