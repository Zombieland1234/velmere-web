import { NextResponse } from "next/server";
import { getPublicReleaseTransparencyWitnessQuorums } from "@/lib/market-integrity/release-transparency-witness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const environment = url.searchParams.get("environment");
    const limit = Number(url.searchParams.get("limit") ?? "10");
    const result = await getPublicReleaseTransparencyWitnessQuorums({
      environment: environment === "staging" || environment === "production" ? environment : undefined,
      limit: Number.isFinite(limit) ? limit : 10,
    });
    return NextResponse.json(result, {
      status: 200,
      headers: {
        "cache-control": "public, max-age=30, stale-while-revalidate=60",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex, nofollow, noarchive",
      },
    });
  } catch {
    return NextResponse.json(
      {
        schemaVersion: "velmere.public-release-transparency-witness-quorums.v1",
        ok: false,
        quorums: [],
        error: "release_transparency_witness_feed_unavailable",
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "x-robots-tag": "noindex, nofollow, noarchive",
        },
      },
    );
  }
}
