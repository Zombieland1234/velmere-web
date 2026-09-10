"use client";

import { useEffect, useState } from "react";

export type Pass527AdaptiveFrameBudget = {
  version: "pass527-adaptive-frame-budget";
  state: "sampling" | "stable" | "constrained";
  averageFrameMs: number;
  droppedFrameRatio: number;
  targetFps: 60 | 45 | 30;
  allowAmbientMotion: boolean;
  reason: string;
};

const initial: Pass527AdaptiveFrameBudget = {
  version: "pass527-adaptive-frame-budget",
  state: "sampling",
  averageFrameMs: 16.7,
  droppedFrameRatio: 0,
  targetFps: 45,
  allowAmbientMotion: false,
  reason: "Measuring the current rendering budget.",
};

export function usePass527AdaptiveFrameBudget(enabled = true): Pass527AdaptiveFrameBudget {
  const [budget, setBudget] = useState<Pass527AdaptiveFrameBudget>(initial);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let frame = 0;
    let previous = performance.now();
    const samples: number[] = [];
    let cancelled = false;
    const tick = (time: number) => {
      if (cancelled) return;
      const delta = time - previous;
      previous = time;
      if (delta > 0 && delta < 250) samples.push(delta);
      if (samples.length >= 42) {
        const averageFrameMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
        const droppedFrameRatio = samples.filter((value) => value > 24).length / samples.length;
        const constrained = averageFrameMs > 22 || droppedFrameRatio > 0.22;
        setBudget({
          version: "pass527-adaptive-frame-budget",
          state: constrained ? "constrained" : "stable",
          averageFrameMs: Math.round(averageFrameMs * 10) / 10,
          droppedFrameRatio: Math.round(droppedFrameRatio * 100) / 100,
          targetFps: constrained ? 30 : averageFrameMs > 18 ? 45 : 60,
          allowAmbientMotion: !constrained && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          reason: constrained
            ? "Frame pacing is under pressure, so ambient loops should pause and state changes should use short opacity/transform transitions."
            : "Frame pacing is stable enough for restrained ambient motion.",
        });
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return budget;
}
