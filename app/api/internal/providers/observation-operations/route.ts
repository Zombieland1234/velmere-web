import { NextResponse } from "next/server";
import {
  authorizeMarketIntegrityCron,
  authorizeMarketIntegrityWorkerMutation,
  marketIntegrityWorkerMutationErrorStatus,
  verifyMarketIntegrityWorkerMutationEnvelope,
} from "@/lib/security/market-integrity-cron-auth";
import { applyApiRateLimit } from "@/lib/security/api-guard";
import {
  getProviderObservationOperationalSnapshot,
  runProviderObservationOperations,
} from "@/lib/market-integrity/provider-observation-operations";
import {
  applyProviderObservationQuarantineAction,
  getProviderObservationPromotionQuality,
  reconcileProviderObservationQuarantine,
  type ProviderQuarantineApprovalRequest,
} from "@/lib/market-integrity/provider-observation-quarantine";
import {
  applyProviderQualityIncidentAction,
  getProviderQualityIncidentGate,
  runProviderQualityIncidentCycle,
  type ProviderQualityIncidentApprovalRequest,
} from "@/lib/market-integrity/provider-quality-incident-response";
import {
  getProviderQualityAutoRollbackStatus,
  runProviderQualityAutoRollback,
} from "@/lib/market-integrity/provider-quality-auto-rollback";
import { publicApiError } from "@/lib/security/api-error-envelope";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
    keyPrefix: "provider-observation-operations",
    limit: 12,
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
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    if (["run", "quarantine", "incident_cycle", "auto_rollback_cycle"].includes(action ?? "")) {
      return json({ ok: false, error: "mutation_requires_post" }, 405);
    }
    if (action === "quality") {
      const quality = await getProviderObservationPromotionQuality();
      return json({ ok: quality.ready, quality }, quality.ready ? 200 : 503);
    }
    if (action === "incident") {
      const incident = await getProviderQualityIncidentGate();
      return json({ ok: incident.ready, incident }, incident.ready ? 200 : 503);
    }
    if (action === "auto_rollback_status") {
      const rollback = await getProviderQualityAutoRollbackStatus();
      return json({ ok: rollback.state !== "store_failed", rollback }, rollback.state !== "store_failed" ? 200 : 503);
    }
    if (action && action !== "snapshot") return json({ ok: false, error: "unsupported_action" }, 400);
    const snapshot = await getProviderObservationOperationalSnapshot();
    return json({ ok: snapshot.ok, snapshot }, snapshot.ok ? 200 : 503);
  } catch (error) {
    return publicApiError(error, {
      route: "/api/internal/providers/observation-operations",
      code: "provider_observation_operations_failed",
      status: 503,
      headers: { "x-robots-tag": "noindex, nofollow, noarchive" },
    });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await readBoundedJsonBody<Record<string, unknown>>(request, 16 * 1024, { maxDepth: 12 });
    if (!parsed.ok) return parsed.response;
    const denied = await authorizeMutation(request, parsed.raw);
    if (denied) return denied;
    const body = parsed.value;
    const action = body.action === undefined ? "run" : String(body.action);
    if (action === "run") {
      const result = await runProviderObservationOperations({
        staleAfterSeconds: Number(body.staleAfterSeconds ?? 1_800),
        retentionLimit: Number(body.retentionLimit ?? 96),
        minStableSamples: Number(body.minStableSamples ?? 3),
        maxAssetsPerCompaction: Number(body.maxAssetsPerCompaction ?? 250),
        anomalyAlertThreshold: Number(body.anomalyAlertThreshold ?? 1),
        staleAssetAlertThreshold: Number(body.staleAssetAlertThreshold ?? 10),
      });
      return json({ ok: result.ok, result }, result.ok ? 200 : 503);
    }
    if (action === "quarantine_reconcile") {
      const quarantine = await reconcileProviderObservationQuarantine({
        minStableSamples: Number(body.minStableSamples ?? 3),
        maxAssets: Number(body.maxAssets ?? 500),
      });
      return json({ ok: quarantine.ok, quarantine }, quarantine.ok ? 200 : 503);
    }
    if (action === "revalidate" || action === "release") {
      const result = await applyProviderObservationQuarantineAction({
        request: body as unknown as ProviderQuarantineApprovalRequest,
      });
      return json({ ok: result.ok, result }, result.ok ? 200 : 409);
    }
    if (action === "incident_cycle") {
      const incident = await runProviderQualityIncidentCycle({
        policy: {
          warningAfterSeconds: Number(body.warningAfterSeconds ?? 300),
          criticalAfterSeconds: Number(body.criticalAfterSeconds ?? 900),
          rollbackAfterSeconds: Number(body.rollbackAfterSeconds ?? 1_800),
          recoveryStableSeconds: Number(body.recoveryStableSeconds ?? 900),
          maxIncidentAgeSeconds: Number(body.maxIncidentAgeSeconds ?? 86_400),
        },
      });
      return json({ ok: incident.blockers.length === 0, incident }, incident.blockers.length === 0 ? 200 : 503);
    }
    if (action === "auto_rollback_cycle") {
      const rollback = await runProviderQualityAutoRollback();
      return json({ ok: rollback.ok, rollback }, rollback.ok ? 200 : 503);
    }
    if (action === "acknowledge" || action === "start_recovery" || action === "resolve") {
      const result = await applyProviderQualityIncidentAction({
        request: body as unknown as ProviderQualityIncidentApprovalRequest,
      });
      return json({ ok: result.ok, result }, result.ok ? 200 : 409);
    }
    return json({ ok: false, error: "unsupported_action" }, 400);
  } catch (error) {
    return publicApiError(error, {
      route: "/api/internal/providers/observation-operations",
      code: "provider_observation_operations_failed",
      status: 503,
      headers: { "x-robots-tag": "noindex, nofollow, noarchive" },
    });
  }
}
