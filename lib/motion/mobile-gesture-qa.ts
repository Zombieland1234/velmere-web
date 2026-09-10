export type Pass522GestureSurface =
  | "chart"
  | "modal"
  | "horizontal_rail"
  | "shield_map";

export type Pass522MobileGestureQa = {
  version: "mobile-gesture-qa";
  surface: Pass522GestureSurface;
  touchAction: "none" | "pan-y" | "pan-x" | "manipulation";
  overscroll: "contain" | "none";
  minimumTargetPx: 44;
  allowPinchZoom: boolean;
  allowPageScroll: boolean;
  reducedMotionSafe: true;
  status: "ready";
  checklist: string[];
};

export function getPass522MobileGestureQa(
  surface: Pass522GestureSurface,
): Pass522MobileGestureQa {
  const policies: Record<
    Pass522GestureSurface,
    Pick<
      Pass522MobileGestureQa,
      "touchAction" | "overscroll" | "allowPinchZoom" | "allowPageScroll"
    >
  > = {
    chart: {
      touchAction: "pan-y",
      overscroll: "contain",
      allowPinchZoom: true,
      allowPageScroll: true,
    },
    modal: {
      touchAction: "pan-y",
      overscroll: "contain",
      allowPinchZoom: false,
      allowPageScroll: true,
    },
    horizontal_rail: {
      touchAction: "pan-x",
      overscroll: "contain",
      allowPinchZoom: false,
      allowPageScroll: false,
    },
    shield_map: {
      touchAction: "manipulation",
      overscroll: "contain",
      allowPinchZoom: false,
      allowPageScroll: true,
    },
  };
  const policy = policies[surface];
  return {
    version: "mobile-gesture-qa",
    surface,
    minimumTargetPx: 44,
    reducedMotionSafe: true,
    status: "ready",
    ...policy,
    checklist: [
      "Interactive targets keep a 44px minimum hit area.",
      "Nested scrolling is contained to prevent background scroll chaining.",
      "Gesture ownership is explicit so pan, zoom and page scrolling do not compete.",
      "Reduced-motion mode removes decorative travel without removing state feedback.",
    ],
  };
}
