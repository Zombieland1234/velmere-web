import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { getAlertLedgerStatus, getPersistentAlertInbox } from "@/lib/market-integrity/alert-ledger";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "20"), 1), 100);

  try {
    const [alerts, ledger] = await Promise.all([
      getPersistentAlertInbox(limit),
      getAlertLedgerStatus(),
    ]);

    return NextResponse.json({
      mode: "stored",
      publication: {
        evidenceState: "partial",
        liveClaimed: false,
        blocker: "alert_ledger_read_does_not_prove_live_market_evidence",
      },
      agent: "velmere-shield-case-inbox-v1",
      alerts,
      ledger,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/alerts", code: "alert_inbox_failed", status: 502 });
  }
}
