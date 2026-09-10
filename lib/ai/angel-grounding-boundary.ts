export type AngelGroundingRow = Readonly<{
  citationId: `E${number}`;
  factId: string;
  label: string;
  value: string | number;
  observedAt: string;
  freshness: "fresh" | "aging" | "stale" | "unknown";
  quorumState: "confirmed" | "single_source" | "internal_only" | "missing" | "stale" | "conflicted";
  sourceIds: string[];
  providerFamilies: string[];
  receiptIds: string[];
}>;

export type AngelProviderGroundingPreflight = Readonly<{
  schemaVersion: "velmere.angel.provider-grounding-preflight.v1";
  required: boolean;
  allowed: boolean;
  state: "NOT_REQUIRED" | "WITHHELD" | "ELIGIBLE";
  reason: string;
  rows: AngelGroundingRow[];
  allowedCitationIds: string[];
  currentness: "NOT_APPLICABLE" | "CURRENT" | "WITHHELD";
}>;

type SourceHealth = {
  evidenceQuorum?: string | null;
  integrity?: string | null;
  temporal?: string | null;
} | null;

const EVIDENCE_BOUND_LANES = new Set(["markets", "audit", "pdf"]);
const MAX_CURRENT_ROW_AGE_MS = 6 * 60 * 60_000;
const CLAIM_LANE_RULES = [
  { lane: "price", text: /\b(price|cena|kurs|preis)\b/i, factId: /(?:^|[-_.])price(?:$|[-_.])|price-change/i },
  { lane: "volume", text: /\b(volume|wolumen|volumen)\b/i, factId: /volume/i },
  { lane: "market_cap", text: /market\s*cap|kapitalizac|marktkapitalisierung|\bfdv\b/i, factId: /market-cap|fdv/i },
  { lane: "liquidity", text: /liquid|płynno|plynno|liquidität|spread|slippage|order\s*book|orderbook/i, factId: /liquid|slippage|spread|orderbook|market-depth/i },
  { lane: "holders_supply", text: /holder|supply|concentration|koncentrac|konzentration|angebot/i, factId: /holder|supply|concentration/i },
  { lane: "contract_admin", text: /contract|kontrakt|vertrag|admin|honeypot|blacklist|mint|sell\s*tax|buy\s*tax/i, factId: /contract|admin|honeypot|blacklist|mint|sell-tax|buy-tax/i },
  { lane: "risk_conclusion", text: /\b(safe|secure|unsafe|critical|risk|ryzy|sicher|risiko|exploit|rug\s*pull|squeeze)\b/i, factId: /risk-score|risk-verdict/i },
  { lane: "audit_conclusion", text: /audit(?:ed|\s+complete)?|audyt|prüfung|zertifiz|certif|vulnerab|podatno|schwachstelle/i, factId: /audit-status|finding|vulnerability/i },
] as const;

function clean(value: unknown, maximum = 180) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[<>\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function unique(values: readonly unknown[], maximum = 32) {
  return Array.from(new Set(values.map((value) => clean(value)).filter(Boolean))).slice(0, maximum);
}

function eligibleRow(row: AngelGroundingRow, nowMs: number) {
  const observedAtMs = Date.parse(row.observedAt);
  const ageMs = nowMs - observedAtMs;
  return /^E(?:[1-9]|[12]\d|3[0-2])$/.test(row.citationId)
    && Boolean(clean(row.factId, 100))
    && Boolean(clean(row.label, 180))
    && (typeof row.value === "number" ? Number.isFinite(row.value) : Boolean(clean(row.value, 500)))
    && row.quorumState === "confirmed"
    && row.freshness === "fresh"
    && unique(row.sourceIds, 8).length >= 2
    && unique(row.providerFamilies, 8).length >= 2
    && unique(row.receiptIds, 8).length >= 2
    && Number.isFinite(observedAtMs)
    && ageMs >= -60_000
    && ageMs <= MAX_CURRENT_ROW_AGE_MS;
}

export function buildAngelProviderGroundingPreflight(input: {
  runtimeLane: string;
  authorityVerified: boolean;
  authorityReason?: string | null;
  providers?: string[] | null;
  sourceHealth?: SourceHealth;
  conflicts?: string[] | null;
  rows?: AngelGroundingRow[] | null;
  nowMs?: number;
}): AngelProviderGroundingPreflight {
  const required = EVIDENCE_BOUND_LANES.has(clean(input.runtimeLane, 32).toLowerCase());
  if (!required) {
    return {
      schemaVersion: "velmere.angel.provider-grounding-preflight.v1",
      required: false,
      allowed: true,
      state: "NOT_REQUIRED",
      reason: "trusted_non_evidence_conversation_lane",
      rows: [],
      allowedCitationIds: [],
      currentness: "NOT_APPLICABLE",
    };
  }

  const nowMs = Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now();
  const providers = unique(input.providers ?? [], 12);
  const conflicts = unique(input.conflicts ?? [], 12);
  const sourceHealth = input.sourceHealth ?? null;
  const exactRows = (input.rows ?? []).filter((row) => eligibleRow(row, nowMs)).slice(0, 24);
  const distinctCitationIds = unique(exactRows.map((row) => row.citationId), 24);

  let reason = "eligible_exact_current_grounding";
  if (!input.authorityVerified) {
    reason = clean(input.authorityReason, 160) || "server_signed_analysis_required";
  } else if (conflicts.length > 0) {
    reason = "evidence_conflict_unresolved";
  } else if (sourceHealth?.evidenceQuorum !== "strong") {
    reason = "evidence_quorum_not_strong";
  } else if (sourceHealth?.integrity !== "trusted") {
    reason = "evidence_integrity_not_trusted";
  } else if (sourceHealth?.temporal !== "current") {
    reason = "evidence_temporal_state_not_current";
  } else if (providers.length < 2) {
    reason = "independent_provider_family_gap";
  } else if (exactRows.length === 0 || distinctCitationIds.length !== exactRows.length) {
    reason = "exact_evidence_rows_missing";
  }

  const allowed = reason === "eligible_exact_current_grounding";
  return {
    schemaVersion: "velmere.angel.provider-grounding-preflight.v1",
    required: true,
    allowed,
    state: allowed ? "ELIGIBLE" : "WITHHELD",
    reason,
    rows: allowed ? exactRows : [],
    allowedCitationIds: allowed ? distinctCitationIds : [],
    currentness: allowed ? "CURRENT" : "WITHHELD",
  };
}

function numericTokens(value: string) {
  return Array.from(value.matchAll(/(?<![A-Za-z])[-+]?\d+(?:[.,]\d+)?%?/g), (match) => match[0])
    .map((token) => token.replace(/%$/, "").replace(",", ".").replace(/^\+/, ""));
}

function rowAllowedNumbers(row: AngelGroundingRow) {
  const values = new Set(numericTokens(String(row.value)));
  const year = row.observedAt.match(/^(\d{4})-/)?.[1];
  if (year) values.add(year);
  return values;
}

export function inspectAngelGroundedProviderOutput(input: {
  text: string;
  preflight: AngelProviderGroundingPreflight;
}) {
  if (!input.preflight.required) {
    return {
      schemaVersion: "velmere.angel.provider-grounding-output.v1" as const,
      allowed: true,
      reasons: [] as string[],
      citationsUsed: [] as string[],
      groundedRowCount: 0,
    };
  }
  if (!input.preflight.allowed) {
    return {
      schemaVersion: "velmere.angel.provider-grounding-output.v1" as const,
      allowed: false,
      reasons: [`preflight_withheld:${input.preflight.reason}`],
      citationsUsed: [] as string[],
      groundedRowCount: 0,
    };
  }

  const text = clean(input.text, 7_200);
  const citationsUsed = unique(Array.from(text.matchAll(/\[(E\d{1,2})\]/g), (match) => match[1]), 32);
  const allowedIds = new Set(input.preflight.allowedCitationIds);
  const unknown = citationsUsed.filter((citation) => !allowedIds.has(citation));
  const reasons: string[] = [];
  if (!text || citationsUsed.length === 0) reasons.push("citation_required");
  for (const citation of unknown) reasons.push(`unknown_citation:${citation}`);

  const citedRows = input.preflight.rows.filter((row) => citationsUsed.includes(row.citationId));
  const allowedNumbers = new Set(citedRows.flatMap((row) => Array.from(rowAllowedNumbers(row))));
  const textWithoutCitations = text.replace(/\[E\d{1,2}\]/g, "");
  for (const number of numericTokens(textWithoutCitations)) {
    if (!allowedNumbers.has(number)) reasons.push(`numeric_claim_not_bound:${number}`);
  }
  for (const sentence of text.split(/(?<=[.!?])\s+/).map((value) => value.trim()).filter(Boolean)) {
    const sentenceCitationIds = unique(Array.from(sentence.matchAll(/\[(E\d{1,2})\]/g), (match) => match[1]), 16);
    const sentenceRows = input.preflight.rows.filter((row) => sentenceCitationIds.includes(row.citationId));
    for (const rule of CLAIM_LANE_RULES) {
      if (!rule.text.test(sentence)) continue;
      if (!sentenceRows.some((row) => rule.factId.test(row.factId))) {
        reasons.push(`claim_lane_not_bound:${rule.lane}`);
      }
    }
  }

  const uniqueReasons = unique(reasons, 24);
  return {
    schemaVersion: "velmere.angel.provider-grounding-output.v1" as const,
    allowed: uniqueReasons.length === 0,
    reasons: uniqueReasons,
    citationsUsed,
    groundedRowCount: citedRows.length,
  };
}
