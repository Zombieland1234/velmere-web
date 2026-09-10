import { createVelmereLensRouteSnapshot } from "@/lib/search/velmere-lens-route-map";
import { velmereSearchSafetyBoundary } from "@/lib/search/intelligence-search-safety";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET() {
  return jsonResponse({
    ok: true,
    mode: "velmere_lens_route_preview",
    boundary: velmereSearchSafetyBoundary,
    snapshot: createVelmereLensRouteSnapshot(),
    storageWritePerformed: false,
    productionBoundary:
      "Velmère Lens is a router and short-capsule layer. It does not replace full Shield analysis.",
  });
}
