import { NextResponse } from "next/server";
import { buildPass2537DurableReceiptStoreRebalance } from "@/lib/market-integrity/durable-receipt-store-rebalance";
import { buildPass2538CustomerExportRedactionReplayGateRebalance } from "@/lib/market-integrity/customer-export-redaction-replay-gate-rebalance";
import { buildPass2539AccountVaultTimelineExportCapsuleRebalance } from "@/lib/market-integrity/account-vault-timeline-export-capsule-rebalance";
import { buildPass2540CustomerExportZeroLeakReplayRebalance, sanitizePass2540CustomerExportPayload } from "@/lib/market-integrity/customer-export-zero-leak-replay-rebalance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query") || url.searchParams.get("symbol") || "VELMERE_ZERO_LEAK_EXPORT";
  const symbol = url.searchParams.get("symbol") || undefined;
  const pass2537 = buildPass2537DurableReceiptStoreRebalance({ query, symbol });
  const pass2538 = buildPass2538CustomerExportRedactionReplayGateRebalance({ query, symbol, pass2537 });
  const pass2539 = buildPass2539AccountVaultTimelineExportCapsuleRebalance({ query, symbol, pass2538 });
  const pass2540 = buildPass2540CustomerExportZeroLeakReplayRebalance({ query, symbol, pass2539 });
  const sampleSanitizerReplay = sanitizePass2540CustomerExportPayload({
    title: "Velmère customer export sample",
    customerSafeHash: pass2540.sanitizedEnvelopes[0]?.customerSafeHash,
    rawProviderPayload: { hidden: true },
    promptRaw: "operator/raw prompt must never render",
    walletAddressFull: "0x0000000000000000000000000000000000000000",
    paymentProviderPayload: { provider: "stripe", raw: true },
  });
  return NextResponse.json({
    ok: true,
    pass: "2540",
    customerExportZeroLeakReplayRebalance: pass2540,
    sanitizedEnvelopes: pass2540.sanitizedEnvelopes,
    leakFindings: pass2540.leakFindings,
    policies: pass2540.policies,
    fixtures: pass2540.fixtures,
    sampleSanitizerReplay,
    rule: pass2540.zeroLeakReplayRule,
  });
}
