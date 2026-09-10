import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";
import { handleSearchGet } from "@/lib/search/search-route-orchestrator";

export async function GET(request: Request) {
  return withExpensiveRouteBudget(request, "search_get", () => handleSearchGet(request));
}
