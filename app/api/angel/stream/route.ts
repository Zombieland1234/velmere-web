import { invokeLazyRouteHandler } from "@/lib/server/lazy-route-dispatch";

export const runtime = "nodejs";

export function POST(request: Request) {
  return invokeLazyRouteHandler({ method: "POST", request, load: () => import("@/lib/server/lazy-route-modules/angel--stream"), unavailableError: "route_temporarily_unavailable" });
}
