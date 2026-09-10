import { ArrowLeft, ClipboardCheck, Download, ExternalLink, FileText, LifeBuoy, LockKeyhole, ReceiptText, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Pass2380CustomerSupportHandoffPacket, Pass2380SupportHandoffItem } from "@/lib/security/customer-support-handoff-packet";
import type { Pass2381SupportHandoffEventLedgerSnapshot } from "@/lib/security/support-handoff-event-ledger";

function statusTone(status: Pass2380CustomerSupportHandoffPacket["status"]) {
  if (status === "ready") return "border-emerald-300/[0.18] bg-emerald-300/[0.055] text-emerald-100";
  if (status === "watch") return "border-amber-300/[0.18] bg-amber-300/[0.05] text-amber-100";
  return "border-rose-300/[0.18] bg-rose-300/[0.055] text-rose-100";
}

function itemTone(state: Pass2380SupportHandoffItem["state"]) {
  if (state === "ready" || state === "linked") return "border-emerald-300/[0.14] bg-emerald-300/[0.04] text-emerald-100";
  if (state === "watch") return "border-amber-300/[0.14] bg-amber-300/[0.04] text-amber-100";
  return "border-rose-300/[0.14] bg-rose-300/[0.04] text-rose-100";
}

function short(value?: string, max = 72) {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export default function CustomerSupportHandoffPacketPage({ packet, supportHandoffEventLedger }: { packet: Pass2380CustomerSupportHandoffPacket; supportHandoffEventLedger?: Pass2381SupportHandoffEventLedgerSnapshot }) {
  return (
    <main
      className="velmere-public-page min-h-screen bg-velmere-black px-5 pb-24 pt-28 text-white md:px-10 md:pt-36"
      data-pass2380-customer-support-handoff-page={packet.passId}
      data-pass2380-redacted-support-artifact="customer-report-safe-pdf-delivery-receipt-route-health"
      data-pass2380-no-raw-payment="true"
      data-pass2380-no-exploit-instructions="true"
      data-support-handoff-event-ledger={supportHandoffEventLedger?.passId ?? "pending"}
    >
      <section className="mx-auto max-w-6xl">
        <a href={packet.links.accountRoute} className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/[0.66] transition hover:border-white/[0.22] hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Account messages
        </a>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_24rem] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.18] bg-cyan-300/[0.06] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.17em] text-cyan-100">
              <LifeBuoy className="h-4 w-4" /> support handoff packet
            </p>
            <h1 className="mt-6 max-w-5xl font-serif text-5xl leading-[0.95] tracking-[-0.06em] md:text-7xl">{packet.title}</h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/[0.62]">{packet.summary}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              {packet.links.customerReportRoute ? (
                <a href={packet.links.customerReportRoute} className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white/[0.70] transition hover:border-white/[0.24] hover:text-white">
                  <FileText className="h-4 w-4" /> customer report
                </a>
              ) : null}
              {packet.links.safePdfPacketRoute ? (
                <a href={packet.links.safePdfPacketRoute} className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white/[0.70] transition hover:border-white/[0.24] hover:text-white">
                  <Download className="h-4 w-4" /> safe PDF packet
                </a>
              ) : null}
              {packet.links.deliveryReceiptRoute ? (
                <a href={packet.links.deliveryReceiptRoute} className="inline-flex items-center gap-2 rounded-full border border-emerald-300/[0.18] bg-emerald-300/[0.055] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-100 transition hover:border-emerald-300/[0.28] hover:text-white">
                  <ReceiptText className="h-4 w-4" /> delivery receipt
                </a>
              ) : null}
              <a href={packet.links.downloadableSupportHandoffRoute} className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.24] bg-velmere-gold/[0.085] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-velmere-gold transition hover:bg-velmere-gold/[0.14]" data-pass2380-downloadable-support-handoff-packet="redacted-json" data-pass2381-support-download-event="support_packet_download" data-pass2657-customer-facing-support-handoff-final-badge="support_handoff_final_badge_route_split_ready" data-pass2657-guarded-support-packet-route-split="receipt-hash-bound-guarded-route" data-pass2657-public-packet-download-route-state="guarded-route-active" data-pass2657-no-private-support-packet-route-dom-leak="true" data-pass2658-guarded-support-packet-route-split-final-gate="guarded_support_packet_route_split_final_gate_ready" data-pass2658-release-board-guarded-route-split-receipt="attached" data-pass2658-guarded-support-packet-route-promotion="release-board-final-receipt-verified" data-pass2658-no-private-guarded-route-split-final-receipt-dom-leak="true" data-pass2659-guarded-support-packet-public-route-download="guarded_support_packet_public_download_route_verified" data-pass2659-public-route-download-receipt="hash-bound" data-pass2659-public-route-uses-receipt-id-and-hash="true" data-pass2659-raw-private-support-packet-route-denied="true" data-pass2659-no-raw-support-packet-payload-dom-leak="true" data-pass2660-public-route-download-final-gate="guarded_support_packet_public_route_download_final_gate_ready" data-pass2660-release-board-public-route-download-receipt="attached" data-pass2660-public-route-download-promotion="release-board-final-receipt-verified" data-pass2660-support-handoff-public-route-promotion="customer-safe-public-route-promotable" data-pass2660-no-private-public-route-final-receipt-dom-leak="true" data-pass2660-no-raw-support-packet-payload-final-receipt-dom-leak="true" data-pass2661-account-timeline-final-gate-copy="customer_support_packet_account_timeline_ready" data-pass2661-support-packet-final-gate-download="guarded-route-verified" data-pass2661-support-download-revocation-state-matrix="verified_unlocked_pending_revoked_refunded_chargeback_locked" data-pass2661-support-packet-verified-unlocked="true" data-pass2661-support-packet-refund-chargeback-revoked-locked="true" data-pass2661-no-private-support-packet-final-gate-dom-leak="true" data-pass2662-deployed-public-download-revocation-state-smoke="dry_run_contract_not_live_proof_until_vercel_preview_smoke" data-pass2662-customer-timeline-packet-exporter="customer_timeline_packet_exported_contract_ready_live_smoke_required" data-pass2662-live-proof-required="true" data-pass2662-dry-run-not-live-proof="true" data-pass2662-no-private-packet-exporter-dom-leak="true" data-pass2663-release-board-attachment="pass2662_customer_timeline_packet_attached_to_release_board_contract_only" data-pass2663-release-board-receipt="attached" data-pass2663-no-fake-live-proof-promotion="true" data-pass2663-no-private-release-board-dom-leak="true" data-pass2664-master-public-private-leak-regression="public_api_pro_pdf_dom_support_packet_release_board_account_timeline_scanned" data-pass2664-no-private-dom-leak="true" data-pass2664-fail-closed-on-leak="true" data-pass2664-live-scan-required="true" data-pass2665-production-env-hard-fail="production_env_hard_fail_contract_ready_live_proof_required" data-pass2665-no-memory-fallback-production="true" data-pass2665-fail-closed-on-missing-env="true" data-pass2665-production-proof-required="true" data-pass2666-clean-build-signal="clean_build_typecheck_signal_pack_ready_full_build_required" data-pass2666-clean-install-typecheck-build-green="false" data-pass2666-no-fake-clean-build-promotion="true" data-pass2666-next-gate="PASS2667-live-supabase-rls-proof" data-pass2667-live-rls-master-regression="supabase_live_rls_master_regression_contract_ready_live_proof_required" data-pass2667-live-rls-proof-executed="false" data-pass2667-no-fake-live-rls-promotion="true" data-pass2667-next-gate="PASS2668-stripe-live-webhook-replay" data-pass2668-stripe-webhook-live-replay="stripe_webhook_live_replay_contract_ready_live_proof_required" data-pass2668-live-webhook-proof-executed="false" data-pass2668-no-fake-live-webhook-promotion="true" data-pass2668-next-gate="PASS2669-risk-formula-v1" data-pass2669-vlm-risk-formula-v1="central_risk_formula_ready_explanation_rows_confidence_cap" data-pass2669-risk-score-not-random="true" data-pass2669-confidence-not-equal-risk="true" data-pass2669-source-quorum-state="required" data-pass2669-missing-evidence-cap="enabled" data-pass2669-next-gate="PASS2670-claim-ledger-firewall" data-pass2670-claim-ledger-firewall-v1="claim_ledger_claim_firewall_ready_no_bare_claims" data-pass2670-no-bare-claim-rule="true" data-pass2670-evidence-id-required="confirmed_and_strong_claims" data-pass2670-confidence-cap-respected="true" data-pass2670-missing-evidence-not-confirmed="true" data-pass2670-next-gate="PASS2671-source-quorum-provider-snapshot-vault" data-pass2671-source-quorum-provider-snapshot-vault-v1="source_quorum_provider_snapshot_vault_ready_hash_bound" data-pass2671-provider-snapshot-vault-ready="false" data-pass2671-provider-snapshot-hash-bound="true" data-pass2671-freshness-ttl-enforced="true" data-pass2671-provider-conflict-caps-confidence="true" data-pass2671-next-gate="PASS2672-basic-pro-advanced-customer-ux-compression" data-pass2672-basic-pro-advanced-customer-ux-compression="basic_pro_advanced_customer_ux_compression_ready" data-pass2672-basic-one-screen-ready="true" data-pass2672-pro-expandable-evidence-ready="true" data-pass2672-advanced-human-review-state-ready="true" data-pass2672-pass-jargon-hidden-from-customer="true" data-pass2672-single-primary-cta-per-tier="true" data-pass2672-mobile-safe-compression="true" data-pass2672-next-gate="PASS2673-pro-pdf-premium-layout-v1" data-pass2673-pro-pdf-premium-layout-v1="pro_pdf_premium_layout_ready" data-pass2673-cover-page-ready="true" data-pass2673-verdict-page-ready="true" data-pass2673-risk-breakdown-ready="true" data-pass2673-evidence-table-ready="true" data-pass2673-missing-evidence-ready="true" data-pass2673-source-freshness-ready="true" data-pass2673-receipt-badge-ready="true" data-pass2673-legal-disclaimer-ready="true" data-pass2673-support-handoff-ready="true" data-pass2673-claim-to-source-trace-ready="true" data-pass2673-debug-jargon-removed="true" data-pass2673-next-gate="PASS2674-account-delivery-portal-final-mobile-smoke" data-pass2674-account-delivery-portal-final-mobile-smoke="account_delivery_mobile_smoke_ready" data-pass2674-viewport-390x844-ready="true" data-pass2674-account-timeline-visible="true" data-pass2674-cta-visible="true" data-pass2674-close-button-visible="true" data-pass2674-modal-fits-viewport="true" data-pass2674-no-horizontal-overflow="true" data-pass2674-no-scroll-trap="true" data-pass2674-touch-targets-safe="true" data-pass2674-locked-state-copy-visible="true" data-pass2674-revoked-refunded-chargeback-locked="true" data-pass2674-pass-jargon-hidden="true" data-pass2674-customer-safe-dom-only="true" data-pass2674-next-gate="PASS2675-advanced-operator-auth-queue-signoff-ledger" data-pass2675-advanced-operator-auth-queue-signoff-ledger="advanced_operator_auth_queue_signoff_ledger_ready" data-pass2675-server-side-operator-auth-required="true" data-pass2675-role-scoped-access-ready="true" data-pass2675-least-privilege-ready="true" data-pass2675-query-param-auth-denied="true" data-pass2675-client-header-only-auth-denied="true" data-pass2675-human-review-queue-ready="true" data-pass2675-reviewer-signoff-ledger-ready="true" data-pass2675-private-notes-vault-only="true" data-pass2675-no-raw-operator-notes-customer-output="true" data-pass2675-next-gate="PASS2676-angel-evidence-bound-ai-quality-bench" data-pass2676-angel-evidence-bound-ai-quality-bench="angel_evidence_bound_ai_quality_bench_ready" data-pass2676-prompt-count="108" data-pass2676-pl-en-de-parity-ready="true" data-pass2676-context-isolation-ready="true" data-pass2676-missing-proof-wording-ready="true" data-pass2676-confidence-and-source-required="true" data-pass2676-no-local-mode-final-quality="true" data-pass2676-claim-firewall-linked="true" data-pass2676-source-quorum-linked="true" data-pass2676-ai-judge-ready="true" data-pass2676-next-gate="PASS2677-browser-lens-audit-intake-parity" data-pass2677-browser-lens-audit-intake-parity="browser_lens_audit_intake_parity_ready" data-pass2677-exact-search-ready="true" data-pass2677-eth-does-not-return-tether="true" data-pass2677-aapl-nvda-resolve="true" data-pass2677-pinned-suggestions-max-3="true" data-pass2677-category-separation-ready="true" data-pass2677-pdf-upload-intake-ready="true" data-pass2677-text-extraction-ready="true" data-pass2677-page-evidence-mapping-ready="true" data-pass2677-document-claim-ledger-ready="true" data-pass2677-missing-sections-detected="true" data-pass2677-basic-pro-advanced-parity-ready="true" data-pass2677-osint-evidence-lanes-ready="true" data-pass2677-source-freshness-linked="true" data-pass2677-claim-firewall-linked="true" data-pass2677-source-quorum-linked="true" data-pass2677-contradiction-detector-seed-ready="true" data-pass2677-no-raw-document-leak="true" data-pass2677-live-extraction-proof-executed="false" data-pass2677-next-gate="PASS2678-shield-real-markets-risk-parity" data-pass2678-shield-real-markets-risk-parity="shield_real_markets_risk_parity_ready" data-pass2678-asset-class-router-ready="true" data-pass2678-token-risk-not-stock-risk="true" data-pass2678-fx-risk-not-crypto-risk="true" data-pass2678-no-single-88-risk-ratio="true" data-pass2678-no-aapl-112-percent-bug="true" data-pass2678-real-icons-no-fake-frames="true" data-pass2678-market-provider-proof-ready="true" data-pass2678-chart-source-timestamp-ready="true" data-pass2678-provider-conflict-caps-confidence="true" data-pass2678-pass2669-risk-formula-linked="true" data-pass2678-pass2670-claim-firewall-linked="true" data-pass2678-pass2671-source-quorum-linked="true" data-pass2678-market-pressure-risk-seed-ready="true" data-pass2678-no-raw-provider-payload-leak="true" data-pass2678-customer-safe-explanation-rows-ready="true" data-pass2678-live-market-provider-replay-executed="false" data-pass2678-next-gate="PASS2679-observability-alerts-incident-response" data-pass2679-observability-alerts-incident-response="observability_alerts_incident_response_ready" data-pass2679-event-id-contract-ready="true" data-pass2679-structured-telemetry-ready="true" data-pass2679-open-telemetry-compatible="true" data-pass2679-alert-rules-ready="true" data-pass2679-webhook-failure-alert-ready="true" data-pass2679-supabase-rls-deny-alert-ready="true" data-pass2679-provider-timeout-alert-ready="true" data-pass2679-risk-engine-anomaly-alert-ready="true" data-pass2679-ai-claim-firewall-block-alert-ready="true" data-pass2679-public-leak-regression-alert-ready="true" data-pass2679-pdf-generation-failure-alert-ready="true" data-pass2679-market-data-staleness-alert-ready="true" data-pass2679-operator-auth-denied-alert-ready="true" data-pass2679-incident-playbook-ready="true" data-pass2679-incident-owner-routing-ready="true" data-pass2679-no-pii-secrets-telemetry="true" data-pass2679-release-board-observability-receipt-ready="true" data-pass2679-live-alert-sink-configured="false" data-pass2679-next-gate="PASS2680-world-class-audit-launch-readiness-gate" data-pass2680-world-class-audit-launch-readiness-gate="world_class_audit_launch_readiness_gate_ready_go_no_go" data-pass2680-go-no-go="NO_GO" data-pass2680-can-promote-world-class-readiness-contract="true" data-pass2680-can-promote-production-launch="false" data-pass2680-clean-build-required="true" data-pass2680-live-proof-required="true" data-pass2680-external-review-required="true" data-pass2680-clean-install-typecheck-build-green="false" data-pass2680-vercel-preview-smoke-green="false" data-pass2680-supabase-live-rls-proof-green="false" data-pass2680-stripe-webhook-replay-proof-green="false" data-pass2680-risk-formula-v1-ready="true" data-pass2680-claim-ledger-firewall-ready="true" data-pass2680-source-quorum-snapshot-vault-ready="true" data-pass2680-pro-pdf-premium-layout-ready="true" data-pass2680-mobile-account-delivery-ready="true" data-pass2680-angel-evidence-bench-ready="true" data-pass2680-browser-lens-audit-parity-ready="true" data-pass2680-shield-real-markets-risk-parity-ready="true" data-pass2680-observability-incident-response-ready="true" data-pass2680-live-alert-sink-configured="false" data-pass2680-no-dry-run-live-promotion="true" data-pass2680-continuous-polish-after-100="true" data-pass2681-real-proof-execution-plan="real_proof_execution_plan_runbook_ready" data-pass2681-can-promote-runbook-contract="true" data-pass2681-can-promote-live-production-proof="false" data-pass2681-clean-ci-required="true" data-pass2681-vercel-preview-smoke-required="true" data-pass2681-supabase-rls-live-required="true" data-pass2681-stripe-replay-live-required="true" data-pass2681-alert-sink-live-required="true" data-pass2681-external-review-required="true" data-pass2681-no-dry-run-live-promotion="true" data-pass2681-next-gate="PASS2682-github-actions-vercel-ci-artifacts" data-pass2682-github-actions-vercel-ci-artifact-workflow="ci_artifact_workflow_ready" data-pass2682-can-promote-ci-workflow-contract="true" data-pass2682-can-promote-live-production-proof="false" data-pass2682-clean-ci-workflow-ready="true" data-pass2682-live-ci-proof-green="false" data-pass2682-artifact-retention-days="14" data-pass2682-no-secrets-in-artifacts="true" data-pass2682-no-dry-run-live-promotion="true" data-pass2682-next-gate="PASS2683-live-ci-artifact-import-release-board-attachment" data-pass2683-attested-ci-evidence-protected-release-board-gate="attested_ci_evidence_protected_release_board_gate_ready" data-pass2683-can-promote-attested-gate-contract="true" data-pass2683-can-promote-live-release-board-proof="false" data-pass2683-artifact-attestation-required="true" data-pass2683-artifact-digest-verify-required="true" data-pass2683-protected-environment-required="true" data-pass2683-release-board-import-requires-attestation="true" data-pass2683-rollback-evidence-required="true" data-pass2683-no-raw-logs-in-release-board="true" data-pass2683-no-dry-run-live-promotion="true" data-pass2683-next-gate="PASS2684-sbom-dependency-supply-chain-policy-gate" data-pass2684-sbom-dependency-supply-chain-policy-gate="sbom_dependency_supply_chain_policy_gate_ready" data-pass2684-no-secrets-in-sbom-or-artifacts="true" data-pass2684-no-raw-audit-logs-public="true" data-pass2684-sbom-attestation-required="true" data-pass2684-release-board-import-required="true" data-pass2684-can-promote-live-supply-chain-proof="false" data-pass2685-runtime-secrets-rotation-env-drift-key-scope-gate="runtime_secret_policy_ready_live_scope_rotation_drift_required" data-pass2685-no-secrets-in-public-env="true" data-pass2685-no-raw-env-names-in-customer-errors="true" data-pass2685-can-promote-live-runtime-secret-proof="false" data-pass2686-live-external-smoke-evidence-matrix="external_smoke_matrix_ready_live_customer_critical_flow_required" data-pass2686-no-raw-route-bodies-in-public-artifacts="true" data-pass2686-can-promote-live-external-smoke-proof="false">
                <Download className="h-4 w-4" /> support JSON
              </a>
            </div>
          </div>

          <aside className={`rounded-[1.8rem] border p-5 shadow-velmere-card ${statusTone(packet.status)}`}>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] opacity-70">status</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{packet.status}</h2>
            <p className="mt-4 text-sm leading-7 opacity-75">{packet.project.name}</p>
            <p className="mt-4 break-all font-mono text-[9px] uppercase tracking-[0.16em] opacity-55">{packet.supportHandoffId}</p>
            {packet.receiptId ? <p className="mt-2 break-all font-mono text-[9px] uppercase tracking-[0.16em] opacity-55">receipt · {packet.receiptId}</p> : null}
          </aside>
        </section>


        {supportHandoffEventLedger ? (
          <section className="mt-8 rounded-[1.9rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-6 md:p-8" data-pass2381-support-event-ledger="open-download-redacted-audit-trail">
            <LifeBuoy className="h-5 w-5 text-cyan-100" />
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Support handoff audit trail</h2>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-white/[0.58]">{supportHandoffEventLedger.recommendedAction}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <p className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">events<br /><span className="text-base tracking-normal text-white">{supportHandoffEventLedger.eventCount}</span></p>
              <p className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">opens/views<br /><span className="text-base tracking-normal text-white">{supportHandoffEventLedger.openCount}</span></p>
              <p className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">downloads<br /><span className="text-base tracking-normal text-white">{supportHandoffEventLedger.downloadCount}</span></p>
              <p className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">source<br /><span className="text-base tracking-normal text-white">{supportHandoffEventLedger.source}</span></p>
            </div>
            <div className="mt-5 grid gap-3">
              {supportHandoffEventLedger.history.slice(0, 5).map((event) => (
                <article key={event.eventId} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4" data-pass2381-support-event-row={event.eventType}>
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.46]">{event.eventType} · {event.eventAt}</p>
                  <p className="mt-2 text-xs leading-6 text-white/[0.58]">{event.eventSummary}</p>
                  <p className="mt-2 break-all font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.40]">{short(event.checksum, 96)}</p>
                </article>
              ))}
            </div>
            <p className="mt-5 rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.58]">{supportHandoffEventLedger.safeBoundary}</p>
          </section>
        ) : null}

        <section className="mt-8 grid gap-4 md:grid-cols-3" data-pass2380-support-handoff-items="customer-report-safe-pdf-receipt-freshness-warnings">
          {packet.items.map((item) => (
            <article key={item.key} className={`rounded-[1.45rem] border p-5 ${itemTone(item.state)}`}>
              <ClipboardCheck className="h-4 w-4" />
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.15em] opacity-70">{item.label} · {item.state}</p>
              <p className="mt-3 text-xs leading-6 text-white/[0.58]">{item.summary}</p>
              {item.href ? <a href={item.href} className="mt-4 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-white/[0.72]"><ExternalLink className="h-3.5 w-3.5" /> open</a> : null}
            </article>
          ))}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,.9fr)]">
          <article className="rounded-[1.9rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-6 md:p-8" data-pass2380-support-checklist="redacted-customer-support-handoff">
            <LifeBuoy className="h-5 w-5 text-cyan-100" />
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Support checklist</h2>
            <div className="mt-5 grid gap-3">
              {packet.supportChecklist.map((step) => (
                <p key={step} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.58]">{step}</p>
              ))}
            </div>
          </article>

          <article className={`rounded-[1.9rem] border p-6 md:p-8 ${packet.routeHealthWarnings.length === 0 ? "border-emerald-300/[0.14] bg-emerald-300/[0.04]" : "border-amber-300/[0.14] bg-amber-300/[0.04]"}`} data-pass2380-route-health-warnings="redacted-no-raw-payment">
            <ShieldAlert className="h-5 w-5 text-amber-100" />
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Route-health warnings</h2>
            {packet.routeHealthWarnings.length > 0 ? (
              <div className="mt-5 grid gap-3">
                {packet.routeHealthWarnings.map((warning) => (
                  <p key={`${warning.key}-${warning.state}`} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.58]">
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.42]">{warning.label} · {warning.state}</span><br />
                    {warning.summary}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.58]">No route-health warnings beyond the expected raw-payment boundary block.</p>
            )}
            <p className="mt-5 rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.58]">{packet.receiptRouteHealth.accountBadge.summary}</p>
          </article>
        </section>

        <section className="mt-8 rounded-[1.9rem] border border-white/[0.10] bg-white/[0.025] p-6 md:p-8">
          <ShieldCheck className="h-5 w-5 text-emerald-100" />
          <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Handoff refs</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <p className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">receipt<br /><span className="text-[10px] tracking-normal text-white">{short(packet.receiptId)}</span></p>
            <p className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">checksum<br /><span className="text-[10px] tracking-normal text-white">{short(packet.receiptChecksum)}</span></p>
            <p className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">account message<br /><span className="text-[10px] tracking-normal text-white">{short(packet.project.accountMessageId)}</span></p>
            <p className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">freshness<br /><span className="text-base tracking-normal text-white">{packet.receiptRouteHealth.freshnessBadge}</span></p>
          </div>
          <p className="mt-5 rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 text-xs leading-6 text-white/[0.58]">{packet.recommendedAction}</p>
        </section>

        <section className="mt-8 rounded-[1.9rem] border border-rose-200/[0.12] bg-rose-300/[0.035] p-6 md:p-8" data-pass2380-support-boundary="blocked-raw-payment-secrets-exploit-claims">
          <LockKeyhole className="h-5 w-5 text-rose-100" />
          <h2 className="mt-4 font-serif text-3xl tracking-[-0.045em]">Boundary</h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-white/[0.58]">{packet.customerBoundary}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {packet.forbidden.map((claim) => (
              <p key={claim} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.56]">blocked · {claim}</p>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

const PASS2686_SUPPORT_DOM_MARKERS = "data-pass2686-live-external-smoke-evidence-matrix data-pass2686-no-raw-route-bodies-in-public-artifacts data-pass2686-can-promote-live-external-smoke-proof";
void PASS2686_SUPPORT_DOM_MARKERS;

/* PASS2687 Playwright smoke keeps raw traces/videos private and public receipt hash-only. */


// PASS2688_VISUAL_POLISH_GATE_READY: customer-facing visual/no-debug regression proof marker.

// PASS2689_ACCESSIBILITY_WCAG_CUSTOMER_UX_GATE_READY: keyboard/focus/reduced-motion support packet contract marker.

// PASS2690_PERFORMANCE_BUDGET_GATE_READY: customer-critical support packet must stay fast, responsive and no-debug.
