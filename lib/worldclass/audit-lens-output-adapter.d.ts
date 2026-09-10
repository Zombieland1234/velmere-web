export type AuditLensTier = "basic" | "pro" | "advanced";
export type AuditLensLocale = "pl" | "en" | "de";
export type SmartContractAuditEvidencePacket = Record<string, unknown> & { surface: "smart_contract_audit"; caseId: string };
export type LensPdfEvidencePacket = Record<string, unknown> & { surface: "lens_pdf"; caseId: string };
export function buildWorldclassSmartContractAuditOutput(args: {
  matrixRow: Record<string, unknown>;
  corpusCase: Record<string, unknown>;
  evidencePacket: SmartContractAuditEvidencePacket;
  sourceSha256: string;
  corpusSha256: string;
  entitlementStatus?: "verified" | "unverified";
  policy?: Record<string, unknown>;
}): Record<string, unknown>;
export function buildWorldclassLensPdfOutput(args: {
  matrixRow: Record<string, unknown>;
  corpusCase: Record<string, unknown>;
  evidencePacket: LensPdfEvidencePacket;
  sourceSha256: string;
  corpusSha256: string;
  entitlementStatus?: "verified" | "unverified";
  policy?: Record<string, unknown>;
}): Record<string, unknown>;
export function buildLensCanonicalCustomerPayload(args: Record<string, unknown>): Record<string, unknown>;
export function buildLensCanonicalPayloadHash(args: Record<string, unknown>): string;
export function buildAuditLensEvidenceReceipt(packet: Record<string, unknown>): string;
export function auditLensAdapterPolicyDefaults(): Record<string, unknown>;
