import { C0_OR_BRACE_ANGLE_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2572AuditProviderRuntimeReport } from "./audit-provider-runtime-client";
import type { Pass2573AuditRuntimeConfidenceReport } from "./audit-runtime-confidence";
import type { Pass2574AuditClaimLedgerReport } from "./audit-claim-ledger";
import type { Pass2575AuditSourceFreshnessReport } from "./audit-source-freshness";
import type { Pass2576AuditPermissionParserReport } from "./audit-permission-parser";
import type { Pass2577AuditLiquidityHolderLockRiskReport } from "./audit-liquidity-holder-lock-risk";

export const PASS2578_AUDIT_REPORT_ASSEMBLER_ID = "audit-report-assembler" as const;

export type Pass2578ReportTier = "basic" | "pro" | "advanced";
export type Pass2578ReportSectionState = "ready" | "partial" | "missing" | "blocked" | "manual_review";
export type Pass2578ReportFindingSeverity = "info" | "watch" | "elevated" | "critical";

export type Pass2578ReportSection = {
  id: string;
  tier: Pass2578ReportTier;
  title: string;
  state: Pass2578ReportSectionState;
  scoreImpact: number;
  confidenceImpact: number;
  customerSummary: string;
  proPdfSummary: string;
  advancedAction: string;
  evidenceCount: number;
  missingCount: number;
  sourceFamilies: string[];
};

export type Pass2578TopFinding = {
  id: string;
  severity: Pass2578ReportFindingSeverity;
  title: string;
  publicLine: string;
  proLine: string;
  advancedAction: string;
  sourceFamily: string;
};

export type Pass2578VisualMergeContract = {
  purpose: string;
  doNotBreak: string[];
  uiSlots: Array<{
    slot: string;
    dataPath: string;
    visualOwner: "user" | "assistant" | "shared";
    notes: string;
  }>;
};

export type Pass2578AuditReportAssemblerReport = {
  passId: typeof PASS2578_AUDIT_REPORT_ASSEMBLER_ID;
  generatedAt: string;
  locale: string;
  target: {
    contractAddress?: string;
    projectName?: string;
    chain: string;
  };
  rule: string;
  reportMode: string;
  finalVerdict: {
    riskScore: number | null;
    riskLabel: string;
    reviewPriorityScore: number;
    sourceConfidence: number;
    readinessScore: number;
    basicState: Pass2578ReportSectionState;
    proState: Pass2578ReportSectionState;
    advancedState: Pass2578ReportSectionState;
    publicVerdict: string;
    proVerdict: string;
    advancedVerdict: string;
  };
  summary: {
    totalSections: number;
    ready: number;
    partial: number;
    missing: number;
    blocked: number;
    manualReview: number;
    totalEvidence: number;
    totalMissing: number;
    proPdfSections: number;
    advancedActions: number;
  };
  sections: Pass2578ReportSection[];
  basicSections: Pass2578ReportSection[];
  proPdfSections: Pass2578ReportSection[];
  advancedQueue: string[];
  topFindings: Pass2578TopFinding[];
  proPdfLines: string[];
  visualMergeContract: Pass2578VisualMergeContract;
};

type AssemblerInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  providerRuntime?: Pass2572AuditProviderRuntimeReport | null;
  runtimeConfidence?: Pass2573AuditRuntimeConfidenceReport | null;
  claimLedger?: Pass2574AuditClaimLedgerReport | null;
  sourceFreshness?: Pass2575AuditSourceFreshnessReport | null;
  permissionParser?: Pass2576AuditPermissionParserReport | null;
  liquidityHolderRisk?: Pass2577AuditLiquidityHolderLockRiskReport | null;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(C0_OR_BRACE_ANGLE_PATTERN, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sectionState(ready: number, partial: number, missing: number, blocked: number, manual = 0): Pass2578ReportSectionState {
  if (manual > 0) return "manual_review";
  if (blocked > 0) return "blocked";
  if (ready > 0 && missing === 0 && partial === 0) return "ready";
  if (ready > 0 || partial > 0) return "partial";
  return "missing";
}

function severityFor(state: Pass2578ReportSectionState, impact: number): Pass2578ReportFindingSeverity {
  if (state === "ready") return "info";
  if (state === "blocked" || impact >= 18) return "critical";
  if (state === "manual_review" || impact >= 12) return "elevated";
  return "watch";
}

function sourceFamilies(...families: Array<string | undefined | null | string[]>) {
  return Array.from(new Set(families.flat().filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()))).slice(0, 8);
}

function section(args: {
  id: string;
  tier: Pass2578ReportTier;
  title: string;
  state: Pass2578ReportSectionState;
  scoreImpact: number;
  confidenceImpact: number;
  customerSummary: string;
  proPdfSummary: string;
  advancedAction: string;
  evidenceCount: number;
  missingCount: number;
  sourceFamilies: string[];
}): Pass2578ReportSection {
  return {
    ...args,
    scoreImpact: clamp(args.scoreImpact, -30, 40),
    confidenceImpact: clamp(args.confidenceImpact, -30, 30),
    evidenceCount: clamp(args.evidenceCount, 0, 200),
    missingCount: clamp(args.missingCount, 0, 200),
    sourceFamilies: args.sourceFamilies.slice(0, 8),
  };
}

function stateWord(locale: string, state: Pass2578ReportSectionState) {
  if (state === "ready") return t(locale, "gotowe", "bereit", "ready");
  if (state === "partial") return t(locale, "częściowe", "teilweise", "partial");
  if (state === "blocked") return t(locale, "zablokowane", "blockiert", "blocked");
  if (state === "manual_review") return t(locale, "manual review", "Manual Review", "manual review");
  return t(locale, "brak danych", "fehlende Daten", "missing");
}

function findingFromSection(locale: string, item: Pass2578ReportSection): Pass2578TopFinding {
  const sourceFamily = item.sourceFamilies[0] ?? "velmere-engine";
  return {
    id: `finding-${item.id}`,
    severity: severityFor(item.state, item.scoreImpact),
    title: `${item.title} · ${stateWord(locale, item.state)}`,
    publicLine: item.customerSummary,
    proLine: item.proPdfSummary,
    advancedAction: item.advancedAction,
    sourceFamily,
  };
}

function findingFromPermissionSignal(signal: Pass2576AuditPermissionParserReport["signals"][number]): Pass2578TopFinding {
  const severity: Pass2578ReportFindingSeverity = signal.severity === "critical"
    ? "critical"
    : signal.severity === "elevated"
      ? "elevated"
      : signal.severity === "watch"
        ? "watch"
        : "info";
  return {
    id: `finding-permission-signal-${signal.id}`,
    severity,
    title: signal.label,
    publicLine: signal.basicLine,
    proLine: signal.proPdfLine,
    advancedAction: signal.advancedAction,
    sourceFamily: `permission:${signal.category}`,
  };
}

function findingFromAdverseClaim(claim: Pass2574AuditClaimLedgerReport["claims"][number]): Pass2578TopFinding {
  const riskFloor = Math.max(0, Math.min(100, Math.round(claim.adverseRiskFloor ?? 0)));
  const severity: Pass2578ReportFindingSeverity = claim.adverseSeverity
    ?? (riskFloor >= 85 ? "critical" : riskFloor >= 65 ? "elevated" : "watch");
  const title = claim.adverseKind === "deployment_identity"
    ? "Deployment identity mismatch · confirmed"
    : claim.adverseKind === "historical_exploit"
      ? "Historical deployment-bound exploit · confirmed"
      : `${claim.label} · confirmed`;
  return {
    id: `finding-${claim.id}`,
    severity,
    title,
    publicLine: claim.customerLine,
    proLine: claim.proPdfLine,
    advancedAction: claim.advancedAction,
    sourceFamily: claim.sourceFamily,
  };
}

function findingFromCurrentConfigurationClaim(claim: Pass2574AuditClaimLedgerReport["claims"][number]): Pass2578TopFinding {
  return {
    id: `finding-${claim.id}`,
    severity: "info",
    title: "Current deployment configuration · exact-block quorum",
    publicLine: claim.customerLine,
    proLine: claim.proPdfLine,
    advancedAction: claim.advancedAction,
    sourceFamily: claim.sourceFamily,
  };
}

function visualContract(locale: string): Pass2578VisualMergeContract {
  return {
    purpose: t(
      locale,
      "Kontrakt do połączenia Twojej wizualnej wersji audytu z aktualnym silnikiem bez gubienia danych.",
      "Vertrag, um dein visuelles Audit mit der aktuellen Engine zu verbinden, ohne Daten zu verlieren.",
      "Contract for merging your visual audit design with the current engine without losing data.",
    ),
    doNotBreak: [
      "claim -> source -> grade -> freshness -> confidence -> verdict",
      "Basic stays public/passive and never claims full safety",
      "Pro PDF uses the same report assembler payload as the page",
      "Advanced remains automated-only: no human-review or operator-signoff claim may be introduced by a deeper tier",
      "Missing evidence is a first-class output, not hidden copy",
      "No seed phrase, no private key, no wallet custody request",
    ],
    uiSlots: [
      {
        slot: "hero_score_card",
        dataPath: "pass2578AuditReportAssembler.finalVerdict",
        visualOwner: "user",
        notes: "Use your premium visual design here; keep riskScore, riskLabel, sourceConfidence and readinessScore wired.",
      },
      {
        slot: "basic_public_rows",
        dataPath: "pass2578AuditReportAssembler.basicSections",
        visualOwner: "shared",
        notes: "Can be condensed visually, but keep state badges and missing evidence visible.",
      },
      {
        slot: "pro_pdf_sections",
        dataPath: "pass2578AuditReportAssembler.proPdfSections",
        visualOwner: "assistant",
        notes: "This is backend/PDF content; visual PDF template can be replaced later.",
      },
      {
        slot: "advanced_automated_evidence_actions",
        dataPath: "pass2578AuditReportAssembler.advancedQueue",
        visualOwner: "assistant",
        notes: "Expose only bounded automated evidence-resolution and retest actions; never imply human review or operator sign-off.",
      },
      {
        slot: "top_findings",
        dataPath: "pass2578AuditReportAssembler.topFindings",
        visualOwner: "shared",
        notes: "Best place for minimal luxury cards in your visual pass.",
      },
    ],
  };
}

export function buildPass2578AuditReportAssemblerReport(input: AssemblerInput): Pass2578AuditReportAssemblerReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? input.providerRuntime?.target.chain ?? input.runtimeConfidence?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? input.providerRuntime?.target.contractAddress ?? input.runtimeConfidence?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? input.providerRuntime?.target.projectName ?? input.runtimeConfidence?.target.projectName;

  const confidence = input.runtimeConfidence?.overall.sourceConfidence ?? 42;
  const riskScore = input.runtimeConfidence?.overall.riskScore ?? null;
  const confirmedRiskFloorClaims = (input.claimLedger?.claims ?? []).filter((claim) =>
    claim.grade === "confirmed" && claim.canShowAsFact && Number.isFinite(claim.adverseRiskFloor) && Number(claim.adverseRiskFloor) > 0);
  const confirmedHistoricalClaims = (input.claimLedger?.claims ?? []).filter((claim) =>
    claim.grade === "confirmed" && claim.canShowAsFact && claim.adverseKind === "historical_exploit" && claim.adverseSeverity === "critical");
  const confirmedCurrentConfigurationClaims = (input.claimLedger?.claims ?? []).filter((claim) =>
    claim.grade === "confirmed" && claim.canShowAsFact && claim.findingKind === "current_deployment_configuration");
  const adverseRiskFloor = confirmedRiskFloorClaims.length > 0
    ? Math.max(...confirmedRiskFloorClaims.map((claim) => Math.max(0, Math.min(100, Math.round(Number(claim.adverseRiskFloor))))))
    : null;
  const baseReviewPriority = input.runtimeConfidence?.overall.reviewPriorityScore ?? 38;

  const runtimeState = sectionState(
    input.providerRuntime?.summary.confirmed ?? 0,
    input.providerRuntime?.summary.partial ?? 0,
    (input.providerRuntime?.summary.missing ?? 0),
    input.providerRuntime?.summary.blocked ?? 0,
  );
  const claimState = sectionState(
    input.claimLedger?.summary.confirmed ?? 0,
    input.claimLedger?.summary.partial ?? 0,
    input.claimLedger?.summary.missing ?? 0,
    input.claimLedger?.summary.blocked ?? 0,
  );
  const freshnessState = sectionState(
    (input.sourceFreshness?.summary.fresh ?? 0) + (input.sourceFreshness?.summary.acceptable ?? 0),
    input.sourceFreshness?.summary.stale ?? 0,
    (input.sourceFreshness?.summary.expired ?? 0) + (input.sourceFreshness?.summary.unknown ?? 0),
    input.sourceFreshness?.summary.blocked ?? 0,
  );
  const permissionState = sectionState(
    input.permissionParser?.summary.detected ?? 0,
    input.permissionParser?.summary.notDetected ?? 0,
    input.permissionParser?.summary.unknown ?? 0,
    input.permissionParser?.summary.blocked ?? 0,
    0,
  );
  const liquidityState = sectionState(
    input.liquidityHolderRisk?.summary.confirmed ?? 0,
    input.liquidityHolderRisk?.summary.partial ?? 0,
    input.liquidityHolderRisk?.summary.missing ?? 0,
    input.liquidityHolderRisk?.summary.blocked ?? 0,
    0,
  );

  const sections: Pass2578ReportSection[] = [
    section({
      id: "provider-runtime",
      tier: "basic",
      title: "Live provider runtime",
      state: runtimeState,
      scoreImpact: ((input.providerRuntime?.summary.blocked ?? 0) + (input.providerRuntime?.summary.timedOut ?? 0) + (input.providerRuntime?.summary.errors ?? 0)) * 5 || 8,
      confidenceImpact: runtimeState === "ready" ? 12 : runtimeState === "partial" ? 3 : -8,
      customerSummary: input.providerRuntime?.summary.confidenceHint ?? t(locale, "Źródła live nie są jeszcze kompletne.", "Live Quellen sind noch nicht komplett.", "Live sources are not complete yet."),
      proPdfSummary: `runtime=${runtimeState}; confirmed=${input.providerRuntime?.summary.confirmed ?? 0}; partial=${input.providerRuntime?.summary.partial ?? 0}; blocked=${input.providerRuntime?.summary.blocked ?? 0}; timedOut=${input.providerRuntime?.summary.timedOut ?? 0}; errors=${input.providerRuntime?.summary.errors ?? 0}`,
      advancedAction: t(locale, "Przywrócić brakujące źródła/provider fallback i ponownie uruchomić evidence runtime.", "Fehlende Quellen/Provider-Fallbacks wiederherstellen und Evidence-Runtime erneut ausführen.", "Restore missing sources/provider fallbacks and rerun the evidence runtime."),
      evidenceCount: input.providerRuntime?.summary.confirmed ?? 0,
      missingCount: (input.providerRuntime?.summary.missing ?? 0) + (input.providerRuntime?.summary.blocked ?? 0),
      sourceFamilies: sourceFamilies(input.providerRuntime?.lanes.map((lane) => lane.provider)),
    }),
    section({
      id: "claim-ledger",
      tier: "basic",
      title: "Claim ledger",
      state: claimState,
      scoreImpact: input.claimLedger?.summary.missing ? input.claimLedger.summary.missing * 4 : 6,
      confidenceImpact: (input.claimLedger?.summary.confirmed ?? 0) - ((input.claimLedger?.summary.missing ?? 0) * 2),
      customerSummary: input.claimLedger?.customerRule ?? t(locale, "Każdy claim musi mieć źródło i status.", "Jeder Claim braucht Quelle und Status.", "Every claim needs a source and status."),
      proPdfSummary: `claims=${input.claimLedger?.summary.totalClaims ?? 0}; factSafe=${input.claimLedger?.summary.factSafeClaims ?? 0}; missing=${input.claimLedger?.summary.missing ?? 0}; blocked=${input.claimLedger?.summary.blocked ?? 0}`,
      advancedAction: t(locale, "Rozwiązać claimy partial/missing i związać drugi niezależny source przed finalnym PDF.", "Partial/Missing Claims auflösen und vor dem finalen PDF an eine zweite unabhängige Quelle binden.", "Resolve partial/missing claims and bind a second independent source before the final PDF."),
      evidenceCount: input.claimLedger?.summary.factSafeClaims ?? 0,
      missingCount: (input.claimLedger?.summary.missing ?? 0) + (input.claimLedger?.summary.blocked ?? 0),
      sourceFamilies: sourceFamilies(input.claimLedger?.claims.map((claim) => claim.sourceFamily)),
    }),
    section({
      id: "freshness-ledger",
      tier: "pro",
      title: "Source freshness ledger",
      state: freshnessState,
      scoreImpact: (input.sourceFreshness?.summary.expired ?? 0) * 5 + (input.sourceFreshness?.summary.stale ?? 0) * 3,
      confidenceImpact: (input.sourceFreshness?.summary.basicUsable ?? 0) - ((input.sourceFreshness?.summary.expired ?? 0) * 2),
      customerSummary: input.sourceFreshness?.customerRule ?? t(locale, "Timestamp i TTL muszą być widoczne.", "Timestamp und TTL muessen sichtbar sein.", "Timestamp and TTL must be visible."),
      proPdfSummary: `fresh=${input.sourceFreshness?.summary.fresh ?? 0}; acceptable=${input.sourceFreshness?.summary.acceptable ?? 0}; stale=${input.sourceFreshness?.summary.stale ?? 0}; expired=${input.sourceFreshness?.summary.expired ?? 0}; next=${input.sourceFreshness?.summary.nextRefreshHint ?? "n/a"}`,
      advancedAction: t(locale, "Odświeżyć stale/expired lane’y i ponownie związać dowody przed artefaktem po TTL.", "Stale/Expired Lanes aktualisieren und die Evidenz nach TTL vor dem Artefakt erneut binden.", "Refresh stale/expired lanes and re-bind evidence before any artifact after TTL."),
      evidenceCount: (input.sourceFreshness?.summary.fresh ?? 0) + (input.sourceFreshness?.summary.acceptable ?? 0),
      missingCount: (input.sourceFreshness?.summary.expired ?? 0) + (input.sourceFreshness?.summary.unknown ?? 0) + (input.sourceFreshness?.summary.blocked ?? 0),
      sourceFamilies: sourceFamilies(input.sourceFreshness?.lanes.map((lane) => lane.provider)),
    }),
    section({
      id: "permission-parser",
      tier: "pro",
      title: "Permission parser",
      state: permissionState,
      scoreImpact: input.permissionParser?.summary.riskDelta ?? 10,
      confidenceImpact: input.permissionParser?.summary.confidenceDelta ?? -4,
      customerSummary: input.permissionParser?.customerRule ?? t(locale, "Uprawnienia kontraktu wymagają parsera i potwierdzenia.", "Contract Rechte brauchen Parser und Bestaetigung.", "Contract permissions need parser and confirmation."),
      proPdfSummary: `detected=${input.permissionParser?.summary.detected ?? 0}; unknown=${input.permissionParser?.summary.unknown ?? 0}; blocked=${input.permissionParser?.summary.blocked ?? 0}; riskDelta=${input.permissionParser?.summary.riskDelta ?? 0}; confidenceDelta=${input.permissionParser?.summary.confidenceDelta ?? 0}`,
      advancedAction: t(locale, "Odtworzyć owner/proxy/mint/freeze/blacklist/tax z source/ABI/bytecode i potwierdzić niezależnym evidence przed oceną końcową.", "Owner/Proxy/Mint/Freeze/Blacklist/Tax aus Source/ABI/Bytecode reproduzieren und vor der Endbewertung mit unabhängiger Evidenz bestätigen.", "Reproduce owner/proxy/mint/freeze/blacklist/tax from source/ABI/bytecode and confirm with independent evidence before the final rating."),
      evidenceCount: input.permissionParser?.summary.detected ?? 0,
      missingCount: (input.permissionParser?.summary.unknown ?? 0) + (input.permissionParser?.summary.blocked ?? 0),
      sourceFamilies: sourceFamilies(input.permissionParser?.signals.map((signal) => signal.category)),
    }),
    section({
      id: "liquidity-holder-lock-risk",
      tier: "pro",
      title: "Liquidity / holders / lock risk",
      state: liquidityState,
      scoreImpact: input.liquidityHolderRisk?.summary.riskDelta ?? 14,
      confidenceImpact: input.liquidityHolderRisk?.summary.confidenceDelta ?? -6,
      customerSummary: input.liquidityHolderRisk?.customerRule ?? t(locale, "Liquidity i holders bez źródła pozostają ograniczone.", "Liquidity und Holders bleiben ohne Quelle begrenzt.", "Liquidity and holders stay limited without sources."),
      proPdfSummary: `confirmed=${input.liquidityHolderRisk?.summary.confirmed ?? 0}; partial=${input.liquidityHolderRisk?.summary.partial ?? 0}; missing=${input.liquidityHolderRisk?.summary.missing ?? 0}; blocked=${input.liquidityHolderRisk?.summary.blocked ?? 0}; riskDelta=${input.liquidityHolderRisk?.summary.riskDelta ?? 0}`,
      advancedAction: t(locale, "Ponownie potwierdzić top holders, LP custody, lock proof i deployer relation na current source-bound evidence.", "Top Holders, LP Custody, Lock Proof und Deployer Relation anhand aktueller source-bound Evidenz erneut bestätigen.", "Revalidate top holders, LP custody, lock proof and deployer relation from current source-bound evidence."),
      evidenceCount: (input.liquidityHolderRisk?.summary.confirmed ?? 0) + (input.liquidityHolderRisk?.summary.partial ?? 0),
      missingCount: (input.liquidityHolderRisk?.summary.missing ?? 0) + (input.liquidityHolderRisk?.summary.blocked ?? 0),
      sourceFamilies: sourceFamilies(input.liquidityHolderRisk?.signals.flatMap((signal) => signal.sourceFamilies)),
    }),
  ];

  const ready = sections.filter((item) => item.state === "ready").length;
  const partial = sections.filter((item) => item.state === "partial").length;
  const missing = sections.filter((item) => item.state === "missing").length;
  const blocked = sections.filter((item) => item.state === "blocked").length;
  const manualReview = sections.filter((item) => item.state === "manual_review").length;
  const totalEvidence = sections.reduce((sum, item) => sum + item.evidenceCount, 0);
  const totalMissing = sections.reduce((sum, item) => sum + item.missingCount, 0);
  const readinessScore = clamp(ready * 20 + partial * 11 + manualReview * 7 - missing * 9 - blocked * 14 + Math.min(totalEvidence, 20) - Math.min(totalMissing, 20), 0, 100);
  const finalConfidence = clamp(confidence + sections.reduce((sum, item) => sum + item.confidenceImpact, 0) / 5, 0, 100);
  // Evidence gaps affect readiness/review priority, not the adverse-risk score.
  // A confirmed adverse authority claim may establish a deterministic risk floor, but only
  // after the claim ledger has verified its independent authority receipt bundle.
  const finalRisk = adverseRiskFloor === null
    ? riskScore
    : riskScore === null
      ? adverseRiskFloor
      : Math.max(riskScore, adverseRiskFloor);
  const reviewPriorityScore = clamp(baseReviewPriority + missing * 8 + blocked * 12 + manualReview * 6 + totalMissing * 2 - ready * 3, 0, 100);
  const finalRiskLabel = finalRisk === null
    ? "Unknown - evidence incomplete"
    : finalRisk >= 72 ? "High watch" : finalRisk >= 55 ? "Elevated" : finalRisk >= 35 ? "Limited" : "Low watch";
  const basicState = ready + partial >= 2 ? "partial" : "missing";
  const proState = totalMissing + blocked > 3 ? "partial" : "ready";
  const advancedState = blocked > 0 ? "blocked" : missing > 0 ? "missing" : partial > 0 ? "partial" : "ready";

  const adverseFindings = [...confirmedHistoricalClaims, ...confirmedRiskFloorClaims]
    .filter((claim, index, rows) => rows.findIndex((candidate) => candidate.id === claim.id) === index)
    .sort((a, b) => {
      const severityRank = { critical: 3, elevated: 2, watch: 1 } as const;
      const severityDelta = (severityRank[b.adverseSeverity ?? "watch"] ?? 0) - (severityRank[a.adverseSeverity ?? "watch"] ?? 0);
      return severityDelta || Number(b.adverseRiskFloor ?? 0) - Number(a.adverseRiskFloor ?? 0);
    })
    .map((claim) => findingFromAdverseClaim(claim));
  const currentConfigurationFindings = confirmedCurrentConfigurationClaims
    .map((claim) => findingFromCurrentConfigurationClaim(claim));
  const permissionFindings = (input.permissionParser?.signals ?? [])
    .filter((signal) => signal.state === "detected" && (signal.severity === "elevated" || signal.severity === "critical"))
    .sort((a, b) => b.riskDelta - a.riskDelta)
    .map((signal) => findingFromPermissionSignal(signal));
  const sectionFindings = sections
    .filter((item) => item.state !== "ready" || item.scoreImpact > 8)
    .sort((a, b) => (b.scoreImpact + b.missingCount * 3) - (a.scoreImpact + a.missingCount * 3))
    .map((item) => findingFromSection(locale, item));
  const topFindings = [...adverseFindings, ...currentConfigurationFindings, ...permissionFindings, ...sectionFindings]
    .filter((finding, index, rows) => rows.findIndex((candidate) => candidate.id === finding.id) === index)
    .slice(0, 7);

  const advancedQueue = sections
    .filter((item) => item.state !== "ready")
    .map((item) => `${item.title}: ${item.advancedAction}`)
    .concat(input.permissionParser?.advancedQueue ?? [], input.liquidityHolderRisk?.advancedQueue ?? [])
    .filter(Boolean)
    .slice(0, 18);

  const proPdfSections = sections.filter((item) => item.tier === "pro" || item.state !== "ready");
  const proPdfLines = [
    `PASS2578 report assembler: readiness=${readinessScore}/100; risk=${finalRisk === null ? "unavailable" : `${finalRiskLabel} ${finalRisk}/100`}; reviewPriority=${reviewPriorityScore}/100; confidence=${finalConfidence}/100`,
    `Target: ${contractAddress ?? projectName ?? "unknown"}; chain=${chain}`,
    `Sections: ready=${ready}; partial=${partial}; missing=${missing}; blocked=${blocked}; manualReview=${manualReview}`,
    `Evidence: evidence=${totalEvidence}; missing=${totalMissing}; topFindings=${topFindings.length}; advancedActions=${advancedQueue.length}`,
    ...topFindings.flatMap((finding, index) => [
      `Finding ${index + 1}: ${finding.title}; severity=${finding.severity}; sourceFamily=${finding.sourceFamily}`,
      `   ${finding.proLine}`,
    ]),
    ...proPdfSections.flatMap((item, index) => [
      `${index + 1}. ${item.title} - ${item.state} - tier=${item.tier}`,
      `   ${item.proPdfSummary}`,
    ]),
  ];

  return {
    passId: PASS2578_AUDIT_REPORT_ASSEMBLER_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { contractAddress, projectName, chain },
    rule: t(
      locale,
      "PASS2578 składa wynik audytu w jeden kontrakt: Basic prescreen, Pro rozszerzony PDF, Advanced zautomatyzowany evidence/retest appendix bez human review.",
      "PASS2578 baut das Audit in einen Vertrag: Basic Prescreen, erweitertes Pro-PDF und automatisierter Advanced Evidence/Retest-Anhang ohne Human Review.",
      "PASS2578 assembles one audit contract: Basic prescreen, extended Pro PDF, and an automated Advanced evidence/retest appendix with no human review.",
    ),
    reportMode: "visual-independent backend report contract; ready for later UI merge",
    finalVerdict: {
      riskScore: finalRisk,
      riskLabel: finalRiskLabel,
      reviewPriorityScore,
      sourceConfidence: finalConfidence,
      readinessScore,
      basicState,
      proState,
      advancedState,
      publicVerdict: t(
        locale,
        finalRisk === null
          ? `Basic nie publikuje liczbowego ryzyka bez zweryfikowanego adverse findingu; missing evidence wynosi ${totalMissing}, więc rośnie tylko priorytet review.`
          : `Basic publikuje evidence-bound risk ${finalRisk}/100; missing evidence wynosi ${totalMissing}.`,
        finalRisk === null
          ? `Basic veroeffentlicht ohne verifiziertes Adverse Finding keinen Risiko-Score; Missing Evidence ist ${totalMissing}, daher steigt nur die Review-Prioritaet.`
          : `Basic veroeffentlicht evidence-bound Risk ${finalRisk}/100; Missing Evidence ist ${totalMissing}.`,
        finalRisk === null
          ? `Basic does not publish a numeric risk score without a verified adverse finding; missing evidence is ${totalMissing}, so only review priority increases.`
          : `Basic publishes evidence-bound risk ${finalRisk}/100; missing evidence is ${totalMissing}.`,
      ),
      proVerdict: t(
        locale,
        `Pro PDF powinien zawierać ${proPdfSections.length} sekcji i ${topFindings.length} głównych findingów przed finalnym layoutem.`,
        `Pro PDF sollte ${proPdfSections.length} Sektionen und ${topFindings.length} Hauptfindings vor finalem Layout enthalten.`,
        `Pro PDF should include ${proPdfSections.length} sections and ${topFindings.length} top findings before final layout.`,
      ),
      advancedVerdict: t(
        locale,
        `Advanced wymaga ${advancedQueue.length} zautomatyzowanych działań evidence-resolution/retest przed kompletnym werdyktem informacyjnym.`,
        `Advanced benötigt ${advancedQueue.length} automatisierte Evidence-Resolution/Retest-Aktionen vor einem vollständigen informativen Urteil.`,
        `Advanced requires ${advancedQueue.length} automated evidence-resolution/retest actions before a complete informational verdict.`,
      ),
    },
    summary: {
      totalSections: sections.length,
      ready,
      partial,
      missing,
      blocked,
      manualReview,
      totalEvidence,
      totalMissing,
      proPdfSections: proPdfSections.length,
      advancedActions: advancedQueue.length,
    },
    sections,
    basicSections: sections.filter((item) => item.tier === "basic" || item.state !== "ready").slice(0, 6),
    proPdfSections,
    advancedQueue,
    topFindings,
    proPdfLines,
    visualMergeContract: visualContract(locale),
  };
}
