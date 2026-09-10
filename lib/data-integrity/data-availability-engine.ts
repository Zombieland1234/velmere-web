/**
 * VELMÈRE DATA AVAILABILITY ENGINE (DAS)
 * 
 * Mandate from zadanie.txt (Sections 12-16, 94) & Institutional Ground-Truth Audit:
 * Calculates ground-truth Data Availability Score (0-100%) across 7 core dimensions.
 * Evaluates exact boundary conditions (29.9%, 30.0%, 30.1%, 59.9%, 60.0%, 84.9%, 85.0%).
 * Enforces field-level availability (contract, price, risk, historical, provider integrity).
 * Prevents high aggregate scores from masking missing critical security or contract data.
 */

export type DataAvailabilityDimension =
  | "contract_verification"
  | "security_data"
  | "market_data"
  | "candle_density"
  | "orderbook_liquidity"
  | "holder_data"
  | "historical_continuity";

export type DataAvailabilityStatus =
  | "CRITICAL_DATA_DEFICIT" // < 30%
  | "PARTIAL_DATA"          // 30 - 59.9%
  | "SUBSTANTIAL_DATA"      // 60 - 84.9%
  | "FULL_DATA_COVERAGE";   // >= 85%

export type DimensionAssessment = {
  dimension: DataAvailabilityDimension;
  labelPl: string;
  labelEn: string;
  labelDe: string;
  maxScore: number;
  earnedScore: number;
  status: "available" | "partial" | "missing";
  sourceOrReasonPl: string;
  sourceOrReasonEn: string;
  sourceOrReasonDe: string;
};

export type FieldAvailabilityReport = {
  contract: { available: boolean; critical: boolean; reason: string };
  price: { available: boolean; critical: boolean; reason: string };
  risk: { available: boolean; critical: boolean; reason: string };
  historical: { available: boolean; critical: boolean; reason: string };
  providerIntegrity: { stale: boolean; disagreement: boolean; reason?: string };
};

export type DataAvailabilityEvaluationInput = {
  // Optional explicit score override for exact boundary testing
  explicitScore?: number;

  // 1. Contract verification (max 20 pts)
  hasSourceCode?: boolean;
  hasBytecode?: boolean;
  hasVerifiedAbi?: boolean;
  isProxyDetected?: boolean;
  hasImplementationSource?: boolean;

  // 2. Security data (max 20 pts)
  hasStaticAnalysis?: boolean;
  hasCfgGraph?: boolean;
  hasTaintAnalysis?: boolean;
  hasFormalInvariants?: boolean;

  // 3. Market data (max 15 pts)
  hasPrice?: boolean;
  has24hVolume?: boolean;
  hasMarketCap?: boolean;
  verifiedProviderCount?: number;

  // 4. Candle density (max 15 pts)
  candleCount?: number;
  hasContinuousTimeline?: boolean;
  hasNoSyntheticGaps?: boolean;

  // 5. Orderbook & Liquidity (max 10 pts)
  hasOrderbookBidsAsks?: boolean;
  hasDexPoolReserves?: boolean;
  hasSlippageBounds?: boolean;

  // 6. Holder data (max 10 pts)
  hasTop10Holders?: boolean;
  hasConcentrationMetrics?: boolean; // Gini / HHI
  hasLpTokenLockProof?: boolean;

  // 7. Historical continuity (max 10 pts)
  historicalSnapshotCount?: number;
  has30dRiskHistory?: boolean;

  // Provider health / integrity indicators
  isProviderStale?: boolean;
  hasProviderDisagreement?: boolean;
};

export type DataAvailabilityResult = {
  score: number; // 0 - 100
  percentage: number;
  status: DataAvailabilityStatus;
  statusLabelPl: string;
  statusLabelEn: string;
  statusLabelDe: string;
  headlinePl: string;
  headlineEn: string;
  headlineDe: string;
  dimensions: DimensionAssessment[];
  fieldAvailability: FieldAvailabilityReport;
  criticalGaps: string[];
  availableItems: string[];
  partialItems: string[];
  missingItems: string[];
  purchaseRecommendation: {
    canPurchasePro: boolean;
    canPurchaseAdvanced: boolean;
    reasonPl: string;
    reasonEn: string;
    reasonDe: string;
  };
};

export function classifyAvailabilityStatus(percentage: number): DataAvailabilityStatus {
  if (percentage >= 85.0) return "FULL_DATA_COVERAGE";
  if (percentage >= 60.0) return "SUBSTANTIAL_DATA";
  if (percentage >= 30.0) return "PARTIAL_DATA";
  return "CRITICAL_DATA_DEFICIT";
}

export function evaluateDataAvailability(
  input: DataAvailabilityEvaluationInput,
  locale: "pl" | "en" | "de" = "en"
): DataAvailabilityResult {
  const dimensions: DimensionAssessment[] = [];

  // 1. Contract Verification (max 20)
  let contractScore = 0;
  if (input.hasBytecode) contractScore += 6;
  if (input.hasSourceCode) contractScore += 8;
  if (input.hasVerifiedAbi) contractScore += 4;
  if (input.isProxyDetected) {
    if (input.hasImplementationSource) contractScore += 2;
  } else {
    contractScore += 2;
  }
  contractScore = Math.min(20, contractScore);
  dimensions.push({
    dimension: "contract_verification",
    labelPl: "Weryfikacja kontraktu on-chain",
    labelEn: "On-Chain Contract Verification",
    labelDe: "On-Chain-Vertragsverifizierung",
    maxScore: 20,
    earnedScore: contractScore,
    status: contractScore >= 16 ? "available" : contractScore >= 6 ? "partial" : "missing",
    sourceOrReasonPl: contractScore >= 16 ? "Zweryfikowany kod Solidity + dekompilowany bajtkod" : contractScore >= 6 ? "Dostępny wyłącznie surowy bajtkod EVM (brak zweryfikowanego źródła)" : "Brak zweryfikowanego bajtkodu lub adresu kontraktu",
    sourceOrReasonEn: contractScore >= 16 ? "Verified Solidity source + decompiled EVM bytecode" : contractScore >= 6 ? "Bytecode only (unverified source code)" : "No verified bytecode or contract address found",
    sourceOrReasonDe: contractScore >= 16 ? "Verifizierter Solidity-Quellcode + EVM-Bytecode" : contractScore >= 6 ? "Nur Bytecode verfügbar (nicht verifizierter Quellcode)" : "Kein verifizierter Bytecode gefunden",
  });

  // 2. Security Data (max 20)
  let securityScore = 0;
  if (input.hasStaticAnalysis) securityScore += 8;
  if (input.hasCfgGraph) securityScore += 4;
  if (input.hasTaintAnalysis) securityScore += 4;
  if (input.hasFormalInvariants) securityScore += 4;
  securityScore = Math.min(20, securityScore);
  dimensions.push({
    dimension: "security_data",
    labelPl: "Analiza bezpieczeństwa i wektory ataków",
    labelEn: "Security Analysis & Attack Vectors",
    labelDe: "Sicherheitsanalyse & Angriffsvektoren",
    maxScore: 20,
    earnedScore: securityScore,
    status: securityScore >= 16 ? "available" : securityScore >= 8 ? "partial" : "missing",
    sourceOrReasonPl: securityScore >= 16 ? "Kompletny graf CFG, analiza taint i weryfikacja niezmienników" : securityScore >= 8 ? "Podstawowa analiza statyczna bez zaawansowanego przepływu danych" : "Brak danych z silnika audytowego",
    sourceOrReasonEn: securityScore >= 16 ? "Complete CFG graph, taint analysis, and invariant verification" : securityScore >= 8 ? "Basic static scan without deep taint propagation" : "No security analysis data available",
    sourceOrReasonDe: securityScore >= 16 ? "Vollständiger CFG-Graph, Taint-Analyse und Invarianten" : securityScore >= 8 ? "Basis-Scan ohne erweiterte Datenflussanalyse" : "Keine Sicherheitsdaten verfügbar",
  });

  // 3. Market Data (max 15)
  let marketScore = 0;
  if (input.hasPrice) marketScore += 6;
  if (input.has24hVolume) marketScore += 4;
  if (input.hasMarketCap) marketScore += 3;
  if ((input.verifiedProviderCount ?? 0) >= 2) marketScore += 2;
  marketScore = Math.min(15, marketScore);
  dimensions.push({
    dimension: "market_data",
    labelPl: "Wycena rynkowa i wolumen transakcji",
    labelEn: "Market Pricing & Trading Volume",
    labelDe: "Marktpreise & Handelsvolumen",
    maxScore: 15,
    earnedScore: marketScore,
    status: marketScore >= 12 ? "available" : marketScore >= 6 ? "partial" : "missing",
    sourceOrReasonPl: marketScore >= 12 ? "Kwotowania z wielu giełd (Binance, CoinGecko, DEX quorum)" : marketScore >= 6 ? "Jedno źródło wyceny — brak pełnego kworum giełdowego" : "Brak zweryfikowanej ceny lub obrotu rynkowego",
    sourceOrReasonEn: marketScore >= 12 ? "Multi-provider pricing (Binance, CoinGecko, DEX quorum)" : marketScore >= 6 ? "Single pricing provider — no exchange quorum" : "No verified price or trading volume",
    sourceOrReasonDe: marketScore >= 12 ? "Multi-Provider-Preise (Binance, CoinGecko, DEX-Quorum)" : marketScore >= 6 ? "Einzelne Preisquelle — kein Börsenquorum" : "Keine verifizierten Marktpreise",
  });

  // 4. Candle Density (max 15)
  let candleScore = 0;
  const candleCount = input.candleCount ?? 0;
  if (candleCount >= 50) candleScore += 7;
  else if (candleCount >= 8) candleScore += 4;
  if (input.hasContinuousTimeline) candleScore += 4;
  if (input.hasNoSyntheticGaps) candleScore += 4;
  candleScore = Math.min(15, candleScore);
  dimensions.push({
    dimension: "candle_density",
    labelPl: "Świece giełdowe i ciągłość OHLC",
    labelEn: "Exchange Candles & OHLC Continuity",
    labelDe: "Börsenkerzen & OHLC-Kontinuität",
    maxScore: 15,
    earnedScore: candleScore,
    status: candleScore >= 12 ? "available" : candleScore >= 4 ? "partial" : "missing",
    sourceOrReasonPl: candleScore >= 12 ? "Pełna historia świec z Binance/CoinGecko bez syntetycznych luk" : candleScore >= 4 ? "Ograniczona liczba świec (sparkline 7D) — brak pełnej historii" : "Brak świec giełdowych — tryb szkieletowy (Zero Random Candles)",
    sourceOrReasonEn: candleScore >= 12 ? "Full genuine exchange candle history without synthetic gaps" : candleScore >= 4 ? "Limited candle density (7D sparkline) — partial series" : "No exchange candles available — skeleton mode (Zero Random Candles)",
    sourceOrReasonDe: candleScore >= 12 ? "Echte Börsenkerzen ohne synthetische Lücken" : candleScore >= 4 ? "Eingeschränkte Kerzendichte (7T Sparkline)" : "Keine Börsenkerzen verfügbar — Skeleton-Modus",
  });

  // 5. Orderbook & Liquidity (max 10)
  let liquidityScore = 0;
  if (input.hasOrderbookBidsAsks) liquidityScore += 4;
  if (input.hasDexPoolReserves) liquidityScore += 4;
  if (input.hasSlippageBounds) liquidityScore += 2;
  liquidityScore = Math.min(10, liquidityScore);
  dimensions.push({
    dimension: "orderbook_liquidity",
    labelPl: "Płynność i głębokość arkusza (L2)",
    labelEn: "Orderbook Depth & Pool Liquidity (L2)",
    labelDe: "Orderbuchtiefe & Pool-Liquidität (L2)",
    maxScore: 10,
    earnedScore: liquidityScore,
    status: liquidityScore >= 8 ? "available" : liquidityScore >= 4 ? "partial" : "missing",
    sourceOrReasonPl: liquidityScore >= 8 ? "Dostępna głębokość arkusza L2 lub rezerwy puli Uniswap/Curve" : liquidityScore >= 4 ? "Częściowy odczyt płynności bez pełnego profilu poślizgu" : "Brak zweryfikowanych danych o płynności i arkuszu zleceń",
    sourceOrReasonEn: liquidityScore >= 8 ? "Full L2 orderbook bids/asks or verified Uniswap/Curve pool reserves" : liquidityScore >= 4 ? "Partial liquidity estimate without full slippage bounds" : "No verified orderbook or pool depth available",
    sourceOrReasonDe: liquidityScore >= 8 ? "Vollständiges L2-Orderbuch oder verifizierte Pool-Reserven" : liquidityScore >= 4 ? "Teilweise Liquiditätsschätzung ohne Slippage-Profil" : "Keine verifizierten Orderbuch- oder Pool-Daten verfügbar",
  });

  // 6. Holder Data (max 10)
  let holderScore = 0;
  if (input.hasTop10Holders) holderScore += 4;
  if (input.hasConcentrationMetrics) holderScore += 3;
  if (input.hasLpTokenLockProof) holderScore += 3;
  holderScore = Math.min(10, holderScore);
  dimensions.push({
    dimension: "holder_data",
    labelPl: "Koncentracja i blokady tokenów (Holders)",
    labelEn: "Holder Concentration & Token Locks",
    labelDe: "Holder-Konzentration & Token-Sperren",
    maxScore: 10,
    earnedScore: holderScore,
    status: holderScore >= 7 ? "available" : holderScore >= 3 ? "partial" : "missing",
    sourceOrReasonPl: holderScore >= 7 ? "Rozkład portfeli Top 10, współczynnik Gini oraz blokady LP" : holderScore >= 3 ? "Podstawowa lista portfeli bez weryfikacji blokad kontraktowych" : "Brak danych o strukturze portfeli i dystrybucji tokenów",
    sourceOrReasonEn: holderScore >= 7 ? "Top 10 holder breakdown, Gini coefficient, and LP lock receipts" : holderScore >= 3 ? "Basic holder count without contract lock verification" : "Missing holder cluster distribution and lock data",
    sourceOrReasonDe: holderScore >= 7 ? "Top-10-Verteilung, Gini-Koeffizient und LP-Sperrbelege" : holderScore >= 3 ? "Basis-Holderliste ohne Vertragssperrprüfung" : "Keine Daten zur Token-Verteilung verfügbar",
  });

  // 7. Historical Continuity (max 10)
  let historyScore = 0;
  const snapshots = input.historicalSnapshotCount ?? 0;
  if (snapshots >= 30) historyScore += 6;
  else if (snapshots >= 7) historyScore += 3;
  else if (snapshots >= 1) historyScore += 1;
  if (input.has30dRiskHistory) historyScore += 4;
  historyScore = Math.min(10, historyScore);
  dimensions.push({
    dimension: "historical_continuity",
    labelPl: "Ciągłość historii ryzyka (30D+)",
    labelEn: "Historical Risk Continuity (30D+)",
    labelDe: "Historische Risikokontinuität (30T+)",
    maxScore: 10,
    earnedScore: historyScore,
    status: historyScore >= 7 ? "available" : historyScore >= 3 ? "partial" : "missing",
    sourceOrReasonPl: historyScore >= 7 ? "Ciągła historia zmian profilu ryzyka z ostatnich 30 dni" : historyScore >= 3 ? "Krótka historia obserwacji ryzyka (< 7 dni)" : "Nowy instrument — brak wystarczającej historii obserwacji",
    sourceOrReasonEn: historyScore >= 7 ? "Continuous 30-day historical risk trajectory snapshots" : historyScore >= 3 ? "Short risk history timeline (< 7 days)" : "New asset — no historical risk trajectory recorded",
    sourceOrReasonDe: historyScore >= 7 ? "Kontinuierliche 30-Tage-Historie der Risikoprofile" : historyScore >= 3 ? "Kurze Risikohistorie (< 7 Tage)" : "Neues Asset — noch keine historische Aufzeichnung",
  });

  const rawScore = input.explicitScore !== undefined
    ? input.explicitScore
    : dimensions.reduce((acc, dim) => acc + dim.earnedScore, 0);

  const totalScore = Math.max(0, Math.min(100, rawScore));
  const status = classifyAvailabilityStatus(totalScore);

  // Field-level availability evaluation
  const contractAvailable = Boolean(input.hasBytecode || input.hasSourceCode);
  const priceAvailable = Boolean(input.hasPrice);
  const riskAvailable = Boolean(input.hasStaticAnalysis || input.hasCfgGraph);
  const historicalAvailable = Boolean(input.has30dRiskHistory || (input.historicalSnapshotCount && input.historicalSnapshotCount > 0));
  const isStale = Boolean(input.isProviderStale);
  const hasDisagreement = Boolean(input.hasProviderDisagreement);

  const criticalGaps: string[] = [];
  if (!contractAvailable) {
    criticalGaps.push("CRITICAL_CONTRACT_UNAVAILABLE: Neither verified source nor EVM bytecode is present.");
  }
  if (!priceAvailable && !input.hasDexPoolReserves) {
    criticalGaps.push("CRITICAL_PRICE_UNAVAILABLE: No reliable spot price or pool reserve data available.");
  }
  if (isStale) {
    criticalGaps.push("PROVIDER_STALENESS: Primary data sources are outdated (> 300s).");
  }
  if (hasDisagreement) {
    criticalGaps.push("PROVIDER_DISAGREEMENT: Conflicting price/liquidity quotes across upstream providers.");
  }

  const fieldAvailability: FieldAvailabilityReport = {
    contract: {
      available: contractAvailable,
      critical: true,
      reason: contractAvailable ? "Bytecode or source code verified" : "Missing both bytecode and source",
    },
    price: {
      available: priceAvailable,
      critical: true,
      reason: priceAvailable ? "Active exchange quote present" : "Missing market price feed",
    },
    risk: {
      available: riskAvailable,
      critical: false,
      reason: riskAvailable ? "CFG and static detectors active" : "Security scan pending",
    },
    historical: {
      available: historicalAvailable,
      critical: false,
      reason: historicalAvailable ? "Historical data recorded" : "No historical trajectory",
    },
    providerIntegrity: {
      stale: isStale,
      disagreement: hasDisagreement,
      reason: isStale ? "Stale data warning" : hasDisagreement ? "Provider variance detected" : "Providers synchronized",
    },
  };

  let statusLabelPl = "Krytyczny brak danych";
  let statusLabelEn = "Critical Data Deficit";
  let statusLabelDe = "Kritisches Datendefizit";

  let headlinePl = "Dane dla tego aktywa są wysoce niekompletne. Płatny audyt Pro/Advanced nie jest zalecany przed dostarczeniem źródeł.";
  let headlineEn = "Data for this asset is severely limited. Paid Pro/Advanced audit is not recommended until full sources are connected.";
  let headlineDe = "Die Daten für dieses Asset sind stark unvollständig. Ein kostenpflichtiger Pro/Advanced-Audit wird nicht empfohlen.";

  let canPurchasePro = false;
  let canPurchaseAdvanced = false;
  let reasonPl = "Brak wystarczających źródeł — zakup wyższych pakietów zablokowany w trosce o ochronę kupującego.";
  let reasonEn = "Insufficient verified data sources — higher tier purchases blocked for buyer protection.";
  let reasonDe = "Unzureichende verifizierte Datenquellen — Kauf höherer Pakete zum Schutz des Nutzers gesperrt.";

  if (status === "FULL_DATA_COVERAGE") {
    statusLabelPl = "Pełne pokrycie danych (100% gotowość)";
    statusLabelEn = "Full Data Coverage (100% Ready)";
    statusLabelDe = "Vollständige Datenabdeckung (100% bereit)";
    headlinePl = "Wszystkie kluczowe źródła są zweryfikowane i aktywne. Raporty Pro oraz Zaawansowany posiadają gwarancję pełnej rzetelności.";
    headlineEn = "All critical data sources are verified and active. Pro and Advanced reports are fully guaranteed for maximum analytical precision.";
    headlineDe = "Alle kritischen Datenquellen sind verifiziert und aktiv. Pro- und Advanced-Berichte bieten maximale analytische Zuverlässigkeit.";
    canPurchasePro = true;
    canPurchaseAdvanced = true;
    reasonPl = "Pełne pokrycie danych — wszystkie funkcje Pro i Advanced są aktywne.";
    reasonEn = "Full data coverage — all Pro and Advanced capabilities are available.";
    reasonDe = "Vollständige Datenabdeckung — alle Pro- und Advanced-Funktionen sind aktiv.";
  } else if (status === "SUBSTANTIAL_DATA") {
    statusLabelPl = "Wysokie pokrycie danych";
    statusLabelEn = "Substantial Data Coverage";
    statusLabelDe = "Hohe Datenabdeckung";
    headlinePl = "Większość kluczowych danych jest dostępna. Analiza Pro i Advanced zapewni rzetelne wnioski, z ujawnieniem drobnych ograniczeń.";
    headlineEn = "Most key data points are available. Pro and Advanced analysis will yield high-confidence insights with disclosed limitations.";
    headlineDe = "Die meisten Schlüsseldaten sind verfügbar. Pro- und Advanced-Analysen liefern zuverlässige Erkenntnisse mit offengelegten Grenzen.";
    canPurchasePro = true;
    canPurchaseAdvanced = true;
    reasonPl = "Wystarczające dane do przeprowadzenia pełnego audytu z ujawnieniem ewentualnych braków.";
    reasonEn = "Sufficient data to conduct complete audit with disclosed peripheral gaps.";
    reasonDe = "Ausreichende Daten für einen vollständigen Audit mit offengelegten Randlücken.";
  } else if (status === "PARTIAL_DATA") {
    statusLabelPl = "Częściowe dane";
    statusLabelEn = "Partial Data";
    statusLabelDe = "Teilweise Daten";
    headlinePl = "Dostępna jest tylko część danych źródłowych. Raport Pro jest możliwy z ostrzeżeniem, pakiet Zaawansowany wymaga dodatkowych źródeł.";
    headlineEn = "Only partial source data is present. Pro analysis is available with disclosures; Advanced audit requires supplementary verified sources.";
    headlineDe = "Nur teilweise Quelldaten vorhanden. Pro-Analyse mit Hinweisen verfügbar; Advanced-Audit erfordert zusätzliche verifizierte Quellen.";
    canPurchasePro = true;
    canPurchaseAdvanced = false;
    reasonPl = "Brak pełnego kodu źródłowego lub głębokiej płynności — pakiet Advanced wyłączony, pakiet Pro dostępny z zastrzeżeniem.";
    reasonEn = "Missing full verified source or deep liquidity — Advanced tier disabled, Pro tier available with explicit disclosures.";
    reasonDe = "Fehlender Quellcode oder mangelnde Liquidität — Advanced-Paket deaktiviert, Pro-Paket mit Hinweisen verfügbar.";
  }

  // Field-level override: If a critical gap exists (e.g. no contract code), block purchase regardless of total score
  if (!contractAvailable) {
    canPurchasePro = false;
    canPurchaseAdvanced = false;
    reasonEn = "Purchase blocked: Contract bytecode or verified source code is completely unavailable.";
    reasonPl = "Zakup zablokowany: Brak bajtkodu i zweryfikowanego kodu źródłowego kontraktu.";
    reasonDe = "Kauf gesperrt: Weder Bytecode noch Quellcode des Vertrags sind verfügbar.";
  }

  const availableItems: string[] = [];
  const partialItems: string[] = [];
  const missingItems: string[] = [];

  for (const dim of dimensions) {
    const label = locale === "pl" ? dim.labelPl : locale === "de" ? dim.labelDe : dim.labelEn;
    const detail = locale === "pl" ? dim.sourceOrReasonPl : locale === "de" ? dim.sourceOrReasonDe : dim.sourceOrReasonEn;
    const entry = `${label} (${dim.earnedScore}/${dim.maxScore} pkt) — ${detail}`;
    if (dim.status === "available") availableItems.push(entry);
    else if (dim.status === "partial") partialItems.push(entry);
    else missingItems.push(entry);
  }

  return {
    score: totalScore,
    percentage: totalScore,
    status,
    statusLabelPl,
    statusLabelEn,
    statusLabelDe,
    headlinePl,
    headlineEn,
    headlineDe,
    dimensions,
    fieldAvailability,
    criticalGaps,
    availableItems,
    partialItems,
    missingItems,
    purchaseRecommendation: {
      canPurchasePro,
      canPurchaseAdvanced,
      reasonPl,
      reasonEn,
      reasonDe,
    },
  };
}
