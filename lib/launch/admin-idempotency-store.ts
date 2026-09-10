import { summarizeLaunchReadiness } from "@/lib/launch/launch-readiness-summary";

export type AdminIdempotencyStatus = "ready" | "partial" | "blocked" | "manual_review";

export type AdminIdempotencyItem = {
  id: string;
  label: string;
  status: AdminIdempotencyStatus;
  progress: number;
  sourceMode: "contract_draft" | "storage_missing" | "manual_review";
  requiredBeforePublicLaunch: boolean;
  operatorPromise: string;
  safetyBoundary: string;
  blockers: string[];
  nextStep: string;
};

export type AdminIdempotencyPreview = {
  idempotencyKey: string;
  normalizedKey: string;
  valid: boolean;
  storageMode: "missing" | "database" | "kv";
  duplicatePolicy: "block_duplicate" | "return_previous" | "missing";
  ttlSeconds: number;
  missing: string[];
};

export const adminIdempotencyStoreMatrix: AdminIdempotencyItem[] = [
  {
    id: "key-normalization",
    label: "Idempotency key normalization",
    status: "manual_review",
    progress: 54,
    sourceMode: "contract_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Every write request uses a stable key tied to action, target and operator.",
    safetyBoundary: "No publish or audit write retry should create duplicate state changes.",
    blockers: ["client key", "server normalization", "operator binding", "target binding"],
    nextStep: "Bind idempotency key to action, target id and authenticated operator id.",
  },
  {
    id: "idempotency-storage",
    label: "Idempotency storage",
    status: "blocked",
    progress: 14,
    sourceMode: "storage_missing",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Server stores key result so retries return previous outcome instead of repeating mutation.",
    safetyBoundary: "In-memory or UI-only dedupe is not enough for production mutations.",
    blockers: ["database/KV table", "unique index", "ttl policy", "previous result"],
    nextStep: "Create persistent idempotency store with unique key and TTL.",
  },
  {
    id: "duplicate-response",
    label: "Duplicate response policy",
    status: "manual_review",
    progress: 38,
    sourceMode: "manual_review",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Duplicate write attempts return previous safe result and never repeat publish/storage mutation.",
    safetyBoundary: "Duplicate response must not leak raw payloads or secrets from the first request.",
    blockers: ["previous safe result", "redacted replay", "status code", "operator copy"],
    nextStep: "Define duplicate replay response using redacted safe payload only.",
  },
  {
    id: "ttl-policy",
    label: "TTL and retention policy",
    status: "blocked",
    progress: 20,
    sourceMode: "contract_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Idempotency keys expire according to mutation risk and retention policy.",
    safetyBoundary: "No indefinite private key storage without retention class and deletion policy.",
    blockers: ["TTL by action", "retention class", "cleanup job", "policy copy"],
    nextStep: "Define TTL by action: import, sync, publish, overwrite and support export.",
  },
];

export function createAdminIdempotencyPreview(input: {
  idempotencyKey?: string;
  action?: string;
  targetId?: string;
  operatorId?: string;
}): AdminIdempotencyPreview {
  const rawKey = input.idempotencyKey?.trim() || "";
  const action = input.action?.trim() || "action:missing";
  const targetId = input.targetId?.trim() || "target:missing";
  const operatorId = input.operatorId?.trim() || "operator:missing";
  const normalizedKey = rawKey
    ? `${action}:${targetId}:${operatorId}:${rawKey}`.replace(/[^a-z0-9:_-]/gi, "").slice(0, 160)
    : "idempotency:missing";

  const missing = [
    ...(!rawKey ? ["idempotency key"] : []),
    ...(operatorId === "operator:missing" || operatorId === "operator:unknown" ? ["auth-bound operator id"] : []),
    ...(targetId === "target:missing" || targetId === "target:unresolved" ? ["target id"] : []),
    "persistent idempotency storage",
  ];

  return {
    idempotencyKey: rawKey || "missing",
    normalizedKey,
    valid: missing.length === 1 && missing[0] === "persistent idempotency storage",
    storageMode: "missing",
    duplicatePolicy: "missing",
    ttlSeconds: 60 * 60 * 24,
    missing,
  };
}

export function getAdminIdempotencyStoreSummary() {
  return summarizeLaunchReadiness(adminIdempotencyStoreMatrix);
}

export const adminIdempotencyStoreLaunchNote =
  "Admin idempotency store is a contract/preview. Production still needs persistent KV/database storage, unique indexes and redacted duplicate responses.";
