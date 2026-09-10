"use client";

import { useEffect } from "react";

import {
  consumePendingModalScrollRestore,
  scheduleModalScrollRestore,
} from "@/lib/ui/modal-scroll-lock-policy";

type ScrollLockSnapshot = {
  count: number;
  scrollX: number;
  scrollY: number;
  scrollRestoration: ScrollRestoration;
  html: {
    overflow: string;
    overscrollBehavior: string;
    scrollbarGutter: string;
  };
  body: {
    overflow: string;
    overscrollBehavior: string;
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
    paddingRight: string;
    touchAction: string;
  };
  removeOwnershipListeners: () => void;
};

declare global {
  interface Window {
    __velmereModalScrollLock?: ScrollLockSnapshot;
  }
}

function closestScrollRegion(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? target.closest<HTMLElement>('[data-modal-scroll-region="true"]')
    : null;
}

function closestGestureOwner(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? target.closest<HTMLElement>(
        '[data-modal-wheel-owner="true"], [data-chart-gesture-surface]',
      )
    : null;
}

function canConsumeVerticalScroll(region: HTMLElement, deltaY: number): boolean {
  if (region.scrollHeight <= region.clientHeight + 1) return false;
  if (deltaY < 0) return region.scrollTop > 0;
  if (deltaY > 0) return region.scrollTop + region.clientHeight < region.scrollHeight - 1;
  return true;
}

function normalizeIOSScrollBoundary(region: HTMLElement | null) {
  if (!region || region.scrollHeight <= region.clientHeight + 1) return;
  const maxScrollTop = region.scrollHeight - region.clientHeight;
  if (region.scrollTop <= 0) region.scrollTop = 1;
  else if (region.scrollTop >= maxScrollTop) region.scrollTop = Math.max(0, maxScrollTop - 1);
}

function installScrollOwnershipListeners(): () => void {
  let previousTouchY: number | null = null;
  let touchRegion: HTMLElement | null = null;

  const onWheel = (event: WheelEvent) => {
    const gestureOwner = closestGestureOwner(event.target);
    if (gestureOwner) {
      // PASS1988: charts/modals should not steal normal wheel scroll in the
      // capture phase. Modifier-wheel is still reserved for chart zoom / OS
      // zoom safety, but a plain wheel may scroll the modal-owned region.
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        event.preventDefault();
      }
      return;
    }
    const region = closestScrollRegion(event.target);
    if (!region || !canConsumeVerticalScroll(region, event.deltaY)) {
      event.preventDefault();
    }
  };

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) {
      previousTouchY = null;
      touchRegion = null;
      return;
    }
    previousTouchY = event.touches[0].clientY;
    touchRegion = closestScrollRegion(event.target);
    normalizeIOSScrollBoundary(touchRegion);
  };

  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length !== 1 || previousTouchY === null) {
      event.preventDefault();
      return;
    }
    const nextY = event.touches[0].clientY;
    const deltaY = previousTouchY - nextY;
    previousTouchY = nextY;
    const gestureOwner = closestGestureOwner(event.target);
    const region = touchRegion ?? closestScrollRegion(event.target);
    if (gestureOwner) {
      // PASS1988: allow vertical panning inside the modal while the pointer is
      // over chart/brain surfaces. Only block if there is no owned scroll
      // region left to consume the gesture.
      if (!region || !canConsumeVerticalScroll(region, deltaY)) {
        event.preventDefault();
        normalizeIOSScrollBoundary(region);
      }
      return;
    }
    if (!region || !canConsumeVerticalScroll(region, deltaY)) {
      event.preventDefault();
      normalizeIOSScrollBoundary(region);
    }
  };

  const onTouchEnd = () => {
    previousTouchY = null;
    touchRegion = null;
  };

  document.addEventListener("wheel", onWheel, { capture: true, passive: false });
  document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
  document.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
  document.addEventListener("touchend", onTouchEnd, { capture: true, passive: true });
  document.addEventListener("touchcancel", onTouchEnd, { capture: true, passive: true });

  return () => {
    document.removeEventListener("wheel", onWheel, true);
    document.removeEventListener("touchstart", onTouchStart, true);
    document.removeEventListener("touchmove", onTouchMove, true);
    document.removeEventListener("touchend", onTouchEnd, true);
    document.removeEventListener("touchcancel", onTouchEnd, true);
  };
}

/**
 * PASS629: iOS-safe, reference-counted page scroll ownership for stacked
 * portals. Only `[data-modal-scroll-region="true"]` may consume wheel/touch
 * input while at least one modal owns the page.
 */
export function useModalScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === "undefined") return undefined;

    const html = document.documentElement;
    const body = document.body;
    let snapshot = window.__velmereModalScrollLock;

    if (!snapshot) {
      const pendingCoordinates = consumePendingModalScrollRestore({
        cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
      });
      const scrollX = pendingCoordinates?.scrollX ?? window.scrollX;
      const scrollY = pendingCoordinates?.scrollY ?? window.scrollY;
      const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
      const scrollRestoration = window.history.scrollRestoration;

      snapshot = {
        count: 0,
        scrollX,
        scrollY,
        scrollRestoration,
        html: {
          overflow: html.style.overflow,
          overscrollBehavior: html.style.overscrollBehavior,
          scrollbarGutter: html.style.scrollbarGutter,
        },
        body: {
          overflow: body.style.overflow,
          overscrollBehavior: body.style.overscrollBehavior,
          position: body.style.position,
          top: body.style.top,
          left: body.style.left,
          right: body.style.right,
          width: body.style.width,
          paddingRight: body.style.paddingRight,
          touchAction: body.style.touchAction,
        },
        removeOwnershipListeners: installScrollOwnershipListeners(),
      };

      window.history.scrollRestoration = "manual";
      html.style.overflow = "hidden";
      html.style.overscrollBehavior = "none";
      html.style.scrollbarGutter = "stable";

      body.style.overflow = "hidden";
      body.style.overscrollBehavior = "none";
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = `-${scrollX}px`;
      body.style.right = "0";
      body.style.width = "100%";
      body.style.touchAction = "none";
      if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

      html.dataset.velmereScrollLocked = "true";
      body.dataset.velmereScrollLocked = "true";
      window.__velmereModalScrollLock = snapshot;
    }

    snapshot.count += 1;
    html.dataset.velmereScrollOwners = String(snapshot.count);

    return () => {
      const current = window.__velmereModalScrollLock;
      if (!current) return;
      current.count = Math.max(0, current.count - 1);
      html.dataset.velmereScrollOwners = String(current.count);
      if (current.count > 0) return;

      current.removeOwnershipListeners();
      html.style.overflow = current.html.overflow;
      html.style.overscrollBehavior = current.html.overscrollBehavior;
      html.style.scrollbarGutter = current.html.scrollbarGutter;

      body.style.overflow = current.body.overflow;
      body.style.overscrollBehavior = current.body.overscrollBehavior;
      body.style.position = current.body.position;
      body.style.top = current.body.top;
      body.style.left = current.body.left;
      body.style.right = current.body.right;
      body.style.width = current.body.width;
      body.style.paddingRight = current.body.paddingRight;
      body.style.touchAction = current.body.touchAction;
      window.history.scrollRestoration = current.scrollRestoration;

      delete html.dataset.velmereScrollLocked;
      delete html.dataset.velmereScrollOwners;
      delete body.dataset.velmereScrollLocked;
      delete window.__velmereModalScrollLock;
      scheduleModalScrollRestore(
        { scrollX: current.scrollX, scrollY: current.scrollY },
        {
          requestFrame: (callback) => window.requestAnimationFrame(callback),
          cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
          scrollTo: (scrollX, scrollY) => window.scrollTo(scrollX, scrollY),
          hasActiveLock: () => Boolean(window.__velmereModalScrollLock),
        },
      );
    };
  }, [active]);
}
