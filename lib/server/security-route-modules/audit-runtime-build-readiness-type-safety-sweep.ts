import { NextResponse } from "next/server";
import { sanitizePublicAuditEnvelope } from "@/lib/security/public-private-route-lockdown";
import { normalizeAuditReviewSubmission, type AuditReviewSubmission } from "@/lib/security/audit-review-flow";
import { buildPass2595RuntimeBuildReadinessTypeSafetySweepReport, PASS2595_RUNTIME_BUILD_READINESS_TYPE_SAFETY_SWEEP_ID } from "@/lib/security/runtime-build-readiness-type-safety-sweep";
import { guardPass4281AuditPostRequest, readPass4281AuditJson, withPass4281AuditPostBudget } from "@/lib/security/api-security-post-wrapper";

async function readSubmission(request: Request): Promise<
  | { readonly ok: true; readonly value: AuditReviewSubmission }
  | { readonly ok: false; readonly response: Response }
> {
  if (request.method === "GET") {
    const url = new URL(request.url);
    return {
      ok: true,
      value: normalizeAuditReviewSubmission({
        projectName: url.searchParams.get("projectName") || "Velmère runtime build readiness sample",
        contractAddress: url.searchParams.get("contractAddress") || undefined,
        chain: url.searchParams.get("chain") || "ethereum",
        reviewLevel: (url.searchParams.get("reviewLevel") as AuditReviewSubmission["reviewLevel"]) || "advanced_review",
        locale: url.searchParams.get("locale") || "en",
      }),
    };
  }
  const parsed = await readPass4281AuditJson<Partial<AuditReviewSubmission>>(request, {
    routeId: "audit-runtime-build-readiness-type-safety-sweep",
  });
  if (!parsed.ok) return parsed;
  return { ok: true, value: normalizeAuditReviewSubmission(parsed.value) };
}

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  const pass4281Guard = await guardPass4281AuditPostRequest(request, {
    routeId: "audit-runtime-build-readiness-type-safety-sweep",
    maxBytes: 32_768,
    limit: 20,
    windowMs: 60_000,
  });
  if (pass4281Guard) return pass4281Guard;

  return withPass4281AuditPostBudget(request, async () => {
  const submission = await readSubmission(request);
  if (!submission.ok) return submission.response;
  const base = submission.value;
  const report = buildPass2595RuntimeBuildReadinessTypeSafetySweepReport(base);
  return NextResponse.json(sanitizePublicAuditEnvelope({ ok: true, report }, "audit-runtime-build-readiness-type-safety-sweep-public"), {
    headers: {
      "x-velmere-public-api-sanitized": "true",
      "cache-control": "no-store",
      "x-velmere-pass2595-build-readiness": PASS2595_RUNTIME_BUILD_READINESS_TYPE_SAFETY_SWEEP_ID,
      "x-velmere-build-readiness": String(report.summary.buildReadiness),
      "x-velmere-must-run-local-next-build": String(report.summary.mustRunLocalNextBuild),
    },
  });
  });
}
