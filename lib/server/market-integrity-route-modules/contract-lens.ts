import { createContractLensPreview } from "@/lib/market-integrity/contract-lens-contract";

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
  const preview = createContractLensPreview({
    chain: url.searchParams.get("chain") ?? undefined,
    address: url.searchParams.get("address") ?? undefined,
    symbol: url.searchParams.get("symbol") ?? undefined,
  });

  return jsonResponse({
    ok: false,
    mode: "contract_lens_preview_only",
    preview,
    storageWritePerformed: false,
    externalFetchPerformed: false,
    productionBoundary:
      "Diagnostic route only. Contract Lens requires server-only analyzer output before production claims.",
  }, 423);
}
