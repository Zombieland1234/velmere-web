import { buildRiskBrain } from "@/lib/market-integrity/risk-brain";
import {
  buildPass4650ProviderQualitySnapshot,
  type Pass4650EvidenceCategory,
  type Pass4650ProviderQualitySnapshot,
} from "@/lib/market-integrity/provider-quality-replay";
import type { RiskSignalId, TokenRiskResult } from "@/lib/market-integrity/risk-types";
import {
  createVlmKernelEvidenceItem,
  runVlmBrainKernel,
  type VlmBrainKernelDepth,
  type VlmBrainKernelFinding,
  type VlmBrainKernelLocale,
  type VlmBrainKernelOutput,
  type VlmBrainKernelSeverity,
  type VlmBrainKernelSurface,
} from "./vlm-brain-kernel";

export type VlmRiskKernelPayload = {
  result: TokenRiskResult;
  riskBrain: ReturnType<typeof buildRiskBrain>;
  tier: "basic" | "pro" | "advanced";
};

function riskSignalSeverity(severity: TokenRiskResult["signals"][number]["severity"]): VlmBrainKernelSeverity {
  if (severity === "critical") return "critical";
  if (severity === "high") return "warning";
  if (severity === "medium") return "watch";
  return "info";
}


function riskFreshnessProfile(provider: string): "crypto_market" | "onchain" {
  return /etherscan|alchemy|quicknode|defillama|dexscreener|on-?chain|holder|liquidity/i.test(provider)
    ? "onchain"
    : "crypto_market";
}

type RiskCopy = {
  unavailableHeadline: (symbol: string) => string;
  unavailableSummary: string;
  scoreTitle: (score: number) => string;
  scoreSummary: string;
  signalBody: (id: string, points: number, severity: string) => string;
  missingReason: string;
};

function riskCopy(locale: VlmBrainKernelLocale): RiskCopy {
  if (locale === "de") {
    return {
      unavailableHeadline: (symbol) => `${symbol}: keine belastbare Risikobewertung`,
      unavailableSummary: "Bestätigte externe Evidenz reicht nicht für einen numerischen Risikowert. Fehlende Daten bleiben sichtbar und blockieren stärkere Aussagen.",
      scoreTitle: (score) => `Risikowert ${score}/100`,
      scoreSummary: "Risk Brain hat bestätigte Marktsignale, Quellenabdeckung und Verlauf zu einem evidence-bound Ergebnis verbunden.",
      signalBody: (id, points, severity) => `Risikosignal ${id} trägt ${points} Punkte bei. Schweregrad=${severity}.`,
      missingReason: "Dieser Nachweis fehlt für eine belastbare Bewertung.",
    };
  }
  if (locale === "en") {
    return {
      unavailableHeadline: (symbol) => `${symbol}: no publishable risk verdict`,
      unavailableSummary: "Confirmed external evidence is insufficient for a numeric risk score. Missing data remains visible and blocks stronger claims.",
      scoreTitle: (score) => `Risk score ${score}/100`,
      scoreSummary: "Risk Brain merged confirmed market signals, source coverage and history into an evidence-bound result.",
      signalBody: (id, points, severity) => `Risk signal ${id} contributes ${points} points. Severity=${severity}.`,
      missingReason: "This evidence is missing and limits a reliable verdict.",
    };
  }
  return {
    unavailableHeadline: (symbol) => `${symbol}: brak publikowalnego werdyktu ryzyka`,
    unavailableSummary: "Potwierdzone dowody zewnętrzne nie wystarczają do publikacji liczbowego score. Braki danych pozostają widoczne i blokują mocniejsze twierdzenia.",
    scoreTitle: (score) => `Wynik ryzyka ${score}/100`,
    scoreSummary: "Risk Brain połączył potwierdzone sygnały rynkowe, pokrycie źródeł i historię w wynik ograniczony dowodami.",
    signalBody: (id, points, severity) => `Sygnał ryzyka ${id} wnosi ${points} punktów. Poziom=${severity}.`,
    missingReason: "Tego dowodu brakuje do wiarygodnego werdyktu.",
  };
}

function requestedRiskIdentity(result: TokenRiskResult): string {
  return result.token.tokenAddress ?? result.token.marketId ?? result.token.symbol;
}

function requestedRiskIdentityAliases(result: TokenRiskResult): string[] {
  return [result.token.symbol, result.token.marketId, result.token.tokenAddress]
    .filter((value): value is string => Boolean(value?.trim()));
}

const SCORE_SIGNAL_EVIDENCE_CATEGORIES = {
  extreme_drawdown: ["history_volatility"],
  major_drawdown: ["history_volatility"],
  severe_24h_drop: ["history_volatility"],
  high_24h_drop: ["history_volatility"],
  rapid_intraday_move: ["history_volatility"],
  parabolic_24h_gain: ["history_volatility"],
  parabolic_7d_gain: ["history_volatility"],
  parabolic_30d_gain: ["history_volatility"],
  multi_timeframe_pump: ["history_volatility"],
  new_ath_repricing: ["history_volatility"],
  thin_liquidity: ["liquidity"],
  very_thin_liquidity: ["liquidity"],
  volume_spike: ["history_volatility", "derivatives_microstructure"],
  wash_trading_risk: ["liquidity", "derivatives_microstructure"],
  holder_concentration: ["holders_ownership"],
  orderbook_depth_collapse: ["liquidity", "derivatives_microstructure"],
  orderbook_slippage_risk: ["liquidity", "derivatives_microstructure"],
  orderbook_imbalance: ["derivatives_microstructure"],
  rebrand_after_crash: ["history_volatility"],
  exchange_deposit_anomaly: ["holders_ownership"],
  contract_privileges: ["contract_permissions"],
  honeypot_risk: ["contract_permissions"],
  high_sell_tax: ["contract_permissions"],
  mint_risk: ["contract_permissions"],
  blacklist_risk: ["contract_permissions"],
  sell_pressure_imbalance: ["derivatives_microstructure"],
  low_dex_liquidity: ["liquidity"],
  market_volume_stress: ["market", "derivatives_microstructure"],
  fdv_marketcap_gap: ["supply_tokenomics"],
  supply_overhang: ["supply_tokenomics"],
  provider_health_degradation: ["market"],
  source_divergence: ["market"],
  stale_market_data: ["market"],
  insufficient_data: ["identity", "market"],
} as const satisfies Record<RiskSignalId, readonly Pass4650EvidenceCategory[]>;

const SCORE_BLOCKING_SIGNALS = new Set<RiskSignalId>(["stale_market_data", "insufficient_data"]);

function scoreSignalCategories(result: TokenRiskResult): Pass4650EvidenceCategory[] {
  const required = new Set<Pass4650EvidenceCategory>(["identity", "market"]);
  for (const signal of result.signals.filter((item) => item.points > 0)) {
    for (const category of SCORE_SIGNAL_EVIDENCE_CATEGORIES[signal.id]) required.add(category);
  }
  return Array.from(required).sort();
}

function independentRiskReceipts(result: TokenRiskResult, quality: Pass4650ProviderQualitySnapshot) {
  return (result.providerEvidenceReceipts ?? []).flatMap((receipt, index) => {
    const verdict = quality.verdicts[index];
    return verdict?.accepted && verdict.independent && verdict.providerRootFamily
      ? [{ receipt, providerRoot: verdict.providerRootFamily }]
      : [];
  });
}

function hasPublishableRiskEvidence(args: {
  result: TokenRiskResult;
  quality: Pass4650ProviderQualitySnapshot;
  requiredCategories: Pass4650EvidenceCategory[];
  blockingEngineSignals: RiskSignalId[];
}) {
  return args.quality.commerciallyUsable
    && args.quality.independentReceiptCount >= 2
    && args.requiredCategories.every((category) => args.quality.evidenceCategories.includes(category))
    && args.blockingEngineSignals.length === 0
    && (args.result.confidence ?? 0) > 0
    && args.result.dataQuality !== "demo";
}

function riskFindings(
  result: TokenRiskResult,
  copy: RiskCopy,
  publishableScore: boolean,
): VlmBrainKernelFinding[] {
  if (!publishableScore) {
    return [{
      id: "risk.verdict-unavailable",
      title: copy.unavailableHeadline(result.token.symbol),
      body: result.metaModel?.summary ?? copy.unavailableSummary,
      severity: "watch",
      confidence: 0,
      evidenceIds: ["risk.sources", "risk.market-data"],
    }];
  }

  const signalFindings: VlmBrainKernelFinding[] = result.signals.slice(0, 10).map((signal) => ({
    id: `risk.signal.${signal.id}`,
    title: signal.id.replaceAll("_", " "),
    body: copy.signalBody(signal.id, signal.points, signal.severity),
    severity: riskSignalSeverity(signal.severity),
    confidence: result.confidence ?? 0,
    evidenceIds: [`risk.signal.${signal.id}`],
  }));

  return [
    {
      id: "risk.score",
      title: copy.scoreTitle(result.score),
      body: result.metaModel?.summary ?? result.aiSummary ?? copy.scoreSummary,
      severity: result.level === "critical" ? "critical" : result.level === "high" ? "warning" : result.level === "medium" ? "watch" : "info",
      confidence: result.confidence ?? 0,
      evidenceIds: ["risk.market-data", "risk.sources"],
    },
    ...signalFindings,
  ];
}

export function analyzeRiskWithVlmKernel(input: {
  result: TokenRiskResult;
  history?: Array<{ score?: number; timestamp?: string }>;
  locale?: VlmBrainKernelLocale;
  depth?: VlmBrainKernelDepth;
  surface?: Extract<VlmBrainKernelSurface, "shield" | "real_markets" | "shield_map" | "browser" | "lens">;
}): VlmBrainKernelOutput<VlmRiskKernelPayload> {
  const riskBrain = buildRiskBrain(input.result, input.history ?? []);
  const result = input.result;
  const resolvedLocale = input.locale ?? "pl";
  const copy = riskCopy(resolvedLocale);
  const evaluatedAt = new Date();
  const providerQuality = buildPass4650ProviderQualitySnapshot({
    receipts: result.providerEvidenceReceipts,
    requestedIdentity: requestedRiskIdentity(result),
    requestedIdentityAliases: requestedRiskIdentityAliases(result),
    assetClass: result.token.assetClass ?? "unknown",
    evidenceProfile: "market",
    now: evaluatedAt,
  });
  const independentReceipts = independentRiskReceipts(result, providerQuality);
  const requiredScoreCategories = scoreSignalCategories(result);
  const missingScoreCategories = requiredScoreCategories.filter((category) => !providerQuality.evidenceCategories.includes(category));
  const blockingEngineSignals = result.signals
    .filter((signal) => signal.points > 0 && SCORE_BLOCKING_SIGNALS.has(signal.id))
    .map((signal) => signal.id);
  const publishableScore = hasPublishableRiskEvidence({
    result,
    quality: providerQuality,
    requiredCategories: requiredScoreCategories,
    blockingEngineSignals,
  });
  const providerEvidence = independentReceipts.map(({ receipt, providerRoot }, index) =>
    createVlmKernelEvidenceItem({
      id: `risk.provider.${index + 1}`,
      label: `Independent provider ${index + 1}`,
      source: receipt.providerId,
      providerFamily: providerRoot,
      independence: "independent",
      sourceTimestamp: receipt.observedAt,
      freshnessProfile: riskFreshnessProfile(`${receipt.providerId} ${providerRoot}`),
      providerLatencyMs: receipt.latencyMs,
      quality: "strong",
      freshness: "fresh",
      confidence: 84,
      value: receipt.payloadHash,
      receiptId: receipt.receiptId,
      payloadHash: receipt.payloadHash,
      capabilities: receipt.capabilities,
      timestampProvenance: receipt.timestampProvenance,
      receiptProviderFamily: receipt.providerFamily,
      providerRootFamily: providerRoot,
    }),
  );
  const evidence = [
    ...providerEvidence,
    createVlmKernelEvidenceItem({
      id: "risk.market-data",
      label: "Market metrics",
      source: "vlm-risk-market-fusion",
      providerFamily: "vlm-risk-engine",
      independence: "derived",
      sourceTimestamp: result.generatedAt,
      freshnessProfile: "crypto_market",
      quality: result.dataQuality === "live" ? "strong" : result.dataQuality === "partial" ? "medium" : "weak",
      freshness: result.dataQuality === "live" ? "fresh" : "unknown",
      confidence: result.dataQuality === "live" ? 84 : result.dataQuality === "partial" ? 62 : 38,
      value: result.generatedAt,
    }),
    createVlmKernelEvidenceItem({
      id: "risk.sources",
      label: "Verified independent provider roots",
      source: "risk-engine",
      providerFamily: "vlm-risk-engine",
      independence: "derived",
      sourceTimestamp: independentReceipts[0]?.receipt.observedAt ?? null,
      freshnessProfile: "crypto_market",
      quality: independentReceipts.length >= 2 ? "strong" : independentReceipts.length === 1 ? "weak" : "missing",
      freshness: "unknown",
      confidence: independentReceipts.length >= 2 ? 80 : independentReceipts.length === 1 ? 32 : 0,
      value: independentReceipts.length,
      missingReason: independentReceipts.length >= 2
        ? undefined
        : `Verified independent provider receipt quorum is ${independentReceipts.length}/2; display-only source labels do not count.`,
    }),
    createVlmKernelEvidenceItem({
      id: "risk.signals",
      label: "Risk signals",
      source: "risk-engine",
      providerFamily: "vlm-risk-engine",
      independence: "derived",
      sourceTimestamp: result.generatedAt,
      freshnessProfile: "crypto_market",
      quality: result.signals.length ? "medium" : "weak",
      freshness: "fresh",
      confidence: result.signals.length ? 68 : 40,
      value: result.signals.length,
    }),
    createVlmKernelEvidenceItem({
      id: "risk.history",
      label: "Persistent risk history",
      source: "vlm-memory",
      providerFamily: "vlm-memory",
      independence: "derived",
      sourceTimestamp: input.history?.at(-1)?.timestamp ?? null,
      freshnessProfile: "crypto_market",
      quality: (input.history?.length ?? 0) >= 2 ? "medium" : "missing",
      freshness: "unknown",
      confidence: (input.history?.length ?? 0) >= 2 ? 64 : 0,
      value: input.history?.length ?? 0,
      missingReason: (input.history?.length ?? 0) >= 2 ? undefined : "Risk history has fewer than two snapshots.",
    }),
  ];

  return runVlmBrainKernel(
    {
      surface: input.surface ?? "shield",
      depth: input.depth ?? "advanced",
      locale: resolvedLocale,
      input: result,
      evidence,
      intent: "market_risk_review",
      memoryKey: `risk:${result.token.marketId ?? result.token.symbol}`,
    },
    {
      result,
      riskBrain,
      tier: input.depth ?? "advanced",
    },
    {
      confidence: publishableScore ? riskBrain.confidence : 0,
      status: publishableScore && riskBrain.missingData.length <= 2 && result.dataQuality !== "demo" ? "ready" : "needs_review",
      headline: publishableScore ? `${result.token.symbol}: ${copy.scoreTitle(riskBrain.brainScore)}` : copy.unavailableHeadline(result.token.symbol),
      summary: publishableScore ? copy.scoreSummary : copy.unavailableSummary,
      findings: riskFindings(result, copy, publishableScore),
      missingData: [
        ...(independentReceipts.length >= 2 ? [] : [{
          id: "risk.missing.provider-receipt-quorum",
          label: "Verified independent provider receipt quorum",
          reason: `Only ${independentReceipts.length}/2 distinct canonical provider roots with distinct content hashes are available. Display labels are not evidence.`,
          blocksPublish: true,
        }]),
        ...(providerQuality.commerciallyUsable ? [] : [{
          id: "risk.missing.provider-quality-gate",
          label: "Central provider quality gate",
          reason: providerQuality.blockers.length > 0
            ? `Provider quality is not commercially usable: ${providerQuality.blockers.join("; ")}.`
            : `Provider quality is below the Basic commercial evidence contract (score ${providerQuality.qualityScore}/100).`,
          blocksPublish: true,
        }]),
        ...(missingScoreCategories.length === 0 ? [] : [{
          id: "risk.missing.score-signal-coverage",
          label: "Evidence coverage for score-driving signals",
          reason: `Independent provider receipts do not cover required categories: ${missingScoreCategories.join(", ")}.`,
          blocksPublish: true,
        }]),
        ...(blockingEngineSignals.length === 0 ? [] : [{
          id: "risk.missing.engine-data-state",
          label: "Risk-engine data state",
          reason: `The engine reported score-blocking data signals: ${blockingEngineSignals.join(", ")}.`,
          blocksPublish: true,
        }]),
        ...riskBrain.missingData.map((item) => ({
          id: `risk.missing.${item.replaceAll(" ", "-")}`,
          label: item,
          reason: copy.missingReason,
          blocksPublish: false,
        })),
      ],
      nextActions: riskBrain.nextActions.map((action, index) => ({
        id: `risk.next.${index + 1}`,
        title: action,
        body: action,
        required: index === 0,
        owner: "operator",
      })),
    },
  );
}
