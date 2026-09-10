export const P86_PUBLIC_ACCOUNT_ARTIFACT_SCHEMA =
  "velmere.public-account-artifact.v3" as const;
export const P86_PUBLIC_ACCOUNT_ARTIFACT_LIST_SCHEMA =
  "velmere.public-account-artifact-list.v3" as const;
export const P86_PUBLIC_ACCOUNT_ARTIFACT_ERROR_SCHEMA =
  "velmere.public-account-artifact-error.v3" as const;

export const P86_EXACT_IMMUTABLE_PDF_AVAILABLE = "exact_immutable_blob" as const;
export const P86_LEGACY_EXACT_PDF_UNAVAILABLE = "legacy_exact_bytes_unavailable" as const;

export type P86CustomerArtifactPdfAvailability =
  | typeof P86_EXACT_IMMUTABLE_PDF_AVAILABLE
  | typeof P86_LEGACY_EXACT_PDF_UNAVAILABLE;

export type P86PublicAccountArtifactSurface = "audit" | "shield" | "real_markets" | "lens";
export type P86PublicAccountArtifactLocale = "pl" | "en" | "de";

export type P86PublicAccountArtifactListRow = {
  artifactId: string;
  surface: P86PublicAccountArtifactSurface;
  reportId: string;
  requestedTier: string;
  deliveredTier: string | null;
  locale: P86PublicAccountArtifactLocale;
  title: string;
  subject: string;
  generatedAt: string;
  integrityToken: string;
  pdfSha256: string;
  pageCount: number;
  pdfAvailability: P86CustomerArtifactPdfAvailability;
  exactStoredPdf: boolean;
  previewRoute: string | null;
  downloadRoute: string | null;
};

export type P86PublicAccountArtifactDetail = P86PublicAccountArtifactListRow & {
  previewDownloadByteIdentical: boolean;
};

export type P86PublicAccountArtifactList = {
  ok: true;
  schemaVersion: typeof P86_PUBLIC_ACCOUNT_ARTIFACT_LIST_SCHEMA;
  artifacts: readonly P86PublicAccountArtifactListRow[];
};

export type P86PublicAccountArtifactDetailResponse = {
  ok: true;
  schemaVersion: typeof P86_PUBLIC_ACCOUNT_ARTIFACT_SCHEMA;
  artifact: P86PublicAccountArtifactDetail;
};

const LIST_RESPONSE_KEYS = Object.freeze(["artifacts", "ok", "schemaVersion"] as const);
const DETAIL_RESPONSE_KEYS = Object.freeze(["artifact", "ok", "schemaVersion"] as const);
const LIST_ROW_KEYS = Object.freeze([
  "artifactId",
  "deliveredTier",
  "downloadRoute",
  "exactStoredPdf",
  "generatedAt",
  "integrityToken",
  "locale",
  "pageCount",
  "pdfAvailability",
  "pdfSha256",
  "previewRoute",
  "reportId",
  "requestedTier",
  "subject",
  "surface",
  "title",
] as const);
const DETAIL_ROW_KEYS = Object.freeze([
  ...LIST_ROW_KEYS,
  "preview",
  "previewDownloadByteIdentical",
].sort());
const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const ARTIFACT_ID = /^artifact-(audit|shield|real_markets|lens)-([a-f0-9]{16})-([a-f0-9]{40}|[a-f0-9]{64})$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function hasUnsafeText(value: string) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined
      || codePoint <= 31
      || codePoint === 127
      || character === "<"
      || character === ">"
      || character === "\\") return true;
  }
  return false;
}

function boundedText(value: unknown, max: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= max
    && value.trim() === value
    && !hasUnsafeText(value);
}

function validSurface(value: unknown): value is P86PublicAccountArtifactSurface {
  return value === "audit" || value === "shield" || value === "real_markets" || value === "lens";
}

function validLocale(value: unknown): value is P86PublicAccountArtifactLocale {
  return value === "pl" || value === "en" || value === "de";
}

function validIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 20 || value.length > 32) return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

export function expectedP86PublicAccountArtifactPdfRoute(
  artifactId: string,
  disposition: "preview" | "download",
) {
  return `/api/account/customer-artifact?id=${encodeURIComponent(artifactId)}&format=pdf&disposition=${disposition}`;
}

export function validateP86PublicAccountArtifactPdfRoutes(value: {
  artifactId: string;
  previewRoute: string | null;
  downloadRoute: string | null;
  exactStoredPdf: boolean;
  pdfAvailability: P86CustomerArtifactPdfAvailability;
}) {
  if (value.exactStoredPdf) {
    return value.pdfAvailability === P86_EXACT_IMMUTABLE_PDF_AVAILABLE
      && value.previewRoute === expectedP86PublicAccountArtifactPdfRoute(value.artifactId, "preview")
      && value.downloadRoute === expectedP86PublicAccountArtifactPdfRoute(value.artifactId, "download");
  }
  return value.pdfAvailability === P86_LEGACY_EXACT_PDF_UNAVAILABLE
    && value.previewRoute === null
    && value.downloadRoute === null;
}

function parseListRow(value: unknown): P86PublicAccountArtifactListRow | null {
  if (!isRecord(value) || !hasExactKeys(value, LIST_ROW_KEYS)) return null;
  if (!validSurface(value.surface) || !validLocale(value.locale)) return null;
  if (!boundedText(value.reportId, 180) || !boundedText(value.requestedTier, 48)) return null;
  if (value.deliveredTier !== null && !boundedText(value.deliveredTier, 48)) return null;
  if (!boundedText(value.title, 240) || !boundedText(value.subject, 180)) return null;
  if (!validIsoTimestamp(value.generatedAt)) return null;
  if (typeof value.integrityToken !== "string" || !SHA256.test(value.integrityToken)) return null;
  if (typeof value.pdfSha256 !== "string" || !SHA256.test(value.pdfSha256)) return null;
  if (!Number.isSafeInteger(value.pageCount) || Number(value.pageCount) < 1 || Number(value.pageCount) > 10_000) return null;
  if (typeof value.exactStoredPdf !== "boolean") return null;
  if (value.pdfAvailability !== P86_EXACT_IMMUTABLE_PDF_AVAILABLE
    && value.pdfAvailability !== P86_LEGACY_EXACT_PDF_UNAVAILABLE) return null;
  if (value.previewRoute !== null && typeof value.previewRoute !== "string") return null;
  if (value.downloadRoute !== null && typeof value.downloadRoute !== "string") return null;
  if (typeof value.artifactId !== "string") return null;
  const artifactMatch = ARTIFACT_ID.exec(value.artifactId);
  if (!artifactMatch || artifactMatch[1] !== value.surface) return null;
  const artifactDigest = value.integrityToken.slice("sha256:".length);
  if (artifactMatch[3] !== artifactDigest && artifactMatch[3] !== artifactDigest.slice(0, 40)) return null;
  if (value.exactStoredPdf && artifactMatch[3].length !== 64) return null;

  const parsed = {
    artifactId: value.artifactId,
    surface: value.surface,
    reportId: value.reportId,
    requestedTier: value.requestedTier,
    deliveredTier: value.deliveredTier as string | null,
    locale: value.locale,
    title: value.title,
    subject: value.subject,
    generatedAt: value.generatedAt,
    integrityToken: value.integrityToken,
    pdfSha256: value.pdfSha256,
    pageCount: Number(value.pageCount),
    pdfAvailability: value.pdfAvailability,
    exactStoredPdf: value.exactStoredPdf,
    previewRoute: value.previewRoute as string | null,
    downloadRoute: value.downloadRoute as string | null,
  } satisfies P86PublicAccountArtifactListRow;
  return validateP86PublicAccountArtifactPdfRoutes(parsed) ? Object.freeze(parsed) : null;
}

export function parseP86PublicAccountArtifactList(value: unknown): P86PublicAccountArtifactList | null {
  if (!isRecord(value) || !hasExactKeys(value, LIST_RESPONSE_KEYS)) return null;
  if (value.ok !== true || value.schemaVersion !== P86_PUBLIC_ACCOUNT_ARTIFACT_LIST_SCHEMA || !Array.isArray(value.artifacts)) return null;
  if (value.artifacts.length > 50) return null;
  const artifacts: P86PublicAccountArtifactListRow[] = [];
  const ids = new Set<string>();
  for (const row of value.artifacts) {
    const parsed = parseListRow(row);
    if (!parsed || ids.has(parsed.artifactId)) return null;
    ids.add(parsed.artifactId);
    artifacts.push(parsed);
  }
  return Object.freeze({
    ok: true,
    schemaVersion: P86_PUBLIC_ACCOUNT_ARTIFACT_LIST_SCHEMA,
    artifacts: Object.freeze(artifacts),
  });
}

export function parseP86PublicAccountArtifactDetail(value: unknown): P86PublicAccountArtifactDetailResponse | null {
  if (!isRecord(value) || !hasExactKeys(value, DETAIL_RESPONSE_KEYS)) return null;
  if (value.ok !== true || value.schemaVersion !== P86_PUBLIC_ACCOUNT_ARTIFACT_SCHEMA || !isRecord(value.artifact)) return null;
  const artifact = value.artifact;
  if (!hasExactKeys(artifact, DETAIL_ROW_KEYS)) return null;
  const listShape = Object.fromEntries(LIST_ROW_KEYS.map((key) => [key, artifact[key]]));
  const parsed = parseListRow(listShape);
  if (!parsed || typeof artifact.previewDownloadByteIdentical !== "boolean") return null;
  if (parsed.exactStoredPdf !== artifact.previewDownloadByteIdentical) return null;
  return Object.freeze({
    ok: true,
    schemaVersion: P86_PUBLIC_ACCOUNT_ARTIFACT_SCHEMA,
    artifact: Object.freeze({
      ...parsed,
      previewDownloadByteIdentical: artifact.previewDownloadByteIdentical,
    }),
  });
}

export function p86PublicAccountArtifactListMatchesDetail(
  row: P86PublicAccountArtifactListRow,
  detail: P86PublicAccountArtifactDetail,
) {
  return LIST_ROW_KEYS.every((key) => row[key] === detail[key]);
}
