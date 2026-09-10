import { CONTROL_PLANE_RUNTIME_PATH_SET } from "@/lib/security/control-plane-runtime-manifest";

export const PASS4659_API_SURFACE_REGISTRY_ID = "pass4659-canonical-api-surface-registry-v1" as const;

export type Pass4659ApiSurfaceClass =
  | "control_plane"
  | "machine_webhook"
  | "admin_operator"
  | "authenticated_customer"
  | "public_product"
  | "unclassified";

// A surface label is not authentication.  The action-report endpoints do not
// prove an account session inside their handlers, so they must remain behind
// the production control-plane boundary until an account-bound contract is
// implemented and tested end-to-end.
export const PASS4665_AUTHENTICATED_CUSTOMER_OVERRIDES = new Set<string>();

export const PASS4665_ADMIN_OPERATOR_OVERRIDES = new Set<string>([
  "/api/security/admin-replay-board",
  "/api/security/payment-runtime-evidence",
  "/api/security/release-gate",
  "/api/security/runtime-qa",
  "/api/security/stripe-webhook-replay-qa",
]);

export const PASS4659_CONTROL_PLANE_PATTERNS: readonly RegExp[] = [
  /^\/api\/security\/audit-pass\d+(?:[-/]|$)/i,
  /^\/api\/security\/(?:final|worldclass|runtime|local-runtime|owner-runtime)-[^/]+(?:\/|$)/i,
  /^\/api\/security\/(?:release-gate|runtime-proof-board|runtime-qa|runtime-receipt-ingestion-merge|runtime-screenshot-checklist-ui|runtime-ux-binding)(?:\/|$)/i,
  /^\/api\/security\/(?:admin-replay-board|mutation-receipts|stripe-webhook-replay-qa|stripe-advanced-negative-matrix|gemini-audit-output-capture|pdf-sample-quality-eval)(?:\/|$)/i,
  /^\/api\/market-integrity\/action-report-[^/]+(?:\/|$)/i,
  /^\/api\/market-integrity\/pass\d+(?:[-/]|$)/i,
  /^\/api\/market-integrity\/(?:release-[^/]+|worldclass-[^/]+|replay|runtime-(?:evidence-chip-adapter-rebalance|health|parity|premium-evidence)|fixture-[^/]+|proof-gap-[^/]+)(?:\/|$)/i,
  /^\/api\/velmere\/(?:final-readiness|pass\d+[^/]*)(?:\/|$)/i,
  /^\/api\/pass\d+(?:[-/]|$)/i,
  /^\/api\/proof-status(?:\/|$)/i,
] as const;

const MACHINE_PATTERNS: readonly RegExp[] = [
  /^\/api\/stripe\/webhook(?:\/|$)/i,
  /^\/api\/webhooks?(?:\/|$)/i,
  /^\/api\/cron(?:\/|$)/i,
  // Internal workers/providers are authenticated machine-to-machine
  // surfaces.  Their route handlers still enforce signed mutation envelopes;
  // this classification prevents them from silently landing in unclassified.
  /^\/api\/internal(?:\/|$)/i,
] as const;

const ADMIN_PATTERNS: readonly RegExp[] = [
  /^\/api\/admin(?:\/|$)/i,
  /^\/api\/ops(?:\/|$)/i,
] as const;

const AUTHENTICATED_CUSTOMER_PATTERNS: readonly RegExp[] = [
  /^\/api\/account(?:\/|$)/i,
  /^\/api\/profile(?:\/|$)/i,
  /^\/api\/auth(?:\/|$)/i,
  /^\/api\/square(?:\/|$)/i,
  /^\/api\/checkout(?:\/|$)/i,
] as const;

const PUBLIC_PRODUCT_PATTERNS: readonly RegExp[] = [
  /^\/api\/market-integrity(?:\/|$)/i,
  /^\/api\/security(?:\/|$)/i,
  /^\/api\/search(?:\/|$)/i,
  /^\/api\/angel(?:\/|$)/i,
  /^\/api\/ai(?:\/|$)/i,
  /^\/api\/products(?:\/|$)/i,
  /^\/api\/printful(?:\/|$)/i,
  /^\/api\/contact(?:\/|$)/i,
  /^\/api\/stripe(?:\/|$)/i,
  /^\/api\/provenance(?:\/|$)/i,
] as const;

function normalizeApiPath(pathname: string) {
  const normalized = pathname.replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function matches(pathname: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(pathname));
}

export function isPass4659ControlPlanePath(pathname: string) {
  const normalized = normalizeApiPath(pathname);
  if (PASS4665_AUTHENTICATED_CUSTOMER_OVERRIDES.has(normalized) || PASS4665_ADMIN_OPERATOR_OVERRIDES.has(normalized)) return false;
  return CONTROL_PLANE_RUNTIME_PATH_SET.has(normalized) || matches(normalized, PASS4659_CONTROL_PLANE_PATTERNS);
}

export function classifyPass4659ApiPath(pathname: string): Pass4659ApiSurfaceClass {
  const normalized = normalizeApiPath(pathname);
  if (!normalized.startsWith("/api/")) return "unclassified";
  if (PASS4665_AUTHENTICATED_CUSTOMER_OVERRIDES.has(normalized)) return "authenticated_customer";
  if (PASS4665_ADMIN_OPERATOR_OVERRIDES.has(normalized)) return "admin_operator";
  if (CONTROL_PLANE_RUNTIME_PATH_SET.has(normalized) || matches(normalized, PASS4659_CONTROL_PLANE_PATTERNS)) return "control_plane";
  if (matches(normalized, MACHINE_PATTERNS)) return "machine_webhook";
  if (matches(normalized, ADMIN_PATTERNS)) return "admin_operator";
  if (matches(normalized, AUTHENTICATED_CUSTOMER_PATTERNS)) return "authenticated_customer";
  if (matches(normalized, PUBLIC_PRODUCT_PATTERNS)) return "public_product";
  return "unclassified";
}

export function pass4659ApiSurfaceHeaders(pathname: string) {
  return {
    "x-velmere-api-surface-registry": PASS4659_API_SURFACE_REGISTRY_ID,
    "x-velmere-api-surface-class": classifyPass4659ApiPath(pathname),
  } as const;
}
