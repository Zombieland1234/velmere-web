import { pass449RedactForLedger } from "@/lib/market-integrity/architecture-dark-matter-guard";
export type RedactionSeverity = "low" | "medium" | "high";

export type RedactionResult = {
  value: string;
  redactedCount: number;
  severity: RedactionSeverity;
  markers: string[];
};

const REDACTION_PATTERNS: Array<{ marker: string; pattern: RegExp; severity: RedactionSeverity }> = [
  { marker: "bearer-token", pattern: /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, severity: "high" },
  { marker: "api-key", pattern: /(api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^"',\s}]+/gi, severity: "high" },
  { marker: "stripe-secret", pattern: /sk_(live|test)_[A-Za-z0-9]+/g, severity: "high" },
  { marker: "webhook-secret", pattern: /whsec_[A-Za-z0-9]+/g, severity: "high" },
  { marker: "email", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, severity: "medium" },
  { marker: "long-hex", pattern: /\b0x[a-f0-9]{32,}\b/gi, severity: "medium" },
];

function severityRank(severity: RedactionSeverity) {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function maxSeverity(a: RedactionSeverity, b: RedactionSeverity): RedactionSeverity {
  return severityRank(a) >= severityRank(b) ? a : b;
}

function safeSerializeForRedaction(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

export function redactOperatorLogValue(input: unknown): RedactionResult {
  const schemaRedacted = pass449RedactForLedger(input);
  let value = typeof schemaRedacted === "string" ? schemaRedacted : (JSON.stringify(schemaRedacted, null, 2) ?? String(schemaRedacted));
  let redactedCount = 0;
  let severity: RedactionSeverity = "low";
  const markers = new Set<string>();

  for (const rule of REDACTION_PATTERNS) {
    value = value.replace(rule.pattern, (match) => {
      redactedCount += 1;
      markers.add(rule.marker);
      severity = maxSeverity(severity, rule.severity);
      const prefix = match.includes(":") ? match.split(":")[0] : rule.marker;
      return `${prefix}:[redacted]`;
    });
  }

  if (safeSerializeForRedaction(input) !== safeSerializeForRedaction(schemaRedacted)) {
    redactedCount += 1;
    markers.add("pass449-schema-envelope");
    severity = maxSeverity(severity, "medium");
  }

  return { value, redactedCount, severity, markers: Array.from(markers).sort() };
}

export function createSafeOperatorLogLine(event: {
  scope: string;
  action: string;
  status: "draft" | "blocked" | "manual_review" | "ready";
  payload?: unknown;
}) {
  const redacted = redactOperatorLogValue(event.payload ?? {});
  return {
    scope: event.scope,
    action: event.action,
    status: event.status,
    redaction: {
      count: redacted.redactedCount,
      severity: redacted.severity,
      markers: redacted.markers,
    },
    safePayload: redacted.value,
  };
}

export const redactedLoggerLaunchNote =
  "Redacted logger is a safe formatting layer. Production still needs server-side logging policy, storage controls and provider response allowlists.";
