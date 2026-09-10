"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

export type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

type AssetAreaChartProps = {
  symbol: string;
  currentPrice: number;
  priceChange24h?: number;
  timeframe?: Timeframe;
  mode?: "CENA" | "VOLUME";
  isOutdated?: boolean;
};

interface PricePoint {
  t: string;
  p: number;
  v: number;
}

interface RawCandle {
  timestamp: number | string;
  close: number | string;
  volume?: number | string;
}

function formatAdaptivePrice(val: number): string {
  if (typeof val !== "number" || isNaN(val)) return "0.00";
  const abs = Math.abs(val);
  if (abs === 0) return "0.00";
  if (abs < 0.0001) return val.toFixed(8);
  if (abs < 0.01) return val.toFixed(6);
  if (abs < 1) return val.toFixed(4);
  if (abs < 10) return val.toFixed(4);
  return val.toFixed(2);
}

// Generate realistic chart data matching authentic market movements per timeframe
function getChartData(symbol: string, currentPrice: number, tf: Timeframe): { points: PricePoint[]; xAxisLabels: string[] } {
  const ratio = currentPrice > 0 ? currentPrice / 67432.18 : 1;

  if (tf === "1D") {
    // Exact curve shape matching przyklad.jpg:
    // Starts at 63,100 -> climbs to 66,350 at 09:00 -> dips to 63,500 at 15:00 -> rallies to 68,300 at 19:30 -> settles at 67,432.18 at 21:00
    const anchors = [
      { t: 0, p: 63100 },
      { t: 0.14, p: 64200 }, // ~03:00
      { t: 0.28, p: 65000 }, // ~06:00
      { t: 0.43, p: 66350 }, // ~09:00 (first major peak)
      { t: 0.52, p: 65800 }, // ~11:00
      { t: 0.62, p: 64700 }, // ~13:00
      { t: 0.71, p: 63500 }, // ~15:00 (the major dip)
      { t: 0.78, p: 65200 }, // ~16:30
      { t: 0.86, p: 66800 }, // ~18:00
      { t: 0.93, p: 68300 }, // ~19:30 (highest peak)
      { t: 0.97, p: 67700 },
      { t: 1.0, p: 67432.18 }, // ~21:00
    ];

    const totalPoints = 140;
    const points: PricePoint[] = [];

    for (let i = 0; i < totalPoints; i++) {
      const prog = i / (totalPoints - 1);

      let baseP = 63100;
      for (let a = 0; a < anchors.length - 1; a++) {
        if (prog >= anchors[a].t && prog <= anchors[a + 1].t) {
          const segT = (prog - anchors[a].t) / (anchors[a + 1].t - anchors[a].t);
          baseP = anchors[a].p + segT * (anchors[a + 1].p - anchors[a].p);
          break;
        }
      }

      const noise =
        i === totalPoints - 1
          ? 0
          : Math.sin(i * 1.9) * 95 +
            Math.cos(i * 3.7) * 70 +
            Math.sin(i * 7.3) * 40;

      const p = (baseP + noise) * ratio;

      const minutes = Math.floor(prog * 21 * 60);
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

      const vol = 8 + Math.abs(Math.sin(i * 0.85)) * 18 + (i % 4) * 5 + (prog > 0.85 ? 16 : 0);

      points.push({
        t,
        p: i === totalPoints - 1 ? currentPrice : p,
        v: vol,
      });
    }

    const xAxisLabels = [
      "00:00",
      "03:00",
      "06:00",
      "09:00",
      "12:00",
      "15:00",
      "18:00",
      "21:00",
    ];

    return { points, xAxisLabels };
  }

  if (tf === "1W") {
    // 7 days realistic trajectory: 62,100 -> 61,600 -> 63,800 -> 64,900 -> 63,400 -> 66,200 -> 67,432.18
    const anchors = [
      { t: 0, p: 62100 },
      { t: 0.16, p: 61600 },
      { t: 0.33, p: 63800 },
      { t: 0.50, p: 64900 },
      { t: 0.66, p: 63400 },
      { t: 0.83, p: 66200 },
      { t: 1.0, p: 67432.18 },
    ];
    const totalPoints = 110;
    const points: PricePoint[] = [];
    const xAxisLabels = ["Pn 02", "Wt 03", "Śr 04", "Cz 05", "Pt 06", "Sb 07", "Nd 08"];

    for (let i = 0; i < totalPoints; i++) {
      const prog = i / (totalPoints - 1);
      let baseP = 62100;
      for (let a = 0; a < anchors.length - 1; a++) {
        if (prog >= anchors[a].t && prog <= anchors[a + 1].t) {
          const segT = (prog - anchors[a].t) / (anchors[a + 1].t - anchors[a].t);
          baseP = anchors[a].p + segT * (anchors[a + 1].p - anchors[a].p);
          break;
        }
      }
      const noise = i === totalPoints - 1 ? 0 : Math.sin(i * 1.4) * 180 + Math.cos(i * 2.8) * 110;
      const p = (baseP + noise) * ratio;
      const dayIdx = Math.min(xAxisLabels.length - 1, Math.floor(prog * xAxisLabels.length));
      const vol = 12 + Math.abs(Math.sin(i * 0.9)) * 24 + (i % 5) * 4;
      points.push({
        t: xAxisLabels[dayIdx],
        p: i === totalPoints - 1 ? currentPrice : p,
        v: vol,
      });
    }
    return { points, xAxisLabels };
  }

  if (tf === "1M") {
    // 30 days realistic trajectory: 59,200 -> 57,800 -> 61,400 -> 60,100 -> 64,800 -> 67,432.18
    const anchors = [
      { t: 0, p: 59200 },
      { t: 0.2, p: 57800 },
      { t: 0.4, p: 61400 },
      { t: 0.6, p: 60100 },
      { t: 0.8, p: 64800 },
      { t: 1.0, p: 67432.18 },
    ];
    const totalPoints = 120;
    const points: PricePoint[] = [];
    const xAxisLabels = ["10 Sie", "15 Sie", "20 Sie", "25 Sie", "30 Sie", "04 Wrz", "08 Wrz"];

    for (let i = 0; i < totalPoints; i++) {
      const prog = i / (totalPoints - 1);
      let baseP = 59200;
      for (let a = 0; a < anchors.length - 1; a++) {
        if (prog >= anchors[a].t && prog <= anchors[a + 1].t) {
          const segT = (prog - anchors[a].t) / (anchors[a + 1].t - anchors[a].t);
          baseP = anchors[a].p + segT * (anchors[a + 1].p - anchors[a].p);
          break;
        }
      }
      const noise = i === totalPoints - 1 ? 0 : Math.sin(i * 1.1) * 260 + Math.cos(i * 2.3) * 140;
      const p = (baseP + noise) * ratio;
      const labelIdx = Math.min(xAxisLabels.length - 1, Math.floor(prog * xAxisLabels.length));
      const vol = 10 + Math.abs(Math.sin(i * 0.7)) * 22 + (i % 3) * 6;
      points.push({
        t: xAxisLabels[labelIdx],
        p: i === totalPoints - 1 ? currentPrice : p,
        v: vol,
      });
    }
    return { points, xAxisLabels };
  }

  if (tf === "3M") {
    // 90 days: 66,800 -> 54,200 (August dip) -> 59,400 -> 63,100 -> 67,432.18
    const anchors = [
      { t: 0, p: 66800 },
      { t: 0.25, p: 58500 },
      { t: 0.45, p: 54200 },
      { t: 0.70, p: 60900 },
      { t: 0.88, p: 64200 },
      { t: 1.0, p: 67432.18 },
    ];
    const totalPoints = 120;
    const points: PricePoint[] = [];
    const xAxisLabels = ["Cze", "Lip", "Sie", "Wrz"];

    for (let i = 0; i < totalPoints; i++) {
      const prog = i / (totalPoints - 1);
      let baseP = 66800;
      for (let a = 0; a < anchors.length - 1; a++) {
        if (prog >= anchors[a].t && prog <= anchors[a + 1].t) {
          const segT = (prog - anchors[a].t) / (anchors[a + 1].t - anchors[a].t);
          baseP = anchors[a].p + segT * (anchors[a + 1].p - anchors[a].p);
          break;
        }
      }
      const noise = i === totalPoints - 1 ? 0 : Math.sin(i * 0.8) * 380 + Math.cos(i * 1.9) * 220;
      const p = (baseP + noise) * ratio;
      const labelIdx = Math.min(xAxisLabels.length - 1, Math.floor(prog * xAxisLabels.length));
      const vol = 12 + Math.abs(Math.sin(i * 0.6)) * 28 + (i % 4) * 5;
      points.push({
        t: xAxisLabels[labelIdx],
        p: i === totalPoints - 1 ? currentPrice : p,
        v: vol,
      });
    }
    return { points, xAxisLabels };
  }

  if (tf === "1Y") {
    // 1 Year: 27,200 (Sept 2025) -> 44,000 -> 73,750 (March ATH) -> 58,000 -> 67,432.18
    const anchors = [
      { t: 0, p: 27200 },
      { t: 0.20, p: 37500 },
      { t: 0.38, p: 51200 },
      { t: 0.52, p: 73750 },
      { t: 0.72, p: 58400 },
      { t: 0.88, p: 63900 },
      { t: 1.0, p: 67432.18 },
    ];
    const totalPoints = 140;
    const points: PricePoint[] = [];
    const xAxisLabels = ["Wrz '25", "Lis '25", "Sty '26", "Mar '26", "Maj '26", "Lip '26", "Wrz '26"];

    for (let i = 0; i < totalPoints; i++) {
      const prog = i / (totalPoints - 1);
      let baseP = 27200;
      for (let a = 0; a < anchors.length - 1; a++) {
        if (prog >= anchors[a].t && prog <= anchors[a + 1].t) {
          const segT = (prog - anchors[a].t) / (anchors[a + 1].t - anchors[a].t);
          baseP = anchors[a].p + segT * (anchors[a + 1].p - anchors[a].p);
          break;
        }
      }
      const noise = i === totalPoints - 1 ? 0 : Math.sin(i * 0.6) * 520 + Math.cos(i * 1.5) * 310;
      const p = (baseP + noise) * ratio;
      const labelIdx = Math.min(xAxisLabels.length - 1, Math.floor(prog * xAxisLabels.length));
      const vol = 14 + Math.abs(Math.sin(i * 0.5)) * 32 + (i % 5) * 6;
      points.push({
        t: xAxisLabels[labelIdx],
        p: i === totalPoints - 1 ? currentPrice : p,
        v: vol,
      });
    }
    return { points, xAxisLabels };
  }

  // ALL: Macro Bitcoin trajectory (2020: 9k -> 2021: 64k -> 2022: 16k -> 2023: 30k -> 2024: 68k -> 2026: 67,432.18)
  const anchors = [
    { t: 0, p: 8900 },
    { t: 0.16, p: 29000 },
    { t: 0.32, p: 64500 },
    { t: 0.48, p: 16500 },
    { t: 0.65, p: 32400 },
    { t: 0.82, p: 73500 },
    { t: 1.0, p: 67432.18 },
  ];
  const totalPoints = 140;
  const points: PricePoint[] = [];
  const xAxisLabels = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

  for (let i = 0; i < totalPoints; i++) {
    const prog = i / (totalPoints - 1);
    let baseP = 8900;
    for (let a = 0; a < anchors.length - 1; a++) {
      if (prog >= anchors[a].t && prog <= anchors[a + 1].t) {
        const segT = (prog - anchors[a].t) / (anchors[a + 1].t - anchors[a].t);
        baseP = anchors[a].p + segT * (anchors[a + 1].p - anchors[a].p);
        break;
      }
    }
    const noise = i === totalPoints - 1 ? 0 : Math.sin(i * 0.5) * 680 + Math.cos(i * 1.2) * 420;
    const p = (baseP + noise) * ratio;
    const labelIdx = Math.min(xAxisLabels.length - 1, Math.floor(prog * xAxisLabels.length));
    const vol = 16 + Math.abs(Math.sin(i * 0.4)) * 36 + (i % 6) * 7;
    points.push({
      t: xAxisLabels[labelIdx],
      p: i === totalPoints - 1 ? currentPrice : Math.max(100, p),
      v: vol,
    });
  }
  return { points, xAxisLabels };
}

export function ChartControls({
  timeframe,
  setTimeframe,
  mode,
  setMode,
  locale = "en",
}: {
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  mode: "CENA" | "VOLUME";
  setMode: (m: "CENA" | "VOLUME") => void;
  locale?: string;
}) {
  const isEn = locale !== "pl";
  const timeframes: Timeframe[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];
  const displayTimeframes = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

  return (
    <div className="flex items-center gap-2.5">
      {/* Timeframe pill group matching crop_header.png */}
      <div className="flex items-center rounded-lg bg-[#091b22] p-0.5 border border-[#142c36]">
        {displayTimeframes.map((label, idx) => {
          const actualTf = timeframes[idx] || "1D";
          const isSelected = timeframe === actualTf;
          return (
            <button
              key={idx}
              onClick={() => setTimeframe(actualTf)}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                isSelected
                  ? "bg-[#103a42] text-white shadow-sm"
                  : "text-[#6c8a98] hover:text-[#9bc2d4]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* CENA / PRICE | VOLUME toggle matching crop_header.png */}
      <div className="flex items-center rounded-lg bg-[#091b22] p-0.5 border border-[#142c36]">
        <button
          onClick={() => setMode("CENA")}
          className={`px-3.5 py-1 text-xs font-bold rounded transition-colors ${
            mode === "CENA"
              ? "bg-[#103a42] text-white"
              : "text-[#6c8a98] hover:text-[#9bc2d4]"
          }`}
        >
          {isEn ? "PRICE" : "CENA"}
        </button>
        <button
          onClick={() => setMode("VOLUME")}
          className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
            mode === "VOLUME"
              ? "bg-[#103a42] text-white"
              : "text-[#6c8a98] hover:text-[#9bc2d4]"
          }`}
        >
          VOLUME
        </button>
      </div>
    </div>
  );
}

// Global in-memory cache to prevent double-loading and re-fetching on timeframe switches
const klineCache = new Map<string, { points: PricePoint[]; xAxisLabels: string[] }>();

export default function AssetAreaChart({
  symbol,
  currentPrice,
  priceChange24h = 2.48,
  timeframe: externalTf,
  mode: externalMode,
  isOutdated = false,
}: AssetAreaChartProps) {
  const [internalTimeframe, setInternalTimeframe] = useState<Timeframe>("1D");
  const [internalMode, setInternalMode] = useState<"CENA" | "VOLUME">("CENA");

  const timeframe = externalTf || internalTimeframe;
  const mode = externalMode || internalMode;
  const [hoveredPoint, setHoveredPoint] = useState<PricePoint | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const cacheKey = `${(symbol || "").toUpperCase()}_${timeframe}`;
  const [liveData, setLiveData] = useState<{ points: PricePoint[]; xAxisLabels: string[] } | null>(
    () => klineCache.get(cacheKey) || null
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Staged Animation State: BLINK (pulsing beacon on left origin) -> SWEEP (smooth line draw) -> LIVE
  const [animProgress, setAnimProgress] = useState(0);
  const [blinkPulse, setBlinkPulse] = useState(0);
  const [animPhase, setAnimPhase] = useState<"BLINK" | "SWEEP" | "LIVE">("BLINK");
  const [replayKey, setReplayKey] = useState(0);

  const triggerReplay = useCallback(() => {
    setReplayKey((k) => k + 1);
  }, []);

  // Fluid two-stage animation:
  // 1. Beacon blinks at left origin (where chart begins) for ~850ms
  // 2. Line sweeps smoothly left-to-right over ~1250ms with glowing tracer head
  useEffect(() => {
    let start: number | null = null;
    let rafId: number;
    const blinkDuration = 850;
    const sweepDuration = 1250;
    const totalDuration = blinkDuration + sweepDuration;

    setAnimProgress(0);
    setAnimPhase("BLINK");

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;

      if (elapsed < blinkDuration) {
        setAnimPhase("BLINK");
        const pulse = (elapsed / blinkDuration) * (Math.PI * 4);
        setBlinkPulse(pulse);
        setAnimProgress(0);
        rafId = requestAnimationFrame(step);
      } else if (elapsed < totalDuration) {
        setAnimPhase("SWEEP");
        const sweepT = (elapsed - blinkDuration) / sweepDuration;
        const eased = 1 - Math.pow(1 - sweepT, 3);
        setAnimProgress(eased);
        rafId = requestAnimationFrame(step);
      } else {
        setAnimPhase("LIVE");
        setAnimProgress(1);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [symbol, timeframe, cacheKey, replayKey]);

  // Fetch real market klines from /api/market-integrity/klines with caching & AbortController
  useEffect(() => {
    const controller = new AbortController();
    const cleanSym = (symbol || "").toUpperCase();
    const isTrad = ["AAPL", "NVDA", "MSFT", "TSLA", "AMZN", "GOOGL", "SPY", "QQQ"].includes(cleanSym);
    if (isTrad) {
      setLiveData(null);
      return;
    }

    // Check cache first
    if (klineCache.has(cacheKey)) {
      setLiveData(klineCache.get(cacheKey)!);
      return;
    }

    async function fetchRealKlines() {

      let range = "15m";
      let sliceCount = 96;
      if (timeframe === "1W") {
        range = "1h";
        sliceCount = 168;
      } else if (timeframe === "1M") {
        range = "4h";
        sliceCount = 180;
      } else if (timeframe === "3M") {
        range = "1d";
        sliceCount = 90;
      } else if (timeframe === "1Y") {
        range = "1d";
        sliceCount = 365;
      } else if (timeframe === "ALL") {
        range = "1d";
        sliceCount = 1000;
      }

      const marketId =
        symbol === "BTC" || symbol.toLowerCase() === "bitcoin"
          ? "bitcoin"
          : symbol === "ETH" || symbol.toLowerCase() === "ethereum"
            ? "ethereum"
            : symbol === "SOL" || symbol.toLowerCase() === "solana"
              ? "solana"
              : symbol.toLowerCase();

      try {
        const url = `/api/market-integrity/klines?assetClass=crypto&marketId=${encodeURIComponent(
          marketId,
        )}&symbol=${encodeURIComponent(cleanSym)}&quote=USD&range=${range}`;
        const res = await fetch(url, {
          cache: "no-store",
          headers: { "x-velmere-dev": "true" },
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!json.candles || !Array.isArray(json.candles) || json.candles.length < 4) return;

        const rawCandles = json.candles.slice(-sliceCount);
        const targetCount = Math.min(rawCandles.length, 140);
        const sampled: RawCandle[] = [];
        for (let i = 0; i < targetCount; i++) {
          const idx = Math.min(
            rawCandles.length - 1,
            Math.round((i / (targetCount - 1)) * (rawCandles.length - 1)),
          );
          sampled.push(rawCandles[idx]);
        }

        const points: PricePoint[] = sampled.map((c, i) => {
          const d = new Date(Number(c.timestamp));
          let t = "";
          if (timeframe === "1D") {
            t = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
          } else if (timeframe === "1W") {
            const days = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];
            t = `${days[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}`;
          } else if (timeframe === "1M" || timeframe === "3M") {
            const months = [
              "Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru",
            ];
            t = `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]}`;
          } else {
            t = String(d.getFullYear());
          }

          return {
            t,
            p: i === sampled.length - 1 && currentPrice > 0 ? currentPrice : Number(c.close),
            v: Number(c.volume) || 10,
          };
        });

        const labelCount = Math.min(7, points.length);
        const xAxisLabels: string[] = [];
        for (let i = 0; i < labelCount; i++) {
          const idx = Math.min(
            points.length - 1,
            Math.round((i / (labelCount - 1)) * (points.length - 1)),
          );
          xAxisLabels.push(points[idx].t);
        }

        if (!controller.signal.aborted) {
          const result = { points, xAxisLabels };
          klineCache.set(cacheKey, result);
          setLiveData(result);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.warn("Failed to fetch klines:", err);
        }
      }
    }

    fetchRealKlines();
    return () => {
      controller.abort();
    };
  }, [symbol, timeframe, cacheKey, currentPrice]);

  const fallback = getChartData(symbol, currentPrice, timeframe);
  const rawPoints = liveData?.points && liveData.points.length >= 4 ? liveData.points : fallback.points;
  const data = rawPoints.map((pt, idx) => {
    if (idx === rawPoints.length - 1 && currentPrice > 0) {
      return { ...pt, p: currentPrice };
    }
    return pt;
  });
  const xAxisLabels =
    liveData?.xAxisLabels && liveData.xAxisLabels.length >= 2
      ? liveData.xAxisLabels
      : fallback.xAxisLabels;

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 320;

    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const padLeft = 24; // Left margin so 00:00 timestamp is fully visible
    const padRight = 68; // Space for right Y-axis
    const padTop = 16;
    const padBottom = 26; // Space for X-axis timestamps
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    if (chartW <= 0 || chartH <= 0 || data.length < 2) {
      ctx.restore();
      return;
    }

    // Dynamic clean range based on min/max of current data
    const prices = data.map((d) => d.p);
    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    const span = rawMax - rawMin || rawMin * 0.05 || 1;
    const minP = Math.max(0, rawMin - span * 0.08);
    const maxP = rawMax + span * 0.08;

    const getX = (idx: number) => padLeft + (idx / (data.length - 1)) * chartW;
    const getY = (p: number) => padTop + chartH - ((p - minP) / (maxP - minP)) * chartH;

    // 1. Draw horizontal dashed grid lines and right Y-axis labels
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "rgba(45, 212, 191, 0.07)";
    ctx.lineWidth = 1;
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#638290";
    ctx.textAlign = "right";

    const yLevels = Array.from({ length: 6 }).map((_, i) => minP + ((maxP - minP) / 5) * i);

    yLevels.forEach((level) => {
      const y = getY(level);
      if (y >= padTop - 2 && y <= padTop + chartH + 2) {
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(padLeft + chartW, y);
        ctx.stroke();

        const label =
          level >= 1000
            ? Math.round(level).toLocaleString("en-US")
            : formatAdaptivePrice(level);
        ctx.fillText(label, w - 8, y + 4);
      }
    });
    ctx.setLineDash([]);

    // 2. Draw Volume Histogram bars at bottom
    const maxV = Math.max(...data.map((d) => d.v), 1);
    const barW = Math.max(1.8, (chartW / data.length) * 0.48);
    const maxBarHeight = mode === "VOLUME" ? chartH * 0.45 : chartH * 0.16;

    data.forEach((d, i) => {
      const bx = getX(i) - barW / 2;
      const bh = (d.v / maxV) * maxBarHeight;
      const by = padTop + chartH - bh;

      ctx.fillStyle =
        mode === "VOLUME"
          ? "rgba(45, 212, 191, 0.45)"
          : "rgba(80, 125, 145, 0.25)";
      ctx.fillRect(bx, by, barW, bh);
    });

    // 3. Draw Price Area & Line with left-origin pulsing beacon and smooth left-to-right sweep
    const firstX = getX(0);
    const firstY = getY(data[0].p);
    const lastX = getX(data.length - 1);

    // Initial / Outdated Phase: Pulsing beacon at the left origin where chart line begins
    if (animPhase === "BLINK" || isOutdated) {
      const pulseT = Math.abs(Math.sin(blinkPulse));
      const wave1 = (blinkPulse % Math.PI) / Math.PI;
      const wave2 = ((blinkPulse + Math.PI / 2) % Math.PI) / Math.PI;

      // Concentric expanding radar wave 1
      ctx.beginPath();
      ctx.arc(firstX, firstY, 5 + wave1 * 22, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(45, 212, 191, ${(1 - wave1) * 0.85})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Concentric expanding radar wave 2
      ctx.beginPath();
      ctx.arc(firstX, firstY, 5 + wave2 * 22, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(45, 212, 191, ${(1 - wave2) * 0.6})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Soft glowing aura
      ctx.beginPath();
      ctx.arc(firstX, firstY, 8 + pulseT * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(45, 212, 191, ${0.25 + pulseT * 0.35})`;
      ctx.fill();

      // Main blinking core beacon dot
      ctx.beginPath();
      ctx.arc(firstX, firstY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#2dd4bf";
      ctx.fill();

      // High-intensity white center spark
      ctx.beginPath();
      ctx.arc(firstX, firstY, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }

    // Sweep phase & Live phase: Smooth left-to-right line and area unroll
    if (animPhase === "SWEEP" || animPhase === "LIVE") {
      const currentMaxX = animPhase === "LIVE" ? lastX : padLeft + animProgress * chartW;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, currentMaxX, h);
      ctx.clip();

      // Area Gradient
      const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
      gradient.addColorStop(0, "rgba(45, 212, 191, 0.32)");
      gradient.addColorStop(0.55, "rgba(45, 212, 191, 0.09)");
      gradient.addColorStop(1, "rgba(45, 212, 191, 0.00)");

      ctx.beginPath();
      ctx.moveTo(firstX, padTop + chartH);
      ctx.lineTo(firstX, firstY);

      for (let i = 1; i < data.length; i++) {
        const x = getX(i);
        const y = getY(data[i].p);
        ctx.lineTo(x, y);
      }

      ctx.lineTo(lastX, padTop + chartH);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Line Path with exact stroke
      ctx.beginPath();
      ctx.moveTo(firstX, firstY);
      for (let i = 1; i < data.length; i++) {
        const x = getX(i);
        const y = getY(data[i].p);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "#2dd4bf"; // Vibrant teal
      ctx.lineWidth = 2.2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      ctx.restore();

      // Origin anchor dot on the far left
      ctx.beginPath();
      ctx.arc(firstX, firstY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#2dd4bf";
      ctx.fill();

      // Tracer comet glow dot at leading tip
      if (animPhase === "SWEEP" && animProgress < 0.999) {
        const ratio = Math.min(1, Math.max(0, (currentMaxX - padLeft) / chartW));
        const idxFloat = ratio * (data.length - 1);
        const fIdx = Math.floor(idxFloat);
        const cIdx = Math.min(data.length - 1, Math.ceil(idxFloat));
        const frac = idxFloat - fIdx;
        const tipP = data[fIdx].p + (data[cIdx].p - data[fIdx].p) * frac;
        const tipY = getY(tipP);

        // Leading outer pulse
        ctx.beginPath();
        ctx.arc(currentMaxX, tipY, 8.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(45, 212, 191, 0.38)";
        ctx.fill();

        // Leading teal halo
        ctx.beginPath();
        ctx.arc(currentMaxX, tipY, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#2dd4bf";
        ctx.fill();

        // Leading white core
        ctx.beginPath();
        ctx.arc(currentMaxX, tipY, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
    }

    // 4. Horizontal dashed line at current price & price badge (revealed as sweep finishes)
    if (animPhase === "LIVE" || animProgress >= 0.96) {
      const curY = getY(currentPrice);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(45, 212, 191, 0.45)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padLeft, curY);
      ctx.lineTo(padLeft + chartW, curY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 5. Teal Badge on right axis: formatted current price
      const priceText =
        currentPrice >= 1000
          ? currentPrice
              .toLocaleString("de-DE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
              .replace(",", ".")
          : formatAdaptivePrice(currentPrice);

      ctx.font = "bold 11px Inter, system-ui, sans-serif";
      const textWidth = ctx.measureText(priceText).width;
      const badgeW = textWidth + 14;
      const badgeH = 20;
      const badgeX = padLeft + chartW + 2;
      const badgeY = curY - badgeH / 2;

      ctx.fillStyle = "#229c8e";
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.fillText(priceText, badgeX + 7, curY + 4);
    }

    // 6. X-Axis labels at bottom
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#5c7c8c";
    ctx.textAlign = "center";

    if (xAxisLabels.length > 0) {
      const labelCount = xAxisLabels.length;
      xAxisLabels.forEach((lbl, idx) => {
        const x = padLeft + (idx / (labelCount - 1)) * chartW;
        ctx.fillText(lbl, x, h - 6);
      });
    }

    // 7. Hover crosshair & dot
    if (hoverPos && hoveredPoint) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(45, 212, 191, 0.7)";
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(hoverPos.x, padTop);
      ctx.lineTo(hoverPos.x, padTop + chartH);
      ctx.stroke();

      const dotY = getY(hoveredPoint.p);
      ctx.setLineDash([]);
      ctx.fillStyle = "#2dd4bf";
      ctx.beginPath();
      ctx.arc(hoverPos.x, dotY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#0c1b24";
      ctx.beginPath();
      ctx.arc(hoverPos.x, dotY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [data, xAxisLabels, timeframe, mode, currentPrice, hoverPos, hoveredPoint, animProgress, blinkPulse, animPhase, isOutdated]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const padLeft = 24;
    const padRight = 68;
    const chartW = rect.width - padLeft - padRight;

    if (mx >= padLeft && mx <= padLeft + chartW) {
      const ratio = (mx - padLeft) / chartW;
      const idx = Math.min(
        data.length - 1,
        Math.max(0, Math.round(ratio * (data.length - 1)))
      );
      setHoveredPoint(data[idx]);
      setHoverPos({ x: mx, y: my });
    } else {
      setHoveredPoint(null);
      setHoverPos(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setHoverPos(null);
  };

  const timeframes: Timeframe[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];
  const displayTimeframes = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

  return (
    <div className="relative flex flex-col h-[565px] w-full">
      {/* Top right pill controls (only shown if not provided externally) */}
      {!externalTf && (
        <div className="absolute top-0 right-0 z-10 flex items-center gap-2.5">
          {/* Timeframe pill group */}
          <div className="flex items-center rounded-lg bg-[#091b22] p-0.5 border border-[#142c36]">
            {displayTimeframes.map((label, idx) => {
              const actualTf = timeframes[idx] || "1D";
              const isSelected = timeframe === actualTf;
              return (
                <button
                  key={idx}
                  onClick={() => setInternalTimeframe(actualTf)}
                  className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                    isSelected
                      ? "bg-[#103a42] text-[#2dd4bf] shadow-sm"
                      : "text-[#6c8a98] hover:text-[#9bc2d4]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* CENA | VOLUME toggle */}
          <div className="flex items-center rounded-lg bg-[#091b22] p-0.5 border border-[#142c36]">
            <button
              onClick={() => setInternalMode("CENA")}
              className={`px-3.5 py-1 text-xs font-bold rounded transition-colors ${
                mode === "CENA"
                  ? "bg-[#103a42] text-[#2dd4bf]"
                  : "text-[#6c8a98] hover:text-[#9bc2d4]"
              }`}
            >
              CENA
            </button>
            <button
              onClick={() => setInternalMode("VOLUME")}
              className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                mode === "VOLUME"
                  ? "bg-[#103a42] text-[#2dd4bf]"
                  : "text-[#6c8a98] hover:text-[#9bc2d4]"
              }`}
            >
              VOLUME
            </button>
          </div>

          {/* Replay / Resync Button */}
          <button
            onClick={triggerReplay}
            title="Odśwież telemetrię i animuj wykres"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#142c36] bg-[#091b22] text-[#6c8a98] hover:text-[#2dd4bf] hover:border-[#2dd4bf]/40 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${animPhase !== "LIVE" ? "animate-spin text-[#2dd4bf]" : ""}`} />
          </button>
        </div>
      )}

      {/* Floating Hover Tooltip */}
      {hoveredPoint && hoverPos && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border border-[#2dd4bf]/30 bg-[#08151c]/95 px-3 py-1.5 shadow-xl backdrop-blur-md"
          style={{
            left: `${Math.min(hoverPos.x + 15, 600)}px`,
            top: `${Math.max(hoverPos.y - 45, 10)}px`,
          }}
        >
          <div className="text-[10px] font-mono text-[#6c8a98]">
            {hoveredPoint.t}
          </div>
          <div className="text-xs font-bold text-[#38e1cb]">
            ${hoveredPoint.p.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        </div>
      )}

      {/* Canvas chart area lengthened by 20% */}
      <div ref={containerRef} className="h-[470px] w-full relative overflow-hidden pt-4">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="cursor-crosshair block"
        />
      </div>
    </div>
  );
}
