"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  BookOpenCheck,
  Check,
  CircleDot,
  Database,
  Info,
  Layers,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import type { IntelligenceTier } from "./IntelligenceInteractive";
import styles from "./IntelligenceLuxury.module.css";

type TierId = IntelligenceTier["id"];

export type SqueezeExperienceCopy = {
  aria: string;
  status: string;
  replay: string;
  selectLabel: string;
  legend: [string, string, string];
  phasesLabel: string;
  scenarios: Array<{
    id: "short" | "long" | "vacuum" | "whale";
    label: string;
    symbol: string;
    zone: string;
    event: string;
    headline: string;
    description: string;
    phases: [string, string, string];
    stats: Array<{ label: string; value: string }>;
  }>;
};

export type LiquidityExperienceCopy = {
  aria: string;
  status: string;
  metrics: Array<{ label: string; value: string }>;
  labels: {
    source: string;
    book: string;
    curve: string;
    consumed: string;
    remaining: string;
    reading: string;
  };
  bands: [string, string, string, string];
  flowSteps: [string, string, string, string];
  reading: string;
  caption: string;
};

export type AngelExperienceCopy = {
  aria: string;
  status: string;
  scope: string;
  evidence: string;
  confidence: string;
  missing: string;
  prompt: string;
  packet: string;
  traceLabel: string;
  gateLabel: string;
  trace: Array<{ label: string; state: string }>;
  questions: Array<{
    tab: string;
    question: string;
    answer: string;
    evidence: string[];
    confidence: string;
    missing: string;
  }>;
};

type TierDetail = {
  summary: string;
  bestFor: string;
  deliverable: string;
  boundary: string;
};

type TierDeckCopy = {
  marketTab: string;
  auditTab: string;
  recommended: string;
  signals: string;
  info: string;
  close: string;
  includes: string;
  bestFor: string;
  deliverable: string;
  boundary: string;
  note: string;
  details: {
    market: Record<TierId, TierDetail>;
    audit: Record<TierId, TierDetail>;
  };
};

type TierDeckProps = {
  copy: TierDeckCopy;
  marketTiers: IntelligenceTier[];
  auditTiers: IntelligenceTier[];
  marketFeatures: Record<TierId, string[]>;
  auditFeatures: Record<TierId, string[]>;
};

type ScenarioId = SqueezeExperienceCopy["scenarios"][number]["id"];
type Candle = readonly [open: number, close: number, high: number, low: number, volume: number];

const scenarioCloses: Record<ScenarioId, readonly number[]> = {
  short: [100.8, 100.2, 101.1, 100.7, 101.5, 101.8, 101.1, 102.0, 102.2, 101.7, 102.5, 102.1, 102.8, 102.4, 103.0, 102.7, 103.4, 104.0, 106.1, 109.4, 114.8, 123.9, 122.1, 126.4, 125.6, 128.8],
  long: [129.0, 129.8, 129.1, 130.0, 129.6, 130.4, 129.8, 130.1, 129.5, 130.0, 129.4, 129.8, 129.0, 129.3, 128.8, 128.5, 127.9, 126.8, 124.2, 120.1, 114.6, 106.7, 108.0, 103.8, 105.2, 101.6],
  vacuum: [112.0, 112.4, 112.1, 112.7, 112.5, 112.9, 112.6, 113.0, 112.8, 113.2, 113.1, 113.4, 113.0, 113.5, 113.3, 113.6, 113.2, 113.7, 113.4, 113.8, 113.5, 119.8, 121.3, 120.6, 123.2, 122.5],
  whale: [124.0, 124.6, 125.1, 124.8, 125.6, 126.2, 126.0, 126.7, 127.1, 126.8, 127.5, 128.0, 127.8, 128.4, 128.1, 127.5, 126.8, 125.9, 124.6, 122.0, 118.3, 112.4, 108.7, 106.1, 103.8, 102.5],
};

const scenarioVolumes: Record<ScenarioId, readonly number[]> = {
  short: [22, 17, 24, 19, 23, 26, 20, 28, 24, 21, 30, 25, 29, 23, 27, 28, 34, 39, 55, 69, 88, 100, 82, 71, 61, 56],
  long: [20, 22, 18, 24, 20, 25, 19, 23, 18, 22, 20, 24, 23, 27, 29, 31, 38, 46, 58, 73, 91, 100, 84, 75, 64, 59],
  vacuum: [18, 16, 17, 19, 17, 18, 16, 20, 18, 19, 17, 20, 18, 19, 17, 18, 16, 17, 15, 14, 13, 66, 58, 49, 55, 43],
  whale: [24, 22, 27, 23, 29, 31, 26, 30, 32, 27, 34, 36, 31, 38, 34, 37, 42, 49, 57, 68, 83, 100, 94, 82, 71, 64],
};

const scenarioMeta: Record<ScenarioId, { eventIndex: number; zoneStart: number; zoneEnd: number }> = {
  short: { eventIndex: 21, zoneStart: 17, zoneEnd: 20 },
  long: { eventIndex: 21, zoneStart: 16, zoneEnd: 20 },
  vacuum: { eventIndex: 21, zoneStart: 15, zoneEnd: 20 },
  whale: { eventIndex: 21, zoneStart: 15, zoneEnd: 20 },
};

function buildCandles(id: ScenarioId): Candle[] {
  const closes = scenarioCloses[id];
  const volumes = scenarioVolumes[id];
  return closes.map((close, index) => {
    const open = index === 0 ? close - (id === "long" || id === "whale" ? -0.7 : 0.7) : closes[index - 1];
    const spread = 0.65 + (index % 4) * 0.17 + (index >= 19 ? 0.35 : 0);
    return [open, close, Math.max(open, close) + spread, Math.min(open, close) - spread * 0.82, volumes[index]] as const;
  });
}

const squeezeCandles: Record<ScenarioId, Candle[]> = {
  short: buildCandles("short"),
  long: buildCandles("long"),
  vacuum: buildCandles("vacuum"),
  whale: buildCandles("whale"),
};

interface OrderbookLevel {
  price: string;
  size: string;
  pct: number;
}

interface ScenarioPhaseData {
  mid: string;
  spread: string;
  imbalance: number;
  imbalanceLabel: string;
  asks: OrderbookLevel[];
  bids: OrderbookLevel[];
  tape: Array<{ action: "BUY" | "SELL" | "CANCEL"; text: string; tag?: string }>;
  mechanism: string;
  candleRange: [start: number, end: number];
}

const scenarioPhaseData: Record<ScenarioId, [ScenarioPhaseData, ScenarioPhaseData, ScenarioPhaseData]> = {
  short: [
    {
      mid: "$102.70",
      spread: "1.2 bps",
      imbalance: 54,
      imbalanceLabel: "+54% BID DOMINANT",
      asks: [
        { price: "103.50", size: "45.2k", pct: 45 },
        { price: "103.20", size: "58.1k", pct: 58 },
        { price: "103.00", size: "72.4k", pct: 72 },
        { price: "102.90", size: "88.0k", pct: 88 },
        { price: "102.80", size: "95.5k", pct: 95 },
      ],
      bids: [
        { price: "102.60", size: "92.0k", pct: 92 },
        { price: "102.50", size: "84.3k", pct: 84 },
        { price: "102.30", size: "76.1k", pct: 76 },
        { price: "102.00", size: "65.0k", pct: 65 },
        { price: "101.80", size: "50.2k", pct: 50 },
      ],
      tape: [
        { action: "SELL", text: "2.4 BTC @ 102.65" },
        { action: "BUY", text: "3.1 BTC @ 102.75" },
        { action: "BUY", text: "4.8 BTC @ 102.80", tag: "WALL TEST" },
      ],
      mechanism: "Ciasny zakres konsolidacji. Pasywne zlecenia ask blokują opór, podczas gdy pod spodem narasta agresywna akumulacja.",
      candleRange: [0, 16],
    },
    {
      mid: "$114.80",
      spread: "3.8 bps",
      imbalance: 79,
      imbalanceLabel: "+79% BUYING PRESSURE",
      asks: [
        { price: "116.50", size: "18.4k", pct: 18 },
        { price: "115.80", size: "12.2k", pct: 12 },
        { price: "115.20", size: "6.1k", pct: 6 },
        { price: "115.00", size: "2.4k", pct: 2 },
        { price: "114.90", size: "0.9k", pct: 1 },
      ],
      bids: [
        { price: "114.60", size: "145.0k", pct: 98 },
        { price: "114.20", size: "128.5k", pct: 87 },
        { price: "113.80", size: "115.0k", pct: 78 },
        { price: "113.20", size: "98.2k", pct: 66 },
        { price: "112.50", size: "84.0k", pct: 57 },
      ],
      tape: [
        { action: "BUY", text: "18.5 BTC @ 114.80", tag: "MKT BUY" },
        { action: "BUY", text: "24.2 BTC @ 115.20", tag: "BREAKOUT" },
        { action: "BUY", text: "38.0 BTC @ 116.50", tag: "STOPS TRIGGERED" },
      ],
      mechanism: "Przebicie oporu wyzwala zlecenia stop-loss. Agresywny popyt zmiata oferty sprzedaży z arkusza.",
      candleRange: [16, 21],
    },
    {
      mid: "$128.80",
      spread: "6.5 bps",
      imbalance: 91,
      imbalanceLabel: "+91% FORCED COVERING",
      asks: [
        { price: "130.50", size: "9.1k", pct: 9 },
        { price: "129.80", size: "6.4k", pct: 6 },
        { price: "129.20", size: "3.8k", pct: 4 },
        { price: "129.00", size: "1.8k", pct: 2 },
        { price: "128.90", size: "0.5k", pct: 1 },
      ],
      bids: [
        { price: "128.50", size: "210.0k", pct: 100 },
        { price: "128.00", size: "185.0k", pct: 88 },
        { price: "127.20", size: "160.0k", pct: 76 },
        { price: "126.50", size: "134.0k", pct: 64 },
        { price: "125.80", size: "110.0k", pct: 52 },
      ],
      tape: [
        { action: "BUY", text: "45.0 BTC @ 123.90", tag: "FORCED COVER" },
        { action: "BUY", text: "62.4 BTC @ 126.40", tag: "LIQUIDATION" },
        { action: "BUY", text: "31.8 BTC @ 128.80", tag: "FORCED COVER" },
      ],
      mechanism: "Wymuszony squeeze. Shortujący muszą odkupywać po każdej cenie, arkusz po stronie ask jest niemal pusty.",
      candleRange: [21, 25],
    },
  ],
  long: [
    {
      mid: "$128.50",
      spread: "1.4 bps",
      imbalance: 51,
      imbalanceLabel: "BALANCED SUPPORT",
      asks: [
        { price: "129.50", size: "52.0k", pct: 52 },
        { price: "129.20", size: "64.0k", pct: 64 },
        { price: "129.00", size: "78.0k", pct: 78 },
        { price: "128.80", size: "85.0k", pct: 85 },
        { price: "128.60", size: "90.0k", pct: 90 },
      ],
      bids: [
        { price: "128.40", size: "95.0k", pct: 95 },
        { price: "128.20", size: "110.0k", pct: 98 },
        { price: "128.00", size: "135.0k", pct: 100 },
        { price: "127.80", size: "68.0k", pct: 68 },
        { price: "127.50", size: "50.0k", pct: 50 },
      ],
      tape: [
        { action: "SELL", text: "12.0 ETH @ 128.50" },
        { action: "BUY", text: "8.5 ETH @ 128.55" },
        { action: "SELL", text: "15.2 ETH @ 128.40", tag: "SUPPORT TEST" },
      ],
      mechanism: "Cena wielokrotnie testuje poziom wsparcia. Płytkie odbicia sygnalizują wyczerpanie kupujących.",
      candleRange: [0, 15],
    },
    {
      mid: "$114.60",
      spread: "4.8 bps",
      imbalance: 22,
      imbalanceLabel: "-78% SELLING AVALANCHE",
      asks: [
        { price: "116.00", size: "155.0k", pct: 95 },
        { price: "115.50", size: "140.0k", pct: 88 },
        { price: "115.20", size: "125.0k", pct: 78 },
        { price: "114.90", size: "110.0k", pct: 68 },
        { price: "114.70", size: "98.0k", pct: 60 },
      ],
      bids: [
        { price: "114.40", size: "14.0k", pct: 14 },
        { price: "114.00", size: "8.5k", pct: 8 },
        { price: "113.50", size: "4.2k", pct: 4 },
        { price: "113.00", size: "2.1k", pct: 2 },
        { price: "112.50", size: "0.8k", pct: 1 },
      ],
      tape: [
        { action: "SELL", text: "150 ETH @ 120.10", tag: "MKT SELL" },
        { action: "SELL", text: "280 ETH @ 116.50", tag: "LIQUIDATION" },
        { action: "SELL", text: "410 ETH @ 114.60", tag: "STOP CASCADE" },
      ],
      mechanism: "Wsparcie pęka. Zlecenia stop-loss pozycji długich przekształcają się w lawinę zleceń sprzedaży.",
      candleRange: [15, 21],
    },
    {
      mid: "$101.60",
      spread: "9.2 bps",
      imbalance: 8,
      imbalanceLabel: "-92% TOTAL PANIC",
      asks: [
        { price: "105.00", size: "220.0k", pct: 100 },
        { price: "104.20", size: "195.0k", pct: 90 },
        { price: "103.50", size: "170.0k", pct: 78 },
        { price: "102.80", size: "145.0k", pct: 66 },
        { price: "102.00", size: "120.0k", pct: 55 },
      ],
      bids: [
        { price: "101.20", size: "6.2k", pct: 6 },
        { price: "100.80", size: "3.5k", pct: 3 },
        { price: "100.20", size: "1.8k", pct: 2 },
        { price: "99.50", size: "0.9k", pct: 1 },
        { price: "98.00", size: "0.3k", pct: 1 },
      ],
      tape: [
        { action: "SELL", text: "580 ETH @ 106.70", tag: "MARGIN CALL" },
        { action: "SELL", text: "320 ETH @ 103.80", tag: "LIQUIDATION" },
        { action: "SELL", text: "240 ETH @ 101.60", tag: "FORCED EXIT" },
      ],
      mechanism: "Delewarowanie rynku. Likwidacje zabezpieczeń uderzają w pusty arkusz, wywołując gwałtowną przecenę.",
      candleRange: [21, 25],
    },
  ],
  vacuum: [
    {
      mid: "$113.50",
      spread: "1.1 bps",
      imbalance: 50,
      imbalanceLabel: "BALANCED DEPTH",
      asks: [
        { price: "114.20", size: "48.0k", pct: 65 },
        { price: "114.00", size: "55.0k", pct: 75 },
        { price: "113.80", size: "62.0k", pct: 84 },
        { price: "113.65", size: "70.0k", pct: 92 },
        { price: "113.55", size: "75.0k", pct: 100 },
      ],
      bids: [
        { price: "113.45", size: "74.0k", pct: 98 },
        { price: "113.35", size: "68.0k", pct: 90 },
        { price: "113.20", size: "58.0k", pct: 77 },
        { price: "113.00", size: "50.0k", pct: 67 },
        { price: "112.80", size: "42.0k", pct: 56 },
      ],
      tape: [
        { action: "BUY", text: "12 SOL @ 113.55" },
        { action: "SELL", text: "15 SOL @ 113.45" },
        { action: "BUY", text: "8 SOL @ 113.55" },
      ],
      mechanism: "Księga w stanie równowagi. Animatorzy rynku zapewniają gęstą płynność przy cenie środkowej.",
      candleRange: [0, 18],
    },
    {
      mid: "$116.80",
      spread: "18.4 bps",
      imbalance: 46,
      imbalanceLabel: "3.9× SPREAD / HOLE",
      asks: [
        { price: "121.50", size: "18.0k", pct: 24 },
        { price: "120.80", size: "12.0k", pct: 16 },
        { price: "120.20", size: "7.5k", pct: 10 },
        { price: "119.80", size: "3.8k", pct: 5 },
        { price: "114.00", size: "VOID", pct: 0 },
      ],
      bids: [
        { price: "113.40", size: "4.2k", pct: 6 },
        { price: "113.00", size: "3.1k", pct: 4 },
        { price: "112.50", size: "2.4k", pct: 3 },
        { price: "112.00", size: "1.8k", pct: 2 },
        { price: "111.50", size: "1.0k", pct: 1 },
      ],
      tape: [
        { action: "CANCEL", text: "450 SOL @ 113.80", tag: "QUOTE PULLED" },
        { action: "CANCEL", text: "600 SOL @ 114.00", tag: "MM RETREAT" },
        { action: "CANCEL", text: "380 SOL @ 113.40", tag: "SPREAD BLOWOUT" },
      ],
      mechanism: "Wycofanie ofert przez algorytmy MM. Arkusz wokół ceny mid zostaje natychmiast opróżniony.",
      candleRange: [18, 21],
    },
    {
      mid: "$122.50",
      spread: "5.4 bps",
      imbalance: 62,
      imbalanceLabel: "+62% NEW ANCHOR",
      asks: [
        { price: "124.50", size: "35.0k", pct: 48 },
        { price: "124.00", size: "28.0k", pct: 38 },
        { price: "123.50", size: "22.0k", pct: 30 },
        { price: "123.00", size: "15.0k", pct: 20 },
        { price: "122.60", size: "8.0k", pct: 11 },
      ],
      bids: [
        { price: "122.40", size: "26.0k", pct: 35 },
        { price: "122.00", size: "21.0k", pct: 28 },
        { price: "121.50", size: "18.0k", pct: 24 },
        { price: "121.00", size: "14.0k", pct: 19 },
        { price: "120.60", size: "9.0k", pct: 12 },
      ],
      tape: [
        { action: "BUY", text: "45 SOL @ 119.80", tag: "GAP EXECUTION" },
        { action: "BUY", text: "22 SOL @ 121.30", tag: "SLIPPAGE" },
        { action: "BUY", text: "30 SOL @ 122.50", tag: "NEW LEVEL" },
      ],
      mechanism: "Skok ceny przez pustą przestrzeń. Nawet niewielkie zlecenie przeskakuje pasma i kotwiczy nową cenę.",
      candleRange: [21, 25],
    },
  ],
  whale: [
    {
      mid: "$127.50",
      spread: "1.3 bps",
      imbalance: 52,
      imbalanceLabel: "+52% NORMAL DEPTH",
      asks: [
        { price: "128.50", size: "42.0k", pct: 56 },
        { price: "128.20", size: "48.0k", pct: 64 },
        { price: "128.00", size: "55.0k", pct: 74 },
        { price: "127.80", size: "65.0k", pct: 87 },
        { price: "127.60", size: "72.0k", pct: 96 },
      ],
      bids: [
        { price: "127.40", size: "82.0k", pct: 100 },
        { price: "127.20", size: "75.0k", pct: 91 },
        { price: "127.00", size: "70.0k", pct: 85 },
        { price: "126.80", size: "62.0k", pct: 76 },
        { price: "126.50", size: "54.0k", pct: 66 },
      ],
      tape: [
        { action: "BUY", text: "120 TOKEN @ 127.60" },
        { action: "SELL", text: "85 TOKEN @ 127.40" },
        { action: "CANCEL", text: "INFLOW 8.4% DETECTED", tag: "ON-CHAIN ALERT" },
      ],
      mechanism: "Wykrycie transferu 8,4% podaży na giełdę. Arkusz jeszcze nie odczuł zlecenia, płynność standardowa.",
      candleRange: [0, 16],
    },
    {
      mid: "$118.30",
      spread: "5.6 bps",
      imbalance: 18,
      imbalanceLabel: "-82% ICEBERG SELLING",
      asks: [
        { price: "124.00", size: "350.0k", pct: 100 },
        { price: "122.50", size: "280.0k", pct: 80 },
        { price: "121.00", size: "210.0k", pct: 60 },
        { price: "119.50", size: "150.0k", pct: 43 },
        { price: "118.50", size: "95.0k", pct: 27 },
      ],
      bids: [
        { price: "118.10", size: "18.0k", pct: 12 },
        { price: "117.50", size: "12.0k", pct: 8 },
        { price: "116.80", size: "7.5k", pct: 5 },
        { price: "116.00", size: "4.2k", pct: 3 },
        { price: "115.20", size: "2.0k", pct: 1 },
      ],
      tape: [
        { action: "SELL", text: "2,500 TOKEN @ 124.60", tag: "ICEBERG 1" },
        { action: "SELL", text: "4,800 TOKEN @ 122.00", tag: "ICEBERG 2" },
        { action: "SELL", text: "6,200 TOKEN @ 118.30", tag: "ICEBERG 3" },
      ],
      mechanism: "Zlecenie iceberg systematycznie pochłania kolejne warstwy ofert kupna, przesuwając cenę w dół.",
      candleRange: [16, 21],
    },
    {
      mid: "$102.50",
      spread: "11.8 bps",
      imbalance: 6,
      imbalanceLabel: "-94% DEPTH EXHAUSTED",
      asks: [
        { price: "110.00", size: "420.0k", pct: 100 },
        { price: "108.00", size: "310.0k", pct: 74 },
        { price: "106.00", size: "240.0k", pct: 57 },
        { price: "104.50", size: "180.0k", pct: 43 },
        { price: "103.00", size: "110.0k", pct: 26 },
      ],
      bids: [
        { price: "102.00", size: "5.5k", pct: 5 },
        { price: "101.50", size: "3.2k", pct: 3 },
        { price: "100.80", size: "1.8k", pct: 2 },
        { price: "99.80", size: "0.9k", pct: 1 },
        { price: "98.50", size: "0.4k", pct: 1 },
      ],
      tape: [
        { action: "SELL", text: "8,500 TOKEN @ 112.40", tag: "VWAP -18.2%" },
        { action: "SELL", text: "PARTIAL FILL 87%", tag: "BOOK EXHAUSTED" },
        { action: "CANCEL", text: "UNFILLED 13%", tag: "SLIPPAGE CAP" },
      ],
      mechanism: "93% dostępnej głębokości zużyte. VWAP drastycznie odbiega od ceny początkowej, realizacja tylko 87%.",
      candleRange: [21, 25],
    },
  ],
};

function useOnceVisible<T extends HTMLElement>(threshold = 0.28) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, visible] as const;
}

export function IntelligenceScrollMotion() {
  useEffect(() => {
    const page = document.querySelector<HTMLElement>("[data-intelligence-page]");
    if (!page) return;
    page.dataset.motion = "ready";
    const nodes = Array.from(page.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((node) => { node.dataset.visible = "true"; });
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.visible = "true";
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12%", threshold: 0.08 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const page = document.querySelector<HTMLElement>("[data-intelligence-page]");
    if (!page) return;

    const handleAnchorClick = (event: globalThis.MouseEvent) => {
      const origin = event.target instanceof Element ? event.target : null;
      const anchor = origin?.closest<HTMLAnchorElement>('a[href^="#"]');
      const hash = anchor?.getAttribute("href");
      if (!hash || hash === "#") return;
      const target = document.getElementById(hash.slice(1));
      if (!target) return;

      event.preventDefault();
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      window.history.replaceState(null, "", hash);
    };

    page.addEventListener("click", handleAnchorClick);
    return () => page.removeEventListener("click", handleAnchorClick);
  }, []);

  return null;
}

export function SqueezeExperience({ copy }: { copy: SqueezeExperienceCopy }) {
  const [stageRef, visible] = useOnceVisible<HTMLDivElement>();
  const [run, setRun] = useState(0);
  const [scenarioId, setScenarioId] = useState<ScenarioId>("short");
  const [activePhase, setActivePhase] = useState<number>(0);

  const scenario = copy.scenarios.find((item) => item.id === scenarioId) ?? copy.scenarios[0];
  const candles = squeezeCandles[scenarioId];
  const meta = scenarioMeta[scenarioId];
  const phases = scenarioPhaseData[scenarioId];
  const currentPhaseData = phases[activePhase] ?? phases[0];

  const chartTop = 28;
  const chartBottom = 286;
  const prices = candles.flatMap(([, , high, low]) => [high, low]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const pricePadding = Math.max(2, (maxPrice - minPrice) * 0.08);
  const priceFloor = minPrice - pricePadding;
  const priceCeiling = maxPrice + pricePadding;
  const priceToY = (price: number) => chartBottom - ((price - priceFloor) / (priceCeiling - priceFloor)) * (chartBottom - chartTop);
  const eventCandle = candles[meta.eventIndex];
  const eventX = 42 + meta.eventIndex * 25.1 + 5;
  const eventY = priceToY(eventCandle[1]);
  const zoneX = 38 + meta.zoneStart * 25.1;
  const zoneWidth = Math.max(58, (meta.zoneEnd - meta.zoneStart + 1) * 25.1);
  const axisValues = Array.from({ length: 5 }, (_, index) => priceCeiling - ((priceCeiling - priceFloor) / 4) * index);

  // Auto-advance through the 3 phases on run or scenario change
  useEffect(() => {
    setActivePhase(0);
    const t1 = setTimeout(() => setActivePhase(1), 1100);
    const t2 = setTimeout(() => setActivePhase(2), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [scenarioId, run]);

  const selectScenario = (id: ScenarioId) => {
    setScenarioId(id);
    setRun((value) => value + 1);
  };

  const handlePhaseClick = (index: number) => {
    setActivePhase(index);
  };

  return (
    <div
      ref={stageRef}
      className={styles.squeezeExperience}
      data-active={visible ? "true" : "false"}
      data-scenario={scenarioId}
      aria-label={copy.aria}
    >
      <div className={styles.marketToolbar}>
        <span><i />{copy.status}</span>
        <b>{scenario.symbol}</b>
        <button type="button" onClick={() => setRun((value) => value + 1)}>
          <RefreshCw size={13} aria-hidden="true" />{copy.replay}
        </button>
      </div>

      <div className={styles.scenarioTabs} role="tablist" aria-label={copy.selectLabel}>
        {copy.scenarios.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={scenarioId === item.id}
            onClick={() => selectScenario(item.id)}
          >
            <small>0{index + 1}</small><span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.squeezeViewport}>
        <div className={styles.squeezeChart} key={run}>
          <svg viewBox="0 0 740 360" role="img" aria-label={copy.aria}>
            <defs>
              <linearGradient id="squeeze-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#42d6c4" stopOpacity=".16" />
                <stop offset="1" stopColor="#42d6c4" stopOpacity="0" />
              </linearGradient>
              <filter id="squeeze-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="8" />
              </filter>
            </defs>

            <g className={styles.chartGrid}>
              {[60, 116, 172, 228, 284].map((y) => <line key={y} x1="34" x2="700" y1={y} y2={y} />)}
              {[88, 212, 336, 460, 584].map((x) => <line key={x} x1={x} x2={x} y1="28" y2="286" />)}
            </g>
            <rect className={styles.squeezeZone} x={zoneX} y="44" width={zoneWidth} height="242" rx="5" />
            <text className={styles.squeezeZoneLabel} x={zoneX + 9} y="63">{scenario.zone}</text>

            <g className={styles.squeezeCandles}>
              {candles.map(([open, close, high, low, volume], index) => {
                const x = 42 + index * 25.1;
                const up = close >= open;
                const top = priceToY(Math.max(open, close));
                const bodyHeight = Math.max(3, Math.abs(priceToY(open) - priceToY(close)));
                const style = { "--candle-index": index } as CSSProperties;
                const isBreakout = index === meta.eventIndex;
                const inCurrentRange = index >= currentPhaseData.candleRange[0] && index <= currentPhaseData.candleRange[1];

                return (
                  <g
                    key={`${index}-${run}`}
                    className={`${styles.squeezeCandle} ${up ? styles.candleUp : styles.candleDown} ${isBreakout ? styles.breakoutCandle : ""}`}
                    style={style}
                    opacity={inCurrentRange ? 1 : 0.45}
                  >
                    <line x1={x + 5} x2={x + 5} y1={priceToY(high)} y2={priceToY(low)} />
                    <rect x={x} y={top} width="10" height={bodyHeight} rx="1.3" />
                    <rect className={styles.volumeBar} x={x + 1} y={338 - volume * .42} width="8" height={volume * .42} rx="1" />
                  </g>
                );
              })}
            </g>

            <g className={styles.squeezeBurst} style={{ "--event-x": `${eventX}px`, "--event-y": `${eventY}px` } as CSSProperties}>
              <circle cx={eventX} cy={eventY} r="31" filter="url(#squeeze-glow)" />
              <circle cx={eventX} cy={eventY} r="4" />
            </g>
            <g className={styles.marketEventLine}>
              <line x1={eventX} x2={eventX} y1="34" y2="286" />
              <circle cx={eventX} cy={eventY} r="3" />
            </g>
            <g className={styles.priceAxis}>
              {axisValues.map((value, index) => <text key={index} x="707" y={64 + index * 56}>{value.toFixed(0)}</text>)}
            </g>
            <text className={styles.squeezeEventLabel} x={Math.min(eventX + 11, 562)} y="44">{scenario.event}</text>
          </svg>
        </div>

        {/* Live Market Mechanics Orderbook Ladder */}
        <div className={styles.squeezeOrderbook}>
          <div className={styles.orderbookTopline}>
            <span><Layers size={11} aria-hidden="true" /> Live Orderbook Ladder</span>
            <small>Phase {activePhase + 1} / 3</small>
          </div>

          <div className={styles.orderbookImbalanceWrap}>
            <div className={styles.orderbookImbalanceLabels}>
              <span>Order Flow Imbalance</span>
              <span style={{ color: currentPhaseData.imbalance >= 50 ? "var(--teal)" : "#ea7a7e", fontWeight: 700 }}>
                {currentPhaseData.imbalanceLabel}
              </span>
            </div>
            <div className={styles.orderbookImbalanceBar}>
              <div
                className={styles.orderbookImbalanceBidFill}
                style={{ width: `${currentPhaseData.imbalance}%` }}
              />
            </div>
          </div>

          {/* Asks (Sell Orders) */}
          <div className={styles.orderbookLadder}>
            {currentPhaseData.asks.map((ask) => (
              <div key={ask.price} className={`${styles.orderbookRow} ${styles.orderbookAskRow}`}>
                <div className={styles.orderbookRowBar} style={{ width: `${ask.pct}%` }} />
                <span className={styles.orderbookRowPrice}>{ask.price}</span>
                <span className={styles.orderbookRowSize}>{ask.size}</span>
              </div>
            ))}
          </div>

          {/* Mid Price & Spread */}
          <div className={styles.orderbookMid}>
            <div className={styles.orderbookMidPrice}>
              {currentPhaseData.imbalance >= 50 ? (
                <TrendingUp size={11} style={{ color: "var(--teal)" }} aria-hidden="true" />
              ) : (
                <TrendingDown size={11} style={{ color: "#ea7a7e" }} aria-hidden="true" />
              )}
              <span>Mid: {currentPhaseData.mid}</span>
            </div>
            <span className={styles.orderbookSpread}>Spread: {currentPhaseData.spread}</span>
          </div>

          {/* Bids (Buy Orders) */}
          <div className={styles.orderbookLadder}>
            {currentPhaseData.bids.map((bid) => (
              <div key={bid.price} className={`${styles.orderbookRow} ${styles.orderbookBidRow}`}>
                <div className={styles.orderbookRowBar} style={{ width: `${bid.pct}%` }} />
                <span className={styles.orderbookRowPrice}>{bid.price}</span>
                <span className={styles.orderbookRowSize}>{bid.size}</span>
              </div>
            ))}
          </div>

          {/* Mechanism Insight */}
          <div className={styles.orderbookMechanism}>
            <strong><Zap size={9} style={{ display: "inline", marginRight: 4 }} aria-hidden="true" />Market Mechanics</strong>
            {currentPhaseData.mechanism}
          </div>

          {/* Order Flow Tape */}
          <div className={styles.orderbookTape}>
            <span className={styles.orderbookTapeTitle}>Recent Executions (Tape)</span>
            {currentPhaseData.tape.map((t, idx) => (
              <div key={idx} className={styles.orderbookTapeItem}>
                <span className={t.action === "BUY" ? styles.orderbookTapeBuy : t.action === "SELL" ? styles.orderbookTapeSell : styles.orderbookTapeCancel}>
                  {t.text}
                </span>
                {t.tag && <span className={styles.orderbookTapeTag}>{t.tag}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.scenarioReading} key={`${scenarioId}-reading`}>
        <div><span>{scenario.label}</span><h3>{scenario.headline}</h3><p>{scenario.description}</p></div>
        <ol aria-label={copy.phasesLabel}>
          {scenario.phases.map((phase, index) => (
            <li key={phase}>
              <button
                type="button"
                className={styles.scenarioPhaseBtn}
                data-active={activePhase === index ? "true" : "false"}
                onClick={() => handlePhaseClick(index)}
              >
                <small>0{index + 1}</small><span>{phase}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.marketLegend}>
        {copy.legend.map((item, index) => <span key={item}><i data-tone={index} />{item}</span>)}
      </div>
      <div className={styles.marketStats}>
        {scenario.stats.map((stat) => <div key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}
      </div>
    </div>
  );
}

export function LiquidityExperience({ copy }: { copy: LiquidityExperienceCopy }) {
  const [stageRef, visible] = useOnceVisible<HTMLDivElement>();
  const depthWidths = [94, 77, 58, 36];

  return (
    <div
      ref={stageRef}
      className={styles.liquidityExperience}
      data-active={visible ? "true" : "false"}
      aria-label={copy.aria}
    >
      <div className={styles.marketToolbar}>
        <span><i />{copy.status}</span>
        <b>MARKET IMPACT / DEPTH MODEL</b>
        <small>VLM—EXEC—04</small>
      </div>

      <div className={styles.liquidityCanvas}>
        <div className={styles.liquidityStageLabels} aria-hidden="true">
          <span>01 / {copy.labels.source}</span>
          <span>02 / {copy.labels.book}</span>
          <span>03 / {copy.labels.curve}</span>
        </div>

        <div className={styles.executionField} aria-hidden="true">
          <div className={styles.executionTicket}>
            <header><span>01 / {copy.labels.source}</span><small>ORDER / SLICED</small></header>
            <div className={styles.orderStack}>
              {[36, 52, 68, 84, 62, 44].map((height, index) => (
                <i
                  key={height + index}
                  style={{ "--slice-height": `${height}%`, "--slice-delay": `${index * 0.16}s` } as CSSProperties}
                />
              ))}
            </div>
            <div className={styles.orderReadout}>
              <span>{copy.metrics[0]?.label}</span>
              <b>{copy.metrics[0]?.value}</b>
            </div>
          </div>

          <div className={styles.depthMatrix}>
            <header><span>02 / {copy.labels.book}</span><small>DEPTH / VERIFIED</small></header>
            <div className={styles.depthRows}>
              {copy.bands.map((band, index) => (
                <div
                  key={band}
                  className={styles.depthRow}
                  style={{ "--depth": `${depthWidths[index] ?? 30}%`, "--row-delay": `${index * 0.24}s` } as CSSProperties}
                >
                  <small>0{index + 1}</small>
                  <span>{band}</span>
                  <i><b /></i>
                </div>
              ))}
            </div>
            <div className={styles.depthSweep} />
            <footer>
              <span>{copy.labels.consumed}<b>TOP → DEEP</b></span>
              <span>{copy.labels.remaining}<b>LIVE SNAPSHOT</b></span>
            </footer>
          </div>

          <div className={styles.impactPanel}>
            <header><span>03 / {copy.labels.curve}</span><small>IMPACT / BPS</small></header>
            <svg viewBox="0 0 260 180">
              <defs>
                <linearGradient id="impact-area-v4702" x1="0" x2="0" y1="0" y2="1">
                  <stop stopColor="#d3ad58" stopOpacity=".18" />
                  <stop offset="1" stopColor="#d3ad58" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className={styles.impactGridLine} d="M12 148H248M12 105H248M12 62H248" />
              <path className={styles.impactArea} d="M12 151 C64 149 91 132 121 110 S184 48 248 27 L248 168 L12 168Z" />
              <path className={styles.impactCurveLine} d="M12 151 C64 149 91 132 121 110 S184 48 248 27" />
              <circle className={styles.impactCursor} cx="0" cy="0" r="4">
                <animateMotion dur="6.4s" repeatCount="indefinite" path="M12 151 C64 149 91 132 121 110 S184 48 248 27" />
              </circle>
            </svg>
            <div className={styles.impactReadout}><span>{copy.metrics[3]?.label}</span><b>{copy.metrics[3]?.value}</b></div>
          </div>

          <div className={styles.executionPath}><i /><b /><span /></div>
        </div>
      </div>

      <ol className={styles.liquidityFlow} aria-label={copy.labels.reading}>
        {copy.flowSteps.map((step, index) => <li key={step}><small>0{index + 1}</small><span>{step}</span><i /></li>)}
      </ol>

      <div className={styles.liquidityMetrics}>
        {copy.metrics.map((metric) => (
          <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>
        ))}
      </div>
      <div className={styles.liquidityReading}><span>{copy.labels.reading}</span><p>{copy.reading}</p></div>
      <p className={styles.experienceCaption}><CircleDot size={13} />{copy.caption}</p>
    </div>
  );
}

export function AngelExperience({ copy }: { copy: AngelExperienceCopy }) {
  const [active, setActive] = useState(0);
  const item = copy.questions[active];

  return (
    <div className={styles.angelExperience} aria-label={copy.aria}>
      <div className={styles.angelOrbital} aria-hidden="true">
        <div className={styles.angelTraceTopline}><span><i />{copy.traceLabel}</span><b>PACKET / 07—A4</b></div>
        <div className={styles.angelPacketCore}>
          <Sparkles size={21} />
          <span>{copy.packet}</span>
          <strong>VLM / BRAIN</strong>
          <i /><i /><i />
        </div>
        <ol className={styles.angelTraceList}>
          {copy.trace.map((trace, index) => (
            <li key={trace.label} style={{ "--trace-index": index } as CSSProperties}>
              <small>0{index + 1}</small><span>{trace.label}</span><b>{trace.state}</b><i />
            </li>
          ))}
        </ol>
        <div className={styles.angelDecisionGate}>
          <span>{copy.gateLabel}</span>
          <div><i /><i /><i /></div>
          <b>ANSWER / BOUNDED</b>
        </div>
      </div>

      <div className={styles.angelConsole}>
        <div className={styles.angelConsoleTopline}>
          <span><i />{copy.status}</span>
          <b>VLM BRAIN / EVIDENCE MODE</b>
        </div>
        <div className={styles.angelQuestionTabs}>
          {copy.questions.map((question, index) => (
            <button key={question.question} type="button" aria-pressed={active === index} onClick={() => setActive(index)}>
              <small>0{index + 1}</small><span>{question.tab}</span>
            </button>
          ))}
        </div>
        <div className={styles.angelQuestion}><span>{copy.scope}</span><p>{item.question}</p></div>
        <div className={styles.angelAnswer} key={active}>
          <div className={styles.angelAnswerLead}><Sparkles size={14} /><p>{item.answer}</p></div>
          <ul>
            {item.evidence.map((evidence) => <li key={evidence}><i />{evidence}</li>)}
          </ul>
          <dl>
            <div><dt>{copy.confidence}</dt><dd>{item.confidence}</dd></div>
            <div><dt>{copy.missing}</dt><dd>{item.missing}</dd></div>
          </dl>
        </div>
        <div className={styles.angelPrompt}><BookOpenCheck size={15} /><span>{copy.prompt}</span><b>PACKET—BOUND</b></div>
      </div>
    </div>
  );
}

export function TierDeck({
  copy,
  marketTiers,
  auditTiers,
  marketFeatures,
  auditFeatures,
}: TierDeckProps) {
  const [mode, setMode] = useState<"market" | "audit">("market");
  const [selectedTierId, setSelectedTierId] = useState<TierId | null>(null);
  const tiers = mode === "market" ? marketTiers : auditTiers;
  const features = mode === "market" ? marketFeatures : auditFeatures;
  const selectedTier = tiers.find((tier) => tier.id === selectedTierId) ?? null;
  const selectedDetail = selectedTierId ? copy.details[mode][selectedTierId] : null;

  useEffect(() => {
    if (!selectedTierId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedTierId(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedTierId]);

  const setTierMode = (nextMode: "market" | "audit") => {
    setMode(nextMode);
    setSelectedTierId(null);
  };

  return (
    <div className={styles.tierDeck}>
      <div className={styles.tierTabs} role="tablist" aria-label={`${copy.marketTab} / ${copy.auditTab}`}>
        <button type="button" role="tab" aria-selected={mode === "market"} onClick={() => setTierMode("market")}>
          <Database size={14} />{copy.marketTab}
        </button>
        <button type="button" role="tab" aria-selected={mode === "audit"} onClick={() => setTierMode("audit")}>
          <CircleDot size={14} />{copy.auditTab}
        </button>
      </div>

      <div className={styles.tierCards} key={mode}>
        {tiers.map((tier, index) => (
          <article key={tier.id} data-tier={tier.id}>
            {tier.id === "pro" ? <span className={styles.recommended}>{copy.recommended}</span> : null}
            <div className={styles.tierCardTopline}><small>0{index + 1}</small><b>{tier.label}</b></div>
            <h3>{tier.subtitle}</h3>
            <div className={styles.tierPrice}>{tier.price}</div>
            <p className={styles.tierSignal}>{tier.signals} {copy.signals}</p>
            <ul>
              {features[tier.id].slice(0, 5).map((feature) => <li key={feature}><Check size={14} />{feature}</li>)}
            </ul>
            <button className={styles.tierInfoButton} type="button" onClick={() => setSelectedTierId(tier.id)}>
              <span><Info size={15} />{copy.info}</span><small>{copy.includes}</small>
            </button>
          </article>
        ))}
      </div>
      <p className={styles.tierNote}>{copy.note}</p>

      {selectedTier && selectedDetail && typeof document !== "undefined" ? createPortal(
        <div className={styles.tierModalBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedTierId(null);
        }}>
          <section className={styles.tierModal} role="dialog" aria-modal="true" aria-labelledby="tier-modal-title">
            <button className={styles.tierModalClose} type="button" onClick={() => setSelectedTierId(null)} aria-label={copy.close} autoFocus><X size={18} /></button>
            <div className={styles.tierModalTopline}><span>{mode === "market" ? copy.marketTab : copy.auditTab}</span><b>{selectedTier.signals} {copy.signals}</b></div>
            <div className={styles.tierModalHero}>
              <div><small>{selectedTier.id.toUpperCase()}</small><h3 id="tier-modal-title">{selectedTier.subtitle}</h3></div>
              <strong>{selectedTier.price}</strong>
            </div>
            <p className={styles.tierModalSummary}>{selectedDetail.summary}</p>
            <div className={styles.tierModalFacts}>
              <article><span>{copy.bestFor}</span><p>{selectedDetail.bestFor}</p></article>
              <article><span>{copy.deliverable}</span><p>{selectedDetail.deliverable}</p></article>
              <article><span>{copy.boundary}</span><p>{selectedDetail.boundary}</p></article>
            </div>
            <div className={styles.tierModalIncludes}>
              <span>{copy.includes}</span>
              <ul>{features[selectedTier.id].map((feature) => <li key={feature}><Check size={14} />{feature}</li>)}</ul>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
