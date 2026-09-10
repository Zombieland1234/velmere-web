import { notFound, redirect } from "next/navigation";
import LoginPage from "../login/page";

const LOGIN_ALIASES = new Set(["login", "sign-in", "signin", "logowanie"]);
const CANONICAL_FALLBACKS = new Map([
  ["admin/import-products", "admin/import-products"],
  ["market-integrity", "market-integrity"],
  ["security/audits", "security/audits"],
]);

function normalizeLocale(locale: string): "pl" | "en" | "de" {
  return locale === "pl" || locale === "de" ? locale : "en";
}

export default async function MissingPage({
  params,
}: {
  params: Promise<{ locale: string; missing?: string[] }>;
}) {
  const resolvedParams = await params;
  const locale = normalizeLocale(resolvedParams.locale);
  const segments = resolvedParams.missing ?? [];
  const [firstSegment] = segments;

  // A stale Vercel rewrite can route an already-canonical /pl/login request
  // into this catch-all. Rendering the canonical server page avoids a
  // self-redirect loop while preserving exactly the same login surface.
  if (firstSegment && LOGIN_ALIASES.has(firstSegment)) {
    return LoginPage({ params: Promise.resolve({ locale }) });
  }

  const canonical = CANONICAL_FALLBACKS.get(segments.join("/"));
  if (canonical) {
    redirect(`/${locale}/${canonical}`);
  }

  notFound();
}
