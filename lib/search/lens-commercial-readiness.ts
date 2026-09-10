import type { LensReport } from "@/lib/search/lens-report";
import type { LensPdfDepth } from "@/lib/search/lens-report-request-contract";
import {
  independentLiveProviderFamilies,
  independentProviderFamilies,
} from "@/lib/ai/evidence-normalization";

export function buildLensCommercialReadiness(report: LensReport, depth: LensPdfDepth) {
  const sourceCount = independentLiveProviderFamilies(report.sources).length;
  const confirmedSourceCount = independentLiveProviderFamilies(
    report.sources.filter((source) => source.evidenceState === "confirmed"),
  ).length;
  const confidence = Math.max(0, Math.min(100, Math.round(Math.min(
    report.sourceConfidence,
    report.pass477.confidenceCeiling,
    report.kernel.confidenceCap,
  ))));
  const requirements = {
    basic: { sources: 0, confirmed: 0, confidence: 0 },
    pro: { sources: 2, confirmed: 1, confidence: 45 },
    advanced: { sources: 3, confirmed: 2, confidence: 60 },
  } as const;
  const required = requirements[depth];
  const unifiedLedgerReady = report.pass646.state === "locked" &&
    report.pass646.duplicateSourceIds.length === 0 &&
    report.pass646.duplicateAtomIds.length === 0 &&
    report.pass646.orphanClaimIds.length === 0;
  const confirmedLedgerSources = independentProviderFamilies(
    report.pass646.sourceLedger
      .filter((source) => source.state === "confirmed")
      .map((source) => source.label),
  ).length;
  const sourceTruthReady = report.pass459.truthState === "source_bound" && report.pass460.state === "aligned";
  const evidenceThresholdMet = sourceCount >= required.sources &&
    confirmedSourceCount >= required.confirmed &&
    confidence >= required.confidence &&
    unifiedLedgerReady &&
    confirmedLedgerSources >= required.confirmed &&
    (depth === "basic" || sourceTruthReady);
  const sellReady = depth === "basic" ? false : evidenceThresholdMet;
  const blockedReasons = [
    sourceCount < required.sources ? `sources:${sourceCount}/${required.sources}` : null,
    confirmedSourceCount < required.confirmed ? `confirmed_sources:${confirmedSourceCount}/${required.confirmed}` : null,
    confidence < required.confidence ? `confidence:${confidence}/${required.confidence}` : null,
  ].filter((value): value is string => Boolean(value));
  const locale = report.locale;
  const customerMessage = depth === "basic"
    ? locale === "de"
      ? "Kostenloses Prescreening: kein verkaufsfertiges Gutachten und kein Sicherheitszertifikat."
      : locale === "pl"
        ? "Darmowy prescreening: to nie jest raport gotowy do sprzedaży ani certyfikat bezpieczeństwa."
        : "Free prescreening: this is not a sell-ready assessment or a security certificate."
    : sellReady
      ? locale === "de" ? "Die Quellenabdeckung reicht für diese Berichtsstufe aus." : locale === "pl" ? "Pokrycie źródeł wystarcza dla tego poziomu raportu." : "Source coverage is sufficient for this report tier."
      : locale === "de" ? "Dieser kostenpflichtige Bericht ist noch nicht verkaufsbereit. Bestätigte unabhängige Quellen fehlen." : locale === "pl" ? "Ten płatny raport nie jest jeszcze gotowy do sprzedaży. Brakuje potwierdzonych niezależnych źródeł." : "This paid report is not sell-ready yet. Confirmed independent sources are missing.";
  return {
    schemaVersion: "pass4640_lens_commercial_readiness_v2",
    depth,
    sellReady,
    evidenceThresholdMet,
    commercialStatus: depth === "basic" ? "free_prescreen" as const : sellReady ? "sell_ready" as const : "blocked" as const,
    checkoutAllowed: depth === "basic" || sellReady,
    sourceCount,
    confirmedSourceCount,
    confidence,
    unifiedLedgerReady,
    confirmedLedgerSources,
    sourceTruthReady,
    blockedReasons: [
      ...blockedReasons,
      !unifiedLedgerReady ? "unified_evidence_ledger_not_locked" : null,
      confirmedLedgerSources < required.confirmed ? `ledger_confirmed_sources:${confirmedLedgerSources}/${required.confirmed}` : null,
      depth !== "basic" && !sourceTruthReady ? "source_truth_not_bound_and_aligned" : null,
    ].filter((value): value is string => Boolean(value)),
    customerMessage,
  };
}
