import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";
import {
  handleAuditWatchGet,
  handleAuditWatchPost,
} from "@/lib/security/audit-watch-route-orchestrator";

export async function GET() {
  return handleAuditWatchGet();
}

export async function POST(request: Request) {
  return withExpensiveRouteBudget(request, "audit_watch_post", () => handleAuditWatchPost(request));
}
