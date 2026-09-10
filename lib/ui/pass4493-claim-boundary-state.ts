export type Pass4493Locale = "pl" | "en" | "de";
export type Pass4493State = "ready" | "watch" | "locked";
export type Pass4493AuditKind = "website" | "repo" | "contract" | "unknown";
export type Pass4493Tier = "basic" | "pro" | "advanced";

export type Pass4493RailItem = {
  label: string;
  value: string;
  state: Pass4493State;
};

const copy = {
  pl: {
    badge: "PASS4493",
    assetTitle: "Claim boundary",
    assetSubtitle: "Widoczna granica wniosków: wykres, analiza i PDF nie brzmią pewniej niż pozwala proof.",
    risk: "Risk label",
    confidence: "Confidence",
    publicClaim: "Public claim",
    proofCap: "Proof cap",
    full: "pełny kontekst",
    limited: "kontekst limitowany",
    sourceLimited: "source-limited",
    candles: "świece",
    timestamp: "timestamp",
    provider: "provider",
    ready: "ready",
    review: "manual review",
    hold: "hold proof",
    shieldTitle: "Claim quality",
    shieldSubtitle: "Shield Pro pokazuje, czy aktualny filtr może iść do raportu, czy wymaga redakcji / manual review.",
    coverage: "Coverage",
    redactions: "Redactions",
    manual: "Manual review",
    evidence: "Evidence",
    none: "brak",
    auditTitle: "Claim preflight",
    auditSubtitle: "Audyt pokazuje granicę claimu przed submit: typ inputu, plan, receipt i delivery boundary.",
    input: "Input",
    tier: "Plan",
    receipt: "Receipt",
    delivery: "Delivery",
    paste: "wklej URL/repo/contract",
    staged: "staged",
    vault: "case vault required",
    publicOnly: "public preview only",
  },
  en: {
    badge: "PASS4493",
    assetTitle: "Claim boundary",
    assetSubtitle: "Visible conclusion boundary: chart, analysis and PDF copy never sound stronger than the proof allows.",
    risk: "Risk label",
    confidence: "Confidence",
    publicClaim: "Public claim",
    proofCap: "Proof cap",
    full: "full context",
    limited: "limited context",
    sourceLimited: "source-limited",
    candles: "candles",
    timestamp: "timestamp",
    provider: "provider",
    ready: "ready",
    review: "manual review",
    hold: "hold proof",
    shieldTitle: "Claim quality",
    shieldSubtitle: "Shield Pro shows whether the current filter can enter a report or needs redaction / manual review.",
    coverage: "Coverage",
    redactions: "Redactions",
    manual: "Manual review",
    evidence: "Evidence",
    none: "none",
    auditTitle: "Claim preflight",
    auditSubtitle: "Audit exposes the claim boundary before submit: input kind, plan, receipt and delivery boundary.",
    input: "Input",
    tier: "Plan",
    receipt: "Receipt",
    delivery: "Delivery",
    paste: "paste URL/repo/contract",
    staged: "staged",
    vault: "case vault required",
    publicOnly: "public preview only",
  },
  de: {
    badge: "PASS4493",
    assetTitle: "Claim Boundary",
    assetSubtitle: "Sichtbare Schlussfolgerungs-Grenze: Chart, Analyse und PDF klingen nie stärker als der Proof erlaubt.",
    risk: "Risk Label",
    confidence: "Confidence",
    publicClaim: "Public Claim",
    proofCap: "Proof Cap",
    full: "voller Kontext",
    limited: "limitierter Kontext",
    sourceLimited: "source-limited",
    candles: "Candles",
    timestamp: "Timestamp",
    provider: "Provider",
    ready: "ready",
    review: "Manual Review",
    hold: "Proof halten",
    shieldTitle: "Claim Quality",
    shieldSubtitle: "Shield Pro zeigt, ob der aktuelle Filter in einen Report kann oder Redaction / Manual Review braucht.",
    coverage: "Coverage",
    redactions: "Redactions",
    manual: "Manual Review",
    evidence: "Evidence",
    none: "keine",
    auditTitle: "Claim Preflight",
    auditSubtitle: "Audit zeigt vor dem Submit die Claim-Grenze: Input-Typ, Plan, Receipt und Delivery Boundary.",
    input: "Input",
    tier: "Plan",
    receipt: "Receipt",
    delivery: "Delivery",
    paste: "URL/Repo/Contract einfügen",
    staged: "staged",
    vault: "Case Vault erforderlich",
    publicOnly: "nur Public Preview",
  },
} as const;

function safeLocale(locale: string): Pass4493Locale {
  return locale === "pl" || locale === "de" ? locale : "en";
}

function numericPercent(label?: string | null) {
  if (!label) return null;
  const match = label.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
}

function stateFromProof(missing: number, risk: number, confidence: number): Pass4493State {
  if (missing >= 2) return "locked";
  if (missing === 1 || risk >= 72 || confidence < 55) return "watch";
  return "ready";
}

export function buildPass4493AssetClaimBoundary(input: {
  locale: string;
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
  const risk = numericPercent(input.riskLabel) ?? (input.riskLabel?.toLowerCase().includes("high") ? 82 : 44);
  const confidence = numericPercent(input.confidenceLabel) ?? 58;
  const missing = [
    input.candleCount < 30 ? t.candles : null,
    !input.sourceTimeLabel ? t.timestamp : null,
    !(input.sourceLabel || input.remoteReady) ? t.provider : null,
  ].filter(Boolean) as string[];
  const state = stateFromProof(missing.length, risk, confidence);
  const publicClaim = state === "ready" ? t.full : state === "watch" ? t.limited : t.sourceLimited;
  const cap = state === "ready" ? t.ready : state === "watch" ? t.review : t.hold;
  return {
    title: t.assetTitle,
    subtitle: t.assetSubtitle,
    badge: t.badge,
    state,
    items: [
      { label: t.risk, value: input.riskLabel ?? "—", state: risk >= 72 ? "watch" : "ready" },
      { label: t.confidence, value: input.confidenceLabel ?? `${confidence}%`, state: confidence < 55 ? "watch" : "ready" },
      { label: t.publicClaim, value: `${input.surface} · ${publicClaim}`, state },
      { label: t.proofCap, value: missing.length ? missing.join(" · ") : cap, state: missing.length ? "locked" : state },
    ] satisfies Pass4493RailItem[],
  };
}

export function buildPass4493ShieldProClaimBoundary(input: {
  locale: string;
  visibleRows: Array<{ integrity: number; liquidity: number; manipulation: number; squeeze: number; evidence: number }>;
  totalCount: number;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const visible = input.visibleRows.length;
  const avgEvidence = visible ? Math.round(input.visibleRows.reduce((sum, row) => sum + row.evidence, 0) / visible) : 0;
  const manual = input.visibleRows.filter((row) => row.manipulation >= 55 || row.squeeze >= 70 || row.integrity < 68).length;
  const redactions = input.visibleRows.filter((row) => row.evidence < 78 || row.liquidity < 48).length;
  const state: Pass4493State = visible === 0 ? "locked" : manual || redactions ? "watch" : "ready";
  return {
    title: t.shieldTitle,
    subtitle: t.shieldSubtitle,
    badge: t.badge,
    state,
    items: [
      { label: t.coverage, value: `${visible}/${input.totalCount}`, state: visible ? "ready" : "locked" },
      { label: t.evidence, value: visible ? `${avgEvidence}%` : "—", state: avgEvidence >= 82 ? "ready" : visible ? "watch" : "locked" },
      { label: t.redactions, value: redactions ? `${redactions}` : t.none, state: redactions ? "watch" : visible ? "ready" : "locked" },
      { label: t.manual, value: manual ? `${manual}` : t.none, state: manual ? "watch" : visible ? "ready" : "locked" },
    ] satisfies Pass4493RailItem[],
  };
}

export function buildPass4493AuditClaimPreflight(input: {
  locale: string;
  kind: Pass4493AuditKind;
  tier: Pass4493Tier;
  valid: boolean;
  queued: boolean;
}) {
  const locale = safeLocale(input.locale);
  const t = copy[locale];
  const state: Pass4493State = !input.valid ? "locked" : input.queued ? "ready" : "watch";
  const tierValue = input.tier === "advanced" ? `${input.tier} · ${t.vault}` : input.tier;
  return {
    title: t.auditTitle,
    subtitle: t.auditSubtitle,
    badge: t.badge,
    state,
    items: [
      { label: t.input, value: input.valid ? input.kind : t.paste, state: input.valid ? "ready" : "locked" },
      { label: t.tier, value: tierValue, state: input.tier === "advanced" ? "watch" : "ready" },
      { label: t.receipt, value: input.queued ? t.staged : input.valid ? t.publicOnly : t.hold, state: input.queued ? "ready" : input.valid ? "watch" : "locked" },
      { label: t.delivery, value: input.queued && input.tier !== "basic" ? t.vault : t.publicOnly, state: input.queued && input.tier !== "basic" ? "watch" : state },
    ] satisfies Pass4493RailItem[],
  };
}
