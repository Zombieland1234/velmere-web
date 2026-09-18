import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { inspectDurableRateLimitRuntime } from "@/lib/security/durable-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function present(key: string) {
  return Boolean(process.env[key]?.trim());
}

function httpsUrl(value: string | undefined) {
  try {
    const parsed = new URL(value?.trim() ?? "");
    return parsed.protocol === "https:" && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function supabaseConfigured() {
  return httpsUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
    && present("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    && present("SUPABASE_SERVICE_ROLE_KEY");
}

function stripeTestConfigured() {
  return (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "").startsWith("pk_test_")
    && (process.env.STRIPE_SECRET_KEY?.trim() ?? "").startsWith("sk_test_")
    && (process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "").startsWith("whsec_");
}

export async function GET(request: Request) {
  const durable = inspectDurableRateLimitRuntime();
  const checks = {
    workerArtifactPresent: existsSync(resolve(process.cwd(), ".generated/audit-engine-worker.cjs")),
    durableStorageConfigured: durable.productionConfigured,
    supabaseConfigured: supabaseConfigured(),
    stripeTestConfigured: stripeTestConfigured(),
  };
  const ready = Object.values(checks).every(Boolean);
  const readinessRequested = new URL(request.url).searchParams.get("readiness") === "1";

  return NextResponse.json({
    ok: true,
    service: "velmere-web",
    status: ready ? "ready" : "degraded",
    deployment: {
      sourceSha: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || process.env.GITHUB_SHA?.trim() || null,
      environment: process.env.VERCEL_ENV?.trim() || null,
    },
    readiness: {
      ready,
      checks,
      connectivityVerified: false,
    },
    boundary: "Liveness plus non-secret configuration/package presence only. Dependency connectivity is not claimed.",
  }, {
    status: readinessRequested && !ready ? 503 : 200,
    headers: {
      "cache-control": "no-store, private",
      "content-type": "application/json; charset=utf-8",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}
