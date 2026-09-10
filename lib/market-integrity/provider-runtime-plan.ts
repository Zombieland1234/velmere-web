import type { AnalysisDepth } from "./analysis-readiness";
import {
  readPass4656ProviderHealthSnapshot,
  resolvePass4656ProviderRuntimeDecision,
  type Pass4656ProviderHealthTransport,
  type Pass4656ProviderRuntimeDecision,
} from "./provider-health-store";

export type Pass4656ProviderDescriptor = {
  providerId: string;
  providerFamily: string;
  priority?: number;
};

export type Pass4656ProviderRuntimePlan = {
  schemaVersion: "pass4656_provider_runtime_plan_v1";
  tier: AnalysisDepth;
  enabled: boolean;
  generatedAt: string;
  decisions: Pass4656ProviderRuntimeDecision[];
  allowedProviderIds: string[];
  customerEvidenceProviderIds: string[];
  probeProviderIds: string[];
  blockedProviderIds: string[];
  hasCustomerTrafficPath: boolean;
  hasEvidencePath: boolean;
  customerEvidenceFamilyCount: number;
  requiredEvidenceFamilyCount: number;
  snapshotMode: string;
  snapshotDurable: boolean;
  snapshotBlockers: string[];
  ledgerFingerprint: string | null;
  blockers: string[];
};

type EnvLike = Record<string, string | undefined>;

export function pass4656ProviderRuntimeGateEnabled(env: EnvLike = process.env) {
  const production = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  if (production) return true;
  return env.VELMERE_PROVIDER_HEALTH_RUNTIME_GATE_ENABLED === "true";
}

function disabledDecision(provider: Pass4656ProviderDescriptor, tier: AnalysisDepth): Pass4656ProviderRuntimeDecision {
  return {
    schemaVersion: "pass4656_provider_runtime_decision_v1",
    providerId: provider.providerId,
    providerFamily: provider.providerFamily,
    tier,
    action: "allow",
    customerEvidenceEligible: true,
    maximumConcurrentRequests: null,
    nextAttemptAt: null,
    snapshotFresh: false,
    blockers: ["provider_health_runtime_gate_disabled"],
    ledgerFingerprint: null,
  };
}

export async function buildPass4656ProviderRuntimePlan(args: {
  tier: AnalysisDepth;
  providers: Pass4656ProviderDescriptor[];
  now?: Date;
  env?: EnvLike;
  enabled?: boolean;
  maximumConcurrentProbes?: number;
  transport?: Pass4656ProviderHealthTransport;
}): Promise<Pass4656ProviderRuntimePlan> {
  const env = args.env ?? process.env;
  const production = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  const enabled = production ? true : (args.enabled ?? pass4656ProviderRuntimeGateEnabled(env));
  const generatedAt = (args.now ?? new Date()).toISOString();
  const uniqueProviders = [...new Map(
    args.providers.map((provider) => [`${provider.providerFamily}::${provider.providerId}`, provider] as const),
  ).values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.providerId.localeCompare(b.providerId));

  const snapshotRead = enabled
    ? await readPass4656ProviderHealthSnapshot({ now: args.now, env, transport: args.transport })
    : null;
  const rawDecisions = enabled
    ? await Promise.all(uniqueProviders.map((provider) => resolvePass4656ProviderRuntimeDecision({
        providerId: provider.providerId,
        providerFamily: provider.providerFamily,
        tier: args.tier,
        now: args.now,
        env,
        transport: args.transport,
        snapshotRead: snapshotRead ?? undefined,
      })))
    : uniqueProviders.map((provider) => disabledDecision(provider, args.tier));

  // Probe-only mode exists to discover whether a provider recovered. It must
  // never fan out across all unknown/half-open providers in one customer
  // request, otherwise a missing health snapshot becomes an accidental load
  // test. Keep a deterministic, bounded probe budget.
  const maximumConcurrentProbes = Math.max(0, Math.min(2, args.maximumConcurrentProbes ?? 1));
  let probesUsed = 0;
  const decisions = rawDecisions.map((decision) => {
    if (decision.action !== "probe_only") return decision;
    if (probesUsed < maximumConcurrentProbes) {
      probesUsed += 1;
      return decision;
    }
    return {
      ...decision,
      action: "block" as const,
      maximumConcurrentRequests: 0,
      blockers: Array.from(new Set([...decision.blockers, "request_probe_budget_exhausted"])),
    };
  });

  const allowedProviderIds = decisions
    .filter((decision) => decision.action === "allow" || decision.action === "allow_degraded" || decision.action === "probe_only")
    .map((decision) => decision.providerId);
  const customerEvidenceProviderIds = decisions
    .filter((decision) => decision.customerEvidenceEligible && (decision.action === "allow" || decision.action === "allow_degraded"))
    .map((decision) => decision.providerId);
  const probeProviderIds = decisions.filter((decision) => decision.action === "probe_only").map((decision) => decision.providerId);
  const blockedProviderIds = decisions.filter((decision) => decision.action === "block").map((decision) => decision.providerId);
  const customerEvidenceFamilyCount = new Set(
    decisions
      .filter((decision) => decision.customerEvidenceEligible && (decision.action === "allow" || decision.action === "allow_degraded"))
      .map((decision) => decision.providerFamily),
  ).size;
  const requiredEvidenceFamilyCount = args.tier === "advanced" ? 4 : args.tier === "pro" ? 2 : 1;
  const blockers = Array.from(new Set([
    ...decisions.flatMap((decision) => decision.action === "block"
      ? decision.blockers.map((blocker) => `${decision.providerId}:${blocker}`)
      : []),
    customerEvidenceFamilyCount < requiredEvidenceFamilyCount
      ? `provider_family_quorum:${customerEvidenceFamilyCount}/${requiredEvidenceFamilyCount}`
      : null,
  ].filter((value): value is string => Boolean(value))));

  return {
    schemaVersion: "pass4656_provider_runtime_plan_v1",
    tier: args.tier,
    enabled,
    generatedAt,
    decisions,
    allowedProviderIds,
    customerEvidenceProviderIds,
    probeProviderIds,
    blockedProviderIds,
    hasCustomerTrafficPath: allowedProviderIds.length > 0,
    hasEvidencePath: customerEvidenceFamilyCount >= requiredEvidenceFamilyCount,
    customerEvidenceFamilyCount,
    requiredEvidenceFamilyCount,
    snapshotMode: snapshotRead?.mode ?? (enabled ? "unavailable" : "disabled"),
    snapshotDurable: snapshotRead?.durable ?? false,
    snapshotBlockers: snapshotRead?.blockers ?? [],
    ledgerFingerprint: snapshotRead?.snapshot?.ledgerFingerprint ?? null,
    blockers,
  };
}


export function buildPass4656FailClosedProviderRuntimePlan(args: {
  tier: AnalysisDepth;
  providers: Pass4656ProviderDescriptor[];
  reason: string;
  now?: Date;
}): Pass4656ProviderRuntimePlan {
  const generatedAt = (args.now ?? new Date()).toISOString();
  const reason = args.reason.trim() || "provider_runtime_plan_unavailable";
  const uniqueProviders = [...new Map(
    args.providers.map((provider) => [`${provider.providerFamily}::${provider.providerId}`, provider] as const),
  ).values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.providerId.localeCompare(b.providerId));
  const decisions: Pass4656ProviderRuntimeDecision[] = uniqueProviders.map((provider) => ({
    schemaVersion: "pass4656_provider_runtime_decision_v1",
    providerId: provider.providerId,
    providerFamily: provider.providerFamily,
    tier: args.tier,
    action: "block",
    customerEvidenceEligible: false,
    maximumConcurrentRequests: 0,
    nextAttemptAt: null,
    snapshotFresh: false,
    blockers: [reason, "provider_runtime_plan_fail_closed"],
    ledgerFingerprint: null,
  }));
  return {
    schemaVersion: "pass4656_provider_runtime_plan_v1",
    tier: args.tier,
    enabled: true,
    generatedAt,
    decisions,
    allowedProviderIds: [],
    customerEvidenceProviderIds: [],
    probeProviderIds: [],
    blockedProviderIds: decisions.map((decision) => decision.providerId),
    hasCustomerTrafficPath: false,
    hasEvidencePath: false,
    customerEvidenceFamilyCount: 0,
    requiredEvidenceFamilyCount: args.tier === "advanced" ? 4 : args.tier === "pro" ? 2 : 1,
    snapshotMode: "error_fail_closed",
    snapshotDurable: false,
    snapshotBlockers: [reason, "provider_runtime_plan_fail_closed"],
    ledgerFingerprint: null,
    blockers: decisions.flatMap((decision) => decision.blockers.map((blocker) => `${decision.providerId}:${blocker}`)),
  };
}

export function pass4656ProviderDecision(plan: Pass4656ProviderRuntimePlan, providerId: string) {
  return plan.decisions.find((decision) => decision.providerId === providerId) ?? null;
}

export function pass4656ProviderAllowed(plan: Pass4656ProviderRuntimePlan, providerId: string) {
  return plan.allowedProviderIds.includes(providerId);
}

export function pass4656ProviderAllowedFailClosed(args: {
  plan: Pass4656ProviderRuntimePlan | null | undefined;
  providerId: string;
  gateEnabled: boolean;
}) {
  if (args.plan) return pass4656ProviderAllowed(args.plan, args.providerId);
  return args.gateEnabled ? false : true;
}

export function pass4656ProviderObservationOrigin(
  plan: Pass4656ProviderRuntimePlan | null | undefined,
  providerId: string,
): "customer" | "probe" {
  return plan && pass4656ProviderDecision(plan, providerId)?.action === "probe_only" ? "probe" : "customer";
}
