import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Sparkles,
  FileText,
  LockKeyhole,
  RadioTower,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Link } from "@/navigation";
import {
  buildAuditBusinessFlow,
  type AuditBusinessTone,
} from "@/lib/security/audit-business-flow";
import { buildAuditBenchmarkPage } from "@/lib/security/audit-page-benchmark";
import ProVsAdvancedComparisonView from "@/components/security/ProVsAdvancedComparisonView";

const toneClass: Record<AuditBusinessTone, string> = {
  gold: "border-velmere-gold/[0.20] bg-velmere-gold/[0.07] text-velmere-gold",
  cyan: "border-cyan-200/[0.18] bg-cyan-300/[0.055] text-cyan-100",
  emerald: "border-emerald-300/[0.18] bg-emerald-300/[0.055] text-emerald-100",
  amber: "border-amber-300/[0.18] bg-amber-300/[0.055] text-amber-100",
  rose: "border-rose-300/[0.18] bg-rose-300/[0.055] text-rose-100",
  neutral: "border-white/[0.12] bg-white/[0.035] text-white/[0.70]",
};

export default function SecurityAuditPricingPage({ locale }: { locale: string }) {
  const business = buildAuditBusinessFlow(locale);
  const benchmark = buildAuditBenchmarkPage(locale);
  return (
    <main
      className="velmere-public-page min-h-screen bg-velmere-black px-5 pb-24 pt-28 text-white md:px-10 md:pt-36"
      data-audit-business-flow-page={business.passId}
      data-pass1694-task-count={business.taskCount}
      data-pass1694-no-certified-safe="true"
      data-pass1694-no-seed-custody="true"
      data-pass1854-pricing-benchmark="elite-layout-standard"
    >
      <section className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_24rem] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.07] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.17em] text-velmere-gold">
              <BadgeCheck className="h-4 w-4" />
              {business.eyebrow}
            </p>
            <h1 className="mt-6 max-w-5xl font-serif text-5xl leading-[0.95] tracking-[-0.06em] md:text-7xl">
              {business.title}
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/[0.62]">{business.body}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/security/audits#review-console" className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.28] bg-velmere-gold/[0.10] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-velmere-gold transition hover:bg-velmere-gold/[0.16]">
                Request review
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/security/audits/sample" className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.16] bg-cyan-300/[0.045] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:border-cyan-200/[0.28] hover:text-white">
                Sample report
              </Link>
              <Link href="/security/audits/benchmark" className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white/[0.70] transition hover:border-white/[0.22] hover:text-white">
                Elite benchmark
              </Link>
            </div>
          </div>

          <aside className="rounded-[1.8rem] border border-white/[0.10] bg-white/[0.025] p-5 shadow-velmere-card">
            <ShieldCheck className="h-5 w-5 text-velmere-gold" />
            <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em]">{business.reportIdTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-white/[0.56]">{business.reportIdBody}</p>
            <div className="mt-5 rounded-2xl border border-velmere-gold/[0.16] bg-velmere-gold/[0.055] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-velmere-gold">{business.sampleLead.requestId}</p>
              <p className="mt-2 text-xs leading-6 text-white/[0.58]">{business.sampleLead.route} · {business.sampleLead.priority}</p>
            </div>
          </aside>
        </div>

        <section className="mt-10 rounded-[1.9rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-6 md:p-8" data-pass1854-pricing-benchmark-strip="top-security-page-package-logic">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                <Sparkles className="h-4 w-4" />
                {benchmark.eyebrow}
              </p>
              <h2 className="mt-3 font-serif text-4xl tracking-[-0.05em]">Packages follow the elite audit-page pattern</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/[0.58]">{benchmark.scorecardBody}</p>
            </div>
            <Link href="/security/audits/benchmark" className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.18] bg-cyan-300/[0.055] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:border-cyan-200/[0.30] hover:text-white">
              View benchmark
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-5">
            {benchmark.metrics.map((metric) => (
              <div key={metric.id} className="rounded-2xl border border-white/[0.09] bg-black/[0.18] p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/[0.38]">{metric.label}</p>
                <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">{metric.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-[2rem] border border-velmere-gold/[0.14] bg-[linear-gradient(145deg,rgba(212,175,55,.08),rgba(255,255,255,.025),rgba(0,0,0,.25))] p-6 md:p-8" data-pass1694-pricing-lanes="free-basic-pro-advanced-disclosure">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">{business.pricingTitle}</p>
            <p className="mt-4 text-sm leading-7 text-white/[0.58]">{business.pricingBody}</p>
          </div>
          <div className="mt-7 grid gap-4 lg:grid-cols-5">
            {business.tiers.map((tier) => (
              <article key={tier.id} className={`rounded-[1.55rem] border p-4 ${toneClass[tier.tone]}`} data-pass1694-tier={tier.id}>
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] opacity-75">{tier.priceLabel}</p>
                <h2 className="mt-3 text-xl font-semibold tracking-[-0.035em]">{tier.label}</h2>
                <p className="mt-3 text-xs leading-6 opacity-75">{tier.caption}</p>
                <p className="mt-4 rounded-full border border-white/[0.12] bg-black/[0.18] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.13em] opacity-80">{tier.bestFor}</p>
                <div className="mt-4 grid gap-2">
                  {tier.deliverables.slice(0, 4).map((item) => (
                    <span key={item} className="rounded-2xl border border-white/[0.10] bg-black/[0.15] px-3 py-2 text-[11px] leading-5 opacity-80">{item}</span>
                  ))}
                </div>
                <p className="mt-4 text-[11px] leading-5 opacity-70">{tier.boundary}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12" id="pro-vs-advanced-comparison">
          <ProVsAdvancedComparisonView />
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
          <article className="rounded-[1.9rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-6 md:p-8" data-pass1694-lead-routing="review-desk-disclosure">
            <RadioTower className="h-5 w-5 text-cyan-100" />
            <h2 className="mt-4 font-serif text-4xl tracking-[-0.05em]">{business.routingTitle}</h2>
            <p className="mt-4 text-sm leading-7 text-white/[0.58]">{business.routingBody}</p>
            <div className="mt-5 grid gap-3">
              {business.sampleLead.nextOperatorActions.slice(0, 4).map((action) => (
                <p key={action} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.56]">{action}</p>
              ))}
            </div>
          </article>

          <article className="rounded-[1.9rem] border border-white/[0.09] bg-white/[0.025] p-6 md:p-8" data-pass1694-premium-checks="release-gate">
            <ClipboardCheck className="h-5 w-5 text-velmere-gold" />
            <h2 className="mt-4 font-serif text-4xl tracking-[-0.05em]">{business.premiumChecksTitle}</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {business.premiumChecks.map((check) => (
                <p key={check} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.56]">{check}</p>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-5 rounded-[1.9rem] border border-rose-200/[0.12] bg-rose-300/[0.035] p-6 md:grid-cols-[minmax(0,.75fr)_minmax(0,1.25fr)] md:p-8">
          <div>
            <Scale className="h-5 w-5 text-rose-100" />
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Blocked sales copy</h2>
            <p className="mt-3 text-sm leading-7 text-white/[0.56]">Velmère Review Desk może sprzedawać review, ale nie bezpieczeństwo absolutne. Te frazy są blokowane w produkcie.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {business.sampleLead.blockedSalesCopy.map((item) => (
              <p key={item} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[10px] uppercase tracking-[0.14em] text-rose-100">{item}</p>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 rounded-[1.9rem] border border-emerald-300/[0.12] bg-emerald-300/[0.035] p-6 md:grid-cols-3 md:p-8">
          <article>
            <FileText className="h-5 w-5 text-emerald-100" />
            <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em]">Lens export</h2>
            <p className="mt-3 text-sm leading-7 text-white/[0.52]">{business.sampleExport.pdf.title}</p>
          </article>
          <article>
            <ShieldCheck className="h-5 w-5 text-velmere-gold" />
            <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em]">Shield Map</h2>
            <p className="mt-3 text-sm leading-7 text-white/[0.52]">{business.sampleExport.shieldMap.title}</p>
          </article>
          <article>
            <LockKeyhole className="h-5 w-5 text-cyan-100" />
            <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em]">Safe lead capture</h2>
            <p className="mt-3 text-sm leading-7 text-white/[0.52]">{business.sampleLead.replyPromise}. No seed phrases, no custody and no active testing without authorization.</p>
          </article>
        </section>
      </section>
    </main>
  );
}
