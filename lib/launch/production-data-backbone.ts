export type ProductionDataBackboneStatus = "ready" | "manual_review" | "blocked";
export type ProductionDataBackbonePriority = "P0" | "P1" | "P2";
export type ProductionDataBackboneArea =
  | "audit_ledger"
  | "source_freshness"
  | "analytics"
  | "operator_workflow"
  | "storage"
  | "privacy";

export type ProductionDataBackboneItem = {
  id: string;
  area: ProductionDataBackboneArea;
  priority: ProductionDataBackbonePriority;
  status: ProductionDataBackboneStatus;
  progress: number;
  title: string;
  promise: string;
  missing: string[];
  nextStep: string;
  productionBoundary: string;
};

export const productionDataBackboneMatrix: ProductionDataBackboneItem[] = [
  {
    id: "durable-audit-ledger",
    area: "audit_ledger",
    priority: "P0",
    status: "blocked",
    progress: 54,
    title: "Durable audit ledger",
    promise: "Every publish, checkout, Shield export and admin mutation should write an immutable server-side event.",
    missing: ["database adapter", "write transaction", "retention policy"],
    nextStep: "Connect a durable storage adapter and require an idempotency key for every write.",
    productionBoundary: "No localStorage-only audit trail can be treated as production evidence.",
  },
  {
    id: "source-freshness-registry",
    area: "source_freshness",
    priority: "P0",
    status: "manual_review",
    progress: 62,
    title: "Source freshness registry",
    promise: "Each market/source lane exposes freshness, source mode, timestamp and fallback state.",
    missing: ["freshness TTL per adapter", "expired-source UI state", "source ledger persistence"],
    nextStep: "Attach TTL rules for market, candles, orderbook, holders, contract and OSINT lanes.",
    productionBoundary: "A stale or fallback source must stay visible and cannot be phrased as a final verdict.",
  },
  {
    id: "operator-workflow-state",
    area: "operator_workflow",
    priority: "P1",
    status: "manual_review",
    progress: 60,
    title: "Operator workflow state",
    promise: "Operator actions move cases through draft, review, blocked, approved and rollback states.",
    missing: ["real operator identity", "case state storage", "rollback evidence links"],
    nextStep: "Bind admin session identity to every mutation and store case state transitions.",
    productionBoundary: "Preview mode must not pretend that a human operator approved the case.",
  },
  {
    id: "analytics-event-taxonomy",
    area: "analytics",
    priority: "P1",
    status: "manual_review",
    progress: 45,
    title: "Analytics event taxonomy",
    promise: "Track product, Shield, Square, VLM and checkout events without PII, seed phrases or wallet secrets.",
    missing: ["event sink", "consent model", "dashboard"],
    nextStep: "Implement safe event names and redacted payload schema before adding a vendor.",
    productionBoundary: "Analytics must never include private keys, seed phrases, raw wallet signatures or unredacted emails.",
  },
  {
    id: "storage-adapter-contract",
    area: "storage",
    priority: "P0",
    status: "blocked",
    progress: 50,
    title: "Storage adapter contract",
    promise: "All durable writes go through a typed adapter with no direct client write access.",
    missing: ["adapter implementation", "RLS / server-only gate", "migration plan"],
    nextStep: "Create server-only adapter interface for audit events, source snapshots and operator cases.",
    productionBoundary: "Client components may request writes; they must not own the persistence layer.",
  },
  {
    id: "privacy-redaction-envelope",
    area: "privacy",
    priority: "P0",
    status: "manual_review",
    progress: 78,
    title: "Privacy redaction envelope",
    promise: "Every exported event is scrubbed for secrets, auth headers, tokens, raw emails and wallet-sensitive data.",
    missing: ["field allowlist coverage", "export reviewer", "retention class"],
    nextStep: "Use a strict allowlist and redact unknown fields before storage/export.",
    productionBoundary: "Unknown payload keys should be dropped or redacted until explicitly allowlisted.",
  },
];

export type ProductionDataBackboneSummary = {
  averageProgress: number;
  blockedCount: number;
  reviewCount: number;
  readyCount: number;
  p0Open: number;
  nextCriticalStep: string;
};

export function getProductionDataBackboneSummary(items = productionDataBackboneMatrix): ProductionDataBackboneSummary {
  const averageProgress = Math.round(items.reduce((sum, item) => sum + item.progress, 0) / items.length);
  const blocked = items.filter((item) => item.status === "blocked");
  const review = items.filter((item) => item.status === "manual_review");
  const ready = items.filter((item) => item.status === "ready");
  const p0Open = items.filter((item) => item.priority === "P0" && item.status !== "ready").length;
  const nextCriticalStep =
    blocked.find((item) => item.priority === "P0")?.nextStep ??
    review.find((item) => item.priority === "P0")?.nextStep ??
    review[0]?.nextStep ??
    "Keep production gates locked until durable storage and source freshness are verified.";

  return {
    averageProgress,
    blockedCount: blocked.length,
    reviewCount: review.length,
    readyCount: ready.length,
    p0Open,
    nextCriticalStep,
  };
}

export function createProductionDataBackboneSnapshot() {
  const generatedAt = new Date().toISOString();
  const summary = getProductionDataBackboneSummary();
  return {
    schemaVersion: "velmere-production-data-backbone-v1",
    mode: "readiness_preview",
    generatedAt,
    summary,
    items: productionDataBackboneMatrix.map((item) => ({
      id: item.id,
      area: item.area,
      priority: item.priority,
      status: item.status,
      progress: item.progress,
      missing: item.missing,
      nextStep: item.nextStep,
      productionBoundary: item.productionBoundary,
    })),
    exportNote: "Readiness snapshot only. It is not a production audit log until durable storage is connected.",
  };
}
