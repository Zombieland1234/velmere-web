import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES } from "@/lib/seo/metadata";
import HomePageClient from "@/components/home/HomePageClient";
import { buildVelmereMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildVelmereMetadata({
    locale,
    title:
      locale === "pl"
        ? "Velmère — Integralność Rynku i Bezpieczeństwo Aktywów Cyfrowych"
        : locale === "de"
          ? "Velmère — Marktintegrität & Digitale Asset-Sicherheit"
          : "Velmère — Institutional Market Integrity & Digital Asset Security",
    description:
      locale === "pl"
        ? "Instytucjonalna analiza integralności rynku, ocena ryzyka kontraktów i weryfikowalne dowody kryptograficzne."
        : locale === "de"
          ? "Institutionelle Marktintegritätsanalyse, Smart-Contract-Risikobewertung und verifizierbare Evidenz."
          : "Institutional-grade digital asset security, market integrity analysis, contract risk intelligence, and verifiable evidence.",
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  return <HomePageClient />;
}
