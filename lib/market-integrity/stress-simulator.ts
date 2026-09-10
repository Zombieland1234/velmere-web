import type { TokenRiskResult } from "./risk-types";

export type StressScenario = {
  id: string;
  label: string;
  severity: "low" | "watch" | "warning" | "critical";
  score: number;
  estimatedSlippagePercent?: number;
  estimatedDrawdownPercent?: number;
  evidence: string[];
  nextStep: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function severityFromScore(score: number): StressScenario["severity"] {
  if (score >= 82) return "critical";
  if (score >= 62) return "warning";
  if (score >= 35) return "watch";
  return "low";
}

function safeNumber(value: number | undefined, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function slippageForSell(liquidityUsd: number, sellUsd: number, baseSlippage?: number) {
  if (liquidityUsd <= 0) return undefined;
  const impact = (sellUsd / Math.max(liquidityUsd, 1)) * 100;
  return clamp(impact * 0.55 + safeNumber(baseSlippage) * 0.65, 0, 100);
}

export function buildStressScenarios(result: TokenRiskResult) {
  const liquidityUsd = safeNumber(result.metrics.liquidityUsd);
  const marketCap = safeNumber(result.metrics.marketCap);
  const volume24h = safeNumber(result.metrics.volume24h);
  const volumeRatio = safeNumber(result.metrics.volumeToMarketCapRatio);
  const baseSlippage = result.metrics.simulatedSlippage10k;
  const change24h = Math.abs(safeNumber(result.metrics.priceChange24h));
  const holderPercent = safeNumber(result.metrics.top10HolderPercent);
  const taxPressure = safeNumber(result.metrics.sellTaxPercentage) + safeNumber(result.metrics.buyTaxPercentage);
  const dataPenalty = result.dataQuality === "demo" ? 18 : result.dataQuality === "partial" ? 10 : 2;

  const sellSizes = [10_000, 50_000, 100_000];
  const sellScenarios = sellSizes.map((sellUsd) => {
    const slip = slippageForSell(liquidityUsd, sellUsd, baseSlippage);
    const liquidityStress = liquidityUsd > 0 ? clamp((sellUsd / liquidityUsd) * 60, 0, 100) : 72;
    const score = Math.round(clamp(liquidityStress + safeNumber(slip) * 0.45 + dataPenalty));
    return {
      id: `sell_${sellUsd}`,
      label: `$${sellUsd.toLocaleString("en-US")} sell shock`,
      severity: severityFromScore(score),
      score,
      estimatedSlippagePercent: slip,
      estimatedDrawdownPercent: slip !== undefined ? clamp(slip * 0.55 + change24h * 0.12, 0, 100) : undefined,
      evidence: [
        liquidityUsd > 0 ? `Visible liquidity: $${Math.round(liquidityUsd).toLocaleString("en-US")}` : "No reliable visible liquidity source.",
        baseSlippage !== undefined ? `Known 10k slippage proxy: ${baseSlippage.toFixed(2)}%.` : "No live slippage proxy available.",
      ],
      nextStep: score >= 62 ? "Open order book/depth review before trusting exit liquidity." : "Keep as monitoring scenario; no immediate liquidity stress from this notional.",
    } satisfies StressScenario;
  });

  const pumpScore = Math.round(clamp(change24h * 1.35 + volumeRatio * 145 + dataPenalty));
  const holderScore = Math.round(clamp(holderPercent * 0.72 + (liquidityUsd && marketCap ? (marketCap / Math.max(liquidityUsd, 1)) * 0.018 : 22) + dataPenalty));
  const contractScore = Math.round(clamp(taxPressure * 4 + (result.token.tokenAddress ? 0 : 12) + dataPenalty));

  const scenarios: StressScenario[] = [
    ...sellScenarios,
    {
      id: "social_velocity_burst",
      label: "Social / velocity burst",
      severity: severityFromScore(pumpScore),
      score: pumpScore,
      estimatedDrawdownPercent: clamp(change24h * 0.45 + volumeRatio * 55, 0, 100),
      evidence: [
        `24h move proxy: ${change24h.toFixed(2)}%.`,
        volume24h > 0 ? `24h volume: $${Math.round(volume24h).toLocaleString("en-US")}.` : "Volume source missing or too sparse.",
      ],
      nextStep: pumpScore >= 62 ? "Compare social momentum against chain holder flows before displaying confidence." : "No strong velocity burst from the current market inputs.",
    },
    {
      id: "holder_exit_cluster",
      label: "Holder exit cluster",
      severity: severityFromScore(holderScore),
      score: holderScore,
      estimatedDrawdownPercent: clamp(holderScore * 0.35, 0, 60),
      evidence: [
        holderPercent > 0 ? `Top holder proxy: ${holderPercent.toFixed(2)}%.` : "Holder concentration source missing.",
        liquidityUsd > 0 ? `Liquidity buffer: $${Math.round(liquidityUsd).toLocaleString("en-US")}.` : "No reliable liquidity buffer.",
      ],
      nextStep: holderScore >= 62 ? "Connect holder distribution and exclude CEX wallets before lowering risk." : "Holder exit stress is not dominant in the proxy model.",
    },
    {
      id: "contract_tax_pressure",
      label: "Contract / tax pressure",
      severity: severityFromScore(contractScore),
      score: contractScore,
      evidence: [
        `Buy + sell tax proxy: ${taxPressure.toFixed(2)}%.`,
        result.token.tokenAddress ? "Contract address present for deeper checks." : "No contract address available from current source.",
      ],
      nextStep: contractScore >= 62 ? "Escalate contract controls, owner privileges and blacklist/honeypot checks." : "Contract pressure is not dominant from available fields.",
    },
  ];

  const top = [...scenarios].sort((a, b) => b.score - a.score)[0];
  return {
    version: "velmere-shield-stress-simulator-v1",
    token: result.token,
    baseScore: result.score,
    worstScenario: top,
    scenarios: scenarios.sort((a, b) => b.score - a.score),
    modelLimits: [
      "This is a deterministic screening model, not proof of manipulation.",
      "Real holder clustering requires chain data and CEX-wallet exclusion.",
      "Order-book stress should be verified with live exchange depth when available.",
    ],
    generatedAt: new Date().toISOString(),
  };
}


export type StressScenarioBundle = ReturnType<typeof buildStressScenarios>;

export function getStressScenarioList(stress: StressScenarioBundle | StressScenario[] | null | undefined): StressScenario[] {
  if (!stress) return [];
  if (Array.isArray(stress)) return stress;
  return Array.isArray(stress.scenarios) ? stress.scenarios : [];
}

export function getWorstStressScenario(stress: StressScenarioBundle | StressScenario[] | null | undefined): StressScenario | undefined {
  return [...getStressScenarioList(stress)].sort((a, b) => b.score - a.score)[0];
}
