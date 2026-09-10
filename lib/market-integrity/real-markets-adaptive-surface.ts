export type Pass618AdaptiveSurfaceMode = "cards" | "table";

export type Pass618AdaptiveSurface = {
  version: "real-markets-adaptive-surface";
  viewportWidth: number;
  mode: Pass618AdaptiveSurfaceMode;
  cardColumns: 1 | 2;
  tableColumns: 9;
  inlinePadding: number;
  gap: number;
  rowMinHeight: number;
  touchTarget: 44;
  horizontalOverflow: false;
  visibleBatch: number;
  density: "compact" | "balanced" | "expanded";
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function buildPass618AdaptiveSurface(input: {
  viewportWidth: number;
  rowCount?: number;
}): Pass618AdaptiveSurface {
  const viewportWidth = clamp(Math.round(input.viewportWidth || 320), 280, 5120);
  const mode: Pass618AdaptiveSurfaceMode = viewportWidth >= 1024 ? "table" : "cards";
  const cardColumns: 1 | 2 = viewportWidth >= 720 && viewportWidth < 1024 ? 2 : 1;
  const density = viewportWidth >= 1440 ? "expanded" : viewportWidth >= 1024 ? "balanced" : "compact";
  const visibleBatch = mode === "table" ? 50 : cardColumns === 2 ? 24 : 18;

  return {
    version: "real-markets-adaptive-surface",
    viewportWidth,
    mode,
    cardColumns,
    tableColumns: 9,
    inlinePadding: viewportWidth < 390 ? 12 : viewportWidth < 1024 ? 16 : 20,
    gap: viewportWidth < 390 ? 8 : 12,
    rowMinHeight: mode === "table" ? 72 : 188,
    touchTarget: 44,
    horizontalOverflow: false,
    visibleBatch: Math.min(Math.max(visibleBatch, 1), Math.max(input.rowCount ?? visibleBatch, 1)),
    density,
  };
}
