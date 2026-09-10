import { summarizeLaunchReadiness } from "@/lib/launch/launch-readiness-summary";

export type AdminServerAuthStatus = "ready" | "partial" | "blocked" | "manual_review";

export type AdminServerAuthItem = {
  id: string;
  label: string;
  status: AdminServerAuthStatus;
  progress: number;
  sourceMode: "missing" | "contract_draft" | "manual_review" | "policy_draft";
  requiredBeforePublicLaunch: boolean;
  operatorPromise: string;
  safetyBoundary: string;
  blockers: string[];
  nextStep: string;
};

export const adminServerAuthContract: AdminServerAuthItem[] = [
  {
    id: "auth-provider",
    label: "Server auth provider",
    status: "blocked",
    progress: 28,
    sourceMode: "missing",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Admin routes are only accessible after a server-validated authenticated session.",
    safetyBoundary: "Public env flags and client checks are not security. Server auth must own the route.",
    blockers: ["provider choice", "server session validation", "unauthorized response", "session expiry"],
    nextStep: "Auth session guard contract now exists; next choose provider and implement server session reader."
  },
  {
    id: "role-contract",
    label: "Admin role contract",
    status: "blocked",
    progress: 40,
    sourceMode: "contract_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Only accounts with an explicit admin/operator role can import, sync or publish products.",
    safetyBoundary: "No email-only allowlist as final security; role and permissions must be explicit.",
    blockers: ["role model", "operator identity", "permission scope", "role audit"],
    nextStep: "Role/scope map now exists; next bind scopes to real authenticated admin roles."
  },
  {
    id: "session-expiry",
    label: "Session expiry and reauth",
    status: "blocked",
    progress: 32,
    sourceMode: "policy_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Admin sessions expire and sensitive actions require a fresh trusted session.",
    safetyBoundary: "No long-lived admin tooling session without expiry, reauth and clear locked state.",
    blockers: ["expiry policy", "reauth policy", "locked session UI", "timeout handling"],
    nextStep: "Fresh session requirement now exists; next connect reauth timestamp to sensitive actions."
  },
  {
    id: "mutation-permission",
    label: "Mutation permission",
    status: "blocked",
    progress: 42,
    sourceMode: "contract_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Import, provider sync and publish actions each require a separate permission scope.",
    safetyBoundary: "Reading product drafts must not imply permission to publish or overwrite live catalogue.",
    blockers: ["import permission", "sync permission", "publish permission", "overwrite permission"],
    nextStep: "Permission scope guard now exists; next enforce scopes in server middleware."
  },
  {
    id: "server-kill-switch",
    label: "Server kill switch",
    status: "blocked",
    progress: 22,
    sourceMode: "manual_review",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Admin tooling can be disabled server-side without shipping new code.",
    safetyBoundary: "Client env gate is only UX; server kill switch must block route and mutations.",
    blockers: ["server env flag", "mutation guard", "locked response", "ops procedure"],
    nextStep: "Implement server-owned ADMIN_TOOLS_ENABLED guard before public deployment.",
  },
];

export function getAdminServerAuthSummary() {
  return summarizeLaunchReadiness(adminServerAuthContract);
}
