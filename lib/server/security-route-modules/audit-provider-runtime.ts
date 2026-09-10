import { NextResponse } from "next/server";
import { normalizeAuditReviewSubmission, type AuditReviewSubmission } from "@/lib/security/audit-review-flow";
import { buildPass2571AuditProviderIntelligenceReport } from "@/lib/security/audit-provider-intelligence";
import { buildPass2572AuditProviderRuntimeReport, PASS2572_AUDIT_PROVIDER_RUNTIME_CLIENT_ID } from "@/lib/security/audit-provider-runtime-client";
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
    bountyScope: url.searchParams.get("bountyScope") ?? undefined,
    contactEmail: url.searchParams.get("contactEmail") ?? undefined,
    reviewLevel: "pro_review",
  };
}

type AuditProviderRuntimeReport = Awaited<ReturnType<typeof buildPass2572AuditProviderRuntimeReport>>;
type AuditProviderRuntimePayload = Partial<AuditReviewSubmission> & { locale?: string };

function response(report: AuditProviderRuntimeReport) {
  return NextResponse.json(
    {
      ok: true,
      surface: "velmere-audit-provider-runtime",
      report,
      rule: report.rule,
      pass4145: {
        asyncBoundary: "provider runtime report resolved before response serialization",
        noExploitInstructions: true,
        sourceUrlsRedacted: true,
      },
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-velmere-pass2572-provider-runtime": PASS2572_AUDIT_PROVIDER_RUNTIME_CLIENT_ID,
        "x-velmere-pass4145-provider-runtime-async-boundary": "resolved-before-json",
        "x-velmere-no-seed-phrase": "true",
        "x-velmere-no-exploit-instructions": "true",
      },
    },
  );
}

/* PASS4145_PROVIDER_RUNTIME_ROUTE_ASYNC_GUARD: GET and POST share one awaited provider-runtime builder, preventing Promise leakage into JSON. */
async function buildRuntimeResponse(payload: AuditProviderRuntimePayload, localeOverride?: string) {
  const locale = localeOverride ?? payload.locale ?? "en";
  const normalized = normalizeAuditReviewSubmission(payload);
  const providerIntelligence = buildPass2571AuditProviderIntelligenceReport({ ...normalized, locale });
  const report = await buildPass2572AuditProviderRuntimeReport({ ...normalized, locale, providerIntelligence });
  return response(report);
}

export async function GET(request: Request) {
  return withPass4824AuditProviderPublicGet(request, "/api/security/audit-provider-runtime", () =>
    handlePass4824AuditProviderGet(request));
}

async function handlePass4824AuditProviderGet(request: Request) {
  const payload = fromSearchParams(request);
  return buildRuntimeResponse(payload, payload.locale);
}

export async function POST(request: Request) {
  const pass4281Guard = await guardPass4281AuditPostRequest(request, {
    routeId: "audit-provider-runtime",
    maxBytes: 32_768,
    limit: 30,
    windowMs: 60_000,
  });
  if (pass4281Guard) return pass4281Guard;

  return withPass4281AuditPostBudget(request, async () => {
  const parsed = await readPass4281AuditJson<Partial<AuditReviewSubmission> & { locale?: string }>(request, {
    routeId: "audit-provider-runtime",
  });
  if (!parsed.ok) return parsed.response;
  const payload = parsed.value;
  const locale = payload.locale === "pl" || payload.locale === "de" || payload.locale === "en" ? payload.locale : "en";
  return buildRuntimeResponse(payload, locale);
  });
}
