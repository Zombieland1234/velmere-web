import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { Pass2823OperatorReviewGate } from "@/lib/market-integrity/top1-advanced-human-review-signoff-gate";

export type Pass2824ReplayDecision =
  | "not_required"
  | "replay_clean"
  | "replay_pending"
  | "payload_drift_detected"
  | "source_root_drift_detected"
  | "operator_note_mutation_detected"
  | "unsafe_replay_attempt"
  | "locked_by_prior_gate";

export type Pass2824AdvancedReviewReplayAuditGate = {
  schemaVersion: "pass2824_advanced_review_replay_audit_gate_v1";
  surface: string;
  tier: string;
  decision: Pass2824ReplayDecision;
  replayAllowed: boolean;
  customerVisibleState: string;
  reviewedPayloadHash: string | null;
  deliveredPayloadHash: string | null;
  reviewedSourceReceiptRoot: string | null;
  deliveredSourceReceiptRoot: string | null;
  operatorSignatureHash: string | null;
  operatorSignatureReplayHash: string | null;
  reviewerNoteHash: string | null;
  reviewerNoteReplayHash: string | null;
  replayAttemptCount: number;
  maxReplayAttempts: number;
  driftChecks: Array<{
    id: string;
    label: string;
    status: "passed" | "pending" | "blocked" | "not_required";
  }>;
  mutationFirewall: {
    status: "clean" | "blocked" | "pending";
    blockedReasons: string[];
    rule: string;
  };
  releaseGate: {
    status: "allow" | "review" | "block";
    reason: string;
  };
  pdfRenderRule: string;
  auditTimeline: Array<{
    kind: "review_signoff" | "delivery_binding" | "replay" | "customer_visibility";
    status: string;
  }>;
};

export const PASS2824_ADVANCED_REVIEW_REPLAY_AUDIT_ACCEPTANCE_GATES = [
  "PASS2824: Advanced review replay must re-check payloadHash, sourceReceiptRoot, operator signature hash and reviewer-note hash before showing paid human-review addendum again.",
  "PASS2824: Replay cannot mutate the PDF payload, change source receipts, rewrite risk/confidence scores, or upgrade community/user notes into source truth.",
  "PASS2824: Payload drift or source-root drift after operator QA approval blocks Advanced addendum and downgrades to metadata-only until a fresh operator review is signed.",
  "PASS2824: Reviewer-note mutation after signoff is blocked; customer-visible replay can show only the signed sanitized note envelope.",
  "PASS2824: Repeated replay attempts are abuse-budgeted and must never bypass consumed/expired/revoked report-token state from prior gates.",
] as const;

function normalize(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function stableHash(input: string | null | undefined) {
  const safe = input ?? "pending";
  return `vlm-rp-${sha256Token(safe, 24)}`;
}

function containsUnsafeReplayMutation(note?: string | null) {
  const text = (note ?? "").toLowerCase();
  const reasons: string[] = [];
  if (/change risk|override risk|raise score|lower score|edit score|rewrite score/.test(text)) reasons.push("score_mutation_requested");
  if (/replace source|delete source|fake source|invent source|make it safe/.test(text)) reasons.push("source_truth_mutation_requested");
  if (/buy now|sell now|guaranteed|risk[- ]?free|100% safe|secure\b/.test(text)) reasons.push("unsafe_customer_claim_or_trade_prompt");
  if (/seed phrase|private key|mnemonic|recovery phrase|<script|javascript:|data:/i.test(note ?? "")) reasons.push("secret_or_script_material_detected");
  return reasons;
}

export function buildPass2824AdvancedReviewReplayAuditGate(args: {
  surface: string;
  tier: string;
  previousGate?: Pass2823OperatorReviewGate | null;
  paidEvidenceAllowed?: boolean;
  payloadHash?: string | null;
  deliveredPayloadHash?: string | null;
  reviewPayloadHash?: string | null;
  sourceReceiptRoot?: string | null;
  deliveredSourceReceiptRoot?: string | null;
  reviewSourceReceiptRoot?: string | null;
  operatorSignatureHash?: string | null;
  operatorSignatureReplayHash?: string | null;
  reviewerNote?: string | null;
  signedReviewerNoteHash?: string | null;
  replayReviewerNoteHash?: string | null;
  replayAttemptCount?: number | null;
  maxReplayAttempts?: number;
  tokenState?: string | null;
  runtimeState?: string | null;
}): Pass2824AdvancedReviewReplayAuditGate {
  const tier = args.tier;
  const advanced = tier === "Advanced";
  const previous = args.previousGate ?? null;
  const maxReplayAttempts = args.maxReplayAttempts ?? 3;
  const replayAttemptCount = Math.max(0, Number(args.replayAttemptCount ?? 0));
  const paidEvidenceAllowed = Boolean(args.paidEvidenceAllowed);
  const tokenLocked = ["consumed", "expired", "revoked", "payload_mismatch"].includes(args.tokenState ?? "");
  const payloadHash = normalize(args.payloadHash) ?? normalize(previous?.payloadHash);
  const deliveredPayloadHash = normalize(args.deliveredPayloadHash) ?? payloadHash;
  const reviewedPayloadHash = normalize(args.reviewPayloadHash) ?? normalize(previous?.reviewPayloadHash) ?? payloadHash;
  const sourceReceiptRoot = normalize(args.sourceReceiptRoot) ?? normalize(previous?.sourceReceiptRoot);
  const deliveredSourceReceiptRoot = normalize(args.deliveredSourceReceiptRoot) ?? sourceReceiptRoot;
  const reviewedSourceReceiptRoot = normalize(args.reviewSourceReceiptRoot) ?? sourceReceiptRoot;
  const operatorSignatureHash = normalize(args.operatorSignatureHash) ?? normalize(previous?.operatorSignatureHash);
  const operatorSignatureReplayHash = normalize(args.operatorSignatureReplayHash) ?? operatorSignatureHash;
  const signedNoteHash = normalize(args.signedReviewerNoteHash) ?? stableHash(previous?.reviewerNoteEnvelope?.sanitizedPreview ?? args.reviewerNote ?? "pending");
  const replayNoteHash = normalize(args.replayReviewerNoteHash) ?? signedNoteHash;
  const unsafeReasons = containsUnsafeReplayMutation(args.reviewerNote);
  const previousBlocks = advanced && previous ? previous.releaseGate.status !== "allow" : false;
  const payloadDrift = advanced && Boolean(reviewedPayloadHash && deliveredPayloadHash && reviewedPayloadHash !== deliveredPayloadHash);
  const rootDrift = advanced && Boolean(reviewedSourceReceiptRoot && deliveredSourceReceiptRoot && reviewedSourceReceiptRoot !== deliveredSourceReceiptRoot);
  const operatorMutation = advanced && Boolean(operatorSignatureHash && operatorSignatureReplayHash && operatorSignatureHash !== operatorSignatureReplayHash);
  const noteMutation = advanced && Boolean(signedNoteHash && replayNoteHash && signedNoteHash !== replayNoteHash);
  const replayBudgetExceeded = advanced && replayAttemptCount > maxReplayAttempts;
  let decision: Pass2824ReplayDecision;
  if (!advanced) decision = "not_required";
  else if (!paidEvidenceAllowed || tokenLocked || previousBlocks) decision = "locked_by_prior_gate";
  else if (unsafeReasons.length > 0 || replayBudgetExceeded) decision = "unsafe_replay_attempt";
  else if (payloadDrift) decision = "payload_drift_detected";
  else if (rootDrift) decision = "source_root_drift_detected";
  else if (operatorMutation || noteMutation) decision = "operator_note_mutation_detected";
  else if (!reviewedPayloadHash || !reviewedSourceReceiptRoot || !operatorSignatureHash) decision = "replay_pending";
  else decision = "replay_clean";
  const pending = decision === "replay_pending";
  const replayAllowed = advanced ? decision === "replay_clean" : true;
  const driftChecks: Pass2824AdvancedReviewReplayAuditGate["driftChecks"] = [
    { id: "prior_gate", label: "PASS2823 signoff allowed Advanced addendum", status: !advanced ? "not_required" : previousBlocks || !paidEvidenceAllowed || tokenLocked ? "blocked" : previous ? "passed" : "pending" },
    { id: "payload_hash", label: "Reviewed payloadHash matches delivered payloadHash", status: !advanced ? "not_required" : payloadDrift ? "blocked" : reviewedPayloadHash && deliveredPayloadHash ? "passed" : "pending" },
    { id: "source_root", label: "Reviewed sourceReceiptRoot matches delivered sourceReceiptRoot", status: !advanced ? "not_required" : rootDrift ? "blocked" : reviewedSourceReceiptRoot && deliveredSourceReceiptRoot ? "passed" : "pending" },
    { id: "operator_signature", label: "Operator signature hash is unchanged on replay", status: !advanced ? "not_required" : operatorMutation ? "blocked" : operatorSignatureHash ? "passed" : "pending" },
    { id: "reviewer_note", label: "Reviewer note hash is unchanged and customer-safe", status: !advanced ? "not_required" : noteMutation || unsafeReasons.length ? "blocked" : signedNoteHash ? "passed" : "pending" },
    { id: "abuse_budget", label: "Replay attempt count is within abuse budget", status: !advanced ? "not_required" : replayBudgetExceeded ? "blocked" : "passed" },
  ];
  return {
    schemaVersion: "pass2824_advanced_review_replay_audit_gate_v1",
    surface: args.surface,
    tier,
    decision,
    replayAllowed,
    customerVisibleState: !advanced
      ? "Replay audit is not required for Basic/Pro human-review addenda."
      : replayAllowed
        ? "Advanced addendum replay is clean: payload, source root and signed note envelope still match."
        : pending
          ? "Advanced addendum replay is pending required hashes/signature; show metadata only."
          : "Advanced addendum replay is blocked by drift, unsafe mutation, prior gate lock or abuse budget.",
    reviewedPayloadHash,
    deliveredPayloadHash,
    reviewedSourceReceiptRoot,
    deliveredSourceReceiptRoot,
    operatorSignatureHash,
    operatorSignatureReplayHash,
    reviewerNoteHash: signedNoteHash,
    reviewerNoteReplayHash: replayNoteHash,
    replayAttemptCount,
    maxReplayAttempts,
    driftChecks,
    mutationFirewall: {
      status: unsafeReasons.length > 0 || operatorMutation || noteMutation ? "blocked" : pending ? "pending" : "clean",
      blockedReasons: [...unsafeReasons, ...(operatorMutation ? ["operator_signature_mutation"] : []), ...(noteMutation ? ["reviewer_note_mutation"] : [])],
      rule: "Replay may re-display only the signed sanitized addendum envelope; it cannot change risk/confidence, source receipts or operator notes after signoff.",
    },
    releaseGate: {
      status: !advanced || replayAllowed ? "allow" : pending ? "review" : "block",
      reason: !advanced
        ? "Basic/Pro do not require Advanced replay audit."
        : replayAllowed
          ? "Replay clean: reviewed/delivered payload and source roots match, signature/note hashes unchanged and replay budget is valid."
          : pending
            ? "Replay pending missing reviewed payload/source/signature values; keep Advanced addendum metadata-only."
            : "Replay blocked by payload/source drift, unsafe mutation, prior gate lock, token state or abuse budget.",
    },
    pdfRenderRule: "PDF/account-vault/email replay may show Advanced human-review addendum only when PASS2823 signoff and PASS2824 replay audit both allow the same payloadHash and sourceReceiptRoot.",
    auditTimeline: [
      { kind: "review_signoff", status: previous?.decision ?? "previous_gate_not_supplied" },
      { kind: "delivery_binding", status: payloadDrift || rootDrift ? "binding_drift_detected" : "binding_match_or_pending" },
      { kind: "replay", status: decision },
      { kind: "customer_visibility", status: replayAllowed ? "advanced_addendum_visible" : "advanced_addendum_metadata_only" },
    ],
  };
}
