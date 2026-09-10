"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ShieldCheck,
  TrendingUp,
  Activity,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "@/navigation";
import AssetAreaChart, {
  ChartControls,
  type Timeframe,
} from "@/components/market-integrity/AssetAreaChart";
import RiskDonutPanel from "@/components/market-integrity/RiskDonutPanel";
import AnalysisCardsSection from "@/components/market-integrity/AnalysisCardsSection";
import ResolvedAssetLogo from "@/components/market-integrity/AssetLogo";

export type AssetDetailData = {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  price: number;
  priceChange24h?: number;
  priceChange7d?: number;
  marketCap?: number;
  volume24h?: number;
  high24h?: number;
  low24h?: number;
  riskScore: number;
  confidence: number;
  freshness: string;
  verifiedSourcesCount: number;
  imageUrl?: string;
  contractAddress?: string;
  assetClass?: string;
  exchange?: string;
};

type AssetDetailPageNewProps = {
  initialAsset: AssetDetailData;
  locale?: string;
  surface?: "shield" | "real-markets";
};

// Top known assets for quick switching dropdown
const SELECTABLE_ASSETS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 78681.99, change: -0.18, score: 42, color: "#f7931a" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 2490.21, change: 1.45, score: 34, color: "#627eea" },
  { id: "solana", symbol: "SOL", name: "Solana", price: 103.79, change: -0.85, score: 48, color: "#14f195" },
  { id: "om", symbol: "OM", name: "MANTRA", price: 0.44, change: -88.5, score: 94, color: "#e11d48" },
  { id: "lab", symbol: "LAB", name: "LAB Protocol", price: 18.00, change: -99.2, score: 100, color: "#dc2626" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", price: 0.124, change: 5.80, score: 58, color: "#c2a633" },
  { id: "aapl", symbol: "AAPL", name: "Apple Inc.", price: 228.50, change: 0.85, score: 28, color: "#a2aaad" },
  { id: "nvda", symbol: "NVDA", name: "NVIDIA Corp.", price: 119.80, change: 4.20, score: 32, color: "#76b900" },
];

export default function AssetDetailPageNew({
  initialAsset,
  locale = "en",
  surface = "shield",
}: AssetDetailPageNewProps) {
  const [asset, setAsset] = useState<AssetDetailData>(initialAsset);
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [chartMode, setChartMode] = useState<"CENA" | "VOLUME">("CENA");
  const router = useRouter();

  // Sync state if initialAsset changes (e.g. route or searchParams change)
  useEffect(() => {
    setAsset(initialAsset);
  }, [initialAsset]);

  // Fetch live market catalog data (Shield crypto or Real Markets equities/commodities)
  useEffect(() => {
    let cancelled = false;
    async function loadLiveData() {
      try {
        const isTrad =
          surface === "real-markets" ||
          asset.assetClass === "stock" ||
          asset.assetClass === "etf" ||
          asset.assetClass === "commodity" ||
          asset.assetClass === "forex";

        if (isTrad) {
          const sym = (asset.symbol || "").toUpperCase();
          const res = await fetch(
            `/api/market-integrity/real-markets?symbols=${encodeURIComponent(sym)}&range=1h&detail=1`,
            {
              cache: "no-store",
              headers: { "x-velmere-dev": "true" },
            },
          );
          if (!res.ok) return;
          const data = await res.json();
          const quotes = data.quotes || {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const match: any = quotes[sym] || quotes[asset.id] || Object.values(quotes)[0];
          if (match && !cancelled) {
            const rawPrice = match.currentPrice ?? match.primaryPrice ?? match.price;
            const price = typeof rawPrice === "number" && !isNaN(rawPrice) && rawPrice > 0 ? rawPrice : undefined;
            const change = typeof match.changePercent === "number" ? match.changePercent : typeof match.priceChange24h === "number" ? match.priceChange24h : undefined;
            const rawScore = match.riskScore ?? match.risk;
            const score = typeof rawScore === "number" && !isNaN(rawScore) ? Math.round(rawScore * 10) / 10 : undefined;

            setAsset((prev) => ({
              ...prev,
              price: typeof initialAsset.price === "number" && initialAsset.price > 0 ? initialAsset.price : (price ?? prev.price),
              priceChange24h: typeof initialAsset.priceChange24h === "number" ? initialAsset.priceChange24h : (change ?? prev.priceChange24h),
              riskScore: typeof initialAsset.riskScore === "number" ? initialAsset.riskScore : (score ?? prev.riskScore),
              marketCap: match.marketCap ?? prev.marketCap,
              volume24h: match.volume24h ?? prev.volume24h,
            }));
          }
          return;
        }

        const res = await fetch(`/api/market-integrity/markets?page=1&perPage=250&tier=basic&live=true`, {
          cache: "no-store",
          headers: { "x-velmere-dev": "true" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.rows || !Array.isArray(data.rows)) return;
        const cleanId = (asset.id || "").toLowerCase();
        const cleanSym = (asset.symbol || "").toLowerCase();
        const match = data.rows.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (r: any) => r.id?.toLowerCase() === cleanId || r.symbol?.toLowerCase() === cleanSym,
        );
        if (match && !cancelled) {
          const delivery = match.delivery;
          const rawScore = delivery?.risk?.score ?? match.result?.score ?? match.riskScore;
          const score = typeof rawScore === "number" && !isNaN(rawScore) ? Math.round(rawScore * 10) / 10 : asset.riskScore;
          const conf = match.result?.confidence ?? match.delivery?.risk?.confidencePercent;
          const confidence = typeof conf === "number" && !isNaN(conf) ? (conf <= 1 ? Math.round(conf * 100) : Math.round(conf)) : asset.confidence;

          setAsset((prev) => ({
            ...prev,
            price: typeof initialAsset.price === "number" && initialAsset.price > 0 ? initialAsset.price : (match.price ?? prev.price),
            priceChange24h: typeof initialAsset.priceChange24h === "number" ? initialAsset.priceChange24h : (match.priceChange24h ?? prev.priceChange24h),
            priceChange7d: match.priceChange7d ?? prev.priceChange7d,
            marketCap: match.marketCap ?? prev.marketCap,
            volume24h: match.volume24h ?? prev.volume24h,
            high24h: match.high24h ?? prev.high24h,
            low24h: match.low24h ?? prev.low24h,
            riskScore: typeof initialAsset.riskScore === "number" ? initialAsset.riskScore : score,
            confidence: confidence,
            imageUrl: match.image ?? prev.imageUrl,
            verifiedSourcesCount: match.result?.dataSources?.length ?? prev.verifiedSourcesCount,
          }));
        }
      } catch (err) {
        console.warn("Live market sync warning:", err);
      }
    }
    loadLiveData();
    return () => {
      cancelled = true;
    };
  }, [asset.id, asset.symbol, surface]);

  const isTraditional =
    surface === "real-markets" ||
    asset.assetClass === "stock" ||
    asset.assetClass === "etf" ||
    asset.assetClass === "commodity" ||
    asset.assetClass === "forex";

  const isPositive = (asset.priceChange24h ?? 2.48) >= 0;
  const changePercent = Math.abs(asset.priceChange24h ?? 2.48).toFixed(2);
  const changeFormatted = `${isPositive ? "+" : "-"}${changePercent}% (24h)`;

  // Price formatted: "$ 67,432.18" or "$ 0.000012"
  const absPrice = Math.abs(asset.price);
  const maxDigits = absPrice < 0.0001 ? 8 : absPrice < 0.01 ? 6 : absPrice < 1 ? 4 : absPrice < 10 ? 4 : 2;
  const minDigits = absPrice < 0.0001 ? 6 : absPrice < 0.01 ? 4 : 2;
  const formattedPrice =
    asset.price >= 1000
      ? `$ ${asset.price.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : `$ ${asset.price.toLocaleString("en-US", {
          minimumFractionDigits: minDigits,
          maximumFractionDigits: maxDigits,
        })}`;

  const handleSelectAsset = (sel: (typeof SELECTABLE_ASSETS)[0]) => {
    setAssetDropdownOpen(false);
    if (sel.id === "aapl" || sel.id === "nvda") {
      router.push(`/real-markets/assets/${sel.id}`);
    } else {
      router.push(`/shield/assets/${sel.id}`);
    }
  };

  const backUrl = surface === "real-markets" ? `/${locale}/real-markets` : `/${locale}/shield`;
  const backLabel =
    surface === "real-markets"
      ? locale === "pl"
        ? "Powrót do Real Markets"
        : locale === "de"
          ? "Zurück zu Real Markets"
          : "Back to Real Markets"
      : locale === "pl"
        ? "Powrót do Shield"
        : locale === "de"
          ? "Zurück zu Shield"
          : "Back to Shield";

  return (
    <div
      data-asset-detail-page
      className="flex min-h-screen flex-col bg-[#07090D] text-white selection:bg-velmere-gold/20 pt-14 md:pt-16"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* Sleek breadcrumb bar directly beneath Velmère master navbar */}
      <section className="border-b border-white/[0.06] bg-[#0A0D13]/70 px-4 py-2 backdrop-blur-md md:px-8">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <Link
              href={backUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-medium text-white/70 transition-colors hover:border-velmere-gold/40 hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-velmere-gold" />
              <span>{backLabel}</span>
            </Link>

            <span className="hidden sm:inline-block text-white/20">/</span>

            <div className="hidden sm:flex items-center gap-2 text-white/50">
              <span>{surface === "real-markets" ? "Real Markets" : "Shield Terminal"}</span>
              <span className="text-white/20">&gt;</span>
              <span className="font-semibold text-white/90">{asset.name}</span>
              <span className="font-mono text-[11px] text-velmere-gold">({asset.symbol})</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {locale === "pl" ? "Telemetria na żywo" : locale === "de" ? "Live-Telemetrie" : "Live Telemetry"}
            </span>

            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 font-mono text-[10px] text-white/50">
              <ShieldCheck className="h-3 w-3 text-velmere-gold" />
              {locale === "pl" ? "Deterministyczna weryfikacja" : locale === "de" ? "Deterministische Verifikation" : "Deterministic Verification"}
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Area - Single Screen Viewport Budget */}
      <main className="flex-1 px-4 py-2.5 md:px-6">
        <div className="mx-auto max-w-[1680px] space-y-3">
          {/* TOP SECTION: Grid of 2 Cards (Chart Card + Risk Card) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_390px] items-stretch">
            {/* 1. LEFT CARD: Asset Chart Card lengthened downward by 20% */}
            <div className="relative rounded-2xl border border-white/[0.08] bg-[#0C1017] p-4 shadow-2xl flex flex-col justify-between min-h-[440px] xl:min-h-[480px]">
              {/* Row 1: Asset Info on left, ChartControls on right */}
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                {/* Coin Icon + Symbol + Name + Dropdown */}
                <div className="relative flex items-center gap-3">
                  <ResolvedAssetLogo
                    symbol={asset.symbol}
                    name={asset.name}
                    id={asset.id}
                    image={asset.imageUrl}
                    assetClass={asset.assetClass || (isTraditional ? "stock" : "crypto")}
                    className="h-8 w-8 rounded-full shadow-md shrink-0 border border-white/[0.12]"
                  />
                  <button
                    onClick={() => setAssetDropdownOpen(!assetDropdownOpen)}
                    className="group flex items-center gap-2 transition"
                  >
                    <span className="font-serif text-2xl font-bold tracking-tight text-white group-hover:text-velmere-gold transition-colors">
                      {asset.symbol}
                    </span>
                    <span className="text-sm font-medium text-white/50">
                      {asset.name}
                    </span>
                    <ChevronDown className="h-4 w-4 text-white/40 group-hover:text-white transition-transform" />
                  </button>

                  {/* Quick Asset Selector Dropdown */}
                  {assetDropdownOpen && (
                    <div className="absolute top-12 left-0 z-30 w-72 rounded-xl border border-white/[0.12] bg-[#0D1117] p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95">
                      <div className="px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white/40">
                        {locale === "pl" ? "Wybierz aktywo" : locale === "de" ? "Asset auswählen" : "Select Asset"}
                      </div>
                      {SELECTABLE_ASSETS.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelectAsset(item)}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition hover:bg-white/[0.06]"
                        >
                          <div className="flex items-center gap-2">
                            <ResolvedAssetLogo
                              symbol={item.symbol}
                              name={item.name}
                              id={item.id}
                              assetClass={item.id === "aapl" || item.id === "nvda" ? "stock" : "crypto"}
                              compact
                              className="h-4 w-4 rounded-full shrink-0"
                            />
                            <span className="font-bold text-white">
                              {item.symbol}
                            </span>
                            <span className="text-white/40">
                              {item.name}
                            </span>
                          </div>
                          <span className="font-mono text-white/90">
                            ${item.price.toLocaleString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Timeframes & Mode toggle */}
                <ChartControls
                  timeframe={timeframe}
                  setTimeframe={setTimeframe}
                  mode={chartMode}
                  setMode={setChartMode}
                  locale={locale}
                />
              </div>

              {/* Row 2: Price + 24h Change */}
              <div className="mt-3 flex items-baseline gap-3">
                <span className="font-mono text-3xl font-extrabold tracking-tight text-white">
                  {formattedPrice}
                </span>
                <span
                  className={`flex items-center gap-1 font-mono text-xs font-bold px-2 py-0.5 rounded-full border ${
                    isPositive
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                  }`}
                >
                  <span>{isPositive ? "▲" : "▼"}</span>
                  <span>{changeFormatted}</span>
                </span>
              </div>

              {/* Row 3: Canvas Area Chart with 20% taller display and blinking-origin sweep animation */}
              <div className="mt-2 flex-1">
                <AssetAreaChart
                  symbol={asset.symbol}
                  currentPrice={asset.price}
                  priceChange24h={asset.priceChange24h}
                  timeframe={timeframe}
                  mode={chartMode}
                  isOutdated={!asset.price || asset.price <= 0}
                />
              </div>
            </div>

            {/* 2. RIGHT CARD: True Real-Time Risk Card lengthened downward */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0C1017] p-4 shadow-2xl flex flex-col justify-between min-h-[440px] xl:min-h-[480px]">
              <RiskDonutPanel
                riskScore={asset.riskScore}
                symbol={asset.symbol}
                isTraditional={isTraditional}
                confidence={asset.confidence}
                locale={locale}
              />
            </div>
          </div>

          {/* BOTTOM SECTION: "Analiza i wgląd" (5 Cards Container moved noticeably lower down) */}
          <div className="mt-10 pt-8 border-t border-white/[0.10]">
            <AnalysisCardsSection
              asset={{
                id: asset.id,
                symbol: asset.symbol,
                name: asset.name,
                price: asset.price,
                priceChange24h: asset.priceChange24h,
                priceChange7d: asset.priceChange7d,
                marketCap: asset.marketCap,
                volume24h: asset.volume24h,
                riskScore: asset.riskScore,
                confidence: asset.confidence,
              }}
              isTraditional={isTraditional}
              locale={locale}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
