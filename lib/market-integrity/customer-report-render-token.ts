import { createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import {
  renderCustomerTierPdf,
  type CustomerReportPayload,
} from "@/lib/market-integrity/customer-tier-pdf-renderer";
import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import {
  buildCanonicalCustomerArtifact,
  verifyCanonicalCustomerArtifact,
  type CanonicalCustomerArtifact,
  type CanonicalCustomerArtifactSurface,
} from "@/lib/reporting/canonical-customer-artifact";
import {
  buildPass4822AccountCustomerArtifactSnapshot,
  verifyPass4822AccountCustomerArtifactOwner,
  verifyPass4822AccountCustomerArtifactSnapshot,
  type AccountCustomerArtifactSnapshot,
} from "@/lib/reporting/account-customer-artifact-snapshot";
import { assertPass6PaidCommercialCompleteness } from "@/lib/reporting/commercial-field-completeness";

export const PASS4818_CUSTOMER_REPORT_RENDER_TOKEN_ID = "pass4818-customer-report-render-token-v1" as const;

const PURPOSE = "customer_market_report_pdf" as const;
const SIGNATURE_DOMAIN = "velmere:customer-market-report-pdf:v1:";
const DEFAULT_TTL_SECONDS = 8 * 60;
const MAX_TTL_SECONDS = 20 * 60;
const MAX_COMPRESSED_TOKEN_BYTES = 600_000;
const MAX_DECOMPRESSED_ENVELOPE_BYTES = 2_000_000;

type SigningKey = { kid: string; secret: string };

export type Pass4818PreparedCustomerReportArtifact = {
  requestedTier: VelmereTier;
  deliveredTier: VelmereTier | null;
  rendered: ReturnType<typeof renderCustomerTierPdf>;
  canonicalArtifact: CanonicalCustomerArtifact;
};

export type Pass4818CustomerReportAccountArtifactBinding = {
  snapshotId: string;
  snapshotDigest: string;
  accountIdHash: string;
  artifactDigest: string;
  surface: CanonicalCustomerArtifactSurface;
  rendererId: string;
  requestedTier: VelmereTier;
  deliveredTier: VelmereTier | null;
};

type CustomerReportRenderEnvelope = {
  v: 1;
  purpose: typeof PURPOSE;
  kid: string;
  iat: number;
  exp: number;
  accountIdHash: string | null;
  requestedTier: VelmereTier;
  deliveredTier: VelmereTier | null;
  payloadDigest: string;
  pdfHash: string;
  layoutModelDigest: string;
  renderPlanDigest: string;
  pdfByteLength: number;
  pageCount: number;
  canonicalArtifact: CanonicalCustomerArtifact;
  accountArtifactBinding?: Pass4818CustomerReportAccountArtifactBinding | null;
  payload: CustomerReportPayload;
};

function keyId(value: string | undefined, fallback: string): string {
  return String(value ?? "").trim().replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, 48) || fallback;
}

function developmentFallbackSecret(value: string): string {
  return createHmac("sha256", value).update("velmere:customer-market-report-render-token:v1:key").digest("hex");
}

function currentSigningKey(env: Record<string, string | undefined>): SigningKey | null {
  const current = String(env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_SECRET_CURRENT ?? env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_SECRET ?? "").trim();
  const previous = String(env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_SECRET_PREVIOUS ?? "").trim();
  if (current.length >= 32) {
    return { kid: keyId(env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_KEY_ID, "current"), secret: current };
  }
  // A previous key exists only to validate tokens issued before rotation.
  // It must never silently become the active issuer, including via a dev fallback.
  if (previous.length < 32 && env.NODE_ENV !== "production") {
    const providerSecret = String(env.VELMERE_PROVIDER_RECEIPT_SIGNING_SECRET ?? "").trim();
    if (providerSecret.length >= 32) {
      return { kid: "development-fallback", secret: developmentFallbackSecret(providerSecret) };
    }
  }
  return null;
}

function verificationKeys(env: Record<string, string | undefined>): SigningKey[] {
  const current = String(env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_SECRET_CURRENT ?? env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_SECRET ?? "").trim();
  const previous = String(env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_SECRET_PREVIOUS ?? "").trim();
  const keys: SigningKey[] = [];
  if (current.length >= 32) keys.push({ kid: keyId(env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_KEY_ID, "current"), secret: current });
  if (previous.length >= 32) keys.push({ kid: keyId(env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_PREVIOUS_KEY_ID, "previous"), secret: previous });
  if (!keys.length && env.NODE_ENV !== "production") {
    const providerSecret = String(env.VELMERE_PROVIDER_RECEIPT_SIGNING_SECRET ?? "").trim();
    if (providerSecret.length >= 32) keys.push({ kid: "development-fallback", secret: developmentFallbackSecret(providerSecret) });
  }
  return keys;
}

function accountHash(accountId: string | null | undefined): string | null {
  const normalized = String(accountId ?? "").trim();
  return normalized ? sha256Digest(`account:${normalized}`) : null;
}

function sign(secret: string, encoded: string): Buffer {
  return createHmac("sha256", secret).update(`${SIGNATURE_DOMAIN}${encoded}`).digest();
}

function validTier(value: unknown): value is VelmereTier {
  return value === "Basic" || value === "Pro" || value === "Advanced";
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);
}

function validAccountArtifactBinding(value: unknown): value is Pass4818CustomerReportAccountArtifactBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const binding = value as Partial<Pass4818CustomerReportAccountArtifactBinding>;
  return typeof binding.snapshotId === "string"
    && binding.snapshotId.startsWith("artifact-")
    && binding.snapshotId.length <= 180
    && validDigest(binding.snapshotDigest)
    && typeof binding.accountIdHash === "string"
    && /^[a-f0-9]{64}$/i.test(binding.accountIdHash)
    && validDigest(binding.artifactDigest)
    && (binding.surface === "audit" || binding.surface === "shield" || binding.surface === "real_markets" || binding.surface === "lens")
    && typeof binding.rendererId === "string"
    && binding.rendererId.length > 0
    && binding.rendererId.length <= 160
    && validTier(binding.requestedTier)
    && (binding.deliveredTier === null || validTier(binding.deliveredTier));
}

function validEnvelope(value: unknown): value is CustomerReportRenderEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const envelope = value as Partial<CustomerReportRenderEnvelope>;
  return envelope.v === 1
    && envelope.purpose === PURPOSE
    && typeof envelope.kid === "string"
    && Number.isInteger(envelope.iat)
    && Number.isInteger(envelope.exp)
    && (envelope.accountIdHash === null || typeof envelope.accountIdHash === "string")
    && validTier(envelope.requestedTier)
    && (envelope.deliveredTier === null || validTier(envelope.deliveredTier))
    && typeof envelope.payloadDigest === "string"
    && typeof envelope.pdfHash === "string"
    && typeof envelope.layoutModelDigest === "string"
    && typeof envelope.renderPlanDigest === "string"
    && Number.isInteger(envelope.pdfByteLength)
    && Number.isInteger(envelope.pageCount)
    && verifyCanonicalCustomerArtifact(envelope.canonicalArtifact)
    && (envelope.accountArtifactBinding === undefined
      || envelope.accountArtifactBinding === null
      || validAccountArtifactBinding(envelope.accountArtifactBinding))
    && Boolean(envelope.payload && typeof envelope.payload === "object" && !Array.isArray(envelope.payload));
}

function encodeEnvelope(envelope: CustomerReportRenderEnvelope): string {
  const serialized = Buffer.from(JSON.stringify(envelope), "utf8");
  if (serialized.byteLength > MAX_DECOMPRESSED_ENVELOPE_BYTES) throw new Error("customer_report_render_envelope_too_large");
  const compressed = deflateRawSync(serialized, { level: 9 });
  if (compressed.byteLength > MAX_COMPRESSED_TOKEN_BYTES) throw new Error("customer_report_render_token_too_large");
  return compressed.toString("base64url");
}

function decodeEnvelope(encoded: string): CustomerReportRenderEnvelope {
  const compressed = Buffer.from(encoded, "base64url");
  if (!compressed.byteLength || compressed.byteLength > MAX_COMPRESSED_TOKEN_BYTES) throw new Error("invalid_customer_report_render_token");
  const serialized = inflateRawSync(compressed, { maxOutputLength: MAX_DECOMPRESSED_ENVELOPE_BYTES });
  const value = JSON.parse(serialized.toString("utf8")) as unknown;
  if (!validEnvelope(value)) throw new Error("invalid_customer_report_render_token");
  return value;
}

function reportArtifactSurface(payload: CustomerReportPayload): CanonicalCustomerArtifactSurface {
  return payload.commercialEnvelope.surface === "real_markets" ? "real_markets" : "shield";
}

export function buildPass4818CustomerReportArtifact(args: {
  payload: CustomerReportPayload;
  requestedTier?: VelmereTier;
}): Pass4818PreparedCustomerReportArtifact {
  const requestedTier = args.requestedTier ?? args.payload.tier;
  assertPass6PaidCommercialCompleteness(args.payload, requestedTier);
  const rendered = renderCustomerTierPdf(args.payload);
  const canonicalArtifact = buildCanonicalCustomerArtifact({
    surface: reportArtifactSurface(args.payload),
    rendererId: rendered.schemaVersion,
    reportId: args.payload.reportId,
    requestedTier,
    deliveredTier: args.payload.deliveryPolicy.visibleTier,
    payloadDigest: rendered.payloadDigest,
    layoutDigest: rendered.layoutModelDigest,
    renderPlanDigest: rendered.renderPlanDigest,
    pdfDigest: rendered.pdfHash,
    pdfByteLength: rendered.bytes.byteLength,
    pageCount: rendered.pageCount,
    renderedRowCount: rendered.renderedRowCount,
  });
  return {
    requestedTier,
    deliveredTier: args.payload.deliveryPolicy.visibleTier,
    rendered,
    canonicalArtifact,
  };
}

function resolvePreparedArtifact(args: {
  payload: CustomerReportPayload;
  requestedTier?: VelmereTier;
  preparedArtifact?: Pass4818PreparedCustomerReportArtifact;
}): Pass4818PreparedCustomerReportArtifact {
  const expectedRequestedTier = args.requestedTier ?? args.payload.tier;
  assertPass6PaidCommercialCompleteness(args.payload, expectedRequestedTier);
  const prepared = args.preparedArtifact ?? buildPass4818CustomerReportArtifact({
    payload: args.payload,
    requestedTier: expectedRequestedTier,
  });
  const { canonicalArtifact, rendered } = prepared;
  const expectedPayloadDigest = sha256Digest(canonicalJson(args.payload));
  const consistent = prepared.requestedTier === expectedRequestedTier
    && prepared.deliveredTier === args.payload.deliveryPolicy.visibleTier
    && verifyCanonicalCustomerArtifact(canonicalArtifact)
    && canonicalArtifact.surface === reportArtifactSurface(args.payload)
    && canonicalArtifact.rendererId === rendered.schemaVersion
    && canonicalArtifact.reportId === args.payload.reportId
    && canonicalArtifact.requestedTier === expectedRequestedTier
    && canonicalArtifact.deliveredTier === args.payload.deliveryPolicy.visibleTier
    && canonicalArtifact.payloadDigest === expectedPayloadDigest
    && rendered.payloadDigest === expectedPayloadDigest
    && canonicalArtifact.layoutDigest === rendered.layoutModelDigest
    && canonicalArtifact.renderPlanDigest === rendered.renderPlanDigest
    && canonicalArtifact.pdfDigest === rendered.pdfHash
    && canonicalArtifact.pdfByteLength === rendered.bytes.byteLength
    && canonicalArtifact.pageCount === rendered.pageCount
    && canonicalArtifact.renderedRowCount === rendered.renderedRowCount;
  if (!consistent) throw new Error("customer_report_prepared_artifact_mismatch");
  return prepared;
}

export function buildPass4818CustomerReportAccountArtifactSnapshot(args: {
  accountId: string;
  payload: CustomerReportPayload;
  requestedTier: VelmereTier;
  canonicalArtifact: CanonicalCustomerArtifact;
}) {
  return buildPass4822AccountCustomerArtifactSnapshot({
    accountId: args.accountId,
    surface: args.canonicalArtifact.surface,
    payloadKind: "market_customer_report_v1",
    reportId: args.payload.reportId,
    requestedTier: args.requestedTier,
    deliveredTier: args.payload.deliveryPolicy.visibleTier,
    locale: args.payload.locale,
    title: args.payload.commercialEnvelope.productName,
    subject: `${args.payload.target.symbol} · ${args.payload.target.name}`,
    generatedAt: args.payload.generatedAt,
    payload: args.payload,
    canonicalArtifact: args.canonicalArtifact,
    pdfStorage: "exact_immutable_blob",
  });
}

function bindAccountArtifact(args: {
  accountId?: string | null;
  payload: CustomerReportPayload;
  requestedTier: VelmereTier;
  canonicalArtifact: CanonicalCustomerArtifact;
  accountArtifactSnapshot?: AccountCustomerArtifactSnapshot | null;
}): Pass4818CustomerReportAccountArtifactBinding | null {
  if (!args.accountArtifactSnapshot) return null;
  const accountId = String(args.accountId ?? "").trim();
  if (!accountId) throw new Error("customer_report_account_artifact_account_required");
  if (!verifyPass4822AccountCustomerArtifactSnapshot(args.accountArtifactSnapshot)) {
    throw new Error("customer_report_account_artifact_snapshot_invalid");
  }
  if (!verifyPass4822AccountCustomerArtifactOwner(args.accountArtifactSnapshot, accountId)) {
    throw new Error("customer_report_account_artifact_owner_mismatch");
  }
  const expected = buildPass4818CustomerReportAccountArtifactSnapshot({
    accountId,
    payload: args.payload,
    requestedTier: args.requestedTier,
    canonicalArtifact: args.canonicalArtifact,
  });
  if (expected.snapshotId !== args.accountArtifactSnapshot.snapshotId
    || expected.snapshotDigest !== args.accountArtifactSnapshot.snapshotDigest) {
    throw new Error("customer_report_account_artifact_snapshot_mismatch");
  }
  return {
    snapshotId: expected.snapshotId,
    snapshotDigest: expected.snapshotDigest,
    accountIdHash: expected.accountIdHash,
    artifactDigest: expected.canonicalArtifact.artifactDigest,
    surface: expected.surface,
    rendererId: expected.canonicalArtifact.rendererId,
    requestedTier: args.requestedTier,
    deliveredTier: args.payload.deliveryPolicy.visibleTier,
  };
}

export function issuePass4818CustomerReportRenderToken(args: {
  payload: CustomerReportPayload;
  accountId?: string | null;
  requestedTier?: VelmereTier;
  preparedArtifact?: Pass4818PreparedCustomerReportArtifact;
  accountArtifactSnapshot?: AccountCustomerArtifactSnapshot | null;
  env?: Record<string, string | undefined>;
  nowMs?: number;
  ttlSeconds?: number;
}) {
  const current = currentSigningKey(args.env ?? process.env);
  if (!current) return { ok: false as const, error: "customer_report_render_token_secret_missing_or_short" as const };
  let prepared: Pass4818PreparedCustomerReportArtifact;
  let accountArtifactBinding: Pass4818CustomerReportAccountArtifactBinding | null;
  try {
    prepared = resolvePreparedArtifact(args);
    accountArtifactBinding = bindAccountArtifact({
      accountId: args.accountId,
      payload: args.payload,
      requestedTier: prepared.requestedTier,
      canonicalArtifact: prepared.canonicalArtifact,
      accountArtifactSnapshot: args.accountArtifactSnapshot,
    });
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "customer_report_render_token_failed" };
  }
  const { rendered, canonicalArtifact } = prepared;
  if (canonicalArtifact.surface === "real_markets" && prepared.requestedTier !== "Basic" && !accountArtifactBinding) {
    return { ok: false as const, error: "customer_report_account_artifact_binding_required" as const };
  }
  const now = Math.floor((args.nowMs ?? Date.now()) / 1000);
  const ttl = Math.max(60, Math.min(MAX_TTL_SECONDS, Math.trunc(args.ttlSeconds ?? DEFAULT_TTL_SECONDS)));
  const envelope: CustomerReportRenderEnvelope = {
    v: 1,
    purpose: PURPOSE,
    kid: current.kid,
    iat: now,
    exp: now + ttl,
    accountIdHash: accountHash(args.accountId),
    requestedTier: prepared.requestedTier,
    deliveredTier: prepared.deliveredTier,
    payloadDigest: rendered.payloadDigest,
    pdfHash: rendered.pdfHash,
    layoutModelDigest: rendered.layoutModelDigest,
    renderPlanDigest: rendered.renderPlanDigest,
    pdfByteLength: rendered.bytes.byteLength,
    pageCount: rendered.pageCount,
    canonicalArtifact,
    accountArtifactBinding,
    payload: args.payload,
  };
  let encoded: string;
  try {
    encoded = encodeEnvelope(envelope);
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "customer_report_render_token_failed" };
  }
  const signature = sign(current.secret, encoded).toString("base64url");
  return {
    ok: true as const,
    token: `${encoded}.${signature}`,
    keyId: current.kid,
    expiresAt: new Date(envelope.exp * 1000).toISOString(),
    accountArtifactBinding,
    artifact: {
      rendererId: rendered.schemaVersion,
      payloadDigest: rendered.payloadDigest,
      pdfHash: rendered.pdfHash,
      layoutModelDigest: rendered.layoutModelDigest,
      renderPlanDigest: rendered.renderPlanDigest,
      byteLength: rendered.bytes.byteLength,
      pageCount: rendered.pageCount,
      lineCount: rendered.lineCount,
      renderedRowCount: rendered.renderedRowCount,
      canonicalArtifact,
      accountArtifactBinding,
    },
  };
}

export function verifyPass4818CustomerReportRenderToken(args: {
  token: string;
  accountId?: string | null;
  expectedRequestedTier?: VelmereTier;
  env?: Record<string, string | undefined>;
  nowMs?: number;
}) {
  const keys = verificationKeys(args.env ?? process.env);
  if (!keys.length) return { ok: false as const, error: "customer_report_render_token_secret_missing_or_short" as const };
  if (!args.token || Buffer.byteLength(args.token, "utf8") > MAX_COMPRESSED_TOKEN_BYTES * 2) return { ok: false as const, error: "invalid_customer_report_render_token" as const };
  const [encoded, signatureText, ...extra] = args.token.split(".");
  if (!encoded || !signatureText || extra.length) return { ok: false as const, error: "invalid_customer_report_render_token" as const };

  let envelope: CustomerReportRenderEnvelope;
  try {
    envelope = decodeEnvelope(encoded);
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "invalid_customer_report_render_token" };
  }
  const candidate = keys.filter((key) => key.kid === envelope.kid);
  if (!candidate.length) return { ok: false as const, error: "customer_report_render_token_key_unknown" as const };
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signatureText, "base64url");
  } catch {
    return { ok: false as const, error: "invalid_customer_report_render_token" as const };
  }
  const signatureValid = candidate.some((key) => {
    const expected = sign(key.secret, encoded);
    return expected.byteLength === supplied.byteLength && timingSafeEqual(expected, supplied);
  });
  if (!signatureValid) return { ok: false as const, error: "customer_report_render_token_signature_invalid" as const };

  const now = Math.floor((args.nowMs ?? Date.now()) / 1000);
  if (envelope.exp <= envelope.iat || envelope.exp - envelope.iat > MAX_TTL_SECONDS || envelope.iat > now + 30) {
    return { ok: false as const, error: "invalid_customer_report_render_token" as const };
  }
  if (envelope.exp <= now) return { ok: false as const, error: "customer_report_render_token_expired" as const };
  if (args.expectedRequestedTier && envelope.requestedTier !== args.expectedRequestedTier) {
    return { ok: false as const, error: "customer_report_render_token_tier_mismatch" as const };
  }
  if (envelope.accountIdHash !== null && envelope.accountIdHash !== accountHash(args.accountId)) {
    return { ok: false as const, error: "customer_report_render_token_account_mismatch" as const };
  }
  const accountArtifactBinding = envelope.accountArtifactBinding ?? null;
  if (envelope.canonicalArtifact.surface === "real_markets" && envelope.requestedTier !== "Basic" && !accountArtifactBinding) {
    return { ok: false as const, error: "customer_report_account_artifact_binding_required" as const };
  }

  let rendered: ReturnType<typeof renderCustomerTierPdf>;
  try {
    assertPass6PaidCommercialCompleteness(envelope.payload, envelope.requestedTier);
    rendered = renderCustomerTierPdf(envelope.payload);
  } catch {
    return { ok: false as const, error: "customer_report_pdf_rerender_failed" as const };
  }
  const rebuiltArtifact = buildCanonicalCustomerArtifact({
    surface: reportArtifactSurface(envelope.payload),
    rendererId: rendered.schemaVersion,
    reportId: envelope.payload.reportId,
    requestedTier: envelope.requestedTier,
    deliveredTier: envelope.deliveredTier,
    payloadDigest: rendered.payloadDigest,
    layoutDigest: rendered.layoutModelDigest,
    renderPlanDigest: rendered.renderPlanDigest,
    pdfDigest: rendered.pdfHash,
    pdfByteLength: rendered.bytes.byteLength,
    pageCount: rendered.pageCount,
    renderedRowCount: rendered.renderedRowCount,
  });
  const consistent = rebuiltArtifact.artifactDigest === envelope.canonicalArtifact.artifactDigest
    && rendered.payloadDigest === envelope.payloadDigest
    && rendered.pdfHash === envelope.pdfHash
    && rendered.layoutModelDigest === envelope.layoutModelDigest
    && rendered.renderPlanDigest === envelope.renderPlanDigest
    && rendered.bytes.byteLength === envelope.pdfByteLength
    && rendered.pageCount === envelope.pageCount;
  if (!consistent) return { ok: false as const, error: "customer_report_pdf_artifact_mismatch" as const };

  if (accountArtifactBinding) {
    const accountId = String(args.accountId ?? "").trim();
    if (!accountId || envelope.accountIdHash === null) {
      return { ok: false as const, error: "customer_report_render_token_account_mismatch" as const };
    }
    try {
      const expected = buildPass4818CustomerReportAccountArtifactSnapshot({
        accountId,
        payload: envelope.payload,
        requestedTier: envelope.requestedTier,
        canonicalArtifact: rebuiltArtifact,
      });
      const bindingConsistent = accountArtifactBinding.snapshotId === expected.snapshotId
        && accountArtifactBinding.snapshotDigest === expected.snapshotDigest
        && accountArtifactBinding.accountIdHash === expected.accountIdHash
        && accountArtifactBinding.accountIdHash === hashVelmereAccountBinding(accountId)
        && accountArtifactBinding.artifactDigest === rebuiltArtifact.artifactDigest
        && accountArtifactBinding.surface === rebuiltArtifact.surface
        && accountArtifactBinding.rendererId === rebuiltArtifact.rendererId
        && accountArtifactBinding.requestedTier === envelope.requestedTier
        && accountArtifactBinding.deliveredTier === envelope.deliveredTier;
      if (!bindingConsistent) {
        return { ok: false as const, error: "customer_report_account_artifact_binding_mismatch" as const };
      }
    } catch {
      return { ok: false as const, error: "customer_report_account_artifact_binding_mismatch" as const };
    }
  }

  return {
    ok: true as const,
    payload: envelope.payload,
    requestedTier: envelope.requestedTier,
    deliveredTier: envelope.deliveredTier,
    keyId: envelope.kid,
    expiresAt: new Date(envelope.exp * 1000).toISOString(),
    artifact: rendered,
    canonicalArtifact: rebuiltArtifact,
    accountArtifactBinding,
  };
}
