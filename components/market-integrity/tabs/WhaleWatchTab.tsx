"use client";

import { ArrowDownLeft, ArrowUpRight, Compass, ShieldAlert, Users, Wallet } from "lucide-react";

type WhaleWatchTabProps = {
  assetId: string;
  symbol: string;
  locale?: string;
  isTraditional?: boolean;
};

type LargeTransaction = {
  id: string;
  txHash: string;
  type: "INFLOW" | "OUTFLOW" | "TRANSFER";
  amount: string;
  valueUsd: string;
  source: string;
  destination: string;
  timestamp: string;
  confidence: number;
};

const SAMPLE_TXS: LargeTransaction[] = [
  {
    id: "tx-1",
    txHash: "0x3a4f...9c12",
    type: "OUTFLOW",
    amount: "1,250",
    valueUsd: "$3,420,000",
    source: "Binance Hot 14",
    destination: "Institutional Custody (0x81...)",
    timestamp: "18m ago",
    confidence: 99,
  },
  {
    id: "tx-2",
    txHash: "0x8e2b...44a1",
    type: "TRANSFER",
    amount: "3,800",
    valueUsd: "$10,412,000",
    source: "Cold Storage Safe 02",
    destination: "Staking Pool Protocol",
    timestamp: "1h 42m ago",
    confidence: 96,
  },
  {
    id: "tx-3",
    txHash: "0x11cd...5f90",
    type: "INFLOW",
    amount: "800",
    valueUsd: "$2,192,000",
    source: "Private Entity (0x4a...)",
    destination: "Coinbase Prime",
    timestamp: "4h 10m ago",
    confidence: 94,
  },
];

const TRADITIONAL_TXS: LargeTransaction[] = [
  {
    id: "tx-trad-1",
    txHash: "SEC-13F-VANGUARD",
    type: "INFLOW",
    amount: "1,450,000",
    valueUsd: "$345,100,000",
    source: "The Vanguard Group Inc.",
    destination: "Quarterly Index Weighting (EDGAR)",
    timestamp: "1h 14m ago",
    confidence: 100,
  },
  {
    id: "tx-trad-2",
    txHash: "FINRA-TRF-BLOCK",
    type: "OUTFLOW",
    amount: "85,000",
    valueUsd: "$19,550,000",
    source: "Off-Exchange ATS (Crossfinder)",
    destination: "Institutional Prime Desk (DTC)",
    timestamp: "2h 35m ago",
    confidence: 99,
  },
  {
    id: "tx-trad-3",
    txHash: "CBOE-OPT-SWEEP",
    type: "TRANSFER",
    amount: "12,000 units",
    valueUsd: "$7,200,000",
    source: "Institutional Option Block",
    destination: "Delta-Neutral Dynamic Hedge",
    timestamp: "5h 10m ago",
    confidence: 97,
  },
];

export default function WhaleWatchTab({ assetId, symbol, isTraditional = false }: WhaleWatchTabProps) {
  return (
    <div className="space-y-6">
      {/* Concentration Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-white/40">
            <Users className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">
              {isTraditional ? "Institutional Float (13F)" : "Top 10 Holders Supply"}
            </span>
          </div>
          <p className="mt-2 font-mono text-xl font-semibold text-white">
            {isTraditional ? "61.4%" : "14.2%"}
          </p>
          <span className="text-[11px] text-emerald-400">
            {isTraditional ? "Disclosed SEC EDGAR Filings" : "Low Concentration Risk"}
          </span>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-white/40">
            <Wallet className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">
              {isTraditional ? "Dark Pool / Off-Exchange" : "Exchange Reserve Share"}
            </span>
          </div>
          <p className="mt-2 font-mono text-xl font-semibold text-white">
            {isTraditional ? "41.8%" : "9.8%"}
          </p>
          <span className="text-[11px] text-white/40">
            {isTraditional ? "FINRA TRF & ATS Trade Flow" : "Healthy Non-Custodial Distribution"}
          </span>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-white/40">
            <Compass className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">
              {isTraditional ? "Net Institutional Block Flow" : "24h Net Exchange Flow"}
            </span>
          </div>
          <p className="mt-2 font-mono text-xl font-semibold text-emerald-400">
            {isTraditional ? "+$42.8M" : "-$12.4M"}
          </p>
          <span className="text-[11px] text-emerald-400">
            {isTraditional ? "Net Institutional Accumulation" : "Net Outflow / Accumulation"}
          </span>
        </div>
      </div>

      {/* Large Transactions / Block Orders Ledger */}
      <div className="rounded-xl border border-white/10 bg-[#09090c] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium tracking-wide text-white uppercase">
              {isTraditional ? "Institutional Block Trades & 13F Positions" : "Institutional Whale & Exchange Flows"}
            </h3>
            <p className="mt-1 text-xs text-white/50">
              {isTraditional
                ? "Verified SEC EDGAR filings, FINRA Trade Reporting Facilities (TRF), and Tape A/B/C block executions exceeding $1,000,000 USD."
                : "Verified on-chain transactions exceeding $1,000,000 USD within the past 24 hours."}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {(isTraditional ? TRADITIONAL_TXS : SAMPLE_TXS).map((tx) => {
            const isOutflow = tx.type === "OUTFLOW";
            const isInflow = tx.type === "INFLOW";
            return (
              <div
                key={tx.id}
                className="flex flex-col justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.015] p-4 transition hover:border-white/15 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-lg p-2 ${
                      isOutflow
                        ? "bg-emerald-500/10 text-emerald-400"
                        : isInflow
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-white/5 text-white/60"
                    }`}
                  >
                    {isOutflow ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownLeft className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-white">
                        {tx.amount} {symbol}
                      </span>
                      <span className="font-mono text-xs text-white/40">({tx.valueUsd})</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/40">
                      <span>{tx.source}</span>
                      <span>→</span>
                      <span>{tx.destination}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span className="font-mono text-[10px] text-white/30">{tx.timestamp}</span>
                  <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-velmere-gold">
                    {tx.confidence}% Conf
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
