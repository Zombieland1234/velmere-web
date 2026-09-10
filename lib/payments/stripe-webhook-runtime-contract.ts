export type StripeRuntimeAuthoritySnapshot = {
  credentialMode: "test" | "live" | "missing" | "mixed";
  requestedMode: "test" | "live" | "missing";
  modeMatches: boolean;
  testPaymentsAllowed: boolean;
  livePaymentsAllowed: boolean;
  blockers?: readonly string[];
};

export type StripeWebhookRuntimeContractInput = {
  eventId: unknown;
  eventType: unknown;
  eventCreatedAt: unknown;
  eventLivemode: unknown;
  authority: StripeRuntimeAuthoritySnapshot;
  nowUnixSeconds?: number;
  maxFutureSkewSeconds?: number;
};

export type StripeWebhookRuntimeContractVerdict =
  | {
      ok: true;
      expectedMode: "test" | "live";
      eventLivemode: boolean;
    }
  | {
      ok: false;
      error:
        | "stripe_event_identity_invalid"
        | "stripe_event_created_invalid"
        | "stripe_event_created_in_future"
        | "stripe_event_livemode_invalid"
        | "payment_runtime_mode_missing"
        | "payment_runtime_credentials_invalid"
        | "payment_runtime_mode_mismatch"
        | "payment_runtime_authority_closed"
        | "stripe_event_runtime_mode_mismatch";
      retryable: boolean;
      terminal: boolean;
      expectedMode?: "test" | "live";
    };

const SAFE_EVENT_ID = /^evt_[A-Za-z0-9_-]{4,176}$/u;
const SAFE_EVENT_TYPE = /^[a-z0-9_]+(?:\.[a-z0-9_]+){1,5}$/u;

export function evaluateStripeWebhookRuntimeContract(
  input: StripeWebhookRuntimeContractInput,
): StripeWebhookRuntimeContractVerdict {
  if (
    typeof input.eventId !== "string" ||
    !SAFE_EVENT_ID.test(input.eventId) ||
    typeof input.eventType !== "string" ||
    !SAFE_EVENT_TYPE.test(input.eventType)
  ) {
    return {
      ok: false,
      error: "stripe_event_identity_invalid",
      retryable: false,
      terminal: true,
    };
  }

  if (!Number.isSafeInteger(input.eventCreatedAt) || Number(input.eventCreatedAt) <= 0) {
    return {
      ok: false,
      error: "stripe_event_created_invalid",
      retryable: false,
      terminal: true,
    };
  }
  const nowUnixSeconds = Number.isSafeInteger(input.nowUnixSeconds)
    ? Number(input.nowUnixSeconds)
    : Math.floor(Date.now() / 1_000);
  const maxFutureSkewSeconds = Number.isSafeInteger(input.maxFutureSkewSeconds)
    ? Math.max(0, Math.min(900, Number(input.maxFutureSkewSeconds)))
    : 300;
  if (Number(input.eventCreatedAt) > nowUnixSeconds + maxFutureSkewSeconds) {
    return {
      ok: false,
      error: "stripe_event_created_in_future",
      retryable: false,
      terminal: true,
    };
  }

  if (typeof input.eventLivemode !== "boolean") {
    return {
      ok: false,
      error: "stripe_event_livemode_invalid",
      retryable: false,
      terminal: true,
    };
  }

  const authority = input.authority;
  if (authority.requestedMode === "missing") {
    return {
      ok: false,
      error: "payment_runtime_mode_missing",
      retryable: true,
      terminal: false,
    };
  }
  const expectedMode = authority.requestedMode;
  if (authority.credentialMode === "missing" || authority.credentialMode === "mixed") {
    return {
      ok: false,
      error: "payment_runtime_credentials_invalid",
      retryable: true,
      terminal: false,
      expectedMode,
    };
  }
  if (!authority.modeMatches || authority.credentialMode !== expectedMode) {
    return {
      ok: false,
      error: "payment_runtime_mode_mismatch",
      retryable: true,
      terminal: false,
      expectedMode,
    };
  }
  const authorityOpen = expectedMode === "test"
    ? authority.testPaymentsAllowed
    : authority.livePaymentsAllowed;
  if (!authorityOpen) {
    return {
      ok: false,
      error: "payment_runtime_authority_closed",
      retryable: true,
      terminal: false,
      expectedMode,
    };
  }
  if (input.eventLivemode !== (expectedMode === "live")) {
    return {
      ok: false,
      error: "stripe_event_runtime_mode_mismatch",
      retryable: false,
      terminal: true,
      expectedMode,
    };
  }
  return {
    ok: true,
    expectedMode,
    eventLivemode: input.eventLivemode,
  };
}
