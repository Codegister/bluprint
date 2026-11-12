/**
 * Cheap, storage-only check for an existing Convex Auth session.
 *
 * The real session is verified by Convex. This is only used before the client
 * has loaded, to choose between the public Home and the app loader and to keep
 * a signed-out Home from waiting on the auth round trip. Keep the keys in step
 * with theme-init.js, which uses the same check before React paints.
 */
const AUTH_KEYS = [
  "__convexAuthJWT",
  "__convexAuthRefreshToken",
] as const;

export function hasStoredAuthSession(): boolean {
  try {
    for (const key of AUTH_KEYS) {
      if (
        window.localStorage.getItem(key) ||
        window.sessionStorage.getItem(key)
      ) {
        return true;
      }
    }
  } catch {
    // Storage can be blocked; treat the visitor as signed out and let Convex
    // make the real decision once the app loads.
  }
  return false;
}
