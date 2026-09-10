import { NextResponse } from "next/server";
import { buildPass2537DurableReceiptStoreRebalance } from "@/lib/market-integrity/durable-receipt-store-rebalance";
import { buildPass2538CustomerExportRedactionReplayGateRebalance } from "@/lib/market-integrity/customer-export-redaction-replay-gate-rebalance";
import { buildPass2539AccountVaultTimelineExportCapsuleRebalance } from "@/lib/market-integrity/account-vault-timeline-export-capsule-rebalance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query") || url.searchParams.get("symbol") || "VELMERE_ACCOUNT_VAULT";
  const symbol = url.searchParams.get("symbol") || undefined;
  const pass2537 = buildPass2537DurableReceiptStoreRebalance({ query, symbol });
  const pass2538 = buildPass2538CustomerExportRedactionReplayGateRebalance({ query, symbol, pass2537 });
  const pass2539 = buildPass2539AccountVaultTimelineExportCapsuleRebalance({ query, symbol, pass2538 });
  return NextResponse.json({
    ok: true,
    pass: "2539",
    accountVaultTimelineExportCapsuleRebalance: pass2539,
    timelineCards: pass2539.timelineCards,
    exportCapsuleCards: pass2539.exportCapsuleCards,
    timelinePolicies: pass2539.timelinePolicies,
    fixtures: pass2539.fixtures,
    rule: pass2539.accountVaultTimelineExportCapsuleRule,
  });
}
