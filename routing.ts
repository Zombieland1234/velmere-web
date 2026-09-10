import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["pl", "en", "de"],
  defaultLocale: "pl",
});

export type AppLocale = (typeof routing.locales)[number];
