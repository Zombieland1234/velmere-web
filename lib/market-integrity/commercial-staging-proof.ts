import { createHash } from "node:crypto";
import type { Pass4645LedgerPersistence } from "./provider-evidence-ledger";
import { inspectPdfStructure } from "@/lib/reporting/pdf-structural-validation";

export type Pass4649Tier = "basic" | "pro" | "advanced";
export type Pass4649Environment = "test" | "staging" | "production";

export type Pass4649ProviderProof = {
  identityMatched: boolean;
  confirmedReceiptCount: number;
  providerFamilyCount: number;
  evidenceCategoryCount: number;
  uniqueEvidenceDelta: number;
  crossProviderConfirmedCategoryCount?: number;
  confidencePercent: number;
  conflictFree: boolean;
  runtimeSellReady: boolean;
};

export type Pass4649PaymentProof = {
  required: boolean;
  verified: boolean;
  mode: "none" | "stripe_test" | "stripe_live" | "manual" | "web3";
  entitlementBound: boolean;
  contextBound: boolean;
  revoked: boolean;
};

export type Pass4649PdfProof = {
  required: boolean;
  validBinary: boolean;
  contentType: string | null;
  byteLength: number;
  sha256: string | null;
  pageCount: number;
  reportChecksumMatches: boolean;
  activeContentDetected: boolean;
  renderVerified: boolean;
  clippingDetected: boolean;
  overlapDetected: boolean;
};

export type Pass4649CommercialProofInput = {
  tier: Pass4649Tier;
  environment: Pass4649Environment;
  provider: Pass4649ProviderProof;
  persistence?: Pass4645LedgerPersistence | null;
  payment: Pass4649PaymentProof;
  pdf: Pass4649PdfProof;
  operatorFinalSignRequired?: boolean;
  operatorFinalSignReady?: boolean;
};

export type Pass4649PdfBinaryInspection = {
  schemaVersion: "pass4649_pdf_binary_inspection_v1";
  valid: boolean;
  byteLength: number;
  sha256: string;
  headerValid: boolean;
  eofValid: boolean;
  pageCount: number;
  activeContentDetected: boolean;
  activeContentMarkers: string[];
  blockers: string[];
};

const THRESHOLDS = {
  basic: { receipts: 2, families: 2, categories: 2, confidence: 45, delta: 0, crossProviderCategories: 0 },
  pro: { receipts: 6, families: 2, categories: 4, confidence: 70, delta: 4, crossProviderCategories: 1 },
  advanced: { receipts: 10, families: 3, categories: 6, confidence: 85, delta: 5, crossProviderCategories: 2 },
} as const;

const PDF_PAGE_RANGE = {
  basic: { min: 2, max: 3 },
  pro: { min: 4, max: 6 },
  advanced: { min: 8, max: 12 },
} as const;

function integer(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function percent(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function inspectPass4649PdfBinary(bytes: Uint8Array): Pass4649PdfBinaryInspection {
  const buffer = Buffer.from(bytes);
  const byteLength = buffer.length;
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const structure = inspectPdfStructure(bytes);
  const headerValid = structure.headerValid;
  const eofValid = structure.eofValid;
  const pageCount = structure.pageCount;
  const activeContentMarkers = [...structure.activeContentMarkers];
  const activeContentDetected = structure.activeContentDetected;
  const blockers = unique([
    byteLength < 1024 ? `pdf_too_small:${byteLength}/1024` : null,
    ...structure.blockers,
  ]);
  return {
    schemaVersion: "pass4649_pdf_binary_inspection_v1",
    valid: blockers.length === 0,
    byteLength,
    sha256,
    headerValid,
    eofValid,
    pageCount,
    activeContentDetected,
    activeContentMarkers,
    blockers,
  };
}

export function buildPass4649CommercialProofDecision(input: Pass4649CommercialProofInput) {
  const thresholds = THRESHOLDS[input.tier];
  const pageRange = PDF_PAGE_RANGE[input.tier];
  const provider = {
    identityMatched: input.provider.identityMatched === true,
    confirmedReceiptCount: integer(input.provider.confirmedReceiptCount),
    providerFamilyCount: integer(input.provider.providerFamilyCount),
    evidenceCategoryCount: integer(input.provider.evidenceCategoryCount),
    uniqueEvidenceDelta: integer(input.provider.uniqueEvidenceDelta),
    crossProviderConfirmedCategoryCount: integer(input.provider.crossProviderConfirmedCategoryCount),
    confidencePercent: percent(input.provider.confidencePercent),
    conflictFree: input.provider.conflictFree === true,
    runtimeSellReady: input.provider.runtimeSellReady === true,
  };
  const paid = input.tier !== "basic";
  const persistenceRequired = paid;
  const pdfRequired = input.pdf.required === true;
  const productionLike = input.environment === "staging" || input.environment === "production";
  const providerBlockers = unique([
    !provider.identityMatched ? "asset_identity_not_verified" : null,
    provider.confirmedReceiptCount < thresholds.receipts
      ? `confirmed_receipts:${provider.confirmedReceiptCount}/${thresholds.receipts}`
      : null,
    provider.providerFamilyCount < thresholds.families
      ? `provider_families:${provider.providerFamilyCount}/${thresholds.families}`
      : null,
    provider.evidenceCategoryCount < thresholds.categories
      ? `evidence_categories:${provider.evidenceCategoryCount}/${thresholds.categories}`
      : null,
    provider.uniqueEvidenceDelta < thresholds.delta
      ? `unique_evidence_delta:${provider.uniqueEvidenceDelta}/${thresholds.delta}`
      : null,
    provider.crossProviderConfirmedCategoryCount < thresholds.crossProviderCategories
      ? `cross_provider_categories:${provider.crossProviderConfirmedCategoryCount}/${thresholds.crossProviderCategories}`
      : null,
    provider.confidencePercent < thresholds.confidence
      ? `confidence:${provider.confidencePercent}/${thresholds.confidence}`
      : null,
    !provider.conflictFree ? "provider_conflicts_unresolved" : null,
    !provider.runtimeSellReady ? "runtime_tier_gate_not_sell_ready" : null,
  ]);

  const persistence = input.persistence ?? null;
  const persistenceBlockers = persistenceRequired
    ? unique([
        !persistence ? "durable_ledger_missing" : null,
        persistence && persistence.durable !== true ? "durable_ledger_not_durable" : null,
        persistence && persistence.readBackVerified !== true ? "durable_ledger_readback_failed" : null,
        persistence && !persistence.headHash ? "durable_ledger_head_hash_missing" : null,
        productionLike && persistence?.mode !== "supabase" ? `durable_ledger_mode:${persistence?.mode ?? "missing"}/supabase` : null,
        ...(persistence?.blockers ?? []).map((blocker) => `durable_ledger:${blocker}`),
      ])
    : [];

  const payment = input.payment;
  const paymentBlockers = paid
    ? unique([
        payment.required !== true ? "paid_tier_payment_contract_not_required" : null,
        payment.verified !== true ? "verified_payment_receipt_missing" : null,
        payment.entitlementBound !== true ? "payment_not_bound_to_entitlement" : null,
        payment.contextBound !== true ? "payment_not_bound_to_report_context" : null,
        payment.revoked === true ? "payment_or_entitlement_revoked" : null,
        input.environment === "staging" && payment.mode !== "stripe_test" ? `staging_payment_mode:${payment.mode}/stripe_test` : null,
        input.environment === "production" && !["stripe_live", "manual", "web3"].includes(payment.mode)
          ? `production_payment_mode:${payment.mode}`
          : null,
      ])
    : [];

  const pdf = input.pdf;
  const pdfBlockers = pdfRequired
    ? unique([
        pdf.validBinary !== true ? "pdf_binary_invalid" : null,
        !String(pdf.contentType ?? "").toLowerCase().includes("application/pdf") ? "pdf_content_type_invalid" : null,
        integer(pdf.byteLength) < 1024 ? `pdf_bytes:${integer(pdf.byteLength)}/1024` : null,
        !pdf.sha256 || !/^[a-f0-9]{64}$/i.test(pdf.sha256) ? "pdf_sha256_invalid" : null,
        integer(pdf.pageCount) < pageRange.min || integer(pdf.pageCount) > pageRange.max
          ? `pdf_pages:${integer(pdf.pageCount)}/${pageRange.min}-${pageRange.max}`
          : null,
        pdf.reportChecksumMatches !== true ? "pdf_report_checksum_mismatch" : null,
        pdf.activeContentDetected === true ? "pdf_active_content_detected" : null,
        pdf.renderVerified !== true ? "pdf_render_not_verified" : null,
        pdf.clippingDetected === true ? "pdf_clipping_detected" : null,
        pdf.overlapDetected === true ? "pdf_overlap_detected" : null,
      ])
    : [];

  const operatorRequired = input.tier === "advanced" && input.operatorFinalSignRequired === true;
  const operatorBlockers = operatorRequired && input.operatorFinalSignReady !== true
    ? ["operator_final_sign_not_ready"]
    : [];

  const blockers = unique([...providerBlockers, ...persistenceBlockers, ...paymentBlockers, ...pdfBlockers, ...operatorBlockers]);
  return {
    schemaVersion: "pass4649_commercial_proof_decision_v1",
    tier: input.tier,
    environment: input.environment,
    commercialReady: blockers.length === 0,
    paymentDoesNotCreateEvidence: true,
    walletConnectIsNotPaymentProof: true,
    thresholds,
    pageRange,
    provider,
    gates: {
      provider: { passed: providerBlockers.length === 0, blockers: providerBlockers },
      persistence: { required: persistenceRequired, passed: persistenceBlockers.length === 0, blockers: persistenceBlockers },
      payment: { required: paid, passed: paymentBlockers.length === 0, blockers: paymentBlockers },
      pdf: { required: pdfRequired, passed: pdfBlockers.length === 0, blockers: pdfBlockers },
      operator: { required: operatorRequired, passed: operatorBlockers.length === 0, blockers: operatorBlockers },
    },
    blockers,
  } as const;
}

function configured(value: unknown, minimumLength = 8) {
  return typeof value === "string" && value.trim().length >= minimumLength && !/\.\.\.|your-|example|changeme/i.test(value);
}

function stripeMode(secret: string | undefined) {
  if (!secret) return "missing" as const;
  if (secret.startsWith("sk_test_")) return "test" as const;
  if (secret.startsWith("sk_live_")) return "live" as const;
  return "invalid" as const;
}

export function buildPass4649StagingPreflight(env: Record<string, string | undefined> = process.env) {
  const stripeSecretMode = stripeMode(env.STRIPE_SECRET_KEY);
  const publicStripeTest = String(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").startsWith("pk_test_");
  const webhookTestConfigured = String(env.STRIPE_WEBHOOK_SECRET ?? "").startsWith("whsec_");
  const supabaseUrlConfigured = /^https:\/\/[a-z0-9.-]+/i.test(String(env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? ""));
  const supabaseServiceRoleConfigured = configured(env.SUPABASE_SERVICE_ROLE_KEY, 24);
  const receiptSigningConfigured = configured(env.VELMERE_PROVIDER_RECEIPT_SIGNING_SECRET, 32);
  const stagingBaseUrl = String(env.VELMERE_STAGING_BASE_URL ?? "").trim();
  const stagingBaseUrlConfigured = /^https:\/\//i.test(stagingBaseUrl) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(stagingBaseUrl);
  const explicitLiveProbe = env.VELMERE_PASS4649_ALLOW_LIVE_PAYMENT_PROBE === "true";
  const blockers = unique([
    !stagingBaseUrlConfigured ? "staging_base_url_missing_or_invalid" : null,
    !supabaseUrlConfigured ? "supabase_url_missing" : null,
    !supabaseServiceRoleConfigured ? "supabase_service_role_missing" : null,
    !receiptSigningConfigured ? "provider_receipt_signing_secret_missing_or_short" : null,
    stripeSecretMode === "missing" ? "stripe_secret_missing" : null,
    stripeSecretMode === "invalid" ? "stripe_secret_format_invalid" : null,
    stripeSecretMode === "live" && !explicitLiveProbe ? "live_stripe_probe_requires_explicit_opt_in" : null,
    stripeSecretMode === "test" && !publicStripeTest ? "stripe_publishable_test_key_missing" : null,
    !webhookTestConfigured ? "stripe_webhook_secret_missing" : null,
  ]);
  return {
    schemaVersion: "pass4649_staging_preflight_v1",
    ready: blockers.length === 0,
    blockers,
    configuration: {
      stagingBaseUrlConfigured,
      supabaseUrlConfigured,
      supabaseServiceRoleConfigured,
      receiptSigningConfigured,
      stripeSecretMode,
      stripePublishableTestConfigured: publicStripeTest,
      stripeWebhookConfigured: webhookTestConfigured,
      livePaymentProbeExplicitlyAllowed: explicitLiveProbe,
    },
    secretValuesExposed: false,
  } as const;
}
