export type StripeWebhookEffectStatus =
  | "processing"
  | "completed"
  | "retryable_failed"
  | "dead_letter";

export type StripeWebhookEffectSnapshot<TReceipt = unknown> = {
  status: StripeWebhookEffectStatus;
  attemptCount: number;
  leaseToken: string | null;
  claimedAtMs: number;
  receipt?: TReceipt;
  lastErrorCode?: string;
};

export type StripeWebhookEffectClaimDecision<TReceipt = unknown> =
  | {
      kind: "claimed";
      attempt: number;
      leaseToken: string;
      next: StripeWebhookEffectSnapshot<TReceipt>;
    }
  | {
      kind: "completed";
      attempt: number;
      receipt: TReceipt;
      next: StripeWebhookEffectSnapshot<TReceipt>;
    }
  | {
      kind: "busy";
      attempt: number;
      retryAfterSeconds: number;
      next: StripeWebhookEffectSnapshot<TReceipt>;
    }
  | {
      kind: "dead_letter";
      attempt: number;
      next: StripeWebhookEffectSnapshot<TReceipt>;
    };

export function decideStripeWebhookEffectClaim<TReceipt>(input: {
  current: StripeWebhookEffectSnapshot<TReceipt> | null;
  nowMs: number;
  staleAfterMs: number;
  requestedLeaseToken: string;
}): StripeWebhookEffectClaimDecision<TReceipt> {
  const staleAfterMs = Math.max(1_000, Math.floor(input.staleAfterMs));
  const nowMs = Math.max(0, Math.floor(input.nowMs));
  const current = input.current;

  if (current?.status === "completed") {
    return {
      kind: "completed",
      attempt: current.attemptCount,
      receipt: current.receipt as TReceipt,
      next: current,
    };
  }

  if (current?.status === "dead_letter") {
    return {
      kind: "dead_letter",
      attempt: current.attemptCount,
      next: current,
    };
  }

  if (
    current?.status === "processing" &&
    nowMs - current.claimedAtMs < staleAfterMs
  ) {
    return {
      kind: "busy",
      attempt: current.attemptCount,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((staleAfterMs - (nowMs - current.claimedAtMs)) / 1_000),
      ),
      next: current,
    };
  }

  const next: StripeWebhookEffectSnapshot<TReceipt> = {
    status: "processing",
    attemptCount: (current?.attemptCount ?? 0) + 1,
    leaseToken: input.requestedLeaseToken,
    claimedAtMs: nowMs,
  };
  return {
    kind: "claimed",
    attempt: next.attemptCount,
    leaseToken: input.requestedLeaseToken,
    next,
  };
}

export function completeStripeWebhookEffectSnapshot<TReceipt>(input: {
  current: StripeWebhookEffectSnapshot<TReceipt> | null;
  expectedAttempt: number;
  expectedLeaseToken: string;
  receipt: TReceipt;
}): StripeWebhookEffectSnapshot<TReceipt> {
  const current = input.current;
  if (
    !current ||
    current.status !== "processing" ||
    current.attemptCount !== Math.max(1, Math.floor(input.expectedAttempt)) ||
    current.leaseToken !== input.expectedLeaseToken
  ) {
    throw new Error("stripe_webhook_effect_stale_completion");
  }
  return {
    ...current,
    status: "completed",
    leaseToken: null,
    receipt: input.receipt,
    lastErrorCode: undefined,
  };
}

export function failStripeWebhookEffectSnapshot<TReceipt>(input: {
  current: StripeWebhookEffectSnapshot<TReceipt> | null;
  expectedAttempt: number;
  expectedLeaseToken: string;
  errorCode: string;
}): StripeWebhookEffectSnapshot<TReceipt> {
  const current = input.current;
  if (
    !current ||
    current.status !== "processing" ||
    current.attemptCount !== Math.max(1, Math.floor(input.expectedAttempt)) ||
    current.leaseToken !== input.expectedLeaseToken
  ) {
    throw new Error("stripe_webhook_effect_stale_failure");
  }
  return {
    ...current,
    status: "retryable_failed",
    leaseToken: null,
    lastErrorCode: input.errorCode.slice(0, 160),
  };
}

export function deadLetterStripeWebhookEffectSnapshot<TReceipt>(input: {
  current: StripeWebhookEffectSnapshot<TReceipt> | null;
  expectedAttempt: number;
  expectedLeaseToken: string;
  errorCode: string;
}): StripeWebhookEffectSnapshot<TReceipt> {
  const current = input.current;
  if (
    !current ||
    current.status !== "processing" ||
    current.attemptCount !== Math.max(1, Math.floor(input.expectedAttempt)) ||
    current.leaseToken !== input.expectedLeaseToken
  ) {
    throw new Error("stripe_webhook_effect_stale_dead_letter");
  }
  return {
    ...current,
    status: "dead_letter",
    leaseToken: null,
    receipt: undefined,
    lastErrorCode: input.errorCode.slice(0, 160),
  };
}
