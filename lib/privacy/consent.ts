import { parseStrictJsonText } from "@/lib/security/strict-json-boundary";

export type ConsentChoice = {
  schemaVersion: "velmere.browser-consent-choice.v2";
  policyVersion: string;
  decidedAt: string;
  expiresAt: string;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  source: "user_choice";
  legalProof: false;
  serverRecorded: false;
};

export type ConsentPreferences = Pick<ConsentChoice, "analytics" | "marketing">;

export const CONSENT_STORAGE_KEY = "velmere_cookie_consent_v2";
export const LEGACY_CONSENT_STORAGE_KEYS = ["velmere_cookie_consent_v1", "velmere_cookie_consent"] as const;
export const CONSENT_POLICY_VERSION = "2026-07-30";
export const CONSENT_TTL_MS = 1000 * 60 * 60 * 24 * 180;
const MAX_CONSENT_BYTES = 2048;
const CLOCK_SKEW_MS = 5 * 60_000;
const EXACT_KEYS = new Set([
  "schemaVersion",
  "policyVersion",
  "decidedAt",
  "expiresAt",
  "necessary",
  "analytics",
  "marketing",
  "source",
  "legalProof",
  "serverRecorded",
]);

export type BrowserConsentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function canonicalIso(value: unknown) {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  try {
    if (new Date(timestamp).toISOString() !== value) return null;
  } catch {
    return null;
  }
  return { value, timestamp };
}

export function createGranularConsentChoice(input: {
  analytics: boolean;
  marketing: boolean;
  now?: Date;
}): ConsentChoice {
  const now = input.now ?? new Date();
  const decidedAt = now.toISOString();
  return {
    schemaVersion: "velmere.browser-consent-choice.v2",
    policyVersion: CONSENT_POLICY_VERSION,
    decidedAt,
    expiresAt: new Date(now.getTime() + CONSENT_TTL_MS).toISOString(),
    necessary: true,
    analytics: input.analytics === true,
    marketing: input.marketing === true,
    source: "user_choice",
    legalProof: false,
    serverRecorded: false,
  };
}

export function createConsentChoice(choice: "accepted" | "declined", now?: Date): ConsentChoice {
  return createGranularConsentChoice({
    analytics: choice === "accepted",
    marketing: choice === "accepted",
    now,
  });
}

export function serializeConsentChoice(choice: ConsentChoice) {
  const verified = parseConsent(JSON.stringify(choice), new Date(choice.decidedAt));
  if (!verified) throw new Error("browser_consent_choice_invalid");
  return JSON.stringify(verified);
}

export function parseConsent(value: string | null, now = new Date()): ConsentChoice | null {
  if (!value || new TextEncoder().encode(value).byteLength > MAX_CONSENT_BYTES) return null;
  try {
    const parsed = parseStrictJsonText<Record<string, unknown>>(value, {
      maxBytes: MAX_CONSENT_BYTES,
      maxDepth: 4,
      maxNodes: 32,
      requireObject: true,
    });
    const keys = Object.keys(parsed);
    if (keys.length !== EXACT_KEYS.size || keys.some((key) => !EXACT_KEYS.has(key))) return null;
    if (
      parsed.schemaVersion !== "velmere.browser-consent-choice.v2"
      || parsed.policyVersion !== CONSENT_POLICY_VERSION
      || parsed.necessary !== true
      || typeof parsed.analytics !== "boolean"
      || typeof parsed.marketing !== "boolean"
      || parsed.source !== "user_choice"
      || parsed.legalProof !== false
      || parsed.serverRecorded !== false
    ) return null;

    const decidedAt = canonicalIso(parsed.decidedAt);
    const expiresAt = canonicalIso(parsed.expiresAt);
    if (!decidedAt || !expiresAt) return null;
    const nowMs = now.getTime();
    if (!Number.isFinite(nowMs)) return null;
    if (decidedAt.timestamp > nowMs + CLOCK_SKEW_MS) return null;
    if (expiresAt.timestamp <= decidedAt.timestamp) return null;
    if (expiresAt.timestamp - decidedAt.timestamp !== CONSENT_TTL_MS) return null;
    if (expiresAt.timestamp <= nowMs) return null;

    return {
      schemaVersion: "velmere.browser-consent-choice.v2",
      policyVersion: CONSENT_POLICY_VERSION,
      decidedAt: decidedAt.value,
      expiresAt: expiresAt.value,
      necessary: true,
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      source: "user_choice",
      legalProof: false,
      serverRecorded: false,
    };
  } catch {
    return null;
  }
}

export function purgeLegacyConsentStorage(storage: BrowserConsentStorage | null | undefined) {
  if (!storage) return 0;
  let removed = 0;
  for (const key of LEGACY_CONSENT_STORAGE_KEYS) {
    try {
      storage.removeItem(key);
      removed += 1;
    } catch {
      // Browser storage can be unavailable. Consent remains default-off.
    }
  }
  return removed;
}

export function readBrowserConsent(storage: BrowserConsentStorage | null | undefined, now = new Date()) {
  if (!storage) return null;
  purgeLegacyConsentStorage(storage);
  try {
    const raw = storage.getItem(CONSENT_STORAGE_KEY);
    const parsed = parseConsent(raw, now);
    if (!parsed && raw !== null) storage.removeItem(CONSENT_STORAGE_KEY);
    return parsed;
  } catch {
    return null;
  }
}

export function writeBrowserConsent(
  storage: BrowserConsentStorage | null | undefined,
  preferences: ConsentPreferences,
  now = new Date(),
) {
  if (!storage) return null;
  purgeLegacyConsentStorage(storage);
  const choice = createGranularConsentChoice({ ...preferences, now });
  try {
    storage.setItem(CONSENT_STORAGE_KEY, serializeConsentChoice(choice));
    return choice;
  } catch {
    return null;
  }
}

export function clearBrowserConsent(storage: BrowserConsentStorage | null | undefined) {
  if (!storage) return false;
  try {
    storage.removeItem(CONSENT_STORAGE_KEY);
    purgeLegacyConsentStorage(storage);
    return true;
  } catch {
    return false;
  }
}

export function consentAllows(choice: ConsentChoice | null, category: "analytics" | "marketing") {
  return Boolean(choice && choice[category] === true);
}
