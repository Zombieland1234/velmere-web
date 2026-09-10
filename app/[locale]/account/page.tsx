import type { Metadata } from "next";
import AuthGate from "@/components/auth/AuthGate";
import DashboardClient from "@/components/dashboard/DashboardClient";
import { buildVelmereMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildVelmereMetadata({
    locale,
    path: "/account",
    title: "Account — Velmère",
    description: "Profile, wallet, orders, and VLM access at Velmère.",
  });
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <AuthGate>
      <DashboardClient />
    </AuthGate>
  );
}
