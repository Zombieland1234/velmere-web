export type AuditProviderEvidenceLaneLike = {
  state: string;
  /** P90 runtime sets this explicitly. False means a transport-level response was not useful for the requested target. */
  liveExecutionEligible?: boolean;
  providerFamily?: string;
  lineage: {
    providerId: string;
    upstreamRoot: string;
    independenceEligible: boolean;
    transport: string;
  };
  receipt?: {
    observedAt: string;
    statusCode: number;
    bodyBytes: number;
    bodyDigest: string;
    requestUrlDigest: string;
  };
  identity?: {
    verification: string;
    matched: boolean;
  };
};

export const P89_PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID = "pass4809-audit-provider-evidence-dimensions-v1" as const;
export const PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID = "pass4830-audit-provider-evidence-dimensions-v2" as const;

const SHA256_HEX = /^[a-f0-9]{64}$/i;

function hasBoundSuccessfulReceipt<T extends AuditProviderEvidenceLaneLike>(lane: T) {
  const receipt = lane.receipt;
  return Boolean(receipt)
    && SHA256_HEX.test(String(receipt?.bodyDigest ?? ""))
    && SHA256_HEX.test(String(receipt?.requestUrlDigest ?? ""))
    && Number(receipt?.bodyBytes ?? 0) > 0
    && Number(receipt?.statusCode ?? 0) >= 200
    && Number(receipt?.statusCode ?? 0) < 300
    && Number.isFinite(Date.parse(String(receipt?.observedAt ?? "")));
}

/**
 * A successful live lane proves that a server-controlled direct provider call
 * completed with bounded response bytes and a cryptographic receipt. It does
 * not prove exact target identity, factual correctness or paid evidence truth.
 */
export function isSuccessfulAuditProviderLane<T extends AuditProviderEvidenceLaneLike>(lane: T) {
  return (lane.state === "confirmed" || lane.state === "partial")
    // Historical fixtures omit the field. Current P90 runtime always emits it; explicit false is fail-closed.
    && lane.liveExecutionEligible !== false
    && lane.lineage.transport === "direct_api"
    && lane.lineage.independenceEligible === true
    && Boolean(lane.lineage.providerId?.trim())
    && Boolean(lane.lineage.upstreamRoot?.trim())
    && Boolean(lane.providerFamily?.trim())
    && hasBoundSuccessfulReceipt(lane);
}

/**
 * A strict lane additionally proves exact response identity for the requested
 * target. Only strict lanes may satisfy verified evidence receipt thresholds.
 */
export function isStrictAuditEvidenceLane<T extends AuditProviderEvidenceLaneLike>(lane: T) {
  const identity = lane.identity;
  return isSuccessfulAuditProviderLane(lane)
    && lane.state === "confirmed"
    && identity?.matched === true
    && identity.verification === "exact_response";
}

function strictContributorKey<T extends AuditProviderEvidenceLaneLike>(lane: T) {
  // One canonical provider identity can satisfy at most one strict receipt
  // slot, regardless of aliases, repeated URLs, roots or replayed bodies.
  return lane.lineage.providerId.trim().toLowerCase();
}

function liveContributorKey<T extends AuditProviderEvidenceLaneLike>(lane: T) {
  // liveLanes is provider execution coverage, not a request counter.
  return lane.lineage.providerId.trim().toLowerCase();
}

function uniqueBy<T>(rows: T[], keyOf: (row: T) => string) {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const row of rows) {
    const key = keyOf(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

export function buildAuditProviderEvidenceDimensions<T extends AuditProviderEvidenceLaneLike>(lanes: T[]) {
  const rawStrictLanes = lanes.filter(isStrictAuditEvidenceLane);
  const rawSuccessfulLiveLanes = lanes.filter(isSuccessfulAuditProviderLane);
  const strictLanes = uniqueBy(rawStrictLanes, strictContributorKey);
  const successfulLiveLanes = uniqueBy(rawSuccessfulLiveLanes, liveContributorKey);
  const independentProviderFamilies = Array.from(new Set(
    strictLanes.map((lane) => lane.providerFamily?.trim()).filter((value): value is string => Boolean(value)),
  )).sort();
  const independentUpstreamRoots = Array.from(new Set(
    strictLanes.map((lane) => lane.lineage.upstreamRoot.trim().toLowerCase()).filter(Boolean),
  )).sort();
  const uniqueContentDigests = Array.from(new Set(
    strictLanes.map((lane) => lane.receipt?.bodyDigest.toLowerCase()).filter((value): value is string => Boolean(value)),
  )).sort();
  const successfulLiveProviderIds = Array.from(new Set(
    successfulLiveLanes.map((lane) => lane.lineage.providerId.trim().toLowerCase()).filter(Boolean),
  )).sort();

  return {
    schemaVersion: PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID,
    strictLanes,
    successfulLiveLanes,
    strictReceiptCount: strictLanes.length,
    successfulLiveLaneCount: successfulLiveLanes.length,
    independentProviderFamilies,
    independentUpstreamRoots,
    uniqueContentDigests,
    successfulLiveProviderIds,
    duplicateStrictLanesRejected: rawStrictLanes.length - strictLanes.length,
    duplicateLiveLanesRejected: rawSuccessfulLiveLanes.length - successfulLiveLanes.length,
    explicitLiveExecutionIneligibleLanesRejected: lanes.filter((lane) => lane.liveExecutionEligible === false).length,
    truthBoundary: "Successful live direct-provider execution and strict exact-identity evidence are separate dimensions. Current runtime must explicitly reject target-irrelevant HTTP success through liveExecutionEligible=false. A contributor can occupy at most one slot per dimension; URL aliases, retries, duplicate receipt replay and submitted/human lanes cannot inflate either count.",
  };
}
