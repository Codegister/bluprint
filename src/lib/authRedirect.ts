/**
 * Where a guest lands after adding an email.
 *
 * There is no `/sets` route: the saved-set library is the `#sets` section of
 * the tutor home. Returning to a set the guest already has is better still,
 * because that is the work they were looking at when they chose to keep it.
 */
export function guestKeepWorkHref(pathname: string): string {
  const returnTo = /^\/sets\/[a-z0-9]{20,40}(?:\/[a-z]+)?$/i.test(pathname)
    ? pathname
    : "/tutor#sets";
  return `/auth?link=1&returnTo=${encodeURIComponent(returnTo)}`;
}

/** Resolves an auth destination, refusing absolute URLs and protocol tricks. */
export function safeReturnTo(value: string | null, fallback = "/tutor"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
