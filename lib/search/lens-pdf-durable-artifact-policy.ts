import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256BytesDigest, sha256Digest } from "@/lib/security/cryptographic-digest";
import type {
  DurableComputationMode,
  DurableComputationSubjectBinding,
} from "@/lib/jobs/durable-computation-replay";

export const P97_LENS_PDF_DURABLE_ARTIFACT_POLICY_ID =
  "p97-lens-pdf-render-once-durable-store-first-v1" as const;
export const P97_LENS_PDF_DURABILITY_RECEIPT_SCHEMA =
  "velmere.p97.lens-pdf-durability-receipt.v1" as const;

export type P97LensPdfDepth = "basic" | "pro" | "advanced";

export type P97LensPdfDurableArtifactPolicy = Readonly<{
  policyId: typeof P97_LENS_PDF_DURABLE_ARTIFACT_POLICY_ID;
  depth: P97LensPdfDepth;
  reportId: string;
  accountBound: boolean;
  requireDurableStore: true;
  canonicalRequestId: string;
  subjectBinding: DurableComputationSubjectBinding;
  anonymousBindingUsesSignedReportIdentity: boolean;
  directNonDurableAllowed: false;
  policyDigest: string;
}>;

export type P97LensPdfDurabilityReceipt = Readonly<{
  schemaVersion: typeof P97_LENS_PDF_DURABILITY_RECEIPT_SCHEMA;
  policyId: typeof P97_LENS_PDF_DURABLE_ARTIFACT_POLICY_ID;
  reportId: string;
  depth: P97LensPdfDepth;
  accountBound: boolean;
  policyDigest: string;
  computationMode: DurableComputationMode;
  replayed: boolean;
  pdfSha256: string;
  pdfByteLength: number;
  storageState:
    | "DURABLE_DATABASE_BLOB_VERIFIED"
    | "LOCAL_MEMORY_EXACT_BLOB_BOUNDED"
    | "NON_DURABLE_REJECTED";
  customerFinalStorageEligible: boolean;
  durableRetentionClaimed: boolean;
  backupRestoreProven: boolean;
  receiptDigest: string;
}>;

const REPORT_ID = /^[a-z0-9][a-z0-9._:-]{7,199}$/i;
const SHA256 = /^sha256:[a-f0-9]{64}$/i;

function assertReportId(reportId: string) {
  const value = String(reportId ?? "").trim();
  if (!REPORT_ID.test(value)) throw new Error("lens_pdf_report_id_invalid");
  return value;
}

function digest(value: unknown) {
  return sha256Digest(canonicalJson(value));
}

/**
 * Final Browser PDFs are artifacts, including free Basic. The signed frozen
 * report identity is the anonymous subject boundary; IP/user-agent transport
 * metadata must never create a second canonical artifact for the same report.
 */
export function buildP97LensPdfDurableArtifactPolicy(args: {
  depth: P97LensPdfDepth;
  reportId: string;
  accountId?: string | null;
}): P97LensPdfDurableArtifactPolicy {
  const reportId = assertReportId(args.reportId);
  const accountId = String(args.accountId ?? "").trim();
  const accountBound = accountId.length > 0;
  const subjectBinding: DurableComputationSubjectBinding = accountBound
    ? { kind: "account", value: accountId }
    : { kind: "anonymous", value: `signed-lens-report:${reportId}` };
  const unsigned = {
    policyId: P97_LENS_PDF_DURABLE_ARTIFACT_POLICY_ID,
    depth: args.depth,
    reportId,
    accountBound,
    requireDurableStore: true as const,
    canonicalRequestId: `signed-lens-report:${reportId}`,
    subjectBinding,
    anonymousBindingUsesSignedReportIdentity: !accountBound,
    directNonDurableAllowed: false as const,
  };
  return { ...unsigned, policyDigest: digest(unsigned) };
}

export function verifyP97LensPdfDurableArtifactPolicy(
  value: P97LensPdfDurableArtifactPolicy,
): boolean {
  try {
    const rebuilt = buildP97LensPdfDurableArtifactPolicy({
      depth: value.depth,
      reportId: value.reportId,
      accountId: value.accountBound ? value.subjectBinding.value : null,
    });
    return canonicalJson(rebuilt) === canonicalJson(value)
      && value.requireDurableStore === true
      && value.directNonDurableAllowed === false
      && (value.accountBound
        ? value.subjectBinding.kind === "account"
        : value.subjectBinding.kind === "anonymous"
          && value.subjectBinding.value === `signed-lens-report:${value.reportId}`
          && value.anonymousBindingUsesSignedReportIdentity === true);
  } catch {
    return false;
  }
}

export function buildP97LensPdfDurabilityReceipt(args: {
  policy: P97LensPdfDurableArtifactPolicy;
  computationMode: DurableComputationMode;
  replayed: boolean;
  pdfSha256: string;
  pdfByteLength: number;
}): P97LensPdfDurabilityReceipt {
  if (!verifyP97LensPdfDurableArtifactPolicy(args.policy)) {
    throw new Error("lens_pdf_durable_policy_invalid");
  }
  if (!SHA256.test(args.pdfSha256)) throw new Error("lens_pdf_digest_invalid");
  if (!Number.isSafeInteger(args.pdfByteLength) || args.pdfByteLength <= 0 || args.pdfByteLength > 4 * 1024 * 1024) {
    throw new Error("lens_pdf_byte_length_invalid");
  }

  const storageState = args.computationMode === "supabase"
    ? "DURABLE_DATABASE_BLOB_VERIFIED" as const
    : args.computationMode === "memory_non_production"
      ? "LOCAL_MEMORY_EXACT_BLOB_BOUNDED" as const
      : "NON_DURABLE_REJECTED" as const;
  const customerFinalStorageEligible = args.computationMode === "supabase";
  const unsigned = {
    schemaVersion: P97_LENS_PDF_DURABILITY_RECEIPT_SCHEMA,
    policyId: P97_LENS_PDF_DURABLE_ARTIFACT_POLICY_ID,
    reportId: args.policy.reportId,
    depth: args.policy.depth,
    accountBound: args.policy.accountBound,
    policyDigest: args.policy.policyDigest,
    computationMode: args.computationMode,
    replayed: args.replayed,
    pdfSha256: args.pdfSha256.toLowerCase(),
    pdfByteLength: args.pdfByteLength,
    storageState,
    customerFinalStorageEligible,
    // A successful durable write/read does not prove retention policy or restore.
    durableRetentionClaimed: false,
    backupRestoreProven: false,
  };
  return { ...unsigned, receiptDigest: digest(unsigned) };
}

export function verifyP97LensPdfDurabilityReceipt(args: {
  receipt: P97LensPdfDurabilityReceipt;
  policy: P97LensPdfDurableArtifactPolicy;
  pdfBytes: Uint8Array;
}): boolean {
  try {
    const value = args.receipt;
    const exactKeys = [
      "schemaVersion",
      "policyId",
      "reportId",
      "depth",
      "accountBound",
      "policyDigest",
      "computationMode",
      "replayed",
      "pdfSha256",
      "pdfByteLength",
      "storageState",
      "customerFinalStorageEligible",
      "durableRetentionClaimed",
      "backupRestoreProven",
      "receiptDigest",
    ].sort();
    if (!value || typeof value !== "object") return false;
    if (!verifyP97LensPdfDurableArtifactPolicy(args.policy)) return false;
    if (!(args.pdfBytes instanceof Uint8Array)) return false;
    if (Object.keys(value).sort().join("|") !== exactKeys.join("|")) return false;
    if (!REPORT_ID.test(String(value.reportId ?? "").trim())) return false;
    if (!["basic", "pro", "advanced"].includes(value.depth)) return false;
    if (typeof value.accountBound !== "boolean" || typeof value.replayed !== "boolean") return false;
    if (!["supabase", "memory_non_production", "direct_non_durable"].includes(value.computationMode)) return false;
    if (!SHA256.test(value.policyDigest) || value.policyDigest !== value.policyDigest.toLowerCase()) return false;
    if (!SHA256.test(value.pdfSha256) || value.pdfSha256 !== value.pdfSha256.toLowerCase()) return false;
    if (!Number.isSafeInteger(value.pdfByteLength) || value.pdfByteLength <= 0 || value.pdfByteLength > 4 * 1024 * 1024) return false;
    if (value.policyDigest !== args.policy.policyDigest
      || value.reportId !== args.policy.reportId
      || value.depth !== args.policy.depth
      || value.accountBound !== args.policy.accountBound) return false;
    if (value.pdfByteLength !== args.pdfBytes.byteLength
      || value.pdfSha256 !== sha256BytesDigest(args.pdfBytes)) return false;

    const expectedState = value.computationMode === "supabase"
      ? "DURABLE_DATABASE_BLOB_VERIFIED"
      : value.computationMode === "memory_non_production"
        ? "LOCAL_MEMORY_EXACT_BLOB_BOUNDED"
        : "NON_DURABLE_REJECTED";
    const customerFinalStorageEligible = value.computationMode === "supabase";
    const unsigned = {
      schemaVersion: P97_LENS_PDF_DURABILITY_RECEIPT_SCHEMA,
      policyId: P97_LENS_PDF_DURABLE_ARTIFACT_POLICY_ID,
      reportId: value.reportId,
      depth: value.depth,
      accountBound: value.accountBound,
      policyDigest: value.policyDigest,
      computationMode: value.computationMode,
      replayed: value.replayed,
      pdfSha256: value.pdfSha256,
      pdfByteLength: value.pdfByteLength,
      storageState: expectedState,
      customerFinalStorageEligible,
      durableRetentionClaimed: false,
      backupRestoreProven: false,
    };
    return value.schemaVersion === P97_LENS_PDF_DURABILITY_RECEIPT_SCHEMA
      && value.policyId === P97_LENS_PDF_DURABLE_ARTIFACT_POLICY_ID
      && value.storageState === expectedState
      && value.customerFinalStorageEligible === customerFinalStorageEligible
      && value.durableRetentionClaimed === false
      && value.backupRestoreProven === false
      && value.receiptDigest === digest(unsigned);
  } catch {
    return false;
  }
}
