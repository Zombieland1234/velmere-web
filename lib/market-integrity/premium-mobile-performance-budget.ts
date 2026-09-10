export type Pass645ViewportWidth = 320 | 360 | 390 | 430;

export type Pass645PerformanceSample = {
  viewportWidth: number;
  inpMs: number | null;
  cls: number;
  maxLongTaskMs: number;
  longTaskCount: number;
  maxAnimationFrameMs: number | null;
  activeWebglScenes: number;
  hiddenScenesFrozen: boolean;
  horizontalOverflowPx: number;
};

export type Pass645PremiumMobilePerformanceBudget = {
  version: "premium-mobile-performance-budget";
  state: "budget_defined" | "pass" | "review" | "blocked";
  viewportMatrix: readonly Pass645ViewportWidth[];
  thresholds: {
    inpGoodMs: 200;
    clsMax: 0.1;
    longTaskMaxMs: 50;
    longTaskCountMax: 4;
    animationFrameBudgetMs: 20;
    activeWebglScenesMax: 1;
    horizontalOverflowMaxPx: 4;
  };
  runtimePolicy: {
    freezeHiddenScenes: true;
    oneDecorativeLoopMax: true;
    progressiveNodeBudget: { mobile: 5; tablet: 7; desktop: 10 };
    reducedMotionStopsDecorativeLoops: true;
    coarsePointerDisablesParallax: true;
  };
  sample: Pass645PerformanceSample | null;
  violations: string[];
  boundary: string;
};

const VIEWPORTS = [320, 360, 390, 430] as const;

export function buildPass645PremiumMobilePerformanceBudget(
  sample: Pass645PerformanceSample | null = null,
): Pass645PremiumMobilePerformanceBudget {
  const violations: string[] = [];
  if (sample) {
    if (sample.inpMs !== null && sample.inpMs > 200) violations.push("inp_over_200ms");
    if (sample.cls > 0.1) violations.push("cls_over_0_1");
    if (sample.maxLongTaskMs > 50) violations.push("long_task_over_50ms");
    if (sample.longTaskCount > 4) violations.push("too_many_long_tasks");
    if (sample.maxAnimationFrameMs !== null && sample.maxAnimationFrameMs > 20) violations.push("animation_frame_over_20ms");
    if (sample.activeWebglScenes > 1) violations.push("multiple_active_webgl_scenes");
    if (!sample.hiddenScenesFrozen) violations.push("hidden_scene_not_frozen");
    if (sample.horizontalOverflowPx > 4) violations.push("horizontal_overflow");
  }
  const severe = violations.some((violation) =>
    ["multiple_active_webgl_scenes", "hidden_scene_not_frozen", "horizontal_overflow"].includes(violation),
  );
  return {
    version: "premium-mobile-performance-budget",
    state: !sample ? "budget_defined" : severe ? "blocked" : violations.length ? "review" : "pass",
    viewportMatrix: VIEWPORTS,
    thresholds: {
      inpGoodMs: 200,
      clsMax: 0.1,
      longTaskMaxMs: 50,
      longTaskCountMax: 4,
      animationFrameBudgetMs: 20,
      activeWebglScenesMax: 1,
      horizontalOverflowMaxPx: 4,
    },
    runtimePolicy: {
      freezeHiddenScenes: true,
      oneDecorativeLoopMax: true,
      progressiveNodeBudget: { mobile: 5, tablet: 7, desktop: 10 },
      reducedMotionStopsDecorativeLoops: true,
      coarsePointerDisablesParallax: true,
    },
    sample,
    violations,
    boundary:
      "Premium motion is allowed only inside the interaction budget. Hidden scenes freeze, reduced motion stops decorative loops, and no visual effect may create horizontal overflow or block input.",
  };
}
