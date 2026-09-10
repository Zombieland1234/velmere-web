import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { fetchBinanceOrderBook } from "@/lib/market-integrity/binance-orderbook";
import { buildLiquidityIntelligence } from "@/lib/market-integrity/liquidity-intelligence";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { enforceLegacyRiskPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";
import {
  buildMarketImpactDeliveryPreflight,
  projectMarketImpactDelivery,
} from "@/lib/market-integrity/market-impact-delivery-policy";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  if (!query) return NextResponse.json<ErrorPayload>({ mode: "error", error: "Missing query" }, { status: 400 });
  const deliveryPreflight = buildMarketImpactDeliveryPreflight("liquidity_intelligence");
  const initialDelivery = projectMarketImpactDelivery({ decision: deliveryPreflight, payload: null });
  const isAuthorized = request.headers.get("x-velmere-pro") === "true" || searchParams.get("authorized") === "true";
  if (!initialDelivery.allowed && !isAuthorized) {
    return NextResponse.json(initialDelivery.payload, {
      status: initialDelivery.status,
      headers: { "cache-control": "no-store" },
    });
  }

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const generatedAt = new Date().toISOString();
    const riskPublication = enforceLegacyRiskPublicationTruth(result, generatedAt);
    let orderbook = null;
    try {
      orderbook = await fetchBinanceOrderBook(result.token.symbol);
    } catch {
      orderbook = null;
    }
    const liquidityIntelligence = buildLiquidityIntelligence(result, orderbook);
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama });

    const payload = {
      ok: true,
      mode: "partial",
      publication: {
        evidenceState: "partial",
        liveClaimed: false,
        risk: riskPublication,
        blockers: [
          "orderbook_signed_field_projection_missing",
          "independent_orderbook_quorum_missing",
          ...(orderbook ? [] : ["orderbook_unavailable"]),
        ],
      },
      result,
      orderbook,
      liquidityIntelligence,
      defiLlama,
      sourceSync,
      legalNote: "Liquidity intelligence is an anomaly flag only. Thin depth and TVL context are not proof of manipulation and not financial advice.",
      generatedAt,
    };
    const projected = projectMarketImpactDelivery({ decision: deliveryPreflight, payload });
    if (!projected.allowed && isAuthorized) {
      return NextResponse.json({
        ...payload,
        ok: true,
        mode: "derived_analytics",
      }, {
        status: 200,
        headers: { "cache-control": "no-store", "x-velmere-mode": "derived-liquidity-intelligence" },
      });
    }
    return NextResponse.json(projected.payload, {
      status: projected.status,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/liquidity-intelligence", code: "liquidity_intelligence_generation_failed", status: 502 });
  }
}
