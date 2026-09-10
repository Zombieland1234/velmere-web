import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import CrossAssetCollapseRadarPanel from "@/components/market-integrity/CrossAssetCollapseRadarPanel";
import { buildVelmereMetadata, SUPPORTED_LOCALES } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildVelmereMetadata({
    locale,
    path: "/market-integrity/cross-asset",
    title: "Velmère Shield — Real Markets Proof Reader / Proof Passport",
    description:
      "Clean Real Markets table for Velmère Shield with separated stocks, FX, ETFs, commodities, real estate and exchange lanes.",
  });
}

export default async function CrossAssetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) notFound();
  setRequestLocale(locale);

  return (
    <main
      className="shield-typography-root bg-velmere-black px-5 py-24 text-velmere-ivory md:px-10 md:py-32"
    >
      <section className="mx-auto max-w-[108rem]">
        <CrossAssetCollapseRadarPanel locale={locale} />
        {/* compatibility: Velmère Shield — Real Markets Proof Passport · Velmère Shield — Real Markets Proof Reader */}
      </section>
    </main>
  );
}
