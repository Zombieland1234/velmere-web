export type MotionPriority = "critical" | "state" | "ambient";

export type MotionEnvironment = {
  reducedMotion?: boolean;
  coarsePointer?: boolean;
  compactViewport?: boolean;
};

export type MotionProfile = {
  duration: {
    instant: number;
    quick: number;
    standard: number;
    emphasis: number;
  };
  distance: {
    micro: number;
    standard: number;
    panel: number;
  };
  easing: readonly [number, number, number, number];
  spring: {
    stiffness: number;
    damping: number;
    mass: number;
  };
  staggerStep: number;
  maxStaggerItems: number;
  allowDecorativeLoop: boolean;
  blurPx: number;
};

export const PASS627_MOTION_VERSION = "pass627-motion-token-constitution" as const;

export const PASS627_LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

const DESKTOP_PROFILE: MotionProfile = {
  duration: { instant: 0.08, quick: 0.18, standard: 0.34, emphasis: 0.52 },
  distance: { micro: 6, standard: 14, panel: 28 },
  easing: PASS627_LUXURY_EASE,
  spring: { stiffness: 240, damping: 28, mass: 0.9 },
  staggerStep: 0.035,
  maxStaggerItems: 8,
  allowDecorativeLoop: true,
  blurPx: 10,
};

export function resolvePass627MotionProfile(environment: MotionEnvironment = {}): MotionProfile {
  if (environment.reducedMotion) {
    return {
      duration: { instant: 0, quick: 0, standard: 0, emphasis: 0 },
      distance: { micro: 0, standard: 0, panel: 0 },
      easing: PASS627_LUXURY_EASE,
      spring: { stiffness: 1000, damping: 100, mass: 0.1 },
      staggerStep: 0,
      maxStaggerItems: 0,
      allowDecorativeLoop: false,
      blurPx: 0,
    };
  }

  const compact = Boolean(environment.compactViewport || environment.coarsePointer);
  if (!compact) return DESKTOP_PROFILE;

  return {
    duration: { instant: 0.06, quick: 0.14, standard: 0.24, emphasis: 0.34 },
    distance: { micro: 4, standard: 9, panel: 18 },
    easing: PASS627_LUXURY_EASE,
    spring: { stiffness: 300, damping: 32, mass: 0.82 },
    staggerStep: 0.025,
    maxStaggerItems: 5,
    allowDecorativeLoop: false,
    blurPx: 4,
  };
}

export function pass627StaggerDelay(index: number, profile: MotionProfile): number {
  if (!Number.isFinite(index) || index <= 0 || profile.maxStaggerItems <= 0) return 0;
  return Math.min(index, profile.maxStaggerItems - 1) * profile.staggerStep;
}

export function pass627TransitionFor(
  priority: MotionPriority,
  profile: MotionProfile,
): { duration: number; ease: MotionProfile["easing"] } {
  const duration = priority === "critical"
    ? profile.duration.quick
    : priority === "ambient"
      ? profile.duration.emphasis
      : profile.duration.standard;
  return { duration, ease: profile.easing };
}
