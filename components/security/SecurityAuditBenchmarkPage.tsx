import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  FileSearch,
  Gauge,
  Layers3,
  LockKeyhole,
  Network,
  Radar,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "@/navigation";
import {
  buildAuditBenchmarkPage,
  PASS1854_AUDIT_PAGE_BENCHMARK_ID,
  type AuditBenchmarkTone,
} from "@/lib/security/audit-page-benchmark";

const toneClass: Record<AuditBenchmarkTone, string> = {
  gold: "border-velmere-gold/[0.18] bg-velmere-gold/[0.055] text-velmere-gold",
  cyan: "border-cyan-200/[0.16] bg-cyan-300/[0.045] text-cyan-100",
  emerald: "border-emerald-300/[0.16] bg-emerald-300/[0.045] text-emerald-100",
  amber: "border-amber-300/[0.16] bg-amber-300/[0.045] text-amber-100",
  rose: "border-rose-300/[0.16] bg-rose-300/[0.045] text-rose-100",
  neutral: "border-white/[0.10] bg-white/[0.025] text-white/[0.66]",
};

export default function SecurityAuditBenchmarkPage({ locale }: { locale: string }) {
  const benchmark = buildAuditBenchmarkPage(locale);

  return (
    <main
      className="velmere-public-page min-h-screen bg-velmere-black px-5 pb-24 pt-28 text-white md:px-10 md:pt-36"
      data-pass1854-audit-benchmark-page={PASS1854_AUDIT_PAGE_BENCHMARK_ID}
      data-pass1854-task-count={benchmark.taskCount}
      data-pass1854-no-fake-client-logos={String(benchmark.releaseGate.noFakeClientLogos)}
      data-pass1854-no-certified-safe={String(benchmark.releaseGate.noCertifiedSafe)}
    >
      <section className="mx-auto max-w-6xl">
        <Link
          href="/security/audits"
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/[0.66] transition hover:border-white/[0.22] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Audit Watch
        </Link>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_24rem] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.07] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.17em] text-velmere-gold">
              <Sparkles className="h-4 w-4" />
              {benchmark.eyebrow}
            </p>
            <h1 className="mt-6 max-w-5xl font-serif text-5xl leading-[0.95] tracking-[-0.06em] md:text-7xl">
              {benchmark.title}
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/[0.62]">{benchmark.subtitle}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/security/audits#review-console"
                className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.28] bg-velmere-gold/[0.10] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-velmere-gold transition hover:bg-velmere-gold/[0.16]"
              >
                {benchmark.primaryCta}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/security/audits/sample"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.16] bg-cyan-300/[0.045] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:border-cyan-200/[0.28] hover:text-white"
              >
                Sample report
              </Link>
              <Link
                href="/security/audits/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white/[0.70] transition hover:border-white/[0.22] hover:text-white"
              >
                Review packages
              </Link>
            </div>
          </div>

          <aside className="rounded-[1.8rem] border border-velmere-gold/[0.14] bg-[linear-gradient(145deg,rgba(212,175,55,.10),rgba(255,255,255,.025),rgba(0,0,0,.28))] p-5 shadow-velmere-card">
            <ShieldCheck className="h-5 w-5 text-velmere-gold" />
            <h2 className="mt-4 text-xl font-semibold tracking-[-0.035em]">Velmère standard</h2>
            <div className="mt-4 grid gap-2">
              {benchmark.reportSections.slice(0, 5).map((section) => (
                <p key={section} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] px-3 py-2 text-xs leading-6 text-white/[0.58]">
                  {section}
                </p>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-10 rounded-[1.9rem] border border-white/[0.09] bg-white/[0.025] p-6 md:p-8" data-pass1854-benchmark-sources="elite-audit-page-patterns-not-copied">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">{benchmark.sourceTitle}</p>
              <h2 className="mt-3 font-serif text-4xl tracking-[-0.05em]">Audit page architecture</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/[0.58]">{benchmark.sourceBody}</p>
            </div>
            <BadgeCheck className="h-8 w-8 text-velmere-gold/70" />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {benchmark.references.map((reference) => (
              <article key={reference.id} className={`rounded-[1.5rem] border p-5 ${toneClass[reference.tone]}`}>
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] opacity-70">benchmark pattern</p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.035em]">{reference.name}</h3>
                <p className="mt-3 text-xs leading-6 opacity-75">{reference.pattern}</p>
                <p className="mt-4 rounded-2xl border border-white/[0.10] bg-black/[0.18] p-3 text-xs leading-6 opacity-75">
                  {reference.velmereAdaptation}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          <article className="rounded-[1.9rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-6 md:p-8" data-pass1854-pipeline="submit-scope-evidence-findings-report">
            <Network className="h-5 w-5 text-cyan-100" />
            <h2 className="mt-4 font-serif text-4xl tracking-[-0.05em]">{benchmark.pipelineTitle}</h2>
            <p className="mt-4 text-sm leading-7 text-white/[0.58]">{benchmark.pipelineBody}</p>
            <div className="mt-6 grid gap-3">
              {benchmark.pipeline.map((step, index) => (
                <div key={step.id} className="grid gap-3 rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 md:grid-cols-[3rem_1fr]">
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-cyan-200/[0.14] bg-cyan-300/[0.06] font-mono text-[10px] text-cyan-100">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">{step.label}</h3>
                    <p className="mt-2 text-xs leading-6 text-white/[0.54]">{step.body}</p>
                    <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-velmere-gold">{step.proof}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <aside className="rounded-[1.9rem] border border-velmere-gold/[0.12] bg-velmere-gold/[0.04] p-6 md:p-8" data-pass1854-scorecard="scope-freshness-admin-disclosure-confidence">
            <Gauge className="h-5 w-5 text-velmere-gold" />
            <h2 className="mt-4 font-serif text-4xl tracking-[-0.05em]">{benchmark.scorecardTitle}</h2>
            <p className="mt-4 text-sm leading-7 text-white/[0.58]">{benchmark.scorecardBody}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {benchmark.metrics.map((metric) => (
                <div key={metric.id} className={`rounded-[1.35rem] border p-4 ${toneClass[metric.tone]}`}>
                  <p className="font-mono text-[9px] uppercase tracking-[0.15em] opacity-70">{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.055em]">{metric.value}</p>
                  <p className="mt-2 text-xs leading-6 opacity-75">{metric.body}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
          <article className="rounded-[1.9rem] border border-white/[0.09] bg-white/[0.025] p-6 md:p-8" data-pass1854-report-outline="public-report-product-not-flat-copy">
            <FileSearch className="h-5 w-5 text-velmere-gold" />
            <h2 className="mt-4 font-serif text-4xl tracking-[-0.05em]">{benchmark.reportTitle}</h2>
            <p className="mt-4 text-sm leading-7 text-white/[0.58]">{benchmark.reportBody}</p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {benchmark.reportSections.map((section) => (
                <p key={section} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.56]">
                  {section}
                </p>
              ))}
            </div>
          </article>

          <aside className="grid gap-4">
            <div className="rounded-[1.6rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-5">
              <Radar className="h-5 w-5 text-cyan-100" />
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em]">Audit Watch</h3>
              <p className="mt-3 text-sm leading-7 text-white/[0.54]">
                Public status, report ID, Lens export and Shield Map are the core product loop.
              </p>
            </div>
            <div className="rounded-[1.6rem] border border-white/[0.10] bg-white/[0.025] p-5">
              <Layers3 className="h-5 w-5 text-velmere-gold" />
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em]">Premium layout rule</h3>
              <p className="mt-3 text-sm leading-7 text-white/[0.54]">
                One hero, one methodology, one scorecard, one report flow. No noisy duplicate panels.
              </p>
            </div>
          </aside>
        </section>

        <section className="mt-8 grid gap-5 rounded-[1.9rem] border border-rose-200/[0.12] bg-rose-300/[0.035] p-6 md:grid-cols-[minmax(0,.72fr)_minmax(0,1.28fr)] md:p-8">
          <div>
            <Scale className="h-5 w-5 text-rose-100" />
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">{benchmark.boundaryTitle}</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {benchmark.boundaries.map((boundary) => (
              <p key={boundary} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.56]">
                {boundary}
              </p>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[1.9rem] border border-velmere-gold/[0.14] bg-[linear-gradient(145deg,rgba(212,175,55,.08),rgba(255,255,255,.025),rgba(0,0,0,.24))] p-6 md:p-8">
          <LockKeyhole className="h-5 w-5 text-velmere-gold" />
          <h2 className="mt-4 font-serif text-4xl tracking-[-0.05em]">Ready for Velmère implementation</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/[0.58]">
            This benchmark page is the design spine for Audit Watch: the main page, pricing page, sample report and export view must follow the same calm premium structure.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/security/audits#review-console" className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.24] bg-velmere-gold/[0.09] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-velmere-gold transition hover:bg-velmere-gold/[0.16]">
              {benchmark.primaryCta}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/security/audits/sample" className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white/[0.70] transition hover:border-white/[0.22] hover:text-white">
              Sample report
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
