# Velmère monitoring and recovery runbook

Scope: C14-P26. This runbook covers runtime diagnosis and recovery for web, durable workers, Redis, PostgreSQL/Supabase, Stripe webhooks, provider calls, report generation and durable storage.

## Operator entry point

Use the authenticated internal worker route:

`GET /api/internal/workers/runtime-readiness`

The route is read-only, rate-limited and protected by the existing internal-worker/cron authentication boundary. It returns only aggregate operational state, safe reason codes, latency/count metrics and a request correlation ID. It must never be exposed as a public status endpoint.

HTTP meaning:
- `200`: every mapped critical component is `ready`.
- `503`: at least one component is `degraded` or `blocked`.
- `401`: operator/worker authentication is missing or invalid.
- `429`: the readiness endpoint itself is rate-limited.

Every response carries `x-correlation-id`. Use that value to join the request with structured operational logs.

## Component map and primary signals

| Component | Primary signal | Retry visibility | Dead-letter visibility | Durable source |
| --- | --- | --- | --- | --- |
| web | readiness handler can execute | n/a | n/a | runtime |
| worker | durable-computation operational snapshot + worker keyring readiness | yes | yes | Supabase RPC |
| Redis | active bounded PING through server-owned configuration | n/a | n/a | Redis |
| PostgreSQL/Supabase | bounded durable-computation metrics RPC succeeds | n/a | n/a | Supabase/PostgreSQL |
| Stripe webhooks | webhook/server secrets configured + reconciliation path ready | yes | yes | Supabase reconciliation |
| provider calls | signed provider-health snapshot validity/freshness/durability | circuit/recovery probe visible | provider circuits, not a DLQ | Supabase provider-health store |
| report generation | `audit_pdf_render` + `lens_pdf_render` durable-worker aggregates | yes | yes | durable computation store |
| storage | service-role durable store configured and reachable | n/a | n/a | Supabase/PostgreSQL |

A configuration check is not treated as connectivity proof. Redis uses an active PING. Supabase/PostgreSQL readiness uses an actual bounded operational RPC. Provider readiness requires a fresh, valid signed health snapshot.

## Structured logging and privacy boundary

Operational records use `lib/security/operational-log-boundary.ts`.

Allowed:
- UTC timestamp,
- safe system/event/code tokens,
- generated request correlation ID,
- aggregate counts/latencies/booleans,
- SHA-256 hashes of identifiers where an identifier is necessary for joining evidence,
- safe error class/code.

Forbidden:
- secrets or credentials,
- Redis/PostgreSQL/Supabase URLs,
- Stripe signatures, webhook secrets or API keys,
- authorization/cookie/session tokens,
- raw provider payloads,
- raw Stripe webhook bodies,
- customer identifiers,
- raw job/event IDs,
- SQL,
- stack traces,
- raw exception messages.

If a debugging need cannot be met within this boundary, create a separate controlled forensic procedure instead of widening production logs.

## Alert keys

The runtime snapshot emits deterministic `<component>:<reason>` keys for non-ready components. Examples:

- `redis:redis_unavailable`
- `postgresql_supabase:rpc_deadline_exceeded`
- `worker:durable_worker_dead_letter_nonzero`
- `stripe_webhooks:stripe_alert_sink_not_configured`
- `provider_calls:provider_health_snapshot_stale`
- `report_generation:report_dead_letter_nonzero`
- `storage:durable_storage_unreachable`

Do not page on a raw error string. Alert on the stable reason key and inspect the correlation-linked structured records.

## Recovery: Redis unavailable

Symptoms:
- runtime component `redis` is `blocked`;
- reason `redis_unavailable` or `redis_configuration_invalid`;
- durable rate-limit decisions fail closed as unavailable.

Procedure:
1. Confirm `VELMERE_RATE_LIMIT_BACKEND=redis`.
2. Validate that the configured Redis URL satisfies the server-owned TLS/local policy. Do not print the URL.
3. Run the readiness endpoint and verify the active Redis probe becomes `ready`.
4. Confirm application rate limits resume `mode=redis`.
5. Do not enable a production in-memory fallback to make the health check green.

Success criterion: bounded PING succeeds and the Redis component is `ready`.

## Recovery: PostgreSQL/Supabase unavailable

Symptoms:
- `postgresql_supabase` blocked;
- worker/report/storage/Stripe may also block because their durable authority is unavailable;
- structured Supabase failures show only operation/capability hashes plus safe error code.

Procedure:
1. Confirm service-role configuration exists without printing keys.
2. Verify Supabase/PostgreSQL provider status and network reachability outside customer traffic.
3. Verify required migrations/RPCs are deployed.
4. Run the runtime readiness endpoint until the bounded operational RPC succeeds.
5. Only after durability is restored, drain normal retries.
6. Requeue dead letters only after the root cause is corrected.

Do not reclassify a memory fallback as durable recovery.

## Recovery: durable worker backlog or dead letter

Symptoms:
- `worker` degraded for retry backlog/expired leases;
- `worker` blocked for dead letters or critical operational severity.

Procedure:
1. Read the authenticated durable-computation operations snapshot.
2. Diagnose by aggregate metrics: processing, retry wait, dead letter, expired leases and oldest ages.
3. Restore dependency/keyring/storage failures first.
4. Run bounded worker drain/maintenance.
5. For explicit dead-letter recovery, use the authenticated `requeue_dead_letters` action with the intended job IDs and operator reason.
6. Verify dead-letter count returns to zero and no new critical alert is generated.

Never put job IDs into general operational logs.

## Recovery: Stripe webhook retry or dead letter

Symptoms:
- Stripe reconciliation reports retry-ready/stale/dead-letter effects;
- webhook handler emits `webhook_retry_scheduled` or `webhook_dead_lettered` structured events;
- `stripe_webhooks` may block if durable storage/reconciliation is unavailable.

Procedure:
1. Use aggregate reconciliation first; do not inspect or replay raw request bodies as a diagnostic shortcut.
2. Determine whether the root cause is storage, provider, entitlement or order processing using existing reconciliation buckets.
3. Correct the root cause.
4. Let Stripe retry retryable failures through the original signed delivery path.
5. For terminal dead letters, use the authenticated admin requeue endpoint with explicit event/effect/request identifiers only after repair and required approval.
6. Re-run reconciliation and confirm dead-letter/retry aggregates clear.
7. Verify alert delivery if an alert was required.

Do not log Stripe event IDs, signatures, checkout/customer payloads or webhook bodies.

## Recovery: provider calls

Symptoms:
- provider snapshot missing/invalid/stale;
- failed/degraded/open providers;
- provider health snapshot is only memory-backed.

Procedure:
1. Run bounded provider health/recovery probes.
2. Inspect signed health snapshot validity/freshness and provider aggregate statuses.
3. Resolve provider authentication, rate-limit, schema/identity or outage cause.
4. Wait for a successful recovery observation to rebuild a valid health state.
5. Paid evidence paths remain fail-closed until their provider-health durability/quorum policy is satisfied.
6. Do not promote a memory-only health snapshot as durable proof.

## Recovery: report generation

Report generation is represented by durable kinds:
- `audit_pdf_render`
- `lens_pdf_render`

Symptoms:
- `report_generation` degraded on retry backlog;
- blocked on dead-letter count, unreachable durable store or non-executable worker.

Procedure:
1. Inspect aggregate report-kind metrics.
2. Restore storage/provider/keyring dependency first.
3. Drain retry-wait jobs through the durable worker.
4. Requeue report dead letters only after the cause is fixed.
5. Verify report retries/dead letters return to zero.
6. Independently verify the customer artifact route after the worker is healthy; worker health alone does not prove a customer-visible report is valid.

## Recovery: storage

Symptoms:
- `storage` blocked;
- durable worker, reports, Stripe or provider health may cascade to blocked.

Procedure:
1. Restore Supabase/PostgreSQL durable connectivity and required schema/RPCs.
2. Verify bounded operational RPC success.
3. Verify downstream durable stores before requeueing side effects.
4. Do not claim recovery from runtime memory caches.
5. For any data-loss scenario, stop automated replay until backup/restore and consistency checks are complete.

## Failure drill checklist

For every production-like recovery drill record:
1. trigger/failure class,
2. first stable alert key,
3. correlation ID,
4. aggregate metrics before recovery,
5. root cause,
6. operator action,
7. aggregate metrics after recovery,
8. confirmation that no secret/customer/raw payload appeared in logs,
9. whether retry or dead-letter replay was required,
10. unresolved external dependency or manual gate.

## Known limitations

This C14-P26 layer improves in-product observability and recovery evidence, but it is not:
- an external uptime monitor,
- an external alert-management/on-call service,
- proof that hosted production secrets are configured,
- proof of successful Stripe TEST-mode delivery,
- proof of a real provider outage/recovery observed over time,
- a backup/restore execution,
- an external independent operational audit.

Those items require hosted/environment-specific evidence and should remain separate release gates.
