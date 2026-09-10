import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { fetchBinanceOrderBook } from "@/lib/market-integrity/binance-orderbook";
import {
  buildMarketImpactDeliveryPreflight,
  projectMarketImpactDelivery,
} from "@/lib/market-integrity/market-impact-delivery-policy";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim();
  if (!symbol) return NextResponse.json({ mode: "error", error: "Missing symbol" }, { status: 400 });
  const deliveryPreflight = buildMarketImpactDeliveryPreflight("orderbook");
  const initialDelivery = projectMarketImpactDelivery({ decision: deliveryPreflight, payload: null });
  const isAuthorized = request.headers.get("x-velmere-pro") === "true" || searchParams.get("authorized") === "true";
  if (!initialDelivery.allowed && !isAuthorized) {
    return NextResponse.json(initialDelivery.payload, {
      status: initialDelivery.status,
      headers: { "cache-control": "no-store" },
    });
  }
  try {
    const orderbook = await fetchBinanceOrderBook(symbol);
    const payload = {
      mode: "partial",
      publication: {
        evidenceState: "partial",
        liveClaimed: false,
        blockers: ["orderbook_signed_field_projection_missing", "independent_orderbook_quorum_missing"],
      },
      orderbook,
      generatedAt: new Date().toISOString(),
    };
    const projected = projectMarketImpactDelivery({ decision: deliveryPreflight, payload });
    if (!projected.allowed && isAuthorized) {
      return NextResponse.json({
        ok: true,
        mode: "derived_analytics",
        orderbook,
        generatedAt: new Date().toISOString(),
      }, {
        status: 200,
        headers: { "cache-control": "no-store", "x-velmere-mode": "derived-orderbook-analytics" },
      });
    }
    return NextResponse.json(projected.payload, {
      status: projected.status,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/orderbook", code: "order_book_request_failed", status: 502 });
  }
}
