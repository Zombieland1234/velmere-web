import { sha256Token } from "@/lib/security/cryptographic-digest";
export type Pass2823AdvancedReviewDecision =
  | "not_required"
  | "ready_for_operator_review"
  | "operator_signed"
  | "review_receipt_missing"
  | "review_payload_mismatch"
  | "review_rejected"
  | "review_stale"
  | "locked_by_entitlement";

export type Pass2823OperatorReviewGate = {
  schemaVersion: "pass2823_advanced_human_review_signoff_gate_v1";
  surface: string;
  tier: string;
  decision: Pass2823AdvancedReviewDecision;
  customerVisibleState: string;
  paidEvidenceAllowed: boolean;
  manualReviewRequired: boolean;
  manualReviewReceiptId: string | null;
  operatorPseudonym: string | null;
  operatorSignatureHash: string | null;
  payloadHash: string | null;
  sourceReceiptRoot: string | null;
  reviewPayloadHash: string | null;
  reviewAgeMinutes: number | null;
  reviewExpiresInMinutes: number;
  reviewerNoteEnvelope: {
    status: "not_required" | "redacted_safe" | "missing" | "blocked";
    sanitizedPreview: string;
    blockedReasons: string[];
    rule: string;
  };
  operatorChecklist: Array<{
    id: string;
    label: string;
    status: "passed" | "blocked" | "missing" | "not_required";
  }>;
  releaseGate: {
    status: "allow" | "review" | "block";
    reason: string;
  };
  pdfRenderRule: string;
  timeline: Array<{
    kind: "request" | "assignment" | "signoff" | "delivery";
    status: string;
  }>;
};

export const PASS2823_ADVANCED_HUMAN_REVIEW_ACCEPTANCE_GATES = [
  "PASS2823: Advanced human-review notes require a manual review receipt; Pro automation cannot silently impersonate Advanced review.",
  "PASS2823: Operator notes are an addendum bound to the existing payloadHash and sourceReceiptRoot; they cannot create new source truth or mutate the report payload.",
  "PASS2823: Reviewer notes must be customer-safe, redacted and free of seed phrases, private keys, buy/sell prompts and guaranteed-language claims.",
  "PASS2823: Operator identity is pseudonymous/signed; raw personal identity is not exposed in customer PDF/API payloads.",
  "PASS2823: Stale/rejected/payload-mismatched manual QA blocks Advanced evidence and downgrades to Pro/metadata until a fresh review is signed.",
] as const;

function normalizeNullable(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function stableHash(input: string) {
  return `vlm-${sha256Token(input, 24)}`;
}

function unsafeNoteReasons(note: string) {
  const lower = note.toLowerCase();
  const reasons: string[] = [];
  if (/seed phrase|private key|mnemonic|recovery phrase/.test(lower)) reasons.push("secret_material_redaction_required");
  if (/buy now|sell now|guaranteed|risk[- ]?free|100% safe|secure\b/.test(lower)) reasons.push("unsafe_claim_or_trade_prompt");
  if (/<script|javascript:|data:/i.test(note)) reasons.push("html_script_or_unsafe_url");
  if (note.length > 900) reasons.push("note_too_long_for_customer_pdf_preview");
  return reasons;
}

function sanitizeNote(note?: string | null) {
  const raw = normalizeNullable(note);
  if (!raw) return "Manual reviewer note pending.";
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/seed phrase|private key|mnemonic|recovery phrase/gi, "[redacted secret material]")
    .replace(/buy now|sell now/gi, "[redacted trade prompt]")
    .replace(/guaranteed|risk[- ]?free|100% safe|secure\b/gi, "evidence-limited")
    .slice(0, 420);
}

export function buildPass2823AdvancedHumanReviewGate(args: {
  surface: string;
  tier: string;
  paidEvidenceAllowed?: boolean;
  manualReviewReceiptId?: string | null;
  operatorId?: string | null;
  operatorSignature?: string | null;
  payloadHash?: string | null;
  sourceReceiptRoot?: string | null;
  reviewPayloadHash?: string | null;
  reviewerNote?: string | null;
  generatedAt?: string | null;
  reviewedAt?: string | null;
  reviewRejected?: boolean;
  runtimeState?: string | null;
  tokenState?: string | null;
  expiresInMinutes?: number;
}): Pass2823OperatorReviewGate {
  const tier = args.tier;
  const advanced = tier === "Advanced";
  const receipt = normalizeNullable(args.manualReviewReceiptId);
  const operatorId = normalizeNullable(args.operatorId);
  const payloadHash = normalizeNullable(args.payloadHash);
  const sourceReceiptRoot = normalizeNullable(args.sourceReceiptRoot);
  const reviewPayloadHash = normalizeNullable(args.reviewPayloadHash) ?? payloadHash;
  const expiresInMinutes = args.expiresInMinutes ?? 1440;
  const generatedAt = args.generatedAt ? Date.parse(args.generatedAt) : Date.now();
  const reviewedAt = args.reviewedAt ? Date.parse(args.reviewedAt) : (receipt ? generatedAt : NaN);
  const reviewAgeMinutes = Number.isFinite(reviewedAt) ? Math.max(0, Math.round((Date.now() - reviewedAt) / 60000)) : null;
  const stale = reviewAgeMinutes !== null && reviewAgeMinutes > expiresInMinutes;
  const payloadMismatch = Boolean(advanced && receipt && payloadHash && reviewPayloadHash && payloadHash !== reviewPayloadHash);
  const noteRaw = normalizeNullable(args.reviewerNote);
  const noteReasons = noteRaw ? unsafeNoteReasons(noteRaw) : [];
  const noteBlocked = noteReasons.length > 0;
  const paidEvidenceAllowed = Boolean(args.paidEvidenceAllowed);
  const tokenLocked = args.tokenState === "consumed" || args.tokenState === "expired" || args.tokenState === "revoked" || args.tokenState === "payload_mismatch";

  let decision: Pass2823AdvancedReviewDecision;
  if (!advanced) decision = "not_required";
  else if (!paidEvidenceAllowed || tokenLocked) decision = "locked_by_entitlement";
  else if (args.reviewRejected) decision = "review_rejected";
  else if (!receipt) decision = "review_receipt_missing";
  else if (payloadMismatch) decision = "review_payload_mismatch";
  else if (stale) decision = "review_stale";
  else if (!operatorId) decision = "ready_for_operator_review";
  else decision = "operator_signed";

  const checklist: Pass2823OperatorReviewGate["operatorChecklist"] = [
    { id: "paid_entitlement", label: "Server receipt/account/report token allowed paid evidence", status: !advanced ? "not_required" : paidEvidenceAllowed && !tokenLocked ? "passed" : "blocked" },
    { id: "manual_review_receipt", label: "Manual review receipt present", status: !advanced ? "not_required" : receipt ? "passed" : "missing" },
    { id: "payload_binding", label: "Review binds to payloadHash + sourceReceiptRoot", status: !advanced ? "not_required" : payloadHash && sourceReceiptRoot && !payloadMismatch ? "passed" : "blocked" },
    { id: "operator_signature", label: "Operator pseudonymous signature present", status: !advanced ? "not_required" : operatorId ? "passed" : "missing" },
    { id: "note_redaction", label: "Reviewer notes are customer-safe/redacted", status: !advanced ? "not_required" : noteBlocked ? "blocked" : noteRaw ? "passed" : "missing" },
    { id: "freshness", label: "Manual QA is not stale", status: !advanced ? "not_required" : stale ? "blocked" : receipt ? "passed" : "missing" },
  ];
  const blocked = checklist.some((item) => item.status === "blocked");
  const missing = checklist.some((item) => item.status === "missing");
  const releaseStatus = !advanced ? "allow" : blocked ? "block" : missing ? "review" : "allow";

  return {
    schemaVersion: "pass2823_advanced_human_review_signoff_gate_v1",
    surface: args.surface,
    tier,
    decision,
    customerVisibleState: advanced
      ? decision === "operator_signed"
        ? "Advanced human-review addendum signed and payload-bound."
        : "Advanced human-review addendum is locked or pending; automated Pro evidence remains the maximum visible depth."
      : "Manual QA not required for this tier.",
    paidEvidenceAllowed,
    manualReviewRequired: advanced,
    manualReviewReceiptId: receipt,
    operatorPseudonym: operatorId ? `operator-${stableHash(operatorId).slice(-6)}` : null,
    operatorSignatureHash: operatorId || args.operatorSignature ? stableHash(`${operatorId ?? "operator"}:${args.operatorSignature ?? receipt ?? "pending"}:${payloadHash ?? "payload"}`) : null,
    payloadHash,
    sourceReceiptRoot,
    reviewPayloadHash,
    reviewAgeMinutes,
    reviewExpiresInMinutes: expiresInMinutes,
    reviewerNoteEnvelope: {
      status: !advanced ? "not_required" : noteBlocked ? "blocked" : noteRaw ? "redacted_safe" : "missing",
      sanitizedPreview: sanitizeNote(noteRaw),
      blockedReasons: noteReasons,
      rule: "Customer PDF/API may show only sanitized reviewer note excerpts; raw operator notes stay private and cannot override source receipts.",
    },
    operatorChecklist: checklist,
    releaseGate: {
      status: releaseStatus,
      reason: !advanced
        ? "Basic/Pro do not require human-review signoff."
        : releaseStatus === "allow"
          ? "Advanced review signoff is present, fresh, redacted and payload-bound."
          : releaseStatus === "review"
            ? "Advanced review is pending missing receipt/operator/note fields; keep automated Pro evidence only."
            : "Advanced review is blocked by entitlement, stale review, unsafe note or payload mismatch.",
    },
    pdfRenderRule: "Advanced PDF page 9/operator notes render only when paid entitlement, token state, manual receipt, operator signature, payload hash and sourceReceiptRoot all match.",
    timeline: [
      { kind: "request", status: advanced ? "advanced_review_requested" : "not_required" },
      { kind: "assignment", status: operatorId ? "operator_assigned_pseudonymous" : "operator_assignment_pending" },
      { kind: "signoff", status: decision },
      { kind: "delivery", status: releaseStatus === "allow" ? "customer_safe_addendum_allowed" : "metadata_only_until_review_passes" },
    ],
  };
}
