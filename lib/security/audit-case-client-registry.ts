export const PASS4614_AUDIT_ACCOUNT_PORTAL_ID = "pass4614-account-audit-status-portal-polling" as const;
export const PASS4614_AUDIT_CASE_REGISTRY_KEY = "velmere:audit-case-refs:v1" as const;
export const PASS4614_AUDIT_CASE_REGISTRY_EVENT = "velmere:audit-cases-changed" as const;

export type AuditCaseBookmarkTier = "basic" | "pro" | "advanced";

export type AuditCaseBookmark = {
  caseRef: string;
  tier?: AuditCaseBookmarkTier;
  savedAt: string;
  lastSeenAt?: string;
};

const MAX_BOOKMARKS = 12;

export function normalizeAuditCaseRef(value: unknown) {
  const clean = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 24);
  return /^AUD-[A-Z0-9]{8,16}$/.test(clean) ? clean : "";
}

function normalizeTier(value: unknown): AuditCaseBookmarkTier | undefined {
  return value === "basic" || value === "pro" || value === "advanced" ? value : undefined;
}

function normalizeTimestamp(value: unknown, fallback: string) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function normalizeBookmarks(value: unknown): AuditCaseBookmark[] {
  if (!Array.isArray(value)) return [];
  const now = new Date().toISOString();
  const unique = new Map<string, AuditCaseBookmark>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const source = item as Partial<AuditCaseBookmark>;
    const caseRef = normalizeAuditCaseRef(source.caseRef);
    if (!caseRef || unique.has(caseRef)) continue;
    unique.set(caseRef, {
      caseRef,
      tier: normalizeTier(source.tier),
      savedAt: normalizeTimestamp(source.savedAt, now),
      lastSeenAt: source.lastSeenAt ? normalizeTimestamp(source.lastSeenAt, now) : undefined,
    });
    if (unique.size >= MAX_BOOKMARKS) break;
  }
  return Array.from(unique.values());
}

let inMemoryAuditCaseBookmarks: AuditCaseBookmark[] = [];
let legacyAuditCaseRegistryPurged = false;

function purgeLegacyAuditCaseRegistry() {
  if (legacyAuditCaseRegistryPurged || typeof window === "undefined") return;
  legacyAuditCaseRegistryPurged = true;
  try {
    window.localStorage.removeItem(PASS4614_AUDIT_CASE_REGISTRY_KEY);
  } catch {
    // Legacy customer activity is never read or migrated.
  }
}

export function readAuditCaseBookmarks(): AuditCaseBookmark[] {
  purgeLegacyAuditCaseRegistry();
  return inMemoryAuditCaseBookmarks.map((item) => ({ ...item }));
}

function writeAuditCaseBookmarks(bookmarks: AuditCaseBookmark[]) {
  if (typeof window === "undefined") return;
  purgeLegacyAuditCaseRegistry();
  inMemoryAuditCaseBookmarks = normalizeBookmarks(bookmarks)
    .slice(0, MAX_BOOKMARKS)
    .map((item) => ({ ...item }));
  window.dispatchEvent(new CustomEvent(PASS4614_AUDIT_CASE_REGISTRY_EVENT));
}

export function rememberAuditCaseRef(
  value: unknown,
  details: { tier?: AuditCaseBookmarkTier; lastSeenAt?: string } = {},
) {
  const caseRef = normalizeAuditCaseRef(value);
  if (!caseRef || typeof window === "undefined") return false;
  const now = new Date().toISOString();
  const previous = readAuditCaseBookmarks();
  const existing = previous.find((item) => item.caseRef === caseRef);
  const next: AuditCaseBookmark = {
    caseRef,
    tier: details.tier ?? existing?.tier,
    savedAt: existing?.savedAt ?? now,
    lastSeenAt: details.lastSeenAt ?? existing?.lastSeenAt,
  };
  writeAuditCaseBookmarks([next, ...previous.filter((item) => item.caseRef !== caseRef)]);
  return true;
}

export function forgetAuditCaseRef(value: unknown) {
  const caseRef = normalizeAuditCaseRef(value);
  if (!caseRef || typeof window === "undefined") return false;
  const previous = readAuditCaseBookmarks();
  const next = previous.filter((item) => item.caseRef !== caseRef);
  if (next.length === previous.length) return false;
  writeAuditCaseBookmarks(next);
  return true;
}
