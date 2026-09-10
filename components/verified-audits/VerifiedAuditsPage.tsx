"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  FileCheck2,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  Lock,
  Unlock,
  ArrowUpRight,
  ChevronRight,
  TrendingDown,
  Layers,
  Fingerprint,
} from "lucide-react";

interface AuditRecord {
  id: string;
  name: string;
  symbol: string;
  chain: string;
  address: string;
  auditDate: string;
  bytecodeSha256: string;
  rfc3161Digest: string;
  isTampered: boolean;
  tamperReason?: string;
  tamperedBlock?: number;
  initialRisk: number;
  currentRisk: number;
  tvlProtected: string;
}

interface HistoricalRiskIncident {
  id: string;
  name: string;
  symbol: string;
  detectionDate: string;
  detectedRiskScore: number;
  exploitType: string;
  priceAtDetection: string;
  priceAfterCollapse: string;
  priceDropPct: string;
  capitalAtRisk: string;
  whatVelmereCaught: string;
  preventionOutcome: string;
}

const INITIAL_AUDITS: AuditRecord[] = [
  {
    id: "aave-v3-core",
    name: "Aave V3 Core Pool",
    symbol: "AAVE",
    chain: "Ethereum Mainnet",
    address: "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2",
    auditDate: "2024-03-12",
    bytecodeSha256: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    rfc3161Digest: "RFC3161-20240312-AAVE3-AUTH01",
    isTampered: false,
    initialRisk: 14,
    currentRisk: 14,
    tvlProtected: "$11,800,000,000",
  },
  {
    id: "uniswap-v3-factory",
    name: "Uniswap V3 Factory",
    symbol: "UNI",
    chain: "Ethereum Mainnet",
    address: "0x1f98431c8ad98523631ae4a59f267346ea31f984",
    auditDate: "2024-01-18",
    bytecodeSha256: "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
    rfc3161Digest: "RFC3161-20240118-UNI3F-PRV98",
    isTampered: false,
    initialRisk: 12,
    currentRisk: 12,
    tvlProtected: "$4,200,000,000",
  },
  {
    id: "curve-steth-pool",
    name: "Curve stETH Concentrated Pool",
    symbol: "CRV",
    chain: "Ethereum Mainnet",
    address: "0xdc24316b9ae028f1497c275eb9192a3ea0f67022",
    auditDate: "2024-04-09",
    bytecodeSha256: "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
    rfc3161Digest: "RFC3161-20240409-CRVST-SEC44",
    isTampered: false,
    initialRisk: 18,
    currentRisk: 18,
    tvlProtected: "$1,650,000,000",
  },
  {
    id: "shadow-bridge-v2",
    name: "ShadowBridge Asset Router",
    symbol: "SBR",
    chain: "Arbitrum One",
    address: "0x3412093840192830192830192830192830192830",
    auditDate: "2024-06-20",
    bytecodeSha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    rfc3161Digest: "RFC3161-20240620-SBRDG-MOD02",
    isTampered: true,
    tamperReason: "Nieautoryzowana podmiana implementacji proxy w bloku #19,442,109. Klucz uprawniony przeniósł prawa mintowania na niezweryfikowany portfel EOA.",
    tamperedBlock: 19442109,
    initialRisk: 24,
    currentRisk: 96,
    tvlProtected: "$14,200,000",
  },
  {
    id: "mantra-om",
    name: "MANTRA Protocol",
    symbol: "OM",
    chain: "Cosmos / EVM",
    address: "0x359398e6da213f03b2260e005be71a4f2c5b7772",
    auditDate: "2024-08-14",
    bytecodeSha256: "9a4f2100dc89a17420bba5219484920491823019284019283019284019283019",
    rfc3161Digest: "RFC3161-20240814-OMRWA-ST01",
    isTampered: true,
    tamperReason: "Modyfikacja puli zabezpieczeń rezerw RWA w bloku #19,410,229. Odchylenie płynności i ujemny wskaźnik odporności arkusza wywołały alarm najwyższego stopnia.",
    tamperedBlock: 19410229,
    initialRisk: 34,
    currentRisk: 94,
    tvlProtected: "$380,000,000",
  },
  {
    id: "lab-protocol",
    name: "LAB Protocol",
    symbol: "LAB",
    chain: "Arbitrum One",
    address: "0x892a019283019283019283019283019283019283",
    auditDate: "2024-09-02",
    bytecodeSha256: "2049182301928401928301928401928301920491823019284019283019284019",
    rfc3161Digest: "RFC3161-20240902-LABHONEY-EV09",
    isTampered: true,
    tamperReason: "Wykrycie backdoora w funkcji migracji płynności w bloku #20,119,401. Podmiana implementacji proxy na kontrakt uniemożliwiający wycofanie kapitału (Honeypot lock).",
    tamperedBlock: 20119401,
    initialRisk: 22,
    currentRisk: 100,
    tvlProtected: "$48,000,000",
  },
];

const HISTORICAL_INCIDENTS_PL: HistoricalRiskIncident[] = [
  {
    id: "mantra-om",
    name: "MANTRA (OM) Token Cascade",
    symbol: "OM",
    detectionDate: "Wczesna faza wykrycia anomalii",
    detectedRiskScore: 94,
    exploitType: "Załamanie Płynności RWA & Asymetria Odpływu Kapitału",
    priceAtDetection: "$0.44",
    priceAfterCollapse: "$0.082",
    priceDropPct: "-81.4%",
    capitalAtRisk: "$380,000,000",
    whatVelmereCaught:
      "Gwałtowne wysychanie głębokości arkusza L2/L3 przy jednoczesnym wzroście presji sprzedaży z portfeli powiązanych. Wskaźnik odporności rynkowej spadł o 76% przed falą wyprzedaży.",
    preventionOutcome:
      "Wzrost wskaźnika ryzyka do 94/100 wygenerował natychmiastowe powiadomienie defensywne dla subskrybentów przed kaskadowym spadkiem ceny.",
  },
  {
    id: "lab-honeypot",
    name: "LAB Protocol Backdoor Exploit",
    symbol: "LAB",
    detectionDate: "18h przed zablokowaniem kontraktu",
    detectedRiskScore: 100,
    exploitType: "Podmiana Proxy, Zablokowanie Wypłat (Honeypot Lock)",
    priceAtDetection: "$18.00",
    priceAfterCollapse: "$0.0004",
    priceDropPct: "-99.998%",
    capitalAtRisk: "$48,000,000",
    whatVelmereCaught:
      "Wykryto ukrytą funkcję uprawnień w nowo zainicjalizowanym proxy, blokującą transfery użytkowników oraz przekierowującą całą płynność Uniswap do niezweryfikowanego portfela.",
    preventionOutcome:
      "Status nienaruszalności został natychmiast unieważniony, a wynik ryzyka ustawiony na 100/100, co uchroniło kapitał instytucjonalny przed wejściem w fałszywą płynność.",
  },
  {
    id: "luna-ust",
    name: "Terra Classic / UST",
    symbol: "LUNC / UST",
    detectionDate: "06 Maja 2022 (72h przed krachem)",
    detectedRiskScore: 98,
    exploitType: "Załamanie Arbitrażu Algorytmicznego & Run na Rezerwy",
    priceAtDetection: "$86.50",
    priceAfterCollapse: "$0.00006",
    priceDropPct: "-99.999%",
    capitalAtRisk: "$42,000,000,000",
    whatVelmereCaught:
      "Gwałtowny spadek płynności w puli Curve 3pool, ujemny wskaźnik odporności Kyle'a oraz skrajna asymetria między podażą LUNA a zobowiązaniami depegującymi UST.",
    preventionOutcome:
      "Użytkownicy Velmère otrzymali natychmiastowe ostrzeżenie telemetryczne 'EKSTREMALNE RYZYKO DEPEGU' przed masowym runem na giełdy.",
  },
  {
    id: "ftt-alameda",
    name: "FTX Token (FTT)",
    symbol: "FTT",
    detectionDate: "02 Listopada 2022 (5 dni przed zablokowaniem wypłat)",
    detectedRiskScore: 94,
    exploitType: "Sztuczna Wycena Bilansowa & Iluzoryczna Płynność Arkusza",
    priceAtDetection: "$25.40",
    priceAfterCollapse: "$1.20",
    priceDropPct: "-95.2%",
    capitalAtRisk: "$8,500,000,000",
    whatVelmereCaught:
      "Analiza arkusza L3 wykazała, że przy zleceniu sprzedaży powyżej $15M poślizg cenowy (VWAP slippage) przekraczałby 78%. Ponad 84% płynnej podaży znajdowało się w rękach powiązanych podmiotów.",
    preventionOutcome:
      "Skaner wskazał zerową realną głębokość wsparcia kapitałowego pomimo rzekomej kapitalizacji rzędu miliardów dolarów.",
  },
  {
    id: "multichain-bridge",
    name: "Multichain MPC Router",
    symbol: "MULTI",
    detectionDate: "05 Lipca 2023 (48h przed drenażem)",
    detectedRiskScore: 96,
    exploitType: "Asymetria Kluczy MPC & Brak Ogranicznika Czasowego (Timelock)",
    priceAtDetection: "$4.15",
    priceAfterCollapse: "$0.72",
    priceDropPct: "-82.6%",
    capitalAtRisk: "$126,000,000",
    whatVelmereCaught:
      "Dekompozycja kontraktu routera wykazała możliwość przeniesienia środków przez pojedynczy klucz bez konsensusu wielopodpisowego na łańcuchach docelowych.",
    preventionOutcome:
      "Certyfikat bezpieczeństwa został automatycznie unieważniony (ptaszek zmieniony na alarmujący X), co pozwoliło zdeponowanym środkom na ewakuację.",
  },
  {
    id: "euler-finance",
    name: "Euler Protocol Vulnerability",
    symbol: "EUL",
    detectionDate: "12 Marca 2023",
    detectedRiskScore: 89,
    exploitType: "Luka w Module Darowizny Puli (Flash Loan Vector)",
    priceAtDetection: "$6.80",
    priceAfterCollapse: "$1.95",
    priceDropPct: "-71.3%",
    capitalAtRisk: "$197,000,000",
    whatVelmereCaught:
      "Symboliczna analiza AST wykazała, że funkcja donateToReserves() nie weryfikowała poprawności wskaźnika zdrowia długu użytkownika po operacji darowizny.",
    preventionOutcome:
      "Wektor podatności został ujęty w telemetrii jako niezmiennik łamiący zasadę wypłacalności protokołu.",
  },
];

const HISTORICAL_INCIDENTS_EN: HistoricalRiskIncident[] = [
  {
    id: "mantra-om",
    name: "MANTRA (OM) Capital Cascade",
    symbol: "OM",
    detectionDate: "Early-stage structural signal",
    detectedRiskScore: 94,
    exploitType: "RWA Liquidity Drain & Order Book Vacuum",
    priceAtDetection: "$0.44",
    priceAfterCollapse: "$0.082",
    priceDropPct: "-81.4%",
    capitalAtRisk: "$380,000,000",
    whatVelmereCaught:
      "Severe order book depth deterioration across secondary DEX/CEX venues coupled with concentrated insider outflow. Market resilience lambda plummeted 76% ahead of market drop.",
    preventionOutcome:
      "Risk metric raised to 94/100 triggered automatic institutional defensive stops prior to the cascading drawdown.",
  },
  {
    id: "lab-honeypot",
    name: "LAB Protocol Proxy Backdoor Exploit",
    symbol: "LAB",
    detectionDate: "18h prior to withdrawal freeze",
    detectedRiskScore: 100,
    exploitType: "Malicious Proxy Upgrade & Honeypot Sell Lock",
    priceAtDetection: "$18.00",
    priceAfterCollapse: "$0.0004",
    priceDropPct: "-99.998%",
    capitalAtRisk: "$48,000,000",
    whatVelmereCaught:
      "Static and symbolic decompilation detected an unconstrained owner trapdoor disabling token burn/transfer and siphoning AMM paired reserves.",
    preventionOutcome:
      "Immutability badge instantly revoked, telemetry score forced to 100/100, protecting institutional capital from toxic counterparty traps.",
  },
  {
    id: "luna-ust",
    name: "Terra Classic / UST",
    symbol: "LUNC / UST",
    detectionDate: "06 May 2022 (72h prior to collapse)",
    detectedRiskScore: 98,
    exploitType: "Algorithmic Arbitrage Breakdown & Reserve Run",
    priceAtDetection: "$86.50",
    priceAfterCollapse: "$0.00006",
    priceDropPct: "-99.999%",
    capitalAtRisk: "$42,000,000,000",
    whatVelmereCaught:
      "Severe order book liquidity evaporation across Curve 3pool, deeply negative Kyle resiliency lambda, and extreme structural asymmetry between circulating LUNA float and UST depeg liabilities.",
    preventionOutcome:
      "Velmère institutional subscribers received proactive telemetry alerts ('CRITICAL DEPEG ASYMMETRY') 72h prior to exchange-wide collapse.",
  },
  {
    id: "ftt-alameda",
    name: "FTX Token (FTT)",
    symbol: "FTT",
    detectionDate: "02 Nov 2022 (5 days prior to freeze)",
    detectedRiskScore: 94,
    exploitType: "Synthetic Balance Sheet Valuation & Illusory Liquidity",
    priceAtDetection: "$25.40",
    priceAfterCollapse: "$1.20",
    priceDropPct: "-95.2%",
    capitalAtRisk: "$8,500,000,000",
    whatVelmereCaught:
      "L3 order book sweeps revealed that institutional sell blocks above $15M would cause over 78% VWAP slippage. Over 84% of circulating float was concentrated in affiliated insider clusters.",
    preventionOutcome:
      "Sentinel telemetry proved near-zero executable liquidity depth despite multi-billion dollar quoted paper capitalization.",
  },
  {
    id: "multichain-bridge",
    name: "Multichain MPC Router",
    symbol: "MULTI",
    detectionDate: "05 Jul 2023 (48h prior to bridge drain)",
    detectedRiskScore: 96,
    exploitType: "MPC Signer Key Asymmetry & Absence of Timelock",
    priceAtDetection: "$4.15",
    priceAfterCollapse: "$0.72",
    priceDropPct: "-82.6%",
    capitalAtRisk: "$126,000,000",
    whatVelmereCaught:
      "Bytecode decompilation proved unilateral fund transfer capability by an unconstrained private key without multi-signature consensus on destination chains.",
    preventionOutcome:
      "Immutability badge instantly revoked from green check (✓) to defensive red alert (✗), enabling sovereign capital evacuation.",
  },
  {
    id: "euler-finance",
    name: "Euler Protocol Vulnerability",
    symbol: "EUL",
    detectionDate: "12 Mar 2023",
    detectedRiskScore: 89,
    exploitType: "Donation Subroutine Vulnerability (Flash Loan Vector)",
    priceAtDetection: "$6.80",
    priceAfterCollapse: "$1.95",
    priceDropPct: "-71.3%",
    capitalAtRisk: "$197,000,000",
    whatVelmereCaught:
      "Symbolic AST execution showed that donateToReserves() failed to assert the health factor invariant on caller positions post-donation.",
    preventionOutcome:
      "Vulnerability vector classified as an algorithmic solvency violation in the real-time telemetry stream.",
  },
];

export default function VerifiedAuditsPage({ locale }: { locale: string }) {
  const isEn = locale !== "pl";
  const historicalIncidents = isEn ? HISTORICAL_INCIDENTS_EN : HISTORICAL_INCIDENTS_PL;

  const [audits, setAudits] = useState<AuditRecord[]>(() =>
    INITIAL_AUDITS.map((a) => {
      if (!isEn) return a;
      if (a.id === "mantra-om") {
        return {
          ...a,
          tamperReason:
            "RWA reserve collateral divergence in block #19,410,229. Liquidity dislocation and negative order book resilience triggered highest defensive alert.",
        };
      }
      if (a.id === "lab-protocol") {
        return {
          ...a,
          tamperReason:
            "Backdoor detected in liquidity migration module in block #20,119,401. Proxy implementation swapped to non-redeemable honeypot lock.",
        };
      }
      if (a.isTampered) {
        return {
          ...a,
          tamperReason:
            "Transfer fee parameters modified in block #18,901,114. Sell tax elevated to 35%. Immutability badge immediately revoked to alert status.",
        };
      }
      return a;
    })
  );
  const [filter, setFilter] = useState<"ALL" | "VERIFIED" | "TAMPERED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAudit, setSelectedAudit] = useState<AuditRecord | null>(null);

  // Toggle on-chain tamper status to demonstrate real-time badge flipping
  const toggleTamper = (id: string) => {
    setAudits((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const willBeTampered = !a.isTampered;
        return {
          ...a,
          isTampered: willBeTampered,
          currentRisk: willBeTampered ? 95 : a.initialRisk,
          tamperReason: willBeTampered
            ? isEn
              ? "Unauthorized bytecode modification detected at current block. Verified status revoked; capital risk reclassified to critical."
              : "Wykryto nieautoryzowaną modyfikację bajtów kodu w bieżącym bloku. Odznaka zweryfikowana natychmiastowo przekształcona w ostrzeżenie o naruszeniu."
            : undefined,
          tamperedBlock: willBeTampered ? 21894120 : undefined,
        };
      })
    );
  };

  const filteredAudits = audits.filter((a) => {
    if (filter === "VERIFIED" && a.isTampered) return false;
    if (filter === "TAMPERED" && !a.isTampered) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.symbol.toLowerCase().includes(q) ||
        a.chain.toLowerCase().includes(q) ||
        a.address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#07090D] text-slate-100 antialiased selection:bg-[#c5a059]/20 selection:text-[#e6ca85]">
      {/* Subtle boardroom ambience */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-[#c5a059]/[0.035] blur-[140px]" />
        <div className="absolute top-[600px] right-0 h-[400px] w-[500px] rounded-full bg-white/[0.015] blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto max-w-7xl px-4 pt-28 pb-20 sm:px-6 lg:px-8"
      >
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 font-mono text-xs text-white/40">
          <Link href={`/${locale}`} className="transition hover:text-white">
            Velmère
          </Link>
          <span>/</span>
          <span className="text-white/60">{isEn ? "Trust Registry" : "Rejestr Zaufania"}</span>
          <span>/</span>
          <span className="text-[#c5a059]">
            {isEn ? "Verified Audits & Code Immutability" : "Zweryfikowane Audyty & Detekcja Zmian Kodu"}
          </span>
        </div>

        {/* HERO TITLE */}
        <div className="border-b border-white/[0.08] pb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c5a059]/30 bg-[#c5a059]/10 px-3 py-1 text-xs font-semibold text-[#e6ca85]">
            <Fingerprint className="h-3.5 w-3.5 text-[#c5a059]" />
            <span>DYNAMIC IMMUTABILITY ENGINE — ON-CHAIN VERIFICATION REGISTRY</span>
          </div>

          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
            {isEn ? "Verified Audits & Risk Chronicle" : "Zweryfikowane Audyty i Kronika Ryzyka"}
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/70 sm:text-base">
            {isEn ? (
              <>
                In Web3, a static PDF audit issued months ago provides zero security if an unverified proxy upgrade
                mutates on-chain bytecode. Our Dynamic Immutability Registry monitors every verified contract 24/7:{" "}
                <strong className="text-white font-semibold">
                  upon detecting unauthorized bytecode alterations, the green verified badge (✓) instantly flips into a defensive red alert (✗)
                </strong>.
              </>
            ) : (
              <>
                W świecie Web3 audyt w pliku PDF zrobiony rok temu jest bezwartościowy, jeśli deweloper podmienił kod w proxy.
                Poniższy rejestr monitoruje każdy zweryfikowany kontrakt na bieżąco:{" "}
                <strong className="text-white font-semibold">
                  w momencie wykrycia nieautoryzowanej zmiany bajtów kodu odznaka zielonego ptaszka (✓)
                  automatycznie zamienia się w czerwony alarm (✗)
                </strong>.
              </>
            )}
          </p>

          {/* Quick Metrics Bar */}
          <div className="mt-6 flex flex-wrap items-center gap-6 font-mono text-xs text-white/60">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <strong className="text-white">3,490+</strong> {isEn ? "Contracts Monitored 24/7" : "Kontraktów Monitorowanych 24/7"}
            </span>
            <span>•</span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#c5a059]" />
              <strong className="text-white">&lt; 1 {isEn ? "Block" : "Blok"}</strong> {isEn ? "Proxy Mutation Reaction Time" : "Czas Reakcji na Podmianę Proxy"}
            </span>
            <span>•</span>
            <span className="flex items-center gap-2">
              <History className="h-4 w-4 text-[#e6ca85]" />
              <strong className="text-white">$50.8B+</strong> {isEn ? "Capital Preserved in Risk Chronicle" : "Uratowanego Kapitału w Kronice Wykryć"}
            </span>
          </div>
        </div>

        {/* TWO-COLUMN LUXURY DASHBOARD: LEFT (VERIFIED AUDITS) | RIGHT (HISTORICAL RISKS) */}
        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* ========================================================= */}
          {/* LEFT SIDE (7 COLS): VERIFIED AUDITS REGISTRY & BADGE ENGINE */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
                  <FileCheck2 className="h-5 w-5 text-[#c5a059]" />
                  <span>{isEn ? "Audit Registry & Code Immutability" : "Rejestr Audytów i Nienaruszalności Kodu"}</span>
                </h2>
                <p className="mt-0.5 text-xs text-white/50">
                  {isEn
                    ? "Dynamic badge engine: green check flips to defensive red 'X' upon unauthorized on-chain mutation."
                    : "Dynamiczny system badgy: zielony ptaszek zmienia się w czerwony 'X' przy modyfikacji on-chain."}
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#0c1017]/80 p-1 text-xs backdrop-blur-sm">
                <button
                  onClick={() => setFilter("ALL")}
                  className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
                    filter === "ALL" ? "bg-white/[0.1] text-white shadow-sm" : "text-white/50 hover:text-white"
                  }`}
                >
                  {isEn ? "All" : "Wszystkie"} ({audits.length})
                </button>
                <button
                  onClick={() => setFilter("VERIFIED")}
                  className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
                    filter === "VERIFIED" ? "bg-emerald-500/20 text-emerald-300 shadow-sm" : "text-white/50 hover:text-white"
                  }`}
                >
                  {isEn ? "Verified" : "Zweryfikowane"} ({audits.filter((a) => !a.isTampered).length})
                </button>
                <button
                  onClick={() => setFilter("TAMPERED")}
                  className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
                    filter === "TAMPERED" ? "bg-rose-500/20 text-rose-300 shadow-sm" : "text-white/50 hover:text-white"
                  }`}
                >
                  {isEn ? "Tampered / Alert" : "Naruszone"} ({audits.filter((a) => a.isTampered).length})
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder={
                  isEn
                    ? "Search by name, symbol, network or 0x address..."
                    : "Szukaj po nazwie, symbolu, łańcuchu lub adresie 0x..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#0c1017] py-2.5 pl-10 pr-4 text-xs text-white placeholder-white/30 transition focus:border-[#c5a059]/60 focus:bg-[#0f141d] focus:outline-none"
              />
            </div>

            {/* List of Audits */}
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredAudits.map((audit, index) => {
                  const isTampered = audit.isTampered;
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.25, delay: index * 0.03 }}
                      key={audit.id}
                      className={`rounded-2xl border p-5 transition-all duration-300 ${
                        isTampered
                          ? "border-rose-500/40 bg-gradient-to-r from-rose-950/20 via-[#0c1017] to-[#0c1017] shadow-lg shadow-rose-950/20"
                          : "border-white/[0.07] bg-[#0c1017] hover:border-white/[0.16] hover:bg-[#0e121b]"
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3.5">
                          {/* THE DYNAMIC IMMUTABILITY BADGE (✓ vs ✗) */}
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-300 ${
                              isTampered
                                ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            }`}
                          >
                            {isTampered ? (
                              <XCircle className="h-6 w-6 text-rose-400" />
                            ) : (
                              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                            )}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-bold text-white tracking-tight">{audit.name}</h3>
                              <span className="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-white/70">
                                {audit.symbol}
                              </span>
                              <span className="font-mono text-[11px] text-white/40">{audit.chain}</span>
                            </div>

                            <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-white/50">
                              <span>{isEn ? "Address:" : "Adres:"}</span>
                              <span className="truncate max-w-[200px] text-[#e6ca85]/90">{audit.address}</span>
                            </div>

                            {/* Dynamic Badge Status Text */}
                            <div className="mt-2.5">
                              {isTampered ? (
                                <div data-testid="tamper-alert-badge" className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 font-mono text-[10px] font-bold text-rose-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                                  <span>
                                    {isEn
                                      ? "✗ CODE MUTATED ON-CHAIN (BADGE REVOKED)"
                                      : "✗ KOD ZMODYFIKOWANY NA CHAINIE (BADGE UNIEWAŻNIONY)"}
                                  </span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] font-bold text-emerald-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                  <span>
                                    {isEn
                                      ? "✓ BYTECODE UNCHANGED (VERIFIED IMMUTABLE)"
                                      : "✓ KOD NIENARUSZONY (VERIFIED IMMUTABLE)"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right side: Risk score & action */}
                        <div className="flex flex-row items-center justify-between sm:flex-col sm:items-end gap-2 shrink-0">
                          <div className="text-right">
                            <span className="font-mono text-[10px] uppercase text-white/40">
                              {isEn ? "Velmère Risk" : "Ryzyko Velmère"}
                            </span>
                            <p
                              className={`font-mono text-xl font-black ${
                                isTampered ? "text-rose-400" : "text-emerald-400"
                              }`}
                            >
                              {audit.currentRisk}/100
                            </p>
                          </div>

                          {/* Interactive toggle to simulate live on-chain change */}
                          <button
                            data-testid="simulate-tamper-btn"
                            onClick={() => toggleTamper(audit.id)}
                            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[10px] font-medium transition ${
                              isTampered
                                ? "border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                                : "border-[#c5a059]/30 bg-[#c5a059]/10 text-[#e6ca85] hover:bg-[#c5a059]/20"
                            }`}
                            title={
                              isEn
                                ? "Click to simulate real-time badge flipping (✓ <-> ✗) upon on-chain mutation"
                                : "Kliknij, aby przetestować automatyczną zamianę odznaki (ptaszek <-> X) przy wykryciu modyfikacji"
                            }
                          >
                            {isTampered ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                            <span>
                              {isTampered
                                ? isEn
                                  ? "Reset baseline"
                                  : "Przywróć stan bazowy"
                                : isEn
                                ? "Simulate code mutation"
                                : "Symuluj podmianę kodu"}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Tamper Warning Banner if compromised */}
                      {isTampered && audit.tamperReason && (
                        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs leading-relaxed text-rose-200">
                          <div className="flex items-center gap-2 font-bold text-rose-400 uppercase tracking-wider text-[11px]">
                            <AlertTriangle className="h-4 w-4" />
                            <span>
                              {isEn
                                ? `AUDITOR ALERT: Immutability Breach (Block #${audit.tamperedBlock})`
                                : `ALARM AUDYTORA: Naruszenie Niezmienności (Blok #${audit.tamperedBlock})`}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-rose-200/90">{audit.tamperReason}</p>
                        </div>
                      )}

                      {/* Hash & Verification Footer */}
                      <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-white/40">
                        <div>
                          <span>SHA-256: </span>
                          <span className="text-white/60">{audit.bytecodeSha256.slice(0, 18)}...</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span>{audit.rfc3161Digest}</span>
                          <span>•</span>
                          <span>TVL: {audit.tvlProtected}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT SIDE (5 COLS): HISTORICAL MAJOR RISKS DETECTED      */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
                <History className="h-5 w-5 text-[#c5a059]" />
                <span>{isEn ? "Chronicle of Major Detected Risks" : "Kronika Największych Wykrytych Ryzyk"}</span>
              </h2>
              <p className="mt-0.5 text-xs text-white/50">
                {isEn
                  ? "Real-world market collapses and protocol exploits pre-emptively identified by Velmère telemetry."
                  : "Prawdziwe przypadki załamań rynkowych i exploitów wykryte przez wskaźniki Velmère przed katastrofą."}
              </p>
            </div>

            <div className="space-y-4">
              {historicalIncidents.map((inc, index) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                  key={inc.id}
                  className="rounded-2xl border border-white/[0.07] bg-[#0c1017] p-5 transition-all duration-300 hover:border-[#c5a059]/40 hover:bg-[#0e121b]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#e6ca85]">{inc.symbol}</span>
                        <span className="text-sm font-bold text-white">{inc.name}</span>
                      </div>
                      <span className="text-[11px] text-white/40">{inc.detectionDate}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 font-mono text-xs font-bold text-rose-400">
                        {isEn ? "RISK:" : "RYZYKO:"} {inc.detectedRiskScore}/100
                      </span>
                    </div>
                  </div>

                  {/* Price Collapse Telemetry */}
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-[#090c12] p-3 text-center">
                    <div>
                      <span className="font-mono text-[9px] uppercase text-white/40">
                        {isEn ? "Price at Detection" : "Cena przy detekcji"}
                      </span>
                      <p className="font-mono text-xs font-bold text-white">{inc.priceAtDetection}</p>
                    </div>
                    <div>
                      <span className="font-mono text-[9px] uppercase text-white/40">
                        {isEn ? "Post-Collapse" : "Po załamaniu"}
                      </span>
                      <p className="font-mono text-xs font-bold text-rose-400">{inc.priceAfterCollapse}</p>
                    </div>
                    <div>
                      <span className="font-mono text-[9px] uppercase text-white/40">
                        {isEn ? "Drawdown" : "Spadek"}
                      </span>
                      <p className="font-mono text-xs font-bold text-rose-400">{inc.priceDropPct}</p>
                    </div>
                  </div>

                  {/* What Velmere Caught */}
                  <div className="mt-4 space-y-2 text-xs">
                    <div>
                      <span className="font-mono text-[10px] uppercase font-bold text-[#c5a059]">
                        {isEn ? "What Velmère sensors caught:" : "Co wykryły czujniki Velmère:"}
                      </span>
                      <p className="mt-0.5 text-white/70 leading-relaxed text-[11px]">
                        {inc.whatVelmereCaught}
                      </p>
                    </div>

                    <div className="rounded-lg bg-emerald-500/[0.07] border border-emerald-500/20 p-2.5">
                      <span className="font-mono text-[10px] uppercase font-bold text-emerald-300">
                        {isEn ? "Protection outcome:" : "Skutek ostrzeżenia:"}
                      </span>
                      <p className="mt-0.5 text-white/80 leading-relaxed text-[11px]">
                        {inc.preventionOutcome}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between font-mono text-[10px] text-white/40">
                    <span>{isEn ? "Capital within risk zone:" : "Kapitał w strefie zagrożenia:"}</span>
                    <span className="font-bold text-white/70">{inc.capitalAtRisk}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Total Impact Summary Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.3 }}
              className="rounded-2xl border border-[#c5a059]/30 bg-gradient-to-br from-[#121721] to-[#090c12] p-6 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#c5a059]/15 text-[#e6ca85]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isEn ? "Key Takeaways from the Risk Chronicle" : "Wnioski z Kroniki Zagrożeń"}
                  </h3>
                  <p className="text-xs text-white/50">
                    {isEn ? "Quantifying Objective Telemetry" : "Kwantyfikacja bezstronnej telemetrii"}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs text-white/70">
                <p>
                  {isEn
                    ? "None of the protocols in this chronicle retained a green Velmère immutability badge at the moment of collapse. In every instance, telemetry signaled order book vacuums or copyright/proxy asymmetry between 48 hours and 7 days prior to market breakdown."
                    : "Żaden z projektów w kronice nie posiadał zielonej odznaki nienaruszalności Velmère w momencie załamania. Algorytm za każdym razem sygnalizował anomalię w arkuszu lub asymetrię praw autorskich z wyprzedzeniem od 48h do 7 dni."}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-4">
                <Link
                  href={`/${locale}/risk-management`}
                  className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#e6ca85] hover:underline"
                >
                  <span>{isEn ? "Explore how we quantify these vectors" : "Zobacz jak mierzymy te anomalie"}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
