import merchantLegalProfile from "@/config/pass21/merchant-legal-profile.json";

export function inspectContactLegalIntakeReadiness() {
  const profile = merchantLegalProfile.profile;
  const policies = merchantLegalProfile.operationalPolicies;
  const blockers = [
    profile.legalName ? null : "legal_controller_identity_missing",
    profile.supportEmail ? null : "approved_support_email_missing",
    policies.privacyPolicyApproved ? null : "privacy_policy_not_approved",
    policies.processorRegisterApproved ? null : "processor_register_not_approved",
    policies.retentionScheduleApproved ? null : "retention_schedule_not_approved",
    policies.legalReviewApproved ? null : "legal_review_not_approved",
  ].filter((value): value is string => Boolean(value));
  return {
    ready:
      blockers.length === 0 &&
      merchantLegalProfile.commerceStatus !== "NO_GO",
    blockers,
    commerceStatus: merchantLegalProfile.commerceStatus,
  } as const;
}
