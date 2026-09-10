import type { RiskLevel, TokenRiskSignal } from "./risk-types";
import type { RiskEngineContext } from "./risk-engine-context";
import { addSignal, finiteNumber, rounded } from "./risk-engine-profile";

export type MicrostructureContractSignalMetrics = {
  buySellImbalancePercent?: number;
  top10HolderPercent?: number;
  holderCount?: number;
  buyTaxPercentage?: number;
  sellTaxPercentage?: number;
  simulatedSlippage10k?: number;
  bidAskImbalancePercent?: number;
};

export function collectMicrostructureHolderContractSignals(
  context: RiskEngineContext,
  signals: TokenRiskSignal[],
): MicrostructureContractSignalMetrics {
  const { safeInput, buys24h, sells24h } = context;
  const orderBookDepthDropPercent = finiteNumber(
    safeInput.orderBookDepthDropPercent,
  );
  if (
    orderBookDepthDropPercent !== undefined &&
    orderBookDepthDropPercent >= 45
  ) {
    addSignal(signals, {
      id: "orderbook_depth_collapse",
      severity:
        orderBookDepthDropPercent >= 85
          ? "critical"
          : orderBookDepthDropPercent >= 70
            ? "high"
            : "medium",
      points:
        orderBookDepthDropPercent >= 85
          ? 30
          : orderBookDepthDropPercent >= 70
            ? 22
            : 12,
      metrics: { orderBookDepthDropPercent: rounded(orderBookDepthDropPercent) },
    });
  }

  const simulatedSlippage10k = finiteNumber(safeInput.simulatedSlippage10k);
  if (simulatedSlippage10k !== undefined && simulatedSlippage10k >= 4) {
    addSignal(signals, {
      id: "orderbook_slippage_risk",
      severity:
        simulatedSlippage10k >= 30
          ? "critical"
          : simulatedSlippage10k >= 10
            ? "high"
            : "medium",
      points:
        simulatedSlippage10k >= 30 ? 30 : simulatedSlippage10k >= 10 ? 18 : 10,
      metrics: { simulatedSlippage10k: rounded(simulatedSlippage10k) },
    });
  }

  const bidAskImbalancePercent = finiteNumber(safeInput.bidAskImbalancePercent);
  if (
    bidAskImbalancePercent !== undefined &&
    Math.abs(bidAskImbalancePercent) >= 45
  ) {
    addSignal(signals, {
      id: "orderbook_imbalance",
      severity: Math.abs(bidAskImbalancePercent) >= 65 ? "high" : "medium",
      points: Math.abs(bidAskImbalancePercent) >= 65 ? 12 : 8,
      metrics: { bidAskImbalancePercent: rounded(bidAskImbalancePercent) },
    });
  }

  const top10HolderPercent = finiteNumber(safeInput.top10HolderPercent);
  if (top10HolderPercent !== undefined && top10HolderPercent >= 40) {
    addSignal(signals, {
      id: "holder_concentration",
      severity:
        top10HolderPercent >= 85
          ? "critical"
          : top10HolderPercent >= 65
            ? "high"
            : "medium",
      points:
        top10HolderPercent >= 85 ? 32 : top10HolderPercent >= 65 ? 20 : 11,
      metrics: {
        top10HolderPercent: rounded(top10HolderPercent),
        walletLabeling: "required",
      },
    });
  }
  const holderCount = finiteNumber(safeInput.holderCount);
  if (holderCount !== undefined && holderCount >= 0 && holderCount < 1_000) {
    addSignal(signals, {
      id: "holder_concentration",
      severity: holderCount < 200 ? "high" : "medium",
      points: holderCount < 200 ? 12 : 8,
      metrics: { holderCount: Math.round(holderCount), walletLabeling: "required" },
    });
  }

  if (safeInput.hadRebrandAfterCrash) {
    addSignal(signals, {
      id: "rebrand_after_crash",
      severity: "medium",
      points: 10,
      metrics: { rebrandAfterCrash: true },
    });
  }
  if (safeInput.abnormalExchangeDeposits) {
    addSignal(signals, {
      id: "exchange_deposit_anomaly",
      severity: "high",
      points: 20,
      metrics: { exchangeDepositAnomaly: true },
    });
  }
  if (safeInput.suspiciousContractPrivileges || safeInput.canPauseTrading) {
    const combinedAdminControls =
      safeInput.suspiciousContractPrivileges === true &&
      safeInput.canPauseTrading === true;
    addSignal(signals, {
      id: "contract_privileges",
      severity: "high",
      points: combinedAdminControls ? 24 : 18,
      metrics: {
        suspiciousContractPrivileges:
          safeInput.suspiciousContractPrivileges === true,
        canPauseTrading: safeInput.canPauseTrading === true,
        contractAdminReview: "required",
      },
    });
  }
  if (safeInput.isHoneypot) {
    addSignal(signals, {
      id: "honeypot_risk",
      severity: "critical",
      points: 48,
      metrics: { isHoneypot: true, contractAdminReview: "required" },
    });
  }

  const buyTaxPercentage = finiteNumber(safeInput.buyTaxPercentage);
  const sellTaxPercentage = finiteNumber(safeInput.sellTaxPercentage);
  const highestTransferTax = Math.max(
    buyTaxPercentage ?? 0,
    sellTaxPercentage ?? 0,
  );
  if (
    (sellTaxPercentage !== undefined && sellTaxPercentage >= 8) ||
    (sellTaxPercentage === undefined &&
      buyTaxPercentage !== undefined &&
      buyTaxPercentage >= 12)
  ) {
    const taxSeverity: RiskLevel =
      sellTaxPercentage !== undefined && sellTaxPercentage >= 50
        ? "critical"
        : highestTransferTax >= 25
          ? "high"
          : highestTransferTax >= 12
            ? "high"
            : "medium";
    const taxPoints =
      taxSeverity === "critical"
        ? 35
        : highestTransferTax >= 25
          ? 24
          : highestTransferTax >= 12
            ? 18
            : 10;
    const taxAsymmetryPercent =
      buyTaxPercentage !== undefined && sellTaxPercentage !== undefined
        ? Math.abs(sellTaxPercentage - buyTaxPercentage)
        : undefined;

    addSignal(signals, {
      id: "high_sell_tax",
      severity: taxSeverity,
      points: taxPoints,
      metrics: {
        buyTaxPercentage:
          buyTaxPercentage !== undefined ? rounded(buyTaxPercentage) : null,
        sellTaxPercentage:
          sellTaxPercentage !== undefined ? rounded(sellTaxPercentage) : null,
        highestTransferTax: rounded(highestTransferTax),
        taxAsymmetryPercent:
          taxAsymmetryPercent !== undefined
            ? rounded(taxAsymmetryPercent)
            : null,
        transferTaxReview: "required",
      },
    });
  }
  if (safeInput.canMintNewTokens) {
    addSignal(signals, {
      id: "mint_risk",
      severity: "high",
      points: 18,
      metrics: { canMintNewTokens: true, contractAdminReview: "required" },
    });
  }
  if (safeInput.canBlacklist) {
    addSignal(signals, {
      id: "blacklist_risk",
      severity: "high",
      points: 18,
      metrics: { canBlacklist: true, contractAdminReview: "required" },
    });
  }

  let buySellImbalancePercent: number | undefined;
  if (
    buys24h !== undefined &&
    sells24h !== undefined &&
    buys24h + sells24h > 0
  ) {
    buySellImbalancePercent =
      (Math.abs(buys24h - sells24h) / (buys24h + sells24h)) * 100;
    if (buySellImbalancePercent >= 70 && buys24h + sells24h >= 50) {
      addSignal(signals, {
        id: "sell_pressure_imbalance",
        severity: "medium",
        points: 10,
        metrics: {
          bidSideTrades24h: buys24h,
          askSideTrades24h: sells24h,
          buySellImbalancePercent: rounded(buySellImbalancePercent),
          dominantFlow:
            sells24h > buys24h ? "ask_side_pressure" : "bid_side_pressure",
        },
      });
    }
  }
  return {
    buySellImbalancePercent,
    top10HolderPercent,
    holderCount,
    buyTaxPercentage,
    sellTaxPercentage,
    simulatedSlippage10k,
    bidAskImbalancePercent,
  };
}
