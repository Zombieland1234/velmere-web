import matrix from "../../config/pass36/a102r44p18-official-provider-rights-decision-matrix.json";
import { buildProviderRightsProjection } from "../compliance/provider-delivery-rights-gate.mjs";

export type R44P18ProviderRightsPublicSummary = {
  schemaVersion: "velmere.pass36.a102r44p18.provider-rights-public-summary.v1";
  generatedAt: string;
  providers: Array<{
    providerId: string;
    internalDiagnosticAllowed: boolean;
    publicDisplayAllowed: boolean;
    customerDeliveryAllowed: boolean;
    paidTierAllowed: boolean;
    legalApprovalStatus: string | null;
    blockers: string[];
  }>;
  rightsApprovedProviders: number;
  truthBoundary: string;
};

export function buildR44P18ProviderRightsPublicSummary(now = new Date()): R44P18ProviderRightsPublicSummary {
  const providers = (matrix.providers ?? []).map((provider) => {
    const projection = buildProviderRightsProjection({ providerId: provider.providerId, matrix });
    const customer = projection.decisions.customer_delivery;
    return {
      providerId: provider.providerId,
      internalDiagnosticAllowed: projection.internalDiagnosticAllowed === true,
      publicDisplayAllowed: projection.publicDisplayAllowed === true,
      customerDeliveryAllowed: projection.customerDeliveryAllowed === true,
      paidTierAllowed: projection.paidTierAllowed === true,
      legalApprovalStatus: typeof customer.legalApprovalStatus === "string" ? customer.legalApprovalStatus : null,
      blockers: Array.isArray(customer.blockers) ? customer.blockers.map(String) : [],
    };
  });
  return {
    schemaVersion: "velmere.pass36.a102r44p18.provider-rights-public-summary.v1",
    generatedAt: now.toISOString(),
    providers,
    rightsApprovedProviders: providers.filter((row) => row.customerDeliveryAllowed).length,
    truthBoundary: "Public endpoints are diagnostic inputs only. Customer delivery and paid tiers remain blocked until provider rights and legal review are physically approved.",
  };
}
