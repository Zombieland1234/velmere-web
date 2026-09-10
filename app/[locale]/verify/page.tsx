import type { Metadata } from "next";
import { notFound } from "next/navigation";
import VerifySearchClient from "@/components/verify/VerifySearchClient";
import { buildVelmereMetadata, SUPPORTED_LOCALES } from "@/lib/seo/metadata";

const copy = {
  pl: {
    eyebrow: "Trwała prawda wdrożenia",
    title: "Velmère Verify",
    body: "Szukaj po kanonicznym chain ID i adresie kontraktu albo po dokładnej publicznej nazwie projektu. Brak wyniku nie ujawnia, czy rekord nie istnieje, czy pozostaje prywatny.",
    boundary: "Status jest obliczany z append-only historii Velmère. Wygasły monitoring nigdy nie pozostaje zielony. Verify nie jest gwarancją bezpieczeństwa ani poradą inwestycyjną.",
    identityLegend: "Kanoniczna tożsamość",
    chainLabel: "Chain ID",
    addressLabel: "Adres kontraktu",
    projectLegend: "Publiczna nazwa projektu",
    projectLabel: "Dokładna nazwa",
    search: "Sprawdź",
    noResults: "Brak publicznego rekordu dla tego zapytania.",
    invalid: "Nie udało się wykonać bezpiecznego wyszukiwania. Sprawdź format i spróbuj ponownie.",
    current: "Otwórz rekord",
    reportPrivate: "Raport pozostaje prywatny; widoczne jest wyłącznie publiczne podsumowanie.",
    reportNotCurrent: "Poprzedni raport jest wyłącznie kontekstem historycznym; bieżący raport pozostaje wstrzymany do rewalidacji.",
  },
  en: {
    eyebrow: "Durable deployment truth",
    title: "Velmère Verify",
    body: "Search by canonical chain ID and contract address, or by an exact public project name. An empty result does not reveal whether a record is unknown or private.",
    boundary: "Status is derived from Velmère's append-only history. Expired monitoring never remains green. Verify is not a safety guarantee or investment advice.",
    identityLegend: "Canonical identity",
    chainLabel: "Chain ID",
    addressLabel: "Contract address",
    projectLegend: "Public project name",
    projectLabel: "Exact name",
    search: "Verify",
    noResults: "No public record matches this query.",
    invalid: "The secure search could not be completed. Check the format and try again.",
    current: "Open record",
    reportPrivate: "The report is private; only its public summary is visible.",
    reportNotCurrent: "The previous report is historical context only; the current report remains withheld pending revalidation.",
  },
  de: {
    eyebrow: "Dauerhafte Deployment-Wahrheit",
    title: "Velmère Verify",
    body: "Suche mit kanonischer Chain-ID und Contract-Adresse oder mit einem exakten öffentlichen Projektnamen. Ein leeres Ergebnis verrät nicht, ob ein Datensatz unbekannt oder privat ist.",
    boundary: "Der Status stammt aus Velmères Append-only-Historie. Abgelaufenes Monitoring bleibt nie grün. Verify ist keine Sicherheitsgarantie und keine Anlageberatung.",
    identityLegend: "Kanonische Identität",
    chainLabel: "Chain-ID",
    addressLabel: "Contract-Adresse",
    projectLegend: "Öffentlicher Projektname",
    projectLabel: "Exakter Name",
    search: "Prüfen",
    noResults: "Kein öffentlicher Datensatz entspricht dieser Suche.",
    invalid: "Die sichere Suche konnte nicht abgeschlossen werden. Format prüfen und erneut versuchen.",
    current: "Datensatz öffnen",
    reportPrivate: "Der Bericht bleibt privat; nur die öffentliche Zusammenfassung ist sichtbar.",
    reportNotCurrent: "Der vorherige Bericht ist nur historischer Kontext; der aktuelle Bericht bleibt bis zur Revalidierung zurückgehalten.",
  },
} as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const text = copy[locale as keyof typeof copy] ?? copy.en;
  return {
    ...buildVelmereMetadata({
      locale,
      path: "/verify",
      title: `${text.title} — Velmère`,
      description: text.body,
    }),
    robots: { index: false, follow: false, noarchive: true },
  };
}

export default async function VerifyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) notFound();
  const typedLocale = locale as keyof typeof copy;
  const text = copy[typedLocale];
  return (
    <main className="velmere-public-page min-h-screen bg-velmere-black px-5 pb-24 pt-28 text-white md:px-10 md:pt-36">
      <section className="mx-auto max-w-6xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">{text.eyebrow}</p>
        <h1 className="mt-5 font-serif text-6xl tracking-[-0.06em] md:text-8xl">{text.title}</h1>
        <p className="mt-6 max-w-3xl text-base leading-8 text-white/65">{text.body}</p>
        <p className="mt-5 max-w-3xl rounded-2xl border border-amber-200/15 bg-amber-200/[0.04] p-4 text-sm leading-7 text-amber-50/80">{text.boundary}</p>
        <VerifySearchClient locale={typedLocale} copy={text} />
      </section>
    </main>
  );
}
