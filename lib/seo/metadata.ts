import type { Metadata } from "next";

export const SUPPORTED_LOCALES = ["pl", "en", "de"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://velmere-store1.vercel.app").replace(/\/$/, "");

export function resolveLocale(locale?: string): SupportedLocale {
  if (locale === "pl" || locale === "de" || locale === "en") return locale;
  return "en";
}

export function absoluteUrl(path = "") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${normalized}`;
}

export function buildLocalizedAlternates(locale: string, path = "") {
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return {
    canonical: `/${resolveLocale(locale)}${normalizedPath}`,
    languages: {
      pl: `/pl${normalizedPath}`,
      en: `/en${normalizedPath}`,
      de: `/de${normalizedPath}`,
      "x-default": `/en${normalizedPath}`,
    },
  } satisfies Metadata["alternates"];
}

export function buildVelmereMetadata({
  locale,
  path = "",
  title,
  description,
}: {
  locale: string;
  path?: string;
  title: string;
  description: string;
}): Metadata {
  const resolvedLocale = resolveLocale(locale);
  const canonicalPath = `/${resolvedLocale}${path ? (path.startsWith("/") ? path : `/${path}`) : ""}`;
  const imagePath = `/${resolvedLocale}/opengraph-image`;

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: buildLocalizedAlternates(resolvedLocale, path),
    openGraph: {
      title,
      description,
      url: canonicalPath,
      siteName: "Velmère",
      locale: resolvedLocale,
      type: "website",
      images: [
        {
          url: imagePath,
          width: 1200,
          height: 630,
          alt: `${title} — Velmère`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imagePath],
    },
  };
}
