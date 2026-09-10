import type { Metadata } from "next";
import SecurityConsolePanel from "@/components/admin/SecurityConsolePanel";
import SecurityConsoleLockedPanel from "@/components/admin/SecurityConsoleLockedPanel";
import { buildSecurityAdminGateReadiness } from "@/lib/security/security-admin-auth";

export const metadata: Metadata = {
  title: "Velmère Admin Security Console",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminSecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const gate = buildSecurityAdminGateReadiness();

  if (!gate.consoleVisible) {
    return <SecurityConsoleLockedPanel locale={locale} />;
  }

  return (
    <main className="min-h-screen bg-velmere-black text-white">
      <SecurityConsolePanel locale={locale} />
    </main>
  );
}
