"use client";

import { useMemo, useState, type ComponentType, type CSSProperties, type KeyboardEvent } from "react";
import {
  Activity,
  ArrowDownWideNarrow,
  ArrowRight,
  CircleGauge,
  Clock3,
  Database,
  FileQuestion,
  GitBranch,
  MessageSquareQuote,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  TrendingUp,
  UserRoundCheck,
} from "lucide-react";
import type {
  AngelEvidenceCopy,
  AngelEvidenceQuestion,
  AngelEvidenceQuestionId,
} from "@/lib/intelligence/angel-evidence-content";
import styles from "./AngelEvidenceChapter.module.css";

const questionIcons: Record<AngelEvidenceQuestionId, ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  "confidence-cap": CircleGauge,
  "lane-moved": GitBranch,
  "missing-evidence": FileQuestion,
  downgrade: ArrowDownWideNarrow,
  "increase-confidence": TrendingUp,
  "human-review": UserRoundCheck,
};

function EvidenceTrace({ copy, active }: { copy: AngelEvidenceCopy; active: AngelEvidenceQuestion }) {
  const steps = [
    { label: copy.layerLabels.conclusion, icon: MessageSquareQuote },
    { label: copy.layerLabels.evidence, icon: Database },
    { label: copy.layerLabels.limitations, icon: TriangleAlert },
    { label: copy.layerLabels.freshness, icon: Clock3 },
    { label: copy.layerLabels.nextCheck, icon: ScanSearch },
  ];

  return (
    <div className={styles.trace} aria-label={copy.traceLabel}>
      <div className={styles.traceHeader}>
        <span>{copy.traceLabel}</span>
        <b>{active.status}</b>
      </div>
      <ol>
        {steps.map(({ label, icon: Icon }, index) => (
          <li key={label} style={{ "--trace-index": index } as CSSProperties}>
            <span><Icon size={15} aria-hidden /></span>
            <b>{label}</b>
            {index < steps.length - 1 ? <i aria-hidden><em /></i> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function AnswerPanel({ copy, active }: { copy: AngelEvidenceCopy; active: AngelEvidenceQuestion }) {
  const ActiveIcon = questionIcons[active.id];

  return (
    <article
      key={active.id}
      id={`angel-panel-${active.id}`}
      className={styles.answer}
      role="tabpanel"
      aria-labelledby={`angel-tab-${active.id}`}
      tabIndex={0}
    >
      <header className={styles.answerHeader}>
        <div className={styles.answerIdentity}>
          <span><Sparkles size={15} aria-hidden />{copy.answerLabel}</span>
          <h3>{active.question}</h3>
        </div>
        <div className={styles.answerStatus}>
          <ActiveIcon size={17} aria-hidden />
          <span>{active.status}</span>
        </div>
      </header>

      <div className={styles.answerGrid}>
        <section className={styles.conclusionCard}>
          <span><MessageSquareQuote size={15} aria-hidden />01 · {copy.layerLabels.conclusion}</span>
          <p>{active.conclusion}</p>
          <i aria-hidden />
        </section>

        <section className={styles.evidenceCard}>
          <span><Database size={15} aria-hidden />02 · {copy.layerLabels.evidence}</span>
          <ul>
            {active.evidence.map((item, index) => (
              <li key={item} style={{ "--evidence-index": index } as CSSProperties}>
                <b>0{index + 1}</b>
                <p>{item}</p>
                <ShieldCheck size={14} aria-hidden />
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.boundaryGrid}>
          <section>
            <span><TriangleAlert size={14} aria-hidden />03 · {copy.layerLabels.limitations}</span>
            <p>{active.limitations}</p>
          </section>
          <section>
            <span><Clock3 size={14} aria-hidden />04 · {copy.layerLabels.freshness}</span>
            <p>{active.freshness}</p>
          </section>
          <section className={styles.nextCheck}>
            <span><ScanSearch size={14} aria-hidden />05 · {copy.layerLabels.nextCheck}</span>
            <p>{active.nextCheck}</p>
            <ArrowRight size={17} aria-hidden />
          </section>
        </div>
      </div>

      <EvidenceTrace copy={copy} active={active} />
    </article>
  );
}

export function AngelEvidenceChapter({ copy, sectionId = "angel-evidence" }: { copy: AngelEvidenceCopy; sectionId?: string }) {
  const [activeId, setActiveId] = useState<AngelEvidenceQuestionId>(copy.questions[0]?.id ?? "confidence-cap");
  const active = useMemo(
    () => copy.questions.find((question) => question.id === activeId) ?? copy.questions[0],
    [activeId, copy.questions],
  );

  const moveSelection = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = (index + 1) % copy.questions.length;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = (index - 1 + copy.questions.length) % copy.questions.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = copy.questions.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const next = copy.questions[nextIndex];
    setActiveId(next.id);
    window.requestAnimationFrame(() => document.getElementById(`angel-tab-${next.id}`)?.focus());
  };

  if (!active) return null;
  const titleId = `${sectionId}-title`;

  return (
    <section id={sectionId} className={styles.section} aria-labelledby={titleId}>
      <div className={styles.sectionHeader}>
        <span className={styles.eyebrow}>{copy.eyebrow}</span>
        <h2 id={titleId}>{copy.title}</h2>
        <p>{copy.intro}</p>
      </div>

      <div className={styles.experience}>
        <aside className={styles.questionRail}>
          <div className={styles.railHeader}>
            <span>{copy.selectorLabel}</span>
            <b>06</b>
          </div>
          <div className={styles.questionTabs} role="tablist" aria-label={copy.selectorLabel} aria-orientation="vertical">
            {copy.questions.map((question, index) => {
              const Icon = questionIcons[question.id];
              const isActive = question.id === active.id;
              return (
                <button
                  key={question.id}
                  id={`angel-tab-${question.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`angel-panel-${question.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveId(question.id)}
                  onKeyDown={(event) => moveSelection(event, index)}
                >
                  <small>0{index + 1}</small>
                  <span><Icon size={17} aria-hidden /></span>
                  <div><b>{question.shortLabel}</b><p>{question.question}</p></div>
                  <ArrowRight size={15} aria-hidden />
                </button>
              );
            })}
          </div>
          <div className={styles.railSignal} aria-hidden>
            <Activity size={18} />
            <i /><i /><i /><i /><i />
          </div>
        </aside>

        <div className={styles.answerSurface}>
          <div className={styles.liveQuestion} aria-live="polite">
            <span><i />{copy.liveLabel}</span>
            <b>{active.question}</b>
          </div>
          <AnswerPanel copy={copy} active={active} />
        </div>
      </div>
    </section>
  );
}
