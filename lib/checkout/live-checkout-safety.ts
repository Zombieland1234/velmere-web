import type { Pass4394ClientRequestIdempotencyReceipt } from "@/lib/security/client-request-idempotency";

export type LiveCheckoutIdempotencyDecision =
  | {
      ok: true;
      code: "live_checkout_idempotency_ready";
      status: 200;
      retryable: false;
      retryMode: "none";
      storageMode: string;
    }
  | {
      ok: false;
      code: "checkout_idempotency_key_required";
      status: 428;
      retryable: true;
      retryMode: "new_client_request_id";
      storageMode: string;
    }
  | {
      ok: false;
      code: "checkout_durable_idempotency_required";
      status: 503;
      retryable: true;
      retryMode: "same_client_request_id";
      storageMode: string;
    };

export function assessLiveCheckoutIdempotency(
  receipt: Pick<
    Pass4394ClientRequestIdempotencyReceipt,
    "clientRequestIdPresent" | "storageMode" | "pass4395Durable"
  >,
): LiveCheckoutIdempotencyDecision {
  const storageMode = receipt.pass4395Durable?.storageMode ?? receipt.storageMode;
  if (!receipt.clientRequestIdPresent) {
    return {
      ok: false,
      code: "checkout_idempotency_key_required",
      status: 428,
      retryable: true,
      retryMode: "new_client_request_id",
      storageMode,
    };
  }
  if (!receipt.pass4395Durable?.durable) {
    return {
      ok: false,
      code: "checkout_durable_idempotency_required",
      status: 503,
      retryable: true,
      retryMode: "same_client_request_id",
      storageMode,
    };
  }
  return {
    ok: true,
    code: "live_checkout_idempotency_ready",
    status: 200,
    retryable: false,
    retryMode: "none",
    storageMode,
  };
}
