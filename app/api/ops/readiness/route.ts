export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

export async function GET() {
  return jsonResponse({
    ok: false,
    status: "pre_release_no_go",
    mode: "public_coarse_readiness",
    productionReady: false,
    productionBoundary: "Detailed operational readiness is restricted to authenticated control-plane surfaces.",
  }, 423);
}
