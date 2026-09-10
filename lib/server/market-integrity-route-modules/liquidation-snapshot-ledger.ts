import { publicApiError } from "@/lib/security/api-error-envelope";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { buildPass2467LiquidationLongShortProof, fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { buildPass2468LiquidationSnapshotLedger, ingestPass2468LiquidationEvents, type Pass2468CollectorEventInput } from "@/lib/market-integrity/liquidation-snapshot-ledger";
import { buildPass2469LiquidationReplayStore, persistPass2469LiquidationReplay } from "@/lib/market-integrity/liquidation-replay-store";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, assertAllowedMethods, assertSameOriginRequest, rejectLargeContentLength, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";
import {
  verifySecurityAdminMutationAssertionAfterToken,
  verifySecurityAdminToken,
} from "@/lib/security/security-admin-auth";

type ErrorPayload = { mode: "error"; error: string };

type PostPayload = {
  query?: string;
  symbol?: string;
  venue?: string;
  collectorId?: string;
  maxAgeSeconds?: number;
  events?: Pass2468CollectorEventInput[];
};

async function resolveMarket(query: string) {
  const marketRow = await searchCoinGeckoMarket(query);
  return marketRow?.result ?? await analyzeDexScreenerToken(query);
}

function sanitizeEvents(events: unknown): Pass2468CollectorEventInput[] {
  if (!Array.isArray(events)) return [];
  return events.slice(0, 60).map((event) => {
    const source = event && typeof event === "object" ? event as Record<string, unknown> : {};
    return {
      venue: typeof source.venue === "string" ? source.venue.slice(0, 64) : undefined,
      symbol: typeof source.symbol === "string" ? source.symbol.slice(0, 32) : undefined,
      eventTime: typeof source.eventTime === "string" || typeof source.eventTime === "number" ? source.eventTime : undefined,
      side: typeof source.side === "string" ? source.side.slice(0, 48) : undefined,
      price: typeof source.price === "string" || typeof source.price === "number" ? source.price : undefined,
      quantity: typeof source.quantity === "string" || typeof source.quantity === "number" ? source.quantity : undefined,
      notionalUsd: typeof source.notionalUsd === "string" || typeof source.notionalUsd === "number" ? source.notionalUsd : undefined,
      rawStreamName: typeof source.rawStreamName === "string" ? source.rawStreamName.slice(0, 120) : undefined,
      sourceEventId: typeof source.sourceEventId === "string" ? source.sourceEventId.slice(0, 120) : undefined,
    };
  });
}

export async function GET(request: Request) {
  const methodGuard = assertAllowedMethods(request, ["GET", "POST"]);
  if (methodGuard) return methodGuard;
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "liquidation-snapshot-ledger", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "" });
  if (!query) return securityJson({ mode: "error", error: "Missing query" } satisfies ErrorPayload, { status: 400 });

  try {
    const result = await resolveMarket(query);
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const derivativesSqueeze = await fetchPass2466DerivativesSqueezeProof({ query, symbol: result?.token.symbol, result });
    const basePass2467 = await fetchPass2467LiquidationLongShortProof({ query, symbol: result?.token.symbol, result, pass2466: derivativesSqueeze });
    const liquidationSnapshotLedger = buildPass2468LiquidationSnapshotLedger({ query, symbol: result?.token.symbol, result });
    const liquidationLongShort = buildPass2467LiquidationLongShortProof({
      query,
      symbol: result?.token.symbol,
      result,
      pass2466: derivativesSqueeze,
      longShortSnapshots: basePass2467.longShortSnapshots,
      liquidationSnapshots: liquidationSnapshotLedger.pass2467LiquidationSnapshots.length ? liquidationSnapshotLedger.pass2467LiquidationSnapshots : basePass2467.liquidationSnapshots,
    });
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama, derivativesSqueeze, liquidationLongShort, liquidationSnapshotLedger });
    return securityJson({
      mode: "liquidation_snapshot_ledger",
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      liquidationSnapshotLedger: sourceSync.pass2468,
      liquidationLongShortProof: sourceSync.pass2467,
      derivativesSqueezeProof: sourceSync.pass2466,
      tierDepthScenarioParity: sourceSync.pass2465,
      advancedSqueezeGate: {
        pass2466: sourceSync.pass2466?.state,
        pass2467: sourceSync.pass2467?.state,
        pass2468: sourceSync.pass2468?.state,
        confirmedSqueezeAllowed: sourceSync.pass2467?.confirmedSqueezeAllowed ?? false,
        confirmedSqueezeUnlockCandidate: sourceSync.pass2468?.confirmedSqueezeUnlockCandidate ?? false,
        ledgerFingerprint: sourceSync.pass2468?.ledgerFingerprint,
        copyMode: sourceSync.pass2467?.copyMode ?? "blocked_confirmed_squeeze",
        missingLocks: sourceSync.pass2468?.missingForWorldClass.slice(0, 10) ?? [],
      },
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/liquidation-snapshot-ledger", code: "liquidation_snapshot_ledger_request_failed", status: 502 });
  }
}

export async function POST(request: Request) {
  const methodGuard = assertAllowedMethods(request, ["GET", "POST"]);
  if (methodGuard) return methodGuard;
  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: process.env.NODE_ENV !== "production" });
  if (originGuard) return originGuard;
  const sizeGuard = rejectLargeContentLength(request, 24_000);
  if (sizeGuard) return sizeGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "liquidation-snapshot-ledger-write", limit: 8, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const adminToken = verifySecurityAdminToken(request, ["security:events"], undefined, {
    deferBodyBoundMutationAssertion: true,
  });
  if (!adminToken.ok) return adminToken.response;

  try {
    const parsedBody = await readBoundedJsonBody<PostPayload>(request, 24_000, { maxDepth: 12 });
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.value;
    const admin = await verifySecurityAdminMutationAssertionAfterToken({
      request,
      requiredScopes: ["security:events"],
      operatorRequirement: { role: "security_admin", requirePhishingResistantMfa: true },
      requestBody: body,
    });
    if (!admin.ok) return admin.response;
    const query = sanitizeBoundedParam(body.query ?? body.symbol ?? "", { maxLength: 120, fallback: "" });
    const symbol = sanitizeBoundedParam(body.symbol ?? query, { maxLength: 32, fallback: query });
    if (!query && !symbol) return securityJson({ mode: "error", error: "Missing query or symbol" } satisfies ErrorPayload, { status: 400 });
    const snapshot = ingestPass2468LiquidationEvents({
      query,
      symbol,
      venue: body.venue,
      collectorId: body.collectorId,
      maxAgeSeconds: body.maxAgeSeconds,
      events: sanitizeEvents(body.events),
    });
    const ledger = buildPass2468LiquidationSnapshotLedger({ query, symbol, snapshots: [snapshot] });
    const replayWrite = await persistPass2469LiquidationReplay({ snapshot, ledgerFingerprint: ledger.ledgerFingerprint });
    const liquidationReplayStore = buildPass2469LiquidationReplayStore({ query, symbol, ledger, records: [replayWrite.record] });
    return securityJson({
      mode: "liquidation_snapshot_ingested",
      snapshot,
      liquidationSnapshotLedger: ledger,
      liquidationReplayStore,
      advancedSqueezeGate: {
        pass2468: ledger.state,
        pass2469: liquidationReplayStore.state,
        confirmedSqueezeUnlockCandidate: ledger.confirmedSqueezeUnlockCandidate,
        ledgerFingerprint: ledger.ledgerFingerprint,
        replayFingerprint: liquidationReplayStore.latestReplayFingerprint,
        replayStorageMode: liquidationReplayStore.storageMode,
        missingLocks: [...ledger.missingForWorldClass, ...liquidationReplayStore.missingForWorldClass].slice(0, 10),
      },
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    }, { status: 201 });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/liquidation-snapshot-ledger", code: "liquidation_snapshot_ingest_failed", status: 400 });
  }
}
