import { NextResponse } from "next/server";
import { getSourceSnapshotLedgerMeta, getSourceSnapshots } from "@/lib/market-integrity/source-snapshot-ledger";
import { checkRateLimit, guardrailHeaders } from "@/lib/market-integrity/api-guardrails";

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request, "source-snapshots");
  const headers = guardrailHeaders(rateLimit);
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim();
  const limit = Number(searchParams.get("limit") ?? 24);

  if (!symbol) {
    return NextResponse.json({
      mode: "error",
      error: "Missing symbol",
      ledger: getSourceSnapshotLedgerMeta(),
    }, { status: 400, headers });
  }

  const snapshots = await getSourceSnapshots(symbol, Number.isFinite(limit) ? limit : 24);

  return NextResponse.json({
    mode: "stored",
    publication: {
      evidenceState: "partial",
      liveClaimed: false,
      blocker: "snapshot_read_is_not_a_fresh_signed_provider_observation",
    },
    symbol: symbol.toUpperCase(),
    snapshots,
    ledger: getSourceSnapshotLedgerMeta(),
    generatedAt: new Date().toISOString(),
    guardrails: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
  }, { headers });
}
