import { NextResponse } from "next/server";
import { getPublicReleaseProvenanceFeed } from "@/lib/market-integrity/release-provenance-index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const environment = url.searchParams.get("environment");
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const feed = await getPublicReleaseProvenanceFeed({
      limit: Number.isFinite(limit) ? limit : 20,
      environment:
        environment === "staging" || environment === "production"
          ? environment
          : undefined,
    });
    return NextResponse.json(feed, {
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
        schemaVersion: "velmere.public-release-provenance-feed.v1",
        ok: false,
        items: [],
        error: "release_provenance_feed_unavailable",
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
