import { REAL_MARKETS_ROUTES } from "@/lib/server/route-registries/real-markets";
import { dispatchLazyRoute, optionsLazyRoute } from "@/lib/server/lazy-route-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function dispatch(method: "GET", request: Request, context: { params: Promise<{ operation: string }> }) {
  const { operation } = await context.params;
  return dispatchLazyRoute({
    method,
    key: operation,
    request,
    registry: REAL_MARKETS_ROUTES,
    unknownError: "unknown_real_markets_route",
    unavailableError: "real_markets_route_temporarily_unavailable",
  });
}

export function GET(request: Request, context: { params: Promise<{ operation: string }> }) {
  return dispatch("GET", request, context);
}

export async function OPTIONS(_request: Request, context: { params: Promise<{ operation: string }> }) {
  const { operation } = await context.params;
  return optionsLazyRoute({ key: operation, registry: REAL_MARKETS_ROUTES, unknownError: "unknown_real_markets_route" });
}
