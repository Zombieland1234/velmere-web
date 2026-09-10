import type { Metadata } from "next";
import SecurityAuditBenchmarkPage from "@/components/security/SecurityAuditBenchmarkPage";

export const metadata: Metadata = {
  title: "Velmère Audit Benchmark",
  description:
    "Velmère Audit Watch benchmark page adapting elite security audit page patterns into a premium evidence-first review product.",
};

export default async function SecurityAuditBenchmarkRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <SecurityAuditBenchmarkPage locale={locale} />;
}
