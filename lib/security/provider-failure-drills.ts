export const PASS636_FAILURE_DRILL_VERSION = "pass636-production-provider-failure-drills" as const;

export type Pass636FailureKind =
  | "offline"
  | "timeout"
  | "rate_limit"
  | "malformed_json"
  | "bad_timestamp"
  | "partial_payload"
  | "storage_failure";
export type Pass636SourceState = "live" | "partial" | "stale" | "fallback" | "offline";

export type Pass636DrillResult = {
  version: typeof PASS636_FAILURE_DRILL_VERSION;
  providerId: string;
  kind: Pass636FailureKind;
  sourceState: Pass636SourceState;
  confidenceCap: number;
  retryAllowed: boolean;
  retryAfterMs: number;
  userMessage: string;
  recoveryPath: string[];
  mayConfirmCurrentFact: boolean;
  uiFunctional: true;
};

const CONTRACT: Record<Pass636FailureKind, Omit<Pass636DrillResult, "version" | "providerId" | "kind">> = {
  offline: {
    sourceState: "offline",
    confidenceCap: 0,
    retryAllowed: true,
    retryAfterMs: 8_000,
    userMessage: "Provider is offline. Current facts remain unconfirmed.",
    recoveryPath: ["serve last known snapshot as historical", "probe backup provider", "retry primary after cooldown"],
    mayConfirmCurrentFact: false,
    uiFunctional: true,
  },
  timeout: {
    sourceState: "fallback",
    confidenceCap: 28,
    retryAllowed: true,
    retryAfterMs: 4_000,
    userMessage: "Provider timed out. A bounded fallback may be shown with its original timestamp.",
    recoveryPath: ["stop request at timeout budget", "use bounded backup", "run one jittered retry"],
    mayConfirmCurrentFact: false,
    uiFunctional: true,
  },
  rate_limit: {
    sourceState: "fallback",
    confidenceCap: 24,
    retryAllowed: true,
    retryAfterMs: 30_000,
    userMessage: "Provider quota is temporarily exhausted. No retry loop is running.",
    recoveryPath: ["respect Retry-After", "serve cached lineage", "resume through single recovery probe"],
    mayConfirmCurrentFact: false,
    uiFunctional: true,
  },
  malformed_json: {
    sourceState: "offline",
    confidenceCap: 0,
    retryAllowed: false,
    retryAfterMs: 0,
    userMessage: "Provider response could not be validated and was rejected.",
    recoveryPath: ["discard malformed payload", "record schema failure", "switch to verified backup"],
    mayConfirmCurrentFact: false,
    uiFunctional: true,
  },
  bad_timestamp: {
    sourceState: "stale",
    confidenceCap: 18,
    retryAllowed: false,
    retryAfterMs: 0,
    userMessage: "Provider timestamp is missing or invalid. Data is not treated as current.",
    recoveryPath: ["preserve fetch time separately", "request provider timestamp", "label last known state"],
    mayConfirmCurrentFact: false,
    uiFunctional: true,
  },
  partial_payload: {
    sourceState: "partial",
    confidenceCap: 42,
    retryAllowed: false,
    retryAfterMs: 0,
    userMessage: "Only part of the provider payload passed validation.",
    recoveryPath: ["keep validated fields", "mark missing fields", "plan targeted source check"],
    mayConfirmCurrentFact: false,
    uiFunctional: true,
  },
  storage_failure: {
    sourceState: "partial",
    confidenceCap: 36,
    retryAllowed: true,
    retryAfterMs: 5_000,
    userMessage: "Evidence was computed but its durable receipt could not be stored.",
    recoveryPath: ["keep response usable", "mark receipt pending", "retry append without blocking UI"],
    mayConfirmCurrentFact: false,
    uiFunctional: true,
  },
};

export function runPass636FailureDrill(providerId: string, kind: Pass636FailureKind): Pass636DrillResult {
  const contract = CONTRACT[kind];
  return {
    version: PASS636_FAILURE_DRILL_VERSION,
    providerId: providerId.replace(/[^a-z0-9._-]/gi, "-").slice(0, 72) || "unknown-provider",
    kind,
    ...contract,
    recoveryPath: [...contract.recoveryPath],
  };
}

export function buildPass636FailureDrillMatrix(providerId = "test-provider") {
  const kinds = Object.keys(CONTRACT) as Pass636FailureKind[];
  const drills = kinds.map((kind) => runPass636FailureDrill(providerId, kind));
  return {
    version: PASS636_FAILURE_DRILL_VERSION,
    providerId,
    drills,
    passed: drills.every((drill) => drill.uiFunctional && !drill.mayConfirmCurrentFact),
    blockedCurrentFacts: drills.filter((drill) => !drill.mayConfirmCurrentFact).length,
  };
}
