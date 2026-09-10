import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import ShieldProCleanTerminalClient from "@/components/market-integrity/ShieldProCleanTerminalClient";
import { buildVelmereMetadata, SUPPORTED_LOCALES } from "@/lib/seo/metadata";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildVelmereMetadata({
    locale,
    path: "/shield-pro",
    title: "Velmère Shield Pro — Institutional Terminal",
    description: "Shield Pro institutional terminal with real-time risk telemetry, multi-exchange orderbook depth, and VLM Brain analytics.",
  });
}

export default async function ShieldProPage({ params }: PageProps) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) notFound();
  setRequestLocale(locale);
  return <ShieldProCleanTerminalClient locale={locale} />;
}

