"use client";


import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowRightCircle, CheckCircle2, FileText, KeyRound, LockKeyhole, Send, ShieldAlert, UploadCloud } from "lucide-react";
import type { AuditAccountMessageRecord, AuditOperatorActionType } from "@/lib/account/audit-account-messages";
import { buildPass2370FocusSummary, hasPass2370AuditFocus, pass2370FocusMatchesMessage, PASS2370_ADMIN_REPLAY_AUDIT_LINK_ID, type Pass2370AuditInboxFocus } from "@/lib/security/admin-replay-audit-link";

const ACTION_LABEL: Record<AuditOperatorActionType, string> = {
  mark_analysis: "Start automated analysis",
  // Legacy action is accepted only for older admin clients and normalized server-side.
  mark_human_review: "Legacy analysis action",
  request_evidence: "Need evidence",
  attach_pdf: "Attach PDF",
  mark_ready: "Mark ready",
  deliver_customer_safe_report: "Deliver safe report",
  block_redaction: "Block redaction",
};

type ApiPayload = {
  ok?: boolean;
  message?: AuditAccountMessageRecord;
  error?: string;
};

function safeRoute(route: string | undefined, fallback: string) {
  return route?.trim() || fallback;
}

function statusTone(status: string) {
  if (status === "delivered" || status === "customer_safe_ready") return "border-emerald-300/[0.18] bg-emerald-300/[0.045] text-emerald-100";
  if (status === "needs_evidence" || status === "blocked_redaction") return "border-amber-300/[0.18] bg-amber-300/[0.045] text-amber-100";
  if (["analysis_queue", "automated_analysis", "pdf_attached", "human_review"].includes(status)) return "border-cyan-200/[0.16] bg-cyan-300/[0.045] text-cyan-100";
  return "border-white/[0.10] bg-white/[0.025] text-white/[0.58]";
}

export default function SecurityAuditOperatorActionsClient({
  locale,
  initialMessages,
  focus,
}: {
  locale: string;
  initialMessages: AuditAccountMessageRecord[];
  focus?: Pass2370AuditInboxFocus;
}) {
  const safeLocale = locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
  const [messages, setMessages] = useState(initialMessages);
  const [token, setToken] = useState("");
  const [operatorNote, setOperatorNote] = useState("Customer-safe operator action. No exploit instructions, no Certified Safe claim.");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");
  const focusActive = hasPass2370AuditFocus(focus);
  const focusSummary = buildPass2370FocusSummary(focus);

  const stats = useMemo(() => {
    const ready = messages.filter((message) => message.operatorStatus === "customer_safe_ready" || message.operatorStatus === "delivered").length;
    const evidence = messages.filter((message) => message.operatorStatus === "needs_evidence" || message.operatorStatus === "blocked_redaction").length;
    const pdf = messages.filter((message) => Boolean(message.pdfRoute || message.customerSafeReport?.pdfRoute)).length;
    return { ready, evidence, pdf };
  }, [messages]);

  const orderedMessages = useMemo(() => {
    if (!focusActive) return messages;
    return [...messages].sort((left, right) => Number(pass2370FocusMatchesMessage(right, focus)) - Number(pass2370FocusMatchesMessage(left, focus)));
  }, [focus, focusActive, messages]);

  async function runAction(message: AuditAccountMessageRecord, action: AuditOperatorActionType) {
    setBusy(`${message.id}:${action}`);
    setResult("");
    const safeId = encodeURIComponent(message.id || message.requestId);
    const hasImmutableSnapshot = Boolean(message.canonicalCustomerSnapshot);
    const canonicalPdfRoute = hasImmutableSnapshot ? `/api/security/audit-watch/customer-safe-report?id=${safeId}&locale=${safeLocale}&format=pdf-safe` : "";
    const canonicalPublicReportRoute = hasImmutableSnapshot ? `/${safeLocale}/security/audits/customer-report/${safeId}` : "";
    const fallbackExport = safeRoute(message.exportRoute, canonicalPdfRoute);
    const fallbackPublicReport = canonicalPublicReportRoute;
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
          locale: safeLocale,
          operatorNote,
          pdfRoute: safeRoute(message.pdfRoute, fallbackExport),
          exportRoute: fallbackExport,
          publicReportRoute: safeRoute(message.publicReportRoute || message.customerSafeReport?.publicReportRoute, fallbackPublicReport),
        }),
      });
      const payload = await readJsonResponseBounded<ApiPayload>(response, 2 * 1024 * 1024).catch(() => ({} as ApiPayload));
      if (!response.ok || !payload.ok || !payload.message) {
        setResult(payload.error ? `Action blocked: ${payload.error}` : "Action blocked by admin gate.");
        return;
      }
      setMessages((current) => current.map((item) => (item.id === payload.message?.id ? payload.message : item)));
      setResult(`${ACTION_LABEL[action]} saved for ${payload.message.requestId}. Account card and customer-safe report route are ready to auto-sync.`);
    } catch {
      setResult("Action failed locally. Check admin token, API route and console logs.");
    } finally {
      setBusy(null);
    }
  }

  function saveToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(token.trim() ? "Operator token staged for this browser session." : "Token field is empty; API will stay locked if admin gate requires it.");
  }

  return (
    <section
      className="mt-8 rounded-[1.8rem] border border-velmere-gold/[0.16] bg-velmere-gold/[0.045] p-5"
      data-pass2361-audit-operator-actions="customer-safe-delivery-controls"
      data-pass2369-operator-mark-ready-report-route="customer-safe-route-and-account-auto-sync"
      data-admin-replay-audit-link={PASS2370_ADMIN_REPLAY_AUDIT_LINK_ID}
      data-linked-request-drawer="operator-actions-joined-in-drawer"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.18] bg-black/[0.18] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.17em] text-velmere-gold">
            <LockKeyhole className="h-4 w-4" /> Operator actions · route sync
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white">Mark ready, attach PDF, update status and deliver customer-safe reports.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/[0.58]">
            This internal panel supports automated-analysis state changes, internal quality control, evidence requests, customer-safe PDF attachment and delivery controls. No human review is included in any public SKU.
          </p>

          {focusActive ? (
            <div className="mt-5 rounded-2xl border border-cyan-200/[0.16] bg-cyan-300/[0.04] p-4" data-pass2370-operator-focus-banner="replay-to-audit-inbox">
              <p className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-100"><ArrowRightCircle className="h-3.5 w-3.5" /> Replay Board focus</p>
              <p className="mt-2 text-xs leading-6 text-white/[0.58]">{focusSummary ?? "A linked payment evidence row opened this inbox. Matching request is pinned first when present."}</p>
            </div>
          ) : null}
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">ready/delivered</p>
              <p className="mt-1 text-2xl text-white">{stats.ready}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">pdf attached</p>
              <p className="mt-1 text-2xl text-white">{stats.pdf}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">blocked/evidence</p>
              <p className="mt-1 text-2xl text-white">{stats.evidence}</p>
            </div>
          </div>
        </div>

        <form onSubmit={saveToken} className="rounded-[1.35rem] border border-white/[0.10] bg-black/[0.20] p-4">
          <div className="flex items-center gap-2 text-cyan-100">
            <KeyRound className="h-4 w-4" />
            <p className="font-mono text-[9px] uppercase tracking-[0.16em]">admin token</p>
          </div>
          <input
            value={token}
            onChange={(event: { target: { value: string } }) => setToken(event.target.value)}
            type="password"
            placeholder="x-velmere-security-admin-token"
            className="mt-3 w-full rounded-2xl border border-white/[0.10] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/[0.28] focus:border-cyan-200/[0.28]"
          />
          <textarea
            value={operatorNote}
            onChange={(event: { target: { value: string } }) => setOperatorNote(event.target.value)}
            className="mt-3 min-h-24 w-full rounded-2xl border border-white/[0.10] bg-white/[0.035] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/[0.28] focus:border-cyan-200/[0.28]"
            placeholder="Operator note"
          />
          <button type="submit" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-cyan-200/[0.18] bg-cyan-300/[0.06] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">
            <ShieldAlert className="h-4 w-4" /> stage token
          </button>
          {result ? <p className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 text-xs leading-6 text-white/[0.54]">{result}</p> : null}
        </form>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {orderedMessages.length ? orderedMessages.map((message) => {
          const actions: AuditOperatorActionType[] = ["mark_analysis", "request_evidence", "attach_pdf", "mark_ready", "deliver_customer_safe_report", "block_redaction"];
          const focused = pass2370FocusMatchesMessage(message, focus);
          return (
            <article
              id={focused ? "pass2370-linked-audit-message-card" : undefined}
              key={message.id}
              data-pass2370-focused-operator-message={focused ? message.id : undefined}
              className={`rounded-[1.35rem] border bg-black/[0.20] p-4 ${focused ? "border-cyan-200/[0.36] ring-1 ring-cyan-200/[0.18]" : "border-white/[0.10]"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="truncate font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-100/[0.72]">{message.requestId}</p>
                  <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white">{message.projectName || message.title}</h3>
                  <p className="mt-2 text-xs leading-6 text-white/[0.46]">{message.contactEmail ?? message.accountId}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {focused ? <span className="rounded-full border border-cyan-200/[0.24] bg-cyan-300/[0.055] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-100">linked evidence</span> : null}
                  <span className={`rounded-full border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] ${statusTone(message.operatorStatus)}`}>{message.operatorStatus}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-3">
                <p className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 text-[11px] leading-5 text-white/[0.50]">delivery: {message.deliveryStatus}</p>
                <p className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 text-[11px] leading-5 text-white/[0.50]">message: {message.status}</p>
                <p className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 text-[11px] leading-5 text-white/[0.50]">actions: {message.actionLog?.length ?? 0}</p>
              </div>

              {message.customerSafeReport ? (
                <div className="mt-4 rounded-2xl border border-emerald-300/[0.14] bg-emerald-300/[0.045] p-4">
                  <div className="flex items-center gap-2 text-emerald-100">
                    <CheckCircle2 className="h-4 w-4" />
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em]">customer-safe report · {message.customerSafeReport.status}</p>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-white/[0.58]">{message.customerSafeReport.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.customerSafeReport.pdfRoute ? <a href={message.customerSafeReport.pdfRoute} className="rounded-full border border-white/[0.12] bg-black/[0.18] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-white/[0.62]">safe PDF packet</a> : null}
                    {message.customerSafeReport.publicReportRoute ? <a href={message.customerSafeReport.publicReportRoute} className="rounded-full border border-white/[0.12] bg-black/[0.18] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-white/[0.62]">customer report</a> : null}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={busy === `${message.id}:${action}`}
                    onClick={() => void runAction(message, action)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.035] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/[0.58] transition hover:border-velmere-gold/[0.24] hover:text-velmere-gold disabled:cursor-wait disabled:opacity-45"
                  >
                    {action === "attach_pdf" ? <FileText className="h-3.5 w-3.5" /> : action === "deliver_customer_safe_report" ? <Send className="h-3.5 w-3.5" /> : <UploadCloud className="h-3.5 w-3.5" />}
                    {busy === `${message.id}:${action}` ? "saving" : ACTION_LABEL[action]}
                  </button>
                ))}
              </div>
            </article>
          );
        }) : (
          <p className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.48]">No account messages to operate on yet. Submit a Basic Audit first.</p>
        )}
      </div>
    </section>
  );
}
