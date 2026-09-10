import { redirect } from "next/navigation";
import { SUPPORTED_LOCALES } from "@/lib/seo/metadata";
import { notFound } from "next/navigation";

type SearchValue = string | string[] | undefined;

function appendSearchParam(query: URLSearchParams, key: string, value: SearchValue) {
  if (Array.isArray(value)) {
    for (const item of value) query.append(key, item);
    return;
  }
  if (typeof value === "string") query.set(key, value);
}

export default async function BrowserLocaleAliasPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, SearchValue>>;
}) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) notFound();
  const resolved = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) appendSearchParam(query, key, value);
  redirect(`/${locale}/search${query.size > 0 ? `?${query.toString()}` : ""}`);
}
