import type { Pass496RuntimeSurfaceTier } from "./runtime-surface-governor";

export type Pass514InteractionMotion = {
  version: "interaction-motion-orchestrator";
  enabled: boolean;
  duration: number;
  stagger: number;
  distance: number;
  blur: number;
  easing: [number, number, number, number];
};

export function getPass514InteractionMotion(
  tier: Pass496RuntimeSurfaceTier,
  reducedMotion: boolean,
  intent: "enter" | "focus" | "ambient" = "enter",
): Pass514InteractionMotion {
  if (reducedMotion || tier === "still") {
    return {
      version: "interaction-motion-orchestrator",
      enabled: false,
      duration: 0,
      stagger: 0,
      distance: 0,
      blur: 0,
      easing: [0, 0, 1, 1],
    };
  }
  const efficient = tier === "efficient";
  return {
    version: "interaction-motion-orchestrator",
    enabled: true,
    duration: intent === "focus" ? (efficient ? 0.18 : 0.24) : intent === "ambient" ? (efficient ? 0.28 : 0.42) : (efficient ? 0.32 : 0.52),
    stagger: efficient ? 0.025 : 0.045,
    distance: efficient ? 6 : 12,
    blur: intent === "ambient" ? 0 : efficient ? 2 : 5,
    easing: [0.16, 1, 0.3, 1],
  };
}
