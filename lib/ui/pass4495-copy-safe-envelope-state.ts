export type Pass4495Locale = "pl" | "en" | "de";
export type Pass4495State = "ready" | "review" | "blocked";
export type Pass4495AuditKind = "website" | "repo" | "contract" | "unknown";
export type Pass4495Tier = "basic" | "pro" | "advanced";

export type Pass4495EnvelopeItem = {
  label: string;
  value: string;
  state: Pass4495State;
};

const copy = {
  pl: {
    badge: "PASS4495",
    assetTitle: "Copy-safe envelope",
    assetSubtitle: "Podgląd paczki, którą można kopiować albo eksportować bez sekretów, seedów, płatnych danych i claimów ponad dowody.",
    shieldTitle: "Customer export envelope",
    shieldSubtitle: "Shield Pro pokazuje, czy aktualny filtr/sort nadaje się do bezpiecznego eksportu klienta, czy wymaga ręcznej redakcji.",
    auditTitle: "Audit packet envelope",
    auditSubtitle: "Audit intake ma bezpieczną kopertę zgłoszenia: fingerprint, scope, plan, redakcje i backend boundary.",
    envelope: "Envelope",
    schema: "Schema",
    payload: "Payload",
    redaction: "Redaction",
    status: "Status",
    rows: "Rows",
    safeRows: "Safe rows",
    reviewRows: "Review rows",
    blockedRows: "Blocked rows",
    plan: "Plan",
    scope: "Scope",
    fingerprint: "Fingerprint",
    clean: "copy-safe",
    review: "manual review",
    blocked: "blocked",
    preview: "preview-only",
    vault: "case vault required",
    publicOnly: "public preview",
  },
  en: {
    badge: "PASS4495",
    assetTitle: "Copy-safe envelope",
    assetSubtitle: "A packet preview that can be copied or exported without secrets, seeds, paid data or claims beyond evidence.",
    shieldTitle: "Customer export envelope",
    shieldSubtitle: "Shield Pro shows whether the current filter/sort is safe for customer export or needs manual redaction.",
    auditTitle: "Audit packet envelope",
    auditSubtitle: "Audit intake has a safe submission envelope: fingerprint, scope, plan, redactions and backend boundary.",
    envelope: "Envelope",
    schema: "Schema",
    payload: "Payload",
    redaction: "Redaction",
    status: "Status",
    rows: "Rows",
    safeRows: "Safe rows",
    reviewRows: "Review rows",
    blockedRows: "Blocked rows",
    plan: "Plan",
    scope: "Scope",
    fingerprint: "Fingerprint",
    clean: "copy-safe",
    review: "manual review",
    blocked: "blocked",
    preview: "preview-only",
    vault: "case vault required",
    publicOnly: "public preview",
  },
  de: {
    badge: "PASS4495",
    assetTitle: "Copy-safe Envelope",
    assetSubtitle: "Eine Packet-Vorschau, die ohne Secrets, Seeds, Paid Data oder Claims über Evidenz kopiert/exportiert werden kann.",
    shieldTitle: "Customer Export Envelope",
    shieldSubtitle: "Shield Pro zeigt, ob aktueller Filter/Sort sicher exportierbar ist oder manuelle Redaction braucht.",
    auditTitle: "Audit Packet Envelope",
    auditSubtitle: "Audit Intake hat eine sichere Submission Envelope: Fingerprint, Scope, Plan, Redactions und Backend Boundary.",
    envelope: "Envelope",
    schema: "Schema",
    payload: "Payload",
    redaction: "Redaction",
    status: "Status",
    rows: "Rows",
    safeRows: "Safe Rows",
    reviewRows: "Review Rows",
    blockedRows: "Blocked Rows",
    plan: "Plan",
    scope: "Scope",
    fingerprint: "Fingerprint",
    clean: "copy-safe",
    review: "manual review",
    blocked: "blocked",
    preview: "preview-only",
    vault: "Case Vault erforderlich",
    publicOnly: "public preview",
  },
} as const;

function safeLocale(locale: string): Pass4495Locale {
  return locale === "pl" || locale === "de" ? locale : "en";
}

function numericPercent(label?: string | null) {
  if (!label) return null;
  const match = label.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
}

function envelopeId(prefix: string, seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function stateFromCounts(blocked: number, review: number, safe: number): Pass4495State {
  if (blocked > Math.max(1, safe)) return "blocked";
  if (blocked || review) return "review";
  return safe ? "ready" : "blocked";
}

export function buildPass4495AssetCopySafeEnvelope(input: {
  locale: string;
  symbol: string;
  surface: string;
  timeframe: string;
  sourceLabel?: string | null;
  sourceTimeLabel?: string | null;
  riskLabel?: string | null;
  confidenceLabel?: string | null;
  candleCount: number;
  remoteReady: boolean;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const risk = numericPercent(input.riskLabel) ?? 45;
  const confidence = numericPercent(input.confidenceLabel) ?? 58;
  const missingSource = !(input.sourceLabel || input.remoteReady);
  const missingFreshness = !input.sourceTimeLabel;
  const thinChart = input.candleCount < 30;
  const state = stateFromCounts(missingSource || thinChart ? 1 : 0, missingFreshness || risk >= 72 || confidence < 55 ? 1 : 0, 1);
  const payload = [input.symbol, input.surface, input.timeframe, `${input.candleCount}c`, missingSource ? "no-source" : "source-bound"].join(" · ");

  return {
    title: t.assetTitle,
    subtitle: t.assetSubtitle,
    badge: t.badge,
    state,
    items: [
      { label: t.envelope, value: envelopeId("VLM-ENV-ASSET", `${payload}:${input.sourceTimeLabel ?? "pending"}`), state },
      { label: t.schema, value: "asset.v1.safe-preview", state: "ready" },
      { label: t.payload, value: payload, state: missingSource ? "blocked" : thinChart ? "review" : "ready" },
      { label: t.redaction, value: state === "ready" ? t.clean : state === "review" ? t.review : t.blocked, state },
    ] satisfies Pass4495EnvelopeItem[],
  };
}

export function buildPass4495ShieldProExportEnvelope(input: {
  locale: string;
  visibleRows: Array<{ symbol: string; integrity: number; liquidity: number; manipulation: number; squeeze: number; evidence: number }>;
  totalCount: number;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const safeRows = input.visibleRows.filter((row) => row.evidence >= 82 && row.integrity >= 70 && row.manipulation < 55 && row.squeeze < 72).length;
  const reviewRows = input.visibleRows.filter((row) => row.evidence >= 55 && row.evidence < 82).length + input.visibleRows.filter((row) => row.manipulation >= 55 || row.squeeze >= 72 || row.integrity < 70).length;
  const blockedRows = Math.max(0, input.visibleRows.length - safeRows - reviewRows);
  const state = stateFromCounts(blockedRows, reviewRows, safeRows);
  const symbols = input.visibleRows.slice(0, 8).map((row) => row.symbol).join("|") || "empty";

  return {
    title: t.shieldTitle,
    subtitle: t.shieldSubtitle,
    badge: t.badge,
    state,
    items: [
      { label: t.envelope, value: envelopeId("VLM-ENV-PRO", `${symbols}:${safeRows}:${reviewRows}:${blockedRows}`), state },
      { label: t.rows, value: `${input.visibleRows.length}/${input.totalCount}`, state: input.visibleRows.length ? "ready" : "blocked" },
      { label: t.safeRows, value: `${safeRows}`, state: safeRows ? "ready" : "review" },
      { label: t.reviewRows, value: `${reviewRows}`, state: reviewRows ? "review" : "ready" },
      { label: t.blockedRows, value: `${blockedRows}`, state: blockedRows ? "blocked" : "ready" },
    ] satisfies Pass4495EnvelopeItem[],
  };
}

export function buildPass4495AuditPacketEnvelope(input: {
  locale: string;
  kind: Pass4495AuditKind;
  tier: Pass4495Tier;
  valid: boolean;
  queued: boolean;
  fingerprint: string;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const requiresVault = input.tier !== "basic";
  const state: Pass4495State = !input.valid ? "blocked" : requiresVault && !input.queued ? "review" : "ready";
  const delivery = !input.valid ? t.blocked : requiresVault ? t.vault : input.queued ? t.preview : t.publicOnly;
  return {
    title: t.auditTitle,
    subtitle: t.auditSubtitle,
    badge: t.badge,
    state,
    items: [
      { label: t.envelope, value: envelopeId("VLM-ENV-AUDIT", `${input.kind}:${input.tier}:${input.fingerprint}:${input.queued}`), state },
      { label: t.scope, value: input.valid ? input.kind : t.blocked, state: input.valid ? "ready" : "blocked" },
      { label: t.plan, value: input.tier, state: input.tier === "advanced" ? "review" : "ready" },
      { label: t.fingerprint, value: input.valid ? input.fingerprint : t.blocked, state: input.valid ? "ready" : "blocked" },
      { label: t.status, value: delivery, state },
    ] satisfies Pass4495EnvelopeItem[],
  };
}
