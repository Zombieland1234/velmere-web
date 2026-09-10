import { invokeLazyRouteHandler } from "@/lib/server/lazy-route-dispatch";


export function GET(request: Request) {
  return invokeLazyRouteHandler({ method: "GET", request, load: () => import("@/lib/server/lazy-route-modules/security--audit-watch--support-handoff"), unavailableError: "route_temporarily_unavailable" });
}
