export type Pass4494Locale = "pl" | "en" | "de";
export type Pass4494State = "ready" | "watch" | "locked";
export type Pass4494AuditKind = "website" | "repo" | "contract" | "unknown";
export type Pass4494Tier = "basic" | "pro" | "advanced";

export type Pass4494PacketItem = {
  label: string;
  value: string;
  state: Pass4494State;
};

const copy = {
  pl: {
    badge: "PASS4494",
    assetTitle: "Customer proof packet",
    assetSubtitle: "Krótki pakiet klienta pokazuje, co można bezpiecznie pokazać dalej: zakres, redakcje, źródła i status dowodu.",
    packet: "Packet",
    scope: "Zakres",
    redaction: "Redakcja",
    share: "Share state",
    full: "full proof",
    limited: "limited proof",
    blocked: "source gap",
    redacted: "redacted",
    clean: "clean",
    source: "source-bound",
    pending: "pending source",
    shieldTitle: "Export packet readiness",
    shieldSubtitle: "Shield Pro liczy, ile aktualnie widocznych wierszy może wejść do pakietu klienta bez claimów ponad dowody.",
    rows: "Rows",
    exportable: "Exportable",
    needsReview: "Needs review",
    locked: "Locked",
    auditTitle: "Submission packet",
    auditSubtitle: "Intake ma czytelny pakiet przed wysyłką: fingerprint, zakres, redakcje i delivery state bez fake backendu.",
    fingerprint: "Fingerprint",
    tier: "Plan",
    delivery: "Delivery",
    invalid: "needs input",
    staged: "staged packet",
    vault: "case vault required",
    publicOnly: "public preview",
  },
  en: {
    badge: "PASS4494",
    assetTitle: "Customer proof packet",
    assetSubtitle: "A compact customer packet shows what can safely be carried forward: scope, redactions, sources and proof status.",
    packet: "Packet",
    scope: "Scope",
    redaction: "Redaction",
    share: "Share state",
    full: "full proof",
    limited: "limited proof",
    blocked: "source gap",
    redacted: "redacted",
    clean: "clean",
    source: "source-bound",
    pending: "pending source",
    shieldTitle: "Export packet readiness",
    shieldSubtitle: "Shield Pro counts how many currently visible rows can enter a customer packet without claims beyond evidence.",
    rows: "Rows",
    exportable: "Exportable",
    needsReview: "Needs review",
    locked: "Locked",
    auditTitle: "Submission packet",
    auditSubtitle: "The intake has a clear pre-submit packet: fingerprint, scope, redactions and delivery state without fake backend claims.",
    fingerprint: "Fingerprint",
    tier: "Plan",
    delivery: "Delivery",
    invalid: "needs input",
    staged: "staged packet",
    vault: "case vault required",
    publicOnly: "public preview",
  },
  de: {
    badge: "PASS4494",
    assetTitle: "Customer Proof Packet",
    assetSubtitle: "Ein kompaktes Kundenpaket zeigt, was sicher weitergegeben werden kann: Scope, Redactions, Quellen und Proof-Status.",
    packet: "Packet",
    scope: "Scope",
    redaction: "Redaction",
    share: "Share State",
    full: "Full Proof",
    limited: "Limited Proof",
    blocked: "Source Gap",
    redacted: "redacted",
    clean: "clean",
    source: "source-bound",
    pending: "pending source",
    shieldTitle: "Export Packet Readiness",
    shieldSubtitle: "Shield Pro zählt, wie viele sichtbare Zeilen in ein Kundenpaket können, ohne Claims über die Evidenz hinaus.",
    rows: "Rows",
    exportable: "Exportable",
    needsReview: "Needs Review",
    locked: "Locked",
    auditTitle: "Submission Packet",
    auditSubtitle: "Der Intake hat ein klares Pre-submit Packet: Fingerprint, Scope, Redactions und Delivery State ohne Fake Backend Claims.",
    fingerprint: "Fingerprint",
    tier: "Plan",
    delivery: "Delivery",
    invalid: "needs input",
    staged: "staged packet",
    vault: "Case Vault erforderlich",
    publicOnly: "Public Preview",
  },
} as const;

function safeLocale(locale: string): Pass4494Locale {
  return locale === "pl" || locale === "de" ? locale : "en";
}

function numericPercent(label?: string | null) {
  if (!label) return null;
  const match = label.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
}

function packetId(prefix: string, seed: string) {
  let hash = 5381;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash, 33) ^ seed.charCodeAt(index);
  }
  return `${prefix}-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

export function buildPass4494AssetCustomerPacket(input: {
  locale: string;
  symbol: string;
  surface: string;
  riskLabel?: string | null;
  confidenceLabel?: string | null;
  sourceLabel?: string | null;
  sourceTimeLabel?: string | null;
  candleCount: number;
  remoteReady: boolean;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const risk = numericPercent(input.riskLabel) ?? (input.riskLabel?.toLowerCase().includes("high") ? 82 : 42);
  const confidence = numericPercent(input.confidenceLabel) ?? 58;
  const proofGaps = [
    input.candleCount < 30,
    !input.sourceTimeLabel,
    !(input.sourceLabel || input.remoteReady),
  ].filter(Boolean).length;
  const state: Pass4494State = proofGaps >= 2 ? "locked" : proofGaps === 1 || risk >= 72 || confidence < 55 ? "watch" : "ready";
  const scope = state === "ready" ? t.full : state === "watch" ? t.limited : t.blocked;
  const redaction = state === "ready" ? t.clean : t.redacted;
  const sourceState = input.sourceLabel || input.remoteReady ? t.source : t.pending;

  return {
    title: t.assetTitle,
    subtitle: t.assetSubtitle,
    badge: t.badge,
    state,
    items: [
      { label: t.packet, value: packetId("VLM-ASSET", `${input.symbol}:${input.surface}:${input.candleCount}:${sourceState}`), state },
      { label: t.scope, value: `${input.surface} · ${scope}`, state },
      { label: t.redaction, value: redaction, state: redaction === t.clean ? "ready" : "watch" },
      { label: t.share, value: sourceState, state: sourceState === t.source ? "ready" : "locked" },
    ] satisfies Pass4494PacketItem[],
  };
}

export function buildPass4494ShieldProExportPacket(input: {
  locale: string;
  visibleRows: Array<{ symbol: string; integrity: number; liquidity: number; manipulation: number; squeeze: number; evidence: number }>;
  totalCount: number;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const visible = input.visibleRows.length;
  const exportable = input.visibleRows.filter((row) => row.evidence >= 82 && row.integrity >= 70 && row.manipulation < 55 && row.squeeze < 72).length;
  const review = input.visibleRows.filter((row) => row.evidence >= 55 && (row.manipulation >= 55 || row.squeeze >= 72 || row.integrity < 70 || row.liquidity < 48)).length;
  const locked = Math.max(0, visible - exportable - review);
  const state: Pass4494State = visible === 0 || locked > exportable ? "locked" : review || locked ? "watch" : "ready";
  const symbols = input.visibleRows.slice(0, 6).map((row) => row.symbol).join("|") || "none";

  return {
    title: t.shieldTitle,
    subtitle: t.shieldSubtitle,
    badge: t.badge,
    state,
    items: [
      { label: t.packet, value: packetId("VLM-PRO", `${symbols}:${visible}:${exportable}:${review}:${locked}`), state },
      { label: t.rows, value: `${visible}/${input.totalCount}`, state: visible ? "ready" : "locked" },
      { label: t.exportable, value: `${exportable}`, state: exportable ? "ready" : visible ? "watch" : "locked" },
      { label: t.needsReview, value: `${review}`, state: review ? "watch" : visible ? "ready" : "locked" },
      { label: t.locked, value: `${locked}`, state: locked ? "locked" : visible ? "ready" : "locked" },
    ] satisfies Pass4494PacketItem[],
  };
}

export function buildPass4494AuditSubmissionPacket(input: {
  locale: string;
  kind: Pass4494AuditKind;
  tier: Pass4494Tier;
  valid: boolean;
  queued: boolean;
  fingerprint: string;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const state: Pass4494State = !input.valid ? "locked" : input.queued ? "ready" : "watch";
  const delivery = !input.valid ? t.invalid : input.queued && input.tier !== "basic" ? t.vault : input.queued ? t.staged : t.publicOnly;
  return {
    title: t.auditTitle,
    subtitle: t.auditSubtitle,
    badge: t.badge,
    state,
    items: [
      { label: t.fingerprint, value: input.valid ? input.fingerprint : t.invalid, state: input.valid ? "ready" : "locked" },
      { label: t.scope, value: input.valid ? input.kind : t.invalid, state: input.valid ? "ready" : "locked" },
      { label: t.tier, value: input.tier, state: input.tier === "advanced" ? "watch" : "ready" },
      { label: t.delivery, value: delivery, state },
    ] satisfies Pass4494PacketItem[],
  };
}
