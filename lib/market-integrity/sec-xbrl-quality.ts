import type { Pass464FundamentalQuality } from "./fundamental-quality";

export type Pass465SecXbrlState =
  | "sec_aligned"
  | "sec_partial"
  | "sec_divergent"
  | "sec_required"
  | "not_applicable";

export type Pass465ConceptState =
  | "aligned"
  | "watch"
  | "divergent"
  | "sec_only"
  | "alpha_only"
  | "missing";

export type Pass465SecFact = {
  tag: string;
  unit: string;
  value: number | null;
  end: string | null;
  filed: string | null;
  form: string | null;
  frame: string | null;
  accessionNumber: string | null;
};

export type Pass465ConceptComparison = {
  id: "revenue" | "netIncome" | "assets" | "liabilities" | "equity" | "operatingCashFlow" | "capitalExpenditure";
  label: string;
  sec: Pass465SecFact | null;
  alphaValue: number | null;
  divergenceBps: number | null;
  state: Pass465ConceptState;
  note: string;
};

export type Pass465EarningsCadence = {
  latestForm: string | null;
  latestFilingDate: string | null;
  latestReportDate: string | null;
  previousFilingDate: string | null;
  daysSinceLatestFiling: number | null;
  daysBetweenLatestFilings: number | null;
  cadenceState: "fresh" | "aging" | "stale" | "source_required";
  nextCheck: string;
};

export type Pass465SecXbrlQuality = {
  version: "sec-xbrl-quality";
  state: Pass465SecXbrlState;
  cik: string | null;
  companyfactsState: "attached" | "missing" | "not_configured";
  filingUrl: string | null;
  filingDate: string | null;
  filingForm: string | null;
  reportDate: string | null;
  accessionNumber: string | null;
  earningsCadence: Pass465EarningsCadence;
  conceptCoverageScore: number;
  alignedConcepts: string[];
  divergentConcepts: string[];
  missingConcepts: string[];
  comparisons: Pass465ConceptComparison[];
  confidenceCap: number;
  flags: string[];
  evidence: Array<{ label: string; value: string; source: string }>;
  boundary: string;
};

type JsonObject = Record<string, unknown>;

type Filing = {
  filingDate: string;
  reportDate: string | null;
  form: string;
  accessionNumber: string | null;
  filingUrl?: string | null;
};

const US_GAAP_CONCEPTS = {
  revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  assets: ["Assets"],
  liabilities: ["Liabilities"],
  equity: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
  operatingCashFlow: ["NetCashProvidedByUsedInOperatingActivities"],
  capitalExpenditure: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
} satisfies Record<Pass465ConceptComparison["id"], string[]>;

const CONCEPT_LABELS = {
  revenue: "Revenue",
  netIncome: "Net income",
  assets: "Assets",
  liabilities: "Liabilities",
  equity: "Equity",
  operatingCashFlow: "Operating cash flow",
  capitalExpenditure: "Capital expenditure",
} satisfies Record<Pass465ConceptComparison["id"], string>;

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

function factsRoot(payload: JsonObject | null | undefined): JsonObject {
  const facts = payload?.facts;
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) return {};
  const usGaap = (facts as JsonObject)["us-gaap"];
  return usGaap && typeof usGaap === "object" && !Array.isArray(usGaap) ? (usGaap as JsonObject) : {};
}

function factRows(concept: unknown): JsonObject[] {
  if (!concept || typeof concept !== "object" || Array.isArray(concept)) return [];
  const units = (concept as JsonObject).units;
  if (!units || typeof units !== "object" || Array.isArray(units)) return [];
  const candidates = ["USD", "shares", "USD/shares", "pure"];
  const rows: JsonObject[] = [];
  for (const unit of candidates) {
    const value = (units as JsonObject)[unit];
    if (Array.isArray(value)) {
      for (const row of value) {
        if (row && typeof row === "object" && !Array.isArray(row)) rows.push({ ...(row as JsonObject), __unit: unit });
      }
    }
  }
  return rows;
}

function dateValue(value: unknown): number {
  const raw = text(value);
  if (!raw) return 0;
  const parsed = Date.parse(`${raw}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function newestFact(payload: JsonObject | null | undefined, tags: string[]): Pass465SecFact | null {
  const root = factsRoot(payload);
  for (const tag of tags) {
    const rows = factRows(root[tag])
      .filter((row) => finite(row.val) !== null)
      .sort((a, b) => {
        const filedDelta = dateValue(b.filed) - dateValue(a.filed);
        if (filedDelta) return filedDelta;
        return dateValue(b.end) - dateValue(a.end);
      });
    const row = rows[0];
    if (row) {
      return {
        tag,
        unit: text(row.__unit) || "unit required",
        value: finite(row.val),
        end: text(row.end),
        filed: text(row.filed),
        form: text(row.form),
        frame: text(row.frame),
        accessionNumber: text(row.accn),
      };
    }
  }
  return null;
}

function ageDays(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((now - parsed) / 86_400_000));
}

function divergenceBps(a: number | null, b: number | null): number | null {
  if (a === null || b === null || Math.abs(b) < 0.000001) return null;
  return Math.abs((a - b) / b) * 10_000;
}

function conceptState(sec: Pass465SecFact | null, alphaValue: number | null, bps: number | null): Pass465ConceptState {
  if (!sec && alphaValue === null) return "missing";
  if (sec && alphaValue === null) return "sec_only";
  if (!sec && alphaValue !== null) return "alpha_only";
  if (bps === null) return "watch";
  if (bps <= 250) return "aligned";
  if (bps <= 1_000) return "watch";
  return "divergent";
}

function compareConcept(
  id: Pass465ConceptComparison["id"],
  sec: Pass465SecFact | null,
  alphaValue: number | null,
): Pass465ConceptComparison {
  const bps = divergenceBps(sec?.value ?? null, alphaValue);
  const state = conceptState(sec, alphaValue, bps);
  return {
    id,
    label: CONCEPT_LABELS[id],
    sec,
    alphaValue,
    divergenceBps: bps === null ? null : Math.round(bps * 10) / 10,
    state,
    note:
      state === "aligned"
        ? "SEC Companyfacts and Alpha Vantage statement lane are within the alignment gate."
        : state === "divergent"
          ? "SEC Companyfacts and Alpha Vantage statement lane diverge; stronger wording is blocked."
          : state === "alpha_only"
            ? "Alpha Vantage has the concept, but SEC XBRL is missing or not configured."
            : state === "sec_only"
              ? "SEC XBRL has the concept, but the Alpha Vantage lane is missing."
              : "Concept needs another comparable period/unit before a stronger conclusion.",
  };
}

function formatMaybe(value: number | null): string {
  if (value === null) return "source required";
  return Math.round(value).toLocaleString("en-US");
}

function buildCadence(filing: Filing | null | undefined, previousFilingDate: string | null, now: number): Pass465EarningsCadence {
  const latestAge = ageDays(filing?.filingDate ?? null, now);
  const previousAge = ageDays(previousFilingDate, now);
  const daysBetweenLatestFilings = latestAge !== null && previousAge !== null ? Math.max(0, previousAge - latestAge) : null;
  const cadenceState: Pass465EarningsCadence["cadenceState"] = latestAge === null
    ? "source_required"
    : latestAge <= 120
      ? "fresh"
      : latestAge <= 210
        ? "aging"
        : "stale";
  return {
    latestForm: filing?.form ?? null,
    latestFilingDate: filing?.filingDate ?? null,
    latestReportDate: filing?.reportDate ?? null,
    previousFilingDate,
    daysSinceLatestFiling: latestAge,
    daysBetweenLatestFilings,
    cadenceState,
    nextCheck:
      cadenceState === "fresh"
        ? "Preserve the filing URL and compare the next 10-Q/10-K when released."
        : cadenceState === "aging"
          ? "Watch the next earnings/filing cadence before upgrading confidence."
          : cadenceState === "stale"
            ? "Refresh EDGAR submissions and block stronger wording until a newer filing is attached."
            : "Attach SEC submissions with a compliant SEC_USER_AGENT before stronger fundamentals copy.",
  };
}

function extractPreviousFilingDate(payload: JsonObject | null | undefined, current: string | null | undefined): string | null {
  const filings = payload?.filings;
  if (!filings || typeof filings !== "object" || Array.isArray(filings)) return null;
  const recent = (filings as JsonObject).recent;
  if (!recent || typeof recent !== "object" || Array.isArray(recent)) return null;
  const forms = Array.isArray((recent as JsonObject).form) ? ((recent as JsonObject).form as unknown[]) : [];
  const filingDates = Array.isArray((recent as JsonObject).filingDate) ? ((recent as JsonObject).filingDate as unknown[]) : [];
  const accepted = new Set(["10-Q", "10-K", "20-F", "40-F"]);
  for (let index = 0; index < forms.length; index += 1) {
    const form = forms[index];
    const filingDate = text(filingDates[index]);
    if (typeof form === "string" && accepted.has(form) && filingDate && filingDate !== current) return filingDate;
  }
  return null;
}

export function blankPass465SecXbrlQuality(): Pass465SecXbrlQuality {
  return {
    version: "sec-xbrl-quality",
    state: "sec_required",
    cik: null,
    companyfactsState: "not_configured",
    filingUrl: null,
    filingDate: null,
    filingForm: null,
    reportDate: null,
    accessionNumber: null,
    earningsCadence: {
      latestForm: null,
      latestFilingDate: null,
      latestReportDate: null,
      previousFilingDate: null,
      daysSinceLatestFiling: null,
      daysBetweenLatestFilings: null,
      cadenceState: "source_required",
      nextCheck: "Attach SEC submissions and Companyfacts/XBRL before stronger fundamentals copy.",
    },
    conceptCoverageScore: 0,
    alignedConcepts: [],
    divergentConcepts: [],
    missingConcepts: ["revenue", "netIncome", "assets", "liabilities", "equity", "operatingCashFlow", "capitalExpenditure"],
    comparisons: [],
    confidenceCap: 52,
    flags: ["SEC Companyfacts/XBRL source required."],
    evidence: [],
    boundary:
      "PASS465 requires SEC submissions plus Companyfacts/XBRL before Alpha Vantage statement metrics can be treated as second-source checked.",
  };
}

export function buildPass465SecXbrlQuality({
  cik,
  secCompanyFacts,
  secSubmissions,
  secFiling,
  alphaQuality,
  now = Date.now(),
}: {
  cik: string | null;
  secCompanyFacts: JsonObject | null;
  secSubmissions?: JsonObject | null;
  secFiling?: Filing | null;
  alphaQuality: Pass464FundamentalQuality;
  now?: number;
}): Pass465SecXbrlQuality {
  if (!cik) return blankPass465SecXbrlQuality();
  if (!secCompanyFacts) {
    const cadence = buildCadence(secFiling, null, now);
    return {
      ...blankPass465SecXbrlQuality(),
      cik,
      companyfactsState: "missing",
      filingUrl: secFiling?.filingUrl ?? null,
      filingDate: secFiling?.filingDate ?? null,
      filingForm: secFiling?.form ?? null,
      reportDate: secFiling?.reportDate ?? null,
      accessionNumber: secFiling?.accessionNumber ?? null,
      earningsCadence: cadence,
      confidenceCap: Math.min(alphaQuality.confidenceCap, 58),
      flags: ["CIK is attached, but SEC Companyfacts/XBRL payload is missing."],
    };
  }

  const conceptFacts = Object.fromEntries(
    (Object.keys(US_GAAP_CONCEPTS) as Pass465ConceptComparison["id"][]).map((id) => [
      id,
      newestFact(secCompanyFacts, US_GAAP_CONCEPTS[id]),
    ]),
  ) as Record<Pass465ConceptComparison["id"], Pass465SecFact | null>;

  const comparisons = [
    compareConcept("revenue", conceptFacts.revenue, alphaQuality.revenueTtm),
    compareConcept("netIncome", conceptFacts.netIncome, alphaQuality.netIncomeTtm),
    compareConcept("assets", conceptFacts.assets, alphaQuality.totalAssets),
    compareConcept("liabilities", conceptFacts.liabilities, alphaQuality.totalLiabilities),
    compareConcept("equity", conceptFacts.equity, alphaQuality.shareholderEquity),
    compareConcept("operatingCashFlow", conceptFacts.operatingCashFlow, alphaQuality.operatingCashFlowTtm),
    compareConcept("capitalExpenditure", conceptFacts.capitalExpenditure, alphaQuality.capitalExpenditureTtm),
  ];
  const alignedConcepts = comparisons.filter((item) => item.state === "aligned").map((item) => item.id);
  const divergentConcepts = comparisons.filter((item) => item.state === "divergent").map((item) => item.id);
  const missingConcepts = comparisons.filter((item) => item.state === "missing" || item.state === "alpha_only").map((item) => item.id);
  const attached = comparisons.filter((item) => item.sec?.value !== null && item.sec?.value !== undefined).length;
  const conceptCoverageScore = Math.round((attached / comparisons.length) * 100);
  const previousFilingDate = extractPreviousFilingDate(secSubmissions, secFiling?.filingDate ?? null);
  const cadence = buildCadence(secFiling, previousFilingDate, now);
  const flags: string[] = [];
  if (divergentConcepts.length) flags.push(`SEC divergence: ${divergentConcepts.join(", ")}.`);
  if (missingConcepts.length) flags.push(`SEC concepts missing or unmatched: ${missingConcepts.join(", ")}.`);
  if (cadence.cadenceState === "stale") flags.push("Latest filing cadence is stale.");
  if (!secFiling?.filingUrl) flags.push("Direct filing URL is missing from SEC submissions.");

  const state: Pass465SecXbrlState = attached === 0
    ? "sec_required"
    : divergentConcepts.length
      ? "sec_divergent"
      : conceptCoverageScore < 70 || missingConcepts.length > 2
        ? "sec_partial"
        : "sec_aligned";
  const rawCap = state === "sec_aligned"
    ? 90
    : state === "sec_partial"
      ? 72
      : state === "sec_divergent"
        ? 46
        : 54;
  const cadenceCap = cadence.cadenceState === "fresh"
    ? 100
    : cadence.cadenceState === "aging"
      ? 78
      : cadence.cadenceState === "stale"
        ? 48
        : 58;
  const confidenceCap = Math.max(24, Math.min(alphaQuality.confidenceCap, rawCap, cadenceCap));

  return {
    version: "sec-xbrl-quality",
    state,
    cik,
    companyfactsState: "attached",
    filingUrl: secFiling?.filingUrl ?? null,
    filingDate: secFiling?.filingDate ?? null,
    filingForm: secFiling?.form ?? null,
    reportDate: secFiling?.reportDate ?? null,
    accessionNumber: secFiling?.accessionNumber ?? null,
    earningsCadence: cadence,
    conceptCoverageScore,
    alignedConcepts,
    divergentConcepts,
    missingConcepts,
    comparisons,
    confidenceCap,
    flags,
    evidence: [
      {
        label: "SEC Companyfacts coverage",
        value: `${conceptCoverageScore}/100 · ${attached}/${comparisons.length} concepts attached`,
        source: "data.sec.gov/api/xbrl/companyfacts",
      },
      {
        label: "Latest filing",
        value: secFiling?.filingDate ? `${secFiling.filingDate} · ${secFiling.form}` : "SEC submissions required",
        source: secFiling?.filingUrl || "data.sec.gov/submissions",
      },
      {
        label: "Alpha ↔ SEC alignment",
        value: divergentConcepts.length ? `divergent: ${divergentConcepts.join(", ")}` : `${alignedConcepts.length} aligned concepts`,
        source: "PASS465 XBRL comparison gate",
      },
      {
        label: "Earnings cadence",
        value: cadence.daysSinceLatestFiling === null ? "source required" : `${cadence.daysSinceLatestFiling} days since filing · ${cadence.cadenceState}`,
        source: "SEC submissions recent filings",
      },
      {
        label: "Revenue / net income",
        value: `SEC rev ${formatMaybe(conceptFacts.revenue?.value ?? null)} · SEC NI ${formatMaybe(conceptFacts.netIncome?.value ?? null)}`,
        source: "SEC us-gaap concepts",
      },
      {
        label: "Balance sheet",
        value: `Assets ${formatMaybe(conceptFacts.assets?.value ?? null)} · Liabilities ${formatMaybe(conceptFacts.liabilities?.value ?? null)} · Equity ${formatMaybe(conceptFacts.equity?.value ?? null)}`,
        source: "SEC us-gaap concepts",
      },
    ],
    boundary:
      "SEC Companyfacts/XBRL is a second-source audit lane. Differences in period, taxonomy tag, unit or restatement lower confidence and must stay visible in UI, PDF and Shield AI.",
  };
}

export const pass465SecXbrlQualityContract = {
  id: "PASS465_SEC_XBRL_QUALITY",
  rules: [
    "SEC Companyfacts/XBRL is a second-source audit lane for Alpha Vantage fundamentals; it never fabricates missing issuer data.",
    "Revenue, net income, assets, liabilities, equity, operating cash flow and capex receive concept-level comparison states.",
    "Earnings cadence uses SEC submissions filing dates and direct filing URLs when SEC_USER_AGENT is configured.",
    "Divergent or stale SEC evidence can only lower the confidence cap used by Real Markets, PDF and Shield AI.",
    "Direct filing URLs remain evidence links, not promotional investment guidance.",
  ],
};
