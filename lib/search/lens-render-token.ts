import { ASCII_CONTROL_PATTERN } from "../security/ascii-control-characters";

import { createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  isLensReport,
  type LensReport,
  type LensReportDepth,
  type LensReportLocale,
} from "@/lib/search/lens-report";
import { PASS4823_LENS_PDF_RENDERER_ID } from "@/lib/search/lens-pdf-renderer-identity";
import {
  inspectR7BrowserEcbDeliveryBinding,
  normalizeR7BrowserEcbDeliveryBinding,
  type R7BrowserEcbDeliveryBinding,
} from "@/lib/search/browser-ecb-delivery-authority";
import {
  normalizeBrowserDerivedDeliveryBinding,
  type BrowserDerivedDeliveryBinding,
} from "@/lib/search/browser-delivery-policy";

export const PASS4823_LENS_FROZEN_RENDER_PAYLOAD_ID =
  "velmere.lens-frozen-render-payload.v1" as const;

export type Pass4823LensFrozenReportIdentity = {
  reportId: string;
  sourceResultId: string;
  reportVersion: LensReport["version"];
  reportDigest: string;
  reportChecksum: string;
  generatedAt: string;
  locale: LensReportLocale;
  depth: LensReportDepth;
  tier: LensReportDepth;
  rendererId: typeof PASS4823_LENS_PDF_RENDERER_ID;
  symbol: string;
  title: string;
};

export type Pass4823LensFrozenRenderPayload = {
  schemaVersion: typeof PASS4823_LENS_FROZEN_RENDER_PAYLOAD_ID;
  identity: Pass4823LensFrozenReportIdentity;
  report: LensReport;
  deliveryBinding?: R7BrowserEcbDeliveryBinding | BrowserDerivedDeliveryBinding;
};

type TokenEnvelopeV3 = {
  v: 3;
  purpose: "lens_pdf_render";
  kid: string;
  iat: number;
  exp: number;
  frozen: Pass4823LensFrozenRenderPayload;
};

type SigningKey = { kid: string; secret: string };

const DEFAULT_TTL_SECONDS = 10 * 60;
const MAX_TTL_SECONDS = 30 * 60;
const MAX_COMPRESSED_ENVELOPE_BYTES = 256 * 1024;
const MAX_DECOMPRESSED_ENVELOPE_BYTES = 1024 * 1024;
const MAX_TOKEN_BYTES = 350 * 1024;
const V3_SIGNATURE_DOMAIN = "velmere:lens_pdf_render:v3:frozen-report:";

function cleanKeyId(value: string | undefined, fallback: string) {
  const cleaned = String(value ?? "").trim().replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, 48);
  return cleaned || fallback;
}

function domainSeparatedFallbackSecret(secret: string) {
  return createHmac("sha256", secret).update("velmere:lens-render-token:v3:frozen-report:key").digest("hex");
}

function currentSigningKey(env: Record<string, string | undefined>): SigningKey | null {
  const currentDedicated = String(env.VELMERE_LENS_RENDER_TOKEN_SECRET_CURRENT ?? env.VELMERE_LENS_RENDER_TOKEN_SECRET ?? "").trim();
  const previousDedicated = String(env.VELMERE_LENS_RENDER_TOKEN_SECRET_PREVIOUS ?? "").trim();
  if (currentDedicated.length >= 32) {
    return { kid: cleanKeyId(env.VELMERE_LENS_RENDER_TOKEN_KEY_ID, "current"), secret: currentDedicated };
  }
  // Development-only migration fallback. Production must use a dedicated key so
  // provider-receipt signatures and PDF render tokens never share a raw secret.
  // A configured previous key is always verification-only and must never cause
  // issuance, including through the development fallback.
  if (previousDedicated.length < 32 && env.NODE_ENV !== "production") {
    const providerSecret = String(env.VELMERE_PROVIDER_RECEIPT_SIGNING_SECRET ?? "").trim();
    if (providerSecret.length >= 32) {
      return { kid: "development-fallback", secret: domainSeparatedFallbackSecret(providerSecret) };
    }
  }
  return null;
}

function verificationKeys(env: Record<string, string | undefined>): SigningKey[] {
  const currentDedicated = String(env.VELMERE_LENS_RENDER_TOKEN_SECRET_CURRENT ?? env.VELMERE_LENS_RENDER_TOKEN_SECRET ?? "").trim();
  const previousDedicated = String(env.VELMERE_LENS_RENDER_TOKEN_SECRET_PREVIOUS ?? "").trim();
  const keys: SigningKey[] = [];
  if (currentDedicated.length >= 32) {
    keys.push({ kid: cleanKeyId(env.VELMERE_LENS_RENDER_TOKEN_KEY_ID, "current"), secret: currentDedicated });
  }
  if (previousDedicated.length >= 32) {
    keys.push({ kid: cleanKeyId(env.VELMERE_LENS_RENDER_TOKEN_PREVIOUS_KEY_ID, "previous"), secret: previousDedicated });
  }
  if (!keys.length && env.NODE_ENV !== "production") {
    const providerSecret = String(env.VELMERE_PROVIDER_RECEIPT_SIGNING_SECRET ?? "").trim();
    if (providerSecret.length >= 32) {
      keys.push({ kid: "development-fallback", secret: domainSeparatedFallbackSecret(providerSecret) });
    }
  }
  return keys;
}

function validDepth(value: unknown): value is LensReportDepth {
  return value === "basic" || value === "pro" || value === "advanced";
}

function validLocale(value: unknown): value is LensReportLocale {
  return value === "pl" || value === "en" || value === "de";
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);
}

function normalizedSourceResultId(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 512 || ASCII_CONTROL_PATTERN.test(normalized)) {
    throw new Error("render_token_source_result_id_invalid");
  }
  return normalized;
}

function normalizedTransportReport(value: LensReport): LensReport {
  let transported: unknown;
  try {
    transported = JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    throw new Error("render_token_report_not_serializable");
  }
  if (!isLensReport(transported)) throw new Error("render_token_report_invalid");
  return transported;
}

function validGeneratedAt(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function normalizeDeliveryBinding(value: unknown): R7BrowserEcbDeliveryBinding | BrowserDerivedDeliveryBinding | null {
  if (value === undefined || value === null) return null;
  return normalizeR7BrowserEcbDeliveryBinding(value) ?? normalizeBrowserDerivedDeliveryBinding(value);
}

export function buildPass4823LensFrozenRenderPayload(args: {
  report: LensReport;
  sourceResultId: string;
  deliveryBinding?: R7BrowserEcbDeliveryBinding | BrowserDerivedDeliveryBinding;
}): Pass4823LensFrozenRenderPayload {
  const report = normalizedTransportReport(args.report);
  const sourceResultId = normalizedSourceResultId(args.sourceResultId);
  const deliveryBinding = args.deliveryBinding === undefined || args.deliveryBinding === null
    ? null
    : normalizeDeliveryBinding(args.deliveryBinding);
  if (args.deliveryBinding !== undefined && args.deliveryBinding !== null && !deliveryBinding) {
    throw new Error("render_token_delivery_binding_invalid");
  }
  const reportDeliveryAuthority = report.deliveryAuthority === undefined || report.deliveryAuthority === null
    ? null
    : normalizeDeliveryBinding(report.deliveryAuthority);
  if (report.deliveryAuthority !== undefined && report.deliveryAuthority !== null && !reportDeliveryAuthority) {
    throw new Error("render_token_report_delivery_authority_invalid");
  }
  if (Boolean(deliveryBinding) !== Boolean(reportDeliveryAuthority)
    || (deliveryBinding && reportDeliveryAuthority
      && canonicalJson(deliveryBinding) !== canonicalJson(reportDeliveryAuthority))) {
    throw new Error("render_token_report_delivery_authority_mismatch");
  }
  if (!validLocale(report.locale) || !validDepth(report.selectedDepth)) {
    throw new Error("render_token_report_identity_invalid");
  }
  if (report.pass477.selectedDepth !== report.selectedDepth || !validGeneratedAt(report.generatedAt)) {
    throw new Error("render_token_report_identity_invalid");
  }
  if (!String(report.brain.checksum ?? "").trim()) {
    throw new Error("render_token_report_checksum_invalid");
  }
  const reportDigest = sha256Digest(canonicalJson(report));
  const identity: Pass4823LensFrozenReportIdentity = {
    reportId: `lens-report-${reportDigest.slice("sha256:".length)}`,
    sourceResultId,
    reportVersion: report.version,
    reportDigest,
    reportChecksum: report.brain.checksum,
    generatedAt: report.generatedAt,
    locale: report.locale,
    depth: report.selectedDepth,
    tier: report.selectedDepth,
    rendererId: PASS4823_LENS_PDF_RENDERER_ID,
    symbol: report.symbol,
    title: report.title,
  };
  return {
    schemaVersion: PASS4823_LENS_FROZEN_RENDER_PAYLOAD_ID,
    identity,
    report,
    ...(deliveryBinding ? { deliveryBinding } : {}),
  };
}

function validateFrozenPayload(value: unknown):
  | { ok: true; frozen: Pass4823LensFrozenRenderPayload }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "render_token_frozen_payload_invalid" };
  }
  const frozen = value as Partial<Pass4823LensFrozenRenderPayload>;
  if (frozen.schemaVersion !== PASS4823_LENS_FROZEN_RENDER_PAYLOAD_ID || !frozen.identity || !isLensReport(frozen.report)) {
    return { ok: false, error: "render_token_frozen_payload_invalid" };
  }
  const identity = frozen.identity as Partial<Pass4823LensFrozenReportIdentity>;
  if (!validDigest(identity.reportDigest)) {
    return { ok: false, error: "render_token_report_digest_invalid" };
  }
  let rebuilt: Pass4823LensFrozenRenderPayload;
  try {
    rebuilt = buildPass4823LensFrozenRenderPayload({
      report: frozen.report,
      sourceResultId: normalizedSourceResultId(identity.sourceResultId),
      ...(frozen.deliveryBinding !== undefined ? { deliveryBinding: frozen.deliveryBinding } : {}),
    });
  } catch {
    return { ok: false, error: "render_token_frozen_payload_invalid" };
  }
  if (rebuilt.identity.reportDigest !== identity.reportDigest) {
    return { ok: false, error: "render_token_report_digest_mismatch" };
  }
  if (canonicalJson(rebuilt.identity) !== canonicalJson(identity)) {
    return { ok: false, error: "render_token_report_identity_mismatch" };
  }
  return { ok: true, frozen: rebuilt };
}

function sign(secret: string, encoded: string) {
  return createHmac("sha256", secret).update(`${V3_SIGNATURE_DOMAIN}${encoded}`).digest();
}

function encodeEnvelope(envelope: TokenEnvelopeV3) {
  const serialized = Buffer.from(JSON.stringify(envelope), "utf8");
  if (serialized.byteLength > MAX_DECOMPRESSED_ENVELOPE_BYTES) {
    throw new Error("render_token_envelope_too_large");
  }
  const compressed = deflateRawSync(serialized, { level: 9 });
  if (compressed.byteLength > MAX_COMPRESSED_ENVELOPE_BYTES) {
    throw new Error("render_token_too_large");
  }
  return compressed.toString("base64url");
}

function decodeEnvelope(encoded: string): TokenEnvelopeV3 {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("invalid_render_token");
  const compressed = Buffer.from(encoded, "base64url");
  if (!compressed.byteLength || compressed.byteLength > MAX_COMPRESSED_ENVELOPE_BYTES || compressed.toString("base64url") !== encoded) {
    throw new Error("invalid_render_token");
  }
  const serialized = inflateRawSync(compressed, { maxOutputLength: MAX_DECOMPRESSED_ENVELOPE_BYTES });
  const value = JSON.parse(serialized.toString("utf8")) as Partial<TokenEnvelopeV3>;
  if (
    value.v !== 3
    || value.purpose !== "lens_pdf_render"
    || typeof value.kid !== "string"
    || !Number.isInteger(value.iat)
    || !Number.isInteger(value.exp)
    || !value.frozen
    || typeof value.frozen !== "object"
  ) {
    throw new Error("invalid_render_token");
  }
  return value as TokenEnvelopeV3;
}

export function issuePass4655LensRenderToken(args: {
  frozen: Pass4823LensFrozenRenderPayload;
  env?: Record<string, string | undefined>;
  nowMs?: number;
  ttlSeconds?: number;
}) {
  const env = args.env ?? process.env;
  const current = currentSigningKey(env);
  if (!current) {
    return { ok: false as const, error: "render_token_secret_missing_or_short" as const };
  }
  const checked = validateFrozenPayload(args.frozen);
  if (!checked.ok) return { ok: false as const, error: checked.error };
  const nowMs = args.nowMs ?? Date.now();
  const deliveryBinding = checked.frozen.deliveryBinding ?? null;
  if (deliveryBinding && !inspectR7BrowserEcbDeliveryBinding({ binding: deliveryBinding, nowMs }).ready) {
    return { ok: false as const, error: "render_token_delivery_binding_not_current" as const };
  }
  const now = Math.floor(nowMs / 1000);
  const ttl = Math.max(60, Math.min(MAX_TTL_SECONDS, Math.floor(args.ttlSeconds ?? DEFAULT_TTL_SECONDS)));
  const exp = deliveryBinding && "deliveryExpiresAt" in deliveryBinding
    ? Math.min(now + ttl, Math.floor(Date.parse(deliveryBinding.deliveryExpiresAt) / 1000))
    : now + ttl;
  if (exp <= now) return { ok: false as const, error: "render_token_original_deadline_elapsed" as const };
  const envelope: TokenEnvelopeV3 = {
    v: 3,
    purpose: "lens_pdf_render",
    kid: current.kid,
    iat: now,
    exp,
    frozen: checked.frozen,
  };
  let encoded: string;
  try {
    encoded = encodeEnvelope(envelope);
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "render_token_issue_failed" };
  }
  const signature = sign(current.secret, encoded).toString("base64url");
  const token = `${encoded}.${signature}`;
  if (Buffer.byteLength(token, "utf8") > MAX_TOKEN_BYTES) {
    return { ok: false as const, error: "render_token_too_large" as const };
  }
  return {
    ok: true as const,
    token,
    keyId: current.kid,
    expiresAt: new Date(envelope.exp * 1000).toISOString(),
    byteLength: Buffer.byteLength(token, "utf8"),
    identity: checked.frozen.identity,
  };
}

export function verifyPass4655LensRenderToken(args: {
  token: string;
  env?: Record<string, string | undefined>;
  nowMs?: number;
  expectedDepth?: LensReportDepth;
  expectedTier?: LensReportDepth;
  expectedRendererId?: string;
  expectedReportDigest?: string;
  expectedSourceResultId?: string;
}) {
  const env = args.env ?? process.env;
  const keys = verificationKeys(env);
  if (!keys.length) return { ok: false as const, error: "render_token_secret_missing_or_short" as const };
  if (!args.token || Buffer.byteLength(args.token, "utf8") > MAX_TOKEN_BYTES) {
    return { ok: false as const, error: "invalid_render_token" as const };
  }
  const [encoded, providedSignature, ...extra] = args.token.split(".");
  if (!encoded || !providedSignature || extra.length > 0) {
    return { ok: false as const, error: "invalid_render_token" as const };
  }

  let envelope: TokenEnvelopeV3;
  try {
    envelope = decodeEnvelope(encoded);
  } catch {
    return { ok: false as const, error: "invalid_render_token" as const };
  }
  const candidateKeys = keys.filter((key) => key.kid === envelope.kid);
  if (!candidateKeys.length) return { ok: false as const, error: "render_token_key_unknown" as const };

  let supplied: Buffer;
  try {
    supplied = Buffer.from(providedSignature, "base64url");
  } catch {
    return { ok: false as const, error: "invalid_render_token" as const };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(providedSignature) || supplied.toString("base64url") !== providedSignature) {
    return { ok: false as const, error: "invalid_render_token" as const };
  }
  const signatureValid = candidateKeys.some((key) => {
    const expected = sign(key.secret, encoded);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
  if (!signatureValid) return { ok: false as const, error: "render_token_signature_invalid" as const };

  const nowMs = args.nowMs ?? Date.now();
  const now = Math.floor(nowMs / 1000);
  if (!Number.isInteger(envelope.iat) || !Number.isInteger(envelope.exp) || envelope.exp - envelope.iat > MAX_TTL_SECONDS || envelope.exp <= envelope.iat) {
    return { ok: false as const, error: "invalid_render_token" as const };
  }
  if (envelope.exp <= now || envelope.iat > now + 30) {
    return { ok: false as const, error: "render_token_expired" as const };
  }
  const checked = validateFrozenPayload(envelope.frozen);
  if (!checked.ok) return { ok: false as const, error: checked.error };
  const deliveryBinding = checked.frozen.deliveryBinding ?? null;
  if (deliveryBinding) {
    if ("deliveryExpiresAt" in deliveryBinding) {
      const inspected = inspectR7BrowserEcbDeliveryBinding({ binding: deliveryBinding, nowMs });
      if (!inspected.ready) return { ok: false as const, error: "render_token_delivery_binding_not_current" as const };
      if (envelope.exp > Math.floor(Date.parse(deliveryBinding.deliveryExpiresAt) / 1000)) {
        return { ok: false as const, error: "render_token_original_deadline_extended" as const };
      }
    }
  }
  const identity = checked.frozen.identity;
  if (args.expectedDepth && identity.depth !== args.expectedDepth) {
    return { ok: false as const, error: "render_token_depth_mismatch" as const };
  }
  if (args.expectedTier && identity.tier !== args.expectedTier) {
    return { ok: false as const, error: "render_token_tier_mismatch" as const };
  }
  if (args.expectedRendererId && identity.rendererId !== args.expectedRendererId) {
    return { ok: false as const, error: "render_token_renderer_mismatch" as const };
  }
  if (args.expectedReportDigest && identity.reportDigest !== args.expectedReportDigest) {
    return { ok: false as const, error: "render_token_report_digest_mismatch" as const };
  }
  if (args.expectedSourceResultId && identity.sourceResultId !== args.expectedSourceResultId.trim()) {
    return { ok: false as const, error: "render_token_source_result_mismatch" as const };
  }
  return {
    ok: true as const,
    frozen: checked.frozen,
    report: checked.frozen.report,
    identity,
    keyId: envelope.kid,
    expiresAt: new Date(envelope.exp * 1000).toISOString(),
  };
}
