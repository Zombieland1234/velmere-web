import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import AtelierPage from "@/components/atelier/AtelierPage";
import {
  buildVelmereMetadata,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/lib/seo/metadata";

const metadata = {
  pl: {
    title: "Velmère Atelier — globalna sieć rzemiosła",
    description:
      "Poznaj regionalną sieć produkcji i realizacji Velmère, możliwości produktowe oraz standard jakości Atelier.",
  },
  en: {
    title: "Velmère Atelier — global craft network",
    description:
      "Explore Velmère's regional production and fulfilment network, product capabilities and Atelier quality standard.",
  },
  de: {
    title: "Velmère Atelier — globales Handwerksnetzwerk",
    description:
      "Entdecke das regionale Produktions- und Abwicklungsnetzwerk von Velmère, Produktmöglichkeiten und den Atelier-Qualitätsstandard.",
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolved = SUPPORTED_LOCALES.includes(locale as SupportedLocale)
    ? (locale as SupportedLocale)
    : "en";

  return buildVelmereMetadata({
    locale: resolved,
    path: "/atelier",
    ...metadata[resolved],
  });
}

export default async function AtelierRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as SupportedLocale)) notFound();

  setRequestLocale(locale);
  return <AtelierPage locale={locale as SupportedLocale} />;
}
