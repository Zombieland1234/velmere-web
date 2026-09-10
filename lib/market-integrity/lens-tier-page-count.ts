export type LensTierPageDepth = "basic" | "pro" | "advanced";
export type LensTierPageCount = 2 | 4 | 8;

const PAGE_COUNT_BY_DEPTH = {
  basic: 2,
  pro: 4,
  advanced: 8,
} as const satisfies Record<LensTierPageDepth, LensTierPageCount>;

export function pageCountForDepth(depth: LensTierPageDepth): LensTierPageCount {
  const pageCount = PAGE_COUNT_BY_DEPTH[depth];
  if (pageCount === undefined) {
    throw new TypeError(`unsupported_lens_tier_depth:${String(depth)}`);
  }
  return pageCount;
}
