import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import CrossAssetCollapseRadarPanel from "@/components/market-integrity/CrossAssetCollapseRadarPanel";
import { buildVelmereMetadata, SUPPORTED_LOCALES } from "@/lib/seo/metadata";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildVelmereMetadata({
    locale,
    path: "/real-markets",
    title: "Velmère Real Markets",
    description:
      locale === "pl"
        ? "Czysta tabela Real Markets dla akcji, FX, ETF, surowców, nieruchomości, giełd i rytmu źródeł."
        : locale === "de"
          ? "Clean Real Markets Tabelle für Aktien, FX, ETFs, Rohstoffe, Immobilien, Börsen und Quellenrhythmus."
          : "Clean Real Markets table for stocks, FX, ETFs, commodities, real estate, exchanges and source rhythm.",
  });
}

export default async function RealMarketsPage({ params }: PageProps) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <main
      className="shield-typography-root realmarkets-page-pass2319 realmarkets-page-pass2320 realmarkets-page-pass2321 realmarkets-page-pass2322 realmarkets-page-pass2323 realmarkets-page-pass2324 realmarkets-page-pass2325 realmarkets-page-pass2326 realmarkets-page-pass2329 realmarkets-page-pass2330 realmarkets-page-pass2331 realmarkets-page-pass2332 realmarkets-page-pass2333 realmarkets-page-pass2334 realmarkets-page-pass2335 realmarkets-page-pass2336 realmarkets-page-pass2337 realmarkets-page-pass2338 realmarkets-page-pass2339 realmarkets-page-pass2340 realmarkets-page-pass2341 realmarkets-page-pass2342 realmarkets-page-pass2344 realmarkets-page-pass2345 realmarkets-page-pass2346 realmarkets-page-pass2347 realmarkets-page-pass2348 realmarkets-page-pass2350 realmarkets-page-pass2351 realmarkets-page-pass2352 realmarkets-page-pass2353 realmarkets-page-pass2354 realmarkets-page-pass2355 bg-velmere-black px-5 py-24 text-velmere-ivory md:px-10 md:py-32"
    >
      <section className="mx-auto max-w-[108rem]">
        <CrossAssetCollapseRadarPanel locale={locale} />
      </section>
    </main>
  );
}
