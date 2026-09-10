import { NextResponse } from "next/server";
import {
  canonicalizeVerifySearchInput,
  searchPublishedPublicProofs,
} from "@/lib/market-integrity/public-proof-publication-resolver";
import {
  applyApiRateLimit,
  rejectOversizedUrl,
} from "@/lib/security/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const HEADERS = {
  "cache-control": "no-store, private, max-age=0",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
} as const;
const ALLOWED_PARAMETERS = new Set(["chainId", "contractAddress", "projectName", "limit"]);

export async function GET(request: Request) {
  const oversized = rejectOversizedUrl(request, 1_024);
  if (oversized) return oversized;
  const rate = await applyApiRateLimit(request, {
    keyPrefix: "verify-public-search",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rate.ok) return rate.response;

  const url = new URL(request.url);
  const parameterNames = [...url.searchParams.keys()];
  if (
    parameterNames.some((name) => !ALLOWED_PARAMETERS.has(name))
    || [...ALLOWED_PARAMETERS].some((name) => url.searchParams.getAll(name).length > 1)
  ) {
    return NextResponse.json({
      schemaVersion: "velmere.verify-public-search.v1",
      ok: false,
      results: [],
      error: "VERIFY_SEARCH_QUERY_INVALID",
    }, { status: 400, headers: HEADERS });
  }

  const input = canonicalizeVerifySearchInput({
    chainId: url.searchParams.get("chainId"),
    contractAddress: url.searchParams.get("contractAddress"),
    projectName: url.searchParams.get("projectName"),
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!input) {
    return NextResponse.json({
      schemaVersion: "velmere.verify-public-search.v1",
      ok: false,
      results: [],
      error: "VERIFY_SEARCH_QUERY_INVALID",
    }, { status: 400, headers: HEADERS });
  }

  const results = await searchPublishedPublicProofs(input);
  return NextResponse.json({
    schemaVersion: "velmere.verify-public-search.v1",
    ok: true,
    results,
    resultCount: results.length,
    identityAuthority: "chainId+contractAddress",
  }, { status: 200, headers: HEADERS });
}

export function POST() {
  return NextResponse.json({ ok: false, error: "METHOD_NOT_ALLOWED" }, {
    status: 405,
    headers: { ...HEADERS, allow: "GET" },
  });
}
