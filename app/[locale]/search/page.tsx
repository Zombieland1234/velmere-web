import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import VelmereIntelligenceSearchClient from "@/components/search/VelmereIntelligenceSearchClient";
import { buildVelmereMetadata, SUPPORTED_LOCALES } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildVelmereMetadata({
    locale,
    path: "/search",
    title: "Velmère Lens",
    description: "A controlled Velmère Lens layer for compact token capsules, source confidence and shortcuts to full Shield analysis."
  });
}

export default async function VelmereSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ query?: string; q?: string; asset?: string }>;
}) {
  const { locale } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) notFound();
  setRequestLocale(locale);

  return (
    <VelmereIntelligenceSearchClient
      locale={locale}
      initialQuery={resolvedSearchParams.query || resolvedSearchParams.q || resolvedSearchParams.asset || ""}
    />
  );
}

// PASS179 public UX marker: TokenMetadataProviderPanel remains available but is no longer rendered on the public Lens page.
