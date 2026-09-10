import type Stripe from "stripe";
import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import { writeOperationalEvent } from "@/lib/security/operational-log-boundary";
import {
  getVlmPaidProduct,
  normalizePaidContext,
  normalizeVlmPaidProductId,
  type VlmPaidAccessContext,
  type VlmPaidProductId,
} from "@/lib/commerce/vlm-paid-access";
import { getVlmCurrentSkuTruth, tierForVlmProductId } from "@/lib/commerce/vlm-current-sku-truth";
import {
  hashVlmPaidAccessContext,
  verifyVlmPaidAccessToken,
  type VlmPaidAccessTokenPayload,
} from "@/lib/commerce/vlm-paid-access-server";

export const PASS2025_VLM_ENTITLEMENT_LEDGER_ID = "pass2025-vlm-paid-entitlement-ledger-webhook-queue" as const;
export const PASS2223_ADVANCED_ENTITLEMENT_HARDENING_ID = "pass2223-advanced-entitlement-fail-closed-runtime" as const;
export const PASS2025_VLM_ENTITLEMENT_LEDGER_TASKS = 88 as const;
export const PASS2362_VLM_SERVICE_PAYMENT_ORCHESTRATOR_ID = "pass2362-vlm-service-payment-demo-stripe-human-review-queue" as const;

export type VlmPaidEntitlementStatus = "paid" | "active" | "expired" | "refunded" | "revoked" | "consumed";
export type VlmPaidEntitlementSource = "stripe_webhook" | "checkout_verify" | "manual_repair" | "local_demo_verify";

export type VlmPaidEntitlementRecord = {
  id: string;
  stripeSessionId: string;
  stripeCustomerId?: string | null;
  productId: VlmPaidProductId;
  accessScope: string;
  status: VlmPaidEntitlementStatus;
  contextHash: string;
  context: VlmPaidAccessContext;
  locale: VlmPaidAccessContext["locale"];
  amountTotal: number | null;
  currency: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  paymentStatus?: string | null;
  source: VlmPaidEntitlementSource;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  auditQueueId?: string | null;
};

export type VlmPaidEntitlementSessionWriteResult =
  | {
      ok: true;
      record: VlmPaidEntitlementRecord;
      persisted: boolean;
      mode: "durable" | "memory";
      idempotent: boolean;
      created: boolean;
    }
  | {
      ok: false;
      error: string;
      retryable: boolean;
      terminal: boolean;
      mode?: "durable" | "memory";
      record?: VlmPaidEntitlementRecord;
    };

export type VlmPaidAccessEntitlementVerdict =
  | {
      ok: true;
      payload: VlmPaidAccessTokenPayload;
      entitlement?: VlmPaidEntitlementRecord | null;
      ledgerMode: "durable" | "memory" | "token_only_non_production";
      warning?: string;
    }
  | {
      ok: false;
      error: string;
      tokenPayload?: VlmPaidAccessTokenPayload;
      ledgerMode?: "durable" | "memory" | "token_only_non_production";
    };

export type VlmPaidAccountEntitlementVerdict =
  | {
      ok: true;
      entitlement: VlmPaidEntitlementRecord;
      ledgerMode: "durable" | "memory";
    }
  | {
      ok: false;
      error: string;
      ledgerMode?: "durable" | "memory";
    };

type MemoryEntitlementKey = string;

const memoryEntitlements: Map<MemoryEntitlementKey, VlmPaidEntitlementRecord> =
  ((globalThis as unknown as Record<string, unknown>).__velmereMemoryEntitlements as Map<MemoryEntitlementKey, VlmPaidEntitlementRecord>)
  || new Map<MemoryEntitlementKey, VlmPaidEntitlementRecord>();
(globalThis as unknown as Record<string, unknown>).__velmereMemoryEntitlements = memoryEntitlements;

const memoryAuditQueue: Map<string, VlmPaidEntitlementRecord> =
  ((globalThis as unknown as Record<string, unknown>).__velmereMemoryAuditQueue as Map<string, VlmPaidEntitlementRecord>)
  || new Map<string, VlmPaidEntitlementRecord>();
(globalThis as unknown as Record<string, unknown>).__velmereMemoryAuditQueue = memoryAuditQueue;

function nowIso(now = new Date()) {
  return now.toISOString();
}

function safeId(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9:_-]+/g, "-").slice(0, 180);
}

function entitlementKey(args: { stripeSessionId: string; productId: VlmPaidProductId; contextHash: string }) {
  return `${args.stripeSessionId}:${args.productId}:${args.contextHash}`;
}

const TERMINAL_ENTITLEMENT_STATUSES = new Set<VlmPaidEntitlementStatus>([
  "expired",
  "refunded",
  "revoked",
  "consumed",
]);
const TERMINAL_PAYMENT_STATUSES = new Set([
  "refunded",
  "revoked",
  "disputed",
  "chargeback",
  "hold",
]);

export function resolveVlmPaidEntitlementSessionWrite(args: {
  existing: VlmPaidEntitlementRecord | null;
  candidate: VlmPaidEntitlementRecord;
  releaseHoldBlocked?: boolean;
  now?: Date;
}): VlmPaidEntitlementSessionWriteResult {
  if (!args.existing) {
    return {
      ok: true,
      record: args.candidate,
      persisted: false,
      mode: "memory",
      idempotent: false,
      created: true,
    };
  }

  const existing = args.existing;
  const paymentStatus = existing.paymentStatus?.trim().toLowerCase() ?? "";
  const expiry = Date.parse(existing.expiresAt);
  const expired = !Number.isFinite(expiry) || expiry <= (args.now ?? new Date()).getTime();
  if (
    args.releaseHoldBlocked === true ||
    TERMINAL_ENTITLEMENT_STATUSES.has(existing.status) ||
    TERMINAL_PAYMENT_STATUSES.has(paymentStatus) ||
    expired
  ) {
    return {
      ok: false,
      error: args.releaseHoldBlocked === true
        ? "entitlement_release_hold"
        : expired || existing.status === "expired"
          ? "entitlement_expired"
          : "entitlement_terminal_state",
      retryable: false,
      terminal: true,
      mode: "memory",
      record: existing,
    };
  }

  // A Checkout Session is single-use evidence. Re-verification is a read of the
  // original entitlement; it must not refresh TTL, status, queue, or ownership.
  return {
    ok: true,
    record: existing,
    persisted: false,
    mode: "memory",
    idempotent: true,
    created: false,
  };
}


export function requiresDurableVlmPaidEntitlementLedger() {
  const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  // PASS2223: production must fail closed. An accidental VELMERE_REQUIRE_PAID_ENTITLEMENT_LEDGER=false
  // must never make paid Advanced depend on a local token-only fallback in Vercel/production.
  if (productionLike) return true;
  const explicit = process.env.VELMERE_REQUIRE_PAID_ENTITLEMENT_LEDGER;
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return false;
}

export function getVlmPaidEntitlementRuntimeMode() {
  return {
    durableRequired: requiresDurableVlmPaidEntitlementLedger(),
    supabaseConfigured: hasSupabaseServiceRoleConfig(),
    tokenOnlyFallbackAllowed: !requiresDurableVlmPaidEntitlementLedger() && !hasSupabaseServiceRoleConfig(),
    memoryFallbackAllowed: !requiresDurableVlmPaidEntitlementLedger(),
  };
}

function resolvePaidAccessTtlMs() {
  const raw = Number(process.env.VELMERE_PAID_ACCESS_TTL_MS);
  if (Number.isFinite(raw) && raw >= 1000 * 60 * 10 && raw <= 1000 * 60 * 60 * 24 * 365) return raw;
  return 1000 * 60 * 60 * 24 * 30;
}

function customerIdFromSession(session: Stripe.Checkout.Session) {
  if (!session.customer) return null;
  return typeof session.customer === "string" ? session.customer : session.customer.id;
}

function buildContextFromSession(session: Stripe.Checkout.Session): VlmPaidAccessContext | null {
  const locale = session.metadata?.locale === "pl" || session.metadata?.locale === "de" || session.metadata?.locale === "en"
    ? session.metadata.locale
    : "en";
  const surface = session.metadata?.surface as VlmPaidAccessContext["surface"] | undefined;
  const depth = session.metadata?.depth as VlmPaidAccessContext["depth"] | undefined;
  return normalizePaidContext({
    surface,
    locale,
    assetId: session.metadata?.assetId || undefined,
    symbol: session.metadata?.symbol || undefined,
    depth,
    requestId: session.metadata?.requestId || undefined,
    auditCaseRef: session.metadata?.auditCaseRef || undefined,
    accountIdHash: session.metadata?.accountIdHash || undefined,
    returnPath: session.metadata?.returnPath || undefined,
  }, locale);
}

function statusFromSession(session: Stripe.Checkout.Session): VlmPaidEntitlementStatus {
  if (session.payment_status === "paid") return "active";
  return "paid";
}

function buildMemoryRecord(args: {
  session: Stripe.Checkout.Session;
  productId: VlmPaidProductId;
  context: VlmPaidAccessContext;
  source: VlmPaidEntitlementSource;
  now?: Date;
}): VlmPaidEntitlementRecord {
  const now = args.now ?? new Date();
  const contextHash = hashVlmPaidAccessContext(args.context);
  const product = getVlmPaidProduct(args.productId, args.context.locale);
  const expiresAt = new Date(now.getTime() + resolvePaidAccessTtlMs()).toISOString();
  return {
    id: safeId(`vlm_entitlement_${args.session.id}_${args.productId}_${contextHash.slice(0, 12)}`),
    stripeSessionId: args.session.id,
    stripeCustomerId: customerIdFromSession(args.session),
    productId: args.productId,
    accessScope: product.accessScope,
    status: statusFromSession(args.session),
    contextHash,
    context: args.context,
    locale: args.context.locale,
    amountTotal: args.session.amount_total ?? null,
    currency: args.session.currency?.toUpperCase() ?? null,
    customerEmail: args.session.customer_details?.email ?? null,
    customerName: args.session.customer_details?.name ?? null,
    paymentStatus: args.session.payment_status,
    source: args.source,
    createdAt: nowIso(now),
    updatedAt: nowIso(now),
    expiresAt,
    auditQueueId: args.productId === "vlm_advanced_audit_human_review" || args.productId === "vlm_pro_audit_review"
      ? safeId(`vlm_audit_queue_${args.session.id}_${contextHash.slice(0, 12)}`)
      : null,
  };
}

function expectedPaidSessionPrice(session: Stripe.Checkout.Session, productId: VlmPaidProductId, locale: VlmPaidAccessContext["locale"]) {
  const product = getVlmPaidProduct(productId, locale);
  if (session.metadata?.paymentRail !== "stripe_checkout_blik") {
    return { amount: product.amount, currency: product.currency };
  }

  const originalAmount = Number(session.metadata.originalAmount);
  const stripeLineAmount = Number(session.metadata.stripeLineAmount);
  const originalCurrency = session.metadata.originalCurrency?.trim().toLowerCase();
  const stripeLineCurrency = session.metadata.stripeLineCurrency?.trim().toLowerCase();
  if (
    !Number.isInteger(originalAmount)
    || originalAmount !== product.amount
    || originalCurrency !== product.currency
    || !Number.isInteger(stripeLineAmount)
    || stripeLineAmount <= 0
    || stripeLineCurrency !== "pln"
  ) return null;
  return { amount: stripeLineAmount, currency: stripeLineCurrency };
}

function shouldAcceptSession(session: Stripe.Checkout.Session, productId?: VlmPaidProductId, locale: VlmPaidAccessContext["locale"] = "en") {
  if (session.metadata?.kind !== "vlm_paid_access" || session.payment_status !== "paid") return false;
  if (!productId) return true;
  const expected = expectedPaidSessionPrice(session, productId, locale);
  if (!expected) return false;
  const sessionCurrency = typeof session.currency === "string" ? session.currency.toLowerCase() : "";
  // PASS2784: a receipt is not valid only because Stripe says paid. It must match
  // the server-authored checkout line amount/currency so a cheaper, wrong, or
  // client-asserted session cannot unlock Pro/Advanced evidence. BLIK uses the
  // immutable PLN line metadata written by the checkout route and also binds the
  // original canonical EUR product price.
  return session.amount_total === expected.amount && sessionCurrency === expected.currency;
}

function explainRejectedPaidSession(session: Stripe.Checkout.Session, productId?: VlmPaidProductId, locale: VlmPaidAccessContext["locale"] = "en") {
  if (session.metadata?.kind !== "vlm_paid_access") return "invalid_vlm_paid_session_kind";
  if (session.payment_status !== "paid") return "payment_not_confirmed";
  if (!productId) return "invalid_vlm_paid_product";
  const expected = expectedPaidSessionPrice(session, productId, locale);
  if (!expected) return "payment_line_metadata_invalid";
  const sessionCurrency = typeof session.currency === "string" ? session.currency.toLowerCase() : "";
  if (session.amount_total !== expected.amount) return "amount_mismatch";
  if (sessionCurrency !== expected.currency) return "currency_mismatch";
  return "payment_not_confirmed";
}


function parseDurableSessionWrite(data: unknown): VlmPaidEntitlementSessionWriteResult {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return {
      ok: false,
      error: "entitlement_session_write_invalid_result",
      retryable: true,
      terminal: false,
      mode: "durable",
    };
  }
  const value = row as Record<string, unknown>;
  const record = value.id ? entitlementRecordFromRow(value) : undefined;
  if (value.ok !== true) {
    return {
      ok: false,
      error: typeof value.error === "string" && value.error
        ? value.error.slice(0, 120)
        : "entitlement_session_write_rejected",
      retryable: Boolean(value.retryable),
      terminal: Boolean(value.terminal),
      mode: "durable",
      record,
    };
  }
  if (!record?.id || !record.stripeSessionId || !record.contextHash) {
    return {
      ok: false,
      error: "entitlement_session_write_invalid_result",
      retryable: true,
      terminal: false,
      mode: "durable",
    };
  }
  return {
    ok: true,
    record,
    persisted: true,
    mode: "durable",
    idempotent: Boolean(value.idempotent),
    created: Boolean(value.created),
  };
}

async function persistEntitlementToSupabase(
  record: VlmPaidEntitlementRecord,
): Promise<VlmPaidEntitlementSessionWriteResult> {
  try {
    const { data } = await runRegisteredServiceRoleRpc({
      operation: "vlm_paid_entitlement_create_or_read",
      args: {
        p_id: record.id,
        p_stripe_session_id: record.stripeSessionId,
        p_stripe_customer_id: record.stripeCustomerId ?? null,
        p_product_id: record.productId,
        p_access_scope: record.accessScope,
        p_context_hash: record.contextHash,
        p_context: record.context,
        p_locale: record.locale,
        p_amount_total: record.amountTotal,
        p_currency: record.currency,
        p_customer_email: record.customerEmail ?? null,
        p_customer_name: record.customerName ?? null,
        p_payment_status: record.paymentStatus ?? null,
        p_source: record.source,
        p_audit_queue_id: record.auditQueueId ?? null,
        p_expires_at: record.expiresAt,
        p_created_at: record.createdAt,
      },
    });
    return parseDurableSessionWrite(data);
  } catch {
    return {
      ok: false,
      error: "entitlement_session_write_failed",
      retryable: true,
      terminal: false,
      mode: "durable",
    };
  }
}


function buildRecordFromVerifiedReceipt(args: {
  sessionId: string;
  productId: VlmPaidProductId;
  context: VlmPaidAccessContext;
  source: VlmPaidEntitlementSource;
  amountTotal?: number | null;
  currency?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  paymentStatus?: string | null;
  now?: Date;
}): VlmPaidEntitlementRecord {
  const now = args.now ?? new Date();
  const contextHash = hashVlmPaidAccessContext(args.context);
  const product = getVlmPaidProduct(args.productId, args.context.locale);
  const expiresAt = new Date(now.getTime() + resolvePaidAccessTtlMs()).toISOString();
  return {
    id: safeId(`vlm_entitlement_${args.sessionId}_${args.productId}_${contextHash.slice(0, 12)}`),
    stripeSessionId: args.sessionId,
    stripeCustomerId: null,
    productId: args.productId,
    accessScope: product.accessScope,
    status: "active",
    contextHash,
    context: args.context,
    locale: args.context.locale,
    amountTotal: args.amountTotal ?? product.amount ?? null,
    currency: (args.currency || product.currency || "eur").toUpperCase(),
    customerEmail: args.customerEmail ?? null,
    customerName: args.customerName ?? null,
    paymentStatus: args.paymentStatus ?? "paid",
    source: args.source,
    createdAt: nowIso(now),
    updatedAt: nowIso(now),
    expiresAt,
    auditQueueId: args.productId === "vlm_advanced_audit_human_review" || args.productId === "vlm_pro_audit_review"
      ? safeId(`vlm_audit_queue_${args.sessionId}_${contextHash.slice(0, 12)}`)
      : null,
  };
}

async function persistVerifiedEntitlementRecord(
  record: VlmPaidEntitlementRecord,
): Promise<VlmPaidEntitlementSessionWriteResult> {
  const key = entitlementKey({ stripeSessionId: record.stripeSessionId, productId: record.productId, contextHash: record.contextHash });

  if (!hasSupabaseServiceRoleConfig()) {
    if (requiresDurableVlmPaidEntitlementLedger()) {
      throw new Error("vlm_paid_entitlement_service_role_unavailable");
    }
    const decision = resolveVlmPaidEntitlementSessionWrite({
      existing: memoryEntitlements.get(key) ?? null,
      candidate: record,
      now: new Date(record.updatedAt),
    });
    if (!decision.ok) return decision;
    if (decision.created) {
      memoryEntitlements.set(key, decision.record);
      if (decision.record.auditQueueId) {
        memoryAuditQueue.set(decision.record.auditQueueId, decision.record);
      }
    }
    writeOperationalEvent({
      level: "warn",
      system: "velmere.vlm.paid_entitlement",
      event: "entitlement_memory_fallback",
      code: "durable_storage_missing",
      metrics: {
        persisted: false,
        mode: "memory_fallback",
        passId: PASS2362_VLM_SERVICE_PAYMENT_ORCHESTRATOR_ID,
        status: record.status,
        source: record.source,
      },
      identifiers: {
        stripeSession: record.stripeSessionId,
        product: record.productId,
        context: record.contextHash,
        customerEmail: record.customerEmail ?? "",
        auditQueue: record.auditQueueId ?? "",
      },
    });
    return { ...decision, persisted: false, mode: "memory" };
  }

  return persistEntitlementToSupabase(record);
}

export async function upsertVlmPaidEntitlementFromDemoReceipt(args: {
  sessionId: string;
  productId: VlmPaidProductId;
  context: Partial<VlmPaidAccessContext>;
  customerEmail?: string | null;
  customerName?: string | null;
  now?: Date;
}) {
  const normalizedContext = normalizePaidContext(args.context, args.context.locale);
  const safeSessionId = args.sessionId.trim().slice(0, 120);
  if (!safeSessionId.startsWith("vlm_demo_")) {
    return { ok: false as const, error: "invalid_demo_receipt" };
  }
  const record = buildRecordFromVerifiedReceipt({
    sessionId: safeSessionId,
    productId: args.productId,
    context: normalizedContext,
    source: "local_demo_verify",
    customerEmail: args.customerEmail ?? null,
    customerName: args.customerName ?? null,
    paymentStatus: "paid",
    now: args.now,
  });
  return persistVerifiedEntitlementRecord(record);
}

export async function upsertVlmPaidEntitlementFromStripeSession(
  session: Stripe.Checkout.Session,
  source: VlmPaidEntitlementSource,
) {
  const productId = normalizeVlmPaidProductId(session.metadata?.productId);
  const context = buildContextFromSession(session);
  if (!productId || !context) {
    return {
      ok: false as const,
      error: "invalid_vlm_paid_session",
      retryable: false,
      terminal: true,
    };
  }

  // P33 paid-readiness hardening: Stripe evidence can never mint an entitlement
  // for a SKU whose current commercial authority has no public checkout.
  // Invitation-only Pro access is provisioned by a separate server-controlled
  // beta workflow; Advanced remains NOT_FOR_SALE. A valid Stripe signature or
  // a matching amount is not permission to override current SKU truth.
  const currentTier = tierForVlmProductId(productId);
  if (currentTier) {
    const skuTruth = getVlmCurrentSkuTruth(currentTier, context.locale);
    if (!skuTruth.publicCheckoutAllowed || !skuTruth.saleEnabled || skuTruth.publicPrice === null) {
      return {
        ok: false as const,
        error: currentTier === "advanced"
          ? "product_not_for_sale"
          : "public_checkout_disabled_invitation_only",
        retryable: false,
        terminal: true,
      };
    }
  }

  if (!shouldAcceptSession(session, productId, context.locale)) {
    return {
      ok: false as const,
      error: explainRejectedPaidSession(session, productId, context.locale),
      retryable: false,
      terminal: true,
    };
  }

  const expectedContextHash = hashVlmPaidAccessContext(context);
  const metadataContextHash = typeof session.metadata?.contextHash === "string" ? session.metadata.contextHash.trim() : "";
  if (metadataContextHash && metadataContextHash !== expectedContextHash) {
    return {
      ok: false as const,
      error: "context_hash_mismatch",
      expectedContextHash,
      metadataContextHash,
      retryable: false as const,
      terminal: true as const,
    };
  }

  const record = buildMemoryRecord({ session, productId, context, source });
  return persistVerifiedEntitlementRecord(record);
}

async function findDurableEntitlement(args: { sessionId: string; productId: VlmPaidProductId; contextHash: string }) {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("velmere_vlm_paid_entitlements")
    .select("*")
    .eq("stripe_session_id", args.sessionId)
    .eq("product_id", args.productId)
    .eq("context_hash", args.contextHash)
    .in("status", ["paid", "active"])
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    stripeSessionId: data.stripe_session_id,
    stripeCustomerId: data.stripe_customer_id,
    productId: data.product_id,
    accessScope: data.access_scope,
    status: data.status,
    contextHash: data.context_hash,
    context: data.context,
    locale: data.locale,
    amountTotal: data.amount_total,
    currency: data.currency,
    customerEmail: data.customer_email,
    customerName: data.customer_name,
    paymentStatus: data.payment_status,
    source: data.source,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    expiresAt: data.expires_at,
    auditQueueId: data.audit_queue_id ?? null,
  } as VlmPaidEntitlementRecord;
}

async function findDurableEntitlementByAccountContext(args: {
  productId: VlmPaidProductId;
  contextHash: string;
  accountIdHash: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("velmere_vlm_paid_entitlements")
    .select("*")
    .eq("product_id", args.productId)
    .eq("context_hash", args.contextHash)
    .in("status", ["paid", "active"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const record = entitlementRecordFromRow(data as Record<string, unknown>);
  if (record.context.accountIdHash !== args.accountIdHash) return null;
  return record;
}

export async function verifyVlmPaidAccountEntitlement(args: {
  productId: VlmPaidProductId;
  context: Partial<VlmPaidAccessContext>;
  now?: Date;
}): Promise<VlmPaidAccountEntitlementVerdict> {
  const normalizedContext = normalizePaidContext(args.context, args.context.locale);
  const accountIdHash = normalizedContext.accountIdHash?.trim().toLowerCase() ?? "";
  if (!/^[a-f0-9]{64}$/.test(accountIdHash)) {
    return { ok: false, error: "entitlement_account_binding_required" };
  }
  const contextHash = hashVlmPaidAccessContext(normalizedContext);
  const runtimeMode = getVlmPaidEntitlementRuntimeMode();
  const now = (args.now ?? new Date()).getTime();

  if (hasSupabaseServiceRoleConfig()) {
    try {
      const durable = await findDurableEntitlementByAccountContext({
        productId: args.productId,
        contextHash,
        accountIdHash,
      });
      if (durable) {
        const expiresAt = Date.parse(durable.expiresAt);
        if (!Number.isFinite(expiresAt) || expiresAt <= now) {
          return { ok: false, error: "entitlement_expired", ledgerMode: "durable" };
        }
        return { ok: true, entitlement: durable, ledgerMode: "durable" };
      }
      if (runtimeMode.durableRequired) {
        return { ok: false, error: "durable_entitlement_not_found", ledgerMode: "durable" };
      }
    } catch {
      if (runtimeMode.durableRequired) {
        return { ok: false, error: "durable_entitlement_lookup_failed", ledgerMode: "durable" };
      }
    }
  }

  if (runtimeMode.durableRequired) {
    return { ok: false, error: "durable_entitlement_ledger_required" };
  }

  const candidates = Array.from(memoryEntitlements.values())
    .filter((record) =>
      record.productId === args.productId
      && record.context.accountIdHash === accountIdHash
      && (
        record.contextHash === contextHash
        || (!record.context.assetId && !record.context.auditCaseRef)
        || (record.context.assetId && record.context.assetId === normalizedContext.assetId)
        || (record.context.symbol && record.context.symbol.toUpperCase() === normalizedContext.symbol?.toUpperCase())
      )
      && (record.status === "paid" || record.status === "active"),
    )
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const memory = candidates[0] ?? null;
  if (!memory) return { ok: false, error: "memory_entitlement_not_found", ledgerMode: "memory" };
  const expiresAt = Date.parse(memory.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return { ok: false, error: "entitlement_expired", ledgerMode: "memory" };
  }
  return { ok: true, entitlement: memory, ledgerMode: "memory" };
}

export async function verifyVlmPaidAccessEntitlement(args: {
  token: string | null | undefined;
  productId: VlmPaidProductId;
  context: Partial<VlmPaidAccessContext>;
  now?: Date;
}): Promise<VlmPaidAccessEntitlementVerdict> {
  const tokenVerdict = verifyVlmPaidAccessToken(args);
  if (!tokenVerdict.ok) return { ok: false, error: tokenVerdict.error };

  const contextHash = hashVlmPaidAccessContext(args.context);
  const lookup = { sessionId: tokenVerdict.payload.sessionId, productId: args.productId, contextHash };
  const runtimeMode = getVlmPaidEntitlementRuntimeMode();
  const now = (args.now ?? new Date()).getTime();

  if (hasSupabaseServiceRoleConfig()) {
    try {
      const durable = await findDurableEntitlement(lookup);
      if (durable && Date.parse(durable.expiresAt) > now) {
        return { ok: true, payload: tokenVerdict.payload, entitlement: durable, ledgerMode: "durable" };
      }
      if (runtimeMode.durableRequired) {
        return { ok: false, error: "durable_entitlement_not_found", tokenPayload: tokenVerdict.payload, ledgerMode: "durable" };
      }
    } catch {
      // PASS2223: never accept token-only Advanced when the durable ledger is configured but unavailable.
      return { ok: false, error: "durable_entitlement_lookup_failed", tokenPayload: tokenVerdict.payload, ledgerMode: "durable" };
    }
  }

  if (runtimeMode.durableRequired) {
    return { ok: false, error: "durable_entitlement_ledger_required", tokenPayload: tokenVerdict.payload, ledgerMode: "durable" };
  }

  const memory = memoryEntitlements.get(entitlementKey({ stripeSessionId: lookup.sessionId, productId: lookup.productId, contextHash: lookup.contextHash }));
  if (memory) {
    const expiresAt = Date.parse(memory.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      return { ok: false, error: "entitlement_expired", tokenPayload: tokenVerdict.payload, ledgerMode: "memory" };
    }
    if (memory.status === "paid" || memory.status === "active") {
      return { ok: true, payload: tokenVerdict.payload, entitlement: memory, ledgerMode: "memory" };
    }
    return { ok: false, error: "entitlement_inactive", tokenPayload: tokenVerdict.payload, ledgerMode: "memory" };
  }

  return {
    ok: true,
    payload: tokenVerdict.payload,
    entitlement: null,
    ledgerMode: "token_only_non_production",
    warning: "No Supabase entitlement ledger is configured; signed token accepted only in non-production fallback mode. Production and Vercel production require a durable ledger.",
  };
}


export function findMemoryVlmPaidEntitlementById(entitlementId: string) {
  const safe = entitlementId.trim();
  if (!safe) return null;
  for (const record of memoryEntitlements.values()) {
    if (record.id === safe) return record;
  }
  return null;
}

export function updateMemoryVlmPaidEntitlementStatus(args: {
  entitlementId: string;
  status: VlmPaidEntitlementStatus;
  now?: Date;
}) {
  const current = findMemoryVlmPaidEntitlementById(args.entitlementId);
  if (!current) return null;
  const next = { ...current, status: args.status, updatedAt: nowIso(args.now ?? new Date()) };
  memoryEntitlements.set(entitlementKey({
    stripeSessionId: current.stripeSessionId,
    productId: current.productId,
    contextHash: current.contextHash,
  }), next);
  return next;
}

export function getMemoryVlmPaidEntitlements() {
  return Array.from(memoryEntitlements.values());
}

export function seedMemoryEntitlementRecord(record: VlmPaidEntitlementRecord) {
  const key = entitlementKey({
    stripeSessionId: record.stripeSessionId,
    productId: record.productId,
    contextHash: record.contextHash,
  });
  memoryEntitlements.set(key, record);
  return record;
}

export function clearMemoryEntitlements() {
  memoryEntitlements.clear();
  memoryAuditQueue.clear();
}

export function getMemoryVlmAuditHumanQueue() {
  return Array.from(memoryAuditQueue.values());
}

export type VlmPaidEntitlementByIdVerdict =
  | { ok: true; entitlement: VlmPaidEntitlementRecord; ledgerMode: "durable" | "memory" }
  | { ok: false; error: string; ledgerMode?: "durable" | "memory" };

function entitlementRecordFromRow(data: Record<string, unknown>): VlmPaidEntitlementRecord {
  const nullableString = (value: unknown) => typeof value === "string" ? value : null;
  const nullableNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
  return {
    id: String(data.id ?? ""),
    stripeSessionId: String(data.stripe_session_id ?? ""),
    stripeCustomerId: nullableString(data.stripe_customer_id),
    productId: data.product_id as VlmPaidProductId,
    accessScope: String(data.access_scope ?? ""),
    status: data.status as VlmPaidEntitlementStatus,
    contextHash: String(data.context_hash ?? ""),
    context: data.context as VlmPaidAccessContext,
    locale: data.locale as VlmPaidAccessContext["locale"],
    amountTotal: nullableNumber(data.amount_total),
    currency: nullableString(data.currency),
    customerEmail: nullableString(data.customer_email),
    customerName: nullableString(data.customer_name),
    paymentStatus: nullableString(data.payment_status),
    source: data.source as VlmPaidEntitlementSource,
    createdAt: String(data.created_at ?? ""),
    updatedAt: String(data.updated_at ?? ""),
    expiresAt: String(data.expires_at ?? ""),
    auditQueueId: nullableString(data.audit_queue_id),
  };
}



export async function readVlmPaidEntitlementForOperations(entitlementIdInput: string): Promise<
  | { ok: true; entitlement: VlmPaidEntitlementRecord; ledgerMode: "durable" | "memory" }
  | { ok: false; error: string; retryable: boolean; ledgerMode?: "durable" | "memory" }
> {
  const entitlementId = entitlementIdInput.trim().slice(0, 180);
  if (!entitlementId) return { ok: false, error: "invalid_entitlement_lookup", retryable: false };

  if (hasSupabaseServiceRoleConfig()) {
    const supabase = getSupabaseServiceRoleClient();
    if (!supabase) return { ok: false, error: "durable_entitlement_lookup_failed", retryable: true, ledgerMode: "durable" };
    try {
      const { data, error } = await supabase
        .from("velmere_vlm_paid_entitlements")
        .select("*")
        .eq("id", entitlementId)
        .maybeSingle();
      if (error) return { ok: false, error: "durable_entitlement_lookup_failed", retryable: true, ledgerMode: "durable" };
      if (!data) return { ok: false, error: "entitlement_not_found", retryable: false, ledgerMode: "durable" };
      return { ok: true, entitlement: entitlementRecordFromRow(data as Record<string, unknown>), ledgerMode: "durable" };
    } catch {
      return { ok: false, error: "durable_entitlement_lookup_failed", retryable: true, ledgerMode: "durable" };
    }
  }

  if (requiresDurableVlmPaidEntitlementLedger()) {
    return { ok: false, error: "durable_entitlement_ledger_required", retryable: true, ledgerMode: "durable" };
  }
  const memory = findMemoryVlmPaidEntitlementById(entitlementId);
  if (!memory) return { ok: false, error: "entitlement_not_found", retryable: false, ledgerMode: "memory" };
  return { ok: true, entitlement: memory, ledgerMode: "memory" };
}

export async function findVlmPaidEntitlementByStripeBinding(args: {
  stripeSessionId: string;
  productId: VlmPaidProductId;
  contextHash: string;
}): Promise<
  | { ok: true; entitlement: VlmPaidEntitlementRecord; ledgerMode: "durable" | "memory" }
  | { ok: false; error: string; retryable: boolean; ledgerMode?: "durable" | "memory" }
> {
  const stripeSessionId = args.stripeSessionId.trim().slice(0, 180);
  const contextHash = args.contextHash.trim().toLowerCase();
  if (!stripeSessionId || !normalizeVlmPaidProductId(args.productId) || !/^[a-f0-9]{64}$/.test(contextHash)) {
    return { ok: false, error: "invalid_entitlement_binding_lookup", retryable: false };
  }

  if (hasSupabaseServiceRoleConfig()) {
    const supabase = getSupabaseServiceRoleClient();
    if (!supabase) return { ok: false, error: "durable_entitlement_lookup_failed", retryable: true, ledgerMode: "durable" };
    try {
      const { data, error } = await supabase
        .from("velmere_vlm_paid_entitlements")
        .select("*")
        .eq("stripe_session_id", stripeSessionId)
        .eq("product_id", args.productId)
        .eq("context_hash", contextHash)
        .maybeSingle();
      if (error) return { ok: false, error: "durable_entitlement_lookup_failed", retryable: true, ledgerMode: "durable" };
      if (!data) return { ok: false, error: "entitlement_not_found", retryable: false, ledgerMode: "durable" };
      return { ok: true, entitlement: entitlementRecordFromRow(data as Record<string, unknown>), ledgerMode: "durable" };
    } catch {
      return { ok: false, error: "durable_entitlement_lookup_failed", retryable: true, ledgerMode: "durable" };
    }
  }

  if (requiresDurableVlmPaidEntitlementLedger()) {
    return { ok: false, error: "durable_entitlement_ledger_required", retryable: true, ledgerMode: "durable" };
  }

  const memory = memoryEntitlements.get(entitlementKey({ stripeSessionId, productId: args.productId, contextHash }));
  if (!memory) return { ok: false, error: "entitlement_not_found", retryable: false, ledgerMode: "memory" };
  return { ok: true, entitlement: memory, ledgerMode: "memory" };
}

export async function verifyVlmPaidEntitlementById(args: {
  entitlementId: string;
  allowedProductIds: VlmPaidProductId[];
  accountIdHash: string;
  auditCaseRef?: string | null;
  assetId?: string | null;
  symbol?: string | null;
  now?: Date;
}): Promise<VlmPaidEntitlementByIdVerdict> {
  const entitlementId = args.entitlementId.trim().slice(0, 180);
  const accountIdHash = args.accountIdHash.trim().toLowerCase();
  if (!entitlementId || !/^[a-f0-9]{64}$/.test(accountIdHash) || args.allowedProductIds.length === 0) {
    return { ok: false, error: "invalid_entitlement_lookup" };
  }
  const nowMs = (args.now ?? new Date()).getTime();
  const validate = (record: VlmPaidEntitlementRecord, mode: "durable" | "memory"): VlmPaidEntitlementByIdVerdict => {
    if (!args.allowedProductIds.includes(record.productId)) return { ok: false, error: "entitlement_product_mismatch", ledgerMode: mode };
    if (record.status !== "active" && record.status !== "paid") return { ok: false, error: "entitlement_inactive", ledgerMode: mode };
    if (!Number.isFinite(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt) <= nowMs) return { ok: false, error: "entitlement_expired", ledgerMode: mode };
    if (record.context.accountIdHash !== accountIdHash) return { ok: false, error: "entitlement_account_mismatch", ledgerMode: mode };
    if (args.auditCaseRef && record.context.auditCaseRef !== args.auditCaseRef) return { ok: false, error: "entitlement_audit_case_mismatch", ledgerMode: mode };
    if (args.assetId && record.context.assetId !== args.assetId) return { ok: false, error: "entitlement_asset_mismatch", ledgerMode: mode };
    if (args.symbol && record.context.symbol?.toUpperCase() !== args.symbol.toUpperCase()) return { ok: false, error: "entitlement_symbol_mismatch", ledgerMode: mode };
    return { ok: true, entitlement: record, ledgerMode: mode };
  };

  if (hasSupabaseServiceRoleConfig()) {
    const supabase = getSupabaseServiceRoleClient();
    if (!supabase) return { ok: false, error: "durable_entitlement_lookup_failed", ledgerMode: "durable" };
    try {
      const { data, error } = await supabase.from("velmere_vlm_paid_entitlements").select("*").eq("id", entitlementId).maybeSingle();
      if (!error && data) {
        return validate(entitlementRecordFromRow(data as Record<string, unknown>), "durable");
      }
      if (requiresDurableVlmPaidEntitlementLedger()) {
        if (error) return { ok: false, error: "durable_entitlement_lookup_failed", ledgerMode: "durable" };
        return { ok: false, error: "durable_entitlement_not_found", ledgerMode: "durable" };
      }
    } catch {
      if (requiresDurableVlmPaidEntitlementLedger()) {
        return { ok: false, error: "durable_entitlement_lookup_failed", ledgerMode: "durable" };
      }
    }
  }

  if (requiresDurableVlmPaidEntitlementLedger()) {
    return { ok: false, error: "durable_entitlement_ledger_required", ledgerMode: "durable" };
  }
  const memory = Array.from(memoryEntitlements.values()).find((record) => record.id === entitlementId);
  if (!memory) return { ok: false, error: "entitlement_not_found", ledgerMode: "memory" };
  return validate(memory, "memory");
}
