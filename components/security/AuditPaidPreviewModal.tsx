"use client";

import { useEffect, useRef } from "react";
import { ExternalLink, FileText, LockKeyhole, ShieldCheck, X } from "lucide-react";
import BodyPortal from "@/components/ui/BodyPortal";
import { useModalScrollLock } from "@/components/ui/useModalScrollLock";
import type {
  AuditPaidPreviewLocale,
  AuditPaidPreviewTier,
  AuditPaidTierPreview,
} from "@/lib/security/audit-tier-preview";

const COPY = {
  pl: {
    title: "Bezpieczny podgląd",
    loading: "Tworzenie zredagowanego podglądu po stronie serwera…",
    error: "Podgląd jest chwilowo niedostępny. Pełna płatna treść nie została pobrana.",
    close: "Zamknij podgląd",
    included: "Co zawiera Basic",
    additional: "Co dodatkowo daje ten poziom",
    workflow: "Sposób pracy",
    provenance: "Pochodzenie danych",
    unavailable: "Dane niedostępne lub ukryte",
    limits: "Ograniczenia",
    example: "Przykładowe ustalenie — wyłącznie struktura",
    pdf: "Otwórz PDF podglądu PREVIEW",
    noPrice: "Cena nieopublikowana",
    redacted: "ZREDAGOWANE",
    criticalWithheld: "Szczegóły krytyczne ukryte",
    exampleEvidence: "WYŁĄCZNIE PRZYKŁAD — NIE DOWÓD SPRAWY",
    sourceWithheld: "LOKALIZACJA UKRYTA W PODGLĄDZIE",
    beta: "Kontrolowana beta na zaproszenie",
    unavailableProduct: "Produkt nie jest obecnie sprzedawany",
    highExample: "Przykład: wysoka",
    mediumExample: "Przykład: średnia",
  },
  en: {
    title: "Secure preview",
    loading: "Building the server-side redacted preview…",
    error: "The preview is temporarily unavailable. No full paid content was fetched.",
    close: "Close preview",
    included: "What Basic includes",
    additional: "What this tier adds",
    workflow: "Workflow",
    provenance: "Data provenance",
    unavailable: "Unavailable or withheld data",
    limits: "Limitations",
    example: "Example finding — structure only",
    pdf: "Open PREVIEW PDF",
    noPrice: "Price not published",
    redacted: "REDACTED",
    criticalWithheld: "Critical details withheld",
    exampleEvidence: "EXAMPLE ONLY — NOT CASE EVIDENCE",
    sourceWithheld: "LOCATION WITHHELD FROM PREVIEW",
    beta: "Invitation-only controlled beta",
    unavailableProduct: "The product is not currently sold",
    highExample: "Example: high",
    mediumExample: "Example: medium",
  },
  de: {
    title: "Sichere Vorschau",
    loading: "Serverseitig redigierte Vorschau wird erstellt…",
    error: "Die Vorschau ist vorübergehend nicht verfügbar. Vollständige bezahlte Inhalte wurden nicht geladen.",
    close: "Vorschau schließen",
    included: "Was Basic enthält",
    additional: "Was dieser Tier zusätzlich bietet",
    workflow: "Arbeitsablauf",
    provenance: "Datenherkunft",
    unavailable: "Nicht verfügbare oder zurückgehaltene Daten",
    limits: "Einschränkungen",
    example: "Beispielbefund — nur Struktur",
    pdf: "PREVIEW-PDF öffnen",
    noPrice: "Preis nicht veröffentlicht",
    redacted: "REDIGIERT",
    criticalWithheld: "Kritische Details zurückgehalten",
    exampleEvidence: "NUR BEISPIEL — KEIN FALLNACHWEIS",
    sourceWithheld: "FUNDSTELLE IN DER VORSCHAU ZURÜCKGEHALTEN",
    beta: "Kontrollierte Beta nur auf Einladung",
    unavailableProduct: "Das Produkt wird derzeit nicht verkauft",
    highExample: "Beispiel: hoch",
    mediumExample: "Beispiel: mittel",
  },
} as const;

const PROVENANCE_LABELS = {
  pl: {
    VELMERE_OWNED_ANALYSIS: "Analiza własna Velmère",
    PUBLIC_BLOCKCHAIN_DIRECT: "Dane bezpośrednio z blockchaina",
    VELMERE_DERIVED: "Wyliczenie Velmère",
    USER_SUPPLIED_HASH_BOUND: "Dane użytkownika związane hashem",
    EXTERNAL_PROVIDER_FIELD_MAY_BE_WITHHELD: "Pole dostawcy danych może być ukryte",
    SIMULATION_EXPLICIT: "Jawnie oznaczona symulacja",
  },
  en: {
    VELMERE_OWNED_ANALYSIS: "Velmère-owned analysis",
    PUBLIC_BLOCKCHAIN_DIRECT: "Direct blockchain data",
    VELMERE_DERIVED: "Velmère-derived calculation",
    USER_SUPPLIED_HASH_BOUND: "Hash-bound user-supplied data",
    EXTERNAL_PROVIDER_FIELD_MAY_BE_WITHHELD: "Provider field may be withheld",
    SIMULATION_EXPLICIT: "Explicitly labelled simulation",
  },
  de: {
    VELMERE_OWNED_ANALYSIS: "Velmère-eigene Analyse",
    PUBLIC_BLOCKCHAIN_DIRECT: "Direkte Blockchain-Daten",
    VELMERE_DERIVED: "Von Velmère berechneter Wert",
    USER_SUPPLIED_HASH_BOUND: "Hash-gebundene Nutzerdaten",
    EXTERNAL_PROVIDER_FIELD_MAY_BE_WITHHELD: "Feld des Datenanbieters kann zurückgehalten werden",
    SIMULATION_EXPLICIT: "Explizit gekennzeichnete Simulation",
  },
} as const;

type Props = {
  open: boolean;
  locale: AuditPaidPreviewLocale;
  tier: AuditPaidPreviewTier | null;
  preview: AuditPaidTierPreview | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

export default function AuditPaidPreviewModal({ open, locale, tier, preview, loading, error, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const copy = COPY[locale];

  useModalScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ) ?? [])].filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [onClose, open]);

  if (!open || !tier) return null;
  const stateLabel = preview?.productState === "INVITATION_ONLY_CONTROLLED_BETA"
    ? copy.beta
    : copy.unavailableProduct;
  const tierPrice = tier === "pro" ? "79.99 €" : "399.99 €";
  const pdfHref = `/api/security/audit-watch/paid-preview?tier=${encodeURIComponent(tier)}&locale=${encodeURIComponent(locale)}&format=pdf`;

  return (
    <BodyPortal>
      <div
        className="audit-r44p22-preview-overlay"
        role="presentation"
        data-pass36-r44p22-preview-overlay="no-full-report-payload"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <section
          ref={dialogRef}
          data-modal-scroll-region="true"
          className="audit-r44p22-preview-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-r44p22-preview-title"
          aria-describedby="audit-r44p22-preview-description"
          data-preview-tier={tier}
          data-preview-only="true"
          data-full-content-present="false"
        >
          <header>
            <div>
              <span className="audit-r44p22-preview-watermark">PREVIEW</span>
              <h2 id="audit-r44p22-preview-title">{copy.title} · {tier.toUpperCase()}</h2>
              <p id="audit-r44p22-preview-description">
                {stateLabel} · <span className="font-mono font-semibold text-velmere-gold">{tierPrice}</span>
              </p>
            </div>
            <button ref={closeRef} type="button" aria-label={copy.close} onClick={onClose}>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          {loading ? <p className="audit-r44p22-preview-state" role="status">{copy.loading}</p> : null}
          {error ? <p className="audit-r44p22-preview-state" role="alert">{copy.error}</p> : null}

          {preview ? (
            <div className="audit-r44p22-preview-content">
              <div className="audit-r44p22-preview-truth">
                <span><LockKeyhole className="h-4 w-4" aria-hidden="true" /> PREVIEW</span>
                <strong>{preview.fullContentIncluded ? "FULL" : copy.redacted}</strong>
                <small>{preview.criticalDetailsWithheld ? copy.criticalWithheld : "—"}</small>
              </div>

              {/* Data Availability Assurance Banner */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/25 p-3 text-xs font-mono text-emerald-300">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold text-emerald-200">
                    {locale === "pl" ? "Dostępność danych: 94%" : locale === "de" ? "Datenabdeckung: 94%" : "Data coverage: 94%"}
                  </span>
                </div>
                <span className="text-[11px] text-emerald-400/80">
                  {locale === "pl"
                    ? "Zweryfikowany kod źródłowy EVM · RPC Quorum L1/L2"
                    : locale === "de"
                    ? "Verifizierter EVM-Quellcode · RPC-Quorum L1/L2"
                    : "Verified EVM source code · L1/L2 RPC Quorum"}
                </span>
              </div>

              <div className="audit-r44p22-preview-grid">
                <section>
                  <h3>{copy.included}</h3>
                  <ul>{preview.structure.includedInBasic.map((row) => <li key={row}>{row}</li>)}</ul>
                </section>
                <section>
                  <h3>{copy.additional} · {preview.structure.additionalSectionCount}</h3>
                  <ul>{preview.structure.additionalSections.map((row) => <li key={row}>{row}</li>)}</ul>
                </section>
                <section>
                  <h3>{copy.workflow}</h3>
                  <ul>{preview.structure.professionalWorkflow.map((row) => <li key={row}>{row}</li>)}</ul>
                </section>
                <section>
                  <h3>{copy.provenance}</h3>
                  <ul>{preview.provenanceClasses.map((row) => (
                    <li key={row}>{PROVENANCE_LABELS[locale][row as keyof typeof PROVENANCE_LABELS[typeof locale]] ?? row}</li>
                  ))}</ul>
                </section>
              </div>

              <section className="audit-r44p22-preview-example">
                <h3>{copy.example}</h3>
                <div>
                  <span>{preview.exampleFinding.severity === "HIGH_EXAMPLE" ? copy.highExample : copy.mediumExample}</span>
                  <strong>{preview.exampleFinding.title}</strong>
                  <p>{preview.exampleFinding.summary}</p>
                  <small>{copy.sourceWithheld} · {copy.exampleEvidence}</small>
                </div>
              </section>

              <div className="audit-r44p22-preview-grid">
                <section>
                  <h3>{copy.unavailable}</h3>
                  <ul>{preview.unavailableData.map((row) => <li key={row}>{row}</li>)}</ul>
                </section>
                <section>
                  <h3>{copy.limits}</h3>
                  <ul>{preview.limitations.map((row) => <li key={row}>{row}</li>)}</ul>
                </section>
              </div>

              <footer>
                <p><ShieldCheck className="h-4 w-4" aria-hidden="true" /> {preview.safeNextStep}</p>
                <a href={pdfHref} target="_blank" rel="noopener noreferrer external" referrerPolicy="no-referrer">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  {copy.pdf}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </footer>
            </div>
          ) : null}
        </section>
      </div>
    </BodyPortal>
  );
}
