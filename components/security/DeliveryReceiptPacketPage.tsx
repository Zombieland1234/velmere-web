import { ArrowLeft, Download, ExternalLink, FileText, LifeBuoy, LockKeyhole, ReceiptText, ShieldCheck } from "lucide-react";
import type { Pass2378DeliveryReceiptPacket } from "@/lib/security/delivery-receipt-packet";
import type { Pass2379ReceiptRouteHealthSnapshot } from "@/lib/security/receipt-route-health";

function statusTone(status: Pass2378DeliveryReceiptPacket["status"]) {
  if (status === "ready") return "border-emerald-300/[0.18] bg-emerald-300/[0.055] text-emerald-100";
  if (status === "not_found") return "border-rose-300/[0.18] bg-rose-300/[0.055] text-rose-100";
  return "border-amber-300/[0.18] bg-amber-300/[0.05] text-amber-100";
}

function yesNo(value: boolean | undefined) {
  if (typeof value !== "boolean") return "—";
  return value ? "yes" : "no";
}

function supportHandoffRoute(locale: string, receiptId?: string) {
  return `/${locale}/security/audits/support-handoff/${encodeURIComponent(receiptId || "missing")}`;
}

function supportHandoffDownloadRoute(locale: string, receiptId?: string) {
  return `/api/security/audit-watch/support-handoff?receiptId=${encodeURIComponent(receiptId || "missing")}&locale=${locale}&format=download`;
}

export default function DeliveryReceiptPacketPage({ packet, receiptRouteHealth }: { packet: Pass2378DeliveryReceiptPacket; receiptRouteHealth?: Pass2379ReceiptRouteHealthSnapshot }) {
  return (
    <main
      className="velmere-public-page min-h-screen bg-velmere-black px-5 pb-24 pt-28 text-white md:px-10 md:pt-36"
      data-pass2378-delivery-receipt-page={packet.passId}
      data-pass2378-redacted-receipt-packet="true"
      data-pass2378-no-raw-payment="true"
      data-pass2378-no-exploit-instructions="true"
      data-receipt-route-health={receiptRouteHealth?.passId}
      data-pass2379-account-badge-refresh={receiptRouteHealth?.freshnessBadge}
    >
      <section className="mx-auto max-w-6xl">
        <a href={`/${packet.locale}/account?tab=messages`} className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/[0.66] transition hover:border-white/[0.22] hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Account messages
        </a>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_24rem] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.07] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.17em] text-velmere-gold">
              <ReceiptText className="h-4 w-4" /> delivery receipt packet
            </p>
            <h1 className="mt-6 max-w-5xl font-serif text-5xl leading-[0.95] tracking-[-0.06em] md:text-7xl">{packet.title}</h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/[0.62]">{packet.summary}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={packet.links.accountRoute} className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.16] bg-cyan-300/[0.045] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:border-cyan-200/[0.28] hover:text-white">
                <ExternalLink className="h-4 w-4" /> account
              </a>
              {packet.links.customerReportRoute ? (
                <a href={packet.links.customerReportRoute} className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white/[0.70] transition hover:border-white/[0.24] hover:text-white">
                  <FileText className="h-4 w-4" /> customer report
                </a>
              ) : null}
              <a href={packet.links.downloadableReceiptPacketRoute} className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.24] bg-velmere-gold/[0.085] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-velmere-gold transition hover:bg-velmere-gold/[0.14]" data-pass2378-downloadable-redacted-receipt-packet="json">
                <Download className="h-4 w-4" /> redacted receipt packet
              </a>
              <a href={supportHandoffRoute(packet.locale, packet.receipt?.receiptId)} className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.18] bg-cyan-300/[0.055] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:border-cyan-200/[0.30] hover:text-white" data-pass2380-receipt-page-support-handoff-link="route">
                <LifeBuoy className="h-4 w-4" /> support handoff
              </a>
              <a href={supportHandoffDownloadRoute(packet.locale, packet.receipt?.receiptId)} className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white/[0.70] transition hover:border-white/[0.24] hover:text-white" data-pass2380-receipt-page-support-handoff-download="redacted-json">
                <Download className="h-4 w-4" /> support JSON
              </a>
            </div>
          </div>

          <aside className={`rounded-[1.8rem] border p-5 shadow-velmere-card ${statusTone(packet.status)}`}>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] opacity-70">status</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{packet.status.replace(/_/g, " ")}</h2>
            <p className="mt-4 text-sm leading-7 opacity-75">{packet.project.name}</p>
            {packet.receipt?.receiptId ? <p className="mt-4 break-all font-mono text-[9px] uppercase tracking-[0.16em] opacity-55">{packet.receipt.receiptId}</p> : null}
            {packet.receipt?.checksum ? <p className="mt-2 break-all font-mono text-[9px] uppercase tracking-[0.16em] opacity-55">checksum · {packet.receipt.checksum}</p> : null}
          </aside>
        </section>

        {receiptRouteHealth ? (
          <section className={`mt-8 rounded-[1.9rem] border p-6 md:p-8 ${receiptRouteHealth.freshnessBadge === "fresh" ? "border-emerald-300/[0.14] bg-emerald-300/[0.04]" : receiptRouteHealth.freshnessBadge === "watch" ? "border-amber-300/[0.14] bg-amber-300/[0.04]" : "border-rose-300/[0.14] bg-rose-300/[0.04]"}`} data-receipt-route-health-panel={receiptRouteHealth.passId}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.42]">Receipt route health</p>
                <h2 className="mt-2 font-serif text-3xl tracking-[-0.045em]">{receiptRouteHealth.accountBadge.label}</h2>
              </div>
              <p className="rounded-full border border-white/[0.12] bg-black/[0.18] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.58]">refresh · {receiptRouteHealth.refreshAfterSeconds}s</p>
            </div>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-white/[0.58]">{receiptRouteHealth.accountBadge.summary}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {receiptRouteHealth.checks.map((check) => (
                <p key={check.key} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.58]">
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.42]">{check.label} · {check.state}</span><br />
                  {check.summary}
                </p>
              ))}
            </div>
            <p className="mt-5 rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.58]">{receiptRouteHealth.recommendedAction}</p>
          </section>
        ) : null}

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,.9fr)]">
          <article className="rounded-[1.9rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-6 md:p-8">
            <ShieldCheck className="h-5 w-5 text-cyan-100" />
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Receipt summary</h2>
            <div className="mt-5 grid gap-3">
              {packet.receiptSections.map((section) => (
                <p key={section} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.58]">{section}</p>
              ))}
            </div>
          </article>

          <article className="rounded-[1.9rem] border border-velmere-gold/[0.14] bg-velmere-gold/[0.045] p-6 md:p-8">
            <ReceiptText className="h-5 w-5 text-velmere-gold" />
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Gate snapshot</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <p className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">can deliver<br /><span className="text-base tracking-normal text-white">{yesNo(packet.gateSnapshot?.canDeliver)}</span></p>
              <p className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">endpoint fresh<br /><span className="text-base tracking-normal text-white">{yesNo(packet.gateSnapshot?.endpointPingFresh)}</span></p>
              <p className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">blocked warnings<br /><span className="text-base tracking-normal text-white">{packet.gateSnapshot?.blockedWarningCount ?? "—"}</span></p>
              <p className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">stale warnings<br /><span className="text-base tracking-normal text-white">{packet.gateSnapshot?.staleWarningCount ?? "—"}</span></p>
            </div>
            <p className="mt-5 rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.58]">{packet.recommendedAction}</p>
          </article>
        </section>

        <section className="mt-8 rounded-[1.9rem] border border-rose-200/[0.12] bg-rose-300/[0.035] p-6 md:p-8" data-pass2378-receipt-boundary="blocked-raw-payment-secrets-exploit-claims">
          <LockKeyhole className="h-5 w-5 text-rose-100" />
          <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Boundary</h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-white/[0.58]">{packet.customerBoundary}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {packet.forbidden.map((claim) => (
              <p key={claim} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">blocked · {claim}</p>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
