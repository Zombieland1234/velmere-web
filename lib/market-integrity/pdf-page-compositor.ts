import type { Pass488PageId } from "./a4-decision-cockpit";

export type Pass581Block = {
  id: string;
  preferredPage: Pass488PageId;
  characters: number;
  rows: number;
};

export type Pass581PlacedBlock = Pass581Block & {
  page: Pass488PageId;
  weight: number;
  state: "placed" | "moved" | "compacted";
};

export type Pass581PagePlan = {
  id: Pass488PageId;
  capacity: number;
  used: number;
  density: number;
  state: "ready" | "review";
  blocks: Pass581PlacedBlock[];
};

export type Pass581PdfPageCompositor = {
  version: "pdf-page-compositor";
  status: "ready" | "review";
  pages: Pass581PagePlan[];
  movedBlocks: string[];
  compactedBlocks: string[];
  boundary: string;
};

const order: Pass488PageId[] = ["decision", "evidence", "analysis", "boundary"];
const capacities: Record<Pass488PageId, number> = {
  decision: 2600,
  evidence: 3500,
  analysis: 4300,
  boundary: 3100,
};

function weight(block: Pass581Block) {
  return Math.max(80, block.characters + block.rows * 120);
}

export function buildPass581PdfPageCompositor(
  blocks: readonly Pass581Block[],
): Pass581PdfPageCompositor {
  const pages: Pass581PagePlan[] = order.map((id) => ({
    id,
    capacity: capacities[id],
    used: 0,
    density: 0,
    state: "ready",
    blocks: [],
  }));
  const movedBlocks: string[] = [];
  const compactedBlocks: string[] = [];

  for (const block of blocks) {
    const blockWeight = weight(block);
    const preferredIndex = order.indexOf(block.preferredPage);
    let target = pages[preferredIndex];
    let state: Pass581PlacedBlock["state"] = "placed";

    if (target.used + blockWeight > target.capacity) {
      const next = pages
        .slice(preferredIndex + 1)
        .find((page) => page.used + blockWeight <= page.capacity);
      if (next) {
        target = next;
        state = "moved";
        movedBlocks.push(block.id);
      } else {
        state = "compacted";
        compactedBlocks.push(block.id);
      }
    }

    const appliedWeight =
      state === "compacted"
        ? Math.min(blockWeight, Math.max(160, target.capacity - target.used))
        : blockWeight;
    target.used = Math.min(target.capacity, target.used + appliedWeight);
    target.blocks.push({
      ...block,
      page: target.id,
      weight: appliedWeight,
      state,
    });
  }

  for (const page of pages) {
    page.density = Math.round((page.used / page.capacity) * 100);
    page.state = page.density > 96 ? "review" : "ready";
  }

  return {
    version: "pdf-page-compositor",
    status:
      movedBlocks.length ||
      compactedBlocks.length ||
      pages.some((page) => page.state === "review")
        ? "review"
        : "ready",
    pages,
    movedBlocks,
    compactedBlocks,
    boundary:
      "Blocks are measured before render. Oversized content is moved forward or compacted before it can collide with the reserved A4 footer.",
  };
}
