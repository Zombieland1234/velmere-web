import { notFound } from "next/navigation";
import { NextRequest } from "next/server";
import CanonicalAuditReportView from "@/components/security/CanonicalAuditReportView";
import { prepareCustomerReport, CUSTOMER_REPORT_FIELDS, CustomerReportRequestError } from "@/lib/security/customer-report-request";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { SUPPORTED_LOCALES } from "@/lib/seo/metadata";
import { headers } from "next/headers";
export const dynamic = "force-dynamic";

export default async function CanonicalAuditReportPageRoute(props: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, id } = await props.params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) notFound();
  setRequestLocale(locale);
  const sp = await props.searchParams;
  const allowed = new Set<string>([...CUSTOMER_REPORT_FIELDS, "entitlementId"]);
  if (Object.entries(sp).some(([key, value]) => !allowed.has(key) || Array.isArray(value))) notFound();
  const input: Record<string, unknown> = Object.fromEntries(Object.entries(sp).filter(([,v]) => v !== undefined));
  input.locale = locale;
  if (!input.address && !input.assetId) {
    if (/^0x[a-fA-F0-9]{40}$/.test(id)) input.address = id;
    else if (!id.startsWith("AUD-")) input.assetId = id;
    else notFound();
  }
  if (id.startsWith("AUD-")) input.caseRef = id;
  const url = new URL("https://velmere.internal/audit");
  if (typeof sp.entitlementId === "string") url.searchParams.set("entitlementId", sp.entitlementId);
  const request = new NextRequest(url, { headers: await headers() });
  let prepared;
  try {
    prepared = await prepareCustomerReport(request, input, id);
    // RSC output must not use an earlier grant if generation revoked it.
    JSON.stringify(prepared.report);
    await prepared.authorizeDelivery();
  } catch (error) {
    if (error instanceof CustomerReportRequestError) notFound();
    throw error;
  }
  const report = prepared.report;
  const pdfParams = new URLSearchParams({address:report.target.contractAddress, name:report.target.contractName,
    chainId:report.target.chainId, tier:prepared.tier, locale,
    analysisMode: report.runtimeAnalysis?.status === "REFERENCE_ONLY" ? "reference" : "runtime"});
  if (report.caseRef) pdfParams.set("caseRef", report.caseRef);
  const pdfDownloadUrl = `/api/audit/report-pdf?${pdfParams}`;

  return (
    <main className="velmere-public-page min-h-screen bg-velmere-black px-5 pb-24 pt-28 text-white md:px-10 md:pt-36">
      <div className="mx-auto max-w-6xl mb-8">
        <Link
          href={`/${locale}/security/audits`}
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/[0.66] transition hover:border-white/[0.22] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{locale === "pl" ? "Wróć do Centrum Audytu" : locale === "de" ? "Zurück zum Audit-Hub" : "Back to Audit Hub"}</span>
        </Link>
      </div>

      <CanonicalAuditReportView
        report={report}
        pdfDownloadUrl={pdfDownloadUrl}
      />
    </main>
  );
}
