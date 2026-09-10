"use client";

import { ArrowRight, CheckCircle2, ChevronRight, FileCode, GitCompare, Minus, Plus, ShieldCheck, X } from "lucide-react";
import AuditValidityBadge from "@/components/security/AuditValidityBadge";

export type AuditSnapshotDiffItem = {
  category: string;
  findingTitle: string;
  statusBefore: string;
  statusAfter: string;
  resolutionType: "REMEDIATED" | "IMPROVED" | "NEW_RISK" | "UNCHANGED";
  details: string;
};

export type AuditSnapshotSummary = {
  id: string;
  version: string;
  date: string;
  score: number;
  validity: "CURRENT" | "OUTDATED";
  bytecodeHash: string;
};

type AuditDifferentialViewProps = {
  priorSnapshot: AuditSnapshotSummary;
  currentSnapshot: AuditSnapshotSummary;
  diffItems: AuditSnapshotDiffItem[];
  onClose?: () => void;
};

export default function AuditDifferentialView({
  priorSnapshot,
  currentSnapshot,
  diffItems,
  onClose,
}: AuditDifferentialViewProps) {
  const scoreDelta = currentSnapshot.score - priorSnapshot.score;
  const isScoreImproved = scoreDelta <= 0; // In risk score, lower score = lower risk (safer)

  return (
    <div className="rounded-2xl border border-white/10 bg-[#09090c] p-6 lg:p-8 shadow-2xl relative">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-velmere-gold/10 p-2 text-velmere-gold">
          <GitCompare className="h-5 w-5" />
        </div>
        <div>
          <span className="text-[10px] font-mono tracking-widest text-velmere-gold uppercase">
            DIFFERENTIAL LINEAGE ENGINE
          </span>
          <h3 className="text-xl font-light text-white">
            What Changed? Snapshot Reconciliation
          </h3>
        </div>
      </div>

      {/* Comparison Cards Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Prior Snapshot */}
        <div className="rounded-xl border border-white/5 bg-white/[0.015] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-white/40 uppercase">Baseline Snapshot</span>
            <AuditValidityBadge validity={priorSnapshot.validity} />
          </div>
          <p className="mt-2 font-mono text-lg font-semibold text-white">
            {priorSnapshot.id} ({priorSnapshot.version})
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-white/50">
            <span>Date: {priorSnapshot.date}</span>
            <span className="font-mono text-white/70">Score: {priorSnapshot.score}/100</span>
          </div>
          <div className="mt-3 font-mono text-[10px] text-white/30 truncate">
            Hash: {priorSnapshot.bytecodeHash}
          </div>
        </div>

        {/* Current Snapshot */}
        <div className="rounded-xl border border-velmere-gold/20 bg-velmere-gold/[0.02] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-velmere-gold uppercase">Evaluated Snapshot</span>
            <AuditValidityBadge validity={currentSnapshot.validity} />
          </div>
          <p className="mt-2 font-mono text-lg font-semibold text-white">
            {currentSnapshot.id} ({currentSnapshot.version})
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-white/50">
            <span>Date: {currentSnapshot.date}</span>
            <span className="font-mono text-velmere-gold font-bold">Score: {currentSnapshot.score}/100</span>
          </div>
          <div className="mt-3 font-mono text-[10px] text-white/30 truncate">
            Hash: {currentSnapshot.bytecodeHash}
          </div>
        </div>
      </div>

      {/* Score Delta Indicator */}
      <div className="mt-4 flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
        <span className="text-xs text-white/60">Calculated Risk Delta</span>
        <div className="flex items-center gap-2 font-mono text-sm font-bold">
          <span className={isScoreImproved ? "text-emerald-400" : "text-rose-400"}>
            {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta} pts
          </span>
          <span className="text-xs font-normal text-white/40">
            ({isScoreImproved ? "Risk Reduced / Security Improved" : "Risk Elevated"})
          </span>
        </div>
      </div>

      {/* Diff Table / List */}
      <div className="mt-6 space-y-3">
        <h4 className="text-xs font-semibold tracking-wider text-white/60 uppercase">
          Finding-By-Finding Resolutions
        </h4>

        {diffItems.map((item, idx) => {
          const isRemediated = item.resolutionType === "REMEDIATED";
          return (
            <div
              key={idx}
              className="rounded-xl border border-white/5 bg-white/[0.01] p-4 transition hover:border-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded p-1 ${
                      isRemediated ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-white/50"
                    }`}
                  >
                    {isRemediated ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  </span>
                  <span className="text-xs font-medium text-white">{item.findingTitle}</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-white/40">
                    {item.category}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-rose-400/80 line-through">{item.statusBefore}</span>
                  <ArrowRight className="h-3 w-3 text-white/30" />
                  <span className="text-emerald-400 font-semibold">{item.statusAfter}</span>
                </div>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-white/50">{item.details}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
