"use client";

import { Calendar, Download, ExternalLink, GitCommit, History, ShieldAlert, ShieldCheck } from "lucide-react";
import { Link } from "@/navigation";

type HistoryTabProps = {
  assetId: string;
  symbol: string;
  locale?: string;
};

type AuditSnapshot = {
  id: string;
  version: string;
  date: string;
  score: number;
  validity: "CURRENT" | "SUPERSEDED";
  changes: string;
  reportRef: string;
};

const AUDIT_HISTORY: AuditSnapshot[] = [
  {
    id: "SNAP-2026-09",
    version: "v2.4.1",
    date: "2026-09-08 04:00 UTC",
    score: 18,
    validity: "CURRENT",
    changes: "Formal re-audit of liquidity reserve migration and upgraded oracle TWAP bounds. Verified zero reentrancy risk.",
    reportRef: "VLM-REP-2026-0908",
  },
  {
    id: "SNAP-2026-08",
    version: "v2.3.0",
    date: "2026-08-15 12:30 UTC",
    score: 22,
    validity: "SUPERSEDED",
    changes: "Prior snapshot before deployment of multi-sig timelock extension. Score improved by 4 points upon timelock activation.",
    reportRef: "VLM-REP-2026-0815",
  },
  {
    id: "SNAP-2026-06",
    version: "v2.0.0",
    date: "2026-06-01 09:15 UTC",
    score: 25,
    validity: "SUPERSEDED",
    changes: "Baseline continuous audit initialization. Full EVM AST decompilation and liquidity pool mapping.",
    reportRef: "VLM-REP-2026-0601",
  },
];

export default function HistoryTab({ assetId, symbol }: HistoryTabProps) {
  return (
    <div className="space-y-6">
      {/* Lineage Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-[#09090c] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-velmere-gold uppercase">
            AUDIT LINEAGE & TIMELINE
          </span>
          <h3 className="mt-1 text-xl font-light text-white">
            Historical Risk & Assessment Drift
          </h3>
          <p className="mt-1 text-xs text-white/50">
            Immutable snapshot log documenting chronological score changes, proxy upgrades, and vulnerability remediation.
          </p>
        </div>

        <Link
          href="/security/audits"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white hover:border-white/20 hover:bg-white/[0.06]"
        >
          <History className="h-4 w-4 text-velmere-gold" />
          <span>Full Audit Vault</span>
        </Link>
      </div>

      {/* Timeline items */}
      <div className="relative border-l border-white/10 pl-6 space-y-6 ml-3">
        {AUDIT_HISTORY.map((snap) => {
          const isCurrent = snap.validity === "CURRENT";
          return (
            <div key={snap.id} className="relative">
              {/* Timeline marker */}
              <div
                className={`absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 ${
                  isCurrent
                    ? "border-velmere-gold bg-velmere-gold"
                    : "border-white/30 bg-[#09090c]"
                }`}
              />

              <div className="rounded-xl border border-white/5 bg-white/[0.015] p-5 transition hover:border-white/15">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-white">
                      {snap.id} ({snap.version})
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${
                        isCurrent
                          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border border-white/10 bg-white/5 text-white/40"
                      }`}
                    >
                      {snap.validity}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-white/40">{snap.date}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-white/40">Score:</span>
                      <strong className="font-mono text-xs text-velmere-gold">{snap.score}/100</strong>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-white/60">{snap.changes}</p>

                <div className="mt-4 flex items-center justify-between text-[11px] text-white/40 pt-2">
                  <span className="font-mono">Ref: {snap.reportRef}</span>
                  <a
                    href={`/api/market-integrity/customer-export-download?assetId=${encodeURIComponent(assetId)}&tier=pro`}
                    className="inline-flex items-center gap-1.5 text-velmere-gold hover:text-white"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download Snapshot PDF</span>
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
