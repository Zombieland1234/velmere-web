import type { Pass4394ClientRequestIdempotencyReceipt } from "@/lib/security/client-request-idempotency";
import { pass4394IdempotencyHeaders } from "@/lib/security/client-request-idempotency";

export const PASS4396_IDEMPOTENCY_REPLAY_BOUNDARY =
  "pass4396-idempotency-replay-boundary: a COMPLETED duplicate replays the atomically stored original status and JSON body, while PENDING, fingerprint conflicts and durable-store failures suppress side effects and return distinct fail-closed responses; raw client request ids and raw account scopes are never exposed" as const;

export type Pass4396ReplaySurface =
  | "contact_message"
  | "square_post"
  | "square_comment"
  | "commerce_checkout"
  | "vlm_service_checkout";

export type Pass4396IdempotencyReplayError =
  | "idempotency_request_pending"
  | "idempotency_request_fingerprint_conflict"
  | "idempotency_durable_store_unavailable";

export type Pass4396IdempotencyReplayReceipt = {
  passId: "PASS4396_IDEMPOTENCY_REPLAY_RECEIPT";
  ok: false;
  duplicate: boolean;
  replaySafe: true;
  originalOutcomeReplayed: boolean;
  sideEffectSuppressed: true;
  status: number;
  surface: Pass4396ReplaySurface;
  error?: Pass4396IdempotencyReplayError;
  clientRequestIdStoredRaw: false;
  accountScopeStoredRaw: false;
  bodyStoredRawBeforeCompletion: false;
  clientRequestIdHash?: string;
  idempotencyKeyHash?: string;
  requestFingerprintHash?: string;
  storageMode: Pass4394ClientRequestIdempotencyReceipt["storageMode"];
  durableStorageMode?: string;
  durable: boolean;
  durableState?: string;
  durableDisposition?: string;
  firstSeenAt?: string;
  duplicateSeenAt?: string;
  boundary: typeof PASS4396_IDEMPOTENCY_REPLAY_BOUNDARY;
};

function errorForReceipt(
  receipt: Pass4394ClientRequestIdempotencyReceipt,
): Pass4396IdempotencyReplayError | undefined {
  if (receipt.state === "completed_replay" && receipt.replayOutcome) return undefined;
  if (receipt.state === "request_fingerprint_conflict") {
    return "idempotency_request_fingerprint_conflict";
  }
  if (receipt.state === "durable_unavailable") {
    return "idempotency_durable_store_unavailable";
  }
  return "idempotency_request_pending";
}

function statusForReceipt(receipt: Pass4394ClientRequestIdempotencyReceipt) {
  if (receipt.state === "completed_replay" && receipt.replayOutcome) {
    return receipt.replayOutcome.status;
  }
  return receipt.state === "durable_unavailable" ? 503 : 409;
}

function cloneJsonValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? null)) as unknown;
}

export function buildPass4396IdempotencyReplayReceipt(args: {
  surface: Pass4396ReplaySurface;
  pass4394Idempotency: Pass4394ClientRequestIdempotencyReceipt;
}): Pass4396IdempotencyReplayReceipt {
  const originalOutcomeReplayed =
    args.pass4394Idempotency.state === "completed_replay"
    && Boolean(args.pass4394Idempotency.replayOutcome);
  return {
    passId: "PASS4396_IDEMPOTENCY_REPLAY_RECEIPT",
    ok: false,
    duplicate: args.pass4394Idempotency.duplicate,
    replaySafe: true,
    originalOutcomeReplayed,
    sideEffectSuppressed: true,
    status: statusForReceipt(args.pass4394Idempotency),
    surface: args.surface,
    ...(errorForReceipt(args.pass4394Idempotency)
      ? { error: errorForReceipt(args.pass4394Idempotency) }
      : {}),
    clientRequestIdStoredRaw: false,
    accountScopeStoredRaw: false,
    bodyStoredRawBeforeCompletion: false,
    clientRequestIdHash: args.pass4394Idempotency.clientRequestIdHash,
    idempotencyKeyHash: args.pass4394Idempotency.idempotencyKeyHash,
    requestFingerprintHash: args.pass4394Idempotency.requestFingerprintHash,
    storageMode: args.pass4394Idempotency.storageMode,
    durableStorageMode: args.pass4394Idempotency.pass4395Durable?.storageMode,
    durable: Boolean(args.pass4394Idempotency.pass4395Durable?.durable),
    durableState: args.pass4394Idempotency.durableState,
    durableDisposition: args.pass4394Idempotency.durableDisposition,
    firstSeenAt: args.pass4394Idempotency.firstSeenAt,
    duplicateSeenAt: args.pass4394Idempotency.duplicateSeenAt,
    boundary: PASS4396_IDEMPOTENCY_REPLAY_BOUNDARY,
  };
}

export function resolvePass4396IdempotencyReplay(args: {
  surface: Pass4396ReplaySurface;
  pass4394Idempotency: Pass4394ClientRequestIdempotencyReceipt;
}): {
  status: number;
  body: unknown;
  replayReceipt: Pass4396IdempotencyReplayReceipt;
} {
  const replayReceipt = buildPass4396IdempotencyReplayReceipt(args);
  const outcome = args.pass4394Idempotency.replayOutcome;
  if (replayReceipt.originalOutcomeReplayed && outcome) {
    return {
      status: outcome.status,
      body: cloneJsonValue(outcome.body),
      replayReceipt,
    };
  }
  return {
    status: replayReceipt.status,
    body: {
      ok: false,
      error: replayReceipt.error,
      pass4394Idempotency: args.pass4394Idempotency,
      pass4396Replay: replayReceipt,
    },
    replayReceipt,
  };
}

export function pass4396IdempotencyReplayResponse(args: {
  surface: Pass4396ReplaySurface;
  pass4394Idempotency: Pass4394ClientRequestIdempotencyReceipt;
}): Response {
  const replay = resolvePass4396IdempotencyReplay(args);
  return Response.json(replay.body, {
    status: replay.status,
    headers: pass4396IdempotencyReplayHeaders({
      pass4394Idempotency: args.pass4394Idempotency,
      replayReceipt: replay.replayReceipt,
    }),
  });
}

export function pass4396IdempotencyReplayHeaders(args: {
  replayReceipt: Pass4396IdempotencyReplayReceipt;
  pass4394Idempotency: Pass4394ClientRequestIdempotencyReceipt;
}): HeadersInit {
  return {
    ...pass4394IdempotencyHeaders(args.pass4394Idempotency),
    "cache-control": "no-store",
    "x-velmere-pass4396-replay-safe": "true",
    "x-velmere-pass4396-original-outcome-replayed":
      args.replayReceipt.originalOutcomeReplayed ? "true" : "false",
    "x-velmere-pass4396-side-effect-suppressed": "true",
    "x-velmere-pass4396-surface": args.replayReceipt.surface,
  };
}
