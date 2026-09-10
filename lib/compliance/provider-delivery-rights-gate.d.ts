export type ProviderDeliveryPurpose = "internal_diagnostic" | "public_display" | "commercial_product" | "customer_delivery" | "caching" | "retention" | "redistribution" | "pdf_export" | "ai_rag" | "derived_analytics_external" | "paid_tier";
export type ProviderDeliveryRightsResolution = {
  schemaVersion: "velmere.pass36.a102r44p18.provider-delivery-rights-resolution.v2";
  providerId: string;
  purpose: ProviderDeliveryPurpose;
  allowed: boolean;
  blockers: string[];
  legalApprovalStatus: unknown;
  engineeringClassification: unknown;
  requiredPlanOrConsent: unknown;
  sourceIds: unknown[];
  matrixSha256: unknown;
  decisionSha256: unknown;
  diagnosticOnly: boolean;
  receiptSha256: string;
};
export type ProviderRightsProjection = {
  schemaVersion: "velmere.pass36.a102r44p18.provider-rights-projection.v2";
  providerId: string;
  decisions: Record<ProviderDeliveryPurpose, ProviderDeliveryRightsResolution>;
  customerDeliveryAllowed: boolean;
  paidTierAllowed: boolean;
  publicDisplayAllowed: boolean;
  internalDiagnosticAllowed: boolean;
  projectionSha256: string;
};
export declare function resolveProviderDeliveryRights(args: { providerId: string; purpose: ProviderDeliveryPurpose; matrix: Record<string, unknown> }): ProviderDeliveryRightsResolution;
export declare function buildProviderRightsProjection(args: { providerId: string; matrix: Record<string, unknown> }): ProviderRightsProjection;
