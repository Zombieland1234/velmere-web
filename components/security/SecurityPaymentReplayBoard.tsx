import { CreditCard, FileText, RadioTower, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { buildPass2365AdminReplayBoard, PASS2365_ADMIN_REPLAY_BOARD_ID } from "@/lib/security/admin-replay-board";
import SecurityPaymentReplayEvidenceClient from "@/components/security/SecurityPaymentReplayEvidenceClient";
import SecurityPaymentEvidenceLiveRowsClient from "@/components/security/SecurityPaymentEvidenceLiveRowsClient";

/* eslint-disable @next/next/no-html-link-for-pages -- These native anchors intentionally request JSON API documents; Next page routing is not appropriate for the targets. */

function statusTone(status: string) {
  if (status === "blocked") return "border-rose-300/[0.18] bg-rose-300/[0.05] text-rose-100";
  if (status === "ready_for_staging_evidence" || status === "pass") return "border-emerald-300/[0.18] bg-emerald-300/[0.05] text-emerald-100";
  if (status === "manual") return "border-cyan-200/[0.16] bg-cyan-300/[0.045] text-cyan-100";
  return "border-amber-300/[0.16] bg-amber-300/[0.045] text-amber-100";
}

export default function SecurityPaymentReplayBoard({ locale }: { locale: string }) {
  const board = buildPass2365AdminReplayBoard(locale);

  return (
    <section className="mt-8 rounded-[1.8rem] border border-cyan-200/[0.14] bg-cyan-300/[0.035] p-5 shadow-velmere-card" data-admin-replay-board={PASS2365_ADMIN_REPLAY_BOARD_ID}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.18] bg-black/[0.18] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.17em] text-cyan-100">
            <RotateCcw className="h-4 w-4" /> Payment replay board
          </p>
          <h2 className="mt-4 max-w-4xl text-3xl font-semibold tracking-[-0.05em] text-white md:text-4xl">Stripe Card / BLIK replay readiness and operator evidence cockpit.</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-white/[0.58]">
 This board connects payment rails to the admin console: card/BLIK readiness, VLM service entitlement replay, duplicate webhook protection, legacy Advanced analysis-queue proof, Durable evidence filters and safe operator evidence buttons.
 </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">status</p>
              <p className={`mt-2 inline-flex rounded-full border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] ${statusTone(board.status)}`}>{board.status}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">replay avg</p>
              <p className="mt-1 text-2xl text-white">{board.replayAverageProgress}%</p>
            </div>
            <div className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">evidence</p>
              <p className="mt-1 text-2xl text-white">{board.replayEvidenceCount}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">linked</p>
              <p className="mt-1 text-2xl text-white">{board.linkedEvidenceCount}</p>
            </div>
          </div>
          <div className="mt-4 rounded-[1.2rem] border border-white/[0.08] bg-black/[0.14] p-3" data-pass2366-evidence-filters="payment-evidence-filters">
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.34]">Durable evidence filters · linked Stripe refs: {board.stripeLinkedCount}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {board.evidenceFilters.map((filter) => (
                <a
                  key={filter.label}
                  href={filter.href}
                  title={filter.description}
                  className="rounded-full border border-cyan-200/[0.14] bg-cyan-300/[0.035] px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-100/[0.72] transition hover:border-cyan-200/[0.28] hover:text-cyan-100"
                >
                  {filter.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <aside className="rounded-[1.35rem] border border-white/[0.10] bg-black/[0.20] p-4">
          <div className="flex items-center gap-2 text-velmere-gold">
            <ShieldAlert className="h-4 w-4" />
            <p className="font-mono text-[9px] uppercase tracking-[0.16em]">safe evidence boundary</p>
          </div>
          <p className="mt-3 text-xs leading-6 text-white/[0.54]">{board.safeEvidenceBoundary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/api/security/stripe-webhook-replay-qa" className="rounded-full border border-white/[0.12] bg-white/[0.035] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-white/[0.58]">replay API</a>
            <a href="/api/checkout/vlm-service/readiness?paymentRail=stripe_checkout_card" className="rounded-full border border-white/[0.12] bg-white/[0.035] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-white/[0.58]">card readiness</a>
            <a href="/api/checkout/vlm-service/readiness?paymentRail=stripe_checkout_blik" className="rounded-full border border-white/[0.12] bg-white/[0.035] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-white/[0.58]">BLIK readiness</a>
          </div>
        </aside>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {board.rails.map((rail) => (
          <article key={rail.rail} className="rounded-[1.35rem] border border-white/[0.10] bg-black/[0.18] p-4" data-pass2365-payment-rail={rail.rail}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-100/[0.68]">
                  {rail.rail === "stripe_checkout_blik" ? <RadioTower className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                  {rail.label}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">{rail.readyProducts}/{rail.totalProducts} products session-ready</h3>
              </div>
              <span className={`rounded-full border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] ${rail.blockers.length ? statusTone("blocked") : statusTone("pass")}`}>{rail.averageProgress}%</span>
            </div>
            {rail.blockers.length ? (
              <div className="mt-4 grid gap-2">
                {rail.blockers.slice(0, 4).map((blocker) => (
                  <p key={blocker} className="rounded-2xl border border-rose-300/[0.12] bg-rose-300/[0.035] p-3 text-xs leading-6 text-rose-100/[0.70]">{blocker}</p>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-emerald-300/[0.12] bg-emerald-300/[0.04] p-3 text-xs leading-6 text-emerald-100/[0.70]">No blocker detected for this rail. Still record signed webhook and duplicate replay evidence before launch.</p>
            )}
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {rail.products.map((product) => (
                <div key={product.productId} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">
                  <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">{product.priceLabel}</p>
                  <p className="mt-2 line-clamp-2 text-xs font-semibold text-white/[0.72]">{product.label}</p>
                  <p className="mt-2 text-[10px] leading-5 text-white/[0.42]">{product.readiness.stripeLineCurrency.toUpperCase()} · {product.readiness.stripeLineAmount}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <section className="rounded-[1.35rem] border border-white/[0.10] bg-black/[0.18] p-4">
          <div className="flex items-center gap-2 text-velmere-gold">
            <ShieldCheck className="h-4 w-4" />
            <p className="font-mono text-[9px] uppercase tracking-[0.16em]">operator runbook</p>
          </div>
          <div className="mt-4 grid gap-2">
            {board.runbook.map((step, index) => (
              <p key={step} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 text-xs leading-6 text-white/[0.54]"><span className="mr-2 text-cyan-100/[0.70]">{String(index + 1).padStart(2, "0")}</span>{step}</p>
            ))}
          </div>
        </section>

        <section className="rounded-[1.35rem] border border-white/[0.10] bg-black/[0.18] p-4">
          <div className="flex items-center gap-2 text-cyan-100">
            <FileText className="h-4 w-4" />
            <p className="font-mono text-[9px] uppercase tracking-[0.16em]">launch blockers</p>
          </div>
          <div className="mt-4 grid gap-2">
            {board.operatorActions.map((action) => (
              <p key={action} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 text-xs leading-6 text-white/[0.54]">{action}</p>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6">
        <SecurityPaymentReplayEvidenceClient scenarios={board.scenarioFocus} />
      </div>

      <SecurityPaymentEvidenceLiveRowsClient locale={locale} scenarioOptions={board.scenarioFocus.map((scenario) => ({ id: scenario.id, label: scenario.label }))} />
    </section>
  );
}
