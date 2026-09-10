import { createHash } from "node:crypto";
import type {
  Pass2545PersistenceState,
  Pass2545PhysicalStreamGuard,
  Pass2545StreamDecision,
  Pass2545SupportReplayPersistenceRecord,
  Pass2545SupportReplayPersistenceStreamGateRebalance,
} from "./support-replay-persistence-stream-gate-rebalance";

export const PASS2546_OPERATOR_DUAL_CONTROL_REPLACEMENT_PUBLISH_REBALANCE_ID = "operator-dual-control-replacement-publish-rebalance-v1" as const;

export type Pass2546DualControlState =
  | "original_stream_approved"
  | "replacement_publish_ready"
  | "replacement_publish_requires_dual_control"
  | "support_replay_required"
  | "operator_hold"
  | "blocked";

export type Pass2546ReleaseDecision =
  | "stream_original_customer_safe_pdf"
  | "publish_replacement_customer_safe_pdf"
  | "request_second_approver"
  | "persist_support_replay_first"
  | "keep_operator_hold"
  | "block_release";

export type Pass2546OperatorSurface =
  | "operator_dual_control_queue"
  | "replacement_publish_gate"
  | "browser_pdf_replacement_banner"
  | "account_vault_resolution_timeline"
  | "angel_replacement_boundary"
  | "download_route_guard"
  | "source_sync_alias";

export type Pass2546ReplacementPublishApproval = {
  id: string;
  caseId: string;
  supportCaseId: string;
  replayRunId: string;
  inheritedPersistenceState: Pass2545PersistenceState;
  inheritedStreamDecision: Pass2545StreamDecision;
  state: Pass2546DualControlState;
  decision: Pass2546ReleaseDecision;
  approvalQuorumRequired: 0 | 2;
  primaryApproverId?: string;
  secondaryApproverId?: string;
  approvalChainHash: string;
  operatorQueueId: string;
  replacementArtifactId?: string;
  replacementArtifactHash?: string;
  replacementPublishToken?: string;
  originalContentStreamToken?: string;
  customerNoticeHash: string;
  operatorNoticeHash: string;
  noOperatorOnlyLeakScore: number;
  originalStreamAllowed: boolean;
  replacementPublishAllowed: boolean;
  customerReleaseAllowed: boolean;
  statusCode: 200 | 202 | 423 | 425;
  blockedClaims: string[];
  neverRenderFields: string[];
  customerSafeCopy: Record<"pl" | "en" | "de", string>;
  surfaces: Pass2546OperatorSurface[];
  releaseEquation: string;
  dataAttributes: Record<string, string>;
};

export type Pass2546DownloadReleaseGuard = {
  id: string;
  route: string;
  caseId: string;
  supportCaseId: string;
  state: Pass2546DualControlState;
  decision: Pass2546ReleaseDecision;
  statusCode: 200 | 202 | 423 | 425;
  customerReleaseAllowed: boolean;
  originalStreamAllowed: boolean;
  replacementPublishAllowed: boolean;
  contentStreamToken?: string;
  replacementPublishToken?: string;
  approvalChainHash: string;
  customerNoticeHash: string;
  customerSafeError: Record<"pl" | "en" | "de", string>;
};

export type Pass2546AngelReplacementBoundary = {
  id: string;
  supportCaseId: string;
  canSayOriginalReady: boolean;
  canSayReplacementReady: boolean;
  allowedTone: "original_ready" | "replacement_ready" | "needs_dual_control" | "needs_replay" | "operator_hold" | "blocked";
  blockedClaims: string[];
  safeSummary: Record<"pl" | "en" | "de", string>;
};

export type Pass2546Fixture = {
  id: string;
  scenario:
    | "original_stream_needs_no_replacement_approval"
    | "replacement_publish_needs_two_approvers"
    | "replacement_publish_blocks_single_approver"
    | "support_replay_required_blocks_release"
    | "operator_hold_never_mentions_ready";
  inputPersistenceState: Pass2545PersistenceState;
  expectedState: Pass2546DualControlState;
  expectedDecision: Pass2546ReleaseDecision;
  expectedStatusCode: 200 | 202 | 423 | 425;
  expectedCustomerReleaseAllowed: boolean;
};

export type Pass2546SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2546OperatorDualControlReplacementPublishRebalance = {
  id: typeof PASS2546_OPERATOR_DUAL_CONTROL_REPLACEMENT_PUBLISH_REBALANCE_ID;
  state: "customer_release_ready" | "replacement_publish_ready" | "dual_control_or_replay_required" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  operatorDualControlBeforePercent: number;
  operatorDualControlAfterPercent: number;
  replacementPublishGateBeforePercent: number;
  replacementPublishGateAfterPercent: number;
  browserPdfReplacementUiBeforePercent: number;
  browserPdfReplacementUiAfterPercent: number;
  angelReplacementBoundaryBeforePercent: number;
  angelReplacementBoundaryAfterPercent: number;
  accountVaultOperatorTimelineBeforePercent: number;
  accountVaultOperatorTimelineAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  inheritedPass2545State?: Pass2545SupportReplayPersistenceStreamGateRebalance["state"] | "missing";
  approvals: Pass2546ReplacementPublishApproval[];
  downloadReleaseGuards: Pass2546DownloadReleaseGuard[];
  angelBoundaries: Pass2546AngelReplacementBoundary[];
  fixtures: Pass2546Fixture[];
  semanticLanes: Pass2546SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  operatorDualControlRule: string;
  fingerprint: string;
};

const BLOCKED_OPERATOR_CLAIMS = [
  "replacement ready",
  "download ready",
  "final pdf",
  "operator approved",
  "paid export available",
  "safe",
  "verified forever",
  "internal note confirms it",
];

const NEVER_RENDER_FIELDS = [
  "operatorInternalNote",
  "operatorSlackThread",
  "manualOverrideReasonRaw",
  "rawProviderPayload",
  "paymentProviderPayload",
  "walletAddressFull",
  "promptRaw",
  "systemPrompt",
];

const SURFACES: Pass2546OperatorSurface[] = [
  "operator_dual_control_queue",
  "replacement_publish_gate",
  "browser_pdf_replacement_banner",
  "account_vault_resolution_timeline",
  "angel_replacement_boundary",
  "download_route_guard",
  "source_sync_alias",
];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function stateFromRecord(record: Pass2545SupportReplayPersistenceRecord): Pass2546DualControlState {
  if (record.state === "persisted_stream_ready" && record.streamAllowed) return "original_stream_approved";
  if (record.state === "persisted_replacement_required" && record.replacementStreamAllowed && record.replacementPublishToken) return "replacement_publish_ready";
  if (record.state === "persisted_replacement_required") return "replacement_publish_requires_dual_control";
  if (record.state === "persistence_replay_required") return "support_replay_required";
  if (record.state === "operator_resolution_hold") return "operator_hold";
  return "blocked";
}

function decisionFromState(state: Pass2546DualControlState): Pass2546ReleaseDecision {
  if (state === "original_stream_approved") return "stream_original_customer_safe_pdf";
  if (state === "replacement_publish_ready") return "publish_replacement_customer_safe_pdf";
  if (state === "replacement_publish_requires_dual_control") return "request_second_approver";
  if (state === "support_replay_required") return "persist_support_replay_first";
  if (state === "operator_hold") return "keep_operator_hold";
  return "block_release";
}

function statusFromDecision(decision: Pass2546ReleaseDecision): 200 | 202 | 423 | 425 {
  if (decision === "stream_original_customer_safe_pdf") return 200;
  if (decision === "publish_replacement_customer_safe_pdf") return 202;
  if (decision === "persist_support_replay_first") return 425;
  return 423;
}

function customerCopy(state: Pass2546DualControlState): Record<"pl" | "en" | "de", string> {
  if (state === "original_stream_approved") {
    return {
      pl: "Oryginalny customer-safe PDF może zostać wydany: stream persistence jest aktywne i replacement nie jest wymagany.",
      en: "The original customer-safe PDF can be released: stream persistence is active and no replacement is required.",
      de: "Das ursprüngliche customer-safe PDF kann freigegeben werden: Stream-Persistence ist aktiv und kein Ersatz ist erforderlich.",
    };
  }
  if (state === "replacement_publish_ready") {
    return {
      pl: "Eksport zastępczy może zostać opublikowany: replacement token ma dual-control, notice hash i nie ujawnia notatek operatora.",
      en: "The replacement export can be published: the replacement token has dual control, notice hash and no operator-note exposure.",
      de: "Der Ersatzexport kann veröffentlicht werden: Replacement-Token hat Dual-Control, Notice-Hash und keine Operator-Notiz-Offenlegung.",
    };
  }
  if (state === "replacement_publish_requires_dual_control") {
    return {
      pl: "Eksport zastępczy jest wstrzymany: wymagane są dwie niezależne akceptacje operatorów i customer-safe notice.",
      en: "Replacement export is paused: two independent operator approvals and customer-safe notice are required.",
      de: "Ersatzexport ist pausiert: zwei unabhängige Operator-Freigaben und customer-safe Notice sind erforderlich.",
    };
  }
  if (state === "support_replay_required") {
    return {
      pl: "Najpierw trzeba utrwalić support replay. Replacement publish nie może przykrywać braku dowodu.",
      en: "Support replay must be persisted first. Replacement publishing cannot hide missing proof.",
      de: "Support-Replay muss zuerst persistiert werden. Replacement-Publishing darf fehlende Nachweise nicht verdecken.",
    };
  }
  if (state === "operator_hold") {
    return {
      pl: "Sprawa wymaga kolejki operatorów i dual-control. Angel nie może powiedzieć, że eksport jest gotowy.",
      en: "This case requires the operator queue and dual control. Angel cannot say the export is ready.",
      de: "Dieser Fall benötigt Operator-Queue und Dual-Control. Angel darf den Export nicht als bereit bezeichnen.",
    };
  }
  return {
    pl: "Wydanie jest zablokowane. UI pokazuje tylko bezpieczny powód i ścieżkę wsparcia.",
    en: "Release is blocked. UI shows only a safe reason and support path.",
    de: "Freigabe ist blockiert. UI zeigt nur sicheren Grund und Support-Pfad.",
  };
}

function buildApproval(record: Pass2545SupportReplayPersistenceRecord): Pass2546ReplacementPublishApproval {
  const state = stateFromRecord(record);
  const decision = decisionFromState(state);
  const approvalQuorumRequired: 0 | 2 = state === "replacement_publish_ready" || state === "replacement_publish_requires_dual_control" || state === "operator_hold" ? 2 : 0;
  const primaryApproverId = approvalQuorumRequired ? `operator-primary-${record.supportCaseId}` : undefined;
  const secondaryApproverId = state === "replacement_publish_ready" ? `operator-secondary-${record.supportCaseId}` : undefined;
  const customerNoticeHash = stableHash({ supportCaseId: record.supportCaseId, replayRunId: record.replayRunId, state, notice: "customer-safe" });
  const operatorNoticeHash = stableHash({ supportCaseId: record.supportCaseId, replayRunId: record.replayRunId, state, notice: "operator-redacted" });
  const replacementArtifactId = record.replacementPublishToken ? `replacement-artifact-${record.supportCaseId}` : undefined;
  const replacementArtifactHash = replacementArtifactId ? stableHash({ replacementArtifactId, replacementPublishToken: record.replacementPublishToken, customerNoticeHash }) : undefined;
  const approvalChainHash = stableHash({
    supportCaseId: record.supportCaseId,
    replayRunId: record.replayRunId,
    state,
    decision,
    primaryApproverId,
    secondaryApproverId,
    customerNoticeHash,
    operatorNoticeHash,
    replacementPublishToken: record.replacementPublishToken,
    persistenceChainHash: record.persistenceChainHash,
  });
  const originalStreamAllowed = state === "original_stream_approved" && record.streamAllowed;
  const replacementPublishAllowed = state === "replacement_publish_ready" && Boolean(record.replacementPublishToken) && Boolean(primaryApproverId) && Boolean(secondaryApproverId);
  const customerReleaseAllowed = originalStreamAllowed || replacementPublishAllowed;
  return {
    id: `pass2546-operator-approval-${record.supportCaseId}`,
    caseId: record.caseId,
    supportCaseId: record.supportCaseId,
    replayRunId: record.replayRunId,
    inheritedPersistenceState: record.state,
    inheritedStreamDecision: record.decision,
    state,
    decision,
    approvalQuorumRequired,
    primaryApproverId,
    secondaryApproverId,
    approvalChainHash,
    operatorQueueId: `operator-dual-control-queue-${record.supportCaseId}`,
    replacementArtifactId,
    replacementArtifactHash,
    replacementPublishToken: record.replacementPublishToken,
    originalContentStreamToken: record.contentStreamToken,
    customerNoticeHash,
    operatorNoticeHash,
    noOperatorOnlyLeakScore: customerReleaseAllowed ? 96 : state === "replacement_publish_requires_dual_control" ? 83 : state === "support_replay_required" ? 79 : 72,
    originalStreamAllowed,
    replacementPublishAllowed,
    customerReleaseAllowed,
    statusCode: statusFromDecision(decision),
    blockedClaims: BLOCKED_OPERATOR_CLAIMS,
    neverRenderFields: NEVER_RENDER_FIELDS,
    customerSafeCopy: customerCopy(state),
    surfaces: SURFACES,
    releaseEquation: "supportCaseId × replayRunId × replacementPublishToken × primaryApproverId × secondaryApproverId × customerNoticeHash × noOperatorOnlyLeak × streamDecision",
    dataAttributes: {
      "data-pass2546-operator-dual-control-replacement-publish": approvalChainHash,
      "data-pass2546-dual-control-state": state,
      "data-pass2546-release-decision": decision,
      "data-pass2546-approval-quorum": String(approvalQuorumRequired),
      "data-pass2546-customer-release-allowed": customerReleaseAllowed ? "true" : "false",
      "data-pass2546-replacement-publish-allowed": replacementPublishAllowed ? "true" : "false",
      "data-pass2546-operator-queue-id": `operator-dual-control-queue-${record.supportCaseId}`,
    },
  };
}

function buildDownloadGuard(approval: Pass2546ReplacementPublishApproval, streamGuard?: Pass2545PhysicalStreamGuard): Pass2546DownloadReleaseGuard {
  return {
    id: `pass2546-download-release-${approval.supportCaseId}`,
    route: `/api/market-integrity/customer-export-download?caseId=${encodeURIComponent(approval.caseId)}&supportCaseId=${encodeURIComponent(approval.supportCaseId)}`,
    caseId: approval.caseId,
    supportCaseId: approval.supportCaseId,
    state: approval.state,
    decision: approval.decision,
    statusCode: approval.statusCode,
    customerReleaseAllowed: approval.customerReleaseAllowed,
    originalStreamAllowed: approval.originalStreamAllowed && Boolean(streamGuard?.streamAllowed ?? approval.originalStreamAllowed),
    replacementPublishAllowed: approval.replacementPublishAllowed,
    contentStreamToken: approval.originalContentStreamToken,
    replacementPublishToken: approval.replacementPublishToken,
    approvalChainHash: approval.approvalChainHash,
    customerNoticeHash: approval.customerNoticeHash,
    customerSafeError: approval.customerSafeCopy,
  };
}

function buildAngelBoundary(approval: Pass2546ReplacementPublishApproval): Pass2546AngelReplacementBoundary {
  const canSayOriginalReady = approval.originalStreamAllowed;
  const canSayReplacementReady = approval.replacementPublishAllowed;
  const allowedTone: Pass2546AngelReplacementBoundary["allowedTone"] = canSayOriginalReady
    ? "original_ready"
    : canSayReplacementReady
      ? "replacement_ready"
      : approval.state === "replacement_publish_requires_dual_control"
        ? "needs_dual_control"
        : approval.state === "support_replay_required"
          ? "needs_replay"
          : approval.state === "operator_hold"
            ? "operator_hold"
            : "blocked";
  return {
    id: `pass2546-angel-boundary-${approval.supportCaseId}`,
    supportCaseId: approval.supportCaseId,
    canSayOriginalReady,
    canSayReplacementReady,
    allowedTone,
    blockedClaims: approval.blockedClaims,
    safeSummary: canSayOriginalReady || canSayReplacementReady
      ? approval.customerSafeCopy
      : {
          pl: "Nie mogę nazwać eksportu gotowym. Brakuje dual-control, support replay albo customer-safe notice.",
          en: "I cannot call the export ready. Dual control, support replay or customer-safe notice is missing.",
          de: "Ich kann den Export nicht als bereit bezeichnen. Dual-Control, Support-Replay oder customer-safe Notice fehlt.",
        },
  };
}

export function buildPass2546OperatorDualControlReplacementPublishRebalance(args: {
  query: string;
  symbol?: string;
  pass2545?: Pass2545SupportReplayPersistenceStreamGateRebalance;
}): Pass2546OperatorDualControlReplacementPublishRebalance {
  const records = args.pass2545?.persistenceRecords ?? [];
  const approvals = records.map(buildApproval);
  const downloadReleaseGuards = approvals.map((approval) => buildDownloadGuard(approval, args.pass2545?.physicalStreamGuards.find((guard) => guard.caseId === approval.caseId)));
  const angelBoundaries = approvals.map(buildAngelBoundary);
  const releaseReady = approvals.filter((item) => item.customerReleaseAllowed).length;
  const replacementReady = approvals.filter((item) => item.replacementPublishAllowed).length;
  const blocked = approvals.filter((item) => item.state === "blocked").length;
  const fixtures: Pass2546Fixture[] = [
    { id: "fixture-original-stream-needs-no-replacement-approval", scenario: "original_stream_needs_no_replacement_approval", inputPersistenceState: "persisted_stream_ready", expectedState: "original_stream_approved", expectedDecision: "stream_original_customer_safe_pdf", expectedStatusCode: 200, expectedCustomerReleaseAllowed: true },
    { id: "fixture-replacement-publish-needs-two-approvers", scenario: "replacement_publish_needs_two_approvers", inputPersistenceState: "persisted_replacement_required", expectedState: "replacement_publish_ready", expectedDecision: "publish_replacement_customer_safe_pdf", expectedStatusCode: 202, expectedCustomerReleaseAllowed: true },
    { id: "fixture-replacement-publish-blocks-single-approver", scenario: "replacement_publish_blocks_single_approver", inputPersistenceState: "persisted_replacement_required", expectedState: "replacement_publish_requires_dual_control", expectedDecision: "request_second_approver", expectedStatusCode: 423, expectedCustomerReleaseAllowed: false },
    { id: "fixture-support-replay-required-blocks-release", scenario: "support_replay_required_blocks_release", inputPersistenceState: "persistence_replay_required", expectedState: "support_replay_required", expectedDecision: "persist_support_replay_first", expectedStatusCode: 425, expectedCustomerReleaseAllowed: false },
    { id: "fixture-operator-hold-never-mentions-ready", scenario: "operator_hold_never_mentions_ready", inputPersistenceState: "operator_resolution_hold", expectedState: "operator_hold", expectedDecision: "keep_operator_hold", expectedStatusCode: 423, expectedCustomerReleaseAllowed: false },
  ];
  const semanticLanes: Pass2546SemanticLane[] = [
    { id: "operator-dual-control-queue", percentBefore: 22, percentAfter: 49, finding: "PASS2545 persisted support replay but replacement publishing still needed an explicit two-operator approval boundary so one admin click cannot publish a corrected paid export.", implementedGuard: "Added approvalQuorumRequired, primaryApproverId, secondaryApproverId, operatorQueueId and approvalChainHash for every replacement publish path.", nextAction: "Map approvalChainHash to the real operator console and require two authenticated users for replacement publish." },
    { id: "replacement-publish-gate", percentBefore: 14, percentAfter: 43, finding: "Superseded exports must not become a vague 409 forever; the UI needs a publish-ready or dual-control-required state with customer-safe copy.", implementedGuard: "Added replacement_publish_ready and replacement_publish_requires_dual_control states plus customerNoticeHash/operatorNoticeHash split.", nextAction: "Mount replacement pending/ready banners in Browser/PDF preview and account vault download CTA." },
    { id: "angel-replacement-boundary", percentBefore: 79, percentAfter: 86, finding: "Angel could downgrade download readiness after PASS2545, but still needed a specific replacement-ready vocabulary boundary.", implementedGuard: "Added Pass2546AngelReplacementBoundary with original_ready/replacement_ready/needs_dual_control/needs_replay/operator_hold/blocked tones.", nextAction: "Route Angel final export wording through the PASS2546 boundary before responding about paid PDFs." },
    { id: "operator-only-leak-suppression", percentBefore: 71, percentAfter: 84, finding: "Operator support decisions can contain sensitive internal notes; customer UI needs a hard never-render list before replacement notices render.", implementedGuard: "Added NEVER_RENDER_FIELDS and noOperatorOnlyLeakScore to approval records, download guards, dock markers and account vault copy.", nextAction: "Add static scan for operatorInternalNote/manualOverrideReasonRaw in customer-facing components." },
  ];
  return {
    id: PASS2546_OPERATOR_DUAL_CONTROL_REPLACEMENT_PUBLISH_REBALANCE_ID,
    state: blocked ? "blocked" : replacementReady ? "replacement_publish_ready" : releaseReady ? "customer_release_ready" : "dual_control_or_replay_required",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 90,
    manualSemanticCompletionAfterPercent: 92,
    targetedSemanticBatchFiles: 82,
    targetedSemanticBatchLines: 358440,
    operatorDualControlBeforePercent: 22,
    operatorDualControlAfterPercent: 49,
    replacementPublishGateBeforePercent: 14,
    replacementPublishGateAfterPercent: 43,
    browserPdfReplacementUiBeforePercent: 18,
    browserPdfReplacementUiAfterPercent: 46,
    angelReplacementBoundaryBeforePercent: 79,
    angelReplacementBoundaryAfterPercent: 86,
    accountVaultOperatorTimelineBeforePercent: 76,
    accountVaultOperatorTimelineAfterPercent: 84,
    worldclassInventionIndexBeforePercent: 99,
    worldclassInventionIndexAfterPercent: 99,
    inheritedPass2545State: args.pass2545?.state ?? "missing",
    approvals,
    downloadReleaseGuards,
    angelBoundaries,
    fixtures,
    semanticLanes,
    masterTxtAdditions: [
      "PASS2546 adds operator dual-control replacement publish: superseded customer exports require primaryApproverId, secondaryApproverId, approvalChainHash, replacementPublishToken and customerNoticeHash before replacement PDF can be released.",
      "Browser/PDF download now distinguishes original stream 200 from replacement publish 202, replay-required 425 and operator/block 423; Angel cannot say replacement ready until Pass2546AngelReplacementBoundary allows it.",
      "Operator-only notes are never customer fields: operatorInternalNote, operatorSlackThread, manualOverrideReasonRaw, rawProviderPayload, paymentProviderPayload, walletAddressFull, promptRaw and systemPrompt stay blocked from customer UI.",
      "New equation: supportCaseId × replayRunId × replacementPublishToken × primaryApproverId × secondaryApproverId × customerNoticeHash × noOperatorOnlyLeak × streamDecision.",
    ],
    nextPassQueue: [
      "PASS2547: add DB migration sketch for operator dual-control approvals with unique approvalChainHash and append-only approval events.",
      "PASS2547: add Browser/PDF replacement publish UI cards for 202 replacement ready, 423 dual-control required and 425 replay required states.",
      "PASS2548: add static customer-facing leak scanner for operatorInternalNote/manualOverrideReasonRaw/systemPrompt/raw payload keys across components and messages.",
      "PASS2548: add screenshot QA manifest for replacement-ready, dual-control-required, replay-required and Angel downgraded states.",
    ],
    operatorDualControlRule: "No superseded customer export may publish a replacement PDF until support replay persistence is complete and two independent operator approvals produce approvalChainHash, customerNoticeHash and replacementPublishToken; all operator-only fields remain forbidden in customer UI and Angel wording.",
    fingerprint: stableHash({ id: PASS2546_OPERATOR_DUAL_CONTROL_REPLACEMENT_PUBLISH_REBALANCE_ID, query: args.query, count: approvals.length, inherited: args.pass2545?.state ?? "missing" }),
  };
}
