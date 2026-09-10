"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";
import { resolvePass627MotionProfile } from "@/lib/ui/motion-constitution";

function readMedia(query: string): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(query).matches
    : false;
}

const subscribeToClientAvailability = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function subscribeToMedia(query: string, onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const media = window.matchMedia(query);
  media.addEventListener?.("change", onChange);
  return () => media.removeEventListener?.("change", onChange);
}

const subscribeToCoarsePointer = (onChange: () => void) =>
  subscribeToMedia("(pointer: coarse)", onChange);
const subscribeToCompactViewport = (onChange: () => void) =>
  subscribeToMedia("(max-width: 780px)", onChange);
const getCoarsePointerSnapshot = () => readMedia("(pointer: coarse)");
const getCompactViewportSnapshot = () => readMedia("(max-width: 780px)");

export function useVelmereMotionProfile() {
  const requestedReducedMotion = Boolean(useReducedMotion());
  const mediaReady = useSyncExternalStore(
    subscribeToClientAvailability,
    getClientSnapshot,
    getServerSnapshot,
  );
  const coarsePointer = useSyncExternalStore(
    subscribeToCoarsePointer,
    getCoarsePointerSnapshot,
    getServerSnapshot,
  );
  const compactViewport = useSyncExternalStore(
    subscribeToCompactViewport,
    getCompactViewportSnapshot,
    getServerSnapshot,
  );

  return useMemo(
    () =>
      resolvePass627MotionProfile({
        // `useReducedMotion` can resolve differently during SSR and on the
        // browser's first render. Deferring media-derived values until after
        // hydration keeps the initial tree deterministic and avoids a global
        // hydration rebuild on every route.
        reducedMotion: mediaReady && requestedReducedMotion,
        coarsePointer: mediaReady && coarsePointer,
        compactViewport: mediaReady && compactViewport,
      }),
    [coarsePointer, compactViewport, mediaReady, requestedReducedMotion],
  );
}
