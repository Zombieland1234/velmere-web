import {
  PASS2196_CUSTOMER_SAFE_STATUS_SURFACE_ID,
  buildPass2196CustomerSafeStatusSurface,
  type Pass2196CustomerLocale,
  type Pass2196CustomerSafeStateCode,
} from "@/lib/ui/customer-safe-status-surface";

export const PASS2198_CUSTOMER_SAFE_STATUS_UI_BINDING_ID = "customer-safe-status-ui-binding" as const;

export type Pass2198BoundSurface =
  | "account_overview"
  | "account_orders"
  | "account_wallet"
  | "cart_items"
  | "cart_empty"
  | "checkout_readiness"
  | "checkout_success"
  | "checkout_cancel";

export type Pass2198BindingStatus = "PASS_STATIC_ONLY" | "BLOCKED_RUNTIME" | "FAIL";

export type Pass2198CustomerSafeUiBinding = {
  surface: Pass2198BoundSurface;
  routeOrComponent: string;
  stateCode: Pass2196CustomerSafeStateCode;
  receiptCode: string;
  visibleMarker: string;
  customerPromise: string;
  protectedBoundary: string;
  runtimeReceiptRequired: string;
};

export type Pass2198CustomerSafeUiBindingReport = {
  schemaVersion: typeof PASS2198_CUSTOMER_SAFE_STATUS_UI_BINDING_ID;
  passId: "PASS2198";
  generatedAt: string;
  status: Pass2198BindingStatus;
  productionGate: "BLOCK_RUNTIME_PRODUCTION" | "ALLOW_STATIC_ONLY";
  dependsOn: typeof PASS2196_CUSTOMER_SAFE_STATUS_SURFACE_ID;
  bindings: Pass2198CustomerSafeUiBinding[];
  requiredCustomerReceipts: string[];
  noCustomerRawCodes: string[];
  nextOwnerActions: string[];
  checksum: string;
};

const BINDING_BLUEPRINTS: Omit<Pass2198CustomerSafeUiBinding, "receiptCode">[] = [
  {
    surface: "account_overview",
    routeOrComponent: "components/dashboard/DashboardClient.tsx",
    stateCode: "build_proof_missing",
    visibleMarker: "data-pass2198-customer-safe-account-overview",
    customerPromise: "Account overview shows calm build/proof status instead of raw runtime-board codes.",
    protectedBoundary: "Do not expose BLOCKED_ENV/PASS_STATIC_ONLY as the main customer copy.",
    runtimeReceiptRequired: "account_status_surface_visible",
  },
  {
    surface: "account_orders",
    routeOrComponent: "components/dashboard/DashboardClient.tsx",
    stateCode: "receipt_missing",
    visibleMarker: "data-pass2198-customer-safe-account-orders",
    customerPromise: "Orders tab shows a safe receipt/order-state message before real orders exist.",
    protectedBoundary: "No raw order payload, payment secret, provider payload, email, phone or address.",
    runtimeReceiptRequired: "account_order_status_surface_visible",
  },
  {
    surface: "account_wallet",
    routeOrComponent: "components/dashboard/DashboardClient.tsx",
    stateCode: "advanced_unpaid_locked",
    visibleMarker: "data-pass2198-customer-safe-account-wallet",
    customerPromise: "Wallet tab explains that wallet connect is not paid Advanced access.",
    protectedBoundary: "Wallet connect must not unlock Advanced or expose paid evidence content.",
    runtimeReceiptRequired: "account_wallet_advanced_boundary_visible",
  },
  {
    surface: "cart_items",
    routeOrComponent: "app/[locale]/cart/page.tsx",
    stateCode: "provider_proof_missing",
    visibleMarker: "data-pass2198-customer-safe-cart-surface",
    customerPromise: "Cart with items shows provider/order proof status in customer-safe language.",
    protectedBoundary: "No raw provider payload, stock sync secret or internal retry payload.",
    runtimeReceiptRequired: "cart_status_surface_visible",
  },
  {
    surface: "cart_empty",
    routeOrComponent: "app/[locale]/cart/page.tsx",
    stateCode: "receipt_missing",
    visibleMarker: "data-pass2198-customer-safe-cart-empty-surface",
    customerPromise: "Empty cart shows calm no-receipt/no-order state without pressure.",
    protectedBoundary: "No false order/payment claim when there is no purchase receipt.",
    runtimeReceiptRequired: "cart_empty_status_surface_visible",
  },
  {
    surface: "checkout_readiness",
    routeOrComponent: "app/[locale]/checkout/page.tsx",
    stateCode: "provider_proof_missing",
    visibleMarker: "data-pass2198-customer-safe-checkout-surface",
    customerPromise: "Checkout readiness shows a premium status panel for closed/ready checkout.",
    protectedBoundary: "No fake production checkout claim when provider/order proof is missing.",
    runtimeReceiptRequired: "checkout_status_surface_visible",
  },
  {
    surface: "checkout_success",
    routeOrComponent: "app/[locale]/checkout/success/page.tsx",
    stateCode: "order_status_safe",
    visibleMarker: "data-pass2198-customer-safe-success-surface",
    customerPromise: "Checkout success shows verification/pending fulfilment safely after payment return.",
    protectedBoundary: "Do not claim shipped/fulfilled before provider proof and webhook receipts exist.",
    runtimeReceiptRequired: "checkout_success_status_surface_visible",
  },
  {
    surface: "checkout_cancel",
    routeOrComponent: "app/[locale]/checkout/cancel/page.tsx",
    stateCode: "advanced_checkout_error",
    visibleMarker: "data-pass2198-customer-safe-cancel-surface",
    customerPromise: "Checkout cancel/fail path shows visible recovery guidance instead of dead silence.",
    protectedBoundary: "No raw Stripe error, payment secret or paid Advanced content.",
    runtimeReceiptRequired: "checkout_cancel_status_surface_visible",
  },
];

function checksum(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return `pass2198-${Math.abs(hash).toString(16)}`;
}

export function buildPass2198CustomerSafeStatusUiBinding(locale: Pass2196CustomerLocale = "pl") {
  return BINDING_BLUEPRINTS.map((binding): Pass2198CustomerSafeUiBinding => {
    const surface = buildPass2196CustomerSafeStatusSurface(binding.stateCode, locale);
    return {
      ...binding,
      receiptCode: surface.receiptCode,
    };
  });
}

export function buildPass2198CustomerSafeStatusUiBindingReport(locale: Pass2196CustomerLocale = "pl"): Pass2198CustomerSafeUiBindingReport {
  const bindings = buildPass2198CustomerSafeStatusUiBinding(locale);
  const requiredCustomerReceipts = bindings.map((binding) => binding.runtimeReceiptRequired);
  const report = {
    schemaVersion: PASS2198_CUSTOMER_SAFE_STATUS_UI_BINDING_ID,
    passId: "PASS2198" as const,
    generatedAt: new Date().toISOString(),
    status: "PASS_STATIC_ONLY" as const,
    productionGate: "BLOCK_RUNTIME_PRODUCTION" as const,
    dependsOn: PASS2196_CUSTOMER_SAFE_STATUS_SURFACE_ID,
    bindings,
    requiredCustomerReceipts,
    noCustomerRawCodes: [
      "BLOCKED_ENV",
      "PASS_STATIC_ONLY",
      "BLOCK_RUNTIME_PRODUCTION",
      "raw Stripe error",
      "raw provider payload",
      "email / phone / address",
      "paid Advanced evidence ledger",
    ],
    nextOwnerActions: [
      "Open account overview/orders/wallet and capture customer-safe status screenshots.",
      "Open cart empty and cart-with-item states and capture the visible status surface.",
      "Open checkout, checkout success and checkout cancel paths and capture the status surface.",
      "Paste only redacted screenshot names/hashes into PASS2194 receipt ingestion.",
    ],
    checksum: "pending",
  };
  return { ...report, checksum: checksum(report) };
}
