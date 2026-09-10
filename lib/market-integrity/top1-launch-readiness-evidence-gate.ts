import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";

export type Pass2827LaunchReadinessState =
  | "blocked"
  | "operator_review"
  | "release_candidate"
  | "monitor_only";
export type Pass2827Surface =
  | "PDF"
  | "Real Markets"
  | "Shield"
  | "Shield Pro"
  | "Methodology"
  | "Report Access"
  | "Community"
  | "VLM Brain";

export type Pass2827LaunchReadinessEvidenceGate = {
  schemaVersion: "pass2827_launch_readiness_evidence_gate_v1";
  surface: Pass2827Surface | string;
  tier: VelmereTier;
  readinessScore: number;
  readinessState: Pass2827LaunchReadinessState;
  releaseGate: {
    status: "allow" | "review" | "block";
    reason: string;
  };
  proofMatrix: {
    buildPassed: boolean;
    typecheckPassed: boolean;
    i18nPassed: boolean;
    verifierPassedCount: number;
    verifierTotalCount: number;
    liveProviderSmokePassed: boolean;
    screenshotQaPassed: boolean;
    mobileQaPassed: boolean;
    securityQaPassed: boolean;
    pdfParityPassed: boolean;
  };
  blockerMatrix: Array<{
    blockerId: string;
    severity: "P0" | "P1" | "P2";
    status: "open" | "prepared" | "passed";
    rule: string;
  }>;
  customerClaimBoundary: {
    canClaimLaunchReady: boolean;
    canClaimWorldClass100: false;
    rule: string;
  };
  operatorNextProof: string[];
};

export const PASS2827_LAUNCH_READINESS_ACCEPTANCE_GATES = [
  "PASS2827: Project cannot claim launch-ready if build/typecheck/live smoke/screenshot/mobile/security gates are not evidenced.",
  "PASS2827: Verifier scripts are helpful but do not replace Next build, typecheck, Playwright, mobile screenshot QA and provider smoke tests.",
  "PASS2827: Provider degradation, skeleton charts and missing evidence must appear in the release score instead of being hidden behind green status.",
  "PASS2827: PDF/UI/account/email delivery can enter release-candidate only when payloadHash, sourceReceiptRoot, token state and paid redaction gates are aligned.",
  "PASS2827: 100% world-class claim is blocked until all P0/P1 gates are evidenced with reproducible artifacts, not just prepared contracts.",
] as const;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2827LaunchReadinessEvidenceGate(args: {
  surface: Pass2827Surface | string;
  tier?: VelmereTier;
  buildPassed?: boolean;
  typecheckPassed?: boolean;
  i18nPassed?: boolean;
  verifierPassedCount?: number;
  verifierTotalCount?: number;
  liveProviderSmokePassed?: boolean;
  screenshotQaPassed?: boolean;
  mobileQaPassed?: boolean;
  securityQaPassed?: boolean;
  pdfParityPassed?: boolean;
  runtimeState?: "healthy" | "degraded" | "circuit_open" | string;
  payloadHashPresent?: boolean;
  sourceReceiptRootPresent?: boolean;
  paidEvidenceRedacted?: boolean;
  p0OpenCount?: number;
  p1OpenCount?: number;
}): Pass2827LaunchReadinessEvidenceGate {
  const proofMatrix = {
    buildPassed: Boolean(args.buildPassed),
    typecheckPassed: Boolean(args.typecheckPassed),
    i18nPassed: args.i18nPassed !== false,
    verifierPassedCount: Math.max(0, args.verifierPassedCount ?? 0),
    verifierTotalCount: Math.max(1, args.verifierTotalCount ?? 1),
    liveProviderSmokePassed: Boolean(args.liveProviderSmokePassed),
    screenshotQaPassed: Boolean(args.screenshotQaPassed),
    mobileQaPassed: Boolean(args.mobileQaPassed),
    securityQaPassed: Boolean(args.securityQaPassed),
    pdfParityPassed: Boolean(args.pdfParityPassed),
  };

  const verifierRatio =
    proofMatrix.verifierPassedCount / proofMatrix.verifierTotalCount;
  const proofScore =
    (proofMatrix.buildPassed ? 16 : 0) +
    (proofMatrix.typecheckPassed ? 16 : 0) +
    (proofMatrix.i18nPassed ? 8 : 0) +
    verifierRatio * 14 +
    (proofMatrix.liveProviderSmokePassed ? 12 : 0) +
    (proofMatrix.screenshotQaPassed ? 9 : 0) +
    (proofMatrix.mobileQaPassed ? 9 : 0) +
    (proofMatrix.securityQaPassed ? 10 : 0) +
    (proofMatrix.pdfParityPassed ? 6 : 0);

  const integrityBonus =
    (args.payloadHashPresent ? 2 : 0) +
    (args.sourceReceiptRootPresent ? 2 : 0) +
    (args.paidEvidenceRedacted !== false ? 2 : 0);
  const runtimePenalty =
    args.runtimeState === "circuit_open"
      ? 12
      : args.runtimeState === "degraded"
        ? 6
        : 0;
  const blockerPenalty =
    (args.p0OpenCount ?? 0) * 14 + (args.p1OpenCount ?? 0) * 5;
  const readinessScore = clampScore(
    proofScore + integrityBonus - runtimePenalty - blockerPenalty,
  );

  const blockerMatrix: Pass2827LaunchReadinessEvidenceGate["blockerMatrix"] = [
    {
      blockerId: "next_build",
      severity: "P0",
      status: proofMatrix.buildPassed ? "passed" : "open",
      rule: "Next production build must pass before launch-ready can be claimed.",
    },
    {
      blockerId: "typecheck",
      severity: "P0",
      status: proofMatrix.typecheckPassed ? "passed" : "open",
      rule: "TypeScript/Next typecheck must pass with project dependencies installed.",
    },
    {
      blockerId: "live_provider_smoke",
      severity: "P1",
      status: proofMatrix.liveProviderSmokePassed ? "passed" : "prepared",
      rule: "CoinGecko/DexScreener/Real Markets provider smoke must be captured with receipts and timeout behavior.",
    },
    {
      blockerId: "mobile_visual_qa",
      severity: "P1",
      status:
        proofMatrix.mobileQaPassed && proofMatrix.screenshotQaPassed
          ? "passed"
          : "prepared",
      rule: "390x844 mobile, Shield modal, Real Markets table and Shield Pro terminal need screenshot evidence.",
    },
    {
      blockerId: "pdf_delivery_parity",
      severity: "P1",
      status:
        proofMatrix.pdfParityPassed &&
        Boolean(args.payloadHashPresent) &&
        Boolean(args.sourceReceiptRootPresent)
          ? "passed"
          : "prepared",
      rule: "PDF/account/email/download delivery must reuse payloadHash and sourceReceiptRoot without debug or paid leakage.",
    },
  ];

  const p0Open =
    blockerMatrix.some(
      (item) => item.severity === "P0" && item.status !== "passed",
    ) || (args.p0OpenCount ?? 0) > 0;
  const p1Open =
    blockerMatrix.some(
      (item) => item.severity === "P1" && item.status !== "passed",
    ) || (args.p1OpenCount ?? 0) > 0;
  const readinessState: Pass2827LaunchReadinessState = p0Open
    ? "blocked"
    : p1Open || readinessScore < 86
      ? "operator_review"
      : readinessScore >= 95
        ? "monitor_only"
        : "release_candidate";
  const status =
    readinessState === "blocked"
      ? "block"
      : readinessState === "operator_review"
        ? "review"
        : "allow";

  return {
    schemaVersion: "pass2827_launch_readiness_evidence_gate_v1",
    surface: args.surface,
    tier: args.tier ?? "Basic",
    readinessScore,
    readinessState,
    releaseGate: {
      status,
      reason: p0Open
        ? "P0 build/typecheck/live proof blockers still open; keep this as prepared, not launch-ready."
        : p1Open
          ? "P1 evidence remains prepared; operator review and artifact capture required before launch claim."
          : "Release candidate can be discussed only with attached proof artifacts and monitoring.",
    },
    proofMatrix,
    blockerMatrix,
    customerClaimBoundary: {
      canClaimLaunchReady: status === "allow",
      canClaimWorldClass100: false,
      rule: "World-class 100% claim stays blocked until build, typecheck, live provider smoke, screenshot QA, mobile QA, security QA and PDF parity are all evidenced reproducibly.",
    },
    operatorNextProof: [
      "Install dependencies and run npm run typecheck + npm run build on the latest ZIP.",
      "Capture Playwright/screenshot evidence for Shield, Real Markets, Shield Pro, VLM, Community and PDF preview/download.",
      "Run live provider smoke with provider timeout/circuit-open receipts and compare UI/PDF chart lifecycle.",
      "Attach payloadHash/sourceReceiptRoot/token-state evidence for Pro and Advanced delivery replay.",
    ],
  };
}
