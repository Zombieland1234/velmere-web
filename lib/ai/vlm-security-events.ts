import {
  recordSecurityEvent,
  type SecurityEventKind,
  type SecurityEventSeverity,
} from "../security/security-event-ledger";
import type { VlmSecurityFlag, VlmSecurityInspection } from "./vlm-security";
import { stableHash } from "./vlm-security";

export type VlmSecurityVector = "input" | "output" | "memory" | "tool" | "claim" | "receipt" | "source";

const kindByVector: Record<VlmSecurityVector, SecurityEventKind> = {
  input: "vlm_input_blocked",
  output: "vlm_output_blocked",
  memory: "vlm_memory_rejected",
  tool: "vlm_tool_rejected",
  claim: "vlm_claim_rejected",
  receipt: "vlm_receipt_invalid",
  source: "vlm_source_quarantined",
};

function severity(score: number): SecurityEventSeverity {
  if (score >= 70) return "blocked";
  if (score >= 45) return "elevated";
  if (score > 0) return "review";
  return "info";
}

export function recordVlmSecurityInspection(input: {
  inspection: VlmSecurityInspection;
  vector: VlmSecurityVector;
  route?: string;
  request?: Request;
  profile?: string;
  provider?: string;
}) {
  if (!input.inspection.flags.length) return null;
  return recordSecurityEvent({
    request: input.request,
    route: input.route ?? `/internal/vlm/${input.vector}`,
    kind: kindByVector[input.vector],
    severity: severity(input.inspection.score),
    profile: input.profile ?? "vlm-security",
    abuseScore: input.inspection.score,
    notes: input.inspection.flags,
    provider: input.provider,
    attackFingerprint: input.inspection.fingerprint,
    safeSummary: `VLM ${input.vector} rejected or reviewed. Only security flags, score and keyed fingerprint were retained.`,
  });
}

export function recordVlmPolicyRejection(input: {
  vector: Exclude<VlmSecurityVector, "input" | "memory">;
  reason: string;
  score?: number;
  route?: string;
  provider?: string;
  flags?: VlmSecurityFlag[];
}) {
  const score = Math.min(100, Math.max(1, input.score ?? 80));
  return recordSecurityEvent({
    route: input.route ?? `/internal/vlm/${input.vector}`,
    kind: kindByVector[input.vector],
    severity: severity(score),
    profile: "vlm-security",
    abuseScore: score,
    notes: [input.reason, ...(input.flags ?? [])].slice(0, 8),
    provider: input.provider,
    attackFingerprint: stableHash({
      namespace: "vlm-policy-event",
      vector: input.vector,
      reason: input.reason,
      flags: input.flags ?? [],
    }).slice(0, 24),
    safeSummary: `VLM ${input.vector} policy rejection recorded without raw prompt, output, tool arguments or user data.`,
  });
}
