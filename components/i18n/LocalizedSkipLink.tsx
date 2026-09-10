"use client";

import { usePathname } from "next/navigation";

const labels = {
  pl: "Przejdź do treści",
  en: "Skip to content",
  de: "Zum Inhalt springen",
} as const;

export default function LocalizedSkipLink() {
  const pathname = usePathname();
  const locale = pathname?.split("/").filter(Boolean)[0];
  const label = locale === "pl" || locale === "de" ? labels[locale] : labels.en;

  return (
    <a
      href="#main-content"
      className="velmere-skip-link sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2200] focus:rounded-full focus:bg-velmere-ivory focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-black"
    >
      {label}
    </a>
  );
}
