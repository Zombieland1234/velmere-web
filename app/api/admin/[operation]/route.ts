import { ADMIN_ROUTES } from "@/lib/server/route-registries/admin";
import { dispatchLazyRoute, optionsLazyRoute } from "@/lib/server/lazy-route-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function dispatch(method: "GET" | "POST", request: Request, context: { params: Promise<{ operation: string }> }) {
  const { operation } = await context.params;
  return dispatchLazyRoute({
    method, key: operation, request, registry: ADMIN_ROUTES,
    unknownError: "unknown_admin_route",
    unavailableError: "admin_route_temporarily_unavailable",
  });
}

export function GET(request: Request, context: { params: Promise<{ operation: string }> }) {
  return dispatch("GET", request, context);
}

export function POST(request: Request, context: { params: Promise<{ operation: string }> }) {
  return dispatch("POST", request, context);
}

export async function OPTIONS(_request: Request, context: { params: Promise<{ operation: string }> }) {
  const { operation } = await context.params;
  return optionsLazyRoute({ key: operation, registry: ADMIN_ROUTES, unknownError: "unknown_admin_route" });
}
