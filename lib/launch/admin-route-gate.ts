import { summarizeLaunchReadiness } from "@/lib/launch/launch-readiness-summary";

export type AdminRouteGateStatus = "ready" | "partial" | "blocked" | "manual_review";

export type AdminRouteGateItem = {
  id: string;
  label: string;
  route: string;
  status: AdminRouteGateStatus;
  progress: number;
  sourceMode: "env_missing" | "env_draft" | "auth_missing" | "audit_required" | "manual_review";
  requiredBeforePublicLaunch: boolean;
  operatorPromise: string;
  safetyBoundary: string;
  blockers: string[];
  nextStep: string;
};

export const adminRouteGateMatrix: AdminRouteGateItem[] = [
  {
    id: "admin-auth",
    label: "Admin authentication",
    route: "/[locale]/admin/*",
    status: "blocked",
    progress: 28,
    sourceMode: "auth_missing",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Only trusted operators can access admin import, product publishing and provider sync tools.",
    safetyBoundary: "No public admin route without authentication, role check and session expiry.",
    blockers: ["auth provider", "admin role", "session expiry", "unauthorized state", "operator identity"],
    nextStep: "Server auth contract now exists; next choose provider and enforce role/session checks server-side."
  },
  {
    id: "environment-gate",
    label: "Environment gate",
    route: "/[locale]/admin/import-products",
    status: "blocked",
    progress: 38,
    sourceMode: "env_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Admin import is only available in approved environments, not accidental public preview traffic.",
    safetyBoundary: "No import/sync action should run unless ADMIN_TOOLS_ENABLED and deployment environment are explicitly allowed.",
    blockers: ["ADMIN_TOOLS_ENABLED", "allowed deployment env", "preview lock", "production approval", "kill switch"],
    nextStep: "Locked admin surface now exists; next replace public-env preview gate with server auth, role checks and persistent audit."
  },
  {
    id: "publish-permission",
    label: "Publish permission",
    route: "product publish actions",
    status: "blocked",
    progress: 34,
    sourceMode: "audit_required",
    requiredBeforePublicLaunch: true,
    operatorPromise: "No imported product can become public without explicit publish permission and truth checks.",
    safetyBoundary: "No one-click publish before provider truth, shipping/returns truth and legal copy pass.",
    blockers: ["publish role", "truth checklist", "provider snapshot", "shipping/returns snapshot", "audit reason"],
    nextStep: "Publish permission gate now exists; next make provider/shipping/legal checklist a hard server-side publish blocker."
  },
  {
    id: "import-audit",
    label: "Import audit trail",
    route: "product import events",
    status: "manual_review",
    progress: 30,
    sourceMode: "audit_required",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Every import, overwrite, provider sync and publish attempt should leave an operator trace.",
    safetyBoundary: "No admin mutation without timestamp, operator id, action type, source and result state.",
    blockers: ["event ledger", "operator id", "source snapshot", "diff summary", "failure state"],
    nextStep: "Reuse order-event ledger style envelope for admin import events and store import diffs.",
  },
  {
    id: "secret-redaction",
    label: "Secret redaction",
    route: "admin logs / UI",
    status: "partial",
    progress: 56,
    sourceMode: "manual_review",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Tokens, API keys, provider secrets and raw private IDs never appear in the customer UI or logs.",
    safetyBoundary: "No raw provider token, webhook secret, payment key or private scoring key in browser-visible copy.",
    blockers: ["log redaction", "debug output guard", "secret scan", "raw response filter"],
    nextStep: "Secret redaction policy and static guard now exist; next add CI enforcement and response allowlist."
  },
  {
    id: "public-route-fallback",
    label: "Public route fallback",
    route: "/[locale]/admin/*",
    status: "manual_review",
    progress: 46,
    sourceMode: "env_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "If admin tools are disabled, the route should show a safe locked state, not crash or expose tooling.",
    safetyBoundary: "No raw stack trace, import form, provider response or publish controls in locked mode.",
    blockers: ["locked state component", "not-found/redirect policy", "safe copy", "support handoff"],
    nextStep: "Locked mode now hides import tooling; next enforce not-found/redirect policy server-side."
  },
];

export function getAdminRouteGateSummary() {
  return summarizeLaunchReadiness(adminRouteGateMatrix);
}

export function getAdminRouteLaunchBlockers() {
  return adminRouteGateMatrix.filter((item) => item.requiredBeforePublicLaunch && item.status !== "ready");
}
