import {
  buildPass2289CustomerReleaseGate,
  PASS2289_REQUIRED_VISIBLE_SECTIONS,
} from "./customer-release-gate";
import type { Pass2288Depth, Pass2288Locale, Pass2288Surface } from "./claim-proof-firewall";
import { vlmTierPaidLocked, vlmTierPriceEur, vlmTierPriceLabel, vlmTierRequiresPayment } from "./paid-tier-policy";

export const PASS2290_RELEASE_TRACE_LEDGER_ID = "pass2290_release_trace_ledger_v1" as const;

export const PASS2290_REQUIRED_TRACE_ORDER = [
  "asset-family",
  "sources",
  "confidence",
  "missing-proof",
  "tier-boundary",
  "payment-boundary",
] as const;

type Pass2290TraceSection = (typeof PASS2290_REQUIRED_TRACE_ORDER)[number];

type Pass2289Gate = ReturnType<typeof buildPass2289CustomerReleaseGate>;

const TRACE_SECTION_TESTS: Record<Pass2290TraceSection, RegExp> = {
  "asset-family": /\b(scope|family|rodzina|familie|asset|aktywo|index|indeks|etf|native crypto|akcja|equity)\b/i,
  sources: /\b(sources|źródła|zrodla|source|quelle|provider|yahoo|stooq|coingecko|binance|dexscreener)\b/i,
  confidence: /\b(confidence|pewno|zauf|vertrauen|cap|risk\/confidence|risk vs confidence)\b/i,
  "missing-proof": /\b(missing proof|missing|brak|gap|luka|fehlt|not confirmed|niepotwierdz)\b/i,
  "tier-boundary": /\b(tier|basic|pro|advanced|poziom|pakiet|warstwa|audit)\b/i,
  "payment-boundary": /\b(79[.,]99|149[.,]99|receipt|stripe|blik|web3|płatno|platno|payment|wallet connect|entitlement)\b/i,
};

const REAL_MARKET_BLOCKED_TERMS = [
  "dex liquidity",
  "liquidity pool",
  "wallet holders",
  "holder concentration",
  "token tax",
  "buy tax",
  "sell tax",
  "honeypot",
  "contract owner",
  "mint authority",
] as const;

const NATIVE_CRYPTO_BLOCKED_TERMS = [
  "erc20 owner",
  "contract owner",
  "mint authority",
  "blacklist authority",
  "honeypot contract",
  "buy tax",
  "sell tax",
] as const;

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => clean(value)).filter(Boolean)));
}

function containsAny(text: string, terms: readonly string[]) {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase()));
}

function sectionIndex(text: string, section: Pass2290TraceSection) {
  const match = TRACE_SECTION_TESTS[section].exec(text);
  return match?.index ?? -1;
}

function visibleSectionOrder(text: string) {
  return PASS2290_REQUIRED_TRACE_ORDER.map((section) => ({ section, index: sectionIndex(text, section) }));
}

function missingTraceSections(text: string) {
  return visibleSectionOrder(text)
    .filter((entry) => entry.index < 0)
    .map((entry) => entry.section);
}

function isTraceOrderSafe(text: string) {
  const present = visibleSectionOrder(text).filter((entry) => entry.index >= 0);
  return present.every((entry, index) => index === 0 || present[index - 1].index <= entry.index);
}

function tierProfile(depth: Pass2288Depth, verified: boolean) {
  if (depth === "basic") {
    return {
      label: "Basic",
      minimumSignals: 10,
      visibleScope: "free preview: family, primary source, confidence cap, top missing proof, next safe check",
      advancedEvidenceVisible: false,
      releaseRule: "Basic can be public only as a cautious preview with no private evidence ledger.",
    } as const;
  }
  if (depth === "pro") {
    return {
      label: "Pro",
      minimumSignals: 14,
      visibleScope: verified
        ? "controlled Pro beta mode: second-provider state, scenario, confidence cap and score-change conditions"
        : "locked Pro preview until tier-matched server-side receipt",
      advancedEvidenceVisible: false,
      releaseRule: "Pro is an invitation-only controlled beta; it requires server-bound invitation entitlement and internal quality control, with no public checkout.",
    } as const;
  }
  return {
    label: "Advanced",
    minimumSignals: 20,
    visibleScope: verified
      ? "controlled evidence mode: source table, contradiction scan, remediation plan and operator-safe summary"
      : "locked paid mode: preview only until server-side Stripe/BLIK/Web3 receipt",
    advancedEvidenceVisible: verified,
    releaseRule: "Advanced is not for sale and cannot be unlocked by a payment receipt, entitlement, wallet connection, or legacy product identifier.",
  } as const;
}

function familyCopy(locale: Pass2288Locale, family: string, asset: string) {
  if (locale === "de") return `Familie: ${family || "unknown"} — ${asset.slice(0, 90)}.`;
  if (locale === "en") return `Family: ${family || "unknown"} — ${asset.slice(0, 90)}.`;
  return `Rodzina: ${family || "unknown"} — ${asset.slice(0, 90)}.`;
}

function sourcesCopy(locale: Pass2288Locale, sources: string[], secondProvider: boolean) {
  const sourceText = sources.length ? sources.join(" + ") : locale === "pl" ? "zewnętrzne źródło niepotwierdzone" : locale === "de" ? "externe Quelle nicht bestätigt" : "external source not confirmed";
  if (locale === "de") return `Quellen: ${sourceText}; zweite Quelle: ${secondProvider ? "bestätigt" : "nicht bestätigt"}.`;
  if (locale === "en") return `Sources: ${sourceText}; second source: ${secondProvider ? "confirmed" : "not confirmed"}.`;
  return `Źródła: ${sourceText}; drugi provider: ${secondProvider ? "potwierdzony" : "niepotwierdzony"}.`;
}

function confidenceCopy(locale: Pass2288Locale, displayRisk: number | null, confidenceCap: number, static35: boolean) {
  const score = displayRisk === null ? "source-capped" : `${displayRisk}/100`;
  if (locale === "de") return `Risk/Confidence: Score ${score}; Confidence-Cap ${confidenceCap}/100; ${static35 ? "35-Band = Source-Gap-Priorität, kein Live-Gefahrenbeweis" : "keine These stärker als die Daten"}.`;
  if (locale === "en") return `Risk/Confidence: score ${score}; confidence cap ${confidenceCap}/100; ${static35 ? "35-band = source-gap priority, not live danger proof" : "no claim stronger than data"}.`;
  return `Risk/Confidence: score ${score}; confidence cap ${confidenceCap}/100; ${static35 ? "pasmo 35 = source-gap priority, nie live dowód zagrożenia" : "brak mocniejszej tezy niż dane"}.`;
}

function missingCopy(locale: Pass2288Locale, missingLanes: string[], depth: Pass2288Depth) {
  const limit = depth === "basic" ? 3 : depth === "pro" ? 5 : 8;
  const text = missingLanes.slice(0, limit).join("; ") || (locale === "pl" ? "brak lane do ujawnienia" : locale === "de" ? "keine Lane sichtbar" : "no lane visible");
  if (locale === "de") return `Missing Proof: ${text}.`;
  if (locale === "en") return `Missing Proof: ${text}.`;
  return `Missing Proof: ${text}.`;
}

function tierCopy(locale: Pass2288Locale, profile: ReturnType<typeof tierProfile>) {
  if (locale === "de") return `Tier: ${profile.label}; minimum signals ${profile.minimumSignals}; ${profile.visibleScope}.`;
  if (locale === "en") return `Tier: ${profile.label}; minimum signals ${profile.minimumSignals}; ${profile.visibleScope}.`;
  return `Tier: ${profile.label}; minimum signals ${profile.minimumSignals}; ${profile.visibleScope}.`;
}

function paymentCopy(locale: Pass2288Locale, depth: Pass2288Depth, verified: boolean) {
  const paidLocked = vlmTierPaidLocked(depth, verified);
  const price = vlmTierPriceLabel(depth, locale);
  if (locale === "de") {
    return paidLocked
      ? `Payment Boundary: ${price} bleibt gesperrt, bis das tiergebundene serverseitige Stripe/BLIK/Web3 Receipt bestätigt ist; Wallet Connect ist kein Zahlungsnachweis.`
      : depth === "basic"
        ? "Payment Boundary: Basic ist kostenlos; Wallet Connect ist Identität/Kontext und kein Zahlungsnachweis."
        : `Payment Boundary: ${price} wurde serverseitig für genau diesen Tier bestätigt; Wallet Connect allein reicht nie aus.`;
  }
  if (locale === "en") {
    return paidLocked
      ? `Payment Boundary: ${price} stays locked until the tier-matched server-side Stripe/BLIK/Web3 receipt is verified; wallet connect is not payment proof.`
      : depth === "basic"
        ? "Payment Boundary: Basic is free; wallet connect is identity/context and not payment proof."
        : `Payment Boundary: ${price} is verified server-side for this exact tier; wallet connect alone is never sufficient.`;
  }
  return paidLocked
    ? `Payment Boundary: ${price} pozostaje zablokowany do potwierdzenia tier-matched server-side Stripe/BLIK/Web3 receipt; wallet connect nie jest dowodem płatności.`
    : depth === "basic"
      ? "Payment Boundary: Basic jest darmowy; wallet connect to identity/context, nie dowód płatności."
      : `Payment Boundary: ${price} został potwierdzony server-side dla dokładnie tego tieru; sam wallet connect nigdy nie wystarcza.`;
}

function nextCopy(locale: Pass2288Locale) {
  if (locale === "de") return "Next: run live preview/localhost replay before claiming production payment or wallet confirmation.";
  if (locale === "en") return "Next: run live preview/localhost replay before claiming production payment or wallet confirmation.";
  return "Next: uruchom live preview/localhost replay zanim oznaczysz płatność lub wallet confirmation jako produkcyjne.";
}

function buildTraceCopy(args: {
  locale: Pass2288Locale;
  depth: Pass2288Depth;
  assetText: string;
  gate: Pass2289Gate;
  paidAccessVerified: boolean;
}) {
  const profile = tierProfile(args.depth, args.paidAccessVerified);
  return [
    familyCopy(args.locale, args.gate.assetFamily, args.assetText),
    sourcesCopy(args.locale, args.gate.sourceFamilies, args.gate.secondProviderConfirmed),
    confidenceCopy(args.locale, args.gate.displayRisk, args.gate.confidenceCap, args.gate.static35Detected),
    missingCopy(args.locale, args.gate.releaseIssues, args.depth),
    tierCopy(args.locale, profile),
    paymentCopy(args.locale, args.depth, args.paidAccessVerified),
    nextCopy(args.locale),
  ].join(" ");
}

export function buildPass2290ReleaseTraceLedger(args: {
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
  upstreamGate?: Pass2289Gate | null;
}) {
  const locale: Pass2288Locale = args.locale === "en" || args.locale === "de" ? args.locale : "pl";
  const gate = args.upstreamGate ?? buildPass2289CustomerReleaseGate({ ...args, locale });
  const sourceText = clean(args.customerOutputText) || clean(gate.customerOutput);
  const missingSections = missingTraceSections(sourceText);
  const orderSafe = isTraceOrderSafe(sourceText);
  const paidAccessVerified = Boolean(args.paidAccessVerified);
  const paidLocked = vlmTierPaidLocked(args.depth, paidAccessVerified);
  const advancedLocked = args.depth === "advanced" && paidLocked;
  const profile = tierProfile(args.depth, paidAccessVerified);
  const assetFamily = clean(gate.assetFamily);
  const blockedHits = assetFamily === "native_crypto"
    ? containsAny(sourceText, NATIVE_CRYPTO_BLOCKED_TERMS)
    : assetFamily === "listed_equity" || assetFamily === "etf" || assetFamily === "index"
      ? containsAny(sourceText, REAL_MARKET_BLOCKED_TERMS)
      : [];
  const traceIssues = unique([
    ...gate.releaseIssues.map((issue) => `upstream:${issue}`),
    ...missingSections.map((section) => `trace-missing:${section}`),
    orderSafe ? null : "trace-order-not-customer-safe",
    args.depth !== "basic" && !gate.secondProviderConfirmed ? "tier-second-provider-gap" : null,
    args.depth === "advanced" ? "advanced-not-for-sale" : paidLocked ? "pro-invitation-entitlement-required" : null,
    ...blockedHits.map((hit) => `asset-family-blocked-term:${hit}`),
  ]);
  const releaseAllowed = gate.releaseAllowed && orderSafe && missingSections.length === 0 && traceIssues.length === 0 && !paidLocked;
  const customerOutput = releaseAllowed
    ? sourceText
    : buildTraceCopy({
        locale,
        depth: args.depth,
        assetText: clean(args.assetText) || "unknown asset",
        gate,
        paidAccessVerified,
      });
  return {
    schemaVersion: PASS2290_RELEASE_TRACE_LEDGER_ID,
    surface: args.surface,
    depth: args.depth,
    productionState: releaseAllowed ? "release_trace_ready" : "release_trace_rewrite",
    releaseAllowed,
    traceIssues,
    missingTraceSections: missingSections,
    traceOrderSafe: orderSafe,
    requiredTraceOrder: PASS2290_REQUIRED_TRACE_ORDER,
    requiredVisibleSections: PASS2290_REQUIRED_TRACE_ORDER as unknown as typeof PASS2289_REQUIRED_VISIBLE_SECTIONS,
    assetFamily: gate.assetFamily,
    sourceFamilies: gate.sourceFamilies,
    secondProviderConfirmed: gate.secondProviderConfirmed,
    displayRisk: gate.displayRisk,
    confidenceCap: gate.confidenceCap,
    static35Detected: gate.static35Detected,
    tierProfile: profile,
    tierPriceEur: vlmTierPriceEur(args.depth),
    paidRequired: vlmTierRequiresPayment(args.depth),
    paidAccessVerified,
    paidLocked,
    advancedLocked,
    paymentProofState: paidLocked
      ? "tier_matched_server_receipt_required"
      : args.depth === "basic"
        ? "free_tier_no_payment_required"
        : "tier_matched_server_receipt_verified",
    upstream: {
      schemaVersion: gate.schemaVersion,
      productionState: gate.productionState,
      releaseAllowed: gate.releaseAllowed,
      issueCount: gate.releaseIssues.length,
    },
    customerOutput,
    publicRule: "PASS2290: customer release requires ordered trace lines: asset family → sources → confidence → missing proof → tier boundary. Pro is invitation-only controlled beta; Advanced is not for sale; public checkout and wallet connect never unlock them.",
  } as const;
}

export const PASS2290_REGRESSION_CASES = [
  "BTC/ETH/SOL: if risk is 33-37 and source proof is weak, final output must say source-gap priority, not live danger proof.",
  "NVDA/AAPL/SPY/QQQ/S&P500: final customer text must not mention DEX liquidity, wallet holders, token tax or contract owner unless the user explicitly supplied a tokenized contract scope.",
  "PDF Basic/Pro/Advanced: final preview must use ordered trace lines and Pro and Advanced evidence stay locked without their tier-matched server-side Stripe/BLIK/Web3 receipt.",
  "Shield Basic/Pro/Advanced: final ai.output must be pass2290ReleaseTraceLedger.customerOutput, not raw provider prose.",
  "Angel paid audits: final reply must show payment boundary and never treat wallet connect as receipt.",
] as const;

// PASS2290 markers: release trace ledger · ordered visible sections · tier profile · static 35 source-gap · Advanced NOT_FOR_SALE server-side receipt · wallet connect not payment proof.
// PASS2290 behavior markers: trace-missing:asset-family · trace-missing:sources · trace-missing:confidence · trace-missing:missing-proof · trace-missing:tier-boundary · trace-missing:payment-boundary · trace-order-not-customer-safe · paid-tier-server-receipt-required
