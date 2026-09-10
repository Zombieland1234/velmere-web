import { notFound, redirect } from "next/navigation";
import { SUPPORTED_LOCALES } from "@/lib/seo/metadata";

// PASS4533: legacy "how we calculate risk" route removed from the product flow.
// It now redirects into the table-first Shield terminal instead of rendering an extra methodology page.
export const dynamic = "force-static";

export default async function RiskMethodologyRemovedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
    notFound();
  }
  redirect(`/${locale}/market-integrity`);
}
