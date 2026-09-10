import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { Pass2450TierEvidenceParity } from "./tier-evidence-parity";
import type {
  Pass2451DataProvenanceLedger,
  Pass2451FieldId,
} from "./data-provenance-ledger";
import type { Pass2452RiskCalibrationKernel } from "./risk-calibration-kernel";
import type { VelmereSourceSyncPacket } from "./source-sync-contract";

type Pass2453SourceSyncPacket = VelmereSourceSyncPacket & {
  pass2450?: Pass2450TierEvidenceParity;
  pass2451?: Pass2451DataProvenanceLedger;
  pass2452?: Pass2452RiskCalibrationKernel;
};

export type Pass2453ReportState = "ready" | "watch" | "blocked";
export type Pass2453SurfaceId =
  | "shield"
  | "real_markets"
  | "vlm_brain"
  | "browser_preview"
  | "pdf_preview"
  | "pdf_download"
  | "angel";
export type Pass2453SectionId =
  | "identity"
  | "market_snapshot"
  | "defillama_fundamentals"
  | "liquidity_depth"
  | "chart_regime"
  | "holder_contract"
  | "risk_calibration"
  | "methodology_limits"
  | "pdf_receipt";

export type Pass2453ReportSection = {
  id: Pass2453SectionId;
  label: string;
  state: Pass2453ReportState;
  requiredFields: Pass2451FieldId[];
  confirmedEvidence: string[];
  missingEvidence: string[];
  allowedProviders: string[];
  copyStrength: "short_badge" | "evidence_summary" | "advanced_report";
  forbiddenShortcut: string;
};

export type Pass2453SurfaceContract = {
  surface: Pass2453SurfaceId;
  state: Pass2453ReportState;
  requiredPayloadKeys: string[];
  visibleBadges: string[];
  blockedBy: string[];
  parityRule: string;
};

export type Pass2453ReportEvidenceCapsule = {
  version: "report-evidence-capsule-v1";
  state: Pass2453ReportState;
  score: number;
  query?: string;
  symbol?: string;
  canonicalEvidenceFingerprint: string;
  reportSections: Pass2453ReportSection[];
  surfaceContracts: Pass2453SurfaceContract[];
  pdfParityLock: {
    state: Pass2453ReportState;
    previewDownloadRule: string;
    localeRule: string;
    payloadKeys: string[];
    blockedBy: string[];
  };
  angelReadoutOrder: string[];
  noFillerReportGovernor: {
    state: Pass2453ReportState;
    rule: string;
    forbiddenClaims: string[];
    requiredBeforeAdvancedPdf: string[];
  };
  nextWorldClassIntegrations: string[];
  generatedAt: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique(items: Array<string | null | undefined | false | 0>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

const stableStringify = canonicalJson;

function stableHash(value: unknown) {
  return `vlm-${sha256Token(stableStringify(value), 24)}`;
}

function field(
  provenance: Pass2451DataProvenanceLedger | undefined,
  id: Pass2451FieldId,
) {
  return provenance?.fieldLedger.find((item) => item.field === id);
}

function section(args: {
  id: Pass2453SectionId;
  label: string;
  fields: Pass2451FieldId[];
  provenance?: Pass2451DataProvenanceLedger;
  extraConfirmed?: Array<string | false | null | undefined | 0>;
  extraMissing?: Array<string | false | null | undefined | 0>;
  copyStrength: Pass2453ReportSection["copyStrength"];
  forbiddenShortcut: string;
}): Pass2453ReportSection {
  const fields = args.fields.map((id) => field(args.provenance, id));
  const confirmedEvidence = unique([
    ...fields.flatMap(
      (item) =>
        item?.confirmedEvidence.map((entry) => `${item.label}: ${entry}`) ?? [],
    ),
    ...(args.extraConfirmed ?? []),
  ]).slice(0, 12);
  const missingEvidence = unique([
    ...fields.flatMap(
      (item) =>
        item?.missingEvidence.map((entry) => `${item.label}: ${entry}`) ?? [],
    ),
    ...args.fields
      .filter((id) => !field(args.provenance, id))
      .map((id) => `missing field ledger: ${id}`),
    ...(args.extraMissing ?? []),
  ]).slice(0, 12);
  const allowedProviders = unique(
    fields.flatMap((item) => item?.allowedProviders ?? []),
  ).slice(0, 10);
  const blockedCount = fields.filter(
    (item) => !item || item.state === "blocked",
  ).length;
  const watchCount = fields.filter((item) => item?.state === "watch").length;
  const state: Pass2453ReportState = blockedCount
    ? "blocked"
    : watchCount || missingEvidence.length > confirmedEvidence.length
      ? "watch"
      : "ready";
  return {
    id: args.id,
    label: args.label,
    state,
    requiredFields: args.fields,
    confirmedEvidence,
    missingEvidence,
    allowedProviders,
    copyStrength: args.copyStrength,
    forbiddenShortcut: args.forbiddenShortcut,
  };
}

function buildSurface(args: {
  surface: Pass2453SurfaceId;
  provenance?: Pass2451DataProvenanceLedger;
  tierEvidence?: Pass2450TierEvidenceParity;
  riskCalibration?: Pass2452RiskCalibrationKernel;
  requiredPayloadKeys: string[];
  blockedBy: string[];
}): Pass2453SurfaceContract {
  const blockedBy = unique(args.blockedBy).slice(0, 10);
  const surfaceDrift =
    args.tierEvidence?.surfaceContracts.find(
      (item) => item.surface.toLowerCase().replace(/ /g, "_") === args.surface,
    )?.missingProof ?? [];
  const allBlocked = unique([...blockedBy, ...surfaceDrift]).slice(0, 10);
  const state: Pass2453ReportState =
    allBlocked.length >= 5 ? "blocked" : allBlocked.length ? "watch" : "ready";
  return {
    surface: args.surface,
    state,
    requiredPayloadKeys: args.requiredPayloadKeys,
    visibleBadges: unique([
      `provenance:${args.provenance?.state ?? "missing"}`,
      `risk:${args.riskCalibration?.state ?? "missing"}`,
      args.tierEvidence?.sourceFingerprint &&
        `fingerprint:${args.tierEvidence.sourceFingerprint}`,
      args.riskCalibration?.confidenceCap !== undefined &&
        `confidence:${args.riskCalibration.confidenceCap}`,
    ]),
    blockedBy: allBlocked,
    parityRule:
      "This surface must render the same canonicalEvidenceFingerprint as Browser/PDF before Advanced copy is allowed.",
  };
}

export function buildPass2453ReportEvidenceCapsule(args: {
  query?: string;
  symbol?: string;
  sourceSync?: Pass2453SourceSyncPacket;
  tierEvidence?: Pass2450TierEvidenceParity;
  dataProvenance?: Pass2451DataProvenanceLedger;
  riskCalibration?: Pass2452RiskCalibrationKernel;
  payloadFingerprint?: string;
}): Pass2453ReportEvidenceCapsule {
  const sourceSync = args.sourceSync;
  const provenance = args.dataProvenance ?? sourceSync?.pass2451;
  const tierEvidence = args.tierEvidence ?? sourceSync?.pass2450;
  const riskCalibration = args.riskCalibration ?? sourceSync?.pass2452;
  const advancedLocks = unique([
    ...(provenance?.advancedLocks ?? []),
    ...(riskCalibration?.tierValueReceipt.find(
      (tier) => tier.tier === "advanced",
    )?.blockedEvidence ?? []),
  ]).slice(0, 12);

  const sections: Pass2453ReportSection[] = [
    section({
      id: "identity",
      label: "Identity / asset resolver",
      fields: ["identity", "price"],
      provenance,
      copyStrength: "short_badge",
      forbiddenShortcut:
        "Never merge assets by ticker only; report id/address/chain must stay visible.",
    }),
    section({
      id: "market_snapshot",
      label: "Market snapshot / valuation",
      fields: ["price", "market_cap", "volume", "fdv"],
      provenance,
      copyStrength: "evidence_summary",
      forbiddenShortcut:
        "Market cap, FDV and volume are separate fields and must not substitute for one another.",
    }),
    section({
      id: "defillama_fundamentals",
      label: "DefiLlama fundamentals / TVL",
      fields: ["tvl"],
      provenance,
      extraMissing: [
        "fees/revenue/stablecoins/yields context when protocol scope is available",
      ],
      copyStrength: "evidence_summary",
      forbiddenShortcut:
        "TVL can support protocol context only; it cannot prove safety, liquidity or future price.",
    }),
    section({
      id: "liquidity_depth",
      label: "Liquidity / exit-depth",
      fields: ["liquidity", "cex_depth", "dex_pool_ohlcv"],
      provenance,
      copyStrength: "advanced_report",
      forbiddenShortcut:
        "Visible liquidity is not guaranteed exit liquidity under stress.",
    }),
    section({
      id: "chart_regime",
      label: "2Y / 5Y / MAX chart regime",
      fields: ["chart_history", "dex_pool_ohlcv"],
      provenance,
      extraConfirmed: [
        riskCalibration?.components.find((item) => item.id === "chart_regime")
          ?.state &&
          `risk chart component:${riskCalibration.components.find((item) => item.id === "chart_regime")?.state}`,
      ],
      copyStrength: "advanced_report",
      forbiddenShortcut:
        "A short sparkline cannot support macro/regime language.",
    }),
    section({
      id: "holder_contract",
      label: "Holder graph / contract security",
      fields: ["holder_graph", "contract_security"],
      provenance,
      copyStrength: "advanced_report",
      forbiddenShortcut:
        "Missing holder or contract proof is uncertainty, not proof of fraud or safety.",
    }),
    section({
      id: "risk_calibration",
      label: "Risk calibration / confidence cap",
      fields: ["price", "volume", "liquidity", "chart_history", "pdf_parity"],
      provenance,
      extraConfirmed: [
        riskCalibration?.calibratedRiskScore !== null &&
          riskCalibration?.calibratedRiskScore !== undefined &&
          `calibratedRiskScore:${riskCalibration.calibratedRiskScore}`,
        riskCalibration && `confidenceCap:${riskCalibration.confidenceCap}`,
        riskCalibration &&
          `uncertaintyPercent:${riskCalibration.uncertaintyPercent}`,
      ],
      extraMissing: [
        ...(riskCalibration?.noFillerGovernor
          .requiredBeforeAdvancedConclusion ?? ["risk calibration kernel"]),
        riskCalibration?.calibratedRiskScore === null &&
          "verified risk-score baseline",
      ],
      copyStrength: "advanced_report",
      forbiddenShortcut:
        "Risk score must not be shown without confidence cap and missing-proof list.",
    }),
    section({
      id: "methodology_limits",
      label: "Provider methodology / forbidden-use limits",
      fields: ["price", "tvl", "liquidity", "holder_graph"],
      provenance,
      extraConfirmed:
        sourceSync?.pass2448?.fieldContracts.map(
          (item) => `${item.label}:${item.currentState}`,
        ) ?? [],
      copyStrength: "evidence_summary",
      forbiddenShortcut:
        "Planned providers are backlog, not evidence, until adapters and keys are live.",
    }),
    section({
      id: "pdf_receipt",
      label: "PDF preview/download receipt",
      fields: ["pdf_parity"],
      provenance,
      extraConfirmed: [
        tierEvidence?.sourceFingerprint &&
          `sourceFingerprint:${tierEvidence.sourceFingerprint}`,
        args.payloadFingerprint &&
          `payloadFingerprint:${args.payloadFingerprint}`,
      ],
      extraMissing: [
        "same payload hash visible in Browser preview and PDF download",
      ],
      copyStrength: "advanced_report",
      forbiddenShortcut:
        "PDF preview and PDF download must not be generated from different source packets.",
    }),
  ];

  const canonicalEvidenceFingerprint =
    args.payloadFingerprint ??
    stableHash({
      query: args.query ?? sourceSync?.query,
      symbol: args.symbol ?? sourceSync?.symbol,
      provenance: provenance?.score,
      risk: riskCalibration?.calibratedRiskScore,
      confidence: riskCalibration?.confidenceCap,
      tier: tierEvidence?.sourceFingerprint,
      sections: sections.map((item) => [
        item.id,
        item.state,
        item.confirmedEvidence.length,
        item.missingEvidence.length,
      ]),
    });

  const baseBlocked = unique([
    ...advancedLocks,
    ...sections
      .filter((item) => item.state === "blocked")
      .map((item) => `${item.label}: blocked`),
    riskCalibration?.state === "blocked" && "risk calibration blocked",
  ]).slice(0, 12);

  const surfaceContracts: Pass2453SurfaceContract[] = [
    buildSurface({
      surface: "shield",
      provenance,
      tierEvidence,
      riskCalibration,
      requiredPayloadKeys: [
        "score",
        "confidenceCap",
        "sourceFingerprint",
        "topComponents",
      ],
      blockedBy: baseBlocked.slice(0, 4),
    }),
    buildSurface({
      surface: "real_markets",
      provenance,
      tierEvidence,
      riskCalibration,
      requiredPayloadKeys: [
        "assetClass",
        "providerMethodology",
        "confidenceCap",
      ],
      blockedBy: baseBlocked.slice(0, 4),
    }),
    buildSurface({
      surface: "vlm_brain",
      provenance,
      tierEvidence,
      riskCalibration,
      requiredPayloadKeys: ["components", "missingProof", "noFillerGovernor"],
      blockedBy: baseBlocked.slice(0, 6),
    }),
    buildSurface({
      surface: "browser_preview",
      provenance,
      tierEvidence,
      riskCalibration,
      requiredPayloadKeys: [
        "canonicalEvidenceFingerprint",
        "reportSections",
        "locale",
      ],
      blockedBy: baseBlocked.slice(0, 6),
    }),
    buildSurface({
      surface: "pdf_preview",
      provenance,
      tierEvidence,
      riskCalibration,
      requiredPayloadKeys: [
        "canonicalEvidenceFingerprint",
        "reportSections",
        "legalNote",
      ],
      blockedBy: baseBlocked.slice(0, 8),
    }),
    buildSurface({
      surface: "pdf_download",
      provenance,
      tierEvidence,
      riskCalibration,
      requiredPayloadKeys: [
        "canonicalEvidenceFingerprint",
        "reportSections",
        "receiptId",
      ],
      blockedBy: baseBlocked.slice(0, 8),
    }),
    buildSurface({
      surface: "angel",
      provenance,
      tierEvidence,
      riskCalibration,
      requiredPayloadKeys: [
        "calibratedRiskScore",
        "confidenceCap",
        "uncertaintyPercent",
        "missingProof",
      ],
      blockedBy: baseBlocked.slice(0, 6),
    }),
  ];

  const blockedSections = sections.filter(
    (item) => item.state === "blocked",
  ).length;
  const watchSections = sections.filter(
    (item) => item.state === "watch",
  ).length;
  const blockedSurfaces = surfaceContracts.filter(
    (item) => item.state === "blocked",
  ).length;
  const missingTotal = sections.reduce(
    (sum, item) => sum + item.missingEvidence.length,
    0,
  );
  const confirmedTotal = sections.reduce(
    (sum, item) => sum + item.confirmedEvidence.length,
    0,
  );
  const score = clamp(
    100 -
      blockedSections * 9 -
      watchSections * 4 -
      blockedSurfaces * 6 -
      Math.max(0, missingTotal - confirmedTotal),
  );
  const state: Pass2453ReportState =
    blockedSections >= 3 || blockedSurfaces >= 2
      ? "blocked"
      : score >= 74
        ? "ready"
        : "watch";
  const pdfBlockedBy = unique([
    ...baseBlocked,
    ...surfaceContracts
      .filter(
        (item) =>
          item.surface === "pdf_preview" || item.surface === "pdf_download",
      )
      .flatMap((item) => item.blockedBy),
    "locale parity check PL/EN/DE before final PDF export",
  ]).slice(0, 12);

  return {
    version: "report-evidence-capsule-v1",
    state,
    score,
    query: args.query ?? sourceSync?.query,
    symbol: args.symbol ?? sourceSync?.symbol,
    canonicalEvidenceFingerprint,
    reportSections: sections,
    surfaceContracts,
    pdfParityLock: {
      state: pdfBlockedBy.length > 4 ? "watch" : "ready",
      previewDownloadRule:
        "Browser preview, PDF preview and PDF download must share canonicalEvidenceFingerprint and reportSections before Advanced copy is unlocked.",
      localeRule:
        "PL page generates PL report, EN page generates EN report, DE page generates DE report; no mixed debug labels in customer PDF.",
      payloadKeys: [
        "canonicalEvidenceFingerprint",
        "reportSections",
        "riskCalibration",
        "dataProvenance",
        "sourceSync",
        "legalNote",
        "locale",
      ],
      blockedBy: pdfBlockedBy,
    },
    angelReadoutOrder: [
      "canonicalEvidenceFingerprint",
      "calibratedRiskScore / confidenceCap / uncertaintyPercent",
      "section states and missing proof",
      "provider methodology boundaries",
      "PDF/Browser parity lock",
      "tier-safe conclusion",
    ],
    noFillerReportGovernor: {
      state: baseBlocked.length ? "watch" : "ready",
      rule: "Customer-facing reports must cite visible evidence fields first; missing sections become locks or next steps, never confident filler.",
      forbiddenClaims: [
        "certified safe",
        "no risk",
        "guaranteed exit liquidity",
        "fully audited",
        "will pump",
        "will recover",
        "institutional proof",
      ],
      requiredBeforeAdvancedPdf: [
        "same canonicalEvidenceFingerprint across Browser/PDF/Brain",
        "field-by-field provenance with observedAt/max-age",
        "risk calibration with confidence cap",
        "chart continuity and overlay state for macro ranges",
        "holder/depth proof or visible lock",
        "DefiLlama TVL methodology boundary when TVL appears",
      ],
    },
    nextWorldClassIntegrations: [
      "Render Report Evidence Capsule as a small proof strip in Shield, Real Markets and VLM Brain before narrative text.",
      "Make Browser preview and PDF download reject mismatched canonicalEvidenceFingerprint.",
      "Persist report capsules per user account so Advanced reports can be replayed and audited later.",
      "Add cross-locale snapshot tests for PL/EN/DE report sections and no debug-copy leakage.",
      "Add report section heatmap to show exactly why Advanced is worth more than Pro without leaking paid evidence.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
