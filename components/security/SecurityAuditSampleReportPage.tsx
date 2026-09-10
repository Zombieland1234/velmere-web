import { ArrowLeft, BadgeCheck, FileText, LockKeyhole, Network, ShieldAlert, ShieldCheck } from "lucide-react";
import { Link } from "@/navigation";
import {
  buildAuditSampleReport,
  PASS1574_AUDIT_SAMPLE_REPORT_ID,
} from "@/lib/security/audit-sample-report";

const verdictToneClass = {
  good: "border-emerald-300/[0.18] bg-emerald-300/[0.055] text-emerald-100",
  warn: "border-amber-300/[0.18] bg-amber-300/[0.055] text-amber-100",
  danger: "border-rose-300/[0.18] bg-rose-300/[0.055] text-rose-100",
  neutral: "border-cyan-200/[0.16] bg-cyan-300/[0.045] text-cyan-100",
} as const;

const severityClass = {
  info: "border-cyan-200/[0.12] bg-cyan-300/[0.035] text-cyan-100",
  low: "border-emerald-300/[0.12] bg-emerald-300/[0.035] text-emerald-100",
  medium: "border-amber-300/[0.14] bg-amber-300/[0.045] text-amber-100",
  high: "border-rose-300/[0.16] bg-rose-300/[0.055] text-rose-100",
  critical: "border-rose-400/[0.20] bg-rose-500/[0.075] text-rose-100",
} as const;

export default function SecurityAuditSampleReportPage({ locale }: { locale: string }) {
  const report = buildAuditSampleReport(locale);

  return (
    <main
      className="velmere-public-page min-h-screen bg-velmere-black px-5 pb-24 pt-28 text-white md:px-10 md:pt-36"
      data-audit-sample-report={PASS1574_AUDIT_SAMPLE_REPORT_ID}
      data-pass1574-task-count={report.taskCount}
      data-pass1574-no-certified-safe={String(report.releaseGate.noCertifiedSafe)}
    >
      <section className="mx-auto max-w-6xl">
        <Link
          href="/security/audits"
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/[0.66] transition hover:border-white/[0.22] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {report.hero.secondaryCta}
        </Link>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_24rem] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.07] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.17em] text-velmere-gold">
              <FileText className="h-4 w-4" />
              {report.hero.eyebrow}
            </p>
            <h1 className="mt-6 max-w-5xl font-serif text-5xl leading-[0.95] tracking-[-0.06em] md:text-7xl">
              {report.hero.title}
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/[0.62]">{report.hero.subtitle}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#sample-report"
                className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.28] bg-velmere-gold/[0.10] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-velmere-gold transition hover:bg-velmere-gold/[0.16]"
              >
                {report.hero.primaryCta}
              </a>
              <Link
                href="/security/audits#review-console"
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white/[0.70] transition hover:border-white/[0.22] hover:text-white"
              >
                {report.requestConsole.title}
              </Link>
            </div>
          </div>

          <aside className={`rounded-[1.8rem] border p-5 shadow-velmere-card ${verdictToneClass[report.verdict.tone]}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] opacity-70">verdict</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{report.verdict.label}</h2>
              </div>
              <ShieldAlert className="h-6 w-6 opacity-80" />
            </div>
            <p className="mt-4 text-sm leading-7 opacity-75">{report.verdict.body}</p>
            <div className="mt-5 rounded-2xl border border-white/[0.12] bg-black/[0.18] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] opacity-60">evidence coverage</p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.06em]">{report.verdict.evidenceCoverage}%</p>
            </div>
          </aside>
        </section>

        <section id="sample-report" className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
          <article className="rounded-[1.9rem] border border-white/[0.09] bg-white/[0.025] p-6 md:p-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">{report.reportId}</p>
            <h2 className="mt-4 font-serif text-4xl leading-none tracking-[-0.05em]">Executive summary</h2>
            <div className="mt-6 grid gap-3">
              {report.sections.executiveSummary.map((item) => (
                <p key={item} className="rounded-2xl border border-white/[0.09] bg-black/[0.18] p-4 text-sm leading-7 text-white/[0.60]">
                  {item}
                </p>
              ))}
            </div>
          </article>

          <aside className="grid gap-4">
            <div className="rounded-[1.6rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-5">
              <FileText className="h-5 w-5 text-velmere-gold" />
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em]">Lens PDF outline</h3>
              <div className="mt-4 grid gap-2">
                {report.sections.lensPdfOutline.map((item) => (
                  <p key={item} className="rounded-2xl border border-white/[0.08] bg-black/[0.16] px-3 py-2 text-xs leading-6 text-white/[0.56]">
                    {item}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-[1.6rem] border border-white/[0.10] bg-white/[0.025] p-5">
              <Network className="h-5 w-5 text-cyan-100" />
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em]">Shield Map flow</h3>
              <p className="mt-3 text-sm leading-7 text-white/[0.52]">{report.sections.shieldMapFlow.join("  ·  ")}</p>
            </div>
          </aside>
        </section>

        <section className="mt-8 rounded-[1.9rem] border border-white/[0.09] bg-white/[0.025] p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-100">Findings table</p>
              <h2 className="mt-3 font-serif text-4xl tracking-[-0.05em]">Evidence, severity, recommendation</h2>
            </div>
            <div className="rounded-full border border-white/[0.10] bg-black/[0.18] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.48]">
              no public exploit detail
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {report.findings.map((finding) => (
              <article key={finding.id} className={`rounded-[1.45rem] border p-4 ${severityClass[finding.severity]}`} data-finding-id={finding.id}>
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] opacity-70">{finding.severity} · {finding.privateHandling}</p>
                <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em]">{finding.title}</h3>
                <p className="mt-3 text-xs leading-6 opacity-75">{finding.evidence}</p>
                <p className="mt-3 rounded-2xl border border-white/[0.10] bg-black/[0.16] p-3 text-xs leading-6 opacity-75">{finding.recommendation}</p>
                <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] opacity-55">{finding.lensAnchor} · {finding.mapAnchor}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)]">
          <article className="rounded-[1.9rem] border border-rose-200/[0.12] bg-rose-300/[0.035] p-6 md:p-8">
            <LockKeyhole className="h-5 w-5 text-rose-100" />
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Disclosure rules</h2>
            <div className="mt-5 grid gap-3">
              {report.sections.disclosureRules.map((rule) => (
                <p key={rule} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.58]">
                  {rule}
                </p>
              ))}
            </div>
          </article>
          <article className="rounded-[1.9rem] border border-velmere-gold/[0.14] bg-velmere-gold/[0.045] p-6 md:p-8">
            <BadgeCheck className="h-5 w-5 text-velmere-gold" />
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Safe badge language</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {report.sections.buyerSafeLanguage.map((badge) => (
                <span key={badge} className="rounded-full border border-white/[0.10] bg-black/[0.18] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.58]">
                  {badge}
                </span>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-pass1574-review-packages="free-basic-pro-advanced">
          {report.packages.map((tier) => (
            <article key={tier.id} className="rounded-[1.55rem] border border-white/[0.10] bg-black/[0.18] p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-velmere-gold">{tier.eyebrow}</p>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.035em] text-white">{tier.label}</h3>
              <p className="mt-3 text-xs leading-6 text-white/[0.54]">{tier.body}</p>
              <div className="mt-4 grid gap-2">
                {tier.deliverables.map((deliverable) => (
                  <span key={deliverable} className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[11px] text-white/[0.50]">
                    {deliverable}
                  </span>
                ))}
              </div>
              <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.36]">{tier.boundary}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-[1.9rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-6 md:p-8">
          <ShieldCheck className="h-5 w-5 text-cyan-100" />
          <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">{report.requestConsole.title}</h2>
          <p className="mt-4 text-sm leading-7 text-white/[0.58]">{report.requestConsole.body}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {report.requestConsole.requiredInputs.map((input) => (
              <p key={input} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.56]">
                {input}
              </p>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
