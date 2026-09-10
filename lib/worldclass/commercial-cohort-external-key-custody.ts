import {
  createHash,
  createPublicKey,
  randomUUID,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";
import { runBoundExternalCommand, type ExternalCommandBoundary } from "@/lib/security/external-command-boundary";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";

export const PASS4812_EXTERNAL_SIGNING_POLICY_ID = "pass4812-external-key-custody-v1" as const;
export const PASS4812_EXTERNAL_SIGNING_REQUEST_SCHEMA = "velmere.external-signing-request.v1" as const;
export const PASS4812_EXTERNAL_SIGNING_RESPONSE_SCHEMA = "velmere.external-signing-response.v1" as const;

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,191}$/;
const MAX_REQUEST_LIFETIME_MS = 10 * 60 * 1_000;
const CLOCK_SKEW_MS = 60_000;
const MAX_SIGNER_OUTPUT_BYTES = 128 * 1024;

export type CommercialCohortExternalSignerProvider =
  | "aws-kms"
  | "gcp-cloud-kms"
  | "azure-key-vault"
  | "vault-transit"
  | "pkcs11-hsm"
  | "test-only";

export type CommercialCohortExternalSigningPurpose = "root" | "release" | "witness" | "deployment" | "staging-e2e" | "chaos-recovery" | "observability-incident" | "privacy-abuse-audit";

export type CommercialCohortExternalSigningRequest = {
  schemaVersion: typeof PASS4812_EXTERNAL_SIGNING_REQUEST_SCHEMA;
  policyVersion: typeof PASS4812_EXTERNAL_SIGNING_POLICY_ID;
  requestId: string;
  environment: "staging" | "production";
  audience: string;
  purpose: CommercialCohortExternalSigningPurpose;
  keyId: string;
  algorithm: "Ed25519";
  expectedPublicKeyFingerprint: string;
  payloadDigest: string;
  payloadBase64Url: string;
  approvalTicketDigest: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
};

export type CommercialCohortExternalSigningResponse = {
  schemaVersion: typeof PASS4812_EXTERNAL_SIGNING_RESPONSE_SCHEMA;
  policyVersion: typeof PASS4812_EXTERNAL_SIGNING_POLICY_ID;
  requestId: string;
  keyId: string;
  provider: CommercialCohortExternalSignerProvider;
  keyVersion: string;
  publicKeyPem: string;
  publicKeyFingerprint: string;
  signature: string;
  signedAt: string;
  custodyReceiptDigest: string;
};

export type CommercialCohortExternalSignerCommand = ExternalCommandBoundary & {
  provider: CommercialCohortExternalSignerProvider;
  timeoutMs?: number;
};

function clean(value: unknown, max = 4096): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function requiredId(value: unknown, code: string): string {
  const text = clean(value, 192);
  if (!SAFE_ID.test(text)) throw new Error(code);
  return text;
}

function requiredDigest(value: unknown, code: string): string {
  const text = clean(value, 80).toLowerCase();
  if (!DIGEST.test(text)) throw new Error(code);
  return text;
}

function parseDate(value: unknown, code: string): Date {
  const text = clean(value, 64);
  const date = new Date(text);
  if (!text || !Number.isFinite(date.getTime())) throw new Error(code);
  return date;
}

function normalizePem(value: unknown): string {
  return clean(value, 16_384).replace(/\\n/g, "\n");
}

function ed25519PublicKey(value: unknown): KeyObject {
  const key = createPublicKey(normalizePem(value));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("external_signer_public_key_not_ed25519");
  return key;
}

export function commercialCohortPublicKeyFingerprint(publicKeyPem: string): string {
  const key = ed25519PublicKey(publicKeyPem);
  const der = key.export({ type: "spki", format: "der" });
  return `sha256:${createHash("sha256").update(der).digest("hex")}`;
}

function requiredSignature(value: unknown): string {
  const text = clean(value, 256).replace(/=+$/g, "");
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error("external_signer_signature_encoding_invalid");
  const bytes = Buffer.from(text, "base64url");
  if (bytes.length !== 64 || bytes.toString("base64url") !== text) throw new Error("external_signer_signature_encoding_invalid");
  return text;
}

function payloadBytes(request: CommercialCohortExternalSigningRequest): Buffer {
  const encoded = clean(request.payloadBase64Url, 1_000_000).replace(/=+$/g, "");
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("external_signer_payload_encoding_invalid");
  const bytes = Buffer.from(encoded, "base64url");
  if (bytes.toString("base64url") !== encoded) throw new Error("external_signer_payload_encoding_invalid");
  if (sha256Digest(bytes.toString("utf8")) !== request.payloadDigest) throw new Error("external_signer_payload_digest_mismatch");
  return bytes;
}

export function prepareCommercialCohortExternalSigningRequest(args: {
  environment: "staging" | "production";
  audience: string;
  purpose: CommercialCohortExternalSigningPurpose;
  keyId: string;
  expectedPublicKeyFingerprint: string;
  payload: unknown;
  approvalTicketDigest: string;
  issuedAt?: Date;
  expiresAt: Date;
  nonce: string;
  requestId?: string;
}): CommercialCohortExternalSigningRequest {
  const issuedAt = args.issuedAt ?? new Date();
  if (args.expiresAt.getTime() <= issuedAt.getTime() || args.expiresAt.getTime() - issuedAt.getTime() > MAX_REQUEST_LIFETIME_MS) {
    throw new Error("external_signer_request_window_invalid");
  }
  const payload = Buffer.from(canonicalJson(args.payload), "utf8");
  return {
    schemaVersion: PASS4812_EXTERNAL_SIGNING_REQUEST_SCHEMA,
    policyVersion: PASS4812_EXTERNAL_SIGNING_POLICY_ID,
    requestId: requiredId(args.requestId ?? `sign-${randomUUID()}`, "external_signer_request_id_invalid"),
    environment: args.environment,
    audience: requiredId(args.audience, "external_signer_audience_invalid"),
    purpose: args.purpose,
    keyId: requiredId(args.keyId, "external_signer_key_id_invalid"),
    algorithm: "Ed25519",
    expectedPublicKeyFingerprint: requiredDigest(args.expectedPublicKeyFingerprint, "external_signer_expected_fingerprint_invalid"),
    payloadDigest: sha256Digest(payload.toString("utf8")),
    payloadBase64Url: payload.toString("base64url"),
    approvalTicketDigest: requiredDigest(args.approvalTicketDigest, "external_signer_approval_ticket_invalid"),
    issuedAt: issuedAt.toISOString(),
    expiresAt: args.expiresAt.toISOString(),
    nonce: requiredId(args.nonce, "external_signer_nonce_invalid"),
  };
}

export function verifyCommercialCohortExternalSigningResponse(args: {
  request: CommercialCohortExternalSigningRequest;
  response: CommercialCohortExternalSigningResponse;
  expectedProvider?: CommercialCohortExternalSignerProvider;
  now?: Date;
}): { verified: boolean; keyId: string | null; signature: string | null; provider: CommercialCohortExternalSignerProvider | null; blockers: string[] } {
  const blockers: string[] = [];
  let keyId: string | null = null;
  let signature: string | null = null;
  let provider: CommercialCohortExternalSignerProvider | null = null;
  try {
    const request = args.request;
    if (request.schemaVersion !== PASS4812_EXTERNAL_SIGNING_REQUEST_SCHEMA || request.policyVersion !== PASS4812_EXTERNAL_SIGNING_POLICY_ID) {
      throw new Error("external_signer_request_schema_invalid");
    }
    if (request.algorithm !== "Ed25519") throw new Error("external_signer_algorithm_invalid");
    const issuedAt = parseDate(request.issuedAt, "external_signer_request_issued_at_invalid");
    const expiresAt = parseDate(request.expiresAt, "external_signer_request_expires_at_invalid");
    if (expiresAt.getTime() <= issuedAt.getTime() || expiresAt.getTime() - issuedAt.getTime() > MAX_REQUEST_LIFETIME_MS) {
      throw new Error("external_signer_request_window_invalid");
    }
    const now = args.now ?? new Date();
    if (now.getTime() + CLOCK_SKEW_MS < issuedAt.getTime()) blockers.push("external_signer_request_not_active");
    if (now.getTime() >= expiresAt.getTime()) blockers.push("external_signer_request_expired");
    const bytes = payloadBytes(request);
    const response = args.response;
    if (!response || response.schemaVersion !== PASS4812_EXTERNAL_SIGNING_RESPONSE_SCHEMA || response.policyVersion !== PASS4812_EXTERNAL_SIGNING_POLICY_ID) {
      throw new Error("external_signer_response_schema_invalid");
    }
    if (requiredId(response.requestId, "external_signer_response_request_id_invalid") !== request.requestId) blockers.push("external_signer_request_binding_invalid");
    keyId = requiredId(response.keyId, "external_signer_response_key_id_invalid");
    if (keyId !== request.keyId) blockers.push("external_signer_key_binding_invalid");
    provider = response.provider;
    if (!(provider === "aws-kms" || provider === "gcp-cloud-kms" || provider === "azure-key-vault" || provider === "vault-transit" || provider === "pkcs11-hsm" || provider === "test-only")) {
      blockers.push("external_signer_provider_invalid");
    }
    if (args.expectedProvider && provider !== args.expectedProvider) blockers.push("external_signer_provider_mismatch");
    if (request.environment === "production" && provider === "test-only") blockers.push("external_signer_test_provider_forbidden_in_production");
    if (!clean(response.keyVersion, 256)) blockers.push("external_signer_key_version_missing");
    const publicKeyPem = normalizePem(response.publicKeyPem);
    const fingerprint = commercialCohortPublicKeyFingerprint(publicKeyPem);
    if (requiredDigest(response.publicKeyFingerprint, "external_signer_response_fingerprint_invalid") !== fingerprint) blockers.push("external_signer_response_fingerprint_mismatch");
    if (fingerprint !== request.expectedPublicKeyFingerprint) blockers.push("external_signer_expected_key_mismatch");
    signature = requiredSignature(response.signature);
    if (!cryptoVerify(null, bytes, ed25519PublicKey(publicKeyPem), Buffer.from(signature, "base64url"))) blockers.push("external_signer_signature_invalid");
    const signedAt = parseDate(response.signedAt, "external_signer_signed_at_invalid");
    if (signedAt.getTime() < issuedAt.getTime() - CLOCK_SKEW_MS || signedAt.getTime() > expiresAt.getTime()) blockers.push("external_signer_signed_at_outside_request");
    if (signedAt.getTime() > now.getTime() + CLOCK_SKEW_MS) blockers.push("external_signer_signed_in_future");
    requiredDigest(response.custodyReceiptDigest, "external_signer_custody_receipt_invalid");
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "external_signer_verification_failed");
  }
  const uniqueBlockers = Array.from(new Set(blockers.filter(Boolean))).sort();
  return { verified: uniqueBlockers.length === 0 && Boolean(keyId && signature && provider), keyId, signature, provider, blockers: uniqueBlockers };
}

export function invokeCommercialCohortExternalSigner(args: {
  request: CommercialCohortExternalSigningRequest;
  signer: CommercialCohortExternalSignerCommand;
  now?: Date;
}): CommercialCohortExternalSigningResponse {
  if (args.request.environment === "production" && args.signer.provider === "test-only") {
    throw new Error("external_signer_test_provider_forbidden_in_production");
  }
  const timeout = Number(args.signer.timeoutMs ?? 30_000);
  if (!Number.isFinite(timeout) || timeout < 1_000 || timeout > 120_000) throw new Error("external_signer_timeout_invalid");
  const result = runBoundExternalCommand({
    boundary: args.signer,
    input: `${JSON.stringify(args.request)}\n`,
    timeoutMs: timeout,
    maxOutputBytes: MAX_SIGNER_OUTPUT_BYTES,
    errorPrefix: "external_signer",
  });
  let response: CommercialCohortExternalSigningResponse;
  try {
    response = JSON.parse(clean(result.stdout, MAX_SIGNER_OUTPUT_BYTES)) as CommercialCohortExternalSigningResponse;
  } catch {
    throw new Error("external_signer_response_json_invalid");
  }
  const verification = verifyCommercialCohortExternalSigningResponse({
    request: args.request,
    response,
    expectedProvider: args.signer.provider,
    now: args.now,
  });
  if (!verification.verified) throw new Error(`external_signer_response_rejected:${verification.blockers.join("|")}`);
  return response;
}
