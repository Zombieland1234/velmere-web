import registry from "../../config/p99/real-markets-basic-field-rights-currentness-registry.json";
import rightsMatrix from "../../config/pass36/a102r44p18-official-provider-rights-decision-matrix.json";
import { buildProviderRightsProjection } from "../compliance/provider-delivery-rights-gate.mjs";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest, sha256Hex } from "@/lib/security/cryptographic-digest";

export const P99_REAL_MARKETS_BASIC_FIELD_POLICY_ID =
  "velmere.p99.real-markets-basic-field-policy.v1" as const;
export const P99_REAL_MARKETS_BASIC_REGISTRY_SHA256 =
  "3fa00531c41c8740c44d394bb85286735b8f0b1ff03fb1117011ee6c8069144d" as const;

export type RealMarketsFieldSemanticClass =
  | "reference"
  | "indicative"
  | "delayed"
  | "official_close"
  | "current_quote"
  | "venue_quote"
  | "executable_quote"
  | "derived"
  | "historical"
  | "provider_timestamp";

export type RealMarketsBasicFieldContract = {
  fieldId: string;
  semanticClass: RealMarketsFieldSemanticClass;
  unit: string;
  currency: string | null;
  venueScope: "aggregated_multi_venue_reference";
  executionEligible: false;
  currentnessClass: "provider_timestamped_reference";
  maxAgeSeconds: number;
  rightsStatus: "WITHHELD_UNVERIFIED" | "APPROVED";
  publicDisplayAllowed: boolean;
  customerDeliveryAllowed: boolean;
  rightsEvidenceId: string | null;
  rightsDocumentSha256: string | null;
  reverifyBy: string | null;
};

export type RealMarketsBasicDeliveryPreflight = {
  schemaVersion: typeof P99_REAL_MARKETS_BASIC_FIELD_POLICY_ID;
  requestedTier: "basic";
  state: "READY_REFERENCE" | "WITHHELD_RIGHTS_UNVERIFIED" | "WITHHELD_REGISTRY_INVALID";
  customerDeliveryAllowed: boolean;
  providerNetworkAllowed: boolean;
  liveClaimed: false;
  executableQuoteClaimed: false;
  priceSemanticClass: "reference";
  fieldCount: number;
  displayEligibleFieldCount: number;
  customerEligibleFieldCount: number;
  blockedFieldCount: number;
  blockers: string[];
  registrySha256: string;
  rightsMatrixSha256: string;
  decisionDigest: string;
};

const SHA256_HEX = /^[a-f0-9]{64}$/u;
const EXPECTED_FIELD_IDS = Object.freeze([
  "identity.market_id",
  "identity.symbol",
  "identity.name",
  "market.rank",
  "market.image",
  "market.price",
  "market.change_1h",
  "market.change_24h",
  "market.change_7d",
  "market.change_14d",
  "market.change_30d",
  "market.market_cap",
  "market.fdv",
  "market.volume_24h",
  "market.high_24h",
  "market.low_24h",
  "market.observed_at",
  "market.ath",
  "market.ath_change",
  "market.circulating_supply",
  "market.total_supply",
  "market.max_supply",
  "market.sparkline_7d",
] as const);

function withoutRegistrySha(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "registrySha256"));
}

function currentRegistryIntegrity() {
  const candidate = registry as unknown as Record<string, unknown> & {
    registrySha256?: unknown;
    fields?: unknown;
  };
  const declared = typeof candidate.registrySha256 === "string" ? candidate.registrySha256 : "";
  const recomputed = sha256Hex(canonicalJson(withoutRegistrySha(candidate)));
  const fields = Array.isArray(candidate.fields) ? candidate.fields : [];
  const fieldIds = fields.map((row) => String((row as { fieldId?: unknown }).fieldId ?? ""));
  return {
    declared,
    recomputed,
    valid:
      declared === P99_REAL_MARKETS_BASIC_REGISTRY_SHA256
      && recomputed === P99_REAL_MARKETS_BASIC_REGISTRY_SHA256
      && fieldIds.length === EXPECTED_FIELD_IDS.length
      && fieldIds.every((fieldId, index) => fieldId === EXPECTED_FIELD_IDS[index])
      && new Set(fieldIds).size === fieldIds.length,
  };
}

export function getP99RealMarketsBasicFieldContracts(): readonly RealMarketsBasicFieldContract[] {
  const integrity = currentRegistryIntegrity();
  if (!integrity.valid) throw new Error("p99_real_markets_basic_registry_integrity_failed");
  return Object.freeze((registry.fields as RealMarketsBasicFieldContract[]).map((field) => Object.freeze({ ...field })));
}

export function getP99RealMarketsFieldContract(fieldId: string): RealMarketsBasicFieldContract {
  const field = getP99RealMarketsBasicFieldContracts().find((candidate) => candidate.fieldId === fieldId);
  if (!field) throw new Error(`p99_real_markets_field_contract_missing:${fieldId}`);
  return field;
}

function buildDecision(args: {
  registryValid: boolean;
  publicDisplayAllowed: boolean;
  customerDeliveryAllowed: boolean;
  fields: readonly RealMarketsBasicFieldContract[];
}): Omit<RealMarketsBasicDeliveryPreflight, "decisionDigest"> {
  const displayEligibleFieldCount = args.fields.filter((field) =>
    field.rightsStatus === "APPROVED"
    && field.publicDisplayAllowed
    && typeof field.rightsEvidenceId === "string"
    && field.rightsEvidenceId.length > 0
    && typeof field.rightsDocumentSha256 === "string"
    && SHA256_HEX.test(field.rightsDocumentSha256)).length;
  const customerEligibleFieldCount = args.fields.filter((field) =>
    field.rightsStatus === "APPROVED"
    && field.customerDeliveryAllowed
    && typeof field.rightsEvidenceId === "string"
    && field.rightsEvidenceId.length > 0
    && typeof field.rightsDocumentSha256 === "string"
    && SHA256_HEX.test(field.rightsDocumentSha256)).length;
  const allFieldsEligible = displayEligibleFieldCount === args.fields.length
    && customerEligibleFieldCount === args.fields.length;
  const blockers = [
    args.registryValid ? null : "field_registry_integrity_failed",
    args.publicDisplayAllowed ? null : "provider_public_display_rights_not_approved",
    args.customerDeliveryAllowed ? null : "provider_customer_delivery_rights_not_approved",
    displayEligibleFieldCount === args.fields.length ? null : `field_public_display_rights_shortfall:${displayEligibleFieldCount}/${args.fields.length}`,
    customerEligibleFieldCount === args.fields.length ? null : `field_customer_delivery_rights_shortfall:${customerEligibleFieldCount}/${args.fields.length}`,
  ].filter((value): value is string => Boolean(value));
  const ready = args.registryValid && args.publicDisplayAllowed && args.customerDeliveryAllowed && allFieldsEligible;
  return {
    schemaVersion: P99_REAL_MARKETS_BASIC_FIELD_POLICY_ID,
    requestedTier: "basic",
    state: !args.registryValid ? "WITHHELD_REGISTRY_INVALID" : ready ? "READY_REFERENCE" : "WITHHELD_RIGHTS_UNVERIFIED",
    customerDeliveryAllowed: ready,
    providerNetworkAllowed: ready,
    liveClaimed: false,
    executableQuoteClaimed: false,
    priceSemanticClass: "reference",
    fieldCount: args.fields.length,
    displayEligibleFieldCount,
    customerEligibleFieldCount,
    blockedFieldCount: args.fields.length - Math.min(displayEligibleFieldCount, customerEligibleFieldCount),
    blockers,
    registrySha256: P99_REAL_MARKETS_BASIC_REGISTRY_SHA256,
    rightsMatrixSha256: String((rightsMatrix as { matrixSha256?: unknown }).matrixSha256 ?? ""),
  };
}

export function buildP99RealMarketsBasicDeliveryPreflight(): RealMarketsBasicDeliveryPreflight {
  const integrity = currentRegistryIntegrity();
  const fields = integrity.valid ? getP99RealMarketsBasicFieldContracts() : [];
  const projection = buildProviderRightsProjection({ providerId: registry.providerId, matrix: rightsMatrix });
  const unsigned = buildDecision({
    registryValid: integrity.valid,
    publicDisplayAllowed: projection.publicDisplayAllowed === true,
    customerDeliveryAllowed: projection.customerDeliveryAllowed === true,
    fields,
  });
  return { ...unsigned, decisionDigest: sha256Digest(canonicalJson(unsigned)) };
}

export function verifyP99RealMarketsBasicDeliveryPreflight(
  decision: RealMarketsBasicDeliveryPreflight,
): boolean {
  const expected = buildP99RealMarketsBasicDeliveryPreflight();
  return canonicalJson(expected) === canonicalJson(decision);
}

export function toP99CustomerSafeRealMarketsBasicWithheld(
  decision: RealMarketsBasicDeliveryPreflight,
) {
  if (!verifyP99RealMarketsBasicDeliveryPreflight(decision) || decision.customerDeliveryAllowed) {
    throw new Error("p99_real_markets_basic_withheld_projection_not_authorized");
  }
  return {
    schemaVersion: "velmere.p99.real-markets-basic-withheld.v1" as const,
    mode: "error" as const,
    availability: "WITHHELD" as const,
    error: "market_data_customer_delivery_unavailable" as const,
    reason: "Customer-display rights for the required market fields are not verified." as const,
    requestedTier: "basic" as const,
    rows: [] as const,
    currentness: "UNKNOWN_BLOCKED" as const,
    priceSemanticClass: "reference" as const,
    liveClaimed: false as const,
    executableQuoteClaimed: false as const,
    retryAfter: null,
  };
}
