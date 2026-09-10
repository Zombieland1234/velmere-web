import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { runRegisteredServiceRoleRpc, type SupabaseRpcOperation } from "@/lib/db/supabase-rpc-operation-registry";
import { probeDurableComputationStaging } from "@/lib/jobs/durable-computation-staging";
import { getProviderObservationPromotionQuality } from "@/lib/market-integrity/provider-observation-quarantine";
import { getProviderQualityIncidentGate } from "@/lib/market-integrity/provider-quality-incident-response";
import { getProviderQualityRollbackRecoveryGate } from "@/lib/market-integrity/provider-quality-auto-rollback";
import { normalizePaidContext } from "@/lib/commerce/vlm-paid-access";
import { createVlmPaidAccessToken, hashVlmPaidAccessContext } from "@/lib/commerce/vlm-paid-access-server";
import { upsertVlmPaidEntitlementFromDemoReceipt, verifyVlmPaidAccessEntitlement } from "@/lib/commerce/vlm-entitlement-ledger";
import { applyVlmPaidEntitlementLifecycleEvent } from "@/lib/commerce/vlm-entitlement-lifecycle";
import { reconcileProviderQuorum } from "@/lib/market-integrity/provider-quorum-reconciliation";
import { evaluateProviderEvidenceTier } from "@/lib/market-integrity/provider-evidence-tier-policy";

type EnvLike = Record<string, string | undefined>;
type RpcRunner = (input: { operation: SupabaseRpcOperation; args?: Record<string, unknown> }) => Promise<{ data: unknown }>;
export type ProviderRecoverySmokeKind = "customer_path" | "provider_path";
export type ProviderRecoverySmokeCheck = { name: string; ok: boolean };
export type ProviderRecoverySmokeResult = {
  kind: ProviderRecoverySmokeKind;
  ok: boolean;
  checksPassed: number;
  checksTotal: number;
  resultDigest: string;
  checks: ProviderRecoverySmokeCheck[];
};

type Dependencies = {
  rpc: RpcRunner;
  now: () => Date;
  probe: typeof probeDurableComputationStaging;
  providerQuality: typeof getProviderObservationPromotionQuality;
  incidentGate: typeof getProviderQualityIncidentGate;
  rollbackGate: typeof getProviderQualityRollbackRecoveryGate;
  customerRunner: (input: { now: Date; chainDigest: string }) => Promise<ProviderRecoverySmokeResult>;
  providerRunner: (input: { now: Date; chainDigest: string }) => Promise<ProviderRecoverySmokeResult>;
};

const defaultDependencies: Dependencies = {
  rpc: runRegisteredServiceRoleRpc,
  now: () => new Date(),
  probe: probeDurableComputationStaging,
  providerQuality: getProviderObservationPromotionQuality,
  incidentGate: getProviderQualityIncidentGate,
  rollbackGate: getProviderQualityRollbackRecoveryGate,
  customerRunner: runLocalCustomerRecoverySmoke,
  providerRunner: runLocalProviderRecoverySmoke,
};

function clean(value: unknown) { return String(value ?? "").trim(); }
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function isSha(value: string) { return /^[0-9a-f]{64}$/.test(value); }
function usableSecret(value: string) { return value.length >= 32 && !/(example|placeholder|changeme|dummy|replace[-_ ]?me|never[-_ ]?production)/i.test(value); }
function exactCheckpoint(value: unknown) { const n = Number(value); return Number.isInteger(n) && n >= 4725 && n <= 999999 ? n : null; }
function row(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return data.find((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object")) ?? null;
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}
function checkResult(kind: ProviderRecoverySmokeKind, checks: ProviderRecoverySmokeCheck[]): ProviderRecoverySmokeResult {
  const normalized = checks.map((entry) => ({ name: clean(entry.name).slice(0, 120), ok: Boolean(entry.ok) }));
  const checksPassed = normalized.filter((entry) => entry.ok).length;
  return {
    kind,
    ok: checksPassed === normalized.length && normalized.length > 0,
    checksPassed,
    checksTotal: normalized.length,
    resultDigest: sha256(JSON.stringify({ kind, checks: normalized })),
    checks: normalized,
  };
}

export async function runLocalCustomerRecoverySmoke(input: { now: Date; chainDigest: string }): Promise<ProviderRecoverySmokeResult> {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") throw new Error("provider_recovery_customer_smoke_local_only");
  const accountIdHash = sha256(`recovery-smoke-account|${input.chainDigest}`);
  const context = normalizePaidContext({ surface: "shield", locale: "en", assetId: "bitcoin", symbol: "BTC", depth: "advanced", requestId: `recovery-${input.chainDigest.slice(0, 16)}`, accountIdHash }, "en");
  const productId = "vlm_advanced_analysis_single" as const;
  const contextHash = hashVlmPaidAccessContext(context);
  const sessionId = `vlm_demo_${productId}_${contextHash.slice(0, 16)}_${input.chainDigest.slice(0, 12)}`;
  const receipt = await upsertVlmPaidEntitlementFromDemoReceipt({ sessionId, productId, context, now: input.now });
  if (!receipt.ok) return checkResult("customer_path", [{ name: "verified_receipt", ok: false }]);
  const token = createVlmPaidAccessToken({ productId, context, sessionId, now: input.now, ttlMs: 86_400_000 });
  const active = token.ok ? await verifyVlmPaidAccessEntitlement({ token: token.token, productId, context, now: input.now }) : null;
  const wrong = token.ok ? await verifyVlmPaidAccessEntitlement({ token: token.token, productId, context: { ...context, symbol: "ETH" }, now: input.now }) : null;
  const refund = await applyVlmPaidEntitlementLifecycleEvent({ entitlementId: receipt.record.id, eventId: `recovery-refund-${input.chainDigest}`, event: "refund", now: new Date(input.now.getTime() + 1_000) });
  const blocked = token.ok ? await verifyVlmPaidAccessEntitlement({ token: token.token, productId, context, now: new Date(input.now.getTime() + 2_000) }) : null;
  const restore = await applyVlmPaidEntitlementLifecycleEvent({ entitlementId: receipt.record.id, eventId: `recovery-restore-${input.chainDigest}`, event: "restore", operatorId: "recovery-smoke-two-person-control", reason: "signed recovery smoke restore validation", now: new Date(input.now.getTime() + 3_000) });
  const restored = token.ok ? await verifyVlmPaidAccessEntitlement({ token: token.token, productId, context, now: new Date(input.now.getTime() + 4_000) }) : null;
  const chargeback = await applyVlmPaidEntitlementLifecycleEvent({ entitlementId: receipt.record.id, eventId: `recovery-chargeback-${input.chainDigest}`, event: "chargeback", now: new Date(input.now.getTime() + 5_000) });
  const finalBlocked = token.ok ? await verifyVlmPaidAccessEntitlement({ token: token.token, productId, context, now: new Date(input.now.getTime() + 6_000) }) : null;
  return checkResult("customer_path", [
    { name: "verified_receipt_created_entitlement", ok: receipt.record.status === "active" },
    { name: "server_token_minted", ok: token.ok },
    { name: "active_entitlement_unlocked", ok: Boolean(active?.ok) },
    { name: "wrong_context_denied", ok: Boolean(wrong && !wrong.ok && wrong.error === "context_mismatch") },
    { name: "refund_blocked_old_token", ok: Boolean(refund.ok && blocked && !blocked.ok && blocked.error === "entitlement_inactive") },
    { name: "controlled_restore_unlocked", ok: Boolean(restore.ok && restored?.ok) },
    { name: "chargeback_blocked_delivery", ok: Boolean(chargeback.ok && finalBlocked && !finalBlocked.ok && finalBlocked.error === "entitlement_inactive") },
  ]);
}

export async function runLocalProviderRecoverySmoke(input: { now: Date; chainDigest: string }): Promise<ProviderRecoverySmokeResult> {
  const nowSeconds = Math.floor(input.now.getTime() / 1000);
  const expectedIdentity = { assetId: "RECOVERY-SMOKE", quoteCurrency: "USD", observationWindow: "latest_quote" };
  const observation = (providerId: string, providerFamily: string, price: number, sourceTimestamp: number) => ({
    providerId,
    providerFamily,
    resolvedAssetId: expectedIdentity.assetId,
    resolvedSymbol: expectedIdentity.assetId,
    quoteCurrency: expectedIdentity.quoteCurrency,
    observationWindow: expectedIdentity.observationWindow,
    source: providerId,
    price,
    sourceTimestamp,
    evidenceEligible: true,
    valueSha256: sha256(`${providerId}|${price}|${sourceTimestamp}`),
  });
  const aligned = reconcileProviderQuorum({ assetClass: "stock", expectedIdentity, nowSeconds, primary: observation("primary", "primary-root", 100, nowSeconds), secondary: observation("secondary", "secondary-root", 100.1, nowSeconds - 60) });
  const alignedTier = evaluateProviderEvidenceTier({ requestedTier: "Advanced", quorum: aligned });
  const divergent = reconcileProviderQuorum({ assetClass: "stock", expectedIdentity, nowSeconds, primary: observation("primary", "primary-root", 100, nowSeconds), secondary: observation("secondary", "secondary-root", 135, nowSeconds - 60) });
  const divergentTier = evaluateProviderEvidenceTier({ requestedTier: "Advanced", quorum: divergent });
  const single = reconcileProviderQuorum({ assetClass: "stock", expectedIdentity, nowSeconds, primary: observation("primary", "primary-root", 100, nowSeconds), secondary: null });
  const singleTier = evaluateProviderEvidenceTier({ requestedTier: "Advanced", quorum: single });
  return checkResult("provider_path", [
    { name: "aligned_dual_source_detected", ok: aligned.state === "aligned" && aligned.comparability === "exact_window" },
    { name: "aligned_advanced_evidence_allowed", ok: alignedTier.maxEvidenceTier === "Advanced" && alignedTier.freshPaidEvidenceAllowed },
    { name: "divergence_detected", ok: divergent.state === "divergent" },
    { name: "divergence_downgrades_paid_claim", ok: divergentTier.downgradeRequired && !divergentTier.freshPaidEvidenceAllowed },
    { name: "single_source_downgrades_paid_claim", ok: singleTier.maxEvidenceTier === "Basic" && singleTier.downgradeRequired },
    { name: "receipt_digest_bound_to_results", ok: isSha(aligned.observationDigest) && isSha(divergent.observationDigest) && input.chainDigest.length === 64 },
  ]);
}

export type ProviderRecoverySmokeReceiptRequest = {
  kind: ProviderRecoverySmokeKind;
  rollbackExecutionDigest: string;
  incidentDigest: string;
  qualityDigest: string;
  capabilityDigest: string;
  sourceSha256: string;
  buildSha256: string;
  exactCheckpoint: number;
  resultDigest: string;
  checksPassed: number;
  checksTotal: number;
  executedAt: number;
  expiresAt: number;
  approvalNonce: string;
  approvalSignature: string;
};

function canonicalReceipt(input: Omit<ProviderRecoverySmokeReceiptRequest, "approvalSignature">) {
  return JSON.stringify(input);
}
export function signProviderRecoverySmokeReceipt(input: Omit<ProviderRecoverySmokeReceiptRequest, "approvalSignature">, secret: string) {
  if (!usableSecret(secret)) throw new Error("provider_recovery_smoke_secret_missing_or_weak");
  return createHmac("sha256", secret).update(canonicalReceipt(input)).digest("hex");
}
function verifyReceiptSignature(request: ProviderRecoverySmokeReceiptRequest, env: EnvLike, now: Date) {
  const secret = clean(env.VELMERE_PROVIDER_RECOVERY_SMOKE_SECRET);
  if (!usableSecret(secret)) throw new Error("provider_recovery_smoke_secret_missing_or_weak");
  if (!isSha(request.approvalSignature) || !isSha(request.resultDigest)) throw new Error("provider_recovery_smoke_digest_invalid");
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (Math.abs(nowSeconds - request.executedAt) > 300 || request.expiresAt <= nowSeconds || request.expiresAt - request.executedAt > 3_600) throw new Error("provider_recovery_smoke_freshness_invalid");
  const { approvalSignature: _signature, ...unsigned } = request;
  const expected = signProviderRecoverySmokeReceipt(unsigned, secret);
  const a = Buffer.from(expected, "hex"); const b = Buffer.from(request.approvalSignature, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("provider_recovery_smoke_signature_mismatch");
}

function releaseEvidence(env: EnvLike) {
  const sourceSha256 = clean(env.VELMERE_DURABLE_EXACT_SOURCE_SHA256).toLowerCase();
  const buildSha256 = clean(env.VELMERE_DURABLE_EXACT_BUILD_SHA256).toLowerCase();
  const checkpoint = exactCheckpoint(env.VELMERE_DURABLE_EXACT_CHECKPOINT);
  return { sourceSha256: isSha(sourceSha256) ? sourceSha256 : null, buildSha256: isSha(buildSha256) ? buildSha256 : null, exactCheckpoint: checkpoint };
}

export async function executeProviderRecoverySmokeSuite(input: { env?: EnvLike; dependencies?: Partial<Dependencies> }) {
  const env = input.env ?? process.env; const dependencies = { ...defaultDependencies, ...input.dependencies }; const now = dependencies.now();
  const productionLike = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  if (productionLike && dependencies.customerRunner === defaultDependencies.customerRunner) throw new Error("provider_recovery_smoke_live_executor_not_configured");
  const release = releaseEvidence(env); if (!release.sourceSha256 || !release.buildSha256 || !release.exactCheckpoint) throw new Error("provider_recovery_smoke_exact_release_missing");
  const probe = await dependencies.probe({ env }); if (!probe.stagingProven || !probe.capabilityDigest) throw new Error("provider_recovery_smoke_staging_not_proven");
  const quality = await dependencies.providerQuality(); if (!quality.ready) throw new Error("provider_recovery_smoke_quality_not_proven");
  const incident = await dependencies.incidentGate({ expectedQualityDigest: quality.qualityDigest }); if (!incident.ready || incident.state !== "resolved" || incident.qualityStableAgeSeconds < 900) throw new Error("provider_recovery_smoke_incident_not_resolved");
  const rollback = await dependencies.rollbackGate({ env }); if (!rollback.executionVerified || !rollback.promotionReentryReady || !rollback.executionDigest) throw new Error("provider_recovery_smoke_rollback_not_verified");
  const chain = { rollbackExecutionDigest: rollback.executionDigest, incidentDigest: incident.incidentDigest, qualityDigest: quality.qualityDigest, capabilityDigest: probe.capabilityDigest, sourceSha256: release.sourceSha256, buildSha256: release.buildSha256, exactCheckpoint: release.exactCheckpoint };
  const chainDigest = sha256(JSON.stringify(chain));
  const [customer, provider] = await Promise.all([dependencies.customerRunner({ now, chainDigest }), dependencies.providerRunner({ now, chainDigest })]);
  if (!customer.ok || !provider.ok) throw new Error("provider_recovery_smoke_suite_failed");
  const secret = clean(env.VELMERE_PROVIDER_RECOVERY_SMOKE_SECRET); const executedAt = Math.floor(now.getTime() / 1000); const expiresAt = executedAt + 1_800;
  const recorded: Record<string, { receiptDigest: string; resultDigest: string }> = {};
  for (const result of [customer, provider]) {
    const unsigned = { kind: result.kind, ...chain, resultDigest: result.resultDigest, checksPassed: result.checksPassed, checksTotal: result.checksTotal, executedAt, expiresAt, approvalNonce: sha256(`${result.kind}|${chainDigest}|${executedAt}`).slice(0, 32) };
    const request: ProviderRecoverySmokeReceiptRequest = { ...unsigned, approvalSignature: signProviderRecoverySmokeReceipt(unsigned, secret) };
    verifyReceiptSignature(request, env, now);
    const { data } = await dependencies.rpc({ operation: "provider_recovery_smoke_receipt_record", args: {
      p_kind: request.kind, p_rollback_execution_digest: request.rollbackExecutionDigest, p_incident_digest: request.incidentDigest, p_quality_digest: request.qualityDigest, p_capability_digest: request.capabilityDigest, p_source_sha256: request.sourceSha256, p_build_sha256: request.buildSha256, p_exact_checkpoint: request.exactCheckpoint, p_result_digest: request.resultDigest, p_checks_passed: request.checksPassed, p_checks_total: request.checksTotal, p_executed_at: new Date(request.executedAt * 1000).toISOString(), p_expires_at: new Date(request.expiresAt * 1000).toISOString(), p_approval_digest: sha256(canonicalReceipt(unsigned)),
    } });
    const value = row(data); const receiptDigest = clean(value?.receipt_digest).toLowerCase(); if (!isSha(receiptDigest) || value?.verified !== true) throw new Error("provider_recovery_smoke_receipt_record_failed");
    recorded[result.kind] = { receiptDigest, resultDigest: result.resultDigest };
  }
  const gate = await getProviderRecoverySmokeGate({ expected: chain, dependencies: { rpc: dependencies.rpc }, now });
  if (!gate.ready) throw new Error("provider_recovery_smoke_gate_not_ready");
  return { schemaVersion: "velmere.provider-recovery-smoke-suite.v1" as const, ok: true, chainDigest, customer, provider, gate, recorded, privacyBoundary: "Only aggregate check counts and SHA-256 digests are persisted. No account, token, entitlement, price, symbol, provider payload or model response is stored." };
}

export async function getProviderRecoverySmokeGate(input: { expected: { rollbackExecutionDigest: string; incidentDigest: string; qualityDigest: string; capabilityDigest: string; sourceSha256: string; buildSha256: string; exactCheckpoint: number }; dependencies?: Pick<Dependencies, "rpc">; now?: Date }) {
  const dependencies = input.dependencies ?? defaultDependencies; const now = input.now ?? new Date();
  const { data } = await dependencies.rpc({ operation: "provider_recovery_smoke_receipt_status", args: { p_rollback_execution_digest: input.expected.rollbackExecutionDigest, p_incident_digest: input.expected.incidentDigest, p_quality_digest: input.expected.qualityDigest, p_capability_digest: input.expected.capabilityDigest, p_source_sha256: input.expected.sourceSha256, p_build_sha256: input.expected.buildSha256, p_exact_checkpoint: input.expected.exactCheckpoint, p_now: now.toISOString() } });
  const value = row(data); if (!value) return { schemaVersion: "velmere.provider-recovery-smoke-gate.v1" as const, ready: false, customerSmokeDigest: null, providerSmokeDigest: null, blockers: ["provider_recovery_smoke_store_empty"] };
  const customerSmokeDigest = clean(value.customer_receipt_digest).toLowerCase(); const providerSmokeDigest = clean(value.provider_receipt_digest).toLowerCase();
  const blockers = Array.isArray(value.blockers) ? value.blockers.map(clean).filter(Boolean) : [];
  const ready = value.ready === true && isSha(customerSmokeDigest) && isSha(providerSmokeDigest) && blockers.length === 0;
  return { schemaVersion: "velmere.provider-recovery-smoke-gate.v1" as const, ready, customerSmokeDigest: isSha(customerSmokeDigest) ? customerSmokeDigest : null, providerSmokeDigest: isSha(providerSmokeDigest) ? providerSmokeDigest : null, blockers, privacyBoundary: "Gate exposes only receipt digests and blocker codes." };
}
