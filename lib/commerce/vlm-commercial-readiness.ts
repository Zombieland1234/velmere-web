import {
  VLM_FIELD_DEFINITIONS,
  evaluateVlmFieldLevelReadiness,
  type VlmFieldAvailabilityState,
  type VlmFieldEvidenceById,
  type VlmFieldLevelReadiness,
} from "@/lib/commerce/vlm-field-level-readiness";
import {
  getVlmCurrentSkuTruth,
  resolveVlmCurrentSkuLocale,
  type VlmCurrentSkuLocale,
  type VlmCurrentSkuTier,
} from "@/lib/commerce/vlm-current-sku-truth";

export const PASS36_R44P21_COMMERCIAL_READINESS_ID =
  "pass36-a102r44p21-field-level-modular-commercial-readiness" as const;

export type VlmCommercialProductFamily =
  | "audit"
  | "browser"
  | "shield-pro"
  | "shield"
  | "shield-map"
  | "real-markets"
  | "market-impact"
  | "whale-watch"
  | "angel"
  | "risk";

export type VlmCommercialGateId =
  | "source_authority"
  | "exact_windows"
  | "full_lint"
  | "full_typecheck"
  | "source_audit"
  | "dual_build"
  | "browser_matrix"
  | "accessibility"
  | "security_privacy"
  | "customer_truth"
  | "current_byte_pdf"
  | "independent_pdf_qa"
  | "external_accuracy"
  | "false_alert_control"
  | "severity_calibration"
  | "manual_quality_control"
  | "independent_adjudication"
  | "incremental_detection_value"
  | "provider_rights"
  | "real_current_data"
  | "freshness_corrections"
  | "multi_provider_failover"
  | "realized_slippage"
  | "signed_labels"
  | "real_unseen_eval"
  | "probability_calibration"
  | "customer_value"
  | "legal_claims_review"
  | "support_refund_operations"
  | "staging_operations"
  | "payment_test_lifecycle"
  | "entitlement_revocation";

export type VlmCommercialEvidence = Readonly<{
  gates: Readonly<Partial<Record<VlmCommercialGateId, boolean>>>;
  fieldEvidence?: VlmFieldEvidenceById;
  auditRecallBps?: number | null;
  controlFlagBps?: number | null;
  independentlyReviewedCases?: number | null;
  realCustomerCases?: number | null;
  rightsApprovedRows?: number | null;
}>;

export type VlmCommercialTarget = "GO_FREE" | "GO_PAID";
export type VlmCommercialReadinessState =
  | "PREPARE_FREE_RELEASE"
  | "READY_FOR_FREE_RELEASE_REVIEW"
  | "PREPARE_FOR_CONTROLLED_BETA"
  | "READY_FOR_CONTROLLED_BETA_REVIEW"
  | "PREPARE_FOR_PAID_SALE"
  | "READY_FOR_PAID_RELEASE_REVIEW";

export type VlmCommercialReadiness = {
  schemaVersion: typeof PASS36_R44P21_COMMERCIAL_READINESS_ID;
  family: VlmCommercialProductFamily;
  /** Internal legacy policy-adapter tier. Never expose this as a customer tier for standalone products. */
  tier: VlmCurrentSkuTier;
  customerFacingTier: VlmCurrentSkuTier | null;
  standaloneProduct: boolean;
  locale: VlmCurrentSkuLocale;
  commercialTarget: VlmCommercialTarget;
  readinessState: VlmCommercialReadinessState;
  currentPublicDecision: ReturnType<typeof getVlmCurrentSkuTruth>["decision"];
  freeAccessGuaranteed: boolean;
  targetPaid: boolean;
  publicPrice: null;
  publicCheckoutAllowed: false;
  chargeAllowed: false;
  findingConfidence: "NOT_CALIBRATED";
  requiredGates: VlmCommercialGateId[];
  passedGates: VlmCommercialGateId[];
  freeReleaseRequiredGates: VlmCommercialGateId[];
  controlledBetaRequiredGates: VlmCommercialGateId[];
  paidSaleRequiredGates: VlmCommercialGateId[];
  blockers: string[];
  freeReleaseBlockers: string[];
  controlledBetaBlockers: string[];
  paidSaleBlockers: string[];
  gateCompletionBps: number;
  freeGateCompletionBps: number;
  controlledBetaGateCompletionBps: number | null;
  paidGateCompletionBps: number | null;
  fieldReadiness: VlmFieldLevelReadiness;
  fieldCompletionBps: number;
  criticalFieldCompletionBps: number;
  valueCompletionBps: number;
  ownOnchainDerivedCompletionBps: number;
  providerFieldCompletionBps: number;
  overallReadinessBps: number;
  freeReleaseReadinessBps: number;
  betaReadinessBps: number | null;
  paidSaleReadinessBps: number | null;
  coreDeliverable: boolean;
  deliveryMode: VlmFieldLevelReadiness["deliveryMode"];
  blockedFieldIds: readonly string[];
  hiddenFieldIds: readonly string[];
  readyForFreeReleaseReview: boolean;
  readyForControlledBetaReview: boolean;
  readyForPaidSaleReview: boolean;
  readyForReleaseReview: boolean;
  saleEnabled: false;
  live: false;
};

const TIERED_FAMILIES = ["audit", "browser", "shield", "shield-pro", "real-markets"] as const satisfies readonly VlmCommercialProductFamily[];
const STANDALONE_FAMILIES = ["shield-map", "market-impact", "whale-watch", "angel", "risk"] as const satisfies readonly VlmCommercialProductFamily[];
const FAMILIES = new Set<VlmCommercialProductFamily>([...TIERED_FAMILIES, ...STANDALONE_FAMILIES]);

const COMMON_RELEASE_GATES: VlmCommercialGateId[] = [
  "source_authority",
  "exact_windows",
  "full_lint",
  "full_typecheck",
  "source_audit",
  "dual_build",
  "browser_matrix",
  "accessibility",
  "security_privacy",
  "customer_truth",
];

const FAMILY_GATES: Record<VlmCommercialProductFamily, VlmCommercialGateId[]> = {
  audit: ["external_accuracy", "false_alert_control", "current_byte_pdf"],
  browser: ["current_byte_pdf"],
  shield: [],
  "shield-pro": [],
  "shield-map": [],
  "real-markets": [],
  "market-impact": [],
  "whale-watch": [],
  angel: ["real_unseen_eval"],
  risk: ["real_unseen_eval"],
};

const CONTROLLED_BETA_GATES: VlmCommercialGateId[] = [
  // Legacy wire-id; current semantics are an automated, receipt-bound quality-control gate.
  "manual_quality_control",
  "legal_claims_review",
  "staging_operations",
];

const PAID_OPERATIONS_GATES: VlmCommercialGateId[] = [
  ...CONTROLLED_BETA_GATES,
  "customer_value",
  "support_refund_operations",
  "payment_test_lifecycle",
  "entitlement_revocation",
];

const ADVANCED_GATES: VlmCommercialGateId[] = [
  // Independent means independently replayed/adjudicated automation, not mandatory human review.
  "independent_adjudication",
  "incremental_detection_value",
  "severity_calibration",
  "independent_pdf_qa",
];

function unique<T>(rows: readonly T[]): T[] {
  return [...new Set(rows)];
}

function completionBps(required: readonly VlmCommercialGateId[], evidence: VlmCommercialEvidence): number {
  if (required.length === 0) return 0;
  return Math.floor((required.filter((gate) => evidence.gates[gate] === true).length * 10_000) / required.length);
}

function missingGateBlockers(required: readonly VlmCommercialGateId[], evidence: VlmCommercialEvidence): string[] {
  return required.filter((gate) => evidence.gates[gate] !== true).map((gate) => `missing_gate:${gate}`);
}

export function freeReleaseCommercialGates(
  family: VlmCommercialProductFamily,
): VlmCommercialGateId[] {
  if (!FAMILIES.has(family)) throw new Error(`unsupported_commercial_family:${family}`);
  return unique([...COMMON_RELEASE_GATES, ...FAMILY_GATES[family]]);
}

function tierSpecificCommercialGates(
  family: VlmCommercialProductFamily,
  tier: VlmCurrentSkuTier,
): VlmCommercialGateId[] {
  if (family === "risk" && tier !== "basic") return ["probability_calibration"];
  return [];
}

export function controlledBetaCommercialGates(
  family: VlmCommercialProductFamily,
  tier: Exclude<VlmCurrentSkuTier, "basic"> = "pro",
): VlmCommercialGateId[] {
  return unique([
    ...freeReleaseCommercialGates(family),
    ...tierSpecificCommercialGates(family, tier),
    ...CONTROLLED_BETA_GATES,
  ]);
}

export function paidSaleCommercialGates(
  family: VlmCommercialProductFamily,
  tier: Exclude<VlmCurrentSkuTier, "basic">,
): VlmCommercialGateId[] {
  return unique([
    ...freeReleaseCommercialGates(family),
    ...tierSpecificCommercialGates(family, tier),
    ...PAID_OPERATIONS_GATES,
    ...(tier === "advanced" ? ADVANCED_GATES : []),
  ]);
}

export function requiredCommercialGates(
  family: VlmCommercialProductFamily,
  tier: VlmCurrentSkuTier,
): VlmCommercialGateId[] {
  return tier === "basic" ? freeReleaseCommercialGates(family) : paidSaleCommercialGates(family, tier);
}

function auditMetricBlockers(
  tier: VlmCurrentSkuTier,
  evidence: VlmCommercialEvidence,
): string[] {
  const blockers: string[] = [];
  const minimumRecall = tier === "advanced" ? 9_500 : tier === "pro" ? 9_000 : 8_000;
  const maximumControlFlag = tier === "advanced" ? 250 : tier === "pro" ? 500 : 1_500;
  if (typeof evidence.auditRecallBps !== "number" || evidence.auditRecallBps < minimumRecall) {
    blockers.push(`audit_recall_below_${minimumRecall}_bps`);
  }
  if (typeof evidence.controlFlagBps !== "number" || evidence.controlFlagBps > maximumControlFlag) {
    blockers.push(`control_flag_rate_above_${maximumControlFlag}_bps`);
  }
  return blockers;
}

function stateForField(
  sourceClass: (typeof VLM_FIELD_DEFINITIONS)[number]["sourceClass"],
  fieldId: string,
  evidence: VlmCommercialEvidence,
): VlmFieldAvailabilityState {
  if (sourceClass === "VELMERE_OWNED") {
    return evidence.gates.source_authority === true ? "AVAILABLE_OWNED" : "BLOCKED_DATA";
  }
  if (sourceClass === "PUBLIC_BLOCKCHAIN_DIRECT") {
    return evidence.gates.real_current_data === true || evidence.gates.external_accuracy === true
      ? "AVAILABLE_PUBLIC_CHAIN"
      : "BLOCKED_DATA";
  }
  if (sourceClass === "VELMERE_DERIVED") {
    // Current evidence-sensitive derived fields require an explicit receipt gate. Generic
    // source/typecheck success can never manufacture customer-product or paid-value readiness.
    const explicitAutomatedGate = fieldId === "manual_quality_control"
      ? evidence.gates.manual_quality_control === true
      : fieldId === "independent_adjudication"
        ? evidence.gates.independent_adjudication === true
        : fieldId === "pdf_independent_qa"
          ? evidence.gates.independent_pdf_qa === true
          : null;
    if (explicitAutomatedGate !== null) return explicitAutomatedGate ? "AVAILABLE_DERIVED" : "BLOCKED_DATA";
    if (fieldId.startsWith("shield_pro_")) return "BLOCKED_DATA";
    return evidence.gates.source_authority === true && evidence.gates.full_typecheck === true
      ? "AVAILABLE_DERIVED"
      : "BLOCKED_DATA";
  }
  if (sourceClass === "USER_SUPPLIED") {
    return evidence.gates.customer_truth === true ? "AVAILABLE_USER_SUPPLIED" : "BLOCKED_DATA";
  }
  if (sourceClass === "PUBLIC_REGULATOR_DATA") {
    return evidence.gates.real_current_data === true ? "AVAILABLE_PUBLIC_REGULATOR" : "BLOCKED_DATA";
  }
  if (sourceClass === "EXTERNAL_PROVIDER") {
    return evidence.gates.provider_rights === true && (evidence.rightsApprovedRows ?? 0) > 0
      ? "AVAILABLE_RIGHTS_APPROVED_PROVIDER"
      : "BLOCKED_RIGHTS";
  }
  if (sourceClass === "MANUAL_REVIEW") {
    const advanced = fieldId.includes("independent") || fieldId.includes("calibration") || fieldId.includes("outcome");
    const ready = advanced
      ? evidence.gates.independent_adjudication === true || evidence.gates.severity_calibration === true
      : evidence.gates.manual_quality_control === true;
    return ready ? "AVAILABLE_MANUAL_REVIEW" : "BLOCKED_OPERATIONS";
  }
  return "SYNTHETIC_ONLY";
}

function inferredFieldEvidence(evidence: VlmCommercialEvidence): VlmFieldEvidenceById {
  const rows: Record<string, { availability: VlmFieldAvailabilityState; alternativeReady: boolean }> = {};
  for (const field of VLM_FIELD_DEFINITIONS) {
    const availability = stateForField(field.sourceClass, field.id, evidence);
    const alternativeReady = availability.startsWith("AVAILABLE_")
      ? false
      : field.alternative.zeroBudgetPossible === true
        && field.alternative.strategy !== "NO_SAFE_SUBSTITUTE"
        && (field.alternative.strategy === "HIDE_FIELD" || field.alternative.preservesRequiredSemantics === true);
    rows[field.id] = { availability, alternativeReady };
  }
  return rows;
}

function metricBlockersForStage(args: {
  family: VlmCommercialProductFamily;
  tier: VlmCurrentSkuTier;
  evidence: VlmCommercialEvidence;
  stage: "free" | "beta" | "paid";
}): string[] {
  const blockers: string[] = [];
  if (args.family === "audit") {
    blockers.push(...auditMetricBlockers(args.tier, args.evidence));
  }
  if (args.stage === "paid" && args.tier !== "basic" && (args.evidence.realCustomerCases ?? 0) < 10) {
    blockers.push("real_customer_value_cases_below_10");
  }
  if (args.stage === "paid" && args.tier === "advanced" && (args.evidence.independentlyReviewedCases ?? 0) < 50) {
    blockers.push("independent_review_cases_below_50");
  }
  return blockers;
}

function combineReadiness(gateBps: number, fieldBps: number, valueBps: number): number {
  return Math.floor((gateBps * 50 + fieldBps * 30 + valueBps * 20) / 100);
}

export function evaluateVlmCommercialReadiness(args: {
  family: VlmCommercialProductFamily;
  tier: VlmCurrentSkuTier;
  /** True only for the five owner-bound standalone products. */
  standaloneProduct?: boolean;
  locale?: unknown;
  evidence: VlmCommercialEvidence;
}): VlmCommercialReadiness {
  if (!FAMILIES.has(args.family)) throw new Error(`unsupported_commercial_family:${args.family}`);
  if (args.tier !== "basic" && args.tier !== "pro" && args.tier !== "advanced") {
    throw new Error(`unsupported_commercial_tier:${String(args.tier)}`);
  }

  const locale = resolveVlmCurrentSkuLocale(args.locale);
  const standaloneProduct = args.standaloneProduct === true;
  const truth = getVlmCurrentSkuTruth(args.tier, locale);
  const freeRequired = freeReleaseCommercialGates(args.family);
  const betaRequired = args.tier === "basic" ? [] : controlledBetaCommercialGates(args.family, args.tier);
  const paidRequired = args.tier === "basic" ? [] : paidSaleCommercialGates(args.family, args.tier);
  const requiredGates = args.tier === "basic" ? freeRequired : paidRequired;
  const passedGates = requiredGates.filter((gate) => args.evidence.gates[gate] === true);

  const fieldReadiness = evaluateVlmFieldLevelReadiness({
    family: args.family,
    tier: args.tier,
    standaloneProduct,
    evidence: args.evidence.fieldEvidence ?? inferredFieldEvidence(args.evidence),
  });
  const fieldBlockers = fieldReadiness.blockers;

  const freeReleaseBlockers = unique([
    ...missingGateBlockers(freeRequired, args.evidence),
    ...fieldBlockers,
    ...metricBlockersForStage({ ...args, stage: "free" }),
  ]);
  const controlledBetaBlockers = args.tier === "basic" ? [] : unique([
    ...missingGateBlockers(betaRequired, args.evidence),
    ...fieldBlockers,
    ...metricBlockersForStage({ ...args, stage: "beta" }),
  ]);
  const paidSaleBlockers = args.tier === "basic" ? [] : unique([
    ...missingGateBlockers(paidRequired, args.evidence),
    ...fieldBlockers,
    ...metricBlockersForStage({ ...args, stage: "paid" }),
  ]);

  const readyForFreeReleaseReview = freeReleaseBlockers.length === 0;
  const readyForControlledBetaReview = args.tier !== "basic" && controlledBetaBlockers.length === 0;
  const readyForPaidSaleReview = args.tier !== "basic" && paidSaleBlockers.length === 0;
  const blockers = args.tier === "basic" ? freeReleaseBlockers : paidSaleBlockers;
  const commercialTarget: VlmCommercialTarget = args.tier === "basic" ? "GO_FREE" : "GO_PAID";
  const readinessState: VlmCommercialReadinessState = args.tier === "basic"
    ? readyForFreeReleaseReview ? "READY_FOR_FREE_RELEASE_REVIEW" : "PREPARE_FREE_RELEASE"
    : readyForPaidSaleReview ? "READY_FOR_PAID_RELEASE_REVIEW"
      : readyForControlledBetaReview ? "READY_FOR_CONTROLLED_BETA_REVIEW"
        : "PREPARE_FOR_CONTROLLED_BETA";

  const freeGateCompletionBps = completionBps(freeRequired, args.evidence);
  const controlledBetaGateCompletionBps = args.tier === "basic" ? null : completionBps(betaRequired, args.evidence);
  const paidGateCompletionBps = args.tier === "basic" ? null : completionBps(paidRequired, args.evidence);
  const gateCompletionBps = args.tier === "basic" ? freeGateCompletionBps : paidGateCompletionBps ?? 0;
  const freeReleaseReadinessBps = combineReadiness(
    freeGateCompletionBps,
    fieldReadiness.fieldCompletionBps,
    fieldReadiness.valueCompletionBps,
  );
  const betaReadinessBps = args.tier === "basic" ? null : combineReadiness(
    controlledBetaGateCompletionBps ?? 0,
    fieldReadiness.fieldCompletionBps,
    fieldReadiness.valueCompletionBps,
  );
  const paidSaleReadinessBps = args.tier === "basic" ? null : combineReadiness(
    paidGateCompletionBps ?? 0,
    fieldReadiness.fieldCompletionBps,
    fieldReadiness.valueCompletionBps,
  );

  return {
    schemaVersion: PASS36_R44P21_COMMERCIAL_READINESS_ID,
    family: args.family,
    tier: args.tier,
    customerFacingTier: standaloneProduct ? null : args.tier,
    standaloneProduct,
    locale,
    commercialTarget,
    readinessState,
    currentPublicDecision: truth.decision,
    freeAccessGuaranteed: args.tier === "basic",
    targetPaid: args.tier !== "basic",
    publicPrice: null,
    publicCheckoutAllowed: false,
    chargeAllowed: false,
    findingConfidence: "NOT_CALIBRATED",
    requiredGates,
    passedGates,
    freeReleaseRequiredGates: freeRequired,
    controlledBetaRequiredGates: betaRequired,
    paidSaleRequiredGates: paidRequired,
    blockers,
    freeReleaseBlockers,
    controlledBetaBlockers,
    paidSaleBlockers,
    gateCompletionBps,
    freeGateCompletionBps,
    controlledBetaGateCompletionBps,
    paidGateCompletionBps,
    fieldReadiness,
    fieldCompletionBps: fieldReadiness.fieldCompletionBps,
    criticalFieldCompletionBps: fieldReadiness.criticalFieldCompletionBps,
    valueCompletionBps: fieldReadiness.valueCompletionBps,
    ownOnchainDerivedCompletionBps: fieldReadiness.ownOnchainDerivedCompletionBps,
    providerFieldCompletionBps: fieldReadiness.providerFieldCompletionBps,
    overallReadinessBps: args.tier === "basic" ? freeReleaseReadinessBps : paidSaleReadinessBps ?? 0,
    freeReleaseReadinessBps,
    betaReadinessBps,
    paidSaleReadinessBps,
    coreDeliverable: fieldReadiness.coreDeliverable,
    deliveryMode: fieldReadiness.deliveryMode,
    blockedFieldIds: fieldReadiness.blockedFieldIds,
    hiddenFieldIds: fieldReadiness.hiddenFieldIds,
    readyForFreeReleaseReview,
    readyForControlledBetaReview,
    readyForPaidSaleReview,
    readyForReleaseReview: args.tier === "basic" ? readyForFreeReleaseReview : readyForPaidSaleReview,
    saleEnabled: false,
    live: false,
  };
}

export function buildVlmCommercialReadinessMatrix(args: {
  locale?: unknown;
  evidenceByFamily: Readonly<Partial<Record<VlmCommercialProductFamily, VlmCommercialEvidence>>>;
}): VlmCommercialReadiness[] {
  const fallback: VlmCommercialEvidence = { gates: {} };
  return [
    ...TIERED_FAMILIES.flatMap((family) => (['basic', 'pro', 'advanced'] as const).map((tier) =>
      evaluateVlmCommercialReadiness({ family, tier, locale: args.locale, evidence: args.evidenceByFamily[family] ?? fallback })
    )),
    // Standalone products have no customer tiers. A single Basic-shaped adapter is retained only
    // for the legacy readiness engine and must never be counted/exposed as a Basic SKU.
    ...STANDALONE_FAMILIES.map((family) =>
      evaluateVlmCommercialReadiness({ family, tier: 'basic', standaloneProduct: true, locale: args.locale, evidence: args.evidenceByFamily[family] ?? fallback })
    ),
  ];
}
