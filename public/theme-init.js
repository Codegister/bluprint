/**
 * Applies the stored theme before React mounts, so the first paint is already
 * light or dark. Kept as a separate file (rather than an inline script) so the
 * Content-Security-Policy can use `script-src 'self'` without a hash.
 */
(function () {
  try {
    var stored = window.localStorage.getItem("bluprint.theme");
    // The product is dark-first. Light remains an explicit, stored choice.
    var dark = stored !== "light";
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (error) {
    /* Storage can be blocked; the dark stage is the safe default. */
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  }

  /*
   * Paint the signed-out Home hero from static markup while the app bundle
   * loads. People with a stored session keep the loader because Home sends
   * them straight to their workspace.
   */
  try {
    var path = window.location.pathname.replace(/index\.html$/, "");
    var home = path === "/" || path === "/bluprint" || path === "/bluprint/";
    var signedIn = Boolean(
      window.localStorage.getItem("__convexAuthJWT") ||
        window.localStorage.getItem("__convexAuthRefreshToken") ||
        window.sessionStorage.getItem("__convexAuthJWT") ||
        window.sessionStorage.getItem("__convexAuthRefreshToken"),
    );
    if (home && !signedIn) {
      document.documentElement.classList.add("home-shell");
    }
  } catch (error) {
    /* Leave the loader in place if session storage is unavailable. */
  }
})();
