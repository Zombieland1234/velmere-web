import { buildPass2288ClaimProofFirewall, type Pass2288Depth, type Pass2288Locale, type Pass2288Surface } from "./claim-proof-firewall";
import { vlmTierPaidLocked, vlmTierPriceEur, vlmTierPriceLabel, vlmTierRequiresPayment } from "./paid-tier-policy";

export const PASS2289_CUSTOMER_RELEASE_GATE_ID = "pass2289_customer_release_gate_v1" as const;

export const PASS2289_REQUIRED_VISIBLE_SECTIONS = ["asset-family", "sources", "confidence", "missing-proof", "payment-boundary"] as const;

// Behavior markers: missing-section:asset-family, missing-section:sources, missing-section:confidence, missing-section:missing-proof, missing-section:payment-boundary, pro-or-advanced-second-provider-gap, paid-tier-receipt-required.
const SECTION_TESTS = [
  { id: "asset-family", re: /rodzina|family|familie|asset|aktywo|index|indeks|etf|native crypto|akcja|equity/i },
  { id: "sources", re: /źród|zrodl|source|quelle|provider|yahoo|stooq|coingecko|binance|dexscreener/i },
  { id: "confidence", re: /confidence|pewno|zauf|vertrauen|cap|risk vs confidence/i },
  { id: "missing-proof", re: /missing|brak|gap|luka|fehlt|not confirmed|niepotwierdz|niepotwierdzony/i },
  { id: "payment-boundary", re: /79[.,]99|149[.,]99|receipt|stripe|web3|płatno|platno|payment|wallet connect|entitlement/i },
] as const;

const FORBIDDEN_RELEASE_TERMS = [
  "guaranteed safe",
  "guaranteed profit",
  "pewny zysk",
  "gwarantowany zysk",
  "100% safe",
  "final verdict without sources",
  "wallet connect proves payment",
  "wallet connect is payment proof",
  "advanced unlocked by wallet connect",
  "DEX liquidity for NVDA",
  "wallet holders for NVDA",
  "token tax for S&P 500",
  "holder concentration for SPY",
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

function sourceCopy(locale: Pass2288Locale, sources: string[], secondProvider: boolean) {
  if (sources.length === 0) {
    if (locale === "de") return "externe Quelle nicht bestätigt; zweiter Provider nicht bestätigt";
    if (locale === "en") return "external source not confirmed; second provider not confirmed";
    return "źródło zewnętrzne niepotwierdzone; drugi provider niepotwierdzony";
  }
  const joined = sources.join(" + ");
  if (locale === "de") return `${joined}; zweiter Provider: ${secondProvider ? "bestätigt" : "nicht bestätigt"}`;
  if (locale === "en") return `${joined}; second provider: ${secondProvider ? "confirmed" : "not confirmed"}`;
  return `${joined}; drugi provider: ${secondProvider ? "potwierdzony" : "niepotwierdzony"}`;
}

function releaseCopy(args: {
  locale: Pass2288Locale;
  surface: Pass2288Surface;
  depth: Pass2288Depth;
  assetFamily: string;
  assetLabel: string;
  sources: string[];
  secondProvider: boolean;
  missingLanes: string[];
  displayRisk: number | null;
  confidenceCap: number;
  static35: boolean;
  paidLocked: boolean;
  releaseAllowed: boolean;
}) {
  const score = args.displayRisk === null ? "source-capped" : `${args.displayRisk}/100`;
  const missing = args.missingLanes.slice(0, args.depth === "basic" ? 3 : args.depth === "pro" ? 5 : 8).join("; ") || (args.locale === "pl" ? "brak potwierdzonej lane do pokazania" : args.locale === "de" ? "keine bestätigte Lane sichtbar" : "no confirmed lane visible");
  if (args.locale === "de") {
    return [
      `Velmère customer release gate: ${args.releaseAllowed ? "PREVIEW_READY" : "REWRITE_REQUIRED"}.`,
      `Scope: ${args.assetFamily} — ${args.assetLabel.slice(0, 90)}; surface=${args.surface}; tier=${args.depth}.`,
      `Quellen: ${sourceCopy(args.locale, args.sources, args.secondProvider)}.`,
      `Risk/Confidence: score ${score}; confidence cap ${args.confidenceCap}/100; ${args.static35 ? "35-Band ist nur Source-Gap-Priorität." : "keine stärkere These als die Daten."}`,
      `Missing Proof: ${missing}.`,
      args.paidLocked
        ? `${vlmTierPriceLabel(args.depth, "de")} ist bis zum tiergebundenen serverseitigen Stripe/BLIK/Web3 Receipt gesperrt; Wallet Connect ist kein Zahlungsnachweis.`
        : "Controlled evidence is released only with a tier-matched server-side receipt; no ROI or guarantee claims.",
    ].join(" ");
  }
  if (args.locale === "en") {
    return [
      `Velmère customer release gate: ${args.releaseAllowed ? "PREVIEW_READY" : "REWRITE_REQUIRED"}.`,
      `Scope: ${args.assetFamily} — ${args.assetLabel.slice(0, 90)}; surface=${args.surface}; tier=${args.depth}.`,
      `Sources: ${sourceCopy(args.locale, args.sources, args.secondProvider)}.`,
      `Risk/Confidence: score ${score}; confidence cap ${args.confidenceCap}/100; ${args.static35 ? "the 35 band is source-gap priority only." : "no claim is stronger than the data."}`,
      `Missing Proof: ${missing}.`,
      args.paidLocked
        ? `${vlmTierPriceLabel(args.depth, "en")} stays locked until a tier-matched server-side Stripe/BLIK/Web3 receipt; wallet connect is not payment proof.`
        : "Controlled evidence can be shown only with a tier-matched server-verified receipt; no ROI or guarantee claims.",
    ].join(" ");
  }
  return [
    `Velmère customer release gate: ${args.releaseAllowed ? "PREVIEW_READY" : "REWRITE_REQUIRED"}.`,
    `Scope: ${args.assetFamily} — ${args.assetLabel.slice(0, 90)}; surface=${args.surface}; tier=${args.depth}.`,
    `Źródła: ${sourceCopy(args.locale, args.sources, args.secondProvider)}.`,
    `Risk/Confidence: score ${score}; confidence cap ${args.confidenceCap}/100; ${args.static35 ? "pasmo 35 to tylko source-gap priority." : "brak mocniejszej tezy niż dane."}`,
    `Missing Proof: ${missing}.`,
    args.paidLocked
      ? `${vlmTierPriceLabel(args.depth, "pl")} pozostaje zablokowany do tier-matched server-side Stripe/BLIK/Web3 receipt; wallet connect nie jest dowodem płatności.`
      : "Płatne evidence można pokazać tylko po tier-matched server-side receipt; bez ROI i bez gwarancji.",
  ].join(" ");
}

export function buildPass2289CustomerReleaseGate(args: {
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
  const claimProof = buildPass2288ClaimProofFirewall({ ...args, locale });
  const text = clean(args.customerOutputText) || clean(claimProof.customerOutput);
  const missingSections = SECTION_TESTS.filter((test) => !test.re.test(text)).map((test) => test.id);
  const forbiddenTerms = containsAny(text, FORBIDDEN_RELEASE_TERMS);
  const paidLocked = vlmTierPaidLocked(args.depth, args.paidAccessVerified);
  const advancedLocked = args.depth === "advanced" && paidLocked;
  const sourceFamilies = unique(claimProof.sourceFamilies);
  const secondProviderConfirmed = Boolean(claimProof.secondProviderConfirmed);
  const static35Blocked = Boolean(claimProof.static35Detected && (claimProof.displayRisk ?? 0) !== (claimProof.rawScore ?? null));
  const releaseIssues = unique([
    ...claimProof.issues.map((issue) => `claim-proof:${issue}`),
    ...missingSections.map((section) => `missing-section:${section}`),
    ...forbiddenTerms.map((term) => `forbidden-release-term:${term}`),
    args.depth !== "basic" && !secondProviderConfirmed ? "pro-or-advanced-second-provider-gap" : null,
    args.depth === "advanced" ? "advanced-not-for-sale" : paidLocked ? "pro-invitation-entitlement-required" : null,
    static35Blocked ? "static-35-display-risk-capped" : null,
  ]);
  const releaseAllowed = releaseIssues.length === 0 && !paidLocked;
  const customerOutput = releaseAllowed
    ? text
    : releaseCopy({
        locale,
        surface: args.surface,
        depth: args.depth,
        assetFamily: claimProof.assetFamily,
        assetLabel: claimProof.assetLabel,
        sources: sourceFamilies,
        secondProvider: secondProviderConfirmed,
        missingLanes: claimProof.missingLanes,
        displayRisk: claimProof.displayRisk,
        confidenceCap: claimProof.confidenceCap,
        static35: Boolean(claimProof.static35Detected),
        paidLocked,
        releaseAllowed,
      });
  return {
    schemaVersion: PASS2289_CUSTOMER_RELEASE_GATE_ID,
    surface: args.surface,
    depth: args.depth,
    assetFamily: claimProof.assetFamily,
    sourceFamilies,
    secondProviderConfirmed,
    missingSections,
    forbiddenTerms,
    releaseIssues,
    releaseAllowed,
    customerOutput,
    displayRisk: claimProof.displayRisk,
    confidenceCap: claimProof.confidenceCap,
    static35Detected: claimProof.static35Detected,
    tierPriceEur: vlmTierPriceEur(args.depth),
    paidRequired: vlmTierRequiresPayment(args.depth),
    paidAccessVerified: Boolean(args.paidAccessVerified),
    paidLocked,
    advancedLocked,
    upstream: {
      schemaVersion: claimProof.schemaVersion,
      productionState: claimProof.productionState,
      rewritten: claimProof.rewritten,
      issueCount: claimProof.issues.length,
    },
    productionState: releaseAllowed ? "customer_release_ready" : args.depth === "advanced" ? "not_for_sale_customer_preview" : paidLocked ? "invitation_locked_customer_preview" : "customer_release_rewrite",
    requiredVisibleSections: PASS2289_REQUIRED_VISIBLE_SECTIONS,
    publicRule: "PASS2289: final customer-visible PDF/Shield/Angel output must include asset family, sources, confidence cap, missing proof, and current tier boundary. Pro is invitation-only controlled beta; Advanced is not for sale.",
  } as const;
}

export const PASS2289_REGRESSION_CASES = [
  "BTC/ETH/SOL: static 35 must be reframed as source-gap priority and never as live danger proof.",
  "NVDA/AAPL/SPY/QQQ/S&P500: no DEX, holder, token tax, wallet-holder or liquidity-pool language.",
  "PDF Basic/Pro/Advanced: each tier must show source scope, confidence cap and missing proof, while Pro and Advanced stay locked without their tier-matched server receipt.",
  "Shield Basic/Pro/Advanced: final ai.output must pass customer release gate after claim-proof firewall.",
  "Angel paid audits: no full evidence ledger or operator appendix unless server-side Stripe/BLIK/Web3 receipt is verified.",
] as const;
