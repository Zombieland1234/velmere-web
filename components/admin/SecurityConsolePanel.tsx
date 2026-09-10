import Link from "next/link";
import { AlertTriangle, Download, Eye, LockKeyhole, RadioTower, ShieldCheck } from "lucide-react";
import { buildDurableRateLimitReadiness } from "@/lib/security/durable-rate-limit";
import { buildSecurityAlertSnapshot } from "@/lib/security/security-alert-rules";
import { buildSecurityEventLedgerSnapshot } from "@/lib/security/security-event-ledger";
import { buildSecurityReadinessSnapshot } from "@/lib/security/security-readiness";
import { buildSecurityAdminGateReadiness } from "@/lib/security/security-admin-auth";
import { buildSecurityEventStoreSnapshot } from "@/lib/security/security-event-store-contract";
import { buildSecurityEventAppendReadiness } from "@/lib/security/security-event-append-adapter";
import { buildSecurityAdminAuditSnapshot } from "@/lib/security/security-admin-audit";
import { buildSecurityRuntimeQaSnapshot } from "@/lib/security/security-runtime-qa";
import { buildSecurityReleaseGateSnapshot } from "@/lib/security/security-release-gate";
import { buildPaymentWebhookSecuritySnapshot } from "@/lib/security/payment-webhook-security";
import { buildPaymentRuntimeEvidenceSnapshot } from "@/lib/security/payment-runtime-evidence";
import { buildStripeWebhookReplayQaSnapshot } from "@/lib/security/stripe-webhook-replay-qa";
import SecurityPaymentReplayBoard from "@/components/security/SecurityPaymentReplayBoard";

type Locale = "pl" | "de" | "en";

const copy = {
  pl: {
    eyebrow: "admin security console",
    title: "Centrum kontroli bezpieczeństwa przed publicznym ruchem.",
    body: "Ten panel zbiera headers, abuse shield, rate-limit provider, event ledger, alert rules i eksport. Widok jest ukryty za security admin gate, a API wymagają server-side tokenu.",
    readiness: "readiness",
    rate: "rate limit",
    events: "events",
    alerts: "alerts",
    blocked: "blocked",
    elevated: "elevated",
    review: "review",
    export: "safe export",
    openEvents: "events API",
    openAlerts: "alerts API",
    openStore: "event store",
    openAudit: "admin audit",
    runtimeQa: "runtime QA",
    releaseGate: "release gate",
    payment: "payment/webhook",
    paymentEvidence: "payment evidence",
    replayQa: "replay QA",
    boundary: "granica produkcyjna",
    next: "next action",
  },
  de: {
    eyebrow: "admin security console",
    title: "Security Kontrollzentrum vor öffentlichem Traffic.",
    body: "Dieses Panel bündelt Headers, Abuse Shield, Rate-Limit Provider, Event Ledger, Alert Rules und Export. Der View ist hinter Security Admin Gate, APIs benötigen serverseitigen Token.",
    readiness: "readiness",
    rate: "rate limit",
    events: "events",
    alerts: "alerts",
    blocked: "blocked",
    elevated: "elevated",
    review: "review",
    export: "safe export",
    openEvents: "events API",
    openAlerts: "alerts API",
    openStore: "event store",
    openAudit: "admin audit",
    runtimeQa: "runtime QA",
    releaseGate: "release gate",
    payment: "payment/webhook",
    paymentEvidence: "payment evidence",
    replayQa: "replay QA",
    boundary: "Produktionsgrenze",
    next: "next action",
  },
  en: {
    eyebrow: "admin security console",
    title: "Security control center before public traffic.",
    body: "This panel brings together headers, Abuse Shield, rate-limit provider, event ledger, alert rules and export. The view is hidden behind Security Admin Gate and APIs require a server-side token.",
    readiness: "readiness",
    rate: "rate limit",
    events: "events",
    alerts: "alerts",
    blocked: "blocked",
    elevated: "elevated",
    review: "review",
    export: "safe export",
    openEvents: "events API",
    openAlerts: "alerts API",
    openStore: "event store",
    openAudit: "admin audit",
    runtimeQa: "runtime QA",
    releaseGate: "release gate",
    payment: "payment/webhook",
    paymentEvidence: "payment evidence",
    replayQa: "replay QA",
    boundary: "production boundary",
    next: "next action",
  },
} as const;

function resolveLocale(locale: string): Locale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

function severityClass(severity: string) {
  if (severity === "critical") return "asc-severity-critical";
  if (severity === "elevated") return "asc-severity-elevated";
  if (severity === "review") return "asc-severity-review";
  return "asc-severity-info";
}

export default function SecurityConsolePanel({ locale }: { locale: string }) {
  const c = copy[resolveLocale(locale)];
  const readiness = buildSecurityReadinessSnapshot();
  const durable = buildDurableRateLimitReadiness();
  const ledger = buildSecurityEventLedgerSnapshot();
  const alerts = buildSecurityAlertSnapshot();
  const adminGate = buildSecurityAdminGateReadiness();
  const eventStore = buildSecurityEventStoreSnapshot();
  const appendAdapter = buildSecurityEventAppendReadiness();
  const adminAudit = buildSecurityAdminAuditSnapshot();
  const runtimeQa = buildSecurityRuntimeQaSnapshot();
  const releaseGate = buildSecurityReleaseGateSnapshot();
  const paymentWebhook = buildPaymentWebhookSecuritySnapshot();
  const paymentEvidence = buildPaymentRuntimeEvidenceSnapshot();
  const replayQa = buildStripeWebhookReplayQaSnapshot();
  const topRules = alerts.rules.slice(0, 6);
  const releaseItems = releaseGate.items.slice(0, 6);

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 md:px-12">
      <div className="asc-shell">
        <div className="grid gap-8 xl:grid-cols-[0.78fr_1.22fr] xl:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.18] bg-velmere-gold/[0.065] px-3 py-1.5 text-velmere-gold">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-mono text-[9px] uppercase tracking-[0.18em]">{c.eyebrow}</span>
            </div>
            <h1 className="mt-5 font-serif text-4xl leading-none tracking-[-0.045em] text-white md:text-6xl">{c.title}</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/[0.58]">{c.body}</p>

            <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="asc-stat"><p>{c.rate}</p><strong>{durable.mode}</strong></div>
              <div className="asc-stat"><p>{c.events}</p><strong>{ledger.total}</strong></div>
              <div className="asc-stat"><p>{c.blocked}</p><strong>{ledger.blocked}</strong></div>
              <div className="asc-stat"><p>{c.alerts}</p><strong>{alerts.critical + alerts.elevated + alerts.review}</strong></div>
              <div className="asc-stat"><p>gate</p><strong>{adminGate.status}</strong></div>
              <div className="asc-stat"><p>store</p><strong>{eventStore.averageProgress}%</strong></div>
              <div className="asc-stat"><p>append</p><strong>{appendAdapter.mode}</strong></div>
              <div className="asc-stat"><p>audit</p><strong>{adminAudit.total}</strong></div>
              <div className="asc-stat"><p>{c.runtimeQa}</p><strong>{runtimeQa.averageProgress}%</strong></div>
              <div className="asc-stat"><p>{c.releaseGate}</p><strong>{releaseGate.status}</strong></div>
              <div className="asc-stat"><p>{c.payment}</p><strong>{paymentWebhook.averageProgress}%</strong></div>
              <div className="asc-stat"><p>{c.paymentEvidence}</p><strong>{paymentEvidence.total}</strong></div>
              <div className="asc-stat"><p>{c.replayQa}</p><strong>{replayQa.averageProgress}%</strong></div>
            </div>

            <div className="mt-5 rounded-[1.35rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-100/[0.58]">{c.boundary}</p>
              <p className="mt-2 text-xs leading-6 text-cyan-100/[0.72]">{readiness.boundary}</p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/api/security/events" className="asc-link">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                {c.openEvents}
              </Link>
              <Link href="/api/security/alerts" className="asc-link">
                <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
                {c.openAlerts}
              </Link>
              <Link href="/api/security/event-store" className="asc-link">
                <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                {c.openStore}
              </Link>
              <Link href="/api/security/admin-audit" className="asc-link">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {c.openAudit}
              </Link>
              <Link href="/api/security/runtime-qa" className="asc-link">
                <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
                {c.runtimeQa}
              </Link>
              <Link href="/api/security/release-gate" className="asc-link">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {c.releaseGate}
              </Link>
              <Link href="/api/security/payment-webhook-review" className="asc-link">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {c.payment}
              </Link>
              <Link href="/api/security/payment-runtime-evidence" className="asc-link">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                {c.paymentEvidence}
              </Link>
              <Link href="/api/security/stripe-webhook-replay-qa" className="asc-link">
                <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
                {c.replayQa}
              </Link>
              <Link href="/api/security/export" className="asc-link">
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {c.export}
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            <article className="asc-card asc-card-strong">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-velmere-gold">{c.readiness}</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Security stack</h2>
                  <p className="mt-2 max-w-2xl text-xs leading-6 text-white/[0.55]">
                    Headers, CSP, API guard, Abuse Shield, durable rate-limit adapter, admin-gated event APIs, event store contract and safe export are present.
                  </p>
                </div>
                <ShieldCheck className="h-6 w-6 text-velmere-gold" aria-hidden="true" />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {readiness.implemented.slice(0, 10).map((item) => (
                  <div key={item} className="rounded-xl border border-white/[0.07] bg-black/[0.22] px-3 py-2 text-[11px] text-white/[0.55]">
                    {item}
                  </div>
                ))}
              </div>
            </article>



            <article className="asc-card asc-card-strong">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-velmere-gold">{c.releaseGate}</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Security release gate · {releaseGate.status}</h2>
                  <p className="mt-2 max-w-2xl text-xs leading-6 text-white/[0.55]">{releaseGate.productionBoundary}</p>
                </div>
                <div className="rounded-full border border-white/[0.10] bg-black/[0.25] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.42]">
                  {releaseGate.averageProgress}%
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {releaseItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/[0.07] bg-black/[0.22] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`asc-severity ${item.status === "blocked" ? "asc-severity-critical" : item.status === "ready_for_preview" ? "asc-severity-info" : "asc-severity-review"}`}>{item.status}</span>
                      <span className="asc-status">{item.progress}%</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-white/[0.82]">{item.label}</p>
                    <p className="mt-2 text-[11px] leading-5 text-white/[0.50]">{item.nextAction}</p>
                  </div>
                ))}
              </div>
            </article>


            {topRules.map((rule) => (
              <article key={rule.id} className="asc-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-velmere-gold" aria-hidden="true" />
                      <span className={`asc-severity ${severityClass(rule.severity)}`}>{rule.severity}</span>
                      <span className="asc-status">{rule.status}</span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-white/[0.88]">{rule.label}</h3>
                    <p className="mt-2 text-xs leading-6 text-white/[0.56]">{rule.operatorMeaning}</p>
                  </div>
                  <div className="shrink-0 rounded-full border border-white/[0.10] bg-black/[0.25] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.38]">
                    {rule.currentSignal}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.07] bg-black/[0.22] p-3">
                    <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">trigger</p>
                    <p className="mt-2 text-[11px] leading-5 text-white/[0.52]">{rule.trigger}</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-black/[0.22] p-3">
                    <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">{c.next}</p>
                    <p className="mt-2 text-[11px] leading-5 text-white/[0.52]">{rule.nextAction}</p>
                  </div>
                </div>
              </article>
            ))}

            <p className="rounded-[1.1rem] border border-white/[0.08] bg-black/[0.24] p-4 text-xs leading-6 text-white/[0.48]">
              {alerts.productionBoundary}
            </p>
          </div>
        </div>
      </div>
      <SecurityPaymentReplayBoard locale={locale} />
    </section>
  );
}
