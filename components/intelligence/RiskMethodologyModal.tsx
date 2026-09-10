"use client";

import { useCallback, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Fingerprint,
  Gauge,
  LockKeyhole,
  ScanSearch,
  ShieldCheck,
  X,
} from "lucide-react";
import type { IntelligenceLocale } from "@/lib/intelligence/intelligence-content";
import BodyPortal from "@/components/ui/BodyPortal";
import { useDialogFocusBoundary } from "@/components/ui/useDialogFocusBoundary";
import { useModalScrollLock } from "@/components/ui/useModalScrollLock";
import styles from "./IntelligenceLuxury.module.css";

type MethodologyCopy = {
  open: string;
  close: string;
  eyebrow: string;
  status: string;
  title: string;
  summary: string;
  processLabel: string;
  steps: Array<{ title: string; body: string }>;
  modelLabel: string;
  model: Array<{ label: string; formula: string; note: string }>;
  visibleLabel: string;
  visible: string[];
  privateLabel: string;
  private: string[];
  boundary: string;
};

const METHODOLOGY_COPY: Record<IntelligenceLocale, MethodologyCopy> = {
  pl: {
    open: "Poznaj metodologię ryzyka",
    close: "Zamknij metodologię ryzyka",
    eyebrow: "Metodologia publiczna / VLM Intelligence",
    status: "Evidence first",
    title: "Jak powstaje wynik ryzyka",
    summary:
      "Nie sumujemy nagłówków. Najpierw oddzielamy dowód od sygnału, potem oceniamy jego znaczenie w konkretnym kontekście. Ryzyko, pewność i niepewność pozostają trzema osobnymi warstwami.",
    processLabel: "Proces decyzyjny",
    steps: [
      {
        title: "Zbieramy dowody",
        body: "Łączymy dane rynkowe, publiczne rejestry, tożsamość podmiotu i stan źródeł wraz ze znacznikami czasu.",
      },
      {
        title: "Normalizujemy sygnały",
        body: "Usuwamy duplikaty, rozdzielamy fakty od interpretacji i zachowujemy sprzeczności zamiast je wygładzać.",
      },
      {
        title: "Ważymy kontekst",
        body: "Oceniamy znaczenie, skalę, świeżość i trwałość sygnału. Dokładne wagi oraz progi pozostają prywatne.",
      },
      {
        title: "Oddzielamy pewność",
        body: "Pokrycie, świeżość i zgodność źródeł określają pewność. Braki danych podnoszą niepewność — nigdy bezpieczeństwo.",
      },
    ],
    modelLabel: "Publiczny model pojęciowy",
    model: [
      {
        label: "Ryzyko",
        formula: "potwierdzony sygnał × znaczenie kontekstowe",
        note: "Co może się wydarzyć i jak duży może być wpływ.",
      },
      {
        label: "Pewność",
        formula: "pokrycie × świeżość × zgodność źródeł",
        note: "Jak mocno dowody wspierają wniosek.",
      },
      {
        label: "Niepewność",
        formula: "braki + konflikty + ograniczenia",
        note: "Czego nadal nie wiemy i co wymaga weryfikacji.",
      },
    ],
    visibleLabel: "Co pokazujemy",
    visible: [
      "główne czynniki wyniku i ich kierunek",
      "pewność, świeżość oraz stan źródeł",
      "brakujące dowody i granice analizy",
      "moment obliczenia i zakres decyzji",
    ],
    privateLabel: "Co chronimy",
    private: [
      "dokładne współczynniki i progi eskalacji",
      "reguły odporności na manipulację",
      "prywatne kontrakty źródłowe i dostawców",
      "wewnętrzne prompty oraz logikę orkiestracji",
    ],
    boundary:
      "Wynik wspiera decyzję, ale nie jest werdyktem ani prawdopodobieństwem ceny. Sygnały o niskiej pewności są wstrzymywane albo oznaczane jako wymagające manualnego sprawdzenia; Velmère nie obiecuje w tym miejscu review człowieka.",
  },
  en: {
    open: "Explore risk methodology",
    close: "Close risk methodology",
    eyebrow: "Public methodology / VLM Intelligence",
    status: "Evidence first",
    title: "How the risk score is formed",
    summary:
      "We do not add up headlines. Evidence is separated from signal first, then its relevance is assessed in context. Risk, confidence and uncertainty remain three distinct layers.",
    processLabel: "Decision process",
    steps: [
      {
        title: "Collect evidence",
        body: "We combine market data, public records, entity identity and source health with explicit timestamps.",
      },
      {
        title: "Normalize signals",
        body: "Duplicates are removed, facts are separated from interpretation and contradictions remain visible.",
      },
      {
        title: "Weight the context",
        body: "We assess relevance, scale, freshness and persistence. Exact weights and thresholds stay private.",
      },
      {
        title: "Separate confidence",
        body: "Coverage, freshness and source agreement determine confidence. Missing data raises uncertainty — never safety.",
      },
    ],
    modelLabel: "Public conceptual model",
    model: [
      {
        label: "Risk",
        formula: "confirmed signal × contextual relevance",
        note: "What may happen and how material the impact may be.",
      },
      {
        label: "Confidence",
        formula: "coverage × freshness × source agreement",
        note: "How strongly the available evidence supports the conclusion.",
      },
      {
        label: "Uncertainty",
        formula: "gaps + conflicts + limitations",
        note: "What remains unknown and needs verification.",
      },
    ],
    visibleLabel: "What we disclose",
    visible: [
      "the main score drivers and their direction",
      "confidence, freshness and source status",
      "missing evidence and analysis boundaries",
      "calculation time and decision scope",
    ],
    privateLabel: "What we protect",
    private: [
      "exact coefficients and escalation thresholds",
      "anti-manipulation and anti-gaming rules",
      "private source and provider contracts",
      "internal prompts and orchestration logic",
    ],
    boundary:
      "The indicator supports a decision; it is not a verdict or a price probability. Low-confidence signals are withheld or marked for a manual-review workflow; this surface does not promise that a human review is included.",
  },
  de: {
    open: "Risikomethodik ansehen",
    close: "Risikomethodik schließen",
    eyebrow: "Öffentliche Methodik / VLM Intelligence",
    status: "Evidence first",
    title: "Wie der Risikowert entsteht",
    summary:
      "Wir addieren keine Schlagzeilen. Zuerst trennen wir Beleg und Signal, danach bewerten wir die Relevanz im jeweiligen Kontext. Risiko, Konfidenz und Unsicherheit bleiben drei getrennte Ebenen.",
    processLabel: "Entscheidungsprozess",
    steps: [
      {
        title: "Belege erfassen",
        body: "Wir verbinden Marktdaten, öffentliche Register, Entitätsidentität und Quellenstatus mit klaren Zeitstempeln.",
      },
      {
        title: "Signale normalisieren",
        body: "Duplikate werden entfernt, Fakten von Interpretation getrennt und Widersprüche sichtbar gehalten.",
      },
      {
        title: "Kontext gewichten",
        body: "Wir bewerten Relevanz, Umfang, Aktualität und Beständigkeit. Exakte Gewichte und Schwellen bleiben privat.",
      },
      {
        title: "Konfidenz trennen",
        body: "Abdeckung, Aktualität und Quellenkonsens bestimmen die Konfidenz. Datenlücken erhöhen Unsicherheit — nie Sicherheit.",
      },
    ],
    modelLabel: "Öffentliches Begriffsmodell",
    model: [
      {
        label: "Risiko",
        formula: "bestätigtes Signal × kontextuelle Relevanz",
        note: "Was eintreten kann und wie wesentlich die Auswirkung wäre.",
      },
      {
        label: "Konfidenz",
        formula: "Abdeckung × Aktualität × Quellenkonsens",
        note: "Wie stark die verfügbaren Belege die Schlussfolgerung stützen.",
      },
      {
        label: "Unsicherheit",
        formula: "Lücken + Konflikte + Grenzen",
        note: "Was unbekannt bleibt und verifiziert werden muss.",
      },
    ],
    visibleLabel: "Was wir zeigen",
    visible: [
      "Haupttreiber des Werts und ihre Richtung",
      "Konfidenz, Aktualität und Quellenstatus",
      "fehlende Belege und Analysegrenzen",
      "Berechnungszeit und Entscheidungsumfang",
    ],
    privateLabel: "Was wir schützen",
    private: [
      "exakte Koeffizienten und Eskalationsschwellen",
      "Regeln gegen Manipulation und Gaming",
      "private Quellen- und Anbietervereinbarungen",
      "interne Prompts und Orchestrierungslogik",
    ],
    boundary:
      "Der Indikator unterstützt eine Entscheidung; er ist weder Urteil noch Preiswahrscheinlichkeit. Signale mit niedriger Konfidenz werden zurückgehalten oder als manuell zu prüfen markiert; eine enthaltene menschliche Prüfung wird hier nicht versprochen.",
  },
};

const STEP_ICONS = [ScanSearch, Fingerprint, Gauge, ShieldCheck] as const;

type RiskMethodologyModalProps = {
  locale: IntelligenceLocale;
  label?: string;
};

export default function RiskMethodologyModal({
  locale,
  label,
}: RiskMethodologyModalProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const copy = METHODOLOGY_COPY[locale];
  const close = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, []);

  useModalScrollLock(open);
  useDialogFocusBoundary(open, dialogRef, {
    onClose: close,
    initialFocus: closeRef,
    returnFocus: false,
    closeOnOutsidePointerDown: true,
  });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.secondaryButton} ${styles.methodologyTrigger}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="vlm-risk-methodology-dialog"
      >
        {label ?? copy.open}
        <ArrowRight size={15} aria-hidden="true" />
      </button>

      <BodyPortal>
        {open ? (
          <div className={`${styles.tierModalBackdrop} ${styles.methodologyBackdrop}`}>
            <section
              ref={dialogRef}
              id="vlm-risk-methodology-dialog"
              className={`${styles.tierModal} ${styles.methodologyModal}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="vlm-risk-methodology-title"
              aria-describedby="vlm-risk-methodology-summary"
              data-modal-scroll-region="true"
              tabIndex={-1}
            >
              <button
                ref={closeRef}
                className={styles.tierModalClose}
                type="button"
                onClick={close}
                aria-label={copy.close}
              >
                <X size={18} aria-hidden="true" />
              </button>

              <div className={styles.tierModalTopline}>
                <span>{copy.eyebrow}</span>
                <b>{copy.status}</b>
              </div>

              <header className={styles.methodologyHero}>
                <div className={styles.methodologyHeroMark} aria-hidden="true">
                  <LockKeyhole size={22} />
                </div>
                <div>
                  <small>VLM / 01—04</small>
                  <h3 id="vlm-risk-methodology-title">{copy.title}</h3>
                </div>
              </header>

              <p id="vlm-risk-methodology-summary" className={styles.methodologySummary}>
                {copy.summary}
              </p>

              <section className={styles.methodologySection} aria-labelledby="vlm-risk-process-title">
                <span id="vlm-risk-process-title">{copy.processLabel}</span>
                <ol className={styles.methodologySteps}>
                  {copy.steps.map((step, index) => {
                    const Icon = STEP_ICONS[index];
                    return (
                      <li key={step.title}>
                        <div aria-hidden="true"><Icon size={16} /></div>
                        <small>{String(index + 1).padStart(2, "0")}</small>
                        <h4>{step.title}</h4>
                        <p>{step.body}</p>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section className={styles.methodologySection} aria-labelledby="vlm-risk-model-title">
                <span id="vlm-risk-model-title">{copy.modelLabel}</span>
                <div className={styles.methodologyModel}>
                  {copy.model.map((item) => (
                    <article key={item.label}>
                      <small>{item.label}</small>
                      <strong>{item.formula}</strong>
                      <p>{item.note}</p>
                    </article>
                  ))}
                </div>
              </section>

              <div className={styles.methodologyBoundaryGrid}>
                <section>
                  <span><Check size={14} aria-hidden="true" />{copy.visibleLabel}</span>
                  <ul>
                    {copy.visible.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </section>
                <section data-private="true">
                  <span><LockKeyhole size={14} aria-hidden="true" />{copy.privateLabel}</span>
                  <ul>
                    {copy.private.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </section>
              </div>

              <footer className={styles.methodologyFooter}>
                <ShieldCheck size={17} aria-hidden="true" />
                <p>{copy.boundary}</p>
              </footer>
            </section>
          </div>
        ) : null}
      </BodyPortal>
    </>
  );
}
