import { createHmac, timingSafeEqual } from "node:crypto";

import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import type { CustomerReportPayload } from "@/lib/market-integrity/customer-tier-pdf-renderer";
import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { CanonicalCustomerArtifactSurface } from "@/lib/reporting/canonical-customer-artifact";
import {
  isPass4824ExactPdfAccountCustomerArtifactSnapshot,
  verifyPass4822AccountCustomerArtifactOwner,
  verifyPass4822AccountCustomerArtifactSnapshot,
  type AccountCustomerArtifactSnapshot,
} from "@/lib/reporting/account-customer-artifact-snapshot";
import {
  assertPass4824PdfBlobMatchesSnapshot,
  verifyPass4824AccountCustomerArtifactPdfBlob,
  type AccountCustomerArtifactPdfBlob,
} from "@/lib/reporting/account-customer-artifact-pdf-blob";

export const P87_CUSTOMER_REPORT_EXACT_PDF_TOKEN_ID =
  "p87-customer-report-exact-pdf-token-v2" as const;
export const P87_CUSTOMER_REPORT_EXACT_PDF_TOKEN_PREFIX = "p87v2" as const;

const PURPOSE = "customer_market_report_exact_pdf" as const;
const SIGNATURE_DOMAIN = "velmere:customer-market-report-exact-pdf:v2:";
const DEFAULT_TTL_SECONDS = 8 * 60;
const MAX_TTL_SECONDS = 20 * 60;
const MAX_TOKEN_BYTES = 16 * 1024;
const MAX_ENVELOPE_BYTES = 8 * 1024;

type SigningKey = { kid: string; secret: string };

export type P87CustomerReportExactPdfEnvelope = {
  v: 2;
  purpose: typeof PURPOSE;
  kid: string;
  iat: number;
  exp: number;
  accountIdHash: string;
  snapshotId: string;
  snapshotDigest: string;
  payloadDigest: string;
  artifactDigest: string;
  pdfBlobId: string;
  pdfBlobRecordDigest: string;
  pdfDigest: string;
  pdfByteLength: number;
  surface: CanonicalCustomerArtifactSurface;
  reportId: string;
  rendererId: string;
  requestedTier: VelmereTier;
  deliveredTier: VelmereTier;
  locale: "pl" | "en" | "de";
};

const ENVELOPE_KEYS = Object.freeze([
  "accountIdHash",
  "artifactDigest",
  "deliveredTier",
  "exp",
  "iat",
  "kid",
  "locale",
  "payloadDigest",
  "pdfBlobId",
  "pdfBlobRecordDigest",
  "pdfByteLength",
  "pdfDigest",
  "purpose",
  "rendererId",
  "reportId",
  "requestedTier",
  "snapshotDigest",
  "snapshotId",
  "surface",
  "v",
].sort());

function keyId(value: string | undefined, fallback: string): string {
  return String(value ?? "").trim().replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, 48) || fallback;
}

function currentSigningKey(env: Record<string, string | undefined>): SigningKey | null {
  const current = String(
    env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_SECRET_CURRENT
      ?? env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_SECRET
      ?? "",
  ).trim();
  if (current.length < 32) return null;
  return {
    kid: keyId(env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_KEY_ID, "current"),
    secret: current,
  };
}

function verificationKeys(env: Record<string, string | undefined>): SigningKey[] {
  const current = String(
    env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_SECRET_CURRENT
      ?? env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_SECRET
      ?? "",
  ).trim();
  const previous = String(env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_SECRET_PREVIOUS ?? "").trim();
  const keys: SigningKey[] = [];
  if (current.length >= 32) {
    keys.push({
      kid: keyId(env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_KEY_ID, "current"),
      secret: current,
    });
  }
  if (previous.length >= 32) {
    keys.push({
      kid: keyId(env.VELMERE_CUSTOMER_REPORT_RENDER_TOKEN_PREVIOUS_KEY_ID, "previous"),
      secret: previous,
    });
  }
  return keys;
}

function validTier(value: unknown): value is VelmereTier {
  return value === "Basic" || value === "Pro" || value === "Advanced";
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/iu.test(value);
}

function validEnvelope(value: unknown): value is P87CustomerReportExactPdfEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const envelope = value as Partial<P87CustomerReportExactPdfEnvelope>;
  const keys = Object.keys(envelope).sort();
  if (keys.length !== ENVELOPE_KEYS.length || keys.some((key, index) => key !== ENVELOPE_KEYS[index])) {
    return false;
  }
  return envelope.v === 2
    && envelope.purpose === PURPOSE
    && typeof envelope.kid === "string"
    && envelope.kid.length > 0
    && envelope.kid.length <= 48
    && Number.isSafeInteger(envelope.iat)
    && Number.isSafeInteger(envelope.exp)
    && typeof envelope.accountIdHash === "string"
    && /^[a-f0-9]{64}$/iu.test(envelope.accountIdHash)
    && typeof envelope.snapshotId === "string"
    && /^artifact-(?:shield|real_markets)-[A-Za-z0-9._:-]{16,170}$/u.test(envelope.snapshotId)
    && validDigest(envelope.snapshotDigest)
    && validDigest(envelope.payloadDigest)
    && validDigest(envelope.artifactDigest)
    && typeof envelope.pdfBlobId === "string"
    && /^pdf-[a-f0-9]{16}-[a-f0-9]{64}$/u.test(envelope.pdfBlobId)
    && validDigest(envelope.pdfBlobRecordDigest)
    && validDigest(envelope.pdfDigest)
    && Number.isSafeInteger(envelope.pdfByteLength)
    && Number(envelope.pdfByteLength) > 0
    && Number(envelope.pdfByteLength) <= 8 * 1024 * 1024
    && (envelope.surface === "shield" || envelope.surface === "real_markets")
    && typeof envelope.reportId === "string"
    && envelope.reportId.length > 0
    && envelope.reportId.length <= 180
    && typeof envelope.rendererId === "string"
    && envelope.rendererId.length > 0
    && envelope.rendererId.length <= 160
    && validTier(envelope.requestedTier)
    && envelope.requestedTier !== "Basic"
    && validTier(envelope.deliveredTier)
    && envelope.deliveredTier !== "Basic"
    && (envelope.locale === "pl" || envelope.locale === "en" || envelope.locale === "de");
}

function sign(secret: string, encoded: string): Buffer {
  return createHmac("sha256", secret).update(`${SIGNATURE_DOMAIN}${encoded}`).digest();
}

function encodeEnvelope(envelope: P87CustomerReportExactPdfEnvelope): string {
  const bytes = Buffer.from(JSON.stringify(envelope), "utf8");
  if (bytes.byteLength > MAX_ENVELOPE_BYTES) throw new Error("customer_report_exact_pdf_token_envelope_too_large");
  return bytes.toString("base64url");
}

function decodeEnvelope(encoded: string): P87CustomerReportExactPdfEnvelope {
  const bytes = Buffer.from(encoded, "base64url");
  if (!bytes.byteLength || bytes.byteLength > MAX_ENVELOPE_BYTES) {
    throw new Error("invalid_customer_report_exact_pdf_token");
  }
  const value = JSON.parse(bytes.toString("utf8")) as unknown;
  if (!validEnvelope(value)) throw new Error("invalid_customer_report_exact_pdf_token");
  return value;
}

export function isP87CustomerReportExactPdfToken(token: string): boolean {
  return String(token ?? "").startsWith(`${P87_CUSTOMER_REPORT_EXACT_PDF_TOKEN_PREFIX}.`);
}

export function assertP87CustomerReportExactPdfBinding(args: {
  accountId: string;
  envelope: P87CustomerReportExactPdfEnvelope;
  snapshot: AccountCustomerArtifactSnapshot;
  blob: AccountCustomerArtifactPdfBlob;
}) {
  if (!verifyPass4822AccountCustomerArtifactSnapshot(args.snapshot)
    || !isPass4824ExactPdfAccountCustomerArtifactSnapshot(args.snapshot)) {
    throw new Error("customer_report_exact_pdf_snapshot_invalid");
  }
  if (!verifyPass4822AccountCustomerArtifactOwner(args.snapshot, args.accountId)) {
    throw new Error("customer_report_exact_pdf_owner_mismatch");
  }
  if (!verifyPass4824AccountCustomerArtifactPdfBlob(args.blob)) {
    throw new Error("customer_report_exact_pdf_blob_invalid");
  }
  assertPass4824PdfBlobMatchesSnapshot({
    blob: args.blob,
    snapshot: args.snapshot,
    accountId: args.accountId,
  });
  if (args.snapshot.payloadKind !== "market_customer_report_v1"
    || (args.snapshot.surface !== "shield" && args.snapshot.surface !== "real_markets")) {
    throw new Error("customer_report_exact_pdf_surface_invalid");
  }
  const deliveredTier = args.snapshot.deliveredTier;
  if (!validTier(args.snapshot.requestedTier)
    || args.snapshot.requestedTier === "Basic"
    || !validTier(deliveredTier)
    || deliveredTier === "Basic") {
    throw new Error("customer_report_exact_pdf_paid_tier_required");
  }
  const expected = args.envelope;
  if (expected.accountIdHash !== hashVelmereAccountBinding(args.accountId)
    || expected.accountIdHash !== args.snapshot.accountIdHash
    || expected.snapshotId !== args.snapshot.snapshotId
    || expected.snapshotDigest !== args.snapshot.snapshotDigest
    || expected.payloadDigest !== args.snapshot.payloadDigest
    || expected.artifactDigest !== args.snapshot.canonicalArtifact.artifactDigest
    || expected.pdfBlobId !== args.blob.blobId
    || expected.pdfBlobRecordDigest !== args.blob.recordDigest
    || expected.pdfDigest !== args.blob.pdfDigest
    || expected.pdfByteLength !== args.blob.pdfByteLength
    || expected.surface !== args.snapshot.surface
    || expected.reportId !== args.snapshot.reportId
    || expected.rendererId !== args.snapshot.canonicalArtifact.rendererId
    || expected.requestedTier !== args.snapshot.requestedTier
    || expected.deliveredTier !== deliveredTier
    || expected.locale !== args.snapshot.locale) {
    throw new Error("customer_report_exact_pdf_binding_mismatch");
  }
  return { snapshot: args.snapshot, blob: args.blob } as const;
}

export function readP87CustomerReportDownloadContext(snapshot: AccountCustomerArtifactSnapshot) {
  if (!verifyPass4822AccountCustomerArtifactSnapshot(snapshot)
    || snapshot.payloadKind !== "market_customer_report_v1"
    || (snapshot.surface !== "shield" && snapshot.surface !== "real_markets")) {
    throw new Error("customer_report_exact_pdf_payload_invalid");
  }
  const payload = snapshot.payload as Partial<CustomerReportPayload>;
  const target = payload.target as Partial<CustomerReportPayload["target"]> | undefined;
  const deliveryPolicy = payload.deliveryPolicy as Partial<CustomerReportPayload["deliveryPolicy"]> | undefined;
  const commercialEnvelope = payload.commercialEnvelope as Partial<CustomerReportPayload["commercialEnvelope"]> | undefined;
  if (payload.schemaVersion !== "velmere-customer-report-payload-v1"
    || payload.reportId !== snapshot.reportId
    || payload.locale !== snapshot.locale
    || !validTier(payload.tier)
    || !target
    || typeof target.symbol !== "string"
    || !target.symbol.trim()
    || typeof target.family !== "string"
    || !target.family.trim()
    || !deliveryPolicy
    || deliveryPolicy.visibleTier !== snapshot.deliveredTier
    || deliveryPolicy.status !== "ready_paid"
    || deliveryPolicy.paidEvidenceAllowed !== true
    || !commercialEnvelope
    || (commercialEnvelope.surface !== "shield" && commercialEnvelope.surface !== "real_markets")) {
    throw new Error("customer_report_exact_pdf_payload_invalid");
  }
  return {
    payload: snapshot.payload as CustomerReportPayload,
    symbol: target.symbol,
    family: target.family,
    locale: snapshot.locale,
    requestedTier: snapshot.requestedTier as Exclude<VelmereTier, "Basic">,
    deliveredTier: snapshot.deliveredTier as Exclude<VelmereTier, "Basic">,
    advancedDeliveryMode: payload.advancedDeliveryMode === "automated" ? "automated" as const : "manual_review" as const,
    manualReviewAppendixAllowed: deliveryPolicy.manualReviewAppendixAllowed === true,
  } as const;
}

export function issueP87CustomerReportExactPdfToken(args: {
  accountId: string;
  snapshot: AccountCustomerArtifactSnapshot;
  blob: AccountCustomerArtifactPdfBlob;
  env?: Record<string, string | undefined>;
  nowMs?: number;
  ttlSeconds?: number;
}) {
  const key = currentSigningKey(args.env ?? process.env);
  if (!key) return { ok: false as const, error: "customer_report_exact_pdf_token_secret_missing_or_short" as const };
  const accountId = String(args.accountId ?? "").trim();
  if (!accountId) return { ok: false as const, error: "customer_report_exact_pdf_account_required" as const };
  try {
    const context = readP87CustomerReportDownloadContext(args.snapshot);
    assertPass4824PdfBlobMatchesSnapshot({ blob: args.blob, snapshot: args.snapshot, accountId });
    if (!verifyPass4822AccountCustomerArtifactOwner(args.snapshot, accountId)) {
      throw new Error("customer_report_exact_pdf_owner_mismatch");
    }
    const now = Math.floor((args.nowMs ?? Date.now()) / 1000);
    const ttl = Math.max(60, Math.min(MAX_TTL_SECONDS, Math.trunc(args.ttlSeconds ?? DEFAULT_TTL_SECONDS)));
    const envelope: P87CustomerReportExactPdfEnvelope = {
      v: 2,
      purpose: PURPOSE,
      kid: key.kid,
      iat: now,
      exp: now + ttl,
      accountIdHash: args.snapshot.accountIdHash,
      snapshotId: args.snapshot.snapshotId,
      snapshotDigest: args.snapshot.snapshotDigest,
      payloadDigest: args.snapshot.payloadDigest,
      artifactDigest: args.snapshot.canonicalArtifact.artifactDigest,
      pdfBlobId: args.blob.blobId,
      pdfBlobRecordDigest: args.blob.recordDigest,
      pdfDigest: args.blob.pdfDigest,
      pdfByteLength: args.blob.pdfByteLength,
      surface: args.snapshot.surface,
      reportId: args.snapshot.reportId,
      rendererId: args.snapshot.canonicalArtifact.rendererId,
      requestedTier: context.requestedTier,
      deliveredTier: context.deliveredTier,
      locale: args.snapshot.locale,
    };
    const encoded = encodeEnvelope(envelope);
    const signature = sign(key.secret, encoded).toString("base64url");
    const token = `${P87_CUSTOMER_REPORT_EXACT_PDF_TOKEN_PREFIX}.${encoded}.${signature}`;
    if (Buffer.byteLength(token, "utf8") > MAX_TOKEN_BYTES) {
      return { ok: false as const, error: "customer_report_exact_pdf_token_too_large" as const };
    }
    return {
      ok: true as const,
      token,
      keyId: key.kid,
      expiresAt: new Date(envelope.exp * 1000).toISOString(),
      accountArtifactBinding: {
        snapshotId: envelope.snapshotId,
        snapshotDigest: envelope.snapshotDigest,
        accountIdHash: envelope.accountIdHash,
        artifactDigest: envelope.artifactDigest,
        surface: envelope.surface,
        rendererId: envelope.rendererId,
        requestedTier: envelope.requestedTier,
        deliveredTier: envelope.deliveredTier,
      },
      artifact: {
        storage: "exact_immutable_blob" as const,
        rendererId: envelope.rendererId,
        payloadDigest: envelope.payloadDigest,
        pdfHash: envelope.pdfDigest,
        layoutModelDigest: args.snapshot.canonicalArtifact.layoutDigest,
        renderPlanDigest: args.snapshot.canonicalArtifact.renderPlanDigest,
        byteLength: envelope.pdfByteLength,
        pageCount: args.snapshot.canonicalArtifact.pageCount,
        renderedRowCount: args.snapshot.canonicalArtifact.renderedRowCount,
        canonicalArtifact: args.snapshot.canonicalArtifact,
        accountArtifactBinding: {
          snapshotId: envelope.snapshotId,
          snapshotDigest: envelope.snapshotDigest,
          accountIdHash: envelope.accountIdHash,
          artifactDigest: envelope.artifactDigest,
          surface: envelope.surface,
          rendererId: envelope.rendererId,
          requestedTier: envelope.requestedTier,
          deliveredTier: envelope.deliveredTier,
        },
        pdfBlobId: envelope.pdfBlobId,
        pdfBlobRecordDigest: envelope.pdfBlobRecordDigest,
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "customer_report_exact_pdf_token_failed",
    };
  }
}

export function verifyP87CustomerReportExactPdfToken(args: {
  token: string;
  accountId: string;
  env?: Record<string, string | undefined>;
  nowMs?: number;
}) {
  const token = String(args.token ?? "").trim();
  if (!token || Buffer.byteLength(token, "utf8") > MAX_TOKEN_BYTES) {
    return { ok: false as const, error: "invalid_customer_report_exact_pdf_token" as const };
  }
  const [prefix, encoded, signatureText, ...extra] = token.split(".");
  if (prefix !== P87_CUSTOMER_REPORT_EXACT_PDF_TOKEN_PREFIX || !encoded || !signatureText || extra.length) {
    return { ok: false as const, error: "invalid_customer_report_exact_pdf_token" as const };
  }
  let envelope: P87CustomerReportExactPdfEnvelope;
  try {
    envelope = decodeEnvelope(encoded);
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "invalid_customer_report_exact_pdf_token",
    };
  }
  const keys = verificationKeys(args.env ?? process.env).filter((key) => key.kid === envelope.kid);
  if (!keys.length) return { ok: false as const, error: "customer_report_exact_pdf_token_key_unknown" as const };
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signatureText, "base64url");
  } catch {
    return { ok: false as const, error: "invalid_customer_report_exact_pdf_token" as const };
  }
  const signatureValid = keys.some((key) => {
    const expected = sign(key.secret, encoded);
    return expected.byteLength === supplied.byteLength && timingSafeEqual(expected, supplied);
  });
  if (!signatureValid) return { ok: false as const, error: "customer_report_exact_pdf_token_signature_invalid" as const };
  const now = Math.floor((args.nowMs ?? Date.now()) / 1000);
  if (envelope.exp <= envelope.iat || envelope.exp - envelope.iat > MAX_TTL_SECONDS || envelope.iat > now + 30) {
    return { ok: false as const, error: "invalid_customer_report_exact_pdf_token" as const };
  }
  if (envelope.exp <= now) return { ok: false as const, error: "customer_report_exact_pdf_token_expired" as const };
  if (envelope.accountIdHash !== hashVelmereAccountBinding(String(args.accountId ?? "").trim())) {
    return { ok: false as const, error: "customer_report_exact_pdf_token_account_mismatch" as const };
  }
  return { ok: true as const, envelope, expiresAt: new Date(envelope.exp * 1000).toISOString() };
}
