import { summarizeLaunchReadiness } from "@/lib/launch/launch-readiness-summary";

export type AdminPermissionScope =
  | "product:import"
  | "product:sync"
  | "product:draft_publish"
  | "product:active_publish"
  | "product:overwrite"
  | "audit:write"
  | "support:export";

export type AdminSessionStatus = "ready" | "partial" | "blocked" | "manual_review";

export type AdminAuthSessionItem = {
  id: string;
  label: string;
  status: AdminSessionStatus;
  progress: number;
  sourceMode: "auth_missing" | "contract_draft" | "manual_review" | "policy_draft";
  requiredBeforePublicLaunch: boolean;
  operatorPromise: string;
  safetyBoundary: string;
  blockers: string[];
  nextStep: string;
};

export type AdminSessionPreview = {
  authenticated: boolean;
  operatorId: string;
  role: "none" | "viewer" | "operator" | "admin";
  scopes: AdminPermissionScope[];
  freshSession: boolean;
  reauthRequired: boolean;
  missing: string[];
};

export const adminAuthSessionMatrix: AdminAuthSessionItem[] = [
  {
    id: "session-reader",
    label: "Server session reader",
    status: "blocked",
    progress: 18,
    sourceMode: "auth_missing",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Admin route reads a server-authenticated session before any mutation or audit write.",
    safetyBoundary: "Client state, public env flags and preview ids never count as admin identity.",
    blockers: ["auth provider", "server session reader", "unauthorized response", "session expiry"],
    nextStep: "Implement server session reader and pass authenticated operator context into audit write route.",
  },
  {
    id: "role-scope-map",
    label: "Role and scope map",
    status: "manual_review",
    progress: 46,
    sourceMode: "contract_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Import, sync, publish, overwrite, audit write and support export each require explicit scopes.",
    safetyBoundary: "Having access to admin page must not imply active publish or customer export permission.",
    blockers: ["scope map", "role mapping", "permission snapshot", "deny-by-default"],
    nextStep: "Map admin roles to scopes and deny active publish/customer export by default.",
  },
  {
    id: "fresh-session",
    label: "Fresh session requirement",
    status: "blocked",
    progress: 24,
    sourceMode: "policy_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Sensitive actions require a fresh session or reauth timestamp before execution.",
    safetyBoundary: "Long-lived sessions cannot publish active products, overwrite provider data or export customer-safe reports.",
    blockers: ["reauth timestamp", "freshness window", "expired session copy", "locked action response"],
    nextStep: "Attach reauth/freshness check to active publish, overwrite and customer export actions.",
  },
  {
    id: "permission-deny-copy",
    label: "Permission deny copy",
    status: "manual_review",
    progress: 50,
    sourceMode: "manual_review",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Blocked admin actions return calm, clear, non-leaky deny reasons.",
    safetyBoundary: "Deny response must not expose internal role lists, secrets or route internals.",
    blockers: ["PL/DE/EN deny copy", "missing scope label", "support escalation path"],
    nextStep: "Add localized deny messages for missing scope, stale session and locked environment.",
  },
];

export const roleScopeMap: Record<AdminSessionPreview["role"], AdminPermissionScope[]> = {
  none: [],
  viewer: [],
  operator: ["product:import", "product:sync", "product:draft_publish", "audit:write"],
  admin: ["product:import", "product:sync", "product:draft_publish", "product:active_publish", "product:overwrite", "audit:write", "support:export"],
};

function splitScopes(value: string | undefined): AdminPermissionScope[] {
  if (!value) return [];
  const allowed = new Set<AdminPermissionScope>([
    "product:import",
    "product:sync",
    "product:draft_publish",
    "product:active_publish",
    "product:overwrite",
    "audit:write",
    "support:export",
  ]);
  return value
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope): scope is AdminPermissionScope => allowed.has(scope as AdminPermissionScope));
}

export function getAdminSessionPreviewFromEnv(): AdminSessionPreview {
  const authenticated = process.env.ADMIN_AUTH_CONTEXT_READY === "true";
  const roleRaw = process.env.ADMIN_ROLE_PREVIEW?.trim().toLowerCase();
  const role: AdminSessionPreview["role"] = roleRaw === "admin" || roleRaw === "operator" || roleRaw === "viewer" ? roleRaw : authenticated ? "operator" : "none";
  const explicitScopes = splitScopes(process.env.ADMIN_PERMISSION_SCOPES);
  const scopes = explicitScopes.length ? explicitScopes : roleScopeMap[role];
  const freshSession = process.env.ADMIN_SESSION_FRESH === "true";
  const missing = [
    ...(!authenticated ? ["server-authenticated session"] : []),
    ...(!freshSession ? ["fresh session / reauth timestamp"] : []),
  ];

  return {
    authenticated,
    operatorId: authenticated ? process.env.ADMIN_OPERATOR_ID?.trim() || "operator:env-preview" : "operator:unknown",
    role,
    scopes,
    freshSession,
    reauthRequired: !freshSession,
    missing,
  };
}

export function requireAdminScope(session: AdminSessionPreview, scope: AdminPermissionScope) {
  const missing: string[] = [];
  if (!session.authenticated) missing.push("server-authenticated session");
  if (!session.scopes.includes(scope)) missing.push(`scope:${scope}`);
  if ((scope === "product:active_publish" || scope === "product:overwrite" || scope === "support:export") && !session.freshSession) {
    missing.push("fresh session / reauth timestamp");
  }
  return {
    ok: missing.length === 0,
    missing,
    operatorId: session.operatorId,
    role: session.role,
    requiredScope: scope,
  };
}

export function getAdminAuthSessionSummary() {
  return summarizeLaunchReadiness(adminAuthSessionMatrix);
}

export const adminAuthSessionLaunchNote =
  "Admin auth session guard is a contract/preview. Production still needs a real auth provider, server session reader and reauth policy.";
