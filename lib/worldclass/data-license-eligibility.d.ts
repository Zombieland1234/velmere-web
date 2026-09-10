export type Pass20DataLicenseCell = {
  cellId: string; caseId: string; surface: string; tier: "basic"|"pro"|"advanced"; fieldId: string; canonicalIdentity: string;
  maxAgeSeconds: number; minimumIndependentFamilies: number; allowedLicenseStates: string[]; requiresCommercialRights: boolean; requiresEntitlement: boolean; specialGates: string[];
};
export type Pass20EvidenceRow = { sourceId: string; family: string; canonicalIdentity: string; fieldId: string; observedAt: string; licenseStatus: string; payloadSha256?: string; value?: unknown; providerId?: string; rightsEvidenceId?: string; rightsDocumentSha256?: string; rightsVerified?: boolean };
export declare function evaluateDataLicenseEligibility(args: { cell: Pass20DataLicenseCell; evidenceRows?: Pass20EvidenceRow[]; entitlementStatus?: string; humanReviewStatus?: string; renderParityStatus?: string; evidenceMode?: "synthetic"|"canonical"; now?: string }): Record<string, unknown>;
export declare function buildRedactedDataLicenseReceipt(args: Parameters<typeof evaluateDataLicenseEligibility>[0]): Record<string, unknown>;
