import { NextResponse } from "next/server";

export const PRODUCTION_FIXTURE_ROUTE_GUARD_ID =
  "velmere-production-fixture-route-guard-v1" as const;

type ProductionRuntimeEnvironment = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
};

export function isProductionLikeRuntime(
  env: ProductionRuntimeEnvironment = process.env,
) {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

/**
 * Offline fixtures, query-driven control-plane simulators and metadata-only
 * envelope generators are useful for deterministic regression tests, but they
 * must not be reachable from a production deployment where synthetic receipts
 * can be mistaken for runtime evidence.
 */
export function blockProductionFixtureRoute(
  routeId: string,
  env: ProductionRuntimeEnvironment = process.env,
) {
  if (!isProductionLikeRuntime(env)) return null;
  return NextResponse.json(
    { ok: false, error: "not_found" },
    {
      status: 404,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex, nofollow, noarchive",
        "x-velmere-runtime-boundary": PRODUCTION_FIXTURE_ROUTE_GUARD_ID,
        "x-velmere-fixture-route": routeId,
      },
    },
  );
}
