import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { marketIntegrityDemoResults } from "@/lib/market-integrity/demo-tokens";
import { recordSingleResult } from "@/lib/market-integrity/market-memory";
import { buildRiskBrain } from "@/lib/market-integrity/risk-brain";
import { analyzeRiskWithVlmKernel } from "@/lib/ai/vlm-brain";
import { getPersistentRiskHistory, persistRiskSnapshots } from "@/lib/market-integrity/risk-ledger";
import { abuseShieldResponseHeaders, abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { securityJson } from "@/lib/security/api-guard";
import { createClientFingerprint } from "@/lib/security/security-event-ledger";
import { recordPass633AuditEvent } from "@/lib/security/audit-event-schema";
import { runPass636FailureDrill, type Pass636FailureKind } from "@/lib/security/provider-failure-drills";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { classifyApiProviderFailure } from "@/lib/security/api-error-envelope";
import { enforceLegacyRiskPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";
import {
  buildShieldBasicDeliveryPreflight,
  projectShieldBasicCustomerDelivery,
} from "@/lib/market-integrity/shield-basic-delivery-policy";

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "analyze", { keyPrefix: "market-analyze", providerId: "market-analysis", queryParam: "query", allowEmptyQuery: true });
  if (!shield.ok) return shield.response;

  const rightsPreflight = buildShieldBasicDeliveryPreflight("analyze");
  const customerJson = (payload: unknown, init: ResponseInit = {}) => {
    const projected = projectShieldBasicCustomerDelivery({
      decision: rightsPreflight,
      payload,
      status: init.status ?? 200,
    });
    return securityJson(projected.payload, { ...init, status: projected.status });
  };
  if (!rightsPreflight.customerDeliveryAllowed || !rightsPreflight.providerNetworkAllowed) {
    return customerJson(null, { status: 503, headers: abuseShieldResponseHeaders(shield) });
  }

  const query = shield.query ?? "";

  if (!query) {
    return customerJson({ mode: "demo", results: marketIntegrityDemoResults, ...abuseShieldResponseMeta(shield) }, { headers: abuseShieldResponseHeaders(shield) });
  }

  const demoHit = marketIntegrityDemoResults.find((result) =>
    [result.token.symbol, result.token.name].some((value) => value?.toLowerCase().includes(query.toLowerCase())),
  );

  if (demoHit && ["om", "mantra"].includes(query.toLowerCase())) {
    return customerJson({ mode: "demo", result: demoHit, ...abuseShieldResponseMeta(shield) }, { headers: abuseShieldResponseHeaders(shield) });
  }

  try {
    const marketHit = await searchCoinGeckoMarket(query);
    if (marketHit) {
      const generatedAt = new Date().toISOString();
      const publication = enforceLegacyRiskPublicationTruth(marketHit.result, generatedAt);
      if (publication.evidenceState !== "verified") {
        return customerJson({
          mode: "withheld",
          result: marketHit.result,
          publication,
          serviceState: shield.rateLimit.degraded ? "degraded" : "nominal",
          blocker: "verified_signed_fresh_quorum_market_evidence_required",
          generatedAt,
          ...abuseShieldResponseMeta(shield),
        }, { status: 424, headers: abuseShieldResponseHeaders(shield) });
      }
      const memory = recordSingleResult(marketHit.result);
      const ledger = memory?.lastSnapshot ? await persistRiskSnapshots([memory.lastSnapshot]) : undefined;
      const id = marketHit.result.token.marketId ?? marketHit.result.token.tokenAddress ?? marketHit.result.token.symbol;
      const history = await getPersistentRiskHistory(id);
      const brain = buildRiskBrain(marketHit.result, history);
      const kernel = analyzeRiskWithVlmKernel({ result: marketHit.result, history, surface: "shield" });
      const defiLlama = await buildDefiLlamaSnapshotForResult(marketHit.result);
      const sourceSync = buildSourceSynchronizationPacket({ query, result: marketHit.result, defiLlama, history });
      const audit = recordPass633AuditEvent({
        route: new URL(request.url).pathname,
        method: request.method,
        actorFingerprint: createClientFingerprint(request),
        providerIds: ["coingecko-market"],
        sourceIds: ["market-snapshot", "risk-history"],
        claimIds: ["risk-score", "market-state", "source-confidence"],
        decision: `analysis_${marketHit.result.level}`,
        state: shield.rateLimit.degraded ? "degraded" : "accepted",
        modelVersion: "velmere-risk-brain",
        promptSchemaVersion: "query-v1",
      });
      return customerJson({
        mode: publication.mode,
        publication,
        serviceState: shield.rateLimit.degraded ? "degraded" : "nominal",
        result: marketHit.result,
        marketRow: { ...marketHit, memory },
        memory,
        ledger,
        history,
        brain,
        kernel,
        defiLlama,
        sourceSync,
        auditReceipt: audit.publicReceipt,
        pass422: brain.pass422,
        pass425: brain.pass425,
        pass427: brain.pass427,
        pass428: brain.pass428,
        pass429: brain.pass429,
        pass430: brain.pass430,
        pass431: brain.pass431,
        pass432: brain.pass432,
        pass433: brain.pass433,
        pass434: brain.pass434,
        pass435: brain.pass435,
        pass436: brain.pass436,
        pass437: brain.pass437,
        pass438: brain.pass438,
        pass439: brain.pass439,
        pass440: brain.pass440,
        pass441: brain.pass441,
        pass442: brain.pass442,
        generatedAt,
        ...abuseShieldResponseMeta(shield),
      }, { headers: abuseShieldResponseHeaders(shield) });
    }

    const result = await analyzeDexScreenerToken(query);
    const generatedAt = new Date().toISOString();
    const publication = enforceLegacyRiskPublicationTruth(result, generatedAt);
    if (publication.evidenceState !== "verified") {
      return customerJson({
        mode: "withheld",
        result,
        publication,
        serviceState: shield.rateLimit.degraded ? "degraded" : "nominal",
        blocker: "verified_signed_fresh_quorum_market_evidence_required",
        generatedAt,
        ...abuseShieldResponseMeta(shield),
      }, { status: 424, headers: abuseShieldResponseHeaders(shield) });
    }
    const memory = recordSingleResult(result);
    const ledger = memory?.lastSnapshot ? await persistRiskSnapshots([memory.lastSnapshot]) : undefined;
    const id = result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol;
    const history = await getPersistentRiskHistory(id);
    const brain = buildRiskBrain(result, history);
    const kernel = analyzeRiskWithVlmKernel({ result, history, surface: "shield" });
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama, history });
    const audit = recordPass633AuditEvent({
      route: new URL(request.url).pathname,
      method: request.method,
      actorFingerprint: createClientFingerprint(request),
      providerIds: ["dexscreener-market"],
      sourceIds: ["pair-snapshot", "risk-history"],
      claimIds: ["risk-score", "liquidity-state", "source-confidence"],
      decision: `analysis_${result.level}`,
      state: shield.rateLimit.degraded ? "degraded" : "accepted",
      modelVersion: "velmere-risk-brain",
      promptSchemaVersion: "query-v1",
    });
    return customerJson({
      mode: publication.mode,
      publication,
      serviceState: shield.rateLimit.degraded ? "degraded" : "nominal",
      result,
      memory,
      ledger,
      history,
      brain,
      kernel,
      defiLlama,
      sourceSync,
      auditReceipt: audit.publicReceipt,
      pass422: brain.pass422,
      pass425: brain.pass425,
        pass427: brain.pass427,
        pass428: brain.pass428,
        pass429: brain.pass429,
        pass430: brain.pass430,
        pass431: brain.pass431,
        pass432: brain.pass432,
        pass433: brain.pass433,
        pass434: brain.pass434,
        pass435: brain.pass435,
        pass436: brain.pass436,
        pass437: brain.pass437,
        pass438: brain.pass438,
        pass439: brain.pass439,
        pass440: brain.pass440,
        pass441: brain.pass441,
        pass442: brain.pass442,
      generatedAt,
      ...abuseShieldResponseMeta(shield),
    }, { headers: abuseShieldResponseHeaders(shield) });
  } catch (error) {
    const failureKind: Pass636FailureKind = classifyApiProviderFailure(error);
    const failure = runPass636FailureDrill("market-analysis", failureKind);
    const audit = recordPass633AuditEvent({
      route: new URL(request.url).pathname,
      method: request.method,
      actorFingerprint: createClientFingerprint(request),
      providerIds: ["market-analysis"],
      decision: `provider_${failureKind}`,
      state: "degraded",
      modelVersion: "velmere-risk-brain",
      promptSchemaVersion: "query-v1",
    });
    return customerJson(
      {
        mode: "degraded",
        error: failure.userMessage,
        sourceState: failure.sourceState,
        confidenceCap: failure.confidenceCap,
        retryAllowed: failure.retryAllowed,
        retryAfterMs: failure.retryAfterMs,
        recoveryPath: failure.recoveryPath,
        auditReceipt: audit.publicReceipt,
        ...abuseShieldResponseMeta(shield),
      },
      { status: failureKind === "rate_limit" ? 429 : 502, headers: abuseShieldResponseHeaders(shield) },
    );
  }
}
