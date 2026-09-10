import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2578AuditReportAssemblerReport } from "./audit-report-assembler";
import type { Pass2580CustomerSafeDeliveryDecisionReport } from "./customer-safe-delivery-decision";

export const PASS2581_AUDIT_VERSIONED_RECHECK_RECEIPT_ID = "audit-versioned-recheck-receipt" as const;

export type Pass2581ReceiptStatus = "draft" | "preview" | "recheck_required" | "ready_to_sign" | "locked";
export type Pass2581RecheckPriority = "low" | "normal" | "high" | "critical";
export type Pass2581ReceiptRowState = "locked" | "watch" | "missing" | "pending" | "ready";

export type Pass2581ReceiptRow = {
  label: string;
  state: Pass2581ReceiptRowState;
  output: string;
};

export type Pass2581VersionedReceipt = {
  receiptId: string;
  reportVersion: string;
  runId: string;
  contentHash: string;
  status: Pass2581ReceiptStatus;
  immutableFields: string[];
  mutableFields: string[];
};

export type Pass2581RecheckPlan = {
  priority: Pass2581RecheckPriority;
  intervalHours: number;
  nextCheckAt: string;
  triggers: string[];
  requiredBeforeFinal: string[];
};

export type Pass2581AuditVersionedRecheckReceiptReport = {
  passId: typeof PASS2581_AUDIT_VERSIONED_RECHECK_RECEIPT_ID;
  generatedAt: string;
  locale: string;
  target: {
    contractAddress?: string;
    projectName?: string;
    chain: string;
  };
  rule: string;
  customerRule: string;
  operatorRule: string;
  receipt: Pass2581VersionedReceipt;
  recheckPlan: Pass2581RecheckPlan;
  summary: {
    receiptStatus: Pass2581ReceiptStatus;
    customerRows: number;
    proPdfRows: number;
    operatorRows: number;
    recheckPriority: Pass2581RecheckPriority;
    nextCheckAt: string;
    canMergeVisual: boolean;
    canFinalSign: boolean;
  };
  customerRows: Pass2581ReceiptRow[];
  proPdfRows: Pass2581ReceiptRow[];
  operatorRows: Pass2581ReceiptRow[];
  visualMergeContract: {
    publicSlot: string;
    pdfSlot: string;
    adminSlot: string;
    rule: string;
    keepWired: string[];
  };
};

type VersionedReceiptInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  reportAssembler?: Pass2578AuditReportAssemblerReport | null;
  customerSafeDeliveryDecision?: Pass2580CustomerSafeDeliveryDecisionReport | null;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(C0_OR_TEMPLATE_META_PATTERN, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function stableHash(input: string) {
  return `vlm-${sha256Token(input, 24)}`;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function buildTriggers(args: { readiness: number; confidence: number; missing: number; blocked: number; deliveryBlocked: number; redaction: number }) {
  const triggers = [
    "source TTL expires",
    "risk score changes by 8+ points",
    "new owner/proxy/liquidity evidence appears",
  ];
  if (args.confidence < 70) triggers.push("source confidence below final-sign threshold");
  if (args.readiness < 78) triggers.push("delivery readiness below final threshold");
  if (args.missing > 0 || args.blocked > 0) triggers.push("missing or blocked claim remains unresolved");
  if (args.deliveryBlocked > 0) triggers.push("delivery gate is still blocked");
  if (args.redaction > 0) triggers.push("redaction gate is still open");
  return Array.from(new Set(triggers)).slice(0, 9);
}

function priorityFrom(args: { risk: number | null; reviewPriority: number; confidence: number; deliveryBlocked: number; missing: number; redaction: number }): Pass2581RecheckPriority {
  if (args.deliveryBlocked > 0 || (args.risk !== null && args.risk >= 76) || args.reviewPriority >= 82 || args.missing >= 4) return "critical";
  if ((args.risk !== null && args.risk >= 62) || args.reviewPriority >= 62 || args.confidence < 58 || args.redaction > 0 || args.missing > 0) return "high";
  if (args.confidence < 76) return "normal";
  return "low";
}

function statusFrom(args: { canFinalSign: boolean; deliveryBlocked: number; missing: number; redaction: number }): Pass2581ReceiptStatus {
  if (args.canFinalSign) return "ready_to_sign";
  if (args.deliveryBlocked > 0 || args.missing > 0 || args.redaction > 0) return "recheck_required";
  return "preview";
}

function row(label: string, state: Pass2581ReceiptRowState, output: string): Pass2581ReceiptRow {
  return { label, state, output };
}

export function buildPass2581AuditVersionedRecheckReceiptReport(input: VersionedReceiptInput): Pass2581AuditVersionedRecheckReceiptReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const now = new Date();
  const generatedAt = now.toISOString();
  const chain = clean(input.chain, 40) ?? input.reportAssembler?.target.chain ?? input.customerSafeDeliveryDecision?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? input.reportAssembler?.target.contractAddress ?? input.customerSafeDeliveryDecision?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? input.reportAssembler?.target.projectName ?? input.customerSafeDeliveryDecision?.target.projectName;
  const targetKey = contractAddress || projectName || "unknown-target";

  const assembler = input.reportAssembler;
  const delivery = input.customerSafeDeliveryDecision;
  const readiness = assembler?.finalVerdict.readinessScore ?? delivery?.summary.deliveryReadiness ?? 38;
  const confidence = assembler?.finalVerdict.sourceConfidence ?? 42;
  const risk = assembler?.finalVerdict.riskScore ?? null;
  const reviewPriority = assembler?.finalVerdict.reviewPriorityScore ?? 62;
  const missing = assembler?.summary.missing ?? 0;
  const blocked = assembler?.summary.blocked ?? 0;
  const deliveryBlocked = delivery?.summary.blockedGates ?? 1;
  const redaction = delivery?.summary.redactionGates ?? 1;
  const canFinalSign = readiness >= 82 && confidence >= 76 && deliveryBlocked === 0 && missing === 0 && blocked === 0 && redaction === 0;
  const priority = priorityFrom({ risk, reviewPriority, confidence, deliveryBlocked, missing: missing + blocked, redaction });
  const intervalHours = priority === "critical" ? 6 : priority === "high" ? 12 : priority === "normal" ? 24 : 72;
  const nextCheckAt = addHours(now, intervalHours);
  const triggers = buildTriggers({ readiness, confidence, missing, blocked, deliveryBlocked, redaction });
  const receiptStatus = statusFrom({ canFinalSign, deliveryBlocked, missing: missing + blocked, redaction });
  const reportVersion = `audit-v${canFinalSign ? 1 : 0}.${clamp(readiness, 0, 99)}.${clamp(confidence, 0, 99)}`;
  const runId = stableHash(`${targetKey}:${chain}:${generatedAt.slice(0, 13)}:${risk ?? "unavailable"}:${reviewPriority}:${confidence}:${readiness}`);
  const contentHash = stableHash(JSON.stringify({ targetKey, chain, risk, reviewPriority, confidence, readiness, missing, blocked, deliveryBlocked, redaction, status: delivery?.summary.deliveryStatus ?? "preview" }));

  const customerRows = [
    row(t(locale, "Wersja raportu", "Report-Version", "Report version"), "locked", `${reportVersion} · ${receiptStatus}`),
    row(t(locale, "Identyfikator audytu", "Audit-ID", "Audit ID"), "locked", runId),
    row(t(locale, "Hash treści", "Content-Hash", "Content hash"), "locked", contentHash),
    row(t(locale, "Następny re-check", "Naechster Re-check", "Next re-check"), priority === "critical" || priority === "high" ? "watch" : "ready", `${nextCheckAt} · ${priority}`),
    row(t(locale, "Finalny podpis", "Finale Freigabe", "Final sign-off"), canFinalSign ? "ready" : "pending", canFinalSign ? t(locale, "Gotowe do finalnego podpisu.", "Bereit fuer finale Freigabe.", "Ready for final sign-off.") : t(locale, "Wymaga re-check przed finalem.", "Re-check vor finaler Freigabe erforderlich.", "Requires re-check before final delivery.")),
  ];

  const proPdfRows = [
    ...customerRows,
    row("Immutable receipt fields", "locked", "target, chain, runId, contentHash, source confidence, risk/readiness snapshot"),
    row("Mutable receipt fields", "watch", "operator notes, redaction status, re-check result, final delivery timestamp"),
    row("Re-check triggers", "watch", triggers.join("; ")),
    row("Final-sign blockers", canFinalSign ? "ready" : "pending", [
      missing + blocked > 0 ? "resolve missing/blocked claims" : "claims ok",
      deliveryBlocked > 0 ? "resolve blocked delivery gates" : "delivery gates ok",
      redaction > 0 ? "finish redaction" : "redaction ok",
      confidence < 76 ? "raise confidence" : "confidence ok",
    ].join("; ")),
  ];

  const operatorRows = [
    row("Operator custody", "locked", "Do not overwrite prior run; append a new versioned receipt for each material re-check."),
    row("Visual merge", "ready", "User visual layer can replace layout, but must keep runId, contentHash, recheckPlan and source confidence wired."),
    row("Advanced private delivery", deliveryBlocked > 0 ? "pending" : "ready", "Only deliver after payment/scope/evidence/redaction gates are resolved server-side."),
    row("Re-check cadence", priority === "critical" ? "watch" : "ready", `${intervalHours}h interval while status is ${receiptStatus}.`),
  ];

  return {
    passId: PASS2581_AUDIT_VERSIONED_RECHECK_RECEIPT_ID,
    generatedAt,
    locale,
    target: { contractAddress, projectName, chain },
    rule: "Every report version gets a stable receipt, a redacted customer ID, a content hash, and a scheduled re-check plan before final delivery.",
    customerRule: t(locale, "Raport ma wersję, hash i plan ponownego sprawdzenia — UI może się zmienić, ale dowody zostają przypięte.", "Der Report hat Version, Hash und Re-check-Plan — UI darf sich aendern, Belege bleiben verankert.", "The report has a version, content hash and re-check plan — the UI can change, but evidence stays anchored."),
    operatorRule: "Never mutate a signed customer report in place. Append a new versioned receipt when sources, risk, redaction or delivery status changes.",
    receipt: {
      receiptId: `audit-receipt-${contentHash}`,
      reportVersion,
      runId,
      contentHash,
      status: receiptStatus,
      immutableFields: ["target", "chain", "runId", "contentHash", "riskScore", "sourceConfidence", "readinessScore", "generatedAt"],
      mutableFields: ["operatorNotes", "redactionStatus", "recheckResult", "customerDeliveryTimestamp", "supportHandoffState"],
    },
    recheckPlan: {
      priority,
      intervalHours,
      nextCheckAt,
      triggers,
      requiredBeforeFinal: [
        "no blocked delivery gates",
        "no unresolved missing material claims",
        "redaction firewall complete",
        "source confidence above final-sign threshold",
      ],
    },
    summary: {
      receiptStatus,
      customerRows: customerRows.length,
      proPdfRows: proPdfRows.length,
      operatorRows: operatorRows.length,
      recheckPriority: priority,
      nextCheckAt,
      canMergeVisual: true,
      canFinalSign,
    },
    customerRows,
    proPdfRows,
    operatorRows,
    visualMergeContract: {
      publicSlot: "basic_public_receipt_footer",
      pdfSlot: "pro_pdf_version_receipt_block",
      adminSlot: "advanced_operator_recheck_queue",
      rule: "Visual layer may redesign the cards, but must keep reportVersion, runId, contentHash, recheckPlan, sourceConfidence and final-sign status wired.",
      keepWired: ["receipt.reportVersion", "receipt.runId", "receipt.contentHash", "receipt.status", "recheckPlan.nextCheckAt", "recheckPlan.triggers", "summary.canFinalSign"],
    },
  };
}
