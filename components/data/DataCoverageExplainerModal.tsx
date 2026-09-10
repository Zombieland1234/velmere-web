"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Database,
  ExternalLink,
  HelpCircle,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
  X,
} from "lucide-react";
import BodyPortal from "@/components/ui/BodyPortal";
import { useModalScrollLock } from "@/components/ui/useModalScrollLock";
import type {
  AssetCompletenessReport,
  FieldCompletenessDiagnosis,
  FieldCompletenessState,
} from "@/lib/data/completeness-root-cause-engine";

export interface DataCoverageExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: AssetCompletenessReport;
  locale?: "pl" | "en" | "de";
}

const STATE_BADGES: Record<
  FieldCompletenessState,
  { label: string; bg: string; text: string; border: string }
> = {
  VERIFIED_LIVE: {
    label: "LIVE VERIFIED",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  VERIFIED_SECONDARY: {
    label: "SECONDARY FAILOVER",
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/30",
  },
  VERIFIED_TERTIARY: {
    label: "TERTIARY ARCHIVE",
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/30",
  },
  INSUFFICIENT_QUORUM: {
    label: "QUORUM SHORTFALL",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  STALE_SNAPSHOT: {
    label: "STALE SNAPSHOT",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  UNSUPPORTED_BY_CONTRACT: {
    label: "NOT APPLICABLE",
    bg: "bg-white/5",
    text: "text-white/40",
    border: "border-white/10",
  },
  RATE_LIMIT_THROTTLED: {
    label: "RATE LIMITED (429)",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/30",
  },
  UPSTREAM_OUTAGE: {
    label: "UPSTREAM 5XX OUTAGE",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/30",
  },
  DATA_SANITY_REJECTED: {
    label: "SANITY REJECTED",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/30",
  },
  GENUINELY_UNAVAILABLE: {
    label: "EXHAUSTED / UNAVAILABLE",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/30",
  },
  SCHEMA_MIGRATION_PENDING: {
    label: "UPCOMING IN V3",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    border: "border-violet-500/30",
  },
  DETERMINISTIC_FIXTURE: {
    label: "REGRESSION FIXTURE",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
};

export default function DataCoverageExplainerModal({
  isOpen,
  onClose,
  report,
  locale = "en",
}: DataCoverageExplainerModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [selectedField, setSelectedField] = useState<FieldCompletenessDiagnosis | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredFields = report.fields.filter((f) =>
    categoryFilter === "ALL" ? true : f.category === categoryFilter
  );

  return (
    <BodyPortal>
      <div
        className="fixed inset-0 z-[1500] grid place-items-center bg-black/85 p-4 backdrop-blur-xl animate-in fade-in duration-200"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          ref={modalRef}
          className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#07090c]/98 text-white shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-velmere-gold">
                  TRANSPARENCY LEDGER
                </span>
                <span className="font-mono text-[10px] text-white/40">
                  {report.symbol} · {report.assetClass}
                </span>
              </div>
              <h3 className="mt-1 font-serif text-2xl font-light text-white">
                Data Completeness & Provider Fallback Furnace
              </h3>
              <p className="mt-1 text-xs text-white/60">
                Axiom: Never fabricate missing data. Every field status is backed by explicit provider query receipts.
              </p>
            </div>

            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-white/60 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Metrics Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-white/[0.015] border-b border-white/5 font-mono text-xs">
            <div className="p-3 rounded-xl border border-white/5 bg-black/40">
              <span className="text-[10px] text-white/40 block">COVERAGE RATIO</span>
              <span className="text-xl font-bold text-white mt-0.5 block">
                {report.verifiedFieldsCount}/{report.applicableFieldsCount}
                <span className="text-xs text-white/40 font-normal ml-1">
                  ({(report.completenessRatio * 100).toFixed(1)}%)
                </span>
              </span>
            </div>

            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <span className="text-[10px] text-emerald-400 block">LIVE VERIFIED</span>
              <span className="text-xl font-bold text-emerald-400 mt-0.5 block">
                {report.summary.liveCount}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-white/5 bg-black/40">
              <span className="text-[10px] text-white/40 block">EXCLUDED (NOT APPLICABLE)</span>
              <span className="text-xl font-bold text-white/60 mt-0.5 block">
                {report.summary.unsupportedCount}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5">
              <span className="text-[10px] text-rose-400 block">GENUINELY UNAVAILABLE</span>
              <span className="text-xl font-bold text-rose-400 mt-0.5 block">
                {report.summary.genuinelyUnavailableCount}
              </span>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 px-6 pt-4 border-b border-white/5">
            {["ALL", "market", "security", "liquidity", "governance"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`pb-3 font-mono text-xs uppercase tracking-wider transition border-b-2 px-2 ${
                  categoryFilter === cat
                    ? "border-velmere-gold text-velmere-gold font-semibold"
                    : "border-transparent text-white/40 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Fields Table / Master Detail View */}
          <div className="flex-1 overflow-y-auto p-6 space-y-2">
            {filteredFields.map((field) => {
              const badge = STATE_BADGES[field.state] || STATE_BADGES.GENUINELY_UNAVAILABLE;
              const isSelected = selectedField?.fieldKey === field.fieldKey;

              return (
                <div
                  key={field.fieldKey}
                  onClick={() => setSelectedField(isSelected ? null : field)}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    isSelected
                      ? "border-velmere-gold/60 bg-velmere-gold/5"
                      : "border-white/5 bg-white/[0.015] hover:border-white/15 hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-white">
                          {field.fieldLabel}
                        </span>
                        <span className="font-mono text-[9px] text-white/30">
                          ({field.fieldKey})
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/60">
                        {field.stateHumanExplanation}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${badge.bg} ${badge.text} ${badge.border}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Audit Log & Attempt Trace */}
                  {isSelected && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-3 font-mono text-xs animate-in fade-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-black/60 border border-white/5">
                          <span className="text-[10px] text-white/40 uppercase block mb-1">
                            Resolved Value
                          </span>
                          <span className="text-white font-semibold">
                            {field.resolvedValue !== null
                              ? JSON.stringify(field.resolvedValue)
                              : "NULL (GENUINELY_UNAVAILABLE)"}
                          </span>
                        </div>

                        <div className="p-3 rounded-lg bg-black/60 border border-white/5">
                          <span className="text-[10px] text-white/40 uppercase block mb-1">
                            Evaluated At
                          </span>
                          <span className="text-white/80">{field.evaluatedAt}</span>
                        </div>
                      </div>

                      {field.attempts.length > 0 && (
                        <div>
                          <span className="text-[10px] text-white/40 uppercase block mb-2">
                            Provider Failover Attempts Log
                          </span>
                          <div className="space-y-1.5">
                            {field.attempts.map((att, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between p-2 rounded bg-white/[0.02] border border-white/5 text-[11px]"
                              >
                                <span className="text-white/80">
                                  {i + 1}. {att.provider}
                                </span>
                                <span
                                  className={
                                    att.status === "SUCCESS"
                                      ? "text-emerald-400"
                                      : att.status === "RATE_LIMITED"
                                      ? "text-amber-400"
                                      : "text-rose-400"
                                  }
                                >
                                  {att.status} {att.errorMessage ? `— ${att.errorMessage}` : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/10 p-4 bg-black/40">
            <span className="font-mono text-[10px] text-white/40">
              ISO/IEC 25010 Data Quality Metrics
            </span>
            <button
              onClick={onClose}
              className="rounded-full border border-white/20 bg-white/5 px-5 py-2 font-mono text-xs uppercase tracking-wider text-white hover:bg-white/10 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
