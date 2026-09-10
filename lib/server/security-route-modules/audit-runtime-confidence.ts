import { NextResponse } from "next/server";
import { normalizeAuditReviewSubmission, type AuditReviewSubmission } from "@/lib/security/audit-review-flow";
import { buildPass2570AuditSourceQuorumReport } from "@/lib/security/audit-source-quorum-runtime";
import { buildPass2571AuditProviderIntelligenceReport } from "@/lib/security/audit-provider-intelligence";
import { buildPass2572AuditProviderRuntimeReport } from "@/lib/security/audit-provider-runtime-client";
import { buildPass2573AuditRuntimeConfidenceReport, PASS2573_AUDIT_RUNTIME_CONFIDENCE_ENGINE_ID } from "@/lib/security/audit-runtime-confidence";
import { guardPass4281AuditPostRequest, readPass4281AuditJson, withPass4281AuditPostBudget } from "@/lib/security/api-security-post-wrapper";

import { withPass4824AuditProviderPublicGet } from "@/lib/security/audit-provider-public-get-control";

function cleanLocale(value: string | null) {
  const locale = String(value ?? "en").trim().toLowerCase();
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

function fromSearchParams(request: Request): Partial<AuditReviewSubmission> & { locale?: string } {
  const url = new URL(request.url);
  return {
    locale: cleanLocale(url.searchParams.get("locale")),
    projectName: url.searchParams.get("projectName") ?? undefined,
    contractAddress: url.searchParams.get("contractAddress") ?? undefined,
    chain: url.searchParams.get("chain") ?? "ethereum",
    auditUrl: url.searchParams.get("auditUrl") ?? undefined,
    website: url.searchParams.get("website") ?? undefined,
    docsUrl: url.searchParams.get("docsUrl") ?? undefined,
    githubUrl: url.searchParams.get("githubUrl") ?? undefined,
    reviewLevel: "basic_review",
  };
}

async function response(input: Partial<AuditReviewSubmission> & { locale?: string }) {
  const normalized = normalizeAuditReviewSubmission(input);
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const sourceQuorum = buildPass2570AuditSourceQuorumReport({ ...normalized, locale });
  const providerIntelligence = buildPass2571AuditProviderIntelligenceReport({
    ...normalized,
    locale,
    sourceQuorum,
  });
  const providerRuntime = await buildPass2572AuditProviderRuntimeReport({
    ...normalized,
    locale,
    providerIntelligence,
  });
  const runtimeConfidence = buildPass2573AuditRuntimeConfidenceReport({
    ...normalized,
    locale,
    sourceQuorum,
    providerRuntime,
  });

  return NextResponse.json({
    ok: true,
    pass2573AuditRuntimeConfidence: runtimeConfidence,
    sourceQuorum,
    providerRuntimeSummary: providerRuntime.summary,
  }, {
    headers: {
      "cache-control": "no-store",
      "x-velmere-pass2573-runtime-confidence": PASS2573_AUDIT_RUNTIME_CONFIDENCE_ENGINE_ID,
      "x-velmere-no-seed-phrase": "true",
      "x-velmere-no-exploit-instructions": "true",
    },
  });
}

export async function POST(request: Request) {
  const pass4281Guard = await guardPass4281AuditPostRequest(request, {
    routeId: "audit-runtime-confidence",
    maxBytes: 32_768,
    limit: 30,
    windowMs: 60_000,
  });
  if (pass4281Guard) return pass4281Guard;

  return withPass4281AuditPostBudget(request, async () => {
  const parsed = await readPass4281AuditJson<Partial<AuditReviewSubmission> & { locale?: string }>(request, {
    routeId: "audit-runtime-confidence",
  });
  if (!parsed.ok) return parsed.response;
  return response(parsed.value);
  });
}

export async function GET(request: Request) {
  return withPass4824AuditProviderPublicGet(request, "/api/security/audit-runtime-confidence", () =>
    handlePass4824AuditProviderGet(request));
}

async function handlePass4824AuditProviderGet(request: Request) {
  return response(fromSearchParams(request));
}
