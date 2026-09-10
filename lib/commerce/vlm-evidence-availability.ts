import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  getVlmCurrentSkuTruth,
  type VlmCurrentSkuLocale,
  type VlmCurrentSkuTier,
} from "@/lib/commerce/vlm-current-sku-truth";
import type {
  VlmCommercialProductFamily,
  VlmCommercialReadiness,
} from "@/lib/commerce/vlm-commercial-readiness";
import type {
  VlmFieldAvailabilityState,
  VlmFieldEvaluation,
} from "@/lib/commerce/vlm-field-level-readiness";

export const VLM_TIER_ELIGIBILITY_RECEIPT_SCHEMA = "velmere.tier-eligibility-receipt.v1" as const;
export const VLM_PUBLIC_TIER_ELIGIBILITY_SCHEMA = "velmere.public-tier-eligibility.v1" as const;
export const VLM_PUBLIC_SERVICE_READINESS_SCHEMA = "velmere.public-vlm-service-readiness.v2" as const;

export type VlmEligibilityProduct = VlmCommercialProductFamily;

export type VlmTierCatalogState = "FREE" | "INVITATION_ONLY" | "NOT_FOR_SALE" | "PUBLIC_SALE";

export type VlmCustomerAvailabilityState =
  | "AVAILABLE"
  | "AVAILABLE_WITH_LIMITATIONS"
  | "WAITING_FOR_FRESH_EVIDENCE"
  | "HISTORICAL_ONLY"
  | "TEMPORARILY_UNAVAILABLE"
  | "UNSUPPORTED"
  | "CONFLICTED"
  | "RIGHTS_BLOCKED"
  | "SYSTEM_DEGRADED";

export type VlmEligibilityTruthState =
  | "REAL_CURRENT"
  | "REAL_RECENT"
  | "REAL_STALE"
  | "DERIVED_CURRENT"
  | "DERIVED_FROM_STALE"
  | "CONFLICTED"
  | "UNAVAILABLE"
  | "UNSUPPORTED"
  | "FIXTURE"
  | "NOT_IMPLEMENTED";

export type VlmEligibilityFreshnessClass = "CURRENT" | "RECENT" | "DELAYED" | "STALE" | "HISTORICAL" | "NOT_APPLICABLE";
export type VlmEligibilityRightsState = "ALLOWED" | "ATTRIBUTION_REQUIRED" | "REVIEW_REQUIRED" | "BLOCKED" | "UNKNOWN";
export type VlmEligibilityRuntimeHealth = "HEALTHY" | "DEGRADED" | "UNAVAILABLE";

export type VlmEligibilityReasonCode =
  | "CATALOG_INVITATION_ONLY"
  | "CATALOG_NOT_FOR_SALE"
  | "CATALOG_PUBLIC_SALE_DISABLED"
  | "CRITICAL_EVIDENCE_MISSING"
  | "CRITICAL_EVIDENCE_STALE"
  | "CRITICAL_EVIDENCE_CONFLICTED"
  | "CRITICAL_EVIDENCE_UNSUPPORTED"
  | "RIGHTS_NOT_CONFIRMED"
  | "RUNTIME_UNAVAILABLE"
  | "RUNTIME_DEGRADED"
  | "VALUE_DELTA_NOT_PROVEN"
  | "VALUE_DELTA_INSUFFICIENT"
  | "LIMITATIONS_PRESENT"
  | "HISTORICAL_FALLBACK_AVAILABLE"
  | "NO_SAFE_HISTORICAL_FALLBACK";

export type VlmEligibilityEvidenceItem = Readonly<{
  id: string;
  label: string;
  required: boolean;
  critical: boolean;
  truthState: VlmEligibilityTruthState;
  freshness: VlmEligibilityFreshnessClass;
  rightsState: VlmEligibilityRightsState;
  runtimeReachable: boolean;
  historicalAvailable: boolean;
  observedAt: string | null;
  expiresAt: string | null;
}>;

export type VlmTierEligibilityPolicy = Readonly<{
  policyVersion: string;
  product: VlmEligibilityProduct;
  tier: VlmCurrentSkuTier;
  locale: VlmCurrentSkuLocale;
  catalogState: VlmTierCatalogState;
  requiresCurrentEvidence: boolean;
  requireCommercialRights: boolean;
  allowLimitations: boolean;
  allowHistoricalFallback: boolean;
  minMaterialValueDeltaBps: number;
}>;

export type VlmTierEligibilityInput = Readonly<{
  evaluatedAt: string;
  subjectId: string;
  sourceHash: string;
  policy: VlmTierEligibilityPolicy;
  evidence: readonly VlmEligibilityEvidenceItem[];
  runtimeHealth: VlmEligibilityRuntimeHealth;
  valueDeltaVsLowerTierBps: number | null;
  valueDeltaEvidenceReady: boolean;
  lastFullyEligibleAt: string | null;
  nextCheckAt: string | null;
  estimatedRestorationAt: string | null;
  estimatedRestorationBasis: string | null;
  suggestedLowerTier: Exclude<VlmCurrentSkuTier, "advanced"> | null;
}>;

export type VlmTierEligibilityReceipt = Readonly<{
  schemaVersion: typeof VLM_TIER_ELIGIBILITY_RECEIPT_SCHEMA;
  eligibilityId: string;
  product: VlmEligibilityProduct;
  tier: VlmCurrentSkuTier;
  subjectId: string;
  evaluatedAt: string;
  sourceHash: string;
  policyVersion: string;
  catalogState: VlmTierCatalogState;
  availabilityState: VlmCustomerAvailabilityState;
  analysisEligible: boolean;
  checkoutEligible: boolean;
  saleEligible: boolean;
  valueEligible: boolean;
  historicalEligible: boolean;
  requiredEvidenceIds: readonly string[];
  availableEvidenceIds: readonly string[];
  missingEvidenceIds: readonly string[];
  staleEvidenceIds: readonly string[];
  conflictedEvidenceIds: readonly string[];
  unsupportedEvidenceIds: readonly string[];
  rightsBlockedEvidenceIds: readonly string[];
  runtimeBlockedEvidenceIds: readonly string[];
  limitationEvidenceIds: readonly string[];
  reasonCodes: readonly VlmEligibilityReasonCode[];
  lastFullyEligibleAt: string | null;
  nextCheckAt: string | null;
  estimatedRestorationAt: string | null;
  estimatedRestorationBasis: string | null;
  suggestedLowerTier: Exclude<VlmCurrentSkuTier, "advanced"> | null;
  receiptHash: string;
}>;

export type PublicVlmTierEligibility = Readonly<{
  schemaVersion: typeof VLM_PUBLIC_TIER_ELIGIBILITY_SCHEMA;
  eligibilityId: string;
  product: VlmEligibilityProduct;
  tier: VlmCurrentSkuTier;
  evaluatedAt: string;
  availabilityState: VlmCustomerAvailabilityState;
  analysisEligible: boolean;
  checkoutEligible: boolean;
  saleEligible: boolean;
  valueEligible: boolean;
  historicalEligible: boolean;
  missingEvidence: readonly string[];
  reasonCodes: readonly VlmEligibilityReasonCode[];
  lastFullyAvailableAt: string | null;
  nextAutomaticCheckAt: string | null;
  estimatedRestorationAt: string | null;
  estimatedRestorationKnown: boolean;
  suggestedLowerTier: Exclude<VlmCurrentSkuTier, "advanced"> | null;
  customerMessage: string;
  integrityToken: string;
}>;

export type VlmPostPaymentEligibilityDecision = Readonly<{
  action: "CONTINUE" | "CONTINUE_WITH_EXPLICIT_DOWNGRADE" | "PAUSE_AND_RETRY" | "CANCEL_AND_REFUND";
  deliverTier: VlmCurrentSkuTier | null;
  silentDowngradeAllowed: false;
  reasonCodes: readonly VlmEligibilityReasonCode[];
}>;

const TIER_ORDER: readonly VlmCurrentSkuTier[] = ["basic", "pro", "advanced"];

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function safeIso(value: string | null, field: string): string | null {
  if (value === null) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`tier_eligibility_${field}_invalid`);
  return date.toISOString();
}

function cleanToken(value: string, field: string, max: number): string {
  const clean = String(value ?? "").replace(/[\p{Cc}<>]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, max);
  if (!clean) throw new Error(`tier_eligibility_${field}_required`);
  return clean;
}

function isUnavailableTruth(value: VlmEligibilityTruthState): boolean {
  return value === "UNAVAILABLE" || value === "NOT_IMPLEMENTED" || value === "FIXTURE";
}

function isStale(item: VlmEligibilityEvidenceItem, requiresCurrent: boolean): boolean {
  if (!requiresCurrent) return false;
  if (item.truthState === "REAL_STALE" || item.truthState === "DERIVED_FROM_STALE") return true;
  return item.freshness === "DELAYED" || item.freshness === "STALE" || item.freshness === "HISTORICAL";
}

function hasBoundCurrentWindow(
  item: VlmEligibilityEvidenceItem,
  evaluatedAt: string,
  requiresCurrent: boolean,
): boolean {
  if (!requiresCurrent || item.freshness !== "CURRENT") return true;
  if (item.observedAt === null || item.expiresAt === null) return false;
  const observedAt = new Date(item.observedAt).getTime();
  const expiresAt = new Date(item.expiresAt).getTime();
  const evaluated = new Date(evaluatedAt).getTime();
  return Number.isFinite(observedAt)
    && Number.isFinite(expiresAt)
    && observedAt <= evaluated
    && evaluated <= expiresAt
    && observedAt <= expiresAt;
}

function rightsBlocked(item: VlmEligibilityEvidenceItem, requireCommercialRights: boolean): boolean {
  if (!item.required) return false;
  if (item.rightsState === "BLOCKED" || item.rightsState === "UNKNOWN") return true;
  return requireCommercialRights && item.rightsState === "REVIEW_REQUIRED";
}

function valueEligibility(input: VlmTierEligibilityInput): { eligible: boolean; reasons: VlmEligibilityReasonCode[] } {
  if (input.policy.tier === "basic" || input.policy.minMaterialValueDeltaBps <= 0) return { eligible: true, reasons: [] };
  if (!input.valueDeltaEvidenceReady || input.valueDeltaVsLowerTierBps === null) {
    return { eligible: false, reasons: ["VALUE_DELTA_NOT_PROVEN"] };
  }
  if (input.valueDeltaVsLowerTierBps < input.policy.minMaterialValueDeltaBps) {
    return { eligible: false, reasons: ["VALUE_DELTA_INSUFFICIENT"] };
  }
  return { eligible: true, reasons: [] };
}

function catalogReasons(catalogState: VlmTierCatalogState): VlmEligibilityReasonCode[] {
  if (catalogState === "INVITATION_ONLY") return ["CATALOG_INVITATION_ONLY"];
  if (catalogState === "NOT_FOR_SALE") return ["CATALOG_NOT_FOR_SALE"];
  if (catalogState !== "PUBLIC_SALE" && catalogState !== "FREE") return ["CATALOG_PUBLIC_SALE_DISABLED"];
  return [];
}

function customerState(args: {
  policy: VlmTierEligibilityPolicy;
  runtimeHealth: VlmEligibilityRuntimeHealth;
  missing: readonly string[];
  stale: readonly string[];
  conflicted: readonly string[];
  unsupported: readonly string[];
  rights: readonly string[];
  limitations: readonly string[];
  historicalEligible: boolean;
  valueEligible: boolean;
}): VlmCustomerAvailabilityState {
  if (args.unsupported.length > 0) return "UNSUPPORTED";
  if (args.rights.length > 0) return "RIGHTS_BLOCKED";
  if (args.runtimeHealth === "UNAVAILABLE") return "SYSTEM_DEGRADED";
  if (args.conflicted.length > 0) return "CONFLICTED";
  if (args.stale.length > 0) return args.historicalEligible ? "HISTORICAL_ONLY" : "WAITING_FOR_FRESH_EVIDENCE";
  if (args.missing.length > 0) return args.historicalEligible ? "HISTORICAL_ONLY" : "TEMPORARILY_UNAVAILABLE";
  if (!args.valueEligible) return "TEMPORARILY_UNAVAILABLE";
  if (args.runtimeHealth === "DEGRADED") return "SYSTEM_DEGRADED";
  if (args.policy.catalogState === "INVITATION_ONLY" || args.policy.catalogState === "NOT_FOR_SALE") {
    return "TEMPORARILY_UNAVAILABLE";
  }
  if (args.limitations.length > 0) return "AVAILABLE_WITH_LIMITATIONS";
  return "AVAILABLE";
}

function publicMessage(
  locale: VlmCurrentSkuLocale,
  state: VlmCustomerAvailabilityState,
  suggestedTier: Exclude<VlmCurrentSkuTier, "advanced"> | null,
): string {
  const fallback = suggestedTier
    ? locale === "pl" ? ` Dostępny niższy poziom: ${suggestedTier}.`
      : locale === "de" ? ` Niedrigere verfügbare Stufe: ${suggestedTier}.`
        : ` Lower available tier: ${suggestedTier}.`
    : "";
  const copy: Record<VlmCurrentSkuLocale, Record<VlmCustomerAvailabilityState, string>> = {
    pl: {
      AVAILABLE: "Wymagane dowody są dostępne.",
      AVAILABLE_WITH_LIMITATIONS: "Analiza jest dostępna z jawnie wskazanymi ograniczeniami.",
      WAITING_FOR_FRESH_EVIDENCE: "Oczekujemy na wystarczająco świeże dowody.",
      HISTORICAL_ONLY: "Bieżąca analiza jest niedostępna, ale istnieje prawidłowo oznaczony snapshot historyczny.",
      TEMPORARILY_UNAVAILABLE: "Ten poziom jest obecnie niedostępny, ponieważ nie spełnia pełnego kontraktu dowodowego lub wartości.",
      UNSUPPORTED: "Ten przypadek nie jest obsługiwany przez wybrany poziom.",
      CONFLICTED: "Krytyczne źródła są materialnie sprzeczne i wymagają rozstrzygnięcia.",
      RIGHTS_BLOCKED: "Dane są technicznie osiągalne, ale prawa do użycia nie są wystarczająco potwierdzone.",
      SYSTEM_DEGRADED: "Stan systemu nie pozwala obecnie bezpiecznie dostarczyć tej analizy.",
    },
    en: {
      AVAILABLE: "The required evidence is available.",
      AVAILABLE_WITH_LIMITATIONS: "The analysis is available with explicit limitations.",
      WAITING_FOR_FRESH_EVIDENCE: "Velmère is waiting for sufficiently fresh evidence.",
      HISTORICAL_ONLY: "Current analysis is unavailable, but a correctly labelled historical snapshot exists.",
      TEMPORARILY_UNAVAILABLE: "This tier is currently unavailable because its full evidence or value contract is not satisfied.",
      UNSUPPORTED: "This case is not supported by the selected tier.",
      CONFLICTED: "Critical sources materially disagree and require adjudication.",
      RIGHTS_BLOCKED: "The data is technically reachable, but usage rights are not sufficiently confirmed.",
      SYSTEM_DEGRADED: "System health does not currently allow safe delivery of this analysis.",
    },
    de: {
      AVAILABLE: "Die erforderlichen Nachweise sind verfügbar.",
      AVAILABLE_WITH_LIMITATIONS: "Die Analyse ist mit ausdrücklich genannten Einschränkungen verfügbar.",
      WAITING_FOR_FRESH_EVIDENCE: "Velmère wartet auf ausreichend aktuelle Nachweise.",
      HISTORICAL_ONLY: "Die aktuelle Analyse ist nicht verfügbar, aber ein korrekt gekennzeichneter historischer Snapshot liegt vor.",
      TEMPORARILY_UNAVAILABLE: "Diese Stufe ist derzeit nicht verfügbar, weil ihr vollständiger Nachweis- oder Wertvertrag nicht erfüllt ist.",
      UNSUPPORTED: "Dieser Fall wird von der ausgewählten Stufe nicht unterstützt.",
      CONFLICTED: "Kritische Quellen widersprechen sich wesentlich und müssen geklärt werden.",
      RIGHTS_BLOCKED: "Die Daten sind technisch erreichbar, aber die Nutzungsrechte sind nicht ausreichend bestätigt.",
      SYSTEM_DEGRADED: "Der Systemzustand erlaubt derzeit keine sichere Bereitstellung dieser Analyse.",
    },
  };
  return `${copy[locale][state]}${fallback}`;
}

export function evaluateVlmTierEligibility(input: VlmTierEligibilityInput): VlmTierEligibilityReceipt {
  const evaluatedAt = safeIso(input.evaluatedAt, "evaluated_at")!;
  const lastFullyEligibleAt = safeIso(input.lastFullyEligibleAt, "last_fully_eligible_at");
  const nextCheckAt = safeIso(input.nextCheckAt, "next_check_at");
  const estimatedRestorationAt = safeIso(input.estimatedRestorationAt, "estimated_restoration_at");
  const subjectId = cleanToken(input.subjectId, "subject_id", 180);
  const sourceHash = cleanToken(input.sourceHash, "source_hash", 96);
  const policyVersion = cleanToken(input.policy.policyVersion, "policy_version", 120);
  if (!/^sha256:[a-f0-9]{64}$/iu.test(sourceHash)) throw new Error("tier_eligibility_source_hash_invalid");
  if (!Number.isInteger(input.policy.minMaterialValueDeltaBps) || input.policy.minMaterialValueDeltaBps < 0 || input.policy.minMaterialValueDeltaBps > 10_000) {
    throw new Error("tier_eligibility_value_threshold_invalid");
  }
  if (estimatedRestorationAt !== null && !cleanToken(input.estimatedRestorationBasis ?? "", "estimated_restoration_basis", 280)) {
    throw new Error("tier_eligibility_restoration_basis_required");
  }

  const evidence = [...input.evidence].sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(evidence.map((item) => item.id)).size !== evidence.length) throw new Error("tier_eligibility_evidence_id_duplicate");
  const required = evidence.filter((item) => item.required);
  const critical = required.filter((item) => item.critical);
  const available = required.filter((item) =>
    !isUnavailableTruth(item.truthState)
    && item.truthState !== "UNSUPPORTED"
    && item.truthState !== "CONFLICTED"
    && hasBoundCurrentWindow(item, evaluatedAt, input.policy.requiresCurrentEvidence));
  const missing = critical.filter((item) => isUnavailableTruth(item.truthState)).map((item) => item.id);
  const stale = critical.filter((item) =>
    isStale(item, input.policy.requiresCurrentEvidence)
    || !hasBoundCurrentWindow(item, evaluatedAt, input.policy.requiresCurrentEvidence)).map((item) => item.id);
  const conflicted = critical.filter((item) => item.truthState === "CONFLICTED").map((item) => item.id);
  const unsupported = critical.filter((item) => item.truthState === "UNSUPPORTED").map((item) => item.id);
  const rights = critical.filter((item) => rightsBlocked(item, input.policy.requireCommercialRights)).map((item) => item.id);
  const runtimeBlocked = critical.filter((item) => !item.runtimeReachable).map((item) => item.id);
  const limitations = required
    .filter((item) => !item.critical && (
      isUnavailableTruth(item.truthState)
      || isStale(item, input.policy.requiresCurrentEvidence)
      || item.truthState === "CONFLICTED"
      || item.truthState === "UNSUPPORTED"
      || rightsBlocked(item, input.policy.requireCommercialRights)
      || !item.runtimeReachable
    ))
    .map((item) => item.id);

  const blockedCriticalIds = unique([...missing, ...stale, ...conflicted, ...unsupported, ...rights, ...runtimeBlocked]);
  const historicalEligible = input.policy.allowHistoricalFallback
    && blockedCriticalIds.length > 0
    && critical
      .filter((item) => blockedCriticalIds.includes(item.id))
      .every((item) => item.historicalAvailable && !rightsBlocked(item, input.policy.requireCommercialRights));
  const value = valueEligibility(input);
  const reasons: VlmEligibilityReasonCode[] = [
    ...catalogReasons(input.policy.catalogState),
    ...(missing.length ? ["CRITICAL_EVIDENCE_MISSING" as const] : []),
    ...(stale.length ? ["CRITICAL_EVIDENCE_STALE" as const] : []),
    ...(conflicted.length ? ["CRITICAL_EVIDENCE_CONFLICTED" as const] : []),
    ...(unsupported.length ? ["CRITICAL_EVIDENCE_UNSUPPORTED" as const] : []),
    ...(rights.length ? ["RIGHTS_NOT_CONFIRMED" as const] : []),
    ...(runtimeBlocked.length || input.runtimeHealth === "UNAVAILABLE" ? ["RUNTIME_UNAVAILABLE" as const] : []),
    ...(input.runtimeHealth === "DEGRADED" ? ["RUNTIME_DEGRADED" as const] : []),
    ...value.reasons,
    ...(limitations.length ? ["LIMITATIONS_PRESENT" as const] : []),
    ...(historicalEligible ? ["HISTORICAL_FALLBACK_AVAILABLE" as const]
      : blockedCriticalIds.length && input.policy.allowHistoricalFallback ? ["NO_SAFE_HISTORICAL_FALLBACK" as const] : []),
  ];

  const availabilityState = customerState({
    policy: input.policy,
    runtimeHealth: input.runtimeHealth,
    missing,
    stale,
    conflicted,
    unsupported,
    rights,
    limitations,
    historicalEligible,
    valueEligible: value.eligible,
  });
  const evidenceEligible = blockedCriticalIds.length === 0
    && input.runtimeHealth !== "UNAVAILABLE"
    && value.eligible
    && (limitations.length === 0 || input.policy.allowLimitations);
  const analysisEligible = evidenceEligible;
  const checkoutEligible = analysisEligible && input.policy.catalogState === "PUBLIC_SALE";
  const saleEligible = checkoutEligible;

  const unsigned = {
    schemaVersion: VLM_TIER_ELIGIBILITY_RECEIPT_SCHEMA,
    eligibilityId: "pending",
    product: input.policy.product,
    tier: input.policy.tier,
    subjectId,
    evaluatedAt,
    sourceHash,
    policyVersion,
    catalogState: input.policy.catalogState,
    availabilityState,
    analysisEligible,
    checkoutEligible,
    saleEligible,
    valueEligible: value.eligible,
    historicalEligible,
    requiredEvidenceIds: required.map((item) => item.id),
    availableEvidenceIds: available.map((item) => item.id),
    missingEvidenceIds: missing,
    staleEvidenceIds: stale,
    conflictedEvidenceIds: conflicted,
    unsupportedEvidenceIds: unsupported,
    rightsBlockedEvidenceIds: rights,
    runtimeBlockedEvidenceIds: runtimeBlocked,
    limitationEvidenceIds: limitations,
    reasonCodes: unique(reasons),
    lastFullyEligibleAt,
    nextCheckAt,
    estimatedRestorationAt,
    estimatedRestorationBasis: estimatedRestorationAt === null ? null : cleanToken(input.estimatedRestorationBasis!, "estimated_restoration_basis", 280),
    suggestedLowerTier: input.suggestedLowerTier,
  } as const;
  const receiptHash = sha256Digest(canonicalJson(unsigned));
  const eligibilityId = `eligibility-${receiptHash.slice("sha256:".length, "sha256:".length + 32)}`;
  return { ...unsigned, eligibilityId, receiptHash };
}

export function verifyVlmTierEligibilityReceipt(value: VlmTierEligibilityReceipt): boolean {
  try {
    const { receiptHash, eligibilityId: _eligibilityId, ...rest } = value;
    const unsigned = { ...rest, eligibilityId: "pending" };
    const rebuiltHash = sha256Digest(canonicalJson(unsigned));
    const expectedId = `eligibility-${rebuiltHash.slice("sha256:".length, "sha256:".length + 32)}`;
    return rebuiltHash === receiptHash && expectedId === value.eligibilityId;
  } catch {
    return false;
  }
}

export function buildPublicVlmTierEligibility(
  receipt: VlmTierEligibilityReceipt,
  locale: VlmCurrentSkuLocale,
): PublicVlmTierEligibility {
  if (!verifyVlmTierEligibilityReceipt(receipt)) throw new Error("tier_eligibility_receipt_invalid");
  const missingEvidence = unique([
    ...receipt.missingEvidenceIds,
    ...receipt.staleEvidenceIds,
    ...receipt.conflictedEvidenceIds,
    ...receipt.unsupportedEvidenceIds,
    ...receipt.rightsBlockedEvidenceIds,
    ...receipt.runtimeBlockedEvidenceIds,
  ]).slice(0, 24);
  return {
    schemaVersion: VLM_PUBLIC_TIER_ELIGIBILITY_SCHEMA,
    eligibilityId: receipt.eligibilityId,
    product: receipt.product,
    tier: receipt.tier,
    evaluatedAt: receipt.evaluatedAt,
    availabilityState: receipt.availabilityState,
    analysisEligible: receipt.analysisEligible,
    checkoutEligible: receipt.checkoutEligible,
    saleEligible: receipt.saleEligible,
    valueEligible: receipt.valueEligible,
    historicalEligible: receipt.historicalEligible,
    missingEvidence,
    reasonCodes: receipt.reasonCodes,
    lastFullyAvailableAt: receipt.lastFullyEligibleAt,
    nextAutomaticCheckAt: receipt.nextCheckAt,
    estimatedRestorationAt: receipt.estimatedRestorationAt,
    estimatedRestorationKnown: receipt.estimatedRestorationAt !== null,
    suggestedLowerTier: receipt.suggestedLowerTier,
    customerMessage: publicMessage(locale, receipt.availabilityState, receipt.suggestedLowerTier),
    integrityToken: receipt.receiptHash,
  };
}

function truthStateFromAvailability(value: VlmFieldAvailabilityState): VlmEligibilityTruthState {
  if (value === "AVAILABLE_OWNED" || value === "AVAILABLE_PUBLIC_CHAIN" || value === "AVAILABLE_PUBLIC_REGULATOR" || value === "AVAILABLE_RIGHTS_APPROVED_PROVIDER" || value === "AVAILABLE_USER_SUPPLIED" || value === "AVAILABLE_MANUAL_REVIEW") return "REAL_CURRENT";
  if (value === "AVAILABLE_DERIVED") return "DERIVED_CURRENT";
  if (value === "SYNTHETIC_ONLY") return "FIXTURE";
  return "UNAVAILABLE";
}

function rightsStateFromField(field: VlmFieldEvaluation): VlmEligibilityRightsState {
  if (field.availability === "BLOCKED_RIGHTS") return "BLOCKED";
  if (field.sourceClass === "EXTERNAL_PROVIDER" && field.availability !== "AVAILABLE_RIGHTS_APPROVED_PROVIDER") return "UNKNOWN";
  return "ALLOWED";
}

function catalogStateForTier(tier: VlmCurrentSkuTier, locale: VlmCurrentSkuLocale): VlmTierCatalogState {
  const truth = getVlmCurrentSkuTruth(tier, locale);
  if (tier === "basic") return "FREE";
  if (truth.decision === "INVITATION_ONLY_CONTROLLED_BETA") return "INVITATION_ONLY";
  if (truth.decision === "NOT_FOR_SALE") return "NOT_FOR_SALE";
  return "NOT_FOR_SALE";
}

function defaultSuggestedTier(tier: VlmCurrentSkuTier): Exclude<VlmCurrentSkuTier, "advanced"> | null {
  return tier === "advanced" ? "pro" : tier === "pro" ? "basic" : null;
}

export function buildCurrentVlmTierEligibility(args: {
  commercial: VlmCommercialReadiness;
  subjectId: string;
  product?: VlmEligibilityProduct;
  evaluatedAt?: string;
}): VlmTierEligibilityReceipt {
  const commercial = args.commercial;
  const tier = commercial.tier;
  const locale = commercial.locale;
  const valueGate = tier === "advanced" ? "incremental_detection_value" : "customer_value";
  const valueDeltaEvidenceReady = tier === "basic" || commercial.passedGates.includes(valueGate);
  const runtimeHealth: VlmEligibilityRuntimeHealth = commercial.passedGates.includes("staging_operations")
    ? "HEALTHY"
    : commercial.passedGates.includes("source_authority") ? "DEGRADED" : "UNAVAILABLE";
  const evidence: VlmEligibilityEvidenceItem[] = commercial.fieldReadiness.fields.map((field) => ({
    id: field.fieldId,
    label: field.label,
    required: field.required,
    critical: field.critical,
    truthState: truthStateFromAvailability(field.availability),
    freshness: field.effectiveReady ? "CURRENT" : "NOT_APPLICABLE",
    rightsState: rightsStateFromField(field),
    runtimeReachable: field.availability !== "BLOCKED_OPERATIONS",
    historicalAvailable: false,
    observedAt: null,
    expiresAt: null,
  }));
  const sourceHash = sha256Digest(canonicalJson({
    schemaVersion: commercial.schemaVersion,
    family: commercial.family,
    tier: commercial.tier,
    passedGates: commercial.passedGates,
    blockedFieldIds: commercial.blockedFieldIds,
    fieldReadiness: commercial.fieldReadiness.fields.map((field) => ({
      fieldId: field.fieldId,
      availability: field.availability,
      effectiveReady: field.effectiveReady,
      critical: field.critical,
    })),
  }));
  return evaluateVlmTierEligibility({
    evaluatedAt: args.evaluatedAt ?? new Date().toISOString(),
    subjectId: args.subjectId,
    sourceHash,
    policy: {
      policyVersion: "velmere.dynamic-tier-eligibility.current.v1",
      product: args.product ?? commercial.family,
      tier,
      locale,
      catalogState: catalogStateForTier(tier, locale),
      requiresCurrentEvidence: true,
      requireCommercialRights: tier !== "basic",
      allowLimitations: tier === "basic",
      allowHistoricalFallback: true,
      minMaterialValueDeltaBps: tier === "basic" ? 0 : tier === "pro" ? 1_000 : 1_500,
    },
    evidence,
    runtimeHealth,
    valueDeltaVsLowerTierBps: valueDeltaEvidenceReady ? 10_000 : null,
    valueDeltaEvidenceReady,
    lastFullyEligibleAt: null,
    nextCheckAt: null,
    estimatedRestorationAt: null,
    estimatedRestorationBasis: null,
    suggestedLowerTier: defaultSuggestedTier(tier),
  });
}

export function decidePostPaymentEligibility(args: {
  purchasedTier: VlmCurrentSkuTier;
  latestReceipt: VlmTierEligibilityReceipt;
  analysisStarted: boolean;
  explicitDowngradeConsent: boolean;
}): VlmPostPaymentEligibilityDecision {
  if (!verifyVlmTierEligibilityReceipt(args.latestReceipt)) throw new Error("tier_eligibility_receipt_invalid");
  if (args.latestReceipt.tier !== args.purchasedTier) throw new Error("tier_eligibility_purchase_tier_mismatch");
  if (args.latestReceipt.saleEligible && args.latestReceipt.analysisEligible) {
    return { action: "CONTINUE", deliverTier: args.purchasedTier, silentDowngradeAllowed: false, reasonCodes: args.latestReceipt.reasonCodes };
  }
  if (args.explicitDowngradeConsent && args.latestReceipt.suggestedLowerTier) {
    return {
      action: "CONTINUE_WITH_EXPLICIT_DOWNGRADE",
      deliverTier: args.latestReceipt.suggestedLowerTier,
      silentDowngradeAllowed: false,
      reasonCodes: args.latestReceipt.reasonCodes,
    };
  }
  return {
    action: args.analysisStarted ? "PAUSE_AND_RETRY" : "CANCEL_AND_REFUND",
    deliverTier: null,
    silentDowngradeAllowed: false,
    reasonCodes: args.latestReceipt.reasonCodes,
  };
}

export function selectHighestEligibleTier(receipts: readonly VlmTierEligibilityReceipt[]): VlmCurrentSkuTier | null {
  const verified = receipts.filter((receipt) => verifyVlmTierEligibilityReceipt(receipt) && receipt.analysisEligible);
  for (const tier of [...TIER_ORDER].reverse()) {
    if (verified.some((receipt) => receipt.tier === tier)) return tier;
  }
  return null;
}
