export type VelmereTelemetryEventName =
  | "surface_readiness_viewed"
  | "shield_token_modal_opened"
  | "shield_analysis_mode_started"
  | "shield_source_lane_viewed"
  | "square_composer_opened"
  | "vlm_access_panel_viewed"
  | "checkout_gate_viewed"
  | "admin_audit_preview_requested";

export type SafeTelemetryPayload = {
  surface?: "home" | "vlm" | "square" | "research" | "checkout" | "shield" | "admin" | "account";
  locale?: "pl" | "de" | "en";
  mode?: "public" | "member" | "operator" | "preview";
  status?: "ready" | "review" | "blocked" | "fallback";
  target?: string;
  score?: number;
};

const allowedPayloadKeys = new Set(["surface", "locale", "mode", "status", "target", "score"]);

const blockedKeyPattern = /token|secret|password|private|seed|phrase|email|authorization|signature|address|bearer/i;

function sanitizeString(value: string) {
  return value
    .replace(/0x[a-fA-F0-9]{16,}/g, "0x…redacted")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "email:redacted")
    .slice(0, 96);
}

export function sanitizeTelemetryPayload(payload: Record<string, unknown>): SafeTelemetryPayload {
  const safe: SafeTelemetryPayload = {};
  for (const [key, rawValue] of Object.entries(payload)) {
    if (!allowedPayloadKeys.has(key)) continue;
    if (blockedKeyPattern.test(key)) continue;

    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      safe[key as keyof SafeTelemetryPayload] = Math.max(0, Math.min(100, Math.round(rawValue))) as never;
      continue;
    }

    if (typeof rawValue === "string") {
      safe[key as keyof SafeTelemetryPayload] = sanitizeString(rawValue) as never;
    }
  }
  return safe;
}

export function createTelemetryEventPreview(
  name: VelmereTelemetryEventName,
  payload: Record<string, unknown>,
) {
  const safePayload = sanitizeTelemetryPayload(payload);
  return {
    schemaVersion: "velmere-safe-telemetry-v1",
    mode: "preview_only",
    name,
    createdAt: new Date().toISOString(),
    payload: safePayload,
    storageWritePerformed: false,
    privacyBoundary: "Preview only. Do not send analytics until consent, event sink and redaction review are complete.",
  };
}

export const telemetryReadinessChecklist = [
  "Define consent and cookie/storage behavior before vendor integration.",
  "Keep event names generic; do not store seed phrases, private keys, auth headers, raw emails or wallet signatures.",
  "Use an allowlist payload schema and drop unknown keys.",
  "Bind analytics to readiness and UX quality, not financial behavior or investment intent.",
  "Document retention and deletion behavior before public launch.",
];
