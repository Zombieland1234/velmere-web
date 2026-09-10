import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RuntimeScreenshotChecklistPanel } from "@/components/status/RuntimeScreenshotChecklistPanel";
import { buildVelmereMetadata, SUPPORTED_LOCALES } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildVelmereMetadata({
    locale,
    path: "/runtime-proof",
    title: "Runtime Proof — Velmère",
    description: "Operator checklist for capturing redacted runtime screenshots and receipts.",
  });
}

export default async function RuntimeProofPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
    notFound();
  }

  return <RuntimeScreenshotChecklistPanel locale={locale} />;
}
