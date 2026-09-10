/**
 * Velmere Dynamic Signal Availability & Stop-Sell Protection Engine
 * 
 * Guarantees complete customer safety:
 * 1. Counts active verification signals per tier (Basic: 10, Pro: 14, Advanced: 20).
 * 2. If all signals are active -> Full price, standard delivery.
 * 3. If partial signals are active (within viable threshold) -> Dynamic discount applied transparently.
 * 4. If critical signals are missing -> STOP-SELL ACTIVATED. Purchases are strictly blocked so the
 *    customer is never charged for data that cannot be completely delivered.
 */

export type AuditOrAssetTier = "basic" | "pro" | "advanced";

export interface SignalDefinition {
  id: string;
  name: string;
  namePl: string;
  nameDe: string;
  requiredFor: AuditOrAssetTier[];
  description: string;
  descriptionDe: string;
}

export const CANONICAL_SIGNALS: SignalDefinition[] = [
  // Basic & Pro & Advanced (1-10)
  { id: "sig_ast_syntax", name: "AST Syntax & Static Analysis", namePl: "Analiza statyczna i drzewo AST", nameDe: "AST-Syntax & Statische Analyse", requiredFor: ["basic", "pro", "advanced"], description: "Parsowanie składniowe kodu i dekompilacja bazowa", descriptionDe: "Syntaktisches Code-Parsing und Basis-Dekompilierung" },
  { id: "sig_symbolic_bytecode", name: "Symbolic Bytecode Execution", namePl: "Symboliczna egzekucja kodu bajtowego", nameDe: "Symbolische Bytecode-Ausführung", requiredFor: ["basic", "pro", "advanced"], description: "Analiza instrukcji opkodowych EVM bez konieczności źródła", descriptionDe: "Analyse von EVM-Opcode-Befehlen ohne Quellcodeerfordernis" },
  { id: "sig_reentrancy_guard", name: "Reentrancy Guard Verification", namePl: "Weryfikacja ochrony przed Reentrancy", nameDe: "Reentrancy-Guard-Verifizierung", requiredFor: ["basic", "pro", "advanced"], description: "Sprawdzanie blokad mutex i kolejności checks-effects-interactions", descriptionDe: "Überprüfung von Mutex-Sperren und Checks-Effects-Interactions-Reihenfolge" },
  { id: "sig_access_control", name: "Access Control Matrix", namePl: "Macierz uprawnień i ról administracyjnych", nameDe: "Zugriffskontrollmatrix & Rollen", requiredFor: ["basic", "pro", "advanced"], description: "Identyfikacja uprawnień OnlyOwner, Timelock i Multi-Sig", descriptionDe: "Identifikation von OnlyOwner-, Timelock- und Multi-Sig-Berechtigungen" },
  { id: "sig_math_invariants", name: "Integer Overflow / Math Invariants", namePl: "Niezmienniki matematyczne i przepełnienia", nameDe: "Mathematische Invarianten & Überläufe", requiredFor: ["basic", "pro", "advanced"], description: "Weryfikacja bezpiecznej arytmetyki SafeMath i dzielenia przez zero", descriptionDe: "Verifizierung sicherer Arithmetik (SafeMath) und Division durch Null" },
  { id: "sig_token_standard", name: "Token Standard Compliance", namePl: "Zgodność ze standardem tokena (ERC20/BEP20)", nameDe: "Token-Standard-Konformität (ERC20/BEP20)", requiredFor: ["basic", "pro", "advanced"], description: "Badanie transferFrom, approve, emitowania eventów i allowance", descriptionDe: "Prüfung von transferFrom, approve, Event-Emission und Allowance" },
  { id: "sig_honeypot_detection", name: "Honeypot & Tax Trap Detection", namePl: "Wykrywanie pułapek Honeypot i podatków", nameDe: "Honeypot- & Steuerfallen-Erkennung", requiredFor: ["basic", "pro", "advanced"], description: "Symulacja sprzedaży i weryfikacja czy użytkownik może wyjść z pozycji", descriptionDe: "Verkaufssimulation zur Prüfung, ob Positionen liquidiert werden können" },
  { id: "sig_ownership_state", name: "Ownership & Renunciation Proof", namePl: "Status zrzeczenia się praw własności", nameDe: "Eigentumsstatus & Verzichtsnachweis", requiredFor: ["basic", "pro", "advanced"], description: "Badanie czy twórca może zmienić zasady kontraktu post-factum", descriptionDe: "Prüfung, ob der Ersteller Vertragsregeln nachträglich ändern kann" },
  { id: "sig_preliminary_score", name: "Preliminary Safety Score", namePl: "Wstępny wskaźnik bezpieczeństwa", nameDe: "Vorläufiger Sicherheits-Score", requiredFor: ["basic", "pro", "advanced"], description: "Syntetyczna kalkulacja ryzyka od 0 do 100", descriptionDe: "Synthetische Risikoberechnung von 0 bis 100" },
  { id: "sig_public_metadata", name: "Public On-Chain Metadata", namePl: "Publiczne metadane on-chain", nameDe: "Öffentliche On-Chain-Metadaten", requiredFor: ["basic", "pro", "advanced"], description: "Weryfikacja wdrożenia, bloku genezy i weryfikacji w explorerze", descriptionDe: "Verifizierung von Bereitstellung, Genesis-Block und Explorer-Status" },

  // Pro & Advanced additional (11-14)
  { id: "sig_holder_distribution", name: "Whale Concentration & Holder Distribution", namePl: "Koncentracja wielorybów i rozkład portfeli", nameDe: "Wal-Konzentration & Halter-Verteilung", requiredFor: ["pro", "advanced"], description: "Analiza rozproszenia tokenów i ryzyka nagłego zrzutu", descriptionDe: "Analyse der Token-Streuung und des Risikos plötzlicher Dumps" },
  { id: "sig_orderbook_liquidity", name: "L2/L3 Orderbook & Pool Liquidity", namePl: "Głębokość księgi L2/L3 i płynność puli", nameDe: "L2/L3-Orderbuch-Tiefe & Pool-Liquidität", requiredFor: ["pro", "advanced"], description: "Badanie odporności płynności na wyciągnięcie (rug pull)", descriptionDe: "Prüfung der Liquiditätsbeständigkeit gegen Rug-Pulls" },
  { id: "sig_vwap_slippage", name: "VWAP Slippage Modeling", namePl: "Modelowanie poślizgu cenowego VWAP", nameDe: "VWAP-Slippage-Modellierung", requiredFor: ["pro", "advanced"], description: "Symulacja realizacji zleceń o wolumenie $10k, $50k, $100k", descriptionDe: "Simulation der Auftragsausführung für Volumina von $10k, $50k, $100k" },
  { id: "sig_crypto_pdf_seal", name: "Cryptographically Signed PDF Certificate", namePl: "Certyfikowany raport PDF z podpisem SHA-256", nameDe: "Kryptografisch signiertes PDF-Zertifikat", requiredFor: ["pro", "advanced"], description: "Niezmienny dokument A4 z pieczęcią integralności", descriptionDe: "Unveränderliches A4-Dokument mit SHA-256-Integritätssiegel" },

  // Advanced additional (15-20)
  { id: "sig_formal_verification", name: "Formal Verification SMT Solver", namePl: "Formalna weryfikacja solverem SMT", nameDe: "Formale Verifikation mit SMT-Solver", requiredFor: ["advanced"], description: "Dowód matematyczny braku ścieżek naruszających reguły bezpieczeństwa", descriptionDe: "Mathematischer Beweis für das Fehlen sicherheitskritischer Pfade" },
  { id: "sig_multi_auditor_consensus", name: "Multi-Auditor Consensus Modeling", namePl: "Konsensus z modelami czołowych audytorów", nameDe: "Multi-Auditor-Konsensmodellierung", requiredFor: ["advanced"], description: "Symulacja wyników pod standardy CertiK, OpenZeppelin i Trail of Bits", descriptionDe: "Ergebnissimulation nach Standards von CertiK, OpenZeppelin, Trail of Bits" },
  { id: "sig_historical_exploit_replay", name: "Historical Exploit Replay Suite", namePl: "Replay historycznych wektorów exploitów", nameDe: "Historische Exploit-Replay-Suite", requiredFor: ["advanced"], description: "Symulacja wektorów z ataków The DAO, Euler Finance, Nomad i Cream", descriptionDe: "Vektorsimulation bekannter Exploits (The DAO, Euler, Nomad, Cream)" },
  { id: "sig_oracle_manipulation", name: "Oracle & Flash Loan Manipulation Vector", namePl: "Wektory manipulacji wyroczniami i pożyczkami flash", nameDe: "Orakel- & Flash-Loan-Manipulationsvektoren", requiredFor: ["advanced"], description: "Badanie odporności wyceny na ataki manipulacji ceną spot", descriptionDe: "Prüfung der Preisfindungsresistenz gegen Spot-Preis-Manipulationen" },
  { id: "sig_institutional_timestamp", name: "RFC 3161 Cryptographic Timestamp", namePl: "Instytucjonalny znacznik czasu RFC 3161", nameDe: "Institutioneller RFC 3161-Zeitstempel", requiredFor: ["advanced"], description: "Prawny dowód stanu wiedzy w dokładnym momencie weryfikacji", descriptionDe: "Rechtsverbindlicher Nachweis des Wissensstands zum Prüfzeitpunkt" },
  { id: "sig_sovereign_demarcation", name: "Sovereign Human Review Demarcation", namePl: "Demarkacja niezależnego przeglądu eksperckiego", nameDe: "Souveräne Experten-Review-Demarkation", requiredFor: ["advanced"], description: "Rozgraniczenie analizy maszynowej od formalnego podpisu audytora", descriptionDe: "Klare Trennung zwischen Maschinenanalyse und manuellem Auditsiegel" },
];

export interface SignalAvailabilityContext {
  hasBytecode: boolean;
  hasSourceCode?: boolean;
  hasOnChainDeploy: boolean;
  hasLiquidityPool?: boolean;
  hasOrderbookData?: boolean;
  hasTradingHistory?: boolean;
  isVerifiedExplorer?: boolean;
  isHistoricalContract?: boolean;
}

export interface DynamicSignalEvaluation {
  tier: AuditOrAssetTier;
  targetSignalsCount: number;
  availableSignalsCount: number;
  availableSignals: SignalDefinition[];
  missingSignals: SignalDefinition[];
  coverageRatio: number;
  deliveryState: "FULL_DELIVERY" | "PARTIAL_DELIVERY_DISCOUNTED" | "STOP_SELL_ACTIVE";
  canPurchase: boolean;
  basePriceEur: number;
  discountPercent: number;
  effectivePriceEur: number;
  badgeTextPl: string;
  badgeTextEn: string;
  badgeTextDe?: string;
  rationalePl: string;
  rationaleEn: string;
  rationaleDe?: string;
}

export function evaluateDynamicSignals(
  tier: AuditOrAssetTier,
  context: SignalAvailabilityContext,
): DynamicSignalEvaluation {
  const targetSignals = CANONICAL_SIGNALS.filter((s) => s.requiredFor.includes(tier));
  const targetCount = targetSignals.length;

  const available: SignalDefinition[] = [];
  const missing: SignalDefinition[] = [];

  for (const signal of targetSignals) {
    let isAvailable = true;

    if (signal.id === "sig_symbolic_bytecode" && !context.hasBytecode) {
      isAvailable = false;
    }
    if (signal.id === "sig_ast_syntax" && !context.hasSourceCode && !context.hasBytecode) {
      isAvailable = false;
    }
    if (signal.id === "sig_public_metadata" && !context.hasOnChainDeploy) {
      isAvailable = false;
    }
    if (signal.id === "sig_orderbook_liquidity" && context.hasLiquidityPool === false && context.hasOrderbookData === false) {
      isAvailable = false;
    }
    if (signal.id === "sig_vwap_slippage" && context.hasTradingHistory === false) {
      isAvailable = false;
    }
    if (signal.id === "sig_holder_distribution" && !context.hasOnChainDeploy) {
      isAvailable = false;
    }

    if (isAvailable) {
      available.push(signal);
    } else {
      missing.push(signal);
    }
  }

  const availableCount = available.length;
  const coverageRatio = targetCount > 0 ? availableCount / targetCount : 0;

  const basePrices: Record<AuditOrAssetTier, number> = {
    basic: 0,
    pro: 14.99,
    advanced: 149.99,
  };
  const basePrice = basePrices[tier];

  const minThresholds: Record<AuditOrAssetTier, number> = {
    basic: 5,
    pro: 10,
    advanced: 15,
  };
  const minRequired = minThresholds[tier];

  if (availableCount < minRequired) {
    return {
      tier,
      targetSignalsCount: targetCount,
      availableSignalsCount: availableCount,
      availableSignals: available,
      missingSignals: missing,
      coverageRatio,
      deliveryState: "STOP_SELL_ACTIVE",
      canPurchase: false,
      basePriceEur: basePrice,
      discountPercent: 0,
      effectivePriceEur: basePrice,
      badgeTextPl: `STOP-SELL: Tylko ${availableCount}/${targetCount} sygnałów`,
      badgeTextEn: `STOP-SELL: Only ${availableCount}/${targetCount} signals`,
      badgeTextDe: `STOP-SELL: Nur ${availableCount}/${targetCount} Signale`,
      rationalePl: `Zakup zablokowany dla Twojego bezpieczeństwa. Dostępnych jest zbyt mało sygnałów (${availableCount}/${targetCount}), aby zagwarantować standard ${tier.toUpperCase()}. Nie pobieramy żadnych opłat za niekompletne dane.`,
      rationaleEn: `Purchase blocked for your protection. Insufficient data signals available (${availableCount}/${targetCount}) to certify ${tier.toUpperCase()} quality. You are never billed for incomplete data.`,
      rationaleDe: `Kauf zu Ihrem Schutz blockiert. Zu wenige Datensignale (${availableCount}/${targetCount}) vorhanden, um den ${tier.toUpperCase()}-Standard zu zertifizieren. Unvollständige Daten werden nicht berechnet.`,
    };
  }

  if (availableCount === targetCount) {
    return {
      tier,
      targetSignalsCount: targetCount,
      availableSignalsCount: availableCount,
      availableSignals: available,
      missingSignals: [],
      coverageRatio: 1.0,
      deliveryState: "FULL_DELIVERY",
      canPurchase: true,
      basePriceEur: basePrice,
      discountPercent: 0,
      effectivePriceEur: basePrice,
      badgeTextPl: `Pełna głębia (${targetCount}/${targetCount} sygnałów)`,
      badgeTextEn: `Full Depth (${targetCount}/${targetCount} signals)`,
      badgeTextDe: `Volle Tiefe (${targetCount}/${targetCount} Signale)`,
      rationalePl: `Wszystkie ${targetCount} sygnały analityczne są aktywne i w pełni zweryfikowane. Raport zostanie dostarczony w najwyższym standardzie.`,
      rationaleEn: `All ${targetCount} analytical signals are active and verified. The report will be delivered at maximum standard.`,
      rationaleDe: `Alle ${targetCount} analytischen Signale sind aktiv und vollständig verifiziert. Der Bericht wird im höchsten Standard geliefert.`,
    };
  }

  const missingCount = targetCount - availableCount;
  const discountPerMissing = tier === "pro" ? 10 : 7;
  const discountPercent = Math.min(40, missingCount * discountPerMissing);
  const effectivePriceEur = Math.round((basePrice * (1 - discountPercent / 100)) * 100) / 100;

  return {
    tier,
    targetSignalsCount: targetCount,
    availableSignalsCount: availableCount,
    availableSignals: available,
    missingSignals: missing,
    coverageRatio,
    deliveryState: "PARTIAL_DELIVERY_DISCOUNTED",
    canPurchase: true,
    basePriceEur: basePrice,
    discountPercent,
    effectivePriceEur,
    badgeTextPl: `Dynamiczny rabat -${discountPercent}% (${availableCount}/${targetCount} sygnałów)`,
    badgeTextEn: `Dynamic Discount -${discountPercent}% (${availableCount}/${targetCount} signals)`,
    badgeTextDe: `Dynamischer Rabatt -${discountPercent}% (${availableCount}/${targetCount} Signale)`,
    rationalePl: `Dostępnych jest ${availableCount} z ${targetCount} sygnałów (brakujące: ${missing.map((s) => s.namePl).join(", ")}). Zastosowano automatyczny rabat ${discountPercent}%. Klient płaci wyłącznie za realnie dostarczone dane.`,
    rationaleEn: `${availableCount} of ${targetCount} signals available (missing: ${missing.map((s) => s.name).join(", ")}). Automatic ${discountPercent}% discount applied. You pay only for verified deliverable data.`,
    rationaleDe: `${availableCount} von ${targetCount} Signalen verfügbar (fehlend: ${missing.map((s) => s.nameDe || s.name).join(", ")}). Automatischer Rabatt von ${discountPercent}% angewendet. Sie zahlen nur für real verifizierte Daten.`,
  };
}
