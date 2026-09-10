/** Neutral redacted security-event DTO. */
export type SecurityEventKind =
  | "abuse_blocked"
  | "rate_limited"
  | "suspicious_allowed"
  | "request_allowed"
  | "method_blocked"
  | "url_too_large"
  | "icon_proxy_blocked"
  | "provider_fallback"
  | "vlm_input_blocked"
  | "vlm_output_blocked"
  | "vlm_memory_rejected"
  | "vlm_tool_rejected"
  | "vlm_claim_rejected"
  | "vlm_receipt_invalid"
  | "vlm_source_quarantined"
  | "csp_violation";
export type SecurityEventSeverity = "info" | "review" | "elevated" | "blocked";
export type SecurityEventRecord = {
  id: string;
  kind: SecurityEventKind;
  severity: SecurityEventSeverity;
  profile: string;
  route: string;
  method: string;
  clientFingerprint: string;
  userAgentFamily: string;
  abuseScore: number;
  notes: string[];
  rateLimitMode?: string;
  provider?: string;
  attackFingerprint?: string;
  count?: number;
  lastSeenAt?: string;
  createdAt: string;
  safeSummary: string;
};
