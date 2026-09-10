import { mapSettledWithConcurrencyLimit } from "@/lib/runtime/bounded-concurrency";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { type Pass458RangeKey, type Pass458TruthQuote, pass458ProviderTruthRouterContract } from "@/lib/market-integrity/provider-truth-router";
import { pass460ProviderConsensusContract } from "@/lib/market-integrity/provider-consensus";
import { pass461VenueHealthContract } from "@/lib/market-integrity/venue-health-runtime";
import { pass462CrossVenueConsensusContract } from "@/lib/market-integrity/cross-venue-consensus";
import { pass463CanonicalPairCoverageContract } from "@/lib/market-integrity/canonical-pair-coverage";
import { pass464FundamentalQualityContract } from "@/lib/market-integrity/fundamental-quality";
import { pass465SecXbrlQualityContract } from "@/lib/market-integrity/sec-xbrl-quality";
import { realMarketsDataContract, toCanonicalRealMarketInstrument } from "@/lib/market-integrity/real-markets-data-contract";
import { buildPass2811TierSuite } from "@/lib/market-integrity/top1-tier-differentiation";
import { resolveVlmPaidSurfaceAccess, toVlmPaidSurfacePaymentRequiredPayload } from "@/lib/commerce/vlm-paid-surface-guard";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { buildPass2812PaidTierSecuritySuiteV2, buildReportAccessDecision } from "@/lib/market-integrity/top1-entitlement-report-access";
import { buildPass2813SurfaceBrainPlan } from "@/lib/market-integrity/top1-vlm-brain-source-router";
import { buildPass2814SourcePoisoningFirewall } from "@/lib/market-integrity/top1-source-poisoning-ssrf-firewall";
import { buildChartLifecycleReceipt } from "@/lib/market-integrity/top1-risk-foundation";
import { buildPass2815ReportIntegrityVault } from "@/lib/market-integrity/top1-report-integrity-vault";
import { buildPass2816RuntimeObservabilityLedger } from "@/lib/market-integrity/top1-runtime-observability-ledger";
import {
  PASS2809_REAL_MARKETS_SERVER_SYMBOL_BUDGET,
  instruments,
  rangeMeta,
  safeSymbol,
  type InstrumentId,
} from "@/lib/market-integrity/real-markets-catalog";
import { fetchQuiet, loadStooqDailyFallback } from "@/lib/market-integrity/real-markets-provider-transport";
import { loadPass69EcbOfficialFxReferenceEnvelope, loadQuoteMetadata, localUnavailableQuote, resolveRealMarketQuoteSafely } from "@/lib/market-integrity/real-markets-quote-hydration";
import {
  CFTC_COT_INSTRUMENTS,
  CFTC_COT_RIGHTS_BOUNDARY,
  loadCftcCotOfficialReference,
} from "@/lib/market-integrity/cftc-cot-official-reference";
import {
  WORLD_BANK_WDI_FX_INSTRUMENTS,
  WORLD_BANK_WDI_RIGHTS_BOUNDARY,
  loadWorldBankWdiOfficialReference,
} from "@/lib/market-integrity/world-bank-wdi-official-reference";
import {
  buildRealMarketsGenericDeliveryPreflight,
  toRealMarketsGenericCustomerSafeWithheld,
} from "@/lib/market-integrity/real-markets-generic-delivery-policy";
import { buildPass2808ChartReceipt, pass2813RealMarketFamilyForSymbol, tierFromRealMarketsRequest } from "@/lib/market-integrity/real-markets-response-policy";
import { reconcileRealMarketsQuoteProviders } from "@/lib/market-integrity/real-markets-provider-quorum";
import { recordProviderObservation } from "@/lib/market-integrity/provider-observation-ledger";
import { applyHistoricalEvidencePolicy } from "@/lib/market-integrity/provider-evidence-tier-policy";
import { buildCustomerReportPayload, type VelmereReportAssetFamily } from "@/lib/market-integrity/customer-report-payload";
import { issuePass4818CustomerReportRenderToken } from "@/lib/market-integrity/customer-report-render-token";
import { createPass4823RealMarketsPaidAccountArtifact } from "@/lib/market-integrity/real-markets-paid-account-artifact";
import { buildCustomerReportLayoutModel } from "@/lib/market-integrity/customer-report-layout-model";
import { buildCustomerReportSourceBinding } from "@/lib/market-integrity/customer-report-source-binding";
import { isPass4644CommerciallyFreshReceipt } from "@/lib/market-integrity/provider-evidence-receipt";
import type { Pass4825RuntimeFieldValue } from "@/lib/reporting/runtime-canonical-field-adapter";
import {
  buildPass4818RealMarketsDecisionSections,
  buildPass4818RealMarketsEvidenceRisk,
  buildPass4818RealMarketsMissingEvidence,
  buildPass4818RealMarketsProviderConflicts,
  buildPass4818RealMarketsProviderReceipts,
  pass4818RealMarketsReceiptDigest,
  type RealMarketsCustomerEvidenceQuote,
} from "@/lib/market-integrity/real-markets-customer-evidence";
import {
  buildP98CustomerPaidTierExactDeliveryDecision,
  toP98CustomerPaidTierDeliveryProjection,
  toP98CustomerPaidTierWithheldPayload,
} from "@/lib/market-integrity/customer-paid-tier-exact-delivery-policy";


function pass4818ReportFamily(assetClass: string | null | undefined): VelmereReportAssetFamily {
  if (assetClass === "etf") return "etf";
  if (assetClass === "fx") return "fx";
  if (assetClass === "commodity") return "commodity";
  if (assetClass === "real_estate") return "real_estate";
  if (assetClass === "exchange_equity" || assetClass === "venue_health") return "exchange_health";
  if (assetClass === "stock" || assetClass === "index") return "equity";
  return "unknown";
}

function pass4818ReportLocale(value: string | null): "pl" | "en" | "de" {
  return value === "pl" || value === "de" ? value : "en";
}

function pass4993RealMarketsCanonicalIdentity(symbol: string | null | undefined, assetClass: string | null | undefined) {
  const normalizedSymbol = String(symbol ?? "").trim().toLowerCase().replace(/[^a-z0-9.^=/-]+/g, "");
  if (!normalizedSymbol) return null;
  return `${pass4818ReportFamily(assetClass)}:${normalizedSymbol}`;
}

export async function handleRealMarketsGet(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim().slice(0, 60);
  if (query) {
    const realMarketsSearchDeliveryPreflight = buildRealMarketsGenericDeliveryPreflight("search");
    if (
      (!realMarketsSearchDeliveryPreflight.providerNetworkAllowed
      || !realMarketsSearchDeliveryPreflight.customerDeliveryAllowed)
      && process.env.NODE_ENV === "production"
    ) {
      return NextResponse.json(
        toRealMarketsGenericCustomerSafeWithheld("search", null),
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }
    try {
      const response = await fetchQuiet(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=16&newsCount=0&enableFuzzyQuery=true`,
        {
          headers: {
            accept: "application/json",
            "user-agent": "Velmere-Market-Integrity/1.0",
          },
          next: { revalidate: 300 },
        },
        2200,
      );
      if (!response?.ok) throw new Error(`provider_${response?.status ?? "network"}`);
      const payload = await readJsonResponseBounded<{
        quotes?: Array<{
          symbol?: string;
          shortname?: string;
          longname?: string;
          exchange?: string;
          exchDisp?: string;
          quoteType?: string;
          typeDisp?: string;
        }>;
      }>(response, 2 * 1024 * 1024);
      const results = (payload.quotes || [])
        .filter((item) => item.symbol && safeSymbol.test(item.symbol))
        .slice(0, 12)
        .map((item) => ({
          symbol: item.symbol as string,
          name: item.longname || item.shortname || item.symbol || "",
          exchange: item.exchDisp || item.exchange || null,
          quoteType: item.quoteType || item.typeDisp || "UNKNOWN",
          source: "Yahoo Finance search adapter",
        }));
      return NextResponse.json(
        { ok: true, generatedAt: new Date().toISOString(), results },
        { headers: { "cache-control": "no-store" } },
      );
    } catch {
      return NextResponse.json(
        { ok: false, error: "provider_search_unavailable", results: [], pass2807ProviderCircuitBreaker: "search degraded without throwing" },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    }
  }

  const ids = (url.searchParams.get("ids") || "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter((id): id is InstrumentId => id in instruments)
    .slice(0, PASS2809_REAL_MARKETS_SERVER_SYMBOL_BUDGET);
  const dynamicSymbols = (url.searchParams.get("symbols") || "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => safeSymbol.test(symbol))
    .slice(0, PASS2809_REAL_MARKETS_SERVER_SYMBOL_BUDGET);
  const detail = url.searchParams.get("detail") === "1";
  const rangeValue = url.searchParams.get("range");
  const rangeKey =
    rangeValue === "15m" ||
    rangeValue === "1h" ||
    rangeValue === "4h" ||
    rangeValue === "1d" ||
    rangeValue === "1w" ||
    rangeValue === "1mo"
      ? rangeValue
      : "1w";
  const providerRangeKey: Pass458RangeKey = rangeKey;
  const generatedAt = new Date().toISOString();
  const requestedTier = tierFromRealMarketsRequest(url.searchParams.get("tier"));
  // P98: customer analysis always runs for the exact requested tier. An
  // unavailable paid tier is WITHHELD; it is never silently analyzed as Pro.
  const automatedDeliveryTier = requestedTier;
  const reportLocale = pass4818ReportLocale(url.searchParams.get("locale"));
  const requestedSymbolsForAccess = [
    ...ids.map((id) => instruments[id]),
    ...dynamicSymbols,
  ].filter((symbol, index, all) => all.indexOf(symbol) === index);
  const pass69ReferenceOnlyRequest = url.searchParams.get("referenceFx") === "1";
  const cftcReferenceOnlyRequest = url.searchParams.get("referenceCot") === "1";
  const worldBankMacroReferenceOnlyRequest = url.searchParams.get("referenceMacro") === "1";
  const requestedReferenceModeCount = [
    pass69ReferenceOnlyRequest,
    cftcReferenceOnlyRequest,
    worldBankMacroReferenceOnlyRequest,
  ].filter(Boolean).length;
  if (requestedReferenceModeCount > 1) {
    return NextResponse.json(
      {
        ok: false,
        mode: "official_reference_mode_conflict",
        availability: "WITHHELD",
        error: "exactly_one_official_reference_mode_required",
        references: [],
        quotes: [],
        canonicalQuotes: [],
        riskScore: null,
        confidence: null,
        liveClaimed: false,
        executable: false,
        customerFinalCredit: false,
      },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  if (pass69ReferenceOnlyRequest) {
    const pass69RequestedReferenceSymbols = [
      ...ids.map((id) => instruments[id]),
      ...dynamicSymbols,
    ].filter((symbol, index, all) => all.indexOf(symbol) === index);
    if (!pass69RequestedReferenceSymbols.length) {
      return NextResponse.json(
        { ok: false, error: "reference_fx_requires_supported_symbol" },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }
    const pass69ReferenceEnvelope = await loadPass69EcbOfficialFxReferenceEnvelope(pass69RequestedReferenceSymbols);
    const pass69Available = pass69ReferenceEnvelope.state === "available";
    return NextResponse.json(
      {
        ok: pass69Available,
        generatedAt,
        mode: "ecb_reference_only",
        fields: ["market.reference_rate", "market.reference_date"],
        sourceAttribution: pass69ReferenceEnvelope.attribution,
        referenceOnly: true,
        executableQuote: false,
        marketPriceFieldEligible: false,
        riskVerdictEligible: false,
        paidValueEligible: false,
        pass69EcbOfficialFxReferenceEnvelope: pass69ReferenceEnvelope,
        truthBoundary: "This public route exposes direct ECB-published EUR reference statistics only. It is not market.price, not a transaction quote, and cannot unlock risk, paid-value, execution or sale claims.",
      },
      { status: pass69Available ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  }
  if (cftcReferenceOnlyRequest) {
    const cftcSymbol = requestedSymbolsForAccess.length === 1 ? requestedSymbolsForAccess[0] : "";
    if (!cftcSymbol || !Object.prototype.hasOwnProperty.call(CFTC_COT_INSTRUMENTS, cftcSymbol)) {
      return NextResponse.json(
        {
          ok: false,
          mode: "cftc_cot_historical_reference_only",
          error: "cftc_reference_requires_exact_supported_symbol",
          quotes: [],
          canonicalQuotes: [],
          riskScore: null,
          confidence: null,
          liveClaimed: false,
          executable: false,
          customerFinalCredit: false,
        },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }
    const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    if (productionLike && !CFTC_COT_RIGHTS_BOUNDARY.productionPaidDisplayAuthorized) {
      return NextResponse.json(
        {
          ok: false,
          mode: "cftc_cot_historical_reference_only",
          availability: "WITHHELD",
          error: "cftc_reference_customer_delivery_unavailable",
          reason: "Production paid display remains blocked pending legal review.",
          sourceAttribution: CFTC_COT_RIGHTS_BOUNDARY.attribution,
          goPaidState: CFTC_COT_RIGHTS_BOUNDARY.goPaidState,
          references: [],
          quotes: [],
          canonicalQuotes: [],
          riskScore: null,
          confidence: null,
          referenceOnly: true,
          historicalReferenceOnly: true,
          liveClaimed: false,
          executable: false,
          marketPriceEligible: false,
          customerFinalCredit: false,
          retryAfter: null,
        },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }
    if (requestedTier === "Basic") {
      return NextResponse.json(
        {
          ok: false,
          mode: "cftc_cot_historical_reference_only",
          availability: "WITHHELD",
          error: "cftc_paid_tier_required",
          references: [],
          quotes: [],
          canonicalQuotes: [],
          riskScore: null,
          confidence: null,
          referenceOnly: true,
          historicalReferenceOnly: true,
          liveClaimed: false,
          executable: false,
          marketPriceEligible: false,
          customerFinalCredit: false,
          retryAfter: null,
        },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }
    const cftcPaidAccessGate = await resolveVlmPaidSurfaceAccess({
      policyId: "real_markets_analysis",
      request,
      depth: requestedTier === "Advanced" ? "advanced" : "pro",
      locale: reportLocale,
      assetId: cftcSymbol,
      symbol: cftcSymbol,
      requestId: url.searchParams.get("requestId"),
      returnPath: url.searchParams.get("returnPath"),
    });
    if (!cftcPaidAccessGate.ok) {
      return NextResponse.json(
        toVlmPaidSurfacePaymentRequiredPayload(cftcPaidAccessGate),
        { status: 402, headers: cftcPaidAccessGate.headers },
      );
    }
    const cftcEntitlementVerified = cftcPaidAccessGate.paidRequired
      && "entitlement" in cftcPaidAccessGate
      && Boolean(cftcPaidAccessGate.entitlement?.entitlement);
    const cftcCotOfficialReference = await loadCftcCotOfficialReference({
      symbol: cftcSymbol,
      tier: requestedTier,
      entitlementVerified: cftcEntitlementVerified,
      now: new Date(generatedAt),
    });
    const cftcAvailable = cftcCotOfficialReference.state === "available";
    return NextResponse.json(
      {
        ok: cftcAvailable,
        generatedAt,
        mode: "cftc_cot_historical_reference_only",
        fields: ["market.cftc_cot_historical_positioning"],
        sourceAttribution: cftcCotOfficialReference.attribution,
        referenceOnly: true,
        historicalReferenceOnly: true,
        liveClaimed: false,
        executable: false,
        marketPriceEligible: false,
        riskScore: null,
        confidence: null,
        paidValueEligible: false,
        customerFinalCredit: false,
        quotes: [],
        canonicalQuotes: [],
        cftcCotOfficialReference,
        truthBoundary: "CFTC COT values are a historical official positioning reference only. They never become live/executable quotes, risk or confidence, paid-value proof or Customer FINAL credit.",
      },
      { status: cftcAvailable ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  }
  if (worldBankMacroReferenceOnlyRequest) {
    const worldBankSymbol = requestedSymbolsForAccess.length === 1 ? requestedSymbolsForAccess[0] : "";
    if (!worldBankSymbol || !Object.prototype.hasOwnProperty.call(WORLD_BANK_WDI_FX_INSTRUMENTS, worldBankSymbol)) {
      return NextResponse.json(
        {
          ok: false,
          mode: "world_bank_wdi_historical_macro_reference_only",
          availability: "WITHHELD",
          error: "world_bank_reference_requires_exact_supported_fx_symbol",
          references: [],
          quotes: [],
          canonicalQuotes: [],
          riskScore: null,
          confidence: null,
          referenceOnly: true,
          historicalAnnualReferenceOnly: true,
          liveClaimed: false,
          executable: false,
          marketPriceEligible: false,
          customerFinalCredit: false,
          retryAfter: null,
        },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }
    const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    if (productionLike && !WORLD_BANK_WDI_RIGHTS_BOUNDARY.productionPaidDisplayAuthorized) {
      return NextResponse.json(
        {
          ok: false,
          mode: "world_bank_wdi_historical_macro_reference_only",
          availability: "WITHHELD",
          error: "world_bank_go_paid_legal_review_required",
          reason: "Published CC BY 4.0 terms are technically bound, but production paid display remains blocked pending legal review.",
          sourceAttribution: WORLD_BANK_WDI_RIGHTS_BOUNDARY.attribution,
          goPaidState: WORLD_BANK_WDI_RIGHTS_BOUNDARY.goPaidState,
          references: [],
          quotes: [],
          canonicalQuotes: [],
          riskScore: null,
          confidence: null,
          referenceOnly: true,
          historicalAnnualReferenceOnly: true,
          liveClaimed: false,
          executable: false,
          marketPriceEligible: false,
          customerFinalCredit: false,
          retryAfter: null,
        },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }
    if (requestedTier === "Basic") {
      return NextResponse.json(
        {
          ok: false,
          mode: "world_bank_wdi_historical_macro_reference_only",
          availability: "WITHHELD",
          error: "world_bank_paid_tier_required",
          references: [],
          quotes: [],
          canonicalQuotes: [],
          riskScore: null,
          confidence: null,
          referenceOnly: true,
          historicalAnnualReferenceOnly: true,
          liveClaimed: false,
          executable: false,
          marketPriceEligible: false,
          customerFinalCredit: false,
          retryAfter: null,
        },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }
    const worldBankPaidAccessGate = await resolveVlmPaidSurfaceAccess({
      policyId: "real_markets_analysis",
      request,
      depth: requestedTier === "Advanced" ? "advanced" : "pro",
      locale: reportLocale,
      assetId: worldBankSymbol,
      symbol: worldBankSymbol,
      requestId: url.searchParams.get("requestId"),
      returnPath: url.searchParams.get("returnPath"),
    });
    if (!worldBankPaidAccessGate.ok) {
      return NextResponse.json(
        toVlmPaidSurfacePaymentRequiredPayload(worldBankPaidAccessGate),
        { status: 402, headers: worldBankPaidAccessGate.headers },
      );
    }
    const worldBankEntitlementVerified = worldBankPaidAccessGate.paidRequired
      && "entitlement" in worldBankPaidAccessGate
      && Boolean(worldBankPaidAccessGate.entitlement?.entitlement);
    const worldBankWdiOfficialReference = await loadWorldBankWdiOfficialReference({
      symbol: worldBankSymbol,
      tier: requestedTier,
      entitlementVerified: worldBankEntitlementVerified,
      productionLike,
      now: new Date(generatedAt),
    });
    const worldBankAvailable = worldBankWdiOfficialReference.state === "available";
    return NextResponse.json(
      {
        ok: worldBankAvailable,
        generatedAt,
        mode: "world_bank_wdi_historical_macro_reference_only",
        fields: ["market.macro.inflation_annual_pct", "market.macro.unemployment_annual_pct"],
        sourceAttribution: worldBankWdiOfficialReference.attribution,
        referenceOnly: true,
        historicalAnnualReferenceOnly: true,
        liveClaimed: false,
        executable: false,
        marketPriceEligible: false,
        riskScore: null,
        confidence: null,
        paidValueEligible: false,
        customerFinalCredit: false,
        quotes: [],
        canonicalQuotes: [],
        worldBankWdiOfficialReference,
        truthBoundary: "World Bank WDI values are annual historical macro references only. They never become live/executable quotes, forecasts, risk or confidence, paid-value proof or Customer FINAL credit.",
      },
      { status: worldBankAvailable ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  }
  const realMarketsQuoteDeliveryPreflight = buildRealMarketsGenericDeliveryPreflight("quotes");
  if (
    (!realMarketsQuoteDeliveryPreflight.providerNetworkAllowed
    || !realMarketsQuoteDeliveryPreflight.customerDeliveryAllowed)
    && process.env.NODE_ENV === "production"
  ) {
    return NextResponse.json(
      toRealMarketsGenericCustomerSafeWithheld("quotes", requestedTier),
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  if (requestedTier !== "Basic" && requestedSymbolsForAccess.length !== 1) {
    return NextResponse.json(
      { ok: false, error: "paid_analysis_requires_single_instrument", requestedTier },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  const paidAccessGate = await resolveVlmPaidSurfaceAccess({
    policyId: "real_markets_analysis",
    request,
    depth: requestedTier === "Advanced" ? "advanced" : requestedTier === "Pro" ? "pro" : "basic",
    locale: reportLocale,
    assetId: requestedSymbolsForAccess[0] ?? null,
    symbol: requestedSymbolsForAccess[0] ?? null,
    requestId: url.searchParams.get("requestId"),
    returnPath: url.searchParams.get("returnPath"),
  });
  if (!paidAccessGate.ok) {
    return NextResponse.json(toVlmPaidSurfacePaymentRequiredPayload(paidAccessGate), { status: 402, headers: paidAccessGate.headers });
  }
  const resolvedAccount = await resolveRequestAccount(request);
  const verifiedEntitlement = paidAccessGate.paidRequired && "entitlement" in paidAccessGate ? paidAccessGate.entitlement : null;
  const entitlementId = verifiedEntitlement?.entitlement?.id ?? "";
  const entitlementDigest = entitlementId ? createHash("sha256").update(entitlementId, "utf8").digest("hex") : "";
  const accessTokenDigest = entitlementDigest;
  const pass2812AccessContext = {
    tier: automatedDeliveryTier,
    accountId: resolvedAccount?.accountId ?? null,
    serverReceiptId: automatedDeliveryTier === "Basic" || !entitlementDigest ? null : `vlm_receipt_${entitlementDigest.slice(0, 32)}`,
    reportToken: automatedDeliveryTier === "Basic" || !accessTokenDigest ? null : `vlm_rpt_${accessTokenDigest.slice(0, 40)}`,
    payloadHash: automatedDeliveryTier === "Basic" ? null : paidAccessGate.context.accountIdHash
      ? createHash("sha256").update(JSON.stringify(paidAccessGate.context), "utf8").digest("hex")
      : null,
    manualReviewReceiptId: null,
    manualReviewRequired: false,
    advancedDeliveryMode: "automated" as const,
    verification: automatedDeliveryTier === "Basic" ? undefined : {
      accountBound: Boolean(resolvedAccount && paidAccessGate.context.accountIdHash),
      serverReceiptVerified: Boolean(verifiedEntitlement?.entitlement),
      reportTokenVerified: Boolean(verifiedEntitlement?.entitlement),
      payloadHashBound: Boolean(paidAccessGate.context.accountIdHash),
      manualReviewVerified: false,
      source: "server_entitlement" as const,
    },
  };
  const pass2812RealMarketsAccessDecision = buildReportAccessDecision(pass2812AccessContext);
  const pass2812RealMarketsPaidTierSecuritySuite = buildPass2812PaidTierSecuritySuiteV2(
    pass2812AccessContext,
    "automated",
  );
  if (requestedTier !== "Basic" && !pass2812RealMarketsAccessDecision.paidEvidenceAllowed) {
    const pass98EntitlementWithheld = buildP98CustomerPaidTierExactDeliveryDecision({
      requestedTier,
      analyzedTier: automatedDeliveryTier,
      payloadTier: null,
      deliveryPolicy: { visibleTier: null, status: "unavailable", paidEvidenceAllowed: false },
    });
    return NextResponse.json(
      toP98CustomerPaidTierWithheldPayload(pass98EntitlementWithheld),
      { status: 402, headers: { "cache-control": "no-store" } },
    );
  }
  const pass2814RealMarketsSourcePoisoningFirewall = buildPass2814SourcePoisoningFirewall({
    surface: "Real Markets",
    sourceFamily: "yahoo_stooq",
    targetUrl: "https://query1.finance.yahoo.com/v8/finance/chart",
    assetFamily: "equity",
    tier: automatedDeliveryTier,
    query: [...ids, ...dynamicSymbols].join(","),
  });

  if (!ids.length && !dynamicSymbols.length) {
    return NextResponse.json(
      { ok: false, error: "no_supported_instruments" },
      { status: 400 },
    );
  }

  const requested = [
    ...ids.map((id) => ({ id, symbol: instruments[id] })),
    ...dynamicSymbols.map((symbol) => ({ id: symbol.toLowerCase(), symbol })),
  ].filter(
    (item, index, all) =>
      all.findIndex((candidate) => candidate.symbol === item.symbol) === index,
  );
  const tableBatchMode = !detail || requested.length > 1;
  const pass69EcbReferenceEnvelopePromise = loadPass69EcbOfficialFxReferenceEnvelope(requested.map((item) => item.symbol));
  const quoteSettled = await mapSettledWithConcurrencyLimit(
    requested,
    6,
    ({ id, symbol }) => resolveRealMarketQuoteSafely({
      id,
      symbol,
      rangeKey,
      providerRangeKey,
      detail,
      requestedLength: requested.length,
    }),
  );
  const quotes = quoteSettled.map((entry, index) =>
    entry.status === "fulfilled"
      ? entry.value
      : localUnavailableQuote(requested[index]?.id ?? "unknown", requested[index]?.symbol ?? "UNKNOWN", rangeKey),
  );
  const pass69EcbReferenceEnvelope = await pass69EcbReferenceEnvelopePromise;
  const quoteMetadata = await loadQuoteMetadata(requested.map((item) => item.symbol), {
    hydrateIntraday: !tableBatchMode,
    fallbackLimit: tableBatchMode ? 0 : 8,
  });
  const stooqFallbackRows = tableBatchMode
    ? requested.map(() => null)
    : (await mapSettledWithConcurrencyLimit(
        requested.slice(0, 8),
        4,
        (item) => loadStooqDailyFallback(item.symbol),
      )).map((entry) => entry.status === "fulfilled" ? entry.value : null);
  const baseHydratedQuotes = quotes.map((quote, index) => {
    const symbol = String(quote.symbol ?? requested[index]?.symbol ?? "").toUpperCase();
    const meta = quoteMetadata[symbol];
    const pass69OfficialFxReference = pass69EcbReferenceEnvelope.references.find((reference) => reference.providerSymbol === symbol) ?? null;
    const stooq = stooqFallbackRows[index];
    const sourceQuote = (quote?.state === "live" && typeof quote.currentPrice === "number"
      ? quote
      : stooq ?? quote) as Pass458TruthQuote & {
        marketCap?: number | null;
        volume24h?: number | null;
        high24h?: number | null;
        low24h?: number | null;
        priceChange1h?: number | null;
        priceChange7d?: number | null;
        sourceReceivedAt?: string | null;
        sourceLatencyMs?: number | null;
        sourceCapabilities?: string[];
      };
    const effectiveCandles = sourceQuote.candles?.length ? sourceQuote.candles : stooq?.candles ?? [];
    const mergedSourceQuote = {
      ...sourceQuote,
      symbol,
      currentPrice:
        typeof sourceQuote.currentPrice === "number"
          ? sourceQuote.currentPrice
          : meta?.currentPrice ?? sourceQuote.currentPrice ?? null,
      currency: sourceQuote.currency ?? meta?.currency ?? null,
      exchange: sourceQuote.exchange ?? meta?.exchange ?? null,
      sourceTimestamp: sourceQuote.sourceTimestamp ?? meta?.sourceTimestamp ?? null,
      marketCap: meta?.marketCap ?? sourceQuote.marketCap ?? null,
      volume24h: meta?.volume24h ?? sourceQuote.volume24h ?? null,
      high24h: meta?.high24h ?? sourceQuote.high24h ?? null,
      low24h: meta?.low24h ?? sourceQuote.low24h ?? null,
      priceChange1h: meta?.priceChange1h ?? sourceQuote.priceChange1h ?? null,
      priceChange24h: meta?.priceChange24h ?? sourceQuote.priceChange24h ?? stooq?.priceChange24h ?? null,
      priceChange7d: sourceQuote.priceChange7d ?? stooq?.priceChange7d ?? null,
      candles: effectiveCandles,
    };
    const { providerQuorum, providerEvidencePolicy, providerObservations, sourceIsStooq } = reconcileRealMarketsQuoteProviders({
      sourceQuote: mergedSourceQuote,
      routeQuote: quote,
      stooq,
      requestedTier: automatedDeliveryTier,
    });
    return {
      ...mergedSourceQuote,
      officialFxReference: pass69OfficialFxReference,
      consensusState: providerQuorum.state,
      freshnessState: providerQuorum.freshnessState,
      divergenceBps: providerQuorum.divergenceBps,
      divergenceThresholdBps: providerQuorum.divergenceThresholdBps,
      confidenceCap: Math.min(sourceQuote.confidenceCap ?? 100, providerQuorum.confidenceCap),
      primaryPrice: providerQuorum.primaryPrice,
      secondaryPrice: providerQuorum.secondaryPrice,
      secondarySource: providerQuorum.secondarySource,
      consensusNotes: providerQuorum.reasons,
      providerQuorum,
      providerObservations,
      providerEvidencePolicy,
      pass2808ChartReceipt: buildPass2808ChartReceipt({
        ...mergedSourceQuote,
        candles: effectiveCandles,
      }, rangeKey),
      providerEvidence: [
        ...((sourceQuote as { providerEvidence?: Array<{ label: string; value: string; source: string }> }).providerEvidence ?? []),
        ...(meta ? [{ label: "Quote metadata", value: "Yahoo quote/summary metadata merged into the content-bound observation", source: "query1.finance.yahoo.com" }] : []),
        ...(stooq && !sourceIsStooq ? [{ label: "Independent reference lane", value: `Stooq daily · ${providerQuorum.comparability} · ${providerQuorum.state}`, source: "stooq.com" }] : []),
        { label: "Provider quorum receipt", value: providerQuorum.observationDigest, source: "Velmère provider quorum" },
      ],
    };
  });

  const hydratedQuotes = await Promise.all(baseHydratedQuotes.map(async (quote) => {
    const providerHistory = await recordProviderObservation({
      assetKey: String(quote.symbol ?? "UNKNOWN"),
      quorum: quote.providerQuorum,
    });
    const providerEvidencePolicy = applyHistoricalEvidencePolicy({
      current: quote.providerEvidencePolicy,
      history: providerHistory,
    });
    const hydratedQuote = {
      ...quote,
      providerHistory,
      providerEvidencePolicy,
      confidenceCap: Math.min(quote.confidenceCap ?? 100, providerHistory.state === "anomalous" ? 40 : providerHistory.state === "watch" ? 72 : 100),
      providerEvidence: [
        ...(quote.providerEvidence ?? []),
        { label: "Provider history receipt", value: providerHistory.receiptDigest, source: "Velmère provider observation ledger" },
      ],
    };
    const pass4818ProviderEvidenceReceipts = buildPass4818RealMarketsProviderReceipts({
      quote: hydratedQuote as RealMarketsCustomerEvidenceQuote,
      generatedAt,
    });
    return {
      ...hydratedQuote,
      pass4818ProviderEvidenceReceipts,
      pass4818ProviderEvidenceDigest: pass4818RealMarketsReceiptDigest(pass4818ProviderEvidenceReceipts),
    };
  }));

  const pass4756ProviderHistoryGate = {
    schemaVersion: "velmere.pass4756.provider-history-gate.v1",
    totalQuotes: hydratedQuotes.length,
    durableHistory: hydratedQuotes.filter((quote) => quote.providerHistory?.durability === "supabase").length,
    stable: hydratedQuotes.filter((quote) => quote.providerHistory?.state === "stable").length,
    watch: hydratedQuotes.filter((quote) => quote.providerHistory?.state === "watch").length,
    anomalous: hydratedQuotes.filter((quote) => quote.providerHistory?.state === "anomalous").length,
    insufficientHistory: hydratedQuotes.filter((quote) => quote.providerHistory?.state === "insufficient_history").length,
    advancedHistoryEligible: hydratedQuotes.filter((quote) => quote.providerHistory?.historicalEvidenceEligible).length,
    rule: "Advanced-confirmed evidence requires durable cross-request history with at least three stable exact-window observations; memory-only history can never authorize Advanced evidence.",
  };

  const pass4755ProviderQuorumGate = {
    schemaVersion: "velmere.pass4755.provider-quorum-gate.v1",
    requestedTier,
    automatedDeliveryTier,
    totalQuotes: hydratedQuotes.length,
    aligned: hydratedQuotes.filter((quote) => quote.providerQuorum?.state === "aligned").length,
    watch: hydratedQuotes.filter((quote) => quote.providerQuorum?.state === "watch").length,
    divergent: hydratedQuotes.filter((quote) => quote.providerQuorum?.state === "divergent").length,
    singleSource: hydratedQuotes.filter((quote) => quote.providerQuorum?.state === "single_source").length,
    unavailable: hydratedQuotes.filter((quote) => quote.providerQuorum?.state === "unavailable").length,
    freshPaidEvidenceAllowed: hydratedQuotes.filter((quote) => quote.providerEvidencePolicy?.freshPaidEvidenceAllowed).length,
    downgradedEvidence: hydratedQuotes.filter((quote) => quote.providerEvidencePolicy?.downgradeRequired).length,
    rule: "Paid tier purchase does not upgrade weak data. Advanced-confirmed claims require two fresh, aligned providers inside the exact timestamp window; reference-close, stale, divergent and single-source lanes remain explicitly downgraded.",
  };

  const pass4818AllProviderEvidenceReceipts = hydratedQuotes.flatMap((quote) => quote.pass4818ProviderEvidenceReceipts ?? []);
  const pass4818ObservedSourceLabels = hydratedQuotes.flatMap((quote) => [
    quote.providerObservations?.primary?.source ?? null,
    quote.providerObservations?.secondary?.source ?? null,
  ]).filter((value): value is string => Boolean(value));
  const pass4993CanonicalTargets = Array.from(new Set(hydratedQuotes.map((quote, index) =>
    pass4993RealMarketsCanonicalIdentity(requested[index]?.symbol, quote.assetClass),
  ).filter((value): value is string => Boolean(value))));
  // A batch cannot share one signed projection across multiple targets. Only
  // the exact single-target path is allowed to produce content-bound receipts.
  const pass4993SingleCanonicalIdentity = requested.length === 1 && pass4993CanonicalTargets.length === 1
    ? pass4993CanonicalTargets[0]
    : null;
  const pass4818RealMarketsSourceBinding = buildCustomerReportSourceBinding({
    providerEvidenceReceipts: pass4818AllProviderEvidenceReceipts,
    observedSourceLabels: pass4818ObservedSourceLabels,
    generatedAt,
    expectedCanonicalIdentity: pass4993SingleCanonicalIdentity,
  });
  const sourceReceipts = pass4818RealMarketsSourceBinding.receipts.filter((receipt) => receipt.evidenceState === "content_bound");

  const pass2815RealMarketsIntegrityVault = buildPass2815ReportIntegrityVault({
    reportId: `VLM-RM-${requested.map((item) => item.symbol.replace(/[^A-Z0-9]/gi, "")).join("-").slice(0, 48) || "BATCH"}`,
    tier: automatedDeliveryTier,
    payloadHash: pass2812AccessContext.payloadHash,
    generatedAt,
    sourceReceipts,
    reportAccessDecision: pass2812RealMarketsAccessDecision,
    sourcePoisoningFirewall: pass2814RealMarketsSourcePoisoningFirewall,
  });
  const pass2816RealMarketsRuntimeObservabilityLedger = buildPass2816RuntimeObservabilityLedger({
    surface: "Real Markets",
    tier: automatedDeliveryTier,
    requestedUnits: requested.length,
    sourceBoundUnits: hydratedQuotes.filter((quote) => quote.pass2808ChartReceipt?.status === "source_bound").length,
    skeletonOrMissingUnits: hydratedQuotes.filter((quote) => quote.pass2808ChartReceipt?.status !== "source_bound").length,
    containedFailures: quoteSettled.filter((entry) => entry.status === "rejected").length + hydratedQuotes.filter((quote) => quote.providerStatus === "provider_error" || quote.state === "unavailable").length,
    hardFailures: pass2815RealMarketsIntegrityVault.releaseGate.status === "block" || pass2814RealMarketsSourcePoisoningFirewall.releaseGate.status === "block" ? 1 : 0,
    serverUnitBudget: PASS2809_REAL_MARKETS_SERVER_SYMBOL_BUDGET,
    softTimeoutMs: 4800,
    retryAfterMs: 30000,
    maxConcurrentBatches: 3,
    batchMode: tableBatchMode ? "table" : "detail",
  });

  const pass4818CustomerQuote = requested.length === 1 && hydratedQuotes.length === 1
    ? hydratedQuotes[0] as typeof hydratedQuotes[number] & RealMarketsCustomerEvidenceQuote
    : null;
  const pass4818CustomerMissingEvidence = pass4818CustomerQuote
    ? buildPass4818RealMarketsMissingEvidence(pass4818CustomerQuote)
    : [];
  const pass4818CustomerProviderConflicts = pass4818CustomerQuote
    ? buildPass4818RealMarketsProviderConflicts(pass4818CustomerQuote)
    : [];
  const pass4818CustomerProviderReceipts = pass4818CustomerQuote?.pass4818ProviderEvidenceReceipts ?? [];
  const pass4818CustomerSourceBinding = buildCustomerReportSourceBinding({
    providerEvidenceReceipts: pass4818CustomerProviderReceipts,
    observedSourceLabels: pass4818CustomerQuote ? [
      pass4818CustomerQuote.providerObservations?.primary?.source ?? "",
      pass4818CustomerQuote.providerObservations?.secondary?.source ?? "",
    ].filter(Boolean) : [],
    generatedAt,
    expectedCanonicalIdentity: pass4993SingleCanonicalIdentity,
  });
  const pass4818ChartSourceBound = pass4818CustomerQuote?.pass2808ChartReceipt?.status === "source_bound"
    && (pass4818CustomerQuote.pass2808ChartReceipt.candleCount ?? 0) >= 2;
  const pass4818DurableHistory = pass4818CustomerQuote?.providerHistory?.durability === "supabase"
    && pass4818CustomerQuote.providerHistory.persisted;
  const pass4818FreshPaidEvidence = pass4818CustomerQuote?.providerEvidencePolicy?.freshPaidEvidenceAllowed === true;
  const pass4818CustomerDecisionSections = pass4818CustomerQuote
    ? buildPass4818RealMarketsDecisionSections({
        quote: pass4818CustomerQuote,
        deliveredTier: automatedDeliveryTier,
      })
    : [];
  const pass98AutomatedStressScenarioExecuted = false;
  const pass98AdvancedDecisionReady = pass4818CustomerDecisionSections.some(
    (section) => section.minimumTier === "Advanced" && (section.state === "ready" || section.state === "watch"),
  );
  const pass98AdvancedAutomationVerified = requestedTier !== "Advanced" || Boolean(
    pass4818CustomerQuote
    && pass4818ChartSourceBound
    && pass4818DurableHistory
    && pass4818FreshPaidEvidence
    && pass4818CustomerSourceBinding.independentContentBoundUpstreamCount >= 3
    && pass4818CustomerQuote.providerQuorum.state === "aligned"
    && pass4818CustomerQuote.providerQuorum.freshnessState === "fresh"
    && pass98AutomatedStressScenarioExecuted
    && pass98AdvancedDecisionReady,
  );
  const pass4825RawObservedTimestamp = pass4818CustomerQuote?.providerObservations?.primary?.sourceTimestamp
    ?? pass4818CustomerQuote?.sourceTimestamp
    ?? null;
  const pass4825ObservedTimestampMs = typeof pass4825RawObservedTimestamp === "number" && Number.isFinite(pass4825RawObservedTimestamp)
    ? pass4825RawObservedTimestamp > 10_000_000_000
      ? pass4825RawObservedTimestamp
      : pass4825RawObservedTimestamp * 1_000
    : Number.NaN;
  const pass4825GeneratedAtMs = Date.parse(generatedAt);
  const pass4825ObservedAt = Number.isFinite(pass4825ObservedTimestampMs)
    ? new Date(pass4825ObservedTimestampMs).toISOString()
    : null;
  const pass4825QuoteCurrency = /^[A-Z]{3}$/.test(String(pass4818CustomerQuote?.currency ?? "").trim().toUpperCase())
    ? String(pass4818CustomerQuote?.currency).trim().toUpperCase()
    : null;
  const pass4825CanonicalQuoteReady = pass4818CustomerQuote?.state === "live"
    && pass4818CustomerSourceBinding.contentBoundReceiptCount > 0
    && Number.isFinite(pass4825GeneratedAtMs)
    && Number.isFinite(pass4825ObservedTimestampMs)
    && pass4825ObservedTimestampMs <= pass4825GeneratedAtMs + 1_000
    && pass4825GeneratedAtMs - pass4825ObservedTimestampMs <= 300_000;
  const pass4825QuoteConfidence = Math.max(0, Math.min(100, pass4818CustomerQuote?.confidenceCap ?? 0));
  const pass4825QuoteMetric = (
    value: unknown,
    missingReason: string,
    options: { currency?: string | null; min?: number; max?: number; ready?: boolean } = {},
  ): Pass4825RuntimeFieldValue => {
    const numeric = typeof value === "number" && Number.isFinite(value) ? value : null;
    const inRange = numeric !== null
      && (options.min === undefined || numeric >= options.min)
      && (options.max === undefined || numeric <= options.max);
    const available = pass4825CanonicalQuoteReady && options.ready !== false && inRange;
    return {
      value: available ? numeric : null,
      missingReason: available ? null : missingReason,
      currency: options.currency ?? undefined,
      confidence: available ? pass4825QuoteConfidence : 0,
      quality: available ? pass4825QuoteConfidence : 0,
      observedAt: available ? pass4825ObservedAt! : generatedAt,
    };
  };
  const pass4825RealMarketsCanonicalValues: Record<string, Pass4825RuntimeFieldValue> = {
    "market.price": pass4825QuoteMetric(
      pass4825QuoteCurrency ? pass4818CustomerQuote?.currentPrice : null,
      pass4825QuoteCurrency ? "fresh source-bound market price unavailable" : "ISO-4217 quote currency unavailable",
      { currency: pass4825QuoteCurrency ?? "USD", min: Number.MIN_VALUE },
    ),
    "market.change_24h": pass4825QuoteMetric(pass4818CustomerQuote?.priceChange24h, "fresh source-bound 24h change unavailable", { min: -100, max: 1_000_000 }),
    "market.volume_24h": pass4825QuoteMetric(
      pass4825QuoteCurrency ? pass4818CustomerQuote?.volume24h : null,
      pass4825QuoteCurrency ? "fresh source-bound 24h volume unavailable" : "ISO-4217 quote currency unavailable",
      { currency: pass4825QuoteCurrency ?? "USD", min: 0 },
    ),
    "market.change_1h": pass4825QuoteMetric(pass4818CustomerQuote?.priceChange1h, "fresh source-bound 1h change unavailable", { min: -100, max: 1_000_000 }),
    "source.second_source_divergence_bps": pass4825QuoteMetric(
      pass4818CustomerQuote?.providerQuorum.divergenceBps,
      "timestamp-comparable second-source divergence unavailable",
      {
        min: 0,
        max: 1_000_000,
        ready: pass4818CustomerQuote?.providerQuorum.comparability === "exact_window"
          || pass4818CustomerQuote?.providerQuorum.comparability === "reference_window",
      },
    ),
    "evidence.claim_ledger": {
      value: pass4818DurableHistory ? {
        state: "durable",
        historyReceiptDigest: pass4818CustomerQuote?.providerEvidencePolicy.historyReceiptDigest ?? null,
        claims: pass4818CustomerDecisionSections.map((section) => ({
          id: section.id,
          state: section.state,
          evidenceCount: section.evidence.length,
        })),
      } : { state: "unavailable", limitation: "durable_provider_history_not_verified" },
      confidence: pass4818DurableHistory ? pass4825QuoteConfidence : 0,
    },
  };
  const pass4825RiskVerdictPublicationReady =
    Boolean(pass4818CustomerQuote) &&
    pass4825CanonicalQuoteReady &&
    pass4818FreshPaidEvidence &&
    pass4818CustomerSourceBinding.independentContentBoundUpstreamCount >= 2 &&
    pass4818CustomerQuote!.providerQuorum.state === "aligned" &&
    pass4818CustomerQuote!.providerQuorum.freshnessState === "fresh";
  const pass4818CustomerReportPayload =
    pass4818CustomerQuote && pass4825RiskVerdictPublicationReady
      ? buildCustomerReportPayload({
    locale: reportLocale,
    tier: automatedDeliveryTier,
    symbol: String(pass4818CustomerQuote.symbol ?? requested[0]?.symbol ?? "UNKNOWN"),
    name: `${String(pass4818CustomerQuote.symbol ?? requested[0]?.symbol ?? "UNKNOWN")} ${String(pass4818CustomerQuote.exchange ?? "").trim()}`.trim(),
    family: pass4818ReportFamily(pass4818CustomerQuote.assetClass),
    reportSurface: "real_markets",
    riskScore: buildPass4818RealMarketsEvidenceRisk(pass4818CustomerQuote),
    sourceFamilyCount: pass4818CustomerSourceBinding.independentContentBoundUpstreamCount,
    missingEvidence: pass4818CustomerMissingEvidence,
    providerConflicts: pass4818CustomerProviderConflicts,
    chartMode: pass4818ChartSourceBound ? "live_ohlcv" : "unavailable",
    chartLifecycleReceipt: buildChartLifecycleReceipt({
      state: pass4818ChartSourceBound ? "source_bound" : "unavailable_skeleton",
      sourceLabel: pass4818CustomerQuote.pass2808ChartReceipt?.source ?? String(pass4818CustomerQuote.source ?? "provider unavailable"),
      timeframeLabel: rangeMeta[rangeKey].uiLabel,
      lastUpdatedLabel: generatedAt,
      candleCount: pass4818CustomerQuote.pass2808ChartReceipt?.candleCount ?? 0,
      confidenceScore: pass4818CustomerQuote.pass2808ChartReceipt?.confidence ?? pass4818CustomerQuote.confidenceCap ?? 0,
    }),
    providerEvidenceReceipts: pass4818CustomerProviderReceipts,
    observedSourceLabels: pass4818CustomerQuote ? [
      pass4818CustomerQuote.providerObservations?.primary?.source ?? "",
      pass4818CustomerQuote.providerObservations?.secondary?.source ?? "",
    ].filter(Boolean) : [],
    expectedCanonicalIdentity: pass4993SingleCanonicalIdentity,
    stressTestExecuted: pass98AutomatedStressScenarioExecuted,
    evidenceLedgerPresent: pass4818DurableHistory,
    advancedDeliveryMode: "automated",
    advancedAutomationVerified: pass98AdvancedAutomationVerified,
    providerTimestamps: pass4818CustomerProviderReceipts
      .filter((receipt) => isPass4644CommerciallyFreshReceipt(receipt, Date.parse(generatedAt)))
      .map((receipt) => receipt.observedAt),
    decisionSections: pass4818CustomerDecisionSections,
    coverageInput: {
      data: pass4818CustomerQuote.state === "live" && typeof pass4818CustomerQuote.currentPrice === "number"
        ? typeof pass4818CustomerQuote.volume24h === "number" ? 94 : 82
        : 24,
      provider: pass4818CustomerSourceBinding.independentContentBoundUpstreamCount >= 2
        ? pass4818CustomerQuote.providerQuorum.state === "aligned" ? 92 : 64
        : pass4818CustomerSourceBinding.independentContentBoundUpstreamCount === 1 ? 45 : 15,
      historical: pass4818ChartSourceBound ? pass4818DurableHistory ? 92 : 72 : 28,
      evidence: pass4818FreshPaidEvidence ? 92 : pass4818CustomerSourceBinding.independentContentBoundUpstreamCount >= 2 ? 55 : 32,
    },
    missingCriticalEvidence: pass4818CustomerMissingEvidence.length,
    dataWindow: `${rangeKey}:${rangeMeta[rangeKey].label}`,
    accountId: pass2812AccessContext.accountId,
    serverReceiptId: pass2812AccessContext.serverReceiptId,
    reportToken: pass2812AccessContext.reportToken,
    payloadHash: pass2812AccessContext.payloadHash,
    manualReviewReceiptId: null,
    accessVerification: pass2812AccessContext.verification,
    generatedAt,
    runtimeCanonicalValues: pass4825RealMarketsCanonicalValues,
  }) : null;
  const pass98CustomerPaidTierDeliveryDecision = buildP98CustomerPaidTierExactDeliveryDecision({
    requestedTier,
    analyzedTier: automatedDeliveryTier,
    payloadTier: pass4818CustomerReportPayload?.tier ?? null,
    deliveryPolicy: pass4818CustomerReportPayload?.deliveryPolicy ?? null,
  });
  if (requestedTier !== "Basic" && !pass98CustomerPaidTierDeliveryDecision.artifactCreationAllowed) {
    return NextResponse.json(
      toP98CustomerPaidTierWithheldPayload(pass98CustomerPaidTierDeliveryDecision),
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }
  const pass4819CustomerReportPreviewLayout = pass4818CustomerReportPayload
    ? buildCustomerReportLayoutModel(pass4818CustomerReportPayload)
    : null;
  let pass4818CustomerReportPdfToken:
    | ReturnType<typeof issuePass4818CustomerReportRenderToken>
    | Awaited<ReturnType<typeof createPass4823RealMarketsPaidAccountArtifact>>["pdfToken"]
    | null = null;
  let pass4823RealMarketsAccountArtifact: Awaited<ReturnType<typeof createPass4823RealMarketsPaidAccountArtifact>>["accountArtifact"] | null = null;
  if (pass4818CustomerReportPayload) {
    if (requestedTier !== "Basic") {
      if (!resolvedAccount) {
        return NextResponse.json(
          { ok: false, error: "account_session_required_for_paid_artifact" },
          { status: 401, headers: { "cache-control": "no-store" } },
        );
      }
      try {
        const paidArtifact = await createPass4823RealMarketsPaidAccountArtifact({
          payload: pass4818CustomerReportPayload,
          accountId: resolvedAccount.accountId,
          requestedTier,
        });
        pass4818CustomerReportPdfToken = paidArtifact.pdfToken;
        pass4823RealMarketsAccountArtifact = paidArtifact.accountArtifact;
      } catch {
        return NextResponse.json(
          { ok: false, error: "real_markets_paid_artifact_unavailable", requestedTier },
          { status: 503, headers: { "cache-control": "no-store" } },
        );
      }
    } else {
      pass4818CustomerReportPdfToken = issuePass4818CustomerReportRenderToken({
        payload: pass4818CustomerReportPayload,
        accountId: null,
        requestedTier,
      });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      generatedAt,
      range: rangeKey,
      rangeMeta: rangeMeta[rangeKey],
      rangeSemantics: "PASS2318: timeframe chips show provider window and candle interval. 1w is 5Y weekly macro history, not last seven days.",
      router: pass458ProviderTruthRouterContract,
      consensus: pass460ProviderConsensusContract,
      providerQuorum: pass4755ProviderQuorumGate,
      providerHistory: pass4756ProviderHistoryGate,
      venueHealth: pass461VenueHealthContract,
      crossVenue: pass462CrossVenueConsensusContract,
      pairCoverage: pass463CanonicalPairCoverageContract,
      fundamentalQuality: pass464FundamentalQualityContract,
      secXbrlQuality: pass465SecXbrlQualityContract,
      detailHydration: detail && requested.length === 1,
      metadataHydration: Object.keys(quoteMetadata).length > 0,
      requestedTier,
      automatedDeliveryTier,
      deliveredTier: pass4818CustomerReportPayload?.deliveryPolicy.visibleTier ?? null,
      pass98CustomerPaidTierDelivery:
        pass98CustomerPaidTierDeliveryDecision.exactTierMatch && pass98CustomerPaidTierDeliveryDecision.visibleTier !== null
          ? toP98CustomerPaidTierDeliveryProjection(pass98CustomerPaidTierDeliveryDecision)
          : null,
      pass4818RealMarketsSourceBinding,
      pass4825RiskVerdictPublicationBoundary: {
        state: pass4825RiskVerdictPublicationReady
          ? "verified_current"
          : "withheld",
        numericalRiskPublished:
          pass4825RiskVerdictPublicationReady &&
          Boolean(pass4818CustomerReportPayload),
        pdfArtifactEligible:
          pass4825RiskVerdictPublicationReady &&
          Boolean(pass4818CustomerReportPdfToken?.ok),
        blocker: pass4825RiskVerdictPublicationReady
          ? null
          : "fresh_rights_authorized_two_source_aligned_quote_required",
      },
      pass4818CustomerReport: pass4818CustomerReportPayload,
      pass4819CustomerReportPreviewLayout,
      pass4823RealMarketsAccountArtifact,
      pass4818CustomerReportPdfArtifact: pass4818CustomerReportPdfToken?.ok ? {
        available: true,
        endpoint: "/api/market-integrity/report-pdf",
        method: "POST",
        renderToken: pass4818CustomerReportPdfToken.token,
        expiresAt: pass4818CustomerReportPdfToken.expiresAt,
        ...pass4818CustomerReportPdfToken.artifact,
      } : pass4818CustomerReportPdfToken ? {
        available: false,
        error: pass4818CustomerReportPdfToken.error,
      } : null,
      pass2807ProviderCircuitBreaker: {
        schemaVersion: "pass2807_real_markets_timeout_safe_batch_v1",
        tableBatchMode,
        requestedSymbols: requested.map((item) => item.symbol),
        resolvedQuotes: quotes.filter((quote) => quote.state === "live").length,
        containedFailures: quoteSettled.filter((entry) => entry.status === "rejected").length,
        rule: "Provider ETIMEDOUT/UND_ERR_CONNECT_TIMEOUT must degrade to missing evidence and neutral chart skeletons, not 500 failed-to-pipe responses.",
      },
      pass2808ChartReceiptGate: {
        schemaVersion: "pass2808_chart_receipt_gate_v1",
        requestedSymbols: requested.map((item) => item.symbol),
        sourceBoundCharts: hydratedQuotes.filter((quote) => quote.pass2808ChartReceipt?.status === "source_bound").length,
        skeletonRequiredCharts: hydratedQuotes.filter((quote) => quote.pass2808ChartReceipt?.status === "skeleton_required").length,
        rule: "Every table/PDF chart must carry a chart receipt. Missing candles render skeleton; no fake live chart is allowed.",
      },
      pass2809RuntimeRequestBudget: {
        schemaVersion: "pass2809_real_markets_request_budget_v1",
        serverSymbolBudget: PASS2809_REAL_MARKETS_SERVER_SYMBOL_BUDGET,
        requestedSymbols: requested.map((item) => item.symbol),
        sourceBoundCharts: hydratedQuotes.filter((quote) => quote.pass2808ChartReceipt?.status === "source_bound").length,
        skeletonRequiredCharts: hydratedQuotes.filter((quote) => quote.pass2808ChartReceipt?.status === "skeleton_required").length,
        staleResponsePolicy: "Client ignores stale/aborted quote batches so old Yahoo/Stooq responses cannot overwrite a newer Real Markets universe.",
        failurePolicy: "Provider failures remain 200 with unavailable quote receipts and neutral chart skeletons whenever the route can respond.",
      },
      pass2810PdfChartLifecycleGate: {
        schemaVersion: "pass2810_pdf_chart_lifecycle_gate_v1",
        requestedSymbols: requested.map((item) => item.symbol),
        pdfSourceChartsAllowed: hydratedQuotes.filter((quote) => quote.pass2808ChartReceipt?.status === "source_bound" && (quote.pass2808ChartReceipt?.candleCount ?? 0) >= 2).length,
        pdfSkeletonBoxesRequired: hydratedQuotes.filter((quote) => quote.pass2808ChartReceipt?.status !== "source_bound" || (quote.pass2808ChartReceipt?.candleCount ?? 0) < 2).length,
        rendererRule: "PDF report must render a neutral unavailable/skeleton box for any chart receipt that is not source_bound with at least two candles.",
      },
      pass2811RealMarketsTierDifferentiationGate: {
        ...buildPass2811TierSuite().gate,
        surfaceSchemaVersion: "pass2811_real_markets_basic_pro_advanced_gate_v1",
        requestedSymbols: requested.map((item) => item.symbol),
        rule: "Real Markets Basic/Pro/Advanced outputs must differ by source families, receipt bundle depth, chart policy and availability/entitlement boundary before any PDF or paid claim.",
      },
      pass2812RealMarketsPaidAccessGate: {
        ...pass2812RealMarketsAccessDecision,
        surfaceSchemaVersion: "pass2812_real_markets_paid_access_gate_v1",
        requestedSymbols: requested.map((item) => item.symbol),
        tableBatchMode,
        rule: "Real Markets Pro/Advanced PDF/source receipts stay locked without server receipt + account binding + expiring report token + payload hash binding.",
      },
      pass2812RealMarketsPaidTierSecuritySuite,
      pass2813RealMarketsVlmBrainPlan: buildPass2813SurfaceBrainPlan({
        surface: "Real Markets",
        assetFamilies: requested.map((item) => pass2813RealMarketFamilyForSymbol(item.symbol)),
        tier: requestedTier,
        sourceBoundCharts: hydratedQuotes.filter((quote) => quote.pass2808ChartReceipt?.status === "source_bound").length,
        skeletonCharts: hydratedQuotes.filter((quote) => quote.pass2808ChartReceipt?.status !== "source_bound").length,
        paidEvidenceAllowed: pass2812RealMarketsAccessDecision.paidEvidenceAllowed,
      }),
      pass2813RealMarketsVlmBrainRule: "Real Markets must route VLM Brain by asset family so equities/ETF/FX/commodities never use ERC-20 holder/contract lanes.",
      pass2814RealMarketsSourcePoisoningFirewall,
      pass2814RealMarketsProviderSafetyRule: "Yahoo/Stooq provider fetches pass protocol/private-host policy before they can create source receipts; blocked/timeout sources become missing evidence and skeleton charts.",
      pass2815RealMarketsIntegrityVault,
      pass2815RealMarketsIntegrityRule: "Real Markets batches expose payloadHash/sourceReceiptMerkleRoot so UI, PDF handoff and account delivery cannot drift or replay paid evidence.",
      pass2816RealMarketsRuntimeObservabilityLedger,
      pass2816RealMarketsRuntimeRule: "Real Markets table/detail batches expose runtime health counters so source failures degrade into missing evidence and grey chart skeletons instead of fake live charts or 500 responses.",

      pass2288ClaimProofFirewall: {
        schemaVersion: "pass2288_real_markets_route_claim_proof_firewall_v1",
        requestedSymbols: requested.map((item) => item.symbol),
        rule: "Real Markets response must expose provider-family proof before verdict; Yahoo chart+quote remains one source family, Stooq only counts if returned, wallet connect is not payment proof.",
        advancedAuditPriceEur: 149,
        receiptBoundary: "Advanced Audit 149€ requires server-side Stripe/BLIK/Web3 receipt; Connect Wallet alone never unlocks paid evidence.",
      },
      pass2289CustomerReleaseGate: {
        schemaVersion: "pass2289_real_markets_route_customer_release_gate_v1",
        requestedSymbols: requested.map((item) => item.symbol),
        requiredVisibleSections: ["asset family", "provider families", "confidence cap", "missing proof", "149€ receipt boundary"],
        rule: "Real Markets customer output is not release-ready unless source proof and payment boundary are visible before verdict.",
        blockedLanguage: ["DEX liquidity for equities", "wallet holders for ETFs", "token tax for indexes", "wallet connect as payment proof"],
      },
      pass2290ReleaseTraceLedger: {
        schemaVersion: "pass2290_real_markets_route_release_trace_ledger_v1",
        requestedSymbols: requested.map((item) => item.symbol),
        requiredTraceOrder: ["asset family", "sources", "confidence cap", "missing proof", "tier boundary", "149€ receipt boundary"],
        rule: "Real Markets customer cards and VLM detail outputs must preserve ordered trace sections before verdict; wallet connect is identity/context only, not payment proof.",
        blockedLanguage: ["DEX liquidity for NVDA", "wallet holders for SPY", "token tax for S&P 500", "Advanced unlocked by wallet connect"],
      },
      pass2291ProductionReplayGate: {
        schemaVersion: "pass2291_real_markets_route_production_replay_gate_v1",
        requestedSymbols: requested.map((item) => item.symbol),
        replayAssets: ["BTC", "ETH", "SOL", "NVDA", "AAPL", "SPY", "QQQ", "S&P 500"],
        requiredReplayChecks: ["visible Basic/Pro/Advanced difference", "source family line", "confidence cap line", "missing proof line", "149€ server receipt boundary"],
        rule: "Real Markets customer output must be replay-audited after the trace ledger; static 35 is source-gap priority and wallet connect never proves payment.",
      },
      pass69EcbOfficialFxReferenceEnvelope: pass69EcbReferenceEnvelope,
      pass69EcbOfficialFxReferenceBoundary: {
        fields: ["market.reference_rate", "market.reference_date"],
        sourceAttribution: pass69EcbReferenceEnvelope.attribution,
        referenceOnly: true,
        executableQuote: false,
        marketPriceFieldEligible: false,
        riskVerdictEligible: false,
        paidValueEligible: false,
        rule: "ECB reference statistics are a separate customer reference lane and can never satisfy market.price, quote freshness, execution, risk verdict, paid delta or sale gates.",
      },
      dataContract: realMarketsDataContract,
      canonicalQuotes: hydratedQuotes.map((quote) =>
        toCanonicalRealMarketInstrument(quote),
      ),
      quotes: hydratedQuotes,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

// PASS2288 markers: Real Markets route returns pass2288ClaimProofFirewall route state so NVDA/SPY/S&P500 output cannot outrun provider-family proof.
// PASS2289 markers: Real Markets route returns pass2289CustomerReleaseGate with required visible sections before any customer-facing verdict.
// PASS2290 markers: Real Markets route returns pass2290ReleaseTraceLedger with ordered family → sources → confidence → missing proof → tier → payment trace.
// PASS2291 markers: Real Markets route returns pass2291ProductionReplayGate with replay assets BTC/NVDA/SPY/S&P 500 and blocks Advanced 149€ without server receipt.
