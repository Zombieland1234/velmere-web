import crypto from "node:crypto";
import type {
  VlmBehavioralEffect,
  VlmBehavioralTraceEvent,
} from "@/lib/ai/vlm-behavioral-trace";

export const A88R2_REVISION =
  "VELMERE_PASS36_A88R2_BEHAVIORAL_HANDLER_AND_RESIGNED_SEMANTIC_MUTATION_CLOSURE" as const;
export const A88R2_SCHEMA =
  "velmere.pass36.a88r2.behavioral-handler-envelope.v3" as const;

export type A88R2Handler = "brain" | "angel" | "risk";
export type A88R2ExpectedDecision =
  | "BLOCKED_PREFLIGHT"
  | "ALLOWED_WITHHELD_CONTROL"
  | "ALLOWED_ENTITLEMENT_CONTROL";

export type A88R2DependencySpies = {
  securityTelemetry: number;
  rateLimit: number;
  access: number;
  marketProvider: number;
  model: number;
  tool: number;
  durable: number;
};

export type A88R2EnvelopeCore = {
  schemaVersion: typeof A88R2_SCHEMA;
  revisionId: typeof A88R2_REVISION;
  caseId: string;
  requestId: string;
  handler: A88R2Handler;
  expectedDecision: A88R2ExpectedDecision;
  observedStatus: number;
  requestHmac: string;
  responseHmac: string;
  handlerSourceSha256: string;
  verifierSourceSha256: string;
  dependencySpies: A88R2DependencySpies;
  trace: VlmBehavioralTraceEvent[];
  traceSha256: string;
  promotion: {
    live: false;
    saleEnabled: false;
    productionApproved: false;
    worldClassProven: false;
  };
};

export type A88R2SignedEnvelope = A88R2EnvelopeCore & {
  integrity: {
    algorithm: "HMAC-SHA256";
    signature: string;
  };
};

export type A88R2VerificationContext = {
  handler: A88R2Handler;
  requestHmac: string;
  responseHmac: string;
  observedStatus: number;
  handlerSourceSha256: string;
  verifierSourceSha256: string;
  dependencySpies: A88R2DependencySpies;
};

const DIGEST = /^[a-f0-9]{64}$/u;
const CASE_ID = /^[a-z0-9][a-z0-9._:-]{7,127}$/u;
const REQUEST_ID = /^[a-f0-9]{32}$/u;
const STAGE = /^[a-z][a-z0-9_]{2,63}$/u;
const EFFECTS: VlmBehavioralEffect[] = [
  "access",
  "market_provider",
  "model",
  "tool",
  "durable",
  "security_telemetry",
];
const OUTCOMES = ["ENTER", "CALLED", "RETURNED", "REJECTED", "THREW"];
const CORE_KEYS = [
  "caseId",
  "dependencySpies",
  "expectedDecision",
  "handler",
  "handlerSourceSha256",
  "observedStatus",
  "promotion",
  "requestHmac",
  "requestId",
  "responseHmac",
  "revisionId",
  "schemaVersion",
  "trace",
  "traceSha256",
  "verifierSourceSha256",
].sort();
const SIGNED_KEYS = [...CORE_KEYS, "integrity"].sort();
const INTEGRITY_KEYS = ["algorithm", "signature"].sort();
const PROMOTION_KEYS = [
  "live",
  "productionApproved",
  "saleEnabled",
  "worldClassProven",
].sort();
const TRACE_KEYS = ["effect", "outcome", "sequence", "stage"].sort();
const DEPENDENCY_SPY_KEYS = [
  "access",
  "durable",
  "marketProvider",
  "model",
  "rateLimit",
  "securityTelemetry",
  "tool",
].sort();

const STAGE_CONTRACT: Record<
  string,
  { effect: VlmBehavioralEffect | null; outcome: VlmBehavioralTraceEvent["outcome"] }
> = {
  handler_enter: { effect: null, outcome: "ENTER" },
  security_query_inspection: {
    effect: "security_telemetry",
    outcome: "CALLED",
  },
  security_prompt_inspection: {
    effect: "security_telemetry",
    outcome: "CALLED",
  },
  preflight_rejected: { effect: null, outcome: "REJECTED" },
  preflight_accepted: { effect: null, outcome: "RETURNED" },
  access: { effect: "access", outcome: "CALLED" },
  access_rejected: { effect: null, outcome: "REJECTED" },
  market_resolver: { effect: "market_provider", outcome: "CALLED" },
  publication_withheld: { effect: null, outcome: "REJECTED" },
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256A88R2(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hmacA88R2(value: string | Buffer, key: Buffer): string {
  if (!Buffer.isBuffer(key) || key.length < 32) {
    throw new Error("a88r2_hmac_key_too_short");
  }
  return crypto.createHmac("sha256", key).update(value).digest("hex");
}

function exactKeys(value: unknown, expected: string[]): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      JSON.stringify(Object.keys(value as Record<string, unknown>).sort()) ===
        JSON.stringify(expected),
  );
}

function signatureFor(core: A88R2EnvelopeCore, key: Buffer): string {
  return hmacA88R2(canonicalJson(core), key);
}

function traceStages(trace: VlmBehavioralTraceEvent[]): string[] {
  return trace.map((event) => event.stage);
}

function effectCounts(trace: VlmBehavioralTraceEvent[]) {
  return Object.fromEntries(
    EFFECTS.map((effect) => [
      effect,
      trace.filter((event) => event.effect === effect).length,
    ]),
  ) as Record<VlmBehavioralEffect, number>;
}

function expectedTraceStages(
  handler: A88R2Handler,
  decision: A88R2ExpectedDecision,
  securityInspectionCount: number,
): string[][] {
  const security =
    securityInspectionCount === 2
      ? ["security_query_inspection", "security_prompt_inspection"]
      : [];
  if (decision === "BLOCKED_PREFLIGHT") {
    return [["handler_enter", ...security, "preflight_rejected"]];
  }
  if (handler === "risk" && decision === "ALLOWED_ENTITLEMENT_CONTROL") {
    return [[
      "handler_enter",
      ...security,
      "preflight_accepted",
      "access",
      "access_rejected",
    ]];
  }
  if (
    (handler === "brain" || handler === "angel") &&
    decision === "ALLOWED_WITHHELD_CONTROL"
  ) {
    return [[
      "handler_enter",
      ...security,
      "preflight_accepted",
      "access",
      "market_resolver",
      "publication_withheld",
    ]];
  }
  return [];
}

export function signA88R2Envelope(
  core: A88R2EnvelopeCore,
  key: Buffer,
): A88R2SignedEnvelope {
  if (!Buffer.isBuffer(key) || key.length < 32) {
    throw new Error("a88r2_hmac_key_too_short");
  }
  return {
    ...structuredClone(core),
    integrity: {
      algorithm: "HMAC-SHA256",
      signature: signatureFor(core, key),
    },
  };
}

export function verifyA88R2Envelope(
  value: unknown,
  key: Buffer,
  context: A88R2VerificationContext,
) {
  const failures: string[] = [];
  const add = (condition: unknown, code: string) => {
    if (!condition) failures.push(code);
  };

  add(Buffer.isBuffer(key) && key.length >= 32, "hmac_key_invalid");
  add(exactKeys(value, SIGNED_KEYS), "signed_fields_not_exact");
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { passed: false, failures, effects: null };
  }

  const signed = value as A88R2SignedEnvelope;
  add(exactKeys(signed.promotion, PROMOTION_KEYS), "promotion_fields_not_exact");
  add(exactKeys(signed.integrity, INTEGRITY_KEYS), "integrity_fields_not_exact");
  add(
    exactKeys(signed.dependencySpies, DEPENDENCY_SPY_KEYS),
    "dependency_spy_fields_not_exact",
  );
  add(signed.schemaVersion === A88R2_SCHEMA, "schema_invalid");
  add(signed.revisionId === A88R2_REVISION, "revision_invalid");
  add(CASE_ID.test(String(signed.caseId ?? "")), "case_id_invalid");
  add(REQUEST_ID.test(String(signed.requestId ?? "")), "request_id_invalid");
  add(
    signed.handler === "brain" ||
      signed.handler === "angel" ||
      signed.handler === "risk",
    "handler_invalid",
  );
  add(
    signed.expectedDecision === "BLOCKED_PREFLIGHT" ||
      signed.expectedDecision === "ALLOWED_WITHHELD_CONTROL" ||
      signed.expectedDecision === "ALLOWED_ENTITLEMENT_CONTROL",
    "decision_invalid",
  );
  add(
    Number.isSafeInteger(signed.observedStatus) &&
      signed.observedStatus >= 100 &&
      signed.observedStatus <= 599,
    "status_invalid",
  );
  for (const [name, digest] of [
    ["request_hmac", signed.requestHmac],
    ["response_hmac", signed.responseHmac],
    ["handler_source", signed.handlerSourceSha256],
    ["verifier_source", signed.verifierSourceSha256],
    ["trace", signed.traceSha256],
  ] as const) {
    add(DIGEST.test(String(digest ?? "")), `${name}_digest_invalid`);
  }
  add(
    signed.integrity?.algorithm === "HMAC-SHA256" &&
      DIGEST.test(String(signed.integrity?.signature ?? "")),
    "signature_shape_invalid",
  );

  if (
    Buffer.isBuffer(key) &&
    key.length >= 32 &&
    DIGEST.test(String(signed.integrity?.signature ?? ""))
  ) {
    const { integrity: _integrity, ...core } = signed;
    const expected = Buffer.from(
      signatureFor(core as A88R2EnvelopeCore, key),
      "hex",
    );
    const observed = Buffer.from(signed.integrity.signature, "hex");
    add(
      expected.length === observed.length &&
        crypto.timingSafeEqual(expected, observed),
      "signature_invalid",
    );
  }

  add(signed.requestHmac === context.requestHmac, "request_binding_mismatch");
  add(signed.handler === context.handler, "handler_binding_mismatch");
  add(signed.responseHmac === context.responseHmac, "response_binding_mismatch");
  add(
    signed.observedStatus === context.observedStatus,
    "response_status_binding_mismatch",
  );
  add(
    signed.handlerSourceSha256 === context.handlerSourceSha256,
    "handler_source_binding_mismatch",
  );
  add(
    signed.verifierSourceSha256 === context.verifierSourceSha256,
    "verifier_source_binding_mismatch",
  );
  add(
    JSON.stringify(signed.dependencySpies) ===
      JSON.stringify(context.dependencySpies),
    "dependency_spy_binding_mismatch",
  );
  for (const [name, count] of Object.entries(
    signed.dependencySpies ?? {},
  )) {
    add(
      Number.isSafeInteger(count) && count >= 0 && count <= 12,
      `dependency_spy_count_invalid:${name}`,
    );
  }

  add(Array.isArray(signed.trace), "trace_invalid");
  const trace = Array.isArray(signed.trace) ? signed.trace : [];
  add(trace.length >= 2 && trace.length <= 12, "trace_length_invalid");
  trace.forEach((event, index) => {
    add(exactKeys(event, TRACE_KEYS), `trace_fields_not_exact:${index}`);
    add(event.sequence === index + 1, `trace_sequence_invalid:${index}`);
    add(STAGE.test(String(event.stage ?? "")), `trace_stage_invalid:${index}`);
    add(
      event.effect === null || EFFECTS.includes(event.effect),
      `trace_effect_invalid:${index}`,
    );
    add(
      OUTCOMES.includes(String(event.outcome ?? "")),
      `trace_outcome_invalid:${index}`,
    );
    const contract = STAGE_CONTRACT[event.stage];
    add(Boolean(contract), `trace_stage_unapproved:${index}`);
    if (contract) {
      add(contract.effect === event.effect, `trace_effect_contract:${index}`);
      add(contract.outcome === event.outcome, `trace_outcome_contract:${index}`);
    }
  });
  add(
    new Set(trace.map((event) => event.stage)).size === trace.length,
    "trace_duplicate_stage",
  );
  add(
    signed.traceSha256 === sha256A88R2(canonicalJson(trace)),
    "trace_digest_mismatch",
  );

  const effects = effectCounts(trace);
  const expectedPatterns = expectedTraceStages(
    signed.handler,
    signed.expectedDecision,
    effects.security_telemetry,
  );
  add(
    expectedPatterns.some(
      (pattern) =>
        JSON.stringify(pattern) === JSON.stringify(traceStages(trace)),
    ),
    "trace_order_or_decision_mismatch",
  );
  add(
    effects.security_telemetry === 0 || effects.security_telemetry === 2,
    "security_telemetry_count_invalid",
  );
  add(
    signed.dependencySpies?.securityTelemetry ===
      effects.security_telemetry,
    "security_telemetry_spy_trace_mismatch",
  );

  if (signed.expectedDecision === "BLOCKED_PREFLIGHT") {
    add(
      signed.observedStatus === 400 || signed.observedStatus === 422,
      "blocked_status_invalid",
    );
    add(effects.access === 0, "blocked_access_leak");
    add(effects.market_provider === 0, "blocked_provider_leak");
    add(effects.model === 0, "blocked_model_leak");
    add(effects.tool === 0, "blocked_tool_leak");
    add(effects.durable === 0, "blocked_durable_leak");
    add(signed.dependencySpies?.access === 0, "blocked_access_spy_leak");
    add(
      signed.dependencySpies?.marketProvider === 0,
      "blocked_provider_spy_leak",
    );
    add(signed.dependencySpies?.model === 0, "blocked_model_spy_leak");
    add(signed.dependencySpies?.tool === 0, "blocked_tool_spy_leak");
    add(signed.dependencySpies?.durable === 0, "blocked_durable_spy_leak");
    add(
      signed.dependencySpies?.rateLimit ===
        (signed.handler === "risk" ? 1 : 0),
      "blocked_rate_limit_spy_count_invalid",
    );
  } else if (signed.expectedDecision === "ALLOWED_WITHHELD_CONTROL") {
    add(signed.handler !== "risk", "withheld_handler_invalid");
    add(signed.observedStatus === 424, "withheld_status_invalid");
    add(effects.access === 1, "withheld_access_count_invalid");
    add(effects.market_provider === 1, "withheld_provider_count_invalid");
    add(effects.model === 0, "withheld_model_leak");
    add(effects.tool === 0, "withheld_tool_leak");
    add(effects.durable === 0, "withheld_durable_leak");
    add(signed.dependencySpies?.access === 1, "withheld_access_spy_invalid");
    add(
      signed.dependencySpies?.marketProvider === 1,
      "withheld_provider_spy_invalid",
    );
    add(signed.dependencySpies?.rateLimit === 0, "withheld_rate_spy_invalid");
    add(signed.dependencySpies?.model === 0, "withheld_model_spy_leak");
    add(signed.dependencySpies?.tool === 0, "withheld_tool_spy_leak");
    add(signed.dependencySpies?.durable === 0, "withheld_durable_spy_leak");
  } else if (signed.expectedDecision === "ALLOWED_ENTITLEMENT_CONTROL") {
    add(signed.handler === "risk", "entitlement_handler_invalid");
    add(signed.observedStatus === 402, "entitlement_status_invalid");
    add(effects.access === 1, "entitlement_access_count_invalid");
    add(effects.market_provider === 0, "entitlement_provider_leak");
    add(signed.dependencySpies?.access === 1, "entitlement_access_spy_invalid");
    add(signed.dependencySpies?.rateLimit === 1, "entitlement_rate_spy_invalid");
    add(
      signed.dependencySpies?.marketProvider === 0,
      "entitlement_provider_spy_leak",
    );
    add(signed.dependencySpies?.model === 0, "entitlement_model_spy_leak");
    add(signed.dependencySpies?.tool === 0, "entitlement_tool_spy_leak");
    add(signed.dependencySpies?.durable === 0, "entitlement_durable_spy_leak");
    add(effects.model === 0, "entitlement_model_leak");
    add(effects.tool === 0, "entitlement_tool_leak");
    add(effects.durable === 0, "entitlement_durable_leak");
  }

  add(
    signed.promotion?.live === false &&
      signed.promotion?.saleEnabled === false &&
      signed.promotion?.productionApproved === false &&
      signed.promotion?.worldClassProven === false,
    "promotion_forbidden",
  );

  return {
    passed: failures.length === 0,
    failures,
    effects,
  };
}
