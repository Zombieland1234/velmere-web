import type { Metadata } from "next";
import SecurityAuditPricingPage from "@/components/security/SecurityAuditPricingPage";
import { buildAuditBusinessFlow } from "@/lib/security/audit-business-flow";

export const metadata: Metadata = {
  title: "Velmère Audit Watch Pricing & Review Desk",
  description:
    "Velmère Audit Watch business flow with review packages, lead routing, responsible disclosure boundaries and safe security-review language.",
};

export default async function SecurityAuditPricingRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  buildAuditBusinessFlow(locale);
  return <SecurityAuditPricingPage locale={locale} />;
}
