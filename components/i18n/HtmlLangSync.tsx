"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const LOCALES = new Set(["pl", "en", "de"]);

export default function HtmlLangSync() {
  const pathname = usePathname();
  useEffect(() => {
    const first = window.location.pathname.split("/").filter(Boolean)[0];
    document.documentElement.lang = LOCALES.has(first) ? first : "en";
  }, [pathname]);
  return null;
}
