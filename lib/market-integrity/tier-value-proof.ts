export type Pass4655Tier = "basic" | "pro" | "advanced";

export type Pass4655TierEvidence = {
  tier: Pass4655Tier;
  categories: string[];
  providerFamilies: string[];
  verifiedReceiptCount: number;
  durableReadBack: boolean;
  outageFamilySurvived?: boolean;
};

const REQUIRED_EXCLUSIVE: Record<Pass4655Tier, string[]> = {
  basic: ["identity", "market"],
  pro: ["liquidity", "history_volatility"],
  advanced: ["derivatives_microstructure", "scenario_dependency"],
};

const MINIMUM_UNIQUE_DELTA: Record<Pass4655Tier, number> = { basic: 2, pro: 2, advanced: 2 };

function unique(values: string[]) { return [...new Set(values.filter(Boolean))].sort(); }

export function evaluatePass4655TierValueProof(args: {
  current: Pass4655TierEvidence;
  lowerTier?: Pass4655TierEvidence | null;
  requiredExclusiveCategories?: string[];
  minimumUniqueDelta?: number;
}) {
  const categories = unique(args.current.categories);
  const lowerCategories = unique(args.lowerTier?.categories ?? []);
  const uniqueDelta = categories.filter((category) => !lowerCategories.includes(category));
  const requiredExclusive = unique(args.requiredExclusiveCategories ?? REQUIRED_EXCLUSIVE[args.current.tier]);
  const minimumUniqueDelta = Math.max(0, Math.floor(args.minimumUniqueDelta ?? MINIMUM_UNIQUE_DELTA[args.current.tier]));
  const exclusivePresent = requiredExclusive.filter((category) => categories.includes(category));
  const blockers = [
    uniqueDelta.length < minimumUniqueDelta
      ? `unique_evidence_delta:${uniqueDelta.length}/${minimumUniqueDelta}`
      : null,
    exclusivePresent.length < requiredExclusive.length
      ? `exclusive_categories:${exclusivePresent.length}/${requiredExclusive.length}`
      : null,
    args.current.tier !== "basic" && unique(args.current.providerFamilies).length < (args.current.tier === "advanced" ? 3 : 2)
      ? `provider_families:${unique(args.current.providerFamilies).length}/${args.current.tier === "advanced" ? 3 : 2}`
      : null,
    args.current.tier !== "basic" && args.current.verifiedReceiptCount < (args.current.tier === "advanced" ? 3 : 2)
      ? `verified_receipts:${args.current.verifiedReceiptCount}/${args.current.tier === "advanced" ? 3 : 2}`
      : null,
    args.current.tier !== "basic" && !args.current.durableReadBack ? "durable_read_back_missing" : null,
    args.current.tier === "advanced" && args.current.outageFamilySurvived !== true ? "single_provider_family_outage_not_proven" : null,
  ].filter((value): value is string => Boolean(value));
  return {
    schemaVersion: "pass4655_tier_value_proof_v1" as const,
    tier: args.current.tier,
    sellReady: blockers.length === 0,
    categories,
    lowerCategories,
    uniqueEvidenceDelta: uniqueDelta,
    uniqueEvidenceDeltaCount: uniqueDelta.length,
    minimumUniqueEvidenceDelta: minimumUniqueDelta,
    requiredExclusiveCategories: requiredExclusive,
    exclusiveCategoriesPresent: exclusivePresent,
    blockers,
    rule: "A paid tier is sell-ready only when it adds unique evidence, satisfies its exclusive lanes, has independent provider families and durable receipts; Advanced must also survive loss of one provider family.",
  };
}
