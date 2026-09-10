export const PASS2280_AUDIT_OUTPUT_REGRESSION_ID =
  "pass2280_audit_output_regression_perfection_v1" as const;

export type Pass2280Depth = "basic" | "pro" | "advanced";
export type Pass2280Asset = "BTC" | "ETH" | "SOL" | "NVDA" | "AAPL" | "SPY" | "S&P 500" | "QQQ";
export type Pass2280AssetFamily = "native_crypto" | "equity" | "etf" | "index";

export type Pass2280TierContract = {
  depth: Pass2280Depth;
  paid: boolean;
  outputShape: string[];
  requiredProof: string[];
  forbiddenClaimsWithoutProof: string[];
  maxCustomerNoise: number;
  minHumanValue: string;
};

export type Pass2280AssetRuntimeContract = {
  asset: Pass2280Asset;
  family: Pass2280AssetFamily;
  acceptedPrimarySources: string[];
  requiredSecondSource: string;
  applicableLanes: string[];
  nonApplicableLanes: string[];
  scoreRule: string;
  missingDataLine: string;
  advancedPaidBoundary: string;
};

export const PASS2280_TIER_CONTRACTS: Record<Pass2280Depth, Pass2280TierContract> = {
  basic: {
    depth: "basic",
    paid: false,
    outputShape: [
      "cautious verdict",
      "confirmed primary source",
      "risk score vs confidence cap",
      "visible missing-data row",
      "one next safe check",
    ],
    requiredProof: ["asset identity", "primary quote/source state", "visible missing source line"],
    forbiddenClaimsWithoutProof: [
      "second-provider certainty",
      "orderbook depth",
      "holder concentration",
      "contract/admin control",
      "audit completion",
    ],
    maxCustomerNoise: 5,
    minHumanValue: "A user should understand what is known, what is missing and whether Pro/Advanced is worth opening.",
  },
  pro: {
    depth: "pro",
    paid: false,
    outputShape: [
      "verdict with confidence cap",
      "source table",
      "second-provider status",
      "scenario / what changes the score",
      "missing lanes before conclusion",
      "next three safe checks",
    ],
    requiredProof: ["Basic proof", "source cadence status", "provider family honesty", "what would change score"],
    forbiddenClaimsWithoutProof: [
      "paid evidence packet",
      "manually QA-checked final audit",
      "proof capsule",
      "private remediation sign-off",
    ],
    maxCustomerNoise: 8,
    minHumanValue: "A user should see why Pro is deeper than Basic without leaking the paid Advanced packet.",
  },
  advanced: {
    depth: "advanced",
    paid: true,
    outputShape: [
      "scope",
      "evidence table",
      "source confidence",
      "contradiction scan",
      "risk score vs confidence cap",
      "what would change my mind",
      "remediation / next safe checks",
      "paid boundary and receipt state",
    ],
    requiredProof: ["server-side entitlement", "source ledger", "evidence rows", "missing-proof rows", "paid audit boundary"],
    forbiddenClaimsWithoutProof: [
      "guaranteed security",
      "ROI or price forecast",
      "exploit steps",
      "wallet connect as payment proof",
      "certified-safe badge",
    ],
    maxCustomerNoise: 12,
    minHumanValue: "A 149€ audit must feel like an evidence workflow: scoped, source-bound, useful and honest about limits.",
  },
};

export const PASS2280_ASSET_CONTRACTS: Record<Pass2280Asset, Pass2280AssetRuntimeContract> = {
  BTC: {
    asset: "BTC",
    family: "native_crypto",
    acceptedPrimarySources: ["CoinGecko", "Binance", "CoinMarketCap", "Yahoo crypto quote"],
    requiredSecondSource: "independent BTC market venue/source or cross-venue quote, not ERC20 contract proof",
    applicableLanes: ["price", "volume", "history", "venue depth when available", "cross-venue confirmation"],
    nonApplicableLanes: ["ERC20 holder concentration", "mint/admin controls", "honeypot", "token blacklist"],
    scoreRule: "Missing second source may cap confidence; it must not force a fake static 35/100 risk score when price is valid and no anomaly is present.",
    missingDataLine: "Missing: independent second BTC market source, depth snapshot or persistent history snapshot.",
    advancedPaidBoundary: "Advanced can add source ledger and contradiction scan after server-side entitlement; still no investment advice.",
  },
  ETH: {
    asset: "ETH",
    family: "native_crypto",
    acceptedPrimarySources: ["CoinGecko", "Binance", "CoinMarketCap", "Yahoo crypto quote"],
    requiredSecondSource: "independent ETH market venue/source or cross-venue quote, not token-admin proof",
    applicableLanes: ["price", "volume", "history", "venue depth when available", "cross-venue confirmation"],
    nonApplicableLanes: ["ERC20 holder concentration for native ETH", "mint/admin controls", "honeypot"],
    scoreRule: "Native ETH must not inherit ERC20 contract-risk wording unless the user supplied a specific token contract.",
    missingDataLine: "Missing: independent second ETH market source, depth snapshot or persistent history snapshot.",
    advancedPaidBoundary: "Advanced can add source ledger and contradiction scan after server-side entitlement; still no investment advice.",
  },
  SOL: {
    asset: "SOL",
    family: "native_crypto",
    acceptedPrimarySources: ["CoinGecko", "Binance", "CoinMarketCap"],
    requiredSecondSource: "independent SOL market venue/source, not ERC20 admin proof",
    applicableLanes: ["price", "volume", "history", "venue depth when available", "cross-venue confirmation"],
    nonApplicableLanes: ["ERC20 tax", "honeypot", "mint/admin contract proof without contract scope"],
    scoreRule: "Native SOL analysis must separate source confidence from chain/token-contract risk.",
    missingDataLine: "Missing: independent second SOL market source or durable depth/history snapshot.",
    advancedPaidBoundary: "Advanced can add source ledger and contradiction scan after server-side entitlement; still no investment advice.",
  },
  NVDA: {
    asset: "NVDA",
    family: "equity",
    acceptedPrimarySources: ["Yahoo Finance", "Stooq", "NASDAQ/issuer/filing source"],
    requiredSecondSource: "Stooq or another independent equity quote/fundamental source, not another Yahoo endpoint",
    applicableLanes: ["quote", "volume", "history", "filing/fundamental freshness", "news/narrative when sourced"],
    nonApplicableLanes: ["DEX liquidity", "token holders", "contract tax", "honeypot", "mint risk"],
    scoreRule: "Equity risk should separate market move/source freshness from token-scam lanes.",
    missingDataLine: "Missing: independent second quote, filing/fundamental freshness or source cadence proof.",
    advancedPaidBoundary: "Advanced can add contradiction scan, source ledger and evidence table after entitlement.",
  },
  AAPL: {
    asset: "AAPL",
    family: "equity",
    acceptedPrimarySources: ["Yahoo Finance", "Stooq", "NASDAQ/issuer/filing source"],
    requiredSecondSource: "Stooq or another independent equity quote/fundamental source",
    applicableLanes: ["quote", "volume", "history", "filing/fundamental freshness", "news/narrative when sourced"],
    nonApplicableLanes: ["DEX liquidity", "token holders", "contract/admin", "honeypot"],
    scoreRule: "AAPL should not show token-style risk wording unless a tokenized wrapper is explicitly in scope.",
    missingDataLine: "Missing: independent second quote, filing/fundamental freshness or source cadence proof.",
    advancedPaidBoundary: "Advanced can add contradiction scan, source ledger and evidence table after entitlement.",
  },
  SPY: {
    asset: "SPY",
    family: "etf",
    acceptedPrimarySources: ["Yahoo Finance", "Stooq", "fund/issuer metadata"],
    requiredSecondSource: "independent quote plus ETF/fund composition/freshness lane when available",
    applicableLanes: ["ETF quote", "volume", "history", "fund metadata", "index relation"],
    nonApplicableLanes: ["contract tax", "honeypot", "mint risk", "holder wallet clusters"],
    scoreRule: "SPY should explain ETF/index and provider cadence, not token scam signals.",
    missingDataLine: "Missing: independent quote, ETF composition/fund metadata or provider freshness proof.",
    advancedPaidBoundary: "Advanced can add source ledger and contradiction scan after entitlement.",
  },
  "S&P 500": {
    asset: "S&P 500",
    family: "index",
    acceptedPrimarySources: ["Yahoo Finance", "Stooq", "index provider/fundamental macro source"],
    requiredSecondSource: "independent index quote/source; Yahoo quote and Yahoo chart are one source family",
    applicableLanes: ["index level", "history", "macro/source cadence", "second index source"],
    nonApplicableLanes: ["share/holder token lanes", "contract/admin risk", "DEX slippage", "token liquidity tax"],
    scoreRule: "Index missing second provider caps confidence; it is not evidence of manipulation by itself.",
    missingDataLine: "Missing: independent index quote/source and macro/fundamental context when not supplied.",
    advancedPaidBoundary: "Advanced can add source ledger and contradiction scan after entitlement.",
  },
  QQQ: {
    asset: "QQQ",
    family: "etf",
    acceptedPrimarySources: ["Yahoo Finance", "Stooq", "fund/issuer metadata"],
    requiredSecondSource: "independent quote plus ETF/fund composition/freshness lane when available",
    applicableLanes: ["ETF quote", "volume", "history", "fund metadata", "index relation"],
    nonApplicableLanes: ["contract tax", "honeypot", "mint risk", "holder wallet clusters"],
    scoreRule: "QQQ must be treated as an ETF/market product, not as a token contract.",
    missingDataLine: "Missing: independent quote, ETF composition/fund metadata or provider freshness proof.",
    advancedPaidBoundary: "Advanced can add source ledger and contradiction scan after entitlement.",
  },
};

export function normalizePass2280Asset(input: string | null | undefined): Pass2280Asset | null {
  const value = String(input ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  if (!value) return null;
  if (["BTC", "BITCOIN"].includes(value)) return "BTC";
  if (["ETH", "ETHEREUM"].includes(value)) return "ETH";
  if (["SOL", "SOLANA"].includes(value)) return "SOL";
  if (["NVDA", "NVIDIA"].includes(value)) return "NVDA";
  if (["AAPL", "APPLE"].includes(value)) return "AAPL";
  if (["SPY", "SPDR S&P 500"].includes(value)) return "SPY";
  if (["S&P 500", "S&P500", "SP500", "^GSPC", "GSPC"].includes(value)) return "S&P 500";
  if (["QQQ", "NASDAQ 100", "^NDX", "NDX"].includes(value)) return "QQQ";
  return null;
}

export function buildPass2280TierRuntimeExpectation(depth: Pass2280Depth) {
  const tier = PASS2280_TIER_CONTRACTS[depth];
  return {
    depth,
    paid: tier.paid,
    mustShow: tier.outputShape,
    mustNotClaimWithoutProof: tier.forbiddenClaimsWithoutProof,
    humanValue: tier.minHumanValue,
  } as const;
}

export function buildPass2280MissingSourceLine(assetInput: string | null | undefined, depth: Pass2280Depth) {
  const asset = normalizePass2280Asset(assetInput);
  const tier = PASS2280_TIER_CONTRACTS[depth];
  if (!asset) {
    return `Missing source lane must be shown before verdict. ${tier.paid ? "Advanced needs server-side entitlement and evidence rows." : "Basic/Pro stay source-bound previews."}`;
  }
  const contract = PASS2280_ASSET_CONTRACTS[asset];
  return `${contract.asset}: ${contract.missingDataLine} ${contract.scoreRule}`;
}

export function buildPass2280AngelAuditReadout(args: {
  locale?: "pl" | "en" | "de";
  depth?: Pass2280Depth;
  asset?: string | null;
  sourceCount?: number;
  confidenceCap?: number | null;
}) {
  const locale = args.locale ?? "en";
  const depth = args.depth ?? "basic";
  const asset = normalizePass2280Asset(args.asset ?? null);
  const tier = PASS2280_TIER_CONTRACTS[depth];
  const contract = asset ? PASS2280_ASSET_CONTRACTS[asset] : null;
  const sourceText = `${args.sourceCount ?? 0} confirmed source lane(s)`;
  const capText = typeof args.confidenceCap === "number" ? `${Math.round(args.confidenceCap)}% confidence cap` : "source-dependent confidence cap";
  if (locale === "pl") {
    return [
      "PASS2280 Angel Premium Audit Readout",
      `Poziom: ${depth}${tier.paid ? " — płatny, wymaga entitlementu" : " — preview source-bound"}`,
      `Źródła: ${sourceText}; ${capText}.`,
      contract ? `Aktywo: ${contract.asset} (${contract.family}). Nie dotyczy: ${contract.nonApplicableLanes.slice(0, 4).join(", ")}.` : "Aktywo: brak stabilnego rozpoznania, najpierw potwierdź symbol/scope.",
      contract ? `Braki: ${contract.missingDataLine}` : "Braki: primary source, second source, scope i proof lane.",
      "Zasada: source gaps przed verdict; 35/100 nie jest live-proof; wallet connect nie jest payment proof.",
      "Advanced Audit 149€: evidence table, contradiction scan, source confidence i bezpieczne remediation — bez fałszywego certyfikatu.",
    ].join("\n");
  }
  if (locale === "de") {
    return [
      "PASS2280 Angel Premium Audit Readout",
      `Stufe: ${depth}${tier.paid ? " — bezahlt, braucht Entitlement" : " — source-bound Preview"}`,
      `Quellen: ${sourceText}; ${capText}.`,
      contract ? `Asset: ${contract.asset} (${contract.family}). Nicht anwendbar: ${contract.nonApplicableLanes.slice(0, 4).join(", ")}.` : "Asset: kein stabiler Scope; zuerst Symbol/Scope bestätigen.",
      contract ? `Lücken: ${contract.missingDataLine}` : "Lücken: primary source, second source, scope und proof lane.",
      "Regel: Source-Gaps vor Verdict; 35/100 ist kein Live-Beweis; Wallet Connect ist kein Zahlungsnachweis.",
      "Advanced Audit 149€: Evidence Table, Contradiction Scan, Source Confidence und sichere Remediation — kein Fake-Zertifikat.",
    ].join("\n");
  }
  return [
    "PASS2280 Angel Premium Audit Readout",
    `Tier: ${depth}${tier.paid ? " — paid, entitlement required" : " — source-bound preview"}`,
    `Sources: ${sourceText}; ${capText}.`,
    contract ? `Asset: ${contract.asset} (${contract.family}). Not applicable: ${contract.nonApplicableLanes.slice(0, 4).join(", ")}.` : "Asset: no stable scope; confirm symbol/scope first.",
    contract ? `Gaps: ${contract.missingDataLine}` : "Gaps: primary source, second source, scope and proof lane.",
    "Rule: source gaps before verdict; 35/100 is not live proof; wallet connect is not payment proof.",
    "Advanced Audit 149€: evidence table, contradiction scan, source confidence and safe remediation — no fake certificate.",
  ].join("\n");
}

export function buildPass2280AuditOutputRegressionMatrix() {
  return {
    schemaVersion: "velmere.pass2280.audit-output-regression.v1",
    id: PASS2280_AUDIT_OUTPUT_REGRESSION_ID,
    auditPriceEur: 149,
    advancedPaymentRule: "Advanced is not for sale and cannot be unlocked by entitlement, payment receipt, or wallet connection. Pro is invitation-only controlled beta.",
    sourceRule: "A missing source becomes a visible gap and confidence cap, never a fake live-risk claim.",
    static35Rule: "BTC/native crypto and Real Markets blue-chip assets must not show static 35/100 as proof of danger when only source coverage is missing.",
    tierContracts: PASS2280_TIER_CONTRACTS,
    assetContracts: PASS2280_ASSET_CONTRACTS,
    qaCases: [
      "BTC Basic/Pro/Advanced: no ERC20 admin/holder lanes unless token-contract scope exists.",
      "NVDA Basic/Pro/Advanced: Yahoo quote + Yahoo chart is one provider family; Stooq counts only if returned.",
      "SPY/S&P 500/QQQ: ETF/index missing second source caps confidence, not risk by itself.",
      "Angel Audit 149€: answer has scope, sources, gaps, severity, remediation, source confidence and paid boundary.",
      "PDF preview/download: one payload, different tier depth, visible missing-proof rows.",
    ],
  } as const;
}

// PASS2280 markers: PASS2280_AUDIT_OUTPUT_REGRESSION_ID · Angel Premium Audit Readout · BTC NVDA SPY S&P 500 QQQ output regression · static 35 is not live proof · wallet connect is not payment proof · Advanced Audit 149€ server-side entitlement
