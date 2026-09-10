import { inspectDurableRateLimitRuntime } from "@/lib/security/durable-rate-limit";

export const PASS4199_PRODUCTION_ENV_CONTRACT_LOCK = {
  passId: "PASS4199_PRODUCTION_ENV_CONTRACT_LOCK",
  title: "Production env and secret contract lock",
  publicClaimAllowed: false,
  topkaLiveAllowed: false,
  releasePromotionAllowed: false,
  secretValueDisclosureAllowed: false,
  productionDemoUnlockAllowed: false,
} as const;

export type VelmereEnvContractStatus = "ready" | "blocked_env" | "qa_only";

export type VelmereEnvContractCheck = {
  id: string;
  area: "checkout" | "stripe" | "ai" | "supabase" | "rate_limit" | "site" | "release";
  requiredForLive: boolean;
  ok: boolean;
  publicLabel: string;
};

export type VelmereEnvContractSummary = {
  passId: typeof PASS4199_PRODUCTION_ENV_CONTRACT_LOCK.passId;
  status: VelmereEnvContractStatus;
  productionLike: boolean;
  publicClaimAllowed: false;
  topkaLiveAllowed: false;
  releasePromotionAllowed: false;
  secretValueDisclosureAllowed: false;
  productionDemoUnlockAllowed: false;
  blockedAreas: string[];
  publicBlockedReasons: string[];
  checks: VelmereEnvContractCheck[];
};

export function isVelmereProductionLikeEnv(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

function readEnv(env: NodeJS.ProcessEnv, name: string) {
  return String(env[name] ?? "").trim();
}

const NON_VELMERE_PRODUCTION_SECRET_NAMES = new Set([
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_CLIENT_SECRET",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_TOKEN",
  "QSTASH_TOKEN",
  "ADMIN_IMPORT_TOKEN",
  "ADMIN_SESSION_SECRET",
  "CRON_SECRET",
  "MARKET_INTEGRITY_CRON_SECRET",
  "WEBHOOK_SECRET",
  "PRIVATE_KEY",
  "PRINTFUL_API_KEY",
  "PRINTFUL_API_TOKEN",
  "PRINTFUL_TOKEN",
  "RESEND_API_KEY",
  "TAPSTITCH_API_KEY",
  "ALCHEMY_API_KEY",
  "ALPHAVANTAGE_API_KEY",
  "ALPHA_VANTAGE_API_KEY",
  "ARTEMIS_API_KEY",
  "BITQUERY_API_KEY",
  "COINGECKO_API_KEY",
  "COINGECKO_DEMO_API_KEY",
  "COINGECKO_PRO_API_KEY",
  "COINMARKETCAP_API_KEY",
  "COIN_METRICS_API_KEY",
  "DEFILLAMA_PRO_API_KEY",
  "ETHERSCAN_API_KEY",
  "GECKOTERMINAL_API_KEY",
  "KAIKO_API_KEY",
  "MESSARI_API_KEY",
  "THE_GRAPH_API_KEY",
  "TOKEN_TERMINAL_API_KEY",
  "TWELVE_DATA_API_KEY",
]);

function isApplicationProductionSecretName(name: string) {
  if (NON_VELMERE_PRODUCTION_SECRET_NAMES.has(name)) return true;
  if (!name.startsWith("VELMERE_")) return false;
  if (/(?:^|_)PUBLIC_KEY(?:_|$)/.test(name) || /(?:^|_)KEY_ID(?:_|$)/.test(name)) return false;
  return /(?:^|_)(?:SECRET|TOKEN|PASSWORD|HMAC|SEED|BEARER|API_KEY)(?:_|$)|PRIVATE_KEY|SERVICE_ROLE/.test(name);
}

export function isObviousProductionSecretPlaceholder(value: string) {
  const normalized = value.trim();
  if (!normalized) return false;
  if (/^(.)\1{7,}$/s.test(normalized) || /^\.{3,}$/.test(normalized)) return true;
  if (/^(?:sk|rk)_test_/i.test(normalized)) return true;
  if (/^(?:1234567890|0123456789|abcdef|qwerty){2,}$/i.test(normalized)) return true;
  if (/^(?:secret|password|token|api[_ -]?key)$/i.test(normalized)) return true;
  return /(?:placeholder|example|sample|fake|not[_ -]?a[_ -]?real|change[_ -]?me|changeme|dummy|test[_ -]?only|never[_ -]?production|replace(?:[_ -]?with)?|server[_ -]?only|set[_ -]?a[_ -]?dedicated|insert[_ -]?(?:secret|key|token)|your[_ -]?(?:secret|key|token)|random[_ -]?(?:chars?|bytes?|secret)|todo|tbd)/i.test(normalized);
}

function hasUsableSecret(env: NodeJS.ProcessEnv, names: string[], minLength = 32) {
  return names.some((name) => {
    const value = readEnv(env, name);
    if (value.length < minLength) return false;
    if (isObviousProductionSecretPlaceholder(value)) return false;
    return true;
  });
}

function configuredSecretEntries(env: NodeJS.ProcessEnv) {
  return Object.keys(env)
    .filter(isApplicationProductionSecretName)
    .sort()
    .map((name) => ({ name, value: readEnv(env, name) }))
    .filter((entry) => Boolean(entry.value));
}

function hasConfiguredSecretPlaceholder(env: NodeJS.ProcessEnv) {
  return configuredSecretEntries(env).some((entry) => isObviousProductionSecretPlaceholder(entry.value));
}

function hasConfiguredSecretReuse(env: NodeJS.ProcessEnv) {
  const seen = new Set<string>();
  for (const entry of configuredSecretEntries(env)) {
    if (seen.has(entry.value)) return true;
    seen.add(entry.value);
  }
  return false;
}

function distinctConfiguredSecrets(env: NodeJS.ProcessEnv, left: string, right: string) {
  const leftValue = readEnv(env, left);
  const rightValue = readEnv(env, right);
  return !leftValue || !rightValue || leftValue !== rightValue;
}

function hasUrl(env: NodeJS.ProcessEnv, name: string) {
  const value = readEnv(env, name);
  try {
    const parsed = new URL(value);
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return false;
    if (!isVelmereProductionLikeEnv(env)) return true;
    if (parsed.protocol !== "https:") return false;
    if (
      /(?:placeholder|example|localhost)/i.test(value) ||
      parsed.hostname === "..." ||
      parsed.hostname.includes("..") ||
      /\.(?:invalid|test|example)$/i.test(parsed.hostname) ||
      /^(?:127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[?::1\]?)$/.test(parsed.hostname)
    ) return false;
    return true;
  } catch {
    return false;
  }
}

function hasVerifiedTrustedProxyProfile(env: NodeJS.ProcessEnv) {
  if (!isVelmereProductionLikeEnv(env)) return true;
  return env.VELMERE_TRUSTED_PROXY_PROFILE?.trim().toLowerCase() === "vercel" &&
    env.VERCEL === "1" &&
    env.VERCEL_ENV === "production";
}

function check(args: Omit<VelmereEnvContractCheck, "ok"> & { ok: boolean }): VelmereEnvContractCheck {
  return args;
}

export function buildVelmereProductionEnvContract(env: NodeJS.ProcessEnv = process.env): VelmereEnvContractSummary {
  const productionLike = isVelmereProductionLikeEnv(env);
  const durableRateLimitRuntime = inspectDurableRateLimitRuntime(env);
  const durableRateLimitConfigured = productionLike
    ? durableRateLimitRuntime.productionConfigured
    : durableRateLimitRuntime.mode === "upstash_rest" || durableRateLimitRuntime.mode === "memory";

  const checks: VelmereEnvContractCheck[] = [
    check({ id: "site_url", area: "site", requiredForLive: true, ok: hasUrl(env, "NEXT_PUBLIC_SITE_URL"), publicLabel: "canonical site URL" }),
    check({ id: "stripe_secret", area: "stripe", requiredForLive: true, ok: hasUsableSecret(env, ["STRIPE_SECRET_KEY"], 24), publicLabel: "Stripe server secret" }),
    check({ id: "stripe_webhook_secret", area: "stripe", requiredForLive: true, ok: hasUsableSecret(env, ["STRIPE_WEBHOOK_SECRET"], 24), publicLabel: "Stripe webhook signing secret" }),
    check({ id: "checkout_mode", area: "checkout", requiredForLive: true, ok: readEnv(env, "CHECKOUT_MODE") === "stripe", publicLabel: "Stripe checkout mode" }),
    check({ id: "commercial_ready_flag", area: "checkout", requiredForLive: true, ok: readEnv(env, "VELMERE_SERVICES_COMMERCIAL_READY") === "true", publicLabel: "commercial-ready operator flag" }),
    check({ id: "paid_access_secret", area: "checkout", requiredForLive: true, ok: hasUsableSecret(env, ["VELMERE_PAID_ACCESS_SECRET"], 32), publicLabel: "dedicated paid access receipt secret" }),
    check({ id: "paid_access_key_separation", area: "checkout", requiredForLive: true, ok: distinctConfiguredSecrets(env, "VELMERE_PAID_ACCESS_SECRET", "VELMERE_VLM_RECEIPT_SECRET"), publicLabel: "paid access and VLM receipt key separation" }),
    check({ id: "local_demo_disabled", area: "checkout", requiredForLive: true, ok: !productionLike || readEnv(env, "VELMERE_LOCAL_PAID_ACCESS_DEMO") !== "true", publicLabel: "local paid demo disabled in production" }),
    check({ id: "gemini_secret", area: "ai", requiredForLive: true, ok: hasUsableSecret(env, ["GEMINI_API_KEY"], 24), publicLabel: "AI provider server secret" }),
    check({ id: "supabase_url", area: "supabase", requiredForLive: true, ok: hasUrl(env, "NEXT_PUBLIC_SUPABASE_URL") || hasUrl(env, "SUPABASE_URL"), publicLabel: "Supabase project URL" }),
    check({ id: "supabase_anon", area: "supabase", requiredForLive: true, ok: hasUsableSecret(env, ["NEXT_PUBLIC_SUPABASE_ANON_KEY"], 24), publicLabel: "Supabase anon key" }),
    check({ id: "supabase_service_role", area: "supabase", requiredForLive: true, ok: hasUsableSecret(env, ["SUPABASE_SERVICE_ROLE_KEY"], 32), publicLabel: "Supabase service role secret" }),
    check({ id: "durable_rate_limit", area: "rate_limit", requiredForLive: true, ok: durableRateLimitConfigured, publicLabel: "durable rate-limit/security state" }),
    check({ id: "trusted_proxy_profile", area: "rate_limit", requiredForLive: true, ok: hasVerifiedTrustedProxyProfile(env), publicLabel: "verified trusted-proxy client address profile" }),
    check({ id: "provider_health_signing_secret", area: "release", requiredForLive: true, ok: hasUsableSecret(env, ["VELMERE_PROVIDER_HEALTH_SIGNING_SECRET_CURRENT"], 32), publicLabel: "dedicated provider health signing secret" }),
    check({ id: "secret_placeholder_scan", area: "release", requiredForLive: true, ok: !hasConfiguredSecretPlaceholder(env), publicLabel: "configured secrets contain no template placeholders" }),
    check({ id: "secret_key_separation", area: "release", requiredForLive: true, ok: !hasConfiguredSecretReuse(env), publicLabel: "configured security domains use distinct secrets" }),
  ];

  const failedLiveChecks = checks.filter((item) => item.requiredForLive && !item.ok);
  const blockedAreas = Array.from(new Set(failedLiveChecks.map((item) => item.area))).sort();
  const publicBlockedReasons = failedLiveChecks.map((item) => `${item.area}:${item.publicLabel}`);

  return {
    passId: PASS4199_PRODUCTION_ENV_CONTRACT_LOCK.passId,
    status: !productionLike ? "qa_only" : failedLiveChecks.length ? "blocked_env" : "ready",
    productionLike,
    publicClaimAllowed: false,
    topkaLiveAllowed: false,
    releasePromotionAllowed: false,
    secretValueDisclosureAllowed: false,
    productionDemoUnlockAllowed: false,
    blockedAreas,
    publicBlockedReasons,
    checks,
  };
}

export function buildVlmCheckoutProductionEnvContract(env: NodeJS.ProcessEnv = process.env) {
  const full = buildVelmereProductionEnvContract(env);
  const checkoutAreas = new Set(["site", "stripe", "checkout", "rate_limit"]);
  const checks = full.checks.filter((item) => checkoutAreas.has(item.area));
  const failedLiveChecks = checks.filter((item) => item.requiredForLive && !item.ok);
  return {
    ...full,
    status: !full.productionLike ? "qa_only" as const : failedLiveChecks.length ? "blocked_env" as const : "ready" as const,
    blockedAreas: Array.from(new Set(failedLiveChecks.map((item) => item.area))).sort(),
    publicBlockedReasons: failedLiveChecks.map((item) => `${item.area}:${item.publicLabel}`),
    checks,
  } satisfies VelmereEnvContractSummary;
}

export function redactVelmereEnvContractForPublic(summary: VelmereEnvContractSummary) {
  return {
    passId: summary.passId,
    status: summary.status,
    productionLike: summary.productionLike,
    publicClaimAllowed: summary.publicClaimAllowed,
    topkaLiveAllowed: summary.topkaLiveAllowed,
    releasePromotionAllowed: summary.releasePromotionAllowed,
    secretValueDisclosureAllowed: summary.secretValueDisclosureAllowed,
    productionDemoUnlockAllowed: summary.productionDemoUnlockAllowed,
    blockedAreas: summary.blockedAreas,
    missingLiveContractCount: summary.publicBlockedReasons.length,
    checks: summary.checks.map((item) => ({
      id: item.id,
      area: item.area,
      requiredForLive: item.requiredForLive,
      ok: item.ok,
      publicLabel: item.publicLabel,
    })),
  };
}
