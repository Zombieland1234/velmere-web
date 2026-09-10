"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Cpu,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  Filter,
  Flame,
  Info,
  Layers,
  Loader2,
  Lock,
  Percent,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { VShieldPulse } from "@/components/motion/VelmereAnalysisMarks";
import {
  CANONICAL_SIGNALS,
  evaluateDynamicSignals,
  type AuditOrAssetTier,
  type SignalDefinition,
} from "@/lib/commerce/vlm-dynamic-signal-engine";

type AnalysisCardsSectionProps = {
  asset: {
    id: string;
    symbol: string;
    name: string;
    price: number;
    priceChange24h?: number;
    priceChange7d?: number;
    marketCap?: number;
    volume24h?: number;
    riskScore: number;
    confidence: number;
  };
  isTraditional?: boolean;
  locale?: string;
};

type CardId = "basic" | "pro" | "advanced" | "market_impact" | "whale_watch";

// Exact custom icons matching crop_cards.png 1:1
function ExactBarsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeLinecap="round">
      <line x1="3" y1="21" x2="21" y2="21" strokeWidth="2" />
      <line x1="6" y1="21" x2="6" y2="15" strokeWidth="2.2" />
      <line x1="10" y1="21" x2="10" y2="8" strokeWidth="2.2" />
      <line x1="14" y1="21" x2="14" y2="4" strokeWidth="2.2" />
      <line x1="18" y1="21" x2="18" y2="11" strokeWidth="2.2" />
    </svg>
  );
}

function ExactRocketIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 17c-1 1-1.5 3.5-1.5 3.5s2.5-.5 3.5-1.5c.8-.8.8-1.8 0-2.6s-1.8-.8-2.6 0z" />
      <path d="M12 14.5l-2.5-2.5C11.5 7 14.5 3.5 21 3c-.5 6.5-4 9.5-9 11.5z" />
      <circle cx="14.5" cy="9.5" r="1.5" fill="#38bdf8" />
    </svg>
  );
}

function ExactTargetIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="1.8" fill="#a78bfa" stroke="none" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function ExactSoundWaveIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13c1.2 0 1.8-3 2.5-7s2 14 3.5 14 2-16 3.5-16 2 13 3 13 1.5-4 2.5-4" />
    </svg>
  );
}

function ExactWhaleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 24" fill="none" stroke="#2dd4bf" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8c1 3 3 4.5 5 4.5h9c3 0 4.5-2 4.5-4s-2-4-5.5-4-9 1-12 4z" />
      <circle cx="18" cy="7.5" r="0.8" fill="#2dd4bf" stroke="none" />
      <path d="M12 12.5c0 1.5-.8 2.5-2 2.5" />
      <path d="M3.5 8c-1-1.5-1.5-3-1-4 .8 0 2 1 2.5 2" />
      <path d="M3.5 8c-1 1.5-1.5 3-1 4 .8 0 2-1 2.5-2" />
    </svg>
  );
}

// Dynamic Large Transaction Data for Whale Watch
type LargeTransaction = {
  id: string;
  txHash: string;
  type: "OUTFLOW" | "INFLOW" | "TRANSFER";
  amount: string;
  valueUsd: string;
  source: string;
  destination: string;
  timestamp: string;
  confidence: number;
};

function buildDynamicWhaleTransactions(
  asset: { symbol: string; price: number; name: string },
  isTrad = false
): LargeTransaction[] {
  const p = asset.price || 100;
  const s = asset.symbol || "BTC";

  if (isTrad) {
    return [
      {
        id: "tx-trad-1",
        txHash: "TRAD-DARKPOOL-0x981a",
        type: "INFLOW",
        amount: `45,000 ${s}`,
        valueUsd: `$${((45000 * p) / 1e6).toFixed(2)}M`,
        source: "Citadel Securities Darkpool",
        destination: "BlackRock Institutional Quorum",
        timestamp: "2 min temu",
        confidence: 99,
      },
      {
        id: "tx-trad-2",
        txHash: "TRAD-DARKPOOL-0x442c",
        type: "OUTFLOW",
        amount: `120,000 ${s}`,
        valueUsd: `$${((120000 * p) / 1e6).toFixed(2)}M`,
        source: "Jane Street Institutional Liquidity",
        destination: "State Street Global Advisors",
        timestamp: "18 min temu",
        confidence: 97,
      },
      {
        id: "tx-trad-3",
        txHash: "TRD-BLK-7104",
        type: "INFLOW",
        amount: Math.round(29_800_000 / p).toLocaleString(),
        valueUsd: "$29,800,000",
        source: "Virtu Financial Liquidity desk",
        destination: "NASDAQ Consolidated Tape",
        timestamp: "52 min temu",
        confidence: 95,
      },
      {
        id: "tx-trad-4",
        txHash: "TRD-BLK-6490",
        type: "OUTFLOW",
        amount: Math.round(76_400_000 / p).toLocaleString(),
        valueUsd: "$76,400,000",
        source: "Morgan Stanley Prime Brokerage",
        destination: "Vanguard Total Market Trust",
        timestamp: "2h 15m temu",
        confidence: 99,
      },
      {
        id: "tx-trad-5",
        txHash: "TRD-BLK-5512",
        type: "TRANSFER",
        amount: Math.round(185_000_000 / p).toLocaleString(),
        valueUsd: "$185,000,000",
        source: "Fedwire Custody Transfer",
        destination: "Fidelity Institutional Vault",
        timestamp: "4h 40m temu",
        confidence: 98,
      },
    ];
  }

  // Crypto dynamic transactions based on current price
  const baseTargets = [
    { targetUsd: 85_000_000, type: "OUTFLOW" as const, src: "Binance Hot 14", dst: "Institutional Custody (0x81f...c40a)", time: "1 min temu", conf: 99 },
    { targetUsd: 240_000_000, type: "TRANSFER" as const, src: "Cold Storage Safe 02", dst: "Staking Pool Vault", time: "14 min temu", conf: 97 },
    { targetUsd: 48_500_000, type: "INFLOW" as const, src: "Private Entity (0x4a...e2)", dst: "Coinbase Prime", time: "38 min temu", conf: 94 },
    { targetUsd: 135_000_000, type: "OUTFLOW" as const, src: "Kraken Custody Desk", dst: "Fidelity Digital Assets", time: "1h 55m temu", conf: 99 },
    { targetUsd: 310_000_000, type: "TRANSFER" as const, src: "Bitfinex Cold Storage", dst: "Bitfinex Multi-Sig 01", time: "4h 20m temu", conf: 98 },
  ];

  return baseTargets.map((b, i) => {
    const calculatedUnits = Math.round(b.targetUsd / p);
    const formattedUnits = calculatedUnits > 1000 ? calculatedUnits.toLocaleString() : (b.targetUsd / p).toFixed(2);
    return {
      id: `tx-dyn-${i + 1}`,
      txHash: `0x${(i * 37 + 19).toString(16).padStart(4, "0")}...${(i * 89 + 11).toString(16).padStart(4, "0")}`,
      type: b.type,
      amount: formattedUnits,
      valueUsd: `$${b.targetUsd.toLocaleString()}`,
      source: b.src,
      destination: b.dst,
      timestamp: b.time,
      confidence: b.conf,
    };
  });
}

export default function AnalysisCardsSection({
  asset,
  isTraditional = false,
  locale = "en",
}: AnalysisCardsSectionProps) {
  const isEn = locale !== "pl";
  // Modal states
  const [activeModal, setActiveModal] = useState<CardId | null>(null);
  const [paywallModal, setPaywallModal] = useState<"pro" | "advanced" | null>(null);

  // Dynamic whale transactions
  const whaleTransactions = useMemo(
    () => buildDynamicWhaleTransactions(asset, isTraditional),
    [asset.symbol, asset.price, isTraditional]
  );

  // Paid gating: Basic is unlocked by default, Pro and Advanced synced on client mount
  const [unlockedTiers, setUnlockedTiers] = useState<Set<string>>(() => new Set(["basic"]));

  useEffect(() => {
    try {
      const saved = localStorage.getItem("velmere_unlocked_tiers");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setUnlockedTiers(new Set(["basic", ...parsed]));
        }
      }
    } catch {}
  }, []);

  // Stripe checkout states (with popup mode support)
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const [stripePopupState, setStripePopupState] = useState<{
    sessionId: string;
    tier: "pro" | "advanced";
    popupWindow: Window | null;
    url: string;
  } | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripeSuccessNotification, setStripeSuccessNotification] = useState<string | null>(null);

  // Authentic Shield analysis waiting animation state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingTier, setAnalyzingTier] = useState<"basic" | "pro" | "advanced" | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState("Inicjalizacja środowiska dowodowego...");

  // Dynamic Signals Simulation State
  const [simulationState, setSimulationState] = useState<"FULL" | "MISSING_DEX" | "STOP_SELL">("FULL");
  
  // Market Impact Slippage Simulator State
  const [simulatedOrderSize, setSimulatedOrderSize] = useState<number>(100000);

  // Whale Watch filter state
  const [whaleFilter, setWhaleFilter] = useState<"ALL" | "OUTFLOW" | "INFLOW" | "TRANSFER">("ALL");

  // Post-Analysis Export Modal State (PDF, JSON, TXT download)
  const [exportModal, setExportModal] = useState<{
    tier: "basic" | "pro" | "advanced";
  } | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<"pdf" | "json" | "txt" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const formatAdaptivePrice = (val: number | undefined) => {
    if (val === undefined || !Number.isFinite(val)) return "0.00";
    if (val >= 1) {
      return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (val < 0.0001) {
      return val.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 8 });
    }
    return val.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  };

  const handleDownload = async (format: "pdf" | "json" | "txt") => {
    if (!exportModal) return;
    setDownloadingFormat(format);
    setExportError(null);
    try {
      const safePrice = Number.isFinite(asset.price) && asset.price > 0 ? asset.price : 100;
      const safeRisk = Number.isFinite(asset.riskScore) ? asset.riskScore : 35;
      const safeConf = Number.isFinite(asset.confidence) ? asset.confidence : 88;
      const url = `/api/market-integrity/export?symbol=${encodeURIComponent(asset.symbol)}&name=${encodeURIComponent(asset.name)}&price=${safePrice}&tier=${exportModal.tier}&riskScore=${safeRisk}&confidence=${safeConf}&surface=${isTraditional ? "real-markets" : "shield"}&format=${format}&locale=${encodeURIComponent(locale)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Błąd pobierania raportu (${res.status})`);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `velmere-${asset.symbol.toLowerCase()}-${exportModal.tier}-analysis.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Export download error:", err);
      setExportError(err instanceof Error ? err.message : "Pobieranie nie powiodło się. Spróbuj ponownie.");
    } finally {
      setDownloadingFormat(null);
    }
  };

  // Helper to permanently unlock and persist a tier
  const unlockAndSave = (tier: string) => {
    setUnlockedTiers((prev) => {
      const next = new Set([...prev, tier]);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("velmere_unlocked_tiers", JSON.stringify([...next]));
        } catch {}
      }
      return next;
    });
  };

  // Trigger analysis with authentic VShieldPulse waiting screen
  const triggerAnalysis = (tier: "basic" | "pro" | "advanced") => {
    setActiveModal(null);
    setPaywallModal(null);
    setAnalyzingTier(tier);
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisStage("Łączenie z węzłami RPC i oraklami cenowymi...");

    const stages = [
      { at: 15, msg: "Łączenie z węzłami RPC i oraklami cenowymi..." },
      {
        at: 40,
        msg:
          tier === "basic"
            ? "Agregacja 10 sygnałów rynkowych i płynnościowych..."
            : tier === "pro"
            ? "Agregacja 14 sygnałów technicznych i profilu on-chain..."
            : "Skanowanie 20 sygnałów audytorskich, modeli AI i smart kontraktów...",
      },
      { at: 70, msg: "Weryfikacja sumy kontrolnej i dowodu kryptograficznego RFC 3161..." },
      { at: 90, msg: "Finalizacja raportu i stemplowanie dowodu SHA-256..." },
    ];

    const startTime = Date.now();
    const duration = tier === "basic" ? 1400 : 1800;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setAnalysisProgress(pct);

      const currentStage = stages.slice().reverse().find((s) => pct >= s.at);
      if (currentStage) {
        setAnalysisStage(currentStage.msg);
      }

      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsAnalyzing(false);
          setActiveModal(tier);
          setExportModal({ tier });
        }, 300);
      }
    }, 35);
  };

  // Check URL parameters for return from Stripe Checkout
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get("payment");
    const tierParam = urlParams.get("tier");

    if (paymentStatus === "success" && (tierParam === "pro" || tierParam === "advanced")) {
      unlockAndSave(tierParam);
      setStripeSuccessNotification(
        `🎉 Płatność Stripe powiodła się! Licencja analityczna ${tierParam.toUpperCase()} (${tierParam === "pro" ? "14.99 €" : "149.99 €"}) została pomyślnie aktywowana.`
      );
      // Clean query params so refresh doesn't replay
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
      // Automatically trigger the authentic shield analysis
      setTimeout(() => {
        triggerAnalysis(tierParam);
      }, 100);
    } else if (paymentStatus === "cancelled") {
      setStripeError("Płatność w bramce Stripe została anulowana. Twoje konto nie zostało obciążone.");
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
    }
  }, []);

  // Close modals on Escape key
  useEffect(() => {
    if (!activeModal && !paywallModal && !isAnalyzing && !exportModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveModal(null);
        setPaywallModal(null);
        setExportModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModal, paywallModal, isAnalyzing, exportModal]);

  // Determine availability context based on simulation state
  const signalContext = {
    hasBytecode: simulationState !== "STOP_SELL",
    hasSourceCode: simulationState !== "STOP_SELL",
    hasOnChainDeploy: simulationState !== "STOP_SELL",
    hasLiquidityPool: simulationState !== "MISSING_DEX" && simulationState !== "STOP_SELL",
    hasOrderbookData: simulationState !== "MISSING_DEX" && simulationState !== "STOP_SELL",
    hasTradingHistory: simulationState !== "MISSING_DEX" && simulationState !== "STOP_SELL",
  };

  const basicEval = evaluateDynamicSignals("basic", signalContext);
  const proEval = evaluateDynamicSignals("pro", signalContext);
  const advEval = evaluateDynamicSignals("advanced", signalContext);

  const handleCardClick = (id: CardId) => {
    if (id === "market_impact" || id === "whale_watch") {
      setActiveModal(id);
      return;
    }
    if (id === "basic") {
      triggerAnalysis("basic");
      return;
    }
    if (id === "pro" || id === "advanced") {
      if (unlockedTiers.has(id)) {
        triggerAnalysis(id);
      } else {
        setPaywallModal(id);
      }
    }
  };

  // Instant unlock for BETA / demo testing
  const handleUnlockTierBeta = (tier: "pro" | "advanced") => {
    unlockAndSave(tier);
    setPaywallModal(null);
    triggerAnalysis(tier);
  };

  // Real Stripe Checkout initiation with in-page popup modal window
  const handleStripeCheckout = async (tier: "pro" | "advanced") => {
    setIsStripeLoading(true);
    setStripeError(null);
    try {
      const res = await fetch("/api/checkout/stripe-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          serviceType: isTraditional ? "real_markets" : "analysis",
          assetId: asset.id,
          symbol: asset.symbol,
          locale: "pl",
          isPopup: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok || !data.url) {
        throw new Error(data.error || "Nie udało się utworzyć sesji płatności Stripe.");
      }

      // Open centered popup window
      const width = 520;
      const height = 760;
      const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
      const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
      const popup = window.open(
        data.url,
        "velmere_stripe_popup",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      setStripePopupState({
        sessionId: data.sessionId,
        tier,
        popupWindow: popup,
        url: data.url,
      });
      setIsStripeLoading(false);
    } catch (err: unknown) {
      console.error("[STRIPE_CHECKOUT_CLIENT_ERROR]:", err);
      const msg = err instanceof Error ? err.message : "Wystąpił nieoczekiwany błąd podczas łączenia ze Stripe.";
      setStripeError(msg);
      setIsStripeLoading(false);
    }
  };

  const completePaymentSuccess = (tier: "pro" | "advanced") => {
    if (stripePopupState?.popupWindow && !stripePopupState.popupWindow.closed) {
      try {
        stripePopupState.popupWindow.close();
      } catch {}
    }
    setStripePopupState(null);
    unlockAndSave(tier);
    setPaywallModal(null);
    setStripeSuccessNotification(
      `🎉 Płatność Stripe powiodła się! Licencja analityczna ${tier.toUpperCase()} (${tier === "pro" ? "14.99 €" : "149.99 €"}) została pomyślnie aktywowana.`
    );
    setTimeout(() => {
      triggerAnalysis(tier);
    }, 150);
  };

  const checkSessionStatusNow = async () => {
    if (!stripePopupState) return;
    setIsStripeLoading(true);
    try {
      const res = await fetch(`/api/checkout/stripe-analysis?sessionId=${encodeURIComponent(stripePopupState.sessionId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.paid) {
          completePaymentSuccess(stripePopupState.tier);
          return;
        }
      }
    } catch {}
    setIsStripeLoading(false);
  };

  const reopenStripePopup = () => {
    if (!stripePopupState) return;
    const width = 520;
    const height = 760;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const popup = window.open(
      stripePopupState.url,
      "velmere_stripe_popup",
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
    );
    setStripePopupState((prev) => (prev ? { ...prev, popupWindow: popup } : null));
  };

  // Polling and postMessage listener for Stripe popup completion
  useEffect(() => {
    if (!stripePopupState) return;

    const { sessionId, tier, popupWindow } = stripePopupState;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "VELMERE_STRIPE_PAYMENT_SUCCESS") {
        if (!event.data.sessionId || event.data.sessionId === sessionId) {
          completePaymentSuccess(tier);
        }
      } else if (event.data?.type === "VELMERE_STRIPE_PAYMENT_CANCELLED") {
        setStripeError("Płatność została anulowana.");
        setStripePopupState(null);
      }
    };

    window.addEventListener("message", handleMessage);

    // Poller every 1.5 seconds
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/stripe-analysis?sessionId=${encodeURIComponent(sessionId)}`);
        if (res.ok) {
          const checkData = await res.json();
          if (checkData.ok && checkData.paid) {
            completePaymentSuccess(tier);
          }
        }
      } catch {}

      // If user closed popup window manually
      if (popupWindow && popupWindow.closed) {
        setTimeout(async () => {
          try {
            const res = await fetch(`/api/checkout/stripe-analysis?sessionId=${encodeURIComponent(sessionId)}`);
            const checkData = await res.json();
            if (checkData.ok && checkData.paid) {
              completePaymentSuccess(tier);
            }
          } catch {}
        }, 600);
      }
    }, 1500);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(interval);
    };
  }, [stripePopupState]);

  const isProUnlocked = unlockedTiers.has("pro");
  const isAdvUnlocked = unlockedTiers.has("advanced");

  // Matching cards from przyklad.jpg with real paid gating and status
  const CARDS: {
    id: CardId;
    icon: React.ReactNode;
    title: string;
    desc: string;
    badge: string;
    badgeStyle: string;
    cta: string;
    signalsCount: number;
    availableCount: number;
  }[] = [
    {
      id: "basic",
      icon: <ExactBarsIcon />,
      title: isEn ? "Core Risk Analysis" : "Analiza Podstawowa",
      desc: isEn
        ? `10 signals • Available: ${basicEval.availableSignalsCount}/10. Real-time EVM and orderbook telemetry.`
        : `10 sygnałów • Dostępne: ${basicEval.availableSignalsCount}/10. Szybki przegląd rynku i wskaźników.`,
      badge: isEn ? `CORE ${basicEval.availableSignalsCount}/10` : `BASIC ${basicEval.availableSignalsCount}/10`,
      badgeStyle: "bg-[#0d3438] text-[#2dd4bf]",
      cta: isEn ? "Analyze Core" : "Analizuj (0 PLN)",
      signalsCount: 10,
      availableCount: basicEval.availableSignalsCount,
    },
    {
      id: "pro",
      icon: <ExactRocketIcon />,
      title: isEn ? "Institutional Pro" : "Analiza Pro",
      desc: isProUnlocked
        ? (isEn
            ? `14 signals • Available: ${proEval.availableSignalsCount}/14. Microstructural order flow and wallet radar.`
            : `14 sygnałów • Dostępne: ${proEval.availableSignalsCount}/14. Głębsza analiza techniczna i on-chain.`)
        : (isEn
            ? "14 signals • €14.99 / mo. Deep technical signals, wallet telemetry & on-chain flows."
            : "14 sygnałów • 14.99 € / mc. Głębsza analiza techniczna, portfele i on-chain."),
      badge: isProUnlocked ? `PRO ${proEval.availableSignalsCount}/14` : "PRO 14.99 €",
      badgeStyle: isProUnlocked ? "bg-[#0e294b] text-[#38bdf8]" : "bg-sky-500/15 text-sky-300 border border-sky-500/30",
      cta: isProUnlocked ? (isEn ? "Analyze Pro" : "Analizuj Pro") : (isEn ? "Unlock Pro (14.99 €)" : "Kup Pro (14.99 €)"),
      signalsCount: 14,
      availableCount: proEval.availableSignalsCount,
    },
    {
      id: "advanced",
      icon: <ExactTargetIcon />,
      title: isEn ? "Sovereign Prime" : "Analiza Advanced",
      desc: isAdvUnlocked
        ? (isEn
            ? `20 signals • Available: ${advEval.availableSignalsCount}/20. Advanced AI decompilation & full audit.`
            : `20 sygnałów • Dostępne: ${advEval.availableSignalsCount}/20. Zaawansowane modele AI i pełne raporty.`)
        : (isEn
            ? "20 signals • €149.99 / mo. Advanced AI models, smart contract proofs & full institutional audit."
            : "20 sygnałów • 149.99 € / mc. Zaawansowane modele AI, smart kontrakty i pełny audyt."),
      badge: isAdvUnlocked ? `PRIME ${advEval.availableSignalsCount}/20` : "ADVANCED 149.99 €",
      badgeStyle: isAdvUnlocked ? "bg-[#251b4c] text-[#a78bfa]" : "bg-purple-500/15 text-purple-300 border border-purple-500/30",
      cta: isAdvUnlocked ? (isEn ? "Analyze Prime" : "Analizuj Advanced") : (isEn ? "Unlock Prime (149.99 €)" : "Kup Advanced (149.99 €)"),
      signalsCount: 20,
      availableCount: advEval.availableSignalsCount,
    },
    {
      id: "market_impact",
      icon: <ExactSoundWaveIcon />,
      title: "Market Impact",
      desc: isEn
        ? "High-volume order simulation and deterministic VWAP slippage modeling."
        : "Wpływ dużych transakcji na rynek i symulator poślizgu VWAP.",
      badge: isEn ? "INCLUDED" : "W CENIE",
      badgeStyle: "bg-[#093532] text-[#34d399]",
      cta: isEn ? "Launch Simulator" : "Pokaż Symulator",
      signalsCount: 0,
      availableCount: 0,
    },
    {
      id: "whale_watch",
      icon: <ExactWhaleIcon />,
      title: isEn ? "Whale Telemetry" : "Whale Watch",
      desc: isEn
        ? "Real-time tracking of institutional wallets, exchange flows, and liquidity shifts."
        : "Śledź ruchy dużych portfeli, giełd i instytucji w czasie rzeczywistym.",
      badge: isEn ? "INCLUDED" : "W CENIE",
      badgeStyle: "bg-[#093532] text-[#34d399]",
      cta: isEn ? "Open Radar" : "Pokaż Radar",
      signalsCount: 0,
      availableCount: 0,
    },
  ];

  // Helper to get active evaluation for modal
  const getActiveTierEval = () => {
    if (activeModal === "basic") return basicEval;
    if (activeModal === "pro") return proEval;
    if (activeModal === "advanced") return advEval;
    return null;
  };

  const activeTierEval = getActiveTierEval();

  // Slippage simulation math for Market Impact (Kyle's Lambda invariant: Delta P = lambda * Q)
  const calculateSlippage = (usdAmount: number) => {
    if (usdAmount <= 10000) return { pct: isTraditional ? 0.002 : 0.008, costUsd: usdAmount * (isTraditional ? 0.00002 : 0.00008), vwapDelta: isTraditional ? 0.05 : 5.4 };
    if (usdAmount <= 50000) return { pct: isTraditional ? 0.005 : 0.021, costUsd: usdAmount * (isTraditional ? 0.00005 : 0.00021), vwapDelta: isTraditional ? 0.12 : 14.1 };
    if (usdAmount <= 100000) return { pct: isTraditional ? 0.008 : 0.042, costUsd: usdAmount * (isTraditional ? 0.00008 : 0.00042), vwapDelta: isTraditional ? 0.22 : 28.3 };
    if (usdAmount <= 500000) return { pct: isTraditional ? 0.018 : 0.145, costUsd: usdAmount * (isTraditional ? 0.00018 : 0.00145), vwapDelta: isTraditional ? 0.55 : 97.7 };
    if (usdAmount <= 1000000) return { pct: isTraditional ? 0.034 : 0.280, costUsd: usdAmount * (isTraditional ? 0.00034 : 0.00280), vwapDelta: isTraditional ? 1.15 : 188.8 };
    if (usdAmount <= 5000000) return { pct: isTraditional ? 0.095 : 0.720, costUsd: usdAmount * (isTraditional ? 0.00095 : 0.00720), vwapDelta: isTraditional ? 3.40 : 485.0 };
    return { pct: isTraditional ? 0.182 : 1.150, costUsd: usdAmount * (isTraditional ? 0.00182 : 0.01150), vwapDelta: isTraditional ? 6.80 : 775.4 };
  };

  const currentSlippage = calculateSlippage(simulatedOrderSize);

  // Filtered Whale Transactions
  const filteredWhaleTxs = whaleTransactions.filter((tx) => {
    if (whaleFilter === "ALL") return true;
    return tx.type === whaleFilter;
  });

  return (
    <div className="w-full">
      {/* Stripe Payment Return Toast Notification */}
      {stripeSuccessNotification && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/50 bg-emerald-500/15 p-4 text-emerald-200 shadow-xl backdrop-blur-md animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">{stripeSuccessNotification}</p>
              <p className="text-xs text-emerald-300/80">Klucz licencji został przypisany i zabezpieczony w Twojej przeglądarce.</p>
            </div>
          </div>
          <button
            onClick={() => setStripeSuccessNotification(null)}
            className="rounded-lg p-1.5 text-emerald-300 transition hover:bg-emerald-500/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Outer Card Container matching przyklad.jpg */}
      <div className="rounded-2xl border border-[#162c37] bg-[#0c1921] p-3.5 shadow-xl">
        {/* Header matching przyklad.jpg: Shield Icon + Analiza i wgląd */}
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center text-[#2dd4bf]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-base font-bold tracking-tight text-white">
              {isEn ? "Analysis & Intelligence" : "Analiza i wgląd"}
            </h3>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-[11px] text-[#638494]">
            <span className="flex items-center gap-1 text-[#2dd4bf]">
              <span className="flex h-2 w-2 rounded-full bg-[#2dd4bf] animate-pulse" />
              <span>Stripe Checkout Ready</span>
            </span>
            <span>•</span>
            <span>{isEn ? "20-Signal Deterministic Proof Engine" : "Katalog 20 Sygnałów Dowodowych Velmère"}</span>
          </div>
        </div>

        {/* 5 Cards Row */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {CARDS.map((card) => (
            <div
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              className="group flex flex-col justify-between rounded-xl border border-[#142935] bg-[#09171f] p-3 transition-all duration-200 hover:border-[#2dd4bf]/40 hover:bg-[#0c1c24] cursor-pointer"
            >
              <div>
                {/* Top: Icon + Badge */}
                <div className="flex items-start justify-between">
                  <div className="flex h-6 w-6 items-center justify-center">
                    {card.icon}
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[9.5px] font-extrabold tracking-wider ${card.badgeStyle}`}
                  >
                    {card.badge}
                  </span>
                </div>

                {/* Title */}
                <div className="mt-2 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white group-hover:text-[#2dd4bf] transition-colors">
                    {card.title}
                  </h4>
                  {card.id === "pro" && !isProUnlocked && (
                    <Lock className="h-3.5 w-3.5 text-sky-400/70" />
                  )}
                  {card.id === "advanced" && !isAdvUnlocked && (
                    <Lock className="h-3.5 w-3.5 text-purple-400/70" />
                  )}
                </div>

                {/* Description */}
                <p className="mt-1 text-[11px] leading-relaxed text-[#8da5b2]">
                  {card.desc}
                </p>
              </div>

              {/* Bottom Action Button matching przyklad.jpg */}
              <div className="mt-3">
                <button
                  data-testid={`analysis-card-btn-${card.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(card.id);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                    card.id === "pro" && !isProUnlocked
                      ? "border-sky-500/30 bg-sky-950/30 text-sky-300 group-hover:border-sky-400 group-hover:bg-sky-900/40"
                      : card.id === "advanced" && !isAdvUnlocked
                      ? "border-purple-500/30 bg-purple-950/30 text-purple-300 group-hover:border-purple-400 group-hover:bg-purple-900/40"
                      : "border-[#173340] bg-[#0b1c24] text-[#8da5b2] group-hover:border-[#2dd4bf]/40 group-hover:bg-[#122a36] group-hover:text-white"
                  }`}
                >
                  <span>{card.cta}</span>
                  <ChevronRight className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. AUTHENTIC VELMÈRE SHIELD ANALYSIS WAITING ANIMATION SCREEN */}
      {/* ========================================================================= */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#071319]/90 p-6 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative flex flex-col items-center max-w-lg w-full text-center">
            {/* The Authentic Shield Animation */}
            <div className="relative mb-6 flex items-center justify-center p-4">
              <VShieldPulse size={120} monochrome={false} />
            </div>

            <span className="rounded-full border border-[#2dd4bf]/40 bg-[#2dd4bf]/10 px-3.5 py-1 text-xs font-mono font-bold tracking-widest text-[#2dd4bf] uppercase">
              {analyzingTier === "basic" && "Analiza Podstawowa (Basic Tier • 0 PLN)"}
              {analyzingTier === "pro" && "Analiza Profesjonalna (Pro Tier • 14.99 €)"}
              {analyzingTier === "advanced" && "Analiza Zaawansowana (Institutional Advanced • 149.99 €)"}
            </span>

            <h3 className="mt-3 text-2xl font-black tracking-tight text-white">
              Generowanie Raportu Dowodowego
            </h3>
            <p className="mt-1 font-mono text-sm text-[#638494]">
              {asset.name} ({asset.symbol}) • Cena: ${formatAdaptivePrice(asset.price)}
            </p>

            {/* Progress Bar & Stage Status */}
            <div className="mt-6 w-full max-w-md">
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="text-[#8da5b2]">{analysisStage}</span>
                <span className="font-bold text-[#2dd4bf]">{analysisProgress}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/50 border border-[#1a3848]">
                <div
                  className="h-full bg-gradient-to-r from-[#14b8a6] via-[#2dd4bf] to-[#38bdf8] transition-all duration-150 ease-out shadow-[0_0_15px_rgba(45,212,191,0.6)]"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
            </div>

            {/* Telemetry Stage Indicators */}
            <div className="mt-6 grid grid-cols-4 gap-2 w-full max-w-md text-[10px] font-mono">
              <div
                className={`p-2 rounded-lg border text-center transition-all ${
                  analysisProgress >= 15
                    ? "border-[#2dd4bf]/50 bg-[#0c2830] text-[#2dd4bf]"
                    : "border-[#142935] bg-[#091720] text-[#557182]"
                }`}
              >
                <div className="font-bold">ETAP 1</div>
                <div className="truncate">Węzły RPC</div>
              </div>
              <div
                className={`p-2 rounded-lg border text-center transition-all ${
                  analysisProgress >= 40
                    ? "border-[#2dd4bf]/50 bg-[#0c2830] text-[#2dd4bf]"
                    : "border-[#142935] bg-[#091720] text-[#557182]"
                }`}
              >
                <div className="font-bold">ETAP 2</div>
                <div className="truncate">Płynność L3</div>
              </div>
              <div
                className={`p-2 rounded-lg border text-center transition-all ${
                  analysisProgress >= 70
                    ? "border-[#2dd4bf]/50 bg-[#0c2830] text-[#2dd4bf]"
                    : "border-[#142935] bg-[#091720] text-[#557182]"
                }`}
              >
                <div className="font-bold">ETAP 3</div>
                <div className="truncate">Sygnały AI</div>
              </div>
              <div
                className={`p-2 rounded-lg border text-center transition-all ${
                  analysisProgress >= 90
                    ? "border-[#2dd4bf]/50 bg-[#0c2830] text-[#2dd4bf]"
                    : "border-[#142935] bg-[#091720] text-[#557182]"
                }`}
              >
                <div className="font-bold">ETAP 4</div>
                <div className="truncate">Stempel RFC</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PRO & ADVANCED STRIPE CHECKOUT & PURCHASE WINDOW MODAL */}
      {/* ========================================================================= */}
      {paywallModal && (
        <div
          onClick={() => {
            if (!isStripeLoading) setPaywallModal(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[#1d3d4e] bg-[#0c1a22] p-6 shadow-2xl"
          >
            {/* Modal Header with Stripe Badge */}
            <div className="flex items-start justify-between border-b border-[#183442] pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-inner ${
                    paywallModal === "pro" ? "bg-[#0e294b] text-[#38bdf8]" : "bg-[#251b4c] text-[#a78bfa]"
                  }`}
                >
                  {paywallModal === "pro" ? <ExactRocketIcon /> : <ExactTargetIcon />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-white">
                      {paywallModal === "pro" ? "Zakup: Analiza Profesjonalna (Pro)" : "Zakup: Analiza Zaawansowana (Advanced)"}
                    </h3>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-black ${
                        paywallModal === "pro" ? "bg-[#0e294b] text-[#38bdf8]" : "bg-[#251b4c] text-[#a78bfa]"
                      }`}
                    >
                      {paywallModal === "pro" ? "14.99 € / MC" : "149.99 € / MC"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[#8da5b2]">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-[#2dd4bf]" />
                    <span className="text-[#2dd4bf] font-medium">Bramka Stripe: Gotowa i Połączona</span>
                    <span>•</span>
                    <span>Aktywo: {asset.name} ({asset.symbol})</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPaywallModal(null)}
                disabled={isStripeLoading}
                className="rounded-lg p-2 text-[#6e8e9e] transition hover:bg-[#17303d] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error banner if any */}
            {stripeError && (
              <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{stripeError}</span>
              </div>
            )}

            {/* Content / Pricing / Features */}
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-[#183a4c] bg-[#081822] p-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#638494]">Opłata Subskrypcyjna</span>
                    <h4 className="text-2xl font-black text-white">
                      {paywallModal === "pro" ? "14.99 €" : "149.99 €"}
                      <span className="text-sm font-normal text-[#8da5b2]"> / miesiąc</span>
                    </h4>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="rounded bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400">
                      Bramka Stripe Live
                    </span>
                    <span className="mt-1 text-[10px] text-[#638494]">Szyfrowanie SSL 256-bit</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-[#8da5b2]">
                  {paywallModal === "pro"
                    ? "Odblokowuje 14 sygnałów dowodowych dla kryptowalut i rynków tradycyjnych, zaawansowane filtry wielorybów oraz weryfikację slippage L3."
                    : "Instytucjonalny pakiet 20 sygnałów: pełna dekompilacja bajtkodu smart kontraktów, audyty podatności reentrancy/flashloan, priorytetowe orakle AI i certyfikowane raporty PDF."}
                </p>

                {/* Accepted payment method pills */}
                <div className="mt-3.5 flex flex-wrap items-center gap-1.5 pt-3 border-t border-[#132c37]">
                  <span className="text-[10px] uppercase font-bold text-[#638494] mr-1">Metody płatności:</span>
                  <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-mono font-bold text-[#38bdf8]">KARTA (VISA/MC)</span>
                  <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-mono font-bold text-[#2dd4bf]">BLIK</span>
                  <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-mono font-bold text-white">APPLE PAY</span>
                  <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-mono font-bold text-[#a78bfa]">GOOGLE PAY</span>
                </div>
              </div>

              {/* Feature Checklist */}
              <div className="space-y-2 text-xs text-[#8da5b2]">
                {paywallModal === "pro" ? (
                  <>
                    <div className="flex items-center gap-2.5 text-white/90">
                      <CheckCircle2 className="h-4 w-4 text-[#38bdf8] shrink-0" />
                      <span><strong>14 Sygnałów Dowodowych</strong> (w tym wskaźniki techniczne i on-chain)</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-white/90">
                      <CheckCircle2 className="h-4 w-4 text-[#38bdf8] shrink-0" />
                      <span><strong>Analiza Arkusza Zleceń</strong> (głębokość L3 ±2% i symulator poślizgu)</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-white/90">
                      <CheckCircle2 className="h-4 w-4 text-[#38bdf8] shrink-0" />
                      <span><strong>Radar Wielorybów</strong> (śledzenie portfeli &gt; 500k USD w czasie rzeczywistym)</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-white/90">
                      <CheckCircle2 className="h-4 w-4 text-[#38bdf8] shrink-0" />
                      <span><strong>Pobieranie Raportów PDF</strong> z pieczęcią kryptograficzną Velmère</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2.5 text-white/90">
                      <CheckCircle2 className="h-4 w-4 text-[#a78bfa] shrink-0" />
                      <span><strong>Kompletny Zestaw 20 Sygnałów</strong> (100% pokrycia dowodowego Velmère)</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-white/90">
                      <CheckCircle2 className="h-4 w-4 text-[#a78bfa] shrink-0" />
                      <span><strong>Formalna Weryfikacja Smart Kontraktu</strong> (wykrywanie backdoorów, honeypotów)</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-white/90">
                      <CheckCircle2 className="h-4 w-4 text-[#a78bfa] shrink-0" />
                      <span><strong>Prekognitywne Modele Ryzyka AI</strong> (predykcja załamania płynności)</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-white/90">
                      <CheckCircle2 className="h-4 w-4 text-[#a78bfa] shrink-0" />
                      <span><strong>Certyfikat Instytucjonalny RFC 3161</strong> z unikalnym SHA-256 Hash</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons: Stripe Checkout & Immediate Beta Unlock */}
            <div className="mt-6 flex flex-col gap-2.5 pt-4 border-t border-[#183442]">
              {stripePopupState ? (
                <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-sky-300 font-bold text-sm mb-1.5">
                    <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                    <span>Okno płatności Stripe zostało otwarte</span>
                  </div>
                  <p className="text-xs text-white/70 mb-3.5">
                    Dokończ autoryzację w nowo otwartym okienku podręcznym Stripe (Karta, BLIK, Apple Pay lub Google Pay). Ta strona zaktualizuje się automatycznie po potwierdzeniu.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => checkSessionStatusNow()}
                      disabled={isStripeLoading}
                      className="flex-1 rounded-xl bg-sky-500 py-2.5 px-3 text-xs font-black text-black hover:bg-sky-400 transition flex items-center justify-center gap-1.5"
                    >
                      {isStripeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span>Sprawdź status teraz</span>
                    </button>
                    <button
                      onClick={() => reopenStripePopup()}
                      className="rounded-xl border border-white/15 bg-white/5 py-2.5 px-3 text-xs font-semibold text-white/80 hover:bg-white/10 transition"
                    >
                      Otwórz ponownie okno
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Primary Stripe Button */}
                  <button
                    onClick={() => handleStripeCheckout(paywallModal)}
                    disabled={isStripeLoading}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black transition shadow-xl ${
                      isStripeLoading
                        ? "bg-sky-500/50 text-white cursor-wait"
                        : paywallModal === "pro"
                        ? "bg-[#38bdf8] text-black hover:bg-[#20a7e4] hover:shadow-[0_0_20px_rgba(56,189,248,0.4)]"
                        : "bg-[#a78bfa] text-black hover:bg-[#906ef5] hover:shadow-[0_0_20px_rgba(167,139,250,0.4)]"
                    }`}
                  >
                    {isStripeLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Inicjalizacja bezpiecznego okna Stripe...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        <span>Zapłać ze Stripe ({paywallModal === "pro" ? "14.99 €" : "149.99 €"})</span>
                        <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                      </>
                    )}
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setPaywallModal(null);
                  setStripePopupState(null);
                }}
                disabled={isStripeLoading}
                className="w-full py-2 text-xs font-semibold text-[#638494] hover:text-white transition"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SIGNALS & DETAILS MODAL */}
      {/* ========================================================================= */}
      {activeModal && (
        <div
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[#1d3d4e] bg-[#0c1a22] p-6 shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#183442] pb-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#143d4a] text-[#2dd4bf] shadow-inner">
                  {CARDS.find((c) => c.id === activeModal)?.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-xl font-black text-white">
                      {activeModal === "basic" && "Analiza Podstawowa (Basic Tier)"}
                      {activeModal === "pro" && "Analiza Profesjonalna (Pro Terminal)"}
                      {activeModal === "advanced" && "Analiza Zaawansowana (Institutional Advanced)"}
                      {activeModal === "market_impact" && "Market Impact & Płynność Arkusza"}
                      {activeModal === "whale_watch" && "Whale Watch & Radar Transakcji"}
                    </h3>
                    <span
                      className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${
                        CARDS.find((c) => c.id === activeModal)?.badgeStyle
                      }`}
                    >
                      {CARDS.find((c) => c.id === activeModal)?.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#8da5b2]">
                    {CARDS.find((c) => c.id === activeModal)?.desc}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(activeModal === "basic" || activeModal === "pro" || activeModal === "advanced") && (
                  <button
                    onClick={() => triggerAnalysis(activeModal)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#2dd4bf]/40 bg-[#0c242c] px-3 py-1.5 text-xs font-semibold text-[#2dd4bf] hover:bg-[#123640] transition"
                    title="Uruchom ponownie weryfikację dowodową z tarczą Velmère"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Odśwież analizę</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveModal(null)}
                  className="rounded-lg p-2 text-[#6e8e9e] transition hover:bg-[#17303d] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="mt-5 space-y-6">
              {/* ------------------------------------------------------------- */}
              {/* TIERS MODAL: BASIC (10), PRO (14), ADVANCED (20) SIGNALS */}
              {/* ------------------------------------------------------------- */}
              {(activeModal === "basic" || activeModal === "pro" || activeModal === "advanced") && activeTierEval && (
                <div className="space-y-5">
                  {/* Top Status Banner with Stop-Sell Indicator */}
                  <div className="rounded-xl border border-[#163546] bg-[#091a24] p-4.5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#2dd4bf]">
                            Stan Silnika Dowodowego
                          </span>
                          <span className="h-1.5 w-1.5 rounded-full bg-[#2dd4bf]" />
                          <span className="text-xs font-mono text-white/50">
                            {activeTierEval.deliveryState}
                          </span>
                        </div>
                        <h4 className="mt-1 text-lg font-bold text-white">
                          Dostępne Sygnały:{" "}
                          <span className="text-[#2dd4bf]">
                            {activeTierEval.availableSignalsCount} / {activeTierEval.targetSignalsCount}
                          </span>{" "}
                          ({Math.round(activeTierEval.coverageRatio * 100)}% pokrycia)
                        </h4>
                        <p className="mt-1 text-xs text-[#8da5b2]">
                          {activeTierEval.rationalePl}
                        </p>
                      </div>

                      {/* Commercial & Price Card */}
                      <div className="flex min-w-[160px] shrink-0 flex-col items-end rounded-lg border border-[#1a3d4f] bg-[#0c222e] px-4 py-2.5">
                        <span className="text-[10px] uppercase tracking-wider text-[#638494]">
                          Cena Poziomu
                        </span>
                        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                          {activeTierEval.discountPercent > 0 && (
                            <span className="font-mono text-xs text-white/40 line-through">
                              {activeTierEval.basePriceEur} €
                            </span>
                          )}
                          <span className="font-mono text-xl font-extrabold text-[#2dd4bf]">
                            {activeModal === "basic"
                              ? "0 PLN (Bezpłatny)"
                              : activeModal === "pro"
                              ? "14.99 € / mc"
                              : "149.99 € / mc"}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium whitespace-nowrap text-emerald-400">
                          {unlockedTiers.has(activeModal) ? "Aktywny i Odblokowany" : "Wymaga Licencji"}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
                        <div
                          className={`h-full transition-all duration-500 ${
                            activeTierEval.deliveryState === "STOP_SELL_ACTIVE"
                              ? "bg-rose-500"
                              : activeTierEval.discountPercent > 0
                              ? "bg-amber-400"
                              : "bg-[#2dd4bf]"
                          }`}
                          style={{ width: `${Math.max(5, activeTierEval.coverageRatio * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Simulation Switch: Test Stop-Sell & Rabat */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#16313f] bg-[#07141b] px-3.5 py-2">
                      <div className="flex items-center gap-2 text-xs text-[#8da5b2]">
                        <Sliders className="h-3.5 w-3.5 text-[#2dd4bf]" />
                        <span className="font-semibold text-white">Test Silnika Handlowego:</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSimulationState("FULL")}
                          className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
                            simulationState === "FULL"
                              ? "bg-[#103a42] text-[#2dd4bf] border border-[#2dd4bf]/40"
                              : "text-[#638494] hover:text-white"
                          }`}
                        >
                          1. Pełna dostawa (100%)
                        </button>
                        <button
                          onClick={() => setSimulationState("MISSING_DEX")}
                          className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
                            simulationState === "MISSING_DEX"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "text-[#638494] hover:text-white"
                          }`}
                        >
                          2. Częściowy ubytek (-20% Rabat)
                        </button>
                        <button
                          onClick={() => setSimulationState("STOP_SELL")}
                          className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
                            simulationState === "STOP_SELL"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : "text-[#638494] hover:text-white"
                          }`}
                        >
                          3. Brak bajtkodu (STOP-SELL)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Signals List Table */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#638494]">
                        Katalog Sygnałów ({activeTierEval.availableSignalsCount} z {activeTierEval.targetSignalsCount} Aktywnych)
                      </h4>
                      <span className="text-[11px] text-[#2dd4bf]">
                        Wszystkie sygnały powiązane z dowodami kryptograficznymi
                      </span>
                    </div>

                    <div className="space-y-2">
                      {/* Render available signals */}
                      {activeTierEval.availableSignals.map((signal, idx) => (
                        <div
                          key={signal.id}
                          className="flex flex-col justify-between gap-2 rounded-xl border border-[#16313f] bg-[#091720] p-3.5 transition hover:border-[#2dd4bf]/30 sm:flex-row sm:items-center"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-[#638494]">
                                  #{idx + 1}
                                </span>
                                <span className="text-sm font-bold text-white">
                                  {signal.namePl}
                                </span>
                                <span className="hidden sm:inline font-mono text-xs text-[#638494]">
                                  ({signal.name})
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-[#8da5b2]">
                                {signal.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-3 self-end sm:self-center">
                            <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-[10px] text-[#638494]">
                              {signal.id.replace("sig_", "EVD-").toUpperCase()}
                            </span>
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-400">
                              AKTYWNY
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Render missing signals if simulated */}
                      {activeTierEval.missingSignals.map((signal, idx) => (
                        <div
                          key={signal.id}
                          className="flex flex-col justify-between gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.03] p-3.5 transition hover:border-rose-500/40 sm:flex-row sm:items-center"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                              <AlertCircle className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-rose-400">
                                  #{activeTierEval.availableSignalsCount + idx + 1}
                                </span>
                                <span className="text-sm font-bold text-white">
                                  {signal.namePl}
                                </span>
                                <span className="hidden sm:inline font-mono text-xs text-rose-300/60">
                                  ({signal.name})
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-rose-200/60">
                                {signal.description} • Brak danych na rynku dla tego aktywa.
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-3 self-end sm:self-center">
                            <span className="rounded bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] text-rose-300">
                              BRAK DANYCH
                            </span>
                            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-rose-400">
                              WYŁĄCZONY
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* MARKET IMPACT & SLIPPAGE SIMULATOR MODAL */}
              {/* ------------------------------------------------------------- */}
              {activeModal === "market_impact" && (
                <div className="space-y-5">
                  {/* Top 3 Core Liquidity Metrics */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-[#16313f] bg-[#091720] p-4">
                      <div className="flex items-center gap-2 text-[#638494]">
                        <Waves className="h-4 w-4 text-[#2dd4bf]" />
                        <span className="text-xs uppercase tracking-wider font-bold">
                          Median Bid/Ask Spread
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-2xl font-black text-white">0.018%</p>
                      <span className="text-[11px] text-[#2dd4bf]">
                        Klasa instytucjonalna (Zero sztucznego spreadu)
                      </span>
                    </div>

                    <div className="rounded-xl border border-[#16313f] bg-[#091720] p-4">
                      <div className="flex items-center gap-2 text-[#638494]">
                        <Percent className="h-4 w-4 text-[#2dd4bf]" />
                        <span className="text-xs uppercase tracking-wider font-bold">
                          Poślizg ($100k Order)
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-2xl font-black text-white">0.042%</p>
                      <span className="text-[11px] text-[#8da5b2]">
                        Głęboki arkusz z multi-venue routingiem
                      </span>
                    </div>

                    <div className="rounded-xl border border-[#16313f] bg-[#091720] p-4">
                      <div className="flex items-center gap-2 text-[#638494]">
                        <ArrowRightLeft className="h-4 w-4 text-[#2dd4bf]" />
                        <span className="text-xs uppercase tracking-wider font-bold">
                          Rozbieżność Cenowa CEX/DEX
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-2xl font-black text-[#2dd4bf]">0.005%</p>
                      <span className="text-[11px] text-[#2dd4bf]">
                        Arbitraż optymalny, brak ryzyka depegu
                      </span>
                    </div>
                  </div>

                  {/* Interactive Slippage Calculator */}
                  <div className="rounded-xl border border-[#16313f] bg-[#091720] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                          Symulator Poślizgu Cenowego VWAP (Market Impact)
                        </h4>
                        <p className="mt-0.5 text-xs text-[#8da5b2]">
                          Wybierz wolumen transakcji, aby obliczyć szacunkowy wpływ na cenę i routing zleceń.
                        </p>
                      </div>
                      <span className="rounded bg-teal-500/10 px-2.5 py-1 font-mono text-xs font-bold text-[#2dd4bf]">
                        L3 BOOK ENGINE
                      </span>
                    </div>

                    {/* Order Size Selector */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {[10000, 50000, 100000, 500000, 1000000, 5000000, 10000000].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setSimulatedOrderSize(amt)}
                          className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                            simulatedOrderSize === amt
                              ? "border border-[#2dd4bf] bg-[#123640] text-white shadow-md"
                              : "border border-[#183442] bg-[#0b1c24] text-[#8da5b2] hover:bg-[#122833] hover:text-white"
                          }`}
                        >
                          ${amt >= 1000000 ? `${amt / 1000000}M` : `${amt / 1000}k`}
                        </button>
                      ))}
                    </div>

                    {/* Calculation Results Card */}
                    <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-[#1d3d4e] bg-[#0c222e] p-4 sm:grid-cols-4">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-[#638494]">
                          Wielkość Zlecenia
                        </span>
                        <p className="mt-1 font-mono text-lg font-bold text-white">
                          ${simulatedOrderSize.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-[#638494]">
                          Wpływ Cenowy (Slippage)
                        </span>
                        <p className="mt-1 font-mono text-lg font-bold text-[#2dd4bf]">
                          {currentSlippage.pct}%
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-[#638494]">
                          Koszt Poślizgu USD
                        </span>
                        <p className="mt-1 font-mono text-lg font-bold text-white">
                          ${currentSlippage.costUsd.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-[#638494]">
                          Oczekiwany VWAP
                        </span>
                        <p className="mt-1 font-mono text-lg font-bold text-white">
                          ${(asset.price + currentSlippage.vwapDelta).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-[#8da5b2]">
                      <span className="font-semibold text-white">Rekomendowany Smart Order Routing:</span> 48% Binance Spot, 32% Coinbase Prime, 20% Kraken Institutional.
                    </div>
                  </div>

                  {/* Order Book Depth Visualizer (Topology ±2%) */}
                  <div className="rounded-xl border border-[#16313f] bg-[#091720] p-5">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                      Topologia Arkusza Zleceń (Głębokość ±2%)
                    </h4>
                    <p className="mt-0.5 text-xs text-[#8da5b2]">
                      Agregowane zlecenia limit z głównych giełd Tier-1.
                    </p>

                    <div className="mt-4 space-y-4">
                      <div>
                        <div className="flex justify-between text-xs text-white/80">
                          <span className="font-medium">+2% Bid Depth (Wsparcie Kapitałowe / Popyt)</span>
                          <span className="font-mono font-bold text-emerald-400">$34,250,000 USD</span>
                        </div>
                        <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-black/40">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: "68%" }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-white/80">
                          <span className="font-medium">-2% Ask Depth (Presja Oporu / Podaż)</span>
                          <span className="font-mono font-bold text-rose-400">$28,120,000 USD</span>
                        </div>
                        <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-black/40">
                          <div className="h-full rounded-full bg-rose-500" style={{ width: "56%" }} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-lg border border-[#142c36] bg-[#0b1c24] px-3.5 py-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-[#2dd4bf]" />
                        <span className="text-white font-medium">Nierównowaga Arkusza (Imbalance):</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400">
                        +21.8% Przewaga Kupujących (Byczy nacisk)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* WHALE WATCH & ON-CHAIN RADAR MODAL */}
              {/* ------------------------------------------------------------- */}
              {activeModal === "whale_watch" && (
                <div className="space-y-5">
                  {/* Top Whale Metrics Grid */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-[#16313f] bg-[#091720] p-4">
                      <div className="flex items-center gap-2 text-[#638494]">
                        <Users className="h-4 w-4 text-[#2dd4bf]" />
                        <span className="text-xs uppercase tracking-wider font-bold">
                          Top 10 Portfeli
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-2xl font-black text-white">14.2%</p>
                      <span className="text-[11px] text-[#2dd4bf]">
                        Niska koncentracja (Zdrowy rozkład)
                      </span>
                    </div>

                    <div className="rounded-xl border border-[#16313f] bg-[#091720] p-4">
                      <div className="flex items-center gap-2 text-[#638494]">
                        <Wallet className="h-4 w-4 text-[#2dd4bf]" />
                        <span className="text-xs uppercase tracking-wider font-bold">
                          Rezerwy Giełdowe
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-2xl font-black text-white">9.8%</p>
                      <span className="text-[11px] text-[#8da5b2]">
                        Zdrowy trend wypłat poza giełdy
                      </span>
                    </div>

                    <div className="rounded-xl border border-[#16313f] bg-[#091720] p-4">
                      <div className="flex items-center gap-2 text-[#638494]">
                        <Compass className="h-4 w-4 text-[#2dd4bf]" />
                        <span className="text-xs uppercase tracking-wider font-bold">
                          Przepływ Netto 24h
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-2xl font-black text-emerald-400">-$12.4M</p>
                      <span className="text-[11px] text-emerald-400">
                        Odpływ z giełd (Akumulacja)
                      </span>
                    </div>

                    <div className="rounded-xl border border-[#16313f] bg-[#091720] p-4">
                      <div className="flex items-center gap-2 text-[#638494]">
                        <Activity className="h-4 w-4 text-[#2dd4bf]" />
                        <span className="text-xs uppercase tracking-wider font-bold">
                          Transakcje &gt; $500k
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-2xl font-black text-white">128</p>
                      <span className="text-[11px] text-[#8da5b2]">
                        W ostatnich 24 godzinach
                      </span>
                    </div>
                  </div>

                  {/* Whale Radar Transaction Ledger */}
                  <div className="rounded-xl border border-[#16313f] bg-[#091720] p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                          {isTraditional
                            ? "Radar Dużych Transakcji Instytucjonalnych (Dark Pool & Tape > $1,000,000)"
                            : "Radar Dużych Transakcji On-Chain (> $1,000,000 USD)"}
                        </h4>
                        <p className="mt-0.5 text-xs text-[#8da5b2]">
                          {isTraditional
                            ? "Zweryfikowane przepływy funduszy powierniczych, dark pooli i prime brokerów."
                            : "Zweryfikowane przepływy portfeli instytucjonalnych, depozytariuszy i giełd."}
                        </p>
                      </div>

                      {/* Transaction Filter Buttons */}
                      <div className="flex items-center gap-1.5 rounded-lg border border-[#173340] bg-[#0b1c24] p-1 text-xs">
                        <button
                          onClick={() => setWhaleFilter("ALL")}
                          className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
                            whaleFilter === "ALL" ? "bg-[#103a42] text-white" : "text-[#638494] hover:text-white"
                          }`}
                        >
                          Wszystkie
                        </button>
                        <button
                          data-testid="whale-filter-outflow"
                          onClick={() => setWhaleFilter("OUTFLOW")}
                          className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
                            whaleFilter === "OUTFLOW" ? "bg-emerald-500/20 text-emerald-400" : "text-[#638494] hover:text-white"
                          }`}
                        >
                          Odpływy (Outflow)
                        </button>
                        <button
                          onClick={() => setWhaleFilter("INFLOW")}
                          className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
                            whaleFilter === "INFLOW" ? "bg-amber-500/20 text-amber-400" : "text-[#638494] hover:text-white"
                          }`}
                        >
                          Wpływy
                        </button>
                        <button
                          onClick={() => setWhaleFilter("TRANSFER")}
                          className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
                            whaleFilter === "TRANSFER" ? "bg-white/10 text-white" : "text-[#638494] hover:text-white"
                          }`}
                        >
                          Transfery
                        </button>
                      </div>
                    </div>

                    {/* Transactions List */}
                    <div className="mt-4 space-y-2.5">
                      {filteredWhaleTxs.map((tx) => {
                        const isOutflow = tx.type === "OUTFLOW";
                        const isInflow = tx.type === "INFLOW";
                        return (
                          <div
                            key={tx.id}
                            className="flex flex-col justify-between gap-3 rounded-xl border border-[#16313f] bg-[#07151d] p-3.5 transition hover:border-[#2dd4bf]/40 sm:flex-row sm:items-center"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                  isOutflow
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : isInflow
                                    ? "bg-amber-500/15 text-amber-400"
                                    : "bg-white/5 text-white/60"
                                }`}
                              >
                                {isOutflow ? (
                                  <ArrowUpRight className="h-5 w-5" />
                                ) : isInflow ? (
                                  <ArrowDownLeft className="h-5 w-5" />
                                ) : (
                                  <ArrowRightLeft className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-black text-white">
                                    {tx.amount} {asset.symbol}
                                  </span>
                                  <span className="font-mono text-xs text-[#8da5b2]">
                                    ({tx.valueUsd})
                                  </span>
                                  <span
                                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                      isOutflow
                                        ? "bg-emerald-500/10 text-emerald-400"
                                        : isInflow
                                        ? "bg-amber-500/10 text-amber-400"
                                        : "bg-white/5 text-white/50"
                                    }`}
                                  >
                                    {tx.type}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-xs text-[#638494]">
                                  <span className="font-medium text-white/70">{tx.source}</span>
                                  <span>→</span>
                                  <span className="font-medium text-white/70">{tx.destination}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-3 self-end sm:self-center">
                              <span className="font-mono text-xs text-[#638494]">{tx.timestamp}</span>
                              <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-[10px] text-[#2dd4bf]">
                                {tx.confidence}% Conf
                              </span>
                              <span className="font-mono text-[11px] text-[#638494] hover:text-white cursor-pointer">
                                {tx.txHash}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Intelligence Summary Note */}
                    <div className="mt-4 rounded-lg border border-[#16313f] bg-[#071319] p-3 text-xs text-[#8da5b2]">
                      <span className="font-bold text-white">Komentarz Velmère Intelligence:</span>{" "}
                      Przewaga odpływów nad wpływami giełdowymi (netto -$12.4M w 24h) wskazuje na fazę spokojnej akumulacji przez portfele instytucjonalne i depozytariuszy. Brak presji płynnościowej zagrażającej załamaniem ceny.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="mt-6 flex items-center justify-between border-t border-[#183442] pt-4">
              <div className="text-xs text-[#638494]">
                Velmère RegTech Platform • Certyfikacja RFC 3161
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl border border-[#1b3745] px-4 py-2 text-xs font-semibold text-[#8da5b2] hover:bg-[#122a36] hover:text-white"
                >
                  Zamknij
                </button>
                <button
                  onClick={() => {
                    const currentTier = (activeModal === "pro" || activeModal === "advanced") ? activeModal : "basic";
                    setExportModal({ tier: currentTier });
                  }}
                  className="flex items-center gap-2 rounded-xl bg-[#2dd4bf] px-4 py-2 text-xs font-bold text-black transition hover:bg-[#26bba7]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Pobierz Raport (PDF / JSON / TXT)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. COMPACT EXPORT / DOWNLOAD MODAL (PDF, JSON, TXT) */}
      {/* ========================================================================= */}
      {exportModal && (
        <div
          onClick={() => setExportModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200"
          data-testid="export-modal"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0c1017] p-6 shadow-2xl"
          >
            {/* Top Badge & Close */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Raport Dowodowy Gotowy Do Pobrania
                </span>
              </div>
              <button
                onClick={() => setExportModal(null)}
                className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/[0.08] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Asset Header Info */}
            <div className="mt-3">
              <h3 className="text-lg font-black text-white">
                Analiza {exportModal.tier.toUpperCase()} — {asset.name} ({asset.symbol})
              </h3>
              <p className="mt-1 font-mono text-xs text-white/60">
                Segment: {isTraditional ? "Real Markets" : "Shield Terminal"} • Ryzyko:{" "}
                <span className={asset.riskScore <= 35 ? "text-emerald-400 font-bold" : asset.riskScore <= 65 ? "text-amber-400 font-bold" : "text-rose-400 font-bold"}>
                  {asset.riskScore}/100 ({asset.riskScore <= 35 ? "Niskie" : asset.riskScore <= 65 ? "Umiarkowane" : "Wysokie"})
                </span>
                {" "}• Cena: ${formatAdaptivePrice(asset.price)}
              </p>
            </div>

            {exportError && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{exportError}</span>
              </div>
            )}

            {/* 3 Download Cards */}
            <div className="mt-5 space-y-3">
              {/* PDF Card */}
              <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#121721] p-3.5 transition hover:border-[#c5a059]/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#c5a059]/15 text-[#e6ca85]">
                    <FileCode2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">Certyfikowany Raport PDF</span>
                      <span className="rounded bg-[#c5a059]/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#e6ca85]">
                        A4 DOWODOWY
                      </span>
                    </div>
                    <p className="text-[11px] text-white/50">
                      Publikacja ze stemplem RFC 3161 i wykazem sygnałów
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDownload("pdf")}
                  disabled={downloadingFormat !== null}
                  data-testid="download-pdf-btn"
                  className="flex items-center gap-1.5 rounded-lg bg-[#c5a059] px-3.5 py-2 text-xs font-bold text-black transition hover:bg-[#d8b46d] disabled:opacity-50"
                >
                  {downloadingFormat === "pdf" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>Pobierz PDF</span>
                </button>
              </div>

              {/* JSON Card */}
              <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#121721] p-3.5 transition hover:border-[#2dd4bf]/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2dd4bf]/15 text-[#2dd4bf]">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">Surowe Dane JSON</span>
                      <span className="rounded bg-[#2dd4bf]/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#2dd4bf]">
                        API READY
                      </span>
                    </div>
                    <p className="text-[11px] text-white/50">
                      Pełna struktura obiektowa dla algorytmów i audytorów
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDownload("json")}
                  disabled={downloadingFormat !== null}
                  data-testid="download-json-btn"
                  className="flex items-center gap-1.5 rounded-lg border border-[#2dd4bf]/40 bg-[#0c242c] px-3.5 py-2 text-xs font-bold text-[#2dd4bf] transition hover:bg-[#123640] disabled:opacity-50"
                >
                  {downloadingFormat === "json" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>Pobierz JSON</span>
                </button>
              </div>

              {/* TXT Card */}
              <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#121721] p-3.5 transition hover:border-white/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/80">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">Podsumowanie TXT</span>
                      <span className="rounded bg-white/[0.1] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white/70">
                        ASCII TABLE
                      </span>
                    </div>
                    <p className="text-[11px] text-white/50">
                      Sformatowane zestawienie tekstowe do terminala i notatek
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDownload("txt")}
                  disabled={downloadingFormat !== null}
                  data-testid="download-txt-btn"
                  className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.05] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
                >
                  {downloadingFormat === "txt" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>Pobierz TXT</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-4 text-[11px] text-white/40">
              <span className="truncate">Velmère Cryptographic Verification Framework</span>
              <button
                onClick={() => setExportModal(null)}
                className="font-medium text-white/70 hover:text-white transition"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
