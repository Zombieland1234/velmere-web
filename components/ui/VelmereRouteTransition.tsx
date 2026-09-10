"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { VShieldPulse } from "@/components/motion/VelmereAnalysisMarks";
import {
  ROUTE_HASH_TARGET_WAIT_MS,
  classifyRouteTransitionHash,
  decodeRouteTransitionHash,
  isRouteTransitionSelfTarget,
  rememberBoundedRoutePrefetchKey,
} from "@/lib/ui/route-transition-policy";

const ROUTE_TRANSITION_MIN_MS = 220;
const ROUTE_TRANSITION_REDUCED_MS = 60;
// Streamed fallbacks can mount a few frames after the URL and first route
// surface commit. Require a genuinely quiet window before revealing the page.
const ROUTE_TRANSITION_SETTLE_MS = 90;
const ROUTE_TRANSITION_REDUCED_SETTLE_MS = 24;
const ROUTE_TRANSITION_SAFETY_MS = 30_000;
const ROUTE_LOADING_SELECTOR =
  '[data-velmere-route-loading="true"], .velmere-route-loading-screen';
const ROUTE_PREFETCH_INTENT_DELAY_MS = 90;
const ROUTE_PREFETCH_PRODUCTION_IDLE_MS = 2_400;

function focusRouteDestination(element: HTMLElement) {
  const hadTabIndex = element.hasAttribute("tabindex");
  if (!hadTabIndex) element.setAttribute("tabindex", "-1");
  element.focus({ preventScroll: true });
  if (!hadTabIndex) {
    element.addEventListener("blur", () => element.removeAttribute("tabindex"), { once: true });
  }
}

function findRouteHashTarget(hash: string | null | undefined): HTMLElement | null {
  const decoded = decodeRouteTransitionHash(hash);
  if (!decoded) return null;
  const byId = document.getElementById(decoded);
  if (byId instanceof HTMLElement) return byId;
  const byName = document.getElementsByName(decoded)[0];
  return byName instanceof HTMLElement ? byName : null;
}

type RouteLoadingMarkProps = {
  label?: string;
  compact?: boolean;
};

export function VelmereRouteLoadingMark({ label = "Velmère", compact = false }: RouteLoadingMarkProps) {
  return (
    <div className="velmere-route-loader-mark" data-compact={compact ? "true" : "false"}>
      <VShieldPulse monochrome size={compact ? "4.5rem" : "clamp(5.75rem, 15vw, 8rem)"} />
      <div className="velmere-route-loader-copy">
        <strong>VELMÈRE</strong>
        <span>{label}</span>
      </div>
      <i className="velmere-route-loader-progress" aria-hidden="true" />
    </div>
  );
}

function isPlainInternalNavigation(event: MouseEvent, anchor: HTMLAnchorElement) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !isRouteTransitionSelfTarget(anchor.getAttribute("target")) ||
    anchor.hasAttribute("download") ||
    anchor.dataset.noRouteTransition === "true"
  ) {
    return false;
  }

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;

  const next = new URL(anchor.href, window.location.href);
  if (next.origin !== window.location.origin) return false;
  if (next.pathname.startsWith("/api/") || /\.(?:pdf|csv|zip|json|xml|txt)$/i.test(next.pathname)) return false;

  const current = new URL(window.location.href);
  return next.pathname !== current.pathname || next.search !== current.search;
}

export default function VelmereRouteTransition() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = pathname?.split("/").filter(Boolean)[0];
  const transitionLabel = locale === "pl"
    ? "Chronione przejście"
    : locale === "de"
      ? "Sicherer Übergang"
      : "Secure transition";
  const [visible, setVisible] = useState(false);
  const previousPath = useRef(pathname);
  const navigationStarted = useRef(false);
  const visibleSince = useRef<number | null>(null);
  const targetUrl = useRef<string | null>(null);
  const initialPathname = useRef<string | null>(null);
  const initialRouteSurface = useRef<Element | null>(null);
  const prefetchedRoutes = useRef(new Set<string>());
  const resetScrollOnCommit = useRef(false);
  const transitionRun = useRef(0);
  const readinessTimer = useRef<number | null>(null);
  const safetyTimer = useRef<number | null>(null);
  const navigationFrame = useRef<number | null>(null);
  const navigationCommitFrame = useRef<number | null>(null);
  const intentPrefetchTimer = useRef<number | null>(null);
  const intentPrefetchAnchor = useRef<HTMLAnchorElement | null>(null);

  const clearIntentPrefetch = useCallback(() => {
    if (intentPrefetchTimer.current) window.clearTimeout(intentPrefetchTimer.current);
    intentPrefetchTimer.current = null;
    intentPrefetchAnchor.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    if (readinessTimer.current) clearTimeout(readinessTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    if (navigationFrame.current !== null) window.cancelAnimationFrame(navigationFrame.current);
    if (navigationCommitFrame.current !== null) window.cancelAnimationFrame(navigationCommitFrame.current);
    readinessTimer.current = null;
    safetyTimer.current = null;
    navigationFrame.current = null;
    navigationCommitFrame.current = null;
    clearIntentPrefetch();
  }, [clearIntentPrefetch]);

  const commitDestinationPositionAndFocus = useCallback(() => {
    const destinationHref = targetUrl.current;
    if (!destinationHref) return;
    const destination = new URL(destinationHref, window.location.href);
    const current = new URL(window.location.href);
    if (current.pathname !== destination.pathname || current.search !== destination.search) return;

    const hashClassification = classifyRouteTransitionHash(destination.hash);
    const hashTarget = hashClassification.kind === "valid"
      ? findRouteHashTarget(destination.hash)
      : null;
    if (hashTarget) {
      hashTarget.scrollIntoView({ block: "start", inline: "nearest" });
      focusRouteDestination(hashTarget);
      return;
    }

    // Invalid or unresolved hashes must not hold the full-screen veil until the
    // 30-second safety timeout. Fall back to the route start and main landmark.
    if (resetScrollOnCommit.current || hashClassification.kind !== "none") {
      window.scrollTo(0, 0);
    }
    const main = document.getElementById("main-content");
    if (main instanceof HTMLElement) focusRouteDestination(main);
  }, []);

  const finish = useCallback((run: number) => {
    if (transitionRun.current !== run) return;
    commitDestinationPositionAndFocus();
    resetScrollOnCommit.current = false;
    navigationStarted.current = false;
    visibleSince.current = null;
    targetUrl.current = null;
    initialPathname.current = null;
    initialRouteSurface.current = null;
    clearTimers();
    setVisible(false);
  }, [clearTimers, commitDestinationPositionAndFocus]);

  const recoverFromSafetyTimeout = useCallback((run: number) => {
    if (transitionRun.current !== run) return;
    const destinationHref = targetUrl.current;
    if (!destinationHref) {
      finish(run);
      return;
    }

    // A timeout is not evidence that the destination rendered. Never uncover
    // stale content under a committed URL; recover through a fresh document so
    // Next's route error/not-found boundary owns the visible result.
    const destination = new URL(destinationHref, window.location.href);
    const current = new URL(window.location.href);
    clearTimers();
    if (current.pathname !== destination.pathname || current.search !== destination.search) {
      window.location.assign(destination.href);
      return;
    }
    window.location.reload();
  }, [clearTimers, finish]);

  const waitForDestination = useCallback((run: number) => {
    const startedAt = visibleSince.current ?? window.performance.now();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minimumVisibleMs = reducedMotion
      ? ROUTE_TRANSITION_REDUCED_MS
      : ROUTE_TRANSITION_MIN_MS;
    const settleMs = reducedMotion
      ? ROUTE_TRANSITION_REDUCED_SETTLE_MS
      : ROUTE_TRANSITION_SETTLE_MS;
    let stableSince: number | null = null;
    let hashMissingSince: number | null = null;
    let lastLayoutSignature = "";

    const inspect = () => {
      if (transitionRun.current !== run) return;

      const now = window.performance.now();
      const currentUrl = new URL(window.location.href);
      const expectedUrl = targetUrl.current ? new URL(targetUrl.current) : null;
      const reachedDestination = !expectedUrl || (
        currentUrl.pathname === expectedUrl.pathname &&
        currentUrl.search === expectedUrl.search
      );
      // Keep the new document pinned to its beginning until the streamed
      // route has settled. Next may restore the previous Y position after the
      // first URL commit, especially when a scroll-locked drawer just closed.
      if (reachedDestination && resetScrollOnCommit.current) window.scrollTo(0, 0);
      const routeFallbackVisible = Boolean(document.querySelector(ROUTE_LOADING_SELECTOR));
      const main = document.getElementById("main-content");
      const mainReady = Boolean(main?.firstElementChild) && main?.getAttribute("aria-busy") !== "true";
      const criticalSurfacePending = Boolean(
        main?.querySelector('[data-velmere-critical-loading="true"]'),
      );
      const currentRouteSurface = main?.querySelector(":scope > .velmere-page-transition") ?? main?.firstElementChild ?? null;
      const pathWillChange = Boolean(expectedUrl && initialPathname.current && expectedUrl.pathname !== initialPathname.current);
      const committedRoutePath = currentRouteSurface?.getAttribute("data-velmere-route-path");
      // Locale layouts persist between sibling routes, so the outer surface DOM
      // node can remain identical while its streamed children change. Bind
      // readiness to the committed pathname marker instead of waiting for a
      // replacement node that may never exist.
      const routeSurfaceCommitted = !pathWillChange || (
        Boolean(expectedUrl) && committedRoutePath === expectedUrl?.pathname
      ) || !initialRouteSurface.current || currentRouteSurface !== initialRouteSurface.current;
      const expectedHash = expectedUrl?.hash ?? "";
      const hashClassification = classifyRouteTransitionHash(expectedHash);
      const hashTarget = hashClassification.kind === "valid"
        ? findRouteHashTarget(expectedHash)
        : null;
      if (!reachedDestination || hashClassification.kind !== "valid" || hashTarget) {
        hashMissingSince = null;
      } else if (hashMissingSince === null) {
        hashMissingSince = now;
      }
      const hashWaitExpired = hashMissingSince !== null && now - hashMissingSince >= ROUTE_HASH_TARGET_WAIT_MS;
      const hashTargetReady = hashClassification.kind !== "valid" || Boolean(hashTarget) || hashWaitExpired;
      const viewportBottom = window.innerHeight * 1.12;
      const pendingAboveFoldImage = Array.from(main?.querySelectorAll("img") ?? []).some((image) => {
        const rect = image.getBoundingClientRect();
        const isAboveFold = rect.top < viewportBottom && rect.bottom > 0;
        // A completed image with naturalWidth=0 has already failed and should
        // yield to its UI fallback instead of holding the whole route hostage.
        return isAboveFold && !image.complete;
      });
      const fontsReady = !document.fonts || document.fonts.status === "loaded";
      const layoutSignature = main
        ? `${main.childElementCount}:${main.scrollHeight}:${document.documentElement.scrollHeight}:${hashClassification.kind}:${hashClassification.value ?? ""}:${hashTargetReady}:${criticalSurfacePending}:${fontsReady}`
        : "missing";
      const visuallyReady = reachedDestination && routeSurfaceCommitted && hashTargetReady && mainReady && fontsReady && !criticalSurfacePending && !routeFallbackVisible && !pendingAboveFoldImage;

      if (!visuallyReady || layoutSignature !== lastLayoutSignature) {
        stableSince = null;
        lastLayoutSignature = layoutSignature;
      } else if (stableSince === null) {
        stableSince = now;
      }

      const minimumElapsed = now - startedAt >= minimumVisibleMs;
      const layoutSettled = stableSince !== null && now - stableSince >= settleMs;
      if (minimumElapsed && layoutSettled) {
        finish(run);
        return;
      }

      readinessTimer.current = window.setTimeout(inspect, 60);
    };

    inspect();
  }, [finish]);

  const begin = useCallback((destination?: string, fromPathname?: string | null) => {
    clearTimers();
    const run = transitionRun.current + 1;
    transitionRun.current = run;
    navigationStarted.current = true;
    visibleSince.current = window.performance.now();
    targetUrl.current = destination ?? window.location.href;
    initialPathname.current = fromPathname ?? window.location.pathname;
    const main = document.getElementById("main-content");
    initialRouteSurface.current = main?.querySelector(":scope > .velmere-page-transition") ?? main?.firstElementChild ?? null;
    setVisible(true);
    waitForDestination(run);
    safetyTimer.current = window.setTimeout(() => recoverFromSafetyTimeout(run), ROUTE_TRANSITION_SAFETY_MS);
  }, [clearTimers, recoverFromSafetyTimeout, waitForDestination]);

  const prefetchInternalRoute = useCallback((href: string) => {
    const destination = new URL(href, window.location.href);
    if (destination.origin !== window.location.origin || destination.pathname.startsWith("/api/")) return;
    const key = `${destination.pathname}${destination.search}`;
    if (!rememberBoundedRoutePrefetchKey(prefetchedRoutes.current, key)) return;
    router.prefetch(key);
  }, [router]);

  useEffect(() => {
    // In development every prefetched heavy route can trigger a separate
    // compiler job and compete with the route the developer is actually
    // opening. Keep dev intent-driven. Production may prewarm only one nearby
    // route during a genuinely idle, non-metered connection.
    if (process.env.NODE_ENV !== "production") return undefined;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") return undefined;
    const localePrefix = locale === "pl" || locale === "de" ? locale : "en";
    const current = window.location.pathname;
    const candidates = [
      `/${localePrefix}/market-integrity`,
      `/${localePrefix}/shield-pro`,
      `/${localePrefix}/real-markets`,
      `/${localePrefix}/search`,
    ].filter((route) => route !== current);
    const prewarmOne = () => {
      const next = candidates[0];
      if (next) prefetchInternalRoute(next);
    };
    const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (typeof idleWindow.requestIdleCallback === "function") {
      const id = idleWindow.requestIdleCallback(prewarmOne, { timeout: ROUTE_PREFETCH_PRODUCTION_IDLE_MS });
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(prewarmOne, ROUTE_PREFETCH_PRODUCTION_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [locale, prefetchInternalRoute]);

  useEffect(() => {
    const cancelIntentForAnchor = (anchor: HTMLAnchorElement | null, relatedTarget: EventTarget | null) => {
      if (!anchor || intentPrefetchAnchor.current !== anchor) return;
      if (relatedTarget instanceof Node && anchor.contains(relatedTarget)) return;
      clearIntentPrefetch();
    };

    const onIntent = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        !isRouteTransitionSelfTarget(anchor.getAttribute("target")) ||
        anchor.hasAttribute("download") ||
        anchor.dataset.noRouteTransition === "true"
      ) return;
      if (
        intentPrefetchAnchor.current === anchor &&
        intentPrefetchTimer.current !== null
      ) return;
      if (
        "relatedTarget" in event &&
        event.relatedTarget instanceof Node &&
        anchor.contains(event.relatedTarget)
      ) return;
      clearIntentPrefetch();
      intentPrefetchAnchor.current = anchor;
      const destinationHref = anchor.href;
      intentPrefetchTimer.current = window.setTimeout(() => {
        intentPrefetchTimer.current = null;
        intentPrefetchAnchor.current = null;
        prefetchInternalRoute(destinationHref);
      }, ROUTE_PREFETCH_INTENT_DELAY_MS);
    };
    const onPointerOut = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      cancelIntentForAnchor(anchor instanceof HTMLAnchorElement ? anchor : null, event.relatedTarget);
    };
    const onFocusOut = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      cancelIntentForAnchor(anchor instanceof HTMLAnchorElement ? anchor : null, event.relatedTarget);
    };
    document.addEventListener("pointerover", onIntent, true);
    document.addEventListener("focusin", onIntent, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("focusout", onFocusOut, true);
    return () => {
      document.removeEventListener("pointerover", onIntent, true);
      document.removeEventListener("focusin", onIntent, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("focusout", onFocusOut, true);
      clearIntentPrefetch();
    };
  }, [clearIntentPrefetch, prefetchInternalRoute]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || !isPlainInternalNavigation(event, anchor)) return;
      const destination = new URL(anchor.href, window.location.href);
      event.preventDefault();
      resetScrollOnCommit.current = !destination.hash;
      begin(anchor.href);
      const destinationHref = anchor.href;
      const destinationPath = `${destination.pathname}${destination.search}${destination.hash}`;

      // Let React commit and the browser paint the veil before route work can
      // occupy the main thread. Two animation frames guarantee one completed
      // paint without adding a perceptible pause to the transition.
      navigationFrame.current = window.requestAnimationFrame(() => {
        navigationFrame.current = null;
        navigationCommitFrame.current = window.requestAnimationFrame(() => {
          navigationCommitFrame.current = null;
          if (targetUrl.current !== destinationHref) return;
          // All scroll/focus placement is committed while the veil is still
          // visible, avoiding a post-loader jump for top and hash destinations.
          if (!destination.hash) window.scrollTo(0, 0);
          router.push(destinationPath, { scroll: false });
        });
      });
    };

    const onPopState = () => begin(window.location.href, previousPath.current);
    const onPageShow = () => {
      transitionRun.current += 1;
      navigationStarted.current = false;
      visibleSince.current = null;
      targetUrl.current = null;
      initialPathname.current = null;
      initialRouteSurface.current = null;
      resetScrollOnCommit.current = false;
      clearTimers();
      setVisible(false);
    };

    // Next/React handles Link clicks before a document bubble listener and
    // calls preventDefault(), which previously meant the destination could
    // commit before our veil started. Capture gives this single transition
    // owner the click while retaining the explicit data-no-route-transition
    // escape hatch for links with custom behavior.
    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
      clearTimers();
    };
  }, [begin, clearTimers, router]);

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!(main instanceof HTMLElement)) return undefined;
    const wasInert = main.inert;
    main.inert = visible;
    return () => {
      main.inert = wasInert;
    };
  }, [visible]);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    const previous = previousPath.current;
    previousPath.current = pathname;
    if (!navigationStarted.current) begin(window.location.href, previous);
  }, [begin, pathname]);

  return (
    <>
      <div
        className="velmere-route-transition-veil"
        data-visible={visible ? "true" : "false"}
        aria-hidden="true"
      >
        {visible ? (
          <>
            <span className="velmere-route-transition-ambient" />
            <VelmereRouteLoadingMark label={transitionLabel} />
          </>
        ) : null}
      </div>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {visible ? transitionLabel : ""}
      </span>
    </>
  );
}
