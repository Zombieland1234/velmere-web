"use client";

import React, { useState } from "react";
import {
  PRO_VS_ADVANCED_COMPARISONS,
  getAllSurfacesComparison,
  getComparisonStatistics,
  type SurfaceId,
  type CapabilityComparisonItem,
} from "@/lib/market-integrity/pro-vs-advanced-comparison";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  Search,
  Globe,
  TrendingUp,
} from "lucide-react";

const SURFACE_ICONS: Record<SurfaceId, React.ReactNode> = {
  browser: <Globe className="h-4 w-4" />,
  lens: <Search className="h-4 w-4" />,
  shield: <Shield className="h-4 w-4" />,
  shield_pro: <Sparkles className="h-4 w-4" />,
  smart_contracts: <Layers className="h-4 w-4" />,
  real_markets: <TrendingUp className="h-4 w-4" />,
};

export default function ProVsAdvancedComparisonView() {
  const [selectedSurface, setSelectedSurface] = useState<SurfaceId | "all">("all");
  const stats = getComparisonStatistics();
  const allSurfaces = getAllSurfacesComparison();

  const displayedSurfaces =
    selectedSurface === "all"
      ? allSurfaces
      : [PRO_VS_ADVANCED_COMPARISONS[selectedSurface]];

  return (
    <div className="w-full space-y-8" data-testid="pro-vs-advanced-matrix">
      {/* Header and Stats */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-md">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.25] bg-velmere-gold/[0.08] px-3 py-1 font-mono text-xs uppercase tracking-wider text-velmere-gold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Audit Directive #30 · Commercial Integrity
            </div>
            <h2 className="mt-3 font-serif text-3xl font-normal text-white">
              Basic vs Pro vs Advanced Verification Matrix
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Institutional capability comparison across all 6 product surfaces. Every claim is strictly backed by verifiable code and live evidence.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-black/40 px-4 py-2.5">
              <div className="font-mono text-[10px] uppercase text-white/40">Total Capabilities</div>
              <div className="font-mono text-xl font-semibold text-white">{stats.totalCapabilities}</div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5">
              <div className="font-mono text-[10px] uppercase text-emerald-400/80">Sellable & Verified</div>
              <div className="font-mono text-xl font-semibold text-emerald-400">
                {stats.sellableCount} ({stats.sellablePercentage}%)
              </div>
            </div>
          </div>
        </div>

        {/* Surface Filter Tabs */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          <button
            onClick={() => setSelectedSurface("all")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 font-mono text-xs transition-all ${
              selectedSurface === "all"
                ? "bg-velmere-gold/20 text-velmere-gold border border-velmere-gold/40 shadow-sm"
                : "text-white/60 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            All Surfaces ({allSurfaces.length})
          </button>
          {allSurfaces.map((s) => (
            <button
              key={s.surfaceId}
              onClick={() => setSelectedSurface(s.surfaceId)}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 font-mono text-xs transition-all ${
                selectedSurface === s.surfaceId
                  ? "bg-velmere-gold/20 text-velmere-gold border border-velmere-gold/40 shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              {SURFACE_ICONS[s.surfaceId]}
              {s.surfaceName} ({s.items.length})
            </button>
          ))}
        </div>
      </div>

      {/* Surface Matrices */}
      {displayedSurfaces.map((surface) => (
        <div
          key={surface.surfaceId}
          className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/60 shadow-xl"
        >
          {/* Surface Banner */}
          <div className="border-b border-white/[0.08] bg-white/[0.03] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/[0.05] text-velmere-gold">
                {SURFACE_ICONS[surface.surfaceId]}
              </div>
              <div>
                <h3 className="font-serif text-xl font-semibold text-white">
                  {surface.surfaceName}
                </h3>
                <p className="text-xs text-white/50">{surface.headline}</p>
              </div>
            </div>
            <a
              href={surface.surfaceRoute}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-velmere-gold hover:underline"
            >
              Inspect Route {surface.surfaceRoute}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-white/80">
              <thead className="border-b border-white/[0.08] bg-white/[0.015] font-mono text-[11px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="py-3 px-6 w-1/6">Capability</th>
                  <th className="py-3 px-4 w-1/6">Basic</th>
                  <th className="py-3 px-4 w-1/5">Pro</th>
                  <th className="py-3 px-4 w-1/4">Advanced</th>
                  <th className="py-3 px-4 w-1/6">Real Evidence</th>
                  <th className="py-3 px-4 text-center w-24">Sellable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] font-sans">
                {surface.items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-4 px-6 align-top">
                      <div className="font-medium text-white">{item.capability}</div>
                    </td>
                    <td className="py-4 px-4 align-top text-xs text-white/60">
                      {item.basic}
                    </td>
                    <td className="py-4 px-4 align-top text-xs text-amber-200/80">
                      {item.pro}
                    </td>
                    <td className="py-4 px-4 align-top text-xs text-cyan-200/90 font-medium">
                      {item.advanced}
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="rounded-lg border border-white/[0.06] bg-black/40 p-2 text-[11px] font-mono text-white/70">
                        {item.realEvidence}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider ${
                          item.sellable === "YES"
                            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {item.sellable === "YES" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertCircle className="h-3 w-3" />
                        )}
                        {item.sellable}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
