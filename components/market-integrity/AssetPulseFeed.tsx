"use client";

import { useMemo, useState } from "react";
import { Activity, Bell, ExternalLink, Flame, ShieldAlert, Sparkles, TrendingUp, Zap } from "lucide-react";

export type PulseEvent = {
  id: string;
  time: string;
  category: "INSTITUTIONAL" | "CONSENSUS" | "GOVERNANCE" | "VOLATILITY" | "EVIDENCE";
  title: string;
  source: string;
  impact: "positive" | "neutral" | "negative";
};

type AssetPulseFeedProps = {
  assetSymbol: string;
  assetName: string;
  isTraditional?: boolean;
};

export default function AssetPulseFeed({
  assetSymbol,
  assetName,
  isTraditional = false,
}: AssetPulseFeedProps) {
  const [filter, setFilter] = useState<string>("ALL");

  const pulseEvents: PulseEvent[] = useMemo(() => {
    if (isTraditional) {
      return [
        {
          id: "p1",
          time: "13:31",
          category: "INSTITUTIONAL",
          title: `${assetSymbol} Institutional Float: 13F filings confirm +1.2% net accumulation across top asset managers.`,
          source: "SEC EDGAR Form 13F",
          impact: "positive",
        },
        {
          id: "p2",
          time: "12:15",
          category: "EVIDENCE",
          title: "Dark Pool Liquidity: ATS block cross of 380,000 shares executed at midpoint NBBO without market impact.",
          source: "FINRA ATS Transparency",
          impact: "neutral",
        },
        {
          id: "p3",
          time: "10:45",
          category: "CONSENSUS",
          title: "Consolidated Tape Quorum: Tape A/B quote synchronization confirmed at 99.998% tick integrity.",
          source: "Consolidated Tape Association",
          impact: "positive",
        },
        {
          id: "p4",
          time: "09:30",
          category: "GOVERNANCE",
          title: `${assetName} Board of Directors confirms scheduled quarterly audit committee review.`,
          source: "Form 8-K Regulatory Filing",
          impact: "neutral",
        },
        {
          id: "p5",
          time: "08:15",
          category: "VOLATILITY",
          title: "Pre-market Volatility: Bid-ask spread tightened to 1.1 bps under opening auction cross.",
          source: "Exchange Direct Feed",
          impact: "positive",
        },
      ];
    }

    if (assetSymbol === "BTC" || assetSymbol === "BITCOIN") {
      return [
        {
          id: "b1",
          time: "13:31",
          category: "INSTITUTIONAL",
          title: "Spot Bitcoin ETFs record +$342M daily net inflow; BlackRock IBIT absorbs 4,120 BTC.",
          source: "Velmère Sentinel / Bloomberg",
          impact: "positive",
        },
        {
          id: "b2",
          time: "12:40",
          category: "VOLATILITY",
          title: "Bitcoin tests $78,800 baseline as perpetual funding rates normalize to +0.008%.",
          source: "Binance / Coinbase Quorum",
          impact: "neutral",
        },
        {
          id: "b3",
          time: "12:02",
          category: "EVIDENCE",
          title: "Long-Term Holder (LTH) supply ratio crosses 74.8%; zero dormant coins (>5y) moved.",
          source: "Glassnode / On-Chain Provenance",
          impact: "positive",
        },
        {
          id: "b4",
          time: "11:10",
          category: "CONSENSUS",
          title: "Mining Difficulty Epoch: Hashrate holds steady at 678 EH/s across 18,400+ reachable full nodes.",
          source: "Bitcoin Core UTXO Consensus",
          impact: "positive",
        },
        {
          id: "b5",
          time: "09:20",
          category: "GOVERNANCE",
          title: "BIP-324 Encrypted P2P transport adoption reaches 42% among mining pool relay endpoints.",
          source: "Protocol Telemetry Node",
          impact: "positive",
        },
      ];
    }

    // Default crypto (ETH, USDT, SOL, etc.)
    return [
      {
        id: "c1",
        time: "13:15",
        category: "EVIDENCE",
        title: `Bytecode Invariant Verified: ${assetSymbol} state consistency anchored in block header validation.`,
        source: "Velmère Sentinel Engine",
        impact: "positive",
      },
      {
        id: "c2",
        time: "11:45",
        category: "INSTITUTIONAL",
        title: `Order book liquidity depth exceeds $45M across verified multi-venue exchanges.`,
        source: "Aggregated Quorum Feed",
        impact: "positive",
      },
      {
        id: "c3",
        time: "09:30",
        category: "CONSENSUS",
        title: "Zero reentrancy anomalies or unverified proxy updates detected in 24-hour observation window.",
        source: "Cryptographic Audit Ledger",
        impact: "positive",
      },
      {
        id: "c4",
        time: "07:20",
        category: "GOVERNANCE",
        title: "Multi-signature signer quorum verified intact with hardware-enforced cold storage keys.",
        source: "Gnosis Safe Observer",
        impact: "neutral",
      },
    ];
  }, [assetSymbol, assetName, isTraditional]);

  const filteredEvents = filter === "ALL" ? pulseEvents : pulseEvents.filter((e) => e.category === filter);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#09090c] p-5 shadow-2xl space-y-4">
      {/* Top Header & Filter Chips */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-semibold tracking-wider text-white uppercase">
            Pulse Feed & Real-Time Intelligence
          </h3>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {["ALL", "INSTITUTIONAL", "CONSENSUS", "EVIDENCE", "VOLATILITY"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-mono tracking-wider transition ${
                filter === cat
                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold"
                  : "bg-white/[0.02] border border-white/5 text-white/50 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="space-y-2.5">
        {filteredEvents.map((evt) => (
          <div
            key={evt.id}
            className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.015] p-3 hover:bg-white/[0.03] transition"
          >
            <div className="flex flex-col items-center shrink-0 pt-0.5">
              <span className="font-mono text-[10px] font-bold text-white/40">{evt.time}</span>
              <span
                className={`mt-1 h-1.5 w-1.5 rounded-full ${
                  evt.impact === "positive"
                    ? "bg-emerald-400"
                    : evt.impact === "negative"
                    ? "bg-rose-400"
                    : "bg-sky-400"
                }`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded bg-white/5 border border-white/10 px-1.5 py-0.2 font-mono text-[9px] text-white/60 uppercase">
                  {evt.category}
                </span>
                <span className="text-[10px] font-mono text-white/30 truncate">
                  Source: {evt.source}
                </span>
              </div>
              <p className="text-xs text-white/80 leading-relaxed font-sans">{evt.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
