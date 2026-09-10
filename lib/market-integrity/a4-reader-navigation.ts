import type { Pass488PageId } from "./a4-decision-cockpit";

export const pass494A4ReaderNavigation = {
  version: "a4-reader-navigation",
  pageIds: ["decision", "evidence", "analysis", "boundary"] as Pass488PageId[],
  observerThresholds: [0.18, 0.34, 0.52, 0.7],
  rootMargin: "-88px 0px -46% 0px",
  snapMode: "proximity" as const,
};

export function pass494ReaderProgress(activePage: Pass488PageId) {
  const index = Math.max(0, pass494A4ReaderNavigation.pageIds.indexOf(activePage));
  return {
    index,
    page: index + 1,
    total: pass494A4ReaderNavigation.pageIds.length,
    percent: ((index + 1) / pass494A4ReaderNavigation.pageIds.length) * 100,
  };
}
