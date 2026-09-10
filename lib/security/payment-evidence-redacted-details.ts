import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { PaymentRuntimeEvidenceRecord } from "@/lib/security/payment-runtime-evidence";

export const PASS2373_PAYMENT_EVIDENCE_DETAIL_ID = "pass2373-payment-evidence-redacted-detail-expansion-route-health" as const;

export type Pass2373RouteHealthState = "ready" | "linked" | "missing" | "blocked";

export type Pass2373PaymentEvidenceDetail = {
  passId: typeof PASS2373_PAYMENT_EVIDENCE_DETAIL_ID;
  safeId: string;
  area: string;
  status: string;
  scenario: string;
  createdAt: string;
  label: string;
  summary: string;
  safeNotes?: string;
  evidenceRef: string;
  linkedRefs: {
    auditQueueId?: string;
    accountMessageId?: string;
    accountId?: string;
    entitlementRef?: string;
    paymentProviderRef: "redacted_present" | "none";
  };
  routeHealth: Array<{
    key: string;
    label: string;
    state: Pass2373RouteHealthState;
    summary: string;
  }>;
  checklist: string[];
  safeBoundary: string;
};

const SECRET_PATTERNS = [
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]+\b/g,
  /\bwhsec_[A-Za-z0-9_-]+\b/g,
  /\bBearer\s+[A-Za-z0-9._-]+\b/gi,
  /\b(?:\d[ -]*?){13,19}\b/g,
  /\b(?:evt|cs|pi|ch|pm|seti|sub)_[A-Za-z0-9_-]{8,}\b/g,
  /\b\d{6}\b/g,
];

function stableHash(value: string) {
  return sha256Token(value, 24);
}

export function pass2373RedactPaymentEvidenceText(value: unknown, fallback = "redacted payment evidence", max = 180) {
  if (typeof value !== "string") return fallback;
  let cleaned = value.replace(/[<>{}[\]`$\\]/g, " ").replace(/\s+/g, " ").trim();
  for (const pattern of SECRET_PATTERNS) cleaned = cleaned.replace(pattern, "[redacted]");
  cleaned = cleaned.replace(/raw\s+(?:stripe|webhook|blik|card)\s+payload/gi, "redacted payment payload");
  return cleaned.slice(0, max) || fallback;
}

function safeRef(value: unknown, prefix: string) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const redacted = pass2373RedactPaymentEvidenceText(value, "", 64);
  return redacted.includes("[redacted]") ? `${prefix}_${stableHash(value).slice(0, 10)}` : redacted;
}

function routeState(present: boolean, blocked = false): Pass2373RouteHealthState {
  if (blocked) return "blocked";
  return present ? "ready" : "missing";
}

export function buildPass2373PaymentEvidenceDetail(
  row: PaymentRuntimeEvidenceRecord,
  context: {
    customerReport?: string;
    safePdfPacket?: string;
    adminReplayBoard?: string;
    hasAccountMessage?: boolean;
  } = {},
): Pass2373PaymentEvidenceDetail {
  const linkedToAudit = Boolean(row.auditQueueId || row.accountMessageId || row.accountId);
  const paymentProviderRefPresent = Boolean(row.stripeEventId || row.stripeSessionId);
  const entitlementRef = safeRef(row.entitlementId, "entitlement");
  const safeEvidenceRef = safeRef(row.evidenceRef, "evidence") ?? `evidence_${stableHash(`${row.id}:${row.createdAt}`).slice(0, 10)}`;
  const label = pass2373RedactPaymentEvidenceText(row.label, "Payment evidence row", 110);
  const summary = pass2373RedactPaymentEvidenceText(row.summary || row.evidenceRef, "Safe payment evidence summary is available.", 260);
  const safeNotes = row.safeNotes ? pass2373RedactPaymentEvidenceText(row.safeNotes, "", 260) : undefined;

  return {
    passId: PASS2373_PAYMENT_EVIDENCE_DETAIL_ID,
    safeId: `ev_${stableHash(row.id || `${row.area}:${row.createdAt}:${safeEvidenceRef}`).slice(0, 12)}`,
    area: pass2373RedactPaymentEvidenceText(row.area, "release_gate", 48),
    status: pass2373RedactPaymentEvidenceText(row.status, "manual", 48),
    scenario: pass2373RedactPaymentEvidenceText(row.scenarioId, "no scenario", 90),
    createdAt: row.createdAt,
    label,
    summary,
    safeNotes,
    evidenceRef: safeEvidenceRef,
    linkedRefs: {
      auditQueueId: safeRef(row.auditQueueId, "queue"),
      accountMessageId: safeRef(row.accountMessageId, "message"),
      accountId: safeRef(row.accountId, "account"),
      entitlementRef,
      paymentProviderRef: paymentProviderRefPresent ? "redacted_present" : "none",
    },
    routeHealth: [
      {
        key: "audit_inbox_focus",
        label: "Audit Inbox focus",
        state: linkedToAudit ? "linked" : "missing",
        summary: linkedToAudit ? "Evidence can focus an audit request/message/account lane." : "No audit/account link stored on this evidence row yet.",
      },
      {
        key: "account_message",
        label: "Account message",
        state: routeState(Boolean(context.hasAccountMessage)),
        summary: context.hasAccountMessage ? "Linked account message is available in the drawer." : "Account message is not loaded for this evidence focus.",
      },
      {
        key: "customer_report_route",
        label: "Customer report route",
        state: routeState(Boolean(context.customerReport)),
        summary: context.customerReport ? "Customer-safe report route is present." : "Report route appears after deterministic customer-safe delivery gates pass.",
      },
      {
        key: "safe_pdf_packet",
        label: "Safe PDF packet",
        state: routeState(Boolean(context.safePdfPacket)),
        summary: context.safePdfPacket ? "Safe PDF/export route is present." : "PDF packet is not attached yet.",
      },
      {
        key: "raw_payment_payload",
        label: "Raw payment payload",
        state: "blocked",
        summary: "Raw Stripe/webhook/BLIK/card data is intentionally unavailable in this detail view.",
      },
    ],
    checklist: [
      linkedToAudit ? "Linked refs are present for operator follow-up." : "Link this row to auditQueueId/accountMessageId before customer delivery.",
      context.customerReport ? "Customer route exists; verify customer copy stays evidence-bound." : "Use the customer-safe delivery path after deterministic gates pass; mark_ready is optional metadata only.",
      context.safePdfPacket ? "PDF packet route exists; keep it redacted and customer-safe." : "Attach PDF before final delivery if customer needs a packet.",
      "Do not paste raw payment payloads, card data, BLIK codes, secrets, seed phrases or exploit instructions into notes.",
    ],
    safeBoundary:
      "PASS2373 evidence expansion shows only redacted labels, summaries, safe references, linked account/request ids and route health. It must not expose raw Stripe payloads, raw webhook bodies, BLIK codes, card data, secrets, seed phrases, exploit instructions, Certified Safe claims or investment advice.",
  };
}
