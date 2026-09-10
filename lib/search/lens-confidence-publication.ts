export type LensPublicConfidenceLocale = "pl" | "de" | "en";

export type LensPublicConfidenceAuthority = {
  sourceConfidenceCalibrated: boolean;
  sourceCoverage: number;
};

function finitePercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function localized(
  locale: LensPublicConfidenceLocale,
  pl: string,
  de: string,
  en: string,
) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

/**
 * The only numeric customer-facing confidence authority in Lens is an explicitly
 * calibrated source-confidence value. Evidence coverage/caps and legacy
 * confidence-shaped fields never self-authorize publication as confidence.
 */
export function lensPublicCalibratedConfidencePercent(
  authority: LensPublicConfidenceAuthority,
  value: unknown,
): number | null {
  if (authority.sourceConfidenceCalibrated !== true) return null;
  return finitePercent(value);
}

export function lensPublicCalibratedConfidenceDisplay(
  locale: LensPublicConfidenceLocale,
  authority: LensPublicConfidenceAuthority,
  value: unknown,
): string {
  const percent = lensPublicCalibratedConfidencePercent(authority, value);
  if (percent !== null) return `${percent}%`;
  return localized(locale, "niedostępna", "nicht verfügbar", "unavailable");
}

export function lensPublicEvidenceCoveragePercent(
  authority: LensPublicConfidenceAuthority,
): number {
  return finitePercent(authority.sourceCoverage) ?? 0;
}

export function lensPublicEvidenceWaterfallTitle(
  locale: LensPublicConfidenceLocale,
): string {
  return localized(
    locale,
    "Waterfall pokrycia dowodów",
    "Evidenzabdeckungs-Wasserfall",
    "Evidence-coverage waterfall",
  );
}

export function lensPublicEvidenceLimitsTitle(
  locale: LensPublicConfidenceLocale,
): string {
  return localized(locale, "Granice dowodów", "Evidenzgrenzen", "Evidence limits");
}

export function lensPublicCalibrationBoundary(
  locale: LensPublicConfidenceLocale,
  authority: LensPublicConfidenceAuthority,
): string {
  const coverage = lensPublicEvidenceCoveragePercent(authority);
  if (authority.sourceConfidenceCalibrated === true) {
    return localized(
      locale,
      `Pokrycie danych: ${coverage}%. Skalibrowana pewność jest publikowana wyłącznie z jawnej warstwy kalibracji; wewnętrzne limity dowodów pozostają metrykami pokrycia.`,
      `Datenabdeckung: ${coverage}%. Kalibrierte Konfidenz wird nur aus einer expliziten Kalibrierungsschicht veröffentlicht; interne Evidenzgrenzen bleiben Abdeckungsmetriken.`,
      `Data coverage: ${coverage}%. Calibrated confidence is published only from an explicit calibration layer; internal evidence ceilings remain coverage metrics.`,
    );
  }
  return localized(
    locale,
    `Pokrycie danych: ${coverage}%. Skalibrowana pewność jest niedostępna; wewnętrzne limity dowodów nie są publikowane jako pewność.`,
    `Datenabdeckung: ${coverage}%. Kalibrierte Konfidenz ist nicht verfügbar; interne Evidenzgrenzen werden nicht als Konfidenz veröffentlicht.`,
    `Data coverage: ${coverage}%. Calibrated confidence is unavailable; internal evidence ceilings are not published as confidence.`,
  );
}

/** Backward-compatible heuristic fields can be shown only as evidence ceilings. */
export function lensPublicEvidenceCeilingPercent(value: unknown): number | null {
  return finitePercent(value);
}
