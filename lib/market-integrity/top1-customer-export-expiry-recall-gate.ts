import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2838CustomerExportRedactionPacketGate } from "@/lib/market-integrity/top1-customer-export-redaction-packet-gate";

export type Pass2839CustomerExportExpiryRecallState =
  | "not_exportable"
  | "active_window"
  | "expires_soon"
  | "expired"
  | "retry_budget_exhausted"
  | "recall_required"
  | "recalled"
  | "retention_window_closed";

export type Pass2839CustomerExportExpiryRecallGate = {
  schemaVersion: "pass2839_customer_export_expiry_recall_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  recallState: Pass2839CustomerExportExpiryRecallState;
  recallReadinessScore: number;
  expiryEnvelope: {
    exportPacketId: string | null;
    activeLinkId: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    minutesUntilExpiry: number | null;
    expiryWindowMinutes: number;
    recallReceiptId: string | null;
    resendIdempotencyKey: string | null;
    retryBudgetLimit: number;
    retryBudgetUsed: number;
    supportAttachmentRetentionHours: number;
    auditTimelineHash: string | null;
    exportPacketRedacted: boolean;
    channelReceiptBound: boolean;
    payloadHashBound: boolean;
    sourceReceiptRootBound: boolean;
    supportSlaBound: boolean;
  };
  recallPolicy: {
    canServeActiveLink: boolean;
    canResendCustomerNotice: boolean;
    canAttachSupportExport: boolean;
    canRecallCustomerPacket: boolean;
    canClaimWorldClass100: false;
    reason: string;
  };
  recallRiskSignals: {
    previousExportBlocked: boolean;
    missingActiveLink: boolean;
    missingExpiry: boolean;
    linkExpired: boolean;
    linkExpiresSoon: boolean;
    recallRequestedWithoutReceipt: boolean;
    retryBudgetExceeded: boolean;
    missingResendIdempotencyKey: boolean;
    retentionWindowClosed: boolean;
    missingAuditTimeline: boolean;
    payloadOrSourceRootDrift: boolean;
  };
  operatorNextActions: string[];
};

export const PASS2839_CUSTOMER_EXPORT_EXPIRY_RECALL_ACCEPTANCE_GATES = [
  "PASS2839: Customer export links must be time-boxed; a redacted packet is not enough without issuedAt/expiresAt and an active-link receipt.",
  "PASS2839: Recall/revoke is a first-class customer export state; recalled packets freeze account download, email resend, API handoff and support attachment until a recall receipt is present.",
  "PASS2839: Customer download retries and email/API resends require an idempotency key and retry budget so support cannot accidentally duplicate paid evidence delivery.",
  "PASS2839: Support attachments have a retention window and audit timeline hash; expired retention or missing timeline blocks support handoff even if the packet was previously redacted.",
  "PASS2839: Payload/source-root drift, expired links, exhausted retry budget or missing recall receipt prevent launch-ready/customer-safe export claims.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function redact(value: string | null | undefined) {
  if (!value) return null;
  const clean = String(value).replace(/[^a-zA-Z0-9_-]/g, "");
  if (clean.length <= 10) return `${clean.slice(0, 3)}…redacted`;
  return `${clean.slice(0, 5)}…${clean.slice(-5)}`;
}

function timeValue(value: string | null | undefined) {
  if (!value) return null;
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? stamp : null;
}

function addMinutesIso(value: string, minutes: number) {
  const stamp = timeValue(value) ?? Date.now();
  return new Date(stamp + minutes * 60000).toISOString();
}

function minutesBetween(fromIso: string, toIso: string) {
  const from = timeValue(fromIso);
  const to = timeValue(toIso);
  if (from === null || to === null) return null;
  return Math.round((to - from) / 60000);
}

export function buildPass2839CustomerExportExpiryRecallGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportRedactionPacketGate: Pass2838CustomerExportRedactionPacketGate;
  generatedAt?: string;
  activeLinkId?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  expiryWindowMinutes?: number;
  recallRequested?: boolean;
  recallReceiptId?: string | null;
  resendRequested?: boolean;
  resendIdempotencyKey?: string | null;
  retryBudgetLimit?: number;
  retryBudgetUsed?: number;
  supportAttachmentRetentionHours?: number;
  supportAttachmentCreatedAt?: string | null;
  auditTimelineHash?: string | null;
  payloadOrSourceRootDrift?: boolean;
}): Pass2839CustomerExportExpiryRecallGate {
  const exportGate = args.customerExportRedactionPacketGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const expiryWindowMinutes = args.expiryWindowMinutes ?? (exportGate.tier === "Basic" ? 30 : exportGate.tier === "Pro" ? 20 : 15);
  const issuedAt = args.issuedAt ?? generatedAt;
  const expiresAt = args.expiresAt ?? addMinutesIso(issuedAt, expiryWindowMinutes);
  const minutesUntilExpiry = expiresAt ? minutesBetween(generatedAt, expiresAt) : null;
  const retryBudgetLimit = Math.max(0, Math.floor(args.retryBudgetLimit ?? (exportGate.tier === "Basic" ? 1 : exportGate.tier === "Pro" ? 2 : 3)));
  const retryBudgetUsed = Math.max(0, Math.floor(args.retryBudgetUsed ?? 0));
  const supportAttachmentRetentionHours = Math.max(0, Math.floor(args.supportAttachmentRetentionHours ?? 72));
  const supportAttachmentMinutesSinceCreate = args.supportAttachmentCreatedAt ? minutesBetween(args.supportAttachmentCreatedAt, generatedAt) : null;
  const supportAttachmentAgeHours = supportAttachmentMinutesSinceCreate == null ? null : supportAttachmentMinutesSinceCreate / 60;

  const previousExportAllowed = exportGate.exportPolicy.canExportCustomerPacket;
  const activeLinkPresent = Boolean(args.activeLinkId);
  const expiryPresent = Boolean(issuedAt && expiresAt && minutesUntilExpiry !== null);
  const linkExpired = expiryPresent && Number(minutesUntilExpiry) <= 0;
  const linkExpiresSoon = expiryPresent && Number(minutesUntilExpiry) > 0 && Number(minutesUntilExpiry) <= 5;
  const recallRequested = Boolean(args.recallRequested || exportGate.exportRiskSignals.exportRevoked);
  const recallReceiptPresent = Boolean(args.recallReceiptId);
  const resendRequested = Boolean(args.resendRequested);
  const resendIdempotencyReady = !resendRequested || Boolean(args.resendIdempotencyKey);
  const retryBudgetExceeded = retryBudgetUsed >= retryBudgetLimit;
  const retentionWindowClosed = supportAttachmentAgeHours != null && supportAttachmentAgeHours > supportAttachmentRetentionHours;
  const auditTimelineReady = Boolean(args.auditTimelineHash);
  const payloadOrSourceRootDrift = Boolean(args.payloadOrSourceRootDrift || exportGate.exportRiskSignals.payloadOrSourceRootDrift);
  const exportPacketRedacted = exportGate.exportPolicy.canExportCustomerPacket && !exportGate.exportRiskSignals.rawTokenExposureRisk && !exportGate.exportRiskSignals.rawPaymentExposureRisk && !exportGate.exportRiskSignals.privateNoteExposureRisk;
  const channelReceiptBound = !exportGate.exportRiskSignals.exportChannelReceiptMissing;
  const payloadHashBound = exportGate.exportEnvelope.payloadHashBound;
  const sourceReceiptRootBound = exportGate.exportEnvelope.sourceReceiptRootBound;
  const supportSlaBound = exportGate.exportEnvelope.supportSlaBound;

  const linkCanBeServed = Boolean(
    previousExportAllowed &&
      activeLinkPresent &&
      expiryPresent &&
      !linkExpired &&
      !recallRequested &&
      !retryBudgetExceeded &&
      resendIdempotencyReady &&
      !retentionWindowClosed &&
      auditTimelineReady &&
      !payloadOrSourceRootDrift,
  );

  const recallState: Pass2839CustomerExportExpiryRecallState = !previousExportAllowed
    ? "not_exportable"
    : recallRequested && recallReceiptPresent
      ? "recalled"
      : recallRequested
        ? "recall_required"
        : retentionWindowClosed
          ? "retention_window_closed"
          : retryBudgetExceeded
            ? "retry_budget_exhausted"
            : linkExpired
              ? "expired"
              : linkExpiresSoon
                ? "expires_soon"
                : "active_window";

  const recallReadinessScore = clamp(
    exportGate.exportReadinessScore +
      (previousExportAllowed ? 10 : -30) +
      (activeLinkPresent ? 12 : -16) +
      (expiryPresent ? 12 : -18) +
      (!linkExpired ? 10 : -24) +
      (!linkExpiresSoon ? 4 : -6) +
      (recallRequested ? (recallReceiptPresent ? 8 : -26) : 4) +
      (resendIdempotencyReady ? 10 : -18) +
      (!retryBudgetExceeded ? 8 : -24) +
      (!retentionWindowClosed ? 8 : -18) +
      (auditTimelineReady ? 12 : -20) +
      (!payloadOrSourceRootDrift ? 12 : -30),
  );

  const reason = !previousExportAllowed
    ? "Previous customer export redaction gate is not clear; expiry/recall cannot make an unsafe packet deliverable."
    : recallRequested && !recallReceiptPresent
      ? "Recall was requested but no recall receipt is attached; freeze download, email/API resend and support attachment."
      : recallRequested && recallReceiptPresent
        ? "Export packet was recalled with a receipt; old links and support attachments remain frozen until a new redacted packet is issued."
        : retentionWindowClosed
          ? "Support attachment retention window is closed; regenerate or re-approve the export handoff before support can attach it."
          : retryBudgetExceeded
            ? "Customer retry budget is exhausted; manual support review is required before another download/email/API resend."
            : linkExpired
              ? "Customer export link expired; issue a new idempotent link tied to the same payload/source root or replay the packet."
              : !auditTimelineReady
                ? "Export audit timeline hash is missing; the customer packet cannot be traced across download/email/API/support channels."
                : payloadOrSourceRootDrift
                  ? "Payload/source-root drift detected; expire current link, recall stale packet and reseal before resend."
                  : linkExpiresSoon
                    ? "Customer export link is still active but expires soon; resend only with idempotency and retry-budget controls."
                    : "Customer export link is time-boxed, traceable and recall-aware; delivery can proceed under expiry watch.";

  return {
    schemaVersion: "pass2839_customer_export_expiry_recall_gate_v1",
    surface: args.surface,
    tier: args.tier ?? exportGate.tier,
    releasePacketId: exportGate.releasePacketId,
    sealId: exportGate.sealId,
    generatedAt,
    recallState,
    recallReadinessScore,
    expiryEnvelope: {
      exportPacketId: exportGate.exportEnvelope.exportPacketId,
      activeLinkId: redact(args.activeLinkId),
      issuedAt,
      expiresAt,
      minutesUntilExpiry,
      expiryWindowMinutes,
      recallReceiptId: redact(args.recallReceiptId),
      resendIdempotencyKey: redact(args.resendIdempotencyKey),
      retryBudgetLimit,
      retryBudgetUsed,
      supportAttachmentRetentionHours,
      auditTimelineHash: redact(args.auditTimelineHash),
      exportPacketRedacted,
      channelReceiptBound,
      payloadHashBound,
      sourceReceiptRootBound,
      supportSlaBound,
    },
    recallPolicy: {
      canServeActiveLink: linkCanBeServed,
      canResendCustomerNotice: linkCanBeServed && resendIdempotencyReady && retryBudgetUsed < retryBudgetLimit,
      canAttachSupportExport: linkCanBeServed && !retentionWindowClosed,
      canRecallCustomerPacket: previousExportAllowed && (!recallRequested || recallReceiptPresent),
      canClaimWorldClass100: false,
      reason,
    },
    recallRiskSignals: {
      previousExportBlocked: !previousExportAllowed,
      missingActiveLink: !activeLinkPresent,
      missingExpiry: !expiryPresent,
      linkExpired,
      linkExpiresSoon,
      recallRequestedWithoutReceipt: recallRequested && !recallReceiptPresent,
      retryBudgetExceeded,
      missingResendIdempotencyKey: !resendIdempotencyReady,
      retentionWindowClosed,
      missingAuditTimeline: !auditTimelineReady,
      payloadOrSourceRootDrift,
    },
    operatorNextActions: [
      previousExportAllowed ? "PASS2838 redaction packet is clear; keep expiry and recall controls bound to the same packet." : "Do not issue export links until PASS2838 redaction packet gate clears.",
      activeLinkPresent ? "Active link ID is present; verify it is single-packet and non-reusable after expiry." : "Create a customer-facing active link receipt with a short expiry window.",
      expiryPresent ? "Expiry metadata is present; enforce it on account download, email/API and support attachment paths." : "Attach issuedAt/expiresAt before customer export can be served.",
      recallRequested ? (recallReceiptPresent ? "Recall receipt is attached; freeze old links and prepare a new packet only after replay." : "Recall requested without receipt; freeze all delivery channels now.") : "No recall request is active; keep recall path available for operator/customer support.",
      resendIdempotencyReady ? "Resend idempotency is ready or not required." : "Add resend idempotency key before email/API resend.",
      retryBudgetExceeded ? "Retry budget exhausted; route to manual support review." : "Retry budget still has capacity under current policy.",
      auditTimelineReady ? "Audit timeline hash is attached; channel handoffs are traceable." : "Attach export audit timeline hash before customer-safe delivery claim.",
    ],
  };
}
