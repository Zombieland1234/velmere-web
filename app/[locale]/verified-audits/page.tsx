import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import VerifiedAuditsPage from "@/components/verified-audits/VerifiedAuditsPage";
import { buildVelmereMetadata, SUPPORTED_LOCALES } from "@/lib/seo/metadata";

const metadataCopy = {
  en: {
    title: "Verified Audits & On-Chain Immutability Registry — Velmère Sentinel",
    description:
      "Explore verified smart contract audits with real-time on-chain code change detection (green checkmark to red X) and the historical major risk registry.",
  },
  pl: {
    title: "Zweryfikowane Audyty i Rejestr Nienaruszalności Kodu — Velmère Sentinel",
    description:
      "Zweryfikowane audyty smart kontraktów z automatyczną detekcją modyfikacji on-chain (zamiana ptaszka w X) oraz kronika największych wykrytych zagrożeń.",
  },
  de: {
    title: "Verifizierte Audits und On-Chain-Unveränderlichkeitsregister — Velmère Sentinel",
    description:
      "Erkunden Sie verifizierte Smart-Contract-Audits mit Echtzeit-Codeänderungserkennung und die historische Risikochronik.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolved = (SUPPORTED_LOCALES.includes(locale as any) ? locale : "pl") as "en" | "pl" | "de";
  return buildVelmereMetadata({
    locale: resolved,
    path: "/verified-audits",
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

  return <VerifiedAuditsPage locale={locale} />;
}
