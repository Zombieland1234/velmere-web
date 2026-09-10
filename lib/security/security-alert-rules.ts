import { buildDurableRateLimitReadiness } from "@/lib/security/durable-rate-limit";
import { buildSecurityEventLedgerSnapshot, type SecurityEventRecord } from "@/lib/security/security-event-ledger";

export type SecurityAlertSeverity = "info" | "review" | "elevated" | "critical";
export type SecurityAlertRuleId =
  | "blocked_event_spike"
  | "provider_fallback_seen"
  | "scanner_activity_seen"
  | "rate_limit_pressure"
  | "security_event_storage_preview"
  | "missing_distributed_provider"
  | "waf_not_configured";

export type SecurityAlertRule = {
  id: SecurityAlertRuleId;
  label: string;
  severity: SecurityAlertSeverity;
  status: "active" | "watch" | "blocked";
  operatorMeaning: string;
  trigger: string;
  currentSignal: string;
  nextAction: string;
};

function countEvents(events: SecurityEventRecord[], predicate: (event: SecurityEventRecord) => boolean) {
  return events.reduce((total, event) => total + (predicate(event) ? 1 : 0), 0);
}

export function evaluateSecurityAlertRules(events: SecurityEventRecord[] = buildSecurityEventLedgerSnapshot().recent): SecurityAlertRule[] {
  const readiness = buildDurableRateLimitReadiness();
  const blocked = countEvents(events, (event) => event.severity === "blocked");
  const fallback = countEvents(events, (event) => event.kind === "provider_fallback" || event.rateLimitMode === "upstash_fallback_memory");
  const scanners = countEvents(events, (event) => event.userAgentFamily === "scanner" || event.notes.includes("scanner_like_user_agent"));
  const rateLimited = countEvents(events, (event) => event.kind === "rate_limited");

  return [
    {
      id: "blocked_event_spike",
      label: "Blocked event spike",
      severity: blocked >= 12 ? "critical" : blocked >= 4 ? "elevated" : "info",
      status: blocked >= 4 ? "watch" : "active",
      operatorMeaning: "Many blocked requests in a short window can mean scanner pressure or noisy abuse traffic.",
      trigger: "blocked events in recent ledger window",
      currentSignal: `${blocked} blocked events`,
      nextAction: blocked >= 4 ? "Review `/api/security/events`, compare user-agent family and tune WAF/rate profiles." : "Keep watching recent event trend.",
    },
    {
      id: "provider_fallback_seen",
      label: "Provider fallback seen",
      severity: fallback > 0 ? "elevated" : "info",
      status: fallback > 0 ? "watch" : "active",
      operatorMeaning: "Rate-limit provider fallback means the distributed provider was not used for at least one decision.",
      trigger: "rateLimit.mode = upstash_fallback_memory or provider_fallback event",
      currentSignal: `${fallback} fallback events`,
      nextAction: fallback > 0 ? "Check Upstash env vars, provider status and server logs." : "No fallback in current memory window.",
    },
    {
      id: "scanner_activity_seen",
      label: "Scanner activity seen",
      severity: scanners > 0 ? "elevated" : "info",
      status: scanners > 0 ? "watch" : "active",
      operatorMeaning: "Scanner-like traffic should be reviewed before attaching live adapters or admin routes.",
      trigger: "scanner user-agent family or scanner_like_user_agent note",
      currentSignal: `${scanners} scanner-like events`,
      nextAction: scanners > 0 ? "Add WAF rule / deny pattern and verify no normal client is affected." : "No scanner-like event in current memory window.",
    },
    {
      id: "rate_limit_pressure",
      label: "Rate-limit pressure",
      severity: rateLimited >= 8 ? "critical" : rateLimited > 0 ? "review" : "info",
      status: rateLimited > 0 ? "watch" : "active",
      operatorMeaning: "Rate-limited requests show the shield is active, but sustained pressure needs platform-level protection.",
      trigger: "rate_limited event kind",
      currentSignal: `${rateLimited} rate-limited events`,
      nextAction: rateLimited > 0 ? "Review route/profile and consider stronger WAF/bot policy for that endpoint." : "No rate-limit event in current memory window.",
    },
    {
      id: "security_event_storage_preview",
      label: "Security event storage preview",
      severity: "review",
      status: "blocked",
      operatorMeaning: "The event ledger is still in-memory, so events can reset between runtime instances/deploys.",
      trigger: "durableStorageReady = false",
      currentSignal: "in-memory preview ledger",
      nextAction: "Move events to durable storage with retention policy and admin-only access.",
    },
    {
      id: "missing_distributed_provider",
      label: "Distributed provider readiness",
      severity: readiness.mode === "memory" ? "review" : "info",
      status: readiness.mode === "memory" ? "watch" : "active",
      operatorMeaning: "Memory fallback is fine for preview, but production traffic needs distributed rate limiting.",
      trigger: "rate-limit mode",
      currentSignal: `mode = ${readiness.mode}`,
      nextAction: readiness.mode === "memory" ? "Configure Upstash env vars in Vercel and test provider mode." : "Provider mode is available; monitor fallback count.",
    },
    {
      id: "waf_not_configured",
      label: "WAF / bot layer",
      severity: "review",
      status: "blocked",
      operatorMeaning: "App-level guards help, but edge WAF/bot rules are still required for public launch.",
      trigger: "platform task not completed",
      currentSignal: "platform WAF not verified",
      nextAction: "Configure Vercel Firewall/WAF rules for scanner paths, high-rate API traffic and known bad user agents.",
    },
  ];
}

export function buildSecurityAlertSnapshot() {
  const events = buildSecurityEventLedgerSnapshot().recent;
  const rules = evaluateSecurityAlertRules(events);
  return {
    schemaVersion: "velmere-security-alert-rules-v1",
    mode: "security_alert_rules_preview",
    generatedAt: new Date().toISOString(),
    rules,
    critical: rules.filter((rule) => rule.severity === "critical").length,
    elevated: rules.filter((rule) => rule.severity === "elevated").length,
    review: rules.filter((rule) => rule.severity === "review").length,
    productionBoundary:
      "Alert rules are preview/operator guidance. Production still needs durable event storage, notification delivery and platform WAF configuration.",
  };
}
