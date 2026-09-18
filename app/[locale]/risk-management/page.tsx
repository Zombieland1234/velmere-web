import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import RiskManagementPage from "@/components/risk-management/RiskManagementPage";
import { buildVelmereMetadata, SUPPORTED_LOCALES } from "@/lib/seo/metadata";

const metadataCopy = {
  en: {
    title: "Risk Management & Methodology Architecture — Velmère Sentinel",
    description:
      "Explore the deterministic risk evaluation methodology behind Velmère Sentinel: L3 orderbook depth, EVM symbolic execution, whale flow entropy and RFC 3161 audit verification.",
  },
  pl: {
    title: "Zarządzanie Ryzykiem i Metodologia — Velmère Sentinel",
    description:
      "Poznaj deterministyczną metodologię oceny ryzyka Velmère Sentinel: głębokość arkusza L3, symboliczna egzekucja EVM, entropia przepływów wielorybów oraz weryfikacja RFC 3161.",
  },
  de: {
    title: "Risikomanagement und Methodik-Architektur — Velmère Sentinel",
    description:
      "Erfahren Sie mehr über die deterministische Risikobewertungsmethodik von Velmère Sentinel: L3-Orderbuchtiefe, symbolische EVM-Ausführung und RFC 3161-Prüfung.",
  },
};

function isSupportedMetadataLocale(value: string): value is keyof typeof metadataCopy {
  return SUPPORTED_LOCALES.some((supported) => supported === value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolved = isSupportedMetadataLocale(locale) ? locale : "pl";
  return buildVelmereMetadata({
    locale: resolved,
    path: "/risk-management",
    ...metadataCopy[resolved],
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) notFound();
  setRequestLocale(locale);

  return <RiskManagementPage locale={locale} />;
}
