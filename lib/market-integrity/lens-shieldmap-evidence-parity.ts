import { sha256Token } from "@/lib/security/cryptographic-digest";
export type Pass1234Locale = "pl" | "de" | "en";
export type Pass1234EvidenceNodeId =
  | "sources"
  | "facts"
  | "signals"
  | "conflicts"
  | "missing"
  | "confidence"
  | "verdict";

export type Pass1234EvidenceTone = "ready" | "review" | "blocked";

export type Pass1234EvidenceNode = {
  id: Pass1234EvidenceNodeId;
  group: string;
  label: string;
  value: string;
  body: string;
  tone: Pass1234EvidenceTone;
  weight: number;
};

export type Pass1234LensShieldMapEvidenceParity = {
  version: "lens-shieldmap-evidence-parity";
  locale: Pass1234Locale;
  role: "lens_pdf_and_shield_map_share_one_evidence_story";
  previewDownloadParity: "same_report_manifest_same_depth_same_checksum";
  shieldMapRole: "evidence_graph_not_price_table";
  browserRole: "pdf_reader_not_second_shield";
  noPriceTableDuplicate: true;
  noPdfDuplicate: true;
  finalStatus: "release_candidate" | "review" | "blocked";
  evidenceCoverageCap: number;
  /** @deprecated Compatibility alias for evidenceCoverageCap; not calibrated confidence. */
  confidenceCap: number;
  sourceCount: number;
  missingCount: number;
  conflictCount: number;
  claimCount: number;
  copy: {
    stripTitle: string;
    stripBody: string;
    readerParity: string;
    mapParity: string;
    nextCheck: string;
    boundary: string;
  };
  nodes: Pass1234EvidenceNode[];
  manifestKey: string;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveLocale(locale: string): Pass1234Locale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

function checksum(parts: Array<string | number | boolean | null | undefined>) {
  const input = parts.map((part) => String(part ?? "-")).join("|");
  return `p1234-${sha256Token(input, 24)}`;
}

const copyByLocale: Record<Pass1234Locale, Pass1234LensShieldMapEvidenceParity["copy"]> = {
  pl: {
    stripTitle: "Ten sam rdzeń dowodów",
    stripBody:
      "Browser czyta i eksportuje PDF. Shield Map pokazuje ścieżkę dowodów. Oba widoki używają jednego manifestu, głębokości i limitu pokrycia dowodów.",
    readerParity: "Reader/PDF 1:1",
    mapParity: "Mapa bez tabeli ceny",
    nextCheck: "Następne sprawdzenie",
    boundary:
      "Brak źródła, timestampu albo drugiego providera obniża pokrycie dowodów. Velmère nie dopisuje pewności ani rekomendacji.",
  },
  de: {
    stripTitle: "Ein gemeinsamer Evidenzkern",
    stripBody:
      "Browser liest und exportiert PDF. Shield Map zeigt den Belegpfad. Beide Flächen nutzen ein Manifest, eine Tiefe und eine Evidenzabdeckungsgrenze.",
    readerParity: "Reader/PDF 1:1",
    mapParity: "Karte ohne Preistabelle",
    nextCheck: "Nächster Check",
    boundary:
      "Fehlende Quelle, Zeitstempel oder Zweitprovider senken die Evidenzabdeckung. Velmère erfindet weder Konfidenz noch Empfehlung.",
  },
  en: {
    stripTitle: "One shared evidence core",
    stripBody:
      "Browser reads and exports the PDF. Shield Map shows the evidence path. Both surfaces use one manifest, one depth and one evidence-coverage cap.",
    readerParity: "Reader/PDF 1:1",
    mapParity: "Map without price table",
    nextCheck: "Next check",
    boundary:
      "Missing source, timestamp or second provider lowers evidence coverage. Velmère does not invent confidence or recommendations.",
  },
};

function nodeCopy(locale: Pass1234Locale) {
  if (locale === "pl") {
    return {
      sources: ["Sources", "Źródła", "Source ID, timestamp i drugi provider określają pokrycie dowodów raportu."],
      facts: ["Facts", "Fakty", "Fakty są krótkie: cena, płynność, wolumen, kontrakt, holderzy albo venue status."],
      signals: ["Signals", "Sygnały", "Sygnały grupują ryzyko, ale nie są komendą wejścia ani wyjścia."],
      conflicts: ["Conflicts", "Konflikty", "Rozjazdy między providerami, narracją i danymi trafiają do review, nie do marketingu."],
      missing: ["Missing Data", "Braki danych", "Braki danych są publiczną granicą pokrycia dowodów, nie ukrytym szczegółem technicznym."],
      confidence: ["Evidence", "Pokrycie dowodów", "To deterministyczny limit pokrycia dowodów, nie skalibrowana pewność ani obietnica wyniku."],
      verdict: ["VLM Verdict", "VLM verdict", "Werdykt VLM kończy ścieżkę i mówi, co sprawdzić dalej."],
    } as const;
  }
  if (locale === "de") {
    return {
      sources: ["Sources", "Quellen", "Source ID, Zeitstempel und Zweitprovider bestimmen die Evidenzabdeckungsgrenze."],
      facts: ["Facts", "Fakten", "Fakten bleiben kurz: Preis, Liquidität, Volumen, Contract, Holder oder Venue-Status."],
      signals: ["Signals", "Signale", "Signale ordnen Risiko, sind aber kein Entry- oder Exit-Befehl."],
      conflicts: ["Conflicts", "Konflikte", "Abweichungen zwischen Providern, Narrativ und Daten gehen ins Review, nicht ins Marketing."],
      missing: ["Missing Data", "Datenlücken", "Datenlücken sind eine sichtbare Evidenzabdeckungsgrenze, kein verstecktes Technikdetail."],
      confidence: ["Evidence", "Evidenzabdeckung", "Dies ist eine deterministische Evidenzabdeckungsgrenze, keine kalibrierte Konfidenz und kein Ergebnisversprechen."],
      verdict: ["VLM Verdict", "VLM Verdict", "Das VLM Verdict schließt den Pfad und zeigt den nächsten Check."],
    } as const;
  }
  return {
    sources: ["Sources", "Sources", "Source ID, timestamp and second provider determine the report's evidence coverage."],
    facts: ["Facts", "Facts", "Facts stay short: price, liquidity, volume, contract, holders or venue status."],
    signals: ["Signals", "Signals", "Signals organize risk, but they are not an entry or exit command."],
    conflicts: ["Conflicts", "Conflicts", "Provider, narrative and data divergence goes to review, not marketing copy."],
    missing: ["Missing Data", "Missing data", "Missing data is a visible evidence-coverage boundary, not a hidden technical detail."],
    confidence: ["Evidence", "Evidence coverage", "This is a deterministic evidence-coverage cap, not calibrated confidence or an outcome promise."],
    verdict: ["VLM Verdict", "VLM verdict", "The VLM verdict closes the path and states the next check."],
  } as const;
}

export function buildPass1234LensShieldMapEvidenceParity(input: {
  locale: string;
  sourceState?: string | null;
  evidenceCoverageCap?: number | null;
  /** @deprecated Compatibility input alias. */
  confidenceCap?: number | null;
  sourceCount?: number | null;
  missingCount?: number | null;
  conflictCount?: number | null;
  claimCount?: number | null;
  signalCount?: number | null;
  factSummary?: string | null;
  verdict?: string | null;
  nextCheck?: string | null;
  depth?: string | null;
  checksum?: string | null;
  manifestKey?: string | null;
}): Pass1234LensShieldMapEvidenceParity {
  const locale = resolveLocale(input.locale);
  const copy = copyByLocale[locale];
  const sourceCount = Math.max(0, Math.round(input.sourceCount ?? 0));
  const missingCount = Math.max(0, Math.round(input.missingCount ?? 0));
  const conflictCount = Math.max(0, Math.round(input.conflictCount ?? 0));
  const claimCount = Math.max(0, Math.round(input.claimCount ?? 0));
  const signalCount = Math.max(0, Math.round(input.signalCount ?? 0));
  const evidenceCoverageCap = clampPercent(input.evidenceCoverageCap ?? input.confidenceCap ?? 0);
  const confidenceCap = evidenceCoverageCap;
  const sourceState = input.sourceState || (sourceCount >= 2 ? "source_bound" : sourceCount === 1 ? "partial" : "source_required");
  const finalStatus =
    evidenceCoverageCap >= 70 && sourceCount >= 2 && missingCount === 0 && conflictCount === 0
      ? "release_candidate"
      : evidenceCoverageCap < 35 || sourceCount === 0
        ? "blocked"
        : "review";
  const labels = nodeCopy(locale);
  const manifestKey =
    input.manifestKey ||
    checksum([
      locale,
      sourceState,
      evidenceCoverageCap,
      sourceCount,
      missingCount,
      conflictCount,
      claimCount,
      signalCount,
      input.depth,
      input.checksum,
    ]);

  const nodes: Pass1234EvidenceNode[] = [
    {
      id: "sources",
      group: labels.sources[0],
      label: labels.sources[1],
      value: `${sourceState} · ${sourceCount}`,
      body: labels.sources[2],
      tone: sourceCount >= 2 ? "ready" : sourceCount === 1 ? "review" : "blocked",
      weight: sourceCount >= 2 ? 100 : sourceCount === 1 ? 58 : 24,
    },
    {
      id: "facts",
      group: labels.facts[0],
      label: labels.facts[1],
      value: input.factSummary?.slice(0, 48) || `${claimCount} claims`,
      body: labels.facts[2],
      tone: claimCount >= 4 ? "ready" : claimCount >= 1 ? "review" : "blocked",
      weight: Math.min(100, claimCount * 12),
    },
    {
      id: "signals",
      group: labels.signals[0],
      label: labels.signals[1],
      value: `${signalCount || Math.max(7, claimCount)} lanes`,
      body: labels.signals[2],
      tone: signalCount || claimCount ? "ready" : "review",
      weight: Math.min(100, Math.max(40, signalCount * 7 || claimCount * 6)),
    },
    {
      id: "conflicts",
      group: labels.conflicts[0],
      label: labels.conflicts[1],
      value: `${conflictCount} review`,
      body: labels.conflicts[2],
      tone: conflictCount > 2 ? "blocked" : conflictCount > 0 ? "review" : "ready",
      weight: Math.max(0, 100 - conflictCount * 22),
    },
    {
      id: "missing",
      group: labels.missing[0],
      label: labels.missing[1],
      value: `${missingCount}`,
      body: labels.missing[2],
      tone: missingCount > 2 ? "blocked" : missingCount > 0 ? "review" : "ready",
      weight: Math.max(0, 100 - missingCount * 18),
    },
    {
      id: "confidence",
      group: labels.confidence[0],
      label: labels.confidence[1],
      value: `${evidenceCoverageCap}/100`,
      body: labels.confidence[2],
      tone: evidenceCoverageCap >= 70 ? "ready" : evidenceCoverageCap >= 45 ? "review" : "blocked",
      weight: evidenceCoverageCap,
    },
    {
      id: "verdict",
      group: labels.verdict[0],
      label: labels.verdict[1],
      value: input.verdict?.slice(0, 72) || finalStatus.replaceAll("_", " "),
      body: input.nextCheck || labels.verdict[2],
      tone: finalStatus === "release_candidate" ? "ready" : finalStatus === "review" ? "review" : "blocked",
      weight: finalStatus === "release_candidate" ? 88 : finalStatus === "review" ? 58 : 28,
    },
  ];

  return {
    version: "lens-shieldmap-evidence-parity",
    locale,
    role: "lens_pdf_and_shield_map_share_one_evidence_story",
    previewDownloadParity: "same_report_manifest_same_depth_same_checksum",
    shieldMapRole: "evidence_graph_not_price_table",
    browserRole: "pdf_reader_not_second_shield",
    noPriceTableDuplicate: true,
    noPdfDuplicate: true,
    finalStatus,
    evidenceCoverageCap,
    confidenceCap,
    sourceCount,
    missingCount,
    conflictCount,
    claimCount,
    copy,
    nodes,
    manifestKey,
  };
}
