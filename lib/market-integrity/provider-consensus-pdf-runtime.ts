import type { VelmereSearchResult } from "@/lib/search/intelligence-search-contract";
import {
  assessEvidenceTimestamp,
  independentLiveProviderFamilies,
  independentProviderFamilies,
} from "@/lib/ai/evidence-normalization";

export type Pass460LensConsensus = {
  version: "pass460-lens-consensus";
  state: "aligned" | "watch" | "divergent" | "single_source" | "stale" | "unavailable";
  confidenceCap: number;
  sourceCount: number;
  liveSourceCount: number;
  freshnessRisk: boolean;
  secondSourceRequired: boolean;
  headline: string;
  explanation: string;
  operatorAction: string;
};

type Locale = "pl" | "de" | "en";

function localeOf(value: string): Locale {
  return value === "de" || value === "en" ? value : "pl";
}

export function buildPass460LensConsensus(
  result: VelmereSearchResult,
  requestedLocale: string,
  options: { nowMs?: number } = {},
): Pass460LensConsensus {
  const locale = localeOf(requestedLocale);
  const active = result.sources.filter((source) => source.mode !== "missing");
  const activeFamilies = independentProviderFamilies(active.map((source) => source.label));
  const liveFamilies = independentProviderFamilies([
    ...independentLiveProviderFamilies(result.sources),
    result.marketSnapshot?.venuePrimary,
    result.marketSnapshot?.venueSecondary,
  ]);
  const timestamp = assessEvidenceTimestamp(result.marketSnapshot?.observedAt, { nowMs: options.nowMs });
  const freshnessRisk = active.some((source) =>
    /stale|expired|old|aging|delayed|opóź|veraltet/i.test(source.freshness),
  ) || timestamp.state === "stale" || timestamp.state === "future" || timestamp.state === "invalid" || (liveFamilies.length > 0 && timestamp.state === "missing");
  const snapshot = result.marketSnapshot;
  const venueState = snapshot?.venueComparisonState;
  const quoteBasisState = snapshot?.venueQuoteBasisState;
  const quoteBasisLabel = snapshot?.venuePrimaryQuoteCurrency && snapshot?.venueSecondaryQuoteCurrency
    ? `${snapshot.venuePrimaryQuoteCurrency}/${snapshot.venueSecondaryQuoteCurrency}`
    : "quote basis";
  const state: Pass460LensConsensus["state"] = freshnessRisk || venueState === "stale"
    ? "stale"
    : venueState === "divergent"
      ? "divergent"
      : venueState === "watch"
        ? "watch"
        : liveFamilies.length >= 2 && (venueState === "aligned" || result.sourceConfidence >= 68)
          ? "aligned"
          : liveFamilies.length === 1 || activeFamilies.length === 1
            ? "single_source"
            : "unavailable";
  const cap =
    state === "aligned"
      ? 90
      : state === "watch"
        ? 70
        : state === "divergent"
          ? 44
          : state === "single_source"
            ? 64
            : state === "stale"
              ? 40
              : 20;
  const venueEvidenceCap = typeof snapshot?.venueConfidenceCap === "number"
    ? snapshot.venueConfidenceCap
    : 100;
  const fundamentalEvidenceCap = typeof snapshot?.fundamentalConfidenceCap === "number"
    ? snapshot.fundamentalConfidenceCap
    : 100;
  const confidenceCap = Math.min(
    cap,
    Math.max(0, Math.round(result.sourceConfidence)),
    Math.max(0, Math.round(venueEvidenceCap)),
    Math.max(0, Math.round(fundamentalEvidenceCap)),
  );
  const secondSourceRequired =
    liveFamilies.length < 2 ||
    !snapshot?.venueSecondary ||
    venueState === "single_source" ||
    venueState === "unavailable";

  const copy = {
    pl: {
      aligned: [
        "Źródła zgodne",
        "Co najmniej dwa aktywne źródła wspierają ten sam zakres faktów.",
        "Zachowaj timestamp i ponów porównanie przed publikacją mocniejszego wniosku.",
      ],
      watch: [
        "Źródła wymagają obserwacji",
        "Dwa venue są dostępne, ale spread, świeżość lub cena nie są jeszcze idealnie zbieżne.",
        "Zachowaj ostrożny język i ponów probe przed publikacją.",
      ],
      divergent: [
        "Rozjazd między venue",
        "Cena, ruch 24h lub kondycja źródeł przekroczyły próg zgodności.",
        `Zablokuj mocniejszy wniosek i sprawdź parę, bazę ${quoteBasisLabel}, stan ${quoteBasisState || "wymaga źródła"} oraz timestampy.`,
      ],
      single_source: [
        "Tylko jedno źródło",
        "Raport może pokazać fakty, ale mocniejsze wnioski mają aktywny limit pewności.",
        "Podłącz drugi niezależny provider i porównaj cenę oraz świeżość.",
      ],
      stale: [
        "Dane wymagają odświeżenia",
        "Co najmniej jedno źródło ma stary lub opóźniony znacznik świeżości.",
        "Odśwież payload i zablokuj publikację do czasu nowego timestampu.",
      ],
      unavailable: [
        "Brak konsensusu",
        "Nie ma wystarczającego payloadu do porównania providerów.",
        "Podłącz źródło główne i drugie źródło przed analizą Pro/Advanced.",
      ],
    },
    de: {
      aligned: [
        "Quellen abgestimmt",
        "Mindestens zwei aktive Quellen stützen denselben Faktenbereich.",
        "Zeitstempel sichern und vor stärkerer Veröffentlichung erneut vergleichen.",
      ],
      watch: [
        "Quellen beobachten",
        "Zwei Handelsplätze sind verfügbar, aber Spread, Aktualität oder Preis stimmen noch nicht vollständig überein.",
        "Vorsichtige Sprache beibehalten und den Probe vor Veröffentlichung wiederholen.",
      ],
      divergent: [
        "Abweichung zwischen Handelsplätzen",
        "Preis, 24h-Bewegung oder Quellenzustand überschreiten die Konsensschwelle.",
        `Stärkere Aussagen sperren und Paar, ${quoteBasisLabel}-Basis, Status ${quoteBasisState || "Quelle erforderlich"} sowie Zeitstempel prüfen.`,
      ],
      single_source: [
        "Nur eine Quelle",
        "Fakten sind sichtbar, stärkere Aussagen bleiben jedoch begrenzt.",
        "Einen unabhängigen Zweitprovider anbinden und Preis sowie Aktualität vergleichen.",
      ],
      stale: [
        "Daten müssen aktualisiert werden",
        "Mindestens eine Quelle zeigt einen alten oder verzögerten Frischezustand.",
        "Payload aktualisieren und Veröffentlichung bis zum neuen Zeitstempel sperren.",
      ],
      unavailable: [
        "Kein Konsens",
        "Für einen Providervergleich fehlt ein ausreichender Payload.",
        "Primär- und Zweitquelle vor Pro/Advanced anbinden.",
      ],
    },
    en: {
      aligned: [
        "Sources aligned",
        "At least two active sources support the same factual scope.",
        "Preserve the timestamp and repeat the comparison before stronger publication.",
      ],
      watch: [
        "Sources need monitoring",
        "Two venues are available, but spread, freshness or price are not yet tightly aligned.",
        "Keep wording guarded and repeat the probe before publication.",
      ],
      divergent: [
        "Cross-venue divergence",
        "Price, 24h move or source health exceeded the alignment threshold.",
        `Block stronger wording and verify the pair, ${quoteBasisLabel} basis, ${quoteBasisState || "source required"} state and timestamps.`,
      ],
      single_source: [
        "Single source only",
        "Facts may be shown, but stronger conclusions remain confidence-capped.",
        "Attach an independent second provider and compare price plus freshness.",
      ],
      stale: [
        "Data needs refresh",
        "At least one source carries a stale or delayed freshness marker.",
        "Refresh the payload and block publication until a new timestamp is attached.",
      ],
      unavailable: [
        "No consensus",
        "There is not enough provider payload for comparison.",
        "Attach primary and secondary sources before Pro/Advanced analysis.",
      ],
    },
  } as const;
  const selected = copy[locale][state];

  return {
    version: "pass460-lens-consensus",
    state,
    confidenceCap,
    sourceCount: activeFamilies.length,
    liveSourceCount: liveFamilies.length,
    freshnessRisk,
    secondSourceRequired,
    headline: selected[0],
    explanation: selected[1],
    operatorAction: selected[2],
  };
}

export const pass460LensConsensusContract = {
  id: "PASS460_LENS_CONSENSUS",
  rules: [
    "PDF never upgrades a single provider into multi-source confidence.",
    "Stale freshness markers lower the confidence cap and block stronger publication.",
    "Preview and download receive the same consensus state and operator action.",
    "PASS463 canonical pair coverage and quote-basis penalties can only lower, never raise, the PDF confidence cap.",
    "PASS464 filing/statement/holdings quality can only lower, never raise, the PDF confidence cap.",
  ],
};
