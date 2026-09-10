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

export const WORLD_BANK_WDI_INDICATORS = {
  inflation: {
    id: "FP.CPI.TOTL.ZG",
    label: "Inflation, consumer prices (annual %)",
    fieldId: "market.macro.inflation_annual_pct",
    minimum: -100,
    maximum: 100_000,
  },
  unemployment: {
    id: "SL.UEM.TOTL.ZS",
    label: "Unemployment, total (% of total labor force) (modeled ILO estimate)",
    fieldId: "market.macro.unemployment_annual_pct",
    minimum: 0,
    maximum: 100,
  },
} as const;

export type WorldBankWdiIndicatorKey = keyof typeof WORLD_BANK_WDI_INDICATORS;
export type WorldBankWdiIndicatorId = typeof WORLD_BANK_WDI_INDICATORS[WorldBankWdiIndicatorKey]["id"];

const WORLD_BANK_WDI_COUNTRIES = {
  EMU: { iso3: "EMU", apiId: "XC", label: "Euro area", currency: "EUR" },
  USA: { iso3: "USA", apiId: "US", label: "United States", currency: "USD" },
  POL: { iso3: "POL", apiId: "PL", label: "Poland", currency: "PLN" },
  JPN: { iso3: "JPN", apiId: "JP", label: "Japan", currency: "JPY" },
  GBR: { iso3: "GBR", apiId: "GB", label: "United Kingdom", currency: "GBP" },
  TUR: { iso3: "TUR", apiId: "TR", label: "Turkiye", currency: "TRY" },
  CHE: { iso3: "CHE", apiId: "CH", label: "Switzerland", currency: "CHF" },
} as const;

export type WorldBankWdiCountryCode = keyof typeof WORLD_BANK_WDI_COUNTRIES;

type FxInstrumentDefinition = {
  symbol: string;
  pair: string;
  countries: readonly [WorldBankWdiCountryCode, WorldBankWdiCountryCode];
};

/**
 * Exact current Real Markets provider identities only. There is deliberately no
 * fuzzy symbol parsing, implicit country inference, or arbitrary World Bank
 * country selection at the customer boundary.
 */
export const WORLD_BANK_WDI_FX_INSTRUMENTS = {
  "EURUSD=X": { symbol: "EURUSD=X", pair: "EUR/USD", countries: ["EMU", "USA"] },
  "EURPLN=X": { symbol: "EURPLN=X", pair: "EUR/PLN", countries: ["EMU", "POL"] },
  "USDPLN=X": { symbol: "USDPLN=X", pair: "USD/PLN", countries: ["USA", "POL"] },
  "JPY=X": { symbol: "JPY=X", pair: "USD/JPY", countries: ["USA", "JPN"] },
  "GBPUSD=X": { symbol: "GBPUSD=X", pair: "GBP/USD", countries: ["GBR", "USA"] },
  "EURTRY=X": { symbol: "EURTRY=X", pair: "EUR/TRY", countries: ["EMU", "TUR"] },
  "TRY=X": { symbol: "TRY=X", pair: "USD/TRY", countries: ["USA", "TUR"] },
  "EURGBP=X": { symbol: "EURGBP=X", pair: "EUR/GBP", countries: ["EMU", "GBR"] },
  "CHF=X": { symbol: "CHF=X", pair: "USD/CHF", countries: ["USA", "CHE"] },
} as const satisfies Record<string, FxInstrumentDefinition>;

export type WorldBankWdiFxSymbol = keyof typeof WORLD_BANK_WDI_FX_INSTRUMENTS;
export type WorldBankWdiTier = "Basic" | "Pro" | "Advanced";

export const WORLD_BANK_WDI_RUNTIME_POLICY = {
  host: "api.worldbank.org",
  apiVersion: "v2",
  maxConcurrent: 1,
  requestsPerMinute: 6,
  requestCost: 2,
  rateWindowMs: 60_000,
  deadlineMs: 3_000,
  maxResponseBytes: 262_144,
  maxRowsPerResponse: 6,
  maxRowsTotal: 12,
  mostRecentValues: 3,
  maxLatestObservationLagYears: 3,
  positiveCacheTtlSeconds: 86_400,
  negativeCacheTtlSeconds: 300,
  retryAfterMaxSeconds: 3_600,
} as const;

export const WORLD_BANK_WDI_RIGHTS_BOUNDARY = {
  sourcePublisher: "World Bank",
  sourceDataset: "World Development Indicators (WDI)",
  sourceId: "2",
  datasetUrl: "https://datacatalog.worldbank.org/search/dataset/0037712/world-development-indicators",
  apiDocumentationUrl: "https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  worldBankLicensePageUrl: "https://datacatalog.worldbank.org/public-licenses",
  license: "CC-BY-4.0",
  attribution: "Source: World Bank, World Development Indicators (WDI), licensed under CC BY 4.0; annual historical macroeconomic observations.",
  modificationDisclosure: "Velmere does not alter source values; it only validates, orders and labels the direct annual observations. Any future transformation must identify the change.",
  policyReviewedAt: "2026-08-21T00:00:00.000Z",
  reverifyBy: "2026-09-04T23:59:59.999Z",
  keylessOfficialApi: true,
  commercialReuseIndicatedByPublishedLicense: true,
  attributionRequired: true,
  thirdPartyMaterialExcluded: true,
  endorsementClaimed: false,
  legalReviewRequired: true,
  productionPaidDisplayAuthorized: false,
  goPaidState: "LEGAL_REVIEW_REQUIRED_GO_PAID",
  customerFinalCredit: false,
  truthBoundary: "Only direct World Bank WDI annual inflation and modeled unemployment observations are projected. They are historical macro references, not live prices, executable quotes, forecasts, personalized advice, risk scores, confidence calibration, paid-value proof or Customer FINAL proof.",
} as const;

type WorldBankWdiRequestBlocker =
  | "world_bank_paid_tier_required"
  | "world_bank_entitlement_required"
  | "world_bank_instrument_not_whitelisted"
  | "world_bank_go_paid_legal_review_required"
  | "world_bank_rights_review_expired"
  | "world_bank_now_invalid";

type WorldBankWdiRequestUrl = {
  indicatorKey: WorldBankWdiIndicatorKey;
  indicatorId: WorldBankWdiIndicatorId;
  url: string;
};

export type WorldBankWdiOfficialReferenceRequest =
  | { ok: false; reason: WorldBankWdiRequestBlocker }
  | {
      ok: true;
      symbol: WorldBankWdiFxSymbol;
      pair: string;
      countries: readonly [WorldBankWdiCountryCode, WorldBankWdiCountryCode];
      urls: readonly WorldBankWdiRequestUrl[];
      headers: Readonly<Record<string, string>>;
      credentialState: "keyless";
      timeoutMs: typeof WORLD_BANK_WDI_RUNTIME_POLICY.deadlineMs;
      maxResponseBytes: typeof WORLD_BANK_WDI_RUNTIME_POLICY.maxResponseBytes;
      positiveCacheTtlSeconds: typeof WORLD_BANK_WDI_RUNTIME_POLICY.positiveCacheTtlSeconds;
      negativeCacheTtlSeconds: typeof WORLD_BANK_WDI_RUNTIME_POLICY.negativeCacheTtlSeconds;
      referencePolicy: typeof WORLD_BANK_WDI_RIGHTS_BOUNDARY;
    };

function exactInstrument(value: unknown): FxInstrumentDefinition | null {
  if (typeof value !== "string" || !Object.prototype.hasOwnProperty.call(WORLD_BANK_WDI_FX_INSTRUMENTS, value)) {
    return null;
  }
  return WORLD_BANK_WDI_FX_INSTRUMENTS[value as WorldBankWdiFxSymbol];
}

function exactIndicatorById(value: unknown) {
  if (value === WORLD_BANK_WDI_INDICATORS.inflation.id) {
    return { key: "inflation" as const, ...WORLD_BANK_WDI_INDICATORS.inflation };
  }
  if (value === WORLD_BANK_WDI_INDICATORS.unemployment.id) {
    return { key: "unemployment" as const, ...WORLD_BANK_WDI_INDICATORS.unemployment };
  }
  return null;
}

function buildIndicatorUrl(definition: FxInstrumentDefinition, indicatorId: WorldBankWdiIndicatorId) {
  const countryPath = definition.countries.join(";");
  const url = new URL(`https://${WORLD_BANK_WDI_RUNTIME_POLICY.host}/${WORLD_BANK_WDI_RUNTIME_POLICY.apiVersion}/country/${countryPath}/indicator/${indicatorId}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("mrnev", String(WORLD_BANK_WDI_RUNTIME_POLICY.mostRecentValues));
  url.searchParams.set("per_page", String(WORLD_BANK_WDI_RUNTIME_POLICY.maxRowsPerResponse));
  return url.toString();
}

export function buildWorldBankWdiOfficialReferenceRequest(args: {
  symbol: string;
  tier: WorldBankWdiTier;
  entitlementVerified: boolean;
  productionLike: boolean;
  now?: Date;
}): WorldBankWdiOfficialReferenceRequest {
  if (args.tier === "Basic") return { ok: false, reason: "world_bank_paid_tier_required" };
  if (!args.entitlementVerified) return { ok: false, reason: "world_bank_entitlement_required" };
  const definition = exactInstrument(args.symbol);
  if (!definition) return { ok: false, reason: "world_bank_instrument_not_whitelisted" };
  const now = args.now ?? new Date();
  if (!Number.isFinite(now.getTime())) return { ok: false, reason: "world_bank_now_invalid" };
  if (now.getTime() > Date.parse(WORLD_BANK_WDI_RIGHTS_BOUNDARY.reverifyBy)) {
    return { ok: false, reason: "world_bank_rights_review_expired" };
  }
  if (args.productionLike && !WORLD_BANK_WDI_RIGHTS_BOUNDARY.productionPaidDisplayAuthorized) {
    return { ok: false, reason: "world_bank_go_paid_legal_review_required" };
  }

  return {
    ok: true,
    symbol: definition.symbol as WorldBankWdiFxSymbol,
    pair: definition.pair,
    countries: definition.countries,
    urls: (Object.keys(WORLD_BANK_WDI_INDICATORS) as WorldBankWdiIndicatorKey[]).map((indicatorKey) => {
      const indicator = WORLD_BANK_WDI_INDICATORS[indicatorKey];
      return {
        indicatorKey,
        indicatorId: indicator.id,
        url: buildIndicatorUrl(definition, indicator.id),
      };
    }),
    headers: {
      accept: "application/json",
      "user-agent": "Velmere-World-Bank-WDI-Reference/1.0",
    },
    credentialState: "keyless",
    timeoutMs: WORLD_BANK_WDI_RUNTIME_POLICY.deadlineMs,
    maxResponseBytes: WORLD_BANK_WDI_RUNTIME_POLICY.maxResponseBytes,
    positiveCacheTtlSeconds: WORLD_BANK_WDI_RUNTIME_POLICY.positiveCacheTtlSeconds,
    negativeCacheTtlSeconds: WORLD_BANK_WDI_RUNTIME_POLICY.negativeCacheTtlSeconds,
    referencePolicy: WORLD_BANK_WDI_RIGHTS_BOUNDARY,
  };
}

export type WorldBankWdiHistoricalReference = {
  schemaVersion: "velmere.world-bank-wdi-official-reference.v1";
  fieldId: "market.macro.inflation_annual_pct" | "market.macro.unemployment_annual_pct";
  semanticClass: "historical_annual_official_reference";
  sourceFamily: "world_bank_wdi_official";
  sourceFamilyCount: 1;
  instrumentSymbol: WorldBankWdiFxSymbol;
  pair: string;
  countryIso3: WorldBankWdiCountryCode;
  countryLabel: string;
  currency: string;
  indicatorId: WorldBankWdiIndicatorId;
  indicatorLabel: string;
  observationYear: number;
  observationValue: number;
  latestObservationLagYears: number;
  datasetLastUpdated: string;
  unit: "percent_per_year";
  attribution: typeof WORLD_BANK_WDI_RIGHTS_BOUNDARY.attribution;
  historicalAnnualReferenceOnly: true;
  referenceOnly: true;
  liveClaimed: false;
  executable: false;
  marketPriceEligible: false;
  paidValueEligible: false;
  riskScore: null;
  confidence: null;
};

export type WorldBankWdiReceipt = {
  schemaVersion: "velmere.world-bank-wdi-official-receipt.v1";
  receiptId: string;
  receiptDigest: string;
  requestSha256: string;
  responseSha256: string;
  responseBytes: number;
  indicatorId: WorldBankWdiIndicatorId;
  countries: readonly [WorldBankWdiCountryCode, WorldBankWdiCountryCode];
  sourceFamily: "world_bank_wdi_official";
  sourceFamilyCount: 1;
  rawRowCount: number;
  deduplicatedRowCount: number;
  fetchedAt: string;
  datasetLastUpdated: string;
};

type WorldBankWdiProjectionFailure =
  | "world_bank_instrument_not_whitelisted"
  | "world_bank_response_set_invalid"
  | "world_bank_indicator_response_missing"
  | "world_bank_indicator_response_duplicate"
  | "world_bank_request_identity_mismatch"
  | "world_bank_payload_shape_invalid"
  | "world_bank_metadata_invalid"
  | "world_bank_metadata_date_invalid"
  | "world_bank_row_limit_exceeded"
  | "world_bank_rows_missing"
  | "world_bank_row_invalid"
  | "world_bank_indicator_identity_mismatch"
  | "world_bank_country_identity_mismatch"
  | "world_bank_observation_year_invalid"
  | "world_bank_observation_year_future"
  | "world_bank_observation_stale"
  | "world_bank_value_invalid"
  | "world_bank_value_out_of_range"
  | "world_bank_duplicate_observation_conflict";

export type WorldBankWdiProjectionResult =
  | { ok: false; reason: WorldBankWdiProjectionFailure }
  | {
      ok: true;
      references: WorldBankWdiHistoricalReference[];
      receipts: WorldBankWdiReceipt[];
      aggregateReceiptDigest: string;
      sourceFamilyCount: 1;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sha256(value: string | Uint8Array) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function strictDate(value: unknown, now: Date) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) return null;
  const tomorrow = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`) + 86_400_000;
  return parsed < tomorrow ? value : null;
}

function exactRequestIdentity(args: {
  requestUrl: string;
  definition: FxInstrumentDefinition;
  indicatorId: WorldBankWdiIndicatorId;
}) {
  try {
    const url = new URL(args.requestUrl);
    return url.protocol === "https:"
      && url.hostname === WORLD_BANK_WDI_RUNTIME_POLICY.host
      && url.port === ""
      && url.username === ""
      && url.password === ""
      && url.pathname === `/${WORLD_BANK_WDI_RUNTIME_POLICY.apiVersion}/country/${args.definition.countries.join(";")}/indicator/${args.indicatorId}`
      && url.searchParams.size === 3
      && url.searchParams.get("format") === "json"
      && url.searchParams.get("mrnev") === String(WORLD_BANK_WDI_RUNTIME_POLICY.mostRecentValues)
      && url.searchParams.get("per_page") === String(WORLD_BANK_WDI_RUNTIME_POLICY.maxRowsPerResponse);
  } catch {
    return false;
  }
}

function parseIndicatorPayload(args: {
  definition: FxInstrumentDefinition;
  indicatorKey: WorldBankWdiIndicatorKey;
  requestUrl: string;
  payload: unknown;
  now: Date;
  fetchedAt: string;
  responseSha256?: string;
  responseBytes?: number;
}): { ok: false; reason: WorldBankWdiProjectionFailure } | {
  ok: true;
  references: WorldBankWdiHistoricalReference[];
  receipt: WorldBankWdiReceipt;
} {
  const indicator = WORLD_BANK_WDI_INDICATORS[args.indicatorKey];
  if (!exactRequestIdentity({ requestUrl: args.requestUrl, definition: args.definition, indicatorId: indicator.id })) {
    return { ok: false, reason: "world_bank_request_identity_mismatch" };
  }
  if (!Array.isArray(args.payload) || args.payload.length !== 2 || !isRecord(args.payload[0]) || !Array.isArray(args.payload[1])) {
    return { ok: false, reason: "world_bank_payload_shape_invalid" };
  }
  const metadata = args.payload[0];
  const rows = args.payload[1];
  if (
    metadata.page !== 1
    || metadata.pages !== 1
    || metadata.per_page !== WORLD_BANK_WDI_RUNTIME_POLICY.maxRowsPerResponse
    || (metadata.sourceid !== null && metadata.sourceid !== WORLD_BANK_WDI_RIGHTS_BOUNDARY.sourceId)
    || !Number.isSafeInteger(metadata.total)
    || Number(metadata.total) !== rows.length
  ) {
    return { ok: false, reason: "world_bank_metadata_invalid" };
  }
  if (rows.length > WORLD_BANK_WDI_RUNTIME_POLICY.maxRowsPerResponse) {
    return { ok: false, reason: "world_bank_row_limit_exceeded" };
  }
  if (!rows.length) return { ok: false, reason: "world_bank_rows_missing" };
  const datasetLastUpdated = strictDate(metadata.lastupdated, args.now);
  if (!datasetLastUpdated) return { ok: false, reason: "world_bank_metadata_date_invalid" };

  const expectedCountries = new Set<WorldBankWdiCountryCode>(args.definition.countries);
  const latestByCountry = new Map<WorldBankWdiCountryCode, number>();
  const byIdentity = new Map<string, WorldBankWdiHistoricalReference>();
  for (const rawRow of rows) {
    if (!isRecord(rawRow) || !isRecord(rawRow.indicator) || !isRecord(rawRow.country)) {
      return { ok: false, reason: "world_bank_row_invalid" };
    }
    if (rawRow.indicator.id !== indicator.id || rawRow.indicator.value !== indicator.label) {
      return { ok: false, reason: "world_bank_indicator_identity_mismatch" };
    }
    if (typeof rawRow.countryiso3code !== "string" || !expectedCountries.has(rawRow.countryiso3code as WorldBankWdiCountryCode)) {
      return { ok: false, reason: "world_bank_country_identity_mismatch" };
    }
    const countryCode = rawRow.countryiso3code as WorldBankWdiCountryCode;
    const country = WORLD_BANK_WDI_COUNTRIES[countryCode];
    if (rawRow.country.id !== country.apiId || rawRow.country.value !== country.label) {
      return { ok: false, reason: "world_bank_country_identity_mismatch" };
    }
    if (typeof rawRow.date !== "string" || !/^\d{4}$/u.test(rawRow.date)) {
      return { ok: false, reason: "world_bank_observation_year_invalid" };
    }
    const observationYear = Number(rawRow.date);
    const currentYear = args.now.getUTCFullYear();
    if (!Number.isSafeInteger(observationYear) || observationYear < 1900) {
      return { ok: false, reason: "world_bank_observation_year_invalid" };
    }
    if (observationYear > currentYear) return { ok: false, reason: "world_bank_observation_year_future" };
    if (typeof rawRow.value !== "number" || !Number.isFinite(rawRow.value)) {
      return { ok: false, reason: "world_bank_value_invalid" };
    }
    if (rawRow.value < indicator.minimum || rawRow.value > indicator.maximum) {
      return { ok: false, reason: "world_bank_value_out_of_range" };
    }
    if (rawRow.obs_status !== "" || !Number.isSafeInteger(rawRow.decimal) || Number(rawRow.decimal) < 0 || Number(rawRow.decimal) > 15) {
      return { ok: false, reason: "world_bank_row_invalid" };
    }
    latestByCountry.set(countryCode, Math.max(latestByCountry.get(countryCode) ?? 0, observationYear));
    const reference: WorldBankWdiHistoricalReference = {
      schemaVersion: "velmere.world-bank-wdi-official-reference.v1",
      fieldId: indicator.fieldId,
      semanticClass: "historical_annual_official_reference",
      sourceFamily: "world_bank_wdi_official",
      sourceFamilyCount: 1,
      instrumentSymbol: args.definition.symbol as WorldBankWdiFxSymbol,
      pair: args.definition.pair,
      countryIso3: countryCode,
      countryLabel: country.label,
      currency: country.currency,
      indicatorId: indicator.id,
      indicatorLabel: indicator.label,
      observationYear,
      observationValue: rawRow.value,
      latestObservationLagYears: 0,
      datasetLastUpdated,
      unit: "percent_per_year",
      attribution: WORLD_BANK_WDI_RIGHTS_BOUNDARY.attribution,
      historicalAnnualReferenceOnly: true,
      referenceOnly: true,
      liveClaimed: false,
      executable: false,
      marketPriceEligible: false,
      paidValueEligible: false,
      riskScore: null,
      confidence: null,
    };
    const identity = `${countryCode}:${indicator.id}:${observationYear}`;
    const existing = byIdentity.get(identity);
    if (existing && JSON.stringify(existing) !== JSON.stringify(reference)) {
      return { ok: false, reason: "world_bank_duplicate_observation_conflict" };
    }
    byIdentity.set(identity, reference);
  }
  if ([...expectedCountries].some((country) => !latestByCountry.has(country))) {
    return { ok: false, reason: "world_bank_country_identity_mismatch" };
  }
  for (const [country, latestYear] of latestByCountry) {
    const lag = args.now.getUTCFullYear() - latestYear;
    if (lag > WORLD_BANK_WDI_RUNTIME_POLICY.maxLatestObservationLagYears) {
      return { ok: false, reason: "world_bank_observation_stale" };
    }
    for (const [identity, reference] of byIdentity) {
      if (reference.countryIso3 === country) byIdentity.set(identity, { ...reference, latestObservationLagYears: lag });
    }
  }
  const references = [...byIdentity.values()].sort((left, right) =>
    left.countryIso3.localeCompare(right.countryIso3)
    || right.observationYear - left.observationYear,
  );
  const canonicalResponse = JSON.stringify(args.payload);
  const responseSha256 = args.responseSha256 && /^sha256:[a-f0-9]{64}$/u.test(args.responseSha256)
    ? args.responseSha256
    : sha256(canonicalResponse);
  const responseBytes = Number.isSafeInteger(args.responseBytes) && Number(args.responseBytes) >= 0
    ? Number(args.responseBytes)
    : new TextEncoder().encode(canonicalResponse).byteLength;
  const receiptCore = {
    requestSha256: sha256(args.requestUrl),
    responseSha256,
    responseBytes,
    indicatorId: indicator.id,
    countries: args.definition.countries,
    sourceFamily: "world_bank_wdi_official" as const,
    sourceFamilyCount: 1 as const,
    rawRowCount: rows.length,
    deduplicatedRowCount: references.length,
    fetchedAt: args.fetchedAt,
    datasetLastUpdated,
  };
  const receiptDigest = sha256(JSON.stringify(receiptCore));
  return {
    ok: true,
    references,
    receipt: {
      schemaVersion: "velmere.world-bank-wdi-official-receipt.v1",
      receiptId: `world_bank_wdi_${receiptDigest.slice("sha256:".length, "sha256:".length + 24)}`,
      receiptDigest,
      ...receiptCore,
    },
  };
}

export function projectWorldBankWdiOfficialReferencePayloads(args: {
  symbol: string;
  now: Date;
  fetchedAt: string;
  responses: readonly {
    indicatorId: string;
    requestUrl: string;
    payload: unknown;
    responseSha256?: string;
    responseBytes?: number;
  }[];
}): WorldBankWdiProjectionResult {
  const definition = exactInstrument(args.symbol);
  if (!definition) return { ok: false, reason: "world_bank_instrument_not_whitelisted" };
  if (!Array.isArray(args.responses) || args.responses.length !== Object.keys(WORLD_BANK_WDI_INDICATORS).length) {
    return { ok: false, reason: "world_bank_response_set_invalid" };
  }
  const seen = new Set<WorldBankWdiIndicatorKey>();
  const references: WorldBankWdiHistoricalReference[] = [];
  const receipts: WorldBankWdiReceipt[] = [];
  for (const response of args.responses) {
    const indicator = exactIndicatorById(response.indicatorId);
    if (!indicator) return { ok: false, reason: "world_bank_indicator_response_missing" };
    if (seen.has(indicator.key)) return { ok: false, reason: "world_bank_indicator_response_duplicate" };
    seen.add(indicator.key);
    const projected = parseIndicatorPayload({
      definition,
      indicatorKey: indicator.key,
      requestUrl: response.requestUrl,
      payload: response.payload,
      now: args.now,
      fetchedAt: args.fetchedAt,
      responseSha256: response.responseSha256,
      responseBytes: response.responseBytes,
    });
    if (!projected.ok) return projected;
    references.push(...projected.references);
    receipts.push(projected.receipt);
  }
  if (seen.size !== Object.keys(WORLD_BANK_WDI_INDICATORS).length) {
    return { ok: false, reason: "world_bank_indicator_response_missing" };
  }
  if (references.length > WORLD_BANK_WDI_RUNTIME_POLICY.maxRowsTotal) {
    return { ok: false, reason: "world_bank_row_limit_exceeded" };
  }
  references.sort((left, right) =>
    left.indicatorId.localeCompare(right.indicatorId)
    || left.countryIso3.localeCompare(right.countryIso3)
    || right.observationYear - left.observationYear,
  );
  receipts.sort((left, right) => left.indicatorId.localeCompare(right.indicatorId));
  return {
    ok: true,
    references,
    receipts,
    aggregateReceiptDigest: sha256(JSON.stringify(receipts.map((receipt) => receipt.receiptDigest))),
    sourceFamilyCount: 1,
  };
}

export type WorldBankWdiOfficialReferenceEnvelope = {
  schemaVersion: "velmere.world-bank-wdi-official-envelope.v1";
  state: "available" | "withheld" | "temporarily_unavailable";
  blocker: string | null;
  retryAfterSeconds: number | null;
  generatedAt: string;
  requestedSymbol: string;
  requestedTier: WorldBankWdiTier;
  sourceId: "world_bank_wdi";
  sourceFamily: "world_bank_wdi_official";
  sourceFamilyCount: 0 | 1;
  attribution: typeof WORLD_BANK_WDI_RIGHTS_BOUNDARY.attribution;
  rightsBoundary: typeof WORLD_BANK_WDI_RIGHTS_BOUNDARY;
  goPaidState: typeof WORLD_BANK_WDI_RIGHTS_BOUNDARY.goPaidState;
  cacheState: "miss" | "positive_hit" | "negative_hit";
  references: WorldBankWdiHistoricalReference[];
  receipts: WorldBankWdiReceipt[];
  aggregateReceiptDigest: string | null;
  historicalAnnualReferenceOnly: true;
  referenceOnly: true;
  liveClaimed: false;
  executable: false;
  marketPriceEligible: false;
  paidValueEligible: false;
  riskScore: null;
  confidence: null;
  customerFinalCredit: false;
  truthBoundary: typeof WORLD_BANK_WDI_RIGHTS_BOUNDARY.truthBoundary;
};

function envelopeBase(args: {
  state: WorldBankWdiOfficialReferenceEnvelope["state"];
  blocker: string | null;
  retryAfterSeconds?: number | null;
  now: Date;
  symbol: string;
  tier: WorldBankWdiTier;
  cacheState?: WorldBankWdiOfficialReferenceEnvelope["cacheState"];
  references?: WorldBankWdiHistoricalReference[];
  receipts?: WorldBankWdiReceipt[];
  aggregateReceiptDigest?: string | null;
}): WorldBankWdiOfficialReferenceEnvelope {
  const references = args.references ?? [];
  return {
    schemaVersion: "velmere.world-bank-wdi-official-envelope.v1",
    state: args.state,
    blocker: args.blocker,
    retryAfterSeconds: args.retryAfterSeconds ?? null,
    generatedAt: args.now.toISOString(),
    requestedSymbol: args.symbol,
    requestedTier: args.tier,
    sourceId: "world_bank_wdi",
    sourceFamily: "world_bank_wdi_official",
    sourceFamilyCount: references.length ? 1 : 0,
    attribution: WORLD_BANK_WDI_RIGHTS_BOUNDARY.attribution,
    rightsBoundary: WORLD_BANK_WDI_RIGHTS_BOUNDARY,
    goPaidState: WORLD_BANK_WDI_RIGHTS_BOUNDARY.goPaidState,
    cacheState: args.cacheState ?? "miss",
    references,
    receipts: args.receipts ?? [],
    aggregateReceiptDigest: args.aggregateReceiptDigest ?? null,
    historicalAnnualReferenceOnly: true,
    referenceOnly: true,
    liveClaimed: false,
    executable: false,
    marketPriceEligible: false,
    paidValueEligible: false,
    riskScore: null,
    confidence: null,
    customerFinalCredit: false,
    truthBoundary: WORLD_BANK_WDI_RIGHTS_BOUNDARY.truthBoundary,
  };
}

type CacheEntry = { expiresAt: number; positive: boolean; value: WorldBankWdiOfficialReferenceEnvelope };
const referenceCache = new Map<string, CacheEntry>();
const inFlightByKey = new Map<string, Promise<WorldBankWdiOfficialReferenceEnvelope>>();
let activeExecutions = 0;

export const worldBankWdiOfficialReferenceDependencies: {
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

export function resetWorldBankWdiOfficialReferenceTestState() {
  referenceCache.clear();
  inFlightByKey.clear();
  activeExecutions = 0;
}

function boundedRetryAfter(value: string | null, now: Date) {
  if (!value) return null;
  const seconds = /^\d+$/u.test(value.trim()) ? Number(value.trim()) : Math.ceil((Date.parse(value) - now.getTime()) / 1_000);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.max(1, Math.min(WORLD_BANK_WDI_RUNTIME_POLICY.retryAfterMaxSeconds, Math.ceil(seconds)));
}

function cachedEnvelope(cacheKey: string, now: Date, tier: WorldBankWdiTier) {
  const cached = referenceCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= now.getTime()) {
    referenceCache.delete(cacheKey);
    return null;
  }
  return {
    ...cached.value,
    requestedTier: tier,
    cacheState: cached.positive ? "positive_hit" as const : "negative_hit" as const,
  };
}

function writeCache(cacheKey: string, now: Date, value: WorldBankWdiOfficialReferenceEnvelope) {
  const positive = value.state === "available";
  referenceCache.set(cacheKey, {
    expiresAt: now.getTime() + (positive
      ? WORLD_BANK_WDI_RUNTIME_POLICY.positiveCacheTtlSeconds
      : WORLD_BANK_WDI_RUNTIME_POLICY.negativeCacheTtlSeconds) * 1_000,
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
  return unavailable ? "world_bank_rate_limit_store_unavailable" : "world_bank_rate_limited";
}

function providerErrorBlocker(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  if (/deadline|timeout|aborted/iu.test(message)) return "world_bank_timeout";
  if (/response_too_large/iu.test(message)) return "world_bank_response_too_large";
  if (/strict_json|invalid_json|response_invalid_json/iu.test(message)) return "world_bank_response_invalid_json";
  return "world_bank_provider_unavailable";
}

async function executeWorldBankWdiRequest(args: {
  request: Extract<WorldBankWdiOfficialReferenceRequest, { ok: true }>;
  now: Date;
  tier: WorldBankWdiTier;
  cacheKey: string;
}) {
  if (activeExecutions >= WORLD_BANK_WDI_RUNTIME_POLICY.maxConcurrent) {
    return envelopeBase({
      state: "temporarily_unavailable",
      blocker: "world_bank_concurrency_budget_exhausted",
      now: args.now,
      symbol: args.request.symbol,
      tier: args.tier,
    });
  }
  const decision = await worldBankWdiOfficialReferenceDependencies.reserveRateLimit({
    namespace: "world-bank-wdi:global-budget",
    key: WORLD_BANK_WDI_RUNTIME_POLICY.host,
    limit: WORLD_BANK_WDI_RUNTIME_POLICY.requestsPerMinute,
    windowMs: WORLD_BANK_WDI_RUNTIME_POLICY.rateWindowMs,
    cost: WORLD_BANK_WDI_RUNTIME_POLICY.requestCost,
  });
  if (!decision.ok || decision.mode === "disabled" || decision.degraded) {
    return writeCache(args.cacheKey, args.now, envelopeBase({
      state: "temporarily_unavailable",
      blocker: limiterBlocker(decision),
      retryAfterSeconds: decision.retryAfterSeconds
        ? Math.min(WORLD_BANK_WDI_RUNTIME_POLICY.retryAfterMaxSeconds, Math.max(1, decision.retryAfterSeconds))
        : null,
      now: args.now,
      symbol: args.request.symbol,
      tier: args.tier,
    }));
  }

  activeExecutions += 1;
  const deadlineController = new AbortController();
  const timer = globalThis.setTimeout(() => {
    deadlineController.abort(new DOMException("World Bank WDI total deadline exceeded", "TimeoutError"));
  }, WORLD_BANK_WDI_RUNTIME_POLICY.deadlineMs);
  try {
    const responses: Array<{
      indicatorId: WorldBankWdiIndicatorId;
      requestUrl: string;
      payload: unknown;
      responseSha256: string;
      responseBytes: number;
    }> = [];
    for (const item of args.request.urls) {
      const response = await worldBankWdiOfficialReferenceDependencies.fetch(
        item.url,
        {
          method: "GET",
          headers: args.request.headers,
          cache: "no-store",
          redirect: "error",
          signal: deadlineController.signal,
        },
        {
          timeoutMs: WORLD_BANK_WDI_RUNTIME_POLICY.deadlineMs,
          operation: `world_bank_wdi_${item.indicatorKey}_reference`,
        },
      );
      if (!response.ok) {
        return writeCache(args.cacheKey, args.now, envelopeBase({
          state: "temporarily_unavailable",
          blocker: `world_bank_http_${response.status}`,
          retryAfterSeconds: response.status === 429 ? boundedRetryAfter(response.headers.get("retry-after"), args.now) : null,
          now: args.now,
          symbol: args.request.symbol,
          tier: args.tier,
        }));
      }
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!/(^|[;/\s])application\/(?:[a-z0-9.+-]+\+)?json(?:[;\s]|$)/iu.test(contentType)) {
        return writeCache(args.cacheKey, args.now, envelopeBase({
          state: "temporarily_unavailable",
          blocker: "world_bank_response_content_type",
          now: args.now,
          symbol: args.request.symbol,
          tier: args.tier,
        }));
      }
      const bytes = await readResponseBytesBounded(response, WORLD_BANK_WDI_RUNTIME_POLICY.maxResponseBytes, {
        timeoutMs: WORLD_BANK_WDI_RUNTIME_POLICY.deadlineMs,
        operation: `world_bank_wdi_${item.indicatorKey}_response_body`,
      });
      const payload = parseStrictJsonBytes<unknown>(bytes, {
        maxBytes: WORLD_BANK_WDI_RUNTIME_POLICY.maxResponseBytes,
        maxDepth: 12,
        maxNodes: 2_000,
        requireArray: true,
        rejectDuplicateKeys: true,
        rejectDangerousKeys: true,
      });
      responses.push({
        indicatorId: item.indicatorId,
        requestUrl: item.url,
        payload,
        responseSha256: sha256(bytes),
        responseBytes: bytes.byteLength,
      });
    }
    const projection = projectWorldBankWdiOfficialReferencePayloads({
      symbol: args.request.symbol,
      now: args.now,
      fetchedAt: args.now.toISOString(),
      responses,
    });
    if (!projection.ok) {
      return writeCache(args.cacheKey, args.now, envelopeBase({
        state: "withheld",
        blocker: projection.reason,
        now: args.now,
        symbol: args.request.symbol,
        tier: args.tier,
      }));
    }
    return writeCache(args.cacheKey, args.now, envelopeBase({
      state: "available",
      blocker: null,
      now: args.now,
      symbol: args.request.symbol,
      tier: args.tier,
      references: projection.references,
      receipts: projection.receipts,
      aggregateReceiptDigest: projection.aggregateReceiptDigest,
    }));
  } catch (error) {
    return writeCache(args.cacheKey, args.now, envelopeBase({
      state: "temporarily_unavailable",
      blocker: providerErrorBlocker(error),
      now: args.now,
      symbol: args.request.symbol,
      tier: args.tier,
    }));
  } finally {
    globalThis.clearTimeout(timer);
    activeExecutions = Math.max(0, activeExecutions - 1);
  }
}

export async function loadWorldBankWdiOfficialReference(args: {
  symbol: string;
  tier: WorldBankWdiTier;
  entitlementVerified: boolean;
  productionLike: boolean;
  now?: Date;
}): Promise<WorldBankWdiOfficialReferenceEnvelope> {
  const now = args.now ?? new Date();
  const preflight = buildWorldBankWdiOfficialReferenceRequest({ ...args, now });
  if (!preflight.ok) {
    return envelopeBase({
      state: "withheld",
      blocker: preflight.reason,
      now: Number.isFinite(now.getTime()) ? now : new Date(0),
      symbol: args.symbol,
      tier: args.tier,
    });
  }
  const cacheKey = preflight.symbol;
  const cached = cachedEnvelope(cacheKey, now, args.tier);
  if (cached) return cached;
  const existing = inFlightByKey.get(cacheKey);
  if (existing) return { ...(await existing), requestedTier: args.tier };
  const execution = executeWorldBankWdiRequest({ request: preflight, now, tier: args.tier, cacheKey });
  inFlightByKey.set(cacheKey, execution);
  try {
    return await execution;
  } finally {
    if (inFlightByKey.get(cacheKey) === execution) inFlightByKey.delete(cacheKey);
  }
}
