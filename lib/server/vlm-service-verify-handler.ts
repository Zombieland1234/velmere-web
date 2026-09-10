import { NextResponse } from "next/server";
import {
  applyApiRateLimit as applyPass2177SoftRateLimit,
  assertSameOriginRequest as assertPass2177SameOriginRequest,
  rejectLargeContentLength as rejectPass2177LargeContentLength,
  securityJson,
} from "@/lib/security/api-guard";
import {
  getVlmPaidProduct,
  normalizePaidContext,
  normalizeVlmPaidProductId,
  type VlmPaidAccessContext,
} from "@/lib/commerce/vlm-paid-access";
import { getVlmCurrentSkuTruth, tierForVlmProductId } from "@/lib/commerce/vlm-current-sku-truth";
import {
  hashVlmPaidAccessContext,
  isVlmLocalPaidAccessDemoEnabled,
} from "@/lib/commerce/vlm-paid-access-server";
import {
  upsertVlmPaidEntitlementFromDemoReceipt,
  upsertVlmPaidEntitlementFromStripeSession,
} from "@/lib/commerce/vlm-entitlement-ledger";
import { getStripeServerClient } from "@/lib/stripe/server";
import { verifyVlmPaidStripeReceipt } from "@/lib/payments/vlm-paid-stripe-receipt-verifier";
import {
  isPaidAuditProduct,
  promoteAuditCaseFromPaidEntitlement,
  PASS4612_AUDIT_CHECKOUT_BINDING_ID,
} from "@/lib/security/audit-intake-case-vault";
import {
  normalizeVlmServicePaymentRail,
  PASS2364_STRIPE_BLIK_REPLAY_ID,
} from "@/lib/checkout/stripe-blik-readiness";
import { recordPaymentRuntimeEvidence } from "@/lib/security/payment-runtime-evidence";
import { storePaymentRuntimeEvidenceDurable } from "@/lib/security/durable-payment-evidence-store";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { hashVelmereAccountBinding, resolveRequestAccount } from "@/lib/auth/account-session";
import {
  buildVlmCheckoutProductionEnvContract,
  redactVelmereEnvContractForPublic,
} from "@/lib/security/production-env-contract";
import {
  verifyVlmCheckoutSessionMetadataBinding,
  verifyVlmCheckoutVerificationBinding,
} from "@/lib/commerce/vlm-checkout-verification-binding";

type VerifyBody = {
  sessionId?: unknown;
  productId?: unknown;
  productCellId?: unknown;
  checkoutVerificationBindingToken?: unknown;
  context?: Partial<VlmPaidAccessContext>;
  locale?: unknown;
};

const PASS4156_SERVER_VERIFY_RECEIPT_BOUNDARY =
  "pass4156-server-verify-receipt-boundary: access token is issued only after demo receipt gate or Stripe paid session retrieval plus entitlement/context-hash match" as const;

type Pass4156ServerVerifyReceiptBoundary = {
  passId: "PASS4156_SERVER_VERIFY_RECEIPT_BOUNDARY";
  successUrlUnlockAllowed: false;
  browserBearerTokenIssued: false;
  accountEntitlementVerified: true;
  contextHashMatched: boolean;
  receiptSource: "local_demo_entitlement" | "stripe_paid_session";
  paymentRail: string;
  productId: string;
  sessionIdPrefix: "vlm_demo" | "cs";
  durableEvidenceSource?: string;
  durableEvidenceWrite?: boolean;
  entitlementLedgerMode?: string;
  auditQueueId?: string;
  boundary: typeof PASS4156_SERVER_VERIFY_RECEIPT_BOUNDARY;
};

function resolvePass4156Locale(
  value: unknown,
  fallback: unknown = "en",
): VlmPaidAccessContext["locale"] {
  if (value === "pl" || value === "de" || value === "en") return value;
  if (fallback === "pl" || fallback === "de" || fallback === "en")
    return fallback;
  return "en";
}

function pass4156ContextString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function pass4156ContextSurface(value: unknown): VlmPaidAccessContext["surface"] | undefined {
  return value === "shield" || value === "shield-pro" || value === "real-markets" || value === "browser" || value === "audit" || value === "unknown"
    ? value
    : undefined;
}

function pass4156ContextDepth(value: unknown): VlmPaidAccessContext["depth"] | undefined {
  return value === "basic" || value === "pro" || value === "advanced" ? value : undefined;
}



const PASS4157_SERVER_VERIFY_NEGATIVE_REPLAY_FIXTURE =
  "pass4157-server-verify-negative-replay-fixture: success URL, unpaid Stripe session, product mismatch and context-hash mismatch must deny access before token issuance" as const;

type Pass4157ServerVerifyReplayOutcome = "verified" | "denied";

type Pass4157ServerVerifyNegativeReplayFixture = {
  passId: "PASS4157_SERVER_VERIFY_NEGATIVE_REPLAY_FIXTURE";
  outcome: Pass4157ServerVerifyReplayOutcome;
  successUrlUnlockAllowed: false;
  accessTokenIssued: boolean;
  deniedReason?:
    | "invalid_session_id"
    | "product_mismatch"
    | "payment_not_confirmed"
    | "context_mismatch"
    | "demo_checkout_disabled";
  expectedDeniedCases: Array<
    | "success_url_only"
    | "unpaid_stripe_session"
    | "product_metadata_mismatch"
    | "context_hash_mismatch"
    | "production_demo_receipt"
  >;
  paymentStatus?: string;
  productId?: string;
  sessionIdPrefix?: "vlm_demo" | "cs" | "invalid";
  contextHashMatched: boolean;
  boundary: typeof PASS4157_SERVER_VERIFY_NEGATIVE_REPLAY_FIXTURE;
};

function pass4157SessionPrefix(value: string): Pass4157ServerVerifyNegativeReplayFixture["sessionIdPrefix"] {
  if (value.startsWith("vlm_demo_")) return "vlm_demo";
  if (value.startsWith("cs_")) return "cs";
  return "invalid";
}

function buildPass4157ServerVerifyNegativeReplayFixture(args: {
  outcome: Pass4157ServerVerifyReplayOutcome;
  sessionId: string;
  contextHashMatched: boolean;
  accessTokenIssued: boolean;
  deniedReason?: Pass4157ServerVerifyNegativeReplayFixture["deniedReason"];
  paymentStatus?: string;
  productId?: string;
}): Pass4157ServerVerifyNegativeReplayFixture {
  return {
    passId: "PASS4157_SERVER_VERIFY_NEGATIVE_REPLAY_FIXTURE",
    outcome: args.outcome,
    successUrlUnlockAllowed: false,
    accessTokenIssued: args.accessTokenIssued,
    deniedReason: args.deniedReason,
    expectedDeniedCases: [
      "success_url_only",
      "unpaid_stripe_session",
      "product_metadata_mismatch",
      "context_hash_mismatch",
      "production_demo_receipt",
    ],
    paymentStatus: args.paymentStatus,
    productId: args.productId,
    sessionIdPrefix: pass4157SessionPrefix(args.sessionId),
    contextHashMatched: args.contextHashMatched,
    boundary: PASS4157_SERVER_VERIFY_NEGATIVE_REPLAY_FIXTURE,
  };
}

function jsonPass4157PaymentReplayError(
  message: string,
  status: number,
  args: {
    sessionId: string;
    deniedReason: NonNullable<Pass4157ServerVerifyNegativeReplayFixture["deniedReason"]>;
    productId?: string;
    paymentStatus?: string;
    contextHashMatched?: boolean;
    details?: unknown;
  },
) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      details: args.details,
      pass4157: buildPass4157ServerVerifyNegativeReplayFixture({
        outcome: "denied",
        sessionId: args.sessionId,
        productId: args.productId,
        paymentStatus: args.paymentStatus,
        contextHashMatched: args.contextHashMatched ?? false,
        accessTokenIssued: false,
        deniedReason: args.deniedReason,
      }),
    },
    {
      status,
      headers: {
        "x-velmere-pass4157-payment-negative-replay":
          "denied-before-access-token",
      },
    },
  );
}

function buildPass4156ServerVerifyReceiptBoundary(args: {
  productId: string;
  paymentRail: string;
  receiptSource: Pass4156ServerVerifyReceiptBoundary["receiptSource"];
  sessionId: string;
  contextHashMatched: boolean;
  durableEvidenceSource?: string;
  durableEvidenceWrite?: boolean;
  entitlementLedgerMode?: string;
  auditQueueId?: string;
}): Pass4156ServerVerifyReceiptBoundary {
  return {
    passId: "PASS4156_SERVER_VERIFY_RECEIPT_BOUNDARY",
    successUrlUnlockAllowed: false,
    browserBearerTokenIssued: false,
    accountEntitlementVerified: true,
    contextHashMatched: args.contextHashMatched,
    receiptSource: args.receiptSource,
    paymentRail: args.paymentRail,
    productId: args.productId,
    sessionIdPrefix: args.sessionId.startsWith("vlm_demo_") ? "vlm_demo" : "cs",
    durableEvidenceSource: args.durableEvidenceSource,
    durableEvidenceWrite: args.durableEvidenceWrite,
    entitlementLedgerMode: args.entitlementLedgerMode,
    auditQueueId: args.auditQueueId,
    boundary: PASS4156_SERVER_VERIFY_RECEIPT_BOUNDARY,
  };
}

function jsonError(message: string, status = 400, details?: unknown) {
  return securityJson({ ok: false, error: message, details }, { status });
}

const defaultVlmServiceVerifyDependencies = {
  resolveRequestAccount,
  getStripeServerClient,
  verifyVlmPaidStripeReceipt,
  upsertVlmPaidEntitlementFromDemoReceipt,
  upsertVlmPaidEntitlementFromStripeSession,
  promoteAuditCaseFromPaidEntitlement,
  recordPaymentRuntimeEvidence,
  storePaymentRuntimeEvidenceDurable,
};

export type VlmServiceVerifyDependencies =
  typeof defaultVlmServiceVerifyDependencies;

export const vlmServiceVerifyDependencies: VlmServiceVerifyDependencies = {
  ...defaultVlmServiceVerifyDependencies,
};

export async function handleVlmServiceVerifyRequest(
  request: Request,
  dependencies: VlmServiceVerifyDependencies =
    vlmServiceVerifyDependencies,
) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(
    request,
    256 * 1024,
  );
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(request, {
    allowMissingOrigin: process.env.NODE_ENV !== "production",
  });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(request, {
    keyPrefix: "pass2177-checkout-vlm-service-verify",
    limit: 20,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  const parsedBody = await readBoundedJsonBody<VerifyBody>(
    request,
    256 * 1024,
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;
  const account = await dependencies.resolveRequestAccount(request);
  if (!account) return jsonError("account_session_required_for_paid_verify", 401);
  const accountIdHash = hashVelmereAccountBinding(account.accountId);

  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const demoSession = sessionId.startsWith("vlm_demo_");
  if (!sessionId.startsWith("cs_") && !demoSession)
    return jsonPass4157PaymentReplayError("invalid_session_id", 400, {
      sessionId,
      deniedReason: "invalid_session_id",
    });

  const productId = normalizeVlmPaidProductId(body.productId);
  if (!productId) return jsonError("invalid_product_id", 400);
  const productCellId =
    typeof body.productCellId === "string" ? body.productCellId.trim() : "";
  if (!productCellId) return jsonError("product_cell_id_required", 400);
  const locale = resolvePass4156Locale(body.locale);
  const context = normalizePaidContext(
    {
      surface: pass4156ContextSurface(body.context?.surface),
      locale,
      assetId: pass4156ContextString(body.context?.assetId),
      symbol: pass4156ContextString(body.context?.symbol),
      depth: pass4156ContextDepth(body.context?.depth),
      requestId: pass4156ContextString(body.context?.requestId),
      auditCaseRef: pass4156ContextString(body.context?.auditCaseRef),
      accountIdHash,
      returnPath: pass4156ContextString(body.context?.returnPath),
    },
    locale,
  );
  const checkoutVerificationBinding =
    verifyVlmCheckoutVerificationBinding({
      token: body.checkoutVerificationBindingToken,
      sessionId,
      productId,
      productCellId,
      accountIdHash,
      context,
    });
  if (!checkoutVerificationBinding.ok) {
    return jsonError(
      checkoutVerificationBinding.error,
      checkoutVerificationBinding.error ===
        "checkout_verification_binding_missing"
        ? 401
        : 409,
      {
        providerCallsAllowed: false,
        durableWritesAllowed: false,
      },
    );
  }

  const checkoutContract = buildVlmCheckoutProductionEnvContract();

  if (demoSession) {
    if (!isVlmLocalPaidAccessDemoEnabled())
      return jsonPass4157PaymentReplayError("demo_checkout_disabled", 403, {
        sessionId,
        deniedReason: "demo_checkout_disabled",
        paymentStatus: "demo_disabled",
      });
    const demoContextHash = hashVlmPaidAccessContext(context);
    const expectedDemoPrefix = `vlm_demo_${productId}_${demoContextHash.slice(0, 16)}_`;
    if (!sessionId.startsWith(expectedDemoPrefix)) {
      return jsonPass4157PaymentReplayError("context_mismatch", 409, {
        sessionId,
        deniedReason: "context_mismatch",
        productId,
        paymentStatus: "demo_receipt_context_mismatch",
        contextHashMatched: false,
      });
    }
    const entitlement =
      await dependencies.upsertVlmPaidEntitlementFromDemoReceipt({
        sessionId,
        productId,
        context,
      });
    if (!entitlement.ok) return jsonError(entitlement.error, 503);
    let auditCaseTransition = null;
    if (isPaidAuditProduct(productId) && context.auditCaseRef) {
      auditCaseTransition =
        await dependencies.promoteAuditCaseFromPaidEntitlement({
          caseRef: context.auditCaseRef,
          stripeSessionId: sessionId,
          productId,
          contextHash: entitlement.record.contextHash,
          entitlementId: entitlement.record.id,
          paymentEventId: `checkout_verify:${sessionId}`,
        });
      if (!auditCaseTransition.ok) return jsonError(auditCaseTransition.error ?? "audit_case_transition_failed", 503, {
        passId: PASS4612_AUDIT_CHECKOUT_BINDING_ID,
        failClosed: auditCaseTransition.failClosed,
      });
    }
    const paymentEvidence = dependencies.recordPaymentRuntimeEvidence({
      area: "vlm_service",
      status: "manual",
      label: "VLM service demo checkout verify",
      summary: `Local demo verify for ${productId}; creates entitlement ledger and optional auditQueueId without live payment proof.`,
      evidenceRef: sessionId,
      operator: "checkout-verify",
      auditQueueId: entitlement.record.auditQueueId,
      stripeSessionId: sessionId,
      entitlementId: entitlement.record.id,
      safeNotes:
        "pass2366=demo_verify_memory_or_supabase; production requires Stripe paid session",
    });
    const durablePaymentEvidence =
      await dependencies.storePaymentRuntimeEvidenceDurable(paymentEvidence);
    return NextResponse.json({
      ok: true,
      product: getVlmPaidProduct(productId, locale),
      context,
      expiresAt: entitlement.record.expiresAt,
      demoMode: "local_paid_access_demo",
      entitlement: {
        id: entitlement.record.id,
        status: entitlement.record.status,
        ledgerMode: entitlement.mode,
        auditQueueId: entitlement.record.auditQueueId,
        source: entitlement.record.source,
      },
      auditCase: auditCaseTransition?.record ? {
        caseRef: auditCaseTransition.record.caseRef,
        status: auditCaseTransition.record.status,
        entitlementVerified: auditCaseTransition.record.entitlementVerified,
        analysisStarted: auditCaseTransition.record.analysisStarted,
        passId: PASS4612_AUDIT_CHECKOUT_BINDING_ID,
      } : null,
      pass2362: {
        paymentState: "demo_receipt_verified",
        queueState: entitlement.record.auditQueueId
          ? "analysis_queue_created"
          : "legacy_entitlement_verified",
        productionBoundary:
          "Local demo receipts never run in production; production still requires Stripe paid Checkout Session + webhook/verify ledger.",
      },
      pass2364: {
        passId: PASS2364_STRIPE_BLIK_REPLAY_ID,
        paymentRail: "local_demo_zero_euro",
        replayState: "demo_verify_no_live_webhook",
      },
      pass2366: {
        paymentEvidenceId: paymentEvidence.id,
        durableSource: durablePaymentEvidence.source,
        durableWrite: durablePaymentEvidence.durableWrite,
        auditQueueId: entitlement.record.auditQueueId,
      },
      pass4156: buildPass4156ServerVerifyReceiptBoundary({
        productId,
        paymentRail: "local_demo_zero_euro",
        receiptSource: "local_demo_entitlement",
        sessionId,
        contextHashMatched: true,
        durableEvidenceSource: durablePaymentEvidence.source,
        durableEvidenceWrite: durablePaymentEvidence.durableWrite,
        entitlementLedgerMode: entitlement.mode,
        auditQueueId: entitlement.record.auditQueueId ?? undefined,
      }),
      pass4157: buildPass4157ServerVerifyNegativeReplayFixture({
        outcome: "verified",
        sessionId,
        productId,
        paymentStatus: "demo_receipt_verified",
        contextHashMatched: true,
        accessTokenIssued: false,
      }),
      warning:
        "Local-only demo receipt. It is not a live payment and is disabled in production.",
    });
  }

  if (checkoutContract.status === "blocked_env") {
    return jsonError("checkout_runtime_unavailable", 503, {
      productionContract: redactVelmereEnvContractForPublic(checkoutContract),
    });
  }

  const stripe = dependencies.getStripeServerClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const sessionMetadataBinding =
    verifyVlmCheckoutSessionMetadataBinding({
      session,
      binding: checkoutVerificationBinding.payload,
    });
  if (!sessionMetadataBinding.ok) {
    return jsonError(sessionMetadataBinding.error, 409, {
      paymentIntentRetrievalAllowed: false,
      durableWritesAllowed: false,
    });
  }
  const metadataProduct = normalizeVlmPaidProductId(
    session.metadata?.productId,
  );
  if (productId !== metadataProduct)
    return jsonPass4157PaymentReplayError("product_mismatch", 409, {
      sessionId,
      deniedReason: "product_mismatch",
      productId,
      paymentStatus: session.payment_status,
      details: { metadataProduct, requestedProduct: productId },
    });
  if (session.payment_status !== "paid")
    return jsonPass4157PaymentReplayError("payment_not_confirmed", 402, {
      sessionId,
      deniedReason: "payment_not_confirmed",
      productId,
      paymentStatus: session.payment_status,
      details: { paymentStatus: session.payment_status },
    });

  const paymentRail = normalizeVlmServicePaymentRail(
    session.metadata?.paymentRail,
  );
  const receiptVerification = await dependencies.verifyVlmPaidStripeReceipt({
    stripe,
    session,
  });
  if (!receiptVerification.ok) {
    return jsonError(
      receiptVerification.error,
      receiptVerification.retryable ? 503 : 423,
      { retryable: receiptVerification.retryable, terminal: receiptVerification.terminal },
    );
  }
  const entitlement = await dependencies.upsertVlmPaidEntitlementFromStripeSession(
    session,
    "checkout_verify",
  );
  if (!entitlement.ok) {
    return jsonError(
      entitlement.error,
      entitlement.retryable ? 503 : 423,
      { retryable: entitlement.retryable, terminal: entitlement.terminal },
    );
  }
  if (entitlement.record.contextHash !== hashVlmPaidAccessContext(context)) {
    return jsonPass4157PaymentReplayError("context_mismatch", 409, {
      sessionId,
      deniedReason: "context_mismatch",
      productId,
      paymentStatus: session.payment_status,
      contextHashMatched: false,
    });
  }

  const expiresMs = Date.parse(entitlement.record.expiresAt) - Date.now();
  if (
    (entitlement.record.status !== "active" && entitlement.record.status !== "paid") ||
    !Number.isFinite(expiresMs) ||
    expiresMs <= 0
  ) {
    return jsonError("entitlement_inactive_or_expired", 423, {
      retryable: false,
      terminal: true,
    });
  }

  let auditCaseTransition = null;
  if (isPaidAuditProduct(productId) && context.auditCaseRef) {
    auditCaseTransition =
      await dependencies.promoteAuditCaseFromPaidEntitlement({
        caseRef: context.auditCaseRef,
        stripeSessionId: session.id,
        productId,
        contextHash: entitlement.record.contextHash,
        entitlementId: entitlement.record.id,
        paymentEventId: `checkout_verify:${session.id}`,
      });
    if (!auditCaseTransition.ok) return jsonError(auditCaseTransition.error ?? "audit_case_transition_failed", 503, {
      passId: PASS4612_AUDIT_CHECKOUT_BINDING_ID,
      failClosed: auditCaseTransition.failClosed,
    });
  }

  const paymentEvidence = dependencies.recordPaymentRuntimeEvidence({
    area: "vlm_service",
    status: "pass",
    label: "VLM service paid checkout verify",
    summary: `Stripe paid session verified for ${productId}; entitlement ledger linked to optional auditQueueId.`,
    evidenceRef: session.id,
    operator: "checkout-verify",
    auditQueueId: entitlement.record.auditQueueId,
    stripeSessionId: session.id,
    entitlementId: entitlement.record.id,
    safeNotes: `pass2366=checkout_verify; paymentRail=${paymentRail}`,
  });
  const durablePaymentEvidence =
    await dependencies.storePaymentRuntimeEvidenceDurable(paymentEvidence);

  return NextResponse.json(
    {
      ok: true,
      product: getVlmPaidProduct(productId, locale),
      context,
      expiresAt: entitlement.record.expiresAt,
      entitlement: {
        id: entitlement.record.id,
        status: entitlement.record.status,
        ledgerMode: entitlement.mode,
        auditQueueId: entitlement.record.auditQueueId,
      },
      auditCase: auditCaseTransition?.record ? {
        caseRef: auditCaseTransition.record.caseRef,
        status: auditCaseTransition.record.status,
        entitlementVerified: auditCaseTransition.record.entitlementVerified,
        analysisStarted: auditCaseTransition.record.analysisStarted,
        passId: PASS4612_AUDIT_CHECKOUT_BINDING_ID,
      } : null,
      pass2364: {
        passId: PASS2364_STRIPE_BLIK_REPLAY_ID,
        paymentRail,
        stripeLineCurrency:
          session.metadata?.stripeLineCurrency ?? session.currency ?? null,
        stripeLineAmount:
          session.metadata?.stripeLineAmount ?? session.amount_total ?? null,
        replayState: "server_retrieve_verify_paid_session",
      },
      pass2366: {
        paymentEvidenceId: paymentEvidence.id,
        durableSource: durablePaymentEvidence.source,
        durableWrite: durablePaymentEvidence.durableWrite,
        auditQueueId: entitlement.record.auditQueueId,
      },
      pass4156: buildPass4156ServerVerifyReceiptBoundary({
        productId,
        paymentRail,
        receiptSource: "stripe_paid_session",
        sessionId: session.id,
        contextHashMatched: true,
        durableEvidenceSource: durablePaymentEvidence.source,
        durableEvidenceWrite: durablePaymentEvidence.durableWrite,
        entitlementLedgerMode: entitlement.mode,
        auditQueueId: entitlement.record.auditQueueId ?? undefined,
      }),
      pass4157: buildPass4157ServerVerifyNegativeReplayFixture({
        outcome: "verified",
        sessionId: session.id,
        productId,
        paymentStatus: session.payment_status,
        contextHashMatched: true,
        accessTokenIssued: false,
      }),
    },
    {
      headers: {
        "x-velmere-pass4156-server-verify-receipt-boundary":
          "token-issued-after-server-verified-receipt",
        "x-velmere-pass4157-payment-negative-replay":
          "verified-after-negative-replay-deny-cases",
      },
    },
  );
}
