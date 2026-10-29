import { vlyPlugin } from "@vly-ai/integrations";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "path";
import { defineConfig, type Plugin } from "vite";

/**
 * GitHub Pages cannot set response headers, so a production build carries the
 * policy in a meta tag. It is added after Vite writes index.html. The theme
 * boot script is a separate public file, so `script-src 'self'` needs no
 * inline hash.
 *
 * This is a best-effort substitute for real headers: `frame-ancestors` and
 * `X-Content-Type-Options` are ignored in meta tags. See README.
 */
function securityMeta(): Plugin {
  return {
    name: "bluprint-security-meta",
    apply: "build",
    closeBundle() {
      const file = path.resolve(__dirname, "dist/index.html");
      if (!existsSync(file)) return;
      const html = readFileSync(file, "utf8");
      if (html.includes("Content-Security-Policy")) return;

      // The theme boot script is a separate file, so script-src can stay
      // strict without a per-build hash. The boot-loader's inline style is
      // covered by style-src's 'unsafe-inline'.
      const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "connect-src 'self' https://harmless-dog-538.convex.cloud wss://harmless-dog-538.convex.cloud https://harmless-dog-538.convex.site",
        "img-src 'self' data: blob: https://harmless-dog-538.convex.cloud",
        "font-src 'self' data: https://fonts.gstatic.com",
        "media-src 'self' blob: https://harmless-dog-538.convex.cloud",
        "worker-src 'self' blob:",
        "frame-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
      ].join("; ");

      const meta = [
        `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
        `<meta http-equiv="X-Content-Type-Options" content="nosniff" />`,
        `<meta name="referrer" content="strict-origin-when-cross-origin" />`,
        `<meta http-equiv="Permissions-Policy" content="camera=(), microphone=(self), geolocation=()" />`,
      ].join("\n  ");

      writeFileSync(file, html.replace("</head>", `  ${meta}\n</head>`));
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vlyPlugin(), react(), tailwindcss(), securityMeta()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Force a single copy of React across all packages (including the preview runtime).
    // Without this, @vly-ai/integrations can resolve its own React copy, which
    // triggers "Invalid hook call" errors at runtime.
    dedupe: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  },
  build: {
    // Enable source maps for better debugging (disable in production if needed)
    sourcemap: false,
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching and lazy loading
        manualChunks: {
          // Vendor chunks for large libraries
          'react-vendor': ['react', 'react-dom', 'react-router'],
          'convex-vendor': ['convex'],
          // Large UI library chunks
          'radix-ui': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],
          // Heavy optional libraries - separate chunks for better lazy loading
          'framer-motion': ['framer-motion'],
          'charts': ['recharts'],
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
        // Optimize chunk size
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit for better chunking
    chunkSizeWarningLimit: 1000,
    // Target modern browsers for better optimization
    target: 'esnext',
    // Minify options - using esbuild (faster than terser)
    minify: 'esbuild',
  },
  // Optimize dependencies
  optimizeDeps: {
    // Only scan the app entry HTML; avoids crawling unrelated *.html files
    // if a legacy snapshot accidentally contains leaked package folders.
    entries: ['index.html'],
    include: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      'react-router',
      '@convex-dev/auth/react',
      'framer-motion',
      // Loaded by src/vly-runtime.ts from index.html. Including it here means
      // the first page load does not discover it and full-reload mid-screenshot.
      '@vly-ai/integrations',
    ],
  },
  // Performance hints
  server: {
    allowedHosts: true,
    // Bind to all interfaces so the browser runtime's server-ready event fires.
    host: true,
    port: 5173,
    // Freebuff requires HMR to stay off. It also avoids stale module requests
    // after the managed dev server restarts.
    hmr: false,
  },
});
