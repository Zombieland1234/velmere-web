"use client";

import { motion } from "framer-motion";
import { useId, useState } from "react";
import { Activity, Cpu, Database, Eye, Lock, Shield, Sparkles } from "lucide-react";

export type RiskForkDomain = {
  id: string;
  name: Record<"pl" | "en" | "de", string>;
  description: Record<"pl" | "en" | "de", string>;
  weight: number;
  score: number;
  icon: typeof Shield;
};

const DEFAULT_DOMAINS: RiskForkDomain[] = [
  {
    id: "vulnerabilities",
    name: {
      pl: "Podatności & Reentrancy",
      en: "Vulnerabilities & Reentrancy",
      de: "Schwachstellen & Reentrancy",
    },
    description: {
      pl: "Analiza statyczna i formalna AST: reentrancy, overflow, delegatecall, unchecked return.",
      en: "Static & formal AST verification: reentrancy, overflow, delegatecall, unchecked return.",
      de: "Statische & formale AST-Verifizierung: Reentrancy, Overflow, Delegatecall, ungeprüfte Rückgaben.",
    },
    weight: 0.30,
    score: 8,
    icon: Shield,
  },
  {
    id: "economic",
    name: {
      pl: "DeFi & Exploity Ekonomiczne",
      en: "DeFi & Economic Exploits",
      de: "DeFi & Ökonomische Exploits",
    },
    description: {
      pl: "Flash-loan attack vectors, sandwiching, asymetria rezerw i symulacje state-drain.",
      en: "Flash-loan attack vectors, sandwiching, pool reserve asymmetry and state-drain simulations.",
      de: "Flash-Loan-Angriffsvektoren, Sandwiching, Pool-Reserve-Asymmetrie und State-Drain-Simulationen.",
    },
    weight: 0.25,
    score: 14,
    icon: Activity,
  },
  {
    id: "oracle",
    name: {
      pl: "Manipulacja Wyrocznią (TWAP/Spot)",
      en: "Oracle Manipulation (TWAP/Spot)",
      de: "Oracle-Manipulation (TWAP/Spot)",
    },
    description: {
      pl: "Odporność feedu cenowego na manipulacje jednoblokowe, heartbeat staleness i fallbacki.",
      en: "Price feed resilience against single-block manipulation, heartbeat staleness, and fallbacks.",
      de: "Resilienz des Preisfeeds gegen Ein-Block-Manipulation, Heartbeat-Veraltung und Fallbacks.",
    },
    weight: 0.15,
    score: 5,
    icon: Eye,
  },
  {
    id: "access",
    name: {
      pl: "Kontrola Dostępu & Privileges",
      en: "Access Control & Privileges",
      de: "Zugriffskontrolle & Privilegien",
    },
    description: {
      pl: "Analiza timelocków, multisigów, uprawnień właściciela, ukrytych mintów i blacklist.",
      en: "Analysis of timelocks, multisigs, owner privileges, hidden mints, and blacklist capabilities.",
      de: "Analyse von Timelocks, Multisigs, Eigentümerrechten, versteckten Mints und Blacklist-Funktionen.",
    },
    weight: 0.15,
    score: 12,
    icon: Lock,
  },
  {
    id: "liquidity",
    name: {
      pl: "Głębokość Płynności & Poślizg",
      en: "Liquidity Depth & Slippage",
      de: "Liquiditätstiefe & Slippage",
    },
    description: {
      pl: "Koncentracja płynności L2/AMM, współczynnik Amihuda i ryzyko rug-pullu rezerw.",
      en: "L2/AMM liquidity concentration, Amihud illiquidity ratio, and reserve rug-pull vulnerability.",
      de: "L2/AMM-Liquiditätskonzentration, Amihud-Illiquiditätsverhältnis und Rug-Pull-Verwundbarkeit.",
    },
    weight: 0.15,
    score: 10,
    icon: Cpu,
  },
];

interface RiskCalculationWaterfallForkProps {
  assetName?: string;
  symbol?: string;
  currentScore?: number | null;
  locale?: "pl" | "en" | "de";
  className?: string;
}

export default function RiskCalculationWaterfallFork({
  assetName = "Smart Contract",
  symbol = "TOKEN",
  currentScore,
  locale = "pl",
  className = "",
}: RiskCalculationWaterfallForkProps) {
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const filterId = useId();

  const weightedSum = DEFAULT_DOMAINS.reduce((acc, d) => acc + d.weight * d.score, 0);
  const finalScore = typeof currentScore === "number" && !Number.isNaN(currentScore) ? currentScore : Math.round(weightedSum);

  const getRiskTone = (score: number) => {
    if (score < 25) return { color: "#52cbbb", label: locale === "pl" ? "MINIMALNE RYZYKO (INSTITUTIONAL)" : locale === "de" ? "MINIMALES RISIKO" : "MINIMAL RISK (INSTITUTIONAL)" };
    if (score < 50) return { color: "#c7a35b", label: locale === "pl" ? "RYZYKO STANDARDOWE" : locale === "de" ? "STANDARD-RISIKO" : "STANDARD RISK" };
    if (score < 75) return { color: "#e07a5f", label: locale === "pl" ? "PODWYŻSZONE RYZYKO" : locale === "de" ? "ERHÖHTES RISIKO" : "ELEVATED RISK" };
    return { color: "#f43f5e", label: locale === "pl" ? "RYZYKO KRYTYCZNE" : locale === "de" ? "KRITISCHES RISIKO" : "CRITICAL RISK" };
  };

  const riskMeta = getRiskTone(finalScore);

  return (
    <div
      className={`relative w-full rounded-2xl border border-white/[0.12] bg-[#070b0e]/95 p-5 md:p-7 text-white shadow-2xl backdrop-blur-xl ${className}`}
      data-testid="risk-calculation-waterfall-fork"
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-96 -translate-x-1/2 rounded-full bg-gradient-to-b from-[#c7a35b]/15 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/2 h-56 w-96 -translate-x-1/2 rounded-full bg-gradient-to-t from-cyan-500/10 to-transparent blur-3xl" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c7a35b]/30 bg-[#c7a35b]/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#d8c49a]">
              <Sparkles className="h-3 w-3 text-[#c7a35b]" />
              {locale === "pl" ? "Dekompozycja Widełkowa VLM" : locale === "de" ? "VLM-Gabel-Dekomposition" : "VLM Waterfall Fork Engine"}
            </span>
            <span className="font-mono text-[10px] text-white/40">v10.4 · ISO/IEC 25010</span>
          </div>
          <h3 className="mt-2 font-serif text-xl md:text-2xl font-light text-white">
            {locale === "pl" ? "Jak Velm\u00e8re Oblicza Wynik Ryzyka" : locale === "de" ? "Wie Velm\u00e8re den Risiko-Score berechnet" : "How Velm\u00e8re Calculates Risk Score"}
          </h3>
          <p className="mt-1 text-xs text-white/55">
            {locale === "pl"
              ? "Wielowymiarowy przepływ wagowy rozgałęziający surowe sygnały na 5 domen bezpieczeństwa."
              : locale === "de"
              ? "Mehrdimensionale Gewichtung, die Rohsignale in 5 Sicherheitsdomänen aufteilt."
              : "Multidimensional weighted pipeline branching raw signals across 5 security domains."}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2">
          <Database className="h-4 w-4 text-[#c7a35b]" />
          <div className="text-right">
            <span className="block font-mono text-[9px] uppercase tracking-wider text-white/40">
              {locale === "pl" ? "Obiekt analizy" : locale === "de" ? "Zielobjekt" : "Target Subject"}
            </span>
            <strong className="font-mono text-xs text-white/90">{assetName} ({symbol})</strong>
          </div>
        </div>
      </div>

      <div className="relative mt-8 flex flex-col items-center">
        {/* ROOT NODE: Ingestion Layer */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-20 flex flex-col items-center"
        >
          <div className="group relative flex items-center gap-3 rounded-xl border border-cyan-400/30 bg-[#09151b] px-5 py-2.5 shadow-[0_0_20px_rgba(82,203,187,0.15)] transition-all hover:border-cyan-400/60">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
            </span>
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300">
                {locale === "pl" ? "1. Wejście Danych & Telemetria EVM" : locale === "de" ? "1. Dateneingang & EVM-Telemetrie" : "1. Raw Data Ingestion & EVM Telemetry"}
              </span>
              <strong className="font-mono text-xs text-white">
                Bytecode · Orderbook L2 · On-Chain State · Oracles
              </strong>
            </div>
          </div>
        </motion.div>

        {/* FORK SVG CONNECTOR: Splitting downward into 5 conduits */}
        <div className="relative w-full max-w-4xl h-20 -my-1 overflow-visible pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 1000 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`fork-grad-${filterId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#52cbbb" stopOpacity="0.8" />
                <stop offset="60%" stopColor="#c7a35b" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#c7a35b" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            <line x1="500" y1="0" x2="500" y2="25" stroke="#52cbbb" strokeWidth="2.5" strokeOpacity="0.8" />

            {/* 5 Branching Curved Conduits */}
            <path
              d="M 500 25 C 500 55, 100 35, 100 80"
              fill="none"
              stroke={`url(#fork-grad-${filterId})`}
              strokeWidth="1.8"
              strokeDasharray="4 4"
              className="animate-pulse"
            />
            <path
              d="M 500 25 C 500 55, 300 35, 300 80"
              fill="none"
              stroke={`url(#fork-grad-${filterId})`}
              strokeWidth="1.8"
              strokeDasharray="4 4"
              className="animate-pulse"
            />
            <path
              d="M 500 25 L 500 80"
              fill="none"
              stroke={`url(#fork-grad-${filterId})`}
              strokeWidth="2.2"
            />
            <path
              d="M 500 25 C 500 55, 700 35, 700 80"
              fill="none"
              stroke={`url(#fork-grad-${filterId})`}
              strokeWidth="1.8"
              strokeDasharray="4 4"
              className="animate-pulse"
            />
            <path
              d="M 500 25 C 500 55, 900 35, 900 80"
              fill="none"
              stroke={`url(#fork-grad-${filterId})`}
              strokeWidth="1.8"
              strokeDasharray="4 4"
              className="animate-pulse"
            />
          </svg>
        </div>

        {/* 5 DOMAIN CARDS (The Branches of the Fork) */}
        <div className="relative z-10 grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-1">
          {DEFAULT_DOMAINS.map((domain, index) => {
            const Icon = domain.icon;
            const isHovered = activeDomain === domain.id;
            const domainContribution = (domain.weight * domain.score).toFixed(1);
            return (
              <motion.div
                key={domain.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                onMouseEnter={() => setActiveDomain(domain.id)}
                onMouseLeave={() => setActiveDomain(null)}
                className={`relative flex flex-col justify-between rounded-xl border p-3.5 transition-all duration-200 cursor-default ${
                  isHovered
                    ? "border-[#c7a35b] bg-[#10171d] shadow-[0_8px_25px_rgba(199,163,91,0.18)] -translate-y-1"
                    : "border-white/[0.08] bg-[#0a1014]/90 hover:border-white/[0.2] hover:bg-[#0d1419]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-[#c7a35b]">
                    <Icon className="h-3.5 w-3.5 text-[#c7a35b]" />
                    {Math.round(domain.weight * 100)}% {locale === "pl" ? "Wagi" : locale === "de" ? "Gewicht" : "Weight"}
                  </span>
                  <span className="font-mono text-[9px] text-white/40">D{index + 1}</span>
                </div>

                <div className="my-2.5">
                  <h4 className="font-serif text-sm font-medium text-white/95 leading-tight">
                    {domain.name[locale]}
                  </h4>
                  <p className="mt-1 text-[10px] text-white/50 line-clamp-3 leading-relaxed">
                    {domain.description[locale]}
                  </p>
                </div>

                <div className="mt-auto border-t border-white/[0.06] pt-2.5 flex items-center justify-between">
                  <div>
                    <span className="block font-mono text-[8px] uppercase tracking-wider text-white/40">
                      {locale === "pl" ? "Ocena domeny" : locale === "de" ? "Teilscore" : "Sub-score"}
                    </span>
                    <strong className="font-mono text-xs text-white">
                      {domain.score} <small className="text-white/40 font-normal">/100</small>
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="block font-mono text-[8px] uppercase tracking-wider text-[#c7a35b]/70">
                      {locale === "pl" ? "Wkład" : locale === "de" ? "Beitrag" : "Contribution"}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-[#d8c49a]">
                      +{domainContribution}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CONVERGENCE CONNECTOR */}
        <div className="relative w-full max-w-4xl h-20 -my-1 overflow-visible pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 1000 80" preserveAspectRatio="none">
            <path d="M 100 0 C 100 45, 500 25, 500 55" fill="none" stroke="#c7a35b" strokeWidth="1.6" strokeOpacity="0.4" strokeDasharray="3 3" />
            <path d="M 300 0 C 300 45, 500 25, 500 55" fill="none" stroke="#c7a35b" strokeWidth="1.6" strokeOpacity="0.4" strokeDasharray="3 3" />
            <path d="M 500 0 L 500 55" fill="none" stroke="#c7a35b" strokeWidth="2.2" strokeOpacity="0.8" />
            <path d="M 700 0 C 700 45, 500 25, 500 55" fill="none" stroke="#c7a35b" strokeWidth="1.6" strokeOpacity="0.4" strokeDasharray="3 3" />
            <path d="M 900 0 C 900 45, 500 25, 500 55" fill="none" stroke="#c7a35b" strokeWidth="1.6" strokeOpacity="0.4" strokeDasharray="3 3" />

            <line x1="500" y1="55" x2="500" y2="80" stroke="#c7a35b" strokeWidth="3" />
          </svg>
        </div>

        {/* FORMULA RECONCILIATION PILL */}
        <div className="relative z-10 -mt-2 mb-4 rounded-full border border-white/10 bg-[#070c0e] px-4 py-1 font-mono text-[10px] text-white/70 shadow-md">
          <span className="text-[#c7a35b]">Formula: </span>
          <span>Risk = Σ (Weight_i × Score_i) × DAS_factor</span>
        </div>

        {/* TERMINAL RESULT NODE */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative z-20 w-full max-w-lg rounded-2xl border p-5 text-center shadow-2xl transition-all"
          style={{
            borderColor: `${riskMeta.color}40`,
            background: "linear-gradient(180deg, rgba(14,20,24,0.95) 0%, rgba(8,12,15,0.98) 100%)",
            boxShadow: `0 12px 40px ${riskMeta.color}15, inset 0 1px 0 rgba(255,255,255,0.06)`,
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: riskMeta.color, boxShadow: `0 0 8px ${riskMeta.color}` }}
            />
            <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-white/70 uppercase">
              {locale === "pl" ? "OSTATECZNY WYNIK RYZYKA VLM" : locale === "de" ? "ENDGÜLTIGER VLM-RISIKOSCORE" : "FINAL VLM COMPOSITE RISK SCORE"}
            </span>
          </div>

          <div className="my-2.5 flex items-baseline justify-center gap-1.5">
            <span
              className="font-mono text-4xl md:text-5xl font-light tracking-tight"
              style={{ color: riskMeta.color }}
            >
              {finalScore.toFixed(1)}
            </span>
            <span className="font-mono text-sm text-white/40">/ 100</span>
          </div>

          <div
            className="inline-block rounded-full border px-3 py-1 font-mono text-[10px] font-semibold tracking-wider"
            style={{
              borderColor: `${riskMeta.color}50`,
              backgroundColor: `${riskMeta.color}12`,
              color: riskMeta.color,
            }}
          >
            {riskMeta.label}
          </div>

          <p className="mt-3 text-[11px] text-white/50 max-w-sm mx-auto leading-relaxed">
            {locale === "pl"
              ? "Syntetyczny wskaźnik odporności z ciągłą weryfikacją dowodów on-chain. Niższy wynik oznacza wyższy poziom bezpieczeństwa instytucjonalnego."
              : locale === "de"
              ? "Synthetischer Resilienz-Index mit kontinuierlicher On-Chain-Beweisprüfung. Ein niedrigerer Score bedeutet höhere institutionelle Sicherheit."
              : "Synthetic resilience index with continuous on-chain evidence verification. Lower score indicates superior institutional security."}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
