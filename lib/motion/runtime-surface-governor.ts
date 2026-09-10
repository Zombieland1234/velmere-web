export type Pass496RuntimeSurfaceTier = "still" | "efficient" | "full";

export type Pass496RuntimeSurfaceInput = {
  reducedMotion: boolean;
  reducedTransparency: boolean;
  saveData: boolean;
  visible: boolean;
  interactionRecent: boolean;
  hardwareConcurrency: number;
  deviceMemory: number;
  viewportWidth: number;
};

export type Pass496RuntimeSurfaceGovernor = {
  version: "runtime-surface-governor";
  tier: Pass496RuntimeSurfaceTier;
  animate: boolean;
  blur: boolean;
  webgl: boolean;
  targetFps: 0 | 30 | 45 | 60;
  reason: "hidden" | "accessibility" | "data_saver" | "constrained_device" | "balanced" | "full_power";
};

export function buildPass496RuntimeSurfaceGovernor(
  input: Pass496RuntimeSurfaceInput,
): Pass496RuntimeSurfaceGovernor {
  if (!input.visible) {
    return {
      version: "runtime-surface-governor",
      tier: "still",
      animate: false,
      blur: false,
      webgl: false,
      targetFps: 0,
      reason: "hidden",
    };
  }
  if (input.reducedMotion || input.reducedTransparency) {
    return {
      version: "runtime-surface-governor",
      tier: "still",
      animate: false,
      blur: false,
      webgl: !input.reducedMotion,
      targetFps: 0,
      reason: "accessibility",
    };
  }
  if (input.saveData) {
    return {
      version: "runtime-surface-governor",
      tier: "efficient",
      animate: input.interactionRecent,
      blur: false,
      webgl: false,
      targetFps: input.interactionRecent ? 30 : 0,
      reason: "data_saver",
    };
  }
  const constrained =
    input.hardwareConcurrency <= 4 ||
    input.deviceMemory <= 4 ||
    input.viewportWidth < 720;
  if (constrained) {
    return {
      version: "runtime-surface-governor",
      tier: "efficient",
      animate: input.interactionRecent,
      blur: false,
      webgl: true,
      targetFps: input.interactionRecent ? 30 : 0,
      reason: "constrained_device",
    };
  }
  const balanced = input.hardwareConcurrency <= 8 || input.deviceMemory <= 8 || input.viewportWidth < 1280;
  if (balanced) {
    return {
      version: "runtime-surface-governor",
      tier: "efficient",
      animate: true,
      blur: true,
      webgl: true,
      targetFps: input.interactionRecent ? 45 : 30,
      reason: "balanced",
    };
  }
  return {
    version: "runtime-surface-governor",
    tier: "full",
    animate: true,
    blur: true,
    webgl: true,
    targetFps: input.interactionRecent ? 60 : 45,
    reason: "full_power",
  };
}
