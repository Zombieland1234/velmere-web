import { PASS4420_AUDIT_WATCH_SERVER_HELPER_BOUNDARY } from "@/lib/security/audit-watch-server-helpers";

export const PASS4421_AUDIT_WATCH_RESPONSE_BOUNDARY = {
  passId: "PASS4421",
  target: "app/api/security/audit-watch/route.ts",
  extractedHelper: "lib/security/audit-watch-response-boundary-helpers.ts",
  visualChanges: false,
  worldclassBenchmarkRequired: true,
  publicTopkaLiveAllowed: false,
  advancedAuditPaymentServerSideOnly: false,
  currentPublicCheckoutAllowed: false,
  publicPrivateEnvelopeHardening: true,
  paymentRequiredEnvelopeSanitized: true,
  topkaComparison: [
    "CertiK-style paid audit envelope hardening",
    "OpenZeppelin-style route response boundary extraction",
    "Trail of Bits-style public/private leak minimization",
    "ChainSecurity-style no live promotion without hosted receipts",
  ],
} as const;

export type Pass4421HeaderMap = Record<string, string>;

export function buildPass4421AuditWatchHeaders(base: Pass4421HeaderMap = {}): Pass4421HeaderMap {
  return {
    "cache-control": base["cache-control"] ?? "no-store",
    ...base,
    "x-velmere-pass4421-audit-watch-response-boundary": PASS4421_AUDIT_WATCH_RESPONSE_BOUNDARY.passId,
    "x-velmere-pass4421-no-visual-changes": String(PASS4421_AUDIT_WATCH_RESPONSE_BOUNDARY.visualChanges === false),
    "x-velmere-pass4421-worldclass-benchmark-required": String(PASS4421_AUDIT_WATCH_RESPONSE_BOUNDARY.worldclassBenchmarkRequired),
    "x-velmere-pass4421-public-topka-live-allowed": String(PASS4421_AUDIT_WATCH_RESPONSE_BOUNDARY.publicTopkaLiveAllowed),
    "x-velmere-pass4421-public-private-envelope-hardening": String(PASS4421_AUDIT_WATCH_RESPONSE_BOUNDARY.publicPrivateEnvelopeHardening),
  };
}

export function buildPass4421PaymentRequiredHeaders(): Pass4421HeaderMap {
  return buildPass4421AuditWatchHeaders({
    "x-velmere-access-boundary": "invitation-only-or-not-for-sale",
    "x-velmere-public-checkout-allowed": "false",
    "x-velmere-pass4421-payment-required-envelope-sanitized": String(PASS4421_AUDIT_WATCH_RESPONSE_BOUNDARY.paymentRequiredEnvelopeSanitized),
  });
}

export type Pass4421PaymentRequiredEnvelopeInput = {
  product: unknown;
  context: unknown;
  reason: unknown;
  ledgerMode: unknown;
};

export function buildPass4421PaymentRequiredEnvelope(input: Pass4421PaymentRequiredEnvelopeInput) {
  const reason = typeof input.reason === "string" ? input.reason : "invitation_or_entitlement_not_verified";
  return {
    ok: false,
    error: reason === "product_not_for_sale" ? "product_not_for_sale" as const : "invitation_required" as const,
    product: input.product,
    context: input.context,
    reason,
    publicCheckoutAllowed: false as const,
    publicPrice: null,
    ledgerMode: typeof input.ledgerMode === "string" ? input.ledgerMode : "unknown",
    pass2223: "pass2223-audit-watch-advanced-token-bearer-hardening",
    pass4420: PASS4420_AUDIT_WATCH_SERVER_HELPER_BOUNDARY,
    pass4421: PASS4421_AUDIT_WATCH_RESPONSE_BOUNDARY,
  };
}
