import { invokeLazyRouteHandler } from "@/lib/server/lazy-route-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return invokeLazyRouteHandler({ method: "GET", request, load: () => import("@/lib/server/lazy-route-modules/admin--security--audit-messages--operator-actions"), unavailableError: "route_temporarily_unavailable" });
}

export function POST(request: Request) {
  return invokeLazyRouteHandler({ method: "POST", request, load: () => import("@/lib/server/lazy-route-modules/admin--security--audit-messages--operator-actions"), unavailableError: "route_temporarily_unavailable" });
}
