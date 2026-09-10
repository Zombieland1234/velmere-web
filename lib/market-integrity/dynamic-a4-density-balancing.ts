export type Pass609PageId = "decision" | "evidence" | "analysis" | "boundary";
export type Pass609BlockInput = {
  id: string;
  preferredPage: Pass609PageId;
  text: string;
  rows?: number;
  minLines?: number;
  keepTogether?: boolean;
};
export type Pass609DynamicA4DensityBalancing = {
  version: "dynamic-a4-density-balancing";
  state: "ready" | "review" | "blocked";
  locale: "pl" | "de" | "en";
  pageCount: 4;
  widowOrphanMinimum: 2;
  pages: Array<{
    id: Pass609PageId;
    capacityLines: number;
    usedLines: number;
    density: number;
    blockIds: string[];
  }>;
  blocks: Array<{
    id: string;
    preferredPage: Pass609PageId;
    page: Pass609PageId;
    estimatedLines: number;
    renderedLineBudget: number;
    keepTogether: boolean;
    state: "placed" | "moved" | "compacted";
  }>;
  movedBlockIds: string[];
  compactedBlockIds: string[];
  maxDensity: number;
  boundary: string;
};

const order: Pass609PageId[] = ["decision", "evidence", "analysis", "boundary"];
const capacities: Record<Pass609PageId, number> = {
  decision: 48,
  evidence: 56,
  analysis: 64,
  boundary: 52,
};
const charsPerLine = { pl: 70, de: 64, en: 76 } as const;

function localeOf(locale: string): "pl" | "de" | "en" {
  return locale === "de" || locale === "en" ? locale : "pl";
}

function estimateLines(value: string, locale: "pl" | "de" | "en") {
  const paragraphs = value
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s*[·|•]\s*/)
    .filter(Boolean);
  if (!paragraphs.length) return 1;
  return paragraphs.reduce(
    (total, paragraph) => total + Math.max(1, Math.ceil(paragraph.length / charsPerLine[locale])),
    0,
  );
}

export function buildPass609DynamicA4DensityBalancing(input: {
  locale: string;
  blocks: readonly Pass609BlockInput[];
}): Pass609DynamicA4DensityBalancing {
  const locale = localeOf(input.locale);
  const pages = order.map((id) => ({
    id,
    capacityLines: capacities[id],
    usedLines: 0,
    density: 0,
    blockIds: [] as string[],
  }));
  const blocks: Pass609DynamicA4DensityBalancing["blocks"] = [];
  const movedBlockIds: string[] = [];
  const compactedBlockIds: string[] = [];

  for (const block of input.blocks) {
    const estimatedLines = Math.max(
      block.minLines || 2,
      estimateLines(block.text, locale) + Math.max(0, block.rows || 0),
    );
    const preferredIndex = Math.max(0, order.indexOf(block.preferredPage));
    let target = pages[preferredIndex];
    let state: "placed" | "moved" | "compacted" = "placed";
    if (target.usedLines + estimatedLines > target.capacityLines) {
      const next = pages
        .slice(preferredIndex + 1)
        .find((page) => page.usedLines + estimatedLines <= page.capacityLines);
      if (next) {
        target = next;
        state = "moved";
        movedBlockIds.push(block.id);
      } else {
        state = "compacted";
        compactedBlockIds.push(block.id);
      }
    }
    const available = Math.max(2, target.capacityLines - target.usedLines);
    const renderedLineBudget = state === "compacted" ? Math.min(estimatedLines, available) : estimatedLines;
    target.usedLines = Math.min(target.capacityLines, target.usedLines + renderedLineBudget);
    target.blockIds.push(block.id);
    blocks.push({
      id: block.id,
      preferredPage: block.preferredPage,
      page: target.id,
      estimatedLines,
      renderedLineBudget,
      keepTogether: block.keepTogether !== false,
      state,
    });
  }
  pages.forEach((page) => {
    page.density = Math.round((page.usedLines / page.capacityLines) * 100);
  });
  const maxDensity = Math.max(...pages.map((page) => page.density), 0);
  const state = compactedBlockIds.length
    ? maxDensity >= 100
      ? "blocked"
      : "review"
    : movedBlockIds.length || maxDensity > 94
      ? "review"
      : "ready";
  return {
    version: "dynamic-a4-density-balancing",
    state,
    locale,
    pageCount: 4,
    widowOrphanMinimum: 2,
    pages,
    blocks,
    movedBlockIds,
    compactedBlockIds,
    maxDensity,
    boundary:
      "PL, DE and EN are measured with locale-specific line budgets. Whole blocks move forward before rendering; compacting is explicit and never allowed to overlap the reserved footer.",
  };
}
