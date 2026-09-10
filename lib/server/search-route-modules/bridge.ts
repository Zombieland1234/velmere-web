import { buildVelmereShieldBridge, normalizeSearchQuery } from "@/lib/search/intelligence-search-contract";
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
  const asset = sanitizeSearchInput(url.searchParams.get("asset") ?? "");
  const bridge = buildVelmereShieldBridge(query, asset || undefined);

  return jsonResponse({
    ok: true,
    mode: "search_to_shield_bridge_preview",
    bridge,
    query: normalizeSearchQuery(query),
    boundary: velmereSearchSafetyBoundary,
    storageWritePerformed: false,
    productionBoundary:
      "Bridge preview only. It routes short search context into Shield and does not create a final risk verdict.",
  });
}
