import type { VelmereMarketSnapshot, VelmereSearchResult, VelmereSearchSourceMode } from "@/lib/search/intelligence-search-contract";
import {
  assessEvidenceTimestamp,
  independentLiveProviderSources,
  normalizeProviderFamily,
} from "@/lib/ai/evidence-normalization";
import {
  createVlmKernelEvidenceItem,
  runVlmBrainKernel,
  vlmKernelSourceFamily,
  type VlmBrainKernelDepth,
  type VlmBrainKernelEvidenceIndependence,
  type VlmBrainKernelFinding,
  type VlmBrainKernelFreshnessProfile,
  type VlmBrainKernelLocale,
  type VlmBrainKernelOutput,
  type VlmBrainKernelSeverity,
} from "./vlm-brain-kernel";

export type VlmLensKernelInput = {
  result: VelmereSearchResult;
  locale?: VlmBrainKernelLocale;
  depth?: VlmBrainKernelDepth;
  generatedAt?: string;
  checksum?: string;
  selectedDepth?: VlmBrainKernelDepth;
  reportSectionCount?: number;
  pdfPageCount?: number;
  claimCount?: number;
  confirmedClaimCount?: number;
  missingSourceCount?: number;
  sourceRegistryCount?: number;
  contradictionCount?: number;
  freshnessState?: string;
  parityManifest?: string;
  evidenceManifest?: string;
  visualQaState?: string;
  premiumState?: string;
};

export type VlmLensKernelPayload = {
  subject: {
    id: string;
    title: string;
    symbol: string;
    category: VelmereSearchResult["category"];
  };
  report: {
    depth: VlmBrainKernelDepth;
    checksum?: string;
    sectionCount: number;
    pdfPageCount: number;
    parityManifest?: string;
    evidenceManifest?: string;
  };
  evidenceReadiness: {
    sourceMode: VelmereSearchSourceMode;
    sourceCount: number;
    sourceConfidence: number;
    missingDataCount: number;
    claimCount: number;
    confirmedClaimCount: number;
    contradictionCount: number;
    sourceRegistryCount: number;
  };
  marketSnapshot: {
    price: number | null;
    change24h: number | null;
    volume24h: number | null;
    marketCap: number | null;
    observedAt: string | null;
  };
  truthBoundary: {
    canExportPdf: boolean;
    canPreviewReader: boolean;
    confidenceCapReason: string;
  };
};

function hasNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function lensPrimitive(value: unknown, fallback = "missing"): string | number | boolean | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value === null) return null;
  return fallback;
}

function lensString(value: unknown, fallback = "missing"): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function clampPercent(value: unknown, fallback = 0): number {
  return hasNumber(value) ? Math.max(0, Math.min(100, Math.round(value))) : fallback;
}

function normalizeLocale(locale?: VlmBrainKernelLocale): VlmBrainKernelLocale {
  return locale === "de" || locale === "en" ? locale : "pl";
}

function normalizeDepth(depth?: VlmBrainKernelDepth): VlmBrainKernelDepth {
  return depth === "basic" || depth === "pro" || depth === "advanced" ? depth : "basic";
}

function sourceQuality(mode: VelmereSearchSourceMode, sourceCount: number) {
  if (mode === "live" || mode === "live_table") {
    if (sourceCount <= 0) {
      return { quality: "missing" as const, freshness: "unknown" as const, confidence: 0 };
    }
    return {
      quality: sourceCount >= 2 ? ("strong" as const) : ("medium" as const),
      freshness: "fresh" as const,
      confidence: sourceCount >= 2 ? 86 : 68,
    };
  }
  if (mode === "table") {
    return { quality: "weak" as const, freshness: "aging" as const, confidence: 42 };
  }
  if (mode === "fallback") {
    return { quality: "weak" as const, freshness: "unknown" as const, confidence: 28 };
  }
  return { quality: "missing" as const, freshness: "unknown" as const, confidence: 0 };
}

function marketSnapshotState(snapshot: VelmereMarketSnapshot | undefined) {
  const fields = [snapshot?.price, snapshot?.change24h, snapshot?.volume24h, snapshot?.marketCap].filter(hasNumber).length;
  if (fields >= 3) return { quality: "strong" as const, confidence: 78 };
  if (fields >= 1) return { quality: "medium" as const, confidence: 56 };
  return { quality: "missing" as const, confidence: 0 };
}

function lensSourceMetadata(source: VelmereSearchResult["sources"][number]): {
  providerFamily: string;
  independence: VlmBrainKernelEvidenceIndependence;
} {
  const fingerprint = `${source.id} ${source.label} ${source.note}`.toLowerCase();
  if (/operator|manual|reviewer/.test(fingerprint)) {
    return { providerFamily: "operator-lens-intake", independence: "operator" };
  }
  if (/yahoo/.test(fingerprint)) return { providerFamily: "yahoo-finance", independence: "independent" };
  if (/stooq/.test(fingerprint)) return { providerFamily: "stooq", independence: "independent" };
  if (/coin\s*gecko|coingecko/.test(fingerprint)) return { providerFamily: "coingecko", independence: "independent" };
  if (/coin\s*market\s*cap|coinmarketcap/.test(fingerprint)) return { providerFamily: "coinmarketcap", independence: "independent" };
  if (/binance/.test(fingerprint)) return { providerFamily: "binance", independence: "independent" };
  if (/finnhub/.test(fingerprint)) return { providerFamily: "finnhub", independence: "independent" };
  if (/polygon/.test(fingerprint)) return { providerFamily: "polygon", independence: "independent" };
  if (/alpha\s*vantage/.test(fingerprint)) return { providerFamily: "alphavantage", independence: "independent" };
  if (/velm[eè]re|vlm|local|source ledger|cross-asset shield|internal page/.test(fingerprint)) {
    return { providerFamily: "vlm-lens-source-registry", independence: "derived" };
  }
  return { providerFamily: vlmKernelSourceFamily(source.label || source.id), independence: "unknown" };
}


function lensFreshnessProfile(
  result: VelmereSearchResult,
  providerFamily?: string,
): VlmBrainKernelFreshnessProfile {
  const family = String(providerFamily ?? "").toLowerCase();
  if (/printful|tapstitch/.test(family)) return "product_import";
  if (/github|semgrep|audit/.test(family)) return "audit_evidence";
  if (/defillama|dexscreener|etherscan|alchemy|quicknode/.test(family)) return "onchain";
  if (/binance|coingecko|coinmarketcap|mexc/.test(family)) return "crypto_market";
  const assetClass = result.marketSnapshot?.assetClass;
  if (result.category === "contract") return "onchain";
  if (result.category === "token" || assetClass === "crypto") return "crypto_market";
  if (assetClass === "fx") return "fx_market";
  if (assetClass === "commodity") return "commodity_market";
  if (["stock", "etf", "index", "real_estate", "exchange_equity"].includes(String(assetClass))) return "equity_market";
  return "document";
}

function lensSourceFreshness(source: VelmereSearchResult["sources"][number]) {
  if (source.mode === "live" || source.mode === "live_table") return "fresh" as const;
  if (source.mode === "table") return "aging" as const;
  return "unknown" as const;
}

function localizedCopy(locale: VlmBrainKernelLocale) {
  if (locale === "de") return {
    headlineReady: "KI-Prüfung: Lens-Bericht bereit",
    headlineReview: "KI-Prüfung: PDF-Quellengrenzen prüfen",
    headlineBlocked: "KI-Prüfung: Lens-Bericht durch Datenlücken begrenzt",
    summary: "Browser, Lens-Vorschau und PDF-Download nutzen dasselbe Evidenzpaket: Quellen, Evidenzabdeckung, fehlende Daten, Claims und Parität.",
    sourceLedger: "Quellenregister",
    marketSnapshot: "Marktdaten-Snapshot",
    claims: "Claims / Belege",
    pdfParity: "Preview/Download-Parität",
    missing: "Fehlende Daten",
    freshness: "Frische / Widerspruch",
    next: "Quellen aktualisieren, zweites Provider-Signal prüfen und PDF erneut aus demselben Evidenzpaket bauen.",
    confidenceReason: "Die Evidenzbereitschaft wird durch Quellenanzahl, Frische, fehlende Daten, Claim-Abdeckung und PDF-Parität begrenzt; der Kernel-Score ist keine kalibrierte Wahrscheinlichkeit.",
  };
  if (locale === "en") return {
    headlineReady: "AI review: Lens report ready",
    headlineReview: "AI review: check PDF source boundaries",
    headlineBlocked: "AI review: Lens report limited by data gaps",
    summary: "Browser, Lens preview and PDF download now share one evidence packet: sources, evidence coverage, missing data, claims and parity.",
    sourceLedger: "Source ledger",
    marketSnapshot: "Market data snapshot",
    claims: "Claims / proof",
    pdfParity: "Preview/download parity",
    missing: "Missing data",
    freshness: "Freshness / contradiction",
    next: "Refresh sources, check the second-provider signal and rebuild the PDF from the same evidence packet.",
    confidenceReason: "Evidence readiness is capped by source count, freshness, missing data, claim coverage and PDF parity; the kernel score is not calibrated probability.",
  };
  return {
    headlineReady: "Kontrola AI: raport Lens gotowy",
    headlineReview: "Kontrola AI: sprawdź granice źródeł PDF",
    headlineBlocked: "Kontrola AI: raport Lens ograniczony przez braki danych",
    summary: "Browser, podgląd Lens i pobrany PDF używają jednego pakietu dowodów: źródła, pokrycie dowodów, braki danych, twierdzenia i parytet.",
    sourceLedger: "Rejestr źródeł",
    marketSnapshot: "Snapshot danych rynku",
    claims: "Twierdzenia / dowody",
    pdfParity: "Parytet podgląd/pobranie",
    missing: "Brakujące dane",
    freshness: "Świeżość / sprzeczności",
    next: "Odśwież źródła, sprawdź drugi provider i zbuduj PDF ponownie z tego samego pakietu dowodów.",
    confidenceReason: "Gotowość dowodowa jest ograniczana przez liczbę źródeł, świeżość, braki danych, pokrycie claimów i parytet PDF; wynik kernela nie jest skalibrowanym prawdopodobieństwem.",
  };
}

function severityFromTone(tone: VelmereSearchResult["tone"]): VlmBrainKernelSeverity {
  if (tone === "blocked") return "critical";
  if (tone === "elevated") return "warning";
  if (tone === "review") return "watch";
  return "info";
}

export function analyzeLensReportWithVlmKernel(input: VlmLensKernelInput): VlmBrainKernelOutput<VlmLensKernelPayload> {
  const locale = normalizeLocale(input.locale);
  const depth = normalizeDepth(input.selectedDepth ?? input.depth);
  const result = input.result;
  const copy = localizedCopy(locale);
  const independentSources = independentLiveProviderSources(result.sources);
  const sourceCount = independentSources.length;
  const missingData = Array.from(new Set((result.missingData ?? []).map((item) => lensString(item, "missing evidence")).filter(Boolean))).slice(0, 12);
  const sourceState = sourceQuality(result.sourceMode, sourceCount);
  const generatedAtMs = input.generatedAt ? Date.parse(input.generatedAt) : Number.NaN;
  const timestamp = assessEvidenceTimestamp(result.marketSnapshot?.observedAt, {
    nowMs: Number.isFinite(generatedAtMs) ? generatedAtMs : undefined,
  });
  const timestampConfidenceCap = timestamp.state === "fresh"
    ? 92
    : timestamp.state === "aging"
      ? 78
      : timestamp.state === "stale"
        ? 58
        : 42;
  const sourceConfidence = Math.min(
    clampPercent(result.sourceConfidence),
    sourceState.confidence,
    timestampConfidenceCap,
  );
  const marketState = marketSnapshotState(result.marketSnapshot);
  const claimCount = Math.max(0, Math.round(input.claimCount ?? 0));
  const confirmedClaimCount = Math.max(0, Math.round(input.confirmedClaimCount ?? 0));
  const missingSourceCount = Math.max(0, Math.round(input.missingSourceCount ?? missingData.length));
  const contradictionCount = Math.max(0, Math.round(input.contradictionCount ?? 0));
  const sectionCount = Math.max(0, Math.round(input.reportSectionCount ?? 0));
  const pageCount = Math.max(0, Math.round(input.pdfPageCount ?? 0));
  const sourceRegistryCount = Math.max(0, Math.round(input.sourceRegistryCount ?? result.sources.length));
  const claimCoverage = claimCount > 0 ? Math.round((confirmedClaimCount / claimCount) * 100) : 0;
  const parityReady = Boolean(input.parityManifest && input.evidenceManifest && input.visualQaState !== "blocked");
  const snapshot = result.marketSnapshot;
  const independentFamilyKeys = new Set(independentSources.map((entry) => entry.family.toLocaleLowerCase("en-US")));
  const sourceEvidence = result.sources.map((source, index) => {
    const metadata = lensSourceMetadata(source);
    const normalizedFamily = normalizeProviderFamily(`${source.label} ${source.id}`);
    const verifiedIndependent = independentFamilyKeys.has(normalizedFamily.toLocaleLowerCase("en-US"));
    const sourceTimestamp = verifiedIndependent && timestamp.state !== "future" && timestamp.state !== "invalid"
      ? timestamp.observedAt
      : null;
    const freshnessProfile = lensFreshnessProfile(result, metadata.providerFamily);
    return createVlmKernelEvidenceItem({
      id: `lens.provider.${index + 1}`,
      label: source.label,
      source: source.label || source.id,
      providerFamily: verifiedIndependent ? normalizedFamily : metadata.providerFamily,
      independence: verifiedIndependent ? "independent" : metadata.independence === "operator" ? "operator" : "derived",
      sourceTimestamp,
      freshnessProfile,
      quality: source.mode === "missing" ? "missing" : source.mode === "fallback" ? "weak" : source.mode === "table" ? "medium" : verifiedIndependent ? "strong" : "weak",
      freshness: verifiedIndependent
        ? timestamp.state === "fresh"
          ? "fresh"
          : timestamp.state === "aging"
            ? "aging"
            : timestamp.state === "stale"
              ? "stale"
              : "unknown"
        : lensSourceFreshness(source),
      confidence: source.mode === "missing" ? 0 : clampPercent(source.confidence, 0),
      value: source.note,
      missingReason: source.mode === "missing" ? source.note || "Lens provider row is missing." : undefined,
    });
  });

  const evidence = [
    ...sourceEvidence,
    createVlmKernelEvidenceItem({
      id: "lens.source-ledger",
      label: copy.sourceLedger,
      source: "velmere-lens-source-registry",
      providerFamily: "vlm-lens-source-registry",
      independence: "derived",
      sourceTimestamp: input.generatedAt ?? null,
      freshnessProfile: "document",
      quality: sourceState.quality,
      freshness: sourceState.freshness,
      confidence: Math.min(sourceConfidence, sourceState.confidence),
      value: `${sourceCount}/${result.sources.length || sourceCount}`,
      observedAt: timestamp.state === "future" || timestamp.state === "invalid"
        ? input.generatedAt ?? null
        : timestamp.observedAt ?? input.generatedAt ?? null,
      missingReason: sourceState.quality === "missing" ? "No confirmed source row was attached to the Lens result." : undefined,
    }),
    createVlmKernelEvidenceItem({
      id: "lens.market-snapshot",
      label: copy.marketSnapshot,
      source: "velmere-market-snapshot",
      providerFamily: "vlm-market-snapshot",
      independence: "derived",
      sourceTimestamp: timestamp.state === "future" || timestamp.state === "invalid" ? null : timestamp.observedAt,
      freshnessProfile: lensFreshnessProfile(result),
      quality: marketState.quality,
      freshness: timestamp.state === "fresh" ? "fresh" : timestamp.state === "aging" ? "aging" : timestamp.state === "stale" ? "stale" : "unknown",
      confidence: marketState.confidence,
      value: hasNumber(snapshot?.price) ? snapshot?.price ?? null : null,
      observedAt: timestamp.state === "future" || timestamp.state === "invalid" ? null : timestamp.observedAt,
      missingReason: marketState.quality === "missing" ? "No price, volume, market cap or 24h movement was attached." : undefined,
    }),
    createVlmKernelEvidenceItem({
      id: "lens.claim-coverage",
      label: copy.claims,
      source: "vlm-claim-source-gate",
      providerFamily: "vlm-claim-source-gate",
      independence: "derived",
      sourceTimestamp: input.generatedAt ?? null,
      freshnessProfile: "document",
      quality: claimCoverage >= 70 ? "strong" : claimCoverage >= 35 ? "medium" : claimCount > 0 ? "weak" : "missing",
      freshness: "fresh",
      confidence: claimCount > 0 ? Math.min(88, Math.max(24, claimCoverage)) : 0,
      value: `${confirmedClaimCount}/${claimCount}`,
      missingReason: claimCount > 0 ? undefined : "No atomic claim decomposition was attached to the report.",
    }),
    createVlmKernelEvidenceItem({
      id: "lens.pdf-parity",
      label: copy.pdfParity,
      source: "vlm-pdf-parity-manifest",
      providerFamily: "vlm-pdf-parity-manifest",
      independence: "derived",
      sourceTimestamp: input.generatedAt ?? null,
      freshnessProfile: "document",
      quality: parityReady ? "strong" : "weak",
      freshness: "fresh",
      confidence: parityReady ? 84 : 42,
      value: input.parityManifest ?? "missing-parity-manifest",
      missingReason: parityReady ? undefined : "Preview/download/evidence manifest is incomplete or visual QA is blocked.",
    }),
    createVlmKernelEvidenceItem({
      id: "lens.freshness-contradiction",
      label: copy.freshness,
      source: "vlm-freshness-contradiction-engine",
      providerFamily: "vlm-freshness-contradiction-engine",
      independence: "derived",
      sourceTimestamp: input.generatedAt ?? null,
      freshnessProfile: "document",
      quality: contradictionCount === 0 ? "medium" : contradictionCount <= 2 ? "weak" : "missing",
      freshness: input.freshnessState === "stale" ? "stale" : "fresh",
      confidence: contradictionCount === 0 ? 72 : contradictionCount <= 2 ? 48 : 18,
      value: `${input.freshnessState ?? "unknown"} / contradictions:${contradictionCount}`,
      missingReason: contradictionCount > 2 ? "Provider contradictions exceed the public confidence boundary." : undefined,
    }),
    ...missingData.slice(0, 8).map((label, index) => createVlmKernelEvidenceItem({
      id: `lens.missing.${index + 1}`,
      label: copy.missing,
      source: "vlm-lens-gap-detector",
      providerFamily: "vlm-lens-gap-detector",
      independence: "derived",
      sourceTimestamp: input.generatedAt ?? null,
      freshnessProfile: "document",
      quality: "missing" as const,
      freshness: "unknown" as const,
      confidence: 0,
      value: lensPrimitive(label),
      missingReason: lensString(label, "Missing Lens source evidence."),
    })),
  ];

  const findings: VlmBrainKernelFinding[] = [
    {
      id: "lens.kernel-summary",
      title: `${result.symbol || result.title}: Lens ${depth}`,
      body: `${result.summary} ${copy.confidenceReason}`.slice(0, 900),
      severity: severityFromTone(result.tone),
      confidence: sourceConfidence,
      evidenceIds: ["lens.source-ledger", "lens.market-snapshot", "lens.claim-coverage", "lens.pdf-parity"],
    },
    {
      id: "lens.preview-download-single-payload",
      title: copy.pdfParity,
      body: `Reader and binary PDF are tied to checksum ${input.checksum || "pending"}; pages=${pageCount}; sections=${sectionCount}; manifest=${input.parityManifest || "pending"}.`,
      severity: parityReady ? "info" : "watch",
      confidence: parityReady ? 84 : 42,
      evidenceIds: ["lens.pdf-parity"],
    },
  ];

  const status = sourceState.quality === "missing" || missingSourceCount >= 6
    ? "blocked"
    : sourceConfidence < 62 || missingData.length > 0 || !parityReady
      ? "needs_review"
      : "ready";

  return runVlmBrainKernel(
    {
      surface: "lens",
      depth,
      locale,
      input,
      evidence,
      intent: "lens_pdf_single_payload_report",
      memoryKey: `lens:${result.id}:${depth}`,
      generatedAt: input.generatedAt,
    },
    {
      subject: {
        id: result.id,
        title: result.title,
        symbol: result.symbol || result.avatarLabel || "VLM",
        category: result.category,
      },
      report: {
        depth,
        checksum: input.checksum,
        sectionCount,
        pdfPageCount: pageCount,
        parityManifest: input.parityManifest,
        evidenceManifest: input.evidenceManifest,
      },
      evidenceReadiness: {
        sourceMode: result.sourceMode,
        sourceCount,
        sourceConfidence,
        missingDataCount: missingData.length,
        claimCount,
        confirmedClaimCount,
        contradictionCount,
        sourceRegistryCount,
      },
      marketSnapshot: {
        price: hasNumber(snapshot?.price) ? snapshot?.price ?? null : null,
        change24h: hasNumber(snapshot?.change24h) ? snapshot?.change24h ?? null : null,
        volume24h: hasNumber(snapshot?.volume24h) ? snapshot?.volume24h ?? null : null,
        marketCap: hasNumber(snapshot?.marketCap) ? snapshot?.marketCap ?? null : null,
        observedAt: timestamp.state === "future" || timestamp.state === "invalid" ? null : timestamp.observedAt,
      },
      truthBoundary: {
        canExportPdf: parityReady
          && status !== "blocked"
          && (depth === "basic" || (sourceCount >= 2 && sourceConfidence >= 62 && (timestamp.state === "fresh" || timestamp.state === "aging"))),
        canPreviewReader: status !== "blocked",
        confidenceCapReason: copy.confidenceReason,
      },
    },
    {
      status,
      confidence: sourceConfidence,
      headline: status === "blocked" ? copy.headlineBlocked : status === "needs_review" ? copy.headlineReview : copy.headlineReady,
      summary: copy.summary,
      findings,
      missingData: missingData.map((label, index) => ({
        id: `lens.gap.${index + 1}`,
        label: lensString(label, "Missing Lens source evidence"),
        reason: lensString(label, "Missing Lens source evidence"),
        blocksPublish: false,
      })),
      nextActions: [
        {
          id: "lens.next.kernel-refresh",
          title: copy.next,
          body: copy.next,
          required: status !== "ready",
          owner: "operator",
        },
      ],
    },
  );
}
