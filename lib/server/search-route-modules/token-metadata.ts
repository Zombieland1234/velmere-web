import { createTokenMetadataCacheSnapshot } from "@/lib/search/token-metadata-cache";
import { sanitizeSearchInput, velmereSearchSafetyBoundary } from "@/lib/search/intelligence-search-safety";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = sanitizeSearchInput(url.searchParams.get("q") ?? "");
  const snapshot = createTokenMetadataCacheSnapshot(query);

  return jsonResponse({
    ok: true,
    mode: "token_metadata_cache_preview",
    boundary: velmereSearchSafetyBoundary,
    snapshot,
    externalFetchPerformed: false,
    storageWritePerformed: false,
    productionBoundary:
      "Diagnostic metadata route only. It uses curated/cache-ready metadata and performs no external provider fetch.",
  });
}
