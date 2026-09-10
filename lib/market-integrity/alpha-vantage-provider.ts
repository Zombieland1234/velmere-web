import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import {
  blankPass464FundamentalQuality,
  buildPass464EquityQuality,
  buildPass464FundQuality,
  type Pass464FundamentalQuality,
} from "./fundamental-quality";
import {
  blankPass465SecXbrlQuality,
  buildPass465SecXbrlQuality,
  type Pass465SecXbrlQuality,
} from "./sec-xbrl-quality";
import {
  buildSecEdgarReferenceRequest,
  reserveSecEdgarFairAccess,
} from "./sec-edgar-reference-policy";

export type Pass459ProviderAssetClass =
  | "stock"
  | "index"
  | "fx"
  | "etf"
  | "commodity"
  | "real_estate"
  | "exchange_equity";

export type Pass459ProviderState =
  | "source_bound"
  | "not_configured"
  | "rate_limited"
  | "provider_error"
  | "unsupported";

export type Pass459ProviderEvidence = {
  label: string;
  value: string;
  source: string;
};

export type Pass459Fundamentals = {
  profileType: "equity" | "etf" | "reit" | "not_applicable";
  name: string | null;
  description: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  latestQuarter: string | null;
  peRatio: number | null;
  pegRatio: number | null;
  priceToBookRatio: number | null;
  profitMargin: number | null;
  operatingMargin: number | null;
  returnOnAssets: number | null;
  returnOnEquity: number | null;
  revenueTtm: number | null;
  grossProfitTtm: number | null;
  ebitda: number | null;
  dilutedEps: number | null;
  dividendYield: number | null;
  beta: number | null;
  analystTargetPrice: number | null;
  week52High: number | null;
  week52Low: number | null;
  sharesOutstanding: number | null;
  netAssets: number | null;
  expenseRatio: number | null;
  turnover: number | null;
  inceptionDate: string | null;
  leveraged: string | null;
  topHoldings: Array<{ symbol: string; description: string; weight: number | null }>;
  sectorAllocation: Array<{ sector: string; weight: number | null }>;
  cik: string | null;
  quality: Pass464FundamentalQuality;
  secXbrl: Pass465SecXbrlQuality;
};

export type Pass459AlphaVantageSnapshot = {
  state: Pass459ProviderState;
  providerKind:
    | "alpha_vantage_market"
    | "alpha_vantage_fx"
    | "alpha_vantage_commodity";
  source: string;
  sourceTimestamp: number | null;
  exchange: string | null;
  currency: string | null;
  currentPrice: number | null;
  changePercent: number | null;
  marketCap: number | null;
  volume24h: number | null;
  high24h: number | null;
  low24h: number | null;
  providerFunctions: string[];
  providerEvidence: Pass459ProviderEvidence[];
  fundamentals: Pass459Fundamentals;
  missingReason: string | null;
};

type JsonObject = Record<string, unknown>;

type Pass460FetchMeta = {
  cache: "hit" | "miss";
  quota: "open" | "guarded";
  fetchedAt: number | null;
};

type Pass460CacheEntry = {
  payload: JsonObject;
  expiresAt: number;
  fetchedAt: number;
};

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";
const pass460ResponseCache = new Map<string, Pass460CacheEntry>();
const pass460Inflight = new Map<string, Promise<JsonObject>>();
const pass460RequestLedger: number[] = [];

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function pass460QuotaPolicy() {
  return {
    perMinute: positiveInteger(
      process.env.ALPHA_VANTAGE_PROCESS_MAX_PER_MINUTE,
      5,
    ),
    perDay: positiveInteger(process.env.ALPHA_VANTAGE_PROCESS_MAX_PER_DAY, 24),
  };
}

function trimRequestLedger(now: number) {
  const dayAgo = now - 86_400_000;
  while (pass460RequestLedger.length && pass460RequestLedger[0] < dayAgo)
    pass460RequestLedger.shift();
}

function pass460QuotaOpen(now: number) {
  trimRequestLedger(now);
  const policy = pass460QuotaPolicy();
  const minuteAgo = now - 60_000;
  const minuteCount = pass460RequestLedger.filter(
    (timestamp) => timestamp >= minuteAgo,
  ).length;
  return (
    minuteCount < policy.perMinute &&
    pass460RequestLedger.length < policy.perDay
  );
}

function reservePass460Quota(now: number) {
  if (!pass460QuotaOpen(now)) return false;
  pass460RequestLedger.push(now);
  return true;
}

function attachFetchMeta(
  payload: JsonObject,
  meta: Pass460FetchMeta,
): JsonObject {
  return { ...payload, __velmerePass460: meta };
}

function fetchMeta(payload: JsonObject): Pass460FetchMeta {
  const raw = payload.__velmerePass460;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const candidate = raw as Partial<Pass460FetchMeta>;
    return {
      cache: candidate.cache === "hit" ? "hit" : "miss",
      quota: candidate.quota === "guarded" ? "guarded" : "open",
      fetchedAt:
        typeof candidate.fetchedAt === "number" ? candidate.fetchedAt : null,
    };
  }
  return { cache: "miss", quota: "open", fetchedAt: null };
}

function apiKey() {
  return (
    process.env.ALPHA_VANTAGE_API_KEY?.trim() ||
    process.env.ALPHAVANTAGE_API_KEY?.trim() ||
    ""
  );
}

export function isPass459AlphaVantageConfigured() {
  return Boolean(apiKey());
}

function finite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/%$/, "").replace(/,/g, "");
  if (!normalized || normalized.toLowerCase() === "none" || normalized === "-")
    return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function unixSeconds(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value.includes("T") ? value : `${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstText(payload: JsonObject, candidates: string[]) {
  for (const candidate of candidates) {
    const exact = text(payload[candidate]);
    if (exact) return exact;
    const entry = Object.entries(payload).find(
      ([key]) => key.toLowerCase() === candidate.toLowerCase(),
    );
    const loose = entry ? text(entry[1]) : null;
    if (loose) return loose;
  }
  return null;
}

function providerFailure(
  payload: JsonObject,
): { state: Pass459ProviderState; reason: string } | null {
  const note = text(payload.Note) || text(payload.Information);
  if (note) return { state: "rate_limited", reason: note.slice(0, 360) };
  const error = text(payload["Error Message"]);
  if (error) return { state: "provider_error", reason: error.slice(0, 360) };
  return null;
}

async function fetchAlphaVantage(
  params: Record<string, string>,
  revalidate: number,
): Promise<JsonObject> {
  const key = apiKey();
  if (!key) return {};
  const cacheKey = new URLSearchParams(params).toString();
  const now = Date.now();
  const cached = pass460ResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return attachFetchMeta(cached.payload, {
      cache: "hit",
      quota: "open",
      fetchedAt: cached.fetchedAt,
    });
  }
  const pending = pass460Inflight.get(cacheKey);
  if (pending) return pending;
  if (!reservePass460Quota(now)) {
    return attachFetchMeta(
      {
        Information:
          "Velmere process-local provider budget is guarded. Reuse cache or retry after the quota window.",
      },
      { cache: "miss", quota: "guarded", fetchedAt: null },
    );
  }

  const request = (async () => {
    const search = new URLSearchParams({ ...params, apikey: key });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await brokeredEgressFetch(
        `${ALPHA_VANTAGE_BASE}?${search.toString()}`,
        {
          headers: {
            accept: "application/json",
            "user-agent": "Velmere-Provider-Truth/460",
          },
          signal: controller.signal,
          next: { revalidate },
        } as RequestInit & { next: { revalidate: number } },
        { profile: "alpha_vantage", operation: "alpha_vantage_query", timeoutMs: 8_000, maxResponseBytes: 4_194_304 },
      );
      if (!response.ok) throw new Error(`alpha_vantage_${response.status}`);
      const payload = await readJsonResponseBounded<JsonObject>(response, 4_194_304);
      const failure = providerFailure(payload);
      if (!failure) {
        pass460ResponseCache.set(cacheKey, {
          payload,
          expiresAt: now + Math.max(30, revalidate) * 1_000,
          fetchedAt: now,
        });
      }
      return attachFetchMeta(payload, {
        cache: "miss",
        quota: "open",
        fetchedAt: now,
      });
    } finally {
      clearTimeout(timer);
      pass460Inflight.delete(cacheKey);
    }
  })();
  pass460Inflight.set(cacheKey, request);
  return request;
}



type Pass464SecFiling = {
  filingDate: string;
  reportDate: string | null;
  form: string;
  accessionNumber: string | null;
  filingUrl: string | null;
};

type Pass465JsonCacheEntry = {
  value: JsonObject | null;
  expiresAt: number;
};

const pass465CompanyfactsCache = new Map<string, Pass465JsonCacheEntry>();
const pass465CompanyfactsInflight = new Map<string, Promise<JsonObject | null>>();
const pass465SubmissionsCache = new Map<string, Pass465JsonCacheEntry>();
const pass465SubmissionsInflight = new Map<string, Promise<JsonObject | null>>();

function normalizedCik(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits ? digits.padStart(10, "0") : null;
}

function secArchiveUrl(cik: string, accessionNumber: string | null) {
  if (!accessionNumber) return null;
  const compactCik = String(Number(cik));
  const compactAccession = accessionNumber.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${compactCik}/${compactAccession}/`;
}

async function fetchPass465SecJson(
  cikValue: string | null,
  kind: "submissions" | "companyfacts",
): Promise<JsonObject | null> {
  const userAgent = process.env.SEC_USER_AGENT?.trim() || "";
  const requestPolicy = buildSecEdgarReferenceRequest({
    cik: cikValue ?? "",
    kind,
    userAgent,
  });
  if (!requestPolicy.ok) return null;
  const cik = requestPolicy.cik;
  const cache = kind === "submissions" ? pass465SubmissionsCache : pass465CompanyfactsCache;
  const inflight = kind === "submissions" ? pass465SubmissionsInflight : pass465CompanyfactsInflight;
  const now = Date.now();
  const cached = cache.get(cik);
  if (cached && cached.expiresAt > now) return cached.value;
  const pending = inflight.get(cik);
  if (pending) return pending;
  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestPolicy.timeoutMs);
    try {
      await reserveSecEdgarFairAccess();
      const response = await brokeredEgressFetch(requestPolicy.url, {
        headers: requestPolicy.headers,
        signal: controller.signal,
        next: { revalidate: requestPolicy.cacheTtlMs / 1_000 },
      } as RequestInit & { next: { revalidate: number } }, {
        profile: "sec_edgar",
        operation: `sec_edgar_${kind}`,
        timeoutMs: requestPolicy.timeoutMs,
        maxResponseBytes: requestPolicy.maxResponseBytes,
      });
      if (!response.ok) return null;
      return await readJsonResponseBounded<JsonObject>(response, requestPolicy.maxResponseBytes);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      inflight.delete(cik);
    }
  })();
  inflight.set(cik, request);
  const value = await request;
  cache.set(cik, {
    value,
    expiresAt: Date.now() + (value ? requestPolicy.cacheTtlMs : requestPolicy.negativeCacheTtlMs),
  });
  return value;
}

async function fetchPass464SecFiling(cikValue: string | null): Promise<Pass464SecFiling | null> {
  const cik = normalizedCik(cikValue);
  const payload = await fetchPass465SecJson(cikValue, "submissions");
  if (!cik || !payload) return null;
  const filings = payload.filings && typeof payload.filings === "object" && !Array.isArray(payload.filings)
    ? (payload.filings as JsonObject)
    : {};
  const recent = filings.recent && typeof filings.recent === "object" && !Array.isArray(filings.recent)
    ? (filings.recent as JsonObject)
    : {};
  const forms = Array.isArray(recent.form) ? recent.form : [];
  const filingDates = Array.isArray(recent.filingDate) ? recent.filingDate : [];
  const reportDates = Array.isArray(recent.reportDate) ? recent.reportDate : [];
  const accessions = Array.isArray(recent.accessionNumber) ? recent.accessionNumber : [];
  const accepted = new Set(["10-Q", "10-K", "20-F", "40-F"]);
  const index = forms.findIndex((form) => typeof form === "string" && accepted.has(form));
  if (index < 0 || typeof filingDates[index] !== "string") return null;
  const accessionNumber = typeof accessions[index] === "string" ? (accessions[index] as string) : null;
  return {
    filingDate: filingDates[index] as string,
    reportDate: typeof reportDates[index] === "string" ? (reportDates[index] as string) : null,
    form: forms[index] as string,
    accessionNumber,
    filingUrl: secArchiveUrl(cik, accessionNumber),
  };
}

async function fetchPass465SecCompanyFacts(cikValue: string | null): Promise<JsonObject | null> {
  return fetchPass465SecJson(cikValue, "companyfacts");
}

async function fetchPass465SecSubmissions(cikValue: string | null): Promise<JsonObject | null> {
  return fetchPass465SecJson(cikValue, "submissions");
}

function blankFundamentals(
  profileType: Pass459Fundamentals["profileType"] = "not_applicable",
): Pass459Fundamentals {
  return {
    profileType,
    name: null,
    description: null,
    sector: null,
    industry: null,
    country: null,
    latestQuarter: null,
    peRatio: null,
    pegRatio: null,
    priceToBookRatio: null,
    profitMargin: null,
    operatingMargin: null,
    returnOnAssets: null,
    returnOnEquity: null,
    revenueTtm: null,
    grossProfitTtm: null,
    ebitda: null,
    dilutedEps: null,
    dividendYield: null,
    beta: null,
    analystTargetPrice: null,
    week52High: null,
    week52Low: null,
    sharesOutstanding: null,
    netAssets: null,
    expenseRatio: null,
    turnover: null,
    inceptionDate: null,
    leveraged: null,
    topHoldings: [],
    sectorAllocation: [],
    cik: null,
    quality: blankPass464FundamentalQuality(),
    secXbrl: blankPass465SecXbrlQuality(),
  };
}

function percentFraction(value: unknown) {
  const parsed = finite(value);
  if (parsed === null) return null;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function textFrom(payload: JsonObject, candidates: string[]) {
  return firstText(payload, candidates);
}

function numberFrom(payload: JsonObject, candidates: string[]) {
  for (const candidate of candidates) {
    const direct = finite(payload[candidate]);
    if (direct !== null) return direct;
    const match = Object.entries(payload).find(
      ([key]) => key.toLowerCase() === candidate.toLowerCase(),
    );
    const loose = match ? finite(match[1]) : null;
    if (loose !== null) return loose;
  }
  return null;
}

function baseSnapshot(
  providerKind: Pass459AlphaVantageSnapshot["providerKind"],
  state: Pass459ProviderState,
  missingReason: string | null,
): Pass459AlphaVantageSnapshot {
  return {
    state,
    providerKind,
    source: "Alpha Vantage",
    sourceTimestamp: null,
    exchange: null,
    currency: null,
    currentPrice: null,
    changePercent: null,
    marketCap: null,
    volume24h: null,
    high24h: null,
    low24h: null,
    providerFunctions: [],
    providerEvidence: [],
    fundamentals: blankFundamentals(),
    missingReason,
  };
}

function parseFxPair(symbol: string): { from: string; to: string } | null {
  const clean = symbol
    .toUpperCase()
    .replace(/=X$/, "")
    .replace(/[^A-Z]/g, "");
  if (clean.length === 6)
    return { from: clean.slice(0, 3), to: clean.slice(3) };
  if (clean.length === 3) return { from: "USD", to: clean };
  return null;
}

const FUND_PROFILE_SYMBOLS = new Set(["SPY", "QQQ", "TLT", "HYG", "EFA", "GLD", "VNQ", "IYR", "XLRE"]);

function overviewFundamentals(
  payload: JsonObject,
  profileType: "equity" | "reit",
): Pass459Fundamentals {
  return {
    ...blankFundamentals(profileType),
    name: textFrom(payload, ["Name"]),
    description: textFrom(payload, ["Description"]),
    sector: textFrom(payload, ["Sector"]),
    industry: textFrom(payload, ["Industry"]),
    country: textFrom(payload, ["Country"]),
    latestQuarter: textFrom(payload, ["LatestQuarter"]),
    cik: textFrom(payload, ["CIK"]),
    peRatio: numberFrom(payload, ["PERatio"]),
    pegRatio: numberFrom(payload, ["PEGRatio"]),
    priceToBookRatio: numberFrom(payload, ["PriceToBookRatio"]),
    profitMargin: percentFraction(payload.ProfitMargin),
    operatingMargin: percentFraction(payload.OperatingMarginTTM),
    returnOnAssets: percentFraction(payload.ReturnOnAssetsTTM),
    returnOnEquity: percentFraction(payload.ReturnOnEquityTTM),
    revenueTtm: numberFrom(payload, ["RevenueTTM"]),
    grossProfitTtm: numberFrom(payload, ["GrossProfitTTM"]),
    ebitda: numberFrom(payload, ["EBITDA"]),
    dilutedEps: numberFrom(payload, ["DilutedEPSTTM"]),
    dividendYield: percentFraction(payload.DividendYield),
    beta: numberFrom(payload, ["Beta"]),
    analystTargetPrice: numberFrom(payload, ["AnalystTargetPrice"]),
    week52High: numberFrom(payload, ["52WeekHigh"]),
    week52Low: numberFrom(payload, ["52WeekLow"]),
    sharesOutstanding: numberFrom(payload, ["SharesOutstanding"]),
  };
}

function parseFundRows(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (row): row is JsonObject =>
          Boolean(row && typeof row === "object" && !Array.isArray(row)),
      )
    : [];
}

function etfFundamentals(payload: JsonObject): Pass459Fundamentals {
  const holdings = parseFundRows(
    payload.holdings || payload.Holdings || payload.constituents,
  )
    .slice(0, 100)
    .map((row) => ({
      symbol: textFrom(row, ["symbol", "ticker"]) || "—",
      description:
        textFrom(row, ["description", "name", "security_description"]) ||
        "holding",
      weight: percentFraction(
        row.weight || row.allocation || row.portfolio_percent,
      ),
    }));
  const sectors = parseFundRows(
    payload.sectors || payload.Sectors || payload.sector_allocation,
  )
    .slice(0, 12)
    .map((row) => ({
      sector: textFrom(row, ["sector", "name"]) || "Other",
      weight: percentFraction(row.weight || row.allocation),
    }));
  return {
    ...blankFundamentals("etf"),
    name: textFrom(payload, ["name", "Name"]),
    description: textFrom(payload, ["description", "Description"]),
    netAssets: numberFrom(payload, ["net_assets", "netAssets", "NetAssets"]),
    expenseRatio: percentFraction(
      payload.net_expense_ratio || payload.expense_ratio || payload.ExpenseRatio,
    ),
    turnover: percentFraction(
      payload.portfolio_turnover || payload.turnover || payload.Turnover,
    ),
    dividendYield: percentFraction(
      payload.dividend_yield || payload.DividendYield,
    ),
    inceptionDate: textFrom(payload, ["inception_date", "inceptionDate", "InceptionDate"]),
    leveraged: textFrom(payload, ["leveraged", "Leveraged"]),
    topHoldings: holdings,
    sectorAllocation: sectors,
  };
}

async function resolveEquity(
  symbol: string,
  profileType: "equity" | "reit" = "equity",
): Promise<Pass459AlphaVantageSnapshot> {
  const normalized = symbol.toUpperCase();
  const [quotePayload, overviewPayload] = await Promise.all([
    fetchAlphaVantage({ function: "GLOBAL_QUOTE", symbol: normalized }, 60),
    fetchAlphaVantage({ function: "OVERVIEW", symbol: normalized }, 21_600),
  ]);
  const quoteFailure = providerFailure(quotePayload);
  if (quoteFailure)
    return {
      ...baseSnapshot(
        "alpha_vantage_market",
        quoteFailure.state,
        quoteFailure.reason,
      ),
      providerFunctions: ["GLOBAL_QUOTE", "OVERVIEW"],
      fundamentals: blankFundamentals(profileType),
    };

  const quote = (quotePayload["Global Quote"] || {}) as JsonObject;
  const currentPrice = finite(quote["05. price"]);
  const latestDay = text(quote["07. latest trading day"]);
  if (currentPrice === null) {
    return {
      ...baseSnapshot(
        "alpha_vantage_market",
        "provider_error",
        "GLOBAL_QUOTE returned no usable price for this symbol.",
      ),
      providerFunctions: ["GLOBAL_QUOTE", "OVERVIEW"],
      fundamentals: blankFundamentals(profileType),
    };
  }

  const overviewFailure = providerFailure(overviewPayload);
  let fundamentals = overviewFailure
    ? blankFundamentals(profileType)
    : overviewFundamentals(overviewPayload, profileType);

  const [incomeStatement, balanceSheet, cashFlow, secFiling, secCompanyFacts, secSubmissions] = overviewFailure
    ? [{}, {}, {}, null, null, null] as const
    : await Promise.all([
        fetchAlphaVantage(
          { function: "INCOME_STATEMENT", symbol: normalized },
          21_600,
        ),
        fetchAlphaVantage(
          { function: "BALANCE_SHEET", symbol: normalized },
          21_600,
        ),
        fetchAlphaVantage(
          { function: "CASH_FLOW", symbol: normalized },
          21_600,
        ),
        fetchPass464SecFiling(fundamentals.cik),
        fetchPass465SecCompanyFacts(fundamentals.cik),
        fetchPass465SecSubmissions(fundamentals.cik),
      ]);

  const quality = buildPass464EquityQuality({
    overview: overviewPayload,
    incomeStatement,
    balanceSheet,
    cashFlow,
    secFiling,
  });
  const secXbrl = buildPass465SecXbrlQuality({
    cik: fundamentals.cik,
    secCompanyFacts,
    secSubmissions,
    secFiling,
    alphaQuality: quality,
  });
  fundamentals = { ...fundamentals, quality, secXbrl };

  const statementFailures = [
    ["INCOME_STATEMENT", providerFailure(incomeStatement)],
    ["BALANCE_SHEET", providerFailure(balanceSheet)],
    ["CASH_FLOW", providerFailure(cashFlow)],
  ] as const;
  const failedStatements = statementFailures
    .filter(([, failure]) => Boolean(failure))
    .map(([name, failure]) => `${name}: ${failure?.reason || "source required"}`);

  const marketCap = overviewFailure
    ? null
    : finite(overviewPayload.MarketCapitalization);
  const volume = finite(quote["06. volume"]);
  const changePercent = finite(quote["10. change percent"]);
  const high = finite(quote["03. high"]);
  const low = finite(quote["04. low"]);
  const exchange = overviewFailure ? null : text(overviewPayload.Exchange);
  const currency = overviewFailure ? null : text(overviewPayload.Currency);
  const quoteMeta = fetchMeta(quotePayload);
  const overviewMeta = fetchMeta(overviewPayload);
  const statementMeta = [incomeStatement, balanceSheet, cashFlow].map(fetchMeta);
  const evidence: Pass459ProviderEvidence[] = [
    {
      label: "Provider cache",
      value: `quote ${quoteMeta.cache} · overview ${overviewMeta.cache} · statements ${statementMeta.map((item) => item.cache).join("/")} · quota ${[quoteMeta, overviewMeta, ...statementMeta].some((item) => item.quota === "guarded") ? "guarded" : "open"}`,
      source: "PASS460 quota/cache guard",
    },
    {
      label: "Latest trading day",
      value: latestDay || "source timestamp required",
      source: "GLOBAL_QUOTE",
    },
    {
      label: "Exchange",
      value: exchange || "issuer exchange required",
      source: "OVERVIEW",
    },
    {
      label: "Market capitalization",
      value: marketCap === null ? "source required" : String(marketCap),
      source: "OVERVIEW",
    },
    {
      label: "Filing / period freshness",
      value: quality.filingDate
        ? `${quality.filingDate} · ${quality.filingForm || "form required"} · ${quality.filingAgeDays ?? "?"}d`
        : quality.reportedPeriodEnd
          ? `${quality.reportedPeriodEnd} · period proxy · ${quality.reportedPeriodAgeDays ?? "?"}d`
          : "source required",
      source: quality.filingDate ? "SEC submissions" : "statement period proxy",
    },
    {
      label: "Free cash flow TTM",
      value: quality.freeCashFlowTtm === null
        ? "source required"
        : String(quality.freeCashFlowTtm),
      source: "CASH_FLOW",
    },
    {
      label: "Balance-sheet pressure",
      value: `net debt ${quality.netDebt ?? "source required"} · net debt/EBITDA ${quality.netDebtToEbitda ?? "source required"}x · current ratio ${quality.currentRatio ?? "source required"}x`,
      source: "BALANCE_SHEET · OVERVIEW",
    },
    {
      label: "Fundamental quality",
      value: `${quality.state} · score ${quality.qualityScore}/100 · cap ${quality.confidenceCap}/100`,
      source: "PASS464 fundamental quality gate",
    },
  ];

  return {
    state: "source_bound",
    providerKind: "alpha_vantage_market",
    source: overviewFailure
      ? "Alpha Vantage GLOBAL_QUOTE · fundamentals pending"
      : "Alpha Vantage quote · overview · financial statements",
    sourceTimestamp: unixSeconds(latestDay),
    exchange,
    currency,
    currentPrice,
    changePercent,
    marketCap,
    volume24h: volume,
    high24h: high,
    low24h: low,
    providerFunctions: [
      "GLOBAL_QUOTE",
      "OVERVIEW",
      "INCOME_STATEMENT",
      "BALANCE_SHEET",
      "CASH_FLOW",
      ...(secFiling ? ["SEC_SUBMISSIONS"] : []),
      ...(fundamentals.secXbrl.companyfactsState === "attached" ? ["SEC_COMPANYFACTS"] : []),
    ],
    providerEvidence: [...evidence, ...quality.evidence, ...secXbrl.evidence],
    fundamentals,
    missingReason: overviewFailure
      ? `Price is source-bound, but the fundamentals lane is unavailable: ${overviewFailure.reason}`
      : failedStatements.length
        ? `Price and overview are source-bound, but deep fundamentals are partial: ${failedStatements.join(" · ")}`
        : marketCap === null
          ? "Quote is source-bound, but OVERVIEW did not supply market capitalization."
          : secXbrl.state === "sec_divergent"
            ? "SEC Companyfacts/XBRL diverges from the Alpha Vantage statement lane."
            : secXbrl.state === "sec_required" || secXbrl.state === "sec_partial"
              ? "SEC Companyfacts/XBRL second-source check is incomplete."
              : quality.state === "stale"
                ? "Financial statements are attached, but the filing/reporting period is stale."
                : null,
  };
}

function benchmarkSymbolForFund(symbol: string): string | null {
  if (symbol === "SPY") return null;
  if (["VNQ", "IYR", "XLRE"].includes(symbol)) return symbol === "VNQ" ? "XLRE" : "VNQ";
  if (["TLT", "HYG"].includes(symbol)) return symbol === "TLT" ? "HYG" : "TLT";
  if (["GLD"].includes(symbol)) return null;
  return "SPY";
}

async function resolveFund(
  symbol: string,
): Promise<Pass459AlphaVantageSnapshot> {
  const normalized = symbol.toUpperCase();
  const [quotePayload, profilePayload] = await Promise.all([
    fetchAlphaVantage({ function: "GLOBAL_QUOTE", symbol: normalized }, 60),
    fetchAlphaVantage({ function: "ETF_PROFILE", symbol: normalized }, 21_600),
  ]);
  const quoteFailure = providerFailure(quotePayload);
  if (quoteFailure)
    return {
      ...baseSnapshot(
        "alpha_vantage_market",
        quoteFailure.state,
        quoteFailure.reason,
      ),
      providerFunctions: ["GLOBAL_QUOTE", "ETF_PROFILE"],
      fundamentals: blankFundamentals("etf"),
    };
  const quote = (quotePayload["Global Quote"] || {}) as JsonObject;
  const currentPrice = finite(quote["05. price"]);
  if (currentPrice === null)
    return {
      ...baseSnapshot(
        "alpha_vantage_market",
        "provider_error",
        "GLOBAL_QUOTE returned no usable ETF/REIT price.",
      ),
      providerFunctions: ["GLOBAL_QUOTE", "ETF_PROFILE"],
      fundamentals: blankFundamentals("etf"),
    };

  const profileFailure = providerFailure(profilePayload);
  let fundamentals = profileFailure
    ? blankFundamentals("etf")
    : etfFundamentals(profilePayload);
  const benchmarkSymbol = profileFailure
    ? null
    : benchmarkSymbolForFund(normalized);
  const benchmarkPayload = benchmarkSymbol && fundamentals.topHoldings.length
    ? await fetchAlphaVantage(
        { function: "ETF_PROFILE", symbol: benchmarkSymbol },
        21_600,
      )
    : {};
  const benchmarkFailure = providerFailure(benchmarkPayload);
  const benchmarkFundamentals = benchmarkSymbol && !benchmarkFailure
    ? etfFundamentals(benchmarkPayload)
    : blankFundamentals("etf");
  const quality = buildPass464FundQuality({
    holdings: fundamentals.topHoldings,
    sectors: fundamentals.sectorAllocation,
    benchmarkSymbol,
    benchmarkHoldings: benchmarkFundamentals.topHoldings,
  });
  fundamentals = { ...fundamentals, quality };

  const latestDay = text(quote["07. latest trading day"]);
  const quoteMeta = fetchMeta(quotePayload);
  const profileMeta = fetchMeta(profilePayload);
  const benchmarkMeta = fetchMeta(benchmarkPayload);
  const marketCap = fundamentals.netAssets;
  return {
    state: "source_bound",
    providerKind: "alpha_vantage_market",
    source: profileFailure
      ? "Alpha Vantage GLOBAL_QUOTE · ETF profile pending"
      : "Alpha Vantage quote · ETF profile · concentration gate",
    sourceTimestamp: unixSeconds(latestDay),
    exchange: null,
    currency: null,
    currentPrice,
    changePercent: finite(quote["10. change percent"]),
    marketCap,
    volume24h: finite(quote["06. volume"]),
    high24h: finite(quote["03. high"]),
    low24h: finite(quote["04. low"]),
    providerFunctions: [
      "GLOBAL_QUOTE",
      "ETF_PROFILE",
      ...(benchmarkSymbol ? [`ETF_PROFILE:${benchmarkSymbol}`] : []),
    ],
    providerEvidence: [
      {
        label: "Provider cache",
        value: `quote ${quoteMeta.cache} · profile ${profileMeta.cache}${benchmarkSymbol ? ` · benchmark ${benchmarkMeta.cache}` : ""} · quota ${[quoteMeta, profileMeta, benchmarkMeta].some((item) => item.quota === "guarded") ? "guarded" : "open"}`,
        source: "PASS460 quota/cache guard",
      },
      {
        label: "Net assets",
        value: marketCap === null ? "source required" : String(marketCap),
        source: "ETF_PROFILE",
      },
      {
        label: "Expense ratio",
        value:
          fundamentals.expenseRatio === null
            ? "source required"
            : `${fundamentals.expenseRatio}%`,
        source: "ETF_PROFILE",
      },
      {
        label: "Portfolio turnover",
        value:
          fundamentals.turnover === null
            ? "source required"
            : `${fundamentals.turnover}%`,
        source: "ETF_PROFILE",
      },
      {
        label: "Concentration",
        value: `top10 ${quality.etf.concentrationTop10 ?? "source required"}% · effective holdings ${quality.etf.effectiveHoldings ?? "source required"}`,
        source: "PASS464 holdings concentration",
      },
      {
        label: "Benchmark overlap",
        value: quality.etf.overlapPercent === null
          ? `${benchmarkSymbol || "benchmark"} comparison required`
          : `${quality.etf.overlapPercent}% vs ${benchmarkSymbol}`,
        source: "PASS464 top-holdings overlap",
      },
      {
        label: "Fund profile status",
        value: profileFailure
          ? `quote bound; ETF profile unavailable: ${profileFailure.reason}`
          : `${quality.state} · score ${quality.qualityScore}/100 · cap ${quality.confidenceCap}/100`,
        source: "ETF_PROFILE · PASS464",
      },
    ],
    fundamentals,
    missingReason: profileFailure
      ? `Price is source-bound, but ETF_PROFILE is unavailable: ${profileFailure.reason}`
      : marketCap === null
        ? "Price is source-bound, but ETF_PROFILE did not supply net assets."
        : quality.etf.overlapState !== "source_bound" && benchmarkSymbol
          ? `Fund profile is source-bound, but ${benchmarkSymbol} overlap is not available in the current provider payload.`
          : null,
  };
}

async function resolveFx(symbol: string): Promise<Pass459AlphaVantageSnapshot> {
  const pair = parseFxPair(symbol);
  if (!pair)
    return baseSnapshot(
      "alpha_vantage_fx",
      "unsupported",
      "FX symbol could not be normalized into a six-letter currency pair.",
    );
  const payload = await fetchAlphaVantage(
    {
      function: "CURRENCY_EXCHANGE_RATE",
      from_currency: pair.from,
      to_currency: pair.to,
    },
    60,
  );
  const failure = providerFailure(payload);
  if (failure)
    return {
      ...baseSnapshot("alpha_vantage_fx", failure.state, failure.reason),
      providerFunctions: ["CURRENCY_EXCHANGE_RATE"],
    };
  const rate = (payload["Realtime Currency Exchange Rate"] || {}) as JsonObject;
  const currentPrice = finite(rate["5. Exchange Rate"]);
  if (currentPrice === null)
    return {
      ...baseSnapshot(
        "alpha_vantage_fx",
        "provider_error",
        "CURRENCY_EXCHANGE_RATE returned no usable exchange rate.",
      ),
      providerFunctions: ["CURRENCY_EXCHANGE_RATE"],
    };
  const bid = finite(rate["8. Bid Price"]);
  const ask = finite(rate["9. Ask Price"]);
  const spreadBps =
    bid !== null && ask !== null && currentPrice > 0
      ? ((ask - bid) / currentPrice) * 10_000
      : null;
  const refreshed = text(rate["6. Last Refreshed"]);
  return {
    state: "source_bound",
    providerKind: "alpha_vantage_fx",
    source: "Alpha Vantage CURRENCY_EXCHANGE_RATE",
    sourceTimestamp: unixSeconds(refreshed),
    exchange: "FX reference rate",
    currency: pair.to,
    currentPrice,
    changePercent: null,
    marketCap: null,
    volume24h: null,
    high24h: null,
    low24h: null,
    providerFunctions: ["CURRENCY_EXCHANGE_RATE"],
    providerEvidence: [
      {
        label: "Provider cache",
        value: `${fetchMeta(payload).cache} · quota ${fetchMeta(payload).quota}`,
        source: "PASS460 quota/cache guard",
      },
      {
        label: "Pair",
        value: `${pair.from}/${pair.to}`,
        source: "CURRENCY_EXCHANGE_RATE",
      },
      {
        label: "Last refreshed",
        value: refreshed || "timestamp required",
        source: "CURRENCY_EXCHANGE_RATE",
      },
      {
        label: "Bid / ask",
        value:
          bid !== null && ask !== null
            ? `${bid} / ${ask}`
            : "spread source required",
        source: "CURRENCY_EXCHANGE_RATE",
      },
      {
        label: "Spread",
        value:
          spreadBps === null ? "not supplied" : `${spreadBps.toFixed(2)} bps`,
        source: "CURRENCY_EXCHANGE_RATE",
      },
    ],
    fundamentals: blankFundamentals(),
    missingReason:
      spreadBps === null
        ? "Rate is source-bound; bid/ask spread was not supplied."
        : null,
  };
}

function commodityFunction(
  symbol: string,
): { fn: string; params: Record<string, string>; label: string } | null {
  const normalized = symbol.toUpperCase();
  if (normalized === "GC=F" || normalized === "XAU/USD" || normalized === "XAU")
    return {
      fn: "GOLD_SILVER_SPOT",
      params: { symbol: "GOLD" },
      label: "Gold spot",
    };
  if (normalized === "SI=F" || normalized === "XAG/USD" || normalized === "XAG")
    return {
      fn: "GOLD_SILVER_SPOT",
      params: { symbol: "SILVER" },
      label: "Silver spot",
    };
  if (normalized === "CL=F" || normalized === "WTI")
    return { fn: "WTI", params: { interval: "daily" }, label: "WTI daily" };
  if (normalized === "BZ=F" || normalized === "BRENT")
    return { fn: "BRENT", params: { interval: "daily" }, label: "Brent daily" };
  if (normalized === "NG=F")
    return {
      fn: "NATURAL_GAS",
      params: { interval: "daily" },
      label: "Natural gas daily",
    };
  return null;
}

async function resolveCommodity(
  symbol: string,
): Promise<Pass459AlphaVantageSnapshot> {
  const contract = commodityFunction(symbol);
  if (!contract)
    return baseSnapshot(
      "alpha_vantage_commodity",
      "unsupported",
      "No keyed Alpha Vantage commodity route is mapped for this contract yet.",
    );
  const payload = await fetchAlphaVantage(
    { function: contract.fn, ...contract.params },
    300,
  );
  const failure = providerFailure(payload);
  if (failure)
    return {
      ...baseSnapshot("alpha_vantage_commodity", failure.state, failure.reason),
      providerFunctions: [contract.fn],
    };

  const rows = Array.isArray(payload.data)
    ? payload.data.filter((row): row is JsonObject =>
        Boolean(row && typeof row === "object" && !Array.isArray(row)),
      )
    : [];
  const latest = rows.find((row) => finite(row.value) !== null);
  const previous = rows
    .slice(rows.indexOf(latest as JsonObject) + 1)
    .find((row) => finite(row.value) !== null);
  const genericPrice =
    finite(payload.price) ??
    finite(payload["05. price"]) ??
    finite(payload.value);
  const currentPrice = latest ? finite(latest.value) : genericPrice;
  if (currentPrice === null)
    return {
      ...baseSnapshot(
        "alpha_vantage_commodity",
        "provider_error",
        `${contract.fn} returned no usable price.`,
      ),
      providerFunctions: [contract.fn],
    };
  const previousPrice = previous ? finite(previous.value) : null;
  const changePercent =
    previousPrice && previousPrice > 0
      ? ((currentPrice - previousPrice) / previousPrice) * 100
      : null;
  const observedAt = latest
    ? text(latest.date)
    : firstText(payload, ["timestamp", "last_updated", "date"]);
  const unit = firstText(payload, ["unit", "currency"]);
  return {
    state: "source_bound",
    providerKind: "alpha_vantage_commodity",
    source: `Alpha Vantage ${contract.fn}`,
    sourceTimestamp: unixSeconds(observedAt),
    exchange: "Commodity reference series",
    currency: unit,
    currentPrice,
    changePercent,
    marketCap: null,
    volume24h: null,
    high24h: null,
    low24h: null,
    providerFunctions: [contract.fn],
    providerEvidence: [
      {
        label: "Provider cache",
        value: `${fetchMeta(payload).cache} · quota ${fetchMeta(payload).quota}`,
        source: "PASS460 quota/cache guard",
      },
      { label: "Series", value: contract.label, source: contract.fn },
      {
        label: "Observed at",
        value: observedAt || "timestamp required",
        source: contract.fn,
      },
      {
        label: "Unit",
        value: unit || "method disclosure required",
        source: contract.fn,
      },
      {
        label: "Contract boundary",
        value:
          contract.fn === "GOLD_SILVER_SPOT"
            ? "spot reference"
            : "daily reference series; not an intraday futures order book",
        source: contract.fn,
      },
    ],
    fundamentals: blankFundamentals(),
    missingReason:
      "Execution depth, futures expiry and venue-specific order book remain separate evidence lanes.",
  };
}

export async function resolvePass459AlphaVantageSnapshot({
  symbol,
  assetClass,
}: {
  symbol: string;
  assetClass: Pass459ProviderAssetClass;
}): Promise<Pass459AlphaVantageSnapshot> {
  if (!isPass459AlphaVantageConfigured()) {
    const kind =
      assetClass === "fx"
        ? "alpha_vantage_fx"
        : assetClass === "commodity"
          ? "alpha_vantage_commodity"
          : "alpha_vantage_market";
    return baseSnapshot(
      kind,
      "not_configured",
      "Set ALPHA_VANTAGE_API_KEY to hydrate the selected instrument with a keyed primary provider.",
    );
  }
  try {
    if (assetClass === "fx") return await resolveFx(symbol);
    if (assetClass === "commodity") return await resolveCommodity(symbol);
    if (assetClass === "index")
      return baseSnapshot(
        "alpha_vantage_market",
        "unsupported",
        "Index breadth and constituent concentration require a dedicated index provider.",
      );
    const normalized = symbol.toUpperCase();
    if (
      assetClass === "etf" ||
      (assetClass === "real_estate" && FUND_PROFILE_SYMBOLS.has(normalized))
    )
      return await resolveFund(symbol);
    if (assetClass === "real_estate")
      return await resolveEquity(symbol, "reit");
    return await resolveEquity(symbol, "equity");
  } catch (error) {
    const kind =
      assetClass === "fx"
        ? "alpha_vantage_fx"
        : assetClass === "commodity"
          ? "alpha_vantage_commodity"
          : "alpha_vantage_market";
    return baseSnapshot(
      kind,
      "provider_error",
      error instanceof Error ? error.message : "Alpha Vantage request failed.",
    );
  }
}

export const pass459AlphaVantageProviderContract = {
  id: "PASS459_ALPHA_VANTAGE_PROVIDER",
  env: "ALPHA_VANTAGE_API_KEY",
  rules: [
    "Batch tables never burn keyed-provider quota; only a single selected detail request may hydrate Alpha Vantage.",
    "GLOBAL_QUOTE supplies equity price/volume/day range while OVERVIEW supplies market capitalization and filing cadence.",
    "CURRENCY_EXCHANGE_RATE supplies FX reference rate and spread evidence; FX market cap remains not applicable.",
    "Commodity routes expose method boundaries so a reference series is never presented as a complete futures order book.",
    "Provider throttle, missing key and unsupported routes remain explicit customer-facing source states.",
    "PASS460 adds process-local cache, inflight deduplication and configurable request guards without pretending to replace provider billing limits.",
    "PASS462 expands OVERVIEW into structured valuation/profitability facts and uses ETF_PROFILE for net assets, expenses, turnover and holdings when available.",
    "PASS464 adds INCOME_STATEMENT, BALANCE_SHEET and CASH_FLOW quality gates, plus optional SEC filing age through SEC_USER_AGENT.",
    "PASS464 fund analysis calculates holdings/sector concentration and a benchmark overlap only from disclosed ETF_PROFILE rows.",
  ],
};
