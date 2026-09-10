import { SECURITY_ROUTES } from "@/lib/server/route-registries/security";
import { dispatchLazyRoute, optionsLazyRoute } from "@/lib/server/lazy-route-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function dispatch(method: "GET" | "POST", request: Request, context: { params: Promise<{ operation: string }> }) {
  const { operation } = await context.params;
  return dispatchLazyRoute({
    method, key: operation, request, registry: SECURITY_ROUTES,
    unknownError: "unknown_security_route",
    unavailableError: "security_route_temporarily_unavailable",
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
  return optionsLazyRoute({ key: operation, registry: SECURITY_ROUTES, unknownError: "unknown_security_route" });
}
