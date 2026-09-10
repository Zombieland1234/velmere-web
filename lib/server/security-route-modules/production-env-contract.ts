import {
  applyApiRateLimit,
  assertSameOriginRequest,
  securityJson,
} from "@/lib/security/api-guard";
import {
  buildVelmereProductionEnvContract,
  redactVelmereEnvContractForPublic,
} from "@/lib/security/production-env-contract";

export async function GET(request: Request) {
  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: true });
  if (originGuard) return originGuard;

  const rateLimit = await applyApiRateLimit(request, {
    keyPrefix: "pass4199-production-env-contract",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const summary = buildVelmereProductionEnvContract();
  return securityJson({
    ok: summary.status === "ready",
    contract: redactVelmereEnvContractForPublic(summary),
    boundary:
      "PASS4199: redacted production env contract only; secret values and raw env previews are never returned.",
  });
}
