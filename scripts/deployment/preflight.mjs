import { pathToFileURL } from "node:url";

function present(env, key) {
  return Boolean(String(env[key] ?? "").trim());
}

function strongSecret(env, key) {
  const value = String(env[key] ?? "").trim();
  return value.length >= 32 && !/^(.)\1+$/u.test(value);
}

function httpsUrl(value) {
  try {
    const parsed = new URL(String(value ?? "").trim());
    return parsed.protocol === "https:" && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function durableStorageConfigured(env) {
  const upstash = httpsUrl(env.UPSTASH_REDIS_REST_URL) && present(env, "UPSTASH_REDIS_REST_TOKEN");
  const selectedNative = String(env.VELMERE_RATE_LIMIT_BACKEND ?? "").trim() === "redis";
  const nativeUrl = String(env.REDIS_URL ?? "").trim();
  const native = selectedNative && (
    /^rediss:\/\/[^\s]+$/u.test(nativeUrl) ||
    /^redis:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/\d+)?$/u.test(nativeUrl)
  );
  return upstash || native;
}

function trustedProxyConfigured(env) {
  const profile = String(env.VELMERE_TRUSTED_PROXY_PROFILE ?? "").trim();
  if (profile === "vercel") {
    return env.VERCEL === "1" && ["preview", "production", "development"].includes(String(env.VERCEL_ENV ?? ""));
  }
  if (profile === "signed_proxy") {
    return strongSecret(env, "VELMERE_PROXY_HMAC_SECRET") && present(env, "VELMERE_PROXY_HMAC_AUDIENCE");
  }
  return false;
}

function supabaseConfigured(env) {
  return httpsUrl(env.NEXT_PUBLIC_SUPABASE_URL)
    && present(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY")
    && present(env, "SUPABASE_SERVICE_ROLE_KEY");
}

function stripeTestConfigured(env) {
  const publishable = String(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").trim();
  const secret = String(env.STRIPE_SECRET_KEY ?? "").trim();
  const webhook = String(env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  return publishable.startsWith("pk_test_")
    && secret.startsWith("sk_test_")
    && webhook.startsWith("whsec_");
}

export function inspectDeploymentEnvironment(env = process.env) {
  const vercelEnvironment = String(env.VERCEL_ENV ?? "").trim() || null;
  const checks = {
    vercelRuntimeMetadata: env.VERCEL === "1" && ["preview", "production", "development"].includes(vercelEnvironment ?? ""),
    trustedProxyConfigured: trustedProxyConfigured(env),
    privacyFingerprintConfigured: strongSecret(env, "VELMERE_SECURITY_FINGERPRINT_SECRET"),
    durableStorageConfigured: durableStorageConfigured(env) && env.VELMERE_RATE_LIMIT_DISABLED !== "1",
    supabaseConfigured: supabaseConfigured(env),
    stripeTestConfigured: stripeTestConfigured(env),
  };
  const blockers = [
    !checks.vercelRuntimeMetadata ? "VERCEL_RUNTIME_METADATA_MISSING" : null,
    !checks.trustedProxyConfigured ? "TRUSTED_PROXY_CONFIGURATION_MISSING" : null,
    !checks.privacyFingerprintConfigured ? "FINGERPRINT_SECRET_MISSING_OR_WEAK" : null,
    !checks.durableStorageConfigured ? "DURABLE_STORAGE_CONFIGURATION_MISSING" : null,
    !checks.supabaseConfigured ? "SUPABASE_CONFIGURATION_MISSING" : null,
    !checks.stripeTestConfigured ? "STRIPE_TEST_CONFIGURATION_MISSING" : null,
  ].filter(Boolean);

  return {
    schemaVersion: "velmere.c14.p21.deployment-preflight.v1",
    sourceSha: String(env.VERCEL_GIT_COMMIT_SHA ?? env.GITHUB_SHA ?? "").trim() || null,
    vercelEnvironment,
    checks,
    configurationReady: blockers.length === 0,
    connectivityVerified: false,
    blockers,
    boundary: "Presence/mode validation only. Secret values are never emitted and provider connectivity is not claimed.",
  };
}

function main() {
  const result = inspectDeploymentEnvironment(process.env);
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!process.argv.includes("--report") && !result.configurationReady) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
