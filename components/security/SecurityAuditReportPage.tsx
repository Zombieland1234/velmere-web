import { ArrowLeft, ArrowRight, Download, ExternalLink, FileText, LockKeyhole, Network, ShieldAlert, ShieldCheck } from "lucide-react";
import { Link } from "@/navigation";
import { buildAuditReportPublicPage } from "@/lib/security/audit-report-queue";
import { buildAuditReportExportPayload } from "@/lib/security/audit-pdf-shield-export";
import { buildAuditLeadCapturePacket } from "@/lib/security/audit-business-flow";

const toneClass = {
  good: "border-emerald-300/[0.18] bg-emerald-300/[0.055] text-emerald-100",
  warn: "border-amber-300/[0.18] bg-amber-300/[0.055] text-amber-100",
  danger: "border-rose-300/[0.18] bg-rose-300/[0.055] text-rose-100",
  neutral: "border-cyan-200/[0.16] bg-cyan-300/[0.045] text-cyan-100",
} as const;

const timelineClass = {
  done: "border-emerald-300/[0.18] bg-emerald-300/[0.045] text-emerald-100",
  active: "border-cyan-200/[0.16] bg-cyan-300/[0.045] text-cyan-100",
  blocked: "border-rose-300/[0.18] bg-rose-300/[0.045] text-rose-100",
  pending: "border-white/[0.09] bg-white/[0.025] text-white/[0.58]",
} as const;

const severityClass: Record<string, string> = {
  info: "border-cyan-200/[0.14] bg-cyan-300/[0.035] text-cyan-100",
  low: "border-emerald-300/[0.14] bg-emerald-300/[0.035] text-emerald-100",
  medium: "border-amber-300/[0.16] bg-amber-300/[0.04] text-amber-100",
  high: "border-rose-300/[0.18] bg-rose-300/[0.045] text-rose-100",
  critical: "border-rose-400/[0.24] bg-rose-400/[0.065] text-rose-50",
};

export default function SecurityAuditReportPage({ locale, id }: { locale: string; id: string }) {
  const page = buildAuditReportPublicPage(locale, id);
  const { copy, record } = page;
  const exportPayload = buildAuditReportExportPayload(id, locale);
  const leadPacket = buildAuditLeadCapturePacket(id, locale);
  const score = Math.max(0, Math.min(100, Math.round(record.evidenceCoverage)));
  const scoreDegrees = Math.round((score / 100) * 360);

  return (
    <main
      className="velmere-public-page min-h-screen bg-velmere-black px-5 pb-24 pt-28 text-white md:px-10 md:pt-36"
      data-pass1614-audit-report-status-page={page.passId}
      data-pass1614-task-count={page.taskCount}
      data-pass1614-report-id={record.reportId}
      data-pass1614-public-route={record.publicRoute}
      data-pass1614-no-certified-safe="true"
    >
      <section className="mx-auto max-w-7xl">
        <Link
          href="/security/audits"
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/[0.66] transition hover:border-white/[0.22] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {copy.back}
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2.2rem] border border-white/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(160,130,80,0.12),transparent_28%),linear-gradient(180deg,#060709_0%,#050608_100%)] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.42)] md:p-10">
          <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(380px,.95fr)] xl:items-start">
            <div>
              <p className="inline-flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-velmere-gold/80">
                <span className="h-px w-10 bg-velmere-gold/60" />
                {copy.eyebrow}
              </p>
              <h1 className="mt-7 max-w-4xl font-serif text-[clamp(3rem,6vw,5.8rem)] leading-[0.92] tracking-[-0.07em] text-white">
                {copy.title}
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-white/[0.62]">{copy.subtitle}</p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/security/audits#review-console"
                  className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.28] bg-velmere-gold/[0.10] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-velmere-gold transition hover:bg-velmere-gold/[0.16]"
                >
                  {copy.request}
                </Link>
                <a
                  href={record.lensExport.route}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.16] bg-cyan-300/[0.045] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:border-cyan-200/[0.28] hover:text-white"
                  data-pass1614-lens-export-link="audit-report-pdf-manifest"
                >
                  <Download className="h-4 w-4" /> PDF manifest
                </a>
                <Link
                  href={`/security/audits/export/${record.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white/[0.70] transition hover:border-white/[0.22] hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" /> full export
                </Link>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  ["Project", record.projectName],
                  ["Chain", record.chain],
                  ["Review", record.reviewLevel.replace(/_/g, " ")],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[1.2rem] border border-white/[0.09] bg-black/[0.18] p-4">
                    <p className="text-[9px] uppercase tracking-[0.16em] text-white/[0.36]">{label}</p>
                    <p className="mt-2 text-sm text-white/[0.72]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className={`rounded-[2rem] border p-6 shadow-[0_22px_80px_rgba(0,0,0,0.45)] ${toneClass[record.statusTone]}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] opacity-70">{copy.status}</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">{record.statusLabel}</h2>
                </div>
                <ShieldAlert className="h-6 w-6 opacity-80" />
              </div>

              <div className="mt-7 flex justify-center">
                <div className="flex h-44 w-44 items-center justify-center rounded-full border border-velmere-gold/25" style={{ background: `conic-gradient(rgba(214,175,100,0.95) 0 ${scoreDegrees}deg, rgba(255,255,255,0.08) ${scoreDegrees}deg 360deg)` }}>
                  <div className="flex h-[8.4rem] w-[8.4rem] flex-col items-center justify-center rounded-full bg-[#08090b] text-center shadow-inner">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-white/[0.40]">Evidence coverage</span>
                    <strong className="mt-2 text-5xl font-semibold tracking-[-0.08em] text-white">{score}</strong>
                    <span className="mt-1 text-xs text-white/[0.46]">/100</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm text-white/[0.72]">
                <div className="rounded-xl border border-white/10 bg-black/18 p-3">
                  <span className="text-[9px] uppercase tracking-[0.16em] text-white/[0.38]">Report ID</span>
                  <p className="mt-2 break-all font-mono text-[11px] text-white/[0.78]">{record.reportId}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/18 p-3">
                  <span className="text-[9px] uppercase tracking-[0.16em] text-white/[0.38]">Visibility</span>
                  <p className="mt-2 text-white/[0.78]">{record.boundaries.audience}</p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-8 rounded-[1.9rem] border border-emerald-300/[0.12] bg-emerald-300/[0.035] p-6 md:p-8" data-pass1694-report-lead-routing="pricing-disclosure-route">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-100">Lead packet</p>
              <h2 className="mt-3 font-serif text-3xl tracking-[-0.045em]">{leadPacket.selectedTier} · {leadPacket.route}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/[0.58]">{leadPacket.replyPromise}. Disclosure contact required: {leadPacket.disclosureContactRequired ? "yes" : "no"}.</p>
            </div>
            <Link href="/security/audits/pricing" className="inline-flex items-center gap-2 rounded-full border border-emerald-300/[0.18] bg-emerald-300/[0.06] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-100 transition hover:border-emerald-300/[0.30] hover:text-white">Review packages</Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {leadPacket.safeSalesCopy.slice(0, 6).map((item) => (
              <p key={item} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">{item}</p>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
          <article className="rounded-[1.9rem] border border-white/[0.09] bg-white/[0.025] p-6 md:p-8">
            <p className="text-[10px] uppercase tracking-[0.18em] text-velmere-gold">{copy.timeline}</p>
            <div className="mt-6 grid gap-3">
              {record.timeline.map((item) => (
                <div key={item.id} className={`rounded-2xl border p-4 ${timelineClass[item.state]}`}>
                  <p className="text-[9px] uppercase tracking-[0.16em] opacity-70">{item.state}</p>
                  <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">{item.label}</h2>
                  <p className="mt-2 text-xs leading-6 opacity-75">{item.body}</p>
                </div>
              ))}
            </div>
          </article>

          <aside className="grid gap-4">
            <div className="rounded-[1.6rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-5" data-pass1614-lens-export-card="enabled-redaction-sections">
              <FileText className="h-5 w-5 text-velmere-gold" />
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em]">{copy.lens}</h2>
              <p className="mt-3 text-sm leading-7 text-white/[0.54]">
                {record.lensExport.enabled ? "Export allowed after operator review." : "Export requires redaction before publication."}
              </p>
              <div className="mt-4 grid gap-2">
                {record.lensExport.sections.slice(0, 5).map((section) => (
                  <p key={section} className="rounded-2xl border border-white/[0.08] bg-black/[0.16] px-3 py-2 text-xs leading-6 text-white/[0.56]">
                    {section}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-[1.6rem] border border-white/[0.10] bg-white/[0.025] p-5" data-pass1614-shield-map-export-card="audit-claim-evidence-graph">
              <Network className="h-5 w-5 text-cyan-100" />
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em]">{copy.map}</h2>
              <p className="mt-3 text-sm leading-7 text-white/[0.52]">{record.shieldMapExport.nodes.join(" → ")}</p>
            </div>
            <div className="rounded-[1.6rem] border border-white/[0.10] bg-white/[0.025] p-5" data-pass1614-queue-signals="request-status-confidence">
              <h2 className="text-xl font-semibold tracking-[-0.03em]">Queue signals</h2>
              <div className="mt-4 grid gap-2">
                {record.queueSignals.slice(0, 4).map((signal) => (
                  <div key={signal} className="rounded-xl border border-white/[0.08] bg-black/[0.16] px-3 py-3 text-xs leading-6 text-white/[0.58]">
                    {signal}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-8 grid gap-5 rounded-[1.9rem] border border-velmere-gold/[0.14] bg-velmere-gold/[0.045] p-6 md:grid-cols-[minmax(0,.75fr)_minmax(0,1.25fr)] md:p-8" data-pass1654-report-export-preview="lens-pdf-shield-map-payload">
          <div>
            <FileText className="h-5 w-5 text-velmere-gold" />
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Full Lens PDF + Shield Map export</h2>
            <p className="mt-4 text-sm leading-7 text-white/[0.58]">Queue record expands into a complete audit verification payload: cover, sections, findings, appendix, graph nodes and graph edges.</p>
            <Link href={`/security/audits/export/${record.slug}`} className="mt-5 inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.22] bg-velmere-gold/[0.08] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-velmere-gold transition hover:bg-velmere-gold/[0.14]">Open full export <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {exportPayload.pdf.sections.slice(0, 3).map((section) => (
              <div key={section.id} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4">
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/[0.38]">PDF section</p>
                <p className="mt-2 text-sm leading-6 text-white/[0.60]">{section.title}</p>
              </div>
            ))}
            {exportPayload.shieldMap.nodes.slice(0, 3).map((node) => (
              <div key={node.id} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4">
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/[0.38]">map node</p>
                <p className="mt-2 text-sm leading-6 text-white/[0.60]">{node.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[1.9rem] border border-white/[0.09] bg-white/[0.025] p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100">{copy.findings}</p>
              <h2 className="mt-3 font-serif text-4xl tracking-[-0.05em]">Evidence without exploit instructions</h2>
            </div>
            <div className="rounded-full border border-white/[0.10] bg-black/[0.18] px-4 py-2 text-[9px] uppercase tracking-[0.16em] text-white/[0.48]">
              {record.boundaries.audience}
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {record.findings.map((finding) => (
              <article key={finding.id} className={`rounded-[1.45rem] border p-4 ${severityClass[finding.severity] ?? severityClass.info}`}>
                <p className="text-[9px] uppercase tracking-[0.15em] opacity-70">{finding.severity} · {finding.privateHandling}</p>
                <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em]">{finding.title}</h3>
                <p className="mt-3 text-xs leading-6 opacity-75">{finding.publicSummary}</p>
                <p className="mt-3 rounded-2xl border border-white/[0.10] bg-black/[0.16] p-3 text-xs leading-6 opacity-75">{finding.recommendation}</p>
                <p className="mt-3 text-[9px] uppercase tracking-[0.14em] opacity-55">{finding.lensAnchor} · {finding.mapAnchor}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
          <article className="rounded-[1.9rem] border border-rose-200/[0.12] bg-rose-300/[0.035] p-6 md:p-8" data-pass1614-publication-boundary="no-exploit-certified-safe-blocked">
            <LockKeyhole className="h-5 w-5 text-rose-100" />
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">{copy.boundaries}</h2>
            <div className="mt-5 grid gap-3">
              {record.boundaries.forbiddenClaims.map((claim) => (
                <p key={claim} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.58]">
                  blocked: {claim}
                </p>
              ))}
            </div>
          </article>
          <article className="rounded-[1.9rem] border border-velmere-gold/[0.14] bg-velmere-gold/[0.045] p-6 md:p-8">
            <ShieldCheck className="h-5 w-5 text-velmere-gold" />
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Next actions</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {record.nextActions.map((action) => (
                <p key={action} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.58]">
                  {action}
                </p>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
