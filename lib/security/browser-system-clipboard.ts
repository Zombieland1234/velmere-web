import { containsUnsafeControlOrBidi, stripUnsafeControlOrBidi } from "@/lib/security/control-character-policy";

export const MAX_SYSTEM_CLIPBOARD_JSON_BYTES = 32 * 1024;
export const MAX_PUBLIC_SYSTEM_CLIPBOARD_TEXT_BYTES = 8 * 1024;
export const PASS36_A102R18_PUBLIC_CLIPBOARD_BOUNDARY_ID =
  "velmere.pass36.a102r18.public-community-system-clipboard-boundary.v1";

const BLOCKED_JSON_KEY = /"(?:vaultPointer|packageId|packetId|pdfPointer|deliveryId|releaseId|releasePointer|customerReceiptId|receiptId|latestReceiptId|customerRoute|downloadPointer|downloadManifestId|downloadRoute|accessCapsuleId|accessRoute|accessTokenId|expiresAt|generatedAt|observedAt|sourceTimeLabel|sourceLabel|sourceClaims|claimIds|consumptionId|consumedAt|downloadSessionId|downloadAuditHash|closeoutId|closedAt|sessionFinalizedHash|attestationId|attestedAt|publicProofPointer|archiveRoute|publicIndexId|indexedAt|transparencyRoute|proofDigest|digest|checksum|accountRoute|orderDraftId|caseId|receiptIds|providerIds|productIds|token|secret|authorization|cookie|nonce|email|address|fullName)"\s*:/iu;

const PUBLIC_SQUARE_SLUG = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,159}$/u;
const PUBLIC_SQUARE_LOCALES = new Set(["pl", "en", "de"]);

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function canonicalPublicBrowserOrigin(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw.length > 2048 || containsUnsafeControlOrBidi(raw, { allowHorizontalTab: true, allowLineFeed: true, allowCarriageReturn: true })) {
    throw new Error("system_clipboard_public_origin_invalid");
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("system_clipboard_public_origin_invalid");
  }
  const localhost = parsed.hostname === "localhost"
    || parsed.hostname === "127.0.0.1"
    || parsed.hostname === "[::1]";
  if (
    parsed.username
    || parsed.password
    || parsed.pathname !== "/"
    || parsed.search
    || parsed.hash
    || (parsed.protocol !== "https:" && !(localhost && parsed.protocol === "http:"))
    || raw.replace(/\/$/u, "") !== parsed.origin
  ) {
    throw new Error("system_clipboard_public_origin_invalid");
  }
  return parsed.origin;
}

export function serializeSafePublicSystemClipboardText(
  value: unknown,
  maxBytes = MAX_PUBLIC_SYSTEM_CLIPBOARD_TEXT_BYTES,
): string {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_PUBLIC_SYSTEM_CLIPBOARD_TEXT_BYTES) {
    throw new Error("system_clipboard_public_budget_invalid");
  }
  if (typeof value !== "string") {
    throw new Error("system_clipboard_public_text_invalid");
  }
  const text = value.replace(/\r\n?/gu, "\n").trim();
  if (!text || containsUnsafeControlOrBidi(text, { allowHorizontalTab: true, allowLineFeed: true, allowCarriageReturn: true })) {
    throw new Error("system_clipboard_public_text_invalid");
  }
  const bytes = utf8ByteLength(text);
  if (bytes < 1 || bytes > maxBytes) {
    throw new Error("system_clipboard_public_payload_out_of_bounds");
  }
  return text;
}

export function buildSafePublicSquarePostClipboardUrl(input: {
  origin: unknown;
  locale: unknown;
  slug: unknown;
}): string {
  const origin = canonicalPublicBrowserOrigin(input.origin);
  const locale = typeof input.locale === "string" ? input.locale.trim() : "";
  const slug = typeof input.slug === "string" ? input.slug.trim() : "";
  if (!PUBLIC_SQUARE_LOCALES.has(locale)) {
    throw new Error("system_clipboard_public_locale_invalid");
  }
  if (!PUBLIC_SQUARE_SLUG.test(slug) || utf8ByteLength(slug) > 160) {
    throw new Error("system_clipboard_public_slug_invalid");
  }
  const target = new URL(`/${locale}/square`, origin);
  target.hash = slug;
  return target.toString();
}

async function writeValidatedSystemClipboardText(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
  if (typeof globalThis.isSecureContext === "boolean" && !globalThis.isSecureContext) return false;
  await navigator.clipboard.writeText(text);
  return true;
}

export async function writeSafePublicSystemClipboardText(
  value: unknown,
  maxBytes = MAX_PUBLIC_SYSTEM_CLIPBOARD_TEXT_BYTES,
): Promise<boolean> {
  return writeValidatedSystemClipboardText(
    serializeSafePublicSystemClipboardText(value, maxBytes),
  );
}

export async function copyPublicCommunityText(value: unknown): Promise<boolean> {
  return writeSafePublicSystemClipboardText(value, MAX_PUBLIC_SYSTEM_CLIPBOARD_TEXT_BYTES);
}

export async function copyPublicSquarePostLink(input: {
  origin: unknown;
  locale: unknown;
  slug: unknown;
}): Promise<boolean> {
  return writeSafePublicSystemClipboardText(
    buildSafePublicSquarePostClipboardUrl(input),
    2048,
  );
}

function cleanText(value: unknown, maxLength = 240): string {
  return stripUnsafeControlOrBidi(String(value ?? ""), "", { allowHorizontalTab: true, allowLineFeed: true, allowCarriageReturn: true })
    .trim()
    .slice(0, maxLength);
}

function cleanList(value: unknown, maxItems = 30, maxLength = 120): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const cleaned = cleanText(item, maxLength);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
    if (result.length >= maxItems) break;
  }
  return result;
}

function cleanLanes(value: unknown): Array<{ lane: string; state: string }> {
  if (!Array.isArray(value)) return [];
  const result: Array<{ lane: string; state: string }> = [];
  for (const row of value.slice(0, 16)) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const lane = cleanText((row as { lane?: unknown }).lane, 80);
    const state = cleanText((row as { state?: unknown }).state, 80);
    if (!lane && !state) continue;
    result.push({ lane: lane || "unspecified", state: state || "unknown" });
  }
  return result;
}

export type PrivateAccountClipboardSummary = {
  schema: "velmere.browser.system-clipboard.private-account-summary.v1";
  artifactSchema: string;
  source: string;
  symbol: string;
  timeframe: string;
  status: string;
  reviewGate: string;
  lanes: Array<{ lane: string; state: string }>;
  clipboardBoundary: "redacted-summary-only";
  identifiersIncluded: false;
  secretsIncluded: false;
  durableAuthority: false;
  warning: string;
};

export function buildPrivateAccountClipboardSummary(input: unknown): PrivateAccountClipboardSummary {
  const row = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  return {
    schema: "velmere.browser.system-clipboard.private-account-summary.v1",
    artifactSchema: cleanText(row.schema, 160) || "unknown-artifact",
    source: cleanText(row.source, 64) || "unknown-source",
    symbol: cleanText(row.symbol, 32) || "unknown-symbol",
    timeframe: cleanText(row.timeframe, 32) || "unknown-timeframe",
    status: cleanText(row.status ?? row.deliveryState, 96) || "unknown-status",
    reviewGate: cleanText(row.reviewGate ?? row.reviewStatus, 96) || "not-provided",
    lanes: cleanLanes(row.lanes),
    clipboardBoundary: "redacted-summary-only",
    identifiersIncluded: false,
    secretsIncluded: false,
    durableAuthority: false,
    warning: "System clipboard is external to Velmere; private identifiers, proofs, routes, hashes and session/download authority were removed.",
  };
}

export type AdminSupportClipboardSummary = {
  schema: "velmere.browser.system-clipboard.admin-support-summary.v1";
  latestEvent: string | null;
  latestStatus: string | null;
  nextExpectedEvents: string[];
  reasonCodes: string[];
  productCount: number;
  providerCount: number;
  receiptCount: number;
  clipboardBoundary: "redacted-summary-only";
  identifiersIncluded: false;
  secretsIncluded: false;
  warning: string;
};

export function buildAdminSupportClipboardSummary(input: unknown): AdminSupportClipboardSummary {
  const row = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const receiptIds = row.receiptIds && typeof row.receiptIds === "object" && !Array.isArray(row.receiptIds)
    ? Object.values(row.receiptIds as Record<string, unknown>).filter((value) => cleanText(value, 256)).length
    : 0;
  return {
    schema: "velmere.browser.system-clipboard.admin-support-summary.v1",
    latestEvent: cleanText(row.latestEvent, 120) || null,
    latestStatus: cleanText(row.latestStatus, 120) || null,
    nextExpectedEvents: cleanList(row.nextExpectedEvents, 20, 120),
    reasonCodes: cleanList(row.reasonCodes, 30, 120),
    productCount: cleanList(row.productIds, 30, 160).length,
    providerCount: cleanList(row.providerIds, 30, 160).length,
    receiptCount: Math.min(receiptIds, 30),
    clipboardBoundary: "redacted-summary-only",
    identifiersIncluded: false,
    secretsIncluded: false,
    warning: "System clipboard is external to Velmere; order, case, receipt, provider and product identifiers were removed.",
  };
}

export type AssetAnalysisClipboardSummary = {
  schema: "velmere.browser.system-clipboard.asset-analysis-summary.v1";
  symbol: string;
  timeframe: string;
  action: string;
  state: string;
  sourceState: string;
  readyCount: number;
  reviewCount: number;
  itemCount: number;
  riskBand: string;
  clipboardBoundary: "redacted-summary-only";
  identifiersIncluded: false;
  timestampsIncluded: false;
  sourceClaimsIncluded: false;
  secretsIncluded: false;
  durableAuthority: false;
  warning: string;
};

function boundedCount(value: unknown, maximum = 10_000): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.min(Math.trunc(numeric), maximum);
}

function cleanRiskBand(value: unknown): string {
  const text = cleanText(value, 48).toLowerCase();
  if (!text) return "not-provided";
  if (/critical|very[- ]?high|extreme/u.test(text)) return "critical";
  if (/high|elevated/u.test(text)) return "high";
  if (/medium|moderate/u.test(text)) return "medium";
  if (/low|minimal/u.test(text)) return "low";
  const numeric = Number(text.match(/\d+(?:\.\d+)?/u)?.[0] ?? NaN);
  if (!Number.isFinite(numeric)) return "present-redacted";
  if (numeric >= 80) return "critical";
  if (numeric >= 60) return "high";
  if (numeric >= 30) return "medium";
  return "low";
}

export function buildAssetAnalysisClipboardSummary(input: unknown): AssetAnalysisClipboardSummary {
  const row = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const commandSurface = row.commandSurface && typeof row.commandSurface === "object" && !Array.isArray(row.commandSurface)
    ? row.commandSurface as Record<string, unknown>
    : {};
  const decisionQueue = row.decisionQueue && typeof row.decisionQueue === "object" && !Array.isArray(row.decisionQueue)
    ? row.decisionQueue as Record<string, unknown>
    : {};
  return {
    schema: "velmere.browser.system-clipboard.asset-analysis-summary.v1",
    symbol: cleanText(row.symbol, 32) || "unknown-symbol",
    timeframe: cleanText(row.timeframe, 32) || "unknown-timeframe",
    action: cleanText(row.action ?? row.activeAction ?? row.vaultLane, 96) || "summary",
    state: cleanText(row.state ?? row.handoff ?? commandSurface.state ?? decisionQueue.state, 96) || "unknown-state",
    sourceState: cleanText(row.sourceState ?? row.sourceHealth ?? row.remoteState, 96) || "source-state-redacted",
    readyCount: boundedCount(row.readyCount),
    reviewCount: boundedCount(row.reviewCount),
    itemCount: boundedCount(row.itemCount ?? row.replayCount ?? row.candleCount),
    riskBand: cleanRiskBand(row.riskBand ?? row.riskLabel ?? row.risk),
    clipboardBoundary: "redacted-summary-only",
    identifiersIncluded: false,
    timestampsIncluded: false,
    sourceClaimsIncluded: false,
    secretsIncluded: false,
    durableAuthority: false,
    warning: "System clipboard is external to Velmere; receipt IDs, packet IDs, source labels, timestamps, routes, claims, hashes and session authority were removed.",
  };
}

export function serializeSafeSystemClipboardJson(summary: PrivateAccountClipboardSummary | AdminSupportClipboardSummary | AssetAnalysisClipboardSummary): string {
  const text = JSON.stringify(summary, null, 2);
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes < 2 || bytes > MAX_SYSTEM_CLIPBOARD_JSON_BYTES) {
    throw new Error("system_clipboard_payload_out_of_bounds");
  }
  if (BLOCKED_JSON_KEY.test(text)) {
    throw new Error("system_clipboard_sensitive_key_detected");
  }
  return text;
}

export async function writeSafeSystemClipboardJson(
  summary: PrivateAccountClipboardSummary | AdminSupportClipboardSummary | AssetAnalysisClipboardSummary,
): Promise<boolean> {
  return writeValidatedSystemClipboardText(serializeSafeSystemClipboardJson(summary));
}

export async function copyPrivateAccountArtifactSummary(input: unknown): Promise<boolean> {
  return writeSafeSystemClipboardJson(buildPrivateAccountClipboardSummary(input));
}

export async function copyAdminSupportSummary(input: unknown): Promise<boolean> {
  return writeSafeSystemClipboardJson(buildAdminSupportClipboardSummary(input));
}

export async function copyAssetAnalysisSummary(input: unknown): Promise<boolean> {
  return writeSafeSystemClipboardJson(buildAssetAnalysisClipboardSummary(input));
}
