import { createOsintQueuePreview } from "@/lib/market-integrity/osint-queue-contract";

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
    ok: false,
    mode: "osint_queue_preview_only",
    preview: createOsintQueuePreview(),
    storageWritePerformed: false,
    externalFetchPerformed: false,
    productionBoundary:
      "Diagnostic route only. OSINT Queue requires source ledger, reviewer identity and safe paraphrase before export.",
  }, 423);
}
