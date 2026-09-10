/**
 * Stable public facade for market-data trust and presentation policy.
 *
 * PASS4786 decomposed the former 1,674-line append-only module into three
 * domain owners while preserving every existing export and import path.
 */
export * from "./market-data-sanity-source";
export * from "./market-data-sanity-presentation";
export * from "./market-data-sanity-proof";
