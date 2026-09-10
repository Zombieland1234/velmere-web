import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { VelmereAdminSession } from "@/lib/admin/session-roles";
import { evaluateRuntimePaymentAuthority } from "@/lib/checkout/runtime-payment-authority";
import {
  runBoundedServiceRoleRpc,
  type SupabaseRpcClient,
} from "@/lib/db/bounded-supabase-rpc";

export type PaymentOperatorActionScope = "payment:reconcile" | "payment:requeue";
export type PaymentOperatorMfaMethod = "webauthn";

export type PaymentOperatorAssertionPayload = {
  schemaVersion: "velmere.payment-operator-assertion.v1";
  assertionId: string;
  actorIdHash: string;
  sessionIdHash: string;
  scope: PaymentOperatorActionScope;
  method: "POST";
  path: string;
  bodySha256: string;
  actionDigest: string;
  issuedAtMs: number;
  recentAuthAtMs: number;
  expiresAtMs: number;
  mfaMethod: PaymentOperatorMfaMethod;
  environment: "test_only";
};

export type PaymentIndependentApprovalPayload = {
  schemaVersion: "velmere.payment-independent-approval.v1";
  approvalId: string;
  approverActorIdHash: string;
  approverSessionIdHash: string;
  approverRole: "owner";
  scope: "payment:requeue";
  primaryAssertionIdHash: string;
  bodySha256: string;
  actionDigest: string;
  decision: "approve";
  issuedAtMs: number;
  recentAuthAtMs: number;
  expiresAtMs: number;
  mfaMethod: PaymentOperatorMfaMethod;
  environment: "test_only";
};

export type VerifiedPaymentOperatorAuthorization = {
  schemaVersion: "velmere.payment-operator-action-authorization.v1";
  scope: PaymentOperatorActionScope;
  bodySha256: string;
  actionDigest: string;
  primaryAssertionIdHash: string;
  actorIdHash: string;
  sessionIdHash: string;
  independentApprovalIdHash: string | null;
  approverActorIdHash: string | null;
  expiresAtMs: number;
  bodyBound: true;
  singleUseRequired: true;
  phishingResistantMfaRequired: true;
  testOnly: true;
};

export class PaymentOperatorAuthorizationError extends Error {
  readonly code:
    | "payment_operator_env_blocked"
    | "payment_operator_runtime_mode_blocked"
    | "payment_operator_assertion_missing"
    | "payment_operator_assertion_invalid"
    | "payment_operator_assertion_expired"
    | "payment_operator_assertion_stale_auth"
    | "payment_operator_assertion_binding_mismatch"
    | "payment_operator_approval_missing"
    | "payment_operator_approval_invalid"
    | "payment_operator_approval_binding_mismatch"
    | "payment_operator_approval_not_independent"
    | "payment_operator_assertion_already_consumed"
    | "payment_operator_assertion_consume_failed";
  readonly status: 400 | 401 | 403 | 409 | 503;

  constructor(code: PaymentOperatorAuthorizationError["code"], status: PaymentOperatorAuthorizationError["status"]) {
    super(code);
    this.name = "PaymentOperatorAuthorizationError";
    this.code = code;
    this.status = status;
  }
}

const HEX64 = /^[a-f0-9]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{15,119}$/u;
const SAFE_PATH = /^\/api\/[a-z0-9/_-]{1,180}$/u;
const TOKEN_MAX_BYTES = 8 * 1024;
const MAX_CLOCK_SKEW_MS = 30_000;
const MAX_RECENT_AUTH_AGE_MS = 5 * 60_000;
const MAX_ASSERTION_LIFETIME_MS = 10 * 60_000;

function sha256Text(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function signPayload(payload64: string, secret: string) {
  return createHmac("sha256", secret).update(payload64, "utf8").digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = createHash("sha256").update(left, "utf8").digest();
  const b = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(a, b);
}

function encodeSignedToken(payload: Record<string, unknown>, secret: string) {
  const payload64 = Buffer.from(canonicalJson(payload), "utf8").toString("base64url");
  return `${payload64}.${signPayload(payload64, secret)}`;
}

function parseSignedToken<T>(token: string, secret: string): T | null {
  if (!token || Buffer.byteLength(token, "utf8") > TOKEN_MAX_BYTES || token.includes("=")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload64, signature] = parts;
  if (!payload64 || !signature || !/^[A-Za-z0-9_-]+$/u.test(payload64) || !/^[A-Za-z0-9_-]{43}$/u.test(signature)) return null;
  const expected = signPayload(payload64, secret);
  if (!safeEqual(expected, signature)) return null;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(payload64, "base64url");
  } catch {
    return null;
  }
  if (bytes.toString("base64url") !== payload64) return null;
  try {
    return JSON.parse(bytes.toString("utf8")) as T;
  } catch {
    return null;
  }
}

function actorHash(actorId: string) {
  return sha256Text(`velmere:payment-operator:actor:${actorId}`);
}

function sessionHash(sessionId: string) {
  return sha256Text(`velmere:payment-operator:session:${sessionId}`);
}

function bodyHash(rawBody: string) {
  return sha256Text(rawBody);
}

function actionDigest(input: { scope: PaymentOperatorActionScope; method: "POST"; path: string; bodySha256: string }) {
  return sha256Text(canonicalJson(input));
}

function validTimeWindow(input: { issuedAtMs: number; recentAuthAtMs: number; expiresAtMs: number; nowMs: number }) {
  if (![input.issuedAtMs, input.recentAuthAtMs, input.expiresAtMs].every(Number.isSafeInteger)) return "invalid" as const;
  if (input.issuedAtMs > input.nowMs + MAX_CLOCK_SKEW_MS || input.recentAuthAtMs > input.nowMs + MAX_CLOCK_SKEW_MS) return "invalid" as const;
  if (input.expiresAtMs <= input.nowMs) return "expired" as const;
  if (input.expiresAtMs <= input.issuedAtMs || input.expiresAtMs - input.issuedAtMs > MAX_ASSERTION_LIFETIME_MS) return "invalid" as const;
  if (input.nowMs - input.recentAuthAtMs > MAX_RECENT_AUTH_AGE_MS || input.recentAuthAtMs > input.issuedAtMs + MAX_CLOCK_SKEW_MS) return "stale_auth" as const;
  return "valid" as const;
}

function strictAssertionShape(value: PaymentOperatorAssertionPayload | null): value is PaymentOperatorAssertionPayload {
  if (!value || value.schemaVersion !== "velmere.payment-operator-assertion.v1") return false;
  return SAFE_ID.test(value.assertionId)
    && HEX64.test(value.actorIdHash)
    && HEX64.test(value.sessionIdHash)
    && (value.scope === "payment:reconcile" || value.scope === "payment:requeue")
    && value.method === "POST"
    && SAFE_PATH.test(value.path)
    && HEX64.test(value.bodySha256)
    && HEX64.test(value.actionDigest)
    && value.mfaMethod === "webauthn"
    && value.environment === "test_only";
}

function strictApprovalShape(value: PaymentIndependentApprovalPayload | null): value is PaymentIndependentApprovalPayload {
  if (!value || value.schemaVersion !== "velmere.payment-independent-approval.v1") return false;
  return SAFE_ID.test(value.approvalId)
    && HEX64.test(value.approverActorIdHash)
    && HEX64.test(value.approverSessionIdHash)
    && value.approverRole === "owner"
    && value.scope === "payment:requeue"
    && HEX64.test(value.primaryAssertionIdHash)
    && HEX64.test(value.bodySha256)
    && HEX64.test(value.actionDigest)
    && value.decision === "approve"
    && value.mfaMethod === "webauthn"
    && value.environment === "test_only";
}

export function verifyPaymentOperatorActionAuthorization(input: {
  session: VelmereAdminSession;
  scope: PaymentOperatorActionScope;
  method: "POST";
  path: string;
  rawBody: string;
  assertionToken: string | null | undefined;
  independentApprovalToken?: string | null;
  nowMs?: number;
  env?: NodeJS.ProcessEnv;
}): VerifiedPaymentOperatorAuthorization {
  const env = input.env ?? process.env;
  const assertionSecret = env.VELMERE_PAYMENT_OPERATOR_ASSERTION_SECRET?.trim() ?? "";
  const approvalSecret = env.VELMERE_PAYMENT_INDEPENDENT_APPROVAL_SECRET?.trim() ?? "";
  if (assertionSecret.length < 32 || (input.scope === "payment:requeue" && approvalSecret.length < 32)) {
    throw new PaymentOperatorAuthorizationError("payment_operator_env_blocked", 503);
  }
  const paymentAuthority = evaluateRuntimePaymentAuthority(env);
  if (!paymentAuthority.testPaymentsAllowed || paymentAuthority.requestedMode !== "test") {
    throw new PaymentOperatorAuthorizationError("payment_operator_runtime_mode_blocked", 503);
  }
  if (!input.assertionToken) {
    throw new PaymentOperatorAuthorizationError("payment_operator_assertion_missing", 401);
  }
  const assertion = parseSignedToken<PaymentOperatorAssertionPayload>(input.assertionToken, assertionSecret);
  if (!strictAssertionShape(assertion)) {
    throw new PaymentOperatorAuthorizationError("payment_operator_assertion_invalid", 401);
  }

  const nowMs = input.nowMs ?? Date.now();
  const computedBodySha256 = bodyHash(input.rawBody);
  const computedActionDigest = actionDigest({ scope: input.scope, method: input.method, path: input.path, bodySha256: computedBodySha256 });
  const expectedActorHash = actorHash(input.session.actorId);
  const expectedSessionHash = sessionHash(input.session.sessionId);
  if (
    assertion.scope !== input.scope
    || assertion.method !== input.method
    || assertion.path !== input.path
    || assertion.bodySha256 !== computedBodySha256
    || assertion.actionDigest !== computedActionDigest
    || assertion.actorIdHash !== expectedActorHash
    || assertion.sessionIdHash !== expectedSessionHash
  ) {
    throw new PaymentOperatorAuthorizationError("payment_operator_assertion_binding_mismatch", 403);
  }
  const primaryTime = validTimeWindow({ ...assertion, nowMs });
  if (primaryTime === "expired") throw new PaymentOperatorAuthorizationError("payment_operator_assertion_expired", 401);
  if (primaryTime === "stale_auth") throw new PaymentOperatorAuthorizationError("payment_operator_assertion_stale_auth", 403);
  if (primaryTime !== "valid") throw new PaymentOperatorAuthorizationError("payment_operator_assertion_invalid", 401);

  const primaryAssertionIdHash = sha256Text(`velmere:payment-operator:assertion:${assertion.assertionId}`);
  let independentApprovalIdHash: string | null = null;
  let approverActorIdHash: string | null = null;
  let expiresAtMs = assertion.expiresAtMs;

  if (input.scope === "payment:requeue") {
    if (!input.independentApprovalToken) {
      throw new PaymentOperatorAuthorizationError("payment_operator_approval_missing", 403);
    }
    const approval = parseSignedToken<PaymentIndependentApprovalPayload>(input.independentApprovalToken, approvalSecret);
    if (!strictApprovalShape(approval)) {
      throw new PaymentOperatorAuthorizationError("payment_operator_approval_invalid", 403);
    }
    const approvalTime = validTimeWindow({ ...approval, nowMs });
    if (approvalTime !== "valid") {
      throw new PaymentOperatorAuthorizationError(
        approvalTime === "stale_auth" ? "payment_operator_assertion_stale_auth" : approvalTime === "expired" ? "payment_operator_assertion_expired" : "payment_operator_approval_invalid",
        403,
      );
    }
    if (
      approval.scope !== input.scope
      || approval.primaryAssertionIdHash !== primaryAssertionIdHash
      || approval.bodySha256 !== computedBodySha256
      || approval.actionDigest !== computedActionDigest
    ) {
      throw new PaymentOperatorAuthorizationError("payment_operator_approval_binding_mismatch", 403);
    }
    if (approval.approverActorIdHash === expectedActorHash || approval.approverSessionIdHash === expectedSessionHash) {
      throw new PaymentOperatorAuthorizationError("payment_operator_approval_not_independent", 403);
    }
    independentApprovalIdHash = sha256Text(`velmere:payment-operator:approval:${approval.approvalId}`);
    approverActorIdHash = approval.approverActorIdHash;
    expiresAtMs = Math.min(expiresAtMs, approval.expiresAtMs);
  }

  return {
    schemaVersion: "velmere.payment-operator-action-authorization.v1",
    scope: input.scope,
    bodySha256: computedBodySha256,
    actionDigest: computedActionDigest,
    primaryAssertionIdHash,
    actorIdHash: expectedActorHash,
    sessionIdHash: expectedSessionHash,
    independentApprovalIdHash,
    approverActorIdHash,
    expiresAtMs,
    bodyBound: true,
    singleUseRequired: true,
    phishingResistantMfaRequired: true,
    testOnly: true,
  };
}

export async function consumePaymentOperatorActionAuthorization(input: {
  authorization: VerifiedPaymentOperatorAuthorization;
  clientOverride?: SupabaseRpcClient | null;
  deadlineMs?: number;
}) {
  const { authorization } = input;
  const { data } = await runBoundedServiceRoleRpc({
    operation: "payment_operator_assertion_consume",
    rpcName: "velmere_consume_payment_operator_action_assertion",
    args: {
      p_primary_assertion_id_hash: authorization.primaryAssertionIdHash,
      p_scope: authorization.scope,
      p_action_digest: authorization.actionDigest,
      p_body_sha256: authorization.bodySha256,
      p_actor_id_hash: authorization.actorIdHash,
      p_session_id_hash: authorization.sessionIdHash,
      p_independent_approval_id_hash: authorization.independentApprovalIdHash,
      p_approver_actor_id_hash: authorization.approverActorIdHash,
      p_expires_at_ms: authorization.expiresAtMs,
    },
    deadlineMs: input.deadlineMs ?? 5_000,
    clientOverride: input.clientOverride,
  });
  const state = String(data ?? "consume_failed");
  if (state === "already_consumed") {
    throw new PaymentOperatorAuthorizationError("payment_operator_assertion_already_consumed", 409);
  }
  if (state !== "consumed") {
    throw new PaymentOperatorAuthorizationError("payment_operator_assertion_consume_failed", 503);
  }
  return {
    schemaVersion: "velmere.payment-operator-consumption-receipt.v1" as const,
    consumed: true as const,
    durable: true as const,
    scope: authorization.scope,
    actionDigest: authorization.actionDigest,
    primaryAssertionIdHash: authorization.primaryAssertionIdHash,
    independentApprovalIdHash: authorization.independentApprovalIdHash,
  };
}

export async function executePaymentOperatorAction<T>(input: {
  session: VelmereAdminSession;
  scope: PaymentOperatorActionScope;
  method: "POST";
  path: string;
  rawBody: string;
  assertionToken: string | null | undefined;
  independentApprovalToken?: string | null;
  nowMs?: number;
  env?: NodeJS.ProcessEnv;
  clientOverride?: SupabaseRpcClient | null;
  execute: (authorization: VerifiedPaymentOperatorAuthorization) => Promise<T>;
}) {
  const authorization = verifyPaymentOperatorActionAuthorization(input);
  const consumption = await consumePaymentOperatorActionAuthorization({
    authorization,
    clientOverride: input.clientOverride,
  });
  const result = await input.execute(authorization);
  return { authorization, consumption, result };
}

export function buildPaymentOperatorAssertionReadiness(env: NodeJS.ProcessEnv = process.env) {
  const authority = evaluateRuntimePaymentAuthority(env);
  return {
    schemaVersion: "velmere.payment-operator-assertion-readiness.v1" as const,
    primaryAssertionSecretConfigured: (env.VELMERE_PAYMENT_OPERATOR_ASSERTION_SECRET?.trim().length ?? 0) >= 32,
    independentApprovalSecretConfigured: (env.VELMERE_PAYMENT_INDEPENDENT_APPROVAL_SECRET?.trim().length ?? 0) >= 32,
    testPaymentAuthorityReady: authority.testPaymentsAllowed && authority.requestedMode === "test",
    scopes: ["payment:reconcile", "payment:requeue"],
    requeueIndependentApprovalRequired: true,
    bodyBound: true,
    singleUseDurableConsumptionRequired: true,
    phishingResistantMfaRequired: true,
    productionBoundary: "Tokens must be issued only after server-side recent reauthentication and phishing-resistant MFA. This verifier does not itself provide the reauthentication UI or identity-provider ceremony.",
  };
}

export function createPaymentOperatorAssertionForServerTest(input: {
  session: VelmereAdminSession;
  scope: PaymentOperatorActionScope;
  path: string;
  rawBody: string;
  assertionId: string;
  nowMs: number;
  recentAuthAtMs?: number;
  expiresAtMs?: number;
  mfaMethod?: string;
  env?: NodeJS.ProcessEnv;
}) {
  const env = input.env ?? process.env;
  const secret = env.VELMERE_PAYMENT_OPERATOR_ASSERTION_SECRET?.trim() ?? "";
  if (secret.length < 32) throw new Error("payment_operator_test_secret_missing");
  const bodySha256 = bodyHash(input.rawBody);
  const payload: PaymentOperatorAssertionPayload = {
    schemaVersion: "velmere.payment-operator-assertion.v1",
    assertionId: input.assertionId,
    actorIdHash: actorHash(input.session.actorId),
    sessionIdHash: sessionHash(input.session.sessionId),
    scope: input.scope,
    method: "POST",
    path: input.path,
    bodySha256,
    actionDigest: actionDigest({ scope: input.scope, method: "POST", path: input.path, bodySha256 }),
    issuedAtMs: input.nowMs,
    recentAuthAtMs: input.recentAuthAtMs ?? input.nowMs,
    expiresAtMs: input.expiresAtMs ?? input.nowMs + 5 * 60_000,
    mfaMethod: (input.mfaMethod ?? "webauthn") as PaymentOperatorMfaMethod,
    environment: "test_only",
  };
  return encodeSignedToken(payload as unknown as Record<string, unknown>, secret);
}

export function createPaymentIndependentApprovalForServerTest(input: {
  primaryAssertionToken: string;
  approverActorId: string;
  approverSessionId: string;
  path: string;
  rawBody: string;
  approvalId: string;
  nowMs: number;
  recentAuthAtMs?: number;
  expiresAtMs?: number;
  env?: NodeJS.ProcessEnv;
}) {
  const env = input.env ?? process.env;
  const assertionSecret = env.VELMERE_PAYMENT_OPERATOR_ASSERTION_SECRET?.trim() ?? "";
  const approvalSecret = env.VELMERE_PAYMENT_INDEPENDENT_APPROVAL_SECRET?.trim() ?? "";
  if (assertionSecret.length < 32 || approvalSecret.length < 32) throw new Error("payment_operator_test_secret_missing");
  const primary = parseSignedToken<PaymentOperatorAssertionPayload>(input.primaryAssertionToken, assertionSecret);
  if (!strictAssertionShape(primary)) throw new Error("payment_operator_test_primary_invalid");
  const bodySha256 = bodyHash(input.rawBody);
  const digest = actionDigest({ scope: "payment:requeue", method: "POST", path: input.path, bodySha256 });
  const payload: PaymentIndependentApprovalPayload = {
    schemaVersion: "velmere.payment-independent-approval.v1",
    approvalId: input.approvalId,
    approverActorIdHash: actorHash(input.approverActorId),
    approverSessionIdHash: sessionHash(input.approverSessionId),
    approverRole: "owner",
    scope: "payment:requeue",
    primaryAssertionIdHash: sha256Text(`velmere:payment-operator:assertion:${primary.assertionId}`),
    bodySha256,
    actionDigest: digest,
    decision: "approve",
    issuedAtMs: input.nowMs,
    recentAuthAtMs: input.recentAuthAtMs ?? input.nowMs,
    expiresAtMs: input.expiresAtMs ?? input.nowMs + 5 * 60_000,
    mfaMethod: "webauthn",
    environment: "test_only",
  };
  return encodeSignedToken(payload as unknown as Record<string, unknown>, approvalSecret);
}
