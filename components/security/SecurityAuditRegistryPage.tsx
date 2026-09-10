import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Database,
  FileSearch,
  Gauge,
  LockKeyhole,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "@/navigation";
import {
  buildAuditRegistryDashboard,
  PASS1894_AUDIT_PUBLIC_REGISTRY_ID,
  type AuditRegistryTone,
} from "@/lib/security/audit-public-registry";

const toneClass: Record<AuditRegistryTone, string> = {
  gold: "border-velmere-gold/[0.18] bg-velmere-gold/[0.055] text-velmere-gold",
  cyan: "border-cyan-200/[0.16] bg-cyan-300/[0.045] text-cyan-100",
  emerald: "border-emerald-300/[0.16] bg-emerald-300/[0.045] text-emerald-100",
  amber: "border-amber-300/[0.16] bg-amber-300/[0.045] text-amber-100",
  rose: "border-rose-300/[0.16] bg-rose-300/[0.045] text-rose-100",
  neutral: "border-white/[0.10] bg-white/[0.025] text-white/[0.66]",
};

export default function SecurityAuditRegistryPage({
  locale,
  query = "",
  status = "all",
  sort = "evidence",
}: {
  locale: string;
  query?: string;
  status?: string;
  sort?: "evidence" | "confidence" | "freshness" | "admin" | "severity";
}) {
  const registry = buildAuditRegistryDashboard(locale, query, status, sort);

  return (
    <main
      className="velmere-public-page min-h-screen bg-velmere-black px-5 pb-24 pt-28 text-white md:px-10 md:pt-36"
      data-pass1894-audit-registry-page={PASS1894_AUDIT_PUBLIC_REGISTRY_ID}
      data-pass1894-task-count={registry.taskCount}
      data-pass1894-no-certified-safe={String(registry.releaseGate.noCertifiedSafe)}
      data-pass1894-no-public-exploit-instructions={String(registry.releaseGate.noPublicExploitInstructions)}
    >
      <section className="mx-auto max-w-7xl">
        <Link
          href="/security/audits"
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/[0.66] transition hover:border-white/[0.22] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Audit Watch
        </Link>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_24rem] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.07] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.17em] text-velmere-gold">
              <Database className="h-4 w-4" />
              {registry.eyebrow}
            </p>
            <h1 className="mt-6 max-w-5xl font-serif text-5xl leading-[0.95] tracking-[-0.06em] md:text-7xl">
              {registry.title}
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/[0.62]">{registry.subtitle}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/security/audits#review-console"
                className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.28] bg-velmere-gold/[0.10] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-velmere-gold transition hover:bg-velmere-gold/[0.16]"
              >
                Request review
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/security/audits/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-emerald-300/[0.16] bg-emerald-300/[0.045] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-100 transition hover:border-emerald-300/[0.28] hover:text-white"
              >
                Review packages
              </Link>
              <Link
                href="/security/audits/benchmark"
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white/[0.70] transition hover:border-white/[0.22] hover:text-white"
              >
                Elite benchmark
              </Link>
            </div>
          </div>

          <aside className="rounded-[1.8rem] border border-cyan-200/[0.14] bg-cyan-300/[0.04] p-5 shadow-velmere-card">
            <Gauge className="h-5 w-5 text-cyan-100" />
            <h2 className="mt-4 text-xl font-semibold tracking-[-0.035em]">{registry.scoreboardTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-white/[0.56]">{registry.scoreboardBody}</p>
            <div className="mt-5 grid gap-2">
              {registry.metrics.map((metric) => (
                <div key={metric.id} className={`rounded-2xl border px-3 py-2 ${toneClass[metric.tone]}`}>
                  <p className="font-mono text-[9px] uppercase tracking-[0.15em] opacity-70">{metric.label}</p>
                  <p className="mt-1 text-xl font-semibold tracking-[-0.04em]">{metric.value}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-10 rounded-[1.9rem] border border-white/[0.09] bg-white/[0.025] p-5 md:p-6" data-pass1894-registry-search="query-status-sort">
          <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_12rem_auto]" action="" method="get">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/[0.34]" />
              <input
                name="q"
                defaultValue={query}
                placeholder={registry.searchPlaceholder}
                className="h-12 w-full rounded-full border border-white/[0.12] bg-black/[0.22] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/[0.28] focus:border-velmere-gold/[0.45]"
              />
            </label>
            <select
              name="status"
              defaultValue={status}
              className="h-12 rounded-full border border-white/[0.12] bg-black/[0.55] px-4 text-xs font-bold uppercase tracking-[0.12em] text-white/[0.70] outline-none focus:border-velmere-gold/[0.45]"
            >
              {registry.filters.map((filter) => (
                <option key={filter.id} value={filter.id}>
                  {filter.label}
                </option>
              ))}
            </select>
            <select
              name="sort"
              defaultValue={sort}
              className="h-12 rounded-full border border-white/[0.12] bg-black/[0.55] px-4 text-xs font-bold uppercase tracking-[0.12em] text-white/[0.70] outline-none focus:border-velmere-gold/[0.45]"
            >
              <option value="evidence">evidence coverage</option>
              <option value="freshness">freshness</option>
              <option value="admin">admin risk</option>
              <option value="severity">severity</option>
            </select>
            <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-velmere-gold/[0.28] bg-velmere-gold/[0.10] px-5 text-xs font-black uppercase tracking-[0.16em] text-velmere-gold transition hover:bg-velmere-gold/[0.16]" data-pass1977-filter-submit="explicit">
              <SlidersHorizontal className="h-4 w-4" />
              Filter
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-[1.9rem] border border-white/[0.09] bg-white/[0.025] p-6 md:p-8" data-pass1894-registry-listing="public-report-export-links">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">{registry.listingTitle}</p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/[0.58]">{registry.listingBody}</p>
            </div>
            <BadgeCheck className="h-8 w-8 text-velmere-gold/70" />
          </div>

          <div className="mt-6 grid gap-4">
            {registry.projects.length ? registry.projects.map((project, index) => (
              <article
                key={project.id}
                className="grid gap-4 rounded-[1.55rem] border border-white/[0.10] bg-black/[0.18] p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.75fr)_minmax(0,.75fr)]"
                data-pass1894-registry-record={project.status}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.10] bg-white/[0.035] font-mono text-[10px] text-white/[0.54]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={`rounded-full border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] ${toneClass[project.statusTone]}`}>
                      {project.statusLabel}
                    </span>
                    <span className="rounded-full border border-white/[0.10] bg-white/[0.025] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.42]">
                      {project.chain} · {project.category}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-[-0.045em] text-white">{project.projectName}</h2>
                  <p className="mt-3 text-sm leading-7 text-white/[0.56]">{project.auditClaim}</p>
                  <p className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 text-xs leading-6 text-white/[0.48]">{project.evidenceSummary}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-2xl border border-white/[0.10] bg-white/[0.025] p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.38]">evidence coverage</p>
                    <p className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-white">{project.evidenceCoverage}%</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.10] bg-white/[0.025] p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.38]">badge language</p>
                    <p className="mt-2 text-sm font-semibold text-velmere-gold">{project.badgeLanguage}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.10] bg-white/[0.025] p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.38]">admin risk</p>
                    <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">{project.adminControlRisk}/100</p>
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-4">
                  <div className="grid gap-2">
                    {project.missingEvidence.slice(0, 3).map((item) => (
                      <span key={item} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[11px] leading-5 text-white/[0.50]">
                        missing: {item}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs leading-6 text-white/[0.52]">{project.nextAction}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={project.publicReportRoute.replace(`/${registry.locale}`, "")}
                      className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.16] bg-cyan-300/[0.045] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100 transition hover:text-white"
                    >
                      Status
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={project.exportRoute.replace(`/${registry.locale}`, "")}
                      className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.08] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-velmere-gold transition hover:bg-velmere-gold/[0.13]"
                    >
                      Export
                    </Link>
                  </div>
                </div>
              </article>
            )) : (
              <div className="rounded-[1.45rem] border border-white/[0.10] bg-black/[0.18] p-8 text-center text-sm text-white/[0.58]">
                {registry.noResultCopy}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
          <article className="rounded-[1.9rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-6 md:p-8" data-pass1894-methodology="scope-freshness-admin-publication">
            <ShieldCheck className="h-5 w-5 text-cyan-100" />
            <h2 className="mt-4 font-serif text-4xl tracking-[-0.05em]">Registry methodology</h2>
            <div className="mt-6 grid gap-3">
              {registry.methodology.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4">
                  <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">{item.label}</h3>
                  <p className="mt-2 text-xs leading-6 text-white/[0.54]">{item.body}</p>
                </div>
              ))}
            </div>
          </article>

          <aside className="rounded-[1.9rem] border border-rose-200/[0.12] bg-rose-300/[0.035] p-6 md:p-8" data-pass1894-publication-boundary="no-certified-safe-no-exploit">
            <LockKeyhole className="h-5 w-5 text-rose-100" />
            <h2 className="mt-4 font-serif text-4xl tracking-[-0.05em]">Public boundary</h2>
            <p className="mt-4 text-sm leading-7 text-white/[0.58]">
              Registry pokazuje status, evidence coverage, missing evidence i rekomendacje. Nie pokazuje exploit steps, nie daje porad inwestycyjnych i nie używa języka Certified Safe / No Risk.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {["No Certified Safe", "No No Risk", "No Investment Advice", "No public exploit instructions"].map((item) => (
                <p key={item} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[10px] uppercase tracking-[0.14em] text-rose-100">
                  {item}
                </p>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-8 rounded-[1.9rem] border border-velmere-gold/[0.12] bg-velmere-gold/[0.04] p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <FileSearch className="h-5 w-5 text-velmere-gold" />
              <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Need your project checked?</h2>
              <p className="mt-3 text-sm leading-7 text-white/[0.56]">Submit contract, public audit URL and docs. Velmère will route it as Free Scan, Review Desk or private disclosure.</p>
            </div>
            <Link href="/security/audits#review-console" className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.28] bg-velmere-gold/[0.10] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-velmere-gold transition hover:bg-velmere-gold/[0.16]">
              Submit review
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
