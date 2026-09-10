"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Calculator,
  CheckCircle2,
  ExternalLink,
  Info,
  Layers,
  Scale,
  Shield,
  ShieldAlert,
  Sliders,
  X,
} from "lucide-react";
import BodyPortal from "@/components/ui/BodyPortal";
import { useModalScrollLock } from "@/components/ui/useModalScrollLock";
import RiskCalculationWaterfallFork from "@/components/market-integrity/RiskCalculationWaterfallFork";
import RiskCalculationTelemetryFlow from "@/components/security/RiskCalculationTelemetryFlow";

export type HowRiskIsCalculatedModalProps = {
  isOpen: boolean;
  onClose: () => void;
  locale: "pl" | "en" | "de";
  currentRiskScore?: number;
  contractAddress?: string;
};

const I18N = {
  en: {
    badge: "INSTITUTIONAL METHODOLOGY · RISK ENGINE V2",
    title: "How Risk is Calculated",
    subtitle:
      "Velmère computes risk through a deterministic, multi-dimensional security equation grounded in formal EVM verification, economic attack simulations, and CVSS v3.1 severity scores.",
    formulaTitle: "Mathematical Risk Formulation",
    formulaNote:
      "Risk score R ∈ [0, 100] is bounded by the convex linear combination of five orthogonal risk domains, normalized by finding severity coefficients and data availability penalties:",
    weightsTitle: "Component Weight Architecture",
    interactiveTitle: "Interactive Risk Simulator",
    interactiveDesc:
      "Adjust parameter inputs below to simulate how vulnerability discoveries and liquidity depth impact the composite risk score in real time.",
    standardsTitle: "Regulatory & Security Reference Standards",
    standardsDesc:
      "Every rule and invariant in Velmère V2 maps directly to globally established smart contract security specifications.",
    swcLabel: "SWC Registry (Smart Contract Weakness)",
    eeaLabel: "EEA EthTrust Security Specification v1",
    cvssLabel: "FIRST CVSS v3.1 Quantitative Scoring",
    close: "Close",
    reset: "Reset to Standards",
    simulatedScore: "Simulated Risk Score",
    severityWeightsTitle: "Finding Severity Weights (CVSS v3.1)",
    critical: "Critical (CVSS 9.0–10.0)",
    high: "High (CVSS 7.0–8.9)",
    medium: "Medium (CVSS 4.0–6.9)",
    low: "Low (CVSS 0.1–3.9)",
  },
  pl: {
    badge: "METODOLOGIA INSTYTUCJONALNA · RISK ENGINE V2",
    title: "Jak obliczane jest ryzyko",
    subtitle:
      "Velmère oblicza wskaźnik ryzyka za pomocą deterministycznego, wielowymiarowego równania opartego na formalnej weryfikacji EVM, symulacjach ataków ekonomicznych i wagach CVSS v3.1.",
    formulaTitle: "Matematyczna formuła ryzyka",
    formulaNote:
      "Wskaźnik ryzyka R ∈ [0, 100] stanowi wypukłą kombinację liniową pięciu ortogonalnych domen bezpieczeństwa, korygowaną przez wagi wykrytych podatności oraz braki danych źródłowych:",
    weightsTitle: "Architektura wag składowych",
    interactiveTitle: "Interaktywny symulator ryzyka",
    interactiveDesc:
      "Zmieniaj parametry poniżej, aby na żywo zobaczyć, jak wykryte błędy, manipulacje cenowe i rezerwy puli wpływają na ostateczną ocenę ryzyka.",
    standardsTitle: "Standardy branżowe i zgodność",
    standardsDesc:
      "Każda reguła i niezmiennik w silniku Velmère V2 bezpośrednio odnosi się do międzynarodowych wytycznych bezpieczeństwa kontraktów.",
    swcLabel: "Rejestr SWC (Smart Contract Weakness)",
    eeaLabel: "Specyfikacja EEA EthTrust v1",
    cvssLabel: "Ilościowa skala ocen FIRST CVSS v3.1",
    close: "Zamknij",
    reset: "Przywróć domyślne",
    simulatedScore: "Symulowany wskaźnik ryzyka",
    severityWeightsTitle: "Wagi wagowe podatności (CVSS v3.1)",
    critical: "Krytyczne (CVSS 9.0–10.0)",
    high: "Wysokie (CVSS 7.0–8.9)",
    medium: "Średnie (CVSS 4.0–6.9)",
    low: "Niskie (CVSS 0.1–3.9)",
  },
  de: {
    badge: "INSTITUTIONELLE METHODIK · RISK ENGINE V2",
    title: "Wie das Risiko berechnet wird",
    subtitle:
      "Velmère berechnet den Risiko-Score über eine deterministische, mehrdimensionale Gleichung basierend auf formaler EVM-Verifikation, wirtschaftlichen Angriffssimulationen und CVSS v3.1-Gewichtungen.",
    formulaTitle: "Mathematische Risikoformel",
    formulaNote:
      "Der Risiko-Score R ∈ [0, 100] ist die konvexe Linearkombination aus fünf orthogonalen Risikobereichen, skaliert durch Schweregrad-Koeffizienten:",
    weightsTitle: "Architektur der Komponenten-Gewichte",
    interactiveTitle: "Interaktiver Risikosimulator",
    interactiveDesc:
      "Passen Sie die Parameter unten an, um in Echtzeit zu sehen, wie sich Schwachstellen und Liquiditätstiefe auf den Gesamtrisiko-Score auswirken.",
    standardsTitle: "Regulatorische & Sicherheits-Referenzstandards",
    standardsDesc:
      "Jede Regel und Invariante in Velmère V2 entspricht direkt anerkannten Spezifikationen für Smart-Contract-Sicherheit.",
    swcLabel: "SWC-Register (Smart Contract Weakness)",
    eeaLabel: "EEA EthTrust Sicherheitsstandard v1",
    cvssLabel: "FIRST CVSS v3.1 Bewertungsskala",
    close: "Schließen",
    reset: "Auf Standard zurücksetzen",
    simulatedScore: "Simulierter Risiko-Score",
    severityWeightsTitle: "Schweregrad-Gewichte (CVSS v3.1)",
    critical: "Kritisch (CVSS 9.0–10.0)",
    high: "Hoch (CVSS 7.0–8.9)",
    medium: "Mittel (CVSS 4.0–6.9)",
    low: "Niedrig (CVSS 0.1–3.9)",
  },
};

const DEFAULT_WEIGHTS = [
  { id: "vuln", nameEn: "Vulnerabilities & Reentrancy", namePl: "Podatności i reentrancy", nameDe: "Schwachstellen & Reentrancy", weight: 30, color: "text-rose-400" },
  { id: "econ", nameEn: "DeFi Economic Exploits", namePl: "Ataki ekonomiczne i flash loans", nameDe: "Wirtschaftliche Exploits", weight: 25, color: "text-amber-400" },
  { id: "oracle", nameEn: "Oracle Manipulation & Staleness", namePl: "Manipulacje wyrocznią cenową", nameDe: "Orakel-Manipulation", weight: 15, color: "text-cyan-400" },
  { id: "priv", nameEn: "Privilege & Access Control", namePl: "Uprawnienia i centralizacja", nameDe: "Zugriffskontrolle & Privilegien", weight: 15, color: "text-violet-400" },
  { id: "liq", nameEn: "Liquidity Depth & Slippage", namePl: "Głębokość arkusza i płynność", nameDe: "Liquidität & Slippage", weight: 15, color: "text-emerald-400" },
];

export default function HowRiskIsCalculatedModal({
  isOpen,
  onClose,
  locale,
  currentRiskScore,
  contractAddress,
}: HowRiskIsCalculatedModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const t = I18N[locale] ?? I18N.en;

  // Simulator inputs (0 to 100 for each domain)
  const [vulnInput, setVulnInput] = useState<number>(20);
  const [econInput, setEconInput] = useState<number>(15);
  const [oracleInput, setOracleInput] = useState<number>(10);
  const [privInput, setPrivInput] = useState<number>(15);
  const [liqInput, setLiqInput] = useState<number>(10);

  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calculate simulated composite risk score
  const computedScore = Math.round(
    (0.30 * vulnInput) +
    (0.25 * econInput) +
    (0.15 * oracleInput) +
    (0.15 * privInput) +
    (0.15 * liqInput)
  );

  const getRiskBand = (score: number) => {
    if (score >= 70) return { label: "CRITICAL RISK", color: "text-rose-400 border-rose-500/40 bg-rose-950/20" };
    if (score >= 45) return { label: "HIGH RISK", color: "text-amber-400 border-amber-500/40 bg-amber-950/20" };
    if (score >= 20) return { label: "MODERATE RISK", color: "text-yellow-300 border-yellow-500/40 bg-yellow-950/20" };
    return { label: "LOW RISK (ROBUST)", color: "text-emerald-400 border-emerald-500/40 bg-emerald-950/20" };
  };

  const currentBand = getRiskBand(computedScore);

  return (
    <BodyPortal>
      <div
        className="fixed inset-0 z-[1600] grid place-items-center bg-black/85 p-3 sm:p-6 backdrop-blur-md animate-in fade-in duration-200"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-risk-is-calculated-title"
      >
        <div
          ref={modalRef}
          data-modal-scroll-region="true"
          className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/[0.14] bg-[#07090b] p-5 sm:p-8 text-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-5">
            <div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/80">
                <Calculator className="h-3 w-3" />
                {t.badge}
              </span>
              <h2
                id="how-risk-is-calculated-title"
                className="mt-1 font-serif text-2xl font-light text-white sm:text-3xl"
              >
                {t.title}
              </h2>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-white/60">
                {t.subtitle}
              </p>
            </div>
            <button
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.02] text-white/60 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
              aria-label={t.close}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Institutional Telemetry Flow Pipeline */}
          <div className="mt-6">
            <RiskCalculationTelemetryFlow locale={locale} />
          </div>

          {/* Institutional Waterfall Fork Diagram */}
          <div className="mt-6">
            <RiskCalculationWaterfallFork
              locale={locale}
              currentScore={currentRiskScore}
              assetName={contractAddress ? `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}` : undefined}
            />
          </div>

          {/* Section 1: Mathematical Formula */}
          <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.015] p-5">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-cyan-200">
              <Scale className="h-4 w-4 text-cyan-400" />
              {t.formulaTitle}
            </div>
            <p className="mt-2 text-xs text-white/60 leading-relaxed">
              {t.formulaNote}
            </p>
            <div className="mt-4 overflow-x-auto rounded-lg border border-white/[0.10] bg-black/60 p-4 font-mono text-xs sm:text-sm text-cyan-100">
              <span className="text-white/40">Risk = </span>
              <span className="text-rose-400">0.30·S_vuln</span>
              <span className="text-white/40"> + </span>
              <span className="text-amber-400">0.25·S_econ</span>
              <span className="text-white/40"> + </span>
              <span className="text-cyan-400">0.15·S_oracle</span>
              <span className="text-white/40"> + </span>
              <span className="text-violet-400">0.15·S_priv</span>
              <span className="text-white/40"> + </span>
              <span className="text-emerald-400">0.15·S_liq</span>
            </div>
          </div>

          {/* Section 2: Component Weights Grid */}
          <div className="mt-6">
            <h3 className="font-mono text-xs uppercase tracking-wider text-white/70">
              {t.weightsTitle}
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              {DEFAULT_WEIGHTS.map((w) => {
                const label = locale === "pl" ? w.namePl : locale === "de" ? w.nameDe : w.nameEn;
                return (
                  <div
                    key={w.id}
                    className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-white/[0.015] p-3.5"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-white/40">
                          Domain
                        </span>
                        <span className={`font-mono text-xs font-semibold ${w.color}`}>
                          {w.weight}%
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-medium text-white/90">
                        {label}
                      </p>
                    </div>
                    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-cyan-400"
                        style={{ width: `${w.weight * 2}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Interactive Risk Simulator */}
          <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.015] p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-cyan-200">
                <Sliders className="h-4 w-4 text-cyan-400" />
                {t.interactiveTitle}
              </div>
              <button
                onClick={() => {
                  setVulnInput(20);
                  setEconInput(15);
                  setOracleInput(10);
                  setPrivInput(15);
                  setLiqInput(10);
                }}
                className="font-mono text-[10px] uppercase tracking-wider text-white/40 hover:text-white"
              >
                {t.reset}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-white/60">
              {t.interactiveDesc}
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Sliders */}
              <div className="space-y-3.5">
                <div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-rose-400">1. Vulnerability & Reentrancy</span>
                    <span className="text-white/80">{vulnInput}/100</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={vulnInput}
                    onChange={(e) => setVulnInput(Number(e.target.value))}
                    className="mt-1.5 w-full accent-rose-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-amber-400">2. Economic & Flash Loan</span>
                    <span className="text-white/80">{econInput}/100</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={econInput}
                    onChange={(e) => setEconInput(Number(e.target.value))}
                    className="mt-1.5 w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-cyan-400">3. Oracle Manipulation</span>
                    <span className="text-white/80">{oracleInput}/100</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={oracleInput}
                    onChange={(e) => setOracleInput(Number(e.target.value))}
                    className="mt-1.5 w-full accent-cyan-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-violet-400">4. Centralization & Privileges</span>
                    <span className="text-white/80">{privInput}/100</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={privInput}
                    onChange={(e) => setPrivInput(Number(e.target.value))}
                    className="mt-1.5 w-full accent-violet-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-emerald-400">5. Liquidity & Slippage</span>
                    <span className="text-white/80">{liqInput}/100</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={liqInput}
                    onChange={(e) => setLiqInput(Number(e.target.value))}
                    className="mt-1.5 w-full accent-emerald-500"
                  />
                </div>
              </div>

              {/* Composite Output Display */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-black/40 p-6 text-center">
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                  {t.simulatedScore}
                </span>
                <div className="mt-2 font-mono text-5xl font-light text-white">
                  {computedScore}
                  <span className="text-lg text-white/30">/100</span>
                </div>
                <div
                  className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider ${currentBand.color}`}
                >
                  <ShieldAlert className="h-3 w-3" />
                  {currentBand.label}
                </div>
                <p className="mt-4 text-[11px] text-white/50 leading-relaxed max-w-xs">
                  {computedScore >= 70
                    ? "Severe protocol vulnerabilities detected. Immediate freeze or remediation required before production capital allocation."
                    : computedScore >= 45
                    ? "Elevated threat surface. Economic vectors or central key controls pose material risk."
                    : computedScore >= 20
                    ? "Moderate exposure. Informational and minor architectural hygiene recommendations present."
                    : "Robust defensive posture. No critical execution paths open to external manipulation."}
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Regulatory & Security Reference Standards */}
          <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.015] p-5">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-cyan-200">
              <BookOpen className="h-4 w-4 text-cyan-400" />
              {t.standardsTitle}
            </div>
            <p className="mt-1.5 text-xs text-white/60">
              {t.standardsDesc}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <a
                href="https://swcregistry.io/"
                target="_blank"
                rel="noreferrer noopener"
                className="group flex flex-col justify-between rounded-lg border border-white/[0.08] bg-black/40 p-3.5 transition hover:border-cyan-500/40 hover:bg-white/[0.03]"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                    <span>SWC Registry</span>
                    <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/60">
                    SWC-107, SWC-105, SWC-115 classification of EVM vulnerabilities.
                  </p>
                </div>
                <span className="mt-3 font-mono text-[9px] uppercase tracking-wider text-white/30">
                  Universal Taxonomy
                </span>
              </a>

              <a
                href="https://entethalliance.org/"
                target="_blank"
                rel="noreferrer noopener"
                className="group flex flex-col justify-between rounded-lg border border-white/[0.08] bg-black/40 p-3.5 transition hover:border-cyan-500/40 hover:bg-white/[0.03]"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                    <span>EEA EthTrust v1</span>
                    <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/60">
                    Enterprise Ethereum Alliance Smart Contract Security standard.
                  </p>
                </div>
                <span className="mt-3 font-mono text-[9px] uppercase tracking-wider text-white/30">
                  Formal Spec v1.0
                </span>
              </a>

              <a
                href="https://www.first.org/cvss/"
                target="_blank"
                rel="noreferrer noopener"
                className="group flex flex-col justify-between rounded-lg border border-white/[0.08] bg-black/40 p-3.5 transition hover:border-cyan-500/40 hover:bg-white/[0.03]"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                    <span>CVSS v3.1</span>
                    <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/60">
                    Common Vulnerability Scoring System for deterministic exploitability.
                  </p>
                </div>
                <span className="mt-3 font-mono text-[9px] uppercase tracking-wider text-white/30">
                  FIRST Standard
                </span>
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-5">
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/30">
              Velmère Security Assurance Framework
            </span>
            <button
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-5 font-mono text-xs uppercase tracking-wider text-white transition hover:bg-white/20"
            >
              {t.close}
            </button>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
