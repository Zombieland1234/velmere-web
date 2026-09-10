import { ArrowLeft, ArrowRight, Download, ExternalLink, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import CustomerSafeAuditTimeline from "@/components/security/CustomerSafeAuditTimeline";
import type { Pass2369CustomerSafeReportPayload } from "@/lib/security/customer-safe-report-route";

const statusTone: Record<string, string> = {
  ready: "border-emerald-300/[0.18] bg-emerald-300/[0.055] text-emerald-100",
  delivered: "border-emerald-300/[0.18] bg-emerald-300/[0.055] text-emerald-100",
  human_review: "border-cyan-200/[0.16] bg-cyan-300/[0.045] text-cyan-100",
  needs_evidence: "border-amber-300/[0.18] bg-amber-300/[0.05] text-amber-100",
  blocked_redaction: "border-rose-300/[0.18] bg-rose-300/[0.055] text-rose-100",
  intake: "border-white/[0.10] bg-white/[0.025] text-white/[0.58]",
};

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function CustomerSafeAuditReportPage({ payload }: { payload: Pass2369CustomerSafeReportPayload }) {
  const score = payload.riskScore;
  const scoreDegrees = score === null ? 0 : Math.max(0, Math.min(360, Math.round((score / 100) * 360)));
  const displaySections = payload.canonicalLayout.customerSections;
  const displayNextSteps = payload.canonicalLayout.nextSteps;

  return (
    <main
      className="velmere-public-page min-h-screen bg-velmere-black px-5 pb-24 pt-28 text-white md:px-10 md:pt-36"
      data-pass2369-customer-safe-report-page={payload.passId}
      data-pass2369-report-source={payload.source}
      data-pass2369-no-raw-payment="true"
      data-pass2369-no-exploit-instructions="true"
      data-pass4820-layout-digest={payload.layoutDigest}
      data-pass4820-pdf-ready={payload.pdfReady ? "true" : "false"}
      data-pass4821-snapshot-ready={payload.snapshotReady ? "true" : "false"}
      data-pass4821-snapshot-digest={payload.snapshotDigest ?? "missing"}
    >
      <section className="mx-auto max-w-7xl">
        <a
          href={`/${payload.locale}/security/audits`}
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/[0.66] transition hover:border-white/[0.22] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Velmère Audit
        </a>

        <section className="mt-6 overflow-hidden rounded-[2.2rem] border border-white/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(160,130,80,0.12),transparent_28%),linear-gradient(180deg,#060709_0%,#050608_100%)] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.42)] md:p-10">
          <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(380px,.95fr)] xl:items-start">
            <div>
              <p className="inline-flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-velmere-gold/80">
                <span className="h-px w-10 bg-velmere-gold/60" /> CUSTOMER-SAFE REPORT
              </p>
              <h1 className="mt-7 max-w-4xl font-serif text-[clamp(3rem,6vw,5.8rem)] leading-[0.92] tracking-[-0.07em] text-white">
                {payload.title}
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-white/[0.62]">{payload.summary}</p>

              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href={payload.links.accountRoute}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.16] bg-cyan-300/[0.045] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:border-cyan-200/[0.28] hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" /> account messages
                </a>
                <a
                  href={payload.links.pdfRoute}
                  className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.24] bg-velmere-gold/[0.085] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-velmere-gold transition hover:bg-velmere-gold/[0.14]"
                  data-pass2369-customer-safe-pdf-route="sanitized-placeholder-or-attached-pdf"
                >
                  <Download className="h-4 w-4" /> safe pdf packet
                </a>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  ["Project", payload.projectName],
                  ["Review level", statusLabel(payload.reviewLevel)],
                  ["Updated", new Date(payload.refreshedAt).toLocaleDateString(payload.locale)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[1.2rem] border border-white/[0.09] bg-black/[0.18] p-4">
                    <p className="text-[9px] uppercase tracking-[0.16em] text-white/[0.36]">{label}</p>
                    <p className="mt-2 text-sm text-white/[0.72]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className={`rounded-[2rem] border p-6 shadow-[0_22px_80px_rgba(0,0,0,0.45)] ${statusTone[payload.status] ?? statusTone.intake}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] opacity-70">status</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">{statusLabel(payload.status)}</h2>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[9px] uppercase tracking-[0.16em] opacity-75">customer-safe</span>
              </div>

              <div className="mt-7 flex justify-center">
                <div className="flex h-44 w-44 items-center justify-center rounded-full border border-velmere-gold/25" style={{ background: `conic-gradient(rgba(214,175,100,0.95) 0 ${scoreDegrees}deg, rgba(255,255,255,0.08) ${scoreDegrees}deg 360deg)` }}>
                  <div className="flex h-[8.4rem] w-[8.4rem] flex-col items-center justify-center rounded-full bg-[#08090b] text-center shadow-inner">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-white/[0.40]">Report score</span>
                    <strong className="mt-2 text-5xl font-semibold tracking-[-0.08em] text-white">{score === null ? "—" : score}</strong>
                    <span className="mt-1 text-xs text-white/[0.46]">/100</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-black/18 p-3 text-white/[0.72]">
                  <span className="text-[9px] uppercase tracking-[0.16em] text-white/[0.38]">Request ID</span>
                  <p className="mt-2 break-all font-mono text-[11px] text-white/[0.78]">{payload.requestId}</p>
                </div>
                {payload.queueId ? (
                  <div className="rounded-xl border border-white/10 bg-black/18 p-3 text-white/[0.72]">
                    <span className="text-[9px] uppercase tracking-[0.16em] text-white/[0.38]">Queue</span>
                    <p className="mt-2 break-all font-mono text-[11px] text-white/[0.78]">{payload.queueId}</p>
                  </div>
                ) : null}
                <div className="rounded-xl border border-white/10 bg-black/18 p-3 text-white/[0.72]">
                  <span className="text-[9px] uppercase tracking-[0.16em] text-white/[0.38]">Report ID</span>
                  <p className="mt-2 break-all font-mono text-[11px] text-white/[0.78]">{payload.reportId}</p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <div className="mt-8">
          <CustomerSafeAuditTimeline timeline={payload.timeline} />
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,.95fr)]">
          <article className="rounded-[1.9rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-6 md:p-8">
            <FileText className="h-5 w-5 text-cyan-100" />
            <div className="mt-4 flex items-center justify-between gap-4">
              <h2 className="font-serif text-3xl tracking-[-0.045em]">Customer-safe sections</h2>
              <span className="rounded-full border border-white/[0.10] bg-black/[0.18] px-3 py-1 text-[9px] uppercase tracking-[0.16em] text-white/[0.48]">sanitized</span>
            </div>
            <div className="mt-5 grid gap-3">
              {displaySections.map((section, index) => (
                <div key={section} className="grid gap-3 rounded-[1.15rem] border border-white/[0.10] bg-black/[0.18] p-4 md:grid-cols-[auto_1fr] md:items-center">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-velmere-gold/18 bg-velmere-gold/10 text-sm font-semibold text-velmere-gold">{index + 1}</span>
                  <p className="text-sm leading-7 text-white/[0.60]">{section}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.9rem] border border-velmere-gold/[0.14] bg-velmere-gold/[0.045] p-6 md:p-8">
            <ShieldCheck className="h-5 w-5 text-velmere-gold" />
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Next actions</h2>
            <div className="mt-5 grid gap-3">
              {displayNextSteps.map((step) => (
                <div key={step} className="flex items-start gap-3 rounded-[1.15rem] border border-white/[0.10] bg-black/[0.18] p-4 text-sm leading-7 text-white/[0.60]">
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-velmere-gold" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-8 rounded-[1.9rem] border border-rose-200/[0.12] bg-rose-300/[0.035] p-6 md:p-8" data-pass2369-customer-safe-forbidden-claims="blocked">
          <LockKeyhole className="h-5 w-5 text-rose-100" />
          <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Boundary</h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-white/[0.58]">{payload.customerBoundary}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {payload.forbidden.map((claim) => (
              <p key={claim} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">
                blocked · {claim}
              </p>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
