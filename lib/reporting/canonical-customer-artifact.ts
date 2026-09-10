import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "../security/ascii-control-characters";

import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";

export const PASS4821_CANONICAL_CUSTOMER_ARTIFACT_ID = "pass4821-canonical-customer-artifact-v1" as const;

export type CanonicalCustomerArtifactSurface = "audit" | "shield" | "real_markets" | "lens";

export type CanonicalCustomerArtifact = {
  schemaVersion: typeof PASS4821_CANONICAL_CUSTOMER_ARTIFACT_ID;
  surface: CanonicalCustomerArtifactSurface;
  rendererId: string;
  reportId: string;
  requestedTier: string;
  deliveredTier: string | null;
  payloadDigest: string;
  layoutDigest: string;
  renderPlanDigest: string;
  pdfDigest: string;
  pdfByteLength: number;
  pageCount: number;
  renderedRowCount: number;
  artifactDigest: string;
};

type BuildCanonicalCustomerArtifactInput = Omit<CanonicalCustomerArtifact, "schemaVersion" | "artifactDigest">;

const CANONICAL_ARTIFACT_KEYS = Object.freeze([
  "artifactDigest",
  "deliveredTier",
  "layoutDigest",
  "pageCount",
  "payloadDigest",
  "pdfByteLength",
  "pdfDigest",
  "renderPlanDigest",
  "renderedRowCount",
  "rendererId",
  "reportId",
  "requestedTier",
  "schemaVersion",
  "surface",
] as const);

function digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);
}

function clean(value: unknown, max = 180): string {
  return typeof value === "string" ? value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function validSurface(value: unknown): value is CanonicalCustomerArtifactSurface {
  return value === "audit" || value === "shield" || value === "real_markets" || value === "lens";
}

export function buildCanonicalCustomerArtifact(input: BuildCanonicalCustomerArtifactInput): CanonicalCustomerArtifact {
  if (!validSurface(input.surface)) throw new Error("canonical_customer_artifact_surface_invalid");
  const rendererId = clean(input.rendererId, 160);
  const reportId = clean(input.reportId, 180);
  const requestedTier = clean(input.requestedTier, 48);
  const deliveredTier = input.deliveredTier === null ? null : clean(input.deliveredTier, 48);
  if (!rendererId || !reportId || !requestedTier || (input.deliveredTier !== null && !deliveredTier)) {
    throw new Error("canonical_customer_artifact_identity_required");
  }
  for (const value of [input.payloadDigest, input.layoutDigest, input.renderPlanDigest, input.pdfDigest]) {
    if (!digest(value)) throw new Error("canonical_customer_artifact_digest_invalid");
  }
  if (!Number.isSafeInteger(input.pdfByteLength) || input.pdfByteLength <= 0) throw new Error("canonical_customer_artifact_pdf_length_invalid");
  if (!Number.isSafeInteger(input.pageCount) || input.pageCount <= 0) throw new Error("canonical_customer_artifact_page_count_invalid");
  if (!Number.isSafeInteger(input.renderedRowCount) || input.renderedRowCount <= 0) throw new Error("canonical_customer_artifact_row_count_invalid");
  const unsigned = {
    schemaVersion: PASS4821_CANONICAL_CUSTOMER_ARTIFACT_ID,
    surface: input.surface,
    rendererId,
    reportId,
    requestedTier,
    deliveredTier,
    payloadDigest: input.payloadDigest,
    layoutDigest: input.layoutDigest,
    renderPlanDigest: input.renderPlanDigest,
    pdfDigest: input.pdfDigest,
    pdfByteLength: input.pdfByteLength,
    pageCount: input.pageCount,
    renderedRowCount: input.renderedRowCount,
  } as const;
  return { ...unsigned, artifactDigest: sha256Digest(canonicalJson(unsigned)) };
}

export function verifyCanonicalCustomerArtifact(value: unknown): value is CanonicalCustomerArtifact {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const artifact = value as Partial<CanonicalCustomerArtifact>;
  const keys = Object.keys(artifact).sort();
  if (keys.length !== CANONICAL_ARTIFACT_KEYS.length || keys.some((key, index) => key !== CANONICAL_ARTIFACT_KEYS[index])) {
    return false;
  }
  if (artifact.schemaVersion !== PASS4821_CANONICAL_CUSTOMER_ARTIFACT_ID || !validSurface(artifact.surface)) return false;
  if (!artifact.rendererId || !artifact.reportId || !artifact.requestedTier) return false;
  if (artifact.deliveredTier !== null && typeof artifact.deliveredTier !== "string") return false;
  if (![artifact.payloadDigest, artifact.layoutDigest, artifact.renderPlanDigest, artifact.pdfDigest, artifact.artifactDigest].every(digest)) return false;
  if (!Number.isSafeInteger(artifact.pdfByteLength) || Number(artifact.pdfByteLength) <= 0) return false;
  if (!Number.isSafeInteger(artifact.pageCount) || Number(artifact.pageCount) <= 0) return false;
  if (!Number.isSafeInteger(artifact.renderedRowCount) || Number(artifact.renderedRowCount) <= 0) return false;
  try {
    const rebuilt = buildCanonicalCustomerArtifact({
      surface: artifact.surface,
      rendererId: artifact.rendererId,
      reportId: artifact.reportId,
      requestedTier: artifact.requestedTier,
      deliveredTier: artifact.deliveredTier ?? null,
      payloadDigest: artifact.payloadDigest!,
      layoutDigest: artifact.layoutDigest!,
      renderPlanDigest: artifact.renderPlanDigest!,
      pdfDigest: artifact.pdfDigest!,
      pdfByteLength: artifact.pdfByteLength!,
      pageCount: artifact.pageCount!,
      renderedRowCount: artifact.renderedRowCount!,
    });
    return rebuilt.artifactDigest === artifact.artifactDigest
      && rebuilt.rendererId === artifact.rendererId
      && rebuilt.reportId === artifact.reportId
      && rebuilt.requestedTier === artifact.requestedTier
      && rebuilt.deliveredTier === artifact.deliveredTier;
  } catch {
    return false;
  }
}
