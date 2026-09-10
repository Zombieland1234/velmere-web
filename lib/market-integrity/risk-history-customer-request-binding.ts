import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";

export const RISK_HISTORY_CUSTOMER_REQUEST_BINDING_SCHEMA = "velmere.risk-history-customer-request-binding.v1" as const;
export const RISK_HISTORY_CUSTOMER_ASSET_REFERENCE_SCHEMA = "velmere.risk-history-customer-asset-reference.v1" as const;
export const RISK_HISTORY_CUSTOMER_PAGE_REFERENCE_SCHEMA = "velmere.risk-history-customer-page-reference.v1" as const;

const ASSET_ID = /^[a-zA-Z0-9:._-]{1,256}$/u;
const DIGEST = /^sha256:[a-f0-9]{64}$/u;
const MAX_PUBLIC_EVENTS = 144;

export type RiskHistoryCustomerRequestBinding = {
  schemaVersion: typeof RISK_HISTORY_CUSTOMER_REQUEST_BINDING_SCHEMA;
  assetReference: string;
  pageReference: string;
  requestedLimit: number;
  before: string | null;
};

export type RiskHistoryCustomerRequestIdentity = {
  assetId: string;
  limit?: number;
  before?: string | null;
};

function canonicalIso(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function normalizedRequest(args: RiskHistoryCustomerRequestIdentity) {
  const requestedId = args.assetId.trim().toLowerCase();
  const requestedLimit = args.limit ?? MAX_PUBLIC_EVENTS;
  const before = args.before ?? null;
  if (!ASSET_ID.test(requestedId)) throw new Error("risk_history_customer_request_asset_invalid");
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > MAX_PUBLIC_EVENTS) {
    throw new Error("risk_history_customer_request_limit_invalid");
  }
  if (before !== null && !canonicalIso(before)) throw new Error("risk_history_customer_request_cursor_invalid");
  return { requestedId, requestedLimit, before };
}

export function buildRiskHistoryCustomerPageReference(args: {
  assetReference: string;
  requestedLimit: number;
  before: string | null;
}): string {
  if (!DIGEST.test(args.assetReference)
      || !Number.isInteger(args.requestedLimit)
      || args.requestedLimit < 1
      || args.requestedLimit > MAX_PUBLIC_EVENTS
      || (args.before !== null && !canonicalIso(args.before))) {
    throw new Error("risk_history_customer_page_reference_input_invalid");
  }
  return sha256Digest(canonicalJson({
    schemaVersion: RISK_HISTORY_CUSTOMER_PAGE_REFERENCE_SCHEMA,
    assetReference: args.assetReference,
    requestedLimit: args.requestedLimit,
    before: args.before,
  }));
}

export function buildRiskHistoryCustomerRequestBinding(
  args: RiskHistoryCustomerRequestIdentity,
): RiskHistoryCustomerRequestBinding {
  const normalized = normalizedRequest(args);
  const assetReference = sha256Digest(canonicalJson({
    schemaVersion: RISK_HISTORY_CUSTOMER_ASSET_REFERENCE_SCHEMA,
    requestedId: normalized.requestedId,
  }));
  const pageReference = buildRiskHistoryCustomerPageReference({
    assetReference,
    requestedLimit: normalized.requestedLimit,
    before: normalized.before,
  });
  return {
    schemaVersion: RISK_HISTORY_CUSTOMER_REQUEST_BINDING_SCHEMA,
    assetReference,
    pageReference,
    requestedLimit: normalized.requestedLimit,
    before: normalized.before,
  };
}

export function verifyRiskHistoryCustomerRequestBindingShape(
  value: unknown,
): value is RiskHistoryCustomerRequestBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expectedKeys = ["assetReference", "before", "pageReference", "requestedLimit", "schemaVersion"].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) return false;
  if (record.schemaVersion !== RISK_HISTORY_CUSTOMER_REQUEST_BINDING_SCHEMA
      || typeof record.assetReference !== "string"
      || !DIGEST.test(record.assetReference)
      || typeof record.pageReference !== "string"
      || !DIGEST.test(record.pageReference)
      || !Number.isInteger(record.requestedLimit)
      || (record.before !== null && typeof record.before !== "string")) return false;
  try {
    return record.pageReference === buildRiskHistoryCustomerPageReference({
      assetReference: record.assetReference,
      requestedLimit: record.requestedLimit as number,
      before: record.before as string | null,
    });
  } catch {
    return false;
  }
}

export function verifyRiskHistoryCustomerRequestBinding(
  value: unknown,
  expected: RiskHistoryCustomerRequestIdentity,
): value is RiskHistoryCustomerRequestBinding {
  if (!verifyRiskHistoryCustomerRequestBindingShape(value)) return false;
  const record = value as RiskHistoryCustomerRequestBinding;
  let computed: RiskHistoryCustomerRequestBinding;
  try {
    computed = buildRiskHistoryCustomerRequestBinding(expected);
  } catch {
    return false;
  }
  return record.assetReference === computed.assetReference
    && record.pageReference === computed.pageReference
    && record.requestedLimit === computed.requestedLimit
    && record.before === computed.before;
}
