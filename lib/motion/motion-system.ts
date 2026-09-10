import type { MotionQuality } from "./useMotionQuality";

export type Pass489MotionTier = "still" | "efficient" | "full";

export type Pass489MotionBudget = {
  version: "pass489-premium-motion-budget";
  tier: Pass489MotionTier;
  targetFps: 0 | 30 | 45 | 60;
  dprCap: 1 | 1.25 | 1.5 | 1.75;
  particleCap: number;
  connectionCap: number;
  concurrentLoops: number;
  blur: boolean;
  parallax: boolean;
  orbit: boolean;
  pulse: boolean;
};

export const pass489MotionTokens = {
  duration: { instant: 0.12, fast: 0.2, standard: 0.34, deliberate: 0.52, reveal: 0.72 },
  ease: { enter: [0.16, 1, 0.3, 1], exit: [0.7, 0, 0.84, 0], move: [0.22, 1, 0.36, 1] },
} as const;

export function getPass489MotionBudget(
  quality: MotionQuality,
  reducedMotion = false,
): Pass489MotionBudget {
  if (reducedMotion) {
    return {
      version: "pass489-premium-motion-budget",
      tier: "still",
      targetFps: 0,
      dprCap: 1,
      particleCap: 0,
      connectionCap: 18,
      concurrentLoops: 0,
      blur: false,
      parallax: false,
      orbit: false,
      pulse: false,
    };
  }
  if (quality === "low") {
    return {
      version: "pass489-premium-motion-budget",
      tier: "efficient",
      targetFps: 30,
      dprCap: 1,
      particleCap: 4,
      connectionCap: 28,
      concurrentLoops: 1,
      blur: false,
      parallax: false,
      orbit: true,
      pulse: false,
    };
  }
  if (quality === "medium") {
    return {
      version: "pass489-premium-motion-budget",
      tier: "efficient",
      targetFps: 45,
      dprCap: 1.25,
      particleCap: 10,
      connectionCap: 48,
      concurrentLoops: 2,
      blur: true,
      parallax: true,
      orbit: true,
      pulse: false,
    };
  }
  return {
    version: "pass489-premium-motion-budget",
    tier: "full",
    targetFps: 60,
    dprCap: 1.5,
    particleCap: 18,
    connectionCap: 72,
    concurrentLoops: 3,
    blur: true,
    parallax: true,
    orbit: true,
    pulse: true,
  };
}
