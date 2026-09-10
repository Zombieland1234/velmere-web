import {
  PASS4824_CANONICAL_FIELD_PACKET_ID,
  buildPass4824FieldObservation,
  getPass4824VisibleFieldDefinitions,
  validatePass4824CanonicalFieldPacket,
  type Pass4824CanonicalFieldPacket,
  type Pass4824CanonicalIdentity,
  type Pass4824DataModule,
  type Pass4824DataTier,
  type Pass4824FieldMode,
  type Pass4824FieldValidationReceipt,
} from "@/lib/reporting/canonical-field-registry";
import type { SourceReceipt } from "@/lib/market-integrity/top1-risk-foundation";
import {
  pass4993SourceReceiptMatchesCanonicalIdentity,
  verifyPass4993SourceReceiptProjection,
} from "@/lib/market-integrity/customer-report-source-binding";
import {
  pass6ObservationDerivationDigest,
  pass6SourceReceiptMatchesField,
  pass6SourceReceiptRefs,
} from "@/lib/reporting/commercial-field-completeness";

export const PASS4825_RUNTIME_FIELD_ADAPTER_ID = "pass4825-runtime-canonical-field-adapter-v1" as const;

export type Pass4825RuntimeFieldValue = {
  value: unknown;
  rawValue?: unknown;
  mode?: Pass4824FieldMode;
  missingReason?: string | null;
  limitation?: string;
  currency?: string | null;
  confidence?: number;
  quality?: number;
  evidenceRefs?: string[];
  sourceObservationIds?: string[];
  formula?: string | null;
  observedAt?: string;
  receivedAt?: string;
};

export type Pass4825RuntimeFieldAdapterInput = {
  caseId: string;
  module: Pass4824DataModule;
  tier: Pass4824DataTier;
  identity: Pass4824CanonicalIdentity;
  generatedAt: string;
  sourceId: string;
  sourceFamily: string;
  sourceDigest: string;
  sourceReceipts?: readonly SourceReceipt[];
  values: Readonly<Record<string, Pass4825RuntimeFieldValue | undefined>>;
};

export type Pass4825CustomerReportFieldContractInput = {
  reportId: string;
  module: "shield" | "real_markets" | "audit";
  tier: Pass4824DataTier;
  identity: Pass4824CanonicalIdentity;
  generatedAt: string;
  sourceDigest: string;
  riskScore: number | null;
  confidenceScore: number;
  missingEvidence: readonly string[];
  sourceQuorum: number;
  sourceReceipts?: readonly SourceReceipt[];
  values?: Readonly<Record<string, Pass4825RuntimeFieldValue | undefined>>;
};

function clean(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`pass4825_runtime_field_${label}_required`);
  return normalized;
}

function clampScore(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : fallback;
}

function identityValue(identity: Pass4824CanonicalIdentity, fieldId: string): unknown {
  if (fieldId === "identity.canonical_id") return identity.canonicalId;
  if (fieldId === "identity.symbol") return identity.symbol;
  if (fieldId === "identity.asset_class") return identity.assetClass;
  if (fieldId === "identity.chain_id") return identity.chainId;
  if (fieldId === "identity.contract_address") return identity.contractAddress;
  return undefined;
}

function identityValuesEqual(left: unknown, right: unknown) {
  if (left === null || right === null) return left === right;
  if (typeof left !== "string" || typeof right !== "string") return left === right;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/**
 * Converts a production runtime result into the same complete field contract used
 * by account artifacts and PDFs. Missing nullable evidence becomes a signed,
 * explicit-missing observation; missing non-nullable evidence fails the producer.
 */
export function buildPass4825RuntimeCanonicalFieldPacket(
  input: Pass4825RuntimeFieldAdapterInput,
): { packet: Pass4824CanonicalFieldPacket; receipt: Pass4824FieldValidationReceipt } {
  const generatedAt = new Date(input.generatedAt).toISOString();
  const canonicalId = clean(input.identity.canonicalId, "canonical_id");
  const sourceId = clean(input.sourceId, "source_id");
  const sourceFamily = clean(input.sourceFamily, "source_family");
  if (!/^sha256:[a-f0-9]{64}$/i.test(input.sourceDigest)) throw new Error("pass4825_runtime_field_source_digest_invalid");
  const identity: Pass4824CanonicalIdentity = {
    canonicalId,
    symbol: clean(input.identity.symbol, "symbol"),
    assetClass: clean(input.identity.assetClass, "asset_class"),
    chainId: input.identity.chainId,
    contractAddress: input.identity.contractAddress,
  };
  const scopedSourceReceipts = (input.sourceReceipts ?? []).filter((receipt) => (
    pass4993SourceReceiptMatchesCanonicalIdentity(receipt, canonicalId)
    && verifyPass4993SourceReceiptProjection({
      receipt,
      expectedCanonicalIdentity: canonicalId,
      atTime: generatedAt,
    }).ok
  ));
  const observations = getPass4824VisibleFieldDefinitions(input.module, input.tier).map((definition) => {
    const configured = input.values[definition.fieldId];
    const automaticIdentity = identityValue(identity, definition.fieldId);
    const identityField = definition.fieldId.startsWith("identity.");
    if (identityField && configured && !identityValuesEqual(configured.value, automaticIdentity)) {
      throw new Error(`pass4825_runtime_identity_override_rejected:${definition.fieldId}`);
    }
    // Identity is copied exclusively from packet.identity. A same-looking value
    // supplied in the generic values map is never treated as an authority.
    const suppliedValue = identityField ? automaticIdentity : configured?.value;
    const missing = suppliedValue === undefined || suppliedValue === null;
    if (missing && definition.nullPolicy !== "explicit_missing") {
      throw new Error(`pass4825_runtime_required_field_unavailable:${definition.fieldId}`);
    }
    const mode: Pass4824FieldMode = missing ? "explicit_missing" : configured?.mode ?? "derived_from_observations";
    if (!missing && !identityField && !configured?.observedAt) {
      throw new Error(`pass4825_runtime_field_observed_at_required:${definition.fieldId}`);
    }
    const observedAt = configured?.observedAt ?? generatedAt;
    const receivedAt = configured?.receivedAt ?? generatedAt;
    const missingReason = missing
      ? configured?.missingReason?.trim() || `runtime_evidence_unavailable:${definition.fieldId}`
      : null;
    const sourceBoundRefs = scopedSourceReceipts
      .filter((receipt) => pass6SourceReceiptMatchesField(definition.fieldId, receipt))
      .flatMap(pass6SourceReceiptRefs);
    const configuredRefs = configured?.evidenceRefs?.filter((value) => value.trim()) ?? [];
    const evidenceRefs = Array.from(new Set(
      configuredRefs.length
        ? configuredRefs
        : sourceBoundRefs.length
          ? sourceBoundRefs
          : [input.sourceDigest],
    ));
    const formula = mode === "derived_from_observations"
      ? configured?.formula?.trim() || `pass4825_adapter_projection:${definition.fieldId}`
      : null;
    const normalizedRawValue = identityField
      ? (missing ? null : suppliedValue)
      : typeof configured?.rawValue === "undefined" ? (missing ? null : suppliedValue) : configured.rawValue;
    return buildPass4824FieldObservation({
      fieldId: definition.fieldId,
      value: missing ? null : suppliedValue,
      rawValue: normalizedRawValue,
      unit: definition.unit,
      missingReason,
      currency: configured?.currency,
      confidence: {
        score: clampScore(configured?.confidence, missing ? 0 : 80),
        method: missing ? "explicit_missing_evidence_cap" : "runtime_source_confidence_projection",
      },
      quality: {
        score: clampScore(configured?.quality, missing ? 0 : 80),
        method: missing ? "explicit_missing_quality_cap" : "runtime_contract_quality_projection",
      },
      evidenceRefs,
      lineage: {
        sourceObservationIds: configured?.sourceObservationIds?.filter((value) => value.trim()) ?? [sourceId],
        formula,
      },
      provenance: {
        mode,
        sourceId,
        sourceFamily,
        adapterId: PASS4825_RUNTIME_FIELD_ADAPTER_ID,
        fixtureId: null,
        requestedIdentity: canonicalId,
        resolvedIdentity: canonicalId,
        identityMatch: "exact",
        observedAt,
        receivedAt,
        derivationDigest: mode === "derived_from_observations" && formula
          ? pass6ObservationDerivationDigest({
            fieldId: definition.fieldId,
            value: missing ? null : suppliedValue,
            rawValue: normalizedRawValue,
            formula,
            evidenceRefs,
            sourceReceipts: scopedSourceReceipts,
          })
          : null,
      },
    });
  });
  const packet: Pass4824CanonicalFieldPacket = {
    schemaVersion: PASS4824_CANONICAL_FIELD_PACKET_ID,
    caseId: clean(input.caseId, "case_id"),
    module: input.module,
    tier: input.tier,
    identity,
    generatedAt,
    observations,
  };
  const receipt = validatePass4824CanonicalFieldPacket(packet);
  if (receipt.status !== "passed") {
    throw new Error(`pass4825_runtime_field_packet_rejected:${receipt.errors.join("|")}`);
  }
  return { packet, receipt };
}

/**
 * Creates the mandatory canonical packet for a newly generated customer report.
 * Values not observed by the active producer remain explicit-missing (nullable
 * fields) or an honest structured unavailable state (required record fields).
 * The caller may override those defaults only with source-bound runtime values.
 */
export function buildPass4825CustomerReportFieldContract(
  input: Pass4825CustomerReportFieldContractInput,
): { packet: Pass4824CanonicalFieldPacket; receipt: Pass4824FieldValidationReceipt } {
  const missingEvidence = Array.from(new Set(input.missingEvidence.map((item) => item.trim()).filter(Boolean)));
  const unavailableRecord = (fieldId: string) => ({
    state: "unavailable",
    fieldId,
    limitation: "source_bound_runtime_evidence_not_supplied",
  });
  const values: Record<string, Pass4825RuntimeFieldValue | undefined> = {
    "risk.score": { value: input.riskScore, confidence: input.confidenceScore },
    "risk.confidence": { value: input.confidenceScore, confidence: input.confidenceScore },
    "evidence.missing": { value: missingEvidence, confidence: input.confidenceScore },
    "evidence.gap_count": { value: missingEvidence.length, confidence: input.confidenceScore },
    "evidence.primary_gap": { value: missingEvidence[0] ?? "none", confidence: input.confidenceScore },
  };

  if (input.module === "shield" || input.module === "real_markets") {
    Object.assign(values, {
      "market.price": { value: null, missingReason: "market_price_not_supplied_to_report_contract", currency: "USD" },
      "market.change_24h": { value: null, missingReason: "market_change_24h_not_supplied_to_report_contract" },
      "market.volume_24h": { value: null, missingReason: "market_volume_24h_not_supplied_to_report_contract", currency: "USD" },
      "market.change_1h": { value: null, missingReason: "market_change_1h_not_supplied_to_report_contract" },
      "source.second_source_divergence_bps": { value: null, missingReason: "comparable_second_source_not_supplied_to_report_contract" },
      "market.liquidity_usd": { value: null, missingReason: "market_liquidity_not_supplied_to_report_contract", currency: "USD" },
      "market.impact_10k_bps": { value: null, missingReason: "market_impact_not_supplied_to_report_contract" },
      "market.orderbook_depth_usd": { value: null, missingReason: "orderbook_depth_not_supplied_to_report_contract", currency: "USD" },
      "scenario.stress_loss_percent": { value: null, missingReason: "stress_scenario_not_supplied_to_report_contract" },
      "evidence.claim_ledger": { value: unavailableRecord("evidence.claim_ledger"), confidence: input.confidenceScore },
    });
    if (input.module === "shield") {
      Object.assign(values, {
        "holder.concentration_percent": { value: null, missingReason: "holder_concentration_not_supplied_to_report_contract" },
        "contract.permission_risk": { value: unavailableRecord("contract.permission_risk"), confidence: 0 },
      });
    } else {
      Object.assign(values, {
        "fundamentals.quality_score": { value: null, missingReason: "filing_quality_not_supplied_to_report_contract" },
        "macro.regime": { value: null, missingReason: "macro_regime_not_supplied_to_report_contract" },
      });
    }
  } else {
    Object.assign(values, {
      "audit.permission_summary": { value: unavailableRecord("audit.permission_summary"), confidence: 0 },
      "audit.liquidity_evidence": { value: unavailableRecord("audit.liquidity_evidence"), confidence: 0 },
      "audit.holder_evidence": { value: unavailableRecord("audit.holder_evidence"), confidence: 0 },
      "source.independent_quorum": { value: Math.max(0, Math.trunc(input.sourceQuorum)), confidence: input.confidenceScore },
      "evidence.claim_ledger": { value: unavailableRecord("evidence.claim_ledger"), confidence: input.confidenceScore },
      "audit.manual_review_state": { value: "unverified", mode: "explicit_missing", confidence: 0 },
      "audit.monitoring_state": { value: "not_configured", confidence: 0 },
      "audit.revalidation_plan": { value: ["revalidate_after_material_change"], confidence: 0 },
      "audit.finding_evidence_graph": { value: unavailableRecord("audit.finding_evidence_graph"), confidence: 0 },
      "audit.false_positive_review": { value: unavailableRecord("audit.false_positive_review"), confidence: 0 },
    });
  }

  for (const [fieldId, configured] of Object.entries({ ...values, ...(input.values ?? {}) })) {
    if (!configured) continue;
    values[fieldId] = {
      ...configured,
      // Leave the reference unset when the caller did not bind one explicitly.
      // The runtime adapter then selects only capability-matching, content-bound
      // provider receipts. Falling back here to the aggregate payload digest
      // made fields look referenced without proving their underlying value.
      ...(configured.evidenceRefs
        ? { evidenceRefs: configured.evidenceRefs.filter((value) => value.trim()) }
        : {}),
      observedAt: configured.observedAt ?? input.generatedAt,
      receivedAt: configured.receivedAt ?? input.generatedAt,
    };
  }

  return buildPass4825RuntimeCanonicalFieldPacket({
    caseId: input.reportId,
    module: input.module,
    tier: input.tier,
    identity: input.identity,
    generatedAt: input.generatedAt,
    sourceId: input.reportId,
    sourceFamily: "velmere_customer_report_payload",
    sourceDigest: input.sourceDigest,
    sourceReceipts: input.sourceReceipts,
    values,
  });
}
