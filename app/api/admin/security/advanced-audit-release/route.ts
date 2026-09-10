import { invokeLazyRouteHandler } from "@/lib/server/lazy-route-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdvancedAuditReleaseHandlerModule = {
  POST?: (request: Request) => Promise<Response> | Response;
  PUT?: (request: Request) => Promise<Response> | Response;
  PATCH?: (request: Request) => Promise<Response> | Response;
};

const load = () => import("@/lib/server/lazy-route-modules/admin--security--advanced-audit-release") as Promise<AdvancedAuditReleaseHandlerModule>;

export function POST(request: Request) {
  return invokeLazyRouteHandler({ method: "POST", request, load, unavailableError: "route_temporarily_unavailable" });
}

export function PUT(request: Request) {
  return invokeLazyRouteHandler({ method: "PUT", request, load, unavailableError: "route_temporarily_unavailable" });
}

export function PATCH(request: Request) {
  return invokeLazyRouteHandler({ method: "PATCH", request, load, unavailableError: "route_temporarily_unavailable" });
}
