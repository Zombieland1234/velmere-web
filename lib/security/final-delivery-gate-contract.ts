import type { Pass2374CustomerSafeRouteHealthSnapshot } from "@/lib/security/customer-route-health";
import type { Pass2375RouteHealthLedgerSnapshot } from "@/lib/security/route-health-ledger";

/**
 * Browser-safe data contract shared with the final-delivery UI.
 *
 * Keep this module free of executable server imports. The delivery evaluator
 * lives in `final-delivery-gate.ts`; client components need only this immutable
 * identifier and the serialized snapshot shape.
 */
export const PASS2376_FINAL_DELIVERY_GATE_ID = "pass2376-final-delivery-route-health-zero-blocker-gate" as const;

export type Pass2376FinalDeliveryGateReason = {
  key: string;
  level: "ok" | "watch" | "stale" | "blocked";
  summary: string;
  nextAction: string;
};

export type Pass2376FinalDeliveryGateSnapshot = {
  ok: boolean;
  passId: typeof PASS2376_FINAL_DELIVERY_GATE_ID;
  generatedAt: string;
  locale: "pl" | "en" | "de";
  canDeliver: boolean;
  deliveryAction: "deliver_customer_safe_report";
  messageId?: string;
  requestId?: string;
  auditQueueId?: string;
  accountMessageId?: string;
  accountId?: string;
  focusKey: string;
  staleAfterMinutes: number;
  operatorReady: boolean;
  routeHealthAllowed: boolean;
  endpointPingFresh: boolean;
  endpointPingRequired: boolean;
  canonicalSnapshotReady: boolean;
  canonicalSnapshotDigest?: string;
  exactAccountArtifactReady: boolean;
  exactAccountArtifactId?: string;
  exactPdfDigest?: string;
  zeroBlockedWarnings: boolean;
  zeroStaleWarnings: boolean;
  lastEndpointPingAt?: string;
  lastEndpointPingAgeMinutes?: number;
  lastEndpointPingSource?: string;
  blockedWarningCount: number;
  staleWarningCount: number;
  reasons: Pass2376FinalDeliveryGateReason[];
  routeHealth: {
    passId: Pass2374CustomerSafeRouteHealthSnapshot["passId"];
    endpoint: string;
    missing: number;
    blocked: number;
    ready: number;
    linked: number;
  };
  ledger: {
    passId: Pass2375RouteHealthLedgerSnapshot["passId"];
    deliveryWarningLevel: Pass2375RouteHealthLedgerSnapshot["deliveryWarningLevel"];
    customerDeliveryAllowed: boolean;
    historyCount: number;
    source: Pass2375RouteHealthLedgerSnapshot["source"];
  };
  safeBoundary: string;
};
