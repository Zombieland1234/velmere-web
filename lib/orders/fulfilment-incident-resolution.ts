import {
  getSupabaseServiceRoleClient,
  hasSupabaseServiceRoleConfig,
} from "@/lib/db/supabase";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import type { SupabaseRpcClient } from "@/lib/db/bounded-supabase-rpc";

export type FulfilmentIncidentResolution =
  | "provider_draft_confirmed"
  | "manual_fulfilment_assigned"
  | "order_cancelled_refund_pending"
  | "false_positive_closed";

export type FulfilmentIncidentResolutionEvidence = {
  providerOrderId?: string;
  providerStatus?: "draft" | "pending" | "confirmed" | "inprocess";
  assignmentReference?: string;
  assigneeFingerprint?: string;
  paymentActionReference?: string;
  refundState?: "pending";
  evidenceReference?: string;
  reasonCode?: string;
};

export type FulfilmentIncidentResolutionResult = {
  schemaVersion: "velmere.fulfilment-incident-resolution.v2";
  status: "resolved" | "already_resolved" | "conflict" | "not_found";
  caseId: string;
  resolution: FulfilmentIncidentResolution;
  evidence: FulfilmentIncidentResolutionEvidence;
  outboxEventId: string | null;
  durable: true;
};

export type FulfilmentIncidentResolutionDependencies = {
  hasDurableStorage: () => boolean;
  getClient: () => SupabaseRpcClient | null;
};

export const fulfilmentIncidentResolutionDependencies: FulfilmentIncidentResolutionDependencies = {
  hasDurableStorage: hasSupabaseServiceRoleConfig,
  getClient: () => getSupabaseServiceRoleClient() as unknown as SupabaseRpcClient | null,
};

const SAFE_CASE_ID = /^fulfilment_case_[a-f0-9]{22}$/;
const SAFE_REQUEST_ID = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$/;
const SAFE_OPERATOR = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{2,119}$/;
const SAFE_REFERENCE = /^[a-zA-Z0-9][a-zA-Z0-9:._/-]{3,159}$/;
const SAFE_REASON = /^[a-z0-9][a-z0-9:_-]{2,79}$/;
const ALLOWED_RESOLUTIONS = new Set<FulfilmentIncidentResolution>([
  "provider_draft_confirmed",
  "manual_fulfilment_assigned",
  "order_cancelled_refund_pending",
  "false_positive_closed",
]);

function bounded(value: string, pattern: RegExp, code: string) {
  const normalized = value.trim();
  if (!pattern.test(normalized)) throw new Error(code);
  return normalized;
}

function optionalReference(value: unknown, code: string) {
  if (typeof value !== "string") return undefined;
  return bounded(value, SAFE_REFERENCE, code);
}

export function normalizeFulfilmentIncidentResolution(value: string) {
  const normalized = value.trim().toLowerCase() as FulfilmentIncidentResolution;
  if (!ALLOWED_RESOLUTIONS.has(normalized)) {
    throw new Error("fulfilment_incident_resolution_invalid_resolution");
  }
  return normalized;
}

export function normalizeFulfilmentIncidentResolutionEvidence(
  resolution: FulfilmentIncidentResolution,
  value: unknown,
): FulfilmentIncidentResolutionEvidence {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const evidence: FulfilmentIncidentResolutionEvidence = {
    providerOrderId: optionalReference(
      source.providerOrderId,
      "fulfilment_incident_resolution_invalid_provider_order_id",
    ),
    providerStatus:
      source.providerStatus === "draft" ||
      source.providerStatus === "pending" ||
      source.providerStatus === "confirmed" ||
      source.providerStatus === "inprocess"
        ? source.providerStatus
        : undefined,
    assignmentReference: optionalReference(
      source.assignmentReference,
      "fulfilment_incident_resolution_invalid_assignment_reference",
    ),
    assigneeFingerprint: optionalReference(
      source.assigneeFingerprint,
      "fulfilment_incident_resolution_invalid_assignee_fingerprint",
    ),
    paymentActionReference: optionalReference(
      source.paymentActionReference,
      "fulfilment_incident_resolution_invalid_payment_action_reference",
    ),
    refundState: source.refundState === "pending" ? "pending" : undefined,
    evidenceReference: optionalReference(
      source.evidenceReference,
      "fulfilment_incident_resolution_invalid_evidence_reference",
    ),
    reasonCode:
      typeof source.reasonCode === "string"
        ? bounded(
            source.reasonCode.toLowerCase(),
            SAFE_REASON,
            "fulfilment_incident_resolution_invalid_reason_code",
          )
        : undefined,
  };

  if (resolution === "provider_draft_confirmed") {
    if (!evidence.providerOrderId || !evidence.providerStatus) {
      throw new Error("fulfilment_incident_resolution_missing_provider_evidence");
    }
  } else if (resolution === "manual_fulfilment_assigned") {
    if (!evidence.assignmentReference || !evidence.assigneeFingerprint) {
      throw new Error("fulfilment_incident_resolution_missing_assignment_evidence");
    }
  } else if (resolution === "order_cancelled_refund_pending") {
    if (!evidence.paymentActionReference || evidence.refundState !== "pending") {
      throw new Error("fulfilment_incident_resolution_missing_refund_evidence");
    }
  } else if (!evidence.evidenceReference || !evidence.reasonCode) {
    throw new Error("fulfilment_incident_resolution_missing_closure_evidence");
  }

  return Object.fromEntries(
    Object.entries(evidence).filter(([, nested]) => nested !== undefined),
  ) as FulfilmentIncidentResolutionEvidence;
}

export async function resolveFulfilmentIncidentCase(
  input: {
    caseId: string;
    resolution: string;
    requestId: string;
    operatorFingerprint: string;
    evidence: unknown;
  },
  dependencies: FulfilmentIncidentResolutionDependencies = fulfilmentIncidentResolutionDependencies,
): Promise<FulfilmentIncidentResolutionResult> {
  const caseId = bounded(
    input.caseId,
    SAFE_CASE_ID,
    "fulfilment_incident_resolution_invalid_case_id",
  );
  const requestId = bounded(
    input.requestId,
    SAFE_REQUEST_ID,
    "fulfilment_incident_resolution_invalid_request_id",
  );
  const operatorFingerprint = bounded(
    input.operatorFingerprint,
    SAFE_OPERATOR,
    "fulfilment_incident_resolution_invalid_operator",
  );
  const resolution = normalizeFulfilmentIncidentResolution(input.resolution);
  const evidence = normalizeFulfilmentIncidentResolutionEvidence(resolution, input.evidence);

  if (!dependencies.hasDurableStorage()) {
    throw new Error("fulfilment_incident_resolution_storage_unavailable");
  }
  const client = dependencies.getClient();
  if (!client) throw new Error("fulfilment_incident_resolution_storage_unavailable");

  let data: unknown;
  try {
    ({ data } = await runRegisteredServiceRoleRpc({
      operation: "fulfilment_incident_resolve",
      clientOverride: client,
      args: {
        p_case_id: caseId,
        p_resolution: resolution,
        p_request_id: requestId,
        p_operator_fingerprint: operatorFingerprint,
        p_evidence: evidence,
      },
    }));
  } catch {
    throw new Error("fulfilment_incident_resolution_write_failed");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error("fulfilment_incident_resolution_empty_result");
  }
  const source = row as Record<string, unknown>;
  const status = String(source.status ?? "conflict");
  if (
    status !== "resolved" &&
    status !== "already_resolved" &&
    status !== "conflict" &&
    status !== "not_found"
  ) {
    throw new Error("fulfilment_incident_resolution_invalid_result");
  }
  const outboxEventId =
    typeof source.outbox_event_id === "string"
      ? source.outbox_event_id.slice(0, 120)
      : null;

  return {
    schemaVersion: "velmere.fulfilment-incident-resolution.v2",
    status,
    caseId,
    resolution,
    evidence,
    outboxEventId,
    durable: true,
  };
}

export function buildFulfilmentIncidentResolutionReadiness() {
  const serviceRoleConfigured = hasSupabaseServiceRoleConfig();
  return {
    schemaVersion: "velmere.fulfilment-incident-resolution-readiness.v2" as const,
    serviceRoleConfigured,
    durableReady: serviceRoleConfigured,
    evidenceGatesReady: true,
    allowedResolutions: Array.from(ALLOWED_RESOLUTIONS),
    productionBoundary:
      "Resolution is service-role-only, idempotent by request ID, requires resolution-specific bounded evidence and atomically updates the incident plus a support-safe transactional outbox event. Raw provider payloads, customer PII and credentials are rejected by contract.",
  };
}
