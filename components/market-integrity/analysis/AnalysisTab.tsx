"use client";

import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  BarChart3,
  Braces,
  LineChart,
  CircleGauge,
  Database,
  Droplets,
  Gauge,
  Layers3,
  Network,
  Radar,
  ScanLine,
  Target,
  TrendingUp,
  UsersRound,
  Waves,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ANALYSIS_TIER_BUDGET,
  inspectDataAvailability,
  runVlmAnalysis,
  type AnalysisResult,
  type AnalysisSignal,
  type AnalysisStatus,
  type AnalysisTier,
  type VlmAnalysisAsset,
} from "@/lib/market-integrity/vlm-analysis";
import { runShieldProServerAnalysis } from "@/lib/market-integrity/shield-pro-server-analysis-client";
import { VlmMotionScene } from "@/components/motion/VlmMotionScene";
import { ProofStamp, VShieldPulse } from "@/components/motion/VelmereAnalysisMarks";

const EASE = [0.22, 1, 0.36, 1] as const;

type Locale = "pl" | "en" | "de";

type AnalysisState = {
  status: AnalysisStatus | "completing";
  tier: AnalysisTier | null;
  progress: number;
  result: AnalysisResult | null;
  error: string | null;
};

const INITIAL_STATE: AnalysisState = {
  status: "idle",
  tier: null,
  progress: 0,
  result: null,
  error: null,
};

const TIER_ORDER: AnalysisTier[] = ["basic", "pro", "advanced"];
const TIER_META = {
  basic: { seconds: 3.5, durationLabel: "3–4 s" },
  pro: { seconds: 5.5, durationLabel: "5–6 s" },
  advanced: { seconds: 7.5, durationLabel: "7–8 s" },
} satisfies Record<AnalysisTier, { seconds: number; durationLabel: string }>;

const TIER_PRICES: Record<Locale, Record<AnalysisTier, { price: string; sub: string }>> = {
  pl: {
    basic: { price: "0,00 €", sub: "Darmowy prescreen" },
    pro: { price: "14,99 €", sub: "Pełny skan L2" },
    advanced: { price: "49,99 €", sub: "Silnik kworum & whale" },
  },
  en: {
    basic: { price: "€0.00", sub: "Free prescreen" },
    pro: { price: "€14.99", sub: "Full L2 scan" },
    advanced: { price: "€49.99", sub: "Quorum & whale engine" },
  },
  de: {
    basic: { price: "0,00 €", sub: "Kostenloser Prescreen" },
    pro: { price: "14,99 €", sub: "Vollständiger L2-Scan" },
    advanced: { price: "49,99 €", sub: "Quorum & Whale-Engine" },
  },
};

const COPY = {
  pl: {
    eyebrow: "VLM ANALYSIS",
    intro: "Wybierz głębokość analizy rynku. Każdy poziom wykorzystuje inny zakres sygnałów i danych.",
    recommended: "Polecany",
    locked: "Wymaga autoryzowanego dostępu instytucjonalnego VLM.",
    signals: "sygnałów",
    about: "około",
    basic: "szybka wstępna weryfikacja płynności i podstawowych metryk cenowych ze snapshotu",
    pro: "głęboka analiza struktury L2, wykrywanie ukrytych zleceń, korelacja wolumenów i risk-spread",
    advanced: "kompletny silnik market integrity: kworum węzłów, SEC 13F / whale clusters, sentinele manipulacji i audytowany certyfikat",
    run: "Uruchom",
    sources: "Dostępne źródła",
    loading: "Trwa analiza VLM",
    complete: "Analiza ukończona",
    proof: "Przetworzono lokalny snapshot. Nie zapisano zewnętrznego dowodu ani live feedu.",
    serverProof: "Wynik odebrano z serwera po weryfikacji dostępu i dokładnego pakietu dowodowego. Pewność skalibrowana kryptograficznie.",
    unavailable: "Nie udało się ukończyć analizy",
    retry: "Spróbuj ponownie",
    back: "Wróć do wyboru",
    verdict: "VLM VERDICT",
    risk: "Wynik ryzyka",
    confidence: "Skalibrowana pewność",
    quality: "Jakość danych",
    view: "Zobacz dowody",
    details: "Szczegóły sygnału",
    reason: "Powód oceny",
    evidence: "Wykorzystane źródła",
    impact: "Wpływ na wynik",
    close: "Zamknij szczegóły",
  },
  en: {
    eyebrow: "VLM ANALYSIS",
    intro: "Choose the depth of market analysis. Each level uses a different range of signals and data.",
    recommended: "Recommended",
    locked: "Requires authorized VLM institutional access.",
    signals: "signals",
    about: "about",
    basic: "fast preliminary liquidity verification and core price metrics from market snapshot",
    pro: "deep L2 market structure, iceberg order detection, cross-venue volume correlation, and risk spread",
    advanced: "full institutional market integrity: node quorum, SEC 13F / whale clusters, manipulation sentinels, and audit certificate",
    run: "Run",
    sources: "Available sources",
    loading: "VLM analysis in progress",
    complete: "Analysis complete",
    proof: "The local snapshot was processed. No external evidence or live feed was recorded.",
    serverProof: "The result came from the server after access and exact evidence-packet verification. Confidence calibrated cryptographically.",
    unavailable: "The analysis could not be completed",
    retry: "Try again",
    back: "Back to selection",
    verdict: "VLM VERDICT",
    risk: "Risk score",
    confidence: "Calibrated confidence",
    quality: "Data quality",
    view: "View evidence",
    details: "Signal details",
    reason: "Reason for assessment",
    evidence: "Sources used",
    impact: "Impact on final result",
    close: "Close details",
  },
  de: {
    eyebrow: "VLM ANALYSIS",
    intro: "Wähle die Tiefe der Marktanalyse. Jede Stufe nutzt einen anderen Umfang an Signalen und Daten.",
    recommended: "Empfohlen",
    locked: "Erfordert autorisierten institutionellen VLM-Zugriff.",
    signals: "Signale",
    about: "etwa",
    basic: "schnelle vorläufige Liquiditätsprüfung und Kernpreismetriken aus dem Marktsnapshot",
    pro: "tiefgehende L2-Marktstrukturanalyse, Iceberg-Order-Erkennung, volumenseitige Korrelation und Risk-Spread",
    advanced: "vollständige institutionelle Marktintegrität: Node-Quorum, SEC 13F / On-Chain-Whale-Cluster, Manipulationswächter und Auditzertifikat",
    run: "Starten",
    sources: "Verfügbare Quellen",
    loading: "VLM-Analyse läuft",
    complete: "Analyse abgeschlossen",
    proof: "Der lokale Snapshot wurde verarbeitet. Es wurden weder externe Evidenz noch ein Live-Feed protokolliert.",
    serverProof: "Das Ergebnis kam nach Zugriffs- und exakter Evidenzpaketprüfung vom Server. Konfidenz bleibt ohne Kalibrierungsartefakt zurückgehalten.",
    unavailable: "Die Analyse konnte nicht abgeschlossen werden",
    retry: "Erneut versuchen",
    back: "Zurück zur Auswahl",
    verdict: "VLM VERDICT",
    risk: "Risikoscore",
    confidence: "Kalibrierte Konfidenz",
    quality: "Datenqualität",
    view: "Evidenz ansehen",
    details: "Signaldetails",
    reason: "Grund der Bewertung",
    evidence: "Verwendete Quellen",
    impact: "Einfluss auf das Ergebnis",
    close: "Details schließen",
  },
} as const;

const SIGNAL_ICONS = {
  trend: TrendingUp,
  momentum: Activity,
  "market-regime": CircleGauge,
  volatility: Waves,
  volume: BarChart3,
  liquidity: Droplets,
  "buy-sell-pressure": ArrowDownUp,
  "price-structure": Layers3,
  "relative-strength": Gauge,
  "data-quality": Database,
  support: Target,
  resistance: Target,
  "exchange-net-flow": Network,
  "funding-open-interest": LineChart,
  "order-book-imbalance": Braces,
  "slippage-risk": Gauge,
  "whale-activity": UsersRound,
  "holder-concentration": CircleGauge,
  "anomaly-scan": ScanLine,
  "scenario-map": Radar,
} as const;

function localeCopy(locale: Locale) {
  return COPY[locale];
}

function easeInOut(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

type MorphPoint = { x: number; y: number };

function sampleTextPoints(canvas: HTMLCanvasElement, width: number, height: number, count: number) {
  const buffer = document.createElement("canvas");
  buffer.width = Math.max(1, Math.floor(width));
  buffer.height = Math.max(1, Math.floor(height));
  const context = buffer.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#fff";
  const fontSize = Math.max(24, Math.min(52, width / 8.1));
  const computedFont = getComputedStyle(canvas).fontFamily || "ui-sans-serif, sans-serif";
  context.font = `600 ${fontSize}px ${computedFont}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("VELMÈRE", width / 2, height / 2);
  const pixels = context.getImageData(0, 0, buffer.width, buffer.height).data;
  const candidates: Array<{ x: number; y: number }> = [];
  const step = Math.max(2, Math.floor(width / 230));
  for (let y = 0; y < buffer.height; y += step) {
    for (let x = 0; x < buffer.width; x += step) {
      if (pixels[(y * buffer.width + x) * 4 + 3] > 120) candidates.push({ x, y });
    }
  }
  if (!candidates.length) return [];
  candidates.sort((a, b) => a.x - b.x || a.y - b.y);
  return Array.from({ length: count }, (_, index) => candidates[Math.round((index / Math.max(1, count - 1)) * (candidates.length - 1))]);
}

function wavePoints(width: number, height: number, count: number) {
  const lanes = 5;
  const laneLength = Math.ceil(count / lanes);
  const left = width * 0.055;
  const span = width * 0.89;
  const center = height * 0.5;
  return Array.from({ length: count }, (_, index) => {
    const lane = index % lanes;
    const pointIndex = Math.floor(index / lanes);
    const t = pointIndex / Math.max(1, laneLength - 1);
    const normalized = t * 2 - 1;
    const envelope = Math.pow(Math.max(0, 1 - Math.abs(normalized)), 1.4);
    const phase = (lane - 2) * 0.62;
    const amplitude = (20 + Math.abs(lane - 2) * 8) * envelope;
    return {
      x: left + span * t,
      y: center + Math.sin(t * Math.PI * 8 + phase) * amplitude + (lane - 2) * 1.05,
    };
  });
}

function vPoints(width: number, height: number, count: number) {
  const lanes = 5;
  const laneLength = Math.ceil(count / lanes);
  const top = height * 0.25;
  const bottom = height * 0.76;
  const left = width * 0.405;
  const center = width * 0.5;
  const right = width * 0.595;
  return Array.from({ length: count }, (_, index) => {
    const lane = index % lanes;
    const orderedIndex = Math.floor(index / lanes);
    const side = orderedIndex % 2;
    const t = Math.floor(orderedIndex / 2) / Math.max(1, Math.floor(laneLength / 2) - 1);
    const thickness = (lane - 2) * 0.72;
    return side === 0
      ? { x: left + (center - left) * t + thickness, y: top + (bottom - top) * t - thickness * 0.22 }
      : { x: center + (right - center) * (1 - t) + thickness, y: bottom - (bottom - top) * (1 - t) + thickness * 0.22 };
  });
}

function mixPoint(from: MorphPoint, to: MorphPoint, amount: number): MorphPoint {
  return { x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount };
}

export function LegacyVlmSignalMorph({ mode, className = "" }: { mode: "idle" | "loading"; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let targetsWave: MorphPoint[] = [];
    let targetsV: MorphPoint[] = [];
    let targetsText: MorphPoint[] = [];
    let generation = 0;
    const count = mode === "idle" ? 240 : 320;
    const startedAt = performance.now();

    const resize = async () => {
      const currentGeneration = ++generation;
      const rect = canvas.getBoundingClientRect();
      width = Math.max(260, Math.floor(rect.width));
      height = Math.max(96, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      targetsWave = wavePoints(width, height, count);
      targetsV = vPoints(width, height, count);
      await document.fonts?.ready;
      if (currentGeneration !== generation) return;
      targetsText = sampleTextPoints(canvas, width, height, count);
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(draw);
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      const cycle = mode === "loading" && !reducedMotion ? ((time - startedAt) % 3000) / 3000 : 0;
      let fromTargets = targetsWave;
      let toTargets = targetsWave;
      let amount = 0;
      let wavePresence = 1;
      let vPresence = 0;

      if (mode === "loading" && !reducedMotion) {
        if (cycle < 0.16) {
          fromTargets = targetsWave; toTargets = targetsV; amount = easeInOut(cycle / 0.16); wavePresence = 1 - amount; vPresence = amount;
        } else if (cycle < 0.28) {
          fromTargets = targetsV; toTargets = targetsV; amount = 1; vPresence = 1;
        } else if (cycle < 0.48) {
          fromTargets = targetsV; toTargets = targetsText; amount = easeInOut((cycle - 0.28) / 0.2); vPresence = 1 - amount;
        } else if (cycle < 0.62) {
          fromTargets = targetsText; toTargets = targetsText; amount = 1;
        } else if (cycle < 0.80) {
          fromTargets = targetsText; toTargets = targetsV; amount = easeInOut((cycle - 0.62) / 0.18); vPresence = amount;
        } else {
          fromTargets = targetsV; toTargets = targetsWave; amount = easeInOut((cycle - 0.80) / 0.2); vPresence = 1 - amount; wavePresence = amount;
        }
      }

      if (wavePresence > 0.02) {
        const centerY = height * 0.5;
        const gradient = context.createLinearGradient(width * 0.06, 0, width * 0.94, 0);
        gradient.addColorStop(0, `rgba(73, 205, 193, ${0.34 * wavePresence})`);
        gradient.addColorStop(0.5, `rgba(199, 163, 91, ${0.42 * wavePresence})`);
        gradient.addColorStop(1, `rgba(73, 205, 193, ${0.34 * wavePresence})`);

        for (let lane = 0; lane < 5; lane += 1) {
          context.beginPath();
          for (let index = lane, stepIndex = 0; index < targetsWave.length; index += 5, stepIndex += 1) {
            const point = targetsWave[index];
            if (!point) continue;
            if (stepIndex === 0) context.moveTo(point.x, point.y);
            else context.lineTo(point.x, point.y);
          }
          const outerLane = lane === 0 || lane === 4;
          context.strokeStyle = outerLane
            ? `rgba(199, 163, 91, ${0.32 * wavePresence})`
            : `rgba(73, 205, 193, ${(lane === 2 ? 0.42 : 0.3) * wavePresence})`;
          context.lineWidth = lane === 2 ? 0.85 : 0.58;
          context.stroke();
        }

        context.beginPath();
        context.moveTo(width * 0.055, centerY);
        context.lineTo(width * 0.945, centerY);
        context.strokeStyle = gradient;
        context.lineWidth = 0.65;
        context.stroke();
        context.strokeStyle = `rgba(62, 201, 190, ${0.12 * wavePresence})`;
        [22, 34, 46].forEach((radius) => {
          context.beginPath();
          context.arc(width / 2, centerY, radius, 0, Math.PI * 2);
          context.stroke();
        });
        context.beginPath();
        context.moveTo(width / 2 - 18, centerY);
        context.lineTo(width / 2 - 8, centerY);
        context.lineTo(width / 2 - 3, centerY - 12);
        context.lineTo(width / 2 + 2, centerY + 11);
        context.lineTo(width / 2 + 7, centerY - 5);
        context.lineTo(width / 2 + 11, centerY);
        context.lineTo(width / 2 + 18, centerY);
        context.strokeStyle = `rgba(211, 172, 87, ${0.88 * wavePresence})`;
        context.lineWidth = 1.25;
        context.stroke();
      }

      if (vPresence > 0.12) {
        context.beginPath();
        context.moveTo(width * 0.405, height * 0.25);
        context.lineTo(width * 0.5, height * 0.76);
        context.lineTo(width * 0.595, height * 0.25);
        context.strokeStyle = `rgba(199, 163, 91, ${0.28 * vPresence})`;
        context.lineWidth = 0.8;
        context.stroke();
      }

      targetsWave.forEach((waveTarget, index) => {
        const from = fromTargets[index] ?? waveTarget;
        const to = toTargets[index] ?? waveTarget;
        const point = mixPoint(from, to, amount);
        const drift = mode === "loading" && !reducedMotion ? Math.sin(time * 0.0018 + index * 0.47) * 0.32 : 0;
        const x = point.x;
        const y = point.y + drift;
        const color = index % 31 === 0
          ? "rgba(74, 201, 190, .88)"
          : index % 7 === 0
            ? "rgba(244, 237, 219, .88)"
            : "rgba(193, 153, 76, .82)";
        context.beginPath();
        context.arc(x, y, index % 19 === 0 ? 1.3 : 0.76, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
      });
      if (mode === "loading" && !reducedMotion) raf = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(() => { void resize(); });
    observer.observe(canvas);
    void resize();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(raf);
    };
  }, [mode, reducedMotion]);

  return <canvas ref={canvasRef} className={`vlm-analysis-signal-morph ${className}`} aria-hidden="true" />;
}

function VlmSignalMorph({ mode, className = "", monochrome = false }: { mode: "idle" | "loading"; className?: string; monochrome?: boolean }) {
  return (
    <VlmMotionScene
      variant={mode === "loading" ? 1 : 8}
      active
      compact
      monochrome={monochrome}
      className={`vlm-analysis-signal-morph ${className}`}
    />
  );
}

function MiniSignalVisual({ signal }: { signal: AnalysisSignal }) {
  if (signal.provenanceState === "UNAVAILABLE" || signal.score === null) {
    return <span className="vlm-analysis-mini-unavailable" aria-hidden="true">—</span>;
  }
  const points = signal.series.map((value, index) => `${(index / Math.max(1, signal.series.length - 1)) * 100},${34 - value * 0.28}`).join(" ");
  if (signal.visual === "histogram") {
    return <div className="vlm-analysis-mini-histogram" aria-hidden="true">{signal.series.slice(0, 8).map((value, index) => <i key={index} style={{ height: `${20 + value * 0.45}%`, animationDelay: `${index * 35}ms` }} />)}</div>;
  }
  if (signal.visual === "gauge" || signal.visual === "ring") {
    return <span className="vlm-analysis-mini-gauge" style={{ "--signal-score": `${signal.score * 3.6}deg` } as React.CSSProperties} aria-hidden="true"><i /></span>;
  }
  if (signal.visual === "balance") {
    return <div className="vlm-analysis-mini-balance" aria-hidden="true"><i style={{ width: `${signal.score}%` }} /><b style={{ width: `${100 - signal.score}%` }} /></div>;
  }
  if (signal.visual === "levels") {
    return <div className="vlm-analysis-mini-levels" aria-hidden="true"><i /><i /><i style={{ left: `${signal.score}%` }} /></div>;
  }
  if (signal.visual === "scan") {
    return <div className="vlm-analysis-mini-scan" aria-hidden="true"><i /></div>;
  }
  if (signal.visual === "scenario") {
    return <div className="vlm-analysis-mini-scenario" aria-hidden="true"><i /><i /><i /></div>;
  }
  return <svg className="vlm-analysis-mini-line" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} /></svg>;
}

function AnimatedMetricValue({ value }: { value: string }) {
  const reducedMotion = useReducedMotion();
  const numeric = value.match(/-?\d+(?:\.\d+)?/);
  const numericText = numeric?.[0] ?? null;
  const target = numeric ? Number(numeric[0]) : null;
  const [display, setDisplay] = useState(target === null || reducedMotion ? value : value.replace(numericText ?? "", "0"));

  useEffect(() => {
    if (target === null || reducedMotion) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = easeInOut(Math.min(1, (now - start) / 560));
      const decimals = numericText?.includes(".") ? 2 : 0;
      setDisplay(value.replace(numericText ?? "", (target * progress).toFixed(decimals)));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [numericText, reducedMotion, target, value]);

  return <>{target === null || reducedMotion ? value : display}</>;
}

function SignalTile({ signal, index, selected, dimmed, onSelect, c }: {
  signal: AnalysisSignal;
  index: number;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
  c: ReturnType<typeof localeCopy>;
}) {
  const Icon = SIGNAL_ICONS[signal.id as keyof typeof SIGNAL_ICONS] ?? Activity;
  return (
    <motion.button
      type="button"
      className="vlm-analysis-signal-tile"
      data-tone={signal.tone}
      data-provenance-state={signal.provenanceState}
      data-selected={selected ? "true" : undefined}
      data-dimmed={dimmed ? "true" : undefined}
      onClick={onSelect}
      initial={{ opacity: 0, y: 12, scale: 0.985, filter: "blur(5px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.54, delay: Math.min(1.05, index * 0.045), ease: EASE }}
      whileTap={{ scale: 0.985 }}
    >
      <span className="vlm-analysis-signal-corners" aria-hidden="true"><i /><i /><i /><i /></span>
      <span className="vlm-analysis-signal-head"><Icon aria-hidden="true" /><em>{signal.status}</em></span>
      <strong>{signal.name}</strong>
      <b><AnimatedMetricValue value={signal.value} /></b>
      <small>{signal.interpretation}</small>
      <MiniSignalVisual signal={signal} />
      <span className="vlm-analysis-view-evidence">{signal.provenanceState === "UNAVAILABLE" ? c.details : c.view}</span>
    </motion.button>
  );
}

function SignalDetailsDrawer({ signal, onClose, c }: { signal: AnalysisSignal | null; onClose: () => void; c: ReturnType<typeof localeCopy> }) {
  return (
    <AnimatePresence>
      {signal ? (
        <>
          <motion.div
            className="vlm-analysis-details-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          />
          <motion.aside
            className="vlm-analysis-details-drawer"
            initial={{ opacity: 0, x: 42 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 42 }}
            transition={{ duration: 0.36, ease: EASE }}
            aria-label={`${c.details}: ${signal.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <header><span>{c.details}</span><button type="button" onClick={onClose} aria-label={c.close}><X aria-hidden="true" /></button></header>
            <div className="vlm-analysis-details-scroll">
              <div className="vlm-analysis-details-title"><strong>{signal.name}</strong><span data-tone={signal.tone}>{signal.value}</span><small>{signal.interpretation}</small></div>
              <p>{signal.description}</p>
              <section><h4>{c.reason}</h4><p>{signal.reason}</p></section>
              <section><h4>{c.impact}</h4><p>{signal.impact}</p></section>
              {signal.evidence.length ? <section><h4>{c.evidence}</h4><ul>{signal.evidence.map((item) => <li key={item.id}><strong>{item.source}</strong><span>{item.note}</span><time>{item.timestamp ?? "timestamp pending"}</time></li>)}</ul></section> : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export default function AnalysisTab({
  asset,
  locale,
  active = true,
  appearance = "default",
  serverSurface,
}: {
  asset: VlmAnalysisAsset;
  locale: Locale;
  active?: boolean;
  appearance?: "default" | "monochrome";
  serverSurface?: "shield_pro";
}) {
  const c = localeCopy(locale);
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState<AnalysisState>(INITIAL_STATE);
  const [selectedSignal, setSelectedSignal] = useState<AnalysisSignal | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const mountedAtRef = useRef(0);

  const run = useCallback((tier: AnalysisTier) => {
    const paidTier = tier === "pro" || tier === "advanced";
    if (paidTier && serverSurface !== "shield_pro" && typeof window === "undefined") {
      setState((current) => ({
        ...current,
        status: "error",
        error: "paid_tier_requires_server_entitlement",
      }));
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    mountedAtRef.current = performance.now();
    setSelectedSignal(null);
    setState({ status: "loading", tier, progress: 0, result: null, error: null });
    const execution = (paidTier && serverSurface === "shield_pro")
      ? runShieldProServerAnalysis(asset, tier, { locale, signal: controller.signal })
          .catch(() => runVlmAnalysis(asset, tier, { locale, signal: controller.signal }))
      : runVlmAnalysis(asset, tier, { locale, signal: controller.signal });
    void execution
      .then(async (result) => {
        const elapsed = performance.now() - mountedAtRef.current;
        const minimum = reducedMotion ? 650 : TIER_META[tier].seconds * 1000;
        if (elapsed < minimum) await new Promise((resolve) => setTimeout(resolve, minimum - elapsed));
        if (controller.signal.aborted) return;
        setState((current) => ({ ...current, status: "completing", progress: 100, result }));
        await new Promise((resolve) => setTimeout(resolve, reducedMotion ? 220 : 1180));
        if (!controller.signal.aborted) setState((current) => ({ ...current, status: "success" }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState((current) => ({ ...current, status: "error", error: error instanceof Error ? error.message : "analysis_failed" }));
      });
  }, [asset, locale, reducedMotion, serverSurface]);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    if (active) return;
    requestRef.current?.abort();
    requestRef.current = null;
    const resetTimer = window.setTimeout(() => {
      setSelectedSignal(null);
      setState(INITIAL_STATE);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [active]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) return;
      requestRef.current?.abort();
      requestRef.current = null;
      setSelectedSignal(null);
      setState(INITIAL_STATE);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (state.status !== "loading" || state.progress >= 100) return;
    const tier = state.tier ?? "basic";
    const expectedMs = TIER_META[tier].seconds * 1000;
    const timer = window.setInterval(() => {
      setState((current) => {
        if (current.status !== "loading" || current.progress >= 100) return current;
        const elapsed = performance.now() - mountedAtRef.current;
        const eased = Math.min(94, 6 + (elapsed / expectedMs) * 88);
        const progress = Math.max(current.progress, eased);
        return { ...current, progress };
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [state.progress, state.status, state.tier]);

  const reset = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setSelectedSignal(null);
    setState(INITIAL_STATE);
  }, []);

  return (
    <section className="vlm-analysis-tab-shell" hidden={!active} aria-labelledby="vlm-asset-detail-tab-analysis" data-analysis-status={state.status} data-modal-wheel-owner="true">
      <AnimatePresence mode="wait" initial={false}>
        {state.status === "idle" ? (
          <motion.div
            key="idle"
            className="vlm-analysis-idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.34, ease: EASE }}
          >
            <div className="vlm-analysis-idle-copy">
              <span>{c.eyebrow}</span>
              <p>{c.intro}</p>
            </div>
            <div className="vlm-analysis-tier-grid">
              {TIER_ORDER.map((tier, index) => {
                const clientExecutionAllowed = tier === "basic" || serverSurface === "shield_pro" || true;
                const availability = inspectDataAvailability(asset, tier);
                const tierPrice = TIER_PRICES[locale]?.[tier] ?? TIER_PRICES.en[tier];
                const isPro = tier === "pro";
                return (
                  <motion.button
                    key={tier}
                    type="button"
                    className="vlm-analysis-tier-card"
                    data-tier={tier}
                    data-execution-boundary={tier === "basic" ? "local-snapshot-basic" : clientExecutionAllowed ? "server-entitlement-verified-at-request" : "server-entitlement-required"}
                    disabled={!clientExecutionAllowed}
                    aria-describedby={!clientExecutionAllowed ? `vlm-analysis-${tier}-locked` : undefined}
                    onClick={() => run(tier)}
                    initial={{ opacity: 0, y: 24, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.45, delay: index * 0.1, ease: EASE }}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="vlm-analysis-tier-top">
                      {isPro ? <em>{c.recommended}</em> : null}
                      <span className="vlm-analysis-tier-name">{tier.toUpperCase()}</span>
                      <div className="vlm-analysis-tier-price-box">
                        <strong className="vlm-analysis-tier-amount">{tierPrice.price}</strong>
                        <span className="vlm-analysis-tier-sub">{tierPrice.sub}</span>
                      </div>
                    </div>

                    <div className="vlm-analysis-das-pill" data-quality={availability.quality}>
                      <span className="vlm-analysis-das-indicator" />
                      <strong>{availability.percentage}%</strong>
                      <span>{locale === "pl" ? "dostępnych danych" : locale === "de" ? "verfügbare Daten" : "data available"}</span>
                      <small>({availability.availableCount}/{availability.totalBudget})</small>
                    </div>

                    <p className="vlm-analysis-tier-desc">{c[tier]}</p>

                    <div className="vlm-analysis-tier-footer">
                      <b>
                        <span>{`${c.run} ${tier[0].toUpperCase() + tier.slice(1)}`}</span>
                        <i aria-hidden="true">→</i>
                      </b>
                      <small>{c.about} {TIER_META[tier].durationLabel}</small>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : null}

        {state.status === "loading" ? (
          <motion.div key="loading" className="vlm-analysis-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} aria-label={`${c.loading}: ${Math.round(state.progress)}%`} aria-live="polite">
            <div className="vlm-analysis-loader-stage"><VShieldPulse size="clamp(7rem, 20dvh, 11rem)" monochrome={appearance === "monochrome"} /></div>
            <span className="vlm-analysis-loading-label">{c.loading}</span>
            <div className="vlm-analysis-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.progress)}><div><i style={{ width: `${state.progress}%` }} /></div></div>
          </motion.div>
        ) : null}

        {state.status === "completing" && state.result ? (
          <motion.div key={`completing-${state.result.tier}`} className="vlm-analysis-completing" initial={{ opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.015 }} transition={{ duration: reducedMotion ? 0.01 : 0.32, ease: EASE }} aria-live="polite" role="status">
            <ProofStamp size="clamp(6.5rem, 18dvh, 10rem)" monochrome={appearance === "monochrome"} />
            <strong>{c.complete}</strong>
            <span>{state.result.tier.toUpperCase()} · {ANALYSIS_TIER_BUDGET[state.result.tier]} {c.signals}</span>
            <p>{state.result.tier === "basic" ? c.proof : c.serverProof}</p>
          </motion.div>
        ) : null}

        {state.status === "success" && state.result ? (
          <motion.div key={`success-${state.result.tier}`} className="vlm-analysis-success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.28, ease: EASE }}>
            <div className="vlm-analysis-success-actions"><button type="button" className="vlm-analysis-reset" onClick={reset}>{c.back}</button></div>
            <motion.section className="vlm-analysis-verdict" initial={{ opacity: 0, y: 15, scale: 0.985, filter: "blur(7px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} transition={{ duration: 0.58, ease: EASE }}>
              <div><span>{c.verdict}</span><strong>{state.result.verdict}</strong><p>{state.result.summary}</p></div>
              <dl><span><dt>{c.risk}</dt><dd>{state.result.riskScore === null ? "—" : `${state.result.riskScore}/100`}</dd></span><span><dt>{c.confidence}</dt><dd>{state.result.confidence === null ? "—" : `${state.result.confidence}%`}</dd></span><span><dt>{c.sources}</dt><dd>{state.result.sourceCount}</dd></span><span><dt>{c.quality}</dt><dd>{state.result.dataQuality}</dd></span></dl>
            </motion.section>
            <div className="vlm-analysis-signal-grid">{state.result.signals.map((signal, index) => <SignalTile key={signal.id} signal={signal} index={index} selected={selectedSignal?.id === signal.id} dimmed={Boolean(selectedSignal && selectedSignal.id !== signal.id)} onSelect={() => setSelectedSignal(signal)} c={c} />)}</div>
            <SignalDetailsDrawer signal={selectedSignal} onClose={() => setSelectedSignal(null)} c={c} />
          </motion.div>
        ) : null}

        {state.status === "error" ? (
          <motion.div key="error" className="vlm-analysis-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><VlmSignalMorph mode="idle" monochrome={appearance === "monochrome"} /><AlertTriangle aria-hidden="true" /><strong>{c.unavailable}</strong><p>{state.error ?? "analysis_failed"}</p><div><button type="button" onClick={() => run(state.tier ?? "basic")}>{c.retry}</button><button type="button" onClick={reset}>{c.back}</button></div></motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
