import { ASCII_CONTROL_PATTERN } from "./ascii-control-characters";

import { appendTrimmedUpstashList } from "@/lib/security/upstash-rest-atomic";
import { sha256Digest, sha256Token } from "@/lib/security/cryptographic-digest";

declare const process: { env: Record<string, string | undefined> };

export const PASS633_AUDIT_VERSION = "audit-event-schema" as const;

export type Pass633AuditStage = "request" | "provider" | "claim" | "decision" | "export";
export type Pass633AuditState = "accepted" | "degraded" | "blocked" | "exported";

export type Pass633RedactionReceipt = {
  version: string;
  receiptId: string;
  removedPaths: string[];
  maskedPaths: string[];
  leakCount: number;
  state: "clean" | "blocked";
};

export type Pass633AuditInput = {
  route: string;
  method: string;
  actorFingerprint: string;
  providerIds?: string[];
  sourceIds?: string[];
  claimIds?: string[];
  decision?: string;
  state?: Pass633AuditState;
  exportId?: string | null;
  modelVersion?: string | null;
  promptSchemaVersion?: string | null;
  prompt?: string | null;
  generatedAt?: string;
  redactionReceipt?: Pass633RedactionReceipt | null;
};

export type Pass633AuditEvent = {
  version: typeof PASS633_AUDIT_VERSION;
  eventId: string;
  traceId: string;
  route: string;
  method: string;
  actorFingerprint: string;
  state: Pass633AuditState;
  stages: Array<{
    stage: Pass633AuditStage;
    observedAt: string;
    refs: string[];
    state: Pass633AuditState;
  }>;
  providerIds: string[];
  sourceIds: string[];
  claimIds: string[];
  decision: string;
  exportId: string | null;
  modelVersion: string | null;
  promptSchemaVersion: string | null;
  promptDigest: string | null;
  redactionReceipt: Pass633RedactionReceipt | null;
  createdAt: string;
  publicReceipt: {
    eventId: string;
    traceId: string;
    route: string;
    state: Pass633AuditState;
    providerCount: number;
    sourceCount: number;
    claimCount: number;
    decision: string;
    exportId: string | null;
    modelVersion: string | null;
    promptSchemaVersion: string | null;
    redactionState: "clean" | "blocked" | "not_attached";
    createdAt: string;
  };
};

const auditEvents: Pass633AuditEvent[] = [];
const appendAttempts: Array<{ ok: boolean; mode: string; eventId: string; error?: string }> = [];
const MAX_AUDIT_EVENTS = 240;
let appendFailureCount = 0;
let appendCooldownUntil = 0;


function auditAppendMode() {
  if (process.env.VELMERE_AUDIT_APPEND_DISABLED === "1") return "disabled" as const;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return "upstash_list" as const;
  return "memory_only" as const;
}

function pushAppendAttempt(attempt: { ok: boolean; mode: string; eventId: string; error?: string }) {
  appendAttempts.unshift(attempt);
  if (appendAttempts.length > 100) appendAttempts.length = 100;
}

async function appendPass633AuditEventBestEffort(event: Pass633AuditEvent) {
  const mode = auditAppendMode();
  if (mode !== "upstash_list") {
    pushAppendAttempt({ ok: true, mode, eventId: event.eventId });
    return;
  }
  const now = Date.now();
  if (now < appendCooldownUntil) {
    pushAppendAttempt({ ok: false, mode: "upstash_cooldown", eventId: event.eventId, error: "provider_cooldown" });
    return;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  const key = (process.env.VELMERE_AUDIT_UPSTASH_KEY ?? "velmere:audit:events")
    .replace(/[^a-zA-Z0-9:_@.-]/g, "_")
    .slice(0, 160);
  try {
    await appendTrimmedUpstashList({
      key,
      value: JSON.stringify(event),
      maxLength: 1000,
      config: { url: url.replace(/\/$/, ""), token, provider: "upstash" },
      timeoutMs: 1_200,
      operation: "pass633_audit_event_append",
    });
    appendFailureCount = 0;
    appendCooldownUntil = 0;
    pushAppendAttempt({ ok: true, mode, eventId: event.eventId });
  } catch (error) {
    appendFailureCount = Math.min(8, appendFailureCount + 1);
    appendCooldownUntil = Date.now() + Math.min(30_000, 1_000 * 2 ** appendFailureCount);
    pushAppendAttempt({
      ok: false,
      mode: "upstash_fallback_memory",
      eventId: event.eventId,
      error: error instanceof Error ? error.message.slice(0, 120) : "audit_append_failed",
    });
  }
}

function clean(value: string | null | undefined, fallback: string, max = 160) {
  return (value ?? fallback)
    .replace(ASCII_CONTROL_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max) || fallback;
}

function hash(value: string) {
  return sha256Token(value, 24);
}

function unique(values: string[] | undefined, max: number) {
  return Array.from(new Set((values ?? []).map((value) => clean(value, "unknown", 96)))).slice(0, max);
}

export function buildPass633AuditEvent(input: Pass633AuditInput): Pass633AuditEvent {
  const createdAt = input.generatedAt && Number.isFinite(Date.parse(input.generatedAt))
    ? new Date(input.generatedAt).toISOString()
    : new Date().toISOString();
  const route = clean(input.route, "unknown-route", 180).split("?")[0];
  const method = clean(input.method, "GET", 12).toUpperCase();
  const actorFingerprint = clean(input.actorFingerprint, "anonymous", 72);
  const providerIds = unique(input.providerIds, 24);
  const sourceIds = unique(input.sourceIds, 64);
  const claimIds = unique(input.claimIds, 160);
  const decision = clean(input.decision, "undecided", 180);
  const state = input.state ?? "accepted";
  const traceSeed = `${route}:${method}:${actorFingerprint}:${createdAt}:${providerIds.join(",")}`;
  const traceId = `trace_${hash(traceSeed)}`;
  const eventId = `audit_${hash(`${traceSeed}:${decision}:${claimIds.join(",")}`)}`;
  const promptDigest = input.prompt ? sha256Digest(input.prompt) : null;
  const refsByStage: Record<Pass633AuditStage, string[]> = {
    request: [route, method, actorFingerprint],
    provider: providerIds,
    claim: [...sourceIds, ...claimIds],
    decision: [decision],
    export: input.exportId ? [clean(input.exportId, "export", 96)] : [],
  };
  const stages: Pass633AuditEvent["stages"] = (["request", "provider", "claim", "decision", "export"] as Pass633AuditStage[])
    .filter((stage) => stage !== "export" || refsByStage.export.length > 0)
    .map((stage) => ({
      stage,
      observedAt: createdAt,
      refs: refsByStage[stage],
      state: stage === "export" ? "exported" : state,
    }));
  const exportId = input.exportId ? clean(input.exportId, "export", 96) : null;
  const modelVersion = input.modelVersion ? clean(input.modelVersion, "unknown", 96) : null;
  const promptSchemaVersion = input.promptSchemaVersion ? clean(input.promptSchemaVersion, "unknown", 96) : null;
  const redactionReceipt = input.redactionReceipt ?? null;

  return {
    version: PASS633_AUDIT_VERSION,
    eventId,
    traceId,
    route,
    method,
    actorFingerprint,
    state,
    stages,
    providerIds,
    sourceIds,
    claimIds,
    decision,
    exportId,
    modelVersion,
    promptSchemaVersion,
    promptDigest,
    redactionReceipt,
    createdAt,
    publicReceipt: {
      eventId,
      traceId,
      route,
      state,
      providerCount: providerIds.length,
      sourceCount: sourceIds.length,
      claimCount: claimIds.length,
      decision,
      exportId,
      modelVersion,
      promptSchemaVersion,
      redactionState: redactionReceipt?.state ?? "not_attached",
      createdAt,
    },
  };
}

export function recordPass633AuditEvent(input: Pass633AuditInput) {
  const event = buildPass633AuditEvent(input);
  auditEvents.unshift(event);
  if (auditEvents.length > MAX_AUDIT_EVENTS) auditEvents.length = MAX_AUDIT_EVENTS;
  void appendPass633AuditEventBestEffort(event);
  return event;
}

export function listPass633AuditReceipts(limit = 30) {
  return auditEvents.slice(0, Math.max(1, Math.min(100, Math.floor(limit)))).map((event) => event.publicReceipt);
}

export function buildPass633AuditSnapshot() {
  return {
    version: PASS633_AUDIT_VERSION,
    total: auditEvents.length,
    degraded: auditEvents.filter((event) => event.state === "degraded").length,
    blocked: auditEvents.filter((event) => event.state === "blocked").length,
    exported: auditEvents.filter((event) => event.state === "exported").length,
    receipts: listPass633AuditReceipts(30),
    append: {
      mode: auditAppendMode(),
      recent: appendAttempts.slice(0, 20),
      failureCount: appendFailureCount,
      cooldownUntil: appendCooldownUntil ? new Date(appendCooldownUntil).toISOString() : null,
    },
    boundary: "Public receipts expose counts, schema versions and decisions only; raw prompts, secrets and raw actor identifiers are never emitted.",
  };
}
