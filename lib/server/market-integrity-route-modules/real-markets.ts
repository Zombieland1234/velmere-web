import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";
import { handleRealMarketsGet } from "@/lib/market-integrity/real-markets-route-orchestrator";

export async function GET(request: Request) {
  return withExpensiveRouteBudget(request, "real_markets_get", () => handleRealMarketsGet(request));
}
