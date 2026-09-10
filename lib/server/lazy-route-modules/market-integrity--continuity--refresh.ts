import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeMarketIntegrityCron } from "@/lib/security/market-integrity-cron-auth";
import {
  getPass4653RefreshRegistrySummary,
  listDuePass4653RefreshTargets,
} from "@/lib/market-integrity/refresh-registry";
import { executePass4653RefreshTarget } from "@/lib/market-integrity/refresh-worker";

async function executeInBatches<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const output: R[] = [];
  for (let index = 0; index < items.length; index += concurrency) {
    const chunk = items.slice(index, index + concurrency);
    const settled = await Promise.all(chunk.map(worker));
    output.push(...settled);
  }
  return output;
}

export async function GET(request: Request) {
  const cronAuth = authorizeMarketIntegrityCron(request);
  if (!cronAuth.authorized) {
    return NextResponse.json(
      { ok: false, error: "unauthorized_continuity_refresh", reason: cronAuth.reason },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 80)));
  const concurrency = Math.min(10, Math.max(1, Number(url.searchParams.get("concurrency") ?? 4)));
  const startedAt = new Date();
  const leaseOwner = `continuity-refresh:${randomUUID()}`;
  const due = await listDuePass4653RefreshTargets({
    now: startedAt,
    limit,
    leaseOwner,
    leaseMs: 2 * 60_000,
  });
  const outcomes = await executeInBatches(due, concurrency, (target) => executePass4653RefreshTarget(target, new Date()));
  const succeeded = outcomes.filter((outcome) => outcome.success).length;
  const failed = outcomes.length - succeeded;
  return NextResponse.json({
    ok: true,
    schemaVersion: "pass4653_continuity_refresh_run_v1",
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    dueTargets: due.length,
    leaseOwner,
    succeeded,
    failed,
    degradedSafe: failed > 0,
    registry: getPass4653RefreshRegistrySummary(),
    outcomes,
    policy: "Demand-adaptive targets are refreshed before expiry. Cached evidence remains visibly marked, category TTL-bound and cannot extend its original observation time.",
  }, { headers: { "cache-control": "no-store" } });
}
