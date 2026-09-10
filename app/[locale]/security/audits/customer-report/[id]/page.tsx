import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import CustomerSafeAuditReportPage from "@/components/security/CustomerSafeAuditReportPage";
import { getAuditAccountMessageByIdentifier } from "@/lib/account/audit-account-messages";
import { buildPass2369CustomerSafeReportPayload } from "@/lib/security/customer-safe-report-route";
import { resolveRequestAccount } from "@/lib/auth/account-session";

async function resolveServerAccount() {
  const incoming = await headers();
  return await resolveRequestAccount(new Request("http://velmere.local/account-report", { headers: incoming }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params;
  const account = await resolveServerAccount();
  let result: Awaited<ReturnType<typeof getAuditAccountMessageByIdentifier>>;
  try {
    result = account ? await getAuditAccountMessageByIdentifier({ id, locale, accountId: account.accountId }) : null;
  } catch {
    result = null;
  }
  if (!result) {
    return { title: "Velmère account report", robots: { index: false, follow: false } };
  }
  let payload: ReturnType<typeof buildPass2369CustomerSafeReportPayload>;
  try {
    payload = buildPass2369CustomerSafeReportPayload({ id, locale, record: result.record });
  } catch {
    return { title: "Velmère account report", robots: { index: false, follow: false } };
  }
  return {
    title: `${payload.projectName} · Velmère customer-safe report`,
    description: "Customer-safe Velmère automated analysis report route with access control and a report-ready timeline.",
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const account = await resolveServerAccount();
  if (!account || ((process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") && account.sessionSource === "preview")) notFound();
  let payload: ReturnType<typeof buildPass2369CustomerSafeReportPayload>;
  try {
    const result = await getAuditAccountMessageByIdentifier({ id, locale, accountId: account.accountId });
    if (!result) notFound();
    payload = buildPass2369CustomerSafeReportPayload({ id, locale, record: result.record });
  } catch {
    notFound();
  }
  return <CustomerSafeAuditReportPage payload={payload} />;
}
