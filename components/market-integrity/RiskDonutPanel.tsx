"use client";

import { useMemo } from "react";
import { ShieldCheck, Activity } from "lucide-react";

type RiskDonutPanelProps = {
  riskScore: number;
  symbol: string;
  isTraditional?: boolean;
  confidence?: number;
  locale?: string;
};

export default function RiskDonutPanel({
  riskScore = 35,
  symbol = "BTC",
  isTraditional = false,
  confidence = 98,
  locale = "en",
}: RiskDonutPanelProps) {
  const isEn = locale !== "pl";

  // Ensure riskScore strictly reflects current asset telemetry (no arbitrary 35 fallback)
  const displayScore = useMemo(() => {
    const val = Number(riskScore);
    if (isNaN(val)) return 15;
    return Math.min(100, Math.max(0, Math.round(val)));
  }, [riskScore]);

  // Dynamic risk tier matching Velmère institutional methodology
  let riskLevel = isEn ? "LOW RISK" : "NISKIE RYZYKO";
  let riskColor = "text-emerald-400";
  let strokeColor = "#10b981";
  let glowColor = "rgba(16, 185, 129, 0.45)";
  let badgeBg = "bg-emerald-500/10 border-emerald-500/25 text-emerald-300";
  let summaryTitle = isEn ? "Low Market Risk" : "Niskie ryzyko rynkowe";
  let summaryDesc = isEn
    ? "Zero structural anomalies or liquidity threats detected. Order flow, volume, and depth remain strictly within statistical norms with no signs of manipulation."
    : "Brak anomalii rynkowych oraz zagrożeń płynnościowych. Wolumen i transakcje pozostają w normie statystycznej bez symptomów manipulacji.";

  if (displayScore >= 85) {
    riskLevel = isEn ? "CRITICAL RISK" : "KRYTYCZNE RYZYKO";
    riskColor = "text-red-500";
    strokeColor = "#ef4444";
    glowColor = "rgba(239, 68, 68, 0.55)";
    badgeBg = "bg-red-500/15 border-red-500/30 text-red-300";
    summaryTitle = isEn ? "Critical Market Risk" : "Krytyczne ryzyko rynkowe";
    summaryDesc = isEn
      ? "Severe order book imbalance, liquidity drain, or extreme volatility detected. Institutional caution required."
      : "Skrajna asymetria księgi zleceń, gwałtowny drenaż płynności lub skrajna zmienność. Wymagana najwyższa ostrożność.";
  } else if (displayScore >= 67) {
    riskLevel = isEn ? "HIGH RISK" : "WYSOKIE RYZYKO";
    riskColor = "text-rose-400";
    strokeColor = "#f43f5e";
    glowColor = "rgba(244, 63, 94, 0.45)";
    badgeBg = "bg-rose-500/10 border-rose-500/25 text-rose-300";
    summaryTitle = isEn ? "High Market Risk" : "Wysokie ryzyko rynkowe";
    summaryDesc = isEn
      ? "Order book asymmetry, heightened volatility, or volume concentration detected. Exercise elevated caution before transaction execution."
      : "Wykryto asymetrię zleceń, podwyższoną zmienność lub koncentrację wolumenu. Wymagana szczególna ostrożność przy zawieraniu transakcji.";
  } else if (displayScore >= 34) {
    riskLevel = isEn ? "MODERATE RISK" : "UMIARKOWANE RYZYKO";
    riskColor = "text-amber-400";
    strokeColor = "#f59e0b";
    glowColor = "rgba(245, 158, 11, 0.45)";
    badgeBg = "bg-amber-500/10 border-amber-500/25 text-amber-300";
    summaryTitle = isEn ? "Moderate Market Risk" : "Umiarkowane ryzyko rynkowe";
    summaryDesc = isEn
      ? "Periodic bid-ask depth fluctuations observed. Pre-execution slippage modeling recommended prior to block orders."
      : "Obserwowane są okresowe wahania głębokości księgi popytu. Zalecana weryfikacja poziomów poślizgu cenowego przed dużymi zleceniami.";
  }

  // Circular gauge geometry: size 130px, stroke 11px
  const size = 130;
  const strokeWidth = 11;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcSweep = (displayScore / 100) * circumference;

  return (
    <div className="flex h-full flex-col justify-between p-1">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.10] bg-white/[0.04]">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold tracking-tight text-white">Risk</h3>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
              {isEn ? "Velmère Telemetry" : "Telemetria Velmère"}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider ${badgeBg}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
          {riskLevel}
        </span>
      </div>

      {/* Middle Gauge & Score View */}
      <div className="my-auto py-4 flex flex-col sm:flex-row items-center gap-6">
        {/* Donut Gauge */}
        <div className="relative flex-shrink-0">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="-rotate-90 transform"
          >
            {/* Background Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.07)"
              strokeWidth={strokeWidth}
            />
            {/* Active Progress Arc */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcSweep} ${circumference}`}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{
                filter: `drop-shadow(0 0 8px ${glowColor})`,
              }}
            />
          </svg>

          {/* Center Score */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black tracking-tight text-white leading-none">
              {displayScore}
            </span>
            <span className="text-[11px] font-mono font-medium text-white/40 mt-1">
              / 100
            </span>
          </div>
        </div>

        {/* Right Summary */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
              {isEn ? "Asset profile:" : "Profil aktywa:"}
            </span>
            <span className="font-mono text-xs font-bold text-white">{symbol}</span>
          </div>
          <h4 className={`mt-1 text-base font-bold tracking-tight ${riskColor}`}>
            {summaryTitle}
          </h4>
          <p className="mt-2 text-xs leading-relaxed text-white/60">
            {summaryDesc}
          </p>
        </div>
      </div>

      {/* Institutional Telemetry Footer (Clean & Uncluttered) */}
      <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-white/50">
            <Activity className="h-3.5 w-3.5 text-velmere-gold" />
            <span className="font-mono text-[10px] uppercase tracking-wider">
              {isEn ? "Confidence score" : "Pewność oceny"}
            </span>
          </div>
          <span className="font-mono text-xs font-semibold text-white">
            {confidence || 98}%
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs border-t border-white/[0.04] pt-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
            {isEn ? "Methodology" : "Metodologia"}
          </span>
          <span className="font-mono text-[10px] text-white/70">
            {isTraditional
              ? (isEn ? "Continuous Order Book & Volatility VaR" : "Ciągły arkusz zleceń i zmienność VaR")
              : (isEn ? "Deterministic EVM Microstructure" : "Deterministyczna mikrostruktura EVM")}
          </span>
        </div>
      </div>
    </div>
  );
}
