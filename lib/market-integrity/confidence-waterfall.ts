import {
  sourceEvidenceCoverageScore,
  type VelmereMarketSnapshot,
  type VelmereSearchResult,
} from "@/lib/search/intelligence-search-contract";
import type { LensReportLocale } from "@/lib/search/lens-report-contract";
import { assessEvidenceTimestamp, independentLiveProviderFamilies } from "@/lib/ai/evidence-normalization";

export type Pass466WaterfallState =
  | "confirmed"
  | "review"
  | "source_required";

export type Pass466ConfidenceWaterfallStage = {
  id:
    | "identity"
    | "primary"
    | "second_source"
    | "freshness"
    | "fundamentals"
    | "final";
  label: string;
  cap: number;
  state: Pass466WaterfallState;
  detail: string;
};

export type Pass466ConfidenceWaterfall = {
  version: "confidence-waterfall";
  assetClass: string;
  product: "basic" | "pro" | "advanced";
  openingCoverage: number;
  finalCoverage: number;
  lostCoverage: number;
  /** @deprecated Compatibility aliases; these values are evidence coverage, not calibrated confidence. */
  openingConfidence: number;
  finalConfidence: number;
  lostConfidence: number;
  stages: Pass466ConfidenceWaterfallStage[];
  filingUrl: string | null;
  filingLabel: string | null;
  boundary: string;
};

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function copy(locale: LensReportLocale) {
  if (locale === "pl") {
    return {
      identity: "Tożsamość instrumentu",
      primary: "Główne źródło",
      second: "Drugie źródło",
      freshness: "Świeżość",
      fundamentals: "Fundamentals / filing",
      final: "Końcowy limit",
      identityOk: "Symbol i klasa aktywa są rozpoznane.",
      identityReview: "Klasa aktywa wymaga potwierdzenia.",
      primaryOk: "Provider zwrócił strukturalne dane.",
      primaryMissing: "Keyed provider lub dane rynkowe wymagane.",
      secondOk: "Drugie źródło jest dołączone i porównywalne.",
      secondReview: "Drugie źródło jest częściowe lub ma inną podstawę.",
      secondMissing: "Brak porównywalnego drugiego źródła.",
      fresh: "Timestamp mieści się w kontrakcie świeżości.",
      stale: "Timestamp jest stary albo nie został dołączony.",
      fundamentalOk: "Sprawozdania i SEC/XBRL są wystarczająco kompletne.",
      fundamentalReview: "Sprawozdania są częściowe, stare lub rozbieżne.",
      fundamentalMissing: "Fundamentals/filing nie dotyczą aktywa albo wymagają źródła.",
      finalText: "Najniższy potwierdzony limit steruje językiem Basic/Pro/Advanced.",
      boundary: "Waterfall pokazuje, gdzie maleje pokrycie dowodów. To nie jest skalibrowana pewność, prognoza ceny ani certyfikat bezpieczeństwa.",
    };
  }
  if (locale === "de") {
    return {
      identity: "Instrument-Identität",
      primary: "Primärquelle",
      second: "Zweitquelle",
      freshness: "Aktualität",
      fundamentals: "Fundamentals / Filing",
      final: "Finales Limit",
      identityOk: "Symbol und Assetklasse sind erkannt.",
      identityReview: "Die Assetklasse muss bestätigt werden.",
      primaryOk: "Der Provider lieferte strukturierte Daten.",
      primaryMissing: "Keyed Provider oder Marktdaten erforderlich.",
      secondOk: "Eine vergleichbare Zweitquelle ist verbunden.",
      secondReview: "Die Zweitquelle ist partiell oder nutzt eine andere Basis.",
      secondMissing: "Keine vergleichbare Zweitquelle vorhanden.",
      fresh: "Der Zeitstempel liegt innerhalb des Freshness-Vertrags.",
      stale: "Der Zeitstempel ist alt oder fehlt.",
      fundamentalOk: "Statements und SEC/XBRL sind ausreichend vollständig.",
      fundamentalReview: "Statements sind partiell, alt oder divergent.",
      fundamentalMissing: "Fundamentals/Filing sind nicht anwendbar oder benötigen eine Quelle.",
      finalText: "Das niedrigste bestätigte Limit steuert die Sprache von Basic/Pro/Advanced.",
      boundary: "Der Waterfall zeigt, wo die Evidenzabdeckung sinkt. Das ist keine kalibrierte Konfidenz, keine Preisprognose und kein Sicherheitszertifikat.",
    };
  }
  return {
    identity: "Instrument identity",
    primary: "Primary source",
    second: "Second source",
    freshness: "Freshness",
    fundamentals: "Fundamentals / filing",
    final: "Final cap",
    identityOk: "Symbol and asset class are resolved.",
    identityReview: "The asset class still needs confirmation.",
    primaryOk: "The provider returned structured data.",
    primaryMissing: "A keyed provider or market data is required.",
    secondOk: "A comparable second source is attached.",
    secondReview: "The second source is partial or uses a different basis.",
    secondMissing: "No comparable second source is attached.",
    fresh: "The timestamp is inside the freshness contract.",
    stale: "The timestamp is old or missing.",
    fundamentalOk: "Statements and SEC/XBRL are sufficiently complete.",
    fundamentalReview: "Statements are partial, stale or divergent.",
    fundamentalMissing: "Fundamentals/filing are not applicable or require a source.",
    finalText: "The lowest confirmed cap controls Basic/Pro/Advanced wording.",
    boundary: "The waterfall shows where evidence coverage falls. It is not calibrated confidence, a price forecast or a safety certificate.",
  };
}

function freshnessCap(snapshot: VelmereMarketSnapshot | undefined, nowMs?: number) {
  const slowAsset = snapshot?.assetClass === "stock" || snapshot?.assetClass === "etf" || snapshot?.assetClass === "real_estate";
  const timestamp = assessEvidenceTimestamp(snapshot?.observedAt, {
    nowMs,
    freshWithinMinutes: slowAsset ? 60 : 5,
    staleAfterMinutes: slowAsset ? 24 * 60 : 60,
  });
  if (timestamp.state === "fresh") return slowAsset ? 94 : 96;
  if (timestamp.state === "aging") return slowAsset ? 76 : 78;
  if (timestamp.state === "stale") return slowAsset ? 48 : 46;
  if (timestamp.state === "future") return 20;
  if (timestamp.state === "invalid") return 24;
  return 58;
}


export function buildPass466ConfidenceWaterfall(
  result: VelmereSearchResult,
  locale: LensReportLocale,
  product: "basic" | "pro" | "advanced" = "advanced",
  options: { nowMs?: number } = {},
): Pass466ConfidenceWaterfall {
  const c = copy(locale);
  const snapshot = result.marketSnapshot;
  // Legacy field names say "confidence", but this model is an evidence-coverage
  // ceiling only. It is not calibrated confidence or probability.
  const opening = 100;
  const sourceCoverage = result.sourceCoverage ?? sourceEvidenceCoverageScore(result);
  const identityResolved = Boolean(result.symbol && (snapshot?.assetClass || result.category));
  const identityCap = identityResolved ? 100 : 72;
  const providerFamilies = independentLiveProviderFamilies(result.sources);
  const primaryBound = providerFamilies.length >= 1 || snapshot?.providerState === "source_bound";
  const primaryCap = primaryBound ? Math.max(58, sourceCoverage) : Math.min(58, sourceCoverage);
  const usableSourceCount = providerFamilies.length;
  const secondState = snapshot?.venueComparisonState;
  const secondBound = usableSourceCount >= 2 || secondState === "aligned";
  const secondReview = secondState === "watch" || secondState === "divergent" || usableSourceCount === 1;
  const secondCap = secondBound
    ? finite(snapshot?.venueConfidenceCap) ?? 92
    : secondReview
      ? finite(snapshot?.venueConfidenceCap) ?? 70
      : 54;
  const freshCap = freshnessCap(snapshot, options.nowMs);
  const fundamentalApplies = snapshot?.assetClass === "stock" || snapshot?.assetClass === "etf" || snapshot?.assetClass === "real_estate";
  const fundamentalCap = fundamentalApplies
    ? Math.min(
        finite(snapshot?.fundamentalConfidenceCap) ?? 58,
        snapshot?.fundamentalSecState === "sec_aligned"
          ? 94
          : snapshot?.fundamentalSecState === "sec_partial"
            ? 72
            : snapshot?.fundamentalSecState === "sec_divergent"
              ? 46
              : 58,
      )
    : 100;
  const finalCoverage = Math.min(
    opening,
    identityCap,
    primaryCap,
    secondCap,
    freshCap,
    fundamentalCap,
    sourceCoverage,
  );
  const stages: Pass466ConfidenceWaterfallStage[] = [
    {
      id: "identity",
      label: c.identity,
      cap: identityCap,
      state: identityResolved ? "confirmed" : "review",
      detail: identityResolved ? c.identityOk : c.identityReview,
    },
    {
      id: "primary",
      label: c.primary,
      cap: primaryCap,
      state: primaryBound ? "confirmed" : "source_required",
      detail: primaryBound ? c.primaryOk : c.primaryMissing,
    },
    {
      id: "second_source",
      label: c.second,
      cap: secondCap,
      state: secondBound ? "confirmed" : secondReview ? "review" : "source_required",
      detail: secondBound ? c.secondOk : secondReview ? c.secondReview : c.secondMissing,
    },
    {
      id: "freshness",
      label: c.freshness,
      cap: freshCap,
      state: freshCap >= 80 ? "confirmed" : freshCap >= 58 ? "review" : "source_required",
      detail: freshCap >= 80 ? c.fresh : c.stale,
    },
    {
      id: "fundamentals",
      label: c.fundamentals,
      cap: fundamentalCap,
      state: !fundamentalApplies
        ? "confirmed"
        : fundamentalCap >= 80
          ? "confirmed"
          : fundamentalCap >= 58
            ? "review"
            : "source_required",
      detail: !fundamentalApplies
        ? c.fundamentalMissing
        : fundamentalCap >= 80
          ? c.fundamentalOk
          : fundamentalCap >= 58
            ? c.fundamentalReview
            : c.fundamentalMissing,
    },
    {
      id: "final",
      label: c.final,
      cap: finalCoverage,
      state: finalCoverage >= 76 ? "confirmed" : finalCoverage >= 52 ? "review" : "source_required",
      detail: c.finalText,
    },
  ];
  const filingUrl = snapshot?.fundamentalFilingUrl || null;
  const filingLabel = filingUrl
    ? [snapshot?.fundamentalFilingForm, snapshot?.fundamentalFilingDate]
        .filter(Boolean)
        .join(" · ") || "SEC filing"
    : null;
  return {
    version: "confidence-waterfall",
    assetClass: snapshot?.assetClass || result.category,
    product,
    openingCoverage: opening,
    finalCoverage,
    lostCoverage: opening - finalCoverage,
    openingConfidence: opening,
    finalConfidence: finalCoverage,
    lostConfidence: opening - finalCoverage,
    stages,
    filingUrl,
    filingLabel,
    boundary: c.boundary,
  };
}

export const pass466ConfidenceWaterfallContract = {
  id: "PASS466_CONFIDENCE_WATERFALL",
  rules: [
    "Every cap is monotonic: a missing source can lower evidence coverage but can never increase it.",
    "The lowest confirmed evidence ceiling controls wording in Browser, PDF and Shield AI; it is not calibrated confidence.",
    "SEC filing links are evidence links and open outside the modal; they are never rendered as promotional calls to action.",
    "Basic, Pro and Advanced can expose different detail density, but they share the same final evidence boundary.",
  ],
} as const;
