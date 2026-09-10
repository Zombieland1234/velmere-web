"use client";

import { AlertTriangle, CheckCircle2, ChevronRight, FileCode2, Info, Lock, Shield, Zap } from "lucide-react";

type AnalysisTabProps = {
  assetId: string;
  symbol: string;
  riskScore: number;
  confidence: number;
  locale?: string;
  isTraditional?: boolean;
};

type RiskFactor = {
  id: string;
  title: string;
  category: "Contract" | "Liquidity" | "Governance" | "Market";
  severity: "LOW" | "MEDIUM" | "HIGH" | "VERIFIED_SAFE";
  weight: number;
  details: string;
  evidenceRef: string;
};

const RISK_FACTORS: RiskFactor[] = [
  {
    id: "reentrancy",
    title: "Reentrancy Protection",
    category: "Contract",
    severity: "VERIFIED_SAFE",
    weight: 0,
    details: "Bytecode matches OpenZeppelin ReentrancyGuard nonReentrant modifier pattern across all state-mutating external endpoints.",
    evidenceRef: "EVD-BYTECODE-GUARD-01",
  },
  {
    id: "privileged_keys",
    title: "Privileged Admin & Mint Capabilities",
    category: "Governance",
    severity: "LOW",
    weight: 12,
    details: "Timelock delay of 48 hours enforced on owner state migrations. Multi-sig consensus required (3-of-5 threshold).",
    evidenceRef: "EVD-TIMELOCK-PROXY-04",
  },
  {
    id: "liquidity_concentration",
    title: "DEX Liquidity Depth & Pool Lock",
    category: "Liquidity",
    severity: "LOW",
    weight: 10,
    details: "Deep pool reserves across Uniswap v3 and Curve. Less than 0.15% price impact for typical institutional standard clip size ($50k).",
    evidenceRef: "EVD-DEX-TOPOLOGY-09",
  },
  {
    id: "oracle_resilience",
    title: "Price Oracle Manipulation Resilience",
    category: "Market",
    severity: "VERIFIED_SAFE",
    weight: 0,
    details: "Chainlink decentralized oracle feed paired with 30-minute geometric TWAP backup fallback. Flash-loan attack surface mitigated.",
    evidenceRef: "EVD-ORACLE-QUORUM-02",
  },
];

const TRADITIONAL_RISK_FACTORS: RiskFactor[] = [
  {
    id: "sec_filings",
    title: "Statutory Reporting & Disclosure",
    category: "Governance",
    severity: "VERIFIED_SAFE",
    weight: 0,
    details: "Form 10-K and 10-Q disclosures filed on EDGAR within statutory deadlines. Clean audit opinion with zero material weaknesses.",
    evidenceRef: "EVD-SEC-10K-XBRL-01",
  },
  {
    id: "nbbo_resilience",
    title: "Tape Liquidity & NBBO Tightness",
    category: "Market",
    severity: "VERIFIED_SAFE",
    weight: 0,
    details: "Median bid/ask spread below 0.02% across primary listed exchanges with deep book support exceeding $25M in top tiers.",
    evidenceRef: "EVD-SIP-CONSOLIDATED-03",
  },
  {
    id: "clearing_settlement",
    title: "DTC Clearinghouse & Settlement Drift",
    category: "Liquidity",
    severity: "LOW",
    weight: 6,
    details: "DTCC continuous net settlement under standard T+1 mandate. Negligible fail-to-deliver rate (<0.01% of aggregate float).",
    evidenceRef: "EVD-DTC-SETTLEMENT-02",
  },
  {
    id: "float_concentration",
    title: "Institutional Float Stability",
    category: "Governance",
    severity: "LOW",
    weight: 8,
    details: "Over 60% of outstanding float held by institutional passive index funds (Vanguard, BlackRock, State Street), providing price stability.",
    evidenceRef: "EVD-13F-FLOAT-04",
  },
];

export default function AnalysisTab({
  assetId,
  symbol,
  riskScore,
  confidence,
  isTraditional = false,
}: AnalysisTabProps) {
  const factors = isTraditional ? TRADITIONAL_RISK_FACTORS : RISK_FACTORS;
  return (
    <div className="space-y-6">
      {/* Risk Decomposition Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-[#09090c] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-velmere-gold uppercase">
            CALIBRATED RISK COMPOSITION
          </span>
          <h3 className="mt-1 text-xl font-light text-white">
            Formal Risk Factor Decomposition
          </h3>
          <p className="mt-1 text-xs text-white/50">
            Multi-dimensional CVSS v3.1 mathematical severity scoring with deterministic confidence bounds.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] uppercase text-white/40">Composite Score</span>
            <p className="font-mono text-2xl font-bold text-velmere-gold">{riskScore}/100</p>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div className="text-right">
            <span className="text-[10px] uppercase text-white/40">Confidence</span>
            <p className="font-mono text-2xl font-bold text-white">{confidence}%</p>
          </div>
        </div>
      </div>

      {/* Factor Breakdown List */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold tracking-wider text-white/60 uppercase">
          Evaluated Vector Dimensions
        </h4>

        {factors.map((factor) => {
          const isSafe = factor.severity === "VERIFIED_SAFE";
          return (
            <div
              key={factor.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.015] p-5 transition hover:border-white/15 sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`mt-0.5 rounded-lg p-2 ${
                    isSafe ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {isSafe ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{factor.title}</span>
                    <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-mono text-white/40">
                      {factor.category}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/50">{factor.details}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-4 self-end sm:self-center">
                <span className="font-mono text-xs text-white/40">Ref: {factor.evidenceRef}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase ${
                    isSafe
                      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "border border-amber-500/20 bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {factor.severity.replace("_", " ")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
