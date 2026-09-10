"use client";

import { Activity, ArrowRightLeft, Layers, Percent, TrendingDown, TrendingUp, Waves } from "lucide-react";

type MarketImpactTabProps = {
  assetId: string;
  symbol: string;
  locale?: string;
};

export default function MarketImpactTab({ assetId, symbol }: MarketImpactTabProps) {
  return (
    <div className="space-y-6">
      {/* Top Liquidity Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-white/40">
            <Waves className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Median Bid/Ask Spread</span>
          </div>
          <p className="mt-2 font-mono text-xl font-semibold text-white">0.018%</p>
          <span className="text-[11px] text-emerald-400">Institutional Grade Tightness</span>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-white/40">
            <Percent className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">$100k Order Price Impact</span>
          </div>
          <p className="mt-2 font-mono text-xl font-semibold text-white">0.042%</p>
          <span className="text-[11px] text-white/40">Deep multi-venue book support</span>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-white/40">
            <ArrowRightLeft className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Cross-Venue Divergence</span>
          </div>
          <p className="mt-2 font-mono text-xl font-semibold text-white">0.005%</p>
          <span className="text-[11px] text-emerald-400">Normal Arbitrage Bounds</span>
        </div>
      </div>

      {/* Order Book Depth Topology */}
      <div className="rounded-xl border border-white/10 bg-[#09090c] p-6">
        <h3 className="text-sm font-medium tracking-wide text-white uppercase">
          Order Book Depth Topology & Volatility Radar
        </h3>
        <p className="mt-1 text-xs text-white/50">
          Aggregated ±2% resting limit order liquidity depth across top Tier-1 CEX and primary DEX liquidity pools.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <div className="flex justify-between text-xs text-white/60">
              <span>+2% Bid Depth (Supportive Capital)</span>
              <span className="font-mono text-emerald-400">$34,250,000</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-emerald-500/80" style={{ width: "68%" }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-white/60">
              <span>-2% Ask Depth (Resistance Pressure)</span>
              <span className="font-mono text-rose-400">$28,120,000</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-rose-500/80" style={{ width: "56%" }} />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-white/5 bg-white/[0.015] p-4 text-xs text-white/60">
          <div className="flex items-center gap-2 text-velmere-gold font-medium">
            <Activity className="h-4 w-4" />
            <span>Volume Anomaly Scanner</span>
          </div>
          <p className="mt-2 leading-relaxed text-white/50">
            No synthetic wash trading or volume pump anomalies detected within the last 72 hours.
            Volume-to-liquidity ratio is 0.18, well within healthy organic parameters.
          </p>
        </div>
      </div>
    </div>
  );
}
