import type { Pass2572RuntimeLane } from "./audit-provider-runtime-client";
import {
  buildAuditProviderEvidenceDimensions,
  isStrictAuditEvidenceLane,
  PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID,
} from "./audit-provider-evidence-dimensions";
import type { AuditTierContract, AuditTierId } from "./audit-tier-contract";
import {
  evaluateAuditProviderRightsCurrentness,
  type AuditProviderRightsRegistry,
} from "./audit-provider-rights-currentness";
import { isStrictAuditAuthorityReceipt, verifyAuditAdjudicatedAuthorityEvidence, type AuditAdjudicatedAuthorityEvidence } from "./audit-adjudicated-authority-evidence";

export const LEGACY_PASS4819_AUDIT_PAID_EVIDENCE_READINESS_ID = "pass4819-audit-paid-evidence-readiness-v1" as const;
export const P89_PASS4819_AUDIT_PAID_EVIDENCE_READINESS_ID = "pass4819-audit-paid-evidence-readiness-v2" as const;
export const PASS4819_AUDIT_PAID_EVIDENCE_READINESS_ID = "pass4819-audit-paid-evidence-readiness-v3" as const;

export { isStrictAuditEvidenceLane };

const MINIMUM_INDEPENDENT_UPSTREAM_ROOTS: Record<AuditTierId, number> = {
  basic: 1,
  pro: 3,
  advanced: 4,
};

function compactUnique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function evaluateAuditPaidEvidenceReadiness(input: {
  lanes: Pass2572RuntimeLane[];
  tier: AuditTierId;
  tierContract: AuditTierContract;
  evidenceRows: number;
  authorityEvidence?: AuditAdjudicatedAuthorityEvidence | null;
  rightsRegistry?: AuditProviderRightsRegistry;
  evaluatedAt?: string;
}) {
  const eligibleLanes = input.lanes.filter((lane) => lane.tier.includes(input.tier));
  const dimensions = buildAuditProviderEvidenceDimensions(eligibleLanes);
  const strictLanes = dimensions.strictLanes;
  const rejectedLanes = eligibleLanes.filter((lane) => !isStrictAuditEvidenceLane(lane));
  // Public/passive dual-authority adjudication may supplement Basic only. Pro/Advanced keep
  // their original strict provider-lane quorum and cannot be unlocked by authority pages alone.
  const strictAuthorityReceipts = input.tier === "basic"
    && verifyAuditAdjudicatedAuthorityEvidence(input.authorityEvidence)
    && input.authorityEvidence?.state === "confirmed"
      ? input.authorityEvidence.receipts.filter(isStrictAuditAuthorityReceipt)
      : [];
  const verifiedEvidenceReceipts = strictLanes.length + strictAuthorityReceipts.length;
  const providerFamilies = compactUnique([
    ...strictLanes.map((lane) => lane.providerFamily),
    ...strictAuthorityReceipts.map((receipt) => receipt.providerFamily),
  ]);
  const upstreamRoots = compactUnique([
    ...strictLanes.map((lane) => lane.lineage.upstreamRoot.trim().toLowerCase()),
    ...strictAuthorityReceipts.map((receipt) => receipt.upstreamRoot.trim().toLowerCase()),
  ]);
  const contentDigests = compactUnique([
    ...strictLanes.map((lane) => lane.receipt?.bodyDigest.toLowerCase()),
    ...strictAuthorityReceipts.map((receipt) => receipt.bodyDigest.toLowerCase()),
  ]);
  const minimumUpstreamRoots = MINIMUM_INDEPENDENT_UPSTREAM_ROOTS[input.tier];
  const evidenceRows = Math.max(0, Math.trunc(Number(input.evidenceRows) || 0));
  const rightsCurrentness = evaluateAuditProviderRightsCurrentness({
    lanes: eligibleLanes,
    tier: input.tier,
    ...(input.rightsRegistry ? { registry: input.rightsRegistry } : {}),
    ...(input.evaluatedAt ? { now: input.evaluatedAt } : {}),
  });

  const technicalBlockers = compactUnique([
    verifiedEvidenceReceipts < input.tierContract.minimumEvidence.verifiedProviderReceipts
      ? `verified_evidence_receipts:${verifiedEvidenceReceipts}/${input.tierContract.minimumEvidence.verifiedProviderReceipts}`
      : null,
    providerFamilies.length < input.tierContract.minimumEvidence.independentProviderFamilies
      ? `independent_provider_families:${providerFamilies.length}/${input.tierContract.minimumEvidence.independentProviderFamilies}`
      : null,
    upstreamRoots.length < minimumUpstreamRoots
      ? `independent_upstream_roots:${upstreamRoots.length}/${minimumUpstreamRoots}`
      : null,
    dimensions.successfulLiveLaneCount < input.tierContract.minimumEvidence.liveLanes
      ? `successful_live_provider_lanes:${dimensions.successfulLiveLaneCount}/${input.tierContract.minimumEvidence.liveLanes}`
      : null,
    evidenceRows < input.tierContract.minimumEvidence.evidenceRows
      ? `evidence_rows:${evidenceRows}/${input.tierContract.minimumEvidence.evidenceRows}`
      : null,
  ]);

  const commercialBlockers = compactUnique([
    ...technicalBlockers,
    rightsCurrentness.rightsCurrentStrictReceiptCount < input.tierContract.minimumEvidence.verifiedProviderReceipts
      ? `rights_current_strict_evidence_receipts:${rightsCurrentness.rightsCurrentStrictReceiptCount}/${input.tierContract.minimumEvidence.verifiedProviderReceipts}`
      : null,
    rightsCurrentness.rightsCurrentProviderFamilies.length < input.tierContract.minimumEvidence.independentProviderFamilies
      ? `rights_current_provider_families:${rightsCurrentness.rightsCurrentProviderFamilies.length}/${input.tierContract.minimumEvidence.independentProviderFamilies}`
      : null,
    rightsCurrentness.rightsCurrentIndependentUpstreamRoots.length < minimumUpstreamRoots
      ? `rights_current_upstream_roots:${rightsCurrentness.rightsCurrentIndependentUpstreamRoots.length}/${minimumUpstreamRoots}`
      : null,
    rightsCurrentness.rightsCurrentSuccessfulLiveLaneCount < input.tierContract.minimumEvidence.liveLanes
      ? `rights_current_live_provider_lanes:${rightsCurrentness.rightsCurrentSuccessfulLiveLaneCount}/${input.tierContract.minimumEvidence.liveLanes}`
      : null,
    rightsCurrentness.blockedFieldIds.length > 0
      ? `customer_field_rights_blocked:${rightsCurrentness.blockedFieldIds.length}`
      : null,
    rightsCurrentness.commercialUseReady ? null : "provider_rights_currentness_not_ready",
  ]);

  return {
    passId: PASS4819_AUDIT_PAID_EVIDENCE_READINESS_ID,
    tier: input.tier,
    eligibleLanes: eligibleLanes.length,
    evidenceDimensionVersion: PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID,
    strictConfirmedLanes: strictLanes.length,
    successfulLiveProviderLanes: dimensions.successfulLiveLaneCount,
    successfulLiveProviderIds: dimensions.successfulLiveProviderIds,
    strictAuthorityReceipts: strictAuthorityReceipts.length,
    rejectedOrPartialLanes: rejectedLanes.length,
    duplicateStrictLanesRejected: dimensions.duplicateStrictLanesRejected,
    duplicateLiveLanesRejected: dimensions.duplicateLiveLanesRejected,
    verifiedProviderReceipts: strictLanes.length,
    verifiedAuthorityReceipts: strictAuthorityReceipts.length,
    verifiedEvidenceReceipts,
    independentProviderFamilies: providerFamilies.length,
    independentProviderFamilyIds: providerFamilies,
    independentUpstreamRoots: upstreamRoots.length,
    independentUpstreamRootIds: upstreamRoots,
    uniqueContentDigests: contentDigests.length,
    evidenceRows,
    minimum: {
      ...input.tierContract.minimumEvidence,
      independentUpstreamRoots: minimumUpstreamRoots,
    },
    rightsCurrentness,
    technicalBlockers,
    commercialBlockers,
    blockers: commercialBlockers,
    technicalMet: technicalBlockers.length === 0,
    commercialMet: commercialBlockers.length === 0,
    met: commercialBlockers.length === 0,
    rule: "Technical evidence dimensions remain separate: strict exact-identity receipts, successful live provider executions and evidence rows. Commercial readiness is a second fail-closed gate and counts only contributors whose current field-level decision explicitly permits customer-derived display, paid-tier use where applicable, PDF export and derived-evidence retention. Technical success, a configured plan, public availability or payment cannot create rights.",
  };
}
