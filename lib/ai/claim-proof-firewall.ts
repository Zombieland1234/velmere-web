import { independentProviderFamilies } from "@/lib/ai/evidence-normalization";
import { vlmTierPaidLocked } from "@/lib/ai/paid-tier-policy";

export const PASS2288_CLAIM_PROOF_FIREWALL_ID = "pass2288_claim_proof_firewall_v1" as const;

export type Pass2288Depth = "basic" | "pro" | "advanced";
export type Pass2288Surface = "pdf" | "shield" | "real_markets" | "angel" | "checkout" | "lens";
export type Pass2288Locale = "pl" | "en" | "de";
export type Pass2288AssetFamily = "native_crypto" | "listed_equity" | "etf" | "index" | "contract_token" | "unknown";

const NATIVE_CRYPTO = /\b(btc|bitcoin|eth|ethereum|sol|solana|bnb)\b/i;
const EQUITY = /\b(nvda|nvidia|aapl|apple|msft|microsoft|googl|google|alphabet|tsla|tesla|amzn|amazon|meta)\b/i;
const ETF = /\b(spy|spdr|qqq|voo|etf)\b/i;
const INDEX = /s\s*&\s*p\s*500|s&p500|sp500|\^gspc|gspc|nasdaq\s*100|\^ndx|dax|vix/i;
const CONTRACT_TOKEN = /0x[a-f0-9]{40}|erc20|token\s+contract|smart\s+contract/i;

const BLOCKED_REAL_MARKET_CLAIMS = [
  "dex",
  "liquidity pool",
  "wallet holders",
  "token tax",
  "transfer tax",
  "honeypot",
  "contract owner",
  "mint authority",
  "blacklist",
];

const BLOCKED_NATIVE_CLAIMS = [
  "erc20 owner",
  "sell tax",
  "buy tax",
  "honeypot",
  "mint authority",
  "blacklist",
  "contract owner",
];

const ADVANCED_LEAK_TERMS = [
  "full evidence ledger",
  "raw source ledger",
  "operator appendix",
  "proof capsule",
  "contradiction scan",
  "pełny evidence ledger",
  "pełny raport advanced",
  "załącznik operatora",
  "vollständiger evidence ledger",
  "operator-anhang",
];

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => clean(value)).filter(Boolean)));
}

function clampPercent(value: unknown, fallback = 0) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}


export function detectPass2288AssetFamily(assetText: string): { family: Pass2288AssetFamily; label: string; blockedClaims: string[] } {
  const text = clean(assetText);
  if (NATIVE_CRYPTO.test(text)) return { family: "native_crypto", label: text || "native crypto", blockedClaims: BLOCKED_NATIVE_CLAIMS };
  if (INDEX.test(text)) return { family: "index", label: text || "index", blockedClaims: BLOCKED_REAL_MARKET_CLAIMS };
  if (ETF.test(text)) return { family: "etf", label: text || "ETF", blockedClaims: BLOCKED_REAL_MARKET_CLAIMS };
  if (EQUITY.test(text)) return { family: "listed_equity", label: text || "listed equity", blockedClaims: BLOCKED_REAL_MARKET_CLAIMS };
  if (CONTRACT_TOKEN.test(text)) return { family: "contract_token", label: text || "contract token", blockedClaims: ["guaranteed safe", "guaranteed profit", "final verdict without sources"] };
  return { family: "unknown", label: text || "unknown asset", blockedClaims: ["guaranteed safe", "guaranteed profit", "wallet connect proves payment", "autonomous model learning", "continual weight updates"] };
}

function hasVisibleSection(text: string, re: RegExp) {
  return re.test(text.toLowerCase());
}

function phraseHits(text: string, phrases: readonly string[]) {
  const lower = text.toLowerCase();
  return phrases.filter((phrase) => lower.includes(phrase.toLowerCase()));
}

function localeLabel(locale: Pass2288Locale, family: Pass2288AssetFamily) {
  if (locale === "pl") {
    if (family === "native_crypto") return "native crypto";
    if (family === "listed_equity") return "akcja giełdowa";
    if (family === "contract_token") return "token kontraktowy";
    if (family === "index") return "indeks";
    if (family === "etf") return "ETF";
    return "niepotwierdzone aktywo";
  }
  if (locale === "de") {
    if (family === "listed_equity") return "boersennotierte Aktie";
    if (family === "native_crypto") return "native Crypto";
    if (family === "contract_token") return "Contract Token";
    return family.replace(/_/g, " ");
  }
  return family.replace(/_/g, " ");
}

function rewriteText(args: {
  locale: Pass2288Locale;
  depth: Pass2288Depth;
  assetFamily: Pass2288AssetFamily;
  assetLabel: string;
  sourceFamilies: string[];
  missingLanes: string[];
  riskScore: number | null;
  confidenceCap: number;
  static35Detected: boolean;
  paidLocked: boolean;
  secondProviderConfirmed: boolean;
}) {
  const sources = args.sourceFamilies.length ? args.sourceFamilies.join(" + ") : args.locale === "pl" ? "źródło zewnętrzne niepotwierdzone" : args.locale === "de" ? "externe Quelle nicht bestätigt" : "external source not confirmed";
  const missing = args.missingLanes.slice(0, args.depth === "basic" ? 3 : args.depth === "pro" ? 5 : 7).join("; ") || (args.locale === "pl" ? "ujawnij source gaps per lane" : args.locale === "de" ? "Source-Gaps je Lane offenlegen" : "show source gaps per lane");
  const score = args.riskScore === null ? "source-capped" : `${args.riskScore}/100`;
  if (args.locale === "de") {
    return [
      `Familie: ${localeLabel(args.locale, args.assetFamily)} — ${args.assetLabel.slice(0, 80)}.`,
      `Quellen: ${sources}; zweite unabhängige Quelle: ${args.secondProviderConfirmed ? "bestätigt" : "nicht bestätigt"}.`,
      `Risk vs confidence: Score ${score}; Confidence-Cap ${args.confidenceCap}/100.`,
      `Gaps zuerst: ${missing}.`,
      args.static35Detected ? "35-Band wird als Source-Gap-Priorität behandelt, nicht als Live-Gefahrenbeweis." : "Keine starke These über die Daten hinaus.",
      args.paidLocked ? (args.depth === "advanced" ? "Advanced ist nicht zum Verkauf und kann nicht freigeschaltet werden." : "Pro bleibt ohne servergebundene Einladung gesperrt; öffentlicher Checkout und Wallet Connect schalten nichts frei.") : "Kontrollierte Evidence ist nur im aktuellen servergebundenen Zugangsrahmen erlaubt.",
    ].join(" ");
  }
  if (args.locale === "en") {
    return [
      `Family: ${localeLabel(args.locale, args.assetFamily)} — ${args.assetLabel.slice(0, 80)}.`,
      `Sources: ${sources}; second independent source: ${args.secondProviderConfirmed ? "confirmed" : "not confirmed"}.`,
      `Risk vs confidence: score ${score}; confidence cap ${args.confidenceCap}/100.`,
      `Gaps first: ${missing}.`,
      args.static35Detected ? "The 35 band is treated as a source-gap priority, not live danger proof." : "No claim is stronger than the available data.",
      args.paidLocked ? (args.depth === "advanced" ? "Advanced is not for sale and cannot be unlocked." : "Pro stays locked without a server-bound invitation; public checkout and wallet connection unlock nothing.") : "Controlled evidence is allowed only within the current server-bound access scope.",
    ].join(" ");
  }
  return [
    `Rodzina: ${localeLabel(args.locale, args.assetFamily)} — ${args.assetLabel.slice(0, 80)}.`,
    `Źródła: ${sources}; drugi niezależny provider: ${args.secondProviderConfirmed ? "potwierdzony" : "niepotwierdzony"}.`,
    `Risk vs confidence: score ${score}; confidence cap ${args.confidenceCap}/100.`,
    `Najpierw luki: ${missing}.`,
    args.static35Detected ? "Pasmo 35 traktuję jako source-gap priority, nie jako live dowód zagrożenia." : "Nie podaję mocniejszej tezy niż pozwalają dane.",
    args.paidLocked ? (args.depth === "advanced" ? "Advanced nie jest na sprzedaż i nie może zostać odblokowany." : "Pro pozostaje zablokowane bez zaproszenia powiązanego z serwerem; publiczny checkout i wallet connect niczego nie odblokowują.") : "Kontrolowane evidence wolno pokazać wyłącznie w bieżącym, serwerowo związanym zakresie dostępu.",
  ].join(" ");
}

export function buildPass2288ClaimProofFirewall(args: {
  locale?: Pass2288Locale | null;
  surface: Pass2288Surface;
  depth: Pass2288Depth;
  assetText?: string | null;
  confirmedSources?: string[] | null;
  missingLanes?: string[] | null;
  rawScore?: number | null;
  confidenceCap?: number | null;
  paidAccessVerified?: boolean | null;
  customerOutputText?: string | null;
}) {
  const locale: Pass2288Locale = args.locale === "en" || args.locale === "de" ? args.locale : "pl";
  const asset = detectPass2288AssetFamily(clean(args.assetText));
  const sourceFamilies = independentProviderFamilies(args.confirmedSources);
  const secondProviderConfirmed = sourceFamilies.length >= 2;
  const rawMissing = unique(args.missingLanes ?? []);
  const missingLanes = unique([
    ...rawMissing,
    sourceFamilies.length ? null : "external primary source lane not confirmed",
    args.depth !== "basic" && !secondProviderConfirmed ? "independent second provider missing" : null,
  ]).slice(0, 18);
  const rawScore = typeof args.rawScore === "number" && Number.isFinite(args.rawScore) ? clampPercent(args.rawScore) : null;
  const static35Detected = rawScore !== null && rawScore >= 33 && rawScore <= 37;
  const confidenceCap = typeof args.confidenceCap === "number" && Number.isFinite(args.confidenceCap)
    ? clampPercent(args.confidenceCap)
    : clampPercent(40 + sourceFamilies.length * 16 - Math.min(missingLanes.length, 8) * 3, 42);
  const paidLocked = vlmTierPaidLocked(args.depth, args.paidAccessVerified);
  const advancedLocked = args.depth === "advanced" && paidLocked;
  const output = clean(args.customerOutputText);
  const forbiddenClaimHits = phraseHits(output, asset.blockedClaims);
  const advancedLeakHits = paidLocked ? phraseHits(output, ADVANCED_LEAK_TERMS) : [];
  const missingProofSections = [
    hasVisibleSection(output, /source|źród|zrodl|quelle|provider|yahoo|stooq|coingecko|binance|dexscreener/) ? null : "source ledger not visible",
    hasVisibleSection(output, /confidence|pewno|zauf|vertrauen|cap/) ? null : "confidence cap not visible",
    hasVisibleSection(output, /missing|brak|gap|luka|fehlt|not confirmed|niepotwierdz/) ? null : "missing lanes not visible",
    hasVisibleSection(output, /wallet connect|payment|płatno|platno|receipt|stripe|web3|79[.,]99|149[.,]99|entitlement/) ? null : "payment/receipt boundary not visible",
  ].filter(Boolean) as string[];
  const sourceGap = sourceFamilies.length === 0 || (args.depth !== "basic" && !secondProviderConfirmed);
  const displayRisk = static35Detected && (sourceGap || confidenceCap < 75)
    ? asset.family === "native_crypto" ? 22
      : asset.family === "listed_equity" ? 24
        : asset.family === "etf" || asset.family === "index" ? 26
          : rawScore
    : rawScore;
  const issues = unique([
    ...forbiddenClaimHits.map((hit) => `forbidden-claim:${hit}`),
    ...advancedLeakHits.map((hit) => `advanced-leak:${hit}`),
    ...missingProofSections,
    sourceGap ? "source-family-gap" : null,
    static35Detected ? "static-35-reframed" : null,
    args.depth === "advanced" ? "advanced-not-for-sale" : paidLocked ? "pro-invitation-required" : null,
  ]);
  const rewritten = issues.length > 0;
  const customerOutput = rewritten
    ? rewriteText({
        locale,
        depth: args.depth,
        assetFamily: asset.family,
        assetLabel: asset.label,
        sourceFamilies,
        missingLanes,
        riskScore: displayRisk,
        confidenceCap,
        static35Detected,
        paidLocked,
        secondProviderConfirmed,
      })
    : output;
  return {
    schemaVersion: PASS2288_CLAIM_PROOF_FIREWALL_ID,
    surface: args.surface,
    depth: args.depth,
    assetFamily: asset.family,
    assetLabel: asset.label,
    sourceFamilies,
    secondProviderConfirmed,
    missingLanes,
    rawScore,
    displayRisk,
    confidenceCap,
    static35Detected,
    paidAccessVerified: Boolean(args.paidAccessVerified),
    paidLocked,
    advancedLocked,
    forbiddenClaimHits,
    advancedLeakHits,
    missingProofSections,
    issues,
    rewritten,
    customerOutput,
    productionState: issues.length === 0 ? "customer_ready" : args.depth === "advanced" ? "not_for_sale_rewrite" : paidLocked ? "invitation_locked_rewrite" : sourceGap ? "source_gap_rewrite" : "claim_proof_rewrite",
    publicRule: "PASS2288: no customer-visible verdict may outrun source proof. Pro is invitation-only controlled beta; Advanced is not for sale; public checkout and wallet connection unlock neither tier.",
  } as const;
}

export function buildPass2288AngelDirective(locale: Pass2288Locale = "pl") {
  if (locale === "de") {
    return "PASS2288: Vor dem Verdict müssen Asset-Familie, Quellenfamilien, fehlende Lanes, Confidence-Cap und Pro invitation-only beta-/Advanced NOT_FOR_SALE-Receipt-Grenze sichtbar sein; keine Token-Claims für Aktien/Indizes/ETFs.";
  }
  if (locale === "en") {
    return "PASS2288: before verdict, show asset family, source families, missing lanes, confidence cap and Pro invitation-only beta / Advanced not for sale receipt boundary; no token claims for equities/indices/ETFs.";
  }
  return "PASS2288: przed werdyktem pokaż rodzinę aktywa, rodziny źródeł, missing lanes, confidence cap i granicę tier-matched receipt Pro Beta nur auf Einladung / Advanced nicht zum Verkauf; bez tokenowych claimów dla akcji/indeksów/ETF.";
}

export const PASS2288_REGRESSION_CASES = [
  "BTC Basic/Pro/Advanced: no ERC20/admin/honeypot without contract scope; static 35 is source-gap review.",
  "NVDA and AAPL: no DEX, wallet holders, token tax or liquidity-pool language.",
  "SPY/QQQ/S&P 500: show index/ETF source cadence and second-provider gap before verdict.",
  "Pro requires server-bound invitation access; Advanced is not for sale. Public payment and wallet markers do not unlock controlled evidence.",
  "Wallet connect: identity/context only, never payment proof.",
] as const;
