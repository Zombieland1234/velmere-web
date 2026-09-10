import { NextResponse } from "next/server";
import { normalizeAuditReviewSubmission, type AuditReviewSubmission } from "@/lib/security/audit-review-flow";
import { buildPass2571AuditProviderIntelligenceReport } from "@/lib/security/audit-provider-intelligence";
import { buildPass2572AuditProviderRuntimeReport } from "@/lib/security/audit-provider-runtime-client";
import { buildPass2582RealProviderAdapterHardeningReport, PASS2582_REAL_PROVIDER_ADAPTER_HARDENING_ID } from "@/lib/security/real-provider-adapter-hardening";
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

async function buildResponse(payload: Partial<AuditReviewSubmission> & { locale?: string }) {
  const locale = payload.locale === "pl" || payload.locale === "de" || payload.locale === "en" ? payload.locale : "en";
  const normalized = normalizeAuditReviewSubmission(payload);
  const providerIntelligence = buildPass2571AuditProviderIntelligenceReport({ ...normalized, locale });
  const providerRuntime = await buildPass2572AuditProviderRuntimeReport({ ...normalized, locale, providerIntelligence });
  const report = buildPass2582RealProviderAdapterHardeningReport({ ...normalized, locale, providerIntelligence, providerRuntime });
  return NextResponse.json(
    {
      ok: true,
      surface: "velmere-audit-real-provider-adapter-hardening",
      report,
      rule: report.rule,
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-velmere-real-provider-adapter-hardening": PASS2582_REAL_PROVIDER_ADAPTER_HARDENING_ID,
        "x-velmere-no-seed-phrase": "true",
        "x-velmere-no-exploit-instructions": "true",
      },
    },
  );
}

export async function GET(request: Request) {
  return withPass4824AuditProviderPublicGet(request, "/api/security/audit-real-provider-adapter-hardening", () =>
    handlePass4824AuditProviderGet(request));
}

async function handlePass4824AuditProviderGet(request: Request) {
  return buildResponse(fromSearchParams(request));
}

export async function POST(request: Request) {
  const pass4281Guard = await guardPass4281AuditPostRequest(request, {
    routeId: "audit-real-provider-adapter-hardening",
    maxBytes: 32_768,
    limit: 30,
    windowMs: 60_000,
  });
  if (pass4281Guard) return pass4281Guard;

  return withPass4281AuditPostBudget(request, async () => {
  const parsed = await readPass4281AuditJson<Partial<AuditReviewSubmission> & { locale?: string }>(request, {
    routeId: "audit-real-provider-adapter-hardening",
  });
  if (!parsed.ok) return parsed.response;
  return buildResponse(parsed.value);
  });
}
