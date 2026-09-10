import { randomUUID } from "node:crypto";
import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import {
  completeStripeWebhookEffectSnapshot,
  deadLetterStripeWebhookEffectSnapshot,
  decideStripeWebhookEffectClaim,
  failStripeWebhookEffectSnapshot,
  type StripeWebhookEffectSnapshot,
} from "./stripe-webhook-effect-state";

export const STRIPE_WEBHOOK_EFFECT_STALE_MS = 5 * 60 * 1_000;
const MAX_RECEIPT_BYTES = 16_384;
const SAFE_EFFECT_KEY = /^[a-z0-9][a-z0-9:_-]{0,119}$/;

type MemoryEffectStore = Map<string, StripeWebhookEffectSnapshot>;

type ClaimedEffect = {
  kind: "claimed";
  attempt: number;
  leaseToken: string;
};

type CompletedEffect<TReceipt> = {
  kind: "completed";
  attempt: number;
  receipt: TReceipt;
};

type BusyEffect = {
  kind: "busy";
  attempt: number;
  retryAfterSeconds: number;
};

type DeadLetterEffect = {
  kind: "dead_letter";
  attempt: number;
};

function memoryStore(): MemoryEffectStore {
  const runtime = globalThis as typeof globalThis & {
    __velmereStripeWebhookEffects?: MemoryEffectStore;
  };
  runtime.__velmereStripeWebhookEffects ??= new Map();
  return runtime.__velmereStripeWebhookEffects;
}

function storageKey(eventId: string, effectKey: string) {
  return `${eventId}:${effectKey}`;
}

function requiresDurableStorage() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function hasServiceRoleStorage() {
  return hasSupabaseServiceRoleConfig();
}

function normalizeIdentity(value: string, label: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`stripe_webhook_effect_invalid_${label}`);
  }
  return normalized;
}

function normalizeEffectKey(value: string) {
  const normalized = normalizeIdentity(value, "effect_key", 120).toLowerCase();
  if (!SAFE_EFFECT_KEY.test(normalized)) {
    throw new Error("stripe_webhook_effect_invalid_effect_key");
  }
  return normalized;
}

function normalizeReceipt<TReceipt>(receipt: TReceipt): TReceipt {
  const encoded = JSON.stringify(receipt);
  if (encoded === undefined) throw new Error("stripe_webhook_effect_receipt_not_json");
  if (Buffer.byteLength(encoded, "utf8") > MAX_RECEIPT_BYTES) {
    throw new Error("stripe_webhook_effect_receipt_too_large");
  }
  return JSON.parse(encoded) as TReceipt;
}

function normalizeErrorCode(error: unknown) {
  return (error instanceof Error ? error.message : "stripe_webhook_effect_failed")
    .replace(/[^a-zA-Z0-9:_-]/g, "_")
    .slice(0, 160);
}

export class StripeWebhookTerminalEffectError extends Error {
  readonly terminal = true;

  constructor(errorCode: string) {
    super(normalizeErrorCode(new Error(errorCode)) || "stripe_webhook_effect_terminal_failure");
    this.name = "StripeWebhookTerminalEffectError";
  }
}

export function isStripeWebhookTerminalEffectError(
  error: unknown,
): error is StripeWebhookTerminalEffectError {
  return error instanceof StripeWebhookTerminalEffectError;
}

function failureFromReceipt(receipt: unknown): Error | null {
  if (!receipt || typeof receipt !== "object" || (receipt as { ok?: unknown }).ok !== false) {
    return null;
  }
  const value = receipt as {
    error?: unknown;
    retryable?: unknown;
    terminal?: unknown;
  };
  const errorCode = typeof value.error === "string" && value.error.trim()
    ? value.error
    : "stripe_webhook_effect_callback_rejected";
  if (value.terminal === true || value.retryable === false) {
    return new StripeWebhookTerminalEffectError(errorCode);
  }
  // Missing retryability is deliberately fail-safe: Stripe must retry instead
  // of silently dropping a paid entitlement or fulfilment side effect.
  return new Error(normalizeErrorCode(new Error(errorCode)));
}

export async function claimStripeWebhookEffect<TReceipt>(input: {
  eventId: string;
  eventType: string;
  effectKey: string;
  staleAfterMs?: number;
}): Promise<ClaimedEffect | CompletedEffect<TReceipt> | BusyEffect | DeadLetterEffect> {
  const eventId = normalizeIdentity(input.eventId, "event_id", 180);
  const eventType = normalizeIdentity(input.eventType, "event_type", 180);
  const effectKey = normalizeEffectKey(input.effectKey);
  const staleAfterMs = Math.max(1_000, Math.floor(input.staleAfterMs ?? STRIPE_WEBHOOK_EFFECT_STALE_MS));
  const requestedLeaseToken = randomUUID();

  if (!hasServiceRoleStorage()) {
    if (requiresDurableStorage()) {
      throw new Error("stripe_webhook_effect_storage_unavailable");
    }
    const key = storageKey(eventId, effectKey);
    let current = (memoryStore().get(key) as StripeWebhookEffectSnapshot<TReceipt> | undefined) ?? null;
    const storedFailure = current?.status === "completed"
      ? failureFromReceipt(current.receipt)
      : null;
    if (storedFailure && current) {
      current = {
        ...current,
        status: isStripeWebhookTerminalEffectError(storedFailure)
          ? "dead_letter"
          : "retryable_failed",
        leaseToken: null,
        receipt: undefined,
        lastErrorCode: normalizeErrorCode(storedFailure),
      };
      memoryStore().set(key, current as StripeWebhookEffectSnapshot);
    }
    const decision = decideStripeWebhookEffectClaim<TReceipt>({
      current,
      nowMs: Date.now(),
      staleAfterMs,
      requestedLeaseToken,
    });
    memoryStore().set(key, decision.next as StripeWebhookEffectSnapshot);
    if (decision.kind === "claimed") {
      return { kind: "claimed", attempt: decision.attempt, leaseToken: decision.leaseToken };
    }
    if (decision.kind === "completed") {
      return { kind: "completed", attempt: decision.attempt, receipt: decision.receipt };
    }
    if (decision.kind === "dead_letter") {
      return { kind: "dead_letter", attempt: decision.attempt };
    }
    return { kind: "busy", attempt: decision.attempt, retryAfterSeconds: decision.retryAfterSeconds };
  }

  let data: unknown;
  try {
    ({ data } = await runRegisteredServiceRoleRpc({
      operation: "stripe_webhook_effect_claim",
      args: {
        p_event_id: eventId,
        p_event_type: eventType,
        p_effect_key: effectKey,
        p_requested_lease_token: requestedLeaseToken,
        p_stale_after_seconds: Math.floor(staleAfterMs / 1_000),
      },
    }));
  } catch {
    throw new Error("stripe_webhook_effect_claim_failed");
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("stripe_webhook_effect_claim_empty_result");
  const status = String(row.status ?? "processing");
  if (status === "completed") {
    return {
      kind: "completed",
      attempt: Number(row.attempt_count ?? 1),
      receipt: (row.result_json ?? null) as TReceipt,
    };
  }
  if (status === "dead_letter") {
    return {
      kind: "dead_letter",
      attempt: Number(row.attempt_count ?? 1),
    };
  }
  if (!row.claimed) {
    return {
      kind: "busy",
      attempt: Number(row.attempt_count ?? 1),
      retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds ?? 5)),
    };
  }
  return {
    kind: "claimed",
    attempt: Number(row.attempt_count ?? 1),
    leaseToken: String(row.lease_token ?? requestedLeaseToken),
  };
}

export async function completeStripeWebhookEffect<TReceipt>(input: {
  eventId: string;
  effectKey: string;
  expectedAttempt: number;
  leaseToken: string;
  receipt: TReceipt;
}) {
  const eventId = normalizeIdentity(input.eventId, "event_id", 180);
  const effectKey = normalizeEffectKey(input.effectKey);
  const receipt = normalizeReceipt(input.receipt);

  if (!hasServiceRoleStorage()) {
    if (requiresDurableStorage()) throw new Error("stripe_webhook_effect_storage_unavailable");
    const key = storageKey(eventId, effectKey);
    const completed = completeStripeWebhookEffectSnapshot({
      current: memoryStore().get(key) ?? null,
      expectedAttempt: input.expectedAttempt,
      expectedLeaseToken: input.leaseToken,
      receipt,
    });
    memoryStore().set(key, completed as StripeWebhookEffectSnapshot);
    return;
  }

  let data: unknown;
  try {
    ({ data } = await runRegisteredServiceRoleRpc({
      operation: "stripe_webhook_effect_complete",
      args: {
        p_event_id: eventId,
        p_effect_key: effectKey,
        p_expected_attempt: Math.max(1, Math.floor(input.expectedAttempt)),
        p_lease_token: input.leaseToken,
        p_result_json: receipt,
      },
    }));
  } catch {
    throw new Error("stripe_webhook_effect_completion_failed");
  }
  if (data !== true) throw new Error("stripe_webhook_effect_stale_completion");
}

export async function failStripeWebhookEffect(input: {
  eventId: string;
  effectKey: string;
  expectedAttempt: number;
  leaseToken: string;
  errorCode: string;
}) {
  const eventId = normalizeIdentity(input.eventId, "event_id", 180);
  const effectKey = normalizeEffectKey(input.effectKey);
  const errorCode = normalizeErrorCode(input.errorCode);

  if (!hasServiceRoleStorage()) {
    if (requiresDurableStorage()) throw new Error("stripe_webhook_effect_storage_unavailable");
    const key = storageKey(eventId, effectKey);
    const failed = failStripeWebhookEffectSnapshot({
      current: memoryStore().get(key) ?? null,
      expectedAttempt: input.expectedAttempt,
      expectedLeaseToken: input.leaseToken,
      errorCode,
    });
    memoryStore().set(key, failed as StripeWebhookEffectSnapshot);
    return;
  }

  let data: unknown;
  try {
    ({ data } = await runRegisteredServiceRoleRpc({
      operation: "stripe_webhook_effect_fail",
      args: {
        p_event_id: eventId,
        p_effect_key: effectKey,
        p_expected_attempt: Math.max(1, Math.floor(input.expectedAttempt)),
        p_lease_token: input.leaseToken,
        p_error_code: errorCode,
      },
    }));
  } catch {
    throw new Error("stripe_webhook_effect_failure_write_failed");
  }
  if (data !== true) throw new Error("stripe_webhook_effect_stale_failure");
}

export async function deadLetterStripeWebhookEffect(input: {
  eventId: string;
  effectKey: string;
  expectedAttempt: number;
  leaseToken: string;
  errorCode: string;
}) {
  const eventId = normalizeIdentity(input.eventId, "event_id", 180);
  const effectKey = normalizeEffectKey(input.effectKey);
  const errorCode = normalizeErrorCode(input.errorCode);

  if (!hasServiceRoleStorage()) {
    if (requiresDurableStorage()) throw new Error("stripe_webhook_effect_storage_unavailable");
    const key = storageKey(eventId, effectKey);
    const deadLettered = deadLetterStripeWebhookEffectSnapshot({
      current: memoryStore().get(key) ?? null,
      expectedAttempt: input.expectedAttempt,
      expectedLeaseToken: input.leaseToken,
      errorCode,
    });
    memoryStore().set(key, deadLettered as StripeWebhookEffectSnapshot);
    return;
  }

  let data: unknown;
  try {
    ({ data } = await runRegisteredServiceRoleRpc({
      operation: "stripe_webhook_effect_dead_letter",
      args: {
        p_event_id: eventId,
        p_effect_key: effectKey,
        p_expected_attempt: Math.max(1, Math.floor(input.expectedAttempt)),
        p_lease_token: input.leaseToken,
        p_error_code: errorCode,
      },
    }));
  } catch {
    throw new Error("stripe_webhook_effect_dead_letter_write_failed");
  }
  if (data !== true) throw new Error("stripe_webhook_effect_stale_dead_letter");
}

export type StripeWebhookEffectRunnerDependencies = {
  claim: typeof claimStripeWebhookEffect;
  complete: typeof completeStripeWebhookEffect;
  fail: typeof failStripeWebhookEffect;
  deadLetter: typeof deadLetterStripeWebhookEffect;
};

export const stripeWebhookEffectRunnerDependencies: StripeWebhookEffectRunnerDependencies = {
  claim: claimStripeWebhookEffect,
  complete: completeStripeWebhookEffect,
  fail: failStripeWebhookEffect,
  deadLetter: deadLetterStripeWebhookEffect,
};

export async function runStripeWebhookEffect<TReceipt>(input: {
  eventId: string;
  eventType: string;
  effectKey: string;
  execute: () => Promise<TReceipt>;
}, dependencies: StripeWebhookEffectRunnerDependencies = stripeWebhookEffectRunnerDependencies): Promise<{ source: "executed" | "replayed"; attempt: number; receipt: TReceipt }> {
  const claim = await dependencies.claim<TReceipt>(input);
  if (claim.kind === "completed") {
    const replayFailure = failureFromReceipt(claim.receipt);
    if (replayFailure) throw replayFailure;
    return { source: "replayed", attempt: claim.attempt, receipt: claim.receipt };
  }
  if (claim.kind === "dead_letter") {
    throw new StripeWebhookTerminalEffectError("stripe_webhook_effect_dead_lettered");
  }
  if (claim.kind === "busy") {
    throw new Error(`stripe_webhook_effect_in_progress:${claim.retryAfterSeconds}`);
  }

  let receipt: TReceipt;
  try {
    receipt = normalizeReceipt(await input.execute());
    const callbackFailure = failureFromReceipt(receipt);
    if (callbackFailure) throw callbackFailure;
  } catch (error) {
    try {
      const settle = {
        eventId: input.eventId,
        effectKey: input.effectKey,
        expectedAttempt: claim.attempt,
        leaseToken: claim.leaseToken,
        errorCode: normalizeErrorCode(error),
      };
      if (isStripeWebhookTerminalEffectError(error)) {
        await dependencies.deadLetter(settle);
      } else {
        await dependencies.fail(settle);
      }
    } catch {
      // Preserve the original effect error. Ingress will still fail closed.
    }
    throw error;
  }

  await dependencies.complete({
    eventId: input.eventId,
    effectKey: input.effectKey,
    expectedAttempt: claim.attempt,
    leaseToken: claim.leaseToken,
    receipt,
  });
  return { source: "executed", attempt: claim.attempt, receipt };
}
