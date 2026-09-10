import { NextResponse } from "next/server";
import { getPublicReleaseTransparencyWitnessHealth } from "@/lib/market-integrity/release-transparency-witness-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const environmentValue = url.searchParams.get("environment");
  const environment = environmentValue === "production" || environmentValue === "staging"
    ? environmentValue
    : undefined;
  const limit = Number(url.searchParams.get("limit") ?? 10);
  try {
    const result = await getPublicReleaseTransparencyWitnessHealth({ environment, limit });
    return NextResponse.json(result, {
      headers: {
        "cache-control": "public, max-age=30, stale-while-revalidate=60",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "release_transparency_witness_health_unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
