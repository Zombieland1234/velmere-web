import { sanitizeTelemetryPayload } from "./ops-telemetry";

export type StorageAdapterStatus = "ready" | "manual_review" | "blocked";
export type StorageAdapterPriority = "P0" | "P1" | "P2";
export type StorageRecordKind =
  | "audit_event"
  | "source_snapshot"
  | "order_event"
  | "operator_case"
  | "telemetry_event";

export type StorageAdapterLane = {
  id: string;
  kind: StorageRecordKind;
  priority: StorageAdapterPriority;
  status: StorageAdapterStatus;
  progress: number;
  title: string;
  serverPromise: string;
  blockedBy: string[];
  nextStep: string;
  retention: "launch_review" | "customer_support" | "security_audit" | "analytics_preview";
};

export const storageAdapterMatrix: StorageAdapterLane[] = [
  {
    id: "audit-event-write",
    kind: "audit_event",
    priority: "P0",
    status: "blocked",
    progress: 58,
    title: "Audit event write path",
    serverPromise: "Server-only append event with operator identity, action, target, redacted payload and idempotency key.",
    blockedBy: ["durable database adapter", "server auth identity", "transaction boundary"],
    nextStep: "Implement appendAuditEvent(adapter, event) behind server auth.",
    retention: "security_audit",
  },
  {
    id: "source-snapshot-write",
    kind: "source_snapshot",
    priority: "P0",
    status: "manual_review",
    progress: 61,
    title: "Source snapshot write path",
    serverPromise: "Persist source mode, freshness timestamp, adapter id and redacted source ledger for Shield decisions.",
    blockedBy: ["source adapter TTL", "snapshot schema migration", "source allowlist"],
    nextStep: "Add typed snapshot envelope for market, candles, orderbook, holders, contract and OSINT lanes.",
    retention: "launch_review",
  },
  {
    id: "order-event-timeline",
    kind: "order_event",
    priority: "P0",
    status: "blocked",
    progress: 55,
    title: "Order event timeline",
    serverPromise: "Persist checkout_started, payment_confirmed, provider_submitted, shipped, return_requested and refunded states.",
    blockedBy: ["payment webhook", "provider webhook", "customer safe export boundary"],
    nextStep: "Create order event adapter and require provider/payment event signatures.",
    retention: "customer_support",
  },
  {
    id: "operator-case-state",
    kind: "operator_case",
    priority: "P1",
    status: "manual_review",
    progress: 64,
    title: "Operator case state",
    serverPromise: "Store review case status with draft, blocked, approved, rollback and linked source snapshots.",
    blockedBy: ["case table", "approval policy", "rollback event link"],
    nextStep: "Bind every operator decision to an audit event and source snapshot id.",
    retention: "security_audit",
  },
  {
    id: "safe-telemetry-event",
    kind: "telemetry_event",
    priority: "P1",
    status: "manual_review",
    progress: 56,
    title: "Safe telemetry event",
    serverPromise: "Store only allowlisted UX/readiness telemetry after consent and redaction review.",
    blockedBy: ["consent model", "vendor decision", "retention policy"],
    nextStep: "Keep telemetry in preview until consent, deletion and payload allowlist are finalized.",
    retention: "analytics_preview",
  },
];

export type StoragePreviewInput = {
  kind: StorageRecordKind;
  operatorId?: string;
  targetId?: string;
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
};

export function buildIdempotencyKey(input: StoragePreviewInput) {
  const cleanKind = input.kind.replace(/[^a-z0-9_-]/gi, "-");
  const target = (input.targetId || "target-preview").replace(/[^a-z0-9:_-]/gi, "-").slice(0, 72);
  const operator = (input.operatorId || "operator-preview").replace(/[^a-z0-9:_-]/gi, "-").slice(0, 72);
  return input.idempotencyKey?.trim() || `${cleanKind}:${operator}:${target}`;
}

export function createStorageWritePreview(input: StoragePreviewInput) {
  const lane = storageAdapterMatrix.find((item) => item.kind === input.kind);
  const idempotencyKey = buildIdempotencyKey(input);
  const safePayload = sanitizeTelemetryPayload(input.payload ?? {});
  const blockedBy = [
    ...(lane?.blockedBy ?? ["unknown storage lane"]),
    ...(!input.operatorId ? ["operator identity missing"] : []),
    ...(!input.targetId ? ["target id missing"] : []),
  ];

  return {
    schemaVersion: "velmere-storage-write-preview-v1",
    mode: "preview_only",
    kind: input.kind,
    laneId: lane?.id ?? "unknown",
    status: lane?.status ?? "blocked",
    idempotencyKey,
    storageWritePerformed: false,
    serverOnlyRequired: true,
    payload: safePayload,
    blockedBy: Array.from(new Set(blockedBy)),
    nextStep: lane?.nextStep ?? "Define storage lane before enabling writes.",
    productionBoundary: "This preview does not persist data. Production requires a server-only adapter, auth context, transaction and retention policy.",
  };
}

export function getStorageAdapterSummary(items = storageAdapterMatrix) {
  const blocked = items.filter((item) => item.status === "blocked");
  const review = items.filter((item) => item.status === "manual_review");
  const ready = items.filter((item) => item.status === "ready");
  return {
    averageProgress: Math.round(items.reduce((sum, item) => sum + item.progress, 0) / items.length),
    p0Open: items.filter((item) => item.priority === "P0" && item.status !== "ready").length,
    blockedCount: blocked.length,
    reviewCount: review.length,
    readyCount: ready.length,
    nextCriticalStep:
      blocked.find((item) => item.priority === "P0")?.nextStep ??
      review.find((item) => item.priority === "P0")?.nextStep ??
      "Keep storage writes locked until all P0 lanes are durable.",
  };
}
