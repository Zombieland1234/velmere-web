"use client";

import { AlertTriangle, CheckCircle2, Clock, Info, ShieldAlert, ShieldCheck } from "lucide-react";
import { type AssessmentValidityState, type InvalidationReason } from "@/lib/security/audit-validity-engine";

type AuditValidityBadgeProps = {
  validity: AssessmentValidityState;
  reason?: InvalidationReason;
  reasonDetails?: string;
  className?: string;
  showDetails?: boolean;
};

export default function AuditValidityBadge({
  validity,
  reason,
  reasonDetails,
  className = "",
  showDetails = false,
}: AuditValidityBadgeProps) {
  const isCurrent = validity === "CURRENT";

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase transition ${
          isCurrent
            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
            : "border border-amber-500/30 bg-amber-500/10 text-amber-300"
        }`}
      >
        {isCurrent ? (
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-amber-300" />
        )}
        <span>{validity}</span>
      </span>

      {showDetails && !isCurrent && reasonDetails && (
        <span
          className="text-[11px] text-white/50 max-w-xs truncate"
          title={reasonDetails}
        >
          {reasonDetails}
        </span>
      )}
    </div>
  );
}
