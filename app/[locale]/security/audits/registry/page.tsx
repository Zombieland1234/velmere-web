import type { Metadata } from "next";
import SecurityAuditRegistryPage from "@/components/security/SecurityAuditRegistryPage";
import { buildAuditRegistryDashboard, type AuditRegistrySort } from "@/lib/security/audit-public-registry";

export const metadata: Metadata = {
  title: "Velmère Audit Watch Registry",
  description:
    "Public Velmère Audit Watch registry with audit verification status, scope mismatch, source freshness, confidence caps and evidence-first report links.",
};

function normalizeSort(value: string | undefined): AuditRegistrySort {
  return value === "freshness" || value === "admin" || value === "severity" ? value : "confidence";
}

export default async function SecurityAuditRegistryRoute({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ q?: string; status?: string; sort?: string }>;
}) {
  const { locale } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  buildAuditRegistryDashboard(locale, resolvedSearch.q ?? "", resolvedSearch.status ?? "all", normalizeSort(resolvedSearch.sort));
  return (
    <SecurityAuditRegistryPage
      locale={locale}
      query={resolvedSearch.q ?? ""}
      status={resolvedSearch.status ?? "all"}
      sort={normalizeSort(resolvedSearch.sort)}
    />
  );
}
