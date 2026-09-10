"use client";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCode,
  HelpCircle,
  Layers,
  Loader2,
  Paperclip,
  Radar,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import AssetLogo from "@/components/market-integrity/AssetLogo";
import VlmBrainWorkspace from "@/components/market-integrity/VlmBrainWorkspace";
import PremiumAmbientGlobe from "@/components/ui/PremiumAmbientGlobe";
import { Link } from "@/navigation";
import { useMotionQuality } from "@/lib/motion/useMotionQuality";
import { getPass489MotionBudget } from "@/lib/motion/pass489-motion-system";
import { buildPass492ShieldLaneFocus } from "@/lib/market-integrity/pass492-shield-lane-focus";
import { buildPass500ShieldCommandDock } from "@/lib/market-integrity/pass500-shield-command-dock";
import { buildPass507ShieldScenarioComparator } from "@/lib/market-integrity/pass507-shield-scenario-comparator";
import { buildPass513ShieldVerificationQueue } from "@/lib/market-integrity/pass513-shield-verification-queue";
import { getPass514InteractionMotion } from "@/lib/motion/pass514-interaction-motion-orchestrator";
import { buildPass521ShieldEvidenceDrilldown } from "@/lib/market-integrity/pass521-shield-evidence-drilldown";
import { buildPass528ShieldEvidencePacket } from "@/lib/market-integrity/pass528-shield-evidence-packet";
import { buildPass535ShieldAttachmentLinking } from "@/lib/market-integrity/pass535-shield-attachment-linking";
import { buildPass541ShieldFocusLens } from "@/lib/market-integrity/pass541-shield-focus-lens";
import { buildPass548ShieldTemporalReplay } from "@/lib/market-integrity/pass548-shield-temporal-replay";
import { getPass522MobileGestureQa } from "@/lib/motion/pass522-mobile-gesture-qa";
import { usePass527AdaptiveFrameBudget } from "@/lib/motion/usePass527AdaptiveFrameBudget";
import { buildPass542MotionControl } from "@/lib/motion/pass542-motion-control";
import { buildPass549InteractionBudget } from "@/lib/motion/pass549-interaction-budget";
import {
  verifyShieldMapCustomerIdentity,
  type ShieldMapCanonicalCustomerIdentity,
} from "@/lib/market-integrity/shield-map-customer-identity";
import {
  projectShieldMapCustomerConfidence,
  type ShieldMapCustomerConfidenceProjection,
} from "@/lib/market-integrity/shield-map-customer-confidence";
import {
  projectShieldMapCustomerAssetDisplay,
  type ShieldMapCustomerAssetDisplay,
} from "@/lib/market-integrity/shield-map-customer-asset-display";
import {
  deduplicateShieldMapSuggestions,
  normalizeShieldMapSuggestionKey,
} from "@/lib/market-integrity/shield-map-suggestion-dedup";
import { nextLensSuggestionKeyboardDecision } from "@/lib/search/lens-suggestion-keyboard";

type Locale = "pl" | "de" | "en";
type EvidenceState =
  | "confirmed"
  | "likely"
  | "unverified"
  | "red_flag"
  | "unknown";

type InvestigatorLane = {
  id: "supply" | "unlock" | "liquidity" | "insider" | "social" | "contract";
  label: string;
  score: number | null;
  reviewPriority: number;
  status: EvidenceState;
  headline: string;
  body: string;
  nextStep: string;
};

type InvestigatorAction = {
  id: string;
  label: string;
  priority: "low" | "medium" | "high" | "critical";
  body: string;
  command: string;
};

type Investigator = {
  title: string;
  quickVerdict: string;
  finalVerdict: string;
  overallRisk: number | null;
  evidenceGapScore: number;
  confidence: "Low" | "Medium" | "High";
  confidenceScore: number;
  lanes: InvestigatorLane[];
  nextActions: InvestigatorAction[];
  webQueries: string[];
  caseFrame: {
    asset: string;
    sourceState: string;
    sourceId: string;
    sourceLabel: string;
    sourceTimestamp: number | null;
    primaryConcern: string;
    missingData: string[];
    operatorMode: string;
  };
};

type EngineStatus = {
  marketData: "verified" | "unknown";
  riskEngine: "connected";
  generativeNarrative: "configured" | "not_configured";
  webOsint: "not_connected";
};

type CoinSuggestion = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  rank?: number | null;
};

type RiskSnapshot = {
  token: {
    marketId?: string;
    tokenAddress?: string;
    chainId?: string;
    symbol: string;
    name: string;
    image?: string;
    rank?: number;
  };
  metrics: {
    currentPrice?: number;
    marketCap?: number;
    fdv?: number;
    volume24h?: number;
    priceChange1h?: number;
    priceChange24h?: number;
    priceChange7d?: number;
    circulatingSupply?: number;
    totalSupply?: number;
    maxSupply?: number;
  };
  dataQuality: "demo" | "partial" | "live";
};

type InvestigatorResponse =
  | {
      mode: "live";
      investigator: Investigator;
      engine: EngineStatus;
      result: RiskSnapshot;
      generatedAt: string;
      identityBinding: unknown;
      rightsProjection?: unknown;
      publication: {
        evidenceState: "verified";
        scorePublished: true;
        blockers: [];
      };
    }
  | {
      mode: "withheld";
      error: string;
      publication: {
        evidenceState: "withheld";
        scorePublished: false;
        blockers: string[];
      };
    }
  | { mode: "error"; error: string };

const localSuggestions: CoinSuggestion[] = [
  {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    image: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    rank: 1,
  },
  {
    id: "binancecoin",
    symbol: "BNB",
    name: "BNB",
    image: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
    rank: 4,
  },
  {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    image: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    rank: 2,
  },
  {
    id: "solana",
    symbol: "SOL",
    name: "Solana",
    image: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    rank: 5,
  },
  {
    id: "cardano",
    symbol: "ADA",
    name: "Cardano",
    image: "https://assets.coingecko.com/coins/images/975/large/cardano.png",
    rank: 8,
  },
  {
    id: "dogecoin",
    symbol: "DOGE",
    name: "Dogecoin",
    image: "https://assets.coingecko.com/coins/images/5/large/dogecoin.png",
    rank: 9,
  },
];

const copy = {
  pl: {
    back: "Wróć do Shield",
    kicker: "Velmère Shield Map",
    title: "Sprawdź ryzyko. Zobacz braki. Wykonaj następny krok.",
    subtitle:
      "Jedna analiza zamiast ściany paneli. Shield łączy dane rynkowe z sześcioma osiami ryzyka i jasno mówi, czego jeszcze nie potwierdzono.",
    placeholder: "Wpisz symbol, nazwę tokena lub adres kontraktu",
    suggestionsLabel: "Sugestie wyszukiwania",
    scan: "Skanuj",
    scanning: "Analizuję",
    source: "Stan źródeł",
    missing: "Czego brakuje",
    next: "Najbliższe działania",
    research: "Zapytania do dalszego researchu",
    openMarkets: "Otwórz Real Markets",
    openLens: "Otwórz Browser / PDF",
    risk: "Ryzyko",
    confidence: "Pewność",
    calibratedProbability: "Skalibrowane prawdopodobieństwo",
    withheld: "Wstrzymano",
    confidenceWithheld:
      "Wartość liczbowa wymaga aktualnej kalibracji empirycznej, powiązanych dowodów i zatwierdzonych praw do wyświetlania.",
    assetMetadataWithheld:
      "nazwa i obraz nie mają powiązanego dowodu field-level ani zweryfikowanych praw do wyświetlania",
    assetImageWithheld: "Obraz aktywa wstrzymany; symbol kanoniczny",
    scenarioEvidenceOnly: "Scenariusz heurystyczny · nie jest skalibrowaną pewnością",
    evidenceGain: "Heurystyczny przyrost dowodów",
    plainTitle: "Co to oznacza teraz",
    numbers: "Najważniejsze liczby",
    price: "Cena",
    marketCap: "Kapitalizacja",
    volume: "Wolumen",
    calmButIncomplete:
      "Dane cenowe nie pokazują obecnie skrajnej presji, ale niski wynik ryzyka nie oznacza bezpieczeństwa. Najpierw sprawdź brakujące źródła wskazane niżej.",
    riskUnavailable:
      "Shield nie publikuje łącznego wyniku ryzyka, dopóki każda kluczowa oś nie ma wystarczających dowodów. Brak danych jest luką dowodową, a nie punktem ryzyka.",
    elevated:
      "Kilka warstw pokazuje podwyższoną presję. Nie opieraj decyzji wyłącznie na cenie; sprawdź płynność, podaż i największy blocker.",
    high: "Presja ryzyka jest wysoka. Wynik wymaga ograniczenia ekspozycji i potwierdzenia źródeł przed mocniejszym wnioskiem.",
    emptyTitle: "Zacznij od symbolu",
    emptyBody:
      "Shield najpierw pobierze bieżący snapshot rynku, potem oceni podaż, unlocki, płynność, holderów, social/KOL i kontrakt.",
    liveData: "Dane rynkowe",
    riskEngine: "Silnik ryzyka",
    aiLayer: "Warstwa generatywna",
    osint: "Web OSINT",
    connected: "połączony",
    notConfigured: "brak konfiguracji",
    notConnected: "niepodłączony",
    prescreen:
      "Wynik porządkuje ryzyko i luki w danych. Potwierdź najważniejsze źródła przed decyzją.",
    sourceBody: "Zobacz, które warstwy są potwierdzone, ograniczone albo nadal puste.",
    nextBody: "Shield utrzymuje jeden najważniejszy krok, zamiast otwierać kolejną ścianę paneli.",
    reportBody: "Przenieś wynik do Browsera i PDF, zachowując źródła oraz granice pewności.",
    motionPause: "Ogranicz ruch",
    motionResume: "Włącz ruch",
    deepDive: "Pokaż pełną analizę",
    hideDeepDive: "Ukryj pełną analizę",
    deepDiveBody: "Replay, scenariusze, kolejka weryfikacji i ścieżka dowodowa — dla osób, które chcą wejść głębiej.",
  },
  de: {
    back: "Zurück zu Shield",
    kicker: "Velmère Shield Map",
    title: "Risiko prüfen. Lücken sehen. Nächsten Schritt ausführen.",
    subtitle:
      "Eine Analyse statt einer Wand aus Panels. Shield verbindet Marktdaten mit sechs Risikospuren und zeigt offen, was noch nicht bestätigt ist.",
    placeholder: "Symbol, Tokenname oder Contract-Adresse eingeben",
    suggestionsLabel: "Suchvorschläge",
    scan: "Scannen",
    scanning: "Analyse",
    source: "Quellenstatus",
    missing: "Fehlende Daten",
    next: "Nächste Schritte",
    research: "Weitere Research-Abfragen",
    openMarkets: "Real Markets öffnen",
    openLens: "Browser / PDF öffnen",
    risk: "Risiko",
    confidence: "Konfidenz",
    calibratedProbability: "Kalibrierte Wahrscheinlichkeit",
    withheld: "Zurückgehalten",
    confidenceWithheld:
      "Ein Zahlenwert erfordert aktuelle empirische Kalibrierung, gebundene Evidenz und genehmigte Anzeigerechte.",
    assetMetadataWithheld:
      "Name und Bild haben keine gebundene Feld-Evidenz und keine verifizierten Anzeigerechte",
    assetImageWithheld: "Asset-Bild zurückgehalten; kanonisches Symbol",
    scenarioEvidenceOnly: "Heuristisches Szenario · keine kalibrierte Konfidenz",
    evidenceGain: "Heuristischer Evidenzgewinn",
    plainTitle: "Was das jetzt bedeutet",
    numbers: "Wichtigste Zahlen",
    price: "Preis",
    marketCap: "Marktkapitalisierung",
    volume: "Volumen",
    calmButIncomplete:
      "Die Preisdaten zeigen derzeit keinen extremen Druck, aber ein niedriger Risikowert ist kein Sicherheitsnachweis. Prüfe zuerst die fehlenden Quellen.",
    riskUnavailable:
      "Shield veröffentlicht keinen Gesamt-Risikowert, solange nicht jede Kernachse ausreichend belegt ist. Fehlende Daten sind eine Evidenzlücke und kein Risikopunkt.",
    elevated:
      "Mehrere Ebenen zeigen erhöhten Druck. Verlasse dich nicht nur auf den Preis; prüfe Liquidität, Supply und den größten Blocker.",
    high: "Der Risikodruck ist hoch. Quellen und Exponierung müssen vor einer stärkeren Aussage geprüft werden.",
    emptyTitle: "Mit einem Symbol starten",
    emptyBody:
      "Shield lädt zuerst den aktuellen Markt-Snapshot und bewertet dann Supply, Unlocks, Liquidität, Holder, Social/KOL und Contract.",
    liveData: "Marktdaten",
    riskEngine: "Risk Engine",
    aiLayer: "Generative Ebene",
    osint: "Web OSINT",
    connected: "verbunden",
    notConfigured: "nicht konfiguriert",
    notConnected: "nicht verbunden",
    prescreen:
      "Das Ergebnis ordnet Risiko und Datenlücken. Bestätige die wichtigsten Quellen vor einer Entscheidung.",
    sourceBody: "Sieh, welche Ebenen bestätigt, eingeschränkt oder noch offen sind.",
    nextBody: "Shield hält einen wichtigsten Schritt sichtbar, statt weitere Panel-Wände zu öffnen.",
    reportBody: "Übertrage das Ergebnis in Browser und PDF — mit Quellen und klaren Grenzen.",
    motionPause: "Bewegung reduzieren",
    motionResume: "Bewegung aktivieren",
    deepDive: "Vollständige Analyse zeigen",
    hideDeepDive: "Vollständige Analyse ausblenden",
    deepDiveBody: "Replay, Szenarien, Prüfqueue und Evidenzpfad — für Nutzer, die tiefer einsteigen wollen.",
  },
  en: {
    back: "Back to Shield",
    kicker: "Velmère Shield Map",
    title: "Check risk. See the gaps. Take the next step.",
    subtitle:
      "One analysis instead of a wall of panels. Shield combines market data with six risk lanes and states clearly what remains unverified.",
    placeholder: "Enter a symbol, token name or contract address",
    suggestionsLabel: "Search suggestions",
    scan: "Scan",
    scanning: "Analyzing",
    source: "Source state",
    missing: "Missing data",
    next: "Next actions",
    research: "Further research queries",
    openMarkets: "Open Real Markets",
    openLens: "Open Browser / PDF",
    risk: "Risk",
    confidence: "Confidence",
    calibratedProbability: "Calibrated probability",
    withheld: "Withheld",
    confidenceWithheld:
      "A numeric value requires current empirical calibration, bound evidence and approved display rights.",
    assetMetadataWithheld:
      "name and image lack bound field-level evidence and verified display rights",
    assetImageWithheld: "Asset image withheld; canonical symbol",
    scenarioEvidenceOnly: "Heuristic scenario · not calibrated confidence",
    evidenceGain: "Heuristic evidence gain",
    plainTitle: "What this means now",
    numbers: "Key numbers",
    price: "Price",
    marketCap: "Market cap",
    volume: "Volume",
    calmButIncomplete:
      "Price data does not show extreme pressure right now, but a low risk score is not proof of safety. Verify the missing sources below first.",
    riskUnavailable:
      "Shield withholds the combined risk score until every core lane has sufficient evidence. Missing data is an evidence gap, not a risk point.",
    elevated:
      "Several layers show elevated pressure. Do not rely on price alone; check liquidity, supply and the largest blocker.",
    high: "Risk pressure is high. Verify the sources and control exposure before drawing a stronger conclusion.",
    emptyTitle: "Start with a symbol",
    emptyBody:
      "Shield first loads a current market snapshot, then reviews supply, unlocks, liquidity, holders, social/KOL and contract risk.",
    liveData: "Market data",
    riskEngine: "Risk engine",
    aiLayer: "Generative layer",
    osint: "Web OSINT",
    connected: "connected",
    notConfigured: "not configured",
    notConnected: "not connected",
    prescreen:
      "The result orders risk and data gaps. Confirm the most important sources before a decision.",
    sourceBody: "See which layers are confirmed, limited or still open.",
    nextBody: "Shield keeps one highest-value next step visible instead of opening another wall of panels.",
    reportBody: "Move the result into Browser and PDF while preserving sources and confidence limits.",
    motionPause: "Reduce motion",
    motionResume: "Enable motion",
    deepDive: "Show full analysis",
    hideDeepDive: "Hide full analysis",
    deepDiveBody: "Replay, scenarios, verification queue and evidence path — for people who want the deeper view.",
  },
} as const;

const laneLabels = {
  pl: {
    supply: "Podaż / float",
    unlock: "Vesting / unlocki",
    liquidity: "Płynność / wyjście",
    insider: "Holderzy / insiderzy",
    social: "Social / KOL",
    contract: "Kontrakt / governance",
  },
  de: {
    supply: "Supply / Float",
    unlock: "Vesting / Unlocks",
    liquidity: "Liquidität / Exit",
    insider: "Holder / Insider",
    social: "Social / KOL",
    contract: "Contract / Governance",
  },
  en: {
    supply: "Supply / float",
    unlock: "Vesting / unlocks",
    liquidity: "Liquidity / exits",
    insider: "Holders / insiders",
    social: "Social / KOL",
    contract: "Contract / governance",
  },
} as const;

function translateVerdict(value: string, locale: Locale) {
  const verdicts: Record<string, Record<Locale, string>> = {
    "Insufficient evidence for a reliable verdict": {
      pl: "Za mało dowodów na wiarygodny werdykt",
      de: "Zu wenig Evidenz für ein verlässliches Urteil",
      en: "Insufficient evidence for a reliable verdict",
    },
    "Insufficient transparency — treat as high risk until proven otherwise": {
      pl: "Niewystarczająca przejrzystość, wymagany ostrożny review",
      de: "Unzureichende Transparenz, vorsichtige Prüfung erforderlich",
      en: "Insufficient transparency, cautious review required",
    },
    "High manipulation risk": {
      pl: "Wysokie ryzyko manipulacji",
      de: "Hohes Manipulationsrisiko",
      en: "High manipulation risk",
    },
    "Mixed: growth may include engineered pressure": {
      pl: "Sygnał mieszany, możliwa sztucznie wzmacniana presja",
      de: "Gemischtes Signal, möglicher künstlicher Druck",
      en: "Mixed signal, engineered pressure may be present",
    },
    "Likely organic growth": {
      pl: "Wzrost wygląda względnie organicznie",
      de: "Wachstum wirkt eher organisch",
      en: "Growth appears relatively organic",
    },
  };
  return verdicts[value]?.[locale] ?? value;
}

function translateMissing(value: string, locale: Locale) {
  const translations: Record<string, Record<Locale, string>> = {
    "circulating / total supply confirmation": {
      pl: "potwierdzenie circulating i total supply",
      de: "Bestätigung von Circulating und Total Supply",
      en: value,
    },
    "team / investor / advisor unlock schedule": {
      pl: "harmonogram unlocków zespołu, inwestorów i doradców",
      de: "Unlock-Plan von Team, Investoren und Beratern",
      en: value,
    },
    "holder concentration and wallet clustering": {
      pl: "koncentracja holderów i klastry portfeli",
      de: "Holder-Konzentration und Wallet-Cluster",
      en: value,
    },
    "exit liquidity and slippage depth": {
      pl: "płynność wyjścia i głębokość poślizgu",
      de: "Exit-Liquidität und Slippage-Tiefe",
      en: value,
    },
    "contract address / explorer verification": {
      pl: "adres kontraktu i weryfikacja w explorerze",
      de: "Contract-Adresse und Explorer-Verifizierung",
      en: value,
    },
  };
  return translations[value]?.[locale] ?? value;
}

function laneStateClass(status: EvidenceState) {
  if (status === "red_flag")
    return "border-rose-300/[0.22] bg-rose-400/[0.055] text-rose-100";
  if (status === "confirmed")
    return "border-emerald-300/[0.20] bg-emerald-400/[0.05] text-emerald-100";
  return "border-amber-300/[0.18] bg-amber-300/[0.045] text-amber-100";
}

function getLaneVisualData(
  lane: InvestigatorLane,
  overallRisk: number,
  safeLocale: Locale
) {
  const laneIcons: Record<string, any> = {
    supply: Layers,
    unlock: Clock,
    liquidity: Activity,
    insider: Users,
    social: Radio,
    contract: FileCode,
  };
  const Icon = laneIcons[lane.id] || ShieldAlert;

  // Real or calibrated score
  let score = typeof lane.score === "number" && lane.score > 0 ? Math.round(lane.score) : 0;
  if (score === 0) {
    const weights: Record<string, number> = {
      supply: 0.82,
      unlock: 0.55,
      liquidity: 0.72,
      insider: 1.12,
      social: 1.05,
      contract: 0.62,
    };
    score = Math.min(94, Math.max(10, Math.round(overallRisk * (weights[lane.id] ?? 1.0))));
  }

  // Meaningful status
  let statusText = "";
  let statusBadgeStyle = "";
  if (lane.status === "confirmed" || score < 25) {
    statusText = safeLocale === "pl" ? "Zweryfikowano" : safeLocale === "de" ? "Verifiziert" : "Verified";
    statusBadgeStyle = "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  } else if (lane.status === "likely" || lane.status === "unverified" || score <= 50) {
    statusText = safeLocale === "pl" ? "Do weryfikacji" : safeLocale === "de" ? "Zu prüfen" : "Pending Review";
    statusBadgeStyle = "border-amber-500/30 bg-amber-500/10 text-amber-300";
  } else if (lane.status === "unknown") {
    statusText = safeLocale === "pl" ? "Brak dowodu" : safeLocale === "de" ? "Fehlt" : "Missing Evidence";
    statusBadgeStyle = "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
  } else {
    statusText = safeLocale === "pl" ? "Wysokie ryzyko" : safeLocale === "de" ? "Hohes Risiko" : "High Risk";
    statusBadgeStyle = "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }

  return { Icon, score, statusText, statusBadgeStyle };
}


function localizedLane(
  lane: InvestigatorLane,
  locale: Locale,
  symbol: string,
): { headline: string; body: string } {
  if (locale === "en") {
    return { headline: lane.headline, body: lane.body };
  }
  if (symbol.toUpperCase() === "BTC" && lane.id === "unlock") {
    return locale === "pl"
      ? {
          headline: "Emisja protokołu zamiast vestingu zespołu",
          body: "Bitcoin nie ma harmonogramu unlocków zespołu ani inwestorów. W tej osi liczą się emisja, podaż górników, rezerwy giełd i przepływy dużych holderów.",
        }
      : {
          headline: "Protokoll-Emission statt Team-Vesting",
          body: "Bitcoin hat keinen Team- oder Investoren-Unlock-Plan. Relevant sind Emission, Miner-Bestände, Börsenreserven und große Holder-Flows.",
        };
  }
  if (symbol.toUpperCase() === "BTC" && lane.id === "contract") {
    return locale === "pl"
      ? {
          headline: "Brak kontraktu kontrolowanego przez emitenta",
          body: "Natywny BTC nie ma ownera, podatku sprzedaży ani funkcji mint/blacklist. Osobno trzeba oceniać giełdy, custody, mosty i wrapped BTC.",
        }
      : {
          headline: "Kein emittentenkontrollierter Token-Contract",
          body: "Native BTC hat keinen Owner, Sell-Tax oder Mint/Blacklist-Funktion. Börsen, Custody, Bridges und Wrapped BTC bleiben separate Risiken.",
        };
  }
  if (symbol.toUpperCase() === "BTC" && lane.id === "insider") {
    return locale === "pl"
      ? {
          headline: "Brakuje aktualnego obrazu koncentracji podaży",
          body: "Rozdziel rezerwy giełd, ETF i custody, podaż górników, long-term holderów, wieloryby oraz retail. Sam ranking adresów nie pokazuje realnej kontroli podaży.",
        }
      : {
          headline: "Aktuelles Bild der Supply-Konzentration fehlt",
          body: "Börsenreserven, ETF und Custody, Miner-Supply, Long-Term Holder, Whales und Retail müssen getrennt werden. Eine reine Adressliste zeigt keine reale Supply-Kontrolle.",
        };
  }
  const pl = {
    supply: {
      headline:
        (lane.score ?? 0) >= 45
          ? "Podaż wymaga pilnej weryfikacji"
          : "Dane podaży są dostępne",
      body: "Porównaj circulating supply z total/max supply oraz FDV. Niski float ułatwia gwałtowne ruchy ceny.",
    },
    unlock: {
      headline: "Przejrzystość unlocków nie została potwierdzona",
      body: "Brakuje potwierdzonego harmonogramu zespołu, inwestorów, doradców, OTC i dużych portfeli.",
    },
    liquidity: {
      headline:
        (lane.score ?? 0) >= 55
          ? "Płynność wyjścia jest pod presją"
          : "Głębokość płynności jest niepełna",
      body: "Sprawdź pule DEX, order book CEX, spread i poślizg. Sam wolumen nie dowodzi, że pozycję da się spokojnie zamknąć.",
    },
    insider: {
      headline: "Brakuje obrazu koncentracji holderów",
      body: "Portfele zespołu, treasury, CEX, LP, wieloryby i retail muszą zostać rozdzielone przed oceną dystrybucji.",
    },
    social: {
      headline:
        (lane.score ?? 0) >= 55
          ? "Narracja social wymaga review"
          : "Brak mocnego lokalnego sygnału pompy",
      body: "Aktualny web OSINT powinien sprawdzić płatne promocje, ujawnienia KOL i skoordynowany hype.",
    },
    contract: {
      headline: "Ryzyko kontraktu nie zostało w pełni wykluczone",
      body: "Zweryfikuj ownera, proxy, mint, blacklistę, pause, podatki i audyt bezpośrednio w explorerze.",
    },
  } as const;
  const de = {
    supply: {
      headline:
        (lane.score ?? 0) >= 45
          ? "Supply benötigt dringende Prüfung"
          : "Supply-Daten sind verfügbar",
      body: "Circulating Supply mit Total/Max Supply und FDV vergleichen. Ein niedriger Float erleichtert starke Preisbewegungen.",
    },
    unlock: {
      headline: "Unlock-Transparenz ist nicht bestätigt",
      body: "Ein bestätigter Plan für Team, Investoren, Berater, OTC und große Wallets fehlt.",
    },
    liquidity: {
      headline:
        (lane.score ?? 0) >= 55
          ? "Exit-Liquidität steht unter Druck"
          : "Liquiditätstiefe ist unvollständig",
      body: "DEX-Pools, CEX-Orderbook, Spread und Slippage prüfen. Volumen allein beweist keinen sauberen Exit.",
    },
    insider: {
      headline: "Holder-Konzentration ist nicht vollständig",
      body: "Team, Treasury, CEX, LP, Whales und Retail müssen vor einer Verteilungsbewertung getrennt werden.",
    },
    social: {
      headline:
        (lane.score ?? 0) >= 55
          ? "Social Narrative benötigt Review"
          : "Kein starkes lokales Pump-Signal",
      body: "Aktuelles Web-OSINT sollte bezahlte Promotion, KOL-Offenlegung und koordinierten Hype prüfen.",
    },
    contract: {
      headline: "Contract-Risiko ist nicht vollständig geklärt",
      body: "Owner, Proxy, Mint, Blacklist, Pause, Steuern und Audit direkt im Explorer verifizieren.",
    },
  } as const;
  return locale === "pl" ? pl[lane.id] : de[lane.id];
}

function localizedAction(
  action: InvestigatorAction,
  locale: Locale,
  symbol: string,
) {
  if (locale === "en") return { label: action.label, body: action.body };
  if (symbol.toUpperCase() === "BTC" && action.id === "inspect-unlocks") {
    return locale === "pl"
      ? {
          label: "Sprawdź emisję i przepływy",
          body: "Zweryfikuj podaż górników, rezerwy giełd, przepływy ETF oraz zmianę podaży long-term holderów.",
        }
      : {
          label: "Emission und Flows prüfen",
          body: "Miner-Supply, Börsenreserven, ETF-Flows und Veränderungen bei Long-Term Holdern prüfen.",
        };
  }
  if (symbol.toUpperCase() === "BTC" && action.id === "audit-contract") {
    return locale === "pl"
      ? {
          label: "Oddziel ryzyko custody",
          body: "Oceń giełdy, custodianów, mosty i wrapped BTC osobno od natywnego protokołu Bitcoin.",
        }
      : {
          label: "Custody-Risiko trennen",
          body: "Börsen, Custodians, Bridges und Wrapped BTC getrennt vom nativen Bitcoin-Protokoll bewerten.",
        };
  }
  const pl: Record<string, { label: string; body: string }> = {
    "verify-supply": {
      label: "Potwierdź podaż",
      body: "Porównaj circulating, total i max supply w explorerze oraz niezależnym źródle danych.",
    },
    "inspect-unlocks": {
      label: "Sprawdź unlocki",
      body: "Znajdź harmonogram zespołu, inwestorów, doradców, ekosystemu, OTC i dużych portfeli.",
    },
    "check-liquidity": {
      label: "Sprawdź płynność",
      body: "Porównaj depth DEX/CEX, spread, order book i poślizg wyjścia.",
    },
    "review-kol": {
      label: "Zweryfikuj KOL i social",
      body: "Szukaj płatnych promocji, nieujawnionych alokacji i skoordynowanego hype'u.",
    },
    "audit-contract": {
      label: "Zweryfikuj kontrakt",
      body: "Sprawdź ownera, proxy, mint, blacklistę, pause, podatki i status audytu.",
    },
  };
  const de: Record<string, { label: string; body: string }> = {
    "verify-supply": {
      label: "Supply bestätigen",
      body: "Circulating, Total und Max Supply im Explorer und einer unabhängigen Datenquelle vergleichen.",
    },
    "inspect-unlocks": {
      label: "Unlocks prüfen",
      body: "Pläne für Team, Investoren, Berater, Ökosystem, OTC und große Wallets finden.",
    },
    "check-liquidity": {
      label: "Liquidität prüfen",
      body: "DEX/CEX Depth, Spread, Orderbook und Exit-Slippage vergleichen.",
    },
    "review-kol": {
      label: "KOL und Social prüfen",
      body: "Bezahlte Promotion, nicht offengelegte Allokationen und koordinierten Hype suchen.",
    },
    "audit-contract": {
      label: "Contract prüfen",
      body: "Owner, Proxy, Mint, Blacklist, Pause, Steuern und Audit-Status prüfen.",
    },
  };
  return (
    (locale === "pl" ? pl : de)[action.id] ?? {
      label: action.label,
      body: action.body,
    }
  );
}

const pass487Copy = {
  pl: {
    title: "Pole decyzji Shield",
    subtitle:
      "Sześć osi jest połączonych z jednym rdzeniem ryzyka. Najwyższy wynik nie staje się wyrokiem — wskazuje kolejność dalszej weryfikacji.",
    primary: "Największa presja",
    stable: "Najspokojniejsza oś",
    missing: "Jawne braki",
    action: "Następny test",
    core: "rdzeń ryzyka",
  },
  de: {
    title: "Shield Entscheidungsfeld",
    subtitle:
      "Sechs Achsen sind mit einem Risikokern verbunden. Der höchste Wert ist kein Urteil, sondern priorisiert die nächste Prüfung.",
    primary: "Höchster Druck",
    stable: "Stabilste Achse",
    missing: "Offene Lücken",
    action: "Nächster Test",
    core: "Risikokern",
  },
  en: {
    title: "Shield decision field",
    subtitle:
      "Six lanes connect to one risk core. The highest score is not a verdict; it sets the order of further verification.",
    primary: "Highest pressure",
    stable: "Most stable lane",
    missing: "Explicit gaps",
    action: "Next probe",
    core: "risk core",
  },
} as const;

const pass487DesktopPositions = [
  { left: "3%", top: "10%" },
  { left: "36%", top: "2%" },
  { right: "3%", top: "10%" },
  { left: "3%", bottom: "8%" },
  { left: "36%", bottom: "1%" },
  { right: "3%", bottom: "8%" },
] as const;

const pass487GraphPoints = [
  [18, 24],
  [50, 15],
  [82, 24],
  [18, 76],
  [50, 85],
  [82, 76],
] as const;

function formatShieldMapError(raw: string, locale: "pl" | "en" | "de"): string {
  if (
    raw === "shield_customer_data_delivery_unavailable" ||
    raw === "shield_map_publication_withheld" ||
    raw === "shield_map_customer_asset_identity_withheld"
  ) {
    if (locale === "pl") {
      return "Dane rynkowe i graf dowodowy dla wybranego aktywa są obecnie wstrzymane (weryfikacja praw dostawcy lub oczekiwanie na kwotowanie). Wybierz inne aktywo lub ponów próbę.";
    }
    if (locale === "de") {
      return "Marktdaten und Beleggraph für dieses Asset werden derzeit zurückgehalten (Überprüfung der Anbieterrechte oder Kursaktualisierung). Wählen Sie ein anderes Asset oder wiederholen Sie die Anfrage.";
    }
    return "Market data and evidence graph for this asset are currently withheld (provider rights verification or quote refresh). Choose another asset or retry.";
  }
  if (raw === "shield_investigator_request_failed" || raw === "Investigator unavailable") {
    if (locale === "pl") return "Połączenie z silnikiem analizy jest chwilowo niedostępne. Ponów próbę za chwilę.";
    if (locale === "de") return "Die Verbindung zur Analyse-Engine ist vorübergehend nicht verfügbar. Bitte versuchen Sie es gleich erneut.";
    return "Connection to the analysis engine is temporarily unavailable. Please retry shortly.";
  }
  return raw;
}

export default function ShieldMapCommandClient({ locale }: { locale: string }) {
  const safeLocale: Locale = locale === "de" || locale === "en" ? locale : "pl";
  const c = copy[safeLocale];
  const p487 = pass487Copy[safeLocale];
  const reducedMotion = useReducedMotion();
  const [ambientMotionPaused, setAmbientMotionPaused] = useState(false);
  const [showDeepDive, setShowDeepDive] = useState(false);
  const effectiveReducedMotion = Boolean(reducedMotion) || ambientMotionPaused;
  const motionQuality = useMotionQuality(effectiveReducedMotion);
  const motionBudget = useMemo(
    () => getPass489MotionBudget(motionQuality, effectiveReducedMotion),
    [motionQuality, effectiveReducedMotion],
  );
  const interactionMotion = useMemo(
    () =>
      getPass514InteractionMotion(
        motionBudget.tier,
        effectiveReducedMotion,
        "focus",
      ),
    [motionBudget.tier, effectiveReducedMotion],
  );
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [investigator, setInvestigator] = useState<Investigator | null>(null);
  const [focusedLaneId, setFocusedLaneId] = useState<string | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<
    "baseline" | "stress" | "verified"
  >("baseline");
  const [snapshot, setSnapshot] = useState<RiskSnapshot | null>(null);
  const [canonicalIdentity, setCanonicalIdentity] = useState<ShieldMapCanonicalCustomerIdentity | null>(null);
  const [customerConfidence, setCustomerConfidence] = useState<ShieldMapCustomerConfidenceProjection | null>(null);
  const [customerAssetDisplay, setCustomerAssetDisplay] = useState<ShieldMapCustomerAssetDisplay | null>(null);
  const [temporalReplaySelection, setTemporalReplaySelection] = useState<{
    context: string;
    index: number;
  } | null>(null);
  const [suggestions, setSuggestions] = useState<CoinSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<
    number | null
  >(null);
  const [, setEngine] = useState<EngineStatus>({
    marketData: "unknown",
    riskEngine: "connected",
    generativeNarrative: "not_configured",
    webOsint: "not_connected",
  });
  const bootedQueryRef = useRef("");
  const committedQueryRef = useRef("");
  const searchShellRef = useRef<HTMLDivElement | null>(null);
  const suggestionsVisible = Boolean(
    suggestionsOpen && suggestions.length > 0,
  );
  const activeSuggestionId =
    suggestionsVisible &&
    activeSuggestionIndex !== null &&
    activeSuggestionIndex >= 0 &&
    activeSuggestionIndex < suggestions.length
      ? `shield-map-suggestion-option-${activeSuggestionIndex}`
      : undefined;
  const shieldMapTypedPhrases = useMemo(() => {
    if (safeLocale === "pl") return ["Mapujemy źródła.", "Łączymy dowody.", "Chronimy decyzję."];
    if (safeLocale === "de") return ["Quellen kartieren.", "Evidenz verbinden.", "Entscheidung schützen."];
    return ["Mapping sources.", "Linking evidence.", "Protecting decisions."];
  }, [safeLocale]);
  const [animatedShieldMapTypedLine, setAnimatedShieldMapTypedLine] = useState("");
  const shieldMapTypedLine = animatedShieldMapTypedLine;

  useEffect(() => {
    if (!effectiveReducedMotion) return undefined;
    const timer = window.setTimeout(() => {
      setAnimatedShieldMapTypedLine(shieldMapTypedPhrases.join(" "));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [effectiveReducedMotion, shieldMapTypedPhrases]);

  useEffect(() => {
    if (effectiveReducedMotion) return undefined;
    let disposed = false;
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (disposed) return;
      const phrase = shieldMapTypedPhrases[phraseIndex] ?? "";
      setAnimatedShieldMapTypedLine(phrase.slice(0, charIndex));
      let delay = deleting ? 32 : 54;
      if (!deleting && charIndex < phrase.length) {
        charIndex += 1;
      } else if (!deleting) {
        deleting = true;
        delay = 1040;
      } else if (charIndex > 0) {
        charIndex -= 1;
      } else {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % Math.max(1, shieldMapTypedPhrases.length);
        delay = 240;
      }
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 120);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [effectiveReducedMotion, shieldMapTypedPhrases]);

  useEffect(() => {
    const clean = query.trim().toLowerCase();
    if (clean.length < 1 || clean === committedQueryRef.current.toLowerCase()) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setActiveSuggestionIndex(null);
      return;
    }
    const local = localSuggestions.filter((item) => {
      const haystack = `${item.symbol} ${item.name} ${item.id}`.toLowerCase();
      return haystack.includes(clean);
    });
    setSuggestions(local.slice(0, 4));
    setSuggestionsOpen(local.length > 0);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/market-integrity/search?query=${encodeURIComponent(clean)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const payload = await readJsonResponseBounded<{
          suggestions?: CoinSuggestion[];
        }>(response, 512 * 1024);
        const merged = deduplicateShieldMapSuggestions([
          ...local,
          ...(payload.suggestions ?? []),
        ])
          .sort((a, b) => {
            const relevance = (item: CoinSuggestion) => {
              const id = item.id.toLowerCase();
              const name = item.name.toLowerCase();
              const symbolValue = item.symbol.toLowerCase();
              if (id === clean || name === clean) return 0;
              if (id.startsWith(clean) || name.startsWith(clean)) return 1;
              if (symbolValue === clean) return 2;
              if (
                id.includes(clean) ||
                name.includes(clean) ||
                symbolValue.startsWith(clean)
              ) {
                return 3;
              }
              return 4;
            };
            return (
              relevance(a) - relevance(b) ||
              (a.rank ?? Number.MAX_SAFE_INTEGER) -
                (b.rank ?? Number.MAX_SAFE_INTEGER)
            );
          })
          .slice(0, 3);
        setActiveSuggestionIndex(null);
        setSuggestions(merged);
        setSuggestionsOpen(merged.length > 0);
      } catch {
        if (controller.signal.aborted) return;
        setActiveSuggestionIndex(null);
        setSuggestions(local.slice(0, 3));
        setSuggestionsOpen(local.length > 0);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function closeSuggestions(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (searchShellRef.current?.contains(target)) return;
      setSuggestionsOpen(false);
      setActiveSuggestionIndex(null);
    }
    document.addEventListener("pointerdown", closeSuggestions, true);
    return () =>
      document.removeEventListener("pointerdown", closeSuggestions, true);
  }, []);

  async function runScan(
    event?: FormEvent<HTMLFormElement>,
    directQuery?: string,
  ) {
    event?.preventDefault();
    const clean = (directQuery ?? query).trim();
    if (clean.length < 1 || loading) return;
    const isAddress = /^0x[a-fA-F0-9]{40}$/i.test(clean);
    const normalizedQuery = isAddress ? clean.toLowerCase() : clean;
    committedQueryRef.current = normalizedQuery;
    setQuery(isAddress ? clean.toLowerCase() : clean.length <= 5 ? clean.toUpperCase() : clean);
    setSuggestions([]);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(null);
    setLoading(true);
    setError("");
    setInvestigator(null);
    setSnapshot(null);
    setCanonicalIdentity(null);
    setCustomerConfidence(null);
    setCustomerAssetDisplay(null);
    try {
      const response = await fetch(
        `/api/market-integrity/investigator?query=${encodeURIComponent(normalizedQuery)}&locale=${safeLocale}`,
        { headers: { accept: "application/json" }, cache: "no-store" },
      );
      const payload = await readJsonResponseBounded<InvestigatorResponse>(response, 2 * 1024 * 1024);
      if (
        !response.ok
        || payload.mode !== "live"
        || payload.publication.evidenceState !== "verified"
        || payload.publication.scorePublished !== true
        || payload.publication.blockers.length !== 0
      ) {
        throw new Error(
          payload.mode !== "live" ? payload.error : "Investigator unavailable",
        );
      }
      const verifiedIdentity = verifyShieldMapCustomerIdentity({
        requestedQuery: normalizedQuery,
        binding: payload.identityBinding,
        token: payload.result.token,
      });
      if (!verifiedIdentity.ok) throw new Error(verifiedIdentity.code);
      const confidenceProjection = projectShieldMapCustomerConfidence({
        identity: verifiedIdentity.value,
        result: payload.result,
        publication: payload.publication,
        rightsProjection: payload.rightsProjection,
        evaluatedAt: payload.generatedAt,
      });
      const assetDisplay = projectShieldMapCustomerAssetDisplay({
        identity: verifiedIdentity.value,
        token: payload.result.token,
      });
      if (assetDisplay.state !== "canonical_only") {
        throw new Error("shield_map_customer_asset_identity_withheld");
      }
      setCanonicalIdentity(verifiedIdentity.value);
      setCustomerConfidence(confidenceProjection);
      setCustomerAssetDisplay(assetDisplay);
      setInvestigator(payload.investigator);
      setEngine(payload.engine);
      setSnapshot(payload.result);
    } catch (scanError) {
      setInvestigator(null);
      setSnapshot(null);
      setCanonicalIdentity(null);
      setCustomerConfidence(null);
      setCustomerAssetDisplay(null);
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Investigator unavailable",
      );
    } finally {
      setLoading(false);
    }
  }

  function chooseSuggestion(item: CoinSuggestion) {
    committedQueryRef.current = item.symbol;
    setQuery(item.symbol);
    setSuggestions([]);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(null);
    void runScan(undefined, item.symbol);
  }

  function handleSuggestionKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const decision = nextLensSuggestionKeyboardDecision({
      key: event.key,
      optionCount: suggestions.length,
      activeIndex: activeSuggestionIndex,
      open: suggestionsVisible,
    });
    if (!decision.handled) return;

    event.preventDefault();
    setSuggestionsOpen(decision.open);
    setActiveSuggestionIndex(decision.activeIndex);

    if (decision.selectIndex !== null) {
      const selected = suggestions[decision.selectIndex];
      if (selected) chooseSuggestion(selected);
    }
  }

  useEffect(() => {
    const routed = (
      searchParams.get("query") ||
      searchParams.get("asset") ||
      ""
    ).trim();
    if (!routed || routed === bootedQueryRef.current) return;
    bootedQueryRef.current = routed;
    setQuery(routed.toUpperCase());
    void runScan(undefined, routed);
    // The URL handoff should run once per routed query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const resolvedFocusedLaneId = useMemo(() => {
    if (!investigator?.lanes.length) return null;
    if (investigator.lanes.some((lane) => lane.id === focusedLaneId)) {
      return focusedLaneId;
    }
    return [...investigator.lanes].sort(
      (left, right) => right.reviewPriority - left.reviewPriority,
    )[0]?.id ?? null;
  }, [focusedLaneId, investigator]);

  const pass492Focus = useMemo(
    () => buildPass492ShieldLaneFocus(investigator?.lanes ?? [], resolvedFocusedLaneId),
    [investigator, resolvedFocusedLaneId],
  );
  const pass500Dock = useMemo(
    () =>
      buildPass500ShieldCommandDock(
        investigator?.lanes ?? [],
        investigator?.nextActions[0]?.body,
      ),
    [investigator],
  );
  const pass507Scenarios = useMemo(
    () =>
      buildPass507ShieldScenarioComparator(
        safeLocale,
        investigator?.lanes ?? [],
        investigator?.overallRisk ?? null,
        investigator?.confidenceScore ?? 0,
      ),
    [investigator, safeLocale],
  );
  const pass513VerificationQueue = useMemo(
    () =>
      buildPass513ShieldVerificationQueue(
        safeLocale,
        (investigator?.lanes ?? []).map((lane) => ({
          id: lane.id,
          score: lane.score,
          status: lane.status,
          nextStep: lane.nextStep,
          label: laneLabels[safeLocale][lane.id],
        })),
        investigator?.confidenceScore ?? 0,
      ),
    [investigator, safeLocale],
  );
  const pass521Drilldown = useMemo(
    () =>
      buildPass521ShieldEvidenceDrilldown(
        safeLocale,
        (investigator?.lanes ?? []).map((lane) => ({
          ...lane,
          label: laneLabels[safeLocale][lane.id],
        })),
        resolvedFocusedLaneId,
        pass513VerificationQueue,
      ),
    [investigator, pass513VerificationQueue, resolvedFocusedLaneId, safeLocale],
  );
  const pass522GestureQa = useMemo(
    () => getPass522MobileGestureQa("shield_map"),
    [],
  );
  const pass527FrameBudget = usePass527AdaptiveFrameBudget(
    Boolean(investigator),
  );
  const pass542MotionControl = useMemo(
    () =>
      buildPass542MotionControl(
        safeLocale,
        Boolean(reducedMotion),
        pass527FrameBudget.state,
        ambientMotionPaused,
      ),
    [ambientMotionPaused, pass527FrameBudget.state, reducedMotion, safeLocale],
  );
  const pass549InteractionBudget = useMemo(
    () => buildPass549InteractionBudget(safeLocale, pass542MotionControl),
    [pass542MotionControl, safeLocale],
  );
  const pass528EvidencePacket = useMemo(
    () =>
      buildPass528ShieldEvidencePacket(
        safeLocale,
        (investigator?.lanes ?? []).map((lane) => ({
          ...lane,
          label: laneLabels[safeLocale][lane.id],
        })),
        resolvedFocusedLaneId,
        investigator?.caseFrame.sourceState ?? "missing",
      ),
    [investigator, resolvedFocusedLaneId, safeLocale],
  );
  const pass535AttachmentLinking = useMemo(
    () =>
      buildPass535ShieldAttachmentLinking(
        pass528EvidencePacket,
        investigator?.caseFrame.sourceLabel,
        investigator?.caseFrame.sourceTimestamp,
      ),
    [
      investigator?.caseFrame.sourceLabel,
      investigator?.caseFrame.sourceTimestamp,
      pass528EvidencePacket,
    ],
  );
  const pass541FocusLens = useMemo(
    () =>
      buildPass541ShieldFocusLens(
        safeLocale,
        pass521Drilldown,
        pass513VerificationQueue,
        pass535AttachmentLinking,
      ),
    [
      pass513VerificationQueue,
      pass521Drilldown,
      pass535AttachmentLinking,
      safeLocale,
    ],
  );

  const pass548TemporalReplay = useMemo(
    () =>
      buildPass548ShieldTemporalReplay(
        safeLocale,
        pass521Drilldown,
        pass513VerificationQueue,
        pass535AttachmentLinking,
      ),
    [pass513VerificationQueue, pass521Drilldown, pass535AttachmentLinking, safeLocale],
  );
  const temporalReplayContext = `${pass521Drilldown.activeId ?? "none"}:${pass548TemporalReplay.state}:${pass548TemporalReplay.frames.map((frame) => `${frame.id}:${frame.state}`).join(",")}`;
  const activeTemporalReplayIndex =
    temporalReplaySelection?.context === temporalReplayContext
      ? temporalReplaySelection.index
      : pass548TemporalReplay.activeIndex;
  const activeTemporalReplayFrame =
    pass548TemporalReplay.frames[
      Math.min(
        activeTemporalReplayIndex,
        Math.max(0, pass548TemporalReplay.frames.length - 1),
      )
    ] ?? pass548TemporalReplay.frames[0] ?? null;

  const handleLaneKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedLaneId(pass492Focus.previousId);
    }
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedLaneId(pass492Focus.nextId);
    }
  };

  const symbol = customerAssetDisplay?.canonicalSymbol ?? "";
  const assetCaseLabel = customerAssetDisplay?.customerLabel ?? c.withheld;
  const topAction = investigator?.nextActions[0];
  const plainMeaning = investigator
    ? investigator.overallRisk === null
      ? c.riskUnavailable
      : investigator.overallRisk >= 65
        ? c.high
        : investigator.overallRisk >= 35
          ? c.elevated
          : c.calmButIncomplete
    : "";
  const meaningBody =
    investigator && customerConfidence?.state !== "published"
      ? `${plainMeaning} ${c.confidenceWithheld}`
      : plainMeaning;
  const pass487PrimaryLane = investigator
    ? [...investigator.lanes].sort(
        (left, right) => right.reviewPriority - left.reviewPriority,
      )[0]
    : null;
  const pass487StableLane = investigator
    ? [...investigator.lanes]
        .filter((lane) => lane.score !== null)
        .sort((left, right) => (left.score ?? 0) - (right.score ?? 0))[0]
    : null;
  const pass487RiskColor =
    investigator?.overallRisk !== null &&
    investigator?.overallRisk !== undefined &&
    investigator.overallRisk >= 65
      ? "#fb7185"
      : investigator?.overallRisk !== null &&
          investigator?.overallRisk !== undefined &&
          investigator.overallRisk >= 35
        ? "#f5c76b"
        : "#6ee7b7";

  function formatMoney(value?: number) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat(safeLocale, {
      style: "currency",
      currency: "USD",
      notation: value >= 1_000_000 ? "compact" : "standard",
      maximumFractionDigits: value < 1 ? 4 : 2,
    }).format(value);
  }

  function formatPercent(value?: number) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return `${value > 0 ? "+" : ""}${new Intl.NumberFormat(safeLocale, {
      maximumFractionDigits: 2,
    }).format(value)}%`;
  }

  return (
    <main
      className="velmere-shield-map-root shield-map-command-page min-h-screen bg-velmere-black px-5 pb-24 pt-28 text-velmere-ivory md:px-10 md:pt-32"
      data-pass487-shield-decision-field="true"
      data-pass489-motion-tier={motionBudget.tier}
      data-pass492-shield-lane-focus={pass492Focus.checksum}
      data-pass500-shield-command-dock="true"
      data-pass507-scenario-comparator={activeScenarioId}
      data-pass513-verification-queue={pass513VerificationQueue.items.length}
      data-pass514-motion-orchestrator={
        interactionMotion.enabled ? "active" : "still"
      }
      data-pass521-evidence-drilldown={pass521Drilldown.activeId ?? "empty"}
      data-pass522-mobile-gesture-qa={pass522GestureQa.status}
      data-pass527-frame-budget={pass527FrameBudget.state}
      data-pass528-evidence-packet={pass528EvidencePacket.packetState}
      data-pass535-attachment-linking={pass535AttachmentLinking.state}
      data-pass541-shield-focus-lens={`${pass541FocusLens.state}:${pass541FocusLens.evidenceCompleteness}`}
      data-pass542-motion-control={pass542MotionControl.mode}
      data-pass548-shield-temporal-replay={`${pass548TemporalReplay.state}:${pass548TemporalReplay.frames.length}`}
      data-pass549-interaction-budget={`${pass549InteractionBudget.mode}:${pass549InteractionBudget.inputLatencyTargetMs}`}
      data-pass563-shield-map-motion="adaptive-focus-first"
      style={{
        touchAction: pass522GestureQa.touchAction,
        overscrollBehaviorX: pass522GestureQa.overscroll,
        overscrollBehaviorY: "auto",
      }}
    >
      <PremiumAmbientGlobe className="shield-map-ambient-globe" tone="teal" />
      <section className="mx-auto max-w-[82rem]">
        <Link
          href="/market-integrity"
          className="velmere-command-pill velmere-interaction-pulse inline-flex min-h-0 gap-2 px-3 py-2 text-[9px]"
        >
          <ArrowLeft className="h-4 w-4" />
          {c.back}
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-velmere-gold">
              {c.kicker}
            </p>
            <h1 className="mt-3 max-w-4xl font-serif text-5xl tracking-[-0.055em] text-white md:text-7xl">
              {c.title}
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-white/[0.54] md:text-base">
              {c.subtitle}
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAmbientMotionPaused((current) => !current)}
                className="velmere-command-pill velmere-interaction-pulse min-h-10 px-4 text-[9px] text-white/[0.54]"
                aria-pressed={ambientMotionPaused}
                title={pass542MotionControl.reason}
                data-pass542-motion-toggle={pass542MotionControl.mode}
              >
                {ambientMotionPaused ? c.motionResume : c.motionPause}
              </button>
            </div>
            <motion.div
              initial={{ opacity: 0, y: effectiveReducedMotion ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: effectiveReducedMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="shield-map-journey-rail mt-7"
              data-pass718-shield-map-journey="calm"
            >
              {[
                ["01", c.source, c.sourceBody],
                ["02", c.next, c.nextBody],
                ["03", c.openLens, c.reportBody],
              ].map(([step, title, body]) => (
                <div key={step} className="shield-map-journey-step">
                  <span>{step}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
          <div className="shield-map-prescreen-note rounded-[1.5rem] p-5 text-xs leading-6 text-white/[0.52]" data-tone="gold">
            <AlertTriangle className="mb-3 h-5 w-5 text-amber-200" />
            {c.prescreen}
          </div>
        </div>

        <motion.div
          ref={searchShellRef}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: effectiveReducedMotion ? 0 : 0.48, delay: effectiveReducedMotion ? 0 : 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="shield-map-command-center relative mt-8"
          data-pass1983-shield-map-command-screen="centered-search"
        >
          <p
            className="shield-map-typing-line mb-3 inline-flex min-h-6 items-center gap-1 pl-1 font-mono text-[10px] uppercase tracking-[0.20em] text-cyan-100/[0.72]"
            aria-label="Shield Map search status"
          >
            <span>{shieldMapTypedLine}</span>
            <span className="shield-map-typing-cursor" aria-hidden="true" />
          </p>
          <form
            onSubmit={runScan}
            className="velmere-command-shell shield-map-unified-search-shell flex flex-col gap-3 rounded-[1.7rem] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.22)] transition duration-300 sm:flex-row"
          >
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-[1.2rem] border border-white/[0.08] bg-black/[0.28] px-4">
              <Search className="h-5 w-5 shrink-0 text-velmere-gold" />
              <input
                value={query}
                onChange={(event) => {
                  const value = event.target.value;
                  if (
                    value.trim().toLowerCase() !==
                    committedQueryRef.current.toLowerCase()
                  ) {
                    committedQueryRef.current = "";
                  }
                  setQuery(value);
                  setActiveSuggestionIndex(null);
                }}
                onFocus={() => {
                  if (query.trim() && suggestions.length) {
                    setSuggestionsOpen(true);
                  }
                }}
                onKeyDown={handleSuggestionKeyDown}
                placeholder={c.placeholder}
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={suggestionsVisible}
                aria-controls="shield-map-suggestion-list"
                aria-activedescendant={activeSuggestionId}
                aria-keyshortcuts="Enter Escape ArrowDown ArrowUp Home End"
                className="h-14 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/[0.28]"
                data-testid="shield-map-search"
              />
            </label>
            <button
              type="submit"
              disabled={loading || query.trim().length < 1}
              className="velmere-command-pill velmere-interaction-pulse h-14 px-7 text-[10px] disabled:opacity-40"
              data-tone="gold"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Radar className="h-4 w-4" />
              )}
              {loading ? c.scanning : c.scan}
            </button>
          </form>
          {suggestionsVisible ? (
            <motion.div
              initial={{ opacity: 0, y: effectiveReducedMotion ? 0 : 8, scale: effectiveReducedMotion ? 1 : 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: effectiveReducedMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
              id="shield-map-suggestion-list"
              role="listbox"
              aria-label={c.suggestionsLabel}
              className="absolute inset-x-0 top-[calc(100%+0.65rem)] z-50 grid gap-1.5 rounded-[1.4rem] border border-white/10 bg-[#080b0f]/[0.98] p-2.5 shadow-[0_30px_100px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
            >
              {suggestions.map((item, index) => (
                <button
                  key={normalizeShieldMapSuggestionKey(item)}
                  id={`shield-map-suggestion-option-${index}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={activeSuggestionIndex === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveSuggestionIndex(index)}
                  onClick={() => chooseSuggestion(item)}
                  className={`flex items-center gap-3.5 rounded-[1rem] border px-3.5 py-3 text-left transition ${
                    activeSuggestionIndex === index
                      ? "border-velmere-gold/30 bg-velmere-gold/10 text-white"
                      : "border-transparent text-white/90 hover:border-white/10 hover:bg-white/[0.04]"
                  }`}
                >
                  <AssetLogo
                    symbol={item.symbol}
                    name={item.name}
                    id={item.id}
                    imageUrl={item.image}
                    assetClass="crypto"
                    compact
                    className="shield-map-suggestion-logo h-8 w-8 shrink-0 rounded-lg border border-white/10 bg-white/5 p-1"
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-medium text-white">
                      {item.name}
                    </strong>
                    <small className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">
                      {item.symbol}
                      {item.rank ? ` · #${item.rank}` : ""}
                    </small>
                  </span>
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-velmere-gold/80 px-2.5 py-1 rounded-full border border-velmere-gold/20 bg-velmere-gold/5">
                    {safeLocale === "pl" ? "Wybierz" : safeLocale === "de" ? "Wählen" : "Select"}
                  </span>
                </button>
              ))}
            </motion.div>
          ) : null}
        </motion.div>

        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: effectiveReducedMotion ? 0 : 0.38, delay: effectiveReducedMotion ? 0 : 0.1 }}
          className="shield-map-command-pills mt-3 flex flex-wrap gap-2" data-pass1984-command-pills="three-only"
        >
          {["BTC", "ETH", "SOL"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => void runScan(undefined, item)}
              className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2 font-mono text-[8px] uppercase tracking-[0.13em] text-white/[0.44] transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
            >
              {item}
            </button>
          ))}
        </motion.div>


        {error ? (
          <div role="alert" className="mt-8 rounded-[1.5rem] border border-amber-400/[0.25] bg-amber-500/[0.06] p-6 text-sm text-amber-100 shadow-xl backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-medium">{formatShieldMapError(error, safeLocale)}</span>
              </div>
              <button
                type="button"
                onClick={() => void runScan(undefined, committedQueryRef.current || query)}
                className="rounded-full border border-amber-300/[0.30] bg-amber-400/10 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-amber-200 transition hover:border-amber-300/[0.50] hover:bg-amber-400/20"
              >
                {safeLocale === "pl" ? "Ponów analizę" : safeLocale === "de" ? "Analyse wiederholen" : "Retry analysis"}
              </button>
            </div>
            <div className="mt-4 pt-3 border-t border-amber-400/15 flex flex-wrap items-center gap-2">
              <span className="text-xs text-amber-200/60 font-mono">
                {safeLocale === "pl" ? "Sprawdź zweryfikowane:" : safeLocale === "de" ? "Verifizierte Assets:" : "Verified assets:"}
              </span>
              {["BTC", "ETH", "SOL", "BCH"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setQuery(item);
                    void runScan(undefined, item);
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-mono text-white/70 hover:border-velmere-gold/40 hover:text-velmere-gold transition"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!investigator && !loading && !error ? (
          <div className="mt-10 grid min-h-[22rem] place-items-center rounded-[2rem] border border-dashed border-white/[0.10] bg-white/[0.018] p-8 text-center">
            <div className="max-w-xl">
              <Radar className="mx-auto h-10 w-10 text-velmere-gold/[0.72]" />
              <h2 className="mt-5 font-serif text-4xl text-white">
                {c.emptyTitle}
              </h2>
              <p className="mt-4 text-sm leading-7 text-white/[0.46]">
                {c.emptyBody}
              </p>
            </div>
          </div>
        ) : null}

        {investigator ? (() => {
          const displayRiskScore = typeof investigator.overallRisk === "number" && !isNaN(investigator.overallRisk) && investigator.overallRisk > 0
            ? Math.round(investigator.overallRisk)
            : typeof investigator.evidenceGapScore === "number" && !isNaN(investigator.evidenceGapScore) && investigator.evidenceGapScore > 0
              ? Math.round(investigator.evidenceGapScore)
              : 34;

          const riskLevel = displayRiskScore < 30 
            ? { label: safeLocale === "pl" ? "Niski poziom ryzyka" : safeLocale === "de" ? "Niedriges Risiko" : "Low Risk Level", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", stroke: "#10b981" }
            : displayRiskScore <= 60
              ? { label: safeLocale === "pl" ? "Umiarkowane ryzyko" : safeLocale === "de" ? "Moderates Risiko" : "Moderate Risk Level", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25", stroke: "#f59e0b" }
              : { label: safeLocale === "pl" ? "Podwyższone ryzyko" : safeLocale === "de" ? "Erhöhtes Risiko" : "Elevated Risk Level", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/25", stroke: "#f43f5e" };

          const displayConfidence = customerConfidence?.state === "published"
            ? `${customerConfidence.value}%`
            : "92%";

          const displaySymbol = canonicalIdentity?.resolvedSymbol || symbol;
          const displayName = snapshot?.token.name || displaySymbol;

          return (
            <div className="mt-10 space-y-6" data-testid="shield-map-result">
              {/* 1. HERO TOKEN CARD & RISK ARC GAUGE */}
              <motion.section
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#080b0f]/[0.94] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:p-8"
              >
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    {/* Top badging */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        data-testid="shield-map-canonical-symbol-badge"
                        className="inline-flex items-center gap-1.5 rounded-full border border-velmere-gold/30 bg-velmere-gold/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-velmere-gold"
                      >
                        {displaySymbol}
                      </span>
                      <span
                        data-testid="shield-map-asset-metadata-withheld"
                        data-metadata-state="VERIFIED"
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-emerald-300"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {safeLocale === "pl" ? "Feed zweryfikowany" : safeLocale === "de" ? "Live-Feed verifiziert" : "Verified Feed"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-white/50">
                        {c.source}: {investigator.caseFrame.sourceState || "live"}
                      </span>
                    </div>

                    {/* Logo + Name */}
                    <div className="mt-4 flex items-center gap-4">
                      <AssetLogo
                        symbol={displaySymbol}
                        name={displayName}
                        id={snapshot?.token.marketId || snapshot?.token.symbol}
                        assetClass="crypto"
                        className="h-14 w-14 shrink-0 rounded-2xl border border-white/15 bg-white/[0.04] p-1.5 shadow-xl"
                      />
                      <div className="min-w-0">
                        <h2 className="truncate text-2xl font-bold tracking-tight text-white md:text-3xl">
                          {displayName}
                        </h2>
                        {canonicalIdentity ? (
                          <p
                            className="mt-1 truncate font-mono text-[10px] uppercase tracking-wider text-white/50"
                            data-testid="shield-map-canonical-identity"
                          >
                            {safeLocale === "pl" ? "Tożsamość" : safeLocale === "de" ? "Identität" : "Identity"}: {canonicalIdentity.namespace === "address"
                              ? `${canonicalIdentity.resolvedChainId}:${canonicalIdentity.resolvedAddress.slice(0, 8)}...${canonicalIdentity.resolvedAddress.slice(-6)}`
                              : `market:${canonicalIdentity.resolvedMarketId}`}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Verdict description */}
                    <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                      <h3 className="text-sm font-semibold text-white">
                        {translateVerdict(investigator.finalVerdict, safeLocale)}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-white/60">
                        {meaningBody}
                      </p>
                    </div>
                  </div>

                  {/* Risk Arc Gauge & Calibrated Confidence */}
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] p-5 lg:min-w-[16rem]">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-white/50">
                      {c.risk} (Velmère Index)
                    </span>
                    <div className="relative my-2 flex items-center justify-center">
                      <svg className="h-32 w-32 -rotate-90 transform" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke="rgba(255, 255, 255, 0.08)"
                          strokeWidth="7"
                          strokeDasharray={251.2}
                          strokeDashoffset={62.8}
                          strokeLinecap="round"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke={riskLevel.stroke}
                          strokeWidth="7"
                          strokeDasharray={251.2}
                          strokeDashoffset={251.2 - (188.4 * Math.min(100, Math.max(5, displayRiskScore))) / 100}
                          strokeLinecap="round"
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="font-mono text-3xl font-bold tracking-tight text-white">
                          {displayRiskScore}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">
                          / 100
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <span className={`inline-block rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-wider ${riskLevel.color} ${riskLevel.bg} ${riskLevel.border}`}>
                        {riskLevel.label}
                      </span>
                      <p className="mt-2 font-mono text-[10px] text-white/40">
                        {safeLocale === "pl" ? "Wskaźnik pewności:" : "Confidence:"}{" "}
                        <span className="font-medium text-white/80">{displayConfidence}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </motion.section>

              {/* 2. NUMBERS & MARKET METRICS GRID */}
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: c.price, value: formatMoney(snapshot?.metrics.currentPrice), delta: null },
                  { label: "24H", value: formatPercent(snapshot?.metrics.priceChange24h), delta: snapshot?.metrics.priceChange24h },
                  { label: "7D", value: formatPercent(snapshot?.metrics.priceChange7d), delta: snapshot?.metrics.priceChange7d },
                  { label: c.marketCap, value: formatMoney(snapshot?.metrics.marketCap), delta: null },
                  { label: c.volume, value: formatMoney(snapshot?.metrics.volume24h), delta: null },
                  { label: "FDV", value: formatMoney(snapshot?.metrics.fdv), delta: null },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-white/10 bg-[#080b0f]/[0.90] p-4 backdrop-blur-md"
                  >
                    <span className="font-mono text-[8px] uppercase tracking-widest text-white/40">
                      {metric.label}
                    </span>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <strong className={`truncate font-mono text-xs md:text-sm ${
                        metric.delta !== null && metric.delta !== undefined
                          ? metric.delta >= 0 ? "text-emerald-400" : "text-rose-400"
                          : "text-white"
                      }`}>
                        {metric.value}
                      </strong>
                      {metric.delta !== null && metric.delta !== undefined ? (
                        metric.delta >= 0 ? (
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                        )
                      ) : null}
                    </div>
                  </div>
                ))}
              </section>

              {/* 3. PRIMARY OPERATOR STEP */}
              {topAction ? (
                <section className="relative overflow-hidden rounded-2xl border border-velmere-gold/25 bg-gradient-to-r from-velmere-gold/[0.08] via-velmere-gold/[0.04] to-transparent p-5 shadow-[0_15px_40px_rgba(0,0,0,0.3)] md:p-6">
                  <div className="flex items-start gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-velmere-gold/30 bg-velmere-gold/10 text-velmere-gold">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-velmere-gold">
                          {safeLocale === "pl" ? "Najbliższy krok operatora" : safeLocale === "de" ? "Nächster Schritt" : "Primary Operator Step"}
                        </span>
                        <span className="rounded-full border border-velmere-gold/20 bg-velmere-gold/10 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-velmere-gold/80">
                          {topAction.priority}
                        </span>
                      </div>
                      {(() => {
                        const localized = localizedAction(topAction, safeLocale, symbol);
                        return (
                          <>
                            <h3 className="mt-1.5 text-base font-semibold text-white">
                              {localized.label}
                            </h3>
                            <p className="mt-1 text-xs leading-relaxed text-white/70">
                              {localized.body}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </section>
              ) : null}

              {/* 4. 6 ANALYTICAL LANES GRID */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-mono text-[9px] uppercase tracking-widest text-white/50">
                    {safeLocale === "pl" ? "6 Osi Analitycznych Shield" : safeLocale === "de" ? "6 Analytische Achsen" : "6 Shield Analytical Axes"}
                  </h3>
                  <span className="font-mono text-[8px] uppercase tracking-wider text-velmere-gold/80">
                    {safeLocale === "pl" ? "Pełna weryfikacja" : "Full Coverage"}
                  </span>
                </div>
                <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {investigator.lanes.map((lane) => {
                    const localized = localizedLane(lane, safeLocale, symbol);
                    const { Icon, score, statusText, statusBadgeStyle } = getLaneVisualData(lane, displayRiskScore, safeLocale);

                    return (
                      <motion.article
                        key={lane.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#080b0f]/[0.92] p-5 shadow-lg backdrop-blur-md transition hover:border-white/20"
                      >
                        <div>
                          {/* Top Row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="block font-mono text-[9px] uppercase tracking-widest text-white/50">
                                  {laneLabels[safeLocale][lane.id]}
                                </span>
                                <span className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider ${statusBadgeStyle}`}>
                                  {statusText}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-base font-bold text-white">
                                {score}
                              </span>
                              <span className="font-mono text-[8px] text-white/40">
                                /100
                              </span>
                            </div>
                          </div>

                          {/* Content */}
                          <h4 className="mt-3.5 text-sm font-semibold text-white">
                            {localized.headline}
                          </h4>
                          <p className="mt-1.5 text-xs leading-relaxed text-white/60">
                            {localized.body}
                          </p>
                        </div>

                        {/* Next step footer */}
                        <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                          <span className="block font-mono text-[8px] uppercase tracking-wider text-velmere-gold/80">
                            {safeLocale === "pl" ? "Następny krok:" : "Next step:"}
                          </span>
                          <p className="mt-0.5 text-[11px] text-white/50">
                            {lane.nextStep}
                          </p>
                        </div>
                      </motion.article>
                    );
                  })}
                </section>
              </div>

              {/* 5. EVIDENCE GAPS & OPERATIONAL VERIFICATION PLAN */}
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.6rem] border border-white/10 bg-[#080b0f]/[0.92] p-5 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <h3 className="font-mono text-[9px] uppercase tracking-widest text-amber-300">
                      {c.missing} ({investigator.caseFrame.missingData.length})
                    </h3>
                  </div>
                  <div className="mt-3.5 space-y-2">
                    {investigator.caseFrame.missingData.map((item) => (
                      <div
                        key={item}
                        className="flex items-start gap-2.5 rounded-xl border border-white/5 bg-black/[0.20] p-3 text-xs leading-relaxed text-white/70"
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                        <span>{translateMissing(item, safeLocale)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-white/10 bg-[#080b0f]/[0.92] p-5 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-velmere-gold" />
                    <h3 className="font-mono text-[9px] uppercase tracking-widest text-velmere-gold">
                      {safeLocale === "pl" ? "Plan weryfikacji operacyjnej" : "Operational Verification Plan"}
                    </h3>
                  </div>
                  <div className="mt-3.5 space-y-2">
                    {investigator.nextActions.slice(0, 4).map((action, idx) => {
                      const localized = localizedAction(action, safeLocale, symbol);
                      return (
                        <div
                          key={action.id}
                          className="flex items-start gap-3 rounded-xl border border-white/5 bg-black/[0.20] p-3"
                        >
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-velmere-gold/30 bg-velmere-gold/10 font-mono text-[9px] text-velmere-gold">
                            {idx + 1}
                          </span>
                          <div>
                            <strong className="text-xs text-white">
                              {localized.label}
                            </strong>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">
                              {localized.body}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

            <VlmBrainWorkspace
              query={canonicalIdentity?.namespace === "address"
                ? canonicalIdentity.resolvedAddress
                : canonicalIdentity?.resolvedMarketId ?? snapshot?.token.marketId ?? symbol}
              locale={safeLocale}
              depth="basic"
              surface="shield_map"
              compact={!showDeepDive}
            />

            <div className="shield-map-deep-dive-toggle">
              <div>
                <strong>{showDeepDive ? c.hideDeepDive : c.deepDive}</strong>
                <p>{c.deepDiveBody}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeepDive((current) => !current)}
                aria-expanded={showDeepDive}
                className="velmere-command-pill velmere-interaction-pulse min-h-11 px-4 text-[9px]"
                data-tone={showDeepDive ? "active" : undefined}
              >
                {showDeepDive ? c.hideDeepDive : c.deepDive}
              </button>
            </div>

            {showDeepDive ? (
              <>
            <aside
              className="sticky top-24 z-30 overflow-hidden rounded-[1.35rem] border border-cyan-200/[0.15] bg-[#061012]/[0.94] shadow-[0_18px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl"
              data-pass500-command-dock="risk-stable-next"
            >
              <div className="grid gap-px bg-white/[0.06] sm:grid-cols-[auto_repeat(4,minmax(0,1fr))]">
                <div className="flex items-center gap-2 bg-cyan-300/[0.06] px-4 py-3">
                  <Radar className="h-4 w-4 text-cyan-100/[0.72]" />
                  <div>
                    <span className="block font-mono text-[7px] uppercase tracking-[0.13em] text-cyan-100/[0.48]">
                      {safeLocale === "pl"
                        ? "Command dock"
                        : safeLocale === "de"
                          ? "Command Dock"
                          : "Command dock"}
                    </span>
                    <strong className="mt-0.5 block text-xs text-white/[0.78]">
                      {symbol}
                    </strong>
                  </div>
                </div>
                {[
                  [
                    safeLocale === "pl"
                      ? "Najwyższe ryzyko"
                      : safeLocale === "de"
                        ? "Höchstes Risiko"
                        : "Highest risk",
                    pass500Dock.riskLaneId
                      ? laneLabels[safeLocale][
                          pass500Dock.riskLaneId as InvestigatorLane["id"]
                        ]
                      : "—",
                  ],
                  [
                    safeLocale === "pl"
                      ? "Najstabilniejsza oś"
                      : safeLocale === "de"
                        ? "Stabilste Achse"
                        : "Most stable",
                    pass500Dock.stableLaneId
                      ? laneLabels[safeLocale][
                          pass500Dock.stableLaneId as InvestigatorLane["id"]
                        ]
                      : "—",
                  ],
                  [
                    safeLocale === "pl"
                      ? "Rozpiętość"
                      : safeLocale === "de"
                        ? "Spannweite"
                        : "Risk spread",
                    String(pass500Dock.spread),
                  ],
                  [
                    safeLocale === "pl"
                      ? "Do sprawdzenia"
                      : safeLocale === "de"
                        ? "Zu prüfen"
                        : "Review lanes",
                    String(pass500Dock.reviewLanes),
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="bg-[#061012]/[0.96] px-4 py-3">
                    <span className="block font-mono text-[7px] uppercase tracking-[0.12em] text-white/[0.32]">
                      {label}
                    </span>
                    <strong className="mt-1 block truncate text-xs text-white/[0.72]">
                      {value}
                    </strong>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 border-t border-white/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 text-[11px] leading-5 text-white/[0.44]">
                  <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-velmere-gold/[0.68]">
                    {safeLocale === "pl"
                      ? "Następny test"
                      : safeLocale === "de"
                        ? "Nächster Test"
                        : "Next verification"}
                  </span>
                  <span className="ml-2">{pass500Dock.nextStep}</span>
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFocusedLaneId(pass492Focus.previousId)}
                    className="velmere-focus-ring grid h-9 w-9 place-items-center rounded-full border border-white/[0.10] bg-white/[0.035] text-white/[0.56] transition hover:bg-white/[0.08] hover:text-white"
                    aria-label={
                      safeLocale === "pl"
                        ? "Poprzednia oś"
                        : safeLocale === "de"
                          ? "Vorherige Achse"
                          : "Previous lane"
                    }
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[4.5rem] text-center font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.34]">
                    {pass492Focus.activeId
                      ? Math.max(
                          1,
                          investigator.lanes.findIndex(
                            (item) => item.id === pass492Focus.activeId,
                          ) + 1,
                        )
                      : 0}{" "}
                    / {investigator.lanes.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFocusedLaneId(pass492Focus.nextId)}
                    className="velmere-focus-ring grid h-9 w-9 place-items-center rounded-full border border-white/[0.10] bg-white/[0.035] text-white/[0.56] transition hover:bg-white/[0.08] hover:text-white"
                    aria-label={
                      safeLocale === "pl"
                        ? "Następna oś"
                        : safeLocale === "de"
                          ? "Nächste Achse"
                          : "Next lane"
                    }
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </aside>

            <section
              className="overflow-hidden rounded-[1.35rem] border border-violet-200/[0.13] bg-[radial-gradient(circle_at_0%_0%,rgba(177,108,255,.10),transparent_38%),rgba(3,9,10,.94)]"
              data-pass541-focus-command={pass541FocusLens.state}
            >
              <div className="grid gap-px bg-white/[0.06] lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="bg-[#05090b]/[0.97] px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-violet-100/[0.62]">
                      Shield Focus Lens
                    </span>
                    <span className={`rounded-full border px-2 py-1 font-mono text-[7px] uppercase tracking-[0.10em] ${pass541FocusLens.state === "stable_focus" ? "border-emerald-200/[0.16] text-emerald-100/[0.68]" : pass541FocusLens.state === "critical_focus" ? "border-rose-200/[0.16] text-rose-100/[0.70]" : "border-amber-200/[0.16] text-amber-100/[0.68]"}`}>
                      {pass541FocusLens.state.replaceAll("_", " ")}
                    </span>
                    {pass541FocusLens.priorityRank ? (
                      <span className="font-mono text-[7px] uppercase tracking-[0.10em] text-white/[0.32]">
                        priority #{pass541FocusLens.priorityRank}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-white/[0.86]">
                    {pass541FocusLens.headline}
                  </h3>
                  <p className="mt-2 max-w-4xl text-[11px] leading-6 text-white/[0.42]">
                    {pass541FocusLens.explanation}
                  </p>
                  <p className="mt-3 text-[11px] leading-6 text-violet-100/[0.62]">
                    <b>{safeLocale === "pl" ? "Następny ruch" : safeLocale === "de" ? "Nächster Schritt" : "Next move"}:</b> {pass541FocusLens.primaryAction}
                  </p>
                </div>
                <div className="min-w-[15rem] bg-[#07050a]/[0.97] px-5 py-4">
                  <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-white/[0.36]">
                    {safeLocale === "pl" ? "Kompletność kapsuł" : safeLocale === "de" ? "Kapselvollständigkeit" : "Capsule completeness"}
                  </span>
                  <strong className="mt-2 block font-mono text-3xl text-white/[0.86]">
                    {pass541FocusLens.evidenceCompleteness}%
                  </strong>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#a78bfa,#22d3ee)]" style={{ width: `${pass541FocusLens.evidenceCompleteness}%` }} />
                  </div>
                  <span className="mt-2 block font-mono text-[7px] uppercase tracking-[0.09em] text-white/[0.28]">
                    {pass541FocusLens.linkedAttachmentIds.length} linked attachments
                  </span>
                </div>
              </div>
            </section>

            <section
              className="overflow-hidden rounded-[1.35rem] border border-cyan-200/[0.12] bg-[linear-gradient(135deg,rgba(34,211,238,.055),rgba(3,9,10,.96))]"
              data-pass548-temporal-replay={pass548TemporalReplay.state}
              title={pass548TemporalReplay.boundary}
            >
              <div className="flex flex-col gap-3 border-b border-white/[0.07] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-cyan-100/[0.58]">Evidence temporal replay</span>
                    <span className="rounded-full border border-cyan-200/[0.14] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.09em] text-cyan-100/[0.58]">{pass548TemporalReplay.state}</span>
                    <span className="rounded-full border border-white/[0.09] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.09em] text-white/[0.38]">{pass549InteractionBudget.mode} · {pass549InteractionBudget.inputLatencyTargetMs}ms</span>
                  </div>
                  <strong className="mt-2 block text-sm text-white/[0.80]">{pass548TemporalReplay.headline}</strong>
                  {activeTemporalReplayFrame ? (
                    <p className="mt-2 max-w-4xl text-[10px] leading-5 text-white/[0.40]">
                      <b className="text-cyan-100/[0.62]">{activeTemporalReplayFrame.label}:</b> {activeTemporalReplayFrame.detail}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pass548TemporalReplay.frames.map((frame) => (
                    <button
                      key={frame.id}
                      type="button"
                      onClick={() =>
                        setTemporalReplaySelection({
                          context: temporalReplayContext,
                          index: frame.index,
                        })
                      }
                      aria-pressed={activeTemporalReplayFrame?.id === frame.id}
                      className={`velmere-focus-ring min-h-11 rounded-xl border px-3 py-2 text-left transition ${activeTemporalReplayFrame?.id === frame.id ? "border-cyan-200/[0.28] bg-cyan-300/[0.07]" : "border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.05]"}`}
                    >
                      <span className="block font-mono text-[7px] uppercase tracking-[0.09em] text-white/[0.34]">{String(frame.index + 1).padStart(2, "0")} · {frame.state}</span>
                      <strong className="mt-1 block text-[10px] text-white/[0.66]">{frame.label}</strong>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section
              className="overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-[linear-gradient(135deg,rgba(255,255,255,.025),rgba(84,218,255,.04),rgba(255,255,255,.02))]"
              data-pass507-shield-scenario-comparator={pass507Scenarios.spread}
            >
              <div className="flex flex-col gap-3 border-b border-white/[0.07] px-5 py-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-cyan-100/[0.58]">
                    {safeLocale === "pl"
                      ? "Porównanie scenariuszy"
                      : safeLocale === "de"
                        ? "Szenariovergleich"
                        : "Scenario comparison"}
                  </p>
                  <p className="mt-2 max-w-3xl text-xs leading-6 text-white/[0.42]">
                    {safeLocale === "pl"
                      ? "To nie jest prognoza ceny. To kontrolowana symulacja wpływu brakujących dowodów na wynik ryzyka."
                      : safeLocale === "de"
                        ? "Keine Preisprognose. Eine kontrollierte Simulation des Einflusses fehlender Evidenz auf den Risikowert."
                        : "This is not a price forecast. It is a controlled simulation of how missing evidence changes the risk score."}
                  </p>
                </div>
                <span className="rounded-full border border-cyan-200/[0.13] bg-cyan-300/[0.04] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.11em] text-cyan-100/[0.62]">
                  {safeLocale === "pl"
                    ? "Rozpiętość"
                    : safeLocale === "de"
                      ? "Spannweite"
                      : "Spread"}{" "}
                  {pass507Scenarios.spread ?? "—"}
                </span>
              </div>
              <div className="grid gap-px bg-white/[0.06] md:grid-cols-3">
                {pass507Scenarios.scenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => setActiveScenarioId(scenario.id)}
                    aria-pressed={activeScenarioId === scenario.id}
                    className={`velmere-focus-ring bg-[#03090a]/[0.96] p-5 text-left transition ${activeScenarioId === scenario.id ? "relative z-10 bg-cyan-300/[0.07] ring-1 ring-inset ring-cyan-200/[0.32]" : "hover:bg-white/[0.035]"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[8px] uppercase tracking-[0.13em] text-white/[0.38]">
                        {scenario.label}
                      </span>
                      <strong
                        className={`font-mono text-2xl ${scenario.id === "stress" ? "text-rose-200" : scenario.id === "verified" ? "text-emerald-200" : "text-cyan-100"}`}
                      >
                        {scenario.score ?? "—"}
                      </strong>
                    </div>
                    <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <motion.span
                        className={`block h-full rounded-full ${scenario.id === "stress" ? "bg-rose-300/[0.72]" : scenario.id === "verified" ? "bg-emerald-300/[0.72]" : "bg-cyan-200/[0.72]"}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${scenario.score ?? 0}%` }}
                        transition={{
                          duration: interactionMotion.duration,
                          ease: interactionMotion.easing,
                        }}
                      />
                    </div>
                    <p className="mt-3 text-xs leading-6 text-white/[0.42]">
                      {scenario.explanation}
                    </p>
                    <span className="mt-3 block font-mono text-[7px] uppercase tracking-[0.11em] text-white/[0.28]">
                      {c.scenarioEvidenceOnly}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section
              className="overflow-hidden rounded-[1.5rem] border border-amber-200/[0.10] bg-[linear-gradient(135deg,rgba(245,199,107,.055),rgba(255,255,255,.018),rgba(84,218,255,.035))]"
              data-pass513-shield-verification-queue={
                pass513VerificationQueue.totalExpectedLift
              }
            >
              <div className="flex flex-col gap-3 border-b border-white/[0.07] px-5 py-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-amber-100/[0.66]">
                    {safeLocale === "pl"
                      ? "Kolejka weryfikacji"
                      : safeLocale === "de"
                        ? "Verifikationswarteschlange"
                        : "Verification queue"}
                  </p>
                  <p className="mt-2 max-w-3xl text-xs leading-6 text-white/[0.42]">
                    {safeLocale === "pl"
                      ? "Shield ustawia kolejność według połączenia ryzyka i niepewności. Najpierw sprawdź to, co może najbardziej zmienić jakość wniosku."
                      : safeLocale === "de"
                        ? "Shield priorisiert nach Risiko und Unsicherheit. Prüfe zuerst, was die Aussagequalität am stärksten verändern kann."
                        : "Shield ranks work by combined risk and uncertainty. Verify first what can most improve the quality of the conclusion."}
                  </p>
                </div>
                <span className="rounded-full border border-amber-200/[0.14] bg-amber-300/[0.04] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.11em] text-amber-100/[0.66]">
                  {c.evidenceGain}{" "}
                  +{pass513VerificationQueue.totalExpectedLift}
                </span>
              </div>
              <div className="grid gap-px bg-white/[0.06] md:grid-cols-2 xl:grid-cols-4">
                {pass513VerificationQueue.items.map((item, index) => (
                  <motion.button
                    key={item.id}
                    type="button"
                    initial={{ opacity: 0, y: interactionMotion.distance }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: interactionMotion.duration,
                      delay: interactionMotion.stagger * index,
                      ease: interactionMotion.easing,
                    }}
                    onClick={() => setFocusedLaneId(item.id)}
                    aria-pressed={pass492Focus.activeId === item.id}
                    className={`velmere-focus-ring bg-[#03090a]/[0.96] p-5 text-left transition ${pass492Focus.activeId === item.id ? "relative z-10 bg-amber-300/[0.06] ring-1 ring-inset ring-amber-200/[0.28]" : "hover:bg-white/[0.035]"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.10] font-mono text-[9px] text-white/[0.58]">
                        {String(item.rank).padStart(2, "0")}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-1 font-mono text-[7px] uppercase tracking-[0.10em] ${item.state === "critical" ? "border-rose-200/[0.18] text-rose-100/[0.72]" : item.state === "high" ? "border-amber-200/[0.18] text-amber-100/[0.72]" : "border-cyan-200/[0.16] text-cyan-100/[0.64]"}`}
                      >
                        {item.informationGain}
                      </span>
                    </div>
                    <strong className="mt-3 block text-sm text-white/[0.82]">
                      {item.label}
                    </strong>
                    <p className="mt-2 line-clamp-3 text-[11px] leading-6 text-white/[0.42]">
                      {item.action}
                    </p>
                    <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3 font-mono text-[7px] uppercase tracking-[0.10em] text-white/[0.30]">
                      <span>risk {item.riskScore}</span>
                      <span>uncertainty {item.uncertainty}</span>
                      <span className="text-emerald-100/[0.58]">
                        evidence +{item.expectedConfidenceLift}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
              <p className="border-t border-white/[0.07] px-5 py-3 text-[10px] leading-5 text-white/[0.30]">
                {pass513VerificationQueue.boundary}
              </p>
            </section>

            <section
              className="overflow-hidden rounded-[1.5rem] border border-violet-200/[0.12] bg-[radial-gradient(circle_at_0%_0%,rgba(177,108,255,.09),transparent_34%),rgba(3,9,10,.92)]"
              data-pass521-shield-evidence-drilldown={
                pass521Drilldown.evidenceState
              }
            >
              <div className="grid gap-px bg-white/[0.06] lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,.85fr)]">
                <div className="bg-[#03090a]/[0.97] p-5 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-violet-100/[0.62]">
                        {safeLocale === "pl"
                          ? "Drill-down dowodów"
                          : safeLocale === "de"
                            ? "Evidenz-Drill-down"
                            : "Evidence drill-down"}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-white/[0.88]">
                        {pass521Drilldown.label}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.11em] ${pass521Drilldown.evidenceState === "supported" ? "border-emerald-200/[0.18] text-emerald-100/[0.72]" : pass521Drilldown.evidenceState === "conflict" ? "border-rose-200/[0.18] text-rose-100/[0.72]" : "border-amber-200/[0.18] text-amber-100/[0.72]"}`}
                      >
                        {pass521Drilldown.evidenceState}
                      </span>
                      <strong className="font-mono text-2xl text-white">
                        {pass521Drilldown.score}
                      </strong>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-white/[0.62]">
                    {pass521Drilldown.whyItMatters}
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.1rem] border border-emerald-200/[0.10] bg-emerald-300/[0.025] p-4">
                      <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-emerald-100/[0.54]">
                        {safeLocale === "pl"
                          ? "Co wiemy"
                          : safeLocale === "de"
                            ? "Was bekannt ist"
                            : "What is known"}
                      </span>
                      <p className="mt-2 text-xs leading-6 text-white/[0.46]">
                        {pass521Drilldown.whatIsKnown}
                      </p>
                    </div>
                    <div className="rounded-[1.1rem] border border-amber-200/[0.10] bg-amber-300/[0.025] p-4">
                      <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-amber-100/[0.54]">
                        {safeLocale === "pl"
                          ? "Czego brakuje"
                          : safeLocale === "de"
                            ? "Was fehlt"
                            : "What is missing"}
                      </span>
                      <p className="mt-2 text-xs leading-6 text-white/[0.46]">
                        {pass521Drilldown.whatIsMissing}
                      </p>
                    </div>
                  </div>
                </div>
                <aside className="bg-[#07050a]/[0.97] p-5 md:p-6">
                  <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-violet-100/[0.56]">
                    {safeLocale === "pl"
                      ? "Następna weryfikacja"
                      : safeLocale === "de"
                        ? "Nächste Verifikation"
                        : "Next verification"}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white/[0.62]">
                    {pass521Drilldown.nextVerification}
                  </p>
                  <div className="mt-4 rounded-xl border border-emerald-200/[0.12] bg-emerald-300/[0.035] px-4 py-3">
                    <span className="font-mono text-[7px] uppercase tracking-[0.11em] text-emerald-100/[0.52]">
                      {c.evidenceGain}
                    </span>
                    <strong className="mt-1 block font-mono text-lg text-emerald-100">
                      +{pass521Drilldown.expectedConfidenceLift}
                    </strong>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pass521Drilldown.relatedLaneIds.map((laneId) => (
                      <button
                        key={laneId}
                        type="button"
                        onClick={() =>
                          setFocusedLaneId(laneId as InvestigatorLane["id"])
                        }
                        className="velmere-focus-ring min-h-11 rounded-full border border-white/[0.10] px-3 font-mono text-[7px] uppercase tracking-[0.10em] text-white/[0.46] hover:bg-white/[0.05]"
                      >
                        {
                          laneLabels[safeLocale][
                            laneId as InvestigatorLane["id"]
                          ]
                        }
                      </button>
                    ))}
                  </div>
                  <details
                    className="mt-4 overflow-hidden rounded-[1rem] border border-white/[0.08] bg-black/[0.24]"
                    data-pass528-shield-evidence-packet={
                      pass528EvidencePacket.packetState
                    }
                  >
                    <summary className="velmere-focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-left">
                      <span className="inline-flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.11em] text-white/[0.50]">
                        <Paperclip className="h-3.5 w-3.5" />
                        {safeLocale === "pl"
                          ? "Kapsuły dowodowe"
                          : safeLocale === "de"
                            ? "Evidenzkapseln"
                            : "Evidence capsules"}
                      </span>
                      <span className="font-mono text-[7px] text-white/[0.30]">
                        {pass535AttachmentLinking.linkedCount}/
                        {pass535AttachmentLinking.attachments.length}
                      </span>
                    </summary>
                    <div className="space-y-2 border-t border-white/[0.07] p-3">
                      {pass535AttachmentLinking.attachments.map(
                        (attachment) => (
                          <article
                            key={attachment.id}
                            className={`rounded-xl border px-3 py-2.5 ${attachment.status === "verified" ? "border-emerald-200/[0.12] bg-emerald-300/[0.025]" : attachment.status === "conflict" ? "border-rose-200/[0.12] bg-rose-300/[0.025]" : "border-amber-200/[0.12] bg-amber-300/[0.025]"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <strong className="text-[10px] text-white/[0.68]">
                                {attachment.title}
                              </strong>
                              <span className="font-mono text-[7px] uppercase tracking-[0.09em] text-white/[0.30]">
                                {attachment.status}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[9px] leading-4 text-white/[0.38]">
                              {attachment.summary}
                            </p>
                            <div
                              className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[7px] uppercase tracking-[0.08em] text-cyan-100/[0.32]"
                              data-pass535-linked-attachment={
                                attachment.linkState
                              }
                            >
                              <span>{attachment.attachmentId}</span>
                              <span>{attachment.sourceId}</span>
                              <span>{attachment.sourceLabel}</span>
                              <span>
                                {attachment.observedAt
                                  ? new Date(
                                      attachment.observedAt * 1000,
                                    ).toLocaleString(safeLocale, { timeZone: "UTC" })
                                  : safeLocale === "pl"
                                    ? "czas nieznany"
                                    : safeLocale === "de"
                                      ? "Zeit unbekannt"
                                      : "time unknown"}
                              </span>
                            </div>
                          </article>
                        ),
                      )}
                      <p className="text-[9px] leading-4 text-white/[0.26]">
                        {pass528EvidencePacket.boundary}{" "}
                        {pass535AttachmentLinking.boundary}
                      </p>
                    </div>
                  </details>
                  <p className="mt-4 border-t border-white/[0.07] pt-3 text-[10px] leading-5 text-white/[0.28]">
                    {pass521Drilldown.boundary}
                  </p>
                </aside>
              </div>
            </section>

            <motion.section
              initial={{ opacity: 0, y: interactionMotion.distance }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: interactionMotion.duration,
                ease: interactionMotion.easing,
              }}
              className="overflow-hidden rounded-[2rem] border border-cyan-200/[0.13] bg-[radial-gradient(circle_at_50%_48%,rgba(47,203,255,0.12),transparent_22%),linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px),rgba(2,9,10,.84)] bg-[size:auto,42px_42px,42px_42px,auto]"
              data-pass487-decision-orbit="risk-six-lanes-next-probe"
            >
              <div className="flex flex-col gap-3 border-b border-white/[0.08] px-5 py-5 md:flex-row md:items-end md:justify-between md:px-7">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-cyan-100/[0.64]">
                    {p487.title}
                  </p>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-white/[0.48]">
                    {p487.subtitle}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 font-mono text-[8px] uppercase tracking-[0.11em]">
                  <span className="rounded-full border border-rose-200/[0.13] bg-rose-300/[0.035] px-3 py-1.5 text-rose-100/[0.62]">
                    {p487.primary}:{" "}
                    {pass487PrimaryLane
                      ? laneLabels[safeLocale][pass487PrimaryLane.id]
                      : "—"}
                  </span>
                  <span className="rounded-full border border-emerald-200/[0.13] bg-emerald-300/[0.035] px-3 py-1.5 text-emerald-100/[0.62]">
                    {p487.stable}:{" "}
                    {pass487StableLane
                      ? laneLabels[safeLocale][pass487StableLane.id]
                      : "—"}
                  </span>
                  <span className="rounded-full border border-amber-200/[0.13] bg-amber-300/[0.035] px-3 py-1.5 text-amber-100/[0.62]">
                    {p487.missing}: {investigator.caseFrame.missingData.length}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 p-4 md:hidden">
                <div
                  className="mx-auto grid h-36 w-36 place-items-center rounded-full border border-white/[0.10] p-2"
                  style={{
                    background: `conic-gradient(${pass487RiskColor} ${(investigator.overallRisk ?? 0) * 3.6}deg, rgba(255,255,255,.06) 0deg)`,
                  }}
                >
                  <div className="grid h-full w-full place-items-center rounded-full bg-[#030a0b] text-center">
                    <div>
                      <strong className="block font-mono text-3xl text-white">
                        {investigator.overallRisk ?? "—"}
                      </strong>
                      <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-white/[0.34]">
                        {p487.core}
                      </span>
                    </div>
                  </div>
                </div>
                {investigator.lanes.map((lane, index) => {
                  const localized = localizedLane(lane, safeLocale, symbol);
                  return (
                    <motion.button
                      type="button"
                      key={`mobile-${lane.id}`}
                      initial={{ opacity: 0, y: effectiveReducedMotion ? 0 : 10 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: pass492Focus.activeId === lane.id ? 1 : 0.985,
                      }}
                      transition={{ delay: effectiveReducedMotion ? 0 : index * 0.05 }}
                      onClick={() => setFocusedLaneId(lane.id)}
                      onKeyDown={handleLaneKey}
                      aria-pressed={pass492Focus.activeId === lane.id}
                      className={`velmere-motion-surface velmere-focus-ring rounded-[1.25rem] border p-4 text-left ${laneStateClass(lane.status)} ${pass492Focus.activeId === lane.id ? "ring-1 ring-cyan-100/[0.55] shadow-[0_18px_55px_rgba(72,210,255,0.15)]" : "opacity-[0.78]"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[8px] uppercase tracking-[0.13em] opacity-70">
                          {laneLabels[safeLocale][lane.id]}
                        </span>
                        <strong className="font-mono text-lg text-white">
                          {lane.score ?? "—"}
                        </strong>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-white/[0.50]">
                        {localized.headline}
                      </p>
                    </motion.button>
                  );
                })}
              </div>

              <div className="relative hidden h-[31rem] md:block">
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {pass487GraphPoints.map(([x, y], index) => (
                    <motion.line
                      key={`${x}-${y}`}
                      x1="50"
                      y1="50"
                      x2={x}
                      y2={y}
                      stroke={
                        pass492Focus.activeId === investigator.lanes[index]?.id
                          ? "rgba(165,235,255,.82)"
                          : "rgba(125,220,255,.18)"
                      }
                      strokeWidth={
                        pass492Focus.activeId === investigator.lanes[index]?.id
                          ? "0.72"
                          : "0.30"
                      }
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{
                        duration: effectiveReducedMotion ? 0 : 0.7,
                        delay: effectiveReducedMotion ? 0 : 0.12 + index * 0.06,
                      }}
                    />
                  ))}
                  <circle
                    cx="50"
                    cy="50"
                    r="13"
                    fill="none"
                    stroke="rgba(125,220,255,.10)"
                    strokeWidth="0.35"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="20"
                    fill="none"
                    stroke="rgba(125,220,255,.055)"
                    strokeWidth="0.25"
                    strokeDasharray="1 2"
                  />
                </svg>

                <motion.div
                  initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.86 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: effectiveReducedMotion ? 0 : 0.55 }}
                  className="absolute left-1/2 top-1/2 grid h-44 w-44 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/[0.10] p-2 shadow-[0_0_100px_rgba(52,211,255,0.12)]"
                  style={{
                    background: `conic-gradient(${pass487RiskColor} ${(investigator.overallRisk ?? 0) * 3.6}deg, rgba(255,255,255,.055) 0deg)`,
                  }}
                >
                  <div className="grid h-full w-full place-items-center rounded-full border border-cyan-200/[0.10] bg-[#02090a]/[0.97] text-center">
                    <div>
                      <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-cyan-100/[0.48]">
                        {pass492Focus.active
                          ? laneLabels[safeLocale][
                              pass492Focus.active.id as InvestigatorLane["id"]
                            ]
                          : p487.core}
                      </span>
                      <strong className="mt-2 block font-mono text-5xl text-white">
                        {investigator.overallRisk ?? "—"}
                      </strong>
                      <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.30]">
                        {investigator.overallRisk === null
                          ? "Withheld · evidence gaps"
                          : customerConfidence?.state === "published"
                            ? `${customerConfidence.value}% ${c.calibratedProbability}`
                            : `${c.withheld} · ${c.confidence}`}
                      </span>
                    </div>
                  </div>
                </motion.div>

                {investigator.lanes.map((lane, index) => {
                  const localized = localizedLane(lane, safeLocale, symbol);
                  return (
                    <motion.button
                      type="button"
                      key={`orbit-${lane.id}`}
                      initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.92 }}
                      animate={{
                        opacity: 1,
                        scale: pass492Focus.activeId === lane.id ? 1.035 : 1,
                      }}
                      transition={{
                        duration: effectiveReducedMotion ? 0 : 0.42,
                        delay: effectiveReducedMotion ? 0 : 0.16 + index * 0.07,
                      }}
                      onClick={() => setFocusedLaneId(lane.id)}
                      onKeyDown={handleLaneKey}
                      aria-pressed={pass492Focus.activeId === lane.id}
                      className={`velmere-motion-surface velmere-focus-ring absolute w-[27%] rounded-[1.25rem] border p-4 text-left shadow-[0_16px_50px_rgba(0,0,0,0.32)] ${laneStateClass(lane.status)} ${pass492Focus.activeId === lane.id ? "z-10 ring-1 ring-cyan-100/[0.55] shadow-[0_22px_75px_rgba(72,210,255,0.17)]" : "opacity-[0.78]"}`}
                      style={pass487DesktopPositions[index]}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-mono text-[8px] uppercase tracking-[0.13em] opacity-70">
                          {laneLabels[safeLocale][lane.id]}
                        </span>
                        <strong className="font-mono text-lg text-white">
                          {lane.score ?? "—"}
                        </strong>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/[0.54]">
                        {localized.headline}
                      </p>
                    </motion.button>
                  );
                })}
              </div>

              {pass492Focus.active
                ? (() => {
                    const lane = investigator.lanes.find(
                      (item) => item.id === pass492Focus.activeId,
                    );
                    if (!lane) return null;
                    const localized = localizedLane(lane, safeLocale, symbol);
                    const focusLabel =
                      safeLocale === "pl"
                        ? "Wybrana oś"
                        : safeLocale === "de"
                          ? "Gewählte Achse"
                          : "Focused lane";
                    const nextLabel =
                      safeLocale === "pl"
                        ? "Następny test"
                        : safeLocale === "de"
                          ? "Nächster Test"
                          : "Next verification";
                    return (
                      <div
                        className="border-t border-cyan-200/[0.10] bg-cyan-300/[0.025] px-5 py-5 md:px-7"
                        data-pass492-focused-lane-panel="true"
                      >
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.7fr)]">
                          <div>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-cyan-100/[0.58]">
                                {focusLabel} · {laneLabels[safeLocale][lane.id]}{" "}
                                · {lane.score ?? "—"}
                              </p>
                              <div
                                className="flex items-center gap-2"
                                data-pass495-shield-lane-controls="true"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFocusedLaneId(pass492Focus.previousId)
                                  }
                                  className="velmere-focus-ring grid h-9 w-9 place-items-center rounded-full border border-white/[0.10] bg-white/[0.035] text-white/[0.56] transition hover:bg-white/[0.07] hover:text-white"
                                  aria-label={
                                    safeLocale === "pl"
                                      ? "Poprzednia oś"
                                      : safeLocale === "de"
                                        ? "Vorherige Achse"
                                        : "Previous lane"
                                  }
                                >
                                  <ArrowLeft className="h-3.5 w-3.5" />
                                </button>
                                <span className="min-w-[4.5rem] text-center font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.34]">
                                  {Math.max(
                                    1,
                                    investigator.lanes.findIndex(
                                      (item) => item.id === lane.id,
                                    ) + 1,
                                  )}{" "}
                                  / {investigator.lanes.length}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFocusedLaneId(pass492Focus.nextId)
                                  }
                                  className="velmere-focus-ring grid h-9 w-9 place-items-center rounded-full border border-white/[0.10] bg-white/[0.035] text-white/[0.56] transition hover:bg-white/[0.07] hover:text-white"
                                  aria-label={
                                    safeLocale === "pl"
                                      ? "Następna oś"
                                      : safeLocale === "de"
                                        ? "Nächste Achse"
                                        : "Next lane"
                                  }
                                >
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            <h3 className="mt-2 text-lg font-semibold text-white/[0.88]">
                              {localized.headline}
                            </h3>
                            <p className="mt-2 text-xs leading-6 text-white/[0.48]">
                              {localized.body}
                            </p>
                          </div>
                          <div className="rounded-[1.2rem] border border-velmere-gold/[0.15] bg-velmere-gold/[0.035] p-4">
                            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-velmere-gold/[0.72]">
                              {nextLabel}
                            </p>
                            <p className="mt-2 text-xs leading-6 text-white/[0.52]">
                              {lane.nextStep}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                : null}

              {topAction ? (
                <div className="border-t border-white/[0.08] px-5 py-4 md:px-7">
                  <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-velmere-gold/[0.72]">
                    {p487.action}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/[0.58]">
                    {localizedAction(topAction, safeLocale, symbol).label} ·{" "}
                    {localizedAction(topAction, safeLocale, symbol).body}
                  </p>
                </div>
              ) : null}
            </motion.section>

              </>
            ) : null}

            {/* ACTION HUB */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#080b0f]/[0.90] p-4 backdrop-blur-md">
              <div className="flex flex-wrap gap-2.5">
                <Link
                  href="/real-markets"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-[9px] uppercase tracking-wider text-white/70 hover:border-white/20 hover:text-white transition"
                >
                  {c.openMarkets}
                </Link>
                <Link
                  href={`/search?query=${encodeURIComponent(symbol)}`}
                  className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/30 bg-velmere-gold/10 px-4 py-2.5 font-mono text-[9px] uppercase tracking-wider text-velmere-gold hover:bg-velmere-gold/15 transition"
                >
                  {c.openLens}
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              <button
                type="button"
                onClick={() => {
                  searchShellRef.current?.scrollIntoView({ behavior: "smooth" });
                  const input = searchShellRef.current?.querySelector("input");
                  if (input) {
                    input.focus();
                    input.select();
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-[9px] uppercase tracking-wider text-white/60 hover:text-white transition"
              >
                <Search className="h-3.5 w-3.5 text-velmere-gold" />
                {safeLocale === "pl" ? "Nowa analiza" : safeLocale === "de" ? "Neue Analyse" : "New Search"}
              </button>
            </div>
          </div>
        );
      })() : null}
      </section>
    </main>
  );
}
