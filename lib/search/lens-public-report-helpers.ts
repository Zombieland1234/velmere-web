import type {
  VelmereOfficialReferenceSnapshot,
  VelmereSearchResult,
} from "@/lib/search/intelligence-search-contract";
import type { LensReport, LensReportDepth } from "@/lib/search/lens-report";

export const PASS4415_LENS_PUBLIC_REPORT_HELPERS_BOUNDARY = {
  passId: "PASS4415",
  mode: "no_visual_browser_lens_public_report_helper_extraction",
  visualChanges: false,
  purpose:
    "Move Browser/Lens public report copy, evidence lane, snapshot formatter and tone helper code out of VelmereIntelligenceSearchClient to reduce client parse/build pressure without changing rendered UI.",
  publicTopkaLiveAllowed: false,
} as const;

export type Pass4415LensLocale = "pl" | "de" | "en";
export type Pass4153LensDepthLabelMap = Record<LensReportDepth, string>;
export type Pass4153LensDepthDescriptionMap = Record<LensReportDepth, string>;
export type PublicLensEvidenceLaneState = "confirmed" | "limited" | "missing" | "locked";

export type PublicLensEvidenceLane = {
  id: string;
  label: string;
  value: string;
  state: PublicLensEvidenceLaneState;
  depth: LensReportDepth[];
};

export function pass4153LensDepthLabel(labels: Pass4153LensDepthLabelMap, depth: LensReportDepth): string {
  return labels[depth] ?? depth;
}

export function pass4153LensDepthDescription(
  descriptions: Pass4153LensDepthDescriptionMap,
  depth: LensReportDepth,
): string {
  return descriptions[depth] ?? depth;
}

export function reportSection(
  report: LensReport,
  id: LensReport["sections"][number]["id"],
  fallback: string,
) {
  return report.sections.find((section: LensReport["sections"][number]) => section.id === id)?.body || fallback;
}

export function formatSnapshotMoney(locale: string, value?: number, currency = "USD") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const maxDigits = abs < 0.0001 ? 8 : abs < 1 ? 6 : 2;
  const minDigits = abs < 0.0001 ? 6 : abs < 0.01 ? 4 : 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: abs >= 1_000_000 ? "compact" : "standard",
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    }).format(value);
  } catch {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    }).format(value);
  }
}

export function formatSnapshotPercent(locale: string, value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}%`;
}

export type CompactBrowserMarketMetric = {
  id: "price" | "market-cap" | "24h" | "volume" | "reference-rate" | "reference-date" | "reference-classification" | "reference-source";
  label: string;
  value: string;
};

export type OfficialReferenceDisplay = {
  rateLabel: string;
  dateLabel: string;
  classificationLabel: string;
  sourceLabel: string;
  rate: string;
  referenceDate: string;
  classification: string;
  source: string;
  warning: string;
  referenceOnly: true;
  executableQuote: false;
  marketPriceFieldEligible: false;
};

export function buildOfficialReferenceDisplay(
  locale: Pass4415LensLocale,
  reference: VelmereOfficialReferenceSnapshot,
): OfficialReferenceDisplay {
  const formattedRate = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 8,
    useGrouping: false,
  }).format(reference.referenceRate);
  const localized = locale === "pl"
    ? {
        rateLabel: "Referencyjny kurs ECB",
        dateLabel: "Data referencyjna",
        classificationLabel: "Charakter",
        sourceLabel: "Źródło",
        classification: "Niewykonawczy punkt odniesienia",
        warning: "Oficjalna statystyka datowana; nie jest bieżącą ceną ani kursem wykonawczym.",
      }
    : locale === "de"
      ? {
          rateLabel: "EZB-Referenzkurs",
          dateLabel: "Referenzdatum",
          classificationLabel: "Einordnung",
          sourceLabel: "Quelle",
          classification: "Nicht ausführbarer Referenzwert",
          warning: "Offizielle datierte Statistik; kein Live-Preis und kein ausführbarer Kurs.",
        }
      : {
          rateLabel: "ECB reference rate",
          dateLabel: "Reference date",
          classificationLabel: "Classification",
          sourceLabel: "Source",
          classification: "Non-executable benchmark",
          warning: "Official dated statistic; not a live price or executable quote.",
        };
  return {
    ...localized,
    rate: `1 EUR = ${formattedRate} ${reference.quoteCurrency}`,
    referenceDate: reference.referenceDate,
    source: reference.attribution,
    referenceOnly: true,
    executableQuote: false,
    marketPriceFieldEligible: false,
  };
}

/**
 * Projects the compact customer card without ever coercing an official dated
 * reference statistic into a live/executable market-price field.
 */
export function buildCompactBrowserMarketMetrics(
  locale: Pass4415LensLocale,
  result: VelmereSearchResult,
): CompactBrowserMarketMetric[] {
  const reference = result.officialReferenceSnapshot;
  if (reference) {
    const display = buildOfficialReferenceDisplay(locale, reference);
    return [
      {
        id: "reference-rate",
        label: display.rateLabel,
        value: display.rate,
      },
      {
        id: "reference-date",
        label: display.dateLabel,
        value: display.referenceDate,
      },
      {
        id: "reference-classification",
        label: display.classificationLabel,
        value: display.classification,
      },
      { id: "reference-source", label: display.sourceLabel, value: display.source },
    ];
  }

  const snapshot = result.marketSnapshot;
  return [
    {
      id: "price",
      label: locale === "pl" ? "Cena" : locale === "de" ? "Preis" : "Price",
      value: formatSnapshotMoney(locale, snapshot?.price, snapshot?.currency),
    },
    {
      id: "market-cap",
      label: locale === "pl" ? "Kapitalizacja" : locale === "de" ? "Marktkapitalisierung" : "Market cap",
      value: formatSnapshotMoney(locale, snapshot?.marketCap, snapshot?.currency),
    },
    {
      id: "24h",
      label: "24H",
      value: formatSnapshotPercent(locale, snapshot?.change24h),
    },
    {
      id: "volume",
      label: locale === "pl" ? "Wolumen" : locale === "de" ? "Volumen" : "Volume",
      value: formatSnapshotMoney(locale, snapshot?.volume24h, snapshot?.currency),
    },
  ];
}

export function isCompactBrowserAssetResult(result: VelmereSearchResult) {
  return result.category === "token" || result.category === "market";
}

export function compactBrowserPreviewCopy(locale: Pass4415LensLocale, result: VelmereSearchResult) {
  if (locale === "pl") {
    return {
      label: "Krótki podgląd",
      body: "Browser pokazuje tylko liczby wejściowe. Pełne źródła, braki, Pro/Advanced i PDF są niżej w akcji raportu.",
      next: result.nextOperatorStep || "Otwórz PDF albo Shield, jeżeli chcesz pełną analizę.",
    };
  }
  if (locale === "de") {
    return {
      label: "Kurzvorschau",
      body: "Browser zeigt nur die Einstiegszahlen. Quellen, Lücken, Pro/Advanced und PDF bleiben in der Report-Aktion.",
      next: result.nextOperatorStep || "PDF oder Shield öffnen, wenn du die volle Analyse willst.",
    };
  }
  return {
    label: "Short preview",
    body: "Browser shows only the entry numbers. Sources, gaps, Pro/Advanced and PDF stay in the report action below.",
    next: result.nextOperatorStep || "Open PDF or Shield for full analysis.",
  };
}

export function publicKernelLabel(locale: Pass4415LensLocale) {
  if (locale === "pl") return "Kontrola AI";
  if (locale === "de") return "KI-Prüfung";
  return "AI review";
}

export function publicKernelStatus(locale: Pass4415LensLocale, status?: string | null) {
  if (status === "ready") return locale === "pl" ? "gotowe" : locale === "de" ? "bereit" : "ready";
  if (status === "needs_review") return locale === "pl" ? "do sprawdzenia" : locale === "de" ? "zu prüfen" : "needs review";
  if (status === "blocked") return locale === "pl" ? "ograniczone" : locale === "de" ? "begrenzt" : "limited";
  return locale === "pl" ? "ograniczone" : locale === "de" ? "begrenzt" : "limited";
}

export function publicPdfMetricLabel(locale: Pass4415LensLocale, key: "evidence" | "cap" | "missing") {
  const labels = {
    pl: { evidence: "Dowody", cap: "Limit pokrycia dowodów", missing: "Braki" },
    de: { evidence: "Belege", cap: "Evidenzabdeckungsgrenze", missing: "Lücken" },
    en: { evidence: "Evidence", cap: "Evidence-coverage ceiling", missing: "Missing" },
  } as const;
  return labels[locale][key];
}

export function publicEvidenceCopy(locale: Pass4415LensLocale) {
  if (locale === "pl") {
    return {
      title: "Pakiet dowodów",
      subtitle: "Ten sam kontrakt claim–źródło co w Shield: brak źródła pokazujemy jako lukę, nie jako pewność.",
      confirmed: "potwierdzone",
      limited: "ograniczone",
      missing: "brak",
      locked: "zablokowane",
      next: "następna luka",
      primary: "Źródło główne",
      second: "Drugie źródło",
      gaps: "Aneks luk",
      confidence: "Limit pokrycia dowodów",
      claimGate: "Bramka claim–źródło",
      orderbook: "Orderbook / spread",
      holders: "Holderzy / supply",
      contract: "Kontrakt / admin",
    };
  }
  if (locale === "de") {
    return {
      title: "Evidenzpaket",
      subtitle: "Derselbe Claim-Quellen-Vertrag wie in Shield: fehlende Quellen bleiben als Lücke sichtbar.",
      confirmed: "bestätigt",
      limited: "begrenzt",
      missing: "fehlt",
      locked: "gesperrt",
      next: "nächste Lücke",
      primary: "Hauptquelle",
      second: "Zweitquelle",
      gaps: "Lückenanhang",
      confidence: "Evidenzabdeckungsgrenze",
      claimGate: "Claim-Quellen-Gate",
      orderbook: "Orderbuch / Spread",
      holders: "Holder / Supply",
      contract: "Contract / Admin",
    };
  }
  return {
    title: "Evidence packet",
    subtitle: "The same claim-source contract as Shield: missing sources stay visible as gaps, not confidence.",
    confirmed: "confirmed",
    limited: "limited",
    missing: "missing",
    locked: "locked",
    next: "next gap",
    primary: "Primary source",
    second: "Second source",
    gaps: "Gap appendix",
    confidence: "Evidence-coverage ceiling",
    claimGate: "Claim-source gate",
    orderbook: "Orderbook / spread",
    holders: "Holders / supply",
    contract: "Contract / admin",
  };
}

export function publicEvidenceStateLabel(locale: Pass4415LensLocale, state: PublicLensEvidenceLaneState) {
  const c = publicEvidenceCopy(locale);
  return c[state];
}

export function publicEvidenceStateClass(state: PublicLensEvidenceLaneState) {
  if (state === "confirmed") return "border-emerald-900/[0.16] bg-emerald-900/[0.035] text-emerald-950/[0.68]";
  if (state === "limited") return "border-amber-900/[0.16] bg-amber-900/[0.035] text-amber-950/[0.68]";
  if (state === "locked") return "border-black/[0.08] bg-black/[0.025] text-black/[0.46]";
  return "border-rose-900/[0.16] bg-rose-900/[0.035] text-rose-950/[0.68]";
}

export function buildPublicLensEvidenceRows(report: LensReport, locale: Pass4415LensLocale) {
  const c = publicEvidenceCopy(locale);
  const depth = report.selectedDepth;
  const confirmedSources = report.sources.filter((source: LensReport["sources"][number]) => source.evidenceState === "confirmed").length;
  const sourceCount = report.sources.length;
  const missingCount = Math.max(report.missingData.length, report.pass608?.entries?.length ?? 0);
  // Legacy cap-shaped fields are completeness/evidence heuristics. They may bound
  // customer wording, but they are not calibrated confidence or probability.
  const evidenceCoverageCap = Math.min(
    report.sourceCoverage,
    report.pass477.evidenceCoverageCeiling,
    report.pass607.evidenceCoverageCap,
  );
  const rows: PublicLensEvidenceLane[] = [
    {
      id: "primary-source",
      label: c.primary,
      state: confirmedSources > 0 ? "confirmed" : sourceCount > 0 ? "limited" : "missing",
      value: sourceCount > 0 ? `${sourceCount} row(s), ${confirmedSources} confirmed` : "source missing",
      depth: ["basic", "pro", "advanced"],
    },
    {
      id: "evidence-coverage-cap",
      label: c.confidence,
      state: evidenceCoverageCap >= 70 ? "confirmed" : evidenceCoverageCap >= 42 ? "limited" : "missing",
      value: `${evidenceCoverageCap}% · evidence ceiling; not calibrated confidence`,
      depth: ["basic", "pro", "advanced"],
    },
    {
      id: "gap-appendix",
      label: c.gaps,
      state: missingCount > 0 ? "limited" : "confirmed",
      value: missingCount > 0 ? `${missingCount} visible gap(s)` : "no priority gap attached",
      depth: ["basic", "pro", "advanced"],
    },
    {
      id: "second-source",
      label: c.second,
      state: sourceCount >= 2 ? "confirmed" : "missing",
      value: sourceCount >= 2 ? "second source attached" : "not confirmed",
      depth: ["pro", "advanced"],
    },
    {
      id: "claim-gate",
      label: c.claimGate,
      // PASS4147 claim source gate state contract: pass607 states are complete/review/blocked, never release.
      state: report.pass607.state === "complete" ? "confirmed" : "limited",
      value: "no claim above source lane",
      depth: ["pro", "advanced"],
    },
    {
      id: "orderbook",
      label: c.orderbook,
      state: "locked",
      value: "required before strong liquidity claims",
      depth: ["advanced"],
    },
    {
      id: "holders",
      label: c.holders,
      state: "locked",
      value: "holder/supply source required",
      depth: ["advanced"],
    },
    {
      id: "contract",
      label: c.contract,
      state: "locked",
      value: "contract/admin source required",
      depth: ["advanced"],
    },
  ];
  const visible = rows.filter((row) => row.depth.includes(depth));
  const nextGap = visible.find((row) => row.state !== "confirmed");
  return { rows: visible, nextGap: nextGap?.label ?? "—", copy: c };
}

export function lensToneClass(tone: VelmereSearchResult["tone"]) {
  if (tone === "calm") {
    return "border-emerald-300/[0.18] bg-[radial-gradient(circle_at_0%_0%,rgba(52,211,153,0.08),transparent_34%),rgba(255,255,255,0.03)]";
  }
  if (tone === "review") {
    return "border-amber-300/[0.18] bg-[radial-gradient(circle_at_0%_0%,rgba(251,191,36,0.08),transparent_34%),rgba(255,255,255,0.03)]";
  }
  if (tone === "elevated") {
    return "border-rose-300/[0.18] bg-[radial-gradient(circle_at_0%_0%,rgba(251,113,133,0.08),transparent_34%),rgba(255,255,255,0.03)]";
  }
  return "border-white/[0.09] bg-white/[0.025]";
}
