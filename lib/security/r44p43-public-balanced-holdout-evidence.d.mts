export const R44P43_HOLDOUT_SCHEMA: "velmere.pass36.a102r44p43.public-balanced-holdout.v1";
export const R44P43_SUPPORTED_RULES_BY_CATEGORY: Readonly<Record<string, readonly string[]>>;
export type R44P43PositiveCase = { caseId: string; category: string; supportedCategory: boolean; resultStatus: string; evidenceSha256: string };
export type R44P43ControlCase = { caseId: string; compilationStatus: string; rootRuleIds: string[]; bundleRuleIds: string[]; evidenceSha256: string };
export function buildR44P43HoldoutSummary(input: { revisionId: string; parentRevisionId: string; smartbugsManifest: Record<string, unknown>; controlManifest: Record<string, unknown>; positiveCases: R44P43PositiveCase[]; controlCases: R44P43ControlCase[]; caseIndex: unknown[]; observedAt?: string }): Record<string, unknown>;
export function verifyR44P43HoldoutSummary(input: { summary: Record<string, unknown>; positiveCases: R44P43PositiveCase[]; controlCases: R44P43ControlCase[]; smartbugsManifest: Record<string, unknown>; controlManifest: Record<string, unknown> }): { ok: boolean; checks: Array<{ id: string; ok: boolean; detail?: unknown }>; failed: Array<{ id: string; ok: boolean; detail?: unknown }> };
