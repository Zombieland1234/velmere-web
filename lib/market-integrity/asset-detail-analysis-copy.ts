// PASS4409 no-visual AssetDetail analysis-copy extraction.
// Boundary: pure analysis copy/evidence row helpers only. No JSX, CSS, className, layout or customer-visible visual changes.

import { buildVlmModalEvidencePacket } from "@/lib/market-integrity/vlm-modal-evidence-packet";

export const PASS4409_ASSET_DETAIL_ANALYSIS_COPY_BOUNDARY = {
  passId: "PASS4409",
  mode: "no_visual_asset_detail_analysis_copy_extraction",
  visualChanges: false,
  purpose:
    "Move AssetDetailModal tier copy, server evidence summary and VLM analysis row generation out of the client component to reduce build parse pressure while keeping identical UI output.",
  publicTopkaLiveAllowed: false,
} as const;

export type Pass4409AnalysisTierLabel = "Basic" | "Pro" | "Advanced";

export type Pass4409AssetDetailModalData = {
  symbol: string;
  name: string;
  assetClassLabel?: string;
  exchangeLabel?: string | null;
  priceLabel: string;
  changeLabel?: string | null;
  changeTone?: "up" | "down" | "neutral";
  sourceLabel?: string | null;
  sourceTimeLabel?: string | null;
  currencyLabel?: string | null;
  marketStatusLabel?: string | null;
  confidenceLabel?: string | null;
  riskLabel?: string | null;
};

export type Pass4409ServerEvidencePacket = {
  schemaVersion?: string;
  evidenceCoverageCap?: number;
  /** @deprecated compatibility alias; customer wording must use evidenceCoverageCap. */
  confidenceCap?: number;
  sourceCount?: number;
  providerCount?: number;
  providers?: string[];
  factsWithValue?: number;
  missingFacts?: number;
  missingData?: string[];
  nextChecks?: string[];
  sourceHealth?: {
    evidenceQuorum?: string;
    integrity?: string;
    temporal?: string;
  };
  claimPolicy?: {
    publicRule?: string;
    noUnsupportedLiquidityClaims?: boolean;
    noHolderClaimsWithoutHolderData?: boolean;
    noContractClaimsWithoutContractData?: boolean;
  };
};

export type Pass4409ServerEvidenceStatus = "idle" | "pending" | "verified" | "limited" | "gated";

export function analysisFieldCount(tier: Pass4409AnalysisTierLabel) {
  return tier === "Advanced" ? 20 : tier === "Pro" ? 14 : 10;
}

export function tierDepthCopy(tier: Pass4409AnalysisTierLabel) {
  if (tier === "Advanced") return "Paid evidence layer: scenarios, source gaps, liquidity proof status, anomaly queue and evidence packet.";
  if (tier === "Pro") return "Pro review: structure, trend quality, feed health and source reliability without unverified claims.";
  return "Basic review: identity, price, risk, source and missing-data clarity.";
}

export function tierToVlmDepth(tier: Pass4409AnalysisTierLabel) {
  return tier === "Advanced" ? "advanced" : tier === "Pro" ? "pro" : "basic";
}

export function publicEvidenceStatusCopy(status?: Pass4409ServerEvidenceStatus) {
  if (status === "verified") return "Server verified";
  if (status === "pending") return "Checking server packet";
  if (status === "gated") return "Access gated";
  if (status === "limited") return "Local packet only";
  return "Local evidence";
}

export function serverEvidenceSummary(packet?: Pass4409ServerEvidencePacket | null, status?: Pass4409ServerEvidenceStatus) {
  if (packet) {
    const sourceCount = typeof packet.sourceCount === "number" ? packet.sourceCount : 0;
    const providerCount = typeof packet.providerCount === "number" ? packet.providerCount : 0;
    const rawCoverage = typeof packet.evidenceCoverageCap === "number" ? packet.evidenceCoverageCap : packet.confidenceCap;
    const cap = typeof rawCoverage === "number" ? `${rawCoverage}% server evidence coverage` : "server evidence coverage pending";
    return `${sourceCount} sources · ${providerCount} providers · ${cap}`;
  }
  return publicEvidenceStatusCopy(status);
}

export function serverEvidenceProviders(packet?: Pass4409ServerEvidencePacket | null) {
  const providers = packet?.providers?.filter(Boolean) ?? [];
  return providers.length ? providers.slice(0, 4).join(", ") : "Provider list pending";
}

export function serverEvidenceMissingCopy(packet?: Pass4409ServerEvidencePacket | null) {
  const missing = packet?.missingData?.filter(Boolean) ?? [];
  const next = packet?.nextChecks?.filter(Boolean) ?? [];
  if (missing.length) return `Missing: ${missing.slice(0, 3).join(", ")}`;
  if (next.length) return `Next: ${next.slice(0, 3).join(", ")}`;
  return "No server-side gap list attached";
}

export function hasUsableMarketPrice(data: Pick<Pass4409AssetDetailModalData, "priceLabel">) {
  const label = data.priceLabel?.trim() ?? "";
  return Boolean(label && label !== "—" && !/^n\/?a$/i.test(label));
}

export function orderbookEvidenceStatus(data: Pick<Pass4409AssetDetailModalData, "sourceLabel" | "exchangeLabel">) {
  const source = `${data.sourceLabel ?? ""} ${data.exchangeLabel ?? ""}`.toLowerCase();
  if (source.includes("orderbook") || source.includes("depth") || source.includes("spread")) return "attached";
  return "missing";
}

export function sourceEvidenceLabel(tier: Pass4409AnalysisTierLabel, data: Pass4409AssetDetailModalData) {
  const packet = buildVlmModalEvidencePacket({ ...data, tier });
  if (!hasUsableMarketPrice(data)) return packet.sourceCount > 0 ? `${packet.sourceCount} provider family attached · price missing` : "Data gap";
  if (packet.sourceCount <= 0) return "Source missing";
  return `${packet.sourceCount} independent provider famil${packet.sourceCount === 1 ? "y" : "ies"} attached`;
}

export function evidenceCoverageCapLabel(tier: Pass4409AnalysisTierLabel, data: Pass4409AssetDetailModalData) {
  const packet = buildVlmModalEvidencePacket({ ...data, tier });
  return `${packet.evidenceCoverageCap}% tier evidence coverage`;
}

export function analysisResultRows(tier: Pass4409AnalysisTierLabel, data: Pass4409AssetDetailModalData) {
  const count = analysisFieldCount(tier);
  const source = data.sourceLabel ?? "source-bound feed";
  const risk = data.riskLabel ?? "pending";
  const change = data.changeLabel ?? "neutral / unavailable";
  const hasPrice = hasUsableMarketPrice(data);
  const orderbookStatus = orderbookEvidenceStatus(data);
  const packet = buildVlmModalEvidencePacket({ ...data, tier });
  const rows = [
    { field: "Asset identity", reading: `${data.symbol} · ${data.name}`, status: "identity locked", action: "Keep canonical symbol, name and surface context attached" },
    { field: "Price feed", reading: hasPrice ? data.priceLabel : "missing price", status: hasPrice ? "live / provider-bound" : "data gap", action: "Never infer price when provider returns no value" },
    { field: "Change", reading: change, status: data.changeTone ?? "neutral", action: "Use 24h/live change first; never use full chart range as current change" },
    { field: "Risk score", reading: risk, status: "bounded", action: "Show uncertainty and missing inputs clearly" },
    { field: "Primary source", reading: source, status: packet.sourceSummary, action: "Attach timestamp and provider status to every read" },
    { field: "Market state", reading: data.marketStatusLabel ?? "market state pending", status: data.currencyLabel ?? "USD", action: "Keep session/currency visible in every result" },
    { field: "Momentum", reading: data.changeTone === "down" ? "negative pressure" : data.changeTone === "up" ? "positive pressure" : "mixed / neutral", status: "price-derived only", action: "Confirm with volume and source freshness before strong wording" },
    { field: "Volatility", reading: tier === "Basic" ? "basic candle range" : "range + wick + volume context", status: `${count} fields`, action: "Flag abnormal candles without ROI or prediction copy" },
    { field: "Volume layer", reading: "volume context available when provider sends volume", status: "chart-bound", action: "Separate liquidity proxy from real order-book depth" },
    { field: "Missing data", reading: orderbookStatus === "missing" ? "depth/spread not attached" : "depth evidence attached", status: "explicit", action: "Missing evidence must reduce evidence coverage, not become a claim" },
    { field: "Support zone", reading: "recent swing support candidate", status: "Pro", action: "Derive only from visible candle clusters" },
    { field: "Resistance zone", reading: "recent swing resistance candidate", status: "Pro", action: "Show rejection/breakout context without price target" },
    { field: "Trend quality", reading: "structure + momentum blend", status: "Pro", action: "Classify clean trend vs noisy chop" },
    { field: "Feed health", reading: hasPrice ? "provider response present" : "provider response incomplete", status: "Pro", action: "Warn if stale, sparse, fallback or synthetic" },
    { field: "Liquidity proof", reading: orderbookStatus === "missing" ? "order-book/spread missing" : "depth/spread attached", status: "Advanced", action: "Do not say deep/tight spreads until proof is attached" },
    { field: "Cross-venue check", reading: tier === "Advanced" ? "secondary venue required" : "upgrade required", status: "Advanced", action: "Compare at least two venues before paid-depth claims" },
    { field: "Holder / supply risk", reading: "not connected in local modal", status: "Advanced gap", action: "Add holder clusters, unlocks, treasury and issuance data" },
    { field: "Contract / admin risk", reading: "not connected in market modal", status: "Advanced gap", action: "Add proxy, mint, blacklist, owner/admin permissions where relevant" },
    { field: "Narrative risk", reading: "news/social layer required", status: "Advanced", action: "Separate hype from verifiable data" },
    { field: "Evidence packet", reading: `${packet.confirmedCount} confirmed · ${packet.limitedCount} limited · ${packet.missingCount + packet.lockedCount} gaps`, status: `${packet.evidenceCoverageCap}% evidence ceiling`, action: packet.claimPolicy.publicRule },
  ];
  return rows.slice(0, count);
}
