import { invokeLazyRouteHandler } from "@/lib/server/lazy-route-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return invokeLazyRouteHandler({ method: "GET", request, load: () => import("@/lib/server/lazy-route-modules/security--audit-watch--customer-safe-report"), unavailableError: "route_temporarily_unavailable" });
}
