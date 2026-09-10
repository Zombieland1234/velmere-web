import { NextResponse } from "next/server";
import { normalizeAuditReviewSubmission, type AuditReviewSubmission } from "@/lib/security/audit-review-flow";
import { buildPass2570AuditSourceQuorumReport } from "@/lib/security/audit-source-quorum-runtime";
import { buildPass2571AuditProviderIntelligenceReport, PASS2571_AUDIT_PROVIDER_INTELLIGENCE_ID } from "@/lib/security/audit-provider-intelligence";
import { guardPass4281AuditPostRequest, readPass4281AuditJson, withPass4281AuditPostBudget } from "@/lib/security/api-security-post-wrapper";

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
    bountyScope: url.searchParams.get("bountyScope") ?? undefined,
    contactEmail: url.searchParams.get("contactEmail") ?? undefined,
    reviewLevel: "pro_review",
  };
}

function response(report: ReturnType<typeof buildPass2571AuditProviderIntelligenceReport>) {
  return NextResponse.json(
    {
      ok: true,
      surface: "velmere-audit-provider-intelligence",
      report,
      rule: report.rule,
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-velmere-pass2571-provider-intelligence": PASS2571_AUDIT_PROVIDER_INTELLIGENCE_ID,
        "x-velmere-no-seed-phrase": "true",
        "x-velmere-no-exploit-instructions": "true",
      },
    },
  );
}

export async function GET(request: Request) {
  const payload = fromSearchParams(request);
  const normalized = normalizeAuditReviewSubmission(payload);
  const sourceQuorum = buildPass2570AuditSourceQuorumReport({ ...normalized, locale: payload.locale });
  return response(buildPass2571AuditProviderIntelligenceReport({ ...normalized, locale: payload.locale, sourceQuorum }));
}

export async function POST(request: Request) {
  const pass4281Guard = await guardPass4281AuditPostRequest(request, {
    routeId: "audit-provider-intelligence",
    maxBytes: 32_768,
    limit: 30,
    windowMs: 60_000,
  });
  if (pass4281Guard) return pass4281Guard;

  return withPass4281AuditPostBudget(request, async () => {
  const parsed = await readPass4281AuditJson<Partial<AuditReviewSubmission> & { locale?: string }>(request, {
    routeId: "audit-provider-intelligence",
  });
  if (!parsed.ok) return parsed.response;
  const payload = parsed.value;
  const locale = payload.locale === "pl" || payload.locale === "de" || payload.locale === "en" ? payload.locale : "en";
  const normalized = normalizeAuditReviewSubmission(payload);
  const sourceQuorum = buildPass2570AuditSourceQuorumReport({ ...normalized, locale });
  return response(buildPass2571AuditProviderIntelligenceReport({ ...normalized, locale, sourceQuorum }));
  });
}
