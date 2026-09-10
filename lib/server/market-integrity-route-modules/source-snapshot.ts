import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import {
  createDemoSourceSnapshotBundle,
  createSourceAdapterEnvelope,
  type SourceAdapterPreviewInput,
} from "@/lib/market-integrity/source-adapter-runtime";
import { applyApiRateLimit as applyPass2177SoftRateLimit, assertSameOriginRequest as assertPass2177SameOriginRequest, rejectLargeContentLength as rejectPass2177LargeContentLength } from "@/lib/security/api-guard";
import type { MarketIntegritySourceLane } from "@/lib/market-integrity/live-source-adapter-contract";

const allowedLanes = new Set<MarketIntegritySourceLane>([
  "market",
  "candles",
  "orderbook",
  "holders",
  "contract",
  "unlocks",
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

export async function GET() {
  const bundle = createDemoSourceSnapshotBundle();

  return jsonResponse({
    ok: false,
    mode: "source_snapshot_preview_only",
    route: "/api/market-integrity/source-snapshot",
    bundle,
    storageWritePerformed: false,
    productionBoundary:
      "Diagnostic route only. It builds redacted source envelopes and does not write durable snapshots.",
  }, 423);
}

export async function POST(request: Request) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(request, 256 * 1024);
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(request, { allowMissingOrigin: true });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(request, {
    keyPrefix: "pass2177-market-integrity-source-snapshot",
    limit: 24,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  const parsedBody = await readBoundedJsonBody<Record<string, unknown>>(request, 256 * 1024, { maxDepth: 16 });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;

  const rawLane = typeof body.lane === "string" ? body.lane : "market";
  const lane = allowedLanes.has(rawLane as MarketIntegritySourceLane) ? rawLane as MarketIntegritySourceLane : "market";
  const previewInput: SourceAdapterPreviewInput = {
    lane,
    adapterId: typeof body.adapterId === "string" ? body.adapterId : undefined,
    receivedAt: typeof body.receivedAt === "string" ? body.receivedAt : undefined,
    mode: typeof body.mode === "string" ? body.mode as SourceAdapterPreviewInput["mode"] : undefined,
    payload: body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? body.payload as Record<string, unknown>
      : body,
  };

  return jsonResponse({
    ok: false,
    mode: "source_snapshot_preview_only",
    route: "/api/market-integrity/source-snapshot",
    snapshot: createSourceAdapterEnvelope(previewInput),
    storageWritePerformed: false,
  }, 423);
}
