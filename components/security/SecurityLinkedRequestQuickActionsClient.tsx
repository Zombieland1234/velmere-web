"use client";


import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, KeyRound, RefreshCw, Send, ShieldAlert, ShieldCheck, UploadCloud } from "lucide-react";
import type { AuditAccountMessageRecord, AuditOperatorActionType } from "@/lib/account/audit-account-messages";
import {
  PASS2376_FINAL_DELIVERY_GATE_ID,
  type Pass2376FinalDeliveryGateSnapshot,
} from "@/lib/security/final-delivery-gate-contract";
import {
  PASS2372_DRAWER_ACTION_LABEL,
  PASS2372_DRAWER_QUICK_ACTIONS,
  PASS2372_LINKED_REQUEST_DRAWER_ACTIONS_ID,
  buildPass2372DrawerActionReadiness,
} from "@/lib/security/linked-request-drawer-actions";

type ApiPayload = {
  ok?: boolean;
  message?: AuditAccountMessageRecord;
  error?: string;
  finalDeliveryGate?: Pass2376FinalDeliveryGateSnapshot;
  reportRouteSync?: {
    publicReportRoute?: string;
    pdfRoute?: string;
  };
};

function safeRoute(route: string | undefined, fallback: string) {
  return route?.trim() || fallback;
}

function tone(status: string | undefined) {
  if (!status) return "border-white/[0.10] bg-white/[0.025] text-white/[0.46]";
  if (["customer_safe_ready", "delivered", "ready", "ready_for_download"].includes(status)) return "border-emerald-300/[0.18] bg-emerald-300/[0.045] text-emerald-100";
  if (["needs_evidence", "blocked_redaction", "blocked"].includes(status)) return "border-amber-300/[0.18] bg-amber-300/[0.045] text-amber-100";
  if (["analysis_queue", "automated_analysis", "human_review", "pdf_attached", "human_review_queue"].includes(status)) return "border-cyan-200/[0.16] bg-cyan-300/[0.045] text-cyan-100";
  return "border-white/[0.10] bg-white/[0.025] text-white/[0.56]";
}

function iconFor(action: AuditOperatorActionType) {
  if (action === "attach_pdf") return <FileText className="h-3.5 w-3.5" />;
  if (action === "deliver_customer_safe_report") return <Send className="h-3.5 w-3.5" />;
  if (action === "mark_ready") return <ShieldCheck className="h-3.5 w-3.5" />;
  if (action === "block_redaction") return <ShieldAlert className="h-3.5 w-3.5" />;
  return <UploadCloud className="h-3.5 w-3.5" />;
}

export default function SecurityLinkedRequestQuickActionsClient({
  locale,
  initialMessage,
  initialFinalDeliveryGate,
}: {
  locale: "pl" | "en" | "de";
  initialMessage?: AuditAccountMessageRecord;
  initialFinalDeliveryGate?: Pass2376FinalDeliveryGateSnapshot;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage);
  const [token, setToken] = useState("");
  const [operatorNote, setOperatorNote] = useState("Drawer action: customer-safe state update only. No raw payment payloads, exploit steps or safety guarantees.");
  const [busy, setBusy] = useState<AuditOperatorActionType | "refresh" | null>(null);
  const [finalDeliveryGate, setFinalDeliveryGate] = useState(initialFinalDeliveryGate);
  const [result, setResult] = useState("");

  const readiness = useMemo(() => buildPass2372DrawerActionReadiness(message), [message]);
  const deliveryBlocked = Boolean(finalDeliveryGate && !finalDeliveryGate.canDeliver);
  const safeId = encodeURIComponent(message?.id || message?.requestId || "linked-request");
  const hasImmutableSnapshot = Boolean(message?.canonicalCustomerSnapshot);
  const canonicalPdfRoute = hasImmutableSnapshot ? `/api/security/audit-watch/customer-safe-report?id=${safeId}&locale=${locale}&format=pdf-safe` : "";
  const canonicalPublicReportRoute = hasImmutableSnapshot ? `/${locale}/security/audits/customer-report/${safeId}` : "";
  const fallbackExport = safeRoute(message?.exportRoute, canonicalPdfRoute);
  const fallbackPublicReport = canonicalPublicReportRoute;

  function stageToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(token.trim() ? "Drawer token staged for direct actions." : "Token empty; admin gate will block if required.");
  }

  async function runAction(action: AuditOperatorActionType) {
    if (!message) {
      setResult("No linked account message loaded for drawer action.");
      return;
    }
    setBusy(action);
    setResult("");
    try {
      const response = await fetch("/api/admin/security/audit-messages/operator-actions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token.trim() ? { "x-velmere-security-admin-token": token.trim() } : {}),
        },
        body: JSON.stringify({
          messageId: message.id,
          requestId: message.requestId,
          action,
          locale,
          operatorNote,
          pdfRoute: safeRoute(message.pdfRoute || message.customerSafeReport?.pdfRoute, fallbackExport),
          exportRoute: fallbackExport,
          publicReportRoute: safeRoute(message.publicReportRoute || message.customerSafeReport?.publicReportRoute, fallbackPublicReport),
          finalDeliveryGateId: PASS2376_FINAL_DELIVERY_GATE_ID,
          routeHealthEndpointPingRequired: action === "deliver_customer_safe_report",
        }),
      });
      const payload = await readJsonResponseBounded<ApiPayload>(response, 2 * 1024 * 1024).catch((): ApiPayload => ({}));
      if (!response.ok || !payload.ok || !payload.message) {
        if (payload.finalDeliveryGate) setFinalDeliveryGate(payload.finalDeliveryGate);
        setResult(payload.error ? `Drawer action blocked: ${payload.error}` : "Drawer action blocked by admin gate.");
        return;
      }
      setMessage(payload.message);
      if (payload.finalDeliveryGate) setFinalDeliveryGate(payload.finalDeliveryGate);
      setResult(`${PASS2372_DRAWER_ACTION_LABEL[action]} saved. Drawer state refreshed; customer-safe routes can auto-sync.`);
      router.refresh();
    } catch {
      setResult("Drawer action failed locally. Check admin token, same-origin guard and console logs.");
    } finally {
      setBusy(null);
    }
  }

  function refreshServer() {
    setBusy("refresh");
    setResult("Refreshing server-rendered drawer and account state…");
    router.refresh();
    window.setTimeout(() => setBusy(null), 650);
  }

  return (
    <div
      className="mt-4 rounded-[1.25rem] border border-velmere-gold/[0.16] bg-velmere-gold/[0.045] p-4"
      data-linked-request-drawer-actions={PASS2372_LINKED_REQUEST_DRAWER_ACTIONS_ID}
    >
      <div className="flex items-center gap-2 text-velmere-gold">
        <ShieldCheck className="h-4 w-4" />
        <p className="font-mono text-[9px] uppercase tracking-[0.16em]">direct drawer controls</p>
      </div>
      <p className="mt-2 text-xs leading-6 text-white/[0.54]">
        Run the focused request from this drawer: review, attach PDF, mark ready and deliver without scrolling to the lower operator list.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <p className={`rounded-2xl border p-3 font-mono text-[8px] uppercase tracking-[0.12em] ${tone(readiness.currentOperatorStatus)}`}>operator<br /><span className="text-[11px] tracking-normal">{readiness.currentOperatorStatus ?? "missing"}</span></p>
        <p className={`rounded-2xl border p-3 font-mono text-[8px] uppercase tracking-[0.12em] ${tone(readiness.currentDeliveryStatus)}`}>delivery<br /><span className="text-[11px] tracking-normal">{readiness.currentDeliveryStatus ?? "missing"}</span></p>
      </div>

      <p className="mt-3 rounded-2xl border border-cyan-200/[0.14] bg-cyan-300/[0.045] p-3 font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-100/[0.72]">
        recommended · {PASS2372_DRAWER_ACTION_LABEL[readiness.recommendedNextAction]}
      </p>

      {finalDeliveryGate ? (
        <div className={`mt-3 rounded-2xl border p-3 ${finalDeliveryGate.canDeliver ? "border-emerald-300/[0.18] bg-emerald-300/[0.045]" : "border-rose-300/[0.14] bg-rose-300/[0.035]"}`} data-final-delivery-gate={finalDeliveryGate.passId}>
          <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.48]">final delivery gate · {finalDeliveryGate.canDeliver ? "open" : "blocked"}</p>
          <p className="mt-2 text-[11px] leading-5 text-white/[0.52]">
            Deliver is enabled only after a fresh route-health endpoint ping and zero blocked/stale warnings.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <p className={`rounded-2xl border p-2 font-mono text-[8px] uppercase tracking-[0.12em] ${tone(finalDeliveryGate.endpointPingFresh ? "ready" : "blocked")}`}>endpoint<br /><span className="text-[11px] tracking-normal">{finalDeliveryGate.endpointPingFresh ? "fresh" : "required"}</span></p>
            <p className={`rounded-2xl border p-2 font-mono text-[8px] uppercase tracking-[0.12em] ${tone(finalDeliveryGate.zeroBlockedWarnings && finalDeliveryGate.zeroStaleWarnings ? "ready" : "blocked")}`}>warnings<br /><span className="text-[11px] tracking-normal">{finalDeliveryGate.blockedWarningCount + finalDeliveryGate.staleWarningCount}</span></p>
          </div>
          {finalDeliveryGate.reasons.slice(0, 2).map((reason) => (
            <p key={reason.key} className="mt-2 text-[10px] leading-5 text-white/[0.48]">• {reason.summary}</p>
          ))}
        </div>
      ) : null}

      <form onSubmit={stageToken} className="mt-3 grid gap-2">
        <div className="flex items-center gap-2 text-cyan-100/[0.75]">
          <KeyRound className="h-3.5 w-3.5" />
          <p className="font-mono text-[8px] uppercase tracking-[0.14em]">admin token for drawer</p>
        </div>
        <input
          value={token}
          onChange={(event: { target: { value: string } }) => setToken(event.target.value)}
          type="password"
          placeholder="x-velmere-security-admin-token"
          className="w-full rounded-2xl border border-white/[0.10] bg-black/[0.18] px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/[0.28] focus:border-cyan-200/[0.28]"
        />
        <textarea
          value={operatorNote}
          onChange={(event: { target: { value: string } }) => setOperatorNote(event.target.value)}
          className="min-h-20 w-full rounded-2xl border border-white/[0.10] bg-black/[0.18] px-3 py-2.5 text-xs leading-5 text-white outline-none placeholder:text-white/[0.28] focus:border-cyan-200/[0.28]"
          placeholder="Customer-safe operator note"
        />
        <button type="submit" className="rounded-full border border-white/[0.12] bg-white/[0.035] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/[0.58] transition hover:border-cyan-200/[0.24] hover:text-cyan-100">
          stage token
        </button>
      </form>

      <div className="mt-3 grid gap-2">
        {PASS2372_DRAWER_QUICK_ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            disabled={!readiness.enabled || busy === action || (action === "deliver_customer_safe_report" && deliveryBlocked)}
            onClick={() => void runAction(action)}
            className={`inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-45 ${action === readiness.recommendedNextAction ? "border-velmere-gold/[0.28] bg-velmere-gold/[0.08] text-velmere-gold" : "border-white/[0.10] bg-white/[0.035] text-white/[0.58] hover:border-velmere-gold/[0.20] hover:text-velmere-gold"}`}
          >
            {iconFor(action)}
            {busy === action ? "saving" : action === "deliver_customer_safe_report" && deliveryBlocked ? "deliver blocked" : PASS2372_DRAWER_ACTION_LABEL[action]}
          </button>
        ))}
        <button
          type="button"
          onClick={refreshServer}
          disabled={busy === "refresh"}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-200/[0.14] bg-cyan-300/[0.045] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100/[0.74] transition hover:border-cyan-200/[0.28] disabled:cursor-wait disabled:opacity-45"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {busy === "refresh" ? "refreshing" : "refresh drawer"}
        </button>
      </div>

      {result ? <p className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 text-xs leading-6 text-white/[0.55]">{result}</p> : null}

      <div className="mt-3 grid gap-2">
        {readiness.checkpoints.map((checkpoint) => (
          <p key={checkpoint} className="rounded-2xl border border-white/[0.08] bg-black/[0.14] p-3 text-[11px] leading-5 text-white/[0.46]">• {checkpoint}</p>
        ))}
      </div>
      <p className="mt-3 rounded-2xl border border-rose-300/[0.12] bg-rose-300/[0.035] p-3 text-[11px] leading-5 text-rose-100/[0.70]">
        {readiness.safeBoundary}
      </p>
    </div>
  );
}
