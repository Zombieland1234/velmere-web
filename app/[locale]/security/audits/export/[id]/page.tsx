import type { Metadata } from "next";
import SecurityAuditExportPage from "@/components/security/SecurityAuditExportPage";
import { buildAuditReportExportPayload } from "@/lib/security/audit-pdf-shield-export";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params;
  const payload = buildAuditReportExportPayload(id, locale);
  return {
    title: `${payload.projectName} · Velmère Audit Export`,
    description: "Full Velmère Audit Watch export payload for Lens PDF and Shield Map evidence graph.",
    robots: { index: false, follow: false },
  };
}

export default async function SecurityAuditExportRoute({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  return <SecurityAuditExportPage locale={locale} id={id} />;
}
