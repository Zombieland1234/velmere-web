import { Activity, ArrowRightCircle, CheckCircle2, ClipboardCheck, FileText, LifeBuoy, Link2, LockKeyhole, ReceiptText, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Pass2371LinkedRequestDrawerSnapshot } from "@/lib/security/linked-request-drawer";
import { PASS2371_LINKED_REQUEST_DRAWER_ID } from "@/lib/security/linked-request-drawer";
import SecurityLinkedRequestQuickActionsClient from "@/components/security/SecurityLinkedRequestQuickActionsClient";
import { PASS2372_LINKED_REQUEST_DRAWER_ACTIONS_ID } from "@/lib/security/linked-request-drawer-actions";
import { buildPass2373PaymentEvidenceDetail, PASS2373_PAYMENT_EVIDENCE_DETAIL_ID } from "@/lib/security/payment-evidence-redacted-details";
import { PASS2374_CUSTOMER_SAFE_ROUTE_HEALTH_ID } from "@/lib/security/customer-route-health";
import { PASS2375_ROUTE_HEALTH_LEDGER_ID } from "@/lib/security/route-health-ledger";
import { PASS2376_FINAL_DELIVERY_GATE_ID } from "@/lib/security/final-delivery-gate-contract";
import { PASS2377_DELIVERY_RECEIPT_LEDGER_ID } from "@/lib/security/delivery-receipt-ledger";
import { PASS2378_DELIVERY_RECEIPT_PACKET_ID } from "@/lib/security/delivery-receipt-packet";
import { PASS2379_RECEIPT_ROUTE_HEALTH_ID } from "@/lib/security/receipt-route-health";
import { PASS2380_CUSTOMER_SUPPORT_HANDOFF_PACKET_ID } from "@/lib/security/customer-support-handoff-packet";
import { PASS2381_SUPPORT_HANDOFF_EVENT_LEDGER_ID } from "@/lib/security/support-handoff-event-ledger";

function truncate(value: string | undefined, max = 76) {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function tone(status: string | undefined) {
  if (!status) return "border-white/[0.10] bg-white/[0.025] text-white/[0.46]";
  if (["pass", "ready", "fresh", "linked", "ready_for_download", "customer_safe_ready", "delivered"].includes(status)) return "border-emerald-300/[0.18] bg-emerald-300/[0.045] text-emerald-100";
  if (["blocked", "blocked_redaction", "fail"].includes(status)) return "border-rose-300/[0.18] bg-rose-300/[0.045] text-rose-100";
  if (["analysis_queue", "automated_analysis", "manual", "manual_review", "human_review", "human_review_queue", "pdf_attached"].includes(status)) return "border-cyan-200/[0.16] bg-cyan-300/[0.045] text-cyan-100";
  return "border-amber-300/[0.16] bg-amber-300/[0.045] text-amber-100";
}

function deliveryReceiptRoute(locale: string, receiptId: string | undefined) {
  return `/${locale}/security/audits/delivery-receipt/${encodeURIComponent(receiptId || "missing")}`;
}

function deliveryReceiptDownloadRoute(locale: string, receiptId: string | undefined) {
  return `/api/security/audit-watch/delivery-receipt?receiptId=${encodeURIComponent(receiptId || "missing")}&locale=${locale}&format=download`;
}

function supportHandoffRoute(locale: string, receiptId: string | undefined) {
  return `/${locale}/security/audits/support-handoff/${encodeURIComponent(receiptId || "missing")}`;
}

function supportHandoffDownloadRoute(locale: string, receiptId: string | undefined) {
  return `/api/security/audit-watch/support-handoff?receiptId=${encodeURIComponent(receiptId || "missing")}&locale=${locale}&format=download`;
}

export default function SecurityLinkedRequestDrawer({ snapshot }: { snapshot: Pass2371LinkedRequestDrawerSnapshot }) {
  if (!snapshot.active) return null;
  const message = snapshot.message;
  const customerReport = snapshot.routes.customerReport;
  const pdfRoute = snapshot.routes.safePdfPacket;

  return (
    <section
      id="linked-request-drawer"
      className="mt-8 overflow-hidden rounded-[1.8rem] border border-velmere-gold/[0.18] bg-[radial-gradient(circle_at_top_left,rgba(220,188,122,0.10),transparent_34%),rgba(255,255,255,0.025)] shadow-velmere-card"
      data-linked-request-drawer={PASS2371_LINKED_REQUEST_DRAWER_ID}
      data-linked-request-drawer-actions={PASS2372_LINKED_REQUEST_DRAWER_ACTIONS_ID}
      data-pass2373-payment-evidence-detail={PASS2373_PAYMENT_EVIDENCE_DETAIL_ID}
      data-pass2374-customer-safe-route-health={PASS2374_CUSTOMER_SAFE_ROUTE_HEALTH_ID}
      data-route-health-ledger={PASS2375_ROUTE_HEALTH_LEDGER_ID}
      data-final-delivery-gate={PASS2376_FINAL_DELIVERY_GATE_ID}
      data-delivery-receipt-ledger={PASS2377_DELIVERY_RECEIPT_LEDGER_ID}
      data-delivery-receipt-packet={PASS2378_DELIVERY_RECEIPT_PACKET_ID}
      data-receipt-route-health={PASS2379_RECEIPT_ROUTE_HEALTH_ID}
      data-pass2380-customer-support-handoff={PASS2380_CUSTOMER_SUPPORT_HANDOFF_PACKET_ID}
      data-support-handoff-event-ledger={PASS2381_SUPPORT_HANDOFF_EVENT_LEDGER_ID}
    >
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="p-5 md:p-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.20] bg-black/[0.20] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.17em] text-velmere-gold">
            <Link2 className="h-4 w-4" /> Linked request · route health
          </p>
          <h2 className="mt-4 max-w-4xl text-3xl font-semibold tracking-[-0.05em] text-white">One operator view for the linked request.</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-white/[0.58]">
            {snapshot.focusSummary ?? "Replay evidence focus loaded."} This drawer joins safe payment evidence, account message state, operator actions and customer-safe report status without exposing raw payment or exploit-level details. PASS2372 adds direct mini-controls here, PASS2374 adds customer-safe route health, and PASS2375 keeps a last-ping ledger with stale-route warnings before customer delivery.
          </p>

          {snapshot.emptyReason ? (
            <p className="mt-4 rounded-2xl border border-amber-300/[0.14] bg-amber-300/[0.04] p-3 text-xs leading-6 text-amber-100/[0.72]"><ShieldAlert className="mr-2 inline h-4 w-4" />{snapshot.emptyReason}</p>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">payment evidence</p>
              <p className="mt-1 text-2xl text-white">{snapshot.accountState.paymentEvidenceCount}</p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.10em] text-white/[0.34]">{snapshot.evidenceSource}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">operator</p>
              <p className={`mt-2 inline-flex rounded-full border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] ${tone(snapshot.accountState.operatorStatus)}`}>{snapshot.accountState.operatorStatus ?? "missing"}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">delivery</p>
              <p className={`mt-2 inline-flex rounded-full border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] ${tone(snapshot.accountState.deliveryStatus)}`}>{snapshot.accountState.deliveryStatus ?? "missing"}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">report</p>
              <p className={`mt-2 inline-flex rounded-full border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] ${tone(snapshot.accountState.reportStatus)}`}>{snapshot.accountState.reportStatus ?? "not ready"}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <article className="rounded-[1.25rem] border border-white/[0.10] bg-black/[0.18] p-4">
              <div className="flex items-center gap-2 text-cyan-100">
                <ReceiptText className="h-4 w-4" />
                <p className="font-mono text-[9px] uppercase tracking-[0.16em]">payment evidence summary</p>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                {Object.entries(snapshot.evidenceStatusCounts).map(([status, count]) => (
                  <p key={status} className={`rounded-2xl border p-3 text-center font-mono text-[9px] uppercase tracking-[0.12em] ${tone(status)}`}>{status}<br /><span className="text-base font-semibold tracking-normal">{count}</span></p>
                ))}
              </div>
              <div className="mt-4 grid gap-2">
                {snapshot.evidenceRows.slice(0, 5).map((row) => {
                  const detail = buildPass2373PaymentEvidenceDetail(row, {
                    customerReport,
                    safePdfPacket: pdfRoute,
                    adminReplayBoard: snapshot.routes.adminReplayBoard,
                    hasAccountMessage: Boolean(message),
                  });
                  return (
                  <details key={row.id} className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3" data-pass2373-redacted-evidence-detail={detail.passId}>
                    <summary className="flex cursor-pointer list-none flex-col gap-2 rounded-xl marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-100/[0.62]">{detail.area} · {detail.scenario}</span>
                        <span className={`rounded-full border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] ${tone(detail.status)}`}>{detail.status}</span>
                      </span>
                      <span className="text-xs font-semibold text-white/[0.74]">{truncate(detail.label, 96)}</span>
                      <span className="text-[11px] leading-5 text-white/[0.44]">{truncate(detail.summary, 140)}</span>
                      <span className="inline-flex w-fit items-center gap-1 rounded-full border border-cyan-200/[0.12] bg-cyan-300/[0.035] px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-cyan-100/[0.68] transition group-open:border-velmere-gold/[0.22] group-open:text-velmere-gold">
                        <Activity className="h-3 w-3" /> click row · redacted detail + route health
                      </span>
                    </summary>
                    <div className="mt-3 rounded-[1rem] border border-white/[0.08] bg-black/[0.18] p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.42]">safe id<br /><span className="text-[10px] text-white/[0.66]">{detail.safeId}</span></p>
                        <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.42]">evidence ref<br /><span className="text-[10px] text-white/[0.66]">{truncate(detail.evidenceRef, 52)}</span></p>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {detail.routeHealth.map((item) => (
                          <p key={item.key} className={`rounded-2xl border p-3 text-[10px] leading-5 ${tone(item.state)}`}>
                            <ClipboardCheck className="mr-1 inline h-3 w-3" />
                            <span className="font-mono uppercase tracking-[0.12em]">{item.label} · {item.state}</span><br />
                            <span className="text-white/[0.54]">{item.summary}</span>
                          </p>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-2 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.40] sm:grid-cols-2">
                        <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">queue · {truncate(detail.linkedRefs.auditQueueId, 42)}</p>
                        <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">message · {truncate(detail.linkedRefs.accountMessageId, 42)}</p>
                        <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">account · {truncate(detail.linkedRefs.accountId, 42)}</p>
                        <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">provider ref · {detail.linkedRefs.paymentProviderRef}</p>
                      </div>
                      <div className="mt-3 rounded-2xl border border-amber-300/[0.12] bg-amber-300/[0.035] p-3">
                        <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-amber-100">safe checklist</p>
                        <div className="mt-2 grid gap-1">
                          {detail.checklist.slice(0, 4).map((item) => <p key={item} className="text-[11px] leading-5 text-white/[0.54]">• {item}</p>)}
                        </div>
                      </div>
                    </div>
                  </details>
                );
                })}
                {!snapshot.evidenceRows.length ? <p className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 text-xs leading-6 text-white/[0.46]">No linked evidence rows loaded. Record or link redacted evidence from Replay Board.</p> : null}
              </div>
            </article>

            <article className="rounded-[1.25rem] border border-white/[0.10] bg-black/[0.18] p-4">
              <div className="flex items-center gap-2 text-velmere-gold">
                <LockKeyhole className="h-4 w-4" />
                <p className="font-mono text-[9px] uppercase tracking-[0.16em]">account message</p>
              </div>
              <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-white">{message?.projectName || message?.title || "No account message linked"}</h3>
              <div className="mt-4 grid gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.42]">
                <p className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">request · {truncate(snapshot.linked.requestId, 48)}</p>
                <p className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">queue · {truncate(snapshot.linked.auditQueueId, 48)}</p>
                <p className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">message · {truncate(snapshot.linked.accountMessageId, 48)}</p>
                <p className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">account · {truncate(snapshot.linked.accountId, 48)}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={snapshot.routes.adminReplayBoard} className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.14] bg-cyan-300/[0.045] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100/[0.78] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"><ArrowRightCircle className="h-3.5 w-3.5" /> replay rows</a>
                {customerReport ? <a href={customerReport} className="inline-flex items-center gap-2 rounded-full border border-emerald-300/[0.14] bg-emerald-300/[0.045] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100/[0.78] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" /> customer report</a> : null}
                {pdfRoute ? <a href={pdfRoute} className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/[0.58] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><FileText className="h-3.5 w-3.5" /> PDF packet</a> : null}
              </div>
            </article>
          </div>
        </div>

        <aside className="border-t border-white/[0.08] bg-black/[0.18] p-5 xl:border-l xl:border-t-0">
          <div className="sticky top-24">
            <div className="flex items-center gap-2 text-emerald-100">
              <ShieldCheck className="h-4 w-4" />
              <p className="font-mono text-[9px] uppercase tracking-[0.16em]">operator actions + report state</p>
            </div>
            <div className="mt-4 grid gap-2">
              {snapshot.operatorActions.map((action) => (
                <p key={action} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.44]">{action.replace(/_/g, " ")}</p>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-4" data-pass2374-route-health-panel={snapshot.routeHealth.passId}>
              <div className="flex items-center gap-2 text-cyan-100">
                <Activity className="h-4 w-4" />
                <p className="font-mono text-[9px] uppercase tracking-[0.16em]">route health / ping</p>
              </div>
              <p className="mt-2 text-xs leading-6 text-white/[0.54]">{snapshot.routeHealth.recommendedAction}</p>
              <div className="mt-3 grid gap-2">
                {snapshot.routeHealth.checks.map((check) => (
                  <p key={check.key} className={`rounded-2xl border p-3 text-[10px] leading-5 ${tone(check.state)}`}>
                    <ClipboardCheck className="mr-1 inline h-3 w-3" />
                    <span className="font-mono uppercase tracking-[0.12em]">{check.label} · {check.state}</span><br />
                    <span className="text-white/[0.54]">{check.summary}</span>
                  </p>
                ))}
              </div>
              <p className="mt-3 rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.38]">endpoint · {truncate(snapshot.routeHealth.routeHealthEndpoint, 72)}</p>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-300/[0.12] bg-amber-300/[0.035] p-4" data-route-health-ledger={snapshot.routeHealthLedger.passId}>
              <div className="flex items-center gap-2 text-amber-100">
                <Activity className="h-4 w-4" />
                <p className="font-mono text-[9px] uppercase tracking-[0.16em]">last ping ledger / stale guard</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <p className={`rounded-2xl border p-3 font-mono text-[8px] uppercase tracking-[0.12em] ${tone(snapshot.routeHealthLedger.deliveryWarningLevel)}`}>delivery<br /><span className="text-base font-semibold tracking-normal">{snapshot.routeHealthLedger.deliveryWarningLevel}</span></p>
                <p className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.42]">endpoint age<br /><span className="text-base font-semibold tracking-normal text-white/[0.70]">{typeof snapshot.routeHealthLedger.lastEndpointPingAgeMinutes === "number" ? `${snapshot.routeHealthLedger.lastEndpointPingAgeMinutes}m` : "none"}</span></p>
              </div>
              <p className="mt-3 text-xs leading-6 text-white/[0.54]">{snapshot.routeHealthLedger.recommendedAction}</p>
              <div className="mt-3 grid gap-2">
                {snapshot.routeHealthLedger.warnings.slice(0, 3).map((warning) => (
                  <p key={warning.key} className={`rounded-2xl border p-3 text-[10px] leading-5 ${tone(warning.level)}`}>
                    <ClipboardCheck className="mr-1 inline h-3 w-3" />
                    <span className="font-mono uppercase tracking-[0.12em]">{warning.key.replace(/_/g, " ")} · {warning.level}</span><br />
                    <span className="text-white/[0.54]">{warning.summary}</span>
                  </p>
                ))}
              </div>
              <div className="mt-3 grid gap-2">
                {snapshot.routeHealthLedger.history.slice(0, 4).map((ping) => (
                  <p key={ping.id} className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.38]">
                    {ping.pingSource} · {ping.deliveryWarningLevel}<br /><span className="text-white/[0.62]">{ping.pingedAt}</span>
                  </p>
                ))}
                {!snapshot.routeHealthLedger.history.length ? <p className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3 text-xs leading-6 text-white/[0.46]">No route-health pings yet. Open the endpoint before customer handoff.</p> : null}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl border p-4 ${snapshot.finalDeliveryGate.canDeliver ? "border-emerald-300/[0.18] bg-emerald-300/[0.045]" : "border-rose-300/[0.14] bg-rose-300/[0.035]"}`} data-final-delivery-gate={snapshot.finalDeliveryGate.passId}>
              <div className="flex items-center gap-2 text-rose-100">
                <LockKeyhole className="h-4 w-4" />
                <p className="font-mono text-[9px] uppercase tracking-[0.16em]">final delivery gate</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <p className={`rounded-2xl border p-3 font-mono text-[8px] uppercase tracking-[0.12em] ${tone(snapshot.finalDeliveryGate.canDeliver ? "ready" : "blocked")}`}>deliver<br /><span className="text-base font-semibold tracking-normal">{snapshot.finalDeliveryGate.canDeliver ? "open" : "blocked"}</span></p>
                <p className={`rounded-2xl border p-3 font-mono text-[8px] uppercase tracking-[0.12em] ${tone(snapshot.finalDeliveryGate.endpointPingFresh ? "ready" : "blocked")}`}>endpoint ping<br /><span className="text-base font-semibold tracking-normal">{snapshot.finalDeliveryGate.endpointPingFresh ? "fresh" : "required"}</span></p>
              </div>
              <div className="mt-3 grid gap-2">
                {snapshot.finalDeliveryGate.reasons.slice(0, 4).map((reason) => (
                  <p key={reason.key} className={`rounded-2xl border p-3 text-[10px] leading-5 ${tone(reason.level)}`}>
                    <ClipboardCheck className="mr-1 inline h-3 w-3" />
                    <span className="font-mono uppercase tracking-[0.12em]">{reason.key.replace(/_/g, " ")} · {reason.level}</span><br />
                    <span className="text-white/[0.54]">{reason.summary}</span>
                  </p>
                ))}
              </div>
              <p className="mt-3 rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.38]">
                last endpoint · {snapshot.finalDeliveryGate.lastEndpointPingAt ?? "none"} · age {typeof snapshot.finalDeliveryGate.lastEndpointPingAgeMinutes === "number" ? `${snapshot.finalDeliveryGate.lastEndpointPingAgeMinutes}m` : "none"}
              </p>
            </div>


            <div className={`mt-4 rounded-2xl border p-4 ${snapshot.deliveryReceiptLedger.deliveryReceiptReady ? "border-emerald-300/[0.18] bg-emerald-300/[0.045]" : snapshot.deliveryReceiptLedger.immutableReceiptRequired ? "border-rose-300/[0.14] bg-rose-300/[0.035]" : "border-white/[0.10] bg-white/[0.025]"}`} data-delivery-receipt-ledger={snapshot.deliveryReceiptLedger.passId}>
              <div className="flex items-center gap-2 text-emerald-100">
                <ReceiptText className="h-4 w-4" />
                <p className="font-mono text-[9px] uppercase tracking-[0.16em]">delivery receipt ledger</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <p className={`rounded-2xl border p-3 font-mono text-[8px] uppercase tracking-[0.12em] ${tone(snapshot.deliveryReceiptLedger.deliveryReceiptReady ? "ready" : snapshot.deliveryReceiptLedger.immutableReceiptRequired ? "blocked" : "manual")}`}>receipt<br /><span className="text-base font-semibold tracking-normal">{snapshot.deliveryReceiptLedger.deliveryReceiptReady ? "ready" : snapshot.deliveryReceiptLedger.immutableReceiptRequired ? "missing" : "pending"}</span></p>
                <p className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.42]">count<br /><span className="text-base font-semibold tracking-normal text-white/[0.70]">{snapshot.deliveryReceiptLedger.receiptCount}</span></p>
              </div>
              {snapshot.deliveryReceiptLedger.latestReceipt ? (
                <div className="mt-3 grid gap-2">
                  <p className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.38]">receipt id<br /><span className="text-[10px] text-white/[0.66]">{truncate(snapshot.deliveryReceiptLedger.latestReceipt.receiptId, 58)}</span></p>
                  <p className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.38]">checksum<br /><span className="text-[10px] text-white/[0.66]">{truncate(snapshot.deliveryReceiptLedger.latestReceipt.checksum, 58)}</span></p>
                  <p className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.38]">delivered<br /><span className="text-[10px] text-white/[0.66]">{snapshot.deliveryReceiptLedger.latestReceipt.deliveredAt}</span></p>
                  <div className="flex flex-wrap gap-2" data-pass2378-drawer-delivery-receipt-links="route-and-downloadable-redacted-packet">
                    <a href={deliveryReceiptRoute(snapshot.locale, snapshot.deliveryReceiptLedger.latestReceipt.receiptId)} className="inline-flex items-center gap-2 rounded-full border border-emerald-300/[0.16] bg-emerald-300/[0.045] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"><ArrowRightCircle className="h-3.5 w-3.5" /> receipt route</a>
                    <a href={deliveryReceiptDownloadRoute(snapshot.locale, snapshot.deliveryReceiptLedger.latestReceipt.receiptId)} className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-black/[0.18] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-white/[0.66] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><FileText className="h-3.5 w-3.5" /> redacted packet</a>
                    <a href={supportHandoffRoute(snapshot.locale, snapshot.deliveryReceiptLedger.latestReceipt.receiptId)} className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.14] bg-cyan-300/[0.045] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200" data-pass2380-drawer-support-handoff-link="route"><LifeBuoy className="h-3.5 w-3.5" /> support handoff</a>
                    <a href={supportHandoffDownloadRoute(snapshot.locale, snapshot.deliveryReceiptLedger.latestReceipt.receiptId)} className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-black/[0.18] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-white/[0.66] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" data-pass2380-drawer-support-handoff-download="redacted-json" data-pass2381-drawer-support-download-event="support_packet_download"><FileText className="h-3.5 w-3.5" /> support JSON</a>
                  </div>
                  {snapshot.supportHandoffEventLedger ? (
                    <div className="mt-3 rounded-2xl border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-3" data-pass2381-drawer-support-event-ledger="open-download-support-handoff-audit-trail">
                      <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-cyan-100/[0.62]">support event ledger</p>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <p className="rounded-xl border border-white/[0.08] bg-black/[0.18] p-2 font-mono text-[8px] uppercase tracking-[0.10em] text-white/[0.42]">events<br /><span className="text-sm text-white/[0.74]">{snapshot.supportHandoffEventLedger.eventCount}</span></p>
                        <p className="rounded-xl border border-white/[0.08] bg-black/[0.18] p-2 font-mono text-[8px] uppercase tracking-[0.10em] text-white/[0.42]">opens<br /><span className="text-sm text-white/[0.74]">{snapshot.supportHandoffEventLedger.openCount}</span></p>
                        <p className="rounded-xl border border-white/[0.08] bg-black/[0.18] p-2 font-mono text-[8px] uppercase tracking-[0.10em] text-white/[0.42]">downloads<br /><span className="text-sm text-white/[0.74]">{snapshot.supportHandoffEventLedger.downloadCount}</span></p>
                      </div>
                      {snapshot.supportHandoffEventLedger.latestEvent ? (
                        <p className="mt-2 break-all font-mono text-[8px] uppercase tracking-[0.10em] text-white/[0.38]">latest · {snapshot.supportHandoffEventLedger.latestEvent.eventType} · {truncate(snapshot.supportHandoffEventLedger.latestEvent.checksum, 58)}</p>
                      ) : (
                        <p className="mt-2 text-[10px] leading-5 text-white/[0.46]">No support handoff open/download events yet.</p>
                      )}
                    </div>
                  ) : null}

                </div>
              ) : null}
              <p className="mt-3 text-xs leading-6 text-white/[0.54]">{snapshot.deliveryReceiptLedger.recommendedAction}</p>
            </div>

            {snapshot.receiptRouteHealth ? (
              <div className={`mt-4 rounded-2xl border p-4 ${snapshot.receiptRouteHealth.freshnessBadge === "fresh" ? "border-emerald-300/[0.18] bg-emerald-300/[0.045]" : snapshot.receiptRouteHealth.freshnessBadge === "watch" ? "border-amber-300/[0.16] bg-amber-300/[0.045]" : "border-rose-300/[0.16] bg-rose-300/[0.04]"}`} data-pass2379-drawer-receipt-route-health={snapshot.receiptRouteHealth.passId}>
                <div className="flex items-center gap-2 text-emerald-100">
                  <Activity className="h-4 w-4" />
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em]">receipt route freshness</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <p className={`rounded-2xl border p-3 font-mono text-[8px] uppercase tracking-[0.12em] ${tone(snapshot.receiptRouteHealth.accountBadge.tone)}`}>badge<br /><span className="text-base font-semibold tracking-normal">{snapshot.receiptRouteHealth.freshnessBadge}</span></p>
                  <p className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.42]">refresh<br /><span className="text-base font-semibold tracking-normal text-white/[0.70]">{snapshot.receiptRouteHealth.refreshAfterSeconds}s</span></p>
                </div>
                <p className="mt-3 text-xs leading-6 text-white/[0.54]">{snapshot.receiptRouteHealth.recommendedAction}</p>
                <div className="mt-3 grid gap-2">
                  {snapshot.receiptRouteHealth.checks.slice(0, 4).map((check) => (
                    <p key={check.key} className={`rounded-2xl border p-3 text-[10px] leading-5 ${tone(check.state)}`}>
                      <ClipboardCheck className="mr-1 inline h-3 w-3" />
                      <span className="font-mono uppercase tracking-[0.12em]">{check.label} · {check.state}</span><br />
                      <span className="text-white/[0.54]">{check.summary}</span>
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-4 rounded-2xl border border-emerald-300/[0.12] bg-emerald-300/[0.035] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-emerald-100">next steps</p>
              <div className="mt-3 grid gap-2">
                {snapshot.nextSteps.map((step) => <p key={step} className="text-xs leading-6 text-white/[0.56]">• {step}</p>)}
              </div>
            </div>
            <SecurityLinkedRequestQuickActionsClient locale={snapshot.locale} initialMessage={message} initialFinalDeliveryGate={snapshot.finalDeliveryGate} />
            <p className="mt-4 rounded-2xl border border-rose-300/[0.12] bg-rose-300/[0.035] p-4 text-xs leading-6 text-rose-100/[0.70]"><ShieldAlert className="mr-2 inline h-4 w-4" />{snapshot.safetyBoundary}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
