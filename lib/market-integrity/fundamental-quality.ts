export type Pass464FundamentalState =
  | "source_bound"
  | "partial"
  | "stale"
  | "source_required";

export type Pass464FreshnessState =
  | "fresh"
  | "aging"
  | "stale"
  | "missing";

export type Pass464EtfAnalytics = {
  concentrationTop1: number | null;
  concentrationTop3: number | null;
  concentrationTop5: number | null;
  concentrationTop10: number | null;
  holdingsHhi: number | null;
  effectiveHoldings: number | null;
  sectorTop3: number | null;
  sectorHhi: number | null;
  benchmarkSymbol: string | null;
  overlapPercent: number | null;
  overlapState: "source_bound" | "comparison_required" | "unsupported";
  boundary: string;
};

export type Pass464FundamentalQuality = {
  version: "fundamental-quality";
  state: Pass464FundamentalState;
  freshnessState: Pass464FreshnessState;
  reportedPeriodEnd: string | null;
  reportedPeriodAgeDays: number | null;
  filingDate: string | null;
  filingAgeDays: number | null;
  filingForm: string | null;
  filingSource: "sec_submissions" | "period_end_proxy" | "source_required";
  currency: string | null;
  revenueTtm: number | null;
  netIncomeTtm: number | null;
  operatingIncomeTtm: number | null;
  operatingCashFlowTtm: number | null;
  capitalExpenditureTtm: number | null;
  freeCashFlowTtm: number | null;
  cashAndEquivalents: number | null;
  totalDebt: number | null;
  netDebt: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  shareholderEquity: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  currentRatio: number | null;
  debtToEquity: number | null;
  debtToEbitda: number | null;
  netDebtToEbitda: number | null;
  freeCashFlowMargin: number | null;
  cashConversion: number | null;
  qualityScore: number;
  confidenceCap: number;
  flags: string[];
  evidence: Array<{ label: string; value: string; source: string }>;
  etf: Pass464EtfAnalytics;
  boundary: string;
};

type JsonObject = Record<string, unknown>;
type Holding = { symbol: string; description: string; weight: number | null };
type Sector = { sector: string; weight: number | null };

function finite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized || /^(none|null|-|n\/a)$/i.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rows(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item && typeof item === "object" && !Array.isArray(item)),
      )
    : [];
}

function valueFrom(row: JsonObject | null, candidates: string[]): number | null {
  if (!row) return null;
  for (const key of candidates) {
    const direct = finite(row[key]);
    if (direct !== null) return direct;
    const match = Object.entries(row).find(
      ([candidate]) => candidate.toLowerCase() === key.toLowerCase(),
    );
    const loose = match ? finite(match[1]) : null;
    if (loose !== null) return loose;
  }
  return null;
}

function dateFrom(row: JsonObject | null): string | null {
  return row ? text(row.fiscalDateEnding) : null;
}

function ageDays(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((now - parsed) / 86_400_000));
}

function ttm(payload: JsonObject, candidates: string[]): number | null {
  const quarterly = rows(payload.quarterlyReports).slice(0, 4);
  if (quarterly.length >= 4) {
    const values = quarterly.map((row) => valueFrom(row, candidates));
    if (values.every((value): value is number => value !== null))
      return values.reduce((total, value) => total + value, 0);
  }
  const annual = rows(payload.annualReports)[0] || null;
  return valueFrom(annual, candidates);
}

function latestRow(payload: JsonObject): JsonObject | null {
  return rows(payload.quarterlyReports)[0] || rows(payload.annualReports)[0] || null;
}

function safeRatio(numerator: number | null, denominator: number | null) {
  return numerator !== null && denominator !== null && Math.abs(denominator) > 0.000001
    ? numerator / denominator
    : null;
}

function round(value: number | null, digits = 2): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function concentration(weights: Array<number | null>, count: number): number | null {
  const clean = weights
    .filter((value): value is number => value !== null && value >= 0)
    .sort((a, b) => b - a)
    .slice(0, count);
  return clean.length ? round(clean.reduce((total, value) => total + value, 0), 2) : null;
}

function hhi(weights: Array<number | null>): number | null {
  const clean = weights.filter((value): value is number => value !== null && value >= 0);
  if (!clean.length) return null;
  return round(clean.reduce((total, value) => total + (value / 100) ** 2, 0), 4);
}

function overlap(
  holdings: Holding[],
  benchmark: Holding[],
): number | null {
  if (!holdings.length || !benchmark.length) return null;
  const right = new Map(
    benchmark
      .filter((item) => item.symbol && item.weight !== null)
      .map((item) => [item.symbol.toUpperCase(), item.weight as number]),
  );
  let total = 0;
  for (const item of holdings) {
    if (!item.symbol || item.weight === null) continue;
    const other = right.get(item.symbol.toUpperCase());
    if (other !== undefined) total += Math.min(item.weight, other);
  }
  return round(total, 2);
}

export function buildPass464EtfAnalytics({
  holdings,
  sectors,
  benchmarkSymbol = null,
  benchmarkHoldings = [],
}: {
  holdings: Holding[];
  sectors: Sector[];
  benchmarkSymbol?: string | null;
  benchmarkHoldings?: Holding[];
}): Pass464EtfAnalytics {
  const holdingsHhi = hhi(holdings.map((item) => item.weight));
  const overlapPercent = overlap(holdings, benchmarkHoldings);
  return {
    concentrationTop1: concentration(holdings.map((item) => item.weight), 1),
    concentrationTop3: concentration(holdings.map((item) => item.weight), 3),
    concentrationTop5: concentration(holdings.map((item) => item.weight), 5),
    concentrationTop10: concentration(holdings.map((item) => item.weight), 10),
    holdingsHhi,
    effectiveHoldings:
      holdingsHhi !== null && holdingsHhi > 0 ? round(1 / holdingsHhi, 1) : null,
    sectorTop3: concentration(sectors.map((item) => item.weight), 3),
    sectorHhi: hhi(sectors.map((item) => item.weight)),
    benchmarkSymbol,
    overlapPercent,
    overlapState: overlapPercent !== null
      ? "source_bound"
      : benchmarkSymbol
        ? "comparison_required"
        : "unsupported",
    boundary:
      "ETF overlap uses disclosed top holdings only. Derivatives, cash, securities lending and holdings outside the provider payload are not normalized.",
  };
}

const emptyEtf = buildPass464EtfAnalytics({ holdings: [], sectors: [] });

export function blankPass464FundamentalQuality(): Pass464FundamentalQuality {
  return {
    version: "fundamental-quality",
    state: "source_required",
    freshnessState: "missing",
    reportedPeriodEnd: null,
    reportedPeriodAgeDays: null,
    filingDate: null,
    filingAgeDays: null,
    filingForm: null,
    filingSource: "source_required",
    currency: null,
    revenueTtm: null,
    netIncomeTtm: null,
    operatingIncomeTtm: null,
    operatingCashFlowTtm: null,
    capitalExpenditureTtm: null,
    freeCashFlowTtm: null,
    cashAndEquivalents: null,
    totalDebt: null,
    netDebt: null,
    totalAssets: null,
    totalLiabilities: null,
    shareholderEquity: null,
    currentAssets: null,
    currentLiabilities: null,
    currentRatio: null,
    debtToEquity: null,
    debtToEbitda: null,
    netDebtToEbitda: null,
    freeCashFlowMargin: null,
    cashConversion: null,
    qualityScore: 0,
    confidenceCap: 24,
    flags: ["Financial statements require a source."],
    evidence: [],
    etf: emptyEtf,
    boundary:
      "No balance-sheet, income-statement or cash-flow conclusion is allowed without statement payloads and a reporting period.",
  };
}

export function buildPass464EquityQuality({
  overview,
  incomeStatement,
  balanceSheet,
  cashFlow,
  secFiling,
  now = Date.now(),
}: {
  overview: JsonObject;
  incomeStatement: JsonObject;
  balanceSheet: JsonObject;
  cashFlow: JsonObject;
  secFiling?: { filingDate: string; form: string } | null;
  now?: number;
}): Pass464FundamentalQuality {
  const incomeLatest = latestRow(incomeStatement);
  const balanceLatest = latestRow(balanceSheet);
  const cashLatest = latestRow(cashFlow);
  const reportedPeriodEnd = [dateFrom(incomeLatest), dateFrom(balanceLatest), dateFrom(cashLatest)]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) || text(overview.LatestQuarter);
  const reportedPeriodAgeDays = ageDays(reportedPeriodEnd, now);
  const filingDate = secFiling?.filingDate || null;
  const filingAgeDays = ageDays(filingDate, now);
  const ageBasis = filingAgeDays ?? reportedPeriodAgeDays;
  const freshnessState: Pass464FreshnessState = ageBasis === null
    ? "missing"
    : ageBasis <= 150
      ? "fresh"
      : ageBasis <= 240
        ? "aging"
        : "stale";

  const revenueTtm = ttm(incomeStatement, ["totalRevenue"]);
  const netIncomeTtm = ttm(incomeStatement, ["netIncome"]);
  const operatingIncomeTtm = ttm(incomeStatement, ["operatingIncome"]);
  const operatingCashFlowTtm = ttm(cashFlow, ["operatingCashflow", "operatingCashFlow"]);
  const capitalExpenditureRaw = ttm(cashFlow, ["capitalExpenditures", "capitalExpenditure"]);
  const capitalExpenditureTtm = capitalExpenditureRaw === null ? null : Math.abs(capitalExpenditureRaw);
  const freeCashFlowTtm = operatingCashFlowTtm !== null && capitalExpenditureTtm !== null
    ? operatingCashFlowTtm - capitalExpenditureTtm
    : null;
  const cashAndEquivalents = valueFrom(balanceLatest, [
    "cashAndShortTermInvestments",
    "cashAndCashEquivalentsAtCarryingValue",
    "cashAndCashEquivalents",
  ]);
  const shortDebt = valueFrom(balanceLatest, ["shortTermDebt", "currentDebt"]);
  const longDebt = valueFrom(balanceLatest, ["longTermDebtNoncurrent", "longTermDebt"]);
  const totalDebtDirect = valueFrom(balanceLatest, ["totalDebt"]);
  const totalDebt = totalDebtDirect ??
    (shortDebt !== null && longDebt !== null ? shortDebt + longDebt : null);
  const netDebt = totalDebt !== null && cashAndEquivalents !== null
    ? totalDebt - cashAndEquivalents
    : null;
  const totalAssets = valueFrom(balanceLatest, ["totalAssets"]);
  const totalLiabilities = valueFrom(balanceLatest, ["totalLiabilities"]);
  const shareholderEquity = valueFrom(balanceLatest, ["totalShareholderEquity", "shareholderEquity"]);
  const currentAssets = valueFrom(balanceLatest, ["totalCurrentAssets", "currentAssets"]);
  const currentLiabilities = valueFrom(balanceLatest, ["totalCurrentLiabilities", "currentLiabilities"]);
  const ebitda = finite(overview.EBITDA);
  const currentRatio = round(safeRatio(currentAssets, currentLiabilities));
  const debtToEquity = round(safeRatio(totalDebt, shareholderEquity));
  const debtToEbitda = round(safeRatio(totalDebt, ebitda));
  const netDebtToEbitda = round(safeRatio(netDebt, ebitda));
  const freeCashFlowMargin = round(
    freeCashFlowTtm !== null && revenueTtm !== null && revenueTtm !== 0
      ? (freeCashFlowTtm / revenueTtm) * 100
      : null,
  );
  const cashConversion = round(
    operatingCashFlowTtm !== null && netIncomeTtm !== null && netIncomeTtm !== 0
      ? operatingCashFlowTtm / netIncomeTtm
      : null,
  );

  const flags: string[] = [];
  if (freshnessState === "stale") flags.push("Financial reporting period is stale.");
  if (filingDate === null) flags.push("Actual SEC filing date is not attached; period end is only a proxy.");
  if (freeCashFlowTtm !== null && freeCashFlowTtm < 0) flags.push("Free cash flow is negative on the available TTM lane.");
  if (currentRatio !== null && currentRatio < 1) flags.push("Current liabilities exceed current assets.");
  if (netDebtToEbitda !== null && netDebtToEbitda > 4) flags.push("Net debt / EBITDA exceeds 4x.");
  if (cashConversion !== null && cashConversion < 0.75) flags.push("Operating cash conversion is below 0.75x net income.");

  const statementCoverage = [incomeLatest, balanceLatest, cashLatest].filter(Boolean).length;
  let score = 38 + statementCoverage * 12;
  if (freshnessState === "fresh") score += 12;
  else if (freshnessState === "aging") score += 4;
  else if (freshnessState === "stale") score -= 18;
  if (freeCashFlowTtm !== null && freeCashFlowTtm > 0) score += 6;
  if (currentRatio !== null && currentRatio >= 1) score += 4;
  if (netDebtToEbitda !== null && netDebtToEbitda <= 3) score += 4;
  score -= Math.min(24, flags.length * 6);
  const qualityScore = Math.max(0, Math.min(100, Math.round(score)));
  const confidenceCap = Math.max(
    24,
    Math.min(92, qualityScore - (filingDate === null ? 8 : 0)),
  );
  const state: Pass464FundamentalState = statementCoverage === 0
    ? "source_required"
    : freshnessState === "stale"
      ? "stale"
      : statementCoverage < 3
        ? "partial"
        : "source_bound";
  const currency = incomeLatest ? text(incomeLatest.reportedCurrency) : null;

  const display = (value: number | null) => value === null ? "source required" : String(Math.round(value));
  return {
    version: "fundamental-quality",
    state,
    freshnessState,
    reportedPeriodEnd: reportedPeriodEnd || null,
    reportedPeriodAgeDays,
    filingDate,
    filingAgeDays,
    filingForm: secFiling?.form || null,
    filingSource: filingDate ? "sec_submissions" : reportedPeriodEnd ? "period_end_proxy" : "source_required",
    currency,
    revenueTtm,
    netIncomeTtm,
    operatingIncomeTtm,
    operatingCashFlowTtm,
    capitalExpenditureTtm,
    freeCashFlowTtm,
    cashAndEquivalents,
    totalDebt,
    netDebt,
    totalAssets,
    totalLiabilities,
    shareholderEquity,
    currentAssets,
    currentLiabilities,
    currentRatio,
    debtToEquity,
    debtToEbitda,
    netDebtToEbitda,
    freeCashFlowMargin,
    cashConversion,
    qualityScore,
    confidenceCap,
    flags,
    evidence: [
      { label: "Reporting period", value: reportedPeriodEnd || "source required", source: "INCOME_STATEMENT · BALANCE_SHEET · CASH_FLOW" },
      { label: "Actual filing", value: filingDate ? `${filingDate} · ${secFiling?.form || "form required"}` : "SEC submissions source required", source: filingDate ? "SEC submissions" : "period-end proxy" },
      { label: "Free cash flow TTM", value: display(freeCashFlowTtm), source: "CASH_FLOW" },
      { label: "Net debt", value: display(netDebt), source: "BALANCE_SHEET" },
      { label: "Net debt / EBITDA", value: netDebtToEbitda === null ? "source required" : `${netDebtToEbitda}x`, source: "BALANCE_SHEET · OVERVIEW" },
      { label: "Current ratio", value: currentRatio === null ? "source required" : `${currentRatio}x`, source: "BALANCE_SHEET" },
    ],
    etf: emptyEtf,
    boundary:
      "Statement quality is historical and period-bound. It does not predict price, eliminate accounting risk or replace the issuer filing.",
  };
}

export function buildPass464FundQuality({
  holdings,
  sectors,
  benchmarkSymbol,
  benchmarkHoldings,
}: {
  holdings: Holding[];
  sectors: Sector[];
  benchmarkSymbol: string | null;
  benchmarkHoldings: Holding[];
}): Pass464FundamentalQuality {
  const etf = buildPass464EtfAnalytics({ holdings, sectors, benchmarkSymbol, benchmarkHoldings });
  const coverage = [etf.concentrationTop10, etf.holdingsHhi, etf.sectorTop3].filter((value) => value !== null).length;
  const flags: string[] = [];
  if (etf.concentrationTop10 !== null && etf.concentrationTop10 > 50) flags.push("Top-10 holdings exceed 50% concentration.");
  if (etf.sectorTop3 !== null && etf.sectorTop3 > 70) flags.push("Top-3 sectors exceed 70% concentration.");
  if (etf.overlapState !== "source_bound") flags.push("Benchmark overlap requires a comparable holdings profile.");
  const qualityScore = Math.max(24, Math.min(92, 48 + coverage * 10 - flags.length * 5));
  return {
    ...blankPass464FundamentalQuality(),
    state: coverage >= 3 ? "source_bound" : coverage ? "partial" : "source_required",
    freshnessState: coverage ? "fresh" : "missing",
    qualityScore,
    confidenceCap: Math.min(88, qualityScore),
    flags,
    evidence: [
      { label: "Top-10 concentration", value: etf.concentrationTop10 === null ? "source required" : `${etf.concentrationTop10}%`, source: "ETF_PROFILE holdings" },
      { label: "Effective holdings", value: etf.effectiveHoldings === null ? "source required" : String(etf.effectiveHoldings), source: "holdings HHI" },
      { label: "Top-3 sector concentration", value: etf.sectorTop3 === null ? "source required" : `${etf.sectorTop3}%`, source: "ETF_PROFILE sectors" },
      { label: "Benchmark overlap", value: etf.overlapPercent === null ? "comparison required" : `${etf.overlapPercent}%`, source: benchmarkSymbol || "benchmark required" },
    ],
    etf,
    boundary: etf.boundary,
  };
}

export const pass464FundamentalQualityContract = {
  id: "PASS464_FUNDAMENTAL_QUALITY",
  rules: [
    "Equity quality requires income statement, balance sheet and cash flow; OVERVIEW alone cannot prove balance-sheet strength.",
    "Actual filing age uses SEC submissions only when a CIK and SEC_USER_AGENT are available; otherwise period-end age remains an explicit proxy.",
    "Free cash flow, liquidity and leverage ratios are period-bound and confidence-capped when any statement is missing or stale.",
    "ETF concentration is calculated from disclosed holdings and sectors; overlap requires an explicit benchmark profile.",
    "Missing statement fields remain source-required and never become synthetic zeros.",
  ],
};
