/**
 * Opens the browser print dialog with a class that marks the print-only view.
 *
 * The class must survive until `afterprint`: removing the print layer
 * immediately after `window.print()` can discard it before the browser takes
 * its print snapshot, which is how the app shell ended up in the preview.
 */
export function printWithClass(className: string, onFinish?: () => void): void {
  document.body.classList.add(className);

  let finished = false;
  let fallback = 0;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.removeEventListener("afterprint", finish);
    if (fallback) window.clearTimeout(fallback);
    document.body.classList.remove(className);
    onFinish?.();
  };

  window.addEventListener("afterprint", finish, { once: true });
  // Browsers that never fire afterprint still get their page back.
  fallback = window.setTimeout(finish, 120_000);

  try {
    window.print();
  } catch {
    finish();
  }
}
