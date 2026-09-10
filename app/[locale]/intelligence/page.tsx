import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import IntelligencePage from "@/components/intelligence/IntelligencePage";
import { buildVlmAdvancedOnlyTierPolicies } from "@/lib/commerce/vlm-tier-presentation-policy";
import { getVlmCurrentSkuTruth } from "@/lib/commerce/vlm-current-sku-truth";
import { getIntelligenceContent, resolveIntelligenceLocale } from "@/lib/intelligence/intelligence-content";
import { PUBLIC_INTELLIGENCE_METRICS } from "@/lib/intelligence/public-intelligence-metrics";
import { buildVelmereMetadata, SUPPORTED_LOCALES } from "@/lib/seo/metadata";

const metadataCopy = {
  en: {
    title: "Velmère Intelligence — Risk as an Evidence System",
    description: "Explore the Velmère evidence architecture: asset-aware risk lanes, confidence boundaries, intelligence surfaces and source-bound verification.",
  },
  pl: {
    title: "Velmère Intelligence — Ryzyko jako system dowodów",
    description: "Poznaj architekturę dowodową Velmère: tory ryzyka zależne od aktywa, granice pewności, powierzchnie intelligence i weryfikację źródeł.",
  },
  de: {
    title: "Velmère Intelligence — Risiko als Evidenzsystem",
    description: "Entdecke die Velmère-Evidenzarchitektur: asset-spezifische Risikobahnen, Konfidenzgrenzen, Intelligence-Oberflächen und Quellenverifizierung.",
  },
};

function serializeStructuredData(value: unknown) {
  return JSON.stringify(value)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}


export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolved = resolveIntelligenceLocale(locale);
  return buildVelmereMetadata({
    locale: resolved,
    path: "/intelligence",
    ...metadataCopy[resolved],
  });
}

export default async function VelmereIntelligencePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) notFound();
  setRequestLocale(locale);

  const resolved = resolveIntelligenceLocale(locale);
  const copy = getIntelligenceContent(resolved);
  const policies = buildVlmAdvancedOnlyTierPolicies(resolved);
  const skuTruth = {
    basic: getVlmCurrentSkuTruth("basic", resolved),
    pro: getVlmCurrentSkuTruth("pro", resolved),
    advanced: getVlmCurrentSkuTruth("advanced", resolved),
  } as const;

  const marketTiers = (["basic", "pro", "advanced"] as const).map((id) => ({
    id,
    label: id.toUpperCase(),
    subtitle: copy.tiers.marketFeatures[id][0],
    price: skuTruth[id].publicPriceLabel,
    signals: policies[id].engineDepth.targetSignals,
  }));
  const auditTiers = (["basic", "pro", "advanced"] as const).map((id) => ({
    id,
    label: id.toUpperCase(),
    subtitle: copy.tiers.auditNames[id],
    price: skuTruth[id].publicPriceLabel,
    signals: policies[id].engineDepth.targetSignals,
  }));

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: metadataCopy[resolved].title,
    description: metadataCopy[resolved].description,
    author: { "@type": "Organization", name: "Velmère" },
    inLanguage: resolved,
    about: ["risk intelligence", "market integrity", "evidence systems"],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }} />
      <IntelligencePage
        locale={resolved}
        copy={copy}
        marketTiers={marketTiers}
        auditTiers={auditTiers}
        proofMetrics={PUBLIC_INTELLIGENCE_METRICS}
      />
    </>
  );
}
