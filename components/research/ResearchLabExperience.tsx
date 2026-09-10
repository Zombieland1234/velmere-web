"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Check, ChevronDown, FlaskConical, ScanLine, ShieldCheck, Sigma } from "lucide-react";
import VelmereProprietaryResearchSection from "./VelmereProprietaryResearchSection";
import styles from "./ResearchLabExperience.module.css";

export type ResearchLabCopy = {
  kicker: string;
  title: string;
  subtitle: string;
  badge: string;
  cards: readonly { label: string; title: string; body: string }[];
  method: string;
  steps: readonly (readonly [string, string, string])[];
  boundaryTitle: string;
  boundary: string;
  benchmarkTitle: string;
  benchmarkIntro: string;
  metrics: readonly (readonly [string, string, string])[];
  inverseTitle: string;
  inverseBody: string;
  inverseTests: readonly string[];
  caveat: string;
};

export type ResearchValidationCopy = {
  kicker: string;
  title: string;
  body: string;
  rows: readonly (readonly [string, string])[];
};

const interfaceCopy = {
  pl: {
    protocol: "protokół publiczny / v3.1",
    status: "model kontrolowany",
    scope: "mierzalne wyniki · jawne ograniczenia",
    sequence: "aktywna sekwencja walidacji",
    terminal: "dziennik metody",
    evidence: "warstwa dowodowa",
    benchmark: "zamrożony benchmark",
    expand: "Otwórz pełny tor testowy",
    progress: "postęp dokumentu",
    independent: "niezależna replikacja wymagana",
  },
  de: {
    protocol: "öffentliches protokoll / v3.1",
    status: "kontrolliertes modell",
    scope: "messbare ergebnisse · klare grenzen",
    sequence: "aktive validierungssequenz",
    terminal: "methodenprotokoll",
    evidence: "evidenzschicht",
    benchmark: "eingefrorener benchmark",
    expand: "Vollständigen Testpfad öffnen",
    progress: "dokumentfortschritt",
    independent: "unabhängige replikation erforderlich",
  },
  en: {
    protocol: "public protocol / v3.1",
    status: "controlled model",
    scope: "measurable results · explicit limits",
    sequence: "active validation sequence",
    terminal: "method ledger",
    evidence: "evidence layer",
    benchmark: "frozen benchmark",
    expand: "Open the complete test lane",
    progress: "document progress",
    independent: "independent replication required",
  },
} as const;

function useTypewriter(value: string, reducedMotion: boolean | null) {
  const [rendered, setRendered] = useState("");

  useEffect(() => {
    if (reducedMotion) return undefined;

    let index = 0;
    let timer: number | undefined;
    const reset = window.setTimeout(() => {
      setRendered("");
      timer = window.setInterval(() => {
        index += 1;
        setRendered(value.slice(0, index));
        if (index >= value.length && timer) window.clearInterval(timer);
      }, 18);
    }, 0);

    return () => {
      window.clearTimeout(reset);
      if (timer) window.clearInterval(timer);
    };
  }, [reducedMotion, value]);

  return reducedMotion ? value : rendered;
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: .72, ease: [.22, 1, .36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function ResearchLabExperience({
  locale,
  copy,
  validation,
}: {
  locale: "pl" | "de" | "en";
  copy: ResearchLabCopy;
  validation: ResearchValidationCopy;
}) {
  const ui = interfaceCopy[locale];
  const pageRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  const { scrollYProgress } = useScroll({ target: pageRef, offset: ["start start", "end end"] });
  const orbitRotate = useTransform(scrollYProgress, [0, .34], [0, reducedMotion ? 0 : 8]);
  const currentStep = copy.steps[activeStep] ?? copy.steps[0];
  const typedStep = useTypewriter(
    currentStep ? `${currentStep[0]} / ${currentStep[1]} — ${currentStep[2]}` : "",
    reducedMotion,
  );

  return (
    <main
      ref={pageRef}
      className={styles.page}
      data-research-lab-redesign="editorial-scroll-ledger"
      data-pass682-research-editorial-surface="true"
      data-pass2007-research="solid-evidence-cyan-no-card-stack"
    >
      <motion.div className={styles.scrollProgress} style={{ scaleX: scrollYProgress }} aria-hidden="true" />
      <div className={styles.ambient} aria-hidden="true" />

      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrowRow}>
              <span>{ui.protocol}</span>
              <i aria-hidden="true" />
              <span>{ui.status}</span>
            </div>
            <p className={styles.kicker}>{copy.kicker}</p>
            <h1>
              <span>Velmère</span>
              <em>Research Lab</em>
            </h1>
            <p className={styles.subtitle}>{copy.subtitle}</p>
            <div className={styles.heroMeta}>
              <span><ShieldCheck aria-hidden="true" />{copy.badge}</span>
              <span><ScanLine aria-hidden="true" />{ui.scope}</span>
            </div>
          </div>

          <motion.aside
            className={styles.instrument}
            style={{ rotate: orbitRotate }}
            aria-label={locale === "pl" ? "Diagram reszty funkcji liczącej liczby pierwsze" : locale === "de" ? "Diagramm des Restfehlers der Primzahlzählfunktion" : "Prime residual research diagram"}
          >
            <div className={styles.instrumentTopbar}>
              <span><i aria-hidden="true" /> B. Protocol</span>
              <span>π(x) − R(x)</span>
            </div>
            <div className={styles.orbitStage}>
              <svg
                viewBox="0 0 520 420"
                role="img"
                aria-label={locale === "pl" ? "Kontrolowany model reszty" : locale === "de" ? "Kontrolliertes Restfehlermodell" : "Controlled residual model"}
              >
                <defs>
                  <linearGradient id="research-gold-line" x1="0" x2="1">
                    <stop offset="0" stopColor="#806d48" stopOpacity="0" />
                    <stop offset=".42" stopColor="#d3ba83" />
                    <stop offset="1" stopColor="#8ccbc2" stopOpacity=".2" />
                  </linearGradient>
                  <radialGradient id="research-core" cx="38%" cy="30%">
                    <stop offset="0" stopColor="#d9c69e" stopOpacity=".22" />
                    <stop offset="1" stopColor="#080b0c" stopOpacity=".96" />
                  </radialGradient>
                </defs>
                <g className={styles.orbitGrid}>
                  <path d="M28 70H492M28 140H492M28 210H492M28 280H492M28 350H492" />
                  <path d="M86 30V390M172 30V390M258 30V390M344 30V390M430 30V390" />
                </g>
                <circle cx="260" cy="210" r="132" className={styles.orbitOuter} />
                <circle cx="260" cy="210" r="86" className={styles.orbitInner} />
                <motion.path
                  d="M36 278C86 75 137 330 188 154c49-167 102 121 151-22 43-125 92 54 145-64"
                  fill="none"
                  stroke="url(#research-gold-line)"
                  strokeWidth="2.2"
                  initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 2.1, delay: .25, ease: [.22, 1, .36, 1] }}
                />
                <motion.path
                  d="M36 298C105 252 151 274 206 228c64-53 118-19 166-70 35-37 72-49 112-61"
                  fill="none"
                  stroke="#91d4ca"
                  strokeOpacity=".46"
                  strokeWidth="1.45"
                  initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.9, delay: .6, ease: [.22, 1, .36, 1] }}
                />
                <circle cx="260" cy="210" r="58" fill="url(#research-core)" className={styles.coreCircle} />
                <text x="260" y="202" textAnchor="middle" className={styles.coreTitle}>B.</text>
                <text x="260" y="229" textAnchor="middle" className={styles.coreLabel}>
                  {locale === "pl" ? "KONTROLOWANA RESZTA" : locale === "de" ? "KONTROLLIERTER RESTFEHLER" : "CONTROLLED RESIDUAL"}
                </text>
              </svg>
            </div>
            <div className={styles.instrumentFooter}>
              <span>{ui.evidence}</span>
              <span><i aria-hidden="true" />{ui.independent}</span>
            </div>
          </motion.aside>
        </header>

        <section className={styles.principles} aria-label={locale === "pl" ? "Zasady badawcze" : locale === "de" ? "Forschungsgrundsätze" : "Research principles"}>
          {copy.cards.map((card, index) => (
            <Reveal key={card.label} className={styles.principleReveal}>
              <article className={styles.principle}>
                <span>0{index + 1}</span>
                <p>{card.label}</p>
                <h2>{card.title}</h2>
                <div>{card.body}</div>
              </article>
            </Reveal>
          ))}
        </section>

        <Reveal>
          <VelmereProprietaryResearchSection locale={locale} />
        </Reveal>

        <Reveal>
          <section className={styles.validation} aria-labelledby="research-validation-title">
            <div className={styles.sectionIndex}>01</div>
            <div className={styles.validationIntro}>
              <p>{validation.kicker}</p>
              <h2 id="research-validation-title">{validation.title}</h2>
              <div>{validation.body}</div>
            </div>
            <div className={styles.validationRows}>
              {validation.rows.map(([label, body], index) => (
                <article key={label}>
                  <span>0{index + 1}</span>
                  <strong>{label}</strong>
                  <p>{body}</p>
                  <Check aria-hidden="true" />
                </article>
              ))}
            </div>
          </section>
        </Reveal>

        <section className={styles.method} aria-labelledby="research-method-title">
          <div className={styles.methodSticky}>
            <div className={styles.sectionIndex}>02</div>
            <p className={styles.sectionKicker}>{ui.sequence}</p>
            <h2 id="research-method-title">{copy.method}</h2>
            <p className={styles.methodBoundary}>{copy.boundary}</p>
            <div className={styles.methodTerminal} aria-live="polite">
              <div><span>{ui.terminal}</span><span>{String(activeStep + 1).padStart(2, "0")}/04</span></div>
              <p><b aria-hidden="true">›</b>{typedStep}<i aria-hidden="true" /></p>
            </div>
          </div>

          <div className={styles.methodSteps}>
            {copy.steps.map(([step, title, body], index) => (
              <motion.article
                key={step}
                className={index === activeStep ? styles.methodStepActive : ""}
                onViewportEnter={() => setActiveStep(index)}
                viewport={{ amount: .62 }}
                initial={reducedMotion ? false : { opacity: .32, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: .52, ease: [.22, 1, .36, 1] }}
              >
                <span>{step}</span>
                <div>
                  <p>{ui.protocol}</p>
                  <h3>{title}</h3>
                  <div>{body}</div>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <Reveal>
          <section className={styles.benchmark} aria-labelledby="research-benchmark-title">
            <div className={styles.benchmarkHeader}>
              <div>
                <div className={styles.sectionIndex}>03</div>
                <p className={styles.sectionKicker}>{ui.benchmark}</p>
                <h2 id="research-benchmark-title">{copy.benchmarkTitle}</h2>
              </div>
              <p>{copy.benchmarkIntro}</p>
            </div>
            <div className={styles.metricGrid}>
              {copy.metrics.map(([label, value, note], index) => (
                <article key={label} className={index === 1 ? styles.metricPrimary : ""}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <p>{note}</p>
                </article>
              ))}
            </div>
            <div className={styles.caveat}><ScanLine aria-hidden="true" /><p>{copy.caveat}</p></div>
          </section>
        </Reveal>

        <Reveal>
          <section className={styles.inverse}>
            <article>
              <Sigma aria-hidden="true" />
              <p className={styles.sectionKicker}>
                {locale === "pl" ? "B. Protocol / tor odwrotny" : locale === "de" ? "B. Protocol / inverser Prüfpfad" : "B. Protocol / inverse lane"}
              </p>
              <h2>{copy.inverseTitle}</h2>
              <div>{copy.inverseBody}</div>
            </article>
            <details>
              <summary>
                <span><FlaskConical aria-hidden="true" /></span>
                <strong>{ui.expand}</strong>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className={styles.inverseTests}>
                {copy.inverseTests.map((test, index) => (
                  <p key={test}><span>0{index + 1}</span>{test}</p>
                ))}
              </div>
            </details>
          </section>
        </Reveal>

        <Reveal>
          <footer className={styles.boundary}>
            <ShieldCheck aria-hidden="true" />
            <div>
              <p>{copy.boundaryTitle}</p>
              <h2>{copy.boundary}</h2>
            </div>
            <span>{ui.independent}</span>
          </footer>
        </Reveal>
      </div>
    </main>
  );
}
