import type { Metadata } from "next";
import SecurityTrustPage from "@/components/security/SecurityTrustPage";
import { resolveSecurityTrustLocale } from "@/lib/security/security-trust-copy";
import { buildVelmereMetadata } from "@/lib/seo/metadata";

const metadataCopy = {
  pl: {
    title: "Velmère Security — architektura ochrony i dowodów",
    description: "Poznaj warstwową architekturę Velmère: Security Intelligence, granice źródeł, ochrona AI, audyty i bezpieczny eksport raportów.",
  },
  en: {
    title: "Velmère Security — protection and evidence architecture",
    description: "Explore Velmère's layered security architecture: Security Intelligence, source boundaries, AI controls, audits and protected report export.",
  },
  de: {
    title: "Velmère Security — Schutz- und Evidenzarchitektur",
    description: "Entdecke Velmères mehrschichtige Architektur: Security Intelligence, Quellengrenzen, KI-Kontrollen, Audits und geschützten Report-Export.",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolved = resolveSecurityTrustLocale(locale);
  return buildVelmereMetadata({ locale: resolved, path: "/security", ...metadataCopy[resolved] });
}

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <SecurityTrustPage locale={locale} />;
}
