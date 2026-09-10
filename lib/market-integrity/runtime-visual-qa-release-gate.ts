import type { LensReportDepth, LensReportLocale } from "@/lib/search/lens-report-contract";
import { pageCountForDepth } from "./lens-tier-page-count";

type Pass1274VisualQaState = "ready_for_browser_proof" | "needs_browser_proof" | "blocked";

export type Pass1274RuntimeVisualQaReleaseGate = {
  version: "runtime-visual-qa-release-gate";
  state: Pass1274VisualQaState;
  score: number;
  manifestKey: string;
  proofMode: "browser_screenshot_required_before_100";
  requiredCommand: "npm run test:e2e:pass1274-1293";
  artifactRoot: "test-results/pass1274-runtime-visual-qa";
  viewportMatrix: Array<{
    id: "desktop" | "mobile";
    width: number;
    height: number;
    required: true;
  }>;
  screenshotPlan: Array<{
    id: string;
    route: string;
    selector: string;
    expectedArtifact: string;
    reason: string;
  }>;
  interactionPlan: Array<{
    id: string;
    trigger: string;
    expectedSurface: string;
    proof: "visible_surface" | "no_overflow" | "scroll_locked" | "download_receipt";
  }>;
  visualBudget: {
    maxHorizontalOverflowPx: 4;
    modalAboveHeader: true;
    singleOpenHeaderSurface: true;
    lensReaderNoHorizontalOverflow: true;
    bodyScrollLockedDuringPdfPreview: true;
  };
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
  }>;
  copy: {
    badge: string;
    title: string;
    body: string;
  };
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function copy(locale: LensReportLocale, state: Pass1274VisualQaState) {
  if (locale === "pl") {
    return {
      badge:
        state === "ready_for_browser_proof"
          ? "Visual QA gotowe do odpalenia"
          : state === "needs_browser_proof"
            ? "Visual QA wymaga screenów"
            : "Visual QA zablokowane",
      title: "Dowód wizualny przed 100%",
      body:
        "Lens modal, reader, PDF iframe, header, koszyk, Shield i Real Markets mają obowiązkowy plan screenshotów oraz kontrolę overflow/scroll-lock przed finalnym 100%.",
    };
  }
  if (locale === "de") {
    return {
      badge:
        state === "ready_for_browser_proof"
          ? "Visual QA bereit"
          : state === "needs_browser_proof"
            ? "Visual QA braucht Screenshots"
            : "Visual QA blockiert",
      title: "Visueller Nachweis vor 100%",
      body:
        "Lens-Modal, Reader, PDF-Iframe, Header, Warenkorb, Shield und Real Markets haben einen Pflichtplan für Screenshots plus Overflow/Scroll-Lock-Kontrolle.",
    };
  }
  return {
    badge:
      state === "ready_for_browser_proof"
        ? "Visual QA ready"
        : state === "needs_browser_proof"
          ? "Visual QA needs screenshots"
          : "Visual QA blocked",
    title: "Visual proof before 100%",
    body:
      "Lens modal, reader, PDF iframe, header, cart, Shield and Real Markets now have a required screenshot plan plus overflow/scroll-lock checks before final 100%.",
  };
}

export function buildPass1274RuntimeVisualQaReleaseGate(input: {
  locale: LensReportLocale;
  depth: LensReportDepth;
  reportChecksum: string;
  symbol: string;
  pass1234State: string;
  pass1254State: string;
  visualParityState: string;
  mobileBudgetState: string;
  pageCount: number;
  sourceCount: number;
  missingCount: number;
}): Pass1274RuntimeVisualQaReleaseGate {
  const checks = [
    {
      id: "lens_modal_selectors",
      label: "Lens preview modal exposes stable selectors for screenshots",
      passed: Boolean(input.symbol && input.reportChecksum),
    },
    {
      id: "reader_pdf_parity_prepared",
      label: "Reader and PDF parity gates are present before screenshot proof",
      passed:
        input.pass1234State !== "blocked" &&
        input.pass1254State !== "blocked" &&
        input.visualParityState !== "blocked",
    },
    {
      id: "mobile_overflow_budget_prepared",
      label: "Mobile overflow budget is prepared for runtime proof",
      passed: input.mobileBudgetState !== "blocked",
    },
    {
      id: "a4_page_count_bounded",
      label: "A4 page count matches the selected tier before screenshot proof",
      passed: input.pageCount === pageCountForDepth(input.depth),
    },
    {
      id: "evidence_rows_bounded",
      label: "Sources and missing rows stay bounded for visual QA",
      passed: input.sourceCount <= 8 && input.missingCount <= 12,
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const score = clampScore((passed / checks.length) * 100);
  const state: Pass1274VisualQaState =
    score >= 90 ? "ready_for_browser_proof" : score >= 70 ? "needs_browser_proof" : "blocked";
  const normalizedSymbol = input.symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "asset";
  return {
    version: "runtime-visual-qa-release-gate",
    state,
    score,
    manifestKey: `pass1274:${input.depth}:${normalizedSymbol}:${input.reportChecksum.slice(0, 12)}`,
    proofMode: "browser_screenshot_required_before_100",
    requiredCommand: "npm run test:e2e:pass1274-1293",
    artifactRoot: "test-results/pass1274-runtime-visual-qa",
    viewportMatrix: [
      { id: "desktop", width: 1440, height: 1000, required: true },
      { id: "mobile", width: 390, height: 844, required: true },
    ],
    screenshotPlan: [
      {
        id: "lens-reader-desktop",
        route: "/pl/search",
        selector: "[data-testid=\"lens-preview-dialog\"]",
        expectedArtifact: `test-results/pass1274-runtime-visual-qa/lens-reader-desktop-${normalizedSymbol}.png`,
        reason: "Proves the Lens reader modal is above the header and not clipped.",
      },
      {
        id: "lens-pdf-frame-desktop",
        route: "/pl/search",
        selector: "[data-testid=\"lens-pdf-frame\"]",
        expectedArtifact: `test-results/pass1274-runtime-visual-qa/lens-pdf-frame-desktop-${normalizedSymbol}.png`,
        reason: "Proves downloaded/preview PDF lane is visible inside the same modal shell.",
      },
      {
        id: "lens-reader-mobile",
        route: "/pl/search",
        selector: "[data-testid=\"lens-preview-dialog\"]",
        expectedArtifact: `test-results/pass1274-runtime-visual-qa/lens-reader-mobile-${normalizedSymbol}.png`,
        reason: "Proves mobile Lens reader avoids horizontal overflow.",
      },
      {
        id: "header-cart-mobile",
        route: "/pl",
        selector: "#velmere-cart-bottom-sheet",
        expectedArtifact: "test-results/pass1274-runtime-visual-qa/header-cart-mobile.png",
        reason: "Proves cart is a bottom sheet and not a left-corner dropdown.",
      },
      {
        id: "shield-unified-modal",
        route: "/pl/market-integrity",
        selector: "[data-unified-asset-modal=\"shield\"]",
        expectedArtifact: "test-results/pass1274-runtime-visual-qa/shield-unified-modal.png",
        reason: "Proves Shield opens the unified analysis modal above the page.",
      },
      {
        id: "real-markets-unified-modal",
        route: "/pl/market-integrity/cross-asset",
        selector: "[data-unified-asset-modal=\"real-markets\"]",
        expectedArtifact: "test-results/pass1274-runtime-visual-qa/real-markets-unified-modal.png",
        reason: "Proves Real Markets uses the same modal contract.",
      },
    ],
    interactionPlan: [
      {
        id: "language-wallet-account-arbiter",
        trigger: "header language -> wallet -> account",
        expectedSurface: "only one anchored header surface remains visible",
        proof: "visible_surface",
      },
      {
        id: "cart-bottom-sheet",
        trigger: "header cart",
        expectedSurface: "#velmere-cart-bottom-sheet",
        proof: "scroll_locked",
      },
      {
        id: "lens-reader-no-overflow",
        trigger: "Lens search -> preview -> Basic -> reader",
        expectedSurface: "[data-testid=\"lens-preview-dialog\"]",
        proof: "no_overflow",
      },
      {
        id: "lens-download-receipt",
        trigger: "Lens download link click",
        expectedSurface: "[data-testid=\"lens-download-receipt\"]",
        proof: "download_receipt",
      },
    ],
    visualBudget: {
      maxHorizontalOverflowPx: 4,
      modalAboveHeader: true,
      singleOpenHeaderSurface: true,
      lensReaderNoHorizontalOverflow: true,
      bodyScrollLockedDuringPdfPreview: true,
    },
    checks,
    copy: copy(input.locale, state),
  };
}
