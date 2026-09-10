import { ArrowLeft, FileText, LockKeyhole, Network, ShieldCheck } from "lucide-react";
import { Link } from "@/navigation";
import { buildAuditReportExportPayload } from "@/lib/security/audit-pdf-shield-export";
import { buildAuditLeadCapturePacket } from "@/lib/security/audit-business-flow";

const nodeTone = {
  good: "border-emerald-300/[0.18] bg-emerald-300/[0.045] text-emerald-100",
  warn: "border-amber-300/[0.18] bg-amber-300/[0.045] text-amber-100",
  danger: "border-rose-300/[0.18] bg-rose-300/[0.045] text-rose-100",
  neutral: "border-cyan-200/[0.16] bg-cyan-300/[0.035] text-cyan-100",
} as const;

export default function SecurityAuditExportPage({ locale, id }: { locale: string; id: string }) {
  const payload = buildAuditReportExportPayload(id, locale);
  const leadPacket = buildAuditLeadCapturePacket(id, locale);

  return (
    <main
      className="velmere-public-page min-h-screen bg-velmere-black px-5 pb-24 pt-28 text-white md:px-10 md:pt-36"
      data-audit-pdf-shield-export={payload.passId}
      data-pass1654-task-count={payload.taskCount}
      data-pass1654-report-id={payload.reportId}
      data-pass1654-no-certified-safe="true"
      data-pass1654-no-exploit-instructions="true"
    >
      <section className="mx-auto max-w-6xl">
        <Link href="/security/audits" className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/[0.66] transition hover:border-white/[0.22] hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          report status
        </Link>

        <section className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_24rem] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.07] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.17em] text-velmere-gold">
              <ShieldCheck className="h-4 w-4" />
 full export
 </p>
            <h1 className="mt-6 max-w-5xl font-serif text-5xl leading-[0.95] tracking-[-0.06em] md:text-7xl">{payload.pdf.title}</h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/[0.62]">{payload.pdf.subtitle}</p>
          </div>

          <aside className="rounded-[1.8rem] border border-cyan-200/[0.14] bg-cyan-300/[0.04] p-5 shadow-velmere-card">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-100">{payload.reportId}</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{payload.projectName}</h2>
            <div className="mt-5 grid gap-2">
              {payload.pdf.coverBadges.map((badge) => (
                <span key={badge} className="rounded-full border border-white/[0.10] bg-black/[0.18] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.54]">{badge}</span>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-8 rounded-[1.9rem] border border-emerald-300/[0.12] bg-emerald-300/[0.035] p-6 md:p-8" data-pass1694-export-business-routing="lead-capture-safe-sales-copy">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-100">Business export</p>
              <h2 className="mt-3 font-serif text-3xl tracking-[-0.045em]">{leadPacket.selectedTier} · {leadPacket.priority}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/[0.58]">{leadPacket.replyPromise}. Full export stays review/pre-audit only and blocks Certified Safe language.</p>
            </div>
            <Link href="/security/audits/pricing" className="inline-flex items-center gap-2 rounded-full border border-emerald-300/[0.18] bg-emerald-300/[0.06] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-100 transition hover:border-emerald-300/[0.30] hover:text-white">Review packages</Link>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <article className="rounded-[1.9rem] border border-velmere-gold/[0.14] bg-velmere-gold/[0.045] p-6 md:p-8" data-pass1654-lens-pdf-full-payload="sections-findings-appendix">
            <FileText className="h-5 w-5 text-velmere-gold" />
            <h2 className="mt-4 font-serif text-4xl tracking-[-0.05em]">Lens PDF payload</h2>
            <div className="mt-5 grid gap-3">
              {payload.pdf.executiveSummary.map((line) => (
                <p key={line} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-sm leading-7 text-white/[0.62]">{line}</p>
              ))}
            </div>
            <div className="mt-6 grid gap-3">
              {payload.pdf.sections.map((section) => (
                <section key={section.id} className="rounded-[1.35rem] border border-white/[0.10] bg-black/[0.18] p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-velmere-gold">{section.redaction}</p>
                  <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white">{section.title}</h3>
                  <p className="mt-2 text-xs leading-6 text-white/[0.55]">{section.body}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {section.bullets.slice(0, 6).map((bullet) => (
                      <span key={bullet} className="rounded-full border border-white/[0.10] bg-white/[0.025] px-3 py-1.5 text-[11px] text-white/[0.50]">{bullet}</span>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>

          <article className="rounded-[1.9rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-6 md:p-8" data-pass1654-shield-map-full-payload="nodes-edges-verdict">
            <Network className="h-5 w-5 text-cyan-100" />
            <h2 className="mt-4 font-serif text-4xl tracking-[-0.05em]">{payload.shieldMap.title}</h2>
            <p className="mt-3 text-sm leading-7 text-white/[0.58]">{payload.shieldMap.verdict} · evidence coverage {payload.shieldMap.evidenceCoverage}%</p>
            <div className="mt-6 grid gap-3">
              {payload.shieldMap.nodes.map((node) => (
                <div key={node.id} className={`rounded-[1.35rem] border p-4 ${nodeTone[node.tone]}`}>
                  <p className="font-mono text-[9px] uppercase tracking-[0.15em] opacity-70">{node.type}</p>
                  <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em]">{node.label}</h3>
                  <p className="mt-2 text-xs leading-6 opacity-75">{node.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-[1.35rem] border border-white/[0.10] bg-black/[0.18] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/[0.38]">edges</p>
              <div className="mt-3 grid gap-2">
                {payload.shieldMap.edges.map((edge) => (
                  <p key={`${edge.from}-${edge.to}-${edge.label}`} className="text-xs leading-6 text-white/[0.55]">{edge.from} → {edge.to} · {edge.label}</p>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
          <article className="rounded-[1.9rem] border border-white/[0.09] bg-white/[0.025] p-6 md:p-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-100">findings export</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {payload.pdf.findings.map((finding) => (
                <div key={finding.id} className="rounded-[1.35rem] border border-white/[0.10] bg-black/[0.18] p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-velmere-gold">{finding.severity} · {finding.disclosure}</p>
                  <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white">{finding.title}</h3>
                  <p className="mt-2 text-xs leading-6 text-white/[0.55]">{finding.publicSummary}</p>
                  <p className="mt-3 text-xs leading-6 text-white/[0.42]">{finding.lensAnchor} · {finding.mapAnchor}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-[1.9rem] border border-rose-200/[0.12] bg-rose-300/[0.035] p-6 md:p-8">
            <LockKeyhole className="h-5 w-5 text-rose-100" />
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Release gate</h2>
            <div className="mt-5 grid gap-3">
              {payload.pdf.appendix.concat(payload.pdf.forbiddenClaims.map((claim) => `Blocked: ${claim}`)).map((line) => (
                <p key={line} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.58]">{line}</p>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
