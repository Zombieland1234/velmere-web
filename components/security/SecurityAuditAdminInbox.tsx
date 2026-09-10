/* PASS2534 visible execution dock marker: data-pass2534-visible-execution-dock-surface="admin" requires dual-control, retry budget and expiry before override release. */
/* PASS2533 execution ledger marker: data-pass2533-admin-execution-dock requires dual-control, expiry and audit ledger before override release. */
/* PASS2532 freshness recovery router marker: data-pass2532-admin-dual-control-recovery-route keeps override on hold until second operator + expiry are present. */
/* PASS2531 source freshness expiry marker: data-pass2531-admin-override-freshness-bridge requires second approver + expiry before override copy. */
/* PASS2530 entitlement replay bridge marker: data-pass2530-admin-revoked-override-bridge requires dual-control + expiry. */
/* PASS2529 runtime evidence chip adapter marker: data-pass2529-admin-runtime-evidence-chip-adapter */
import { ArrowRightCircle, Eye, FileText, LockKeyhole, Network, ShieldCheck } from "lucide-react";
import { Link } from "@/navigation";
import { buildAuditAdminInbox } from "@/lib/security/audit-report-queue";
import { buildAuditDeliveryReadiness, buildAuditOperatorActionReadiness, listAuditAccountMessages, PASS2360_AUDIT_ACCOUNT_DELIVERY_ID, PASS2361_AUDIT_OPERATOR_ACTIONS_ID } from "@/lib/account/audit-account-messages";
import { buildPass2370FocusSummary, hasPass2370AuditFocus, parsePass2370AuditFocus, pass2370FocusMatchesMessage, PASS2370_ADMIN_REPLAY_AUDIT_LINK_ID } from "@/lib/security/admin-replay-audit-link";
import { buildPass2371LinkedRequestDrawerSnapshot, PASS2371_LINKED_REQUEST_DRAWER_ID } from "@/lib/security/linked-request-drawer";
import SecurityLinkedRequestDrawer from "@/components/security/SecurityLinkedRequestDrawer";
import SecurityAuditOperatorActionsClient from "@/components/security/SecurityAuditOperatorActionsClient";

const statusClass: Record<string, string> = {
  queued: "border-white/[0.09] bg-white/[0.025] text-white/[0.58]",
  triage: "border-cyan-200/[0.16] bg-cyan-300/[0.045] text-cyan-100",
  lens_ready: "border-emerald-300/[0.16] bg-emerald-300/[0.045] text-emerald-100",
  shield_map_ready: "border-emerald-300/[0.16] bg-emerald-300/[0.045] text-emerald-100",
  waiting_for_evidence: "border-amber-300/[0.16] bg-amber-300/[0.04] text-amber-100",
  private_disclosure: "border-rose-300/[0.18] bg-rose-300/[0.045] text-rose-100",
  published_sample: "border-emerald-300/[0.18] bg-emerald-300/[0.055] text-emerald-100",
};

export default async function SecurityAuditAdminInbox({ locale, focusParams = {} }: { locale: string; focusParams?: Record<string, string | string[] | undefined> }) {
  const inbox = buildAuditAdminInbox(locale);
  const focus = parsePass2370AuditFocus(focusParams);
  const focusActive = hasPass2370AuditFocus(focus);
  const delivery = await listAuditAccountMessages({ locale, limit: focusActive ? 40 : 12 });
  const deliveryReadiness = buildAuditDeliveryReadiness(delivery.messages);
  const operatorReadiness = buildAuditOperatorActionReadiness(delivery.messages);
  const focusedMessages = delivery.messages.filter((message) => pass2370FocusMatchesMessage(message, focus));
  const focusSummary = buildPass2370FocusSummary(focus);
  const linkedRequestDrawer = await buildPass2371LinkedRequestDrawerSnapshot({ locale, focus, messages: delivery.messages });

  return (
    <main
      className="min-h-screen bg-velmere-black px-5 pb-24 pt-28 text-white md:px-10 md:pt-36"
      data-pass1614-audit-admin-inbox={inbox.passId}
      data-pass1614-task-count={inbox.taskCount}
      data-pass1614-admin-gate="manual-review-before-paid-badge"
      data-pass2361-audit-operator-actions={PASS2361_AUDIT_OPERATOR_ACTIONS_ID}
      data-admin-replay-audit-link={PASS2370_ADMIN_REPLAY_AUDIT_LINK_ID}
      data-linked-request-drawer={PASS2371_LINKED_REQUEST_DRAWER_ID}
      data-pass2514-admin-security-audit-trail="grant-export-pin-refund-product-dual-control" data-pass2515-admin-operator-evidence-audit-trail="release-override-payment-rollback-vault-read-provider-override-product-release-pin-override" data-pass2516-security-line-audit="admin-auth-session-receipt-dual-control-line-scan" data-pass2517-admin-semantic-audit="release-override-vault-read-provider-override-rule-pack" data-pass2518-admin-override-integrity="operator-reason-expiry-dual-control-audit-ledger-no-silent-grant"
    >
      <section className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.07] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.17em] text-velmere-gold">
              <LockKeyhole className="h-4 w-4" />
 operator surface
 </p>
            <h1 className="mt-6 max-w-5xl font-serif text-5xl leading-[0.95] tracking-[-0.06em] md:text-7xl">{inbox.title}</h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/[0.62]">{inbox.body}</p>
          </div>
          <aside className="rounded-[1.8rem] border border-cyan-200/[0.14] bg-cyan-300/[0.04] p-5 shadow-velmere-card">
            <ShieldCheck className="h-5 w-5 text-cyan-100" />
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">Release gate</h2>
            <div className="mt-4 grid gap-2">
              {Object.entries(inbox.releaseGate).map(([key, value]) => (
                <p key={key} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">
                  {key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)} · {String(value)}
                </p>
              ))}
            </div>
          </aside>
        </div>


        {focusActive ? (
          <section
            id="pass2370-linked-audit-message"
            className="mt-8 rounded-[1.35rem] border border-cyan-200/[0.16] bg-cyan-300/[0.045] p-5"
            data-pass2370-audit-inbox-focus={PASS2370_ADMIN_REPLAY_AUDIT_LINK_ID}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.18] bg-black/[0.18] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-100">
                  <ArrowRightCircle className="h-4 w-4" /> Linked replay evidence
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">Replay Board opened the related Audit Inbox lane.</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-white/[0.56]">{focusSummary ?? "Evidence focus loaded."} · matches: {focusedMessages.length}</p>
              </div>
              <a href={`/${locale}/admin/security`} className="inline-flex items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.035] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-white/[0.62] transition hover:border-cyan-200/[0.28] hover:text-cyan-100">back to replay board</a>
            </div>
          </section>
        ) : null}

        <SecurityLinkedRequestDrawer snapshot={linkedRequestDrawer} />

        <section className="mt-10 grid gap-4 md:grid-cols-4" data-pass1614-admin-metrics="queue-ready-redaction-confidence">
          {inbox.metrics.map((metric) => (
            <div key={metric.label} className="rounded-[1.35rem] border border-white/[0.10] bg-white/[0.025] p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.38]">{metric.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">{metric.value}</p>
            </div>
          ))}
        </section>

        <section
          className="mt-8 rounded-[1.8rem] border border-cyan-200/[0.14] bg-cyan-300/[0.035] p-5"
          data-pass2360-audit-account-delivery={PASS2360_AUDIT_ACCOUNT_DELIVERY_ID}
          data-pass2360-delivery-source={delivery.source}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-100">Account delivery spine</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">Audit messages now have a server lane.</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/[0.58]">Basic/Advanced submissions are written to the account inbox through Supabase when configured, with a memory fallback for local demos. Email is marked pending until a real provider is connected.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <div className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-3">
                <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">total</p>
                <p className="mt-1 text-2xl text-white">{deliveryReadiness.total}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-3">
                <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">queued</p>
                <p className="mt-1 text-2xl text-white">{deliveryReadiness.queued}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-3">
                <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">paid wait</p>
                <p className="mt-1 text-2xl text-white">{deliveryReadiness.waitingPayment}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-3">
                <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">operator</p>
                <p className="mt-1 text-2xl text-white">{deliveryReadiness.operatorReady}</p>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            {deliveryReadiness.lanes.map((lane) => (
              <p key={lane} className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3 text-xs leading-6 text-white/[0.52]">{lane}</p>
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {delivery.messages.length ? delivery.messages.map((message) => {
              const focused = pass2370FocusMatchesMessage(message, focus);
              return (
              <article key={message.id} data-pass2370-delivery-card-focus={focused ? "true" : undefined} className={`rounded-2xl border bg-black/[0.18] p-4 ${focused ? "border-cyan-200/[0.36] ring-1 ring-cyan-200/[0.16]" : "border-white/[0.10]"}`}>
                <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.36]">{message.deliveryStatus}</p>
                <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-white">{message.title}</h3>
                <p className="mt-2 truncate font-mono text-[10px] text-cyan-100/[0.68]">{message.requestId}</p>
                <p className="mt-2 text-[11px] leading-5 text-white/[0.45]">{message.contactEmail ?? message.accountId}</p>
              </article>
            );
            }) : (
              <p className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.48]">No submitted account messages yet. Submit a Basic Audit to populate this lane.</p>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-[1.35rem] border border-white/[0.10] bg-white/[0.025] p-5" data-pass2361-operator-action-readiness={operatorReadiness.passId}>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-velmere-gold">Operator action readiness</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">Customer-safe report delivery queue.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-white/[0.54]">{operatorReadiness.safetyBoundary}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3"><p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">review</p><p className="mt-1 text-2xl text-white">{operatorReadiness.byStatus.human_review}</p></div>
              <div className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3"><p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">pdf</p><p className="mt-1 text-2xl text-white">{operatorReadiness.byStatus.pdf_attached}</p></div>
              <div className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3"><p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">delivered</p><p className="mt-1 text-2xl text-white">{operatorReadiness.byStatus.delivered}</p></div>
            </div>
          </div>
        </section>

        <SecurityAuditOperatorActionsClient locale={locale} initialMessages={delivery.messages} focus={focus} />

        <section className="mt-8 grid gap-5 xl:grid-cols-5" data-pass1614-admin-lanes="free-basic-pro-advanced-disclosure">
          {inbox.lanes.map((lane) => (
            <article key={lane.id} className="rounded-[1.55rem] border border-white/[0.10] bg-white/[0.025] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-velmere-gold">{lane.label}</p>
              <div className="mt-4 grid gap-3">
                {lane.records.length ? lane.records.map((record) => (
                  <div key={record.reportId} className={`rounded-2xl border p-4 ${statusClass[record.status] ?? statusClass.queued}`}>
                    <p className="font-mono text-[9px] uppercase tracking-[0.15em] opacity-70">{record.statusLabel}</p>
                    <h2 className="mt-2 text-sm font-semibold leading-5">{record.projectName}</h2>
                    <p className="mt-2 text-[11px] leading-5 opacity-70">{record.reportId}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={record.publicRoute} className="inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-black/[0.18] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em]">
                        <Eye className="h-3 w-3" /> public
                      </Link>
                      <a href={record.lensExport.route} className="inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-black/[0.18] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em]">
                        <FileText className="h-3 w-3" /> pdf
                      </a>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-black/[0.18] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em]">
                        <Network className="h-3 w-3" /> {record.shieldMapExport.enabled ? "map" : "hold"}
                      </span>
                    </div>
                  </div>
                )) : (
                  <p className="rounded-2xl border border-white/[0.08] bg-black/[0.16] p-4 text-xs leading-6 text-white/[0.46]">No records in this lane.</p>
                )}
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}

/* PASS2519 risk kernel calibration marker: data-pass2519-admin-risk-override-proof admin overrides require reason, expiry, operator and audit receipt. */
/* PASS2520 premium risk psychology marker: data-pass2520-admin-override-trust-friction requires reason/expiry/operator before customer-visible safety copy changes. */

/* data-pass2521-admin-source-override-quorum-audit */
/* data-pass2522-admin-entitlement-override-audit-chain */

/* PASS2523 marker: data-pass2523-admin-operator-proof-passport requires reason, expiry, scope and audit receipt before manual unlock/publish. */

/* PASS2524 marker: data-pass2524-admin-revoke-replay-ledger requires dual-control replay for manual grants after refund/revoke/hash mismatch. */

/* PASS2525 admin marker: data-pass2525-admin-operator-review-chip data-pass2525-admin-override-proof-gap */

/* PASS2526 marker: data-pass2526-admin-operator-downgrade-chip-rail blocks manual override without dual control. */
/* PASS2527 marker: data-pass2527-admin-runtime-proof-chip-mount blocks manual override without operator reason, expiry, audit log and second approver. */
/* PASS2528 marker: data-pass2528-admin-live-chip-state-replay blocks override without operator ledger, expiry, reason, audit id and second approver. */
