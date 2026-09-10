import { NextResponse } from "next/server";
import { applyApiRateLimit } from "@/lib/security/api-guard";
import { getPublicReleaseTransparencyWitnessRollbackResolutions } from "@/lib/market-integrity/release-transparency-witness-rollback-resolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rate = await applyApiRateLimit(request, { keyPrefix: "public-witness-rollback-resolutions", limit: 30, windowMs: 60_000 });
  if (!rate.ok) return rate.response;
  try {
    const url = new URL(request.url);
    const environment = url.searchParams.get("environment");
    const result = await getPublicReleaseTransparencyWitnessRollbackResolutions({
      environment: environment === "production" ? "production" : environment === "staging" ? "staging" : undefined,
      limit: Number(url.searchParams.get("limit") ?? 10),
    });
    return NextResponse.json(result, { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=60", "x-content-type-options": "nosniff" } });
  } catch {
    return NextResponse.json({ ok: false, error: "release_transparency_witness_rollback_resolution_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
