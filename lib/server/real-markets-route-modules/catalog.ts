import { NextResponse } from "next/server";
import {
  REAL_MARKETS_CUSTOMER_CATALOG_COMMERCIAL_RIGHTS_VERIFIED,
  REAL_MARKETS_CUSTOMER_CATALOG_COUNTS,
  REAL_MARKETS_CUSTOMER_CATALOG_DATA_MODE,
  REAL_MARKETS_CUSTOMER_CATALOG_LIVE_DATA_INCLUDED,
  REAL_MARKETS_CUSTOMER_CATALOG_ROWS,
  REAL_MARKETS_CUSTOMER_CATALOG_SHA256,
  REAL_MARKETS_CUSTOMER_CATALOG_SNAPSHOT_AT,
  REAL_MARKETS_CUSTOMER_CATALOG_SOURCE_SHA256,
} from "@/lib/market-integrity/real-markets-customer-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    responseGeneratedAt: new Date().toISOString(),
    catalogSnapshotAt: REAL_MARKETS_CUSTOMER_CATALOG_SNAPSHOT_AT,
    catalogDataMode: REAL_MARKETS_CUSTOMER_CATALOG_DATA_MODE,
    liveDataIncluded: REAL_MARKETS_CUSTOMER_CATALOG_LIVE_DATA_INCLUDED,
    commercialRightsVerified: REAL_MARKETS_CUSTOMER_CATALOG_COMMERCIAL_RIGHTS_VERIFIED,
    schemaVersion: "real_markets_catalog_v3",
    contract: {
      responseMode: "customer_catalog_compact",
      providerTimestampRequiredForLiveState: true,
      dynamicProviderSearch: true,
      noFakeVenuePrice: true,
      inheritedRowsDeduplicatedBy: "assetClass+symbol",
      historicalProofRuntime: "archived_offline",
      catalogSourceSha256: REAL_MARKETS_CUSTOMER_CATALOG_SOURCE_SHA256,
      catalogRowsSha256: REAL_MARKETS_CUSTOMER_CATALOG_SHA256,
      catalogFreshnessField: "catalogSnapshotAt",
      responseTimeMustNotImplyDataFreshness: true,
      cryptoRowsAreComparisonOnly: true,
    },
    counts: REAL_MARKETS_CUSTOMER_CATALOG_COUNTS,
    rows: REAL_MARKETS_CUSTOMER_CATALOG_ROWS,
  }, {
    headers: {
      "cache-control": "no-store",
      "x-velmere-catalog-mode": "customer-compact",
      "x-velmere-catalog-proof-runtime": "archived-offline",
    },
  });
}
