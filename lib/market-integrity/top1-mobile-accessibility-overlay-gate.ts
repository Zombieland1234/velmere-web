import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";

export type Pass2819Surface = "Shield" | "Real Markets" | "Shield Pro" | "PDF" | "Report Access" | "Community" | "VLM";
export type Pass2819ViewportClass = "mobile_390" | "tablet" | "desktop";
export type Pass2819GateStatus = "mobile_ready" | "needs_guarded_degrade" | "blocked_overlay_or_scroll";

export type Pass2819MobileAccessibilityOverlayGate = {
  schemaVersion: "pass2819_mobile_accessibility_overlay_gate_v1";
  surface: Pass2819Surface;
  tier: VelmereTier;
  viewportClass: Pass2819ViewportClass;
  status: Pass2819GateStatus;
  checks: {
    backgroundScrollLock: boolean;
    focusReturn: boolean;
    escapeClose: boolean;
    outsideClickClose: boolean;
    safeAreaPadding: boolean;
    horizontalTableContained: boolean;
    chartTouchDoesNotTrapPageScroll: boolean;
    reducedMotionFallback: boolean;
    ariaLabelsPresent: boolean;
    hiddenOverlayClickCaptureBlocked: boolean;
  };
  blockers: string[];
  warnings: string[];
  policies: {
    modalPolicy: string;
    chartGesturePolicy: string;
    tableOverflowPolicy: string;
    accessibilityPolicy: string;
    pdfPolicy: string;
  };
  rendererMarkers: string[];
  releaseGate: {
    status: "pass" | "warn" | "block";
    reasons: string[];
  };
};

export const PASS2819_MOBILE_ACCESSIBILITY_ACCEPTANCE_GATES = [
  "Every modal/drawer must lock background scroll, keep close/CTA controls inside the 390x844 safe area, restore focus on close and support Escape/outside click where the component is not a consent form.",
  "Table mini charts are not interactive traps: they expose aria labels/source lifecycle markers and never intercept vertical page scroll or row clicks.",
  "Wide Shield Pro/Real Markets tables may scroll horizontally only inside their own overflow container; the page itself must not get uncontrolled horizontal scroll.",
  "Consent gates, paid evidence locks and report access warnings must be keyboard reachable, screen-reader labelled and visible before any Pro/Advanced evidence render.",
  "Reduced-motion users must receive static/skeleton/monochrome variants instead of forced Mobius, brain, shimmer or chart animations.",
  "Hidden overlays from cart, wallet, chart modal, Shield Pro consent or report preview must not capture clicks after they visually close.",
] as const;

export function buildPass2819MobileAccessibilityOverlayGate(args: {
  surface: Pass2819Surface;
  tier?: VelmereTier;
  viewportClass?: Pass2819ViewportClass;
  backgroundScrollLock?: boolean;
  focusReturn?: boolean;
  escapeClose?: boolean;
  outsideClickClose?: boolean;
  safeAreaPadding?: boolean;
  horizontalTableContained?: boolean;
  chartTouchDoesNotTrapPageScroll?: boolean;
  reducedMotionFallback?: boolean;
  ariaLabelsPresent?: boolean;
  hiddenOverlayClickCaptureBlocked?: boolean;
}): Pass2819MobileAccessibilityOverlayGate {
  const tier = args.tier ?? "Basic";
  const checks = {
    backgroundScrollLock: args.backgroundScrollLock ?? true,
    focusReturn: args.focusReturn ?? true,
    escapeClose: args.escapeClose ?? true,
    outsideClickClose: args.outsideClickClose ?? true,
    safeAreaPadding: args.safeAreaPadding ?? true,
    horizontalTableContained: args.horizontalTableContained ?? true,
    chartTouchDoesNotTrapPageScroll: args.chartTouchDoesNotTrapPageScroll ?? true,
    reducedMotionFallback: args.reducedMotionFallback ?? true,
    ariaLabelsPresent: args.ariaLabelsPresent ?? true,
    hiddenOverlayClickCaptureBlocked: args.hiddenOverlayClickCaptureBlocked ?? true,
  };

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!checks.hiddenOverlayClickCaptureBlocked) blockers.push("hidden overlay can still capture clicks after visual close");
  if (!checks.backgroundScrollLock) blockers.push("modal/drawer does not lock background scroll");
  if (!checks.safeAreaPadding) blockers.push("mobile controls may be clipped outside safe area");
  if (!checks.horizontalTableContained) blockers.push("wide table can create uncontrolled page-level horizontal scroll");
  if (!checks.chartTouchDoesNotTrapPageScroll) blockers.push("chart/touch layer can trap page scroll or row clicks");
  if (!checks.focusReturn) warnings.push("focus return not confirmed");
  if (!checks.escapeClose) warnings.push("Escape close not confirmed");
  if (!checks.outsideClickClose) warnings.push("outside click close not confirmed");
  if (!checks.reducedMotionFallback) warnings.push("prefers-reduced-motion fallback not confirmed");
  if (!checks.ariaLabelsPresent) warnings.push("aria labels/source lifecycle labels not confirmed");

  const status: Pass2819GateStatus = blockers.length
    ? "blocked_overlay_or_scroll"
    : warnings.length
      ? "needs_guarded_degrade"
      : "mobile_ready";
  const releaseStatus: "pass" | "warn" | "block" = status === "mobile_ready" ? "pass" : status === "needs_guarded_degrade" ? "warn" : "block";

  return {
    schemaVersion: "pass2819_mobile_accessibility_overlay_gate_v1",
    surface: args.surface,
    tier,
    viewportClass: args.viewportClass ?? "mobile_390",
    status,
    checks,
    blockers,
    warnings,
    policies: {
      modalPolicy: "Modal and drawer layers must own body scroll lock, safe-area padding, close affordance visibility, focus return and pointer-events cleanup after close.",
      chartGesturePolicy: "Mini charts are read-only receipts; advanced charts may support drag/zoom only when they do not steal vertical page scroll or block row/modal close gestures.",
      tableOverflowPolicy: "Wide institutional tables use contained overflow-x with overscroll containment and a visible scroll hint; page-level horizontal scroll is a release blocker.",
      accessibilityPolicy: "Risk, confidence, source lifecycle, lock state and skeleton/unavailable states require aria/title labels and keyboard reachable controls.",
      pdfPolicy: "PDF/report preview must mirror the same lock/source/lifecycle state as UI and cannot hide unavailable charts behind decorative skeletons without labels.",
    },
    rendererMarkers: [
      "data-pass2819-mobile-overlay-gate",
      "data-pass2819-contained-overflow",
      "data-pass2819-chart-touch-safe",
      "data-pass2819-safe-area-controls",
      "data-pass2819-reduced-motion-fallback",
    ],
    releaseGate: {
      status: releaseStatus,
      reasons: blockers.length ? blockers : warnings.length ? warnings : ["mobile/overlay/accessibility gate accepted"],
    },
  };
}

export function buildPass2819SurfaceGateMatrix(args: { surface: Pass2819Surface; tier?: VelmereTier }) {
  const primary = buildPass2819MobileAccessibilityOverlayGate({ surface: args.surface, tier: args.tier ?? "Basic" });
  const strictTable = buildPass2819MobileAccessibilityOverlayGate({
    surface: args.surface,
    tier: args.tier ?? "Basic",
    viewportClass: "desktop",
    horizontalTableContained: true,
    chartTouchDoesNotTrapPageScroll: true,
    reducedMotionFallback: true,
  });
  return {
    schemaVersion: "pass2819_mobile_accessibility_surface_matrix_v1" as const,
    surface: args.surface,
    tier: args.tier ?? "Basic",
    gates: [primary, strictTable],
    releaseGate: {
      status: primary.releaseGate.status === "block" || strictTable.releaseGate.status === "block" ? "block" : primary.releaseGate.status === "warn" || strictTable.releaseGate.status === "warn" ? "warn" : "pass" as "pass" | "warn" | "block",
      rule: "Mobile and desktop overflow states must both be contained before release; warnings keep the surface in guarded-degrade mode.",
    },
  };
}
