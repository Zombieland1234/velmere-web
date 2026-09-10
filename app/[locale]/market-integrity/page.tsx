import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import ShieldRealMarketsParityClient from "@/components/market-integrity/ShieldRealMarketsParityClient";
import { buildVelmereMetadata, SUPPORTED_LOCALES } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildVelmereMetadata({
    locale,
    path: "/market-integrity",
    title: "Velmère Shield — Market Integrity",
    description:
      "Shield-native crypto terminal with Real Markets visual parity, source-bound risk scoring, VLM Brain modal analysis and clean crypto table navigation.",
  });
}

export default async function MarketIntegrityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <main
      className="shield-typography-root realmarkets-page-pass2355 shield-page-pass2356 bg-velmere-black px-5 py-24 text-velmere-ivory md:px-10 md:py-32"
    >
      <section className="mx-auto max-w-[108rem]">
        <ShieldRealMarketsParityClient locale={locale} />
      </section>
    </main>
  );
}
