import type { Metadata } from "next";
// PASS2062 marker: MarketIntegrityShieldMapPage · Mapa operacyjna Shielda
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import ShieldMapCommandClient from "@/components/market-integrity/ShieldMapCommandClient";
import { buildVelmereMetadata, SUPPORTED_LOCALES } from "@/lib/seo/metadata";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildVelmereMetadata({
    locale,
    path: "/market-integrity/shield-map",
    title: "Velmère Shield Map",
    description:
      locale === "pl"
        ? "Interaktywna mapa ryzyka: źródła, luki i następny krok weryfikacji."
        : locale === "de"
          ? "Interaktive Risikokarte: Quellen, Lücken und der nächste Prüfschritt."
          : "Interactive risk map: sources, gaps and the next verification step.",
  });
}

export default async function ShieldMapPage({ params }: PageProps) {
  const { locale } = await params;
  if (
    !SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])
  ) {
    notFound();
  }
  setRequestLocale(locale);
  return <ShieldMapCommandClient locale={locale} />;
}
