import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";

export type Pass2828ArtifactStatus =
  | "missing"
  | "prepared"
  | "attached"
  | "failed"
  | "stale";

export type Pass2828ArtifactKind =
  | "build_log"
  | "typecheck_log"
  | "i18n_log"
  | "verifier_log"
  | "live_provider_smoke"
  | "screenshot_pack"
  | "mobile_screenshot_pack"
  | "security_scan"
  | "pdf_parity_packet";

export type Pass2828EvidenceArtifactHandoffGate = {
  schemaVersion: "pass2828_evidence_artifact_handoff_gate_v1";
  surface: string;
  tier: VelmereTier;
  manifestId: string;
  handoffState:
    | "blocked_no_artifacts"
    | "prepared_manifest"
    | "operator_review"
    | "evidence_attached";
  proofCompletenessScore: number;
  artifactMatrix: Array<{
    kind: Pass2828ArtifactKind;
    status: Pass2828ArtifactStatus;
    requiredFor: "launch_ready" | "world_class_100" | "operator_review";
    artifactId: string | null;
    rule: string;
  }>;
  releaseGate: {
    status: "block" | "review" | "allow";
    reason: string;
  };
  noFalseClaimBoundary: {
    canClaimLaunchReady: boolean;
    canClaimWorldClass100: false;
    rule: string;
  };
  operatorHandoff: {
    requiredCommandReceipts: string[];
    screenshotRoutes: string[];
    liveProviderTargets: string[];
    pdfParityTargets: string[];
  };
};

export const PASS2828_EVIDENCE_ARTIFACT_HANDOFF_ACCEPTANCE_GATES = [
  "PASS2828: Launch-ready proof needs attached artifact IDs for build, typecheck, live provider smoke, screenshots, mobile QA, security QA and PDF parity; prepared text is not proof.",
  "PASS2828: Every artifact must declare kind, status, artifactId, route/target and whether it is required for operator review, launch-ready or world-class 100%.",
  "PASS2828: A verifier script can mark gate coverage, but it cannot replace build/typecheck logs, Playwright screenshots, mobile screenshots or live provider smoke receipts.",
  "PASS2828: Evidence handoff must be visible to Report API, Real Markets, PDF payload, report access, delivery state, Shield Pro and methodology so UI/PDF/operator views do not drift.",
  "PASS2828: World-class 100% remains false even with attached artifacts until all P0/P1 artifacts are fresh, reproducible and reviewed.",
] as const;

const ARTIFACT_RULES: Record<Pass2828ArtifactKind, string> = {
  build_log: "Next production build log must be attached before launch-ready can be claimed.",
  typecheck_log: "TypeScript/Next typecheck log must be attached with dependencies installed.",
  i18n_log: "Locale/i18n check must be attached and pure across PL/EN/DE surfaces.",
  verifier_log: "PASS verifier log is useful coverage evidence but not a replacement for build/live/mobile proof.",
  live_provider_smoke: "Live provider smoke must prove timeout/degraded behavior and source-bound receipt handling.",
  screenshot_pack: "Desktop screenshot pack must include Shield, Real Markets, Shield Pro, VLM, Community and PDF preview/download.",
  mobile_screenshot_pack: "Mobile 390x844 screenshots must prove no scroll trap, hidden overlay or table overflow breakage.",
  security_scan: "Security scan must cover SSRF, source poisoning, paid entitlement, PDF access, token replay and community link safety.",
  pdf_parity_packet: "PDF parity packet must bind UI preview, download, account vault and email/API handoff to payloadHash/sourceReceiptRoot.",
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function softHash(input: string) {
  return `pass2828-${sha256Token(input, 24)}`;
}

function normalizeArtifactId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 120) : null;
}

function statusFor(value: string | null | undefined, fallback: Pass2828ArtifactStatus) {
  const normalized = value?.toLowerCase();
  if (
    normalized === "attached" ||
    normalized === "prepared" ||
    normalized === "missing" ||
    normalized === "failed" ||
    normalized === "stale"
  ) {
    return normalized;
  }
  return fallback;
}

export function buildPass2828EvidenceArtifactHandoffGate(args: {
  surface: string;
  tier?: VelmereTier;
  buildArtifactId?: string | null;
  typecheckArtifactId?: string | null;
  i18nArtifactId?: string | null;
  verifierArtifactId?: string | null;
  liveProviderSmokeArtifactId?: string | null;
  screenshotPackArtifactId?: string | null;
  mobileScreenshotPackArtifactId?: string | null;
  securityScanArtifactId?: string | null;
  pdfParityPacketArtifactId?: string | null;
  buildStatus?: Pass2828ArtifactStatus | string | null;
  typecheckStatus?: Pass2828ArtifactStatus | string | null;
  i18nStatus?: Pass2828ArtifactStatus | string | null;
  verifierStatus?: Pass2828ArtifactStatus | string | null;
  liveProviderSmokeStatus?: Pass2828ArtifactStatus | string | null;
  screenshotStatus?: Pass2828ArtifactStatus | string | null;
  mobileScreenshotStatus?: Pass2828ArtifactStatus | string | null;
  securityScanStatus?: Pass2828ArtifactStatus | string | null;
  pdfParityStatus?: Pass2828ArtifactStatus | string | null;
  payloadHash?: string | null;
  sourceReceiptRoot?: string | null;
}): Pass2828EvidenceArtifactHandoffGate {
  const input = [
    args.surface,
    args.tier ?? "Basic",
    args.payloadHash ?? "no-payload",
    args.sourceReceiptRoot ?? "no-source-root",
    args.buildArtifactId ?? "no-build",
    args.typecheckArtifactId ?? "no-typecheck",
    args.liveProviderSmokeArtifactId ?? "no-live-smoke",
    args.screenshotPackArtifactId ?? "no-screenshots",
    args.mobileScreenshotPackArtifactId ?? "no-mobile",
    args.securityScanArtifactId ?? "no-security",
    args.pdfParityPacketArtifactId ?? "no-pdf-parity",
  ].join("|");
  const manifestId = softHash(input);
  const matrix: Pass2828EvidenceArtifactHandoffGate["artifactMatrix"] = [
    {
      kind: "build_log",
      status: statusFor(args.buildStatus, args.buildArtifactId ? "attached" : "missing"),
      requiredFor: "launch_ready",
      artifactId: normalizeArtifactId(args.buildArtifactId),
      rule: ARTIFACT_RULES.build_log,
    },
    {
      kind: "typecheck_log",
      status: statusFor(args.typecheckStatus, args.typecheckArtifactId ? "attached" : "missing"),
      requiredFor: "launch_ready",
      artifactId: normalizeArtifactId(args.typecheckArtifactId),
      rule: ARTIFACT_RULES.typecheck_log,
    },
    {
      kind: "i18n_log",
      status: statusFor(args.i18nStatus, args.i18nArtifactId ? "attached" : "prepared"),
      requiredFor: "operator_review",
      artifactId: normalizeArtifactId(args.i18nArtifactId),
      rule: ARTIFACT_RULES.i18n_log,
    },
    {
      kind: "verifier_log",
      status: statusFor(args.verifierStatus, args.verifierArtifactId ? "attached" : "prepared"),
      requiredFor: "operator_review",
      artifactId: normalizeArtifactId(args.verifierArtifactId),
      rule: ARTIFACT_RULES.verifier_log,
    },
    {
      kind: "live_provider_smoke",
      status: statusFor(args.liveProviderSmokeStatus, args.liveProviderSmokeArtifactId ? "attached" : "prepared"),
      requiredFor: "launch_ready",
      artifactId: normalizeArtifactId(args.liveProviderSmokeArtifactId),
      rule: ARTIFACT_RULES.live_provider_smoke,
    },
    {
      kind: "screenshot_pack",
      status: statusFor(args.screenshotStatus, args.screenshotPackArtifactId ? "attached" : "prepared"),
      requiredFor: "launch_ready",
      artifactId: normalizeArtifactId(args.screenshotPackArtifactId),
      rule: ARTIFACT_RULES.screenshot_pack,
    },
    {
      kind: "mobile_screenshot_pack",
      status: statusFor(args.mobileScreenshotStatus, args.mobileScreenshotPackArtifactId ? "attached" : "prepared"),
      requiredFor: "launch_ready",
      artifactId: normalizeArtifactId(args.mobileScreenshotPackArtifactId),
      rule: ARTIFACT_RULES.mobile_screenshot_pack,
    },
    {
      kind: "security_scan",
      status: statusFor(args.securityScanStatus, args.securityScanArtifactId ? "attached" : "prepared"),
      requiredFor: "launch_ready",
      artifactId: normalizeArtifactId(args.securityScanArtifactId),
      rule: ARTIFACT_RULES.security_scan,
    },
    {
      kind: "pdf_parity_packet",
      status: statusFor(args.pdfParityStatus, args.pdfParityPacketArtifactId ? "attached" : "prepared"),
      requiredFor: "launch_ready",
      artifactId: normalizeArtifactId(args.pdfParityPacketArtifactId),
      rule: ARTIFACT_RULES.pdf_parity_packet,
    },
  ];
  const attached = matrix.filter((item) => item.status === "attached").length;
  const prepared = matrix.filter((item) => item.status === "prepared").length;
  const failed = matrix.filter((item) => item.status === "failed" || item.status === "stale").length;
  const launchRequired = matrix.filter((item) => item.requiredFor === "launch_ready");
  const launchAttached = launchRequired.every((item) => item.status === "attached");
  const p0Missing = matrix
    .filter((item) => item.kind === "build_log" || item.kind === "typecheck_log")
    .some((item) => item.status !== "attached");
  const proofCompletenessScore = clampScore((attached / matrix.length) * 100 - failed * 12 + prepared * 2);
  const handoffState = p0Missing
    ? "blocked_no_artifacts"
    : launchAttached
      ? "evidence_attached"
      : prepared > 0 || attached > 0
        ? "operator_review"
        : "prepared_manifest";
  const status = handoffState === "evidence_attached" ? "allow" : p0Missing ? "block" : "review";

  return {
    schemaVersion: "pass2828_evidence_artifact_handoff_gate_v1",
    surface: args.surface,
    tier: args.tier ?? "Basic",
    manifestId,
    handoffState,
    proofCompletenessScore,
    artifactMatrix: matrix,
    releaseGate: {
      status,
      reason:
        status === "allow"
          ? "All launch-required artifacts are attached; operator can review freshness and reproducibility before launch claim."
          : p0Missing
            ? "Build/typecheck artifacts are missing, failed or stale; launch-ready and 100% claims stay blocked."
            : "Some artifacts are prepared or missing; keep the surface in operator-review state and capture proof before claim.",
    },
    noFalseClaimBoundary: {
      canClaimLaunchReady: status === "allow",
      canClaimWorldClass100: false,
      rule: "Attached artifacts can move a surface toward launch-ready, but world-class 100% remains blocked until all P0/P1 evidence is fresh, reproducible, reviewed and monitored after deploy.",
    },
    operatorHandoff: {
      requiredCommandReceipts: [
        "npm ci",
        "npm run typecheck",
        "npm run build",
        "npm run check:i18n",
        "npm run verify:pass2828-evidence-artifact-handoff",
      ],
      screenshotRoutes: [
        "/en/market-integrity",
        "/en/real-markets",
        "/en/shield-pro",
        "/en/vlm",
        "/en/square",
        "/en/risk-methodology",
      ],
      liveProviderTargets: ["BTC", "ETH", "SOL", "AAPL", "NVDA", "SPY", "EUR/USD"],
      pdfParityTargets: ["BTC Basic/Pro/Advanced", "AAPL Basic/Pro/Advanced", "small ERC-20", "stablecoin", "DeFi protocol"],
    },
  };
}
