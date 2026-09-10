"use client";

import { Activity, ArrowDownRight, ArrowUpRight, CheckCircle2, ShieldCheck, Zap } from "lucide-react";

type OverviewTabProps = {
  asset: {
    id: string;
    symbol: string;
    name: string;
    price: number;
    priceChange24h?: number;
    priceChange7d?: number;
    marketCap?: number;
    volume24h?: number;
    high24h?: number;
    low24h?: number;
    riskScore: number;
    confidence: number;
    freshness: string;
    verifiedSourcesCount: number;
    assetClass?: string;
  };
  locale?: string;
  isTraditional?: boolean;
};

export default function OverviewTab({ asset, locale = "en", isTraditional = false }: OverviewTabProps) {
  const isPositive24h = (asset.priceChange24h ?? 0) >= 0;
  const isPositive7d = (asset.priceChange7d ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <span className="text-[11px] font-medium tracking-wider text-white/40 uppercase">
            Market Cap
          </span>
          <p className="mt-1 font-mono text-lg font-semibold text-white">
            {asset.marketCap
              ? `$${asset.marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <span className="text-[11px] font-medium tracking-wider text-white/40 uppercase">
            24h Volume
          </span>
          <p className="mt-1 font-mono text-lg font-semibold text-white">
            {asset.volume24h
              ? `$${asset.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <span className="text-[11px] font-medium tracking-wider text-white/40 uppercase">
            24h Range
          </span>
          <p className="mt-1 font-mono text-sm font-semibold text-white">
            {asset.low24h && asset.high24h
              ? `$${asset.low24h.toFixed(2)} - $${asset.high24h.toFixed(2)}`
              : "Live Depth"}
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <span className="text-[11px] font-medium tracking-wider text-white/40 uppercase">
            7d Change
          </span>
          <p
            className={`mt-1 flex items-center gap-1 font-mono text-lg font-semibold ${
              isPositive7d ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {isPositive7d ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            <span>
              {asset.priceChange7d !== undefined
                ? `${asset.priceChange7d > 0 ? "+" : ""}${asset.priceChange7d.toFixed(2)}%`
                : "—"}
            </span>
          </p>
        </div>
      </div>

      {/* Assurance Summary Box */}
      <div className="rounded-xl border border-white/10 bg-[#09090c] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-velmere-gold" />
            <h3 className="text-sm font-medium tracking-wide text-white uppercase">
              Assurance & Verification Summary
            </h3>
          </div>
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs text-emerald-400">
            EVIDENCE LINKED
          </span>
        </div>

        <p className="text-sm leading-relaxed text-white/60">
          Continuous observation for{" "}
          <strong className="text-white">{asset.name} ({asset.symbol})</strong> is active.
          {isTraditional
            ? " Risk vectors are synthesized across SEC statutory disclosures, FINRA dark pool telemetry, and exchange consolidated tape consensus."
            : " Risk vectors are synthesized across bytecode formal analysis, order book topology, and multi-venue consensus."}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/5 bg-white/[0.015] p-3 text-xs">
            <span className="text-white/40">Calibrated Risk</span>
            <p className="mt-1 font-mono text-base font-bold text-velmere-gold">
              {asset.riskScore}/100
            </p>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.015] p-3 text-xs">
            <span className="text-white/40">Measurement Confidence</span>
            <p className="mt-1 font-mono text-base font-bold text-white">
              {asset.confidence}%
            </p>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.015] p-3 text-xs">
            <span className="text-white/40">Verified Sources</span>
            <p className="mt-1 font-mono text-base font-bold text-white">
              {asset.verifiedSourcesCount} {isTraditional ? "Tape & EDGAR Quorum" : "Multi-Chain Quorum"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
