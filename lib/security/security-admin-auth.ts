import { createHash, timingSafeEqual } from "node:crypto";
import { securityJson } from "@/lib/security/api-guard";
import { recordSecurityAdminAudit } from "@/lib/security/security-admin-audit";
import {
  verifyAndConsumeSecurityOperatorAssertion,
  verifySecurityOperatorAssertion,
  type SecurityOperatorRole,
} from "@/lib/security/security-operator-assertion";

export type SecurityAdminScope =
  | "security:read"
  | "security:events"
  | "security:alerts"
  | "security:export"
  | "security:console";

export type SecurityAdminGateStatus = "ready" | "locked" | "not_configured" | "disabled";

export type SecurityAdminGateSnapshot = {
  schemaVersion: "velmere-security-admin-gate-v1";
  status: SecurityAdminGateStatus;
  consoleVisible: boolean;
  apiProtected: boolean;
  authHeaderNames: ["authorization", "x-velmere-security-admin-token"];
  requiredScopes: SecurityAdminScope[];
  configured: {
    tokenHash: boolean;
    tokenFallback: boolean;
    consoleEnabled: boolean;
    productionBypassDisabled: boolean;
  };
  missing: string[];
  productionBoundary: string;
};

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

function safeEqualString(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

function normalizeScopeList(value: string | undefined): SecurityAdminScope[] {
  const allowed = new Set<SecurityAdminScope>([
    "security:read",
    "security:events",
    "security:alerts",
    "security:export",
    "security:console",
  ]);
  return (value ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope): scope is SecurityAdminScope => allowed.has(scope as SecurityAdminScope));
}

function configuredScopes() {
  const scopes = normalizeScopeList(process.env.VELMERE_SECURITY_ADMIN_SCOPES);
  if (scopes.length) return scopes;
  const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  return productionLike ? [] : (["security:read"] satisfies SecurityAdminScope[]);
}

function extractProvidedToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice("bearer ".length).trim() : "";
  const headerToken = request.headers.get("x-velmere-security-admin-token")?.trim() ?? "";
  return bearer || headerToken;
}

export function getSecurityAdminGateSnapshot(requiredScopes: SecurityAdminScope[] = ["security:read"]): SecurityAdminGateSnapshot {
  const enabled = process.env.VELMERE_SECURITY_ADMIN_ENABLED === "true";
  const consoleEnabled = process.env.VELMERE_SECURITY_ADMIN_CONSOLE_ENABLED === "true";
  const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const tokenHash = /^[a-f0-9]{64}$/i.test(process.env.VELMERE_SECURITY_ADMIN_TOKEN_SHA256?.trim() ?? "");
  const tokenFallback = Boolean(process.env.VELMERE_SECURITY_ADMIN_TOKEN);
  const bypassDisabled = process.env.NODE_ENV === "production" ? process.env.VELMERE_SECURITY_ADMIN_BYPASS !== "1" : true;
  const scopeSet = new Set(configuredScopes());
  const missing: string[] = [];

  if (!enabled) missing.push("VELMERE_SECURITY_ADMIN_ENABLED must be true");
  if (!tokenHash && (!tokenFallback || productionLike)) missing.push("VELMERE_SECURITY_ADMIN_TOKEN_SHA256 must contain an exact SHA-256 digest");
  if (productionLike && tokenFallback) missing.push("VELMERE_SECURITY_ADMIN_TOKEN plaintext fallback is forbidden in production");
  for (const scope of requiredScopes) {
    if (!scopeSet.has(scope)) missing.push(`missing scope ${scope}`);
  }

  const credentialReady = tokenHash || (!productionLike && tokenFallback);
  const ready = enabled && credentialReady && requiredScopes.every((scope) => scopeSet.has(scope));
  return {
    schemaVersion: "velmere-security-admin-gate-v1",
    status: ready ? "ready" : enabled ? "not_configured" : "locked",
    consoleVisible: ready && consoleEnabled,
    apiProtected: true,
    authHeaderNames: ["authorization", "x-velmere-security-admin-token"],
    requiredScopes,
    configured: {
      tokenHash,
      tokenFallback,
      consoleEnabled,
      productionBypassDisabled: bypassDisabled,
    },
    missing,
    productionBoundary:
      "Security admin gate is deny-by-default. API routes require a server-side token check; the public page remains locked unless console visibility is explicitly enabled.",
  };
}

export type SecurityAdminOperatorRequirement = {
  role: SecurityOperatorRole;
  requirePhishingResistantMfa?: boolean;
};

export type SecurityAdminTokenVerificationOptions = {
  /** The route will parse a bounded body and immediately call
   * verifySecurityAdminMutationAssertionAfterToken before side effects. */
  deferBodyBoundMutationAssertion?: boolean;
};

function operatorAssertionRequired() {
  if (process.env.VELMERE_SECURITY_OPERATOR_ASSERTION_REQUIRED === "true") return true;
  if (process.env.VELMERE_SECURITY_OPERATOR_ASSERTION_REQUIRED === "false") return false;
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function verifySecurityAdminToken(
  request: Request,
  requiredScopes: SecurityAdminScope[] = ["security:read"],
  operatorRequirement?: SecurityAdminOperatorRequirement,
  options: SecurityAdminTokenVerificationOptions = {},
) {
  const snapshot = getSecurityAdminGateSnapshot(requiredScopes);
  if (snapshot.status !== "ready") {
    recordSecurityAdminAudit({
      request,
      scopes: requiredScopes,
      result: "not_configured",
      safeSummary: "Security admin request blocked because the admin gate is not configured.",
    });
    return {
      ok: false as const,
      snapshot,
      response: securityJson({
        ok: false,
        mode: "security_admin_gate_not_configured",
        gate: snapshot,
      }, { status: 503 }),
    };
  }

  const provided = extractProvidedToken(request);
  if (!provided) {
    recordSecurityAdminAudit({
      request,
      scopes: requiredScopes,
      result: "denied",
      safeSummary: "Security admin request denied because no token was provided.",
    });
    return {
      ok: false as const,
      snapshot,
      response: securityJson({
        ok: false,
        mode: "security_admin_token_required",
        requiredHeaders: snapshot.authHeaderNames,
        gate: { ...snapshot, configured: { ...snapshot.configured, tokenFallback: Boolean(snapshot.configured.tokenFallback) } },
      }, { status: 401 }),
    };
  }

  const expectedHash = process.env.VELMERE_SECURITY_ADMIN_TOKEN_SHA256?.trim().toLowerCase();
  const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const expectedPlain = productionLike ? undefined : process.env.VELMERE_SECURITY_ADMIN_TOKEN;
  const providedHash = sha256(provided);
  const hashOk = expectedHash ? safeEqualHex(providedHash, expectedHash) : false;
  const plainOk = expectedPlain ? safeEqualString(provided, expectedPlain) : false;

  if (!hashOk && !plainOk) {
    recordSecurityAdminAudit({
      request,
      scopes: requiredScopes,
      result: "denied",
      safeSummary: "Security admin request denied because token verification failed.",
    });
    return {
      ok: false as const,
      snapshot,
      response: securityJson({
        ok: false,
        mode: "security_admin_token_invalid",
      }, { status: 401 }),
    };
  }

  const unsafeMethod = !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
  if (unsafeMethod && options.deferBodyBoundMutationAssertion !== true) {
    recordSecurityAdminAudit({
      request,
      scopes: requiredScopes,
      result: "denied",
      safeSummary: "Security admin mutation blocked because the route did not declare the body-bound single-use assertion phase.",
    });
    return {
      ok: false as const,
      snapshot,
      response: securityJson({
        ok: false,
        mode: "security_admin_mutation_assertion_middleware_required",
      }, { status: 503 }),
    };
  }

  const assertion = operatorRequirement
    ? verifySecurityOperatorAssertion({
        request,
        requiredRole: operatorRequirement.role,
        requiredScopes,
        requirePhishingResistantMfa: operatorRequirement.requirePhishingResistantMfa,
      })
    : null;
  if (assertion && !assertion.ok && (!assertion.missing || operatorAssertionRequired())) {
    recordSecurityAdminAudit({
      request,
      scopes: requiredScopes,
      result: "denied",
      safeSummary: `Security admin operator assertion denied: ${assertion.error}.`,
    });
    return {
      ok: false as const,
      snapshot,
      response: securityJson({ ok: false, mode: assertion.error }, { status: assertion.error.includes("not_configured") ? 503 : 401 }),
    };
  }

  const operator = assertion?.ok
    ? {
        id: assertion.operator.id,
        pseudonym: assertion.operator.pseudonym,
        scopes: requiredScopes,
        role: assertion.operator.role,
        mfa: assertion.operator.mfa,
        assertionFingerprint: assertion.operator.assertionFingerprint,
        authMode: "signed-operator-assertion" as const,
      }
    : {
        id: "security-admin",
        pseudonym: "operator-legacy-admin",
        scopes: requiredScopes,
        role: operatorRequirement?.role ?? "security_admin",
        mfa: null,
        assertionFingerprint: null,
        authMode: (expectedHash ? "sha256" : "env-token") as "sha256" | "env-token",
      };
  if (options.deferBodyBoundMutationAssertion !== true) {
    recordSecurityAdminAudit({
      request,
      scopes: requiredScopes,
      result: "allowed",
      operatorId: operator.pseudonym,
      safeSummary: assertion?.ok
        ? "Security admin request allowed by token gate plus request-bound signed operator assertion."
        : "Security admin request allowed by server-side token gate in legacy/non-production mode.",
    });
  }

  return {
    ok: true as const,
    snapshot,
    operator,
  };
}

/**
 * Mandatory second phase for privileged mutations. Call only after the admin
 * or independent-approver credential has passed and after the bounded JSON
 * reader has produced `requestBody`. The assertion is bound to that canonical
 * body and its nonce is reserved before route side effects begin.
 */
export async function verifySecurityAdminMutationAssertionAfterToken(args: {
  request: Request;
  requiredScopes: SecurityAdminScope[];
  operatorRequirement: SecurityAdminOperatorRequirement;
  requestBody: unknown;
}) {
  const assertion = await verifyAndConsumeSecurityOperatorAssertion({
    request: args.request,
    requiredRole: args.operatorRequirement.role,
    requiredScopes: args.requiredScopes,
    requirePhishingResistantMfa: args.operatorRequirement.requirePhishingResistantMfa,
    requestBody: args.requestBody,
  });
  if (!assertion.ok) {
    recordSecurityAdminAudit({
      request: args.request,
      scopes: args.requiredScopes,
      result: "denied",
      safeSummary: `Security mutation operator assertion denied: ${assertion.error}.`,
    });
    const status = assertion.error.includes("store_unavailable")
      ? 503
      : assertion.error.includes("replayed")
        ? 409
        : 401;
    return {
      ok: false as const,
      response: securityJson({ ok: false, mode: assertion.error }, { status }),
    };
  }
  const operator = {
    id: assertion.operator.id,
    pseudonym: assertion.operator.pseudonym,
    scopes: args.requiredScopes,
    role: assertion.operator.role,
    mfa: assertion.operator.mfa,
    assertionFingerprint: assertion.operator.assertionFingerprint,
    authMode: "signed-operator-assertion" as const,
    replayProtection: assertion.replayProtection,
  };
  recordSecurityAdminAudit({
    request: args.request,
    scopes: args.requiredScopes,
    result: "allowed",
    operatorId: operator.pseudonym,
    safeSummary: "Security mutation allowed by body-bound assertion with single-use nonce reservation.",
  });
  return { ok: true as const, operator };
}

export function verifySecurityApproverToken(request: Request) {
  const scopes: SecurityAdminScope[] = ["security:events", "security:export"];
  if (process.env.VELMERE_SECURITY_ADMIN_ENABLED !== "true") {
    return {
      ok: false as const,
      response: securityJson({ ok: false, mode: "security_approver_gate_disabled" }, { status: 503 }),
    };
  }
  const provided = request.headers.get("x-velmere-security-approver-token")?.trim() ?? "";
  if (!provided) {
    recordSecurityAdminAudit({ request, scopes, result: "denied", safeSummary: "Advanced approval denied because the independent approver token was missing." });
    return {
      ok: false as const,
      response: securityJson({ ok: false, mode: "security_approver_token_required", requiredHeader: "x-velmere-security-approver-token" }, { status: 401 }),
    };
  }
  const expectedHash = process.env.VELMERE_SECURITY_APPROVER_TOKEN_SHA256?.trim().toLowerCase();
  const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const expectedPlain = productionLike ? undefined : process.env.VELMERE_SECURITY_APPROVER_TOKEN;
  if (!expectedHash && !expectedPlain) {
    return {
      ok: false as const,
      response: securityJson({ ok: false, mode: "security_approver_gate_not_configured" }, { status: 503 }),
    };
  }
  const providedHash = sha256(provided);
  const hashOk = expectedHash ? safeEqualHex(providedHash, expectedHash) : false;
  const plainOk = expectedPlain ? safeEqualString(provided, expectedPlain) : false;
  if (!hashOk && !plainOk) {
    recordSecurityAdminAudit({ request, scopes, result: "denied", safeSummary: "Advanced approval denied because independent token verification failed." });
    return {
      ok: false as const,
      response: securityJson({ ok: false, mode: "security_approver_token_invalid" }, { status: 401 }),
    };
  }

  const adminHash = process.env.VELMERE_SECURITY_ADMIN_TOKEN_SHA256?.trim().toLowerCase();
  const adminPlain = process.env.VELMERE_SECURITY_ADMIN_TOKEN;
  const aliasesPrimary = (adminHash && safeEqualHex(providedHash, adminHash)) || (adminPlain ? safeEqualString(provided, adminPlain) : false);
  if (aliasesPrimary) {
    recordSecurityAdminAudit({ request, scopes, result: "denied", safeSummary: "Advanced approval denied because primary and secondary credentials were identical." });
    return {
      ok: false as const,
      response: securityJson({ ok: false, mode: "security_approver_must_be_independent" }, { status: 409 }),
    };
  }

  const operator = {
    id: `security-approver-${providedHash.slice(0, 12)}`,
    pseudonym: `operator-${providedHash.slice(0, 16)}`,
    scopes,
    role: "independent_approver" as const,
    mfa: null,
    assertionFingerprint: null,
    authMode: (expectedHash ? "sha256" : "env-token") as "sha256" | "env-token",
  };
  recordSecurityAdminAudit({ request, scopes, result: "allowed", operatorId: operator.pseudonym, safeSummary: "Independent Advanced approver credential accepted; the route must still consume its body-bound operator assertion before mutation." });
  return { ok: true as const, operator };
}

export function buildSecurityAdminGateReadiness() {
  return {
    ...getSecurityAdminGateSnapshot(["security:read", "security:events", "security:alerts", "security:export"]),
    nextCriticalStep:
      "Set VELMERE_SECURITY_ADMIN_ENABLED=true, configure VELMERE_SECURITY_ADMIN_TOKEN_SHA256, keep console disabled by default, and test authorized API calls on Vercel.",
  };
}
