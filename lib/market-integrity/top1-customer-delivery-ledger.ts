import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";

export type Pass2821DeliveryStatus = "deliverable" | "queued_redacted" | "blocked";
export type Pass2821ChannelStatus = "enabled" | "notification_only" | "locked" | "blocked";
export type Pass2821ReleaseStatus = "pass" | "warn" | "block";
export type Pass2821DeliveryChannel = "download" | "account_vault" | "email_notice" | "api_handoff";

export type Pass2821DeliveryChannelDecision = {
  channel: Pass2821DeliveryChannel;
  status: Pass2821ChannelStatus;
  rule: string;
};

export type Pass2821CustomerDeliveryLedger = {
  schemaVersion: "pass2821_customer_delivery_ledger_v1";
  surface: string;
  tier: VelmereTier;
  status: Pass2821DeliveryStatus;
  deliveryChannels: Pass2821DeliveryChannelDecision[];
  parityEnvelope: {
    payloadHashRequired: true;
    sourceReceiptRootRequired: true;
    uiPreviewPdfDownloadAccountDeliveryMustMatch: true;
    payloadHashPresent: boolean;
    sourceReceiptRootPresent: boolean;
    rule: string;
  };
  privacyEnvelope: {
    emailAttachmentPolicy: "metadata_only_until_account_vault_token" | "allowed_with_expiring_token";
    accountVaultPolicy: string;
    rawProviderSecretPolicy: "never_deliver";
    piiMinimizationPolicy: string;
  };
  expiryAndReplay: {
    oneTimeTokenRequired: boolean;
    tokenPresent: boolean;
    expiresInMinutes: number;
    replayPolicy: string;
  };
  redactionReason: string | null;
  releaseGate: {
    status: Pass2821ReleaseStatus;
    reasons: string[];
  };
};

export const PASS2821_CUSTOMER_DELIVERY_ACCEPTANCE_GATES = [
  "PASS2821: Customer delivery cannot generate a new payload; it must deliver the exact UI/PDF/account payload hash and source receipt root.",
  "PASS2821: Pro/Advanced email is metadata-only unless account binding, server receipt, one-time report token and payload-hash parity pass.",
  "PASS2821: Download links are one-time, expiring and replay-guarded; Stripe success URL and wallet connect never count as delivery proof.",
  "PASS2821: Account vault delivery stores report ID, payload hash, source receipt root and entitlement receipt without exposing provider API secrets.",
  "PASS2821: Degraded/circuit-open runtime queues redacted delivery instead of attaching stale source receipts or fake charts.",
  "PASS2821: Human-review notes for Advanced cannot be delivered unless manual review receipt and private delivery boundary are present.",
] as const;

export function buildPass2821CustomerDeliveryLedger(args: {
  surface: string;
  tier: VelmereTier;
  paidEvidenceAllowed: boolean;
  accountBound: boolean;
  serverReceiptPresent: boolean;
  oneTimeReportTokenPresent: boolean;
  payloadHash?: string | null;
  sourceReceiptRoot?: string | null;
  pdfCleanroomStatus?: string | null;
  runtimeState?: string | null;
  manualReviewReceiptPresent?: boolean;
  expiresInMinutes?: number;
}): Pass2821CustomerDeliveryLedger {
  const payloadHashPresent = Boolean(args.payloadHash);
  const sourceReceiptRootPresent = Boolean(args.sourceReceiptRoot);
  const expiresInMinutes = Math.max(1, Math.min(args.expiresInMinutes ?? 15, 60));
  const hardBlocks: string[] = [];
  const warnings: string[] = [];

  if (args.pdfCleanroomStatus === "blocked") hardBlocks.push("PDF cleanroom blocked customer rendering.");
  if (args.runtimeState === "circuit_open") hardBlocks.push("Runtime provider circuit is open; do not deliver source-looking evidence.");
  if (!payloadHashPresent) warnings.push("Missing payload hash; queue delivery until UI/PDF/account parity can be proven.");
  if (!sourceReceiptRootPresent) warnings.push("Missing source receipt root; queue delivery until receipt bundle is anchored.");
  if ((args.tier === "Pro" || args.tier === "Advanced") && !args.paidEvidenceAllowed) warnings.push("Paid evidence is not allowed by entitlement decision.");
  if ((args.tier === "Pro" || args.tier === "Advanced") && !args.serverReceiptPresent) warnings.push("Server receipt missing for paid tier.");
  if (args.tier === "Advanced" && !args.manualReviewReceiptPresent) warnings.push("Advanced delivery lacks manual review receipt.");
  if (!args.oneTimeReportTokenPresent) warnings.push("One-time report token missing; download/email attachment remains locked.");
  if (!args.accountBound) warnings.push("Account vault binding missing; deliver notification only.");
  if (args.runtimeState === "degraded") warnings.push("Runtime degraded; deliver redacted/queued copy instead of source-looking live evidence.");

  const status: Pass2821DeliveryStatus = hardBlocks.length
    ? "blocked"
    : warnings.length
      ? "queued_redacted"
      : "deliverable";
  const releaseStatus: Pass2821ReleaseStatus = status === "blocked" ? "block" : status === "deliverable" ? "pass" : "warn";

  const downloadEnabled = status === "deliverable" && args.oneTimeReportTokenPresent && payloadHashPresent && sourceReceiptRootPresent;
  const accountEnabled = status === "deliverable" && args.accountBound && payloadHashPresent && sourceReceiptRootPresent;
  const emailEnabled = status === "deliverable" && args.accountBound && args.oneTimeReportTokenPresent;

  return {
    schemaVersion: "pass2821_customer_delivery_ledger_v1",
    surface: args.surface,
    tier: args.tier,
    status,
    deliveryChannels: [
      {
        channel: "download",
        status: hardBlocks.length ? "blocked" : downloadEnabled ? "enabled" : "locked",
        rule: "Download requires one-time token, payload-hash parity, source receipt root and entitlement/account boundary for paid tiers.",
      },
      {
        channel: "account_vault",
        status: hardBlocks.length ? "blocked" : accountEnabled ? "enabled" : "locked",
        rule: "Account vault receives report metadata, payload hash and receipt root; provider secrets and unredacted raw data never leave server policy.",
      },
      {
        channel: "email_notice",
        status: hardBlocks.length ? "blocked" : emailEnabled ? "enabled" : "notification_only",
        rule: "Email is notification/link-first; Pro/Advanced evidence stays behind expiring account-bound token unless all gates pass.",
      },
      {
        channel: "api_handoff",
        status: hardBlocks.length ? "blocked" : payloadHashPresent && sourceReceiptRootPresent ? "enabled" : "locked",
        rule: "API handoff carries delivery ledger + hashes, never a newly generated or mismatched report payload.",
      },
    ],
    parityEnvelope: {
      payloadHashRequired: true,
      sourceReceiptRootRequired: true,
      uiPreviewPdfDownloadAccountDeliveryMustMatch: true,
      payloadHashPresent,
      sourceReceiptRootPresent,
      rule: "Preview, PDF download, account vault and email/API handoff must all reference the same payload hash and receipt root.",
    },
    privacyEnvelope: {
      emailAttachmentPolicy: status === "deliverable" ? "allowed_with_expiring_token" : "metadata_only_until_account_vault_token",
      accountVaultPolicy: "Store minimal report metadata, receipt IDs and immutable hashes; never deliver provider API keys, hidden prompts or raw operator-only notes.",
      rawProviderSecretPolicy: "never_deliver",
      piiMinimizationPolicy: "Delivery ledger stores account/report binding and receipt IDs, not unnecessary personal data or raw community text.",
    },
    expiryAndReplay: {
      oneTimeTokenRequired: args.tier !== "Basic",
      tokenPresent: args.oneTimeReportTokenPresent,
      expiresInMinutes,
      replayPolicy: "Any consumed, expired or payload-mismatched token downgrades to redacted metadata and requires a fresh server-side receipt/token issue.",
    },
    redactionReason: warnings[0] ?? hardBlocks[0] ?? null,
    releaseGate: {
      status: releaseStatus,
      reasons: [...hardBlocks, ...warnings],
    },
  };
}
