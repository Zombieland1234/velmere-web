import { buildPass2207AngelRouteLiveBindingFixProof } from "@/lib/worldclass/angel-route-live-binding-fix";
import { applyApiRateLimit, assertSameOriginRequest, securityJson } from "@/lib/security/api-guard";

export async function GET(req: Request) {
  const originGuard = assertSameOriginRequest(req, { allowMissingOrigin: true });
  if (originGuard) return originGuard;
  const rateLimit = await applyApiRateLimit(req, { keyPrefix: "angel-route-live-binding:get", limit: 30, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;
  return securityJson({
    proof: buildPass2207AngelRouteLiveBindingFixProof(),
    auditBoundary: "pass2207 angel route live binding proof: static, redacted, no secrets",
  });
}
