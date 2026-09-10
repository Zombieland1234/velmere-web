import crypto from "node:crypto";
import { stripUnsafeControlOrBidi } from "@/lib/security/control-character-policy";

const SAFE_TOKEN = /^[a-z][a-z0-9_.:-]{2,95}$/;
const REDACTED_STRING_METRIC = "redacted" as const;
const STRING_METRIC_POLICIES: Readonly<Record<string, RegExp>> = Object.freeze({
  paymentstatus: /^(?:paid|unpaid|no_payment_required|unknown)$/,
  currency: /^(?:[a-z]{3}|unknown)$/,
  mode: /^memory_fallback$/,
  passid: /^pass[0-9]{1,6}-[a-z0-9-]{1,80}$/,
  status: /^(?:paid|active|expired|refunded|revoked|consumed)$/,
  source: /^(?:stripe_webhook|checkout_verify|manual_repair|local_demo_verify)$/,
  providerclass: /^(?:local|remote)$/,
});

export const PASS36_A102R13_OPERATIONAL_LOG_BOUNDARY_ID =
  "velmere.pass36.a102r13.operational-log-boundary.v1" as const;

type Primitive = string | number | boolean | null;
type OperationalLogLevel = "info" | "warn" | "error";

type OperationalEventInput = {
  level: OperationalLogLevel;
  system: string;
  event: string;
  code: string;
  metrics?: Record<string, Primitive>;
  identifiers?: Record<string, unknown>;
  error?: unknown;
};

function token(value: unknown, fallback: string) {
  const clean = String(value ?? "").trim().toLowerCase();
  return SAFE_TOKEN.test(clean) ? clean : fallback;
}

function metricKey(value: string) {
  return stripUnsafeControlOrBidi(value).replace(/[^a-z0-9_.:-]/gi, "_").slice(0, 64) || "metric";
}

function metricValue(key: string, value: Primitive): Primitive {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null) return value;
  const raw = String(value);
  const stripped = stripUnsafeControlOrBidi(raw, " ");
  if (stripped !== raw) return REDACTED_STRING_METRIC;
  const clean = stripped.trim().toLowerCase();
  if (clean.length === 0 || clean.length > 96 || /\s/u.test(clean)) return REDACTED_STRING_METRIC;
  const policy = STRING_METRIC_POLICIES[key.toLowerCase()];
  return policy?.test(clean) ? clean : REDACTED_STRING_METRIC;
}

export function operationalIdentifierHash(label: string, value: unknown) {
  const normalizedLabel = metricKey(label).toLowerCase();
  const normalizedValue = stripUnsafeControlOrBidi(String(value ?? "")).trim().slice(0, 2048);
  return crypto.createHash("sha256").update(`${normalizedLabel}\0${normalizedValue}`).digest("hex");
}

function safeErrorClass(error: unknown) {
  if (!error || typeof error !== "object") return { name: "UnknownError", code: "unclassified" };
  const record = error as { name?: unknown; code?: unknown };
  return {
    name: metricKey(String(record.name ?? "Error")).slice(0, 48),
    code: token(record.code, "unclassified"),
  };
}

export function buildOperationalLogRecord(input: OperationalEventInput) {
  const metrics = Object.fromEntries(
    Object.entries(input.metrics ?? {}).map(([key, value]) => {
      const normalizedKey = metricKey(key);
      return [normalizedKey, metricValue(normalizedKey, value)];
    }),
  );
  const identifierHashes = Object.fromEntries(Object.entries(input.identifiers ?? {}).map(([key, value]) => [`${metricKey(key)}Sha256`, operationalIdentifierHash(key, value)]));
  return {
    schemaVersion: PASS36_A102R13_OPERATIONAL_LOG_BOUNDARY_ID,
    level: input.level,
    system: token(input.system, "velmere.unknown"),
    event: token(input.event, "operational_event"),
    code: token(input.code, "unclassified"),
    metrics,
    identifierHashes,
    error: safeErrorClass(input.error),
    rawIdentifiersIncluded: false,
    rawErrorMessageIncluded: false,
    stackIncluded: false,
  } as const;
}

export function writeOperationalEvent(input: OperationalEventInput) {
  const record = buildOperationalLogRecord(input);
  const encoded = JSON.stringify(record);
  if (Buffer.byteLength(encoded, "utf8") > 8192) {
    throw new Error("operational_log_record_too_large");
  }
  if (input.level === "error") console.error(encoded);
  else if (input.level === "warn") console.warn(encoded);
  else console.info(encoded);
  return record;
}
