import type { Pass607ClaimSourceCompletenessGate } from "./claim-source-completeness-gate";

export type Pass608Locale = "pl" | "de" | "en";
export type Pass608MissingSourceAppendix = {
  version: "missing-source-appendix";
  state: "clear" | "action_required";
  title: string;
  summary: string;
  entries: Array<{
    id: `M${string}`;
    label: string;
    reason: string;
    impact: "high" | "medium" | "low";
    evidencePenalty: number;
    /** @deprecated Compatibility alias for evidencePenalty; not calibrated confidence. */
    confidencePenalty: number;
    nextCheck: string;
    linkedClaimIds: Array<`C${string}`>;
  }>;
  totalEvidencePenalty: number;
  /** @deprecated Compatibility alias for totalEvidencePenalty; not calibrated confidence. */
  totalConfidencePenalty: number;
  boundary: string;
};

function localeOf(locale: string): Pass608Locale {
  return locale === "de" || locale === "en" ? locale : "pl";
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 220);
}

function copy(locale: Pass608Locale) {
  if (locale === "de") {
    return {
      title: "Anhang: fehlende Quellen",
      clear: "Für die aktuelle Berichtstiefe wurde keine prioritäre Quellenlücke erkannt.",
      summary: (count: number) => `${count} konkrete Evidenzlücken begrenzen die Aussagekraft des Berichts.`,
      reason: "Die Evidenz ist nicht vollständig mit Quelle, Zeitstempel und Aktualität verbunden.",
      action: (value: string) => actionFor(value, "de"),
      boundary: "Der Anhang erfindet keine Werte. Jede Lücke zeigt nur Auswirkung und nächsten prüfbaren Schritt.",
    };
  }
  if (locale === "en") {
    return {
      title: "Missing-source appendix",
      clear: "No priority source gap was detected for the selected report depth.",
      summary: (count: number) => `${count} concrete evidence gaps limit the strength of the report.`,
      reason: "The evidence is not fully linked to a source, timestamp and usable freshness state.",
      action: (value: string) => actionFor(value, "en"),
      boundary: "The appendix does not invent values. Every gap exposes only its impact and one verifiable next check.",
    };
  }
  return {
    title: "Aneks brakujących źródeł",
    clear: "Dla wybranego zakresu raportu nie wykryto priorytetowej luki źródłowej.",
    summary: (count: number) => `${count} konkretnych luk dowodowych ogranicza siłę raportu.`,
    reason: "Dowód nie jest w pełni połączony ze źródłem, timestampem i użytecznym stanem świeżości.",
    action: (value: string) => actionFor(value, "pl"),
    boundary: "Aneks nie wymyśla wartości. Każda luka pokazuje tylko wpływ i jeden sprawdzalny następny krok.",
  };
}

function actionFor(value: string, locale: Pass608Locale) {
  const normalized = value.toLowerCase();
  const lane = /timestamp|fresh|czas|aktual|stale/.test(normalized)
    ? "timestamp"
    : /second|provider|source|źród|quelle/.test(normalized)
      ? "second_source"
      : /orderbook|depth|liquid|slippage|płynn|tiefe/.test(normalized)
        ? "liquidity"
        : /holder|unlock|supply|concentration|koncentr|halter/.test(normalized)
          ? "ownership"
          : /filing|reserve|fundamental|sec|rezerw|bericht/.test(normalized)
            ? "filing"
            : "generic";
  const messages = {
    pl: {
      timestamp: "Pobierz nowy snapshot providera i zapisz jego dokładny czas obserwacji.",
      second_source: "Dołącz niezależne drugie źródło i porównaj wartość oraz timestamp.",
      liquidity: "Zmierz depth, płynność i poślizg na wskazanym venue dla tej samej chwili.",
      ownership: "Dołącz aktualny snapshot podaży, holderów albo unlocków z datą obserwacji.",
      filing: "Dołącz najnowszy filing lub ujawnienie rezerw i zapisz okres raportowy.",
      generic: "Dołącz konkretne źródło z timestampem i ponownie przelicz limit pokrycia dowodów.",
    },
    de: {
      timestamp: "Neuen Provider-Snapshot abrufen und den genauen Beobachtungszeitpunkt speichern.",
      second_source: "Eine unabhängige Zweitquelle anbinden und Wert sowie Zeitstempel vergleichen.",
      liquidity: "Depth, Liquidität und Slippage am selben Venue-Zeitpunkt messen.",
      ownership: "Aktuellen Supply-, Holder- oder Unlock-Snapshot mit Beobachtungsdatum anbinden.",
      filing: "Neuestes Filing oder Reserven-Offenlegung mit Berichtsperiode anbinden.",
      generic: "Konkrete Quelle mit Zeitstempel anbinden und die Evidenzabdeckungsgrenze neu berechnen.",
    },
    en: {
      timestamp: "Fetch a new provider snapshot and store its exact observation time.",
      second_source: "Attach an independent second source and compare both value and timestamp.",
      liquidity: "Measure depth, liquidity and slippage on the same venue at the same observation time.",
      ownership: "Attach a current supply, holder or unlock snapshot with an observation date.",
      filing: "Attach the latest filing or reserve disclosure and store its reporting period.",
      generic: "Attach a concrete source with a timestamp and recompute the evidence-coverage cap.",
    },
  } as const;
  return messages[locale][lane];
}

function stableKey(value: string) {
  return clean(value).toLowerCase().replace(/[^a-z0-9ąćęłńóśźżäöüß]+/gi, " ").trim();
}

export function buildPass608MissingSourceAppendix(input: {
  locale: string;
  depth: "basic" | "pro" | "advanced";
  missingData: readonly string[];
  claimGate: Pass607ClaimSourceCompletenessGate;
}): Pass608MissingSourceAppendix {
  const locale = localeOf(input.locale);
  const c = copy(locale);
  const candidates = [
    ...input.missingData.map((label) => ({ label, claimIds: [] as Array<`C${string}`>, blockers: [] as string[] })),
    ...input.claimGate.claims
      .filter((claim) => claim.state === "blocked" || claim.state === "bounded")
      .map((claim) => ({
        label: `${claim.label}: ${claim.value}`,
        claimIds: [claim.claimId],
        blockers: claim.blockers,
      })),
  ];
  const seen = new Set<string>();
  const limit = input.depth === "advanced" ? 8 : input.depth === "pro" ? 6 : 4;
  const entries = candidates
    .filter((candidate) => {
      const key = stableKey(candidate.label);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map((candidate, index) => {
      const high = candidate.claimIds.length > 0 || /source|timestamp|fresh|źród|quelle/i.test(candidate.label);
      const impact: "high" | "medium" = high ? "high" : "medium";
      return {
        id: `M${String(index + 1).padStart(2, "0")}` as const,
        label: clean(candidate.label),
        reason: candidate.blockers.length ? candidate.blockers.join(" · ") : c.reason,
        impact,
        evidencePenalty: impact === "high" ? 14 : 8,
        confidencePenalty: impact === "high" ? 14 : 8,
        nextCheck: c.action(candidate.label),
        linkedClaimIds: candidate.claimIds,
      };
    });
  const totalEvidencePenalty = Math.min(
    60,
    entries.reduce((total, entry) => total + entry.evidencePenalty, 0),
  );
  return {
    version: "missing-source-appendix",
    state: entries.length ? "action_required" : "clear",
    title: c.title,
    summary: entries.length ? c.summary(entries.length) : c.clear,
    entries,
    totalEvidencePenalty,
    totalConfidencePenalty: totalEvidencePenalty,
    boundary: c.boundary,
  };
}
