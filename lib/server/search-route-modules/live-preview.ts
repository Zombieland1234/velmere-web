import { searchVelmereIntelligence, type VelmereSearchMode } from "@/lib/search/intelligence-search-contract";
import { createLiveSearchAdapterPreview } from "@/lib/search/live-search-adapter-skeleton";
import { sanitizeSearchInput, velmereSearchSafetyBoundary } from "@/lib/search/intelligence-search-safety";

const allowedModes = new Set<VelmereSearchMode>([
  "all",
  "token",
  "market",
  "contract",
  "velmere",
  "osint",
]);

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
  const rawMode = url.searchParams.get("mode") ?? "all";
  const mode = allowedModes.has(rawMode as VelmereSearchMode) ? rawMode as VelmereSearchMode : "all";
  const search = searchVelmereIntelligence(query, mode);
  const preview = createLiveSearchAdapterPreview(search.query, mode, search.results);

  return jsonResponse({
    ok: false,
    mode: "live_search_adapter_preview_only",
    boundary: velmereSearchSafetyBoundary,
    preview,
    storageWritePerformed: false,
    externalFetchPerformed: false,
    productionBoundary:
      "Diagnostic route only. It shows the future live adapter skeleton and does not fetch public web or OSINT sources.",
  }, 423);
}
