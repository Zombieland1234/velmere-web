"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Layers,
  Activity,
  AlertTriangle,
  Lock,
  Cpu,
  Database,
  ArrowRight,
  TrendingDown,
  Scale,
  Zap,
  CheckCircle2,
  FileCheck2,
  Eye,
  Sliders,
  ChevronRight,
  BarChart3,
  ExternalLink,
} from "lucide-react";

interface RiskManagementPageProps {
  locale: string;
}

export default function RiskManagementPage({ locale }: RiskManagementPageProps) {
  const [activePillar, setActivePillar] = useState<number>(0);
  const isEn = locale !== "pl";

  const pillars = isEn
    ? [
        {
          id: "microstructure",
          num: "01",
          title: "L3 Order Book Microstructure & VWAP Slippage Model",
          subtitle: "Quantifying sovereign liquidity depth and book resiliency",
          icon: <BarChart3 className="h-5 w-5 text-[#c5a059]" />,
          tag: "ORDERBOOK L3 / VWAP",
          accent: "gold",
          howItWorks:
            "The telemetry engine sweeps order book depth within ±2% of current market spread. The algorithm filters out artificial phantom orders (spoofing canceled within sub-second intervals) in real time and computes Kyle's lambda illiquidity metric. Simulated volume shocks from $10,000 to $5,000,000 generate a deterministic VWAP slippage curve.",
          whyItWorks:
            "Order size on paper does not imply executable execution at market quote. Seemingly liquid assets often suffer from severe order book vacuums, causing double-digit slippage under institutional size. Velmère exposes synthetic liquidity instantly and protects capital from illiquid entrapment.",
          mathConcept: "Kyle's Lambda: λ = Cov(ΔP, Q) / Var(Q) • Resilient Depth Metric",
        },
        {
          id: "symbolic",
          num: "02",
          title: "EVM Symbolic Execution & AST Decompilation",
          subtitle: "Deterministic mathematical proof of bytecode security",
          icon: <Cpu className="h-5 w-5 text-[#e6ca85]" />,
          tag: "EVM SYMBOLIC SOLVER",
          accent: "amber",
          howItWorks:
            "Independent of developer declarations, the engine decompiles raw bytecode into an abstract syntax tree (AST). The SMT solver then simulates state permutations to verify core invariants: sell authorization (Can-Sell Invariant), hidden transfer taxes (Tax Trap > 5%), unbacked minting permissions, and reentrancy vectors.",
          whyItWorks:
            "Over 80% of modern on-chain exploits are obfuscated within proxy patterns, unverified external libraries, or complex delegation logic. Human visual audits suffer cognitive bias; deterministic symbolic solver proofs provide unassailable verification of execution safety.",
          mathConcept: "SMT Invariant Proof: ∀ state S, transaction T(sell) => Success(S') ∧ Tax(S') ≤ 5%",
        },
        {
          id: "topology",
          num: "03",
          title: "Wallet Flow Topology & Concentration Ratio",
          subtitle: "Detecting supply asymmetry and hidden whale coalitions",
          icon: <Activity className="h-5 w-5 text-emerald-400" />,
          tag: "WHALE GRAPH ENTROPY",
          accent: "emerald",
          howItWorks:
            "The system models an on-chain relationship graph, categorizing wallets into behavioral clusters: centralized exchange cold/hot vaults, institutional custodians, AMM liquidity pools, and private whale entities. A modified Gini coefficient and Herfindahl-Hirschman Index (HHI) are continuously measured for circulating float.",
          whyItWorks:
            "Even an audit-clean smart contract becomes an exit trap if three affiliated entities control 65% of circulating supply. Detecting coordinated exchange outflows (accumulation) or deposit spikes (distribution prep) forecasts sell pressure ahead of price reaction.",
          mathConcept: "Supply Inequality: G = (Σ |yi - yj|) / (2n²ȳ) • HHI = Σ (s_i)²",
        },
        {
          id: "oracle",
          num: "04",
          title: "Oracle Resiliency & Flash Manipulation Resistance",
          subtitle: "Zero-latency price feed integrity across trading venues",
          icon: <Lock className="h-5 w-5 text-sky-400" />,
          tag: "ORACLE INTEGRITY CORE",
          accent: "sky",
          howItWorks:
            "The engine correlates automated market maker (AMM) tick pools against primary reference venues (Chainlink, Pyth, Uniswap v3 TWAP). It calculates the precise capital cost required to dislocate spot prices within a single block flash loan vector.",
          whyItWorks:
            "If an asset valuation relies on shallow decentralized pools, an adversary can borrow $50M, distort spot prices for one block, and drain lending pools. Velmère validates whether pricing oracles possess resilient manipulation immunity.",
          mathConcept: "Capital Manipulation Threshold: Cost_manipulation > Max_extractable_value",
        },
      ]
    : [
        {
          id: "microstructure",
          num: "01",
          title: "Mikrostruktura Arkusza L3 i Model Poślizgu VWAP",
          subtitle: "Kwantyfikacja rzeczywistej głębokości płynności i odporności księgi",
          icon: <BarChart3 className="h-5 w-5 text-[#c5a059]" />,
          tag: "ORDERBOOK L3 / VWAP",
          accent: "gold",
          howItWorks:
            "Silnik telemetryczny pobiera głębokość arkusza zleceń w paśmie ±2% od bieżącego spreadu. Algorytm odfiltrowuje sztuczne zlecenia (spoofing anulowany w ułamkach sekund) i wylicza wskaźnik Kyle'a (Kyle's lambda). Model symuluje uderzenia wolumenowe od $10,000 do $5,000,000, tworząc deterministyczną krzywą poślizgu VWAP.",
          whyItWorks:
            "Wielkość zleceń na papierze nie oznacza możliwości ich egzekucji po cenie rynkowej. Często aktywa o rzekomo wysokiej kapitalizacji posiadają próżnię w arkuszu. Velmère obnaża iluzoryczną płynność zanim dojdzie do uwięzienia kapitału w pozycji.",
          mathConcept: "Lambda Kyle'a: λ = Cov(ΔP, Q) / Var(Q) • Wskaźnik odporności arkusza",
        },
        {
          id: "symbolic",
          num: "02",
          title: "Egzekucja Symboliczna EVM i Dekompilacja AST",
          subtitle: "Deterministyczny matematyczny dowód bezpieczeństwa kodu bajtowego",
          icon: <Cpu className="h-5 w-5 text-[#e6ca85]" />,
          tag: "EVM SYMBOLIC SOLVER",
          accent: "amber",
          howItWorks:
            "Niezależnie od deklaracji dewelopera, silnik dekompiluje kod bajtowy do drzewa składniowego (AST). Solver SMT symuluje permutacje stanów sprawdzając kluczowe niezmienniki: możliwość sprzedaży (Can-Sell Invariant), ukryte podatki (Tax Trap > 5%), prawa nielimitowanego bicia (Infinite Mint) oraz wektory reentrancy.",
          whyItWorks:
            "Ponad 80% exploitów Web3 ukrytych jest w strukturach proxy, bibliotekach zewnętrznych lub niejednoznacznych warunkach logicznych. Ludzki audyt wzrokowy ulega błędom; deterministyczny solver dowodowy eliminuje czynnik subiektywny.",
          mathConcept: "Dowód SMT: ∀ stan S, transakcja T(sell) => Sukces(S') ∧ Podatek(S') ≤ 5%",
        },
        {
          id: "topology",
          num: "03",
          title: "Topologia Przepływów i Wskaźnik Koncentracji Podaży",
          subtitle: "Wykrywanie asymetrii portfeli i ukrytych koalicji wielorybów",
          icon: <Activity className="h-5 w-5 text-emerald-400" />,
          tag: "WHALE GRAPH ENTROPY",
          accent: "emerald",
          howItWorks:
            "System buduje graf relacji on-chain kategoryzując portfele na klastry: skarbce CEX, instytucjonalni kustosze, pule AMM oraz prywatne wieloryby. Mierzony jest zmodyfikowany współczynnik Giniego oraz wskaźnik Herfindahla-Hirschmana (HHI) dla dostępnej podaży.",
          whyItWorks:
            "Nawet bezpieczny audytowo kontrakt staje się pułapką, jeśli 3 podmioty kontrolują 65% płynnego tokena. Wykrycie skoordynowanego odpływu z giełd (akumulacja) lub napływu na CEX (dystrybucja) pozwala przewidzieć presję podażową przed zmianą ceny.",
          mathConcept: "Nierówność podaży: G = (Σ |yi - yj|) / (2n²ȳ) • HHI = Σ (s_i)²",
        },
        {
          id: "oracle",
          num: "04",
          title: "Stabilność Wyroczni i Odporność na Ataki Błyskawiczne",
          subtitle: "Odporność wyceny na manipulacje w pojedynczym bloku transakcyjnym",
          icon: <Lock className="h-5 w-5 text-sky-400" />,
          tag: "ORACLE INTEGRITY CORE",
          accent: "sky",
          howItWorks:
            "Silnik bada korelacje między cenami w pulach płynności a zewnętrznymi źródłami referencyjnymi (Chainlink, Pyth, TWAP Uniswap v3). Analizowany jest minimalny koszt kapitałowy potrzebny do sztucznego przesunięcia ceny spot w ramach pożyczki błyskawicznej (Flash Loan Attack Vector).",
          whyItWorks:
            "Jeśli wycena aktywa w protokole pożyczkowym lub likwidacyjnym opiera się wyłącznie na płytkiej puli AMM, napastnik może pożyczyć 50M USD, zaburzyć cenę na 1 blok i wyczyścić rezerwy. Velmère sprawdza, czy architektura wyroczni jest odporna na manipulację kapitałem chwilowym.",
          mathConcept: "Capital Manipulation Threshold: Cost_manipulation > Max_extractable_value",
        },
      ];

  const riskTiers = isEn
    ? [
        {
          range: "0 — 35",
          tier: "LOW RISK",
          label: "Institutional Grade Profile",
          badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          indicatorColor: "bg-emerald-400",
          description:
            "Asset satisfies rigorous liquidity and structural standards. Bytecode is free of administrative backdoors, supply is decentralized across thousands of independent entities, and order book resiliency remains resilient (slippage < 0.1% for $100k orders).",
          features: [
            "Verified contract without transfer freeze or blacklisting capabilities",
            "High L3 order book depth across primary Tier-1 venues",
            "Zero transactional wash trading anomalies",
            "SHA-256 Merkle Evidence Seal certification included in audit export",
          ],
        },
        {
          range: "36 — 64",
          tier: "MODERATE RISK",
          label: "Cautionary Phase",
          badgeColor: "bg-[#c5a059]/10 text-[#e6ca85] border-[#c5a059]/30",
          indicatorColor: "bg-[#c5a059]",
          description:
            "Asset exhibits verified technical structure but presents elevated volatility, moderate whale concentration, or shallower order book depth. Requires limit execution and avoidance of aggressive market orders.",
          features: [
            "Potential execution slippage on institutional trade sizes",
            "Moderate token concentration in early investor or team wallets",
            "Standard administrative roles (typically governed by timelock)",
            "Whale Watch telemetry monitoring recommended",
          ],
        },
        {
          range: "65 — 100",
          tier: "HIGH RISK",
          label: "High Vulnerability Asymmetry",
          badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
          indicatorColor: "bg-rose-400",
          description:
            "Critical risk vectors identified: hidden taxes exceeding 5%, unilateral owner authority to halt trading, synthetic wash trading volume, or severe order book vacuum.",
          features: [
            "Potential liquidity trap or honeypot execution pattern",
            "Unrestricted owner privileges to modify parameters without timelock",
            "Extreme capital concentration (>70% held across affiliated clusters)",
            "Severe capital loss warning on sell execution",
          ],
        },
      ]
    : [
        {
          range: "0 — 35",
          tier: "NISKIE RYZYKO",
          label: "Profil Instytucjonalny (Institutional Grade)",
          badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          indicatorColor: "bg-emerald-400",
          description:
            "Aktywo spełnia rygorystyczne normy płynnościowe i strukturalne. Kod bajtowy wolny od pułapek administracyjnych, podaż rozproszona wśród tysięcy niezależnych podmiotów, wysoka odporność arkusza na duże zlecenia (poślizg < 0.1% dla zleceń $100k).",
          features: [
            "Zweryfikowany kontrakt bez uprawnień do blokady transferów",
            "Wysoka głębokość księgi L3 na głównych giełdach",
            "Brak anomalii w wolumenie transakcyjnym",
            "Certyfikacja dowodowa SHA-256 Merkle Evidence Seal dostępna w raporcie PDF",
          ],
        },
        {
          range: "36 — 64",
          tier: "UMIARKOWANE RYZYKO",
          label: "Faza Ostrzegawcza (Cautionary Phase)",
          badgeColor: "bg-[#c5a059]/10 text-[#e6ca85] border-[#c5a059]/30",
          indicatorColor: "bg-[#c5a059]",
          description:
            "Aktywo posiada prawidłową konstrukcję techniczną, jednak odnotowano podwyższoną zmienność, umiarkowaną koncentrację wielorybów lub płytszy arkusz zleceń. Wymaga stosowania zleceń limitowanych i unikania zleceń rynkowych o dużym wolumenie.",
          features: [
            "Możliwy wyższy poślizg cenowy przy transakcjach instytucjonalnych",
            "Umiarkowana koncentracja tokenów w portfelach wczesnych inwestorów",
            "Prawidłowe uprawnienia administracyjne (często z timelockiem)",
            "Zalecane monitorowanie radaru Whale Watch",
          ],
        },
        {
          range: "65 — 100",
          tier: "WYSOKIE RYZYKO",
          label: "Asymetria Dowodowa (High Vulnerability)",
          badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
          indicatorColor: "bg-rose-400",
          description:
            "Zidentyfikowano krytyczne wektory ryzyka: ukryte podatki powyżej 5%, jednostronne uprawnienia właściciela do wstrzymania handlu, sztucznie generowany wolumen (wash trading) lub brak wystarczającej płynności w księdze.",
          features: [
            "Potencjalna pułapka płynnościowa lub ryzyko Honeypot",
            "Uprawnienia właściciela do zmiany parametrów bez opóźnienia czasowego",
            "Ekstremalna koncentracja kapitału (>70% w rękach kilku podmiotów)",
            "Ostrzeżenie przed utratą całości kapitału przy zleceniu sprzedaży",
          ],
        },
      ];

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
        {/* Breadcrumb Navigation */}
        <div className="mb-6 flex items-center gap-2 font-mono text-xs text-white/40">
          <Link href={`/${locale}`} className="transition hover:text-white">
            Velmère
          </Link>
          <span>/</span>
          <span className="text-white/60">{isEn ? "Risk Architecture" : "Architektura Ryzyka"}</span>
          <span>/</span>
          <span className="text-[#c5a059]">Risk Management Core</span>
        </div>

        {/* HERO SECTION */}
        <div className="border-b border-white/[0.08] pb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c5a059]/30 bg-[#c5a059]/10 px-3 py-1 text-xs font-semibold text-[#e6ca85]">
            <span className="flex h-2 w-2 rounded-full bg-[#c5a059]" />
            <span>VELMÈRE RISK SENTINEL V2.4 — METHODOLOGY DISCLOSURE</span>
          </div>

          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
            {isEn ? "Deterministic Architecture" : "Deterministyczna Architektura"} <br />
            <span className="bg-gradient-to-r from-white via-[#f3e8cb] to-[#c5a059] bg-clip-text text-transparent">
              {isEn ? "For Market Risk Quantification" : "Pomiaru Ryzyka Rynkowego"}
            </span>
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
            {isEn ? (
              <>
                Traditional market research relies on subjective narratives and outdated reports.
                The Velmère platform deploys a <strong className="text-white font-semibold">deterministic proof system</strong> unifying L3 order
                book telemetry, EVM symbolic execution, and Bayesian slippage modeling into an unassailable
                risk index <strong className="text-[#e6ca85] font-semibold">(0 — 100)</strong>.
              </>
            ) : (
              <>
                Tradycyjne analizy rynkowe opierają się na subiektywnych opiniach i zdezaktualizowanych raportach.
                Platforma Velmère stosuje <strong className="text-white font-semibold">deterministyczny system dowodowy</strong>, który łączy telemetrię
                arkusza zleceń L3, symboliczną egzekucję EVM oraz bayesowskie modelowanie poślizgu w jeden
                niepodważalny wskaźnik ryzyka <strong className="text-[#e6ca85] font-semibold">(0 — 100)</strong>.
              </>
            )}
          </p>

          {/* Key Metric Highlights */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="rounded-xl border border-white/[0.07] bg-[#0c1017] p-4 transition hover:border-white/[0.15]"
            >
              <span className="font-mono text-xs uppercase tracking-wider text-white/40">{isEn ? "Proof Catalog" : "Katalog Dowodowy"}</span>
              <p className="mt-1 font-mono text-2xl font-black text-white sm:text-3xl">{isEn ? "20 Signals" : "20 Sygnałów"}</p>
              <span className="text-[11px] text-[#c5a059]">{isEn ? "Deterministic verification" : "Deterministyczna weryfikacja"}</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="rounded-xl border border-white/[0.07] bg-[#0c1017] p-4 transition hover:border-white/[0.15]"
            >
              <span className="font-mono text-xs uppercase tracking-wider text-white/40">{isEn ? "Engine Latency" : "Czas Odpowiedzi"}</span>
              <p className="mt-1 font-mono text-2xl font-black text-white sm:text-3xl">&lt; 12 ms</p>
              <span className="text-[11px] text-[#c5a059]">{isEn ? "Microstructural speed" : "Mikrostrukturalna szybkość"}</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="rounded-xl border border-white/[0.07] bg-[#0c1017] p-4 transition hover:border-white/[0.15]"
            >
              <span className="font-mono text-xs uppercase tracking-wider text-white/40">{isEn ? "Quantification" : "Kwantyfikacja"}</span>
              <p className="mt-1 font-mono text-2xl font-black text-white sm:text-3xl">0 — 100</p>
              <span className="text-[11px] text-emerald-400">VLM Unified Risk Score</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="rounded-xl border border-white/[0.07] bg-[#0c1017] p-4 transition hover:border-white/[0.15]"
            >
              <span className="font-mono text-xs uppercase tracking-wider text-white/40">{isEn ? "Audit Proof" : "Integralność Prawna"}</span>
              <p className="mt-1 font-mono text-2xl font-black text-white sm:text-3xl">SHA-256</p>
              <span className="text-[11px] text-[#e6ca85]">{isEn ? "Merkle Evidence Seal" : "Pieczęć dowodowa Merkle Tree"}</span>
            </motion.div>
          </div>
        </div>

        {/* IP PROTECTION & METHODOLOGY INTEGRITY NOTICE */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="my-10 rounded-2xl border border-white/[0.08] bg-[#0b0e15] p-5 sm:p-6 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#c5a059]/15 text-[#e6ca85]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                {isEn
                  ? "Methodology Integrity & Intellectual Property Disclosure (Guarded Core)"
                  : "Nota Integralności i Ochrony Własności Intelektualnej (Guarded Core)"}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-white/70 sm:text-sm">
                {isEn ? (
                  <>
                    This document discloses the mathematical mechanics and conceptual frameworks powering the Velmère
                    risk sentinel. To prevent adversarial actors from gaming scoring metrics (<em>audit manipulation</em>),
                    internal neural weight matrices, solver hyperplanes, and proprietary liquidity elasticity equations remain
                    strictly guarded corporate trade secrets. State outputs remain deterministically verifiable via SHA-256 commitments.
                  </>
                ) : (
                  <>
                    Niniejszy dokument przedstawia mechanizmy i matematyczne fundamenty, na których opiera się platforma
                    Velmère. W celu uniemożliwienia podmiotom złośliwym manipulowania modelami (tzw. <em>gaming the audit</em>),
                    wewnętrzne macierze wag neuronowych, parametry optymalizacyjne solvera oraz autorskie wagi wrażliwości
                    pozostają tajemnicą przedsiębiorstwa. Oceny publikowane są w sposób bezwzględnie weryfikowalny
                    poprzez sumy kontrolne SHA-256.
                  </>
                )}
              </p>
            </div>
          </div>
        </motion.div>

        {/* 4 FOUNDATIONAL PILLARS (INTERACTIVE TABS) */}
        <div className="mt-14">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#c5a059]">
              {isEn ? "Sentinel Engine Architecture" : "Architektura Silnika Sentinel"}
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
              {isEn ? "Four Pillars of Risk Quantification" : "Cztery Filary Obliczania Ryzyka"}
            </h2>
            <p className="text-sm text-white/50">
              {isEn
                ? "Every asset evaluation across Shield Terminal and Real Markets is grounded in continuous verification of four independent risk vectors."
                : "Każda ocena ryzyka aktywa w Shield Terminal oraz Real Markets opiera się na ciągłej ewaluacji czterech niezależnych wektorów."}
            </p>
          </div>

          {/* Pillar Selector Tabs */}
          <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((pillar, idx) => {
              const isActive = activePillar === idx;
              return (
                <button
                  key={pillar.id}
                  onClick={() => setActivePillar(idx)}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 ${
                    isActive
                      ? "border-[#c5a059]/60 bg-[#121722] shadow-lg shadow-[#c5a059]/5"
                      : "border-white/[0.07] bg-[#0c1017] hover:border-white/[0.16] hover:bg-[#0e121b]"
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    isActive ? "bg-[#c5a059]/20" : "bg-black/40"
                  }`}>
                    {pillar.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs font-bold ${isActive ? "text-[#e6ca85]" : "text-white/40"}`}>
                        {pillar.num}
                      </span>
                      <span className="font-mono text-[10px] text-white/40">{pillar.tag}</span>
                    </div>
                    <h3 className="mt-1 text-sm font-bold text-white leading-snug">{pillar.title}</h3>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Pillar Detail Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activePillar}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-4 rounded-2xl border border-white/[0.08] bg-[#0c1017] p-6 sm:p-8"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-[#c5a059]/10 border border-[#c5a059]/20 px-2.5 py-1 font-mono text-xs font-bold text-[#e6ca85]">
                    <span>{isEn ? `PILLAR ${pillars[activePillar].num}` : `FILAR ${pillars[activePillar].num}`}</span>
                    <span>•</span>
                    <span>{pillars[activePillar].tag}</span>
                  </div>
                  <h3 className="mt-3 text-2xl font-bold tracking-tight text-white">
                    {pillars[activePillar].title}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-white/60">
                    {pillars[activePillar].subtitle}
                  </p>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-xl border border-white/[0.06] bg-[#090c12] p-4">
                      <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#e6ca85]">
                        <Sliders className="h-4 w-4" />
                        <span>{isEn ? "How the mechanism works" : "Jak działa mechanizm?"}</span>
                      </h4>
                      <p className="mt-2 text-xs leading-relaxed text-white/80 sm:text-sm">
                        {pillars[activePillar].howItWorks}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-[#090c12] p-4">
                      <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{isEn ? "Why it protects capital" : "Dlaczego to działa i chroni kapitał?"}</span>
                      </h4>
                      <p className="mt-2 text-xs leading-relaxed text-white/80 sm:text-sm">
                        {pillars[activePillar].whyItWorks}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mathematical Formula Preview Box */}
                <div className="w-full lg:w-80 shrink-0">
                  <div className="rounded-xl border border-white/[0.08] bg-[#090c12] p-5">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                      <span className="font-mono text-xs uppercase text-white/50">{isEn ? "Formula & Proof" : "Formuła & Weryfikacja"}</span>
                      <span className="rounded bg-[#c5a059]/15 border border-[#c5a059]/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#e6ca85]">
                        LIVE INVARIANT
                      </span>
                    </div>

                    <div className="mt-4 rounded-lg bg-black/60 p-3 font-mono text-xs text-[#e6ca85] overflow-x-auto">
                      {pillars[activePillar].mathConcept}
                    </div>

                    <p className="mt-3 text-[11px] text-white/50 leading-relaxed">
                      {isEn
                        ? "Every asset in the catalog evaluates against this solver invariant prior to risk score calculation. Boundary violations instantly trigger defensive alert protocols."
                        : "Każde aktywo w katalogu przechodzi przez ten algorytm przed aktualizacją wskaźnika ryzyka. Brak spełnienia warunków brzegowych automatycznie aktywuje procedurę ostrzegawczą."}
                    </p>

                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-white/70">
                      <span>{isEn ? "Telemetry status:" : "Status telemetrii:"}</span>
                      <span className="flex items-center gap-1.5 font-mono text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {isEn ? "Active / Continuous Proof" : "Aktywny / Weryfikacja ciągła"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* UNIFIED RISK SCORE SCALE (0-100) */}
        <div className="mt-20">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#c5a059]">
              {isEn ? "Velmère Risk Scale" : "Skala Ryzyka Velmère"}
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
              {isEn ? "Transparent Metric Interpretation (0 — 100)" : "Przejrzysta Interpretacja Wyników (0 — 100)"}
            </h2>
            <p className="text-sm text-white/50">
              {isEn
                ? "Our unified score synthesizes disparate telemetry signals into a single unassailable rating, eliminating conflicting indicator confusion."
                : "Nasz wskaźnik syntetyzuje wszystkie sygnały w jedną czytelną ocenę, eliminując chaos setek sprzecznych wskaźników."}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {riskTiers.map((tier, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                key={idx}
                className="flex flex-col justify-between rounded-2xl border border-white/[0.07] bg-[#0c1017] p-6 transition hover:border-white/[0.16] hover:bg-[#0e121b]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-bold ${tier.badgeColor}`}>
                      {tier.range}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${tier.indicatorColor}`} />
                      <span className="font-mono text-xs font-bold text-white">{tier.tier}</span>
                    </div>
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-white">{tier.label}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/70">{tier.description}</p>

                  <div className="mt-6 border-t border-white/[0.06] pt-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                      {isEn ? "Key Parameters" : "Kluczowe Parametry"}
                    </span>
                    <ul className="mt-3 space-y-2">
                      {tier.features.map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2 text-xs text-white/80">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#c5a059] mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/[0.06]">
                  <Link
                    href={`/${locale}/shield`}
                    className="flex items-center justify-between font-mono text-xs font-bold text-white/60 hover:text-[#e6ca85] transition"
                  >
                    <span>{isEn ? "Inspect assets in this tier" : "Zobacz aktywa w tej klasie"}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* COMPARISON: VELMÈRE SENTINEL VS LEGACY AUDITS */}
        <div className="mt-20">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#c5a059]">
              {isEn ? "Security Standard Evolution" : "Ewolucja Standardu Bezpieczeństwa"}
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
              {isEn ? "Why Traditional Point-in-Time Audits Fail" : "Dlaczego Tradycyjne Audyty Zawodzą?"}
            </h2>
            <p className="text-sm text-white/50">
              {isEn
                ? "Comparison of static legacy PDF certificates versus Velmère continuous proof architecture."
                : "Porównanie tradycyjnych jednorazowych certyfikatów z ciągłą architekturą dowodową Velmère."}
            </p>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c1017]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-[#090c12] font-mono text-white/50 uppercase">
                    <th className="py-4 px-6 font-bold">{isEn ? "Evaluation Dimension" : "Wymiar Oceny"}</th>
                    <th className="py-4 px-6 font-bold text-rose-300">{isEn ? "Legacy Audit (Static)" : "Tradycyjny Audyt (Legacy)"}</th>
                    <th className="py-4 px-6 font-bold text-[#e6ca85]">Velmère Sentinel Core</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  <tr className="hover:bg-white/[0.02]">
                    <td className="py-4 px-6 font-bold text-white">{isEn ? "Verification Frequency" : "Częstotliwość weryfikacji"}</td>
                    <td className="py-4 px-6 text-white/60">{isEn ? "One-off snapshot (at token launch)" : "Jednorazowo (w momencie premiery)"}</td>
                    <td className="py-4 px-6 font-semibold text-[#e6ca85]">{isEn ? "Continuous real-time telemetry (< 12ms)" : "Ciągła telemetria w czasie rzeczywistym (< 12ms)"}</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="py-4 px-6 font-bold text-white">{isEn ? "On-Chain Code Mutation Response" : "Reakcja na zmianę kodu on-chain"}</td>
                    <td className="py-4 px-6 text-white/60">{isEn ? "None. Green badge persists despite proxy bytecode changes" : "Brak. Znaczek wisi pomimo podmiany implementacji proxy"}</td>
                    <td className="py-4 px-6 font-semibold text-[#e6ca85]">{isEn ? "Instant badge revocation replaced with red alert 'X'" : "Natychmiastowe unieważnienie odznaki i zamiana na ostrzeżenie 'X'"}</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="py-4 px-6 font-bold text-white">{isEn ? "Liquidity & Slippage Testing" : "Badanie płynności i poślizgu"}</td>
                    <td className="py-4 px-6 text-white/60">{isEn ? "Ignored (code-only evaluation)" : "Ignorowane (analizowany wyłącznie kod)"}</td>
                    <td className="py-4 px-6 font-semibold text-[#e6ca85]">{isEn ? "L3 order book & VWAP slippage simulation ($10k - $5M)" : "Symulacja księgi L3 i poślizgu VWAP ($10k - $5M)"}</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="py-4 px-6 font-bold text-white">{isEn ? "Whale Tracking & CEX Flows" : "Ruchy wielorybów i rezerwy CEX"}</td>
                    <td className="py-4 px-6 text-white/60">{isEn ? "Not tracked" : "Nieuwzględniane"}</td>
                    <td className="py-4 px-6 font-semibold text-[#e6ca85]">{isEn ? "Institutional flow radar with deposit/outflow categorization" : "Radar duzych przepływów z kategoryzacją depozytów i odpływów"}</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="py-4 px-6 font-bold text-white">{isEn ? "Immutability Assurance" : "Gwarancja nienaruszalności"}</td>
                    <td className="py-4 px-6 text-white/60">{isEn ? "Static PDF without cryptographic proof" : "Prosty dokument PDF bez kryptograficznego dowodu"}</td>
                    <td className="py-4 px-6 font-semibold text-[#e6ca85]">{isEn ? "Deterministic SHA-256 Merkle state commitment seal" : "Deterministyczny stempel SHA-256 Merkle w łańcuchu dowodowym"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CALL TO ACTION / NAVIGATIONAL LINKS */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-20 rounded-2xl border border-[#c5a059]/30 bg-gradient-to-b from-[#121721] to-[#07090D] p-8 text-center sm:p-12 shadow-xl"
        >
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
            {isEn ? "Experience Risk Architecture Across Live Markets" : "Przetestuj Architekturę Ryzyka na Żywych Rynkach"}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/60">
            {isEn
              ? "Access our advanced telemetry terminals across crypto or traditional capital markets."
              : "Skorzystaj z naszych zaawansowanych terminali telemetrycznych dla rynku kryptowalut lub tradycyjnych aktywów finansowych."}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={`/${locale}/shield`}
              className="flex items-center gap-2 rounded-xl bg-[#c5a059] px-6 py-3 font-mono text-xs font-bold text-black transition hover:bg-[#e6ca85] shadow-lg shadow-[#c5a059]/20"
            >
              <Shield className="h-4 w-4" />
              <span>{isEn ? "Launch Shield Terminal" : "Otwórz Shield Terminal"}</span>
            </Link>

            <Link
              href={`/${locale}/real-markets`}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 font-mono text-xs font-bold text-white transition hover:bg-white/[0.08]"
            >
              <Activity className="h-4 w-4" />
              <span>{isEn ? "Explore Real Markets" : "Przejdź do Real Markets"}</span>
            </Link>

            <Link
              href={`/${locale}/verified-audits`}
              className="flex items-center gap-2 rounded-xl border border-[#c5a059]/40 bg-[#c5a059]/10 px-6 py-3 font-mono text-xs font-bold text-[#e6ca85] transition hover:bg-[#c5a059]/20"
            >
              <FileCheck2 className="h-4 w-4" />
              <span>{isEn ? "Verified Audits Registry" : "Zweryfikowane Audyty (Badge Registry)"}</span>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
