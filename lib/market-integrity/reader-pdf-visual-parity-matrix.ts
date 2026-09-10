import { sha256Token } from "../security/cryptographic-digest";
import { pageCountForDepth } from "./lens-tier-page-count";
import type { Pass610ReaderDownloadParityManifest } from "./reader-download-parity-manifest";

export type Pass643ReaderPdfVisualParityMatrix = {
  version: "reader-pdf-visual-parity-matrix";
  state: "ready" | "review" | "blocked";
  currentCase: {
    id: string;
    locale: "pl" | "de" | "en";
    depth: "basic" | "pro" | "advanced";
    pageCount: 2 | 4 | 8;
    manifestKey: string;
    uniquePageIds: boolean;
    canonicalVisual: "pdf_blob";
    readerMode: "semantic_reflow";
  };
  requiredCases: Array<{
    id: string;
    locale: "pl" | "de" | "en";
    depth: "basic" | "pro" | "advanced";
    viewport: "a4" | "reader_desktop" | "reader_mobile";
  }>;
  extremeFixtures: Array<{
    id: "long_symbol" | "long_source" | "unbroken_word" | "dense_missing_appendix";
    value: string;
    expected: string;
  }>;
  captureContract: {
    exactPdfBinary: true;
    screenshotEachPage: true;
    comparePageManifest: true;
    maxUnexpectedOverflowPx: 0;
    contentLossAllowed: false;
  };
  visualKey: string;
  boundary: string;
};

function hash(value: string) {
  return sha256Token(value, 16);
}

export function buildPass643ReaderPdfVisualParityMatrix(input: {
  parity: Pass610ReaderDownloadParityManifest;
}): Pass643ReaderPdfVisualParityMatrix {
  const parity = input.parity;
  const uniquePageIds =
    new Set(parity.pages.map((page) => page.id)).size === parity.pageCount;
  const requiredCases = (["pl", "de", "en"] as const).flatMap((locale) =>
    (["basic", "pro", "advanced"] as const).flatMap((depth) =>
      (["a4", "reader_desktop", "reader_mobile"] as const).map((viewport) => ({
        id: `${locale}-${depth}-${viewport}`,
        locale,
        depth,
        viewport,
      })),
    ),
  );
  const extremeFixtures = [
    {
      id: "long_symbol" as const,
      value: "VELMERE-EXTREMELY-LONG-INSTRUMENT-SYMBOL-1234567890",
      expected: "wrap_or_ellipsis_without_covering_price_or_badges",
    },
    {
      id: "long_source" as const,
      value: "Independent provider receipt with observation timestamp, methodology, venue, quote currency and a long public evidence note ".repeat(3).trim(),
      expected: "move_whole_source_block_to_next_page_without_overlap",
    },
    {
      id: "unbroken_word" as const,
      value: "SOURCEPROVENANCE".repeat(14),
      expected: "emergency_break_inside_printable_width",
    },
    {
      id: "dense_missing_appendix" as const,
      value: Array.from({ length: 12 }, (_, index) => `M${index + 1}: source timestamp and independent confirmation required`).join(" | "),
      expected: "appendix_paginates_without_content_loss",
    },
  ];
  const expectedPageCount = pageCountForDepth(parity.depth);
  const blocked = parity.pageCount !== expectedPageCount || !uniquePageIds;
  const state: Pass643ReaderPdfVisualParityMatrix["state"] = blocked
    ? "blocked"
    : parity.state === "locked"
      ? "ready"
      : "review";
  const visualKey = `VLM-VIS-${hash([
    parity.manifestKey,
    parity.locale,
    parity.depth,
    ...parity.pages.flatMap((page) => [page.id, page.title, ...page.blockIds]),
    ...extremeFixtures.map((fixture) => `${fixture.id}:${fixture.value}:${fixture.expected}`),
  ].join("|"))}`;
  return {
    version: "reader-pdf-visual-parity-matrix",
    state,
    currentCase: {
      id: `${parity.locale}-${parity.depth}-${parity.manifestKey}`,
      locale: parity.locale,
      depth: parity.depth,
      pageCount: parity.pageCount,
      manifestKey: parity.manifestKey,
      uniquePageIds,
      canonicalVisual: parity.canonicalVisual,
      readerMode: parity.readerMode,
    },
    requiredCases,
    extremeFixtures,
    captureContract: {
      exactPdfBinary: true,
      screenshotEachPage: true,
      comparePageManifest: true,
      maxUnexpectedOverflowPx: 0,
      contentLossAllowed: false,
    },
    visualKey,
    boundary:
      "Reader may reflow semantically, but it must preserve every section, claim, source, appendix entry and page identity from the same canonical report payload.",
  };
}
