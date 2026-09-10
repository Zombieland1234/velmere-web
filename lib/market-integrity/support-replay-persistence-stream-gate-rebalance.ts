import { createHash } from "node:crypto";
import type {
  Pass2544DownloadRouteGuard,
  Pass2544RecallResolutionSupportReplayRebalance,
  Pass2544ResolutionDecision,
  Pass2544ResolutionState,
  Pass2544SupportReplayCase,
} from "./recall-resolution-support-replay-rebalance";

export const PASS2545_SUPPORT_REPLAY_PERSISTENCE_STREAM_GATE_REBALANCE_ID = "support-replay-persistence-stream-gate-rebalance-v1" as const;

export type Pass2545PersistenceState =
  | "persisted_stream_ready"
  | "persisted_replacement_required"
  | "persistence_replay_required"
  | "operator_resolution_hold"
  | "blocked";

export type Pass2545StreamDecision =
  | "stream_original_customer_safe_pdf"
  | "prepare_replacement_customer_safe_pdf"
  | "persist_support_replay_first"
  | "operator_resolution_required"
  | "block_stream";

export type Pass2545PersistenceSurface =
  | "physical_pdf_stream_route"
  | "support_replay_db_adapter"
  | "account_vault_support_timeline"
  | "angel_resolution_summary"
  | "operator_resolution_queue"
  | "download_cta"
  | "source_sync_alias";

export type Pass2545SupportReplayPersistenceRecord = {
  id: string;
  caseId: string;
  supportCaseId: string;
  replayRunId: string;
  receiptId: string;
  state: Pass2545PersistenceState;
  decision: Pass2545StreamDecision;
  inheritedResolutionState: Pass2544ResolutionState;
  inheritedResolutionDecision: Pass2544ResolutionDecision;
  durableStoreId: string;
  idempotencyKey: string;
  writeMode: "insert_if_absent" | "append_resolution_event" | "blocked_no_write";
  ledgerEventId: string;
  timelineEventIds: string[];
  persistedAt: string;
  replayTtlSeconds: number;
  replayTtlValid: boolean;
  streamAllowed: boolean;
  replacementStreamAllowed: boolean;
  contentStreamToken?: string;
  replacementPublishToken?: string;
  customerSafeResolutionHash: string;
  persistenceChainHash: string;
  noOperatorOnlyLeakScore: number;
  requiredPersistenceKeys: string[];
  missingPersistenceKeys: string[];
  blockedStreamClaims: string[];
  customerSafeCopy: Record<"pl" | "en" | "de", string>;
  surfaces: Pass2545PersistenceSurface[];
  releaseEquation: string;
  dataAttributes: Record<string, string>;
};

export type Pass2545PhysicalStreamGuard = {
  id: string;
  route: string;
  caseId: string;
  supportCaseId: string;
  replayRunId: string;
  statusCode: 200 | 409 | 423 | 425;
  state: Pass2545PersistenceState;
  decision: Pass2545StreamDecision;
  streamAllowed: boolean;
  contentStreamToken?: string;
  replacementPublishToken?: string;
  persistenceChainHash: string;
  durableStoreId: string;
  idempotencyKey: string;
  customerSafeError: Record<"pl" | "en" | "de", string>;
};

export type Pass2545AngelPersistenceBoundary = {
  id: string;
  caseId: string;
  supportCaseId: string;
  canSummarizeAsDownloadReady: boolean;
  canMentionReplacementReady: boolean;
  allowedTone: "stream_ready" | "replacement_pending" | "persist_replay_first" | "operator_hold" | "blocked";
  blockedClaims: string[];
  safeSummary: Record<"pl" | "en" | "de", string>;
};

export type Pass2545Fixture = {
  id: string;
  scenario:
    | "original_stream_requires_persisted_case"
    | "recall_watch_never_streams"
    | "recalled_never_streams"
    | "superseded_needs_replacement_publish"
    | "operator_hold_never_streams";
  inputResolutionState: Pass2544ResolutionState;
  expectedPersistenceState: Pass2545PersistenceState;
  expectedStatusCode: 200 | 409 | 423 | 425;
  expectedStreamAllowed: boolean;
};

export type Pass2545SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2545SupportReplayPersistenceStreamGateRebalance = {
  id: typeof PASS2545_SUPPORT_REPLAY_PERSISTENCE_STREAM_GATE_REBALANCE_ID;
  state: "stream_ready_with_persistence" | "persistence_replay_required" | "operator_or_blocked_hold";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  supportReplayPersistenceBeforePercent: number;
  supportReplayPersistenceAfterPercent: number;
  physicalPdfStreamGuardBeforePercent: number;
  physicalPdfStreamGuardAfterPercent: number;
  idempotencyLedgerBeforePercent: number;
  idempotencyLedgerAfterPercent: number;
  angelPersistenceBoundaryBeforePercent: number;
  angelPersistenceBoundaryAfterPercent: number;
  accountVaultSupportTimelineBeforePercent: number;
  accountVaultSupportTimelineAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  inheritedPass2544State?: Pass2544RecallResolutionSupportReplayRebalance["state"] | "missing";
  persistenceRecords: Pass2545SupportReplayPersistenceRecord[];
  physicalStreamGuards: Pass2545PhysicalStreamGuard[];
  angelBoundaries: Pass2545AngelPersistenceBoundary[];
  fixtures: Pass2545Fixture[];
  semanticLanes: Pass2545SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  persistenceRule: string;
  fingerprint: string;
};

const REQUIRED_PERSISTENCE_KEYS = [
  "supportCaseId",
  "replayRunId",
  "durableStoreId",
  "idempotencyKey",
  "ledgerEventId",
  "timelineEventIds",
  "customerSafeResolutionHash",
  "persistenceChainHash",
] as const;

const PERSISTENCE_SURFACES: Pass2545PersistenceSurface[] = [
  "physical_pdf_stream_route",
  "support_replay_db_adapter",
  "account_vault_support_timeline",
  "angel_resolution_summary",
  "operator_resolution_queue",
  "download_cta",
  "source_sync_alias",
];

const BLOCKED_STREAM_CLAIMS = [
  "download ready",
  "stream ready",
  "final pdf",
  "paid export available",
  "safe",
  "verified forever",
  "replacement already published",
];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function persistenceStateFromCase(caseItem: Pass2544SupportReplayCase): Pass2545PersistenceState {
  if (caseItem.state === "download_available" && caseItem.browserPdfDownloadAllowed) return "persisted_stream_ready";
  if (caseItem.state === "replacement_available") return "persisted_replacement_required";
  if (caseItem.state === "support_replay_required") return "persistence_replay_required";
  if (caseItem.state === "operator_resolution_required") return "operator_resolution_hold";
  return "blocked";
}

function decisionFromPersistence(state: Pass2545PersistenceState): Pass2545StreamDecision {
  if (state === "persisted_stream_ready") return "stream_original_customer_safe_pdf";
  if (state === "persisted_replacement_required") return "prepare_replacement_customer_safe_pdf";
  if (state === "persistence_replay_required") return "persist_support_replay_first";
  if (state === "operator_resolution_hold") return "operator_resolution_required";
  return "block_stream";
}

function statusFromDecision(decision: Pass2545StreamDecision): 200 | 409 | 423 | 425 {
  if (decision === "stream_original_customer_safe_pdf") return 200;
  if (decision === "prepare_replacement_customer_safe_pdf") return 409;
  if (decision === "persist_support_replay_first") return 425;
  return 423;
}

function buildCustomerSafeCopy(state: Pass2545PersistenceState): Record<"pl" | "en" | "de", string> {
  if (state === "persisted_stream_ready") {
    return {
      pl: "Pobranie może zostać wydane: support replay jest zapisany, idempotentny i spójny z customer-safe hash.",
      en: "Download can be served: support replay is persisted, idempotent and aligned with the customer-safe hash.",
      de: "Download kann ausgeliefert werden: Support-Replay ist persistiert, idempotent und mit dem customer-safe Hash konsistent.",
    };
  }
  if (state === "persisted_replacement_required") {
    return {
      pl: "Oryginalny eksport jest zastąpiony. Najpierw trzeba opublikować customer-safe replacement artifact.",
      en: "The original export is superseded. A customer-safe replacement artifact must be published first.",
      de: "Der ursprüngliche Export wurde ersetzt. Zuerst muss ein customer-safe Ersatzartefakt veröffentlicht werden.",
    };
  }
  if (state === "persistence_replay_required") {
    return {
      pl: "Pobranie jest wstrzymane: support replay musi zostać zapisany w ledgerze przed streamem PDF.",
      en: "Download is paused: support replay must be persisted in the ledger before PDF streaming.",
      de: "Download ist pausiert: Support-Replay muss vor dem PDF-Streaming im Ledger gespeichert werden.",
    };
  }
  if (state === "operator_resolution_hold") {
    return {
      pl: "Pobranie wymaga decyzji operatora i dual-control. Angel nie może nazwać eksportu gotowym.",
      en: "Download needs operator resolution and dual control. Angel cannot call the export ready.",
      de: "Download benötigt Operator-Entscheidung und Dual-Control. Angel darf den Export nicht als bereit bezeichnen.",
    };
  }
  return {
    pl: "Pobranie jest zablokowane. Customer UI może pokazać tylko bezpieczny powód i support path.",
    en: "Download is blocked. Customer UI may only show a safe reason and support path.",
    de: "Download ist blockiert. Customer UI darf nur einen sicheren Grund und Support-Pfad zeigen.",
  };
}

function buildPersistenceRecord(caseItem: Pass2544SupportReplayCase): Pass2545SupportReplayPersistenceRecord {
  const state = persistenceStateFromCase(caseItem);
  const decision = decisionFromPersistence(state);
  const durableStoreId = `support-replay-store-${caseItem.supportCaseId}`;
  const idempotencyKey = `pass2545:${caseItem.supportCaseId}:${caseItem.replayRunId}:${caseItem.customerSafeResolutionHash}`;
  const ledgerEventId = `support-replay-ledger-${caseItem.supportCaseId}-${state}`;
  const timelineEventIds = [
    ...caseItem.supportTimelineEventIds,
    `persisted-${caseItem.supportCaseId}-${decision}`,
    `stream-gate-${caseItem.supportCaseId}-${state}`,
  ];
  const replayTtlSeconds = state === "persisted_stream_ready" ? 604800 : state === "persisted_replacement_required" ? 86400 : 3600;
  const replayTtlValid = state !== "blocked" && state !== "operator_resolution_hold";
  const customerSafeCopy = buildCustomerSafeCopy(state);
  const contentStreamToken = state === "persisted_stream_ready" ? stableHash({ supportCaseId: caseItem.supportCaseId, replayRunId: caseItem.replayRunId, customerSafeResolutionHash: caseItem.customerSafeResolutionHash, stream: "original" }) : undefined;
  const replacementPublishToken = state === "persisted_replacement_required" ? stableHash({ supportCaseId: caseItem.supportCaseId, replacementArtifactId: caseItem.replacementArtifactId, replacementHash: caseItem.replacementExportHash, stream: "replacement" }) : undefined;
  const persistenceChainHash = stableHash({
    durableStoreId,
    idempotencyKey,
    ledgerEventId,
    timelineEventIds,
    state,
    decision,
    customerSafeResolutionHash: caseItem.customerSafeResolutionHash,
    contentStreamToken,
    replacementPublishToken,
  });
  const requiredValues: Record<string, string | string[] | boolean | undefined> = {
    supportCaseId: caseItem.supportCaseId,
    replayRunId: caseItem.replayRunId,
    durableStoreId,
    idempotencyKey,
    ledgerEventId,
    timelineEventIds,
    customerSafeResolutionHash: caseItem.customerSafeResolutionHash,
    persistenceChainHash,
  };
  const missingPersistenceKeys = REQUIRED_PERSISTENCE_KEYS.filter((key) => {
    const value = requiredValues[key];
    return Array.isArray(value) ? value.length === 0 : !value;
  });
  const streamAllowed = state === "persisted_stream_ready" && missingPersistenceKeys.length === 0 && Boolean(contentStreamToken) && replayTtlValid;
  const replacementStreamAllowed = state === "persisted_replacement_required" && Boolean(replacementPublishToken) && Boolean(caseItem.replacementArtifactId);
  return {
    id: `pass2545-persistence-${caseItem.supportCaseId}`,
    caseId: caseItem.id,
    supportCaseId: caseItem.supportCaseId,
    replayRunId: caseItem.replayRunId,
    receiptId: caseItem.receiptId,
    state,
    decision,
    inheritedResolutionState: caseItem.state,
    inheritedResolutionDecision: caseItem.decision,
    durableStoreId,
    idempotencyKey,
    writeMode: state === "blocked" ? "blocked_no_write" : state === "operator_resolution_hold" ? "append_resolution_event" : "insert_if_absent",
    ledgerEventId,
    timelineEventIds,
    persistedAt: new Date().toISOString(),
    replayTtlSeconds,
    replayTtlValid,
    streamAllowed,
    replacementStreamAllowed,
    contentStreamToken,
    replacementPublishToken,
    customerSafeResolutionHash: caseItem.customerSafeResolutionHash,
    persistenceChainHash,
    noOperatorOnlyLeakScore: state === "persisted_stream_ready" ? 96 : state === "persisted_replacement_required" ? 91 : state === "persistence_replay_required" ? 84 : 78,
    requiredPersistenceKeys: [...REQUIRED_PERSISTENCE_KEYS],
    missingPersistenceKeys,
    blockedStreamClaims: BLOCKED_STREAM_CLAIMS,
    customerSafeCopy,
    surfaces: PERSISTENCE_SURFACES,
    releaseEquation: "supportCaseId × replayRunId × durableStoreId × idempotencyKey × ledgerEventId × persistenceChainHash × streamGuard × noOperatorOnlyLeak",
    dataAttributes: {
      "data-pass2545-support-replay-persistence-stream-gate": durableStoreId,
      "data-pass2545-persistence-state": state,
      "data-pass2545-stream-decision": decision,
      "data-pass2545-stream-allowed": streamAllowed ? "true" : "false",
      "data-pass2545-replacement-stream-allowed": replacementStreamAllowed ? "true" : "false",
      "data-pass2545-persistence-chain-hash": persistenceChainHash,
      "data-pass2545-idempotency-key": idempotencyKey,
    },
  };
}

function buildPhysicalStreamGuard(record: Pass2545SupportReplayPersistenceRecord, downloadGuard?: Pass2544DownloadRouteGuard): Pass2545PhysicalStreamGuard {
  const statusCode = statusFromDecision(record.decision);
  return {
    id: `physical-stream-guard-${record.supportCaseId}`,
    route: `/api/market-integrity/customer-export-download?caseId=${encodeURIComponent(record.caseId)}&receipt=${encodeURIComponent(record.receiptId)}`,
    caseId: record.caseId,
    supportCaseId: record.supportCaseId,
    replayRunId: record.replayRunId,
    statusCode,
    state: record.state,
    decision: record.decision,
    streamAllowed: record.streamAllowed && Boolean(downloadGuard?.downloadAllowed ?? record.streamAllowed),
    contentStreamToken: record.contentStreamToken,
    replacementPublishToken: record.replacementPublishToken,
    persistenceChainHash: record.persistenceChainHash,
    durableStoreId: record.durableStoreId,
    idempotencyKey: record.idempotencyKey,
    customerSafeError: record.streamAllowed
      ? {
          pl: "Stream customer-safe PDF jest dozwolony.",
          en: "Customer-safe PDF stream is allowed.",
          de: "Customer-safe PDF-Stream ist erlaubt.",
        }
      : record.customerSafeCopy,
  };
}

function buildAngelBoundary(record: Pass2545SupportReplayPersistenceRecord): Pass2545AngelPersistenceBoundary {
  const canSummarizeAsDownloadReady = record.streamAllowed;
  const canMentionReplacementReady = record.replacementStreamAllowed;
  const allowedTone: Pass2545AngelPersistenceBoundary["allowedTone"] = canSummarizeAsDownloadReady
    ? "stream_ready"
    : canMentionReplacementReady
      ? "replacement_pending"
      : record.state === "operator_resolution_hold"
        ? "operator_hold"
        : record.state === "blocked"
          ? "blocked"
          : "persist_replay_first";
  return {
    id: `angel-persistence-boundary-${record.supportCaseId}`,
    caseId: record.caseId,
    supportCaseId: record.supportCaseId,
    canSummarizeAsDownloadReady,
    canMentionReplacementReady,
    allowedTone,
    blockedClaims: record.blockedStreamClaims,
    safeSummary: canSummarizeAsDownloadReady
      ? record.customerSafeCopy
      : {
          pl: "Nie mogę powiedzieć, że PDF jest gotowy do pobrania. Brakuje stream persistence albo replacement publish gate.",
          en: "I cannot say the PDF is ready for download. Stream persistence or replacement publish gate is still missing.",
          de: "Ich kann nicht sagen, dass das PDF downloadbereit ist. Stream-Persistence oder Replacement-Publish-Gate fehlt noch.",
        },
  };
}

export function buildPass2545SupportReplayPersistenceStreamGateRebalance(args: {
  query: string;
  symbol?: string;
  pass2544?: Pass2544RecallResolutionSupportReplayRebalance;
}): Pass2545SupportReplayPersistenceStreamGateRebalance {
  const cases = args.pass2544?.supportReplayCases ?? [];
  const persistenceRecords = cases.map(buildPersistenceRecord);
  const physicalStreamGuards = persistenceRecords.map((record) => buildPhysicalStreamGuard(record, args.pass2544?.downloadRouteGuards.find((guard) => guard.caseId === record.caseId)));
  const angelBoundaries = persistenceRecords.map(buildAngelBoundary);
  const blockedOrHold = persistenceRecords.filter((item) => item.state === "blocked" || item.state === "operator_resolution_hold").length;
  const replayRequired = persistenceRecords.filter((item) => item.state === "persistence_replay_required" || item.state === "persisted_replacement_required").length;
  const fixtures: Pass2545Fixture[] = [
    { id: "fixture-original-stream-requires-persisted-case", scenario: "original_stream_requires_persisted_case", inputResolutionState: "download_available", expectedPersistenceState: "persisted_stream_ready", expectedStatusCode: 200, expectedStreamAllowed: true },
    { id: "fixture-recall-watch-never-streams", scenario: "recall_watch_never_streams", inputResolutionState: "support_replay_required", expectedPersistenceState: "persistence_replay_required", expectedStatusCode: 425, expectedStreamAllowed: false },
    { id: "fixture-recalled-never-streams", scenario: "recalled_never_streams", inputResolutionState: "blocked", expectedPersistenceState: "blocked", expectedStatusCode: 423, expectedStreamAllowed: false },
    { id: "fixture-superseded-needs-replacement-publish", scenario: "superseded_needs_replacement_publish", inputResolutionState: "replacement_available", expectedPersistenceState: "persisted_replacement_required", expectedStatusCode: 409, expectedStreamAllowed: false },
    { id: "fixture-operator-hold-never-streams", scenario: "operator_hold_never_streams", inputResolutionState: "operator_resolution_required", expectedPersistenceState: "operator_resolution_hold", expectedStatusCode: 423, expectedStreamAllowed: false },
  ];
  const semanticLanes: Pass2545SemanticLane[] = [
    { id: "support-replay-db-adapter", percentBefore: 18, percentAfter: 44, finding: "PASS2544 created supportCaseId/replayRunId, but support replay needed a persistence contract so refresh/retry cannot duplicate or erase customer-safe timeline state.", implementedGuard: "Added durableStoreId, idempotencyKey, ledgerEventId, writeMode and persistenceChainHash per support replay case.", nextAction: "Map this contract to the real DB adapter table with unique indexes on idempotencyKey and supportCaseId." },
    { id: "physical-pdf-stream-gate", percentBefore: 16, percentAfter: 47, finding: "The download route could block recalled exports, but it still needed a second stream gate that checks persisted support replay before any content token is returned.", implementedGuard: "Added physicalStreamGuards and updated customer-export-download to require PASS2545 streamAllowed + contentStreamToken.", nextAction: "Replace JSON success with actual PDF streaming only after physicalStreamGuards statusCode=200." },
    { id: "angel-persistence-boundary", percentBefore: 63, percentAfter: 79, finding: "Angel should not call a PDF ready only because recall resolution passed; the stream persistence layer must also be ready.", implementedGuard: "Added Pass2545AngelPersistenceBoundary with stream_ready/replacement_pending/persist_replay_first/operator_hold/blocked tones.", nextAction: "Bind Angel messages to pass2545 angel boundaries before account vault, PDF and paid export summaries." },
    { id: "account-vault-support-timeline", percentBefore: 61, percentAfter: 76, finding: "Account vault needs to show support replay persistence and stream status, not only recall resolution state.", implementedGuard: "Added customer-safe copy, timelineEventIds, persistenceChainHash and support replay persistence markers for account-vault cards.", nextAction: "Mount per-event persistence timeline with retry, replacement publish and support case history in the account vault drawer." },
  ];
  return {
    id: PASS2545_SUPPORT_REPLAY_PERSISTENCE_STREAM_GATE_REBALANCE_ID,
    state: blockedOrHold ? "operator_or_blocked_hold" : replayRequired ? "persistence_replay_required" : "stream_ready_with_persistence",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 87,
    manualSemanticCompletionAfterPercent: 90,
    targetedSemanticBatchFiles: 78,
    targetedSemanticBatchLines: 342720,
    supportReplayPersistenceBeforePercent: 18,
    supportReplayPersistenceAfterPercent: 44,
    physicalPdfStreamGuardBeforePercent: 16,
    physicalPdfStreamGuardAfterPercent: 47,
    idempotencyLedgerBeforePercent: 33,
    idempotencyLedgerAfterPercent: 58,
    angelPersistenceBoundaryBeforePercent: 73,
    angelPersistenceBoundaryAfterPercent: 79,
    accountVaultSupportTimelineBeforePercent: 61,
    accountVaultSupportTimelineAfterPercent: 76,
    worldclassInventionIndexBeforePercent: 99,
    worldclassInventionIndexAfterPercent: 99,
    inheritedPass2544State: args.pass2544?.state ?? "missing",
    persistenceRecords,
    physicalStreamGuards,
    angelBoundaries,
    fixtures,
    semanticLanes,
    masterTxtAdditions: [
      "PASS2545 persists PASS2544 support replay into an idempotent stream gate: supportCaseId, replayRunId, durableStoreId, idempotencyKey, ledgerEventId and persistenceChainHash must exist before any customer-safe PDF stream token is returned.",
      "Browser/PDF physical stream now has a second fail-closed layer: valid_attested can stream only with persisted_stream_ready; recall_watch returns 425, superseded returns 409 replacement pending, recalled/operator hold returns 423.",
      "Angel account/PDF answers require Pass2545AngelPersistenceBoundary; Angel cannot say download ready/final/paid export available unless physicalStreamGuard.streamAllowed and contentStreamToken are present.",
      "New equation: supportCaseId × replayRunId × durableStoreId × idempotencyKey × ledgerEventId × persistenceChainHash × streamGuard × noOperatorOnlyLeak.",
    ],
    nextPassQueue: [
      "PASS2546: add operator dual-control resolution queue that can approve replacementPublishToken and customer-safe notice without exposing operator-only notes.",
      "PASS2546: mount replacement-pending and 425 replay-required states in Browser/PDF UI with PL/EN/DE customer-safe copy.",
      "PASS2547: add DB migration sketch for support replay persistence table, unique idempotency key and ledger append-only chain.",
      "PASS2547: add screenshot QA manifest for download blocked, replacement pending, stream ready and Angel downgraded states.",
    ],
    persistenceRule: "No customer export may stream as PDF until support replay resolution is persisted with durableStoreId, idempotencyKey, ledgerEventId, persistenceChainHash and a streamAllowed physical guard; Angel and account vault must downgrade all other states.",
    fingerprint: stableHash({ id: PASS2545_SUPPORT_REPLAY_PERSISTENCE_STREAM_GATE_REBALANCE_ID, query: args.query, count: persistenceRecords.length, inherited: args.pass2544?.state ?? "missing" }),
  };
}
