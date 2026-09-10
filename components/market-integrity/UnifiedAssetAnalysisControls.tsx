"use client";

import type {
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  Ref,
  WheelEvent as ReactWheelEvent,
} from "react";

export const UNIFIED_ASSET_ANALYSIS_LEVELS = [
  "basic",
  "pro",
  "advanced",
] as const;

export type UnifiedAssetAnalysisLevel =
  (typeof UNIFIED_ASSET_ANALYSIS_LEVELS)[number];

export type UnifiedTimeframeOption<T extends string> = {
  value: T;
  label: string;
};

export type UnifiedDepthOption<T extends string = UnifiedAssetAnalysisLevel> = {
  value: T;
  label: string;
  meta?: string;
  icon?: ReactNode;
};

export type UnifiedAssetReadoutTone = "gold" | "cyan" | "ready" | "neutral";

export type UnifiedAssetReadout = {
  label: ReactNode;
  value: ReactNode;
  tone?: UnifiedAssetReadoutTone;
};

// PASS4155 broad renderer boundary sweep: shared asset modal events now use
// concrete React DOM event aliases instead of the old visible `any` boundary.
type Pass4155UnifiedButtonClickEvent = ReactMouseEvent<HTMLButtonElement>;
type Pass4155UnifiedButtonPointerEvent = ReactPointerEvent<HTMLButtonElement>;
type Pass4155UnifiedButtonContextEvent = ReactMouseEvent<HTMLButtonElement>;
type Pass4155UnifiedChartWheelEvent = ReactWheelEvent<HTMLDivElement>;

export const UNIFIED_ASSET_LOADING_LABELS: Record<
  UnifiedAssetAnalysisLevel,
  string
> = {
  basic: "2–3s",
  pro: "4–5s",
  advanced: "6–8s",
};

export function UnifiedAssetModalShell({
  kind,
  eyebrow,
  title,
  subtitle,
  icon,
  readouts,
  timeframeSlot,
  chartSlot,
  depthSlot,
  detailsSlot,
  analysisOverlaySlot,
  headerMetaSlot,
  chartFooterSlot,
  depthHeaderSlot,
  closeLabel,
  closeButtonRef,
  onClose,
}: {
  kind: "shield" | "real-markets";
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  readouts: readonly UnifiedAssetReadout[];
  timeframeSlot: ReactNode;
  chartSlot: ReactNode;
  depthSlot: ReactNode;
  detailsSlot?: ReactNode;
  analysisOverlaySlot?: ReactNode;
  headerMetaSlot?: ReactNode;
  chartFooterSlot?: ReactNode;
  depthHeaderSlot?: ReactNode;
  closeLabel: string;
  closeButtonRef?: Ref<HTMLButtonElement>;
  onClose: () => void;
}) {
  return (
    <section
      className="unified-asset-modal-shell unified-asset-modal-shell-pass2205 real-markets-unified-asset-modal relative rounded-[2rem]"
      data-unified-asset-modal={kind}
      data-unified-asset-modal-shell="true"
      data-unified-asset-layout="clean-terminal-v2"
      data-pass1454-runtime-architecture="mobile-performance-rectangular-terminal"
      data-pass1454-public-modal-rule="rectangular-chart-attached-depth-rail-only"
      data-pass1734-runtime-cleanliness="rectangular-popup-only"
      data-pass1734-color-rule="gold-primary-cyan-state-only"
      data-pass1983-five-piece-modal="icon-readout-chart-depth-contained-brain"
      data-pass1984-five-piece-final="icon-strip-chart-three-depth-cards-contained-brain"
      data-pass1987-five-piece-polish="single-grid-chart-rail-scroll-safe"
      data-pass1988-five-piece-stability="header-readouts-chart-depth-brain"
      data-pass1989-clean-modal="single-layer-top-actions-chart-only"
      data-pass1990-clean-modal="separate-header-metrics-chart-right-actions"
      data-pass1992-modal="transparent-container-separate-solid-windows-no-scroll"
      data-pass1993-modal="visual-qa-separated-solid-windows-no-scroll"
      data-pass1994-modal="final-visual-audit-five-clean-windows"
      data-pass1995-modal="visual-logic-lock-five-real-windows"
      data-pass1996-modal="aesthetic-logic-viewport-locked"
      data-pass1997-modal="syntax-safe-final-viewport-visual-lock"
      data-pass1998-modal="final-aesthetic-logic-no-outer-frame-no-page-scroll"
      data-pass1999-modal="live-screen-premium-five-window-lock"
      data-pass2000-modal="premium-live-lock-five-windows-no-scroll-final-qa"
      data-pass2011-modal="single-instrument-panel-stable-geometry"
      data-pass2027-modal="minimal-separated-windows-no-overlap"
      data-pass2184-ui-polish="luxury-modal-angel-run-analysis"
      data-pass2201-visual-p0="nvidia-parity"
      data-pass2203-asset-modal-final-parity="nvidia-terminal"
      data-pass2205-modal-mobile-scroll-lock="short-viewport-final-sweep"
      data-pass2209-reference-modal="btc-concept-parity-90v"
      data-chart-system="shared-shield-real-markets"
      data-pass4138-mobile-analysis-reachability="shell-safe-area-scroll-owner"
    >
      {analysisOverlaySlot ? (
        <div
          className="unified-asset-analysis-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Velmère VLM analysis stage"
          data-modal-scroll-region="true"
          data-unified-asset-analysis-overlay="true"
          data-pass1983-contained-brain-stage="inside-asset-modal"
          data-pass1984-contained-brain="same-popup-no-fullscreen"
        >
          <span className="sr-only" aria-live="polite">
            Velmère VLM analysis is running inside this asset modal.
          </span>
          {analysisOverlaySlot}
        </div>
      ) : null}
      <header
        className="unified-asset-modal-shell__header grid items-center gap-4 p-5 md:p-6"
        data-pass1984-modal-header="coin-card-title-close"
        data-pass1454-modal-header="compact-readable"
        data-pass1995-window="asset-header"
        data-pass1996-window="asset-header-clean"
        data-pass1997-window="header-title-logo-close"
        data-pass1998-window="header-logo-title-close-balanced"
        data-pass1999-window="header-logo-title-close-one-row"
        data-pass2000-window="header-one-row-no-rings-no-overflow"
        data-pass2011-region="identity-header"
        data-pass2026-region="identity-plus-metrics-window"
      >
        <div className="unified-asset-modal-shell__identity flex min-w-0 items-center gap-4">
          {icon ? <div className="shrink-0">{icon}</div> : null}
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-velmere-gold">
              {eyebrow}
            </p>
            <h2 className="mt-1 truncate font-serif text-3xl tracking-[-0.045em] text-white md:text-5xl">
              {title}
            </h2>
            {subtitle ? (
              <div className="mt-1 text-xs text-white/[0.42]">{subtitle}</div>
            ) : null}
            {headerMetaSlot ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">{headerMetaSlot}</div>
            ) : null}
          </div>
        </div>
        <div
          className="unified-asset-modal-shell__header-readouts grid gap-3"
          data-pass1984-price-risk-strip="single-lane"
          data-pass1454-readout-row="dense-three-card-budget"
          data-pass1989-readouts="price-risk-confidence-separate-tiles"
          data-pass1995-window="price-risk-confidence-strip"
          data-pass1996-window="metric-strip-clean"
          data-pass1997-window="metric-strip-three-readable-cards"
          data-pass1998-window="metric-strip-three-compact-cards"
          data-pass1999-window="metric-strip-no-overflow-three-cards"
          data-pass2000-window="metric-strip-three-equal-cards-readability-lock"
          data-pass2011-region="single-metric-strip"
          data-pass2026-region="price-risk-certainty-cards"
        >
          {readouts.map((readout, index) => (
            <div
              key={`readout-${index}`}
              className="velmere-readout-card"
              data-unified-asset-readout-index={index}
              data-tone={readout.tone === "neutral" ? undefined : readout.tone}
            >
              <p className="velmere-readout-label">{readout.label}</p>
              <p className="velmere-readout-value text-xl tabular-nums md:text-2xl">
                {readout.value}
              </p>
            </div>
          ))}
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onPointerDown={(event: Pass4155UnifiedButtonPointerEvent) => {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }}
          onClick={onClose}
          className="unified-asset-modal-close grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/[0.10] bg-white/[0.025] text-white/[0.58] transition-colors hover:border-cyan-200/[0.22] hover:text-white"
          aria-label={closeLabel}
        >
          <span aria-hidden="true" className="text-2xl leading-none">
            ×
          </span>
        </button>
      </header>

      <div
        className="unified-asset-modal-shell__body grid gap-4 p-4 md:p-6"
        data-pass1454-modal-body="single-scroll-owner"
        data-pass1989-modal-body="clean-top-actions-chart-only"
        data-pass1989-clean-command-row="readouts-plus-three-actions"
        data-pass4138-mobile-analysis-reachability="body-keeps-depth-rail-in-scroll"
      >
        <div
          className="unified-asset-rect-stage"
          data-unified-asset-rect-stage="chart-with-right-action-rail"
          data-pass1413-circular-chart-removed="true"
          data-pass1414-simple-rectangular-modal="chart-scroll-zoom-plus-attached-rail"
          data-pass1989-chart-stage="one-chart-no-empty-depth-column"
          data-pass1990-chart-stage="separate-chart-card-plus-three-right-cards"
          data-pass1995-stage="chart-plus-three-actions"
          data-pass1996-stage="fixed-chart-actions-no-page-scroll"
          data-pass1997-stage="desktop-fit-chart-actions-no-scroll"
          data-pass1998-stage="chart-actions-fit-viewport-no-page-scroll"
          data-pass1999-stage="live-screen-chart-dominant-actions-fit"
          data-pass2000-stage="chart-dominant-actions-fit-one-viewport"
          data-pass2011-stage="stable-chart-compact-actions"
          data-pass2027-stage="one-chart-one-action-rail-no-nested-frame"
          data-pass2209-stage="single-chart-single-rail-no-double-frames"
          data-pass4138-mobile-analysis-reachability="chart-and-depth-stack-no-bottom-cutoff"
        >
          <div
            className="unified-asset-chart-panel"
            data-modal-wheel-owner="true"
            data-unified-asset-rect-chart="true"
            data-pass1414-chart-wheel-owner="true"
            data-pass1454-chart-gesture-containment="wheel-touch-pointer"
            data-pass1734-chart-wheel-owner="zoom-not-page-scroll"
            data-pass1734-chart-no-modal-drag="true"
            data-pass1983-chart-wheel-policy="normal-scroll-modifier-zoom"
            data-pass1986-chart-pointer-hygiene="true"
            data-pass1987-chart-gesture-policy="wheel-contained-touch-native"
            data-pass1988-chart-wheel-policy="normal-scroll-modifier-zoom"
            data-pass1989-chart-card="only-large-visual-panel"
            data-pass1990-chart-card="single-clean-window"
            data-pass1995-window="main-chart"
            data-pass1996-window="chart-window-clean"
            data-pass1997-window="chart-window-wide-readable"
            data-pass1998-window="chart-window-quiet-premium"
            data-pass1999-window="chart-window-dominant-no-page-wheel"
            data-pass2000-window="chart-card-wheel-contained-no-page-scroll"
            data-pass2011-region="single-chart-frame"
            data-pass2026-region="chart-window-with-timeframes"
            data-pass2027-region="single-chart-window-no-overlay"
            data-pass2205-chart-mobile-containment="single-owned-scroll-chart"
            data-pass2209-chart-panel="tradingview-style-shared-runtime"
            onWheelCapture={(event: Pass4155UnifiedChartWheelEvent) => {
              event.stopPropagation();
              if (event.ctrlKey || event.metaKey || event.shiftKey) {
                event.preventDefault();
              }
            }}
            onWheel={(event: Pass4155UnifiedChartWheelEvent) => event.stopPropagation()}
          >
            <div
              className="unified-asset-chart-panel__head"
              data-pass1989-timeframes="single-small-row-above-chart"
              data-pass1995-window="timeframe-strip"
              data-pass1996-window="timeframe-strip-clean"
              data-pass1997-window="timeframe-row-contained"
              data-pass1998-window="timeframe-pill-row-no-gold-box"
              data-pass1999-window="timeframe-row-calm-cyan-focus"
              data-pass2000-window="timeframe-row-no-gold-focus-no-layout-shift"
              data-pass2011-region="unframed-timeframe"
            >
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-velmere-gold">
                Price chart
              </p>
              {timeframeSlot}
            </div>
            <div className="unified-asset-chart-panel__body">
              {chartSlot}
              {chartFooterSlot ? (
                <div className="unified-asset-chart-statusbar mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-[11px] text-white/[0.42]">
                  {chartFooterSlot}
                </div>
              ) : null}
            </div>
          </div>
          <aside
            className="unified-asset-depth-rail unified-asset-depth-rail--side"
            data-unified-asset-depth-rail="rectangular-attached"
            data-pass1992-depth-rail="right-three-separate-action-windows"
            data-pass1993-depth-rail="clean-three-button-column"
            data-pass1414-depth-rail="basic-pro-advanced-rectangular"
            data-pass1454-depth-rail="compact-linear-three-buttons"
            data-pass1734-depth-rail="basic-pro-advanced-attached"
            data-pass1989-depth-position="top-right-not-extra-window"
            data-pass1990-depth-position="right-side-three-separate-windows"
            data-pass1995-window="right-actions-rail"
            data-pass1996-window="right-actions-clean"
            data-pass1997-window="right-actions-equal-clean"
            data-pass1998-window="right-actions-three-equal-quiet-cards"
            data-pass1999-window="right-actions-readable-premium-stack"
            data-pass2000-window="right-actions-three-equal-premium-cards"
            data-pass2011-region="unframed-compact-actions"
            data-pass2027-region="three-action-cards-visible"
            data-pass2205-depth-rail-mobile="bottom-stack-close-reachable"
            data-pass2209-depth-rail="minimal-attached-no-orbit-rings"
            data-pass4138-mobile-analysis-reachability="depth-rail-bottom-reachable"
          >
            <div className="unified-asset-action-stack-pass2027" data-pass2027-action-stack="basic-pro-advanced-visible">
              {depthHeaderSlot ? <div className="unified-asset-depth-header mb-3">{depthHeaderSlot}</div> : null}
              {depthSlot}
              <div
                className="unified-asset-powered-footer"
                data-pass2203-powered-footer="nvidia-style"
              >
                <span aria-hidden="true" className="unified-asset-powered-lock">⌁</span>
                <span>{kind === "shield" ? "Powered by Velmère Shield" : "Powered by Velmère Market Intelligence"}</span>
              </div>
            </div>
          </aside>
        </div>

        {detailsSlot ? (
          <div
            className="unified-asset-details-tray"
            hidden
            aria-hidden="true"
            data-pass1989-details-hidden="source-details-removed-from-public-asset-popup"
          >
            {detailsSlot}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function UnifiedTimeframeTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
  testIdPrefix,
}: {
  options: readonly UnifiedTimeframeOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  testIdPrefix?: string;
}) {
  return (
    <div
      className={`unified-asset-timeframe-tabs flex min-w-0 flex-wrap gap-2 ${className}`}
      role="toolbar"
      aria-label={ariaLabel}
      data-unified-asset-timeframes="true"
      data-pass2000-timeframe-tabs="click-safe-no-gold-focus"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={(event: Pass4155UnifiedButtonClickEvent) => {
            event.stopPropagation();
            onChange(option.value);
          }}
          aria-pressed={value === option.value}
          data-range-active={value === option.value ? "true" : "false"}
          data-testid={
            testIdPrefix ? `${testIdPrefix}-${option.value}` : undefined
          }
          className={`velmere-interaction-pulse rounded-full border px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-0 ${
            value === option.value
              ? "border-cyan-200/[0.34] bg-cyan-300/[0.095] text-cyan-50"
              : "border-white/[0.10] bg-white/[0.035] text-white/[0.48] hover:border-cyan-200/[0.22] hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function UnifiedAnalysisDepthDock<
  T extends string = UnifiedAssetAnalysisLevel,
>({
  options,
  value,
  onSelect,
  onRun,
  ariaLabel,
  runLabel = "Run analysis",
  className = "",
}: {
  options: readonly UnifiedDepthOption<T>[];
  value: T | null;
  onSelect: (value: T) => void;
  onRun?: (value: T) => void;
  ariaLabel: string;
  runLabel?: string;
  className?: string;
}) {
  const onBubbleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll("button:not([disabled])"),
    ) as HTMLButtonElement[]; // PASS4279/PASS4139 keyboard roving focus button narrowing
    if (!buttons.length) return;
    const currentIndex = Math.max(
      0,
      buttons.indexOf(document.activeElement as HTMLButtonElement),
    );
    const focusIndex = (nextIndex: number) => {
      event.preventDefault();
      buttons[(nextIndex + buttons.length) % buttons.length]?.focus({
        preventScroll: true,
      });
    };
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      focusIndex(currentIndex + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      focusIndex(currentIndex - 1);
    } else if (event.key === "Home") {
      focusIndex(0);
    } else if (event.key === "End") {
      focusIndex(buttons.length - 1);
    }
  };

  const runOption =
    (value ? options.find((option) => option.value === value) : undefined) ??
    options[0];

  return (
    <div
      className={`unified-asset-depth-dock grid gap-3 ${className}`}
      role="toolbar"
      aria-label={ariaLabel}
      onKeyDown={onBubbleKeyDown}
      data-unified-asset-depth-dock="true"
      data-unified-asset-rect-depth-dock="true"
      data-pass1414-no-bubble-depth="true"
      data-analysis-keyboard="linear-loop"
      data-pass1454-depth-controls="basic-pro-advanced-rectangular-only"
      data-pass1734-depth-controls="three-rectangles-no-bubbles"
      data-depth-layout="fly-in"
      data-pass1983-depth-fly-in="chart-join-animation"
      data-pass1984-depth-dock="three-cards-fly-to-chart"
      data-pass1987-depth-dock="three-stable-actions-no-legacy-bubbles"
      data-pass1988-depth-dock="stable-three-cards-toggle-safe"
      data-pass1990-depth-dock="three-separate-right-cards"
      data-pass1992-depth-dock="three-real-side-windows"
      data-pass1993-depth-dock="short-meta-no-cramped-text"
      data-pass1994-depth-dock="separate-right-actions-locked-height"
      data-pass1995-depth-dock="clean-equal-action-windows"
      data-pass1996-depth-dock="equal-readable-action-cards"
      data-pass1997-depth-dock="equal-premium-action-cards"
      data-pass1998-depth-dock="three-equal-readable-action-cards"
      data-pass1999-depth-dock="three-equal-premium-cards-no-cramped-copy"
      data-pass2000-depth-dock="three-equal-click-safe-no-cramped-copy"
      data-pass2011-depth-dock="compact-top-aligned-actions"
      data-pass2184-depth-dock="cards-plus-run-analysis"
      data-pass2201-depth-dock="powered-by-velmere-no-run-analysis-copy"
      data-pass2205-depth-dock-mobile="three-cards-no-horizontal-overflow"
      data-pass2209-depth-dock="minimal-icons-no-nested-frames"
      data-pass4138-mobile-analysis-reachability="basic-pro-advanced-buttons-visible"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={(event: Pass4155UnifiedButtonClickEvent) => {
            event.stopPropagation();
            onSelect(option.value);
          }}
          aria-pressed={value === option.value}
          data-analysis-mode={option.value}
          data-tier-selected={value === option.value ? "true" : "false"}
          data-pass1983-analysis-button="basic-pro-advanced"
          data-pass1995-action-window="basic-pro-advanced"
          data-pass1996-action-window="short-clean-cta"
          data-pass1997-action-window="premium-cta-no-cramped-copy"
          data-pass1998-action-window="quiet-premium-no-cramped-copy"
          data-pass1999-action-window="short-readable-click-target"
          data-pass2000-action-window="large-click-target-calm-hover"
          data-pass2011-action="compact-terminal-row"
          onContextMenu={(event: Pass4155UnifiedButtonContextEvent) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerDown={(event: Pass4155UnifiedButtonPointerEvent) => event.stopPropagation()}
          className={`unified-asset-depth-button group min-h-16 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-0 ${
            value === option.value
              ? "is-active border-cyan-200/[0.34] bg-cyan-300/[0.10]"
              : "border-white/[0.10] bg-white/[0.025] hover:border-cyan-200/[0.24] hover:bg-cyan-300/[0.055]"
          }`}
        >
          <span className="flex items-start gap-3">
            {option.icon ? (
              <span className="unified-asset-depth-icon" aria-hidden="true">
                {option.icon}
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              <strong className="block min-w-0 font-serif text-2xl leading-none tracking-[-0.045em] text-white/[0.90] md:text-[1.7rem]">
                {option.label}
              </strong>
              {option.meta ? (
                <span className="mt-3 block text-xs leading-5 text-white/[0.48]" data-pass1995-action-meta="short-readable">
                  {option.meta}
                </span>
              ) : null}
            </span>
            <span className="unified-asset-depth-arrow mt-1 shrink-0 font-mono text-sm text-white/[0.34] transition group-hover:text-cyan-100" aria-hidden="true">
              →
            </span>
          </span>
        </button>
      ))}
      {runOption && onRun ? (
        <button
          type="button"
          className="unified-asset-run-button"
          onClick={(event: Pass4155UnifiedButtonClickEvent) => {
            event.stopPropagation();
            onRun(runOption.value);
          }}
          onPointerDown={(event: Pass4155UnifiedButtonPointerEvent) => event.stopPropagation()}
          onContextMenu={(event: Pass4155UnifiedButtonContextEvent) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          aria-label={`${runLabel}: ${runOption.label}`}
          data-pass2184-run-analysis="shield-map-handoff"
        >
          <span>{runLabel}</span>
          <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </div>
  );
}
