import { getRequestConfig } from "next-intl/server";
import deMessages from "./messages/de.json";
import enMessages from "./messages/en.json";
import plMessages from "./messages/pl.json";
import { routing } from "./routing";

// A42: keep the locale catalog statically bound. Next 16/Turbopack no longer
// needs to resolve a template-literal JSON import inside every server worker,
// which removes one global JSON/module-cache failure surface without changing
// any translated copy.
const MESSAGE_CATALOG = {
  pl: plMessages,
  en: enMessages,
  de: deMessages,
} as const;
Object.freeze(MESSAGE_CATALOG);

export default getRequestConfig(async ({ requestLocale }: { requestLocale: Promise<string | undefined> }) => {
  const requested = await requestLocale;
  const locale = typeof requested === "string" && (routing.locales as readonly string[]).includes(requested)
    ? requested as keyof typeof MESSAGE_CATALOG
    : routing.defaultLocale;

  return {
    locale,
    messages: MESSAGE_CATALOG[locale],
  };
});
