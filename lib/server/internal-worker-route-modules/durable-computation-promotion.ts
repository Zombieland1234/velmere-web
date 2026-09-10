import { NextResponse } from "next/server";
import {
  authorizeMarketIntegrityCron,
  authorizeMarketIntegrityWorkerMutation,
  marketIntegrityWorkerMutationErrorStatus,
  verifyMarketIntegrityWorkerMutationEnvelope,
} from "@/lib/security/market-integrity-cron-auth";
import { applyApiRateLimit } from "@/lib/security/api-guard";
import {
  applyDurableComputationPromotion,
  getDurableComputationPromotionReadiness,
  type DurableComputationPromotionRequest,
} from "@/lib/jobs/durable-computation-promotion";
import { reconcileDurableComputationAlertOutbox } from "@/lib/jobs/durable-computation-alert-reconciliation";
import { recordProviderQualityRecoveryProof, type ProviderQualityRecoveryProofRequest } from "@/lib/market-integrity/provider-quality-recovery-proof";
import { executeProviderRecoverySmokeSuite } from "@/lib/market-integrity/provider-recovery-smoke";
import { recordProviderRecoveryReleaseCertificate, type ProviderRecoveryReleaseCertificateRequest } from "@/lib/market-integrity/provider-recovery-release-certificate";
import { recordProviderRecoveryReleaseBundle, type ProviderRecoveryReleaseBundleRequest } from "@/lib/market-integrity/provider-recovery-release-bundle";
import { recordReleaseCandidateAttestation, type ReleaseCandidateAttestationRequest } from "@/lib/market-integrity/release-candidate-attestation";
import { recordReleaseProvenanceIndex, type ReleaseProvenanceIndexRequest } from "@/lib/market-integrity/release-provenance-index";
import { applyReleaseTransparencyWitnessPolicy, reconcileReleaseTransparencyWitnessHealth, type ReleaseTransparencyWitnessPolicyRequest } from "@/lib/market-integrity/release-transparency-witness-health";
import { applyReleaseTransparencyWitnessHealthRecovery, type ReleaseTransparencyWitnessHealthRecoveryRequest } from "@/lib/market-integrity/release-transparency-witness-health-recovery";
import { recordReleaseTransparencyWitnessRollbackResolution, verifyReleaseTransparencyWitnessRollbackResolution, type ReleaseTransparencyWitnessRollbackResolutionRequest } from "@/lib/market-integrity/release-transparency-witness-rollback-resolution";
import { publicApiError } from "@/lib/security/api-error-envelope";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

async function applyWorkerRateLimit(request: Request) {
  const rate = await applyApiRateLimit(request, {
    keyPrefix: "durable-computation-promotion",
    limit: 6,
    windowMs: 60_000,
  });
  return rate.ok ? null : rate.response;
}

async function authorizeReadOnly(request: Request) {
  const auth = authorizeMarketIntegrityCron(request);
  if (!auth.authorized) return json({ ok: false, error: "unauthorized_worker" }, 401);
  return applyWorkerRateLimit(request);
}

async function authorizeMutation(request: Request, rawBody: string) {
  const verified = verifyMarketIntegrityWorkerMutationEnvelope({ request, rawBody });
  if (!verified.authorized) {
    return json(
      { ok: false, error: "unauthorized_worker_mutation", reason: verified.error },
      marketIntegrityWorkerMutationErrorStatus(verified.error),
    );
  }
  const rateDenied = await applyWorkerRateLimit(request);
  if (rateDenied) return rateDenied;
  const consumed = await authorizeMarketIntegrityWorkerMutation({ request, rawBody });
  return consumed.authorized
    ? null
    : json(
        { ok: false, error: "unauthorized_worker_mutation", reason: consumed.error },
        marketIntegrityWorkerMutationErrorStatus(consumed.error),
      );
}

export async function GET(request: Request) {
  const denied = await authorizeReadOnly(request);
  if (denied) return denied;
  try {
    const action = new URL(request.url).searchParams.get("action");
    if (action === "reconcile_alerts") return json({ ok: false, error: "mutation_requires_post" }, 405);
    if (action && action !== "readiness") return json({ ok: false, error: "unsupported_action" }, 400);
    const readiness = await getDurableComputationPromotionReadiness();
    return json({ ok: readiness.ready, readiness }, readiness.ready ? 200 : 503);
  } catch (error) {
    return publicApiError(error, {
      route: "/api/internal/workers/durable-computation-promotion",
      code: "durable_computation_promotion_failed",
      status: 503,
      headers: { "x-robots-tag": "noindex, nofollow, noarchive" },
    });
  }
}

export async function POST(request: Request) {
  const parsed = await readBoundedJsonBody<Record<string, unknown>>(request, 24 * 1024, { maxDepth: 18 });
  if (!parsed.ok) return parsed.response;
  const denied = await authorizeMutation(request, parsed.raw);
  if (denied) return denied;
  const body = parsed.value;
  try {
    if (body.action === "reconcile_alerts") {
      const reconciliation = await reconcileDurableComputationAlertOutbox();
      return json({ ok: reconciliation.ok, reconciliation }, reconciliation.ok ? 200 : 503);
    }
    if (body.action === "run_recovery_smoke") {
      const result = await executeProviderRecoverySmokeSuite({});
      return json({ ok: result.ok, result }, result.ok ? 200 : 503);
    }
    if (body.action === "record_recovery_proof") {
      const { action: _action, ...request } = body;
      const result = await recordProviderQualityRecoveryProof({ request: request as unknown as ProviderQualityRecoveryProofRequest });
      return json({ ok: result.ok, result }, result.ok ? 200 : 503);
    }
    if (body.action === "record_release_certificate") {
      const { action: _action, ...request } = body;
      const result = await recordProviderRecoveryReleaseCertificate({ request: request as unknown as ProviderRecoveryReleaseCertificateRequest });
      return json({ ok: result.ok, result }, result.ok ? 200 : 503);
    }
    if (body.action === "record_release_bundle") {
      const { action: _action, ...request } = body;
      const result = await recordProviderRecoveryReleaseBundle({
        request: request as unknown as ProviderRecoveryReleaseBundleRequest,
      });
      return json({ ok: result.ok, result }, result.ok ? 200 : 503);
    }
    if (body.action === "record_release_provenance_index") {
      const { action: _action, ...request } = body;
      const result = await recordReleaseProvenanceIndex({ request: request as unknown as ReleaseProvenanceIndexRequest });
      return json({ ok: result.ok, result }, result.ok ? 200 : 503);
    }
    if (body.action === "record_release_candidate_attestation") {
      const { action: _action, ...request } = body;
      const result = await recordReleaseCandidateAttestation({
        request: request as unknown as ReleaseCandidateAttestationRequest,
      });
      return json({ ok: result.ok, result }, result.ok ? 200 : 503);
    }
    if (body.action === "apply_witness_health_policy") {
      const { action: _action, ...request } = body;
      const result = await applyReleaseTransparencyWitnessPolicy({
        request: request as unknown as ReleaseTransparencyWitnessPolicyRequest,
      });
      return json({ ok: result.ok, result }, result.ok ? 200 : 503);
    }
    if (body.action === "reconcile_witness_health") {
      const result = await reconcileReleaseTransparencyWitnessHealth({
        environment: body.environment === "production" ? "production" : "staging",
        audience: typeof body.audience === "string" ? body.audience : undefined,
        maxDegradedSeconds: Number(body.maxDegradedSeconds ?? process.env.VELMERE_RELEASE_WITNESS_HEALTH_MAX_DEGRADED_SECONDS ?? 900),
      });
      return json({ ok: result.ok, result }, result.rollbackRequired ? 409 : result.ok ? 200 : 503);
    }
    if (body.action === "recover_witness_health") {
      const { action: _action, ...request } = body;
      const result = await applyReleaseTransparencyWitnessHealthRecovery({
        request: request as unknown as ReleaseTransparencyWitnessHealthRecoveryRequest,
      });
      return json({ ok: result.ok, result }, result.ok ? 200 : 409);
    }
    if (body.action === "record_witness_rollback_resolution") {
      const { action: _action, ...request } = body;
      const result = await recordReleaseTransparencyWitnessRollbackResolution({
        request: request as unknown as ReleaseTransparencyWitnessRollbackResolutionRequest,
      });
      return json({ ok: result.ok, result }, result.ok ? 200 : 409);
    }
    if (body.action === "verify_witness_rollback_resolution") {
      const result = await verifyReleaseTransparencyWitnessRollbackResolution({
        resolutionDigest: String(body.resolutionDigest ?? ""),
      });
      return json({ ok: result.ok, result }, result.ok ? 200 : 409);
    }
    if (body.action !== "promote" && body.action !== "rollback") return json({ ok: false, error: "unsupported_action" }, 400);
    const result = await applyDurableComputationPromotion({ request: body as unknown as DurableComputationPromotionRequest });
    return json({ ok: result.ok, result }, result.ok ? 200 : result.state === "conflict" ? 409 : 503);
  } catch (error) {
    return publicApiError(error, {
      route: "/api/internal/workers/durable-computation-promotion",
      code: "durable_computation_promotion_failed",
      status: 400,
      headers: { "x-robots-tag": "noindex, nofollow, noarchive" },
    });
  }
}
