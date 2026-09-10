export const PASS4682_PAID_ACCESS_BOUNDARY_ID = "pass4682-server-entitlement-and-report-binding-v1" as const;

export type Pass4682EntitlementShape = {
  ok: boolean;
  ledgerMode?: "durable" | "memory" | "token_only_non_production";
  entitlement?: unknown | null;
};

export type Pass4682ServerEntitlementRecordShape = Pass4682EntitlementShape & {
  ok: true;
  ledgerMode: "durable" | "memory";
  entitlement: Record<string, unknown>;
};

export function hasPass4682ServerEntitlementRecord(
  verdict: Pass4682EntitlementShape,
): verdict is Pass4682ServerEntitlementRecordShape {
  return Boolean(
    verdict.ok &&
    verdict.entitlement &&
    typeof verdict.entitlement === "object" &&
    (verdict.ledgerMode === "durable" || verdict.ledgerMode === "memory"),
  );
}

export function validatePass4682PaidAccessTemporalClaims(args: {
  issuedAt: unknown;
  expiresAt: unknown;
  nowMs: number;
  maxTtlMs?: number;
  futureSkewMs?: number;
}) {
  const issuedAtMs = typeof args.issuedAt === "string" ? Date.parse(args.issuedAt) : Number.NaN;
  const expiresAtMs = typeof args.expiresAt === "string" ? Date.parse(args.expiresAt) : Number.NaN;
  const maxTtlMs = Math.max(60_000, Math.min(args.maxTtlMs ?? 365 * 24 * 60 * 60 * 1000, 365 * 24 * 60 * 60 * 1000));
  const futureSkewMs = Math.max(0, Math.min(args.futureSkewMs ?? 30_000, 5 * 60_000));
  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= issuedAtMs) {
    return { ok: false as const, error: "invalid_temporal_claims" as const };
  }
  if (issuedAtMs > args.nowMs + futureSkewMs) return { ok: false as const, error: "issued_in_future" as const };
  if (expiresAtMs - issuedAtMs > maxTtlMs) return { ok: false as const, error: "ttl_exceeds_policy" as const };
  if (expiresAtMs <= args.nowMs) return { ok: false as const, error: "expired" as const };
  return { ok: true as const, issuedAtMs, expiresAtMs };
}
