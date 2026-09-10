import {
  applyDurableRateLimit,
  type DurableRateLimitDecision,
  type DurableRateLimitOptions,
} from "@/lib/security/durable-rate-limit";

export const PASS4824_AUDIT_PROVIDER_BUDGET_ID = "pass4824-audit-provider-distributed-budget-v1" as const;

export type Pass4824AuditProviderId =
  | "etherscan-v2"
  | "dexscreener-api"
  | "goplus-token-security"
  | "honeypot-is"
  | "coingecko-search"
  | "sourcify-v2";

export type Pass4824ProviderBudgetReservation = {
  providerId: Pass4824AuditProviderId;
  cost: number;
};

const PROVIDER_LIMITS: Record<Pass4824AuditProviderId, { limit: number; windowMs: number }> = {
  "etherscan-v2": { limit: 60, windowMs: 60_000 },
  "dexscreener-api": { limit: 60, windowMs: 60_000 },
  "goplus-token-security": { limit: 60, windowMs: 60_000 },
  "honeypot-is": { limit: 60, windowMs: 60_000 },
  "coingecko-search": { limit: 60, windowMs: 60_000 },
  "sourcify-v2": { limit: 60, windowMs: 60_000 },
};

export class Pass4824AuditProviderBudgetError extends Error {
  readonly status: 429 | 503;
  readonly retryAfterSeconds: number;
  readonly providerId: Pass4824AuditProviderId;
  readonly decision: DurableRateLimitDecision;

  constructor(providerId: Pass4824AuditProviderId, decision: DurableRateLimitDecision) {
    const unavailable = decision.reason === "rate_limit_store_unavailable" || decision.mode === "unavailable";
    super(unavailable ? "audit_provider_budget_store_unavailable" : "audit_provider_budget_exceeded");
    this.name = "Pass4824AuditProviderBudgetError";
    this.status = unavailable ? 503 : 429;
    this.retryAfterSeconds = Math.max(1, decision.retryAfterSeconds ?? 60);
    this.providerId = providerId;
    this.decision = decision;
  }
}

export const pass4824AuditProviderBudgetDependencies: {
  rateLimit: (options: DurableRateLimitOptions) => Promise<DurableRateLimitDecision>;
} = {
  rateLimit: applyDurableRateLimit,
};

/**
 * Reserves global provider units before fan-out. Keys intentionally exclude the
 * requested asset so rotating query targets cannot create fresh quota buckets.
 */
export async function reservePass4824AuditProviderBudgets(
  reservations: Pass4824ProviderBudgetReservation[],
) {
  const unique = new Map<Pass4824AuditProviderId, number>();
  for (const reservation of reservations) {
    unique.set(
      reservation.providerId,
      Math.max(unique.get(reservation.providerId) ?? 0, Math.max(1, reservation.cost)),
    );
  }
  const decisions = await Promise.all(Array.from(unique, async ([providerId, cost]) => {
    const profile = PROVIDER_LIMITS[providerId];
    const decision = await pass4824AuditProviderBudgetDependencies.rateLimit({
      namespace: "pass4824:audit-provider-global-budget",
      key: providerId,
      limit: profile.limit,
      windowMs: profile.windowMs,
      cost,
    });
    return { providerId, decision };
  }));
  const blocked = decisions.find(({ decision }) => !decision.ok);
  if (blocked) throw new Pass4824AuditProviderBudgetError(blocked.providerId, blocked.decision);
  return decisions;
}

