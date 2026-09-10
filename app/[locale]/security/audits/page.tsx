import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import SecurityAuditsCleanPage from "@/components/security/SecurityAuditsCleanPage";
import { SUPPORTED_LOCALES } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "Velmère Audit",
  description:
    "Velmère Basic limited prescreen, invitation-only Pro beta and unavailable Advanced evidence analysis with explicit confidence and review boundaries.",
};

export default async function SecurityAuditsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  return <SecurityAuditsCleanPage locale={locale} />;
}
