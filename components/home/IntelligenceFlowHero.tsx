"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  FileCheck2,
  Layers,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type Locale = "pl" | "en" | "de";

type IntelligenceFlowHeroProps = {
  locale: string;
};

type FlowNode = {
  id: string;
  step: string;
  label: Record<Locale, string>;
  subtext: Record<Locale, string>;
  metric: Record<Locale, string>;
  metricLabel: Record<Locale, string>;
  icon: typeof Database;
};

const NODES: FlowNode[] = [
  {
    id: "data",
    step: "01",
    label: {
      en: "Data Ingestion",
      pl: "Pozyskanie Danych",
      de: "Datenerfassung",
    },
    subtext: {
      en: "Multi-chain RPCs, order books, mempool depth, and oracle feeds.",
      pl: "Wielosieciowe węzły RPC, arkusze zleceń, mempool i kwotowania wyroczni.",
      de: "Multi-Chain-RPCs, Orderbücher, Mempool-Tiefe und Oracle-Feeds.",
    },
    metric: {
      en: "12 Channels",
      pl: "12 Kanałów",
      de: "12 Kanäle",
    },
    metricLabel: {
      en: "Active Ingestion",
      pl: "Kanały Aktywne",
      de: "Aktive Kanäle",
    },
    icon: Database,
  },
  {
    id: "analysis",
    step: "02",
    label: {
      en: "Deep Analysis",
      pl: "Głęboka Analiza",
      de: "Tiefenanalyse",
    },
    subtext: {
      en: "Bytecode decompilation, proxy lineage, and invariant fuzzing.",
      pl: "Dekompilacja bajtkodu, ciągłość proxy i testy niezmienników.",
      de: "Bytecode-Dekompilierung, Proxy-Linie und Invarianten-Fuzzing.",
    },
    metric: {
      en: "100% Deterministic",
      pl: "100% Deterministyczna",
      de: "100% Deterministisch",
    },
    metricLabel: {
      en: "EVM Verification",
      pl: "Weryfikacja EVM",
      de: "EVM-Verifikation",
    },
    icon: Cpu,
  },
  {
    id: "evidence",
    step: "03",
    label: {
      en: "Cryptographic Evidence",
      pl: "Dowody Kryptograficzne",
      de: "Kryptografische Evidenz",
    },
    subtext: {
      en: "SHA-256 state snapshots, physically bound logs, and provenance trees.",
      pl: "Migawki stanu SHA-256, powiązane logi i drzewa pochodzenia.",
      de: "SHA-256-Zustands-Snapshots, gebundene Logs und Provenienz-Bäume.",
    },
    metric: {
      en: "Zero Guesswork",
      pl: "Zero Domysłów",
      de: "Null Vermutungen",
    },
    metricLabel: {
      en: "Provenance Proof",
      pl: "Dowód Pochodzenia",
      de: "Provenienz-Beweis",
    },
    icon: FileCheck2,
  },
  {
    id: "risk",
    step: "04",
    label: {
      en: "Calibrated Risk",
      pl: "Skalibrowane Ryzyko",
      de: "Kalibriertes Risiko",
    },
    subtext: {
      en: "Multi-dimensional CVSS v3.1 weighting, confidence bounds, and penalties.",
      pl: "Wielowymiarowe wagi CVSS v3.1, przedziały ufności i kary za braki.",
      de: "Mehrdimensionale CVSS v3.1-Gewichtung und Konfidenzgrenzen.",
    },
    metric: {
      en: "0 – 100 Composite",
      pl: "Kompozyt 0 – 100",
      de: "0 – 100 Zusammengesetzt",
    },
    metricLabel: {
      en: "Continuous Metric",
      pl: "Ciągła Metryka",
      de: "Kontinuierliche Metrik",
    },
    icon: Activity,
  },
  {
    id: "decision",
    step: "05",
    label: {
      en: "Defensive Decision",
      pl: "Decyzja Obronna",
      de: "Defensive Entscheidung",
    },
    subtext: {
      en: "Automated allocation gates, executive consent, and autonomous capital defense.",
      pl: "Bramki ochrony kapitału, zgoda wykonawcza i natychmiastowa reakcja.",
      de: "Automatisierte Allokations-Gates und autonome Kapitalverteidigung.",
    },
    metric: {
      en: "Executive Consent",
      pl: "Zgoda Wykonawcza",
      de: "Exekutive Zustimmung",
    },
    metricLabel: {
      en: "Actionable Policy",
      pl: "Polityka Wykonawcza",
      de: "Handlungsrichtlinie",
    },
    icon: ShieldCheck,
  },
];

export default function IntelligenceFlowHero({ locale }: IntelligenceFlowHeroProps) {
  const safeLocale: Locale = locale === "pl" || locale === "de" ? locale : "en";
  const [activeStep, setActiveStep] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % NODES.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <div
      className="relative mx-auto my-12 w-full max-w-6xl rounded-2xl border border-white/10 bg-[#09090c]/80 p-6 backdrop-blur-xl md:p-8"
      aria-label="Intelligence Evidence Flow Architecture"
    >
      {/* Header telemetry ribbon */}
      <div className="mb-8 flex flex-col gap-3 border-b border-white/5 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-semibold tracking-widest text-white/50 uppercase">
            VELMÈRE CORE PIPELINE · DUAL-LAYER VERIFICATION
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>{safeLocale === "pl" ? "Cykl przepływu dowodów" : safeLocale === "de" ? "Evidenzfluss-Zyklus" : "Evidence Flow Pipeline"}</span>
          <span className="font-mono text-velmere-gold">v2.4-PROD</span>
        </div>
      </div>

      {/* Sequential Flow Nodes Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {NODES.map((node, index) => {
          const Icon = node.icon;
          const isActive = activeStep === index;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setActiveStep(index)}
              className={`group relative overflow-hidden flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-velmere-gold/40 ${
                isActive
                  ? "border-velmere-gold/50 bg-white/[0.05] shadow-[0_0_25px_rgba(200,169,106,0.16)] scale-[1.01]"
                  : "border-white/5 bg-white/[0.015] hover:border-velmere-gold/30 hover:bg-white/[0.035] hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(200,169,106,0.08)]"
              }`}
            >
              {/* Step indicator and Icon */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`font-mono text-xs font-semibold ${
                      isActive ? "text-velmere-gold" : "text-white/30"
                    }`}
                  >
                    {node.step}
                  </span>
                  <div
                    className={`rounded-lg p-2 transition-colors ${
                      isActive
                        ? "bg-velmere-gold/15 text-velmere-gold"
                        : "bg-white/5 text-white/40 group-hover:text-white/70"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                </div>

                {/* Node Title */}
                <h3 className="text-sm font-medium tracking-tight text-white md:text-base">
                  {node.label[safeLocale]}
                </h3>

                {/* Node Description */}
                <p className="mt-2 text-xs leading-relaxed text-white/50">
                  {node.subtext[safeLocale]}
                </p>
              </div>

              {/* Bottom Telemetry Tag */}
              <div className="mt-4 border-t border-white/5 pt-3">
                <span className="text-[10px] tracking-wider text-white/30 uppercase">
                  {node.metricLabel[safeLocale]}
                </span>
                <p className="font-mono text-xs font-semibold text-white/80">
                  {node.metric[safeLocale]}
                </p>
              </div>

              {/* Progress Bar under active node */}
              {isActive && !prefersReducedMotion && (
                <div
                  className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-velmere-gold/20 via-velmere-gold to-velmere-gold/20"
                  style={{ borderRadius: "1px" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Flow Summary Footer */}
      <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.01] p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-velmere-gold/10 text-velmere-gold">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-medium text-white/90">
              {safeLocale === "pl"
                ? "Brak domysłów · Czysta weryfikowalność"
                : safeLocale === "de"
                  ? "Keine Vermutungen · Reine Verifizierbarkeit"
                  : "Zero Conjecture · Absolute Verifiability"}
            </h4>
            <p className="text-[11px] text-white/40">
              {safeLocale === "pl"
                ? "Każda metryka ryzyka i wniosek audytowy są bezpośrednio powiązane z kryptograficznym śladem źródłowym."
                : safeLocale === "de"
                  ? "Jede Risikometrik ist direkt an kryptografisch signierte Quelldaten gebunden."
                  : "Every risk score and audit finding is cryptographically bound to raw verifiable origin data."}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 self-end text-xs font-medium text-velmere-gold sm:self-center">
          <span>{safeLocale === "pl" ? "Standard metodologiczny" : safeLocale === "de" ? "Methodenstandard" : "Methodology Standard"}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}
