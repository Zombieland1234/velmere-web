import type { Metadata } from "next";
import { AlertTriangle, FileWarning, LockKeyhole, Scale, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import trustIndex from "@/config/pass36/a89-public-trust-intake-index.json";
import { SUPPORTED_LOCALES, buildVelmereMetadata } from "@/lib/seo/metadata";

const sectionTitles = {
  methodology: "Methodology",
  scope_and_limitations: "Scope and limitations",
  public_audit_registry: "Public audit registry",
  validated_findings: "Validated findings",
  remediation_confirmations: "Remediation confirmations",
  retest_confirmations: "Retest confirmations",
  cross_audit_benchmark: "Cross-audit benchmark",
  false_positive_duplicate_dispute_ledger: "False-positive, duplicate and dispute ledger",
  responsible_disclosure: "Responsible disclosure",
  safe_harbor_and_authorization: "Safe harbor and authorization",
  provider_and_data_rights: "Provider and data rights",
  model_and_ai_limitations: "Model and AI limitations",
  risk_calibration: "Risk calibration",
  pdf_and_report_integrity: "PDF and report integrity",
  security_and_privacy: "Security and privacy",
  sbom_and_supply_chain: "SBOM and supply chain",
  accessibility: "Accessibility",
  corrections_and_supersession: "Corrections and supersession",
  independent_assurance: "Independent assurance",
  legal_and_contact: "Legal and contact",
} as const;

const copy = {
  en: {
    eyebrow: "Public truth boundary",
    title: "Trust Center",
    body: "This page publishes what is evidenced, what is still missing, and which claims remain forbidden. A local harness, fixture or self-authored document is never counted as external approval.",
    status: "NO_GO · sale disabled",
    implemented: "Planned section — not published",
    blocked: "External evidence required",
    zero: "Verified external records: 0",
    notice: "No provider-rights approval, legal sign-off, independent assurance or customer-value cohort has been supplied. Paid release remains blocked.",
  },
  pl: {
    eyebrow: "Publiczna granica prawdy",
    title: "Trust Center",
    body: "Ta strona publikuje, co ma dowód, czego nadal brakuje i które twierdzenia pozostają zabronione. Lokalny harness, fixture ani własny dokument nigdy nie są liczone jako zewnętrzna akceptacja.",
    status: "NO_GO · sprzedaż wyłączona",
    implemented: "Sekcja planowana — nieopublikowana",
    blocked: "Wymagany dowód zewnętrzny",
    zero: "Zweryfikowane rekordy zewnętrzne: 0",
    notice: "Nie dostarczono akceptacji praw providerów, podpisu prawnego, niezależnego assurance ani kohort wartości klienta. Płatny release pozostaje zablokowany.",
  },
  de: {
    eyebrow: "Öffentliche Wahrheitsgrenze",
    title: "Trust Center",
    body: "Diese Seite zeigt, was belegt ist, was fehlt und welche Aussagen verboten bleiben. Lokale Harnesses, Fixtures oder selbst verfasste Dokumente gelten nie als externe Freigabe.",
    status: "NO_GO · Verkauf deaktiviert",
    implemented: "Geplanter Abschnitt — nicht veröffentlicht",
    blocked: "Externer Nachweis erforderlich",
    zero: "Verifizierte externe Datensätze: 0",
    notice: "Es liegen keine Freigaben zu Providerrechten, keine juristische Unterzeichnung, keine unabhängige Assurance und keine Kundenwert-Kohorte vor. Ein bezahlter Release bleibt gesperrt.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const metadata = buildVelmereMetadata({
    locale,
    path: "/trust-center",
    title: "Trust Center — Velmère",
    description: "Velmère evidence status, limitations, rights, assurance and no-promotion truth boundary.",
  });
  return {
    ...metadata,
    robots: { index: false, follow: false, noarchive: true },
  };
}

export default async function TrustCenterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) notFound();
  const text = copy[locale as keyof typeof copy] ?? copy.en;
  const externalEvidenceTotal = Object.values(trustIndex.currentEvidence).reduce((sum, value) => sum + value, 0);

  return (
    <main
      className="velmere-public-page min-h-screen bg-velmere-black px-5 pb-24 pt-28 text-white md:px-10 md:pt-36"
      data-velmere-trust-center="truth-boundary"
      data-required-sections={trustIndex.requiredPublicSections.length}
      data-public-sections-implemented={trustIndex.currentEvidence.publicSectionsImplemented}
      data-external-evidence-total={externalEvidenceTotal}
      data-sale-enabled={String(trustIndex.saleEnabled)}
    >
      <section className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_24rem] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.07] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.17em] text-velmere-gold">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {text.eyebrow}
            </p>
            <h1 className="mt-6 font-serif text-6xl leading-[0.92] tracking-[-0.06em] md:text-8xl">{text.title}</h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/[0.62]">{text.body}</p>
          </div>
          <aside className="rounded-[1.8rem] border border-rose-300/[0.18] bg-rose-300/[0.045] p-6">
            <AlertTriangle className="h-5 w-5 text-rose-100" aria-hidden="true" />
            <p className="mt-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-rose-100">{text.status}</p>
            <p className="mt-4 text-sm leading-7 text-white/[0.60]">{text.notice}</p>
          </aside>
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Trust Center sections">
          {trustIndex.requiredPublicSections.map((id, index) => (
            <article
              key={id}
              className="rounded-[1.6rem] border border-white/[0.10] bg-white/[0.025] p-5"
              data-trust-section={id}
              data-external-status="ACTION_REQUIRED"
              data-publication-status="NOT_PUBLISHED"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-velmere-gold">
                  {String(index + 1).padStart(2, "0")} / {trustIndex.requiredPublicSections.length}
                </span>
                <FileWarning className="h-4 w-4 text-amber-200/70" aria-label={text.blocked} />
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em]">
                {sectionTitles[id as keyof typeof sectionTitles] ?? id}
              </h2>
              <p className="mt-3 text-xs leading-6 text-white/[0.52]">{text.implemented}</p>
              <p className="mt-3 rounded-xl border border-amber-200/[0.12] bg-amber-200/[0.035] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-amber-100">
                {text.blocked} · {text.zero}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          <article className="rounded-[1.6rem] border border-white/[0.10] bg-black/[0.18] p-5">
            <LockKeyhole className="h-5 w-5 text-cyan-100" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-semibold">Claim boundary</h2>
            <p className="mt-3 text-sm leading-7 text-white/[0.54]">{trustIndex.truthBoundary}</p>
          </article>
          <article className="rounded-[1.6rem] border border-white/[0.10] bg-black/[0.18] p-5">
            <Scale className="h-5 w-5 text-velmere-gold" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-semibold">External approval</h2>
            <p className="mt-3 text-sm leading-7 text-white/[0.54]">
              Rights, legal review, independent assurance and customer outcomes remain ACTION_REQUIRED.
            </p>
          </article>
          <article className="rounded-[1.6rem] border border-white/[0.10] bg-black/[0.18] p-5">
            <FileWarning className="h-5 w-5 text-amber-100" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-semibold">Promotion</h2>
            <p className="mt-3 text-sm leading-7 text-white/[0.54]">
              LIVE=false · saleEnabled=false · productionApproved=false · worldClassProven=false
            </p>
          </article>
        </section>
      </section>
    </main>
  );
}
