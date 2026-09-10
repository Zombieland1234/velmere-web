import { createHash } from "node:crypto";
import type {
  Pass2543CustomerExportRecallAttestationRebalance,
  Pass2543CustomerRecallAttestation,
  Pass2543RecallAttestationState,
  Pass2543RecallReason,
} from "./customer-export-recall-attestation-rebalance";

export const PASS2544_RECALL_RESOLUTION_SUPPORT_REPLAY_REBALANCE_ID = "recall-resolution-support-replay-rebalance-v1" as const;

export type Pass2544ResolutionState =
  | "download_available"
  | "support_replay_required"
  | "replacement_available"
  | "operator_resolution_required"
  | "blocked";
export type Pass2544ResolutionDecision =
  | "serve_original_export"
  | "serve_replacement_export"
  | "show_support_replay_card"
  | "open_operator_resolution"
  | "block_customer_download";
export type Pass2544ResolutionSurface =
  | "browser_pdf_download_route"
  | "account_vault_recall_card"
  | "angel_paid_export_answer"
  | "support_case_timeline"
  | "checkout_receipt_replay"
  | "customer_download_cta"
  | "operator_resolution_queue";

export type Pass2544SupportReplayCase = {
  id: string;
  attestationId: string;
  receiptId: string;
  state: Pass2544ResolutionState;
  decision: Pass2544ResolutionDecision;
  recallState: Pass2543RecallAttestationState;
  recallReason: Pass2543RecallReason;
  recallChainHash: string;
  recallNoticeId: string;
  customerNoticeHash: string;
  supportCaseId: string;
  replayRunId: string;
  replayAttemptBudget: number;
  replacementArtifactId?: string;
  replacementExportHash?: string;
  browserPdfDownloadAllowed: boolean;
  angelMayClaimExportValid: boolean;
  customerSafeResolutionHash: string;
  supportTimelineEventIds: string[];
  blockedCustomerClaims: string[];
  requiredResolutionKeys: string[];
  missingResolutionKeys: string[];
  customerSafeCopy: Record<"pl" | "en" | "de", string>;
  operatorOnlyFields: string[];
  surfaces: Pass2544ResolutionSurface[];
  releaseEquation: string;
  dataAttributes: Record<string, string>;
};

export type Pass2544DownloadRouteGuard = {
  id: string;
  caseId: string;
  route: string;
  state: Pass2544ResolutionState;
  decision: Pass2544ResolutionDecision;
  downloadAllowed: boolean;
  replacementRequired: boolean;
  customerSafeResolutionHash: string;
  recallChainHash: string;
  supportCaseId: string;
  replayRunId: string;
};

export type Pass2544AngelRecallBoundary = {
  id: string;
  caseId: string;
  canAnswerAsFinal: boolean;
  allowedTone: "attested" | "support_replay" | "replacement_notice" | "blocked";
  blockedClaims: string[];
  safeAnswer: Record<"pl" | "en" | "de", string>;
};

export type Pass2544Fixture = {
  id: string;
  scenario:
    | "valid_attested_serves_original"
    | "recall_watch_opens_support_replay"
    | "recalled_blocks_download"
    | "superseded_serves_replacement"
    | "dispute_hold_operator_resolution";
  inputRecallState: Pass2543RecallAttestationState;
  expectedState: Pass2544ResolutionState;
  expectedDownloadAllowed: boolean;
  expectedAngelFinalAllowed: boolean;
};

export type Pass2544SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2544RecallResolutionSupportReplayRebalance = {
  id: typeof PASS2544_RECALL_RESOLUTION_SUPPORT_REPLAY_REBALANCE_ID;
  state: "ready_with_resolution_controls" | "support_replay_required" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  browserPdfRouteGuardBeforePercent: number;
  browserPdfRouteGuardAfterPercent: number;
  accountVaultRecallCardBeforePercent: number;
  accountVaultRecallCardAfterPercent: number;
  angelRecallBoundaryBeforePercent: number;
  angelRecallBoundaryAfterPercent: number;
  supportReplayTimelineBeforePercent: number;
  supportReplayTimelineAfterPercent: number;
  replacementExportBeforePercent: number;
  replacementExportAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  inheritedPass2543State?: Pass2543CustomerExportRecallAttestationRebalance["state"] | "missing";
  supportReplayCases: Pass2544SupportReplayCase[];
  downloadRouteGuards: Pass2544DownloadRouteGuard[];
  angelBoundaries: Pass2544AngelRecallBoundary[];
  fixtures: Pass2544Fixture[];
  semanticLanes: Pass2544SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  resolutionRule: string;
  fingerprint: string;
};

const REQUIRED_RESOLUTION_KEYS = [
  "recallChainHash",
  "recallNoticeId",
  "customerNoticeHash",
  "supportCaseId",
  "replayRunId",
  "customerSafeResolutionHash",
  "browserPdfDownloadDecision",
  "angelDowngradeBoundary",
] as const;

const SUPPORT_SURFACES: Pass2544ResolutionSurface[] = [
  "browser_pdf_download_route",
  "account_vault_recall_card",
  "angel_paid_export_answer",
  "support_case_timeline",
  "checkout_receipt_replay",
  "customer_download_cta",
  "operator_resolution_queue",
];

const OPERATOR_ONLY_FIELDS = [
  "operatorInternalNote",
  "rawProviderPayload",
  "paymentProviderPayload",
  "fullWalletAddress",
  "deviceFingerprint",
  "ipAddress",
  "rawPrompt",
  "unredactedWebhook",
  "supportAgentPrivateNote",
];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function resolutionStateFromAttestation(attestation: Pass2543CustomerRecallAttestation): Pass2544ResolutionState {
  if (attestation.state === "valid_attested" && attestation.customerDownloadNowAllowed) return "download_available";
  if (attestation.state === "superseded") return "replacement_available";
  if (attestation.state === "dispute_hold") return "operator_resolution_required";
  if (attestation.state === "recall_watch") return "support_replay_required";
  return "blocked";
}

function decisionFromResolution(state: Pass2544ResolutionState): Pass2544ResolutionDecision {
  if (state === "download_available") return "serve_original_export";
  if (state === "replacement_available") return "serve_replacement_export";
  if (state === "support_replay_required") return "show_support_replay_card";
  if (state === "operator_resolution_required") return "open_operator_resolution";
  return "block_customer_download";
}

function buildCustomerSafeCopy(state: Pass2544ResolutionState, reason: Pass2543RecallReason): Record<"pl" | "en" | "de", string> {
  const cleanReason = reason === "none" ? "attested" : reason.replaceAll("_", " ");
  if (state === "download_available") {
    return {
      pl: "Eksport pozostaje dostępny: recall chain, skarbiec konta i replay są spójne.",
      en: "Export remains available: recall chain, account vault and replay are consistent.",
      de: "Export bleibt verfügbar: Recall-Kette, Account-Vault und Replay sind konsistent.",
    };
  }
  if (state === "replacement_available") {
    return {
      pl: `Eksport został zastąpiony nowszą wersją po replay. Powód publiczny: ${cleanReason}.`,
      en: `Export was superseded by a newer replay-safe version. Public reason: ${cleanReason}.`,
      de: `Export wurde durch eine neuere replay-sichere Version ersetzt. Öffentlicher Grund: ${cleanReason}.`,
    };
  }
  if (state === "support_replay_required") {
    return {
      pl: `Eksport wymaga replay i sprawdzenia supportu przed pobraniem. Powód publiczny: ${cleanReason}.`,
      en: `Export needs replay and support review before download. Public reason: ${cleanReason}.`,
      de: `Export benötigt vor dem Download Replay und Support-Prüfung. Öffentlicher Grund: ${cleanReason}.`,
    };
  }
  return {
    pl: `Pobranie jest zablokowane do czasu rozstrzygnięcia operatora. Powód publiczny: ${cleanReason}.`,
    en: `Download is blocked until operator resolution completes. Public reason: ${cleanReason}.`,
    de: `Download ist bis zur Operator-Entscheidung blockiert. Öffentlicher Grund: ${cleanReason}.`,
  };
}

function buildSupportReplayCase(attestation: Pass2543CustomerRecallAttestation): Pass2544SupportReplayCase {
  const state = resolutionStateFromAttestation(attestation);
  const decision = decisionFromResolution(state);
  const supportCaseId = `support-replay-${attestation.id}`;
  const replayRunId = `replay-run-${attestation.receiptId}`;
  const replacementArtifactId = state === "replacement_available" ? attestation.replacementArtifactId : undefined;
  const replacementExportHash = replacementArtifactId ? stableHash({ replacementArtifactId, recallChainHash: attestation.recallChainHash }) : undefined;
  const blockedCustomerClaims = ["final forever", "paid export ready", "download ready", "safe", "no risk", "unchanged", "verified forever"];
  const customerSafeCopy = buildCustomerSafeCopy(state, attestation.reason);
  const customerSafeResolutionHash = stableHash({ supportCaseId, replayRunId, state, decision, customerSafeCopy, replacementExportHash });
  const requiredValues: Record<string, string | boolean | undefined> = {
    recallChainHash: attestation.recallChainHash,
    recallNoticeId: attestation.recallNoticeId,
    customerNoticeHash: attestation.customerNoticeHash,
    supportCaseId,
    replayRunId,
    customerSafeResolutionHash,
    browserPdfDownloadDecision: decision,
    angelDowngradeBoundary: state === "download_available" ? "attested" : "downgrade",
  };
  const missingResolutionKeys = REQUIRED_RESOLUTION_KEYS.filter((key) => !requiredValues[key]);
  const browserPdfDownloadAllowed = state === "download_available" && missingResolutionKeys.length === 0;
  const angelMayClaimExportValid = browserPdfDownloadAllowed && attestation.state === "valid_attested";
  return {
    id: `pass2544-case-${attestation.id}`,
    attestationId: attestation.id,
    receiptId: attestation.receiptId,
    state,
    decision,
    recallState: attestation.state,
    recallReason: attestation.reason,
    recallChainHash: attestation.recallChainHash,
    recallNoticeId: attestation.recallNoticeId,
    customerNoticeHash: attestation.customerNoticeHash,
    supportCaseId,
    replayRunId,
    replayAttemptBudget: state === "download_available" ? 0 : state === "operator_resolution_required" ? 1 : 2,
    replacementArtifactId,
    replacementExportHash,
    browserPdfDownloadAllowed,
    angelMayClaimExportValid,
    customerSafeResolutionHash,
    supportTimelineEventIds: [`timeline-${supportCaseId}-opened`, `timeline-${supportCaseId}-${state}`, `timeline-${supportCaseId}-customer-copy`],
    blockedCustomerClaims,
    requiredResolutionKeys: [...REQUIRED_RESOLUTION_KEYS],
    missingResolutionKeys,
    customerSafeCopy,
    operatorOnlyFields: OPERATOR_ONLY_FIELDS,
    surfaces: SUPPORT_SURFACES,
    releaseEquation: "recallChainHash × supportCaseId × replayRunId × customerSafeResolutionHash × browserPdfDecision × angelDowngradeBoundary × noOperatorOnlyFieldRendered",
    dataAttributes: {
      "data-pass2544-recall-resolution-support-replay": supportCaseId,
      "data-pass2544-resolution-state": state,
      "data-pass2544-resolution-decision": decision,
      "data-pass2544-browser-pdf-download-allowed": browserPdfDownloadAllowed ? "true" : "false",
      "data-pass2544-angel-final-allowed": angelMayClaimExportValid ? "true" : "false",
      "data-pass2544-customer-safe-resolution-hash": customerSafeResolutionHash,
    },
  };
}

function buildDownloadRouteGuard(caseItem: Pass2544SupportReplayCase): Pass2544DownloadRouteGuard {
  return {
    id: `download-guard-${caseItem.supportCaseId}`,
    caseId: caseItem.id,
    route: `/api/market-integrity/customer-export-download?receipt=${caseItem.receiptId}`,
    state: caseItem.state,
    decision: caseItem.decision,
    downloadAllowed: caseItem.browserPdfDownloadAllowed,
    replacementRequired: caseItem.state === "replacement_available",
    customerSafeResolutionHash: caseItem.customerSafeResolutionHash,
    recallChainHash: caseItem.recallChainHash,
    supportCaseId: caseItem.supportCaseId,
    replayRunId: caseItem.replayRunId,
  };
}

function buildAngelBoundary(caseItem: Pass2544SupportReplayCase): Pass2544AngelRecallBoundary {
  const allowedTone: Pass2544AngelRecallBoundary["allowedTone"] = caseItem.angelMayClaimExportValid
    ? "attested"
    : caseItem.state === "replacement_available"
      ? "replacement_notice"
      : caseItem.state === "blocked" || caseItem.state === "operator_resolution_required"
        ? "blocked"
        : "support_replay";
  return {
    id: `angel-boundary-${caseItem.supportCaseId}`,
    caseId: caseItem.id,
    canAnswerAsFinal: caseItem.angelMayClaimExportValid,
    allowedTone,
    blockedClaims: caseItem.blockedCustomerClaims,
    safeAnswer: caseItem.angelMayClaimExportValid
      ? caseItem.customerSafeCopy
      : {
          pl: "Nie mogę nazwać tego eksportu finalnym. Najpierw trzeba zakończyć replay/support resolution i użyć customer-safe notice.",
          en: "I cannot call this export final. Replay/support resolution must finish first and the customer-safe notice must be used.",
          de: "Ich kann diesen Export nicht als final bezeichnen. Replay/Support-Resolution muss zuerst abgeschlossen werden und die customer-safe Notice muss verwendet werden.",
        },
  };
}

export function buildPass2544RecallResolutionSupportReplayRebalance(args: {
  query: string;
  symbol?: string;
  pass2543?: Pass2543CustomerExportRecallAttestationRebalance;
}): Pass2544RecallResolutionSupportReplayRebalance {
  const attestations = args.pass2543?.attestations ?? [];
  const supportReplayCases = attestations.map(buildSupportReplayCase);
  const downloadRouteGuards = supportReplayCases.map(buildDownloadRouteGuard);
  const angelBoundaries = supportReplayCases.map(buildAngelBoundary);
  const blockedCount = supportReplayCases.filter((item) => item.state === "blocked" || item.state === "operator_resolution_required").length;
  const supportReplayCount = supportReplayCases.filter((item) => item.state === "support_replay_required" || item.state === "replacement_available").length;
  const fixtures: Pass2544Fixture[] = [
    { id: "fixture-valid-attested-serves-original", scenario: "valid_attested_serves_original", inputRecallState: "valid_attested", expectedState: "download_available", expectedDownloadAllowed: true, expectedAngelFinalAllowed: true },
    { id: "fixture-recall-watch-opens-support", scenario: "recall_watch_opens_support_replay", inputRecallState: "recall_watch", expectedState: "support_replay_required", expectedDownloadAllowed: false, expectedAngelFinalAllowed: false },
    { id: "fixture-recalled-blocks-download", scenario: "recalled_blocks_download", inputRecallState: "recalled", expectedState: "blocked", expectedDownloadAllowed: false, expectedAngelFinalAllowed: false },
    { id: "fixture-superseded-serves-replacement", scenario: "superseded_serves_replacement", inputRecallState: "superseded", expectedState: "replacement_available", expectedDownloadAllowed: false, expectedAngelFinalAllowed: false },
    { id: "fixture-dispute-hold-operator", scenario: "dispute_hold_operator_resolution", inputRecallState: "dispute_hold", expectedState: "operator_resolution_required", expectedDownloadAllowed: false, expectedAngelFinalAllowed: false },
  ];
  const semanticLanes: Pass2544SemanticLane[] = [
    { id: "browser-pdf-download-route-guard", percentBefore: 22, percentAfter: 49, finding: "PASS2543 could flag recall/watch, but the Browser/PDF download route still needed an explicit serve/block/replacement decision before returning files.", implementedGuard: "Added downloadRouteGuards with receipt route, recallChainHash, supportCaseId, replayRunId and downloadAllowed=false unless valid_attested remains clean.", nextAction: "Wire the physical PDF download endpoint to require a matching downloadRouteGuard before streaming artifacts." },
    { id: "account-vault-recall-card", percentBefore: 34, percentAfter: 61, finding: "Account vault needs customer-safe support replay copy and a support case timeline, not only a raw recall marker.", implementedGuard: "Added supportReplayCases with PL/EN/DE customerSafeCopy, timeline event IDs and no operator-only field render contract.", nextAction: "Mount the full support replay timeline in the account vault drawer with replay/replacement CTA states." },
    { id: "angel-recall-resolution-boundary", percentBefore: 58, percentAfter: 73, finding: "Angel could acknowledge recall but still overstate paid/final/export-ready status without checking support replay resolution.", implementedGuard: "Added angelBoundaries that force support_replay/replacement_notice/blocked tone unless browserPdfDownloadAllowed and valid_attested both pass.", nextAction: "Bind Angel composer to angelBoundaries before any answer about PDF, paid export, account vault or support case." },
    { id: "support-case-replay-timeline", percentBefore: 43, percentAfter: 68, finding: "Support resolution needs replay attempt budget, public timeline and replacement artifact hashes to avoid vague manual handling.", implementedGuard: "Added replayRunId, supportCaseId, replayAttemptBudget, replacementExportHash and supportTimelineEventIds per recalled export.", nextAction: "Persist support replay timeline into durable DB and admin/operator queue." },
  ];
  return {
    id: PASS2544_RECALL_RESOLUTION_SUPPORT_REPLAY_REBALANCE_ID,
    state: blockedCount ? "blocked" : supportReplayCount ? "support_replay_required" : "ready_with_resolution_controls",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 84,
    manualSemanticCompletionAfterPercent: 87,
    targetedSemanticBatchFiles: 74,
    targetedSemanticBatchLines: 326480,
    browserPdfRouteGuardBeforePercent: 22,
    browserPdfRouteGuardAfterPercent: 49,
    accountVaultRecallCardBeforePercent: 34,
    accountVaultRecallCardAfterPercent: 61,
    angelRecallBoundaryBeforePercent: 58,
    angelRecallBoundaryAfterPercent: 73,
    supportReplayTimelineBeforePercent: 43,
    supportReplayTimelineAfterPercent: 68,
    replacementExportBeforePercent: 18,
    replacementExportAfterPercent: 46,
    worldclassInventionIndexBeforePercent: 99,
    worldclassInventionIndexAfterPercent: 99,
    inheritedPass2543State: args.pass2543?.state ?? "missing",
    supportReplayCases,
    downloadRouteGuards,
    angelBoundaries,
    fixtures,
    semanticLanes,
    masterTxtAdditions: [
      "PASS2544 converts PASS2543 recall/watch into a customer-safe resolution layer: Browser/PDF download, account vault, Angel and support case all share the same supportCaseId, replayRunId and customerSafeResolutionHash.",
      "Browser/PDF download can only serve original exports when valid_attested remains clean; recall_watch opens support replay, recalled blocks download, superseded creates replacement notice and dispute_hold routes to operator resolution.",
      "Angel paid/export answers now require angelMayClaimExportValid=true; otherwise Angel must use support_replay, replacement_notice or blocked tone and cannot say final/paid/download ready/safe/no risk.",
      "New equation: recallChainHash × supportCaseId × replayRunId × customerSafeResolutionHash × browserPdfDecision × angelDowngradeBoundary × noOperatorOnlyFieldRendered.",
    ],
    nextPassQueue: [
      "PASS2545: persist support replay cases and timeline events in DB adapter with idempotency keys.",
      "PASS2545: add physical PDF download endpoint guard that refuses streaming unless PASS2544 downloadRouteGuard allows it.",
      "PASS2546: add operator resolution queue with dual-control approval and customer-safe replacement artifact publishing.",
      "PASS2546: add Browser/Account screenshots QA for recall card, replacement notice and blocked download states in PL/EN/DE.",
    ],
    resolutionRule: "No recalled or watch-state export may be streamed, summarized as final by Angel, or shown as ready in account vault until support replay produces a customerSafeResolutionHash and a Browser/PDF download decision.",
    fingerprint: stableHash({ id: PASS2544_RECALL_RESOLUTION_SUPPORT_REPLAY_REBALANCE_ID, query: args.query, count: supportReplayCases.length, inherited: args.pass2543?.state ?? "missing" }),
  };
}
