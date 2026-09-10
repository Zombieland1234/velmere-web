import { createHash } from "node:crypto";

export const PASS35_CANONICAL_PACKET_SCHEMA = "velmere.pass35.canonical-packet.v1" as const;

type Tier = "basic" | "pro" | "advanced";
type ClaimKind = "FACT" | "FINDING" | "INFERENCE" | "ASSUMPTION" | "LIMITATION" | "NOT_TESTED";
type PacketState = "ORIGINAL" | "EXPLICIT_FALLBACK" | "CORRECTION";

export type Pass35CanonicalClaim = Readonly<{
  claimId: string;
  kind: ClaimKind;
  text: string;
  severity: "info" | "low" | "medium" | "high" | "critical" | null;
  confidence: number | null;
  evidenceIds: readonly string[];
}>;

export type Pass35CanonicalFieldProvenance = Readonly<{
  fieldId: string;
  providerId: string;
  providerFamily: string;
  observedAt: string;
  maxAgeMs: number;
  rightsState: "SELL_ELIGIBLE" | "DISPLAY_ONLY" | "WITHHELD" | "UNVERIFIED" | "WITHDRAWN";
  sourceReceiptSha256: string;
}>;

export type Pass35CanonicalPacketInput = Readonly<{
  productCellId: string;
  skuId: string;
  tier: Tier;
  releaseId: string;
  sourceSha256: string;
  artifactSha256: string;
  configSha256: string;
  accountIdHash: string;
  caseIdHash: string;
  providerHashes: readonly string[];
  dataHashes: readonly string[];
  modelHash: string | null;
  promptHash: string | null;
  reviewerHashes: readonly string[];
  policyHashes: readonly string[];
  provenance: readonly Pass35CanonicalFieldProvenance[];
  claims: readonly Pass35CanonicalClaim[];
  contradictions: readonly string[];
  missingProof: readonly string[];
  methodology: readonly string[];
  uncertainty: string;
  abstained: boolean;
  humanReview: Readonly<{
    required: boolean;
    completed: boolean;
    reviewerIdHash: string | null;
    conflictDeclarationSha256: string | null;
  }>;
  commercialRefs: Readonly<{
    paymentReceiptHash: string | null;
    entitlementIdHash: string | null;
    deliveryReceiptHash: string | null;
    refundPolicyVersion: string;
  }>;
  packetState: PacketState;
  fallbackReason: string | null;
  supersedesPacketHash: string | null;
  createdAt: string;
  validUntil: string;
  invalidationTriggers: readonly string[];
}>;

export type Pass35CanonicalPacket = Readonly<Pass35CanonicalPacketInput & {
  schemaVersion: typeof PASS35_CANONICAL_PACKET_SCHEMA;
  packetId: string;
  factsHash: string;
  packetHash: string;
  signature: null;
}>;

const DIGEST = /^[a-f0-9]{64}$/u;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{2,255}$/u;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertIso(value: string, code: string): void {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) throw new Error(code);
}

function assertDigest(value: string | null, code: string, allowNull = false): void {
  if (allowNull && value === null) return;
  if (!DIGEST.test(value ?? "")) throw new Error(code);
}

function assertUnique(values: readonly string[], code: string): void {
  if (new Set(values).size !== values.length) throw new Error(code);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function buildPass35CanonicalPacket(input: Pass35CanonicalPacketInput): Pass35CanonicalPacket {
  if (!SAFE_ID.test(input.productCellId)) throw new Error("pass35_packet_product_cell_invalid");
  if (!SAFE_ID.test(input.skuId)) throw new Error("pass35_packet_sku_invalid");
  for (const [label, digest] of [
    ["source", input.sourceSha256],
    ["artifact", input.artifactSha256],
    ["config", input.configSha256],
    ["account", input.accountIdHash],
    ["case", input.caseIdHash],
  ] as const) assertDigest(digest, `pass35_packet_${label}_hash_invalid`);
  for (const [label, values] of [
    ["provider", input.providerHashes],
    ["data", input.dataHashes],
    ["reviewer", input.reviewerHashes],
    ["policy", input.policyHashes],
  ] as const) {
    assertUnique(values, `pass35_packet_${label}_hash_duplicate`);
    values.forEach((digest) => assertDigest(digest, `pass35_packet_${label}_hash_invalid`));
  }
  assertDigest(input.modelHash, "pass35_packet_model_hash_invalid", true);
  assertDigest(input.promptHash, "pass35_packet_prompt_hash_invalid", true);
  assertIso(input.createdAt, "pass35_packet_created_at_invalid");
  assertIso(input.validUntil, "pass35_packet_valid_until_invalid");
  if (Date.parse(input.validUntil) <= Date.parse(input.createdAt)) throw new Error("pass35_packet_expiry_not_after_creation");
  if (!input.claims.length) throw new Error("pass35_packet_claims_empty");
  assertUnique(input.claims.map((claim) => claim.claimId), "pass35_packet_claim_id_duplicate");
  for (const claim of input.claims) {
    if (!SAFE_ID.test(claim.claimId) || !claim.text.trim()) throw new Error("pass35_packet_claim_invalid");
    if (claim.confidence !== null && (!Number.isFinite(claim.confidence) || claim.confidence < 0 || claim.confidence > 1)) {
      throw new Error("pass35_packet_claim_confidence_invalid");
    }
    assertUnique(claim.evidenceIds, "pass35_packet_claim_evidence_duplicate");
  }
  assertUnique(input.provenance.map((row) => row.fieldId), "pass35_packet_field_provenance_duplicate");
  for (const row of input.provenance) {
    assertIso(row.observedAt, "pass35_packet_observed_at_invalid");
    if (!Number.isSafeInteger(row.maxAgeMs) || row.maxAgeMs <= 0) throw new Error("pass35_packet_max_age_invalid");
    assertDigest(row.sourceReceiptSha256, "pass35_packet_source_receipt_hash_invalid");
  }
  if (input.humanReview.required && (!input.humanReview.completed || !input.humanReview.reviewerIdHash || !input.humanReview.conflictDeclarationSha256)) {
    throw new Error("pass35_packet_required_human_review_missing");
  }
  assertDigest(input.humanReview.reviewerIdHash, "pass35_packet_reviewer_id_hash_invalid", true);
  assertDigest(input.humanReview.conflictDeclarationSha256, "pass35_packet_conflict_hash_invalid", true);
  if (input.packetState === "EXPLICIT_FALLBACK" && !input.fallbackReason) throw new Error("pass35_packet_fallback_reason_missing");
  if (input.packetState !== "EXPLICIT_FALLBACK" && input.fallbackReason) throw new Error("pass35_packet_unexpected_fallback_reason");
  if (input.packetState === "CORRECTION") assertDigest(input.supersedesPacketHash, "pass35_packet_supersedes_hash_missing");
  if (input.packetState !== "CORRECTION" && input.supersedesPacketHash) throw new Error("pass35_packet_unexpected_supersedes_hash");
  if (!input.invalidationTriggers.length) throw new Error("pass35_packet_invalidation_triggers_empty");

  const normalized = JSON.parse(JSON.stringify(input)) as Pass35CanonicalPacketInput;
  const factsHash = sha256(canonicalJson(normalized.claims));
  const core = { schemaVersion: PASS35_CANONICAL_PACKET_SCHEMA, ...normalized, factsHash };
  const packetHash = sha256(canonicalJson(core));
  return deepFreeze({ ...core, packetId: `pkt_${packetHash}`, packetHash, signature: null });
}

export function assertPass35ArtifactParity(
  packet: Pass35CanonicalPacket,
  representations: readonly Readonly<{ channel: "api" | "ui" | "preview" | "pdf" | "brain" | "angel"; packetId: string; packetHash: string; factsHash: string; }>[],
): void {
  if (!representations.length) throw new Error("pass35_packet_parity_representations_empty");
  assertUnique(representations.map((row) => row.channel), "pass35_packet_parity_channel_duplicate");
  for (const row of representations) {
    if (row.packetId !== packet.packetId || row.packetHash !== packet.packetHash || row.factsHash !== packet.factsHash) {
      throw new Error(`pass35_packet_parity_mismatch:${row.channel}`);
    }
  }
}
