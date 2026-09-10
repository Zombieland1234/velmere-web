import {
  calibrateConfidencePercent,
  type EvidenceConfidenceStatus,
} from "./confidence-calibration";
import { humanMissingValue } from "./human-readout-lane-runtime";

export type UnifiedAuditMode = "basic" | "pro" | "advanced";
export type UnifiedAuditLocale = "pl" | "de" | "en";
export type UnifiedAuditAssetClass =
  | "crypto"
  | "stock"
  | "index"
  | "fx"
  | "etf"
  | "commodity"
  | "real_estate"
  | "exchange";

export type UnifiedAuditEvidence = {
  id: string;
  label: string;
  value: string;
  note: string;
  status: "verified" | "review" | "missing";
};

export type UnifiedAuditInput = {
  locale: string;
  subject: string;
  source: string;
  assetClass?: UnifiedAuditAssetClass;
  sourceTimestamp?: number | null;
  riskScore?: number | null;
  confidence?: number | null;
  metrics: Array<{
    id: string;
    label: string;
    value?: unknown;
    note?: string;
    status?: UnifiedAuditEvidence["status"];
  }>;
};

const countByMode: Record<UnifiedAuditMode, number> = {
  basic: 10,
  pro: 14,
  advanced: 20,
};

const copy = {
  pl: {
    source: "Źródło",
    sourceNote: "Adapter danych przypisany do tego wyniku.",
    timestamp: "Timestamp źródła",
    timestampNote: "Czas ostatniej obserwacji przekazany przez dostawcę.",
    risk: "Presja ryzyka",
    riskNote: "Wynik porządkuje sygnały i luki danych.",
    confidence: "Pewność danych",
    confidenceNote: "Pewność jest kalibrowana przez kompletność, źródło i świeżość wejścia.",
    coverage: "Pokrycie dowodów",
    coverageNote: "Pokrycie pokazuje udział potwierdzonych i częściowo potwierdzonych pól.",
    subject: "Tożsamość instrumentu",
    subjectNote: "Symbol i nazwa są podstawą dalszego routingu źródeł.",
    review: "Nie udajemy pewności — potrzebne drugie źródło albo świeższa obserwacja.",
  },
  de: {
    source: "Quelle",
    sourceNote: "Der diesem Ergebnis zugeordnete Datenadapter.",
    timestamp: "Quellenzeit",
    timestampNote: "Zeit der letzten vom Provider gelieferten Beobachtung.",
    risk: "Risikodruck",
    riskNote: "Der Wert ordnet Signale und Datenlücken.",
    confidence: "Datenkonfidenz",
    confidenceNote: "Konfidenz wird durch Vollständigkeit, Quelle und Aktualität kalibriert.",
    coverage: "Evidenzabdeckung",
    coverageNote: "Die Abdeckung zeigt bestätigte und teilweise bestätigte Felder.",
    subject: "Instrument-Identität",
    subjectNote: "Symbol und Name steuern das weitere Quellen-Routing.",
    review: "Keine vorgetäuschte Sicherheit — Zweitquelle oder frischere Beobachtung nötig.",
  },
  en: {
    source: "Source",
    sourceNote: "The data adapter assigned to this result.",
    timestamp: "Source timestamp",
    timestampNote: "Time of the latest observation supplied by the provider.",
    risk: "Risk pressure",
    riskNote: "The score organizes signals and data gaps.",
    confidence: "Data confidence",
    confidenceNote: "Confidence is calibrated by completeness, source presence and freshness.",
    coverage: "Evidence coverage",
    coverageNote: "Coverage represents verified and partially verified fields.",
    subject: "Instrument identity",
    subjectNote: "Symbol and name drive further source routing.",
    review: "No fake certainty — requires a second source or fresher observation.",
  },
} as const;

export function resolveUnifiedAuditLocale(locale: string): UnifiedAuditLocale {
  return locale === "de" || locale === "en" ? locale : "pl";
}

function formatAuditValue(value: unknown, locale: UnifiedAuditLocale): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: Math.abs(value) < 10 ? 4 : 2,
    }).format(value);
  }
  if (typeof value === "boolean") {
    if (locale === "pl") return value ? "tak" : "nie";
    if (locale === "de") return value ? "ja" : "nein";
    return value ? "yes" : "no";
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => formatAuditValue(item, locale))
      .filter(Boolean)
      .join(" · ");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferredKeys = [
      "price",
      "currentPrice",
      "marketCap",
      "fdv",
      "change",
      "changePercent",
      "change1h",
      "change24h",
      "change7d",
      "volume",
      "liquidity",
      "slippage",
      "source",
      "sourceTimestamp",
      "state",
    ];
    const parts = preferredKeys.flatMap((key) => {
      if (!(key in record)) return [];
      const formatted = formatAuditValue(record[key], locale);
      return formatted ? `${key}: ${formatted}` : [];
    });
    if (parts.length) return parts.join(" · ");
    return Object.entries(record)
      .slice(0, 4)
      .map(([key, entry]) => {
        const formatted = formatAuditValue(entry, locale);
        return formatted ? `${key}: ${formatted}` : "";
      })
      .filter(Boolean)
      .join(" · ");
  }
  return String(value);
}

const commonPriority: Record<UnifiedAuditMode, string[]> = {
  basic: [
    "identity",
    "humanBrief",
    "price",
    "marketCap",
    "change24h",
    "volume",
    "source",
    "timestamp",
    "confidence",
    "coverage",
    "risk",
    "providerState",
    "exchange",
    "currency",
  ],
  pro: [
    "identity",
    "humanBrief",
    "price",
    "marketCap",
    "change1h",
    "change24h",
    "change7d",
    "volume",
    "candles",
    "gaps",
    "sourceQuality",
    "secondSource",
    "providerState",
    "timestamp",
    "risk",
    "confidence",
    "coverage",
    "liquidity",
    "depth",
    "exchange",
    "currency",
  ],
  advanced: [
    "identity",
    "humanBrief",
    "price",
    "marketCap",
    "fdv",
    "change1h",
    "change24h",
    "change7d",
    "change30d",
    "volume",
    "turnover",
    "liquidity",
    "liquidityRatio",
    "slippage",
    "depth",
    "supply",
    "unlockPressure",
    "holders",
    "concentration",
    "tax",
    "sourceQuorum",
    "agentDisagreement",
    "candles",
    "volatility",
    "gaps",
    "secondSource",
    "sourceQuality",
    "providerState",
    "timestamp",
    "source",
    "risk",
    "confidence",
    "coverage",
    "venueHealth",
    "websocketCadence",
    "filing",
    "pdfReadout",
    "auditBoundary",
    "quoteObject",
    "open",
    "high",
    "low",
    "close",
    "sessionStart",
    "sessionEnd",
    "exchange",
    "currency",
  ],
};

const assetPriority: Record<UnifiedAuditAssetClass, Partial<Record<UnifiedAuditMode, string[]>>> = {
  crypto: {
    pro: ["fdv", "turnover", "circulatingRatio", "secondSource", "sourceQuorum"],
    advanced: ["holders", "unlockPressure", "supply", "liquidityRatio", "venueHealth", "websocketCadence", "providerResilience"],
  },
  stock: {
    pro: ["marketCap", "peRatio", "earningsDate", "revenueGrowth", "filingFreshness", "secondSource"],
    advanced: ["enterpriseValue", "freeCashFlow", "debtLoad", "insiderActivity", "institutionalOwnership", "filing", "providerResilience"],
  },
  index: {
    pro: ["constituentBreadth", "concentration", "realizedVolatility", "secondSource"],
    advanced: ["sectorBreadth", "topWeight", "rebalanceRisk", "macroSensitivity", "providerResilience"],
  },
  fx: {
    pro: ["spread", "realizedVolatility", "rateDifferential", "macroCalendar", "secondSource"],
    advanced: ["forwardPoints", "carryRegime", "liquiditySession", "centralBankRisk", "providerResilience"],
  },
  etf: {
    pro: ["aum", "navPremium", "trackingError", "holdingsConcentration", "secondSource"],
    advanced: ["creationRedemption", "issuerConcentration", "liquidityTier", "holdingsFreshness", "providerResilience"],
  },
  commodity: {
    pro: ["openInterest", "contractExpiry", "futuresCurve", "inventorySignal", "secondSource"],
    advanced: ["rollYield", "curveStress", "deliveryRisk", "seasonality", "providerResilience"],
  },
  real_estate: {
    pro: ["ffo", "occupancy", "leverage", "navDiscount", "secondSource"],
    advanced: ["debtMaturity", "tenantConcentration", "refinancingRisk", "capRateSpread", "providerResilience"],
  },
  exchange: {
    basic: ["identity", "humanBrief", "venueHealth", "providerState", "websocketCadence", "source", "timestamp", "risk", "confidence", "coverage"],
    pro: ["withdrawals", "reserves", "depth", "heartbeatAge", "reconnectPolicy", "secondSource", "sourceQuality"],
    advanced: ["statusPage", "orderbookIntegrity", "apiErrorRate", "maintenanceState", "proofOfReserves", "jurisdiction", "providerResilience", "auditBoundary"],
  },
};

function priorityFor(mode: UnifiedAuditMode, assetClass?: UnifiedAuditAssetClass) {
  const specific = assetClass ? assetPriority[assetClass][mode] || [] : [];
  return [...specific, ...commonPriority[mode]].filter(
    (id, index, all) => all.indexOf(id) === index,
  );
}

export function buildUnifiedAuditEvidence(
  input: UnifiedAuditInput,
  mode: UnifiedAuditMode,
): UnifiedAuditEvidence[] {
  const locale = resolveUnifiedAuditLocale(input.locale);
  const c = copy[locale];
  const supplied = input.metrics.map<UnifiedAuditEvidence>((metric) => {
    const formattedValue = formatAuditValue(metric.value, locale);
    const hasValue = formattedValue.length > 0;
    return {
      id: metric.id,
      label: metric.label,
      value: hasValue
        ? formattedValue
        : humanMissingValue(locale, `${metric.id} ${metric.label}`),
      note: metric.note || (hasValue ? c.sourceNote : c.review),
      status: metric.status || (hasValue ? "verified" : "missing"),
    };
  });
  const calibrated = calibrateConfidencePercent({
    modelConfidence: input.confidence,
    statuses: supplied.map((item) => item.status as EvidenceConfidenceStatus),
    hasSource: Boolean(input.source),
    hasTimestamp: Boolean(input.sourceTimestamp),
    sourceCount: input.source
      .split(/\s+\+\s+|\s+\|\s+|,/)
      .map((source) => source.trim())
      .filter(Boolean).length,
  });
  const base: UnifiedAuditEvidence[] = [
    {
      id: "identity",
      label: c.subject,
      value: input.subject,
      note: c.subjectNote,
      status: "verified",
    },
    {
      id: "source",
      label: c.source,
      value: input.source || humanMissingValue(locale, "source"),
      note: input.source ? c.sourceNote : c.review,
      status: input.source ? "verified" : "missing",
    },
    {
      id: "timestamp",
      label: c.timestamp,
      value: input.sourceTimestamp
        ? new Date(input.sourceTimestamp * 1000).toLocaleString(locale)
        : humanMissingValue(locale, "timestamp"),
      note: input.sourceTimestamp ? c.timestampNote : c.review,
      status: input.sourceTimestamp ? "verified" : "missing",
    },
    {
      id: "risk",
      label: c.risk,
      value:
        typeof input.riskScore === "number"
          ? `${Math.round(input.riskScore)}/100`
          : humanMissingValue(locale, "risk"),
      note: typeof input.riskScore === "number" ? c.riskNote : c.review,
      status: typeof input.riskScore === "number" ? "review" : "missing",
    },
    {
      id: "confidence",
      label: c.confidence,
      value:
        typeof input.confidence === "number"
          ? `${calibrated.confidence}%`
          : humanMissingValue(locale, "confidence"),
      note:
        typeof input.confidence === "number"
          ? `${c.confidenceNote} ${c.coverage}: ${calibrated.coverage}%.`
          : c.review,
      status: typeof input.confidence === "number" ? "review" : "missing",
    },
    {
      id: "coverage",
      label: c.coverage,
      value: `${calibrated.coverage}%`,
      note: c.coverageNote,
      status:
        calibrated.coverage >= 78
          ? "verified"
          : calibrated.coverage >= 45
            ? "review"
            : "missing",
    },
  ];

  const unique = [...base, ...supplied].filter(
    (item, index, all) =>
      all.findIndex((candidate) => candidate.id === item.id) === index,
  );
  const priority = priorityFor(mode, input.assetClass);
  const ordered = [
    ...priority
      .map((id) => unique.find((item) => item.id === id))
      .filter((item): item is UnifiedAuditEvidence => Boolean(item)),
    ...unique.filter((item) => !priority.includes(item.id)),
  ].filter(
    (item, index, all) =>
      all.findIndex((candidate) => candidate.id === item.id) === index,
  );

  return ordered.slice(0, countByMode[mode]);
}
