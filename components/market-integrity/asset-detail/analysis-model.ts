import { buildVlmModalEvidencePacket } from "@/lib/market-integrity/vlm-modal-evidence-packet";
import {
  analysisFieldCount,
  evidenceCoverageCapLabel,
  hasUsableMarketPrice,
  orderbookEvidenceStatus,
  sourceEvidenceLabel,
} from "@/lib/market-integrity/asset-detail-analysis-copy";
import type { VlmAssetDetailModalData } from "./contract";
import type { AnalysisTierLabel } from "./analysis-contract";
import { parseNumericLabel, type AnalysisInsightItem } from "./visuals";

export function exactDetailMetric(data: VlmAssetDetailModalData, pattern: RegExp) {
  return data.detailMetrics?.find((metric) => pattern.test(metric.label.trim())) ?? null;
}

export function analysisConfidencePercent(tier: AnalysisTierLabel, data: VlmAssetDetailModalData): number | null {
  void tier;
  if (data.confidenceCalibrated !== true) return null;
  const explicit = parseNumericLabel(data.confidenceLabel);
  return explicit === null ? null : Math.max(0, Math.min(100, Math.round(explicit)));
}

export function analysisLiquidityDescriptor(data: VlmAssetDetailModalData) {
  const metric = exactDetailMetric(data, /^(?:liquidity|płynność|liquidität)$/i);
  return metric?.value?.trim() || "Source data unavailable";
}

export function analysisInvestmentGrade(tier: AnalysisTierLabel, data: VlmAssetDetailModalData) {
  return buildVlmModalEvidencePacket({ ...data, tier }).coverageGrade;
}

export function hasVerifiedLiveMarketData(data: VlmAssetDetailModalData) {
  return data.marketDataState === "live_verified";
}

export function analysisRiskStack(_tier: AnalysisTierLabel, data: VlmAssetDetailModalData) {
  const rows: Array<{ label: string; score: number }> = [];
  const risk = parseNumericLabel(data.riskLabel);
  if (risk !== null) rows.push({ label: "Risk score", score: Math.max(0, Math.min(100, Math.round(risk))) });
  const metricPatterns: Array<[string, RegExp]> = [
    ["Liquidity", /^(?:liquidity|płynność|liquidität)$/i],
    ["Volatility", /^(?:volatility|zmienność|volatilität)$/i],
    ["Manipulation", /^(?:manipulation|manipulacja)$/i],
    ["Squeeze", /^squeeze$/i],
  ];
  for (const [label, pattern] of metricPatterns) {
    const value = parseNumericLabel(exactDetailMetric(data, pattern)?.value);
    if (value !== null) rows.push({ label, score: Math.max(0, Math.min(100, Math.round(value))) });
  }
  return rows;
}

export function analysisVolatilityMeter(data: VlmAssetDetailModalData) {
  const explicit = parseNumericLabel(exactDetailMetric(data, /^(?:volatility|zmienność|volatilität)(?:\s*\([^)]*\))?$/i)?.value);
  if (explicit !== null) {
    const value = Math.max(0, Math.min(100, Math.round(explicit)));
    return { value, label: value >= 55 ? "High" : value >= 34 ? "Moderate" : "Low", available: true, source: "provider metric" };
  }
  const closes = (data.candles ?? []).map((candle) => candle.close).filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (closes.length < 3) return { value: null, label: "Source data unavailable", available: false, source: "missing" };
  const returns = closes.slice(1).map((close, index) => Math.abs((close - closes[index]) / closes[index]) * 100).filter(Number.isFinite);
  if (!returns.length) return { value: null, label: "Source data unavailable", available: false, source: "missing" };
  const realized = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const value = Math.max(0, Math.min(100, Math.round(realized * 12)));
  return { value, label: value >= 55 ? "High" : value >= 34 ? "Moderate" : "Low", available: true, source: "realized from candles" };
}

export function candleSparklineValues(data: VlmAssetDetailModalData, offset = 0) {
  const closes = (data.candles ?? [])
    .map((candle) => candle.close)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (closes.length < 3) return null;
  const sample = closes.slice(Math.max(0, closes.length - 34 - offset), Math.max(3, closes.length - offset));
  const compact = sample.filter((_, index) => index % Math.max(1, Math.floor(sample.length / 7)) === 0).slice(-7);
  return compact.length >= 3 ? compact : sample.slice(-7);
}

export function analysisInsightRows(tier: AnalysisTierLabel, data: VlmAssetDetailModalData): AnalysisInsightItem[] {
  const risk = parseNumericLabel(data.riskLabel);
  const volatility = analysisVolatilityMeter(data);
  const liquidity = analysisLiquidityDescriptor(data);
  const hasPrice = hasUsableMarketPrice(data);
  const liveVerified = hasVerifiedLiveMarketData(data);
  const orderbookStatus = orderbookEvidenceStatus(data);
  const baseRows: AnalysisInsightItem[] = [
    {
      key: "asset",
      title: "Asset identity",
      reading: `${data.symbol} · ${data.name}`,
      detail: "Canonical symbol, venue context and market identity stay attached to every read.",
      badge: "Mapped",
      tone: "neutral",
      sparkline: [],
    },
    {
      key: "price",
      title: "Price feed",
      reading: hasPrice ? data.priceLabel : "Price unavailable",
      detail: liveVerified
        ? "The server-verified LIVE gate passed; price remains separate from risk conclusions."
        : hasPrice
          ? "A price value is present, but no server-verified LIVE gate is attached."
          : "Provider returned no confirmed price. Keep this visible instead of inventing data.",
      badge: liveVerified ? "LIVE VERIFIED" : hasPrice ? "NOT LIVE VERIFIED" : "Data gap",
      tone: liveVerified ? "positive" : hasPrice ? "neutral" : "watch",
      sparkline: hasPrice ? candleSparklineValues(data) ?? [] : [],
    },
    {
      key: "source",
      title: "Source lane",
      reading: sourceEvidenceLabel(tier, data),
      detail: data.sourceLabel ? `Primary source: ${data.sourceLabel}.` : "No primary source label is attached yet.",
      badge: data.sourceLabel ? "Source" : "Missing",
      tone: data.sourceLabel ? "neutral" : "watch",
      sparkline: [],
    },
    {
      key: "momentum",
      title: "Momentum",
      reading: data.changeTone === "up" ? "Positive pressure" : data.changeTone === "down" ? "Negative pressure" : "Balanced flow",
      detail: data.changeTone === "up" ? "Short-term follow-through is present, but still needs volume/source confirmation." : data.changeTone === "down" ? "Short-term momentum is weak. Watch for reversal or continuation signals." : "Momentum is mixed. Confirmation is still needed.",
      badge: data.changeTone === "up" ? "Positive" : data.changeTone === "down" ? "Watch" : "Neutral",
      tone: data.changeTone === "up" ? "positive" : data.changeTone === "down" ? "watch" : "neutral",
      sparkline: candleSparklineValues(data) ?? [],
    },
    {
      key: "volatility",
      title: "Volatility",
      reading: volatility.value === null ? "Source data unavailable" : `${volatility.label} · ${volatility.value}/100`,
      detail: volatility.value === null
        ? "No provider volatility metric or usable candle history is attached."
        : volatility.source === "provider metric"
          ? "Provider-supplied volatility metric is attached to this read."
          : "Realized volatility is calculated only from the attached candle closes.",
      badge: volatility.value === null ? "Data gap" : volatility.label,
      tone: volatility.value === null || volatility.value >= 55 ? "watch" : "neutral",
      sparkline: candleSparklineValues(data) ?? [],
    },
    {
      key: "liquidity",
      title: "Liquidity",
      reading: liquidity,
      detail: orderbookStatus === "missing"
        ? "Order-book depth, spread and slippage are not attached. No liquidity proxy is generated."
        : "Depth/spread evidence is attached and can support a source-bound liquidity read.",
      badge: orderbookStatus === "missing" ? "Data gap" : "Verified",
      tone: orderbookStatus === "missing" ? "watch" : "positive",
      sparkline: [],
    },
    {
      key: "risk",
      title: "Risk score",
      reading: risk === null ? "Source data unavailable" : `${risk}/100 · ${risk <= 33 ? "Low" : risk <= 66 ? "Moderate" : "High"}`,
      detail: risk === null
        ? "No source-bound risk score is attached. The interface must not substitute a default score."
        : "Risk stays separate from price direction and must be capped when source lanes are missing.",
      badge: risk === null ? "Data gap" : risk <= 33 ? "Low" : risk <= 66 ? "Watch" : "High",
      tone: risk === null ? "watch" : risk <= 33 ? "positive" : risk <= 66 ? "watch" : "risk",
      sparkline: [],
    },
    {
      key: "missing-data",
      title: "Missing data",
      reading: orderbookStatus === "missing" ? "Depth/spread missing" : "Depth attached",
      detail: orderbookStatus === "missing" ? "Do not output words like deep orderbook, tight spread or slippage quality until this lane is connected." : "Liquidity claims can be upgraded because depth evidence is present.",
      badge: orderbookStatus === "missing" ? "Gap" : "Ready",
      tone: orderbookStatus === "missing" ? "watch" : "positive",
      sparkline: [],
    },
    {
      key: "structure",
      title: "Market structure",
      reading: tier === "Advanced" ? "Multi-layer structure" : tier === "Pro" ? "Swing-aware structure" : "Core structure",
      detail: tier === "Basic" ? "Basic only shows a simple structure label." : "Pro and Advanced separate swing structure from raw price movement.",
      badge: tier === "Basic" ? "Core" : "Mapped",
      tone: "neutral",
      sparkline: candleSparklineValues(data) ?? [],
    },
    {
      key: "evidence-coverage",
      title: "Evidence coverage",
      reading: evidenceCoverageCapLabel(tier, data),
      detail: "Coverage reflects attached evidence lanes for this tier. It is not calibrated confidence and cannot be increased by tier name alone.",
      badge: "Coverage",
      tone: "neutral",
      sparkline: [],
    },
  ];

  const proRows: AnalysisInsightItem[] = [
    {
      key: "support",
      title: "Support zone",
      reading: "Recent reaction area",
      detail: "Derived only from visible candle clusters, not from predicted price targets.",
      badge: "Pro",
      tone: "neutral",
      sparkline: candleSparklineValues(data, 2) ?? [],
    },
    {
      key: "resistance",
      title: "Resistance zone",
      reading: "Recent supply area",
      detail: "Used as context for rejection/breakout monitoring, not as a promise.",
      badge: "Pro",
      tone: "neutral",
      sparkline: candleSparklineValues(data, 1) ?? [],
    },
    {
      key: "trend-quality",
      title: "Trend quality",
      reading: "Structure + momentum blend",
      detail: "Separates clean trend from noisy chop before the model uses stronger language.",
      badge: "Pro",
      tone: "neutral",
      sparkline: candleSparklineValues(data) ?? [],
    },
    {
      key: "feed-health",
      title: "Feed health",
      reading: liveVerified ? "Server-verified LIVE" : hasPrice ? "Source value present" : "Provider response incomplete",
      detail: liveVerified
        ? "The explicit server LIVE gate passed; Advanced still applies its own wider evidence requirements."
        : hasPrice
          ? "Price presence alone does not prove freshness, identity, quorum or LIVE delivery."
          : "Missing provider data must remain visible.",
      badge: liveVerified ? "LIVE VERIFIED" : hasPrice ? "NOT LIVE VERIFIED" : "Gap",
      tone: liveVerified ? "positive" : hasPrice ? "neutral" : "watch",
      sparkline: hasPrice ? candleSparklineValues(data) ?? [] : [],
    },
  ];

  const advancedRows: AnalysisInsightItem[] = [
    {
      key: "cross-venue",
      title: "Cross-venue check",
      reading: "Secondary venue required",
      detail: "Advanced should compare at least two venues before escalating confidence.",
      badge: "Advanced gap",
      tone: "watch",
      sparkline: [],
    },
    {
      key: "orderbook",
      title: "Order-book proof",
      reading: orderbookStatus === "missing" ? "Not attached" : "Attached",
      detail: orderbookStatus === "missing" ? "Depth, spread and slippage remain missing, so liquidity claims are capped." : "Depth evidence supports a stronger liquidity lane.",
      badge: orderbookStatus === "missing" ? "Missing" : "Proof",
      tone: orderbookStatus === "missing" ? "watch" : "positive",
      sparkline: [],
    },
    {
      key: "holders",
      title: "Holder / supply risk",
      reading: "Not connected",
      detail: "Needs holder clusters, treasury/CEX wallets, unlocks and issuance context.",
      badge: "Gap",
      tone: "watch",
      sparkline: [],
    },
    {
      key: "contract-admin",
      title: "Contract / admin risk",
      reading: "Not connected",
      detail: "Needs proxy, mint, blacklist, owner/admin permissions where relevant.",
      badge: "Gap",
      tone: "watch",
      sparkline: [],
    },
    {
      key: "scenario-map",
      title: "Scenario map",
      reading: "Bull / base / bear outline",
      detail: "Shows possible structures without price promises or ROI language.",
      badge: "Advanced",
      tone: "neutral",
      sparkline: candleSparklineValues(data) ?? [],
    },
    {
      key: "narrative-risk",
      title: "Narrative risk",
      reading: "News/social layer required",
      detail: "Separates hype, KOL pressure and filings/news from candle-only data.",
      badge: "Gap",
      tone: "watch",
      sparkline: [],
    },
    {
      key: "anomaly-scan",
      title: "Anomaly scan",
      reading: "Wick/gap/volume queue",
      detail: "Flags unusual candles as audit notes instead of predictive claims.",
      badge: "Advanced",
      tone: "neutral",
      sparkline: candleSparklineValues(data) ?? [],
    },
    {
      key: "evidence-packet",
      title: "Evidence packet",
      reading: "Receipts pending final engine",
      detail: "Final paid output should include source IDs, timestamps, provider status and missing-data caps.",
      badge: "Advanced",
      tone: "neutral",
      sparkline: [],
    },
  ];

  if (tier === "Advanced") return [...baseRows, ...proRows, ...advancedRows].slice(0, analysisFieldCount(tier));
  if (tier === "Pro") return [...baseRows, ...proRows].slice(0, analysisFieldCount(tier));
  return baseRows.slice(0, analysisFieldCount(tier));
}

export function insightToneClass(tone: AnalysisInsightItem["tone"]) {
  if (tone === "positive") return "vlm-analysis-signal-badge vlm-analysis-signal-badge--positive";
  if (tone === "watch") return "vlm-analysis-signal-badge vlm-analysis-signal-badge--watch";
  if (tone === "risk") return "vlm-analysis-signal-badge vlm-analysis-signal-badge--risk";
  return "vlm-analysis-signal-badge vlm-analysis-signal-badge--neutral";
}


export type TierReaderCard = {
  title: string;
  value: string;
  body: string;
  badge: string;
};

export function tierReaderCards(tier: AnalysisTierLabel, data: VlmAssetDetailModalData): TierReaderCard[] {
  const risk = parseNumericLabel(data.riskLabel);
  const volatility = analysisVolatilityMeter(data);
  const liquidity = analysisLiquidityDescriptor(data);
  const hasPrice = hasUsableMarketPrice(data);
  const liveVerified = hasVerifiedLiveMarketData(data);
  const orderbookStatus = orderbookEvidenceStatus(data);
  const momentum = data.changeTone === "up" ? "positive pressure" : data.changeTone === "down" ? "negative pressure" : "mixed flow";
  const coreCards: TierReaderCard[] = [
    {
      title: "What changed now",
      value: data.changeLabel ?? "current change pending",
      body: hasPrice
        ? `${data.symbol} is reading ${momentum}. ${liveVerified ? "The server-verified LIVE gate passed." : "A value is present, but LIVE is not verified."} The price feed stays separated from the risk score.`
        : "The provider did not return a confirmed price. The result must stay capped until a usable feed is attached.",
      badge: liveVerified ? "LIVE VERIFIED" : tier === "Basic" ? "Core" : "Current context",
    },
    {
      title: "Risk meaning",
      value: risk === null ? "Source data unavailable" : `${risk}/100`,
      body: risk === null
        ? "No source-bound risk score is attached. The result stays withheld instead of using a default value."
        : risk <= 33
          ? "Current risk is low on the visible surface, but missing proof lanes still reduce certainty. This is not a guarantee of safety."
          : risk <= 66
            ? "The asset sits in a watch zone. The model should explain what is missing before it strengthens any conclusion."
            : "The asset needs a cautious read. Strong warnings must be tied to evidence, not hype or a single candle.",
      badge: risk === null ? "Data gap" : risk <= 33 ? "Low" : risk <= 66 ? "Watch" : "High",
    },
    {
      title: "Source quality",
      value: data.sourceLabel ?? "source pending",
      body: data.sourceTimeLabel
        ? `The result has a visible timestamp (${data.sourceTimeLabel}). Paid-depth output should reuse the same source time in Shield, PDF and Brain.`
        : "Timestamp is not visible yet, so freshness remains a missing-data lane.",
      badge: data.sourceTimeLabel ? "Timestamped" : "Freshness gap",
    },
  ];

  const proCards: TierReaderCard[] = [
    {
      title: "Structure read",
      value: volatility.label,
      body: volatility.value === null
        ? "Pro cannot add a volatility score until a provider metric or usable candle history is attached."
        : `Pro adds source-bound volatility context. Current reading is ${volatility.value}/100 from ${volatility.source}.`,
      badge: "Pro layer",
    },
    {
      title: "Liquidity wording",
      value: liquidity,
      body: orderbookStatus === "missing"
        ? "Depth, spread and slippage are not attached. The UI withholds liquidity instead of generating an activity proxy."
        : "Depth evidence is attached, so liquidity language can be source-bound.",
      badge: orderbookStatus === "missing" ? "Proxy" : "Verified",
    },
  ];

  const advancedCards: TierReaderCard[] = [
    {
      title: "Advanced lock",
      value: orderbookStatus === "missing" ? "proof required" : "depth ready",
      body: orderbookStatus === "missing"
        ? "Advanced should show scenario lanes, but it must keep order-book, holder, contract and squeeze claims locked until their proof packets exist."
        : "Advanced can lift some liquidity caps because depth proof is present, while holder/contract/squeeze lanes still need their own evidence.",
      badge: "Proof gate",
    },
    {
      title: "Squeeze / trap wording",
      value: "watch only",
      body: "Long/short squeeze, rug-pull, trap and exit-liquidity wording must stay as scenario watch unless the dedicated evidence packets are attached and fresh.",
      badge: "No overclaim",
    },
  ];

  if (tier === "Advanced") return [...coreCards, ...proCards, ...advancedCards];
  if (tier === "Pro") return [...coreCards, ...proCards];
  return coreCards;
}
