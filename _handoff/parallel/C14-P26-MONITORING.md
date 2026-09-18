# C14-P26 — Monitoring / Recovery

## Result

- Repository: `Zombieland1234/velmere-web`
- Base SHA: `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`
- Branch: `parallel/c14-p26-monitoring-recovery`
- Qualified implementation SHA before this handoff: `43d18b928e132f96631d01711513fc81d82c27da`
- Qualification workflow: `.github/workflows/c14-p26-monitoring.yml`
- Qualification run: `35292905310`
- Qualification job: `105439446754`
- Merge performed: **NO**
- C13 monitoring/recovery score: **5/10**
- C14-P26 evidence-based score: **8/10**
- Release implication: this work materially improves internal observability/recovery, but does **not** by itself prove hosted production readiness or change any separate release `NO_GO` gate.

Why 8/10 instead of 10/10: the repository now has a coherent internal readiness model, active Redis and durable Supabase signals, correlation, structured privacy-bounded failure logs, retry/dead-letter visibility and runbooks. It still lacks independent external uptime/synthetic monitoring, hosted alert/on-call proof, production-environment recovery drills, backup/restore proof and current real Stripe/provider incident evidence.

## Qualification

Final implementation qualification at `43d18b928e132f96631d01711513fc81d82c27da`:

- locked dependency install: **PASS**
- `git diff --check`: **PASS**
- focused strict TypeScript: **PASS**
- focused ESLint: **PASS**
- failure/recovery tests: **12/12 PASS**
- failures: **0**

The first qualification attempt correctly failed strict TypeScript because three Redis test fixtures were unsafely cast to `NodeJS.ProcessEnv`. The fixtures were fixed rather than weakening the typecheck. The following full qualification passed. Later, the Stripe durable failure-code privacy boundary received a dedicated regression test; the final implementation run above passed with 12 tests.

## Critical component map

| Component | C13 / base gap observed | C14-P26 signal / recovery surface | Result |
| --- | --- | --- | --- |
| web | no single operator view spanning runtime dependencies | authenticated `GET /api/internal/workers/runtime-readiness`, correlation header, structured readiness event | **IMPROVED** |
| worker | strong durable metrics existed but were isolated | worker executable state + processing/retry/DLQ/expired-lease/age aggregates included in unified snapshot | **IMPROVED** |
| Redis | configuration/fail-closed limiter existed; no active readiness probe | bounded active PING with safe latency/code; no URL/credential output | **FIXED GAP** |
| PostgreSQL / Supabase | bounded RPC existed; failure logging/correlation was weak | bounded RPC failures now emit privacy-bounded structured operational records; runtime readiness uses a real operational RPC, not config-only | **IMPROVED** |
| Stripe webhooks | reconciliation, retry, DLQ and alert sink existed but request failure path used ad-hoc logging and raw error message could be persisted as failure code | request correlation, structured retry/DLQ/dependency logs, stable safe persisted failure codes, existing reconciliation/DLQ paths retained | **FIXED GAP** |
| provider calls | signed health snapshots/circuit/recovery mechanisms existed, but not part of one runtime view | fresh/valid/durable provider-health status and aggregate failed/blocker counts included in unified readiness | **IMPROVED** |
| report generation | durable kinds existed but operator had to infer report health from generic worker data | `audit_pdf_render` + `lens_pdf_render` processing/retry/DLQ/completed aggregates exposed as a separate report-generation component | **FIXED GAP** |
| storage | several durable paths existed, but no single runtime dependency state | durable configuration + actual Supabase operational reachability mapped to storage readiness | **IMPROVED** |

## Implemented changes

### 1. Structured operational log boundary

Modified:

`lib/security/operational-log-boundary.ts`

Added:
- UTC `occurredAt`;
- bounded `correlationId`;
- exported event input type for reusable observability producers.

Preserved:
- identifier hashing;
- no raw identifiers;
- no raw error message;
- no stack;
- bounded record size.

### 2. Request / correlation IDs

Added:

`lib/observability/request-correlation.ts`

Behavior:
- accepts only bounded Velmère-shaped `req_<32 hex>` incoming IDs;
- rejects arbitrary supplied IDs and generates a secure request ID;
- emits `x-correlation-id` on responses;
- does not accept arbitrary bearer/token-like text as a correlation value.

This is deliberately narrower than trusting arbitrary upstream `x-request-id` values.

### 3. Redis readiness

Modified:

`lib/security/native-redis-rate-limit.ts`

Added:
- active bounded PING probe;
- states `ready / not_configured / unavailable`;
- safe latency and stable code;
- dependency-injected client for failure testing;
- structured failure log without Redis URL, credentials or raw driver message.

Existing production rule remains: rate limiting fails closed; C14-P26 does not introduce a memory fallback.

### 4. Supabase / PostgreSQL RPC observability

Modified:

`lib/db/bounded-supabase-rpc.ts`

Added:
- optional correlation propagation;
- structured records for capability unavailable, provider failure, abort and deadline failure;
- aggregate duration/deadline/aborted metrics;
- operation/capability/provider-code values are sent only through the identifier hashing boundary.

No raw provider message, SQL, URL or stack is logged.

### 5. Unified runtime readiness

Added:

`lib/observability/runtime-readiness.ts`

Mapped exactly:
- `web`
- `worker`
- `redis`
- `postgresql_supabase`
- `stripe_webhooks`
- `provider_calls`
- `report_generation`
- `storage`

Each component returns:
- `ready / degraded / blocked`;
- stable reason codes;
- safe aggregate metrics;
- retry visibility flag;
- dead-letter visibility flag;
- operator recovery action.

The snapshot also returns deterministic alert keys in the form:

`<component>:<reason_code>`

Examples:
- `redis:redis_unavailable`
- `postgresql_supabase:rpc_deadline_exceeded`
- `worker:durable_worker_dead_letter_nonzero`
- `report_generation:report_dead_letter_nonzero`

### 6. Authenticated operator readiness route

Added:

`lib/server/internal-worker-route-modules/runtime-readiness.ts`

Registered in:

`lib/server/route-registries/internal-workers.ts`

Route:

`GET /api/internal/workers/runtime-readiness`

Properties:
- existing internal-worker/cron authentication;
- rate limited;
- `cache-control: no-store`;
- noindex;
- correlation ID;
- 200 only when all mapped critical components are ready;
- 503 for degraded/blocked runtime state;
- 401 for invalid operator auth.

Important boundary: this is an **internal operator endpoint**, not a public status page.

### 7. Stripe webhook recovery logging and durable failure privacy

Modified:

`lib/payments/stripe-webhook/ingress.ts`

Added:
- request correlation;
- structured `webhook_retry_scheduled`;
- structured `webhook_dead_lettered`;
- structured `webhook_dependency_unavailable`;
- correlation header on webhook responses.

Added:

`lib/payments/stripe-webhook/failure-code.ts`

A base issue was found during P26 review: the webhook path previously persisted up to 160 characters of `error.message` as the durable failure code. That could preserve unnecessary sensitive/downstream text even though it was not console logging.

C14-P26 now persists:
- a strict safe token if the error is already a stable code; otherwise
- `webhook_processing_failed`.

Raw URLs, keys, SQL-like text and downstream messages are not used as the durable failure code.

### 8. Recovery runbook

Added:

`docs/operations/MONITORING_RECOVERY.md`

Includes:
- operator entry point;
- component map;
- status semantics;
- alert-key use;
- logging/privacy rules;
- Redis recovery;
- Supabase/PostgreSQL recovery;
- durable-worker retry/DLQ recovery;
- Stripe retry/DLQ recovery;
- provider recovery;
- report-generation recovery;
- storage recovery;
- failure-drill checklist;
- limitations.

### 9. Qualification automation

Added:

`.github/workflows/c14-p26-monitoring.yml`

Added focused strict typecheck config:

`tsconfig.c14-p26.json`

The workflow runs against the branch head and checks:
- locked dependency install;
- patch whitespace;
- strict TypeScript for P26 surfaces;
- ESLint for P26 surfaces;
- failure/recovery tests.

## Failure / recovery tests

Added:

`scripts/c14/monitoring-recovery.test.ts`

Final qualified set: **12/12 PASS**.

Covered cases:

1. valid bounded request correlation ID is retained;
2. attacker-controlled bearer/secret-like correlation input is rejected;
3. structured operational log contains timestamp/correlation but hashes identifiers and omits raw error/stack;
4. invalid Redis configuration returns safe not-configured state and never echoes URL credentials/host;
5. Redis connection failure returns `redis_unavailable` and raw driver error does not enter structured logs;
6. successful Redis PING becomes ready and closes the client;
7. Stripe durable failure state accepts stable error codes but rejects raw URL/secret-like messages;
8. Supabase RPC provider failure emits a redacted structured record and does not expose raw RPC/provider message;
9. all eight healthy components produce overall `ready`;
10. Redis outage produces deterministic blocked diagnosis + alert key;
11. worker retry backlog is visible as aggregate degraded state without job/customer/event IDs;
12. report DLQ and database outage drills prove blocked diagnosis and cascading durable dependency visibility.

The database outage drill verifies that a durable-store failure makes the relevant dependent lanes diagnosable as blocked rather than silently appearing healthy.

## Existing recovery machinery retained and reused

P26 deliberately did not create duplicate queues/recovery systems.

Reused existing mechanisms include:
- Stripe reconciliation aggregates;
- Stripe alert sink;
- Stripe dead-letter admin requeue;
- durable-computation operations snapshot;
- durable-computation maintenance;
- durable-computation dead-letter requeue;
- durable worker lease/heartbeat/retry model;
- provider signed health snapshot;
- provider recovery probes/circuit state;
- bounded Supabase RPC deadlines;
- fail-closed Redis-backed rate limiting.

## Privacy / secret review

P26 logging contract intentionally excludes:
- Redis/Supabase/PostgreSQL URLs;
- Stripe signatures/secrets/API keys;
- authorization/cookie/session values;
- raw provider bodies;
- raw Stripe webhook bodies;
- customer identifiers;
- raw job IDs;
- raw event IDs;
- SQL;
- stack traces;
- raw error messages.

Identifiers passed to the operational boundary are SHA-256 hashed. The unified readiness response uses aggregate counts and stable reason codes only.

## Remaining monitoring / recovery gaps

These are still open and are why the result is 8/10, not 10/10.

### P0 / hosted evidence

1. **No independent external synthetic uptime monitor is proven.**
   The internal route cannot prove the site is reachable from outside the hosting platform.

2. **No hosted production alert/on-call delivery evidence for the unified alert keys.**
   Stripe has an alert sink path, but P26 does not prove a complete production incident-routing destination, escalation ownership or acknowledgement workflow for all components.

3. **No real production-environment fault injection.**
   The 12 tests are controlled failure drills with real code boundaries and dependency fakes where required. They are not proof of deliberately taking down production Redis/Supabase/Stripe/provider services.

4. **No backup/restore disaster-recovery execution.**
   Storage diagnostics exist, but a real restore with measured RPO/RTO remains separate work.

### P1 / integration evidence

5. **No fresh Stripe TEST-mode webhook outage/recovery proof was generated by P26.**
   Existing retry/reconcile/DLQ code is mapped and tested at the boundary, but hosted TEST-mode evidence remains environment work.

6. **No fresh real provider outage/recovery sequence was generated by P26.**
   The product's signed provider-health and recovery-probe mechanisms are surfaced, but current external provider behavior was not manufactured or claimed.

7. **Readiness is diagnostic, not a replacement for service-specific dashboards.**
   Aggregate state intentionally does not expose raw IDs/payloads. Deep incident forensics still requires authorized service-specific evidence.

## Score rationale: 5/10 -> 8/10

C13 already had meaningful pieces: Stripe reconciliation/DLQ, durable worker telemetry/requeue, provider health, bounded I/O and some redaction. The problem was fragmentation and several blind spots.

P26 raises the score because it adds:
- one authenticated operator view over all requested components;
- active Redis connectivity proof;
- real durable Supabase operational reachability signal;
- correlation IDs;
- structured failure events;
- explicit retry/DLQ visibility;
- separate report-generation health;
- privacy-bounded Stripe durable failure codes;
- deterministic alert keys;
- recovery runbook;
- 12 passing fault/recovery regressions;
- CI qualification of the changed surfaces.

The missing 2 points require hosted/external operational evidence, not more optimistic repository claims.
