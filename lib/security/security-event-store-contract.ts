import { buildSecurityEventLedgerSnapshot } from "@/lib/security/security-event-ledger";
import { buildSecurityEventAppendReadiness } from "@/lib/security/security-event-append-adapter";

export type SecurityEventStoreMode = "memory_preview" | "upstash_stream_ready" | "database_ready" | "blocked";
export type SecurityEventStoreItem = {
  id: string;
  label: string;
  status: "ready" | "partial" | "blocked" | "manual_review";
  progress: number;
  sourceMode: SecurityEventStoreMode;
  operatorPromise: string;
  safetyBoundary: string;
  blockers: string[];
  nextStep: string;
};

export const securityEventStoreContract: SecurityEventStoreItem[] = [
  {
    id: "memory-preview-ledger",
    label: "Memory preview ledger",
    status: "partial",
    progress: 66,
    sourceMode: "memory_preview",
    operatorPromise: "Security events are visible immediately in the current runtime for debugging and QA.",
    safetyBoundary: "Memory preview does not survive deploys, cold starts or horizontal scaling.",
    blockers: ["runtime reset", "no retention policy", "no admin-only viewer persistence"],
    nextStep: "Keep memory preview for dev and add durable event append route before launch.",
  },
  {
    id: "durable-append-contract",
    label: "Durable append contract",
    status: "manual_review",
    progress: 54,
    sourceMode: "database_ready",
    operatorPromise: "Every blocked, rate-limited or suspicious request can be appended as a safe event record.",
    safetyBoundary: "Do not store raw IP, raw query payloads, authorization headers or secrets.",
    blockers: ["storage provider", "retention period", "write idempotency", "redaction tests"],
    nextStep: "Implement server-only append adapter after choosing storage provider.",
  },
  {
    id: "upstash-stream-lane",
    label: "Upstash stream lane",
    status: "manual_review",
    progress: 48,
    sourceMode: "upstash_stream_ready",
    operatorPromise: "High-pressure security events can be written to a stream/list for later review.",
    safetyBoundary: "Provider writes must be best-effort and must never block the user-facing route indefinitely.",
    blockers: ["UPSTASH stream key", "payload size cap", "fallback behavior", "alert consumer"],
    nextStep: "Add optional stream writer with timeout and fallback event marker.",
  },
  {
    id: "retention-policy",
    label: "Retention and export policy",
    status: "blocked",
    progress: 34,
    sourceMode: "blocked",
    operatorPromise: "Security events have a clear retention window and safe export format.",
    safetyBoundary: "No raw IP/query export. Fingerprints and high-level route/profile metadata only.",
    blockers: ["retention duration", "purge job", "admin export auth", "operator audit"],
    nextStep: "Define retention period and purge policy before storing events durably.",
  },
  {
    id: "admin-only-viewer",
    label: "Admin-only viewer",
    status: "partial",
    progress: 74,
    sourceMode: "memory_preview",
    operatorPromise: "Security console shows operational state but stays locked by the security admin gate.",
    safetyBoundary: "Console visibility is not authentication; API routes still need server token verification.",
    blockers: ["real session auth", "role scopes", "admin audit event"],
    nextStep: "Bind console route to real server session/role when provider is chosen.",
  },
];

export function buildSecurityEventStoreSnapshot() {
  const ledger = buildSecurityEventLedgerSnapshot();
  const averageProgress = Math.round(securityEventStoreContract.reduce((sum, item) => sum + item.progress, 0) / securityEventStoreContract.length);
  return {
    schemaVersion: "velmere-security-event-store-contract-v1",
    mode: "event_store_contract_preview",
    generatedAt: new Date().toISOString(),
    averageProgress,
    memoryLedger: {
      total: ledger.total,
      blocked: ledger.blocked,
      elevated: ledger.elevated,
      review: ledger.review,
      durableStorageReady: ledger.durableStorageReady,
    },
    appendAdapter: buildSecurityEventAppendReadiness(),
    items: securityEventStoreContract,
    storageWritePerformed: false,
    productionBoundary:
      "Event store contract is architecture/readiness only. Production needs durable append, retention, admin auth, purge policy and alert delivery.",
  };
}
