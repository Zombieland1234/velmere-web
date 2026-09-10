import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import ShieldMapCommandClient from "@/components/market-integrity/ShieldMapCommandClient";
import { buildVelmereMetadata, SUPPORTED_LOCALES } from "@/lib/seo/metadata";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildVelmereMetadata({
    locale,
    path: "/shield-map",
    title: "Velmère Shield Map — Evidence Graph",
    description:
      locale === "pl"
        ? "Mapa dowodów VLM: źródła, fakty, sygnały, konflikty, braki danych, confidence i wniosek."
        : locale === "de"
          ? "VLM Evidence Graph: Quellen, Fakten, Signale, Konflikte, fehlende Daten, Konfidenz und Urteil."
          : "VLM evidence graph: sources, facts, signals, conflicts, missing data, confidence and verdict.",
  });
}

export default async function ShieldMapShortPage({ params }: PageProps) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  return <ShieldMapCommandClient locale={locale} />;
}
