import { stripUnsafeControlOrBidi } from "@/lib/security/control-character-policy";

export type VelmereClientProfile = {
  displayName: string;
  email?: string;
  accountId?: string;
  provider?: "email" | "google" | "google_preview" | "preview" | "server" | string;
  handle?: string;
  sessionSource?: "server" | "cookie" | "header" | string;
};

export type VelmereClientAuthProbe =
  | { status: "authenticated"; profile: VelmereClientProfile }
  | { status: "unauthenticated"; profile?: null }
  | { status: "unavailable"; profile?: null };

export type VelmereClientAuthState = {
  authenticated: boolean;
  profile: VelmereClientProfile | null;
  status: VelmereClientAuthProbe["status"];
};

const LEGACY_AUTH_STORAGE_KEYS = [
  "velmere:account-session",
  "velmere:account-profile",
] as const;

function boundedText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const normalized = stripUnsafeControlOrBidi(value, " ").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function normalizeProfile(profile: VelmereClientProfile) {
  const displayName = boundedText(profile.displayName, 80);
  if (!displayName) return null;
  return {
    displayName,
    email: boundedText(profile.email, 180),
    accountId: boundedText(profile.accountId, 160),
    provider: boundedText(profile.provider, 48),
    handle: boundedText(profile.handle, 64),
    sessionSource: "server",
  } satisfies VelmereClientProfile;
}

export function resolveVelmereClientAuthState(probe: VelmereClientAuthProbe): VelmereClientAuthState {
  if (probe.status !== "authenticated") {
    return { authenticated: false, profile: null, status: probe.status };
  }
  const profile = normalizeProfile(probe.profile);
  if (!profile) {
    return { authenticated: false, profile: null, status: "unauthenticated" };
  }
  return { authenticated: true, profile, status: "authenticated" };
}

export function purgeLegacyVelmereClientAuthCache(storage: Pick<Storage, "removeItem"> | null | undefined) {
  if (!storage) return;
  for (const key of LEGACY_AUTH_STORAGE_KEYS) storage.removeItem(key);
}

export function legacyVelmereClientAuthStorageKeys() {
  return [...LEGACY_AUTH_STORAGE_KEYS];
}
