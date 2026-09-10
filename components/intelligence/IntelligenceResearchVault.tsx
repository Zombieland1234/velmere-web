"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowDownRight, X } from "lucide-react";
import type { IntelligenceContent, IntelligenceLocale } from "@/lib/intelligence/intelligence-content";
import type { IntelligenceDepthCopy } from "@/lib/intelligence/intelligence-depth-content";
import type { IntelligenceFlagshipCopy } from "@/lib/intelligence/intelligence-flagship-content";
import type { AngelEvidenceCopy } from "@/lib/intelligence/angel-evidence-content";
import type { IntelligenceTier } from "./IntelligenceInteractive";
import styles from "./IntelligenceLuxury.module.css";

const loadFallback = () => <div className={styles.labLoading} role="status" aria-live="polite">LOADING RESEARCH MODULE</div>;

const EvidenceTransformation = dynamic(
  () => import("./IntelligenceInteractive").then((module) => module.EvidenceTransformation),
  { ssr: false, loading: loadFallback },
);
const TierComparison = dynamic(
  () => import("./IntelligenceInteractive").then((module) => module.TierComparison),
  { ssr: false, loading: loadFallback },
);
const BrainHub = dynamic(
  () => import("./IntelligenceDepthSections").then((module) => module.BrainHub),
  { ssr: false, loading: loadFallback },
);
const DetectionScenarioLab = dynamic(
  () => import("./IntelligenceDepthSections").then((module) => module.DetectionScenarioLab),
  { ssr: false, loading: loadFallback },
);
const OutputPathExperience = dynamic(
  () => import("./IntelligenceDepthSections").then((module) => module.OutputPathExperience),
  { ssr: false, loading: loadFallback },
);
const ReportJourney = dynamic(
  () => import("./IntelligenceDepthSections").then((module) => module.ReportJourney),
  { ssr: false, loading: loadFallback },
);
const LiquidityLabChapter = dynamic(
  () => import("./IntelligenceFlagshipSections").then((module) => module.LiquidityLabChapter),
  { ssr: false, loading: loadFallback },
);
const MarketImpactWhaleSection = dynamic(
  () => import("./IntelligenceFlagshipSections").then((module) => module.MarketImpactWhaleSection),
  { ssr: false, loading: loadFallback },
);
const SecurityAuditsChapter = dynamic(
  () => import("./IntelligenceFlagshipSections").then((module) => module.SecurityAuditsChapter),
  { ssr: false, loading: loadFallback },
);
const AngelEvidenceChapter = dynamic(
  () => import("./AngelEvidenceChapter").then((module) => module.AngelEvidenceChapter),
  { ssr: false, loading: loadFallback },
);

type LabId = "evidence" | "market" | "brain" | "depth";

type IntelligenceResearchVaultProps = {
  locale: IntelligenceLocale;
  copy: IntelligenceContent;
  depthCopy: IntelligenceDepthCopy;
  flagshipCopy: IntelligenceFlagshipCopy;
  angelCopy: AngelEvidenceCopy;
  marketTiers: IntelligenceTier[];
  auditTiers: IntelligenceTier[];
};

const vaultCopy: Record<IntelligenceLocale, {
  eyebrow: string;
  title: string;
  intro: string;
  open: string;
  close: string;
  modules: Array<{ id: LabId; index: string; title: string; note: string; anchor: string }>;
}> = {
  pl: {
    eyebrow: "RESEARCH VAULT / NA ŻĄDANIE",
    title: "Głębia wtedy, kiedy jej potrzebujesz.",
    intro: "Zaawansowane laboratoria nie obciążają strony w tle. Każdy moduł uruchamia się dopiero po otwarciu.",
    open: "Otwórz laboratorium",
    close: "Zamknij laboratorium",
    modules: [
      { id: "evidence", index: "01", title: "Droga dowodowa", note: "Silnik ryzyka · wynik · ograniczenia", anchor: "output-path" },
      { id: "market", index: "02", title: "Rynek i wykonanie", note: "Scenariusze · płynność · wpływ", anchor: "scenario-lab" },
      { id: "brain", index: "03", title: "VLM Brain i Angel", note: "Powierzchnie decyzji · evidence Q&A", anchor: "brain-lab" },
      { id: "depth", index: "04", title: "Głębia i audyt", note: "Poziomy · audyty · raport", anchor: "intelligence-depth" },
    ],
  },
  en: {
    eyebrow: "RESEARCH VAULT / ON DEMAND",
    title: "Depth when you need it.",
    intro: "Advanced laboratories do not run behind the page. Each module starts only when you open it.",
    open: "Open laboratory",
    close: "Close laboratory",
    modules: [
      { id: "evidence", index: "01", title: "Evidence path", note: "Risk engine · output · boundaries", anchor: "output-path" },
      { id: "market", index: "02", title: "Market and execution", note: "Scenarios · liquidity · impact", anchor: "scenario-lab" },
      { id: "brain", index: "03", title: "VLM Brain and Angel", note: "Decision surfaces · evidence Q&A", anchor: "brain-lab" },
      { id: "depth", index: "04", title: "Depth and audit", note: "Tiers · audits · report", anchor: "intelligence-depth" },
    ],
  },
  de: {
    eyebrow: "RESEARCH VAULT / AUF ABRUF",
    title: "Tiefe, wenn Sie sie brauchen.",
    intro: "Erweiterte Labore laufen nicht im Hintergrund. Jedes Modul startet erst nach dem Öffnen.",
    open: "Labor öffnen",
    close: "Labor schließen",
    modules: [
      { id: "evidence", index: "01", title: "Evidenzpfad", note: "Risk Engine · Ergebnis · Grenzen", anchor: "output-path" },
      { id: "market", index: "02", title: "Markt und Ausführung", note: "Szenarien · Liquidität · Impact", anchor: "scenario-lab" },
      { id: "brain", index: "03", title: "VLM Brain und Angel", note: "Entscheidungsflächen · Evidence Q&A", anchor: "brain-lab" },
      { id: "depth", index: "04", title: "Tiefe und Audit", note: "Tiers · Audits · Bericht", anchor: "intelligence-depth" },
    ],
  },
};

export function IntelligenceResearchVault({
  locale,
  copy,
  depthCopy,
  flagshipCopy,
  angelCopy,
  marketTiers,
  auditTiers,
}: IntelligenceResearchVaultProps) {
  const [activeLab, setActiveLab] = useState<LabId | null>(null);
  const labels = vaultCopy[locale];
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<LabId, HTMLButtonElement | null>>({ evidence: null, market: null, brain: null, depth: null });

  const closeActiveLab = useCallback(() => {
    if (!activeLab) return;
    const closingLab = activeLab;
    setActiveLab(null);
    window.requestAnimationFrame(() => triggerRefs.current[closingLab]?.focus({ preventScroll: true }));
  }, [activeLab]);

  useEffect(() => {
    if (!activeLab) return;
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [activeLab]);

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeActiveLab();
  };

  return (
    <section id="research-lab" className={styles.researchVault} aria-labelledby="research-vault-title">
      <header className={styles.vaultHeader}>
        <span>{labels.eyebrow}</span>
        <h2 id="research-vault-title">{labels.title}</h2>
        <p>{labels.intro}</p>
      </header>

      <div className={styles.vaultModules}>
        {labels.modules.map((module) => {
          const isActive = activeLab === module.id;
          return (
            <article key={module.id} id={`research-vault-card-${module.id}`} data-target-anchor={module.anchor} data-active={isActive ? "true" : "false"}>
              <button
                ref={(node) => { triggerRefs.current[module.id] = node; }}
                id={`research-vault-trigger-${module.id}`}
                type="button"
                onClick={() => {
                  if (isActive) closeActiveLab();
                  else setActiveLab(module.id);
                }}
                aria-expanded={isActive}
                aria-controls={`research-vault-panel-${module.id}`}
              >
                <small>{module.index}</small>
                <span><strong>{module.title}</strong><em>{module.note}</em></span>
                <b>{isActive ? labels.close : labels.open}</b>
                {isActive ? <X size={18} /> : <ArrowDownRight size={18} />}
              </button>
            </article>
          );
        })}
      </div>

      {activeLab && (
        <div
          ref={panelRef}
          id={`research-vault-panel-${activeLab}`}
          className={styles.labPanel}
          role="region"
          aria-labelledby={`research-vault-trigger-${activeLab}`}
          tabIndex={-1}
          onKeyDown={handlePanelKeyDown}
        >
          <div className={styles.labPanelTopline}>
            <span>VELMÈRE / ACTIVE RESEARCH MODULE</span>
            <button type="button" onClick={closeActiveLab} aria-label={labels.close}><X size={17} /></button>
          </div>

          {activeLab === "evidence" && (
            <div className={styles.labStack}>
              <EvidenceTransformation copy={copy} replayLabel={depthCopy.pipeline.replay} />
              <OutputPathExperience
                stages={copy.pipeline.stages}
                outcomes={depthCopy.pipeline.outcomes}
                replayLabel={depthCopy.pipeline.replay}
                nextLabel={depthCopy.pipeline.next}
                activeLabel={depthCopy.pipeline.activeStage}
              />
            </div>
          )}

          {activeLab === "market" && (
            <div className={styles.labStack}>
              <DetectionScenarioLab copy={depthCopy.scenarios} />
              <LiquidityLabChapter copy={flagshipCopy} sectionId="research-vault-liquidity-lab" />
              <div id="research-vault-impact-whale"><MarketImpactWhaleSection copy={flagshipCopy.impactWhale} instanceId="research-vault" /></div>
            </div>
          )}

          {activeLab === "brain" && (
            <div className={styles.labStack}>
              <BrainHub copy={depthCopy.brain} />
              <AngelEvidenceChapter copy={angelCopy} sectionId="research-vault-angel-evidence" />
            </div>
          )}

          {activeLab === "depth" && (
            <div className={styles.labStack}>
              <TierComparison copy={copy.tiers} locale={locale} marketTiers={marketTiers} />
              <SecurityAuditsChapter copy={flagshipCopy} auditTiers={auditTiers} />
              <ReportJourney copy={depthCopy.report} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
