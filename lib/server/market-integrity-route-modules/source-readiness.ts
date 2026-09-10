import { createMarketIntegritySourceReadinessSnapshot } from "@/lib/market-integrity/live-source-adapter-contract";

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
  const snapshot = createMarketIntegritySourceReadinessSnapshot();

  return jsonResponse({
    ok: false,
    mode: "source_readiness_preview_only",
    route: "/api/market-integrity/source-readiness",
    snapshot,
    storageWritePerformed: false,
    productionBoundary:
      "Diagnostic route only. It does not fetch third-party data and does not claim a live source is verified.",
  }, 423);
}
