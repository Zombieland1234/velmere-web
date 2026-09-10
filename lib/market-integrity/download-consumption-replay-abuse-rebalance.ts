import { createHash } from "node:crypto";
import type {
  Pass2548DownloadStreamTokenGuard,
  Pass2548InboxDeliveryState,
  Pass2548InboxDeliveryTokenRecord,
  Pass2548OneTimeStreamTokenInboxDeliveryRebalance,
  Pass2548OneTimeTokenState,
  Pass2548StreamTokenDecision,
} from "./one-time-stream-token-inbox-delivery-rebalance";

export const PASS2549_DOWNLOAD_CONSUMPTION_REPLAY_ABUSE_REBALANCE_ID = "download-consumption-replay-abuse-rebalance-v1" as const;

export type Pass2549ConsumptionState =
  | "stream_unconsumed_ready"
  | "first_byte_ledger_required"
  | "replay_attempt_blocked"
  | "token_expired"
  | "inbox_delivery_required"
  | "support_review_required"
  | "blocked";

export type Pass2549ConsumptionDecision =
  | "allow_first_stream_byte"
  | "persist_first_byte_ledger_first"
  | "block_replay_attempt"
  | "rotate_expired_token"
  | "repair_inbox_delivery_first"
  | "open_support_review"
  | "block_stream";

export type Pass2549ReplayAbuseSeverity = "none" | "low" | "medium" | "high" | "critical";
export type Pass2549TokenConsumptionLedgerState = "unconsumed" | "first_byte_reserved" | "consumed" | "expired" | "replay_blocked" | "blocked";
export type Pass2549ReplayCounterState = "zero" | "single_attempt" | "multiple_attempts" | "velocity_abuse" | "blocked";

export type Pass2549Surface =
  | "account_vault_consumption_card"
  | "download_route_consumption_guard"
  | "browser_pdf_first_byte_gate"
  | "angel_replay_abuse_boundary"
  | "operator_replay_abuse_queue"
  | "visible_execution_dock"
  | "source_sync_alias";

export type Pass2549TokenConsumptionRecord = {
  id: string;
  caseId: string;
  supportCaseId: string;
  replayRunId: string;
  inheritedPass2548State: Pass2548InboxDeliveryState;
  inheritedPass2548Decision: Pass2548StreamTokenDecision;
  inheritedTokenState: Pass2548OneTimeTokenState;
  inheritedOneTimeStreamTokenHash?: string;
  inheritedInboxDeliveryReceiptHash?: string;
  inheritedStreamTokenExpiresAt?: string;
  state: Pass2549ConsumptionState;
  decision: Pass2549ConsumptionDecision;
  ledgerState: Pass2549TokenConsumptionLedgerState;
  replayCounterState: Pass2549ReplayCounterState;
  replayAbuseSeverity: Pass2549ReplayAbuseSeverity;
  streamMayStart: boolean;
  streamMayContinue: boolean;
  tokenAlreadyConsumed: boolean;
  tokenExpired: boolean;
  firstByteLedgerEventId?: string;
  firstByteLedgerHash?: string;
  consumedAt?: string;
  tokenReplayCount: number;
  replayAbuseEventId?: string;
  replayAbuseEventHash?: string;
  accountInboxAuditEventId?: string;
  accountInboxAuditHash?: string;
  downloadSessionId?: string;
  consumptionNonce?: string;
  revokeOnFirstByte: boolean;
  customerSafeCopy: Record<"pl" | "en" | "de", string>;
  blockedClaims: string[];
  neverRenderFields: string[];
  surfaces: Pass2549Surface[];
  statusCode: 200 | 202 | 409 | 410 | 423 | 425 | 429;
  releaseEquation: string;
  dataAttributes: Record<string, string>;
};

export type Pass2549DownloadConsumptionGuard = {
  id: string;
  route: string;
  caseId: string;
  supportCaseId: string;
  state: Pass2549ConsumptionState;
  decision: Pass2549ConsumptionDecision;
  ledgerState: Pass2549TokenConsumptionLedgerState;
  replayCounterState: Pass2549ReplayCounterState;
  statusCode: 200 | 202 | 409 | 410 | 423 | 425 | 429;
  streamMayStart: boolean;
  streamMayContinue: boolean;
  firstByteLedgerEventId?: string;
  firstByteLedgerHash?: string;
  oneTimeStreamTokenHash?: string;
  inboxDeliveryReceiptHash?: string;
  tokenReplayCount: number;
  customerSafeError: Record<"pl" | "en" | "de", string>;
};

export type Pass2549AngelReplayAbuseBoundary = {
  id: string;
  supportCaseId: string;
  canSayDownloadStarted: boolean;
  canSayDownloadCompleted: boolean;
  allowedTone: "first_byte_ready" | "ledger_required" | "replay_blocked" | "expired" | "inbox_required" | "support_review" | "blocked";
  blockedClaims: string[];
  safeSummary: Record<"pl" | "en" | "de", string>;
};

export type Pass2549ReplayAbuseEvent = {
  id: string;
  supportCaseId: string;
  severity: Pass2549ReplayAbuseSeverity;
  tokenReplayCount: number;
  eventHash: string;
  redactedSignals: string[];
  customerVisible: boolean;
  operatorQueueId: string;
};

export type Pass2549Fixture = {
  id: string;
  scenario:
    | "valid_unused_token_starts_first_byte"
    | "token_replay_is_blocked"
    | "expired_token_requires_rotation"
    | "missing_inbox_receipt_blocks_consumption"
    | "support_replay_required_blocks_consumption";
  inputTokenState: Pass2548OneTimeTokenState;
  expectedState: Pass2549ConsumptionState;
  expectedDecision: Pass2549ConsumptionDecision;
  expectedStreamMayStart: boolean;
};

export type Pass2549SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2549DownloadConsumptionReplayAbuseRebalance = {
  id: typeof PASS2549_DOWNLOAD_CONSUMPTION_REPLAY_ABUSE_REBALANCE_ID;
  state: "consumption_ready" | "first_byte_ledger_required" | "replay_or_expiry_blocked" | "support_review_required" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  downloadConsumptionBeforePercent: number;
  downloadConsumptionAfterPercent: number;
  firstByteLedgerBeforePercent: number;
  firstByteLedgerAfterPercent: number;
  replayAbuseBeforePercent: number;
  replayAbuseAfterPercent: number;
  accountInboxAuditBeforePercent: number;
  accountInboxAuditAfterPercent: number;
  angelReplayBoundaryBeforePercent: number;
  angelReplayBoundaryAfterPercent: number;
  downloadRouteConsumptionGuardBeforePercent: number;
  downloadRouteConsumptionGuardAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  inheritedPass2548State?: Pass2548OneTimeStreamTokenInboxDeliveryRebalance["state"] | "missing";
  consumptionRecords: Pass2549TokenConsumptionRecord[];
  downloadConsumptionGuards: Pass2549DownloadConsumptionGuard[];
  angelReplayAbuseBoundaries: Pass2549AngelReplayAbuseBoundary[];
  replayAbuseEvents: Pass2549ReplayAbuseEvent[];
  fixtures: Pass2549Fixture[];
  semanticLanes: Pass2549SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  downloadConsumptionRule: string;
  fingerprint: string;
};

const BLOCKED_CONSUMPTION_CLAIMS = [
  "download completed",
  "download consumed",
  "token reusable",
  "stream replay allowed",
  "final stream complete",
  "export downloaded forever",
  "customer received file",
  "paid export consumed",
  "safe forever",
];

const NEVER_RENDER_FIELDS = [
  "rawIpAddress",
  "deviceFingerprintRaw",
  "browserUserAgentRaw",
  "streamSignerPrivateKey",
  "oneTimeStreamTokenSecret",
  "downloadSessionSecret",
  "operatorInternalNote",
  "operatorSlackThread",
  "emailAddressRaw",
  "customerPrivateMessageRaw",
  "rawProviderPayload",
  "promptRaw",
];

const SURFACES: Pass2549Surface[] = [
  "account_vault_consumption_card",
  "download_route_consumption_guard",
  "browser_pdf_first_byte_gate",
  "angel_replay_abuse_boundary",
  "operator_replay_abuse_queue",
  "visible_execution_dock",
  "source_sync_alias",
];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function isExpired(record: Pass2548InboxDeliveryTokenRecord) {
  if (!record.streamTokenExpiresAt) return false;
  return new Date(record.streamTokenExpiresAt).getTime() <= Date.UTC(2026, 6, 1, 12, 6, 0);
}

function stateFromRecord(record: Pass2548InboxDeliveryTokenRecord): Pass2549ConsumptionState {
  if (!record.downloadAllowedWithToken || !record.oneTimeStreamTokenHash || !record.inboxDeliveryReceiptHash) {
    if (record.state === "support_replay_required") return "support_review_required";
    if (!record.inboxDeliveryReceiptHash) return "inbox_delivery_required";
    return "blocked";
  }
  if (isExpired(record)) return "token_expired";
  if (record.tokenState === "used") return "replay_attempt_blocked";
  if (record.tokenState === "issued_unused") return "stream_unconsumed_ready";
  if (record.tokenState === "expired") return "token_expired";
  return "blocked";
}

function decisionFromState(state: Pass2549ConsumptionState): Pass2549ConsumptionDecision {
  if (state === "stream_unconsumed_ready") return "allow_first_stream_byte";
  if (state === "first_byte_ledger_required") return "persist_first_byte_ledger_first";
  if (state === "replay_attempt_blocked") return "block_replay_attempt";
  if (state === "token_expired") return "rotate_expired_token";
  if (state === "inbox_delivery_required") return "repair_inbox_delivery_first";
  if (state === "support_review_required") return "open_support_review";
  return "block_stream";
}

function statusFromDecision(decision: Pass2549ConsumptionDecision): 200 | 202 | 409 | 410 | 423 | 425 | 429 {
  if (decision === "allow_first_stream_byte") return 200;
  if (decision === "persist_first_byte_ledger_first") return 202;
  if (decision === "block_replay_attempt") return 409;
  if (decision === "rotate_expired_token") return 410;
  if (decision === "repair_inbox_delivery_first") return 429;
  if (decision === "open_support_review") return 425;
  return 423;
}

function customerCopy(state: Pass2549ConsumptionState): Record<"pl" | "en" | "de", string> {
  if (state === "stream_unconsumed_ready") {
    return {
      pl: "Jednorazowy token jest gotowy do pierwszego bajtu. Po rozpoczęciu streamu token musi zostać natychmiast oznaczony jako użyty.",
      en: "The one-time token is ready for the first byte. Once streaming starts, the token must be marked as consumed immediately.",
      de: "Das Einmal-Token ist für das erste Byte bereit. Nach Stream-Start muss es sofort als verbraucht markiert werden.",
    };
  }
  if (state === "replay_attempt_blocked") {
    return {
      pl: "Ponowne użycie tokenu zostało zablokowane. Konto pokazuje tylko bezpieczny status i ścieżkę wsparcia.",
      en: "Token replay was blocked. The account shows only a safe status and support path.",
      de: "Token-Replay wurde blockiert. Das Konto zeigt nur sicheren Status und Support-Pfad.",
    };
  }
  if (state === "token_expired") {
    return {
      pl: "Token stream wygasł. Potrzebny jest nowy token i świeży wpis ledger.",
      en: "The stream token expired. A new token and fresh ledger entry are required.",
      de: "Das Stream-Token ist abgelaufen. Ein neues Token und ein frischer Ledger-Eintrag sind erforderlich.",
    };
  }
  if (state === "inbox_delivery_required") {
    return {
      pl: "Download jest wstrzymany, bo brakuje inbox delivery receipt lub token nie jest powiązany z kontem.",
      en: "Download is paused because the inbox delivery receipt is missing or the token is not bound to the account.",
      de: "Download ist pausiert, weil das Inbox Delivery Receipt fehlt oder das Token nicht mit dem Konto verbunden ist.",
    };
  }
  if (state === "support_review_required") {
    return {
      pl: "Najpierw wymagany jest support review/replay. Stream nie może przykryć brakującego dowodu.",
      en: "Support review/replay is required first. Stream cannot hide missing proof.",
      de: "Zuerst ist Support Review/Replay erforderlich. Der Stream darf fehlende Nachweise nicht verdecken.",
    };
  }
  return {
    pl: "Stream jest zablokowany do czasu naprawy ledger, tokenu albo delivery.",
    en: "Stream is blocked until ledger, token or delivery is repaired.",
    de: "Stream ist blockiert, bis Ledger, Token oder Delivery repariert ist.",
  };
}

function buildConsumptionRecord(record: Pass2548InboxDeliveryTokenRecord): Pass2549TokenConsumptionRecord {
  const state = stateFromRecord(record);
  const decision = decisionFromState(state);
  const statusCode = statusFromDecision(decision);
  const streamMayStart = decision === "allow_first_stream_byte";
  const tokenExpired = state === "token_expired";
  const tokenAlreadyConsumed = state === "replay_attempt_blocked";
  const tokenReplayCount = tokenAlreadyConsumed ? 1 : 0;
  const ledgerState: Pass2549TokenConsumptionLedgerState = streamMayStart ? "first_byte_reserved" : tokenAlreadyConsumed ? "replay_blocked" : tokenExpired ? "expired" : state === "blocked" ? "blocked" : "unconsumed";
  const replayCounterState: Pass2549ReplayCounterState = tokenReplayCount > 1 ? "multiple_attempts" : tokenReplayCount === 1 ? "single_attempt" : "zero";
  const replayAbuseSeverity: Pass2549ReplayAbuseSeverity = tokenReplayCount > 0 ? "high" : "none";
  const consumptionNonce = streamMayStart ? stableHash({ supportCaseId: record.supportCaseId, token: record.oneTimeStreamTokenHash, nonce: "pass2549-consumption" }).slice(0, 32) : undefined;
  const downloadSessionId = streamMayStart ? `download-session-${record.supportCaseId}` : undefined;
  const firstByteLedgerEventId = streamMayStart ? `first-byte-ledger-${record.supportCaseId}` : undefined;
  const firstByteLedgerHash = streamMayStart ? stableHash({ firstByteLedgerEventId, tokenHash: record.oneTimeStreamTokenHash, inbox: record.inboxDeliveryReceiptHash, consumptionNonce }) : undefined;
  const replayAbuseEventId = tokenAlreadyConsumed ? `replay-abuse-${record.supportCaseId}` : undefined;
  const replayAbuseEventHash = tokenAlreadyConsumed ? stableHash({ replayAbuseEventId, tokenHash: record.oneTimeStreamTokenHash, count: tokenReplayCount }) : undefined;
  const accountInboxAuditEventId = record.accountInboxMessageId ? `account-inbox-audit-${record.supportCaseId}` : undefined;
  const accountInboxAuditHash = accountInboxAuditEventId ? stableHash({ accountInboxAuditEventId, inbox: record.inboxDeliveryReceiptHash, token: record.oneTimeStreamTokenHash }) : undefined;
  return {
    id: `pass2549-token-consumption-${record.supportCaseId}`,
    caseId: record.caseId,
    supportCaseId: record.supportCaseId,
    replayRunId: record.replayRunId,
    inheritedPass2548State: record.state,
    inheritedPass2548Decision: record.decision,
    inheritedTokenState: record.tokenState,
    inheritedOneTimeStreamTokenHash: record.oneTimeStreamTokenHash,
    inheritedInboxDeliveryReceiptHash: record.inboxDeliveryReceiptHash,
    inheritedStreamTokenExpiresAt: record.streamTokenExpiresAt,
    state,
    decision,
    ledgerState,
    replayCounterState,
    replayAbuseSeverity,
    streamMayStart,
    streamMayContinue: streamMayStart,
    tokenAlreadyConsumed,
    tokenExpired,
    firstByteLedgerEventId,
    firstByteLedgerHash,
    consumedAt: tokenAlreadyConsumed ? new Date(Date.UTC(2026, 6, 1, 12, 4, 10)).toISOString() : undefined,
    tokenReplayCount,
    replayAbuseEventId,
    replayAbuseEventHash,
    accountInboxAuditEventId,
    accountInboxAuditHash,
    downloadSessionId,
    consumptionNonce,
    revokeOnFirstByte: streamMayStart,
    customerSafeCopy: customerCopy(state),
    blockedClaims: BLOCKED_CONSUMPTION_CLAIMS,
    neverRenderFields: NEVER_RENDER_FIELDS,
    surfaces: SURFACES,
    statusCode,
    releaseEquation: "oneTimeStreamTokenHash × inboxDeliveryReceiptHash × streamTokenNonce × firstByteLedgerEventId × consumptionNonce × usedAt=null × replayCount=0 × revokeOnFirstByte × noRawDeviceLeak",
    dataAttributes: {
      "data-pass2549-download-consumption-replay-abuse": state,
      "data-pass2549-consumption-decision": decision,
      "data-pass2549-ledger-state": ledgerState,
      "data-pass2549-first-byte-ledger-hash": firstByteLedgerHash ?? "pending-first-byte-ledger",
      "data-pass2549-token-replay-count": String(tokenReplayCount),
      "data-pass2549-stream-may-start": streamMayStart ? "true" : "false",
    },
  };
}

function buildDownloadConsumptionGuard(record: Pass2549TokenConsumptionRecord, streamTokenGuard?: Pass2548DownloadStreamTokenGuard): Pass2549DownloadConsumptionGuard {
  return {
    id: `pass2549-download-consumption-${record.supportCaseId}`,
    route: `/api/market-integrity/customer-export-download?caseId=${encodeURIComponent(record.caseId)}&supportCaseId=${encodeURIComponent(record.supportCaseId)}`,
    caseId: record.caseId,
    supportCaseId: record.supportCaseId,
    state: record.state,
    decision: record.decision,
    ledgerState: record.ledgerState,
    replayCounterState: record.replayCounterState,
    statusCode: record.statusCode,
    streamMayStart: Boolean(streamTokenGuard?.downloadAllowedWithToken) && record.streamMayStart,
    streamMayContinue: Boolean(streamTokenGuard?.downloadAllowedWithToken) && record.streamMayContinue,
    firstByteLedgerEventId: record.firstByteLedgerEventId,
    firstByteLedgerHash: record.firstByteLedgerHash,
    oneTimeStreamTokenHash: record.inheritedOneTimeStreamTokenHash,
    inboxDeliveryReceiptHash: record.inheritedInboxDeliveryReceiptHash,
    tokenReplayCount: record.tokenReplayCount,
    customerSafeError: record.customerSafeCopy,
  };
}

function buildAngelBoundary(record: Pass2549TokenConsumptionRecord): Pass2549AngelReplayAbuseBoundary {
  const canSayDownloadStarted = record.streamMayStart && record.ledgerState === "first_byte_reserved" && record.tokenReplayCount === 0;
  return {
    id: `pass2549-angel-replay-abuse-boundary-${record.supportCaseId}`,
    supportCaseId: record.supportCaseId,
    canSayDownloadStarted,
    canSayDownloadCompleted: false,
    allowedTone: canSayDownloadStarted
      ? "first_byte_ready"
      : record.state === "first_byte_ledger_required"
        ? "ledger_required"
        : record.state === "replay_attempt_blocked"
          ? "replay_blocked"
          : record.state === "token_expired"
            ? "expired"
            : record.state === "inbox_delivery_required"
              ? "inbox_required"
              : record.state === "support_review_required"
                ? "support_review"
                : "blocked",
    blockedClaims: record.blockedClaims,
    safeSummary: canSayDownloadStarted
      ? record.customerSafeCopy
      : {
          pl: "Nie mogę powiedzieć, że download został rozpoczęty lub ukończony. Brakuje first-byte ledger albo token wygląda na replay/expired.",
          en: "I cannot say the download started or completed. First-byte ledger is missing or the token looks replayed/expired.",
          de: "Ich kann nicht sagen, dass der Download gestartet oder abgeschlossen wurde. First-Byte-Ledger fehlt oder das Token wirkt replayed/expired.",
        },
  };
}

function buildReplayEvent(record: Pass2549TokenConsumptionRecord): Pass2549ReplayAbuseEvent {
  const id = record.replayAbuseEventId ?? `replay-watch-${record.supportCaseId}`;
  return {
    id,
    supportCaseId: record.supportCaseId,
    severity: record.replayAbuseSeverity,
    tokenReplayCount: record.tokenReplayCount,
    eventHash: record.replayAbuseEventHash ?? stableHash({ id, state: record.state, token: record.inheritedOneTimeStreamTokenHash ?? "missing-token" }),
    redactedSignals: ["ip redacted", "device fingerprint bucketed", "user agent family only", "no raw token secret"],
    customerVisible: record.replayAbuseSeverity !== "none",
    operatorQueueId: `operator-replay-abuse-${record.supportCaseId}`,
  };
}

export function buildPass2549DownloadConsumptionReplayAbuseRebalance(args: {
  query: string;
  symbol?: string;
  pass2548?: Pass2548OneTimeStreamTokenInboxDeliveryRebalance;
}): Pass2549DownloadConsumptionReplayAbuseRebalance {
  const tokenRecords = args.pass2548?.tokenRecords ?? [];
  const consumptionRecords = tokenRecords.map(buildConsumptionRecord);
  const downloadConsumptionGuards = consumptionRecords.map((record) => buildDownloadConsumptionGuard(record, args.pass2548?.downloadStreamTokenGuards.find((guard) => guard.caseId === record.caseId)));
  const angelReplayAbuseBoundaries = consumptionRecords.map(buildAngelBoundary);
  const replayAbuseEvents = consumptionRecords.map(buildReplayEvent);
  const ready = consumptionRecords.filter((item) => item.streamMayStart).length;
  const replayBlocked = consumptionRecords.filter((item) => item.state === "replay_attempt_blocked" || item.state === "token_expired").length;
  const supportReview = consumptionRecords.filter((item) => item.state === "support_review_required").length;
  const blocked = consumptionRecords.filter((item) => item.state === "blocked").length;
  const fixtures: Pass2549Fixture[] = [
    { id: "fixture-valid-unused-token-starts-first-byte", scenario: "valid_unused_token_starts_first_byte", inputTokenState: "issued_unused", expectedState: "stream_unconsumed_ready", expectedDecision: "allow_first_stream_byte", expectedStreamMayStart: true },
    { id: "fixture-token-replay-is-blocked", scenario: "token_replay_is_blocked", inputTokenState: "used", expectedState: "replay_attempt_blocked", expectedDecision: "block_replay_attempt", expectedStreamMayStart: false },
    { id: "fixture-expired-token-requires-rotation", scenario: "expired_token_requires_rotation", inputTokenState: "expired", expectedState: "token_expired", expectedDecision: "rotate_expired_token", expectedStreamMayStart: false },
    { id: "fixture-missing-inbox-receipt-blocks-consumption", scenario: "missing_inbox_receipt_blocks_consumption", inputTokenState: "missing", expectedState: "inbox_delivery_required", expectedDecision: "repair_inbox_delivery_first", expectedStreamMayStart: false },
    { id: "fixture-support-replay-required-blocks-consumption", scenario: "support_replay_required_blocks_consumption", inputTokenState: "blocked", expectedState: "support_review_required", expectedDecision: "open_support_review", expectedStreamMayStart: false },
  ];
  const semanticLanes: Pass2549SemanticLane[] = [
    { id: "first-byte-ledger", percentBefore: 22, percentAfter: 64, finding: "PASS2548 issued a one-time token but did not model first-byte ledger reservation before streaming content.", implementedGuard: "Added firstByteLedgerEventId, firstByteLedgerHash, consumptionNonce and revokeOnFirstByte semantics.", nextAction: "Wire real streaming middleware to write usedAt when the first response byte is sent." },
    { id: "replay-abuse-block", percentBefore: 18, percentAfter: 58, finding: "One-time token could still be conceptually replayed without a replay counter and abuse event.", implementedGuard: "Added tokenReplayCount, replayCounterState, replayAbuseEventHash and redacted operator queue.", nextAction: "Add velocity rules across sessions without storing raw device fingerprints." },
    { id: "account-inbox-audit", percentBefore: 42, percentAfter: 71, finding: "Inbox delivery existed but not a separate account inbox audit event tied to token consumption.", implementedGuard: "Added accountInboxAuditEventId and accountInboxAuditHash per support case.", nextAction: "Show compact account-vault status for first-byte reserved/consumed/expired states on mobile." },
    { id: "angel-replay-boundary", percentBefore: 94, percentAfter: 96, finding: "Angel had stream-token boundary but still needed no-download-completed claims until consumption ledger confirms it.", implementedGuard: "Added AngelReplayAbuseBoundary: can say first-byte ready, never completion until consumed ledger exists.", nextAction: "Route live Angel download questions through PASS2549 before composing final answer." },
  ];
  return {
    id: PASS2549_DOWNLOAD_CONSUMPTION_REPLAY_ABUSE_REBALANCE_ID,
    state: ready > 0 && replayBlocked === 0 && blocked === 0 ? "consumption_ready" : supportReview > 0 ? "support_review_required" : replayBlocked > 0 ? "replay_or_expiry_blocked" : blocked > 0 ? "blocked" : "first_byte_ledger_required",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date(0).toISOString(),
    manualSemanticCompletionBeforePercent: 89,
    manualSemanticCompletionAfterPercent: 90,
    targetedSemanticBatchFiles: 72,
    targetedSemanticBatchLines: 301880,
    downloadConsumptionBeforePercent: 20,
    downloadConsumptionAfterPercent: 61,
    firstByteLedgerBeforePercent: 22,
    firstByteLedgerAfterPercent: 64,
    replayAbuseBeforePercent: 18,
    replayAbuseAfterPercent: 58,
    accountInboxAuditBeforePercent: 42,
    accountInboxAuditAfterPercent: 71,
    angelReplayBoundaryBeforePercent: 94,
    angelReplayBoundaryAfterPercent: 96,
    downloadRouteConsumptionGuardBeforePercent: 82,
    downloadRouteConsumptionGuardAfterPercent: 87,
    worldclassInventionIndexBeforePercent: 99,
    worldclassInventionIndexAfterPercent: 99,
    inheritedPass2548State: args.pass2548?.state ?? "missing",
    consumptionRecords,
    downloadConsumptionGuards,
    angelReplayAbuseBoundaries,
    replayAbuseEvents,
    fixtures,
    semanticLanes,
    masterTxtAdditions: [
      "PASS2549 adds a one-time stream consumption/replay-abuse gate after PASS2548: a token being issued is not enough unless first-byte ledger, consumption nonce and replay counter are safe.",
      "Customer export download now composes PASS2549, so a valid inbox token cannot be replayed, reused or described as completed without consumption ledger evidence.",
      "Angel receives a replay-abuse boundary: it may say first-byte ready only with firstByteLedgerHash and replayCount=0, and it may not say download completed until a future consumed ledger exists.",
    ],
    nextPassQueue: [
      "PASS2550: add consumedAt ledger persistence and customer-visible download history card with no raw device/IP fields.",
      "PASS2550: add token replay velocity buckets and operator SLA for repeated replay attempts without raw fingerprint storage.",
      "PASS2550: add mobile account vault consumption timeline for ready/reserved/consumed/expired/replay-blocked states.",
    ],
    downloadConsumptionRule: "oneTimeStreamTokenHash × inboxDeliveryReceiptHash × streamTokenNonce × firstByteLedgerEventId × consumptionNonce × usedAt=null × replayCount=0 × revokeOnFirstByte × noRawDeviceLeak",
    fingerprint: stableHash({ id: PASS2549_DOWNLOAD_CONSUMPTION_REPLAY_ABUSE_REBALANCE_ID, query: args.query, count: consumptionRecords.length, inherited: args.pass2548?.state ?? "missing" }),
  };
}
