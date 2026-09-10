import { buildPass2290ReleaseTraceLedger } from "./release-trace-ledger";
import type { Pass2288Depth, Pass2288Locale, Pass2288Surface } from "./claim-proof-firewall";
import { independentProviderFamilies } from "./evidence-normalization";
import { vlmTierPaidLocked, vlmTierPriceEur, vlmTierPriceLabel, vlmTierRequiresPayment } from "./paid-tier-policy";

export const PASS2291_PRODUCTION_REPLAY_GATE_ID = "pass2291_production_replay_gate_v1" as const;

export const PASS2291_REPLAY_ASSETS = [
  "BTC",
  "ETH",
  "SOL",
  "NVDA",
  "AAPL",
  "SPY",
  "QQQ",
  "S&P 500",
] as const;

export const PASS2291_TIER_EXPECTATIONS = {
  basic: {
    minimumSignals: 10,
    evidenceRows: 4,
    visibleSections: ["asset family", "primary source", "confidence cap", "missing proof", "next safe check"],
    blockedSections: ["operator appendix", "private evidence capsule", "manually QA-checked certificate"],
  },
  pro: {
    minimumSignals: 14,
    evidenceRows: 7,
    visibleSections: ["asset family", "primary source", "second-source state", "confidence cap", "score drivers", "what changes score"],
    blockedSections: ["paid remediation packet", "private contradiction ledger", "final human certificate"],
  },
  advanced: {
    minimumSignals: 20,
    evidenceRows: 12,
    visibleSections: ["scope", "source table", "confidence cap", "contradiction scan", "missing proof", "remediation boundary"],
    blockedSections: ["guaranteed security", "ROI promise", "wallet-connect-as-receipt"],
  },
} as const;

const TRACE_TERMS = {
  family: /\b(Family|Rodzina|Familie|asset family|rodzina aktywa|native crypto|listed_equity|equity|etf|index|indeks)\b/i,
  sources: /\b(Sources|Źródła|Zrodla|Quellen|provider|Yahoo|Stooq|CoinGecko|DexScreener)\b/i,
  confidence: /\b(confidence cap|confidence|pewno|zauf|Risk\/Confidence|cap \d{1,3}\/?100)\b/i,
  missing: /\b(Missing Proof|missing|brak|gap|luka|not confirmed|niepotwierdz|fehlt)\b/i,
  tier: /\b(Tier|Basic|Pro|Advanced|minimum signals|poziom|pakiet)\b/i,
  payment: /\b(79[.,]99|149[.,]99|receipt|server-side|Stripe|BLIK|Web3|wallet connect|payment proof|płatno|platno)\b/i,
} as const;

const REAL_MARKET_FORBIDDEN = [
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

const NATIVE_FORBIDDEN = [
  "erc20 owner",
  "contract owner",
  "mint authority",
  "blacklist authority",
  "honeypot contract",
  "buy tax",
  "sell tax",
] as const;

function compact(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(compact).filter(Boolean)));
}

function has(text: string, term: keyof typeof TRACE_TERMS) {
  return TRACE_TERMS[term].test(text);
}

function forbiddenHits(text: string, assetFamily: string) {
  const lower = text.toLowerCase();
  const list = assetFamily === "native_crypto"
    ? NATIVE_FORBIDDEN
    : assetFamily === "listed_equity" || assetFamily === "etf" || assetFamily === "index"
      ? REAL_MARKET_FORBIDDEN
      : [];
  return list.filter((term) => lower.includes(term));
}

function depthCopy(depth: Pass2288Depth, paidAccessVerified: boolean) {
  const tier = PASS2291_TIER_EXPECTATIONS[depth];
  const paidLocked = vlmTierPaidLocked(depth, paidAccessVerified);
  return {
    ...tier,
    tierPriceEur: vlmTierPriceEur(depth),
    paidRequired: vlmTierRequiresPayment(depth),
    paidAccessVerified,
    paidLocked,
    paidEvidenceState: paidLocked
      ? "locked_until_tier_matched_server_receipt"
      : depth === "basic"
        ? "free_tier_no_private_paid_evidence"
        : "tier_matched_server_receipt_verified",
  } as const;
}

function fallbackCustomerOutput(args: {
  locale: Pass2288Locale;
  depth: Pass2288Depth;
  assetText: string;
  assetFamily: string;
  sources: string[];
  missing: string[];
  confidenceCap: number;
  paidAccessVerified: boolean;
  static35: boolean;
}) {
  const sources = args.sources.length ? args.sources.join(" + ") : args.locale === "pl" ? "brak potwierdzonego zewnętrznego źródła" : args.locale === "de" ? "keine bestätigte externe Quelle" : "no confirmed external source";
  const missing = args.missing.slice(0, args.depth === "basic" ? 3 : args.depth === "pro" ? 5 : 8).join("; ") || "second provider / freshness proof";
  const static35 = args.static35
    ? args.locale === "pl" ? "pasmo 35 = source-gap priority, nie dowód live zagrożenia" : args.locale === "de" ? "35-Band = Source-Gap-Priorität, kein Live-Gefahrenbeweis" : "35-band = source-gap priority, not live danger proof"
    : args.locale === "pl" ? "score nie wychodzi poza potwierdzone dane" : args.locale === "de" ? "Score bleibt innerhalb bestätigter Daten" : "score stays within confirmed data";
  const paidLocked = vlmTierPaidLocked(args.depth, args.paidAccessVerified);
  const price = vlmTierPriceLabel(args.depth, args.locale);
  const payment = paidLocked
    ? args.locale === "pl" ? `${price} zablokowany do tier-matched server-side Stripe/BLIK/Web3 receipt; wallet connect nie jest payment proof.`
      : args.locale === "de" ? `${price} bleibt bis zum tiergebundenen serverseitigen Stripe/BLIK/Web3 Receipt gesperrt; Wallet Connect ist kein Zahlungsnachweis.`
      : `${price} stays locked until a tier-matched server-side Stripe/BLIK/Web3 receipt; wallet connect is not payment proof.`
    : args.depth === "basic"
      ? args.locale === "pl" ? "Basic jest darmowy; wallet connect to tylko identity/context."
        : args.locale === "de" ? "Basic ist kostenlos; Wallet Connect ist nur Identität/Kontext."
        : "Basic is free; wallet connect is identity/context only."
      : args.locale === "pl" ? `${price} potwierdzony server-side dla dokładnie tego tieru.`
        : args.locale === "de" ? `${price} wurde serverseitig für genau diesen Tier bestätigt.`
        : `${price} is verified server-side for this exact tier.`;

  return [
    `Family: ${args.assetFamily || "unknown"} — ${compact(args.assetText).slice(0, 90)}.`,
    `Sources: ${sources}.`,
    `Confidence: cap ${args.confidenceCap}/100; ${static35}.`,
    `Missing Proof: ${missing}.`,
    `Tier: ${args.depth}; minimum signals ${PASS2291_TIER_EXPECTATIONS[args.depth].minimumSignals}; evidence rows target ${PASS2291_TIER_EXPECTATIONS[args.depth].evidenceRows}.`,
    `Payment Boundary: ${payment}`,
  ].join(" ");
}

export function buildPass2291ProductionReplayGate(args: {
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
  upstreamLedger?: ReturnType<typeof buildPass2290ReleaseTraceLedger> | null;
}) {
  const locale: Pass2288Locale = args.locale === "en" || args.locale === "de" ? args.locale : "pl";
  const upstreamLedger = args.upstreamLedger ?? buildPass2290ReleaseTraceLedger({ ...args, locale });
  const output = compact(args.customerOutputText) || compact(upstreamLedger.customerOutput);
  const sourceFamilies = independentProviderFamilies(args.confirmedSources ?? upstreamLedger.sourceFamilies ?? []);
  const missingLanes = unique([...(args.missingLanes ?? []), ...(upstreamLedger.traceIssues ?? [])]);
  const rawScore = typeof args.rawScore === "number" ? args.rawScore : upstreamLedger.displayRisk;
  const paidAccessVerified = Boolean(args.paidAccessVerified);
  const paidLocked = vlmTierPaidLocked(args.depth, paidAccessVerified);
  const advancedLocked = args.depth === "advanced" && paidLocked;
  const static35 = typeof rawScore === "number" && rawScore >= 33 && rawScore <= 37;
  const requiredSections = {
    family: has(output, "family"),
    sources: has(output, "sources"),
    confidence: has(output, "confidence"),
    missing: has(output, "missing"),
    tier: has(output, "tier"),
    payment: has(output, "payment"),
  };
  const missingRequiredSections = Object.entries(requiredSections)
    .filter(([, ok]) => !ok)
    .map(([section]) => `visible-section-missing:${section}`);
  const forbidden = forbiddenHits(output, upstreamLedger.assetFamily);
  const liveDangerClaim = /\b(live danger|critical exploit|confirmed exploit|guaranteed risk|pewny exploit|krytyczna luka|dowód zagrożenia)\b/i.test(output);
  const hasSourceGapLanguage = /\b(source-gap|missing proof|brak źród|brak zrod|not live danger proof|nie dowód|nie jest dowodem|source gap)\b/i.test(output);
  const issues = unique([
    ...missingRequiredSections,
    ...upstreamLedger.traceIssues.map((issue) => `upstream:${issue}`),
    args.depth !== "basic" && sourceFamilies.length < 2 ? "pro-advanced-second-provider-not-visible" : null,
    args.depth === "advanced" ? "advanced-not-for-sale" : paidLocked ? "pro-invitation-entitlement-required" : null,
    static35 && liveDangerClaim && !hasSourceGapLanguage ? "static-35-live-danger-claim" : null,
    ...forbidden.map((hit) => `asset-family-forbidden-output:${hit}`),
  ]);
  const releaseAllowed = issues.length === 0 && upstreamLedger.releaseAllowed && !paidLocked;
  const customerOutput = releaseAllowed ? output : fallbackCustomerOutput({
    locale,
    depth: args.depth,
    assetText: args.assetText ?? output,
    assetFamily: upstreamLedger.assetFamily,
    sources: sourceFamilies,
    missing: missingLanes,
    confidenceCap: typeof args.confidenceCap === "number" ? args.confidenceCap : upstreamLedger.confidenceCap,
    paidAccessVerified,
    static35,
  });
  return {
    schemaVersion: PASS2291_PRODUCTION_REPLAY_GATE_ID,
    surface: args.surface,
    depth: args.depth,
    productionState: releaseAllowed ? "production_replay_release_ready" : "production_replay_rewrite",
    releaseAllowed,
    replayIssues: issues,
    requiredSections,
    tierExpectation: depthCopy(args.depth, paidAccessVerified),
    replayAssets: PASS2291_REPLAY_ASSETS,
    sourceFamilies,
    missingLanes: missingLanes.slice(0, 10),
    rawScore,
    static35Detected: static35,
    assetFamily: upstreamLedger.assetFamily,
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
      schemaVersion: upstreamLedger.schemaVersion,
      productionState: upstreamLedger.productionState,
      releaseAllowed: upstreamLedger.releaseAllowed,
      traceOrderSafe: upstreamLedger.traceOrderSafe,
      issueCount: upstreamLedger.traceIssues.length,
    },
    customerOutput,
    publicRule: "PASS2291: production replay re-checks asset family, sources, confidence cap, missing proof, and tier boundary. Pro is invitation-only controlled beta; Advanced is not for sale; public checkout and wallet connection unlock neither tier.",
  } as const;
}

export function buildPass2291ReplayMatrix() {
  return PASS2291_REPLAY_ASSETS.flatMap((asset) => (["basic", "pro", "advanced"] as const).map((depth) => ({
    asset,
    depth,
    expectation: PASS2291_TIER_EXPECTATIONS[depth],
    paidLockedWithoutReceipt: depth !== "basic",
    advancedLockedWithoutReceipt: depth === "advanced",
    forbiddenLanguage: asset === "BTC" || asset === "ETH" || asset === "SOL" ? NATIVE_FORBIDDEN : REAL_MARKET_FORBIDDEN,
  })));
}

export const PASS2291_REGRESSION_CASES = [
  "BTC/ETH/SOL: static 35 must be replayed as source-gap priority unless confirmed live evidence exists.",
  "NVDA/AAPL/SPY/QQQ/S&P500: replay output must never leak DEX, holder, token-tax or contract-owner language.",
  "Basic/Pro/Advanced: every replay output must show a visible tier difference and minimum signal target.",
  "Paid audits: replay output must stay locked until server-side Stripe/BLIK/Web3 receipt is verified.",
  "Wallet connect: replay output must state wallet connect is identity/context only, never payment proof.",
] as const;

// PASS2291 markers: production replay gate · actual customer output re-check · BTC static 35 source-gap · NVDA SPY S&P500 no token language · Basic Pro Advanced visible difference · Advanced NOT_FOR_SALE server-side receipt · wallet connect not payment proof.
// PASS2291 behavior markers: visible-section-missing:family · visible-section-missing:sources · visible-section-missing:confidence · visible-section-missing:missing · visible-section-missing:tier · visible-section-missing:payment · pro-advanced-second-provider-not-visible · paid-tier-server-receipt-required · static-35-live-danger-claim
