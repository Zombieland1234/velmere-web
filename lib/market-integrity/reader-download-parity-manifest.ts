import { sha256Token } from "@/lib/security/cryptographic-digest";
import {
  pageCountForDepth,
  type LensTierPageCount,
  type LensTierPageDepth,
} from "./lens-tier-page-count";
import type { Pass607ClaimSourceCompletenessGate } from "./claim-source-completeness-gate";
import type { Pass608MissingSourceAppendix } from "./missing-source-appendix";
import type { Pass609DynamicA4DensityBalancing } from "./dynamic-a4-density-balancing";

export type Pass610ReaderDownloadParityManifest = {
  version: "reader-download-parity-manifest";
  state: "locked" | "review";
  locale: "pl" | "de" | "en";
  depth: LensTierPageDepth;
  pageCount: LensTierPageCount;
  pages: Array<{
    id:
      | "decision"
      | "evidence"
      | "analysis"
      | "boundary"
      | "evidence-ledger"
      | "claim-map"
      | "missing-recheck"
      | "methodology-signature";
    index: number;
    title: string;
    blockIds: string[];
  }>;
  sectionOrder: string[];
  sourceIds: Array<`S${string}`>;
  claimIds: Array<`C${string}`>;
  appendixIds: Array<`M${string}`>;
  manifestKey: string;
  canonicalVisual: "pdf_blob";
  readerMode: "semantic_reflow";
  boundary: string;
};

function hash(value: string) {
  return sha256Token(value, 24);
}

function localeOf(locale: string): "pl" | "de" | "en" {
  return locale === "de" || locale === "en" ? locale : "pl";
}

function pageTitles(locale: "pl" | "de" | "en") {
  if (locale === "de") return ["Entscheidung", "Quellen", "Analyse", "Grenzen", "Evidenzregister", "Claim-Karte", "Lücken und Re-check", "Methodik und Signatur"];
  if (locale === "en") return ["Decision", "Evidence", "Analysis", "Boundaries", "Evidence ledger", "Claim map", "Gaps and re-check", "Methodology and signature"];
  return ["Decyzja", "Dowody", "Analiza", "Granice", "Rejestr dowodów", "Mapa claimów", "Braki i re-check", "Metodologia i podpis"];
}

export function buildPass610ReaderDownloadParityManifest(input: {
  locale: string;
  depth: LensTierPageDepth;
  reportChecksum: string;
  sections: readonly { id: string; title: string; body: string }[];
  claimGate: Pass607ClaimSourceCompletenessGate;
  appendix: Pass608MissingSourceAppendix;
  density: Pass609DynamicA4DensityBalancing;
}): Pass610ReaderDownloadParityManifest {
  const locale = localeOf(input.locale);
  const pageCount = pageCountForDepth(input.depth);
  const titles = pageTitles(locale);
  const basePages = input.density.pages.map((page, index) => ({
    id: page.id,
    index: index + 1,
    title: titles[index],
    blockIds: page.blockIds,
  }));
  const advancedPages = [
    { id: "evidence-ledger" as const, index: 5, title: titles[4], blockIds: ["advanced-source-ledger", "advanced-source-freshness"] },
    { id: "claim-map" as const, index: 6, title: titles[5], blockIds: ["advanced-claim-map", "advanced-analysis-sections"] },
    { id: "missing-recheck" as const, index: 7, title: titles[6], blockIds: ["advanced-missing-proof", "advanced-recheck-plan"] },
    { id: "methodology-signature" as const, index: 8, title: titles[7], blockIds: ["advanced-methodology", "advanced-release-signature"] },
  ];
  const pages = pageCount === 2
    ? basePages.slice(0, 2)
    : pageCount === 8
      ? [...basePages, ...advancedPages]
      : basePages;
  if (pages.length !== pageCount) {
    throw new TypeError(
      `reader_download_page_count_mismatch:${input.depth}:${pages.length}:${pageCount}`,
    );
  }
  const sectionOrder = input.sections.map((section) => section.id);
  const sourceIds = input.claimGate.sources.map((source) => source.sourceId);
  const claimIds = input.claimGate.claims.map((claim) => claim.claimId);
  const appendixIds = input.appendix.entries.map((entry) => entry.id);
  const canonical = [
    locale,
    input.depth,
    input.reportChecksum,
    ...pages.flatMap((page) => [page.id, String(page.index), page.title, ...page.blockIds]),
    ...input.sections.map((section) => `${section.id}:${section.title}:${section.body}`),
    ...sourceIds,
    ...claimIds,
    ...appendixIds,
  ].join("|");
  return {
    version: "reader-download-parity-manifest",
    state: input.density.state === "blocked" ? "review" : "locked",
    locale,
    depth: input.depth,
    pageCount,
    pages,
    sectionOrder,
    sourceIds,
    claimIds,
    appendixIds,
    manifestKey: `VLM-RD-${hash(canonical)}`,
    canonicalVisual: "pdf_blob",
    readerMode: "semantic_reflow",
    boundary:
      "The PDF blob is the canonical visual output. Reader and download share locale, depth, page IDs, section order, source IDs, claim IDs and appendix IDs; the semantic Reader may reflow without changing content.",
  };
}
