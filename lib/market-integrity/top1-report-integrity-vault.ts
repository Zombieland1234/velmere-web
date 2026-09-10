import type { ReportAccessDecision } from "@/lib/market-integrity/top1-entitlement-report-access";
import type { SourceReceipt, VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2814SourcePoisoningFirewall } from "@/lib/market-integrity/top1-source-poisoning-ssrf-firewall";

import { sha256Token } from "@/lib/security/cryptographic-digest";
import { classifyReceiptDigest, type ReceiptDigestKind } from "@/lib/security/receipt-digest-compatibility";
export type Pass2815IntegrityGateStatus = "pass" | "warn" | "block";

export type Pass2815IntegrityGate = {
  status: Pass2815IntegrityGateStatus;
  reasons: string[];
};

export type Pass2815ReceiptVaultEntry = {
  receiptId: string;
  sourceFamily: SourceReceipt["sourceFamily"];
  usedInLanes: string[];
  receiptHash: string;
  retentionClass: "public_metadata" | "paid_receipt" | "advanced_private";
  immutable: boolean;
};

export type Pass2815ReportIntegrityVault = {
  schemaVersion: "pass2815_report_integrity_vault_v1";
  reportId: string;
  tier: VelmereTier;
  payloadHash: string;
  payloadHashKind: ReceiptDigestKind;
  sourceReceiptMerkleRoot: string;
  receiptEntries: Pass2815ReceiptVaultEntry[];
  reportAccessReplayGuard: {
    accountBound: boolean;
    tokenBound: boolean;
    payloadHashBound: boolean;
    paidEvidenceAllowed: boolean;
    replayDecision: "allow_basic_preview" | "allow_paid_render" | "deny_paid_render";
  };
  abuseBudget: {
    heavyReportRunsPerMinute: number;
    pdfDownloadsPerHour: number;
    sourceReceiptExportsPerDay: number;
    degradedMode: "skeleton_receipts" | "metadata_only" | "full_receipts";
  };
  immutableLedgerPolicy: {
    appendOnly: boolean;
    redactSecretsBeforeWrite: boolean;
    doNotStoreRawHtml: boolean;
    doNotStoreApiKeys: boolean;
    customerCopy: string;
  };
  releaseGate: Pass2815IntegrityGate;
  rendererRules: string[];
};

export const PASS2815_REPORT_INTEGRITY_ACCEPTANCE_GATES = [
  "Every PDF/report payload needs a stable payload hash before paid evidence can render.",
  "Source receipts must be reduced to receipt IDs/hashes/family/lane metadata before persistence; no raw provider HTML or secrets in the vault.",
  "Paid report access requires account binding, server receipt decision, one-time token binding and exact payload-hash parity.",
  "Report replay mismatches must render Basic preview or access denial, never Pro/Advanced source receipts.",
  "Provider timeout, blocked SSRF/source-poisoning policy or missing receipts must create visible missing evidence and confidence cap.",
  "Community claims cannot become report receipts without moderation/source-upgrade and a receipt hash.",
] as const;

function gate(reasons: string[]): Pass2815IntegrityGate {
  if (!reasons.length) return { status: "pass", reasons: [] };
  const blocking = reasons.some((reason) => reason.includes("missing_payload_hash") || reason.includes("poisoning_block") || reason.includes("paid_access_denied") || reason.includes("legacy_payload_hash") || reason.includes("unknown_payload_hash"));
  return { status: blocking ? "block" : "warn", reasons };
}

export function stablePass2815Hash(input: string): string {
  return `vlm_${sha256Token(input, 32)}`;
}

function receiptRetentionClass(tier: VelmereTier): Pass2815ReceiptVaultEntry["retentionClass"] {
  if (tier === "Advanced") return "advanced_private";
  if (tier === "Pro") return "paid_receipt";
  return "public_metadata";
}

export function buildPass2815ReportIntegrityVault(args: {
  reportId: string;
  tier: VelmereTier;
  payloadHash?: string | null;
  generatedAt: string;
  sourceReceipts: SourceReceipt[];
  reportAccessDecision: ReportAccessDecision;
  sourcePoisoningFirewall?: Pass2814SourcePoisoningFirewall | null;
}): Pass2815ReportIntegrityVault {
  const canonicalReceiptString = args.sourceReceipts
    .map((receipt) => `${receipt.receiptId}:${receipt.sourceFamily}:${receipt.usedInLanes.join("|")}:${receipt.observedAt}:${receipt.qualityScore}`)
    .join(";");
  const payloadHash = args.payloadHash?.trim() || stablePass2815Hash(`${args.reportId}:${args.tier}:${args.generatedAt}:${canonicalReceiptString}`);
  const payloadHashClassification = classifyReceiptDigest(payloadHash);
  const receiptEntries = args.sourceReceipts.map((receipt) => ({
    receiptId: receipt.receiptId,
    sourceFamily: receipt.sourceFamily,
    usedInLanes: receipt.usedInLanes,
    receiptHash: stablePass2815Hash(`${payloadHash}:${receipt.receiptId}:${receipt.sourceFamily}:${receipt.usedInLanes.join("|")}`),
    retentionClass: receiptRetentionClass(args.tier),
    immutable: true,
  }));
  const sourceReceiptMerkleRoot = stablePass2815Hash(receiptEntries.map((entry) => entry.receiptHash).join("|") || `${payloadHash}:no-receipts`);
  const reasons: string[] = [];
  if (!payloadHash) reasons.push("missing_payload_hash");
  if ((args.tier === "Pro" || args.tier === "Advanced") && !payloadHashClassification.cryptographic) {
    reasons.push(payloadHashClassification.legacy ? "legacy_payload_hash_requires_sha256_reissue" : "unknown_payload_hash_algorithm");
  }
  if (!receiptEntries.length) reasons.push("no_source_receipts_for_vault");
  if (args.sourcePoisoningFirewall?.releaseGate.status === "block") reasons.push("source_poisoning_block_active");
  if ((args.tier === "Pro" || args.tier === "Advanced") && !args.reportAccessDecision.paidEvidenceAllowed) reasons.push("paid_access_denied_or_incomplete_receipt_chain");
  if (args.tier === "Advanced" && !args.reportAccessDecision.requiredSignals.some((signal) => signal.id === "manual_review" && signal.state === "present")) reasons.push("advanced_manual_review_boundary_missing");

  const paidEvidenceAllowed = args.reportAccessDecision.paidEvidenceAllowed;
  const replayDecision = args.tier === "Basic" ? "allow_basic_preview" : paidEvidenceAllowed ? "allow_paid_render" : "deny_paid_render";
  return {
    schemaVersion: "pass2815_report_integrity_vault_v1",
    reportId: args.reportId,
    tier: args.tier,
    payloadHash,
    payloadHashKind: payloadHashClassification.kind,
    sourceReceiptMerkleRoot,
    receiptEntries,
    reportAccessReplayGuard: {
      accountBound: Boolean(args.reportAccessDecision.requiredSignals.some((signal) => signal.id === "account_id" && signal.state === "present")),
      tokenBound: Boolean(args.reportAccessDecision.requiredSignals.some((signal) => signal.id === "report_token" && signal.state === "present")),
      payloadHashBound: Boolean(args.reportAccessDecision.requiredSignals.some((signal) => signal.id === "payload_hash" && signal.state === "present")),
      paidEvidenceAllowed,
      replayDecision,
    },
    abuseBudget: {
      heavyReportRunsPerMinute: args.tier === "Basic" ? 12 : 4,
      pdfDownloadsPerHour: args.tier === "Basic" ? 12 : 3,
      sourceReceiptExportsPerDay: args.tier === "Advanced" ? 8 : args.tier === "Pro" ? 3 : 0,
      degradedMode: paidEvidenceAllowed ? "full_receipts" : args.tier === "Basic" ? "metadata_only" : "skeleton_receipts",
    },
    immutableLedgerPolicy: {
      appendOnly: true,
      redactSecretsBeforeWrite: true,
      doNotStoreRawHtml: true,
      doNotStoreApiKeys: true,
      customerCopy: "Report evidence is stored as signed metadata and hashes. Raw provider HTML, API keys and private notes must not be exposed in customer PDF or logs.",
    },
    releaseGate: gate(reasons),
    rendererRules: [
      "If replayDecision is deny_paid_render, render Basic preview + locked evidence boundary only.",
      "If receipt vault status is warn/block, PDF must show missing/blocked evidence rows before recommendations.",
      "The same payloadHash and sourceReceiptMerkleRoot must appear in UI preview, PDF download and account delivery.",
      "Receipt hashes may be visible; raw provider bodies, secrets and untrusted HTML must never render.",
    ],
  };
}

export function buildPass2815CommunityModerationVault(args: {
  moderationState: string;
  linkState: string;
  authorId?: string | null;
  bodyLength: number;
  tagCount: number;
}) {
  const canonical = `${args.moderationState}:${args.linkState}:${args.authorId ?? "anonymous"}:${args.bodyLength}:${args.tagCount}`;
  const needsModerator = args.moderationState !== "clean" || args.linkState !== "clean";
  return {
    schemaVersion: "pass2815_community_moderation_vault_v1" as const,
    moderationHash: stablePass2815Hash(canonical),
    needsModerator,
    evidenceUpgradeAllowed: !needsModerator,
    rendererRule: needsModerator
      ? "Community post remains opinion/source request; it cannot be promoted to source receipt or PDF evidence."
      : "Community post is still non-financial opinion unless a moderator/source adapter creates a separate receipt.",
  };
}
