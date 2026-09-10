import { createHash } from "node:crypto";
import type { TokenRiskResult, VelmereMarketAssetClass } from "./risk-types";
import type { Pass2488SupplyFilingProvenanceLock } from "./supply-filing-provenance-lock";
import type { Pass2502SurfaceRuntimeRebalanceSweep } from "./surface-runtime-rebalance-sweep";
import {
  SEC_EDGAR_CUSTOMER_BOUNDARY,
  buildSecEdgarReferenceRequest,
  inspectSecEdgarOperatorUserAgent,
} from "./sec-edgar-reference-policy";

export const PASS2503_REAL_MARKETS_SEC_COMPANYFACTS_HYDRATOR_ID = "real-markets-sec-companyfacts-hydrator-v1" as const;

export type Pass2503State = "runtime_adapter_ready" | "watch" | "blocked" | "not_applicable";
export type Pass2503LaneState = "ready" | "watch" | "blocked" | "not_applicable";
export type Pass2503LaneId =
  | "real_market_cik_identity"
  | "sec_submissions_endpoint"
  | "sec_companyfacts_endpoint"
  | "xbrl_concept_matrix"
  | "etf_holdings_boundary"
  | "browser_pdf_surface_parity"
  | "wallet_drawer_motion_boundary";

export type Pass2503SecEndpoint = {
  id: "submissions" | "companyfacts";
  url: string | null;
  requiredHeader: "SEC_USER_AGENT";
  state: Pass2503LaneState;
  blocker: string | null;
  attribution: typeof SEC_EDGAR_CUSTOMER_BOUNDARY.attribution;
  referenceOnly: true;
  liveClaimed: false;
  executableQuote: false;
  thirdPartyContentExcluded: true;
  boundary: string;
};

export type Pass2503Lane = {
  id: Pass2503LaneId;
  label: string;
  surface: "real_markets" | "browser_pdf" | "wallet_drawer" | "all";
  state: Pass2503LaneState;
  progressBefore: number;
  progressAfter: number;
  readyEvidence: string[];
  missingEvidence: string[];
  customerBoundary: string;
  operatorAction: string;
};


type Pass2503LaneInput = Omit<Pass2503Lane, "readyEvidence" | "missingEvidence"> & {
  readyEvidence: Array<string | null | undefined | false>;
  missingEvidence: Array<string | null | undefined | false>;
};

export type Pass2503RealMarketsSecCompanyfactsHydrator = {
  id: typeof PASS2503_REAL_MARKETS_SEC_COMPANYFACTS_HYDRATOR_ID;
  state: Pass2503State;
  query: string;
  symbol: string;
  assetClass: VelmereMarketAssetClass | "crypto_market" | "unknown";
  cik: string | null;
  issuerName: string | null;
  secUserAgentConfigured: boolean;
  secUserAgentState: "identified_operator" | "blocked";
  endpoints: Pass2503SecEndpoint[];
  referencePolicy: typeof SEC_EDGAR_CUSTOMER_BOUNDARY;
  xbrlConcepts: string[];
  secReferencePreflightReady: boolean;
  secHydrationAllowed: boolean;
  paidFilingCopyAllowed: boolean;
  nonEntitlementLanesTouched: number;
  lanes: Pass2503Lane[];
  realMarketsProgressBefore: number;
  realMarketsProgressAfter: number;
  browserPdfProgressBefore: number;
  browserPdfProgressAfter: number;
  walletProgressBefore: number;
  walletProgressAfter: number;
  hardLocks: string[];
  nextActions: string[];
  operatorRule: string;
  fingerprint: string;
  generatedAt: string;
};

type KnownIssuer = { cik: string; name: string; assetClass: VelmereMarketAssetClass; holdingsBoundary?: boolean };

const KNOWN_SEC_ISSUERS: Record<string, KnownIssuer> = {
  AAPL: { cik: "0000320193", name: "Apple Inc.", assetClass: "stock" },
  APPLE: { cik: "0000320193", name: "Apple Inc.", assetClass: "stock" },
  NVDA: { cik: "0001045810", name: "NVIDIA Corporation", assetClass: "stock" },
  NVIDIA: { cik: "0001045810", name: "NVIDIA Corporation", assetClass: "stock" },
  MSFT: { cik: "0000789019", name: "Microsoft Corporation", assetClass: "stock" },
  MICROSOFT: { cik: "0000789019", name: "Microsoft Corporation", assetClass: "stock" },
  GOOGL: { cik: "0001652044", name: "Alphabet Inc.", assetClass: "stock" },
  GOOG: { cik: "0001652044", name: "Alphabet Inc.", assetClass: "stock" },
  ALPHABET: { cik: "0001652044", name: "Alphabet Inc.", assetClass: "stock" },
  AMZN: { cik: "0001018724", name: "Amazon.com, Inc.", assetClass: "stock" },
  AMAZON: { cik: "0001018724", name: "Amazon.com, Inc.", assetClass: "stock" },
  META: { cik: "0001326801", name: "Meta Platforms, Inc.", assetClass: "stock" },
  TSLA: { cik: "0001318605", name: "Tesla, Inc.", assetClass: "stock" },
  TESLA: { cik: "0001318605", name: "Tesla, Inc.", assetClass: "stock" },
  AMD: { cik: "0000002488", name: "Advanced Micro Devices, Inc.", assetClass: "stock" },
  SPY: { cik: "0000884394", name: "SPDR S&P 500 ETF Trust", assetClass: "etf", holdingsBoundary: true },
  QQQ: { cik: "0001067839", name: "Invesco QQQ Trust", assetClass: "etf", holdingsBoundary: true },
};

const XBRL_CONCEPTS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "NetIncomeLoss",
  "Assets",
  "Liabilities",
  "StockholdersEquity",
  "NetCashProvidedByUsedInOperatingActivities",
  "PaymentsToAcquirePropertyPlantAndEquipment",
];

function clean(value?: string | null) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9_.:-]+/g, "-").slice(0, 92) || "unknown";
}

function normalizeSymbol(value?: string | null) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.=-]+/g, "").slice(0, 24);
}

function inferKnownIssuer(query?: string | null, symbol?: string | null, result?: TokenRiskResult | null): KnownIssuer | null {
  const candidates = [symbol, result?.token.symbol, result?.token.name, query]
    .map((item) => normalizeSymbol(item))
    .filter(Boolean);
  for (const candidate of candidates) {
    const direct = KNOWN_SEC_ISSUERS[candidate];
    if (direct) return direct;
    const noSuffix = candidate.replace(/\.US$/, "");
    if (KNOWN_SEC_ISSUERS[noSuffix]) return KNOWN_SEC_ISSUERS[noSuffix];
  }
  const blob = `${query || ""} ${result?.token.name || ""}`.toLowerCase();
  if (/apple/.test(blob)) return KNOWN_SEC_ISSUERS.AAPL;
  if (/nvidia/.test(blob)) return KNOWN_SEC_ISSUERS.NVDA;
  if (/spdr|s&p 500 etf|spy/.test(blob)) return KNOWN_SEC_ISSUERS.SPY;
  return null;
}

function isRealMarket(assetClass?: string | null) {
  return ["stock", "etf", "index", "fx", "commodity", "real_estate", "exchange_equity"].includes(String(assetClass || ""));
}

function endpoint(kind: Pass2503SecEndpoint["id"], cik: string | null, userAgent: string, now: Date): Pass2503SecEndpoint {
  const padded = cik ? cik.replace(/\D/g, "").padStart(10, "0") : null;
  const request = padded ? buildSecEdgarReferenceRequest({ kind, cik: padded, userAgent, now }) : null;
  const url = padded
    ? kind === "submissions"
      ? `https://data.sec.gov/submissions/CIK${padded}.json`
      : `https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`
    : null;
  return {
    id: kind,
    url,
    requiredHeader: "SEC_USER_AGENT",
    state: !padded ? "blocked" : request?.ok ? "ready" : request?.reason === "sec_policy_review_expired" ? "blocked" : "watch",
    blocker: !padded ? "sec_cik_invalid" : request?.ok ? null : request?.reason ?? "sec_reference_policy_blocked",
    attribution: SEC_EDGAR_CUSTOMER_BOUNDARY.attribution,
    referenceOnly: true,
    liveClaimed: false,
    executableQuote: false,
    thirdPartyContentExcluded: true,
    boundary:
      kind === "submissions"
        ? "Submissions is dated SEC reference evidence for filing cadence and accession lineage; it is not live market data and third-party content is excluded."
        : "Companyfacts is dated SEC reference evidence for public XBRL concept availability; it is not a quote and does not replace issuer filings or ETF holdings freshness.",
  };
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32).toUpperCase();
}

function evidence(items: Array<string | null | undefined | false>): string[] {
  return Array.from(new Set(items.filter((item): item is string => typeof item === "string" && item.trim().length > 0))).slice(0, 12);
}

function lane(args: Pass2503LaneInput): Pass2503Lane {
  return {
    ...args,
    readyEvidence: evidence(args.readyEvidence).slice(0, 10),
    missingEvidence: evidence(args.missingEvidence),
  };
}

export function buildPass2503RealMarketsSecCompanyfactsHydrator(args: {
  query?: string | null;
  symbol?: string | null;
  result?: TokenRiskResult | null;
  pass2488?: Pass2488SupplyFilingProvenanceLock | null;
  pass2502?: Pass2502SurfaceRuntimeRebalanceSweep | null;
  now?: Date;
}): Pass2503RealMarketsSecCompanyfactsHydrator {
  const now = args.now ?? new Date();
  const query = clean(args.query || args.symbol || args.result?.token.symbol || "velmere");
  const normalized = normalizeSymbol(args.symbol || args.result?.token.symbol || args.query || "VLM");
  const known = inferKnownIssuer(args.query, args.symbol, args.result);
  const resultAssetClass = args.result?.token.assetClass;
  const assetClass = known?.assetClass ?? resultAssetClass ?? (args.result?.token.chainId || args.result?.token.tokenAddress ? "crypto_market" : "unknown");
  const secUserAgent = process.env.SEC_USER_AGENT?.trim() || "";
  const secUserAgentInspection = inspectSecEdgarOperatorUserAgent(secUserAgent);
  const secUserAgentConfigured = secUserAgentInspection.ok;
  const realMarket = isRealMarket(assetClass);
  const cik = known?.cik ?? null;
  const endpoints = [endpoint("submissions", cik, secUserAgent, now), endpoint("companyfacts", cik, secUserAgent, now)];
  const secReferencePreflightReady = realMarket && Boolean(cik) && endpoints.every((item) => item.state === "ready");
  const secHydrationAllowed = secReferencePreflightReady && SEC_EDGAR_CUSTOMER_BOUNDARY.productionEgressAuthorized;
  const paidFilingCopyAllowed = secHydrationAllowed
    && Boolean(args.pass2488?.paidProvenanceAllowed && args.pass2488.realSecIdentityReady && args.pass2488.realSecXbrlFresh && args.pass2488.realFundamentalCoverageReady)
    && SEC_EDGAR_CUSTOMER_BOUNDARY.customerFinalCredit;
  const hardLocks = evidence([
    !realMarket && "PASS2503 is not applicable to crypto/native token proof lanes; crypto holder/supply/unlock stay in PASS2488.",
    realMarket && !cik && "Real Markets SEC hydration blocked: supported CIK identity is missing for this symbol.",
    realMarket && cik && !secUserAgentConfigured && `SEC hydration blocked before runtime fetch: ${secUserAgentInspection.ok ? "unknown" : secUserAgentInspection.reason}.`,
    realMarket && secReferencePreflightReady && !SEC_EDGAR_CUSTOMER_BOUNDARY.productionEgressAuthorized && "SEC request preflight is ready, but the generic SEC rights egress gate remains closed; this patch authorizes no provider network, customer display or FINAL credit.",
    known?.holdingsBoundary && "ETF boundary: Companyfacts does not replace holdings/N-PORT freshness; holdings lane remains separate.",
  ]);
  const state: Pass2503State = !realMarket
    ? "not_applicable"
    : !cik
      ? "blocked"
      : secHydrationAllowed
        ? "runtime_adapter_ready"
        : endpoints.some((item) => item.blocker === "sec_policy_review_expired")
          ? "blocked"
          : "watch";
  const lanes: Pass2503Lane[] = [
    lane({
      id: "real_market_cik_identity",
      label: "Real Markets CIK identity resolver",
      surface: "real_markets",
      state: realMarket && cik ? "ready" : realMarket ? "blocked" : "not_applicable",
      progressBefore: 48,
      progressAfter: realMarket && cik ? 55 : 49,
      readyEvidence: [cik && `${known?.name || normalized} -> CIK ${cik}`, "AAPL/NVDA/SPY alias family mapped before crypto fallback"],
      missingEvidence: [realMarket && !cik && "CIK alias missing for this Real Markets symbol"],
      customerBoundary: "CIK identity is only issuer identity; it is not a valuation verdict or investment signal.",
      operatorAction: "Add missing issuer aliases only after source proof; never route Apple/NVDA/SPY through token fallback.",
    }),
    lane({
      id: "sec_submissions_endpoint",
      label: "SEC submissions filing cadence endpoint",
      surface: "real_markets",
      state: endpoints[0].state,
      progressBefore: 30,
      progressAfter: endpoints[0].state === "ready" ? 42 : 32,
      readyEvidence: [endpoints[0].url, secUserAgentConfigured && "SEC_USER_AGENT configured"],
      missingEvidence: [!cik && "CIK required", cik && !secUserAgentConfigured && "SEC_USER_AGENT required"],
      customerBoundary: "Latest filing/date/accession must remain visible; stale filings lower confidence instead of creating stronger copy.",
      operatorAction: "Fetch submissions with compliant SEC_USER_AGENT and persist filingDate/form/accession/URL in Advanced receipts.",
    }),
    lane({
      id: "sec_companyfacts_endpoint",
      label: "SEC Companyfacts/XBRL endpoint",
      surface: "real_markets",
      state: endpoints[1].state,
      progressBefore: 25,
      progressAfter: endpoints[1].state === "ready" ? 39 : 28,
      readyEvidence: [endpoints[1].url, `${XBRL_CONCEPTS.length} XBRL concept candidates`],
      missingEvidence: [!cik && "CIK required", cik && !secUserAgentConfigured && "SEC_USER_AGENT required"],
      customerBoundary: "Companyfacts confirms concept availability; missing/restated/divergent concepts must stay visible in PDF and Brain.",
      operatorAction: "Hydrate Companyfacts and compare revenue, income, assets, liabilities, equity, cash flow and capex coverage.",
    }),
    lane({
      id: "xbrl_concept_matrix",
      label: "XBRL concept coverage matrix",
      surface: "real_markets",
      state: secHydrationAllowed ? "watch" : realMarket ? "blocked" : "not_applicable",
      progressBefore: 34,
      progressAfter: secHydrationAllowed ? 43 : 35,
      readyEvidence: [secHydrationAllowed && "Concept matrix can run once runtime payload is returned", args.pass2488?.realSecIdentityReady && "PASS2488 SEC identity ready"],
      missingEvidence: [!args.pass2488?.realSecXbrlFresh && "PASS2488 realSecXbrlFresh is not ready", !args.pass2488?.realFundamentalCoverageReady && "PASS2488 realFundamentalCoverageReady is not ready"],
      customerBoundary: "A real filing lane is a coverage matrix, not filler text; Advanced must show which concepts are missing.",
      operatorAction: "Write latest concept coverage into source-sync, modal, PDF and Angel before allowing paid-filing copy.",
    }),
    lane({
      id: "etf_holdings_boundary",
      label: "ETF holdings vs issuer filing boundary",
      surface: "real_markets",
      state: known?.holdingsBoundary ? "watch" : realMarket ? "ready" : "not_applicable",
      progressBefore: 24,
      progressAfter: known?.holdingsBoundary ? 32 : realMarket ? 36 : 24,
      readyEvidence: [realMarket && !known?.holdingsBoundary && "Stock path uses filings/fundamentals; ETF holdings lane separated"],
      missingEvidence: [known?.holdingsBoundary && "ETF holdings/N-PORT freshness still required beyond Companyfacts"],
      customerBoundary: "ETF/holdings freshness must not be replaced with stock fundamentals copy.",
      operatorAction: "For SPY/QQQ, add holdings/N-PORT freshness before stronger Advanced ETF copy.",
    }),
    lane({
      id: "browser_pdf_surface_parity",
      label: "Browser/PDF SEC proof strip parity",
      surface: "browser_pdf",
      state: "ready",
      progressBefore: 51,
      progressAfter: 55,
      readyEvidence: ["Browser compact rail receives PASS2503 SEC/CIK status", "PDF headers receive PASS2503 adapter boundary"],
      missingEvidence: ["Runtime preview/download hash still needs persisted customer receipt capture"],
      customerBoundary: "Browser result can show SEC proof status, but final PDF still needs preview=download hash before paid delivery copy.",
      operatorAction: "Keep public Browser card compact and route deeper SEC/XBRL proof into preview/report surfaces.",
    }),
    lane({
      id: "wallet_drawer_motion_boundary",
      label: "Wallet drawer motion and payment boundary rail",
      surface: "wallet_drawer",
      state: "ready",
      progressBefore: 48,
      progressAfter: 52,
      readyEvidence: ["Wallet drawer receives PASS2503 motion/rounded geometry boundary", "Wallet connect remains identity only"],
      missingEvidence: ["MetaMask/Phantom icon click-through should be screenshot-tested on mobile"],
      customerBoundary: "Wallet connect never proves paid Advanced, SEC hydration, filing freshness or artifact delivery.",
      operatorAction: "Unify wallet/menu/cart motion and keep payment proof server-side only.",
    }),
  ];
  const nonEntitlementLanesTouched = lanes.filter((item) => item.surface !== "all" && item.state !== "not_applicable").length;
  return {
    id: PASS2503_REAL_MARKETS_SEC_COMPANYFACTS_HYDRATOR_ID,
    state,
    query,
    symbol: normalized || clean(args.symbol || args.result?.token.symbol || args.query || "VLM").toUpperCase(),
    assetClass,
    cik,
    issuerName: known?.name ?? null,
    secUserAgentConfigured,
    secUserAgentState: secUserAgentInspection.state,
    endpoints,
    referencePolicy: SEC_EDGAR_CUSTOMER_BOUNDARY,
    xbrlConcepts: XBRL_CONCEPTS,
    secReferencePreflightReady,
    secHydrationAllowed,
    paidFilingCopyAllowed,
    nonEntitlementLanesTouched,
    lanes,
    realMarketsProgressBefore: 48,
    realMarketsProgressAfter: secHydrationAllowed ? 58 : cik ? 53 : 49,
    browserPdfProgressBefore: 51,
    browserPdfProgressAfter: 55,
    walletProgressBefore: 48,
    walletProgressAfter: 52,
    hardLocks,
    nextActions: [
      "Run SEC submissions + Companyfacts live fetch for AAPL/NVDA/SPY with SEC_USER_AGENT and persist filingDate/form/accession/facts coverage.",
      "Add ETF holdings/N-PORT freshness for SPY/QQQ separately from Companyfacts.",
      "Surface PASS2503 CIK/SEC state in Real Markets modal, Browser compact result, PDF headers and Angel context.",
      "Continue non-entitlement rebalance next: Shield Map icon resolver top-100 + wallet/menu/cart animation unification.",
    ],
    operatorRule:
      "PASS2503 exposes dated SEC reference readiness only. It does not advance entitlement, customer FINAL, sale, LIVE or security credit; it excludes third-party content and never turns filings into a market quote or investment advice.",
    fingerprint: `PASS2503-${hash({ query, normalized, assetClass, cik, secUserAgentConfigured, paidFilingCopyAllowed })}`,
    generatedAt: now.toISOString(),
  };
}
