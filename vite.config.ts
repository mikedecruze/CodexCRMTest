import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": `http://127.0.0.1:${process.env.TROVE_API_PORT || 3001}`,
      "/auth": `http://127.0.0.1:${process.env.TROVE_API_PORT || 3001}`,
    },
  },
  build: { target: "es2022" },
});
