import "@vly-ai/integrations";

/**
 * Preview runtime, loaded as a real module from index.html.
 *
 * The Vly Vite plugin used to inject this as an inline module. Vite turns
 * inline modules into `index.html?html-proxy&index=N.js` virtual files, and a
 * browser can request a stale proxy index after the dev server restarts,
 * producing:
 *
 *   No matching HTML proxy module found from index.html?html-proxy&index=1.js
 *
 * Keeping the runtime in a source file removes every HTML proxy module from
 * the page while preserving the screenshot listener and error reporting.
 */
type PreviewError = {
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
};

function reportPreviewError(payload: PreviewError) {
  try {
    window.parent.postMessage(
      {
        type: "vly-vite-hmr-error",
        error: payload,
        timestamp: Date.now(),
      },
      "*",
    );
  } catch {
    // Cross-origin parents can reject postMessage. Reporting must never break
    // the app, so a failure here is deliberately ignored.
  }
}

window.addEventListener("error", (event) => {
  reportPreviewError({
    message: event.message,
    stack: event.error?.stack,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason as
    | { message?: string; stack?: string }
    | undefined;
  reportPreviewError({
    message: reason?.message ?? String(event.reason),
    stack: reason?.stack,
  });
});
