/**
 * Applies the stored theme before React mounts, so the first paint is already
 * light or dark. Kept as a separate file (rather than an inline script) so the
 * Content-Security-Policy can use `script-src 'self'` without a hash.
 */
(function () {
  try {
    var stored = window.localStorage.getItem("bluprint.theme");
    var dark =
      stored === "dark" ||
      (stored !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (error) {
    /* Storage can be blocked; the light sheet is the safe default. */
  }
})();
