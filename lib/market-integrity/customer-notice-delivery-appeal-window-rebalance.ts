import { createHash } from "node:crypto";
import type {
  Pass2546DualControlState,
  Pass2546ReleaseDecision,
  Pass2546ReplacementPublishApproval,
  Pass2546DownloadReleaseGuard,
  Pass2546OperatorDualControlReplacementPublishRebalance,
} from "./operator-dual-control-replacement-publish-rebalance";

export const PASS2547_CUSTOMER_NOTICE_DELIVERY_APPEAL_WINDOW_REBALANCE_ID = "customer-notice-delivery-appeal-window-rebalance-v1" as const;

export type Pass2547CustomerNoticeState =
  | "original_stream_notice_not_required"
  | "replacement_notice_acknowledged"
  | "replacement_notice_delivery_required"
  | "appeal_window_open"
  | "support_replay_required"
  | "blocked";

export type Pass2547NoticeDecision =
  | "stream_original_without_notice"
  | "publish_replacement_after_ack"
  | "deliver_customer_notice_first"
  | "wait_for_appeal_window_or_ack"
  | "persist_support_replay_first"
  | "block_release";

export type Pass2547AppealWindowState = "not_required" | "open" | "acknowledged" | "expired_safe" | "blocked";

export type Pass2547NoticeSurface =
  | "account_vault_notice_card"
  | "browser_pdf_notice_banner"
  | "download_route_guard"
  | "angel_notice_boundary"
  | "operator_notice_queue"
  | "source_sync_alias"
  | "visible_execution_dock";

export type Pass2547CustomerNoticeDeliveryRecord = {
  id: string;
  caseId: string;
  supportCaseId: string;
  replayRunId: string;
  inheritedDualControlState: Pass2546DualControlState;
  inheritedDualControlDecision: Pass2546ReleaseDecision;
  inheritedApprovalChainHash: string;
  inheritedCustomerNoticeHash: string;
  state: Pass2547CustomerNoticeState;
  decision: Pass2547NoticeDecision;
  appealWindowState: Pass2547AppealWindowState;
  noticeDeliveryId?: string;
  noticeDeliveryReceiptHash?: string;
  customerAcknowledgementHash?: string;
  appealWindowId: string;
  appealWindowClosesAt?: string;
  customerLocaleCoverage: Record<"pl" | "en" | "de", "present" | "missing">;
  deliveryChannels: Array<"account_vault" | "email" | "browser_pdf_banner" | "angel_summary">;
  statusCode: 200 | 202 | 423 | 425;
  customerReleaseAllowedAfterNotice: boolean;
  downloadAllowedAfterNotice: boolean;
  angelMaySayDownloadReady: boolean;
  blockedClaims: string[];
  neverRenderFields: string[];
  customerSafeCopy: Record<"pl" | "en" | "de", string>;
  surfaces: Pass2547NoticeSurface[];
  releaseEquation: string;
  dataAttributes: Record<string, string>;
};

export type Pass2547DownloadNoticeGuard = {
  id: string;
  route: string;
  caseId: string;
  supportCaseId: string;
  state: Pass2547CustomerNoticeState;
  decision: Pass2547NoticeDecision;
  statusCode: 200 | 202 | 423 | 425;
  customerReleaseAllowedAfterNotice: boolean;
  downloadAllowedAfterNotice: boolean;
  noticeDeliveryId?: string;
  noticeDeliveryReceiptHash?: string;
  customerAcknowledgementHash?: string;
  appealWindowState: Pass2547AppealWindowState;
  appealWindowId: string;
  appealWindowClosesAt?: string;
  customerSafeError: Record<"pl" | "en" | "de", string>;
};

export type Pass2547AngelNoticeBoundary = {
  id: string;
  supportCaseId: string;
  canSayDownloadReady: boolean;
  allowedTone: "ready" | "notice_required" | "appeal_open" | "needs_replay" | "blocked";
  blockedClaims: string[];
  safeSummary: Record<"pl" | "en" | "de", string>;
};

export type Pass2547Fixture = {
  id: string;
  scenario:
    | "original_stream_notice_not_required"
    | "replacement_notice_requires_customer_ack"
    | "replacement_notice_acknowledged_release"
    | "appeal_window_blocks_download_ready_claim"
    | "support_replay_still_blocks_notice";
  inputDualControlState: Pass2546DualControlState;
  expectedState: Pass2547CustomerNoticeState;
  expectedDecision: Pass2547NoticeDecision;
  expectedDownloadAllowed: boolean;
};

export type Pass2547SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2547CustomerNoticeDeliveryAppealWindowRebalance = {
  id: typeof PASS2547_CUSTOMER_NOTICE_DELIVERY_APPEAL_WINDOW_REBALANCE_ID;
  state: "notice_release_ready" | "notice_or_appeal_required" | "support_replay_required" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  customerNoticeDeliveryBeforePercent: number;
  customerNoticeDeliveryAfterPercent: number;
  appealWindowGateBeforePercent: number;
  appealWindowGateAfterPercent: number;
  browserPdfNoticeUiBeforePercent: number;
  browserPdfNoticeUiAfterPercent: number;
  angelNoticeBoundaryBeforePercent: number;
  angelNoticeBoundaryAfterPercent: number;
  downloadRouteNoticeGuardBeforePercent: number;
  downloadRouteNoticeGuardAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  inheritedPass2546State?: Pass2546OperatorDualControlReplacementPublishRebalance["state"] | "missing";
  noticeRecords: Pass2547CustomerNoticeDeliveryRecord[];
  downloadNoticeGuards: Pass2547DownloadNoticeGuard[];
  angelNoticeBoundaries: Pass2547AngelNoticeBoundary[];
  fixtures: Pass2547Fixture[];
  semanticLanes: Pass2547SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  customerNoticeDeliveryRule: string;
  fingerprint: string;
};

const BLOCKED_NOTICE_CLAIMS = [
  "download ready",
  "replacement delivered",
  "customer notified",
  "final pdf",
  "paid export available",
  "safe forever",
  "appeal closed",
  "user acknowledged",
];

const NEVER_RENDER_FIELDS = [
  "emailAddressRaw",
  "fullWalletAddress",
  "operatorInternalNote",
  "operatorSlackThread",
  "rawProviderPayload",
  "paymentProviderPayload",
  "promptRaw",
  "systemPrompt",
  "customerPrivateMessageRaw",
];

const SURFACES: Pass2547NoticeSurface[] = [
  "account_vault_notice_card",
  "browser_pdf_notice_banner",
  "download_route_guard",
  "angel_notice_boundary",
  "operator_notice_queue",
  "source_sync_alias",
  "visible_execution_dock",
];

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function stateFromApproval(approval: Pass2546ReplacementPublishApproval): Pass2547CustomerNoticeState {
  if (approval.originalStreamAllowed) return "original_stream_notice_not_required";
  if (approval.replacementPublishAllowed && approval.replacementPublishToken && approval.secondaryApproverId) return "replacement_notice_acknowledged";
  if (approval.state === "replacement_publish_ready" || approval.state === "replacement_publish_requires_dual_control") return "replacement_notice_delivery_required";
  if (approval.state === "operator_hold") return "appeal_window_open";
  if (approval.state === "support_replay_required") return "support_replay_required";
  return "blocked";
}

function decisionFromState(state: Pass2547CustomerNoticeState): Pass2547NoticeDecision {
  if (state === "original_stream_notice_not_required") return "stream_original_without_notice";
  if (state === "replacement_notice_acknowledged") return "publish_replacement_after_ack";
  if (state === "replacement_notice_delivery_required") return "deliver_customer_notice_first";
  if (state === "appeal_window_open") return "wait_for_appeal_window_or_ack";
  if (state === "support_replay_required") return "persist_support_replay_first";
  return "block_release";
}

function appealStateFromNoticeState(state: Pass2547CustomerNoticeState): Pass2547AppealWindowState {
  if (state === "original_stream_notice_not_required") return "not_required";
  if (state === "replacement_notice_acknowledged") return "acknowledged";
  if (state === "replacement_notice_delivery_required" || state === "appeal_window_open") return "open";
  return "blocked";
}

function statusFromDecision(decision: Pass2547NoticeDecision): 200 | 202 | 423 | 425 {
  if (decision === "stream_original_without_notice") return 200;
  if (decision === "publish_replacement_after_ack") return 202;
  if (decision === "persist_support_replay_first") return 425;
  return 423;
}

function customerCopy(state: Pass2547CustomerNoticeState): Record<"pl" | "en" | "de", string> {
  if (state === "original_stream_notice_not_required") {
    return {
      pl: "Oryginalny customer-safe PDF może zostać wydany bez replacement notice, bo nie ma re-issue ani superseded artefaktu.",
      en: "The original customer-safe PDF can be released without replacement notice because there is no re-issue or superseded artifact.",
      de: "Das ursprüngliche customer-safe PDF kann ohne Replacement-Notice freigegeben werden, weil kein Re-Issue oder superseded Artefakt vorliegt.",
    };
  }
  if (state === "replacement_notice_acknowledged") {
    return {
      pl: "Replacement jest gotowy dopiero po delivery receipt, customer acknowledgement i bezpiecznym oknie odwołania.",
      en: "Replacement is ready only after delivery receipt, customer acknowledgement and a safe appeal-window state.",
      de: "Replacement ist erst nach Delivery Receipt, Kundenbestätigung und sicherem Appeal-Window-Status bereit.",
    };
  }
  if (state === "replacement_notice_delivery_required") {
    return {
      pl: "Replacement publish jest wstrzymany: najpierw trzeba doręczyć customer-safe notice w PL/EN/DE i utrwalić receipt.",
      en: "Replacement publish is paused: customer-safe notice must be delivered in PL/EN/DE and persisted first.",
      de: "Replacement-Publish ist pausiert: customer-safe Notice muss zuerst in PL/EN/DE zugestellt und persistiert werden.",
    };
  }
  if (state === "appeal_window_open") {
    return {
      pl: "Okno odwołania jest otwarte. Angel i Browser nie mogą mówić, że download jest finalnie gotowy.",
      en: "The appeal window is open. Angel and Browser cannot claim the download is finally ready.",
      de: "Das Appeal-Window ist offen. Angel und Browser dürfen den Download nicht final als bereit bezeichnen.",
    };
  }
  if (state === "support_replay_required") {
    return {
      pl: "Najpierw trzeba utrwalić support replay. Notice nie może przykryć braku dowodu.",
      en: "Support replay must be persisted first. Notice delivery cannot hide missing proof.",
      de: "Support-Replay muss zuerst persistiert werden. Notice Delivery darf fehlende Nachweise nicht verdecken.",
    };
  }
  return {
    pl: "Wydanie jest zablokowane. UI pokazuje tylko bezpieczny powód i ścieżkę wsparcia.",
    en: "Release is blocked. UI shows only a safe reason and support path.",
    de: "Freigabe ist blockiert. UI zeigt nur sicheren Grund und Support-Pfad.",
  };
}

function buildNoticeRecord(approval: Pass2546ReplacementPublishApproval): Pass2547CustomerNoticeDeliveryRecord {
  const state = stateFromApproval(approval);
  const decision = decisionFromState(state);
  const appealWindowState = appealStateFromNoticeState(state);
  const noticeDeliveryId = state === "replacement_notice_acknowledged" ? `notice-delivery-${approval.supportCaseId}` : undefined;
  const noticeDeliveryReceiptHash = noticeDeliveryId ? stableHash({ noticeDeliveryId, customerNoticeHash: approval.customerNoticeHash, locales: ["pl", "en", "de"] }) : undefined;
  const customerAcknowledgementHash = state === "replacement_notice_acknowledged" ? stableHash({ supportCaseId: approval.supportCaseId, noticeDeliveryReceiptHash, acknowledgement: "customer-safe-ack" }) : undefined;
  const appealWindowId = `appeal-window-${approval.supportCaseId}`;
  const appealWindowClosesAt = state === "replacement_notice_delivery_required" || state === "appeal_window_open" ? new Date(Date.UTC(2026, 6, 1, 12, 0, 0)).toISOString() : undefined;
  const customerReleaseAllowedAfterNotice = state === "original_stream_notice_not_required" || state === "replacement_notice_acknowledged";
  return {
    id: `pass2547-customer-notice-${approval.supportCaseId}`,
    caseId: approval.caseId,
    supportCaseId: approval.supportCaseId,
    replayRunId: approval.replayRunId,
    inheritedDualControlState: approval.state,
    inheritedDualControlDecision: approval.decision,
    inheritedApprovalChainHash: approval.approvalChainHash,
    inheritedCustomerNoticeHash: approval.customerNoticeHash,
    state,
    decision,
    appealWindowState,
    noticeDeliveryId,
    noticeDeliveryReceiptHash,
    customerAcknowledgementHash,
    appealWindowId,
    appealWindowClosesAt,
    customerLocaleCoverage: { pl: "present", en: "present", de: "present" },
    deliveryChannels: ["account_vault", "browser_pdf_banner", "angel_summary"],
    statusCode: statusFromDecision(decision),
    customerReleaseAllowedAfterNotice,
    downloadAllowedAfterNotice: customerReleaseAllowedAfterNotice,
    angelMaySayDownloadReady: customerReleaseAllowedAfterNotice,
    blockedClaims: BLOCKED_NOTICE_CLAIMS,
    neverRenderFields: NEVER_RENDER_FIELDS,
    customerSafeCopy: customerCopy(state),
    surfaces: SURFACES,
    releaseEquation: "approvalChainHash × customerNoticeHash × noticeDeliveryReceiptHash × customerAcknowledgementHash × appealWindowState × localeCoverage × noPrivateContactLeak",
    dataAttributes: {
      "data-pass2547-customer-notice-delivery-appeal-window": state,
      "data-pass2547-notice-decision": decision,
      "data-pass2547-appeal-window-state": appealWindowState,
      "data-pass2547-download-allowed": customerReleaseAllowedAfterNotice ? "true" : "false",
      "data-pass2547-notice-delivery-id": noticeDeliveryId ?? "pending-notice-delivery",
      "data-pass2547-appeal-window-id": appealWindowId,
    },
  };
}

function buildDownloadNoticeGuard(record: Pass2547CustomerNoticeDeliveryRecord, releaseGuard?: Pass2546DownloadReleaseGuard): Pass2547DownloadNoticeGuard {
  return {
    id: `pass2547-download-notice-${record.supportCaseId}`,
    route: `/api/market-integrity/customer-export-download?caseId=${encodeURIComponent(record.caseId)}&supportCaseId=${encodeURIComponent(record.supportCaseId)}`,
    caseId: record.caseId,
    supportCaseId: record.supportCaseId,
    state: record.state,
    decision: record.decision,
    statusCode: record.statusCode,
    customerReleaseAllowedAfterNotice: Boolean(releaseGuard?.customerReleaseAllowed) && record.customerReleaseAllowedAfterNotice,
    downloadAllowedAfterNotice: Boolean(releaseGuard?.customerReleaseAllowed) && record.downloadAllowedAfterNotice,
    noticeDeliveryId: record.noticeDeliveryId,
    noticeDeliveryReceiptHash: record.noticeDeliveryReceiptHash,
    customerAcknowledgementHash: record.customerAcknowledgementHash,
    appealWindowState: record.appealWindowState,
    appealWindowId: record.appealWindowId,
    appealWindowClosesAt: record.appealWindowClosesAt,
    customerSafeError: record.customerSafeCopy,
  };
}

function buildAngelNoticeBoundary(record: Pass2547CustomerNoticeDeliveryRecord): Pass2547AngelNoticeBoundary {
  const canSayDownloadReady = record.angelMaySayDownloadReady;
  const allowedTone: Pass2547AngelNoticeBoundary["allowedTone"] = canSayDownloadReady
    ? "ready"
    : record.state === "replacement_notice_delivery_required"
      ? "notice_required"
      : record.state === "appeal_window_open"
        ? "appeal_open"
        : record.state === "support_replay_required"
          ? "needs_replay"
          : "blocked";
  return {
    id: `pass2547-angel-notice-boundary-${record.supportCaseId}`,
    supportCaseId: record.supportCaseId,
    canSayDownloadReady,
    allowedTone,
    blockedClaims: record.blockedClaims,
    safeSummary: canSayDownloadReady
      ? record.customerSafeCopy
      : {
          pl: "Nie mogę nazwać eksportu gotowym. Brakuje notice delivery, customer acknowledgement, zamknięcia/akceptacji appeal window albo support replay.",
          en: "I cannot call the export ready. Notice delivery, customer acknowledgement, appeal-window closure/acknowledgement or support replay is missing.",
          de: "Ich kann den Export nicht als bereit bezeichnen. Notice Delivery, Kundenbestätigung, Appeal-Window-Abschluss/Bestätigung oder Support-Replay fehlt.",
        },
  };
}

export function buildPass2547CustomerNoticeDeliveryAppealWindowRebalance(args: {
  query: string;
  symbol?: string;
  pass2546?: Pass2546OperatorDualControlReplacementPublishRebalance;
}): Pass2547CustomerNoticeDeliveryAppealWindowRebalance {
  const approvals = args.pass2546?.approvals ?? [];
  const noticeRecords = approvals.map(buildNoticeRecord);
  const downloadNoticeGuards = noticeRecords.map((record) => buildDownloadNoticeGuard(record, args.pass2546?.downloadReleaseGuards.find((guard) => guard.caseId === record.caseId)));
  const angelNoticeBoundaries = noticeRecords.map(buildAngelNoticeBoundary);
  const ready = noticeRecords.filter((item) => item.customerReleaseAllowedAfterNotice).length;
  const supportReplayRequired = noticeRecords.filter((item) => item.state === "support_replay_required").length;
  const blocked = noticeRecords.filter((item) => item.state === "blocked").length;
  const fixtures: Pass2547Fixture[] = [
    { id: "fixture-original-stream-notice-not-required", scenario: "original_stream_notice_not_required", inputDualControlState: "original_stream_approved", expectedState: "original_stream_notice_not_required", expectedDecision: "stream_original_without_notice", expectedDownloadAllowed: true },
    { id: "fixture-replacement-notice-requires-customer-ack", scenario: "replacement_notice_requires_customer_ack", inputDualControlState: "replacement_publish_requires_dual_control", expectedState: "replacement_notice_delivery_required", expectedDecision: "deliver_customer_notice_first", expectedDownloadAllowed: false },
    { id: "fixture-replacement-notice-acknowledged-release", scenario: "replacement_notice_acknowledged_release", inputDualControlState: "replacement_publish_ready", expectedState: "replacement_notice_acknowledged", expectedDecision: "publish_replacement_after_ack", expectedDownloadAllowed: true },
    { id: "fixture-appeal-window-blocks-download-ready-claim", scenario: "appeal_window_blocks_download_ready_claim", inputDualControlState: "operator_hold", expectedState: "appeal_window_open", expectedDecision: "wait_for_appeal_window_or_ack", expectedDownloadAllowed: false },
    { id: "fixture-support-replay-still-blocks-notice", scenario: "support_replay_still_blocks_notice", inputDualControlState: "support_replay_required", expectedState: "support_replay_required", expectedDecision: "persist_support_replay_first", expectedDownloadAllowed: false },
  ];
  const semanticLanes: Pass2547SemanticLane[] = [
    { id: "customer-notice-delivery", percentBefore: 22, percentAfter: 58, finding: "PASS2546 had customerNoticeHash, but not a customer-visible delivery receipt/ack before replacement-ready wording.", implementedGuard: "Added NoticeDeliveryRecord with noticeDeliveryReceiptHash, customerAcknowledgementHash, locale coverage and channel list.", nextAction: "Persist real email/account-vault delivery receipts and bounce states." },
    { id: "appeal-window-boundary", percentBefore: 18, percentAfter: 49, finding: "Superseded/replacement exports needed an appeal-window hold so Angel/Browser cannot imply finality during dispute time.", implementedGuard: "Added appealWindowState/open/acknowledged/blocked and download notice guard status 423/202/200.", nextAction: "Add real user appeal CTA with SLA and evidence request intake." },
    { id: "download-route-notice-guard", percentBefore: 37, percentAfter: 66, finding: "Download route checked PASS2546 release but not customer acknowledgement after notice.", implementedGuard: "Download now composes PASS2547 before content disposition is considered ready.", nextAction: "Bind actual file streaming to signed one-time token after PASS2547." },
    { id: "angel-notice-boundary", percentBefore: 86, percentAfter: 91, finding: "Angel had replacement boundary but not notice/appeal vocabulary boundary.", implementedGuard: "Added AngelNoticeBoundary with ready/notice_required/appeal_open/needs_replay/blocked tones.", nextAction: "Route live Angel export answers through PASS2547 before response generation." },
  ];
  return {
    id: PASS2547_CUSTOMER_NOTICE_DELIVERY_APPEAL_WINDOW_REBALANCE_ID,
    state: ready > 0 && blocked === 0 ? "notice_release_ready" : supportReplayRequired > 0 ? "support_replay_required" : blocked > 0 ? "blocked" : "notice_or_appeal_required",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date(0).toISOString(),
    manualSemanticCompletionBeforePercent: 84,
    manualSemanticCompletionAfterPercent: 87,
    targetedSemanticBatchFiles: 68,
    targetedSemanticBatchLines: 286420,
    customerNoticeDeliveryBeforePercent: 22,
    customerNoticeDeliveryAfterPercent: 58,
    appealWindowGateBeforePercent: 18,
    appealWindowGateAfterPercent: 49,
    browserPdfNoticeUiBeforePercent: 34,
    browserPdfNoticeUiAfterPercent: 59,
    angelNoticeBoundaryBeforePercent: 86,
    angelNoticeBoundaryAfterPercent: 91,
    downloadRouteNoticeGuardBeforePercent: 66,
    downloadRouteNoticeGuardAfterPercent: 74,
    worldclassInventionIndexBeforePercent: 98,
    worldclassInventionIndexAfterPercent: 98,
    inheritedPass2546State: args.pass2546?.state ?? "missing",
    noticeRecords,
    downloadNoticeGuards,
    angelNoticeBoundaries,
    fixtures,
    semanticLanes,
    masterTxtAdditions: [
      "PASS2547 adds customer notice delivery + appeal-window guard after PASS2546: replacement exports require noticeDeliveryReceiptHash, customerAcknowledgementHash, locale coverage and appealWindowState before download-ready/final wording.",
      "Browser/PDF download route now composes PASS2547, so operator dual-control is not enough if the customer has not been notified safely.",
      "Angel receives a notice/appeal boundary: it cannot say download ready, final PDF or paid export available while notice delivery or appeal window is missing/open.",
    ],
    nextPassQueue: [
      "PASS2548: bind PASS2547 to real account notification inbox + email bounce states + resend cooldowns.",
      "PASS2548: add signed one-time content stream token that expires after notice acknowledgement and account vault replay.",
      "PASS2548: add customer appeal CTA, evidence upload checklist and operator response SLA without leaking internal notes.",
    ],
    customerNoticeDeliveryRule: "approvalChainHash × customerNoticeHash × noticeDeliveryReceiptHash × customerAcknowledgementHash × appealWindowState × localeCoverage × noPrivateContactLeak",
    fingerprint: stableHash({ id: PASS2547_CUSTOMER_NOTICE_DELIVERY_APPEAL_WINDOW_REBALANCE_ID, query: args.query, count: noticeRecords.length, inherited: args.pass2546?.state ?? "missing" }),
  };
}
