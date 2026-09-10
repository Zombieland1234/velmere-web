import { INTERNAL_WORKERS_ROUTES } from "@/lib/server/route-registries/internal-workers";
import { dispatchLazyRoute, optionsLazyRoute } from "@/lib/server/lazy-route-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function dispatch(method: "GET" | "POST", request: Request, context: { params: Promise<{ worker: string }> }) {
  const { worker } = await context.params;
  return dispatchLazyRoute({
    method, key: worker, request, registry: INTERNAL_WORKERS_ROUTES,
    unknownError: "unknown_internal_worker",
    unavailableError: "internal_worker_temporarily_unavailable",
  });
}

export function GET(request: Request, context: { params: Promise<{ worker: string }> }) {
  return dispatch("GET", request, context);
}

export function POST(request: Request, context: { params: Promise<{ worker: string }> }) {
  return dispatch("POST", request, context);
}

export async function OPTIONS(_request: Request, context: { params: Promise<{ worker: string }> }) {
  const { worker } = await context.params;
  return optionsLazyRoute({ key: worker, registry: INTERNAL_WORKERS_ROUTES, unknownError: "unknown_internal_worker" });
}
