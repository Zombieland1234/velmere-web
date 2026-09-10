import {
  buildCustomerSafeRiskHistoryPageStorageProof,
  buildPublicCustomerRiskHistoryProjection,
} from "@/lib/market-integrity/risk-history-contract";
import { buildRiskHistoryCustomerRequestBinding } from "@/lib/market-integrity/risk-history-customer-request-binding";
import { getPublicRiskHistoryResolution } from "@/lib/market-integrity/risk-ledger";
import { applyApiRateLimit, securityJson } from "@/lib/security/api-guard";

// PASS2223: keep this route physically present because Tailwind/Turbopack dev tracking may stat it during hot reload.

export const RISK_HISTORY_PUBLIC_ROUTE_SCHEMA = "velmere.risk-history.customer-route.v3" as const;

const ALLOWED_QUERY_KEYS = new Set(["id", "limit", "before"]);
const INTEGER_QUERY = /^[1-9][0-9]{0,2}$/u;
const ASSET_ID = /^[a-zA-Z0-9:._-]{1,256}$/u;
const PUBLIC_HISTORY_MAX_EVENTS = 144;
const PUBLIC_HISTORY_RATE_LIMIT = 36;
const MAX_CURSOR_CLOCK_SKEW_MS = 5 * 60 * 1_000;

function routeJson(payload: unknown, status = 200, headers?: HeadersInit) {
  return securityJson(payload, { status, headers });
}

function canonicalIso(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export async function GET(request: Request) {
  if (new TextEncoder().encode(request.url).byteLength > 2_048) {
    return routeJson({ mode: "error", error: "risk_history_request_too_large" }, 414);
  }

  const rateLimit = await applyApiRateLimit(request, {
    keyPrefix: "risk-history-public-read",
    limit: PUBLIC_HISTORY_RATE_LIMIT,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const url = new URL(request.url);
  const unsupported = Array.from(new Set(Array.from(url.searchParams.keys()).filter((key) => !ALLOWED_QUERY_KEYS.has(key))));
  const duplicate = Array.from(ALLOWED_QUERY_KEYS).filter((key) => url.searchParams.getAll(key).length > 1);
  if (unsupported.length || duplicate.length) {
    return routeJson({ mode: "error", error: "risk_history_query_invalid" }, 400, rateLimit.headers);
  }

  const id = url.searchParams.get("id")?.trim() ?? "";
  const rawLimit = url.searchParams.get("limit");
  const before = url.searchParams.get("before");
  if (!ASSET_ID.test(id)) {
    return routeJson({ mode: "error", error: "risk_history_identity_invalid" }, 400, rateLimit.headers);
  }
  if (rawLimit !== null && !INTEGER_QUERY.test(rawLimit)) {
    return routeJson({ mode: "error", error: "risk_history_limit_invalid" }, 400, rateLimit.headers);
  }
  const limit = Number(rawLimit ?? String(PUBLIC_HISTORY_MAX_EVENTS));
  if (!Number.isInteger(limit) || limit < 1 || limit > PUBLIC_HISTORY_MAX_EVENTS) {
    return routeJson({ mode: "error", error: "risk_history_limit_invalid" }, 400, rateLimit.headers);
  }
  const generatedAt = new Date().toISOString();
  if (before !== null && (!canonicalIso(before) || Date.parse(before) > Date.parse(generatedAt) + MAX_CURSOR_CLOCK_SKEW_MS)) {
    return routeJson({ mode: "error", error: "risk_history_cursor_invalid" }, 400, rateLimit.headers);
  }

  try {
    const requestBinding = buildRiskHistoryCustomerRequestBinding({ assetId: id, limit, before });
    const resolution = await getPublicRiskHistoryResolution(id, limit, before);
    const storage = buildCustomerSafeRiskHistoryPageStorageProof({
      pageSource: resolution.source,
      resolution: resolution.resolution,
      canonicalAssetId: resolution.canonicalAssetId,
      requestBinding,
      page: resolution.page,
      events: resolution.events.map((event) => ({
        eventReference: event.eventDigest,
        observedAt: event.observedAt,
      })),
    });
    const projection = buildPublicCustomerRiskHistoryProjection({
      requestedId: id,
      resolution: resolution.resolution,
      canonicalAssetId: resolution.canonicalAssetId,
      events: resolution.events,
      requestBinding: resolution.requestBinding,
      page: resolution.page,
      storage,
      limit,
    });

    return routeJson({
      schemaVersion: RISK_HISTORY_PUBLIC_ROUTE_SCHEMA,
      mode: "stored",
      requestBinding,
      publication: {
        evidenceState: projection.status === "AVAILABLE" ? "verified" : "withheld",
        liveClaimed: false,
        currentness: projection.status === "AVAILABLE" ? "event_observation_time_bound" : "unavailable",
      },
      riskHistory: projection,
      generatedAt,
    }, 200, rateLimit.headers);
  } catch {
    return routeJson({
      mode: "error",
      error: "risk_history_temporarily_unavailable",
    }, 503, rateLimit.headers);
  }
}
