import type { Metadata } from "next";
import SecurityAuditAdminInbox from "@/components/security/SecurityAuditAdminInbox";
import SecurityConsoleLockedPanel from "@/components/admin/SecurityConsoleLockedPanel";
import { buildSecurityAdminGateReadiness } from "@/lib/security/security-admin-auth";

export const metadata: Metadata = {
  title: "Velmère Audit Review Inbox",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminSecurityAuditInboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const focusParams = searchParams ? await searchParams : {};
  const gate = buildSecurityAdminGateReadiness();

  if (!gate.consoleVisible) {
    return <SecurityConsoleLockedPanel locale={locale} />;
  }

  return <SecurityAuditAdminInbox locale={locale} focusParams={focusParams} />;
}
