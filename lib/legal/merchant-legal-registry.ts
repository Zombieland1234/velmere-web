import registry from "@/config/pass21/merchant-legal-profile.json";

export type MerchantLegalReadiness = {
  ready: boolean;
  missingProfileFields: string[];
  incompletePolicies: string[];
  status: "READY" | "NO_GO";
};

const requiredProfileFields = [
  "legalName",
  "legalForm",
  "countryCode",
  "fullServiceAddress",
  "registrationNumber",
  "supportEmail",
  "returnAddress",
] as const;
const requiredPolicyFields = [
  "processorRegisterApproved", "retentionScheduleApproved", "shippingRegionsApproved",
  "shippingRatesApproved", "returnsProcessApproved", "privacyPolicyApproved",
  "termsApproved", "taxHandlingApproved", "fulfilmentApproved", "legalReviewApproved"
] as const;

export function getMerchantLegalReadiness(): MerchantLegalReadiness {
  const profile = registry.profile as Record<string, unknown>;
  const policies = registry.operationalPolicies as Record<string, unknown>;
  const missingProfileFields: string[] = requiredProfileFields.filter((field) => !String(profile[field] ?? "").trim());
  const hasTaxIdentity = Boolean(String(profile.vatId ?? "").trim() || String(profile.taxId ?? "").trim());
  if (!hasTaxIdentity) missingProfileFields.push("vatId_or_taxId");
  const incompletePolicies = requiredPolicyFields.filter((field) => policies[field] !== true);
  const ready = missingProfileFields.length === 0 && incompletePolicies.length === 0 && registry.commerceStatus === "READY";
  return { ready, missingProfileFields: [...missingProfileFields], incompletePolicies: [...incompletePolicies], status: ready ? "READY" : "NO_GO" };
}

export function assertMerchantLegalReady(): void {
  const readiness = getMerchantLegalReadiness();
  if (!readiness.ready) throw new Error(`Merchant legal registry is not ready: ${[...readiness.missingProfileFields, ...readiness.incompletePolicies].join(", ")}`);
}
