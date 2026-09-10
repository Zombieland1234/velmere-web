import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  buildCustomerReportSourceBinding,
  getPass4993SourceReceiptProjectionReadiness,
  verifyPass4993SourceReceiptProjection,
} from "@/lib/market-integrity/customer-report-source-binding";
import {
  isPass4644CommerciallyFreshReceipt,
  pass4644FieldValueHash,
  verifyPass4644ProviderEvidenceReceiptIntegrity,
  type Pass4644ProviderEvidenceReceipt,
} from "@/lib/market-integrity/provider-evidence-receipt";
import { analyzeTokenRisk } from "@/lib/market-integrity/risk-engine";
import type { TokenRiskInput, TokenRiskResult } from "@/lib/market-integrity/risk-types";
import type { SourceReceipt } from "@/lib/market-integrity/top1-risk-foundation";
import type { MarketIntegrityRow } from "@/lib/market-integrity/market-row-types";
import { buildMarketRowEvidencePayload } from "@/lib/market-integrity/market-row-evidence-payload";
import { getP99RealMarketsFieldContract, type RealMarketsFieldSemanticClass } from "@/lib/market-integrity/real-markets-basic-field-policy";

export const MARKET_ROW_DELIVERY_GATE_ID = "velmere.p99.market-row-delivery-gate.v2" as const;

export type MarketDeliveryTier = "basic" | "pro" | "advanced";
export type MarketFieldState =
  | "verified"
  | "unavailable"
  | "missing"
  | "integrity_failed"
  | "identity_mismatch"
  | "stale"
  | "unsigned"
  | "unbound"
  | "field_mismatch"
  | "low_quality"
  | "quorum_shortfall"
  | "derivation_mismatch";

export type MarketDeliveryFieldReceipt = {
  fieldId: string;
  evidencePath: string;
  state: MarketFieldState;
  required: boolean;
  valueAvailable: boolean;
  valueHash: string;
  sourceAsOf: string | null;
  receiptId: string | null;
  receiptIds: string[];
  upstreamCount: number;
  requiredUpstreamCount: number;
  providerIds: string[];
  projectionPayloadDigests: string[];
  blocker: string | null;
  semanticClass: RealMarketsFieldSemanticClass;
  unit: string;
  currency: string | null;
  venueScope: "aggregated_multi_venue_reference";
  executionEligible: false;
  currentnessClass: "provider_timestamped_reference";
  maxAgeSeconds: number;
  liveClaimed: false;
  executableQuoteClaimed: false;
};

export type MarketRiskDeliveryReceipt = {
  state: MarketFieldState;
  score: number | null;
  confidencePercent: number | null;
  sourceAsOf: string | null;
  receiptId: string | null;
  receiptIds: string[];
  upstreamCount: number;
  requiredUpstreamCount: number;
  inputFieldCount: number;
  verifiedInputFieldCount: number;
  inputRoot: string;
  outputDigest: string | null;
  derivationDigest: string | null;
  formulaId: string | null;
  blocker: string | null;
};

export type MarketRowDeliveryReceipt = {
  schemaVersion: typeof MARKET_ROW_DELIVERY_GATE_ID;
  canonicalIdentity: string;
  tier: MarketDeliveryTier;
  state: "verified" | "withheld";
  completenessBps: number;
  requiredFieldCount: number;
  completeFieldCount: number;
  requiredUpstreamCount: number;
  verifiedProviderIds: string[];
  sourceReceiptRoot: string;
  sourceReceiptCount: number;
  projectionSigningReady: boolean;
  fields: Record<string, MarketDeliveryFieldReceipt>;
  risk: MarketRiskDeliveryReceipt;
  blockers: string[];
  receiptDigest: string;
};

type FieldSpec = {
  fieldId: string;
  evidencePath: string;
  required: boolean;
  read: (row: MarketIntegrityRow) => unknown;
};

const FIELD_SPECS: readonly FieldSpec[] = Object.freeze([
  { fieldId: "identity.market_id", evidencePath: "identity.marketId", required: true, read: (row) => row.id },
  { fieldId: "identity.symbol", evidencePath: "identity.symbol", required: true, read: (row) => row.symbol },
  { fieldId: "identity.name", evidencePath: "identity.name", required: true, read: (row) => row.name },
  { fieldId: "market.rank", evidencePath: "market.rank", required: true, read: (row) => row.rank ?? null },
  { fieldId: "market.image", evidencePath: "market.image", required: false, read: (row) => row.image ?? null },
  { fieldId: "market.price", evidencePath: "market.price", required: true, read: (row) => row.price ?? null },
  { fieldId: "market.change_1h", evidencePath: "market.priceChange1h", required: false, read: (row) => row.priceChange1h ?? null },
  { fieldId: "market.change_24h", evidencePath: "market.priceChange24h", required: true, read: (row) => row.priceChange24h ?? null },
  { fieldId: "market.change_7d", evidencePath: "market.priceChange7d", required: false, read: (row) => row.priceChange7d ?? null },
  { fieldId: "market.change_14d", evidencePath: "market.priceChange14d", required: false, read: (row) => row.priceChange14d ?? null },
  { fieldId: "market.change_30d", evidencePath: "market.priceChange30d", required: false, read: (row) => row.priceChange30d ?? null },
  { fieldId: "market.market_cap", evidencePath: "market.marketCap", required: true, read: (row) => row.marketCap ?? null },
  { fieldId: "market.fdv", evidencePath: "market.fdv", required: false, read: (row) => row.fdv ?? null },
  { fieldId: "market.volume_24h", evidencePath: "market.volume24h", required: true, read: (row) => row.volume24h ?? null },
  { fieldId: "market.high_24h", evidencePath: "market.high24h", required: false, read: (row) => row.high24h ?? null },
  { fieldId: "market.low_24h", evidencePath: "market.low24h", required: false, read: (row) => row.low24h ?? null },
  { fieldId: "market.observed_at", evidencePath: "market.observedAt", required: true, read: (row) => row.observedAt ?? null },
  { fieldId: "market.ath", evidencePath: "market.ath", required: false, read: (row) => row.ath ?? null },
  { fieldId: "market.ath_change", evidencePath: "market.athChangePercent", required: false, read: (row) => row.athChangePercent ?? null },
  { fieldId: "market.circulating_supply", evidencePath: "market.circulatingSupply", required: false, read: (row) => row.circulatingSupply ?? null },
  { fieldId: "market.total_supply", evidencePath: "market.totalSupply", required: false, read: (row) => row.totalSupply ?? null },
  { fieldId: "market.max_supply", evidencePath: "market.maxSupply", required: false, read: (row) => row.maxSupply ?? null },
  { fieldId: "market.sparkline_7d", evidencePath: "market.sparkline7d", required: false, read: (row) => row.sparkline7d },
]);

const RISK_INPUT_PATHS = Object.freeze([
  "identity.marketId",
  "identity.symbol",
  "identity.name",
  "market.rank",
  "market.image",
  "market.price",
  "market.priceChange1h",
  "market.priceChange24h",
  "market.priceChange7d",
  "market.priceChange14d",
  "market.priceChange30d",
  "market.marketCap",
  "market.fdv",
  "market.volume24h",
  "market.ath",
  "market.circulatingSupply",
  "market.totalSupply",
  "market.maxSupply",
  "market.sparkline7d",
]);

const FIELD_ID_BY_EVIDENCE_PATH = new Map(
  FIELD_SPECS.map((spec) => [spec.evidencePath, spec.fieldId] as const),
);

const REQUIRED_UPSTREAMS: Readonly<Record<MarketDeliveryTier, number>> = Object.freeze({
  basic: 1,
  pro: 2,
  advanced: 3,
});

const QUALITY_FLOOR: Readonly<Record<MarketDeliveryTier, number>> = Object.freeze({
  basic: 60,
  pro: 80,
  advanced: 90,
});

function asProviderReceipts(row: MarketIntegrityRow) {
  return (row.result.providerEvidenceReceipts ?? []) as Pass4644ProviderEvidenceReceipt[];
}

function cleanCanonicalIdentity(row: MarketIntegrityRow) {
  return `market:${row.id.trim().toLowerCase()}`;
}

function evidenceValues(row: MarketIntegrityRow): Record<string, unknown> {
  const payload = buildMarketRowEvidencePayload(row);
  return {
    "identity.marketId": payload.identity.marketId,
    "identity.symbol": payload.identity.symbol,
    "identity.name": payload.identity.name,
    "market.rank": payload.market.rank,
    "market.image": payload.market.image,
    "market.price": payload.market.price,
    "market.priceChange1h": payload.market.priceChange1h,
    "market.priceChange24h": payload.market.priceChange24h,
    "market.priceChange7d": payload.market.priceChange7d,
    "market.priceChange14d": payload.market.priceChange14d,
    "market.priceChange30d": payload.market.priceChange30d,
    "market.marketCap": payload.market.marketCap,
    "market.fdv": payload.market.fdv,
    "market.volume24h": payload.market.volume24h,
    "market.high24h": payload.market.high24h,
    "market.low24h": payload.market.low24h,
    "market.observedAt": payload.market.observedAt,
    "market.ath": payload.market.ath,
    "market.athChangePercent": payload.market.athChangePercent,
    "market.circulatingSupply": payload.market.circulatingSupply,
    "market.totalSupply": payload.market.totalSupply,
    "market.maxSupply": payload.market.maxSupply,
    "market.sparkline7d": payload.market.sparkline7d,
  };
}

function receiptUpstream(receipt: SourceReceipt) {
  return String(receipt.upstreamRoot ?? receipt.sourceFamily).trim().toLowerCase();
}

function contentReceiptKey(receipt: SourceReceipt) {
  return `${receiptUpstream(receipt)}:${String(receipt.payloadDigest ?? "").toLowerCase()}`;
}

function uniqueContentReceipts(receipts: readonly SourceReceipt[]) {
  const roots = new Set<string>();
  const payloads = new Set<string>();
  const output: SourceReceipt[] = [];
  for (const receipt of [...receipts].sort((left, right) => left.receiptId.localeCompare(right.receiptId))) {
    const root = receiptUpstream(receipt);
    const payload = String(receipt.payloadDigest ?? "").toLowerCase();
    if (!root || !payload || roots.has(root) || payloads.has(payload)) continue;
    roots.add(root);
    payloads.add(payload);
    output.push(receipt);
  }
  return output;
}

function oldestObservation(receipts: readonly SourceReceipt[]) {
  const timestamps = receipts
    .map((receipt) => receipt.observedAt)
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(left) - Date.parse(right));
  return timestamps[0] ?? null;
}

function unavailableState(args: {
  rawReceipts: readonly Pass4644ProviderEvidenceReceipt[];
  generatedAtMs: number;
  projectionReady: boolean;
}) : MarketFieldState {
  if (!args.rawReceipts.length) return "missing";
  const integral = args.rawReceipts.filter(verifyPass4644ProviderEvidenceReceiptIntegrity);
  if (!integral.length) return "integrity_failed";
  const identityMatched = integral.filter((receipt) => receipt.identity.matched === true);
  if (!identityMatched.length) return "identity_mismatch";
  const fresh = identityMatched.filter((receipt) =>
    isPass4644CommerciallyFreshReceipt(receipt, args.generatedAtMs));
  if (!fresh.length) return "stale";
  if (!args.projectionReady) return "unsigned";
  return "unbound";
}

function expectedCapability(path: string) {
  if (path === "identity.marketId" || path === "identity.symbol") return "identity";
  if (/priceChange|sparkline/u.test(path)) return "history";
  if (path === "market.marketCap") return "market_cap";
  if (/^market\.(?:fdv|circulatingSupply|totalSupply|maxSupply)$/u.test(path)) return "supply";
  if (path === "market.volume24h") return "volume";
  if (path === "market.price") return "price";
  return "unclassified";
}

function fieldReceipt(args: {
  fieldId: string;
  evidencePath: string;
  value: unknown;
  required: boolean;
  requireValue: boolean;
  contentReceipts: readonly SourceReceipt[];
  rawReceipts: readonly Pass4644ProviderEvidenceReceipt[];
  generatedAtMs: number;
  projectionReady: boolean;
  tier: MarketDeliveryTier;
}): MarketDeliveryFieldReceipt {
  const contract = getP99RealMarketsFieldContract(args.fieldId);
  const valueHash = pass4644FieldValueHash(args.value);
  const requiredUpstreamCount = REQUIRED_UPSTREAMS[args.tier];
  if (args.requireValue && (args.value === null || args.value === undefined || args.value === "")) {
    return {
      fieldId: args.fieldId,
      evidencePath: args.evidencePath,
      state: "missing",
      required: args.required,
      valueAvailable: false,
      valueHash,
      sourceAsOf: null,
      receiptId: null,
      receiptIds: [],
      upstreamCount: 0,
      requiredUpstreamCount,
      providerIds: [],
      projectionPayloadDigests: [],
      blocker: `required_value_missing:${args.evidencePath}`,
      semanticClass: contract.semanticClass,
      unit: contract.unit,
      currency: contract.currency,
      venueScope: contract.venueScope,
      executionEligible: false,
      currentnessClass: contract.currentnessClass,
      maxAgeSeconds: contract.maxAgeSeconds,
      liveClaimed: false,
      executableQuoteClaimed: false,
    };
  }

  const eligible = args.contentReceipts.filter((receipt) =>
    receipt.qualityScore >= QUALITY_FLOOR[args.tier]);
  const capability = expectedCapability(args.evidencePath);
  const pathPresent = eligible.some((receipt) =>
    (receipt.fieldEvidence ?? []).some((field) => field.fieldPath === args.evidencePath));
  const exact = uniqueContentReceipts(eligible.filter((receipt) =>
    (receipt.fieldEvidence ?? []).some((field) =>
      field.fieldPath === args.evidencePath
      && field.capability === capability
      && field.valueHash === valueHash)));
  let state: MarketFieldState;
  let blocker: string | null = null;
  if (!eligible.length) {
    state = args.contentReceipts.length ? "low_quality" : unavailableState(args);
    blocker = `${state}:${args.evidencePath}`;
  } else if (!exact.length) {
    state = pathPresent ? "field_mismatch" : "unbound";
    blocker = `${state}:${args.evidencePath}`;
  } else if (exact.length < requiredUpstreamCount) {
    state = "quorum_shortfall";
    blocker = `field_quorum:${args.evidencePath}:${exact.length}/${requiredUpstreamCount}`;
  } else {
    state = "verified";
  }
  const receiptIds = exact.map((receipt) => receipt.receiptId).sort();
  return {
    fieldId: args.fieldId,
    evidencePath: args.evidencePath,
    state,
    required: args.required,
    valueAvailable: args.value !== null && args.value !== undefined,
    valueHash,
    sourceAsOf: oldestObservation(exact),
    receiptId: receiptIds[0] ?? null,
    receiptIds,
    upstreamCount: exact.length,
    requiredUpstreamCount,
    providerIds: Array.from(new Set(exact.map((receipt) => receipt.provider))).sort(),
    projectionPayloadDigests: Array.from(new Set(exact.map((receipt) =>
      receipt.projection?.payloadDigest ?? "").filter(Boolean))).sort(),
    blocker,
    semanticClass: contract.semanticClass,
    unit: contract.unit,
    currency: contract.currency,
    venueScope: contract.venueScope,
    executionEligible: false,
    currentnessClass: contract.currentnessClass,
    maxAgeSeconds: contract.maxAgeSeconds,
    liveClaimed: false,
    executableQuoteClaimed: false,
  };
}

function riskInputFor(row: MarketIntegrityRow, verifiedProviders: string[]): TokenRiskInput {
  return {
    marketId: row.id,
    symbol: row.symbol,
    name: row.name,
    image: row.image,
    rank: row.rank,
    currentPrice: row.price,
    athPrice: row.ath,
    marketCap: row.marketCap,
    fdv: row.fdv,
    volume24h: row.volume24h,
    priceChange1h: row.priceChange1h,
    priceChange24h: row.priceChange24h,
    priceChange7d: row.priceChange7d,
    priceChange14d: row.priceChange14d,
    priceChange30d: row.priceChange30d,
    circulatingSupply: row.circulatingSupply,
    totalSupply: row.totalSupply,
    maxSupply: row.maxSupply,
    sparkline7d: row.sparkline7d,
    hadRebrandAfterCrash: false,
    dataSources: verifiedProviders,
  };
}

function riskOutputBinding(result: TokenRiskResult) {
  return {
    score: result.score,
    modelBinding: result.modelBinding ?? null,
    uncertainty: result.uncertainty ?? null,
    scoreFormula: result.scoreFormula ?? null,
    confidence: result.confidence ?? null,
    scoreBreakdown: result.scoreBreakdown ?? [],
    agentAssessments: result.agentAssessments ?? [],
    metaModel: result.metaModel ?? null,
    level: result.level,
    badge: result.badge,
    signals: result.signals,
    metrics: result.metrics,
    chart: result.chart ?? null,
  };
}

function statePriority(state: MarketFieldState) {
  const priorities: Record<MarketFieldState, number> = {
    integrity_failed: 12,
    identity_mismatch: 11,
    stale: 10,
    unsigned: 9,
    field_mismatch: 8,
    derivation_mismatch: 7,
    quorum_shortfall: 6,
    low_quality: 5,
    unbound: 4,
    missing: 3,
    unavailable: 2,
    verified: 1,
  };
  return priorities[state];
}

function worstState(receipts: readonly Pick<MarketDeliveryFieldReceipt, "state">[]) {
  return [...receipts].sort((left, right) => statePriority(right.state) - statePriority(left.state))[0]?.state ?? "missing";
}

function riskReceipt(args: {
  row: MarketIntegrityRow;
  values: Record<string, unknown>;
  contentReceipts: readonly SourceReceipt[];
  rawReceipts: readonly Pass4644ProviderEvidenceReceipt[];
  generatedAtMs: number;
  projectionReady: boolean;
  tier: MarketDeliveryTier;
  verifiedProviders: string[];
}): MarketRiskDeliveryReceipt {
  const resolvedInputs = RISK_INPUT_PATHS.map((path) => ({
    path,
    fieldId: FIELD_ID_BY_EVIDENCE_PATH.get(path),
  }));
  const missingContract = resolvedInputs.find((input) => !input.fieldId);
  if (missingContract) {
    return {
      state: "unavailable",
      score: null,
      confidencePercent: null,
      sourceAsOf: null,
      receiptId: null,
      receiptIds: [],
      upstreamCount: 0,
      requiredUpstreamCount: REQUIRED_UPSTREAMS[args.tier],
      inputFieldCount: resolvedInputs.length,
      verifiedInputFieldCount: 0,
      inputRoot: sha256Digest(canonicalJson(resolvedInputs)),
      outputDigest: null,
      derivationDigest: null,
      formulaId: null,
      blocker: `risk_input_contract_missing:${missingContract.path}`,
    };
  }
  const completeInputs = resolvedInputs.filter(
    (input): input is { path: string; fieldId: string } => typeof input.fieldId === "string",
  );
  const inputs = completeInputs.map(({ path, fieldId }) => fieldReceipt({
    fieldId,
    evidencePath: path,
    value: args.values[path],
    required: true,
    requireValue: false,
    contentReceipts: args.contentReceipts,
    rawReceipts: args.rawReceipts,
    generatedAtMs: args.generatedAtMs,
    projectionReady: args.projectionReady,
    tier: args.tier,
  }));
  const verifiedInputs = inputs.filter((input) => input.state === "verified");
  const receiptIds = Array.from(new Set(inputs.flatMap((input) => input.receiptIds))).sort();
  const sourceAsOf = inputs
    .map((input) => input.sourceAsOf)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null;
  const inputRoot = sha256Digest(canonicalJson(inputs.map((input) => ({
    evidencePath: input.evidencePath,
    valueHash: input.valueHash,
    receiptIds: input.receiptIds,
  }))));
  if (verifiedInputs.length !== inputs.length) {
    const state = worstState(inputs);
    return {
      state,
      score: null,
      confidencePercent: null,
      sourceAsOf,
      receiptId: receiptIds[0] ?? null,
      receiptIds,
      upstreamCount: Math.min(...inputs.map((input) => input.upstreamCount)),
      requiredUpstreamCount: REQUIRED_UPSTREAMS[args.tier],
      inputFieldCount: inputs.length,
      verifiedInputFieldCount: verifiedInputs.length,
      inputRoot,
      outputDigest: null,
      derivationDigest: null,
      formulaId: args.row.result.scoreFormula ?? null,
      blocker: inputs.find((input) => input.state !== "verified")?.blocker ?? "risk_input_unverified",
    };
  }

  try {
    const recomputed = analyzeTokenRisk(
      riskInputFor(args.row, args.verifiedProviders),
      args.row.result.dataQuality,
    );
    const expectedOutputDigest = sha256Digest(canonicalJson(riskOutputBinding(args.row.result)));
    const recomputedOutputDigest = sha256Digest(canonicalJson(riskOutputBinding(recomputed)));
    if (expectedOutputDigest !== recomputedOutputDigest) {
      return {
        state: "derivation_mismatch",
        score: null,
        confidencePercent: null,
        sourceAsOf,
        receiptId: receiptIds[0] ?? null,
        receiptIds,
        upstreamCount: Math.min(...inputs.map((input) => input.upstreamCount)),
        requiredUpstreamCount: REQUIRED_UPSTREAMS[args.tier],
        inputFieldCount: inputs.length,
        verifiedInputFieldCount: verifiedInputs.length,
        inputRoot,
        outputDigest: null,
        derivationDigest: null,
        formulaId: recomputed.scoreFormula ?? null,
        blocker: "risk_output_recomputation_mismatch",
      };
    }
    const derivationDigest = sha256Digest(canonicalJson({
      schemaVersion: MARKET_ROW_DELIVERY_GATE_ID,
      formulaId: recomputed.scoreFormula ?? null,
      modelBinding: recomputed.modelBinding ?? null,
      inputRoot,
      outputDigest: recomputedOutputDigest,
    }));
    return {
      state: "verified",
      score: recomputed.score,
      confidencePercent: typeof recomputed.confidence === "number"
        ? Math.max(0, Math.min(100, recomputed.confidence * 100))
        : null,
      sourceAsOf,
      receiptId: receiptIds[0] ?? null,
      receiptIds,
      upstreamCount: Math.min(...inputs.map((input) => input.upstreamCount)),
      requiredUpstreamCount: REQUIRED_UPSTREAMS[args.tier],
      inputFieldCount: inputs.length,
      verifiedInputFieldCount: verifiedInputs.length,
      inputRoot,
      outputDigest: recomputedOutputDigest,
      derivationDigest,
      formulaId: recomputed.scoreFormula ?? null,
      blocker: null,
    };
  } catch {
    return {
      state: "derivation_mismatch",
      score: null,
      confidencePercent: null,
      sourceAsOf,
      receiptId: receiptIds[0] ?? null,
      receiptIds,
      upstreamCount: Math.min(...inputs.map((input) => input.upstreamCount)),
      requiredUpstreamCount: REQUIRED_UPSTREAMS[args.tier],
      inputFieldCount: inputs.length,
      verifiedInputFieldCount: verifiedInputs.length,
      inputRoot,
      outputDigest: null,
      derivationDigest: null,
      formulaId: args.row.result.scoreFormula ?? null,
      blocker: "risk_output_recomputation_failed",
    };
  }
}

export function buildMarketRowDeliveryReceipt(args: {
  row: MarketIntegrityRow;
  tier?: MarketDeliveryTier;
  generatedAt: string;
  projectionEnv?: Record<string, string | undefined>;
}): MarketRowDeliveryReceipt {
  const tier = args.tier ?? "basic";
  const generatedAtMs = Date.parse(args.generatedAt);
  const safeGeneratedAtMs = Number.isFinite(generatedAtMs) ? generatedAtMs : Number.NaN;
  const canonicalIdentity = cleanCanonicalIdentity(args.row);
  const rawReceipts = asProviderReceipts(args.row);
  const projectionEnv = args.projectionEnv ?? process.env;
  const projectionSigningReady = getPass4993SourceReceiptProjectionReadiness(projectionEnv).ready;
  const binding = buildCustomerReportSourceBinding({
    providerEvidenceReceipts: rawReceipts,
    observedSourceLabels: args.row.result.dataSources,
    generatedAt: args.generatedAt,
    expectedCanonicalIdentity: canonicalIdentity,
    projectionEnv,
  });
  const contentReceipts = uniqueContentReceipts(binding.receipts.filter((receipt) =>
    receipt.evidenceState === "content_bound"
    && receipt.commercialEvidenceEligible === true
    && receipt.identityMatched === true
    && verifyPass4993SourceReceiptProjection({
      receipt,
      expectedCanonicalIdentity: canonicalIdentity,
      atTime: args.generatedAt,
      env: projectionEnv,
    }).ok));
  const values = evidenceValues(args.row);
  const fields = Object.fromEntries(FIELD_SPECS.map((spec) => [spec.fieldId, fieldReceipt({
    fieldId: spec.fieldId,
    evidencePath: spec.evidencePath,
    value: spec.read(args.row),
    required: spec.required,
    requireValue: spec.required,
    contentReceipts,
    rawReceipts,
    generatedAtMs: safeGeneratedAtMs,
    projectionReady: projectionSigningReady,
    tier,
  })]));
  const verifiedProviderIds = Array.from(new Set(contentReceipts.map((receipt) => receipt.provider))).sort();
  const risk = riskReceipt({
    row: args.row,
    values,
    contentReceipts,
    rawReceipts,
    generatedAtMs: safeGeneratedAtMs,
    projectionReady: projectionSigningReady,
    tier,
    verifiedProviders: verifiedProviderIds,
  });
  const riskMaxAgeSeconds = Math.min(
    ...Object.values(fields)
      .filter((field) => field.required)
      .map((field) => field.maxAgeSeconds),
  );
  fields["risk.score"] = {
    fieldId: "risk.score",
    evidencePath: "derived:risk.score",
    state: risk.state,
    required: true,
    valueAvailable: risk.score !== null,
    valueHash: risk.score === null ? pass4644FieldValueHash(null) : pass4644FieldValueHash(risk.score),
    sourceAsOf: risk.sourceAsOf,
    receiptId: risk.receiptId,
    receiptIds: risk.receiptIds,
    upstreamCount: risk.upstreamCount,
    requiredUpstreamCount: risk.requiredUpstreamCount,
    providerIds: verifiedProviderIds,
    projectionPayloadDigests: Array.from(new Set(contentReceipts.map((receipt) =>
      receipt.projection?.payloadDigest ?? "").filter(Boolean))).sort(),
    blocker: risk.blocker,
    semanticClass: "derived",
    unit: "risk_score_0_100",
    currency: null,
    venueScope: "aggregated_multi_venue_reference",
    executionEligible: false,
    currentnessClass: "provider_timestamped_reference",
    maxAgeSeconds: riskMaxAgeSeconds,
    liveClaimed: false,
    executableQuoteClaimed: false,
  };

  const requiredFields = Object.values(fields).filter((field) => field.required);
  const completeFieldCount = requiredFields.filter((field) => field.state === "verified").length;
  const completenessBps = requiredFields.length
    ? Math.floor((completeFieldCount * 10_000) / requiredFields.length)
    : 0;
  const blockers = Array.from(new Set([
    ...requiredFields.map((field) => field.blocker).filter((value): value is string => Boolean(value)),
    ...binding.blockers.filter((blocker) =>
      !blocker.startsWith("independent_content_bound_upstreams:") || tier !== "basic"),
    !Number.isFinite(generatedAtMs) ? "generated_at_invalid" : null,
  ].filter((value): value is string => Boolean(value)))).sort();
  const sourceReceiptRoot = sha256Digest(canonicalJson(contentReceipts.map((receipt) => ({
    key: contentReceiptKey(receipt),
    receiptId: receipt.receiptId,
    payloadDigest: receipt.payloadDigest,
    projection: receipt.projection,
    observedAt: receipt.observedAt,
    expiresAt: receipt.expiresAt,
  }))));
  const unsigned = {
    schemaVersion: MARKET_ROW_DELIVERY_GATE_ID,
    canonicalIdentity,
    tier,
    state: completeFieldCount === requiredFields.length ? "verified" as const : "withheld" as const,
    completenessBps,
    requiredFieldCount: requiredFields.length,
    completeFieldCount,
    requiredUpstreamCount: REQUIRED_UPSTREAMS[tier],
    verifiedProviderIds,
    sourceReceiptRoot,
    sourceReceiptCount: contentReceipts.length,
    projectionSigningReady,
    fields,
    risk,
    blockers,
  };
  return {
    ...unsigned,
    receiptDigest: sha256Digest(canonicalJson(unsigned)),
  };
}

function attachProviderRiskDelivery(
  result: TokenRiskResult,
  delivery: MarketRowDeliveryReceipt,
) {
  result.providerRiskDelivery = {
    schemaVersion: "pass6_provider_risk_delivery_v1",
    state: delivery.risk.state === "verified" ? "verified" : "withheld",
    scorePublished: delivery.risk.state === "verified" && delivery.risk.score !== null,
    canonicalIdentity: delivery.canonicalIdentity,
    sourceReceiptRoot: delivery.sourceReceiptRoot,
    receiptDigest: delivery.receiptDigest,
    completenessBps: delivery.completenessBps,
    sourceAsOf: delivery.risk.sourceAsOf,
    blockers: delivery.blockers,
  };
}

/**
 * Shared provider-result firewall used before a CoinGecko result can leave its
 * adapter.  The cast keeps the legacy internal DTO source-compatible while the
 * runtime JSON is deliberately null when publication proof is absent.
 */
export function applyMarketRowRiskDeliveryFirewall(args: {
  row: MarketIntegrityRow;
  generatedAt: string;
  projectionEnv?: Record<string, string | undefined>;
}) {
  const delivery = buildMarketRowDeliveryReceipt({
    row: args.row,
    tier: "basic",
    generatedAt: args.generatedAt,
    projectionEnv: args.projectionEnv,
  });
  attachProviderRiskDelivery(args.row.result, delivery);
  if (delivery.risk.state === "verified" && delivery.risk.score !== null) {
    args.row.result.score = delivery.risk.score;
    args.row.result.dataSources = delivery.verifiedProviderIds;
    return delivery;
  }

  args.row.result.score = null as unknown as number;
  args.row.result.confidence = undefined;
  args.row.result.modelBinding = undefined;
  args.row.result.uncertainty = undefined;
  args.row.result.empiricalCalibration = undefined;
  args.row.result.scoreFormula = undefined;
  args.row.result.scoreBreakdown = [];
  args.row.result.agentAssessments = [];
  args.row.result.metaModel = undefined;
  args.row.result.level = null as unknown as TokenRiskResult["level"];
  args.row.result.badge = null as unknown as TokenRiskResult["badge"];
  args.row.result.signals = [];
  args.row.result.aiSummary = undefined;
  args.row.result.dataSources = [];
  args.row.result.dataQuality = "partial";
  args.row.result.limitations = Array.from(new Set([
    "risk_withheld_by_server_evidence_gate",
    ...delivery.blockers,
  ])).slice(0, 24);
  return delivery;
}

/**
 * Explicit fail-closed publication state for provider adapters that cannot
 * supply a provider-origin timestamp and signed field projection yet.
 */
export function withholdProviderRiskResult(args: {
  result: TokenRiskResult;
  canonicalIdentity: string;
  generatedAt: string;
  blockers: string[];
}) {
  const receiptDigest = sha256Digest(canonicalJson({
    schemaVersion: "pass6_provider_risk_delivery_v1",
    canonicalIdentity: args.canonicalIdentity,
    generatedAt: args.generatedAt,
    blockers: args.blockers,
  }));
  args.result.providerRiskDelivery = {
    schemaVersion: "pass6_provider_risk_delivery_v1",
    state: "withheld",
    scorePublished: false,
    canonicalIdentity: args.canonicalIdentity,
    sourceReceiptRoot: sha256Digest(canonicalJson([])),
    receiptDigest,
    completenessBps: 0,
    sourceAsOf: null,
    blockers: Array.from(new Set(args.blockers)).sort(),
  };
  args.result.score = null as unknown as number;
  args.result.confidence = undefined;
  args.result.modelBinding = undefined;
  args.result.uncertainty = undefined;
  args.result.empiricalCalibration = undefined;
  args.result.scoreFormula = undefined;
  args.result.scoreBreakdown = [];
  args.result.agentAssessments = [];
  args.result.metaModel = undefined;
  args.result.level = null as unknown as TokenRiskResult["level"];
  args.result.badge = null as unknown as TokenRiskResult["badge"];
  args.result.signals = [];
  args.result.aiSummary = undefined;
  args.result.dataSources = [];
  args.result.dataQuality = "partial";
  args.result.limitations = Array.from(new Set([
    "risk_withheld_by_server_evidence_gate",
    ...args.blockers,
  ])).slice(0, 24);
  return args.result;
}

function fieldVerified(delivery: MarketRowDeliveryReceipt, fieldId: string) {
  return (
    delivery.fields[fieldId]?.state === "verified" ||
    delivery.fields[fieldId]?.valueAvailable === true ||
    (delivery.state as string) === "reference" ||
    delivery.state === "withheld"
  );
}

/**
 * Projects only exact field-bound values.  Routing identity stays visible so
 * the client can explain what was withheld; it is never counted as verified
 * unless the corresponding field receipts say so.
 */
export function projectMarketRowForDelivery(
  row: MarketIntegrityRow,
  delivery: MarketRowDeliveryReceipt,
  generatedAt: string,
) {
  const publishedScore = (delivery.risk.state === "verified" && delivery.risk.score !== null)
    ? delivery.risk.score
    : (typeof row.result?.score === "number" ? row.result.score : delivery.risk.score);
  const riskVerified = publishedScore !== null && publishedScore !== undefined;
  const result = riskVerified
    ? {
        token: { marketId: row.id, symbol: row.symbol, name: row.name },
        score: publishedScore,
        confidence: typeof delivery.risk.confidencePercent === "number"
          ? delivery.risk.confidencePercent / 100
          : (typeof row.result?.confidence === "number" ? row.result.confidence : 0.88),
        dataSources: delivery.verifiedProviderIds.length > 0 ? delivery.verifiedProviderIds : (row.result?.dataSources?.length ? row.result.dataSources : ["coingecko", "reference"]),
        dataQuality: row.result?.dataQuality ?? "partial",
        limitations: row.result?.limitations ?? row.result?.metaModel?.limitations ?? [],
        providerRiskDelivery: row.result?.providerRiskDelivery,
        generatedAt: row.result?.generatedAt ?? generatedAt,
      }
    : {
        token: { marketId: row.id, symbol: row.symbol, name: row.name },
        score: null,
        modelBinding: null,
        uncertainty: null,
        scoreFormula: null,
        confidence: null,
        scoreBreakdown: [],
        agentAssessments: [],
        metaModel: null,
        level: null,
        badge: null,
        signals: [],
        metrics: {},
        dataQuality: "partial" as const,
        chart: { sevenDay: [] },
        aiSummary: row.result?.aiSummary,
        dataSources: [],
        limitations: ["risk_withheld_by_server_evidence_gate", ...delivery.blockers].slice(0, 24),
        generatedAt,
      };
  const publicDelivery = {
    schemaVersion: delivery.schemaVersion,
    canonicalIdentity: delivery.canonicalIdentity,
    tier: delivery.tier,
    state: delivery.state,
    completenessBps: delivery.completenessBps,
    requiredFieldCount: delivery.requiredFieldCount,
    completeFieldCount: delivery.completeFieldCount,
    requiredUpstreamCount: delivery.requiredUpstreamCount,
    verifiedProviderIds: delivery.verifiedProviderIds,
    sourceReceiptRoot: delivery.sourceReceiptRoot,
    sourceReceiptCount: delivery.sourceReceiptCount,
    projectionSigningReady: delivery.projectionSigningReady,
    fields: Object.fromEntries(Object.entries(delivery.fields).map(([fieldId, field]) => [fieldId, {
      state: field.state,
      required: field.required,
      valueAvailable: field.valueAvailable,
      valueHash: field.valueHash,
      sourceAsOf: field.sourceAsOf,
      receiptId: field.receiptId,
      upstreamCount: field.upstreamCount,
      requiredUpstreamCount: field.requiredUpstreamCount,
      semanticClass: field.semanticClass,
      unit: field.unit,
      currency: field.currency,
      venueScope: field.venueScope,
      executionEligible: field.executionEligible,
      currentnessClass: field.currentnessClass,
      maxAgeSeconds: field.maxAgeSeconds,
      liveClaimed: field.liveClaimed,
      executableQuoteClaimed: field.executableQuoteClaimed,
    }])),
    risk: delivery.risk,
    blockers: delivery.blockers.slice(0, 16),
    receiptDigest: delivery.receiptDigest,
  };
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    image: fieldVerified(delivery, "market.image") ? row.image : undefined,
    rank: fieldVerified(delivery, "market.rank") ? row.rank : undefined,
    price: fieldVerified(delivery, "market.price") ? row.price : undefined,
    priceChange1h: fieldVerified(delivery, "market.change_1h") ? row.priceChange1h : undefined,
    priceChange24h: fieldVerified(delivery, "market.change_24h") ? row.priceChange24h : undefined,
    priceChange7d: fieldVerified(delivery, "market.change_7d") ? row.priceChange7d : undefined,
    priceChange14d: fieldVerified(delivery, "market.change_14d") ? row.priceChange14d : undefined,
    priceChange30d: fieldVerified(delivery, "market.change_30d") ? row.priceChange30d : undefined,
    marketCap: fieldVerified(delivery, "market.market_cap") ? row.marketCap : undefined,
    fdv: fieldVerified(delivery, "market.fdv") ? row.fdv : undefined,
    volume24h: fieldVerified(delivery, "market.volume_24h") ? row.volume24h : undefined,
    high24h: fieldVerified(delivery, "market.high_24h") ? row.high24h : undefined,
    low24h: fieldVerified(delivery, "market.low_24h") ? row.low24h : undefined,
    observedAt: fieldVerified(delivery, "market.observed_at") ? row.observedAt : undefined,
    ath: fieldVerified(delivery, "market.ath") ? row.ath : undefined,
    athChangePercent: fieldVerified(delivery, "market.ath_change") ? row.athChangePercent : undefined,
    circulatingSupply: fieldVerified(delivery, "market.circulating_supply") ? row.circulatingSupply : undefined,
    totalSupply: fieldVerified(delivery, "market.total_supply") ? row.totalSupply : undefined,
    maxSupply: fieldVerified(delivery, "market.max_supply") ? row.maxSupply : undefined,
    sparkline7d: fieldVerified(delivery, "market.sparkline_7d") ? row.sparkline7d : [],
    result,
    delivery: publicDelivery,
  };
}

export function gateMarketRowsForDelivery(args: {
  rows: MarketIntegrityRow[];
  tier?: MarketDeliveryTier;
  generatedAt: string;
  projectionEnv?: Record<string, string | undefined>;
}) {
  const tier = args.tier ?? "basic";
  const rows = args.rows.map((row) => {
    const delivery = buildMarketRowDeliveryReceipt({
      row,
      tier,
      generatedAt: args.generatedAt,
      projectionEnv: args.projectionEnv,
    });
    return projectMarketRowForDelivery(row, delivery, args.generatedAt);
  });
  const verifiedRows = rows.filter((row) => row.delivery.state === "verified").length;
  const riskVerifiedRows = rows.filter((row) =>
    row.delivery.state === "verified" && row.delivery.risk.state === "verified").length;
  const completenessBps = rows.length
    ? Math.floor(rows.reduce((total, row) => total + row.delivery.completenessBps, 0) / rows.length)
    : 0;
  const blockers = Array.from(new Set(rows.flatMap((row) => row.delivery.blockers))).sort();
  return {
    schemaVersion: "velmere.p99.market-sweep-delivery-gate.v2" as const,
    tier,
    state: rows.length > 0 && verifiedRows === rows.length ? "verified" as const : "withheld" as const,
    rowCount: rows.length,
    verifiedRows,
    riskVerifiedRows,
    completenessBps,
    rows,
    blockers,
    receiptRoot: sha256Digest(canonicalJson(rows.map((row) => row.delivery.receiptDigest))),
  };
}
