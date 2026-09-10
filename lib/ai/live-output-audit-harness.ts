import { independentProviderFamilies } from "./evidence-normalization";
import { vlmTierPriceEur, vlmTierPriceLabel, vlmTierRequiresPayment } from "./paid-tier-policy";

export const PASS2282_LIVE_OUTPUT_AUDIT_HARNESS_ID =
  "pass2282_live_output_audit_harness_world_power_v1" as const;

export type Pass2282Depth = "basic" | "pro" | "advanced";
export type Pass2282AssetFamily = "native_crypto" | "equity" | "etf" | "index" | "token_contract" | "unknown";

export type Pass2282AssetExpectation = {
  canonical: string;
  family: Pass2282AssetFamily;
  aliases: string[];
  mustShow: string[];
  missingIfUnconfirmed: string[];
  forbiddenWithoutScope: string[];
  confidenceRule: string;
  riskScoreRule: string;
};

export type Pass2282DepthExpectation = {
  depth: Pass2282Depth;
  paidRequired: boolean;
  outputShape: string[];
  sourceRequirement: string;
  hiddenUntilPaid: string[];
};

export const PASS2282_ASSET_EXPECTATIONS: Record<string, Pass2282AssetExpectation> = {
  BTC: {
    canonical: "BTC",
    family: "native_crypto",
    aliases: ["bitcoin", "btc"],
    mustShow: ["native market quote", "source freshness", "confidence cap", "not-applicable token-contract lanes"],
    missingIfUnconfirmed: ["independent venue quote", "orderbook/depth snapshot", "persistent history", "cross-venue confirmation"],
    forbiddenWithoutScope: ["ERC20 holders", "contract owner/admin", "honeypot", "sell tax", "mint/blacklist controls"],
    confidenceRule: "BTC can have a low risk-review score with low confidence; missing second venue caps confidence, not safety/risk truth.",
    riskScoreRule: "If BTC lands near 35 only because sources are missing, label it source-gap review priority, not live danger.",
  },
  NVDA: {
    canonical: "NVDA",
    family: "equity",
    aliases: ["nvidia", "nvda"],
    mustShow: ["equity quote", "market session/cadence", "issuer/fundamental freshness", "source confidence"],
    missingIfUnconfirmed: ["independent quote", "SEC/issuer filing freshness", "event/news source", "volume/candle freshness"],
    forbiddenWithoutScope: ["DEX liquidity", "wallet holders", "contract permissions", "honeypot", "token tax"],
    confidenceRule: "NVDA gaps are equity-provider gaps; they must never become token-scam language.",
    riskScoreRule: "A 35-like value on NVDA is a review-priority placeholder unless market anomaly evidence exists.",
  },
  SPY: {
    canonical: "SPY",
    family: "etf",
    aliases: ["spy", "spdr s&p 500", "s&p500 etf"],
    mustShow: ["ETF quote", "benchmark relation", "source cadence", "holdings/composition freshness"],
    missingIfUnconfirmed: ["independent quote", "ETF composition freshness", "benchmark confirmation", "provider divergence"],
    forbiddenWithoutScope: ["token holders", "contract owner", "DEX slippage", "mint controls"],
    confidenceRule: "SPY confidence depends on quote + ETF/benchmark freshness; missing composition is a confidence gap.",
    riskScoreRule: "SPY risk is market/ETF review priority, not token contract danger.",
  },
  "S&P 500": {
    canonical: "S&P 500",
    family: "index",
    aliases: ["s&p 500", "sp500", "^gspc", "gspc", "standard and poor"],
    mustShow: ["index quote", "session/cadence", "benchmark identity", "macro/breadth context when sourced"],
    missingIfUnconfirmed: ["independent index source", "macro/breadth source", "provider timestamp", "index methodology link"],
    forbiddenWithoutScope: ["wallet holders", "token contract", "DEX liquidity", "transfer tax"],
    confidenceRule: "S&P 500 missing macro/source lanes cap confidence and must not be filled with invented certainty.",
    riskScoreRule: "S&P 500 static score is a review priority marker until provider freshness and macro lanes are sourced.",
  },
};

export const PASS2282_DEPTH_EXPECTATIONS: Record<Pass2282Depth, Pass2282DepthExpectation> = {
  basic: {
    depth: "basic",
    paidRequired: false,
    outputShape: ["cautious verdict", "confirmed source", "risk vs confidence", "top gaps", "next safe check"],
    sourceRequirement: "1 confirmed source is enough for triage, but the answer must visibly cap confidence.",
    hiddenUntilPaid: ["operator appendix", "proof capsule", "independent review status", "full contradiction ledger"],
  },
  pro: {
    depth: "pro",
    paidRequired: false,
    outputShape: ["verdict", "source cadence", "second-provider status", "score drivers", "gaps", "next checks"],
    sourceRequirement: "Pro should attempt a second provider/cadence check and say clearly when it failed.",
    hiddenUntilPaid: ["operator appendix", "independent review status", "controlled evidence packet"],
  },
  advanced: {
    depth: "advanced",
    paidRequired: false,
    outputShape: ["scope", "evidence table", "source confidence", "contradiction scan", "severity", "remediation", "boundary"],
    sourceRequirement: "Advanced requires server-side entitlement and must separate evidence from missing lanes before any strong verdict.",
    hiddenUntilPaid: ["nothing after payment; before payment redact paid proof details"],
  },
};

function includesAlias(text: string, aliases: string[]) {
  const lower = text.toLowerCase();
  return aliases.some((alias) => lower.includes(alias.toLowerCase()));
}

export function detectPass2282AssetExpectation(text = "") {
  return Object.values(PASS2282_ASSET_EXPECTATIONS).find((asset) => includesAlias(text, [asset.canonical, ...asset.aliases])) ?? null;
}

export function buildPass2282VisibleOutputPlan(args: {
  depth: Pass2282Depth;
  assetText?: string | null;
  confirmedSources?: string[] | null;
  locale?: "pl" | "en" | "de";
}) {
  const asset = detectPass2282AssetExpectation(args.assetText ?? "") ?? {
    canonical: "unconfirmed asset",
    family: "unknown" as const,
    aliases: [],
    mustShow: ["scope", "confirmed source", "missing source", "boundary"],
    missingIfUnconfirmed: ["asset identity", "primary source", "second source", "freshness timestamp"],
    forbiddenWithoutScope: ["strong verdict", "guarantee", "paid certificate"],
    confidenceRule: "Unknown scope caps confidence until primary source and asset identity are confirmed.",
    riskScoreRule: "Unknown scope uses review priority only, not a final risk verdict.",
  };
  const depth = PASS2282_DEPTH_EXPECTATIONS[args.depth];
  const confirmed = independentProviderFamilies(args.confirmedSources).slice(0, 6);
  const sourceState = confirmed.length >= 2 ? "two_source_review" : confirmed.length === 1 ? "single_source_confidence_cap" : "source_gap";
  const missing = asset.missingIfUnconfirmed.filter((lane) => !confirmed.some((source) => source.toLowerCase().includes(lane.split(" ")[0].toLowerCase())));
  return {
    schemaVersion: PASS2282_LIVE_OUTPUT_AUDIT_HARNESS_ID,
    depth: args.depth,
    asset: asset.canonical,
    family: asset.family,
    paidRequired: vlmTierRequiresPayment(args.depth),
    tierPriceEur: vlmTierPriceEur(args.depth),
    sourceState,
    confirmedSources: confirmed,
    requiredVisibleSections: depth.outputShape,
    mustShow: asset.mustShow,
    missingLanes: missing.slice(0, args.depth === "basic" ? 4 : args.depth === "pro" ? 8 : 12),
    forbiddenWithoutScope: asset.forbiddenWithoutScope,
    confidenceRule: asset.confidenceRule,
    riskScoreRule: asset.riskScoreRule,
    sourceRequirement: depth.sourceRequirement,
    paymentRule: "Stripe/BLIK/Web3 unlock requires server-side confirmation; connect wallet is identity/context only.",
    hiddenUntilPaid: depth.hiddenUntilPaid,
  } as const;
}

export function buildPass2282RiskPresentation(args: {
  symbol?: string | null;
  rawScore?: number | null;
  confidenceCap?: number | null;
  confirmedSources?: string[] | null;
  missingLanes?: string[] | null;
  assetClass?: string | null;
}) {
  const asset = detectPass2282AssetExpectation(`${args.symbol ?? ""} ${args.assetClass ?? ""}`);
  const raw = typeof args.rawScore === "number" && Number.isFinite(args.rawScore) ? Math.max(0, Math.min(100, Math.round(args.rawScore))) : null;
  const confirmedCount = (args.confirmedSources ?? []).filter(Boolean).length;
  const missingCount = (args.missingLanes ?? []).filter(Boolean).length;
  const confidenceCap = typeof args.confidenceCap === "number" && Number.isFinite(args.confidenceCap)
    ? Math.max(0, Math.min(100, Math.round(args.confidenceCap)))
    : Math.max(26, Math.min(88, 38 + confirmedCount * 14 - Math.min(missingCount, 8) * 3));
  const looksStatic35 = raw !== null && raw >= 33 && raw <= 37 && confirmedCount < 2 && missingCount > 0;
  const presentationScore = looksStatic35 && asset
    ? asset.family === "native_crypto"
      ? 24
      : asset.family === "equity"
        ? 26
        : 28
    : raw;
  const label = looksStatic35
    ? "source-gap review priority, not live danger proof"
    : raw === null
      ? "score unavailable until source proof exists"
      : raw >= 70
        ? "high review priority"
        : raw >= 45
          ? "elevated review priority"
          : raw >= 30
            ? "watch review priority"
            : "calm prescreen";
  return {
    schemaVersion: PASS2282_LIVE_OUTPUT_AUDIT_HARNESS_ID,
    symbol: asset?.canonical ?? args.symbol ?? "unknown",
    family: asset?.family ?? "unknown",
    rawScore: raw,
    presentationScore,
    confidenceCap,
    confirmedCount,
    missingCount,
    static35Reframed: looksStatic35,
    label,
    rule: asset?.riskScoreRule ?? "Risk score is a review priority and must be interpreted with confidence/source coverage.",
  } as const;
}

export function buildPass2282AngelAuditScaffold(args: {
  locale: "pl" | "en" | "de";
  depth: Pass2282Depth;
  assetText?: string | null;
  confirmedSources?: string[] | null;
  missingLanes?: string[] | null;
  rawScore?: number | null;
  confidenceCap?: number | null;
}) {
  const plan = buildPass2282VisibleOutputPlan({ depth: args.depth, assetText: args.assetText, confirmedSources: args.confirmedSources, locale: args.locale });
  const risk = buildPass2282RiskPresentation({ symbol: plan.asset, rawScore: args.rawScore, confidenceCap: args.confidenceCap, confirmedSources: args.confirmedSources, missingLanes: args.missingLanes ?? plan.missingLanes, assetClass: plan.family });
  if (args.locale === "pl") {
    return [
      `${vlmTierPriceLabel(args.depth, "pl")}: ${plan.asset} (${plan.family}) · tier ${args.depth} · ${args.depth === "basic" ? "darmowy ograniczony prescreen" : args.depth === "pro" ? "beta wyłącznie na zaproszenie" : "nie na sprzedaż"}.`,
      `Układ: ${plan.requiredVisibleSections.join(" → ")}.`,
      `Źródła: ${plan.sourceState}; potwierdzone=${plan.confirmedSources.join(", ") || "brak"}; braki=${plan.missingLanes.slice(0, 5).join(", ")}.`,
      `Ryzyko: ${risk.label}; score=${risk.presentationScore ?? "n/a"}; confidence cap=${risk.confidenceCap}%; static35Reframed=${risk.static35Reframed}.`,
      `Zakazane bez scope: ${plan.forbiddenWithoutScope.slice(0, 4).join(", ")}. Wallet connect nie jest proofem płatności.`,
    ];
  }
  if (args.locale === "de") {
    return [
      `${vlmTierPriceLabel(args.depth, "de")}: ${plan.asset} (${plan.family}) · Tier ${args.depth} · ${args.depth === "basic" ? "kostenloser begrenzter Prescreen" : args.depth === "pro" ? "Beta nur auf Einladung" : "nicht zum Verkauf"}.`,
      `Layout: ${plan.requiredVisibleSections.join(" → ")}.`,
      `Quellen: ${plan.sourceState}; bestätigt=${plan.confirmedSources.join(", ") || "keine"}; Lücken=${plan.missingLanes.slice(0, 5).join(", ")}.`,
      `Risiko: ${risk.label}; Score=${risk.presentationScore ?? "n/a"}; Confidence Cap=${risk.confidenceCap}%; static35Reframed=${risk.static35Reframed}.`,
      `Verboten ohne Scope: ${plan.forbiddenWithoutScope.slice(0, 4).join(", ")}. Wallet Connect ist kein Payment Proof.`,
    ];
  }
  return [
    `${vlmTierPriceLabel(args.depth, "en")}: ${plan.asset} (${plan.family}) · tier ${args.depth} · ${args.depth === "basic" ? "free limited prescreen" : args.depth === "pro" ? "invitation-only beta" : "not for sale"}.`,
    `Layout: ${plan.requiredVisibleSections.join(" → ")}.`,
    `Sources: ${plan.sourceState}; confirmed=${plan.confirmedSources.join(", ") || "none"}; gaps=${plan.missingLanes.slice(0, 5).join(", ")}.`,
    `Risk: ${risk.label}; score=${risk.presentationScore ?? "n/a"}; confidence cap=${risk.confidenceCap}%; static35Reframed=${risk.static35Reframed}.`,
    `Forbidden without scope: ${plan.forbiddenWithoutScope.slice(0, 4).join(", ")}. Wallet connect is not payment proof.`,
  ];
}

export function buildPass2282LiveOutputAuditHarness() {
  return {
    schemaVersion: PASS2282_LIVE_OUTPUT_AUDIT_HARNESS_ID,
    tierPricesEur: { basic: vlmTierPriceEur("basic"), pro: vlmTierPriceEur("pro"), advanced: vlmTierPriceEur("advanced") },
    sampleAssets: Object.keys(PASS2282_ASSET_EXPECTATIONS),
    assetExpectations: PASS2282_ASSET_EXPECTATIONS,
    depthExpectations: PASS2282_DEPTH_EXPECTATIONS,
    regressionAssertions: [
      "BTC Basic/Pro/Advanced must never show ERC20 holder/contract/admin lanes unless a token-contract scope is provided.",
      "NVDA/SPY/S&P500 outputs must use equity/ETF/index source language, never DEX or honeypot language.",
      "A static 35-like score caused by missing source proof must be labelled review priority/confidence cap, not live danger proof.",
      "Basic, Pro and Advanced must visibly differ by proof depth and both paid tiers must remain behind tier-matched server-side entitlement.",
      "Stripe/BLIK/Web3 payment confirmation must be server-side; wallet connect alone is never payment proof.",
    ],
  } as const;
}

// PASS2282 markers: live output audit harness · BTC NVDA SPY S&P500 regression · Basic Pro Advanced visible difference · static35 reframed · Pro invitation-only beta / Advanced not for sale · Stripe BLIK Web3 server-side proof
