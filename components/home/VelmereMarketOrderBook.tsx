"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronRight, Layers, Radio, Sparkles, TrendingUp, Zap } from "lucide-react";

type Locale = "pl" | "en" | "de";
type AssetSymbol = "BTC" | "ETH" | "SOL" | "VLM";

interface OrderLevel {
  price: number;
  amount: number;
  total: number;
  depthPercent: number;
  highlight?: "add" | "fill" | null;
}

interface RecentTrade {
  id: string;
  time: string;
  price: number;
  amount: number;
  side: "buy" | "sell";
}

interface AssetConfig {
  symbol: AssetSymbol;
  name: string;
  pair: string;
  basePrice: number;
  decimals: number;
  amountDecimals: number;
  spreadMin: number;
}

const ASSET_CONFIGS: Record<AssetSymbol, AssetConfig> = {
  BTC: { symbol: "BTC", name: "Bitcoin", pair: "BTC/USDT", basePrice: 68425.5, decimals: 2, amountDecimals: 4, spreadMin: 1.5 },
  ETH: { symbol: "ETH", name: "Ethereum", pair: "ETH/USDT", basePrice: 3482.2, decimals: 2, amountDecimals: 3, spreadMin: 0.4 },
  SOL: { symbol: "SOL", name: "Solana", pair: "SOL/USDT", basePrice: 178.6, decimals: 2, amountDecimals: 2, spreadMin: 0.08 },
  VLM: { symbol: "VLM", name: "Velmère Token", pair: "VLM/USDT", basePrice: 4.85, decimals: 4, amountDecimals: 1, spreadMin: 0.002 },
};

const I18N = {
  pl: {
    title: "KSIĘGA ZLECEŃ & PRZEPŁYW RYNKU W CZASIE RZECZYWISTYM",
    badge: "SILNIK DOPASOWYWANIA L2",
    price: "Cena",
    amount: "Ilość",
    depth: "Głębokość",
    spread: "Spread",
    trades: "Taśma Transakcji",
    time: "Czas",
    side: "Strona",
    buy: "KUPNO",
    sell: "SPRZEDAŻ",
    bids: "Zlecenia Kupna (Bids)",
    asks: "Zlecenia Sprzedaży (Asks)",
    liveFeed: "STRUMIEŃ LIVE",
    liquidityRatio: "Balans Płynności",
    buyerAdvantage: "Przewaga Kupujących",
    sellerAdvantage: "Przewaga Sprzedających",
    orderFlowActive: "Ciągły audyt płynności on-chain",
  },
  en: {
    title: "LIVE L2 ORDER BOOK & REAL-TIME MARKET FLOW",
    badge: "L2 MATCHING ENGINE",
    price: "Price",
    amount: "Amount",
    depth: "Depth",
    spread: "Spread",
    trades: "Recent Trades",
    time: "Time",
    side: "Side",
    buy: "BUY",
    sell: "SELL",
    bids: "Bids (Buy Orders)",
    asks: "Asks (Sell Orders)",
    liveFeed: "LIVE FEED",
    liquidityRatio: "Liquidity Ratio",
    buyerAdvantage: "Buyer Dominance",
    sellerAdvantage: "Seller Dominance",
    orderFlowActive: "Continuous on-chain liquidity audit",
  },
  de: {
    title: "L2-ORDERBUCH & ECHTZEIT-MARKTFLUSS",
    badge: "L2-MATCHING-ENGINE",
    price: "Preis",
    amount: "Menge",
    depth: "Tiefe",
    spread: "Spread",
    trades: "Letzte Trades",
    time: "Zeit",
    side: "Seite",
    buy: "KAUF",
    sell: "VERKAUF",
    bids: "Kaufaufträge (Bids)",
    asks: "Verkaufsaufträge (Asks)",
    liveFeed: "LIVE-FEED",
    liquidityRatio: "Liquiditätsverhältnis",
    buyerAdvantage: "Käufervorteil",
    sellerAdvantage: "Verkäufervorteil",
    orderFlowActive: "Kontinuierliche On-Chain-Liquiditätsprüfung",
  },
};

export default function VelmereMarketOrderBook({ locale = "en" }: { locale?: string }) {
  const safeLocale: Locale = locale === "pl" || locale === "de" ? locale : "en";
  const t = I18N[safeLocale];

  const [activeAsset, setActiveAsset] = useState<AssetSymbol>("BTC");
  const [currentPrice, setCurrentPrice] = useState<number>(ASSET_CONFIGS.BTC.basePrice);
  const [lastDirection, setLastDirection] = useState<"up" | "down">("up");
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const [orderCount, setOrderCount] = useState<number>(18420);
  const [activeTab, setActiveTab] = useState<"book" | "trades">("book");

  const config = ASSET_CONFIGS[activeAsset];

  // Helper to format prices
  const formatPrice = (val: number, decimals = config.decimals) => {
    return val.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatAmount = (val: number) => {
    return val.toLocaleString("en-US", { minimumFractionDigits: config.amountDecimals, maximumFractionDigits: config.amountDecimals });
  };

  // Generate initial book levels around currentPrice
  const { asks, bids, spread, spreadPercent, bidLiquidityRatio } = useMemo(() => {
    const askLevels: OrderLevel[] = [];
    const bidLevels: OrderLevel[] = [];
    const step = config.spreadMin * 1.5;

    let cumulativeAsk = 0;
    for (let i = 5; i >= 1; i--) {
      const p = currentPrice + i * step;
      const amt = (Math.sin(p) * 2 + 3) * (config.symbol === "BTC" ? 0.35 : config.symbol === "ETH" ? 2.5 : config.symbol === "SOL" ? 25 : 1200);
      const total = p * amt;
      cumulativeAsk += total;
      askLevels.push({ price: p, amount: amt, total, depthPercent: Math.min(100, (i / 5) * 85 + 15) });
    }

    let cumulativeBid = 0;
    for (let i = 1; i <= 5; i++) {
      const p = currentPrice - i * step;
      const amt = (Math.cos(p) * 2 + 3.2) * (config.symbol === "BTC" ? 0.42 : config.symbol === "ETH" ? 2.8 : config.symbol === "SOL" ? 28 : 1350);
      const total = p * amt;
      cumulativeBid += total;
      bidLevels.push({ price: p, amount: amt, total, depthPercent: Math.min(100, ((6 - i) / 5) * 80 + 20) });
    }

    const bestAsk = askLevels[askLevels.length - 1]?.price || currentPrice + step;
    const bestBid = bidLevels[0]?.price || currentPrice - step;
    const calculatedSpread = Math.max(0.0001, bestAsk - bestBid);
    const calculatedSpreadPercent = (calculatedSpread / currentPrice) * 100;
    const ratio = Math.round((cumulativeBid / (cumulativeBid + cumulativeAsk)) * 100);

    return {
      asks: askLevels,
      bids: bidLevels,
      spread: calculatedSpread,
      spreadPercent: calculatedSpreadPercent,
      bidLiquidityRatio: ratio,
    };
  }, [currentPrice, config]);

  // When asset changes, reset price and trades
  useEffect(() => {
    setCurrentPrice(config.basePrice);
    const initialTrades: RecentTrade[] = [
      { id: "1", time: "14:28:44.120", price: config.basePrice, amount: config.symbol === "BTC" ? 0.45 : 3.2, side: "buy" },
      { id: "2", time: "14:28:42.840", price: config.basePrice - config.spreadMin, amount: config.symbol === "BTC" ? 0.18 : 1.5, side: "sell" },
      { id: "3", time: "14:28:41.200", price: config.basePrice + config.spreadMin, amount: config.symbol === "BTC" ? 1.25 : 8.0, side: "buy" },
      { id: "4", time: "14:28:39.950", price: config.basePrice, amount: config.symbol === "BTC" ? 0.82 : 4.4, side: "sell" },
    ];
    setTrades(initialTrades);
  }, [activeAsset, config]);

  // High-frequency, realistic order stream ticker
  useEffect(() => {
    const interval = setInterval(() => {
      // Micro price fluctuation
      const deltaFactor = (Math.random() - 0.485) * (config.spreadMin * 0.8);
      setCurrentPrice((prev) => {
        const next = Math.max(0.001, prev + deltaFactor);
        setLastDirection(deltaFactor >= 0 ? "up" : "down");
        return next;
      });

      // Generate a new realistic executed order trade
      const isBuy = Math.random() > 0.46;
      const now = new Date();
      const timeStr = `${now.toTimeString().split(" ")[0]}.${String(now.getMilliseconds()).padStart(3, "0").slice(0, 2)}`;
      
      const tradeAmount = (Math.random() * 1.8 + 0.1) * (config.symbol === "BTC" ? 0.5 : config.symbol === "ETH" ? 3.5 : config.symbol === "SOL" ? 22 : 950);
      const tradePrice = currentPrice + (isBuy ? config.spreadMin * 0.5 : -config.spreadMin * 0.5);

      const newTrade: RecentTrade = {
        id: Math.random().toString(36).slice(2, 9),
        time: timeStr,
        price: tradePrice,
        amount: tradeAmount,
        side: isBuy ? "buy" : "sell",
      };

      setTrades((prev) => [newTrade, ...prev.slice(0, 6)]);
      setOrderCount((prev) => prev + 1);
    }, 1100);

    return () => clearInterval(interval);
  }, [currentPrice, config]);

  return (
    <div className="relative mx-auto my-8 w-full max-w-5xl rounded-2xl border border-velmere-gold/25 bg-[#07080c]/90 p-3 sm:p-5 shadow-[0_0_50px_rgba(212,175,55,0.08)] backdrop-blur-xl">
      {/* Ambient Cockpit Lighting Lines */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-velmere-gold/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Top Header: Asset Selector & Live Status Ticker */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        {/* Market Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl bg-white/[0.03] p-1">
          {(["BTC", "ETH", "SOL", "VLM"] as AssetSymbol[]).map((sym) => {
            const isSelected = activeAsset === sym;
            return (
              <button
                key={sym}
                onClick={() => setActiveAsset(sym)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-mono font-medium transition-all duration-200 ${
                  isSelected
                    ? "bg-velmere-gold/20 text-velmere-gold shadow-[0_0_12px_rgba(212,175,55,0.25)] border border-velmere-gold/40"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="font-semibold">{sym}</span>
                <span className="text-[10px] text-white/40">/USDT</span>
              </button>
            );
          })}
        </div>

        {/* Live Feed Status & Order Counter */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-semibold text-[11px] tracking-wider">{t.liveFeed}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-white/50 text-[11px]">
            <Radio className="h-3 w-3 text-cyan-400 animate-pulse" />
            <span>#{orderCount.toLocaleString()} {safeLocale === "pl" ? "zleceń" : "events"}</span>
          </div>
        </div>
      </div>

      {/* Mobile View Toggle */}
      <div className="mt-3 flex sm:hidden rounded-lg bg-white/[0.04] p-1 text-xs font-mono">
        <button
          onClick={() => setActiveTab("book")}
          className={`flex-1 py-1.5 rounded-md text-center ${activeTab === "book" ? "bg-velmere-gold/20 text-velmere-gold font-semibold" : "text-white/50"}`}
        >
          {safeLocale === "pl" ? "Księga Zleceń" : "Order Book"}
        </button>
        <button
          onClick={() => setActiveTab("trades")}
          className={`flex-1 py-1.5 rounded-md text-center ${activeTab === "trades" ? "bg-velmere-gold/20 text-velmere-gold font-semibold" : "text-white/50"}`}
        >
          {t.trades}
        </button>
      </div>

      {/* Main Dual Cockpit Grid: Order Book + Recent Executions */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12 font-mono">
        {/* Left Column: L2 Order Book (Asks, Spread, Bids) */}
        <div className={`lg:col-span-7 flex flex-col gap-1 ${activeTab === "trades" ? "hidden sm:flex" : "flex"}`}>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40 px-2 pb-1 border-b border-white/5">
            <span>{t.price} (USDT)</span>
            <span className="text-right">{t.amount} ({config.symbol})</span>
            <span className="text-right">{t.depth}</span>
          </div>

          {/* ASKS (Sprzedaż - Red/Rose with Volume Depth) */}
          <div className="flex flex-col gap-0.5">
            {asks.map((level, idx) => (
              <div
                key={`ask-${level.price}-${idx}`}
                className="relative flex items-center justify-between px-2 py-1 text-xs transition-colors hover:bg-rose-500/10"
              >
                {/* Horizontal Depth Volume Fill */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-rose-500/15 transition-all duration-300 pointer-events-none rounded-l-sm"
                  style={{ width: `${level.depthPercent}%` }}
                />
                <span className="relative z-10 font-semibold text-rose-400">
                  {formatPrice(level.price)}
                </span>
                <span className="relative z-10 text-white/80">
                  {formatAmount(level.amount)}
                </span>
                <span className="relative z-10 text-[10px] text-white/40">
                  ${Math.round(level.total).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* SPREAD & MARK PRICE MIDDLE BANNER */}
          <div className="my-1.5 flex items-center justify-between rounded-lg border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-amber-500/5 px-3 py-2 shadow-inner">
            <div className="flex items-center gap-2">
              <span className={`text-lg sm:text-xl font-bold tracking-tight ${lastDirection === "up" ? "text-emerald-400" : "text-rose-400"}`}>
                {formatPrice(currentPrice)}
              </span>
              <span className="inline-flex items-center text-xs font-semibold">
                {lastDirection === "up" ? (
                  <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-rose-400" />
                )}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-white/60">
              <span>
                {t.spread}: <strong className="text-velmere-gold">${formatPrice(spread, config.spreadMin < 0.1 ? 3 : 2)}</strong>
              </span>
              <span className="text-white/30 hidden sm:inline">•</span>
              <span className="text-white/50 text-[10px] hidden sm:inline">
                {spreadPercent.toFixed(3)}%
              </span>
            </div>
          </div>

          {/* BIDS (Kupno - Emerald/Green with Volume Depth) */}
          <div className="flex flex-col gap-0.5">
            {bids.map((level, idx) => (
              <div
                key={`bid-${level.price}-${idx}`}
                className="relative flex items-center justify-between px-2 py-1 text-xs transition-colors hover:bg-emerald-500/10"
              >
                {/* Horizontal Depth Volume Fill */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 transition-all duration-300 pointer-events-none rounded-l-sm"
                  style={{ width: `${level.depthPercent}%` }}
                />
                <span className="relative z-10 font-semibold text-emerald-400">
                  {formatPrice(level.price)}
                </span>
                <span className="relative z-10 text-white/80">
                  {formatAmount(level.amount)}
                </span>
                <span className="relative z-10 text-[10px] text-white/40">
                  ${Math.round(level.total).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Live Trades Stream (Taśma Zleceń) & Depth Imbalance */}
        <div className={`lg:col-span-5 flex flex-col justify-between rounded-xl border border-white/5 bg-white/[0.015] p-3 ${activeTab === "book" ? "hidden sm:flex" : "flex"}`}>
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 text-xs">
              <span className="font-semibold text-white/80 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-velmere-gold" />
                {t.trades}
              </span>
              <span className="text-[10px] text-white/40 uppercase">{config.pair}</span>
            </div>

            {/* Trades Table Header */}
            <div className="grid grid-cols-3 text-[10px] uppercase tracking-wider text-white/40 pb-1 px-1">
              <span>{t.time}</span>
              <span className="text-center">{t.price}</span>
              <span className="text-right">{t.amount}</span>
            </div>

            {/* Live Trades Stream List */}
            <div className="flex flex-col gap-1 overflow-hidden">
              <AnimatePresence initial={false}>
                {trades.map((tr) => (
                  <motion.div
                    key={tr.id}
                    initial={{ opacity: 0, x: 10, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="grid grid-cols-3 items-center px-1 py-1 text-[11px] rounded hover:bg-white/[0.03]"
                  >
                    <span className="text-white/40 text-[10px]">{tr.time}</span>
                    <span className={`text-center font-medium ${tr.side === "buy" ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatPrice(tr.price)}
                    </span>
                    <span className="text-right text-white/80">
                      {formatAmount(tr.amount)}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Liquidity Imbalance Radar */}
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-[10px] text-white/60 mb-1.5">
              <span>{t.liquidityRatio}</span>
              <span className="text-emerald-400 font-semibold">{bidLiquidityRatio}% Kupno</span>
            </div>

            {/* Liquidity Ratio Gauge */}
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-rose-500/30">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-l-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                style={{ width: `${bidLiquidityRatio}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[9px] text-white/40">
              <span>Bids: {bidLiquidityRatio}%</span>
              <span>Asks: {100 - bidLiquidityRatio}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-footer Micro Ticker */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-[10px] font-mono text-white/40">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-velmere-gold" />
          <span>{t.orderFlowActive}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>LATENCY: <strong>8ms</strong></span>
          <span>•</span>
          <span>SLIPPAGE: <strong>&lt;0.001%</strong></span>
        </div>
      </div>
    </div>
  );
}
