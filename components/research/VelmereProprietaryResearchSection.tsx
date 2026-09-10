"use client";

import { useState } from "react";
import {
  calculateVelmereProviderConsensus,
  calculateVelmereLiquidityStress,
  calculateVelmereGovernancePower,
  calculateVelmereOracleFragility,
  calculateVelmereExitRisk,
  calculateVelmereDataConfidence,
  calculateVelmereSystemicCorrelation,
  calculateVelmereLiquidityDrawdownShock,
  type OwnerGovernanceType,
  type ProxyArchitectureType,
  type OracleSourceMechanism,
} from "@/lib/intelligence/velmere-proprietary-algorithms";
import styles from "./VelmereProprietaryResearchSection.module.css";
import {
  Activity,
  ShieldCheck,
  Database,
  Lock,
  AlertTriangle,
  Layers,
  TrendingDown,
  Zap,
  Sliders,
  Check,
  Copy,
} from "lucide-react";

type AlgoKey = "vpcs" | "vlsi" | "vgpi" | "vofs" | "ver" | "vdcs" | "vscs" | "vlds";

export default function VelmereProprietaryResearchSection({
  locale = "pl",
}: {
  locale?: "pl" | "de" | "en";
}) {
  const [activeAlgo, setActiveAlgo] = useState<AlgoKey>("vpcs");
  const [activePreset, setActivePreset] = useState<string>("preset_1");
  const [mode, setMode] = useState<"presets" | "sandbox">("presets");
  const [copiedDigest, setCopiedDigest] = useState(false);

  // --- Interactive Sandbox State ---
  // VPCS
  const [vpcsSpread, setVpcsSpread] = useState(0.2); // %
  const [vpcsLatency, setVpcsLatency] = useState(150); // ms
  const [vpcsProviders, setVpcsProviders] = useState(3);

  // VLSI
  const [vlsiDepthMultiplier, setVlsiDepthMultiplier] = useState(1.0);

  // VGPI
  const [vgpiOwner, setVgpiOwner] = useState<"renounced" | "multisig" | "eoa">("multisig");
  const [vgpiProxy, setVgpiProxy] = useState<"none" | "erc1967" | "unrestricted">("erc1967");
  const [vgpiPrivileges, setVgpiPrivileges] = useState(2); // 0-5
  const [vgpiTimelock, setVgpiTimelock] = useState(24); // hours

  // VOFS
  const [vofsMechanism, setVofsMechanism] = useState<"twap" | "short_twap" | "spot">("twap");
  const [vofsHeartbeat, setVofsHeartbeat] = useState(60); // seconds
  const [vofsManipCost, setVofsManipCost] = useState(5000000); // USD

  // VER
  const [verSellTax, setVerSellTax] = useState(2); // %
  const [verLpLocked, setVerLpLocked] = useState(90); // %
  const [verWhaleConc, setVerWhaleConc] = useState(25); // %
  const [verIsHoneypot, setVerIsHoneypot] = useState(false);

  // VDCS
  const [vdcsConsensus, setVdcsConsensus] = useState(92);
  const [vdcsAgeSec, setVdcsAgeSec] = useState(15);
  const [vdcsSignedPct, setVdcsSignedPct] = useState(100);
  const [vdcsReplayOk, setVdcsReplayOk] = useState(true);

  // VSCS
  const [vscsCorr, setVscsCorr] = useState(0.35); // -1.0 to 1.0
  const [vscsBeta, setVscsBeta] = useState(0.85); // 0.0 to 3.0
  const [vscsStress, setVscsStress] = useState(0.2); // 0.0 to 1.0

  // VLDS
  const [vldsWaves, setVldsWaves] = useState(5);
  const [vldsWaveSize, setVldsWaveSize] = useState(50000); // USD
  const [vldsReplenish, setVldsReplenish] = useState(10); // %

  const handleCopyDigest = (digest: string) => {
    navigator.clipboard.writeText(digest);
    setCopiedDigest(true);
    setTimeout(() => setCopiedDigest(false), 2000);
  };

  const algorithms = {
    vpcs: {
      code: "VPCS",
      name: "Velmère Provider Consensus Score",
      icon: Activity,
      description:
        locale === "pl"
          ? "Ilościowa miara zgodności cenowej i czasowej pomiędzy niezależnymi źródłami danych rynkowych (CEX, DEX, wyrocznie). Wykrywa anomalie pojedynczych giełd, luki płynnościowe i próby zafałszowania ceny."
          : "Quantitative measure of price and timestamp agreement across independent market providers (CEX, DEX, oracles). Detects isolated exchange anomalies, liquidity gaps, and feed poisoning.",
      formula: "VPCS = 100 · exp(-50 · WMAD - 0.5 · Δ_latency) · S_factor",
      formulaExplanation:
        locale === "pl"
          ? "WMAD to ważone średnie bezwzględne odchylenie od ważonej mediany. Δ_latency to maksymalne opóźnienie między kwotowaniami, a S_factor to mnożnik premiujący liczbę niezależnych źródeł (N ≥ 3)."
          : "WMAD represents weighted mean absolute deviation from median. Δ_latency is maximum timestamp divergence, and S_factor rewards provider independence.",
      params: [
        { name: "WMAD", desc: locale === "pl" ? "Ważona dyspersja cenowa względem mediany" : "Weighted price dispersion" },
        { name: "Δ_latency", desc: locale === "pl" ? "Rozjazd czasowy obserwacji (skew) w ms" : "Observation time skew in ms" },
        { name: "S_factor", desc: locale === "pl" ? "Współczynnik niezależnych providerów" : "Independent provider multiplier" },
      ],
      presets: [
        {
          id: "preset_1",
          label: locale === "pl" ? "3 Giełdy Tier-1 w ścisłej zgodzie (Binance, Coinbase, Kraken)" : "3 Tier-1 Exchanges in Tight Consensus",
          compute: () => {
            const res = calculateVelmereProviderConsensus([
              { providerId: "binance", priceUsd: 65420.5, observedAtMs: 1000 },
              { providerId: "coinbase", priceUsd: 65422.0, observedAtMs: 1020 },
              { providerId: "kraken", priceUsd: 65419.8, observedAtMs: 1010 },
            ]);
            return {
              score: res.score,
              gradeText: "INSTITUTIONAL CONSENSUS",
              gradeStyle: styles.gradeOptimal,
              metrics: [
                { label: locale === "pl" ? "Ważona Mediana" : "Weighted Median", value: `$${res.weightedMedianPrice.toLocaleString()}` },
                { label: locale === "pl" ? "Dyspersja (WMAD)" : "Dispersion (WMAD)", value: `${res.weightedMadPct}%` },
                { label: locale === "pl" ? "Liczba Źródeł" : "Sources Count", value: `${res.sampleCount}` },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
        {
          id: "preset_2",
          label: locale === "pl" ? "Rozjazd cenowy / Flash Crash na mniejszej giełdzie (4.8% spread)" : "Price Disconnect / Outlier Split (4.8% spread)",
          compute: () => {
            const res = calculateVelmereProviderConsensus([
              { providerId: "binance", priceUsd: 65420.5, observedAtMs: 1000 },
              { providerId: "dex_pool", priceUsd: 62280.0, observedAtMs: 1000 },
              { providerId: "outlier_cex", priceUsd: 68100.0, observedAtMs: 1000 },
            ]);
            return {
              score: res.score,
              gradeText: "ANOMALOUS SPLIT",
              gradeStyle: styles.gradeDanger,
              metrics: [
                { label: locale === "pl" ? "Ważona Mediana" : "Weighted Median", value: `$${res.weightedMedianPrice.toLocaleString()}` },
                { label: locale === "pl" ? "Dyspersja (WMAD)" : "Dispersion (WMAD)", value: `${res.weightedMadPct}%` },
                { label: locale === "pl" ? "Liczba Źródeł" : "Sources Count", value: `${res.sampleCount}` },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
      ],
      computeSandbox: () => {
        const basePrice = 65000;
        const observations = [];
        for (let i = 0; i < vpcsProviders; i++) {
          const shift = (i - (vpcsProviders - 1) / 2) * (vpcsSpread / 100) * basePrice;
          observations.push({
            providerId: `provider_${i + 1}`,
            priceUsd: basePrice + shift,
            observedAtMs: 1000 + i * (vpcsLatency / Math.max(1, vpcsProviders - 1)),
          });
        }
        const res = calculateVelmereProviderConsensus(observations);
        return {
          score: res.score,
          gradeText: res.score >= 80 ? "HIGH CONSENSUS" : res.score >= 50 ? "MODERATE SKEW" : "DIVERGENT QUORUM",
          gradeStyle: res.score >= 80 ? styles.gradeOptimal : res.score >= 50 ? styles.gradeModerate : styles.gradeDanger,
          metrics: [
            { label: locale === "pl" ? "Mediana Ceny" : "Median Price", value: `$${res.weightedMedianPrice.toFixed(2)}` },
            { label: locale === "pl" ? "Dyspersja WMAD" : "WMAD Dispersion", value: `${res.weightedMadPct}%` },
            { label: locale === "pl" ? "Aktywne Źródła" : "Active Feeds", value: `${res.sampleCount}` },
          ],
          digest: res.evidenceDigest,
        };
      },
      limitations: [
        locale === "pl" ? "Wymaga minimum 2 niezależnych kwotowań do wyznaczenia kworum." : "Requires minimum 2 feeds for quorum.",
        locale === "pl" ? "W przypadku ekstremalnej zmienności rynkowej okno tolerancji ulega zwężeniu." : "Window narrows during extreme volatility regimes.",
        locale === "pl" ? "Pojedyncze źródło otrzymuje sztywny pułap 50/100 (brak potwierdzenia)." : "Single feed capped at 50/100 default.",
      ],
      benchmark:
        locale === "pl"
          ? "W odróżnieniu od prostych średnich arytmetycznych (CoinMarketCap / CoinGecko), VPCS wykorzystuje ważoną medianę i funkcję wykładniczą karzącą odchylenia powyżej 0.25%, eliminując podatność na flash-crash pojedynczej giełdy."
          : "Unlike naive arithmetic means (CoinMarketCap), VPCS applies weighted median and exponential penalties against single-exchange anomalies.",
    },
    vlsi: {
      code: "VLSI",
      name: "Velmère Liquidity Stress Index",
      icon: Layers,
      description:
        locale === "pl"
          ? "Nieliniowy model odporności głębokości rynku na uderzenia kapitałowe o standardowych wolumenach ($10k, $50k, $250k, $1M). Mierzy rzeczywisty poślizg cenowy i asymetrię bid/ask."
          : "Nonlinear order book resilience model evaluating execution slippage under standardized capital brackets ($10k, $50k, $250k, $1M) and bid/ask depth skew.",
      formula: "VLSI = 100 · [ 1 - ∑ α_k · min(1, Slip(S_k) / θ_k) ] · (1 - 0.25 · Asym)",
      formulaExplanation:
        locale === "pl"
          ? "S_k reprezentuje 4 progi kapitałowe, θ_k to maksymalne dopuszczalne progi poślizgu cenowego, a Asym to wskaźnik nierównowagi wolumenu ofert kupna i sprzedaży."
          : "S_k represents 4 capital brackets, θ_k is the maximum slippage tolerance, and Asym is the order book volume skew.",
      params: [
        { name: "S_k", desc: locale === "pl" ? "Zlecenia testowe: $10k, $50k, $250k, $1M" : "Test brackets: $10k, $50k, $250k, $1M" },
        { name: "Slip(S)", desc: locale === "pl" ? "Średni poślizg ważony wolumenem zlecenia" : "Volume-weighted slippage" },
        { name: "Asym", desc: locale === "pl" ? "Asymetria głębokości bid vs ask w księdze" : "Bid/Ask volume imbalance ratio" },
      ],
      presets: [
        {
          id: "preset_1",
          label: locale === "pl" ? "BTC/USDT Głęboki Orderbook Instytucjonalny ($5M+ w granicach 1%)" : "BTC/USDT Deep Institutional Orderbook ($5M+ within 1%)",
          compute: () => {
            const bids = [
              { price: 65400, quantity: 25 },
              { price: 65380, quantity: 35 },
              { price: 65300, quantity: 80 },
            ];
            const asks = [
              { price: 65405, quantity: 25 },
              { price: 65420, quantity: 35 },
              { price: 65500, quantity: 80 },
            ];
            const res = calculateVelmereLiquidityStress(bids, asks, 65402.5);
            return {
              score: res.score,
              gradeText: "INSTITUTIONAL DEEP",
              gradeStyle: styles.gradeOptimal,
              metrics: [
                { label: locale === "pl" ? "Poślizg $50k" : "Slippage $50k", value: `${res.slippage50kPct}%` },
                { label: locale === "pl" ? "Poślizg $1M" : "Slippage $1M", value: `${res.slippage1mPct}%` },
                { label: locale === "pl" ? "Asymetria Bid/Ask" : "Imbalance Bid/Ask", value: `${res.bidAskImbalancePct}%` },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
        {
          id: "preset_2",
          label: locale === "pl" ? "Cienki basen DEX / Niski wolumen ($12k całkowitej płynności)" : "Thin DEX Pool ($12k Total Liquidity Reserve)",
          compute: () => {
            const bids = [{ price: 1.0, quantity: 4000 }];
            const asks = [{ price: 1.04, quantity: 4000 }];
            const res = calculateVelmereLiquidityStress(bids, asks, 1.02);
            return {
              score: res.score,
              gradeText: "CRITICAL ILLIQUID",
              gradeStyle: styles.gradeDanger,
              metrics: [
                { label: locale === "pl" ? "Poślizg $10k" : "Slippage $10k", value: `${res.slippage10kPct}%` },
                { label: locale === "pl" ? "Deficyt $250k" : "Deficit $250k", value: `${res.slippage250kPct}%` },
                { label: locale === "pl" ? "Asymetria Bid/Ask" : "Imbalance Bid/Ask", value: `${res.bidAskImbalancePct}%` },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
      ],
      computeSandbox: () => {
        const qBase = 30 * vlsiDepthMultiplier;
        const bids = [
          { price: 65400, quantity: qBase },
          { price: 65200, quantity: qBase * 1.5 },
          { price: 64800, quantity: qBase * 2.5 },
        ];
        const asks = [
          { price: 65410, quantity: qBase },
          { price: 65600, quantity: qBase * 1.5 },
          { price: 66000, quantity: qBase * 2.5 },
        ];
        const res = calculateVelmereLiquidityStress(bids, asks, 65405);
        return {
          score: res.score,
          gradeText: res.score >= 75 ? "RESILIENT DEPTH" : res.score >= 40 ? "SHALLOW SLIPPAGE" : "CRITICAL THIN",
          gradeStyle: res.score >= 75 ? styles.gradeOptimal : res.score >= 40 ? styles.gradeModerate : styles.gradeDanger,
          metrics: [
            { label: locale === "pl" ? "Poślizg $50k" : "Slippage $50k", value: `${res.slippage50kPct}%` },
            { label: locale === "pl" ? "Poślizg $250k" : "Slippage $250k", value: `${res.slippage250kPct}%` },
            { label: locale === "pl" ? "Poślizg $1M" : "Slippage $1M", value: `${res.slippage1mPct}%` },
          ],
          digest: res.evidenceDigest,
        };
      },
      limitations: [
        locale === "pl" ? "Symulacja zakłada natychmiastowe wykonanie rynkowe bez interwencji animatorów." : "Assumes instantaneous execution without maker re-hedging.",
        locale === "pl" ? "W Uniswap v3 obliczenie uwzględnia krzywą płynności tickowej." : "Supports Uniswap v3 tick curve integration.",
      ],
      benchmark:
        locale === "pl"
          ? "Tradycyjne terminale raportują statyczną metrykę '+/- 2% depth'. VLSI modeluje pełną krzywą kosztu likwidacji dla realnych portfeli funduszy hedgingowych i inwestorów indywidualnych."
          : "Conventional platforms only report static '+/- 2% depth'. VLSI computes full execution slippage curves for hedge fund and retail order sizes.",
    },
    vgpi: {
      code: "VGPI",
      name: "Velmère Governance Power Index",
      icon: Lock,
      description:
        locale === "pl"
          ? "Ocena stopnia decentralizacji władzy administracyjnej, mutowalności logiki (proxy) oraz ryzyka jednostronnego przejęcia lub wyczyszczenia środków (rug-pull)."
          : "Evaluation of administrative decentralization, proxy upgrade mutability, and unilateral rug-pull / drain exploit risk.",
      formula: "VGPI = 100 · (1 - max(0, min(1, 0.35·O + 0.30·P + 0.35·R - T - M)))",
      formulaExplanation:
        locale === "pl"
          ? "O to ryzyko właściciela (EOA vs Multisig), P to architektura proxy, R to uprawnienia krytyczne (mint, pause, blacklist, drain), T to mitigacja timelockiem, a M to bonus progu wielopodpisowego."
          : "O is owner risk (EOA vs Multisig), P is proxy mutability, R is critical privileges (mint, blacklist), T is timelock mitigation, and M is multisig threshold credit.",
      params: [
        { name: "O (Owner)", desc: locale === "pl" ? "Typ właściciela: 0 dla renounced, 1 dla EOA" : "Owner type: 0 renounced, 1 EOA" },
        { name: "P (Proxy)", desc: locale === "pl" ? "Ryzyko mutowalności kodu i upgradeability" : "Code mutability and upgrade risk" },
        { name: "T (Timelock)", desc: locale === "pl" ? "Opóźnienie wykonania transakcji zarządczych (h)" : "Governance timelock delay (hours)" },
      ],
      presets: [
        {
          id: "preset_1",
          label: locale === "pl" ? "Renounced Zero Address · Niezmienny Smart Kontrakt" : "Renounced Zero Address · Immutable Smart Contract",
          compute: () => {
            const res = calculateVelmereGovernancePower({
              ownerType: "zero_address_renounced",
              proxyType: "immutable_no_proxy",
              canMint: false,
              canPause: false,
              canBlacklist: false,
              canChangeFee: false,
              canWithdrawLiquidity: false,
            });
            return {
              score: res.score,
              gradeText: "DECENTRALIZED DEFENSIBLE",
              gradeStyle: styles.gradeOptimal,
              metrics: [
                { label: locale === "pl" ? "Ryzyko Centralizacji" : "Centralization Risk", value: `${res.centralizationRiskPct}%` },
                { label: locale === "pl" ? "Uprawnienia Krytyczne" : "Critical Privileges", value: "0" },
                { label: locale === "pl" ? "Timelock" : "Timelock", value: locale === "pl" ? "Brak potrzeby (kod stały)" : "Not needed (immutable)" },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
        {
          id: "preset_2",
          label: locale === "pl" ? "Prywatny klucz EOA + Custom Proxy + Nielimitowany Mint i Drain" : "Private Key EOA + Unrestricted Custom Proxy + Mint/Drain",
          compute: () => {
            const res = calculateVelmereGovernancePower({
              ownerType: "eoa_unilateral",
              proxyType: "unrestricted_custom_proxy",
              canMint: true,
              canPause: true,
              canBlacklist: true,
              canChangeFee: true,
              canWithdrawLiquidity: true,
            });
            return {
              score: res.score,
              gradeText: "UNILATERAL EXPLOIT RISK",
              gradeStyle: styles.gradeDanger,
              metrics: [
                { label: locale === "pl" ? "Ryzyko Centralizacji" : "Centralization Risk", value: `${res.centralizationRiskPct}%` },
                { label: locale === "pl" ? "Uprawnienia Krytyczne" : "Critical Privileges", value: "5 / 5 active" },
                { label: locale === "pl" ? "Zabezpieczenie" : "Timelock Delay", value: "0h (instant)" },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
      ],
      computeSandbox: () => {
        const ownerMap: Record<"renounced" | "multisig" | "eoa", OwnerGovernanceType> = {
          renounced: "zero_address_renounced",
          multisig: "timelocked_multisig",
          eoa: "eoa_unilateral",
        };
        const proxyMap: Record<"none" | "erc1967" | "unrestricted", ProxyArchitectureType> = {
          none: "immutable_no_proxy",
          erc1967: "timelocked_beacon_uups",
          unrestricted: "unrestricted_custom_proxy",
        };
        const res = calculateVelmereGovernancePower({
          ownerType: ownerMap[vgpiOwner],
          proxyType: proxyMap[vgpiProxy],
          canMint: vgpiPrivileges >= 1,
          canPause: vgpiPrivileges >= 2,
          canBlacklist: vgpiPrivileges >= 3,
          canChangeFee: vgpiPrivileges >= 4,
          canWithdrawLiquidity: vgpiPrivileges >= 5,
          timelockDelayHours: vgpiTimelock,
        });
        return {
          score: res.score,
          gradeText: res.score >= 80 ? "STRONG DECENTRALIZATION" : res.score >= 50 ? "SUPERVISED MULTISIG" : "HIGH PRIVILEGE RISK",
          gradeStyle: res.score >= 80 ? styles.gradeOptimal : res.score >= 50 ? styles.gradeModerate : styles.gradeDanger,
          metrics: [
            { label: locale === "pl" ? "Ryzyko Właściciela" : "Owner Risk", value: `${res.centralizationRiskPct}%` },
            { label: locale === "pl" ? "Uprawnienia Aktywne" : "Active Privileges", value: `${vgpiPrivileges} / 5` },
            { label: locale === "pl" ? "Timelock Delay" : "Timelock Delay", value: `${vgpiTimelock}h` },
          ],
          digest: res.evidenceDigest,
        };
      },
      limitations: [
        locale === "pl" ? "Analiza opiera się na statycznej i dynamicznej dekompilacji bytecode'u EVM." : "Analysis derived from static and dynamic EVM bytecode decompilation.",
        locale === "pl" ? "Sygnatury off-chain (np. Snapshot) bez on-chain timelocka nie redukują ryzyka." : "Off-chain voting without on-chain timelock does not reduce risk.",
      ],
      benchmark:
        locale === "pl"
          ? "Podczas gdy CertiK i Etherscan często oznaczają kontrakty proxy jako 'Zweryfikowane' ignorując brak timelocka, VGPI traktuje natychmiastowe proxy jako wektor wysokiego ryzyka exploitacyjnego."
          : "While legacy scanners verify source code without checking timelocks, VGPI flags un-delayed proxy switches as high-threat attack vectors.",
    },
    vofs: {
      code: "VOFS",
      name: "Velmère Oracle Fragility Score",
      icon: AlertTriangle,
      description:
        locale === "pl"
          ? "Formułuje ekonomiczny koszt manipulacji wyrocznią cenową o 2% w ramach jednego bloku transakcyjnego (flash-loan exploitability) oraz zależność od podatnych rezerw spot."
          : "Formulates the economic capital cost required to distort the oracle feed by 2% within a single block (flash-loan exploitability) and dependency on spot DEX reserves.",
      formula: "VOFS = 100 · (0.35·M_risk + 0.25·D_risk + 0.15·H_risk + 0.25·E_manip)",
      formulaExplanation:
        locale === "pl"
          ? "M_risk to typ źródła wyroczni, D_risk to różnorodność feedów, H_risk to starość ostatniego uderzenia serca (heartbeat), a E_manip to kapitałowy koszt ataku."
          : "M_risk is mechanism type, D_risk is feed diversity, H_risk is heartbeat lag, and E_manip is capital manipulation cost.",
      params: [
        { name: "M_risk", desc: locale === "pl" ? "Ryzyko mechanizmu: TWAP vs spot pool" : "Mechanism risk: TWAP vs spot pool" },
        { name: "D_risk", desc: locale === "pl" ? "Brak zróżnicowania źródeł" : "Source concentration risk" },
        { name: "E_manip", desc: locale === "pl" ? "Kapitał potrzebny do zafałszowania ceny o 2%" : "Capital cost to distort price by 2%" },
      ],
      presets: [
        {
          id: "preset_1",
          label: locale === "pl" ? "Zdecentralizowany Agregator Chainlink + Pyth TWAP ($15M koszt ataku)" : "Decentralized Chainlink + Pyth TWAP ($15M attack cost)",
          compute: () => {
            const res = calculateVelmereOracleFragility({
              mechanism: "decentralized_aggregator_twap",
              independentFeedsCount: 4,
              heartbeatSeconds: 60,
              poolTvlUsd: 120_000_000,
              capitalCostToManipulate2PctUsd: 15_000_000,
            });
            return {
              score: res.score,
              gradeText: "ROBUST DEFENSIBLE",
              gradeStyle: styles.gradeOptimal,
              metrics: [
                { label: locale === "pl" ? "Wskaźnik Podatności" : "Fragility Ratio", value: `${res.manipulationCostRatio}` },
                { label: locale === "pl" ? "Opóźnienie Heartbeat" : "Heartbeat Lag", value: "60s" },
                { label: locale === "pl" ? "Koszt Ataku 2%" : "Attack Cost 2%", value: "> $15M USD" },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
        {
          id: "preset_2",
          label: locale === "pl" ? "Bezpośrednia rezerwa Uniswap v2 spot ($65k koszt zniekształcenia)" : "Direct Uniswap v2 Spot Reserve ($65k attack cost)",
          compute: () => {
            const res = calculateVelmereOracleFragility({
              mechanism: "dex_spot_reserves_direct",
              independentFeedsCount: 1,
              heartbeatSeconds: 1800,
              poolTvlUsd: 250_000,
              capitalCostToManipulate2PctUsd: 65_000,
            });
            return {
              score: res.score,
              gradeText: "FLASH LOAN RISK",
              gradeStyle: styles.gradeDanger,
              metrics: [
                { label: locale === "pl" ? "Wskaźnik Podatności" : "Fragility Ratio", value: `${res.manipulationCostRatio}` },
                { label: locale === "pl" ? "Opóźnienie Heartbeat" : "Heartbeat Lag", value: "30 min" },
                { label: locale === "pl" ? "Koszt Ataku 2%" : "Attack Cost 2%", value: "< $65k (critical)" },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
      ],
      computeSandbox: () => {
        const mechMap: Record<"twap" | "short_twap" | "spot", OracleSourceMechanism> = {
          twap: "decentralized_aggregator_twap",
          short_twap: "dex_twap_short_5m",
          spot: "dex_spot_reserves_direct",
        };
        const res = calculateVelmereOracleFragility({
          mechanism: mechMap[vofsMechanism],
          independentFeedsCount: vofsMechanism === "twap" ? 4 : vofsMechanism === "short_twap" ? 2 : 1,
          heartbeatSeconds: vofsHeartbeat,
          poolTvlUsd: vofsManipCost * 8,
          capitalCostToManipulate2PctUsd: vofsManipCost,
        });
        return {
          score: res.score,
          gradeText: res.score >= 75 ? "HARDENED ORACLE" : res.score >= 45 ? "MODERATE EXPLOIT COST" : "FLASH LOAN VULNERABLE",
          gradeStyle: res.score >= 75 ? styles.gradeOptimal : res.score >= 45 ? styles.gradeModerate : styles.gradeDanger,
          metrics: [
            { label: locale === "pl" ? "Koszt Ataku 2%" : "Attack Cost 2%", value: `$${(vofsManipCost / 1000).toLocaleString()}k` },
            { label: locale === "pl" ? "Heartbeat" : "Heartbeat", value: `${vofsHeartbeat}s` },
            { label: locale === "pl" ? "Współczynnik Ryzyka" : "Risk Ratio", value: `${res.manipulationCostRatio}` },
          ],
          digest: res.evidenceDigest,
        };
      },
      limitations: [
        locale === "pl" ? "Koszt ataku 2% uwzględnia bieżące rezerwy AMM oraz maksymalną pożyczkę flash-loan." : "Calculates attack cost factoring in available EVM flash loan depth.",
      ],
      benchmark:
        locale === "pl"
          ? "Większość platform analitycznych weryfikuje jedynie dostępność API. VOFS bada odporność gry ekonomicznej na manipulację w ramach DeFi lending i liquidation botów."
          : "Unlike competitors who only ping oracle endpoints, VOFS calculates economic attack game-theory and liquidation distortion limits.",
    },
    ver: {
      code: "VER",
      name: "Velmère Exit Risk",
      icon: ShieldCheck,
      description:
        locale === "pl"
          ? "Łączna estymacja prawdopodobieństwa niemożności zlikwidowania pozycji do aktywów rezerwowych (ETH/USDT/USDC). Uwzględnia honeypot, podatki transakcyjne, limity portfela i blokadę LP."
          : "Aggregate estimation of inability to liquidate holdings into base reserves (ETH/USDT/USDC). Accounts for honeypots, transfer taxes, wallet limits, and LP timelocks.",
      formula: "VER = 100 · min(1, 0.35·Tax + 0.25·Restrict + 0.20·(1-LP_locked) + 0.20·Whale_conc)",
      formulaExplanation:
        locale === "pl"
          ? "Wzór sumuje obciążenie podatkowe, restrykcje kontraktowe (cooldown, blacklist), procent odblokowanej płynności dewelopera oraz koncentrację top 10 portfeli."
          : "Formula synthesizes tax burdens, transfer controls, unlock schedules, and wallet concentration.",
      params: [
        { name: "Tax", desc: locale === "pl" ? "Suma podatku kupna i sprzedaży znormalizowana do 30%" : "Tax load normalized to 30%" },
        { name: "Restrict", desc: locale === "pl" ? "Wagi flag: blacklist, cooldown, max wallet" : "Contract restrictions weight" },
        { name: "LP_locked", desc: locale === "pl" ? "Udział płynności zamkniętej w timelocku" : "Locked liquidity percentage" },
      ],
      presets: [
        {
          id: "preset_1",
          label: locale === "pl" ? "Czyste aktywo bazowe (0% tax, 100% zablokowane LP, brak blacklist)" : "Clean Base Asset (0% Tax, 100% Locked LP, No Blacklist)",
          compute: () => {
            const res = calculateVelmereExitRisk({
              isHoneypot: false,
              buyTaxPct: 0,
              sellTaxPct: 0,
              tradingCooldown: false,
              canBlacklistUser: false,
              percentLiquidityLocked: 100,
              top10HoldersPercentExcludingPools: 14,
            });
            return {
              score: res.score,
              gradeText: "UNRESTRICTED LIQUID",
              gradeStyle: styles.gradeOptimal,
              metrics: [
                { label: locale === "pl" ? "Obciążenie Podatkowe" : "Tax Burden", value: "0%" },
                { label: locale === "pl" ? "Płynność Zablokowana" : "Locked LP", value: "100%" },
                { label: locale === "pl" ? "Koncentracja Top 10" : "Top 10 Whales", value: "14%" },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
        {
          id: "preset_2",
          label: locale === "pl" ? "Honeypot / Całkowita blokada transferów wyjściowych" : "Honeypot / 100% Trapped Liquidity",
          compute: () => {
            const res = calculateVelmereExitRisk({
              isHoneypot: true,
              buyTaxPct: 99,
              sellTaxPct: 100,
              tradingCooldown: true,
              canBlacklistUser: true,
              percentLiquidityLocked: 0,
              top10HoldersPercentExcludingPools: 95,
            });
            return {
              score: res.score,
              gradeText: "HONEYPOT LOCKUP",
              gradeStyle: styles.gradeDanger,
              metrics: [
                { label: locale === "pl" ? "Obciążenie Podatkowe" : "Tax Burden", value: "100%" },
                { label: locale === "pl" ? "Płynność Zablokowana" : "Locked LP", value: "0%" },
                { label: locale === "pl" ? "Możliwość Wyjścia" : "Exit Feasibility", value: "0% (Trapped)" },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
      ],
      computeSandbox: () => {
        const res = calculateVelmereExitRisk({
          isHoneypot: verIsHoneypot,
          buyTaxPct: Math.min(10, verSellTax),
          sellTaxPct: verSellTax,
          tradingCooldown: verSellTax > 25,
          canBlacklistUser: verSellTax > 15,
          percentLiquidityLocked: verLpLocked,
          top10HoldersPercentExcludingPools: verWhaleConc,
        });
        return {
          score: res.score,
          gradeText: res.score >= 75 ? "SAFE EXIT FLOW" : res.score >= 40 ? "FRICTION DETECTED" : "HIGH TRAP RISK",
          gradeStyle: res.score >= 75 ? styles.gradeOptimal : res.score >= 40 ? styles.gradeModerate : styles.gradeDanger,
          metrics: [
            { label: locale === "pl" ? "Podatek Sprzedaży" : "Sell Tax", value: `${verSellTax}%` },
            { label: locale === "pl" ? "LP Zablokowane" : "Locked LP", value: `${verLpLocked}%` },
            { label: locale === "pl" ? "Koncentracja Top 10" : "Top 10 Whales", value: `${verWhaleConc}%` },
          ],
          digest: res.evidenceDigest,
        };
      },
      limitations: [
        locale === "pl" ? "Wykrycie honeypota oparte jest na symulacji EVM trace i weryfikacji revert w parze DEX." : "Derived from EVM trace simulation and contract revert testing.",
      ],
      benchmark:
        locale === "pl"
          ? "Standardowe narzędzia (DEXScreener) sprawdzają tylko flagę honeypot. VER łączy fizykę płynności, podatki oraz ryzyko zrzutu przez wielorybów w jeden defensywny wskaźnik."
          : "Standard screeners only check basic honeypot flags. VER combines liquidity decay, token taxes, and whale concentration into an institutional exit guarantee.",
    },
    vdcs: {
      code: "VDCS",
      name: "Velmère Data Confidence Score",
      icon: Database,
      description:
        locale === "pl"
          ? "Meta-wskaźnik epistemologiczny oceniający wiarygodność każdego wygenerowanego raportu i kwotowania na podstawie kworum, świeżości danych, podpisów kryptograficznych i odtwarzalności."
          : "Epistemic meta-metric evaluating the auditability and defensibility of generated intelligence based on consensus, freshness decay, cryptographic signatures, and replayability.",
      formula: "VDCS = 100 · (0.35·VPCS + 0.25·Q_fresh + 0.20·Q_prov + 0.20·Q_replay)",
      formulaExplanation:
        locale === "pl"
          ? "Q_fresh to wykładniczy rozpad świeżości (t_half = 3 min), Q_prov to współczynnik podpisanych paragonów dowodowych, a Q_replay to deterministyczny wynik powtórzenia obliczeń."
          : "Q_fresh is freshness decay (half-life = 3 min), Q_prov is signed receipt coverage, and Q_replay is bit-for-bit deterministic reproducibility.",
      params: [
        { name: "VPCS", desc: locale === "pl" ? "Znormalizowany wynik konsensusu providerów" : "Normalized provider consensus" },
        { name: "Q_fresh", desc: locale === "pl" ? "Współczynnik świeżości (exp(-age / 180s))" : "Freshness decay factor" },
        { name: "Q_prov", desc: locale === "pl" ? "Udział podpisanych kryptograficznie pakietów" : "Signed receipt provenance ratio" },
      ],
      presets: [
        {
          id: "preset_1",
          label: locale === "pl" ? "Instytucjonalny Dowód Live (5s opóźnienia, 100% podpisane, zweryfikowany replay)" : "Institutional Live Proof (5s age, 100% signed, verified replay)",
          compute: () => {
            const res = calculateVelmereDataConfidence({
              providerConsensusScore: 96,
              ageMs: 5000,
              signedReceiptsCount: 16,
              totalDataPoints: 16,
              deterministicReplayVerified: true,
            });
            return {
              score: res.score,
              gradeText: "INSTITUTIONAL DEFENSIBLE",
              gradeStyle: styles.gradeOptimal,
              metrics: [
                { label: locale === "pl" ? "Mnożnik Świeżości" : "Freshness Factor", value: `${res.freshnessMultiplier}` },
                { label: locale === "pl" ? "Pochodzenie Danych" : "Provenance", value: "100% Signed" },
                { label: locale === "pl" ? "Replay Hash" : "Replay Hash", value: locale === "pl" ? "Bit-for-bit zgodny" : "Bit-exact verified" },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
        {
          id: "preset_2",
          label: locale === "pl" ? "Przeterminowane dane (12 minut), rozjazd kworum i brak podpisów" : "Stale Telemetry (12 min age, broken quorum, unsigned)",
          compute: () => {
            const res = calculateVelmereDataConfidence({
              providerConsensusScore: 35,
              ageMs: 720000,
              signedReceiptsCount: 2,
              totalDataPoints: 16,
              deterministicReplayVerified: false,
            });
            return {
              score: res.score,
              gradeText: "UNTRUSTED FAIL CLOSED",
              gradeStyle: styles.gradeDanger,
              metrics: [
                { label: locale === "pl" ? "Mnożnik Świeżości" : "Freshness Factor", value: `${res.freshnessMultiplier}` },
                { label: locale === "pl" ? "Pochodzenie Danych" : "Provenance", value: "12.5% Signed" },
                { label: locale === "pl" ? "Replay Hash" : "Replay Hash", value: locale === "pl" ? "Brak spójności" : "Inconsistent" },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
      ],
      computeSandbox: () => {
        const total = 10;
        const signed = Math.round((vdcsSignedPct / 100) * total);
        const res = calculateVelmereDataConfidence({
          providerConsensusScore: vdcsConsensus,
          ageMs: vdcsAgeSec * 1000,
          signedReceiptsCount: signed,
          totalDataPoints: total,
          deterministicReplayVerified: vdcsReplayOk,
        });
        return {
          score: res.score,
          gradeText: res.score >= 80 ? "PROVEN CONFIDENCE" : res.score >= 50 ? "DEGRADED TELEMETRY" : "UNTRUSTED CIRCUIT TRIP",
          gradeStyle: res.score >= 80 ? styles.gradeOptimal : res.score >= 50 ? styles.gradeModerate : styles.gradeDanger,
          metrics: [
            { label: locale === "pl" ? "Mnożnik Świeżości" : "Freshness Factor", value: `${res.freshnessMultiplier}` },
            { label: locale === "pl" ? "Podpisane Dowody" : "Signed Receipts", value: `${vdcsSignedPct}%` },
            { label: locale === "pl" ? "Bit-exact Replay" : "Replay State", value: vdcsReplayOk ? (locale === "pl" ? "Zgodny" : "Verified") : (locale === "pl" ? "Błąd" : "Failed") },
          ],
          digest: res.evidenceDigest,
        };
      },
      limitations: [
        locale === "pl" ? "W razie aktywacji bezpiecznika Stale-Data Circuit Breaker, wynik VDCS jest natychmiast zerowany." : "In case of circuit trip, VDCS fails closed to 0.",
      ],
      benchmark:
        locale === "pl"
          ? "Żadna inna platforma rynkowa (Bloomberg, Nansen, CertiK) nie publikuje jawnego wskaźnika pewności danych z dowodem kryptograficznym per pole."
          : "No competing platform publishes an explicit epistemic confidence score with cryptographic proof per field.",
    },
    vscs: {
      code: "VSCS",
      name: "Velmère Systemic Correlation Score",
      icon: TrendingDown,
      description:
        locale === "pl"
          ? "Ocena stopnia korelacji i wrażliwości beta stóp zwrotu aktywa względem indeksów bazowych (BTC, ETH, S&P 500) w warunkach stresu rynkowego. Mierzy odporność na zarażenie systemowe."
          : "Evaluation of asset return co-movement and beta sensitivity relative to macro anchors during market stress regimes. Quantifies idiosyncratic decoupling vs contagion risk.",
      formula: "VSCS = 100 · [ 1 - min(1, max(0, r_{i,M}) · (1 + 0.5 · S_{stress})) ]",
      formulaExplanation:
        locale === "pl"
          ? "r_{i,M} to współczynnik korelacji liniowej Pearsona stóp zwrotu, a S_{stress} to wskaźnik ogólnorynkowej presji likwidacyjnej. Wartość 100 oznacza pełne odprzężenie (decoupled)."
          : "r_{i,M} is the Pearson correlation of returns, and S_{stress} is macro liquidation stress. 100 represents full idiosyncratic decoupling.",
      params: [
        { name: "r_{i,M}", desc: locale === "pl" ? "Korelacja Pearsona stóp zwrotu [-1.0, 1.0]" : "Pearson return correlation [-1.0, 1.0]" },
        { name: "Beta (β)", desc: locale === "pl" ? "Współczynnik kowariancji do wariancji benchmarku" : "Asset market beta factor" },
        { name: "S_{stress}", desc: locale === "pl" ? "Wskaźnik presji makroekonomicznej [0, 1.0]" : "Macro liquidation stress index" },
      ],
      presets: [
        {
          id: "preset_1",
          label: locale === "pl" ? "Idiosyncratyczne Aktywo Odprzężone (r = 0.04, β = 0.12, brak zarażenia)" : "Decoupled Idiosyncratic Asset (r = 0.04, β = 0.12)",
          compute: () => {
            const assetRet = [0.02, -0.01, 0.03, 0.01, -0.02, 0.04, 0.01];
            const benchRet = [-0.05, -0.04, -0.06, -0.03, -0.08, -0.02, -0.04];
            const res = calculateVelmereSystemicCorrelation({
              assetReturns: assetRet,
              benchmarkReturns: benchRet,
              marketStressIndex: 0.15,
            });
            return {
              score: res.score,
              gradeText: "DECOUPLED RESILIENT",
              gradeStyle: styles.gradeOptimal,
              metrics: [
                { label: locale === "pl" ? "Korelacja Pearsona (r)" : "Pearson Correlation (r)", value: `${res.pearsonCorrelation}` },
                { label: locale === "pl" ? "Współczynnik Beta (β)" : "Beta Factor (β)", value: `${res.betaFactor}` },
                { label: locale === "pl" ? "Wskaźnik Zarażenia" : "Contagion Index", value: `${res.contagionIndex}` },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
        {
          id: "preset_2",
          label: locale === "pl" ? "Skrajne Zarażenie Systemowe / High-Beta (r = 0.94, β = 2.45 w krachu)" : "High-Beta Systemic Contagion (r = 0.94, β = 2.45)",
          compute: () => {
            const benchRet = [-0.04, -0.05, -0.07, -0.03, -0.09, -0.06, -0.08];
            const assetRet = benchRet.map((r) => r * 2.2 + 0.005);
            const res = calculateVelmereSystemicCorrelation({
              assetReturns: assetRet,
              benchmarkReturns: benchRet,
              marketStressIndex: 0.85,
            });
            return {
              score: res.score,
              gradeText: "PURE SYSTEMIC CONTAGION",
              gradeStyle: styles.gradeDanger,
              metrics: [
                { label: locale === "pl" ? "Korelacja Pearsona (r)" : "Pearson Correlation (r)", value: `${res.pearsonCorrelation}` },
                { label: locale === "pl" ? "Współczynnik Beta (β)" : "Beta Factor (β)", value: `${res.betaFactor}` },
                { label: locale === "pl" ? "Wskaźnik Zarażenia" : "Contagion Index", value: `${res.contagionIndex}` },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
      ],
      computeSandbox: () => {
        const benchRet = [-0.03, 0.01, -0.05, -0.02, 0.04, -0.06, 0.02];
        const n = benchRet.length;
        const meanB = benchRet.reduce((sum, v) => sum + v, 0) / n;
        const devB = benchRet.map((x) => x - meanB);
        const varB = devB.reduce((sum, v) => sum + v * v, 0) / n;
        const stdB = Math.sqrt(varB) || 0.01;

        const rawO = devB.map((_, i) => Math.sin((i + 1) * 2.1));
        const meanO = rawO.reduce((sum, v) => sum + v, 0) / n;
        const devO = rawO.map((x) => x - meanO);
        const dotBO = devB.reduce((sum, b, i) => sum + b * devO[i], 0);
        const orthO = devO.map((o, i) => o - (dotBO / (n * varB)) * devB[i]);
        const varOrth = orthO.reduce((sum, o) => sum + o * o, 0) / n;
        const stdOrth = Math.sqrt(varOrth) || 0.01;

        const bNorm = devB.map((x) => x / stdB);
        const oNorm = orthO.map((x) => x / stdOrth);

        const clampedCorr = Math.max(-0.999, Math.min(0.999, vscsCorr));
        const orthWeight = Math.sqrt(Math.max(0, 1 - clampedCorr * clampedCorr));
        const scale = Math.abs(clampedCorr) > 0.05 ? vscsBeta / clampedCorr : vscsBeta;
        const assetRet = bNorm.map((b, i) => (clampedCorr * b + orthWeight * oNorm[i]) * stdB * Math.max(0.01, scale));

        const res = calculateVelmereSystemicCorrelation({
          assetReturns: assetRet,
          benchmarkReturns: benchRet,
          marketStressIndex: vscsStress,
        });
        return {
          score: res.score,
          gradeText: res.score >= 75 ? "DECOUPLED ASSET" : res.score >= 45 ? "MODERATE BETA" : "CONTAGION VULNERABLE",
          gradeStyle: res.score >= 75 ? styles.gradeOptimal : res.score >= 45 ? styles.gradeModerate : styles.gradeDanger,
          metrics: [
            { label: locale === "pl" ? "Korelacja (r)" : "Correlation (r)", value: `${res.pearsonCorrelation}` },
            { label: locale === "pl" ? "Beta (β)" : "Beta (β)", value: `${res.betaFactor}` },
            { label: locale === "pl" ? "Indeks Zarażenia" : "Contagion Index", value: `${res.contagionIndex}` },
          ],
          digest: res.evidenceDigest,
        };
      },
      limitations: [
        locale === "pl" ? "Wymaga spójnych kwotowań stóp zwrotu w identycznych interwałach czasowych." : "Requires synchronized return intervals.",
        locale === "pl" ? "W reżimach braku płynności korelacja jest sztucznie zaniżona (efekt stale price)." : "Illiquid assets display artificially low correlation (stale pricing).",
      ],
      benchmark:
        locale === "pl"
          ? "Tradycyjna analiza finansowa podaje pojedynczy wskaźnik Beta. VSCS modeluje dynamiczną asymetrię spadków i karze aktywa, których korelacja skokowo rośnie podczas paniki rynkowej."
          : "Traditional models report a single beta. VSCS accounts for crash asymmetry and contagion spikes under liquidity stress.",
    },
    vlds: {
      code: "VLDS",
      name: "Velmère Liquidity Drawdown Shock",
      icon: Zap,
      description:
        locale === "pl"
          ? "Symulacja wyczerpania arkusza ofert kupna (bids) w wyniku sekwencyjnych zleceń sprzedaży bez dopływu świeżej płynności od animatorów rynku. Wyznacza odporność na kaskadowy flash crash."
          : "Sequential sell cascade exhaustion simulation evaluating order book collapse threshold when market makers withhold replenishment. Computes true flash crash vulnerability.",
      formula: "VLDS = 100 · exp(-Δ_{drawdown} / 15) · (1 - 0.70 · E_{exhausted})",
      formulaExplanation:
        locale === "pl"
          ? "Δ_{drawdown} to łączny spadek ceny po N falach zrzutu kapitału, a E_{exhausted} to wskaźnik całkowitego opróżnienia arkusza ofert przed zakończeniem symulacji."
          : "Δ_{drawdown} is cumulative price drop across cascade rounds, and E_{exhausted} penalizes total bid depletion.",
      params: [
        { name: "Cascade Count", desc: locale === "pl" ? "Liczba fal uderzeń kapitałowych (np. 5x)" : "Sequential liquidation cascade rounds" },
        { name: "Order Size", desc: locale === "pl" ? "Wolumen pojedynczej fali ($10k - $250k)" : "Order size per cascade round" },
        { name: "Replenish Rate", desc: locale === "pl" ? "Współczynnik odnawiania płynności między krokami" : "Inter-tick depth replenishment rate" },
      ],
      presets: [
        {
          id: "preset_1",
          label: locale === "pl" ? "Głęboki Orderbook BTC/USDT (5 fal x $50k, spadek < 1.4%)" : "Deep BTC/USDT Orderbook (5 waves x $50k, drawdown < 1.4%)",
          compute: () => {
            const bids = [
              { price: 65400, quantity: 20 },
              { price: 65300, quantity: 30 },
              { price: 65100, quantity: 50 },
              { price: 64800, quantity: 100 },
            ];
            const res = calculateVelmereLiquidityDrawdownShock({
              bids,
              cascadeOrderCount: 5,
              orderSizeUsd: 50000,
              replenishmentRatePct: 15,
            });
            return {
              score: res.score,
              gradeText: "CASCADE RESISTANT",
              gradeStyle: styles.gradeOptimal,
              metrics: [
                { label: locale === "pl" ? "Łączny Drawdown" : "Total Drawdown", value: `${res.cumulativeDrawdownPct}%` },
                { label: locale === "pl" ? "Średni Poślizg" : "Mean Slippage", value: `${res.averageExecutionSlippagePct}%` },
                { label: locale === "pl" ? "Wyczerpanie Arkusza" : "Exhaustion Step", value: res.exhaustionStep ? `Krok ${res.exhaustionStep}` : (locale === "pl" ? "Brak (Przetrwał)" : "Survived") },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
        {
          id: "preset_2",
          label: locale === "pl" ? "Cienki Basen DEX (Wyczerpanie ofert kupna już przy 2. fali, spadek > 40%)" : "Thin DEX Pool (Depletion at wave 2, drawdown > 40%)",
          compute: () => {
            const bids = [
              { price: 1.0, quantity: 15000 },
              { price: 0.92, quantity: 10000 },
            ];
            const res = calculateVelmereLiquidityDrawdownShock({
              bids,
              cascadeOrderCount: 5,
              orderSizeUsd: 25000,
              replenishmentRatePct: 0,
            });
            return {
              score: res.score,
              gradeText: "FLASH CRASH COLLAPSE",
              gradeStyle: styles.gradeDanger,
              metrics: [
                { label: locale === "pl" ? "Łączny Drawdown" : "Total Drawdown", value: `${res.cumulativeDrawdownPct}%` },
                { label: locale === "pl" ? "Średni Poślizg" : "Mean Slippage", value: `${res.averageExecutionSlippagePct}%` },
                { label: locale === "pl" ? "Wyczerpanie Arkusza" : "Exhaustion Step", value: `Krok ${res.exhaustionStep} (Total)` },
              ],
              digest: res.evidenceDigest,
            };
          },
        },
      ],
      computeSandbox: () => {
        const bids = [
          { price: 100, quantity: 500 },
          { price: 98, quantity: 800 },
          { price: 95, quantity: 1200 },
          { price: 90, quantity: 2000 },
          { price: 82, quantity: 3000 },
        ];
        const res = calculateVelmereLiquidityDrawdownShock({
          bids,
          cascadeOrderCount: vldsWaves,
          orderSizeUsd: vldsWaveSize,
          replenishmentRatePct: vldsReplenish,
        });
        return {
          score: res.score,
          gradeText: res.score >= 75 ? "SHOCK RESILIENT" : res.score >= 40 ? "SEVERE SLIPPAGE" : "COLLAPSE THRESHOLD",
          gradeStyle: res.score >= 75 ? styles.gradeOptimal : res.score >= 40 ? styles.gradeModerate : styles.gradeDanger,
          metrics: [
            { label: locale === "pl" ? "Drawdown Kaskadowy" : "Cascade Drawdown", value: `${res.cumulativeDrawdownPct}%` },
            { label: locale === "pl" ? "Średni Poślizg" : "Mean Slippage", value: `${res.averageExecutionSlippagePct}%` },
            { label: locale === "pl" ? "Wyczerpanie Arkusza" : "Book Exhaustion", value: res.exhaustionStep ? `Krok ${res.exhaustionStep}` : (locale === "pl" ? "Przetrwał" : "Survived") },
          ],
          digest: res.evidenceDigest,
        };
      },
      limitations: [
        locale === "pl" ? "Model symuluje wycofanie się animatorów rynku podczas sekwencyjnego dumpu." : "Simulates maker withdrawal during sequential dump cascades.",
      ],
      benchmark:
        locale === "pl"
          ? "Żadna publiczna platforma analityczna nie oferuje otwartego symulatora kaskadowego drenażu płynności. VLDS stanowi standard instytucjonalnego stress-testu dla funduszy DeFi i animatorów rynku."
          : "No public competitor offers open sequential cascade stress-testing. VLDS establishes an institutional standard.",
    },
  };

  const currentAlgo = algorithms[activeAlgo];

  // Compute based on mode
  const computed =
    mode === "presets"
      ? (currentAlgo.presets.find((p) => p.id === activePreset) ?? currentAlgo.presets[0]).compute()
      : currentAlgo.computeSandbox();

  return (
    <section className={styles.container} aria-labelledby="proprietary-algos-title">
      <div className={styles.header}>
        <div className={styles.eyebrow}>
          <Activity size={13} aria-hidden="true" />
          <span>
            {locale === "pl"
              ? "Autorskie Modele Matematyczne · Velmère Quantitative Labs (Wersja v2)"
              : "Proprietary Quantitative Models · Velmère Labs (Version v2)"}
          </span>
        </div>
        <h2 id="proprietary-algos-title" className={styles.title}>
          {locale === "pl"
            ? "8 Własnych Algorytmów Wyceny Ryzyka i Prawdy Rynkowej"
            : "8 Proprietary Quantitative & Security Risk Algorithms"}
        </h2>
        <p className={styles.subtitle}>
          {locale === "pl"
            ? "Zamiast powielać powierzchowne wskaźniki konkurencji, Velmère wyprowadza formalne modele odporne na manipulacje płynnością, split-brain providerów, kaskady wyprzedaży i ukryte uprawnienia smart kontraktów."
            : "Rather than repeating shallow competitor metrics, Velmère derives formal mathematical models resilient against liquidity spoofing, provider split-brain, cascading flash crashes, and smart contract centralization."}
        </p>
      </div>

      <nav className={styles.navTabs} aria-label="Wybór algorytmu badawczego">
        {(Object.keys(algorithms) as AlgoKey[]).map((key) => {
          const algo = algorithms[key];
          const Icon = algo.icon;
          const isActive = activeAlgo === key;
          return (
            <button
              key={key}
              type="button"
              className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ""}`}
              onClick={() => {
                setActiveAlgo(key);
                setActivePreset("preset_1");
              }}
            >
              <Icon size={14} aria-hidden="true" />
              <span className={styles.tabCode}>{algo.code}</span>
              <span>{algo.name.split(" ")[1] ?? algo.code}</span>
            </button>
          );
        })}
      </nav>

      <article className={styles.algorithmCard}>
        <div className={styles.algoMetaGrid}>
          <div>
            <div className={styles.algoHeader}>
              <h3 className={styles.algoName}>{currentAlgo.name}</h3>
              <p className={styles.algoDescription}>{currentAlgo.description}</p>
            </div>

            <div className={styles.formulaBox}>
              <div className={styles.formulaLabel}>
                {locale === "pl" ? "Formuła Matematyczna" : "Mathematical Formula"}
              </div>
              <div className={styles.formulaCode}>{currentAlgo.formula}</div>
              <p style={{ fontSize: "0.8rem", color: "#b0b6b2", marginTop: "0.75rem", lineHeight: 1.6 }}>
                {currentAlgo.formulaExplanation}
              </p>
              <div className={styles.paramsList}>
                {currentAlgo.params.map((p) => (
                  <div key={p.name} className={styles.paramItem}>
                    <strong>{p.name}</strong>: {p.desc}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.comparisonSection}>
              <div className={styles.compBlock}>
                <h4>{locale === "pl" ? "Ograniczenia i Założenia" : "Limitations & Assumptions"}</h4>
                <ul className={styles.limitationsList}>
                  {currentAlgo.limitations.map((lim, i) => (
                    <li key={i}>{lim}</li>
                  ))}
                </ul>
              </div>
              <div className={styles.compBlock}>
                <h4>{locale === "pl" ? "Przewaga nad Benchmarkiem Rynkowym" : "Market Benchmark Advantage"}</h4>
                <p>{currentAlgo.benchmark}</p>
              </div>
            </div>
          </div>

          <aside className={styles.simulatorPanel}>
            <div className={styles.simTitle}>
              <span>{locale === "pl" ? "Silnik Kalkulacyjny" : "Calculation Engine"}</span>
              <span style={{ color: "var(--lab-cyan, #9ad8cf)" }}>LIVE RUNTIME</span>
            </div>

            {/* Mode Switcher: Presets vs Live Sandbox */}
            <div className={styles.modeToggleGroup}>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === "presets" ? styles.modeBtnActive : ""}`}
                onClick={() => setMode("presets")}
              >
                {locale === "pl" ? "Scenariusze Wzorcowe" : "Curated Scenarios"}
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === "sandbox" ? styles.modeBtnActive : ""}`}
                onClick={() => setMode("sandbox")}
              >
                <Sliders size={12} aria-hidden="true" />
                {locale === "pl" ? "Live Sandbox" : "Live Sandbox"}
              </button>
            </div>

            {mode === "presets" ? (
              <div className={styles.presetGroup}>
                {currentAlgo.presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`${styles.presetBtn} ${activePreset === preset.id ? styles.presetBtnActive : ""}`}
                    onClick={() => setActivePreset(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.sandboxContainer}>
                {activeAlgo === "vpcs" && (
                  <>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Rozrzut Cenowy (WMAD):</span>
                        <span className={styles.controlValue}>{vpcsSpread.toFixed(2)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.01"
                        max="8.0"
                        step="0.05"
                        value={vpcsSpread}
                        onChange={(e) => setVpcsSpread(parseFloat(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Opóźnienie Czasowe:</span>
                        <span className={styles.controlValue}>{vpcsLatency} ms</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="5000"
                        step="50"
                        value={vpcsLatency}
                        onChange={(e) => setVpcsLatency(parseInt(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Liczba Niezależnych Źródeł:</span>
                        <span className={styles.controlValue}>{vpcsProviders}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={vpcsProviders}
                        onChange={(e) => setVpcsProviders(parseInt(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                  </>
                )}

                {activeAlgo === "vlsi" && (
                  <>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Mnożnik Płynności Księgi:</span>
                        <span className={styles.controlValue}>{vlsiDepthMultiplier.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="3.0"
                        step="0.1"
                        value={vlsiDepthMultiplier}
                        onChange={(e) => setVlsiDepthMultiplier(parseFloat(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                  </>
                )}

                {activeAlgo === "vgpi" && (
                  <>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Właściciel Kontraktu:</span>
                        <span className={styles.controlValue}>{vgpiOwner.toUpperCase()}</span>
                      </div>
                      <div className={styles.toggleRow}>
                        {(["renounced", "multisig", "eoa"] as const).map((o) => (
                          <button
                            key={o}
                            type="button"
                            className={`${styles.toggleOption} ${vgpiOwner === o ? styles.toggleOptionActive : ""}`}
                            onClick={() => setVgpiOwner(o)}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Uprawnienia Krytyczne:</span>
                        <span className={styles.controlValue}>{vgpiPrivileges} / 5</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="1"
                        value={vgpiPrivileges}
                        onChange={(e) => setVgpiPrivileges(parseInt(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Timelock Delay:</span>
                        <span className={styles.controlValue}>{vgpiTimelock} h</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="72"
                        step="6"
                        value={vgpiTimelock}
                        onChange={(e) => setVgpiTimelock(parseInt(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                  </>
                )}

                {activeAlgo === "vofs" && (
                  <>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Mechanizm Wyroczni:</span>
                        <span className={styles.controlValue}>{vofsMechanism.toUpperCase()}</span>
                      </div>
                      <div className={styles.toggleRow}>
                        {(["twap", "short_twap", "spot"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={`${styles.toggleOption} ${vofsMechanism === m ? styles.toggleOptionActive : ""}`}
                            onClick={() => setVofsMechanism(m)}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Heartbeat Wyroczni:</span>
                        <span className={styles.controlValue}>{vofsHeartbeat}s</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="1800"
                        step="30"
                        value={vofsHeartbeat}
                        onChange={(e) => setVofsHeartbeat(parseInt(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Koszt Ataku 2%:</span>
                        <span className={styles.controlValue}>${(vofsManipCost / 1000).toLocaleString()}k</span>
                      </div>
                      <input
                        type="range"
                        min="50000"
                        max="10000000"
                        step="100000"
                        value={vofsManipCost}
                        onChange={(e) => setVofsManipCost(parseInt(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                  </>
                )}

                {activeAlgo === "ver" && (
                  <>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Podatek Sprzedaży:</span>
                        <span className={styles.controlValue}>{verSellTax}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        step="1"
                        value={verSellTax}
                        onChange={(e) => setVerSellTax(parseInt(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Płynność Zablokowana:</span>
                        <span className={styles.controlValue}>{verLpLocked}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={verLpLocked}
                        onChange={(e) => setVerLpLocked(parseInt(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Koncentracja Top 10:</span>
                        <span className={styles.controlValue}>{verWhaleConc}%</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="95"
                        step="5"
                        value={verWhaleConc}
                        onChange={(e) => setVerWhaleConc(parseInt(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                  </>
                )}

                {activeAlgo === "vdcs" && (
                  <>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Konsensus Źródeł (VPCS):</span>
                        <span className={styles.controlValue}>{vdcsConsensus} / 100</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={vdcsConsensus}
                        onChange={(e) => setVdcsConsensus(parseInt(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Wiek Danych (Świeżość):</span>
                        <span className={styles.controlValue}>{vdcsAgeSec}s</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="600"
                        step="10"
                        value={vdcsAgeSec}
                        onChange={(e) => setVdcsAgeSec(parseInt(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Podpisane Dowody:</span>
                        <span className={styles.controlValue}>{vdcsSignedPct}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="10"
                        value={vdcsSignedPct}
                        onChange={(e) => setVdcsSignedPct(parseInt(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                  </>
                )}

                {activeAlgo === "vscs" && (
                  <>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Korelacja Pearsona (r):</span>
                        <span className={styles.controlValue}>{vscsCorr.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="-1.0"
                        max="1.0"
                        step="0.05"
                        value={vscsCorr}
                        onChange={(e) => setVscsCorr(parseFloat(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Współczynnik Beta (β):</span>
                        <span className={styles.controlValue}>{vscsBeta.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="3.0"
                        step="0.1"
                        value={vscsBeta}
                        onChange={(e) => setVscsBeta(parseFloat(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Stres Rynkowy (S_stress):</span>
                        <span className={styles.controlValue}>{vscsStress.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={vscsStress}
                        onChange={(e) => setVscsStress(parseFloat(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                  </>
                )}

                {activeAlgo === "vlds" && (
                  <>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Liczba Fal Kaskady:</span>
                        <span className={styles.controlValue}>{vldsWaves}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={vldsWaves}
                        onChange={(e) => setVldsWaves(parseInt(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Wolumen Fali:</span>
                        <span className={styles.controlValue}>${(vldsWaveSize / 1000).toFixed(0)}k</span>
                      </div>
                      <input
                        type="range"
                        min="10000"
                        max="200000"
                        step="10000"
                        value={vldsWaveSize}
                        onChange={(e) => setVldsWaveSize(parseInt(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                    <div className={styles.controlGroup}>
                      <div className={styles.controlLabelRow}>
                        <span className={styles.controlLabel}>Odnawianie Płynności:</span>
                        <span className={styles.controlValue}>{vldsReplenish}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        step="5"
                        value={vldsReplenish}
                        onChange={(e) => setVldsReplenish(parseInt(e.target.value))}
                        className={styles.sliderInput}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Live Calculated Output */}
            <div className={styles.scoreOutput}>
              <span
                style={{
                  fontSize: "0.6rem",
                  color: "rgba(240,241,237,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                }}
              >
                {locale === "pl" ? "Wyliczona Wartość Indeksu" : "Calculated Index Output"}
              </span>
              <div className={styles.scoreNumber}>{computed.score}</div>

              {/* Animated progress meter */}
              <div className={styles.meterBar}>
                <div
                  className={styles.meterFill}
                  style={{
                    width: `${computed.score}%`,
                    backgroundColor:
                      computed.score >= 75 ? "var(--lab-cyan, #9ad8cf)" : computed.score >= 45 ? "var(--lab-gold, #d2bc8e)" : "#f87171",
                  }}
                />
              </div>

              <div className={`${styles.scoreGrade} ${computed.gradeStyle}`}>{computed.gradeText}</div>

              <div
                style={{
                  marginTop: "1.5rem",
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: "0.5rem",
                  textAlign: "left",
                }}
              >
                {computed.metrics.map((m) => (
                  <div
                    key={m.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.74rem",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      paddingBottom: "0.35rem",
                    }}
                  >
                    <span style={{ color: "#858b87" }}>{m.label}</span>
                    <strong style={{ color: "#f0f1ed", fontFamily: "var(--font-mono, monospace)" }}>
                      {m.value}
                    </strong>
                  </div>
                ))}
              </div>

              <div className={styles.digestRow}>
                <div>SHA-256 Digest: {computed.digest.slice(0, 24)}...</div>
                <button
                  type="button"
                  className={`${styles.copyDigestBtn} ${copiedDigest ? styles.copyDigestBtnCopied : ""}`}
                  onClick={() => handleCopyDigest(computed.digest)}
                >
                  {copiedDigest ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedDigest ? (locale === "pl" ? "Skopiowano" : "Copied") : (locale === "pl" ? "Kopiuj Dowód SHA-256" : "Copy Proof SHA-256")}</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </article>
    </section>
  );
}
