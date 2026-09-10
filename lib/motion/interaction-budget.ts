import type { Pass542MotionControl } from "./motion-control";

export type Pass549InteractionBudget = {
  version: "interaction-budget";
  mode: "premium" | "efficient" | "still";
  inputLatencyTargetMs: 50 | 75 | 100;
  maxConcurrentAmbientLoops: 0 | 1 | 2;
  maxBlurPx: 0 | 8 | 16;
  allowParallax: boolean;
  allowSpring: boolean;
  headline: string;
  boundary: string;
};

export function buildPass549InteractionBudget(
  locale: "pl" | "de" | "en",
  motion: Pass542MotionControl,
): Pass549InteractionBudget {
  const mode: Pass549InteractionBudget["mode"] = motion.mode === "full" ? "premium" : motion.mode;
  const inputLatencyTargetMs = mode === "premium" ? 50 : mode === "efficient" ? 75 : 100;
  const maxConcurrentAmbientLoops = mode === "premium" ? 2 : mode === "efficient" ? 1 : 0;
  const maxBlurPx = mode === "premium" ? 16 : mode === "efficient" ? 8 : 0;
  return {
    version: "interaction-budget",
    mode,
    inputLatencyTargetMs,
    maxConcurrentAmbientLoops,
    maxBlurPx,
    allowParallax: mode === "premium",
    allowSpring: mode !== "still",
    headline:
      locale === "pl"
        ? `Budżet interakcji: ${mode} · cel ${inputLatencyTargetMs} ms`
        : locale === "de"
          ? `Interaktionsbudget: ${mode} · Ziel ${inputLatencyTargetMs} ms`
          : `Interaction budget: ${mode} · ${inputLatencyTargetMs} ms target`,
    boundary:
      "The budget limits decorative effects only. Focus, keyboard navigation, content visibility and functional state changes remain available.",
  };
}
