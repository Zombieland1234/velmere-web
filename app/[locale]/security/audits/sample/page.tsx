import type { Metadata } from "next";
import SecurityAuditSampleReportPage from "@/components/security/SecurityAuditSampleReportPage";

export const metadata: Metadata = {
  title: "Velmère Audit Verification Sample Report",
  description:
    "A sample Velmère Audit Watch report showing Lens PDF outline, Shield Map evidence flow, safe badge language and responsible disclosure boundaries.",
};

export default async function SecurityAuditSamplePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <SecurityAuditSampleReportPage locale={locale} />;
}
