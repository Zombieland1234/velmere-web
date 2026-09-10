import Link from "next/link";
import type { PublishedPublicProof } from "@/lib/market-integrity/public-proof-publication-resolver";
import { buildPublicVerifyRecordViewModel } from "@/lib/market-integrity/public-verify-record-view-model";

export default function PublicVerifyRecord({
  proof,
  mode,
}: {
  proof: PublishedPublicProof;
  mode: "summary" | "technical";
}) {
  const view = buildPublicVerifyRecordViewModel(proof, mode);
  return (
    <main className="min-h-screen bg-velmere-black px-5 py-16 text-white md:px-10">
      <article className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/[0.025] p-6 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">Velmère Verify</p>
            <h1 className="mt-4 font-serif text-4xl tracking-[-0.04em] md:text-6xl">
              {view.projectLabel}
            </h1>
          </div>
          <span className={`rounded-full border px-4 py-2 font-mono text-[10px] font-bold tracking-[0.12em] ${view.green ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : "border-amber-200/25 bg-amber-200/[0.07] text-amber-50"}`}>
            {view.statusLabel}
          </span>
        </div>

        {/* The optimizer may cache a previous green SVG. This status image must hit the no-store route. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={view.badge.src}
          alt={view.badge.alt}
          width={420}
          height={76}
          className="mt-8 h-auto max-w-full"
        />

        <dl className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <dt className="text-xs uppercase tracking-[0.12em] text-white/45">Chain ID</dt>
            <dd className="mt-2 font-mono text-sm">{proof.chainId}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <dt className="text-xs uppercase tracking-[0.12em] text-white/45">Contract address</dt>
            <dd className="mt-2 break-all font-mono text-sm">{proof.contractAddress}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <dt className="text-xs uppercase tracking-[0.12em] text-white/45">Risk status</dt>
            <dd className="mt-2 text-sm">{view.riskLabel}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <dt className="text-xs uppercase tracking-[0.12em] text-white/45">Last deployment check</dt>
            <dd className="mt-2 text-sm"><time dateTime={proof.lastCheckedAt}>{proof.lastCheckedAt}</time></dd>
          </div>
        </dl>

        <section className="mt-8 rounded-2xl border border-white/10 p-5">
          {view.report.contextHeading ? (
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-amber-100">
              {view.report.contextHeading}
            </p>
          ) : null}
          <h2 className="text-xl font-semibold">{proof.reportTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-white/70">{proof.publicSummary}</p>
          {view.report.contextBody ? (
            <p className="mt-4 text-xs leading-6 text-amber-50/70">
              {view.report.contextBody}
            </p>
          ) : view.report.currentDigest ? (
            <p className="mt-4 break-all font-mono text-[10px] text-white/45">Report SHA-256 · {view.report.currentDigest}</p>
          ) : (
            <p className="mt-4 text-xs text-white/45">{view.report.privateMessage}</p>
          )}
        </section>

        {view.technical ? (
          <dl className="mt-6 grid gap-3 rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.03] p-5 text-xs">
            <div><dt className="text-white/45">Audit version</dt><dd className="mt-1 font-mono">{proof.auditVersion}</dd></div>
            <div><dt className="text-white/45">Publication version</dt><dd className="mt-1 font-mono">{proof.publicationVersion}</dd></div>
            <div><dt className="text-white/45">Current deployment SHA-256</dt><dd className="mt-1 break-all font-mono">{proof.currentDeploymentDigest}</dd></div>
            <div><dt className="text-white/45">Head event SHA-256</dt><dd className="mt-1 break-all font-mono">{proof.headEventDigest}</dd></div>
            <div><dt className="text-white/45">Monitoring due</dt><dd className="mt-1 font-mono">{proof.monitorDueAt}</dd></div>
          </dl>
        ) : null}

        <nav className="mt-8 flex flex-wrap gap-3 text-sm" aria-label="Verify record links">
          <Link href={view.links.technical} className="rounded-full border border-white/15 px-4 py-2 hover:border-velmere-gold/50">Technical verification</Link>
          <Link href={view.links.history} className="rounded-full border border-white/15 px-4 py-2 hover:border-velmere-gold/50">Version history</Link>
          <Link href={view.links.search} className="rounded-full border border-white/15 px-4 py-2 hover:border-velmere-gold/50">Search Verify</Link>
        </nav>

        <p className="mt-8 border-t border-white/10 pt-5 text-xs leading-6 text-white/45">
          Verify confirms the recorded deployment identity and publication state. It is not a guarantee of safety, future behavior, or investment performance.
        </p>
      </article>
    </main>
  );
}
