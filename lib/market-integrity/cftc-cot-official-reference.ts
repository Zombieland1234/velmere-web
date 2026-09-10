import { createHash } from "node:crypto";

import {
  fetchWithDeadline,
  readResponseBytesBounded,
  type VelmereFetchRequestInit,
} from "@/lib/network/fetch-with-deadline";
import {
  applyDurableRateLimit,
  type DurableRateLimitDecision,
  type DurableRateLimitOptions,
} from "@/lib/security/durable-rate-limit";
import { parseStrictJsonBytes } from "@/lib/security/strict-json-boundary";

export const CFTC_COT_DATASETS = {
  disaggregatedFuturesOnly: {
    id: "72hh-3qpy",
    label: "CFTC Disaggregated - Futures Only",
    reportType: "disaggregated_futures_only",
  },
  tradersInFinancialFuturesOnly: {
    id: "gpe5-46if",
    label: "CFTC Traders in Financial Futures - Futures Only",
    reportType: "traders_in_financial_futures_only",
  },
} as const;

export type CftcCotDatasetId = typeof CFTC_COT_DATASETS[keyof typeof CFTC_COT_DATASETS]["id"];
export type CftcCotTier = "Basic" | "Pro" | "Advanced";

type CftcCotInstrumentDefinition = {
  symbol: "CL=F" | "GC=F" | "ZN=F";
  label: string;
  datasetId: CftcCotDatasetId;
  cftcContractMarketCode: string;
  exactMarketAndExchangeName: string;
  positioningCategory: "managed_money" | "leveraged_money";
  longField: "m_money_positions_long_all" | "lev_money_positions_long";
  shortField: "m_money_positions_short_all" | "lev_money_positions_short";
};

/**
 * Exact, source-verified identities only. This registry intentionally has no
 * fuzzy search, prefix matching, alias fallback or inferred CFTC code.
 */
export const CFTC_COT_INSTRUMENTS = {
  "CL=F": {
    symbol: "CL=F",
    label: "WTI Crude Oil futures",
    datasetId: CFTC_COT_DATASETS.disaggregatedFuturesOnly.id,
    cftcContractMarketCode: "067651",
    exactMarketAndExchangeName: "WTI-PHYSICAL - NEW YORK MERCANTILE EXCHANGE",
    positioningCategory: "managed_money",
    longField: "m_money_positions_long_all",
    shortField: "m_money_positions_short_all",
  },
  "GC=F": {
    symbol: "GC=F",
    label: "Gold futures",
    datasetId: CFTC_COT_DATASETS.disaggregatedFuturesOnly.id,
    cftcContractMarketCode: "088691",
    exactMarketAndExchangeName: "GOLD - COMMODITY EXCHANGE INC.",
    positioningCategory: "managed_money",
    longField: "m_money_positions_long_all",
    shortField: "m_money_positions_short_all",
  },
  "ZN=F": {
    symbol: "ZN=F",
    label: "10-Year U.S. Treasury Note futures",
    datasetId: CFTC_COT_DATASETS.tradersInFinancialFuturesOnly.id,
    cftcContractMarketCode: "043602",
    exactMarketAndExchangeName: "UST 10Y NOTE - CHICAGO BOARD OF TRADE",
    positioningCategory: "leveraged_money",
    longField: "lev_money_positions_long",
    shortField: "lev_money_positions_short",
  },
} as const satisfies Record<string, CftcCotInstrumentDefinition>;

export type CftcCotInstrumentSymbol = keyof typeof CFTC_COT_INSTRUMENTS;

export const CFTC_COT_RUNTIME_POLICY = {
  host: "publicreportinghub.cftc.gov",
  maxConcurrent: 1,
  requestsPerMinute: 4,
  rateWindowMs: 60_000,
  deadlineMs: 2_500,
  maxResponseBytes: 524_288,
  maxRows: 13,
  maxReportAgeDays: 14,
  positiveCacheTtlSeconds: 21_600,
  negativeCacheTtlSeconds: 300,
  retryAfterMaxSeconds: 3_600,
} as const;

export const CFTC_COT_RIGHTS_BOUNDARY = {
  sourcePublisher: "U.S. Commodity Futures Trading Commission",
  sourceDataLandingPages: [
    "https://publicreportinghub.cftc.gov/Commitments-of-Traders/Disaggregated-Futures-Only/72hh-3qpy",
    "https://publicreportinghub.cftc.gov/Commitments-of-Traders/TFF-Futures-Only/gpe5-46if",
  ],
  sourceApiDocumentationPages: [
    "https://dev.socrata.com/foundry/publicreportinghub.cftc.gov/72hh-3qpy",
    "https://dev.socrata.com/foundry/publicreportinghub.cftc.gov/gpe5-46if",
  ],
  cftcWebPolicyUrl: "https://www.cftc.gov/WebPolicy/index.htm",
  policyReviewedAt: "2026-08-21T00:00:00.000Z",
  reverifyBy: "2026-09-04T23:59:59.999Z",
  publicDomainBasis: "CFTC states that U.S. Government information on its website is public domain and requests appropriate acknowledgement.",
  attribution: "Source: U.S. Commodity Futures Trading Commission (CFTC), Commitments of Traders; historical futures-only positioning data.",
  thirdPartyMaterialExcluded: true,
  cftcSealExcluded: true,
  endorsementClaimed: false,
  legalReviewRequired: true,
  productionPaidDisplayAuthorized: false,
  goPaidState: "LEGAL_REVIEW_REQUIRED_GO_PAID",
  customerFinalCredit: false,
  truthBoundary: "Only direct CFTC-published aggregate Futures Only positioning rows are projected. This historical reference is not live market data, an executable quote, investment advice, a risk score, confidence calibration, paid-value proof or Customer FINAL proof.",
} as const;

type CftcCotEnvironment = Pick<NodeJS.ProcessEnv, "CFTC_SOCRATA_APP_TOKEN"> | Record<string, string | undefined>;

export type CftcCotRequestBlocker =
  | "cftc_paid_tier_required"
  | "cftc_entitlement_required"
  | "cftc_instrument_not_whitelisted"
  | "cftc_rights_review_expired"
  | "cftc_now_invalid";

export type CftcCotOfficialReferenceRequest =
  | { ok: false; reason: CftcCotRequestBlocker }
  | {
      ok: true;
      symbol: CftcCotInstrumentSymbol;
      datasetId: CftcCotDatasetId;
      cftcContractMarketCode: string;
      url: string;
      headers: Record<string, string>;
      credentialState: "keyless" | "server_app_token" | "invalid_token_ignored_keyless";
      timeoutMs: typeof CFTC_COT_RUNTIME_POLICY.deadlineMs;
      maxResponseBytes: typeof CFTC_COT_RUNTIME_POLICY.maxResponseBytes;
      maxRows: typeof CFTC_COT_RUNTIME_POLICY.maxRows;
      positiveCacheTtlSeconds: typeof CFTC_COT_RUNTIME_POLICY.positiveCacheTtlSeconds;
      negativeCacheTtlSeconds: typeof CFTC_COT_RUNTIME_POLICY.negativeCacheTtlSeconds;
      referencePolicy: typeof CFTC_COT_RIGHTS_BOUNDARY;
    };

function exactInstrument(value: unknown): CftcCotInstrumentDefinition | null {
  if (typeof value !== "string" || !Object.prototype.hasOwnProperty.call(CFTC_COT_INSTRUMENTS, value)) return null;
  return CFTC_COT_INSTRUMENTS[value as CftcCotInstrumentSymbol];
}

function validServerAppToken(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{8,128}$/u.test(value);
}

function utcDay(value: Date) {
  return Date.parse(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function oldestAllowedReportDate(now: Date) {
  return new Date(utcDay(now) - CFTC_COT_RUNTIME_POLICY.maxReportAgeDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function buildExactDatasetUrl(definition: CftcCotInstrumentDefinition, now: Date) {
  const url = new URL(`https://${CFTC_COT_RUNTIME_POLICY.host}/resource/${definition.datasetId}.json`);
  const selectedFields = [
    "id",
    "market_and_exchange_names",
    "report_date_as_yyyy_mm_dd",
    "cftc_contract_market_code",
    "open_interest_all",
    definition.longField,
    definition.shortField,
  ];
  const today = now.toISOString().slice(0, 10);
  const oldest = oldestAllowedReportDate(now);
  url.searchParams.set("$select", selectedFields.join(","));
  url.searchParams.set(
    "$where",
    `cftc_contract_market_code='${definition.cftcContractMarketCode}' AND report_date_as_yyyy_mm_dd >= '${oldest}T00:00:00.000' AND report_date_as_yyyy_mm_dd <= '${today}T23:59:59.999'`,
  );
  url.searchParams.set("$order", "report_date_as_yyyy_mm_dd DESC");
  url.searchParams.set("$limit", String(CFTC_COT_RUNTIME_POLICY.maxRows));
  return url.toString();
}

export function buildCftcCotOfficialReferenceRequest(args: {
  symbol: string;
  tier: CftcCotTier;
  entitlementVerified: boolean;
  now?: Date;
  environment?: CftcCotEnvironment;
}): CftcCotOfficialReferenceRequest {
  if (args.tier === "Basic") return { ok: false, reason: "cftc_paid_tier_required" };
  if (!args.entitlementVerified) return { ok: false, reason: "cftc_entitlement_required" };
  const definition = exactInstrument(args.symbol);
  if (!definition) return { ok: false, reason: "cftc_instrument_not_whitelisted" };
  const now = args.now ?? new Date();
  if (!Number.isFinite(now.getTime())) return { ok: false, reason: "cftc_now_invalid" };
  if (now.getTime() > Date.parse(CFTC_COT_RIGHTS_BOUNDARY.reverifyBy)) {
    return { ok: false, reason: "cftc_rights_review_expired" };
  }

  const environment = args.environment ?? process.env;
  const suppliedToken = environment.CFTC_SOCRATA_APP_TOKEN;
  const tokenIsValid = validServerAppToken(suppliedToken);
  const serverRuntime = typeof window === "undefined";
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": "Velmere-CFTC-COT-Reference/1.0",
  };
  if (serverRuntime && tokenIsValid) headers["x-app-token"] = String(suppliedToken);

  return {
    ok: true,
    symbol: definition.symbol,
    datasetId: definition.datasetId,
    cftcContractMarketCode: definition.cftcContractMarketCode,
    url: buildExactDatasetUrl(definition, now),
    headers,
    credentialState: serverRuntime && tokenIsValid
      ? "server_app_token"
      : suppliedToken
        ? "invalid_token_ignored_keyless"
        : "keyless",
    timeoutMs: CFTC_COT_RUNTIME_POLICY.deadlineMs,
    maxResponseBytes: CFTC_COT_RUNTIME_POLICY.maxResponseBytes,
    maxRows: CFTC_COT_RUNTIME_POLICY.maxRows,
    positiveCacheTtlSeconds: CFTC_COT_RUNTIME_POLICY.positiveCacheTtlSeconds,
    negativeCacheTtlSeconds: CFTC_COT_RUNTIME_POLICY.negativeCacheTtlSeconds,
    referencePolicy: CFTC_COT_RIGHTS_BOUNDARY,
  };
}

export type CftcCotHistoricalReference = {
  schemaVersion: "velmere.cftc-cot-official-reference.v1";
  fieldId: "market.cftc_cot_historical_positioning";
  semanticClass: "historical_official_reference";
  sourceFamily: "cftc_cot_official";
  sourceFamilyCount: 1;
  datasetId: CftcCotDatasetId;
  reportType: "disaggregated_futures_only" | "traders_in_financial_futures_only";
  instrumentSymbol: CftcCotInstrumentSymbol;
  instrumentLabel: string;
  cftcContractMarketCode: string;
  marketAndExchangeName: string;
  reportDate: string;
  ageDays: number;
  positioningCategory: "managed_money" | "leveraged_money";
  openInterest: number;
  longPositions: number;
  shortPositions: number;
  netPositions: number;
  unit: "contracts";
  attribution: typeof CFTC_COT_RIGHTS_BOUNDARY.attribution;
  historicalReferenceOnly: true;
  referenceOnly: true;
  liveClaimed: false;
  executable: false;
  marketPriceEligible: false;
  riskScore: null;
  confidence: null;
};

export type CftcCotReceipt = {
  schemaVersion: "velmere.cftc-cot-official-receipt.v1";
  receiptId: string;
  receiptDigest: string;
  requestSha256: string;
  responseSha256: string;
  responseBytes: number;
  datasetId: CftcCotDatasetId;
  cftcContractMarketCode: string;
  sourceFamily: "cftc_cot_official";
  sourceFamilyCount: 1;
  rawRowCount: number;
  deduplicatedRowCount: number;
  fetchedAt: string;
  latestReportDate: string;
};

type ProjectionFailureReason =
  | "cftc_instrument_not_whitelisted"
  | "cftc_dataset_mismatch"
  | "cftc_request_identity_mismatch"
  | "cftc_payload_not_array"
  | "cftc_row_limit_exceeded"
  | "cftc_rows_missing"
  | "cftc_row_invalid"
  | "cftc_contract_code_mismatch"
  | "cftc_market_identity_mismatch"
  | "cftc_report_date_invalid"
  | "cftc_report_date_future"
  | "cftc_report_stale"
  | "cftc_numeric_value_invalid"
  | "cftc_position_value_inconsistent"
  | "cftc_duplicate_report_conflict";

export type CftcCotProjectionResult =
  | { ok: false; reason: ProjectionFailureReason }
  | { ok: true; references: CftcCotHistoricalReference[]; receipt: CftcCotReceipt };

function sha256(value: string | Uint8Array) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeUnsignedInteger(value: unknown) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,15})$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function strictReportDate(value: unknown, now: Date) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.\d{3})?Z?$/u.test(value)) {
    return { ok: false as const, reason: "cftc_report_date_invalid" as const };
  }
  const reportDayText = value.slice(0, 10);
  const reportDay = Date.parse(`${reportDayText}T00:00:00.000Z`);
  const nowDay = utcDay(now);
  if (!Number.isFinite(reportDay) || new Date(reportDay).toISOString().slice(0, 10) !== reportDayText) {
    return { ok: false as const, reason: "cftc_report_date_invalid" as const };
  }
  if (reportDay > nowDay) return { ok: false as const, reason: "cftc_report_date_future" as const };
  const ageDays = Math.floor((nowDay - reportDay) / 86_400_000);
  if (ageDays > CFTC_COT_RUNTIME_POLICY.maxReportAgeDays) {
    return { ok: false as const, reason: "cftc_report_stale" as const };
  }
  return { ok: true as const, reportDate: reportDayText, ageDays };
}

function datasetReportType(datasetId: CftcCotDatasetId) {
  return datasetId === CFTC_COT_DATASETS.disaggregatedFuturesOnly.id
    ? CFTC_COT_DATASETS.disaggregatedFuturesOnly.reportType
    : CFTC_COT_DATASETS.tradersInFinancialFuturesOnly.reportType;
}

function exactRequestIdentity(urlValue: string, definition: CftcCotInstrumentDefinition) {
  try {
    const url = new URL(urlValue);
    return url.protocol === "https:"
      && url.hostname === CFTC_COT_RUNTIME_POLICY.host
      && url.port === ""
      && url.username === ""
      && url.password === ""
      && url.pathname === `/resource/${definition.datasetId}.json`
      && url.searchParams.get("$limit") === String(CFTC_COT_RUNTIME_POLICY.maxRows)
      && url.searchParams.get("$where")?.includes(`cftc_contract_market_code='${definition.cftcContractMarketCode}'`) === true;
  } catch {
    return false;
  }
}

export function projectCftcCotOfficialReferencePayload(args: {
  symbol: string;
  datasetId: string;
  payload: unknown;
  now: Date;
  fetchedAt: string;
  requestUrl: string;
  responseSha256?: string;
  responseBytes?: number;
}): CftcCotProjectionResult {
  const definition = exactInstrument(args.symbol);
  if (!definition) return { ok: false, reason: "cftc_instrument_not_whitelisted" };
  if (args.datasetId !== definition.datasetId) return { ok: false, reason: "cftc_dataset_mismatch" };
  if (!exactRequestIdentity(args.requestUrl, definition)) return { ok: false, reason: "cftc_request_identity_mismatch" };
  if (!Array.isArray(args.payload)) return { ok: false, reason: "cftc_payload_not_array" };
  if (args.payload.length > CFTC_COT_RUNTIME_POLICY.maxRows) return { ok: false, reason: "cftc_row_limit_exceeded" };
  if (args.payload.length === 0) return { ok: false, reason: "cftc_rows_missing" };

  const byReportDate = new Map<string, CftcCotHistoricalReference>();
  for (const rawRow of args.payload) {
    if (!isRecord(rawRow)) return { ok: false, reason: "cftc_row_invalid" };
    if (rawRow.cftc_contract_market_code !== definition.cftcContractMarketCode) {
      return { ok: false, reason: "cftc_contract_code_mismatch" };
    }
    if (rawRow.market_and_exchange_names !== definition.exactMarketAndExchangeName) {
      return { ok: false, reason: "cftc_market_identity_mismatch" };
    }
    const reportDate = strictReportDate(rawRow.report_date_as_yyyy_mm_dd, args.now);
    if (!reportDate.ok) return reportDate;
    const openInterest = safeUnsignedInteger(rawRow.open_interest_all);
    const longPositions = safeUnsignedInteger(rawRow[definition.longField]);
    const shortPositions = safeUnsignedInteger(rawRow[definition.shortField]);
    if (openInterest === null || longPositions === null || shortPositions === null) {
      return { ok: false, reason: "cftc_numeric_value_invalid" };
    }
    if (longPositions > openInterest || shortPositions > openInterest) {
      return { ok: false, reason: "cftc_position_value_inconsistent" };
    }
    const netPositions = longPositions - shortPositions;
    if (!Number.isSafeInteger(netPositions)) return { ok: false, reason: "cftc_numeric_value_invalid" };
    const reference: CftcCotHistoricalReference = {
      schemaVersion: "velmere.cftc-cot-official-reference.v1",
      fieldId: "market.cftc_cot_historical_positioning",
      semanticClass: "historical_official_reference",
      sourceFamily: "cftc_cot_official",
      sourceFamilyCount: 1,
      datasetId: definition.datasetId,
      reportType: datasetReportType(definition.datasetId),
      instrumentSymbol: definition.symbol,
      instrumentLabel: definition.label,
      cftcContractMarketCode: definition.cftcContractMarketCode,
      marketAndExchangeName: definition.exactMarketAndExchangeName,
      reportDate: reportDate.reportDate,
      ageDays: reportDate.ageDays,
      positioningCategory: definition.positioningCategory,
      openInterest,
      longPositions,
      shortPositions,
      netPositions,
      unit: "contracts",
      attribution: CFTC_COT_RIGHTS_BOUNDARY.attribution,
      historicalReferenceOnly: true,
      referenceOnly: true,
      liveClaimed: false,
      executable: false,
      marketPriceEligible: false,
      riskScore: null,
      confidence: null,
    };
    const existing = byReportDate.get(reference.reportDate);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(reference)) {
        return { ok: false, reason: "cftc_duplicate_report_conflict" };
      }
      continue;
    }
    byReportDate.set(reference.reportDate, reference);
  }

  const references = [...byReportDate.values()].sort((left, right) => right.reportDate.localeCompare(left.reportDate));
  if (!references.length) return { ok: false, reason: "cftc_rows_missing" };
  const canonicalResponse = JSON.stringify(args.payload);
  const responseDigest = args.responseSha256 && /^sha256:[a-f0-9]{64}$/u.test(args.responseSha256)
    ? args.responseSha256
    : sha256(canonicalResponse);
  const responseBytes = Number.isSafeInteger(args.responseBytes) && Number(args.responseBytes) >= 0
    ? Number(args.responseBytes)
    : new TextEncoder().encode(canonicalResponse).byteLength;
  const requestSha256 = sha256(args.requestUrl);
  const receiptCore = {
    datasetId: definition.datasetId,
    cftcContractMarketCode: definition.cftcContractMarketCode,
    sourceFamily: "cftc_cot_official" as const,
    sourceFamilyCount: 1 as const,
    rawRowCount: args.payload.length,
    deduplicatedRowCount: references.length,
    fetchedAt: args.fetchedAt,
    latestReportDate: references[0].reportDate,
    requestSha256,
    responseSha256: responseDigest,
    responseBytes,
  };
  const receiptDigest = sha256(JSON.stringify(receiptCore));
  return {
    ok: true,
    references,
    receipt: {
      schemaVersion: "velmere.cftc-cot-official-receipt.v1",
      receiptId: `cftc_cot_${receiptDigest.slice("sha256:".length, "sha256:".length + 24)}`,
      receiptDigest,
      ...receiptCore,
    },
  };
}

export type CftcCotOfficialReferenceEnvelope = {
  schemaVersion: "velmere.cftc-cot-official-envelope.v1";
  state: "available" | "withheld" | "temporarily_unavailable";
  blocker: string | null;
  retryAfterSeconds: number | null;
  fetchedAt: string;
  requestedSymbol: string;
  requestedTier: CftcCotTier;
  datasetId: CftcCotDatasetId | null;
  sourceId: "cftc_cot_futures_only";
  sourceFamily: "cftc_cot_official";
  sourceFamilyCount: 0 | 1;
  attribution: typeof CFTC_COT_RIGHTS_BOUNDARY.attribution;
  rightsBoundary: typeof CFTC_COT_RIGHTS_BOUNDARY;
  goPaidState: typeof CFTC_COT_RIGHTS_BOUNDARY.goPaidState;
  cacheState: "miss" | "positive_hit" | "negative_hit";
  references: CftcCotHistoricalReference[];
  receipt: CftcCotReceipt | null;
  historicalReferenceOnly: true;
  referenceOnly: true;
  liveClaimed: false;
  executable: false;
  marketPriceEligible: false;
  riskScore: null;
  confidence: null;
  customerFinalCredit: false;
  truthBoundary: typeof CFTC_COT_RIGHTS_BOUNDARY.truthBoundary;
};

function envelopeBase(args: {
  state: CftcCotOfficialReferenceEnvelope["state"];
  blocker: string | null;
  retryAfterSeconds?: number | null;
  now: Date;
  symbol: string;
  tier: CftcCotTier;
  datasetId?: CftcCotDatasetId | null;
  cacheState?: CftcCotOfficialReferenceEnvelope["cacheState"];
  references?: CftcCotHistoricalReference[];
  receipt?: CftcCotReceipt | null;
}): CftcCotOfficialReferenceEnvelope {
  const references = args.references ?? [];
  return {
    schemaVersion: "velmere.cftc-cot-official-envelope.v1",
    state: args.state,
    blocker: args.blocker,
    retryAfterSeconds: args.retryAfterSeconds ?? null,
    fetchedAt: args.now.toISOString(),
    requestedSymbol: args.symbol,
    requestedTier: args.tier,
    datasetId: args.datasetId ?? null,
    sourceId: "cftc_cot_futures_only",
    sourceFamily: "cftc_cot_official",
    sourceFamilyCount: references.length ? 1 : 0,
    attribution: CFTC_COT_RIGHTS_BOUNDARY.attribution,
    rightsBoundary: CFTC_COT_RIGHTS_BOUNDARY,
    goPaidState: CFTC_COT_RIGHTS_BOUNDARY.goPaidState,
    cacheState: args.cacheState ?? "miss",
    references,
    receipt: args.receipt ?? null,
    historicalReferenceOnly: true,
    referenceOnly: true,
    liveClaimed: false,
    executable: false,
    marketPriceEligible: false,
    riskScore: null,
    confidence: null,
    customerFinalCredit: false,
    truthBoundary: CFTC_COT_RIGHTS_BOUNDARY.truthBoundary,
  };
}

type CacheEntry = { expiresAt: number; positive: boolean; value: CftcCotOfficialReferenceEnvelope };
const referenceCache = new Map<string, CacheEntry>();
const inFlightByKey = new Map<string, Promise<CftcCotOfficialReferenceEnvelope>>();
let activeProviderExecutions = 0;

export const cftcCotOfficialReferenceDependencies: {
  reserveRateLimit: (options: DurableRateLimitOptions) => Promise<DurableRateLimitDecision>;
  fetch: (
    input: RequestInfo | URL,
    init: VelmereFetchRequestInit,
    options: { timeoutMs: number; operation: string },
  ) => Promise<Response>;
} = {
  reserveRateLimit: applyDurableRateLimit,
  fetch: fetchWithDeadline,
};

export function resetCftcCotOfficialReferenceTestState() {
  referenceCache.clear();
  inFlightByKey.clear();
  activeProviderExecutions = 0;
}

function boundedRetryAfter(value: string | null, now: Date) {
  if (!value) return null;
  const integerSeconds = /^\d+$/u.test(value.trim()) ? Number(value.trim()) : NaN;
  const dateSeconds = Number.isFinite(integerSeconds)
    ? integerSeconds
    : Math.ceil((Date.parse(value) - now.getTime()) / 1_000);
  if (!Number.isFinite(dateSeconds) || dateSeconds <= 0) return null;
  return Math.max(1, Math.min(CFTC_COT_RUNTIME_POLICY.retryAfterMaxSeconds, Math.ceil(dateSeconds)));
}

function cachedEnvelope(cacheKey: string, now: Date) {
  const cached = referenceCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= now.getTime()) {
    referenceCache.delete(cacheKey);
    return null;
  }
  return {
    ...cached.value,
    cacheState: cached.positive ? "positive_hit" as const : "negative_hit" as const,
  };
}

function writeCache(cacheKey: string, now: Date, value: CftcCotOfficialReferenceEnvelope) {
  const positive = value.state === "available";
  const ttlSeconds = positive
    ? CFTC_COT_RUNTIME_POLICY.positiveCacheTtlSeconds
    : CFTC_COT_RUNTIME_POLICY.negativeCacheTtlSeconds;
  referenceCache.set(cacheKey, {
    expiresAt: now.getTime() + ttlSeconds * 1_000,
    positive,
    value,
  });
  return value;
}

function limiterBlocker(decision: DurableRateLimitDecision) {
  const unavailable = decision.mode === "unavailable"
    || decision.mode === "disabled"
    || decision.degraded
    || decision.reason === "rate_limit_store_unavailable";
  return unavailable ? "cftc_rate_limit_store_unavailable" : "cftc_rate_limited";
}

function providerErrorBlocker(error: unknown) {
  const code = isRecord(error) && typeof error.code === "string" ? error.code : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/deadline|timeout|aborted/iu.test(`${code} ${message}`)) return "cftc_timeout";
  if (/response_too_large/iu.test(`${code} ${message}`)) return "cftc_response_too_large";
  if (/response_content_type/iu.test(`${code} ${message}`)) return "cftc_response_content_type";
  if (/strict_json|invalid_json|response_invalid_json/iu.test(`${code} ${message}`)) return "cftc_response_invalid_json";
  return "cftc_provider_unavailable";
}

async function executeCftcCotReferenceRequest(args: {
  request: Extract<CftcCotOfficialReferenceRequest, { ok: true }>;
  now: Date;
  tier: CftcCotTier;
  cacheKey: string;
}) {
  const decision = await cftcCotOfficialReferenceDependencies.reserveRateLimit({
    namespace: "cftc-cot:global-budget",
    key: CFTC_COT_RUNTIME_POLICY.host,
    limit: CFTC_COT_RUNTIME_POLICY.requestsPerMinute,
    windowMs: CFTC_COT_RUNTIME_POLICY.rateWindowMs,
    cost: 1,
  });
  if (!decision.ok || decision.mode === "disabled" || decision.degraded) {
    return writeCache(args.cacheKey, args.now, envelopeBase({
      state: "temporarily_unavailable",
      blocker: limiterBlocker(decision),
      retryAfterSeconds: decision.retryAfterSeconds
        ? Math.min(CFTC_COT_RUNTIME_POLICY.retryAfterMaxSeconds, Math.max(1, decision.retryAfterSeconds))
        : null,
      now: args.now,
      symbol: args.request.symbol,
      tier: args.tier,
      datasetId: args.request.datasetId,
    }));
  }
  if (activeProviderExecutions >= CFTC_COT_RUNTIME_POLICY.maxConcurrent) {
    return envelopeBase({
      state: "temporarily_unavailable",
      blocker: "cftc_concurrency_budget_exhausted",
      now: args.now,
      symbol: args.request.symbol,
      tier: args.tier,
      datasetId: args.request.datasetId,
    });
  }

  activeProviderExecutions += 1;
  const deadlineController = new AbortController();
  const deadlineTimer = globalThis.setTimeout(() => {
    deadlineController.abort(new DOMException("CFTC COT total deadline exceeded", "TimeoutError"));
  }, CFTC_COT_RUNTIME_POLICY.deadlineMs);
  try {
    const response = await cftcCotOfficialReferenceDependencies.fetch(
      args.request.url,
      {
        method: "GET",
        headers: args.request.headers,
        cache: "no-store",
        redirect: "error",
        signal: deadlineController.signal,
      },
      {
        timeoutMs: CFTC_COT_RUNTIME_POLICY.deadlineMs,
        operation: "cftc_cot_futures_only_reference",
      },
    );
    if (!response.ok) {
      return writeCache(args.cacheKey, args.now, envelopeBase({
        state: "temporarily_unavailable",
        blocker: `cftc_http_${response.status}`,
        retryAfterSeconds: response.status === 429
          ? boundedRetryAfter(response.headers.get("retry-after"), args.now)
          : null,
        now: args.now,
        symbol: args.request.symbol,
        tier: args.tier,
        datasetId: args.request.datasetId,
      }));
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!/(^|[;/\s])application\/(?:[a-z0-9.+-]+\+)?json(?:[;\s]|$)/iu.test(contentType)) {
      return writeCache(args.cacheKey, args.now, envelopeBase({
        state: "temporarily_unavailable",
        blocker: "cftc_response_content_type",
        now: args.now,
        symbol: args.request.symbol,
        tier: args.tier,
        datasetId: args.request.datasetId,
      }));
    }
    const bytes = await readResponseBytesBounded(response, CFTC_COT_RUNTIME_POLICY.maxResponseBytes, {
      timeoutMs: CFTC_COT_RUNTIME_POLICY.deadlineMs,
      operation: "cftc_cot_response_body",
    });
    const payload = parseStrictJsonBytes<unknown>(bytes, {
      maxBytes: CFTC_COT_RUNTIME_POLICY.maxResponseBytes,
      maxDepth: 12,
      maxNodes: 2_000,
      requireArray: true,
      rejectDuplicateKeys: true,
      rejectDangerousKeys: true,
    });
    const projection = projectCftcCotOfficialReferencePayload({
      symbol: args.request.symbol,
      datasetId: args.request.datasetId,
      payload,
      now: args.now,
      fetchedAt: args.now.toISOString(),
      requestUrl: args.request.url,
      responseSha256: sha256(bytes),
      responseBytes: bytes.byteLength,
    });
    if (!projection.ok) {
      return writeCache(args.cacheKey, args.now, envelopeBase({
        state: "withheld",
        blocker: projection.reason,
        now: args.now,
        symbol: args.request.symbol,
        tier: args.tier,
        datasetId: args.request.datasetId,
      }));
    }
    return writeCache(args.cacheKey, args.now, envelopeBase({
      state: "available",
      blocker: null,
      now: args.now,
      symbol: args.request.symbol,
      tier: args.tier,
      datasetId: args.request.datasetId,
      references: projection.references,
      receipt: projection.receipt,
    }));
  } catch (error) {
    return writeCache(args.cacheKey, args.now, envelopeBase({
      state: "temporarily_unavailable",
      blocker: providerErrorBlocker(error),
      now: args.now,
      symbol: args.request.symbol,
      tier: args.tier,
      datasetId: args.request.datasetId,
    }));
  } finally {
    globalThis.clearTimeout(deadlineTimer);
    activeProviderExecutions = Math.max(0, activeProviderExecutions - 1);
  }
}

export async function loadCftcCotOfficialReference(args: {
  symbol: string;
  tier: CftcCotTier;
  entitlementVerified: boolean;
  now?: Date;
  environment?: CftcCotEnvironment;
}): Promise<CftcCotOfficialReferenceEnvelope> {
  const now = args.now ?? new Date();
  const preflight = buildCftcCotOfficialReferenceRequest({ ...args, now });
  if (!preflight.ok) {
    return envelopeBase({
      state: "withheld",
      blocker: preflight.reason,
      now: Number.isFinite(now.getTime()) ? now : new Date(0),
      symbol: args.symbol,
      tier: args.tier,
    });
  }

  const cacheKey = `${preflight.datasetId}:${preflight.cftcContractMarketCode}`;
  const cached = cachedEnvelope(cacheKey, now);
  if (cached) return cached;
  const existing = inFlightByKey.get(cacheKey);
  if (existing) return existing;
  const execution = executeCftcCotReferenceRequest({ request: preflight, now, tier: args.tier, cacheKey });
  inFlightByKey.set(cacheKey, execution);
  try {
    return await execution;
  } finally {
    if (inFlightByKey.get(cacheKey) === execution) inFlightByKey.delete(cacheKey);
  }
}
