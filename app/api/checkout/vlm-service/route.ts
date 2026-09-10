import { publicApiError, reportApiError } from "@/lib/security/api-error-envelope";
import { resolveCanonicalSiteOrigin } from "@/lib/security/navigation-redirect-boundary";
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { getStripeServerClient } from "@/lib/stripe/server";
import {
  buildVlmPaidReturnPath,
  getVlmPaidProduct,
  normalizePaidContext,
  normalizeVlmPaidProductId,
  PASS2024_VLM_PAID_ACCESS_ID,
  type VlmPaidAccessContext,
} from "@/lib/commerce/vlm-paid-access";
import { tierForVlmProductId } from "@/lib/commerce/vlm-current-sku-truth";
import { evaluateVlmCommercialReadiness, type VlmCommercialProductFamily } from "@/lib/commerce/vlm-commercial-readiness";
import { buildCurrentP36CommercialEvidence } from "@/lib/commerce/vlm-current-commercial-evidence";
import { buildCurrentVlmTierEligibility, buildPublicVlmTierEligibility } from "@/lib/commerce/vlm-evidence-availability";
import {
  hashVlmPaidAccessContext,
  isVlmLocalPaidAccessDemoEnabled,
} from "@/lib/commerce/vlm-paid-access-server";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
  securityJson,
} from "@/lib/security/api-guard";
import {
  buildVlmServicePaymentRailReadiness,
  normalizeVlmServicePaymentRail,
  PASS2364_STRIPE_BLIK_REPLAY_ID,
} from "@/lib/checkout/stripe-blik-readiness";
import { appendPass2178MutationReceipt } from "@/lib/security/mutation-receipt-vault";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { hashVelmereAccountBinding, resolveRequestAccount } from "@/lib/auth/account-session";
import {
  authorizeAuditCaseForCheckout,
  bindAuditCaseToCheckoutSession,
  isPaidAuditProduct,
  PASS4612_AUDIT_CHECKOUT_BINDING_ID,
  PASS4612_AUDIT_CHECKOUT_BOUNDARY,
} from "@/lib/security/audit-intake-case-vault";
import {
  buildVlmCheckoutProductionEnvContract,
  redactVelmereEnvContractForPublic,
} from "@/lib/security/production-env-contract";
import { completePass4394ClientRequestJsonResponse, pass4394IdempotencyHeaders, registerPass4394ClientRequestMutation } from "@/lib/security/client-request-idempotency";
import { assessLiveCheckoutIdempotency } from "@/lib/checkout/live-checkout-safety";
import { pass4396IdempotencyReplayResponse } from "@/lib/security/idempotency-replay-response";
import {
  evaluatePass35ProductCellCheckout,
  PASS35_PRODUCT_CELL_GATE_ID,
} from "@/lib/commerce/pass35-product-cell-readiness";
import { createVlmCheckoutVerificationBinding } from "@/lib/commerce/vlm-checkout-verification-binding";
import { PASS36_PAID_CHECKOUT_CONTAINMENT } from "@/lib/commerce/vlm-paid-checkout-containment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function commercialFamilyForProductId(
  productId: string,
  surface: "shield" | "shield-pro" | "real-markets" | "browser" | "audit" | "unknown",
): VlmCommercialProductFamily | null {
  if (productId.includes("_audit_")) return "audit";
  // Generic legacy analysis/PDF ids do not encode a product family. Resolve them only from
  // server-normalized surface context. Unknown must fail closed instead of manufacturing
  // Browser/PDF readiness credit. PDF is an artifact, never a product family/SKU.
  // "shield" surface is ambiguous between Shield and Shield Pro for generic legacy paid IDs.
  if (surface === "shield") {
    if (productId.includes("pro") || productId.includes("institutional")) return "shield-pro";
    return "shield";
  }
  if (surface === "shield-pro") return "shield-pro";
  if (surface === "real-markets") return "real-markets";
  if (surface === "browser") return "browser";
  if (surface === "audit") return "audit";
  return null;
}

const PASS4145_SERVER_RECEIPT_REPLAY_BOUNDARY =
  "pass4145-server-receipt-replay-boundary: success URL is context only; paid access is unlocked only by server-verified receipt/entitlement replay" as const;

type Pass4145ServerReceiptReplayGuard = {
  passId: "PASS4145_SERVER_RECEIPT_REPLAY_GUARD";
  successUrlUnlockAllowed: false;
  serverReceiptRequired: true;
  webhookOrServerVerifyRequired: true;
  paymentRail: string;
  productId: string;
  contextHash: string;
  mutationReceiptId?: string;
  mutationReceiptPersisted?: boolean;
  boundary: typeof PASS4145_SERVER_RECEIPT_REPLAY_BOUNDARY;
};

function buildPass4145ServerReceiptReplayGuard(args: {
  productId: string;
  paymentRail: string;
  contextHash: string;
  mutationReceiptId?: string;
  mutationReceiptPersisted?: boolean;
}): Pass4145ServerReceiptReplayGuard {
  return {
    passId: "PASS4145_SERVER_RECEIPT_REPLAY_GUARD",
    successUrlUnlockAllowed: false,
    serverReceiptRequired: true,
    webhookOrServerVerifyRequired: true,
    productId: args.productId,
    paymentRail: args.paymentRail,
    contextHash: args.contextHash,
    mutationReceiptId: args.mutationReceiptId,
    mutationReceiptPersisted: args.mutationReceiptPersisted,
    boundary: PASS4145_SERVER_RECEIPT_REPLAY_BOUNDARY,
  };
}

type VlmServiceCheckoutBody = {
  productId?: unknown;
  productCellId?: unknown;
  locale?: unknown;
  context?: Partial<VlmPaidAccessContext>;
  paymentRail?: unknown;
  clientRequestId?: unknown;
};

function jsonError(message: string, status = 400, details?: unknown) {
  return securityJson({ ok: false, error: message, details }, { status });
}

function compact(value: unknown, max = 460) {
  const raw = JSON.stringify(value ?? {});
  if (raw.length <= max) return raw;
  return JSON.stringify({
    truncated: true,
    sha256: createHash("sha256").update(raw).digest("hex"),
  });
}

function serviceCheckoutReady() {
  const contract = buildVlmCheckoutProductionEnvContract();
  const qaStripeReady =
    !contract.productionLike &&
    process.env.CHECKOUT_MODE === "stripe" &&
    Boolean(process.env.STRIPE_SECRET_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_SITE_URL) &&
    process.env.VELMERE_SERVICES_COMMERCIAL_READY === "true";
  const reasons = contract.publicBlockedReasons;
  return {
    enabled: contract.status === "ready" || qaStripeReady,
    reasons,
    productionContract: redactVelmereEnvContractForPublic(contract),
  };
}

export async function POST(request: Request) {
  const sizeGuard = rejectLargeContentLength(request, 24 * 1024);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(request, {
    allowMissingOrigin: process.env.NODE_ENV !== "production",
  });
  if (originGuard) return originGuard;
  const rateLimit = await applyApiRateLimit(request, {
    keyPrefix: "vlm-service-checkout",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  // Fail before body parsing, account lookup, Stripe calls, URL construction,
  // metadata creation or browser binding issuance. Re-enabling this route
  // requires a new source revision with a durable opaque server-owned flow,
  // clean callback URLs and formal A73/A96 denominator governance.
  if (PASS36_PAID_CHECKOUT_CONTAINMENT.active) {
    const response = securityJson(
      {
        ok: false,
        error: PASS36_PAID_CHECKOUT_CONTAINMENT.reason,
        saleEnabled: false,
        productionApproved: false,
        live: false,
        retryable: false,
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
          "x-content-type-options": "nosniff",
        },
      },
    );
    response.headers.set("referrer-policy", "no-referrer");
    return response;
  }

  const parsedBody = await readBoundedJsonBody<VlmServiceCheckoutBody>(
    request,
    24 * 1024,
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;

  const productId = normalizeVlmPaidProductId(body.productId);
  if (!productId) return jsonError("invalid_product_id", 400);

  const locale =
    body.locale === "pl" || body.locale === "de" || body.locale === "en"
      ? body.locale
      : "en";
  const requestedContext = normalizePaidContext({ ...body.context, locale }, locale);
  const product = getVlmPaidProduct(productId, locale);
  const currentTier = tierForVlmProductId(productId);
  if (currentTier) {
    const family = commercialFamilyForProductId(productId, requestedContext.surface);
    const commercial = family ? evaluateVlmCommercialReadiness({
      family,
      tier: currentTier,
      locale,
      evidence: buildCurrentP36CommercialEvidence(family),
    }) : null;
    const eligibility = commercial ? buildPublicVlmTierEligibility(
      buildCurrentVlmTierEligibility({ commercial, subjectId: productId }),
      locale,
    ) : null;
    return jsonError(currentTier === "advanced" ? "product_not_for_sale" : "public_checkout_disabled_invitation_only", 409, {
      product: {
        id: product.id,
        label: product.label,
        customerDecision: product.customerDecision,
        publicCheckoutAllowed: false,
        publicPrice: null,
      },
      eligibility,
      commercialFamily: family,
      artifactOnlyOrUnscopedLegacyProduct: family === null,
      chargeAllowed: false,
      saleEnabled: false,
      providerCallsAllowed: false,
      durableWritesAllowed: false,
      retryable: false,
    });
  }
  const productCellGate = evaluatePass35ProductCellCheckout({
    legacyProductId: productId,
    requestedProductCellId: body.productCellId,
    surface: requestedContext.surface,
    tier: requestedContext.depth,
  });
  if (!productCellGate.ok) {
    return jsonError(productCellGate.error, productCellGate.status, {
      passId: PASS35_PRODUCT_CELL_GATE_ID,
      chargeAllowed: false,
      readinessEvaluated: productCellGate.readinessEvaluated,
      legacyProductId: productId,
      requestedProductCellId:
        typeof body.productCellId === "string" ? body.productCellId.trim() : null,
      surface: requestedContext.surface,
      tier: requestedContext.depth ?? null,
      expectedProductCellId:
        "expectedProductCellId" in productCellGate
          ? productCellGate.expectedProductCellId ?? null
          : null,
      productCell:
        "productCell" in productCellGate
          ? {
              productCellId: productCellGate.productCell.productCellId,
              productFamily: productCellGate.productCell.productFamily,
              tier: productCellGate.productCell.tier,
              role: productCellGate.productCell.role,
              sellEnabled: productCellGate.productCell.sellEnabled,
            }
          : null,
      blockers: "blockers" in productCellGate ? productCellGate.blockers : [],
    });
  }

  const account = await resolveRequestAccount(request);
  if (!account) return jsonError("account_session_required_for_paid_checkout", 401);
  const pass4394Idempotency = await registerPass4394ClientRequestMutation({
    request,
    action: "vlm_service_checkout_session_created",
    targetType: "vlm_service_checkout",
    targetId: productId,
    accountId: account.accountId,
    body,
  });
  if (!pass4394Idempotency.ok) {
    return pass4396IdempotencyReplayResponse({
      surface: "vlm_service_checkout",
      pass4394Idempotency,
    });
  }
  const accountIdHash = hashVelmereAccountBinding(account.accountId);
  const context = normalizePaidContext({ ...body.context, locale, accountIdHash }, locale);
  const contextHash = hashVlmPaidAccessContext(context);
  const auditTier = productId === "vlm_advanced_audit_human_review" ? "advanced" : productId === "vlm_pro_audit_review" ? "pro" : null;
  if (isPaidAuditProduct(productId)) {
    if (!account) return jsonError("account_required_for_paid_audit", 401, { passId: PASS4612_AUDIT_CHECKOUT_BINDING_ID });
    if (context.surface !== "audit" || context.depth !== auditTier || !context.auditCaseRef) {
      return jsonError("audit_case_context_required", 400, {
        expectedSurface: "audit",
        expectedDepth: auditTier,
        auditCaseRefRequired: true,
        boundary: PASS4612_AUDIT_CHECKOUT_BOUNDARY,
      });
    }
    const auditCaseAuthorization = await authorizeAuditCaseForCheckout({
      caseRef: context.auditCaseRef,
      accountId: account.accountId,
      tier: auditTier,
      productId,
    });
    if (!auditCaseAuthorization.ok) {
      const status = auditCaseAuthorization.error === "case_account_mismatch" ? 403 : auditCaseAuthorization.error === "case_not_found" ? 404 : 409;
      return jsonError(auditCaseAuthorization.error ?? "audit_case_checkout_denied", status, {
        passId: PASS4612_AUDIT_CHECKOUT_BINDING_ID,
        failClosed: auditCaseAuthorization.failClosed,
        boundary: PASS4612_AUDIT_CHECKOUT_BOUNDARY,
      });
    }
  }
  const paymentRail = normalizeVlmServicePaymentRail(body.paymentRail);
  const paymentReadiness = buildVlmServicePaymentRailReadiness({ product, paymentRail });
  let siteUrl: string;
  try {
    siteUrl = resolveCanonicalSiteOrigin({
      requestUrl: request.url,
      configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    });
  } catch {
    return jsonError("canonical_site_origin_unavailable", 503, { product });
  }
  const returnPath = buildVlmPaidReturnPath(context, `/${locale}`);
  const successContextParams = new URLSearchParams({
    vlm_service: product.id,
    product_cell: productCellGate.productCell.productCellId,
    return: returnPath,
    paymentRail,
  });
  if (context.surface && context.surface !== "unknown")
    successContextParams.set("surface", context.surface);
  if (context.assetId) successContextParams.set("assetId", context.assetId);
  if (context.symbol) successContextParams.set("symbol", context.symbol);
  if (context.depth) successContextParams.set("depth", context.depth);
  if (context.requestId)
    successContextParams.set("requestId", context.requestId);
  if (context.auditCaseRef)
    successContextParams.set("auditCaseRef", context.auditCaseRef);

  const readiness = serviceCheckoutReady();
  if (!readiness.enabled) {
    if (!isVlmLocalPaidAccessDemoEnabled()) {
      return jsonError("service_checkout_disabled", 503, {
        product,
        productionContract: readiness.productionContract,
      });
    }
    successContextParams.set("demo", "local-paid-access");
    const demoSessionId = `vlm_demo_${product.id}_${contextHash.slice(0, 16)}_${Date.now().toString(36)}`;
    let auditCaseBinding = null;
    if (isPaidAuditProduct(productId) && auditTier && account && context.auditCaseRef) {
      auditCaseBinding = await bindAuditCaseToCheckoutSession({
        caseRef: context.auditCaseRef,
        accountId: account.accountId,
        tier: auditTier,
        productId,
        stripeSessionId: demoSessionId,
        contextHash,
      });
      if (!auditCaseBinding.ok) return jsonError(auditCaseBinding.error ?? "audit_case_checkout_bind_failed", 409, auditCaseBinding);
    }
    const checkoutVerificationBinding =
      createVlmCheckoutVerificationBinding({
        sessionId: demoSessionId,
        productId,
        productCellId: productCellGate.productCell.productCellId,
        productCellBindingSha256: productCellGate.bindingSha256,
        accountIdHash,
        context,
      });
    if (!checkoutVerificationBinding.ok) {
      return jsonError(checkoutVerificationBinding.error, 503);
    }
    const demoUrl = `${siteUrl}/${locale}/checkout/success?session_id=${encodeURIComponent(demoSessionId)}&${successContextParams.toString()}`;
    return completePass4394ClientRequestJsonResponse({
      receipt: pass4394Idempotency,
      body: {
        ok: true,
        url: demoUrl,
        sessionId: demoSessionId,
        checkoutVerificationBindingToken: checkoutVerificationBinding.token,
        product,
        productCell: {
          productCellId: productCellGate.productCell.productCellId,
          productFamily: productCellGate.productCell.productFamily,
          surface: productCellGate.surface,
          tier: productCellGate.tier,
          bindingSha256: productCellGate.bindingSha256,
          derivedFromLegacy: productCellGate.derivedFromLegacy,
        },
        context,
        contextHash,
        auditCase: auditCaseBinding?.record ? {
          caseRef: auditCaseBinding.record.caseRef,
          status: auditCaseBinding.record.status,
          checkoutBound: Boolean(auditCaseBinding.record.checkoutSessionId),
        } : null,
        demoMode: "local_paid_access_demo",
        pass2362: {
          paymentRail: "local_demo_zero_euro",
          requestedRail: paymentRail,
          nextStep: "redirect_to_success_then_server_verify_writes_receipt_ledger",
          productionBoundary: "No live charge was created; production still requires Stripe-paid server receipt.",
        },
        pass4394Idempotency,
        pass2364: paymentReadiness,
        pass4145: buildPass4145ServerReceiptReplayGuard({
          productId: product.id,
          paymentRail: "local_demo_zero_euro",
          contextHash,
        }),
        warning:
          "Local development only. No live charge was created; production still requires Stripe-paid server receipt.",
        blockedLiveContract: readiness.productionContract,
      },
    });
  }

  const liveIdempotency = assessLiveCheckoutIdempotency(pass4394Idempotency);
  if (!liveIdempotency.ok) {
    return securityJson(
      {
        ok: false,
        error: liveIdempotency.code,
        retryable: liveIdempotency.retryable,
        retryWithNewClientRequestId: liveIdempotency.retryMode === "new_client_request_id",
        retryWithSameClientRequestId: liveIdempotency.retryMode === "same_client_request_id",
        idempotencyMode: liveIdempotency.storageMode,
      },
      {
        status: liveIdempotency.status,
        headers: {
          ...pass4394IdempotencyHeaders(pass4394Idempotency),
          "cache-control": "no-store",
          ...(liveIdempotency.status === 503 ? { "retry-after": "30" } : {}),
        },
      },
    );
  }

  if (paymentRail === "stripe_checkout_blik" && !paymentReadiness.enabledForStripeSession) {
    return jsonError("blik_checkout_not_ready", 503, { product, paymentReadiness });
  }

  const stripe = getStripeServerClient();
  const successUrl = `${siteUrl}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}&${successContextParams.toString()}`;
  const cancelUrl = new URL(returnPath, siteUrl).toString();

  const paymentIntentMetadata = {
    kind: "vlm_paid_access",
    productId: product.id,
    productCellId: productCellGate.productCell.productCellId,
    productCellBindingSha256: productCellGate.bindingSha256,
    auditCaseRef: context.auditCaseRef || "",
    auditTier: auditTier ?? "",
    contextHash,
    accountIdHash,
  };
  const stripeIdempotencyKey = `vlm_checkout_${createHash("sha256")
    .update([
      product.id,
      productCellGate.bindingSha256,
      accountIdHash,
      contextHash,
      pass4394Idempotency.idempotencyKeyHash ?? "missing",
    ].join("|"))
    .digest("hex")}`;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    payment_intent_data: { metadata: paymentIntentMetadata },
    success_url: successUrl,
    cancel_url: cancelUrl,
    billing_address_collection: "auto",
    ...(paymentReadiness.paymentMethodTypes ? { payment_method_types: paymentReadiness.paymentMethodTypes } : {}),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: paymentReadiness.stripeLineCurrency,
          unit_amount: paymentReadiness.stripeLineAmount,
          product_data: {
            name: product.label,
            description: product.description.slice(0, 320),
            metadata: {
              productId: product.id,
              productCellId: productCellGate.productCell.productCellId,
              productCellBindingSha256: productCellGate.bindingSha256,
              accessScope: product.accessScope,
              passId: PASS2024_VLM_PAID_ACCESS_ID,
              pass2364: PASS2364_STRIPE_BLIK_REPLAY_ID,
            },
          },
        },
      },
    ],
    metadata: {
      kind: "vlm_paid_access",
      productId: product.id,
      productCellId: productCellGate.productCell.productCellId,
      productCellFamily: productCellGate.productCell.productFamily,
      productCellBindingSha256: productCellGate.bindingSha256,
      locale,
      paymentRail,
      paymentRailPassId: PASS2364_STRIPE_BLIK_REPLAY_ID,
      originalCurrency: product.currency,
      originalAmount: String(product.amount),
      stripeLineCurrency: paymentReadiness.stripeLineCurrency,
      stripeLineAmount: String(paymentReadiness.stripeLineAmount),
      surface: context.surface,
      assetId: context.assetId || "",
      symbol: context.symbol || "",
      depth: context.depth || "",
      requestId: context.requestId || "",
      auditCaseRef: context.auditCaseRef || "",
      auditTier: auditTier || "",
      auditAccountIdHash: createHash("sha256").update(account.accountId).digest("hex").slice(0, 24),
      accountIdHash,
      returnPath,
      contextHash,
      context: compact(context),
      pass4394ClientRequestIdHash: pass4394Idempotency.clientRequestIdHash ?? "missing",
      pass4394IdempotencyKeyHash: pass4394Idempotency.idempotencyKeyHash ?? "missing",
      passId: PASS2024_VLM_PAID_ACCESS_ID,
    },
  };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: stripeIdempotencyKey,
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/checkout/vlm-service",
      code: "stripe_checkout_session_create_failed",
      status: 502,
      headers: {
        ...pass4394IdempotencyHeaders(pass4394Idempotency),
        "retry-after": "30",
      },
    });
  }

  let auditCaseBinding = null;
  if (isPaidAuditProduct(productId) && auditTier && account && context.auditCaseRef) {
    auditCaseBinding = await bindAuditCaseToCheckoutSession({
      caseRef: context.auditCaseRef,
      accountId: account.accountId,
      tier: auditTier,
      productId,
      stripeSessionId: session.id,
      contextHash,
    });
    if (!auditCaseBinding.ok) {
      let sessionExpired = false;
      let sessionExpireError: string | null = null;
      let sessionExpireCorrelationId: string | null = null;
      try {
        await stripe.checkout.sessions.expire(session.id);
        sessionExpired = true;
      } catch (error) {
        const reported = reportApiError(error, {
          route: "/api/checkout/vlm-service",
          code: "stripe_session_expire_failed",
          status: 502,
        });
        sessionExpireError = reported.publicCode;
        sessionExpireCorrelationId = reported.correlationId;
      }
      return jsonError(auditCaseBinding.error ?? "audit_case_checkout_bind_failed", 409, {
        passId: PASS4612_AUDIT_CHECKOUT_BINDING_ID,
        stripeRollback: { attempted: true, sessionExpired, error: sessionExpireError, correlationId: sessionExpireCorrelationId },
        boundary: PASS4612_AUDIT_CHECKOUT_BOUNDARY,
      });
    }
  }

  const checkoutVerificationBinding =
    createVlmCheckoutVerificationBinding({
      sessionId: session.id,
      productId,
      productCellId: productCellGate.productCell.productCellId,
      productCellBindingSha256: productCellGate.bindingSha256,
      accountIdHash,
      context,
    });
  if (!checkoutVerificationBinding.ok) {
    let sessionExpired = false;
    let sessionExpireError: string | null = null;
    let sessionExpireCorrelationId: string | null = null;
    try {
      await stripe.checkout.sessions.expire(session.id);
      sessionExpired = true;
    } catch (error) {
      const reported = reportApiError(error, {
        route: "/api/checkout/vlm-service",
        code: "stripe_session_expire_failed",
        status: 502,
      });
      sessionExpireError = reported.publicCode;
      sessionExpireCorrelationId = reported.correlationId;
    }
    return jsonError(checkoutVerificationBinding.error, 503, {
      stripeRollback: {
        attempted: true,
        sessionExpired,
        error: sessionExpireError,
        correlationId: sessionExpireCorrelationId,
      },
    });
  }

  if (!session.url) {
    let sessionExpired = false;
    let sessionExpireError: string | null = null;
    let sessionExpireCorrelationId: string | null = null;
    try {
      await stripe.checkout.sessions.expire(session.id);
      sessionExpired = true;
    } catch (error) {
      const reported = reportApiError(error, {
        route: "/api/checkout/vlm-service",
        code: "stripe_session_expire_failed",
        status: 502,
      });
      sessionExpireError = reported.publicCode;
      sessionExpireCorrelationId = reported.correlationId;
    }
    return securityJson(
      {
        ok: false,
        error: "stripe_session_missing_url",
        retryable: true,
        retryWithNewClientRequestId: true,
        stripeRollback: { attempted: true, sessionExpired, error: sessionExpireError, correlationId: sessionExpireCorrelationId },
      },
      {
        status: 502,
        headers: {
          ...pass4394IdempotencyHeaders(pass4394Idempotency),
          "cache-control": "no-store",
          "retry-after": "30",
        },
      },
    );
  }
  const mutationReceipt = await appendPass2178MutationReceipt({
    request,
    action: "vlm_service_checkout_session_created",
    targetType: "stripe_checkout_session",
    targetId: session.id,
    actorId: account.accountId,
    actorMode: "member",
    payload: {
      productId: product.id,
      productCellId: productCellGate.productCell.productCellId,
      productCellBindingSha256: productCellGate.bindingSha256,
      accessScope: product.accessScope,
      locale,
      surface: context.surface,
      contextHash,
      sessionId: session.id,
      auditCaseRef: context.auditCaseRef ?? null,
      auditCaseStatus: auditCaseBinding?.record?.status ?? null,
      pass4394State: pass4394Idempotency.state,
      pass4394ClientRequestIdHash: pass4394Idempotency.clientRequestIdHash,
      pass4394IdempotencyKeyHash: pass4394Idempotency.idempotencyKeyHash,
    },
    safeSummary:
      "VLM paid service checkout created a Stripe session and wrote a redacted PASS2178 mutation receipt.",
  });
  return completePass4394ClientRequestJsonResponse({
    receipt: pass4394Idempotency,
    body: {
      ok: true,
      url: session.url,
      sessionId: session.id,
      checkoutVerificationBindingToken: checkoutVerificationBinding.token,
      product,
      productCell: {
        productCellId: productCellGate.productCell.productCellId,
        productFamily: productCellGate.productCell.productFamily,
        surface: productCellGate.surface,
        tier: productCellGate.tier,
        bindingSha256: productCellGate.bindingSha256,
        derivedFromLegacy: productCellGate.derivedFromLegacy,
      },
      context,
      contextHash,
      auditCase: auditCaseBinding?.record ? {
        caseRef: auditCaseBinding.record.caseRef,
        status: auditCaseBinding.record.status,
        checkoutBound: Boolean(auditCaseBinding.record.checkoutSessionId),
        entitlementVerified: auditCaseBinding.record.entitlementVerified,
        analysisStarted: auditCaseBinding.record.analysisStarted,
        passId: PASS4612_AUDIT_CHECKOUT_BINDING_ID,
      } : null,
      mutationReceipt,
      pass4394Idempotency,
      pass2362: {
        paymentRail,
        nextStep: "checkout.session.completed_webhook_or_success_verify_writes_receipt_ledger",
        productionBoundary: "Audit Pro access, when invitation-authorized, requires a server-verified receipt; Advanced is not for sale.",
      },
      pass2364: paymentReadiness,
      pass4145: buildPass4145ServerReceiptReplayGuard({
        productId: product.id,
        paymentRail,
        contextHash,
        mutationReceiptId: mutationReceipt.receiptId,
        mutationReceiptPersisted: mutationReceipt.persisted,
      }),
    },
  });
}
