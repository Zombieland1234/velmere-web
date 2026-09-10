import type { AuditAccountMessageRecord } from "@/lib/account/audit-account-messages";
import {
  hasExactAuditAccountArtifactBinding,
  verifyAuditAccountCustomerSnapshot,
} from "@/lib/security/audit-account-customer-snapshot";
import { buildPass2374CustomerSafeRouteHealth, type Pass2374CustomerSafeRouteHealthSnapshot } from "@/lib/security/customer-route-health";
import {
  PASS2376_FINAL_DELIVERY_GATE_ID,
  type Pass2376FinalDeliveryGateReason,
  type Pass2376FinalDeliveryGateSnapshot,
} from "@/lib/security/final-delivery-gate-contract";
import { buildPass2375RouteHealthLedger, type Pass2375RouteHealthLedgerSnapshot, type Pass2375RouteHealthWarning } from "@/lib/security/route-health-ledger";

export {
  PASS2376_FINAL_DELIVERY_GATE_ID,
  type Pass2376FinalDeliveryGateReason,
  type Pass2376FinalDeliveryGateSnapshot,
} from "@/lib/security/final-delivery-gate-contract";

const SAFE_LOCALES = new Set(["pl", "en", "de"]);

function normalizeLocale(value?: string | null): "pl" | "en" | "de" {
  return SAFE_LOCALES.has(String(value || "")) ? (String(value) as "pl" | "en" | "de") : "en";
}

function cleanToken(value: unknown, max = 180): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/[<>{}[\]`$\\]/g, " ")
    .replace(/\b(?:sk_live|pk_live|sk_test|pk_test|whsec|Bearer)\b[^\s]*/gi, "[redacted]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-card-like]")
    .replace(/\b\d{6}\b/g, "[redacted-code]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return cleaned || undefined;
}

function reasonFromWarning(warning: Pass2375RouteHealthWarning): Pass2376FinalDeliveryGateReason {
  return {
    key: warning.key,
    level: warning.level,
    summary: warning.summary,
    nextAction: warning.nextAction,
  };
}

function okReason(summary: string, nextAction: string): Pass2376FinalDeliveryGateReason {
  return { key: `pass2376_${summary.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 42) || "ok"}`, level: "ok", summary, nextAction };
}

export async function buildPass2376FinalDeliveryGate(input: {
  locale?: string | null;
  message?: AuditAccountMessageRecord | null;
  routeHealth?: Pass2374CustomerSafeRouteHealthSnapshot;
  routeHealthLedger?: Pass2375RouteHealthLedgerSnapshot;
  staleAfterMinutes?: number;
}): Promise<Pass2376FinalDeliveryGateSnapshot> {
  const locale = normalizeLocale(input.locale ?? input.message?.locale);
  const staleAfterMinutes = Math.max(1, Math.min(Number(input.staleAfterMinutes ?? 15), 240));
  const message = input.message ?? null;
  const routeHealth = input.routeHealth ?? buildPass2374CustomerSafeRouteHealth({
    locale,
    id: message?.id,
    requestId: message?.requestId,
    record: message,
  });
  const routeHealthLedger = input.routeHealthLedger ?? await buildPass2375RouteHealthLedger({
    routeHealth,
    pingSource: "customer_delivery_guard",
    recordPing: false,
    staleAfterMinutes,
  });

  const blockingWarnings = routeHealthLedger.warnings.filter((warning) => warning.level === "blocked");
  const staleWarnings = routeHealthLedger.warnings.filter((warning) => warning.level === "stale");
  // V17/P77: operator status is retained only as an internal annotation; it cannot unlock or block delivery.
  const operatorReady = message?.operatorStatus === "customer_safe_ready" || message?.operatorStatus === "delivered";
  const endpointPingFresh = Boolean(
    routeHealthLedger.lastEndpointPing &&
    routeHealthLedger.lastEndpointPing.pingSource === "route_health_endpoint" &&
    typeof routeHealthLedger.lastEndpointPingAgeMinutes === "number" &&
    routeHealthLedger.lastEndpointPingAgeMinutes <= staleAfterMinutes,
  );
  const routeHealthAllowed = routeHealthLedger.customerDeliveryAllowed && routeHealthLedger.deliveryWarningLevel === "ok";
  const canonicalSnapshotReady = verifyAuditAccountCustomerSnapshot(message?.canonicalCustomerSnapshot);
  const exactAccountArtifactReady = canonicalSnapshotReady
    && hasExactAuditAccountArtifactBinding(message?.canonicalCustomerSnapshot);
  const zeroBlockedWarnings = blockingWarnings.length === 0;
  const zeroStaleWarnings = staleWarnings.length === 0;
  const canDeliver = Boolean(message?.id || message?.requestId)
    && canonicalSnapshotReady
    && exactAccountArtifactReady
    && routeHealthAllowed
    && endpointPingFresh
    && zeroBlockedWarnings
    && zeroStaleWarnings;

  const reasons: Pass2376FinalDeliveryGateReason[] = [];
  if (!message) {
    reasons.push({
      key: "missing_account_message",
      level: "blocked",
      summary: "No linked audit account message is loaded for final delivery.",
      nextAction: "Open the linked request from Audit Inbox before trying to deliver the customer-safe report.",
    });
  }
  if (message && !canonicalSnapshotReady) {
    reasons.push({
      key: "canonical_customer_snapshot_required",
      level: "blocked",
      summary: "The account message is not bound to an immutable canonical customer-report snapshot.",
      nextAction: "Regenerate the evidence-bound customer pipeline and attach its verified snapshot before delivery.",
    });
  }
  if (message && canonicalSnapshotReady && !exactAccountArtifactReady) {
    reasons.push({
      key: "exact_account_pdf_artifact_required",
      level: "blocked",
      summary: "The canonical Audit snapshot is not bound to a persisted immutable account-owned PDF blob.",
      nextAction: "Regenerate delivery through the exact Audit artifact bundle path; deterministic re-render metadata is not sufficient.",
    });
  }
  if (!endpointPingFresh) {
    reasons.push({
      key: "fresh_endpoint_ping_required",
      level: routeHealthLedger.lastEndpointPing ? "stale" : "blocked",
      summary: routeHealthLedger.lastEndpointPing
        ? `Last route-health endpoint ping is not fresh enough for final delivery.`
        : "A route-health endpoint ping is required before final customer delivery.",
      nextAction: "Open /api/security/audit-watch/route-health for this request, then refresh the linked request drawer.",
    });
  }
  if (!routeHealthAllowed || !zeroBlockedWarnings || !zeroStaleWarnings) {
    reasons.push(...routeHealthLedger.warnings.filter((warning) => warning.level !== "ok").map(reasonFromWarning));
  }
  if (!reasons.length) {
    reasons.push(okReason("Final delivery gate is open", "Deliver customer-safe report, then verify account card auto-sync."));
  }

  return {
    ok: canDeliver,
    passId: PASS2376_FINAL_DELIVERY_GATE_ID,
    generatedAt: new Date().toISOString(),
    locale,
    canDeliver,
    deliveryAction: "deliver_customer_safe_report",
    messageId: cleanToken(message?.id),
    requestId: cleanToken(message?.requestId),
    auditQueueId: cleanToken(message?.auditQueueId),
    accountMessageId: cleanToken(message?.id),
    accountId: cleanToken(message?.accountId),
    focusKey: routeHealthLedger.focusKey,
    staleAfterMinutes,
    operatorReady,
    routeHealthAllowed,
    endpointPingFresh,
    endpointPingRequired: true,
    canonicalSnapshotReady,
    canonicalSnapshotDigest: cleanToken(message?.canonicalCustomerSnapshot?.snapshotDigest, 80),
    exactAccountArtifactReady,
    exactAccountArtifactId: cleanToken(message?.canonicalCustomerSnapshot?.exactAccountArtifact?.snapshotId, 180),
    exactPdfDigest: cleanToken(message?.canonicalCustomerSnapshot?.exactAccountArtifact?.pdfDigest, 80),
    zeroBlockedWarnings,
    zeroStaleWarnings,
    lastEndpointPingAt: cleanToken(routeHealthLedger.lastEndpointPing?.pingedAt, 90),
    lastEndpointPingAgeMinutes: routeHealthLedger.lastEndpointPingAgeMinutes,
    lastEndpointPingSource: cleanToken(routeHealthLedger.lastEndpointPing?.pingSource, 90),
    blockedWarningCount: blockingWarnings.length,
    staleWarningCount: staleWarnings.length,
    reasons: reasons.slice(0, 8),
    routeHealth: {
      passId: routeHealth.passId,
      endpoint: routeHealth.routeHealthEndpoint,
      missing: routeHealth.counts.missing,
      blocked: routeHealth.counts.blocked,
      ready: routeHealth.counts.ready,
      linked: routeHealth.counts.linked,
    },
    ledger: {
      passId: routeHealthLedger.passId,
      deliveryWarningLevel: routeHealthLedger.deliveryWarningLevel,
      customerDeliveryAllowed: routeHealthLedger.customerDeliveryAllowed,
      historyCount: routeHealthLedger.history.length,
      source: routeHealthLedger.source,
    },
    safeBoundary:
      "PASS2376 final-delivery gate is deterministic: immutable customer snapshot, route health, fresh endpoint ping and zero blocked/stale warnings decide delivery. Operator status is informational only and cannot unlock or block delivery. It exposes only redacted ids and never raw payment data, secrets, exploit instructions, Certified Safe claims or investment advice.",
  };
}
