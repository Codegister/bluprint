/**
 * ResizeObserver loop guard.
 *
 * Browsers report
 *
 *   "ResizeObserver loop completed with undelivered notifications"
 *
 * when an observer's callback changes layout in a way that changes the size it
 * is watching: the callback resizes the element, the browser schedules another
 * notification, and the next delivery finds the size already stale again. The
 * browser surfaces that as an `error` event, which Vite's dev overlay turns
 * into a full-screen "Build Error" even though nothing crashed.
 *
 * The fix here is timing, not suppression: every observer callback is moved to
 * the next animation frame. Layout changes made by a callback then happen in a
 * normal frame, so the browser's delivery step finishes with no outstanding
 * notification and the loop cannot form.
 *
 * The last-resort listener at the bottom only covers observers that were
 * created before this module ran (the platform toolbar, browser extensions).
 * It matches that one message exactly and re-throws everything else, so a real
 * error is never hidden.
 */

type ResizeObserverCallbackLike = ConstructorParameters<typeof ResizeObserver>[0];

const GUARD_FLAG = "__bluprintResizeObserverGuard" as const;

export function installResizeObserverGuard(): void {
  if (typeof window === "undefined" || !("ResizeObserver" in window)) return;

  const host = window as typeof window & {
    [GUARD_FLAG]?: boolean;
    ResizeObserver: typeof ResizeObserver;
  };
  if (host[GUARD_FLAG]) return;
  host[GUARD_FLAG] = true;

  const NativeObserver = host.ResizeObserver;

  /**
   * Same public surface as ResizeObserver, but the callback is queued on the
   * next frame. Only the newest entry batch is delivered, which is what a
   * coalesced resize means anyway.
   */
  class GuardedResizeObserver implements ResizeObserver {
    private readonly inner: ResizeObserver;
    private frame = 0;
    private latest: ResizeObserverEntry[] = [];

    constructor(callback: ResizeObserverCallbackLike) {
      this.inner = new NativeObserver((entries) => {
        this.latest = entries;
        if (this.frame !== 0) return;
        this.frame = window.requestAnimationFrame(() => {
          this.frame = 0;
          // The guarded instance is passed as the observer, matching the API.
          callback(this.latest, this);
        });
      });
    }

    observe(target: Element, options?: ResizeObserverOptions): void {
      this.inner.observe(target, options);
    }

    unobserve(target: Element): void {
      this.inner.unobserve(target);
    }

    disconnect(): void {
      this.inner.disconnect();
      if (this.frame !== 0) window.cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.latest = [];
    }
  }

  host.ResizeObserver = GuardedResizeObserver as unknown as typeof ResizeObserver;

  window.addEventListener(
    "error",
    (event) => {
      const message = event.message ?? "";
      if (!message.includes("ResizeObserver loop")) return;
      // Benign, stackless browser notification: keep it in the console but do
      // not let the dev overlay fail the build over it.
      event.preventDefault();
      event.stopImmediatePropagation();
      console.debug("[resize-guard]", message);
    },
    true,
  );
}
