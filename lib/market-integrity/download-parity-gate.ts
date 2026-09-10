import { sha256Token } from "@/lib/security/cryptographic-digest";
import {
  pageCountForDepth,
  type LensTierPageCount,
  type LensTierPageDepth,
} from "./lens-tier-page-count";
import type { Pass581PdfPageCompositor } from "./pdf-page-compositor";
import type { Pass582SourceCitationRail } from "./source-citation-rail";

export type Pass583DownloadParityGate = {
  version: "download-parity-gate";
  state: "locked" | "review";
  manifestKey: string;
  readerPages: LensTierPageCount;
  downloadPages: LensTierPageCount;
  citationCount: number;
  boundary: string;
};

function hash(value: string) {
  return sha256Token(value, 24);
}

export function buildPass583DownloadParityGate(input: {
  symbol: string;
  locale: string;
  depth: LensTierPageDepth;
  reportChecksum: string;
  parityKey: string;
  sections: readonly { id: string; title: string; body: string }[];
  compositor: Pass581PdfPageCompositor;
  citationRail: Pass582SourceCitationRail;
}): Pass583DownloadParityGate {
  const pageCount = pageCountForDepth(input.depth);
  const canonical = [
    input.symbol.toUpperCase(),
    input.locale,
    input.depth,
    input.reportChecksum,
    input.parityKey,
    ...input.sections.map(
      (section) => `${section.id}:${section.title}:${section.body}`,
    ),
    ...input.compositor.pages.flatMap((page) =>
      page.blocks.map(
        (block) => `${page.id}:${block.id}:${block.state}:${block.weight}`,
      ),
    ),
    ...input.citationRail.citations.map(
      (citation) =>
        `${citation.id}:${citation.label}:${citation.confidence}:${citation.state}`,
    ),
  ].join("|");
  const state = input.compositor.compactedBlocks.length ? "review" : "locked";

  return {
    version: "download-parity-gate",
    state,
    manifestKey: `VLM-PARITY-${hash(canonical)}`,
    readerPages: pageCount,
    downloadPages: pageCount,
    citationCount: input.citationRail.citations.length,
    boundary:
      "Reader and download are accepted only when page order, source IDs, depth and the source-bound report checksum produce the same manifest.",
  };
}
