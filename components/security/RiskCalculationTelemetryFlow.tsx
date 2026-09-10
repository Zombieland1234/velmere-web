"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Database,
  FileCheck2,
  Lock,
  Scale,
  Shield,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type Stage = {
  id: string;
  step: string;
  name: Record<"pl" | "en" | "de", string>;
  subtitle: Record<"pl" | "en" | "de", string>;
  metric: string;
  icon: typeof Database;
  color: string;
};

const STAGES: Stage[] = [
  {
    id: "data",
    step: "01",
    name: {
      pl: "Pozyskanie Danych",
      en: "Data Ingestion",
      de: "Datenerfassung",
    },
    subtitle: {
      pl: "EVM RPC + Orderbook L2 + Wyrocznie",
      en: "EVM RPC + L2 Orderbooks + Oracles",
      de: "EVM RPC + L2-Orderbücher + Orakel",
    },
    metric: "3 independent sources",
    icon: Database,
    color: "from-cyan-500/20 to-cyan-500/0 text-cyan-400 border-cyan-500/30",
  },
  {
    id: "analysis",
    step: "02",
    name: {
      pl: "Dekompozycja Wektorowa",
      en: "Vector Analysis",
      de: "Vektoranalyse",
    },
    subtitle: {
      pl: "AST Formal + SWC + Płynność Amihuda",
      en: "AST Formal + SWC + Amihud Liquidity",
      de: "AST Formal + SWC + Amihud-Liquidität",
    },
    metric: "5 orthogonal vectors",
    icon: Activity,
    color: "from-amber-500/20 to-amber-500/0 text-amber-400 border-amber-500/30",
  },
  {
    id: "evidence",
    step: "03",
    name: {
      pl: "Weryfikacja Dowodowa",
      en: "Cryptographic Evidence",
      de: "Kryptografische Evidenz",
    },
    subtitle: {
      pl: "Skróty SHA-256 + Kworum Węzłów",
      en: "SHA-256 State Digests + Quorum",
      de: "SHA-256-State-Digests + Quorum",
    },
    metric: "100% anchored proofs",
    icon: FileCheck2,
    color: "from-emerald-500/20 to-emerald-500/0 text-emerald-400 border-emerald-500/30",
  },
  {
    id: "risk",
    step: "04",
    name: {
      pl: "Kalkulacja Wyniku Ryzyka",
      en: "Risk Score Formulation",
      de: "Risikoberechnung",
    },
    subtitle: {
      pl: "Kombinacja Wypukła + Wagi CVSS v3.1",
      en: "Convex Combination + CVSS v3.1",
      de: "Konvexe Kombination + CVSS v3.1",
    },
    metric: "Bounded R ∈ [0, 100]",
    icon: Scale,
    color: "from-velmere-gold/20 to-velmere-gold/0 text-velmere-gold border-velmere-gold/30",
  },
  {
    id: "decision",
    step: "05",
    name: {
      pl: "Decyzja Kapitałowa",
      en: "Capital Decision",
      de: "Kapitalentscheidung",
    },
    subtitle: {
      pl: "Pewność Inwestycyjna + Reguły Inwalidacji",
      en: "Allocation Bounds + Invalidation Rules",
      de: "Allokationsgrenzen + Ungültigkeitsregeln",
    },
    metric: "Institutional Grade",
    icon: ShieldCheck,
    color: "from-emerald-400/20 to-emerald-400/0 text-emerald-300 border-emerald-400/30",
  },
];

export default function RiskCalculationTelemetryFlow({
  locale = "en",
}: {
  locale?: "pl" | "en" | "de";
}) {
  const [activeStep, setActiveStep] = useState(0);

  // Sequential progression timer (respects prefers-reduced-motion)
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setActiveStep(3); // Static view of core calculation
      return;
    }

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STAGES.length);
    }, 2400);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#07090c] p-5 sm:p-6 shadow-xl relative overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <span className="font-mono text-[9px] uppercase tracking-widest text-velmere-gold">
            TELEMETRY INVARIANT PIPELINE
          </span>
          <h4 className="mt-1 font-serif text-lg text-white font-light">
            Continuous Assurance Architecture
          </h4>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] text-white/40">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>AUTONOMOUS ENGINE</span>
        </div>
      </div>

      {/* Asymmetric Staggered Step Grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isActive = activeStep === idx;
          const isPassed = activeStep > idx;

          return (
            <div
              key={stage.id}
              onClick={() => setActiveStep(idx)}
              className={`group cursor-pointer rounded-xl border p-4 transition-all duration-300 relative flex flex-col justify-between ${
                isActive
                  ? `border-white/30 bg-gradient-to-b ${stage.color} shadow-lg -translate-y-1`
                  : "border-white/5 bg-white/[0.015] hover:border-white/15 hover:bg-white/[0.03]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-white/40">
                    STAGE {stage.step}
                  </span>
                  <span
                    className={`rounded-full p-1.5 ${
                      isActive
                        ? "bg-white/10 text-white shadow-sm"
                        : "bg-white/[0.03] text-white/30 group-hover:text-white/60"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                </div>

                <div className="mt-3">
                  <h5 className="font-sans text-xs font-semibold text-white group-hover:text-velmere-gold transition">
                    {stage.name[locale]}
                  </h5>
                  <p className="mt-1 text-[10px] text-white/50 leading-relaxed">
                    {stage.subtitle[locale]}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between font-mono text-[9px]">
                <span className="text-white/30 uppercase">Invariant</span>
                <span className={isActive ? "text-white font-semibold" : "text-white/50"}>
                  {stage.metric}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
