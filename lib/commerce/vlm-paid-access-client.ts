"use client";

import { fetchWithDeadline, readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { assertCheckoutRedirectUrl } from "@/lib/security/navigation-redirect-boundary";
import { createBrowserSecureId } from "@/lib/runtime/browser-secure-id";

import {
  buildVlmPaidAccessStorageKey,
  buildVlmPaidReturnPath,
  getVlmPaidProduct,
  normalizePaidContext,
  type VlmPaidAccessContext,
  type VlmPaidProductId,
} from "@/lib/commerce/vlm-paid-access";
import {
  Pass35PaidUiStopSellError,
  resolvePass35PaidUiStopSell,
} from "@/lib/commerce/pass35-paid-ui-stop-sell";

const PASS2259_PENDING_KEY = "velmere.vlm-paid-access.pending-checkout";
const PASS2259_LAST_SUCCESS_KEY = "velmere.vlm-paid-access.last-success";
const PASS2263_PENDING_TTL_MS = 1000 * 60 * 60 * 2;
const PASS36_SERVER_ACCOUNT_ENTITLEMENT_MARKER = "server-account-entitlement";
const LEGACY_PAID_ACCESS_PREFIX = "velmere.paid-access.";
const memorySessionStore = new Map<string, string>();
let legacyPersistentPaidAccessPurged = false;
const VLM_CHECKOUT_BINDING_TOKEN =
  /^[A-Za-z0-9_-]{1,4052}\.[A-Za-z0-9_-]{43}$/u;
const VLM_CHECKOUT_SESSION_ID =
  /^(?:cs_(?:test_|live_)?[A-Za-z0-9_-]{4,176}|vlm_demo_[A-Za-z0-9:_-]{4,176})$/u;

type StoredAccessEvent = {
  productId: VlmPaidProductId;
  context: VlmPaidAccessContext;
  createdAt: string;
  expiresAt?: string;
  sessionId?: string;
  demoMode?: string;
};

function purgeLegacyPersistentPaidAccess() {
  if (typeof window === "undefined" || legacyPersistentPaidAccessPurged) return;
  legacyPersistentPaidAccessPurged = true;
  const purge = (storage: Storage) => {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key) keys.push(key);
    }
    for (const key of keys) {
      if (key === PASS2259_PENDING_KEY || key === PASS2259_LAST_SUCCESS_KEY || key.startsWith(LEGACY_PAID_ACCESS_PREFIX)) {
        storage.removeItem(key);
      }
    }
  };
  try {
    purge(window.localStorage);
  } catch {
    // Persistent browser storage can be disabled. Server-side entitlement remains authoritative.
  }
  try {
    purge(window.sessionStorage);
  } catch {
    // Historical tab-scoped checkout identifiers are best-effort purged. New
    // checkout and entitlement hints remain memory-only and non-authoritative.
  }
}

function storageGet(key: string) {
  if (typeof window === "undefined") return "";
  purgeLegacyPersistentPaidAccess();
  return memorySessionStore.get(key) ?? "";
}

function storageSet(key: string, value: string) {
  if (typeof window === "undefined") return false;
  purgeLegacyPersistentPaidAccess();
  memorySessionStore.set(key, value);
  return true;
}

function storageRemove(key: string) {
  if (typeof window === "undefined") return false;
  purgeLegacyPersistentPaidAccess();
  return memorySessionStore.delete(key);
}

function auditContextForIncludedPdf(context: Partial<VlmPaidAccessContext>) {
  const normalized = normalizePaidContext(context, context.locale);
  return normalizePaidContext(
    {
      ...normalized,
      surface: "audit",
      depth: "advanced",
      returnPath: undefined,
    },
    normalized.locale,
  );
}

function pass2265AccessLookupContexts(
  context: Partial<VlmPaidAccessContext>,
): VlmPaidAccessContext[] {
  const normalized = normalizePaidContext(context, context.locale);
  const contexts: VlmPaidAccessContext[] = [normalized];
  const seen = new Set([JSON.stringify(normalized)]);
  const add = (candidate: Partial<VlmPaidAccessContext>) => {
    const normalizedCandidate = normalizePaidContext(
      { ...normalized, ...candidate },
      normalized.locale,
    );
    const key = JSON.stringify(normalizedCandidate);
    if (seen.has(key)) return;
    seen.add(key);
    contexts.push(normalizedCandidate);
  };

  // PASS2265: service checkout URLs can carry both assetId and symbol, while
  // older modals sometimes read the receipt with only one of them. Try strict
  // first, then safe same-surface aliases. The backend still verifies the token
  // context, so this only prevents client storage key drift after redirects.
  if (normalized.symbol && normalized.assetId !== normalized.symbol) {
    add({ assetId: normalized.symbol, symbol: normalized.symbol });
    add({ assetId: undefined, symbol: normalized.symbol });
  }
  if (normalized.assetId && normalized.symbol !== normalized.assetId) {
    add({ assetId: normalized.assetId, symbol: normalized.assetId });
    add({ assetId: normalized.assetId, symbol: undefined });
  }

  return contexts;
}

function readStoredAccessToken(
  productId: VlmPaidProductId,
  context: Partial<VlmPaidAccessContext>,
) {
  for (const candidate of pass2265AccessLookupContexts(context)) {
    const marker = storageGet(buildVlmPaidAccessStorageKey(productId, candidate));
    if (marker === PASS36_SERVER_ACCOUNT_ENTITLEMENT_MARKER) {
      return PASS36_SERVER_ACCOUNT_ENTITLEMENT_MARKER;
    }
  }
  return "";
}

export function readVlmPaidAccessToken(
  productId: VlmPaidProductId,
  context: Partial<VlmPaidAccessContext>,
) {
  if (typeof window === "undefined") return "";
  const direct = readStoredAccessToken(productId, context);
  if (direct) return direct;

  // PASS2259/PASS2265: Advanced Audit includes Advanced PDF for the same
  // request. Keep the entitlement product strict, but allow the same safe
  // symbol/asset storage aliases as the primary lookup.
  if (productId === "vlm_advanced_pdf_single") {
    const included = readStoredAccessToken(
      "vlm_advanced_audit_human_review",
      auditContextForIncludedPdf(context),
    );
    if (included) return included;
  }
  return "";
}

export function writeVlmPaidAccessToken(
  productId: VlmPaidProductId,
  context: Partial<VlmPaidAccessContext>,
  token: string,
) {
  if (typeof window === "undefined") return false;
  const normalized = normalizePaidContext(context, context.locale);
  // The browser stores only a non-secret hint. Every paid API request is
  // re-authorized from the authenticated account and server entitlement ledger.
  void token;
  const wrote = storageSet(
    buildVlmPaidAccessStorageKey(productId, normalized),
    PASS36_SERVER_ACCOUNT_ENTITLEMENT_MARKER,
  );
  if (!wrote) return false;
  window.dispatchEvent(
    new CustomEvent("velmere:paid-access", {
      detail: { productId, context: normalized },
    }),
  );
  return true;
}

export function writeVlmPaidAccessBundle(args: {
  productId: VlmPaidProductId;
  context: Partial<VlmPaidAccessContext>;
  token: string;
  expiresAt?: string;
  sessionId?: string;
  demoMode?: string;
}) {
  const normalized = normalizePaidContext(args.context, args.context.locale);
  const wrotePrimary = writeVlmPaidAccessToken(
    args.productId,
    normalized,
    args.token,
  );
  const product = getVlmPaidProduct(args.productId, normalized.locale);
  const included = product.includedIn ?? [];

  // Keep included products discoverable without weakening the server gate. For
  // audit -> PDF, the stored value is still the audit token; PDF routes only
  // accept it through their explicit included-entitlement branch.
  for (const includedProductId of included) {
    if (
      includedProductId === "vlm_advanced_pdf_single" &&
      args.productId === "vlm_advanced_audit_human_review"
    ) {
      storageSet(
        buildVlmPaidAccessStorageKey(
          args.productId,
          auditContextForIncludedPdf(normalized),
        ),
        PASS36_SERVER_ACCOUNT_ENTITLEMENT_MARKER,
      );
    }
  }

  const event: StoredAccessEvent = {
    productId: args.productId,
    context: normalized,
    createdAt: new Date().toISOString(),
    expiresAt: args.expiresAt,
    sessionId: args.sessionId,
    demoMode: args.demoMode,
  };
  storageSet(PASS2259_LAST_SUCCESS_KEY, JSON.stringify(event));
  storageRemove(PASS2259_PENDING_KEY);
  window.dispatchEvent(
    new CustomEvent("velmere:paid-access-ready", { detail: event }),
  );
  return wrotePrimary;
}

export function writeVlmPaidCheckoutIntent(args: {
  productId: VlmPaidProductId;
  context: Partial<VlmPaidAccessContext>;
  locale: string;
  checkoutVerificationBindingToken?: string;
  sessionId?: string;
}) {
  const context = normalizePaidContext(
    {
      ...args.context,
      returnPath: buildVlmPaidReturnPath(args.context, `/${args.locale}`),
    },
    args.locale,
  );
  const payload = {
    productId: args.productId,
    context,
    locale: context.locale,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + PASS2263_PENDING_TTL_MS).toISOString(),
    checkoutVerificationBindingToken:
      typeof args.checkoutVerificationBindingToken === "string"
      && VLM_CHECKOUT_BINDING_TOKEN.test(args.checkoutVerificationBindingToken)
        ? args.checkoutVerificationBindingToken
        : undefined,
    sessionId:
      typeof args.sessionId === "string"
      && VLM_CHECKOUT_SESSION_ID.test(args.sessionId)
        ? args.sessionId
        : undefined,
  };
  storageSet(PASS2259_PENDING_KEY, JSON.stringify(payload));
  return payload;
}

export function readVlmPaidCheckoutIntent(): {
  productId: VlmPaidProductId;
  context: VlmPaidAccessContext;
  locale: string;
  createdAt: string;
  expiresAt?: string;
  checkoutVerificationBindingToken?: string;
  sessionId?: string;
} | null {
  const raw = storageGet(PASS2259_PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      productId?: unknown;
      context?: Partial<VlmPaidAccessContext>;
      locale?: unknown;
      createdAt?: unknown;
      expiresAt?: unknown;
      checkoutVerificationBindingToken?: unknown;
      sessionId?: unknown;
    };
    const productId =
      parsed.productId === "vlm_pro_analysis_single" ||
      parsed.productId === "vlm_pro_pdf_single" ||
      parsed.productId === "vlm_pro_audit_review" ||
      parsed.productId === "vlm_advanced_analysis_single" ||
      parsed.productId === "vlm_advanced_pdf_single" ||
      parsed.productId === "vlm_advanced_audit_human_review"
        ? parsed.productId
        : null;
    if (!productId) return null;
    const locale =
      parsed.locale === "pl" || parsed.locale === "de" || parsed.locale === "en"
        ? parsed.locale
        : "en";
    const createdAt =
      typeof parsed.createdAt === "string"
        ? parsed.createdAt
        : new Date(0).toISOString();
    const expiresAt =
      typeof parsed.expiresAt === "string" ? parsed.expiresAt : undefined;
    const createdMs = Date.parse(createdAt);
    const expiresMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
    if (
      (Number.isFinite(expiresMs) && expiresMs < Date.now()) ||
      (Number.isFinite(createdMs) && Date.now() - createdMs > PASS2263_PENDING_TTL_MS)
    ) {
      storageRemove(PASS2259_PENDING_KEY);
      return null;
    }
    return {
      productId,
      context: normalizePaidContext(parsed.context, locale),
      locale,
      createdAt,
      expiresAt,
      checkoutVerificationBindingToken:
        typeof parsed.checkoutVerificationBindingToken === "string"
        && VLM_CHECKOUT_BINDING_TOKEN.test(
          parsed.checkoutVerificationBindingToken,
        )
          ? parsed.checkoutVerificationBindingToken
          : undefined,
      sessionId:
        typeof parsed.sessionId === "string"
        && VLM_CHECKOUT_SESSION_ID.test(parsed.sessionId)
          ? parsed.sessionId
          : undefined,
    };
  } catch {
    return null;
  }
}


export function clearVlmPaidCheckoutIntent() {
  return storageRemove(PASS2259_PENDING_KEY);
}

export function readLastVlmPaidAccessSuccess(): StoredAccessEvent | null {
  const raw = storageGet(PASS2259_LAST_SUCCESS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredAccessEvent;
    return parsed?.productId ? parsed : null;
  } catch {
    return null;
  }
}

export async function startVlmServiceCheckout(args: {
  productId: VlmPaidProductId;
  locale: string;
  context: Partial<VlmPaidAccessContext>;
}) {
  const context = normalizePaidContext(args.context, args.locale);
  const tier = context.depth === "advanced" ? "advanced" : "pro";
  const serviceType =
    context.surface === "audit"
      ? "audit"
      : context.surface === "real-markets"
      ? "real_markets"
      : "browser";

  // First, attempt to open Stripe Popup Checkout with live credentials
  try {
    const stripeRes = await fetch("/api/checkout/stripe-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier,
        serviceType,
        symbol: context.symbol || context.assetId || "ASSET",
        locale: args.locale,
        isPopup: true,
      }),
    });
    const stripeData = await stripeRes.json();
    if (stripeRes.ok && stripeData.ok && stripeData.url) {
      const width = 520;
      const height = 760;
      const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
      const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
      const popup = window.open(
        stripeData.url,
        "velmere_stripe_checkout",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      return new Promise<void>((resolve, reject) => {
        let isDone = false;
        const cleanup = () => {
          clearInterval(pollInterval);
          window.removeEventListener("message", messageHandler);
        };

        const handleSuccess = () => {
          if (isDone) return;
          isDone = true;
          cleanup();
          try {
            popup?.close();
          } catch {}
          writeVlmPaidAccessBundle({
            productId: args.productId,
            context,
            token: `stripe_verified_${stripeData.sessionId}`,
            sessionId: stripeData.sessionId,
          });
          resolve();
        };

        const messageHandler = (e: MessageEvent) => {
          if (e.data?.type === "VELMERE_STRIPE_PAYMENT_SUCCESS") {
            handleSuccess();
          } else if (e.data?.type === "VELMERE_STRIPE_PAYMENT_CANCELLED") {
            cleanup();
            reject(new Error("Płatność w bramce Stripe została anulowana."));
          }
        };
        window.addEventListener("message", messageHandler);

        const pollInterval = setInterval(async () => {
          try {
            const check = await fetch(
              `/api/checkout/stripe-analysis?sessionId=${encodeURIComponent(stripeData.sessionId)}`
            );
            if (check.ok) {
              const res = await check.json();
              if (res.ok && res.paid) {
                handleSuccess();
              }
            }
          } catch {}
          if (popup && popup.closed && !isDone) {
            setTimeout(async () => {
              if (isDone) return;
              cleanup();
              reject(new Error("Okno płatności Stripe zostało zamknięte bez finalizacji."));
            }, 1000);
          }
        }, 1500);
      });
    }
  } catch (stripeErr) {
    console.warn("[STRIPE_POPUP_FALLBACK]:", stripeErr);
  }

  // Fallback to legacy endpoint if Stripe popup fails
  const productCellGate = resolvePass35PaidUiStopSell({
    productId: args.productId,
    surface: context.surface,
    tier: context.depth,
  });
  if (!productCellGate.ok) {
    throw new Pass35PaidUiStopSellError(productCellGate);
  }
  writeVlmPaidCheckoutIntent({
    productId: args.productId,
    locale: args.locale,
    context,
  });
  const clientRequestId = createBrowserSecureId(`vlm-service-${args.productId}`);
  const response = await fetchWithDeadline("/api/checkout/vlm-service", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-velmere-client-request-id": clientRequestId,
    },
    body: JSON.stringify({
      productId: args.productId,
      productCellId: productCellGate.productCellId,
      locale: args.locale,
      context,
      clientRequestId,
    }),
  });
  const payload = await readJsonResponseBounded<{
    ok?: boolean;
    url?: string;
    sessionId?: string;
    checkoutVerificationBindingToken?: string;
    error?: string;
    details?: unknown;
  }>(response, 128 * 1024);
  if (
    !response.ok
    || !payload.ok
    || !payload.url
    || !payload.sessionId
    || !VLM_CHECKOUT_SESSION_ID.test(payload.sessionId)
    || !payload.checkoutVerificationBindingToken
    || !VLM_CHECKOUT_BINDING_TOKEN.test(
      payload.checkoutVerificationBindingToken,
    )
  ) {
    throw new Error(payload.error || "checkout_unavailable");
  }
  writeVlmPaidCheckoutIntent({
    productId: args.productId,
    locale: args.locale,
    context,
    sessionId: payload.sessionId,
    checkoutVerificationBindingToken:
      payload.checkoutVerificationBindingToken,
  });
  window.location.assign(assertCheckoutRedirectUrl(payload.url, window.location.origin));
}
