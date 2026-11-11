import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

/**
 * Dev-only preview server.
 *
 * The real Today, Timetable and Auth pages are rendered with deterministic
 * fixtures so screenshots do not depend on a signed-in account or production
 * data. This config is never used by `vite build` or the production app.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^convex\/react$/,
        replacement: path.resolve(__dirname, "src/dev/convex-preview.tsx"),
      },
      {
        find: /^@\/hooks\/use-auth$/,
        replacement: path.resolve(__dirname, "src/dev/use-auth-preview.ts"),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "src"),
      },
    ],
    dedupe: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  },
  // The normal index.html imports the real Convex client, which is deliberately
  // absent from the preview mock. Keep dependency discovery on the preview entry
  // only so a preview run never evaluates the production client.
  optimizeDeps: {
    entries: ["preview.html"],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    hmr: false,
  },
});
