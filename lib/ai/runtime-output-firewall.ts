import { independentProviderFamilies } from "@/lib/ai/evidence-normalization";
import { vlmTierPaidLocked, vlmTierPriceEur, vlmTierPriceLabel, vlmTierRequiresPayment } from "@/lib/ai/paid-tier-policy";

export const PASS2287_RUNTIME_OUTPUT_FIREWALL_ID = "pass2287_runtime_output_firewall_v1" as const;

export type Pass2287Depth = "basic" | "pro" | "advanced";
export type Pass2287Surface = "pdf" | "shield" | "real_markets" | "angel" | "checkout";
export type Pass2287AssetFamily = "native_crypto" | "listed_equity" | "etf" | "index" | "contract_token" | "unknown";
export type Pass2287Locale = "pl" | "en" | "de";

type Pass2287AssetContract = {
  family: Pass2287AssetFamily;
  label: string;
  forbiddenWithoutScope: string[];
  requiredVisibleLanes: string[];
  static35Rewrite: string;
};

const PASS2287_ASSET_CONTRACTS: Record<string, Pass2287AssetContract> = {
  btc: {
    family: "native_crypto",
    label: "BTC / Bitcoin",
    forbiddenWithoutScope: ["ERC20", "contract owner", "owner privilege", "sell tax", "buy tax", "honeypot", "mint authority", "blacklist", "wallet holders"],
    requiredVisibleLanes: ["native market quote", "timestamp", "provider family", "missing lanes", "confidence cap"],
    static35Rewrite: "Treat a 33-37 score band as a source-gap review priority, not a live danger verdict.",
  },
  eth: {
    family: "native_crypto",
    label: "ETH / Ethereum",
    forbiddenWithoutScope: ["ERC20 owner", "sell tax", "honeypot", "mint authority", "blacklist", "wallet holders"],
    requiredVisibleLanes: ["native market quote", "network identity", "timestamp", "missing lanes", "confidence cap"],
    static35Rewrite: "ETH native output must separate network/market evidence from ERC20 contract claims.",
  },
  sol: {
    family: "native_crypto",
    label: "SOL / Solana",
    forbiddenWithoutScope: ["ERC20", "sell tax", "honeypot", "mint authority", "blacklist", "contract owner"],
    requiredVisibleLanes: ["native market quote", "network identity", "timestamp", "missing lanes", "confidence cap"],
    static35Rewrite: "SOL gaps are source-confidence gaps, not EVM-token control proof.",
  },
  nvda: {
    family: "listed_equity",
    label: "NVDA / NVIDIA",
    forbiddenWithoutScope: ["DEX", "wallet holders", "token tax", "transfer tax", "contract permissions", "honeypot", "liquidity pool"],
    requiredVisibleLanes: ["listed equity quote", "market session timestamp", "issuer identity", "second provider status", "confidence cap"],
    static35Rewrite: "NVDA score bands are market-data review priority, not token-risk proof.",
  },
  aapl: {
    family: "listed_equity",
    label: "AAPL / Apple",
    forbiddenWithoutScope: ["DEX", "wallet holders", "token tax", "transfer tax", "contract permissions", "honeypot", "liquidity pool"],
    requiredVisibleLanes: ["listed equity quote", "market session timestamp", "issuer identity", "second provider status", "confidence cap"],
    static35Rewrite: "AAPL score bands are source-coverage review priority, not crypto-token proof.",
  },
  spy: {
    family: "etf",
    label: "SPY / SPDR S&P 500 ETF",
    forbiddenWithoutScope: ["DEX", "wallet holders", "token contract", "transfer tax", "honeypot", "liquidity pool"],
    requiredVisibleLanes: ["ETF quote", "benchmark identity", "composition freshness", "second provider status", "confidence cap"],
    static35Rewrite: "SPY output must separate ETF market evidence from token/contract claims.",
  },
  qqq: {
    family: "etf",
    label: "QQQ / Nasdaq 100 ETF",
    forbiddenWithoutScope: ["DEX", "wallet holders", "token contract", "transfer tax", "honeypot", "liquidity pool"],
    requiredVisibleLanes: ["ETF quote", "benchmark identity", "composition freshness", "second provider status", "confidence cap"],
    static35Rewrite: "QQQ output must separate ETF evidence from token/contract claims.",
  },
  sp500: {
    family: "index",
    label: "S&P 500 / ^GSPC",
    forbiddenWithoutScope: ["DEX", "wallet holders", "token contract", "transfer tax", "honeypot", "liquidity pool"],
    requiredVisibleLanes: ["index quote", "methodology/source", "timestamp", "macro/breadth source status", "confidence cap"],
    static35Rewrite: "S&P 500 score bands are source/macro coverage flags, not wallet or token-risk proof.",
  },
};


function detectAssetContract(value: unknown): Pass2287AssetContract {
  const text = clean(value);
  const lower = text.toLowerCase();
  const aliases: Array<[RegExp, keyof typeof PASS2287_ASSET_CONTRACTS]> = [
    [/\b(btc|bitcoin)\b/i, "btc"],
    [/\b(eth|ethereum)\b/i, "eth"],
    [/\b(sol|solana)\b/i, "sol"],
    [/\b(nvda|nvidia)\b/i, "nvda"],
    [/\b(aapl|apple)\b/i, "aapl"],
    [/\b(spy|spdr s&p 500)\b/i, "spy"],
    [/\b(qqq|nasdaq 100 etf)\b/i, "qqq"],
    [/(?:s\s*&\s*p\s*500|s&p500|sp500|\^gspc|gspc)/i, "sp500"],
  ];
  for (const [pattern, key] of aliases) {
    if (pattern.test(text)) return PASS2287_ASSET_CONTRACTS[key];
  }
  if (/0x[a-f0-9]{40}|erc20|token\s+contract|smart\s+contract/i.test(lower)) {
    return {
      family: "contract_token",
      label: text || "contract token",
      forbiddenWithoutScope: ["guaranteed safe", "guaranteed profit", "final verdict without sources"],
      requiredVisibleLanes: ["contract identity", "source code status", "admin permissions", "liquidity/holder evidence", "confidence cap"],
      static35Rewrite: "A 35-band contract score is an evidence-gap review priority, not proof of safety or exploitability.",
    };
  }
  return {
    family: "unknown",
    label: text || "unknown asset",
    forbiddenWithoutScope: ["guaranteed safe", "guaranteed profit", "final verdict without sources", "wallet connect proves payment"],
    requiredVisibleLanes: ["asset identity", "primary source", "timestamp", "missing lanes", "confidence cap"],
    static35Rewrite: "A 35-band unknown-asset score is source-gap priority only, not a live verdict.",
  };
}

const TIER_SENTENCE_LIMIT: Record<Pass2287Depth, number> = {
  basic: 5,
  pro: 8,
  advanced: 12,
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => clean(value)).filter(Boolean)));
}

function clampPercent(value: unknown, fallback = 0) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}


function sentenceCount(value: unknown) {
  const text = clean(value);
  if (!text) return 0;
  return text.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean).length;
}

function matchForbidden(output: string, forbidden: string[]) {
  const lower = output.toLowerCase();
  return forbidden.filter((phrase) => lower.includes(phrase.toLowerCase()));
}

function missingVisibleSections(output: string) {
  const lower = output.toLowerCase();
  const checks: Array<[string, RegExp]> = [
    ["asset family", /family|rodzina|aktywa|asset|equity|crypto|index|etf|akcj/],
    ["source ledger", /source|źród|zrodl|provider|yahoo|stooq|coingecko|binance|dane/],
    ["confidence cap", /confidence|cap|pewno|zauf|limit pewności|confidence cap/],
    ["missing lanes", /missing|brak|gap|lane|niepotwierdzone|brakuje/],
    ["receipt boundary", /receipt|płatno|platno|stripe|web3|wallet connect|79[.,]99|149[.,]99|entitlement|pro|advanced/],
  ];
  return checks.filter(([, regex]) => !regex.test(lower)).map(([label]) => label);
}

function labelForFamily(family: Pass2287AssetFamily, locale: Pass2287Locale) {
  if (locale === "pl") {
    if (family === "native_crypto") return "native crypto";
    if (family === "listed_equity") return "akcja giełdowa";
    if (family === "etf") return "ETF";
    if (family === "index") return "indeks";
    if (family === "contract_token") return "token kontraktowy";
    return "niepotwierdzone aktywo";
  }
  if (locale === "de") {
    if (family === "listed_equity") return "boersennotierte Aktie";
    if (family === "index") return "Index";
    if (family === "contract_token") return "Contract Token";
    return family.replace(/_/g, " ");
  }
  return family.replace(/_/g, " ");
}

function buildFallbackCustomerOutput(args: {
  locale: Pass2287Locale;
  asset: Pass2287AssetContract;
  sourceFamilies: string[];
  missingLanes: string[];
  displayRisk: number | null;
  confidenceCap: number;
  static35Detected: boolean;
  depth: Pass2287Depth;
  paidAccessVerified?: boolean | null;
}) {
  const sources = args.sourceFamilies.length ? args.sourceFamilies.join(" + ") : "missing external source";
  const missing = args.missingLanes.slice(0, args.depth === "basic" ? 3 : args.depth === "pro" ? 5 : 7).join("; ") || "none visible";
  const score = args.displayRisk === null ? "source-capped" : `${args.displayRisk}/100`;
  if (args.locale === "pl") {
    return [
      `Rodzina: ${labelForFamily(args.asset.family, args.locale)} — ${args.asset.label}.`,
      `Źródła: ${sources}.`,
      `Risk/confidence: wynik ${score}; limit pewności ${args.confidenceCap}/100.`,
      `Braki: ${missing}.`,
      args.static35Detected ? `Uwaga: pasmo 35 traktuję jako priorytet uzupełnienia źródeł, nie jako live proof zagrożenia.` : `Wniosek: ocena pozostaje zależna od źródeł, bez obietnic i bez mocnych tez ponad dane.`,
      vlmTierPaidLocked(args.depth, args.paidAccessVerified) ? `${vlmTierPriceLabel(args.depth, "pl")}: szczegóły dowodowe są zablokowane do server-side receipt; wallet connect nie jest płatnością.` : `Następny test: potwierdź drugi provider i odśwież timestamp przed decyzją.`,
    ].join(" ");
  }
  if (args.locale === "de") {
    return [
      `Familie: ${labelForFamily(args.asset.family, args.locale)} — ${args.asset.label}.`,
      `Quellen: ${sources}.`,
      `Risk/Confidence: Score ${score}; Confidence Cap ${args.confidenceCap}/100.`,
      `Fehlende Lanes: ${missing}.`,
      args.static35Detected ? `Hinweis: ein 35-Band ist Quellenluecke/Review-Prioritaet, kein Live-Gefahrenbeweis.` : `Urteil: quellenabhaengig, ohne Preisversprechen und ohne staerkere These als die Daten tragen.`,
      vlmTierPaidLocked(args.depth, args.paidAccessVerified) ? `${vlmTierPriceLabel(args.depth, "de")} bleibt bis zum serverseitigen Receipt gesperrt; Wallet Connect ist keine Zahlung.` : `Naechster Test: zweiten Provider und Timestamp bestaetigen.`,
    ].join(" ");
  }
  return [
    `Family: ${labelForFamily(args.asset.family, args.locale)} — ${args.asset.label}.`,
    `Sources: ${sources}.`,
    `Risk/confidence: score ${score}; confidence cap ${args.confidenceCap}/100.`,
    `Missing lanes: ${missing}.`,
    args.static35Detected ? `Note: a 35 band is treated as source-gap review priority, not live danger proof.` : `Verdict: source-bound and evidence-capped, with no claim stronger than the data supports.`,
    vlmTierPaidLocked(args.depth, args.paidAccessVerified) ? `${vlmTierPriceLabel(args.depth, "en")} remains locked until server-side receipt; wallet connect is not payment.` : `Next test: confirm second provider and timestamp before action.`,
  ].join(" ");
}

export function applyPass2287RuntimeOutputFirewall(args: {
  locale?: Pass2287Locale | null;
  surface: Pass2287Surface;
  depth: Pass2287Depth;
  assetText?: string | null;
  confirmedSources?: string[] | null;
  missingLanes?: string[] | null;
  rawScore?: number | null;
  confidenceCap?: number | null;
  paidAccessVerified?: boolean | null;
  customerOutputText?: string | null;
}) {
  const locale: Pass2287Locale = args.locale === "en" || args.locale === "de" ? args.locale : "pl";
  const asset = detectAssetContract(clean(args.assetText));
  const sourceFamilies = independentProviderFamilies(args.confirmedSources);
  const explicitMissing = unique(args.missingLanes ?? []);
  const missingLanes = unique(explicitMissing.length ? explicitMissing : asset.requiredVisibleLanes).slice(0, args.depth === "basic" ? 7 : args.depth === "pro" ? 12 : 18);
  const rawScore = typeof args.rawScore === "number" && Number.isFinite(args.rawScore) ? clampPercent(args.rawScore) : null;
  const static35Detected = rawScore !== null && rawScore >= 33 && rawScore <= 37;
  const confidenceCap = typeof args.confidenceCap === "number" && Number.isFinite(args.confidenceCap)
    ? clampPercent(args.confidenceCap)
    : clampPercent(44 + Math.min(sourceFamilies.length, 3) * 13 - Math.min(missingLanes.length, 9) * 3, 44);
  const output = clean(args.customerOutputText);
  const forbiddenHits = matchForbidden(output, asset.forbiddenWithoutScope);
  const visibleGaps = output ? missingVisibleSections(output) : ["customer output unavailable"];
  const sourceFamilyGap = args.depth !== "basic" && sourceFamilies.length < 2;
  const paidLocked = vlmTierPaidLocked(args.depth, args.paidAccessVerified);
  const tooLong = output ? sentenceCount(output) > TIER_SENTENCE_LIMIT[args.depth] + 2 : false;
  const displayRisk = static35Detected && (sourceFamilyGap || confidenceCap < 72 || visibleGaps.length > 0)
    ? asset.family === "native_crypto" ? 23
      : asset.family === "listed_equity" ? 25
        : asset.family === "etf" || asset.family === "index" ? 27
          : rawScore
    : rawScore;
  const issues = unique([
    ...forbiddenHits.map((hit) => `forbidden/no-scope phrase: ${hit}`),
    ...visibleGaps.map((gap) => `missing visible section: ${gap}`),
    sourceFamilyGap ? "second external provider family missing for Pro/Advanced" : null,
    args.depth === "advanced" ? "Advanced is not for sale" : paidLocked ? "Pro invitation entitlement missing" : null,
    tooLong ? "customer answer exceeds premium sentence budget" : null,
  ]);
  const requiresRewrite = issues.length > 0 || static35Detected;
  const customerOutput = requiresRewrite
    ? buildFallbackCustomerOutput({ locale, asset, sourceFamilies, missingLanes, displayRisk, confidenceCap, static35Detected, depth: args.depth, paidAccessVerified: args.paidAccessVerified })
    : output;
  const productionState = paidLocked
    ? "paid_tier_locked_until_receipt"
    : requiresRewrite
      ? "customer_output_rewritten_by_firewall"
      : sourceFamilies.length >= (args.depth === "basic" ? 1 : 2)
        ? "customer_ready"
        : "customer_ready_confidence_capped";

  return {
    schemaVersion: PASS2287_RUNTIME_OUTPUT_FIREWALL_ID,
    surface: args.surface,
    depth: args.depth,
    auditPriceEur: vlmTierPriceEur(args.depth),
    tierPriceEur: vlmTierPriceEur(args.depth),
    assetLabel: asset.label,
    assetFamily: asset.family,
    sourceFamilies,
    sourceFamilyCount: sourceFamilies.length,
    missingLanes,
    rawScore,
    displayRisk,
    confidenceCap,
    static35Detected,
    static35Rewrite: static35Detected ? asset.static35Rewrite : "Risk score and confidence stay separate.",
    forbiddenWithoutScope: asset.forbiddenWithoutScope,
    forbiddenHits,
    visibleGaps,
    sourceFamilyGap,
    requiresRewrite,
    rewritten: requiresRewrite,
    customerOutput,
    productionState,
    paidRequired: vlmTierRequiresPayment(args.depth),
    paidAccessVerified: Boolean(args.paidAccessVerified),
    paidLocked,
    paymentProofRules: [
      args.depth === "basic" ? "Basic is a free limited prescreen." : args.depth === "pro" ? "Pro requires server-bound invitation entitlement and internal quality control; public checkout is disabled." : "Advanced is not for sale and cannot be unlocked.",
      "Wallet connect is identity/context only and never payment proof.",
      "Web3 proof needs chain id, tx hash, recipient, amount, confirmations and backend receipt binding.",
      "Stripe/BLIK proof needs webhook-confirmed payment intent/session mapped to report id.",
    ],
    nextRepair: requiresRewrite
      ? "Display the firewall output instead of raw model output; collect a second provider and live timestamp before stronger claims."
      : "Output passed asset-family, source, confidence, missing-lane and receipt-boundary firewall.",
  } as const;
}

export function buildPass2287AngelDirective(locale: Pass2287Locale) {
  if (locale === "pl") {
    return "PASS2287: przed pokazaniem odpowiedzi klientowi przepuść ją przez runtime output firewall: jeśli brakuje rodziny aktywa, źródeł, confidence cap, missing lanes albo receipt boundary, pokaż krótką wersję firewall. BTC/ETH/SOL bez kontraktu nie mają ERC20/admin/honeypot języka. NVDA/SPY/S&P500 nie mają DEX/wallet-holder/token-tax języka. Score 35 to source-gap review priority, nie live proof. Pro beta na zaproszenie i Advanced nie na sprzedaż tylko po tier-matched server-side receipt; wallet connect nie jest płatnością.";
  }
  if (locale === "de") {
    return "PASS2287: jede Kundenantwort laeuft durch den Runtime Output Firewall: fehlt Asset-Familie, Quellen, Confidence Cap, Missing Lanes oder Receipt Boundary, zeige die kurze Firewall-Version. BTC/ETH/SOL ohne Contract bekommen keine ERC20/Admin/Honeypot-Sprache. NVDA/SPY/S&P500 bekommen keine DEX/Wallet-Holder/Token-Tax-Sprache. Score 35 ist Source-Gap Review, kein Live-Beweis. Pro Beta nur auf Einladung und Advanced nicht zum Verkauf nur nach tiergebundenem serverseitigem Receipt; Wallet Connect ist keine Zahlung.";
  }
  return "PASS2287: run every customer answer through the runtime output firewall: if asset family, sources, confidence cap, missing lanes or receipt boundary are missing, show the short firewall version. BTC/ETH/SOL without contract scope get no ERC20/admin/honeypot language. NVDA/SPY/S&P500 get no DEX/wallet-holder/token-tax language. Score 35 is source-gap review priority, not live proof. Pro is invitation-only controlled beta, Advanced is not for sale, and public checkout is disabled.";
}

export function buildPass2287RegressionMatrix() {
  return {
    schemaVersion: PASS2287_RUNTIME_OUTPUT_FIREWALL_ID,
    assets: ["BTC", "ETH", "SOL", "NVDA", "AAPL", "SPY", "QQQ", "S&P 500"],
    tierPricesEur: { basic: null, pro: null, advanced: null },
    assertions: [
      "Customer-visible Angel/VLM output is replaced by a firewall scaffold when source/confidence/missing/payment sections are absent.",
      "BTC/ETH/SOL do not get ERC20/admin/honeypot language without explicit contract scope.",
      "NVDA/AAPL/SPY/QQQ/S&P500 do not get DEX/wallet-holder/token-tax language without tokenized-security scope.",
      "Static 35 band is demoted to source-gap review priority and displayRisk is capped while source confidence is low.",
      "Pro requires a server-bound invitation entitlement. Advanced is not for sale. Payment and wallet markers do not unlock either tier.",
    ],
  } as const;
}

// PASS2287 markers: runtime output firewall · Angel customer output rewrite · BTC ETH SOL no ERC20 lane · NVDA AAPL SPY QQQ S&P500 no DEX wallet-holder token-tax · static 35 source-gap review priority · Pro invitation-only beta Advanced not for sale tier-matched server-side receipt · wallet connect is not payment proof
