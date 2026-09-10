import type { VelmereSearchResult } from "@/lib/search/intelligence-search-contract";
import { stripUnsafeControlOrBidi } from "@/lib/security/control-character-policy";

export type Pass468PdfDepth = "basic" | "pro" | "advanced";
export type Pass468HandoffTarget = "shield" | "orbit";

/**
 * A102R14: Browser-to-Shield navigation is intentionally not an evidence packet.
 * It contains only a public canonical asset key used to start a fresh target scan.
 */
export type Pass468BrowserShieldOrbitHandoff = {
  version: "browser-shield-orbit-handoff-v2";
  assetKey: string | null;
  target: Pass468HandoffTarget;
  trustedForDisplayOnly: true;
  requiresFreshTargetScan: true;
  containsCustomerQuery: false;
  containsTier: false;
  containsSourceClaims: false;
  browserPersistenceAllowed: false;
};

const LEGACY_STORAGE_PREFIX = "velmere:pass468:handoff:";
const SYMBOL_RE = /^[A-Z0-9][A-Z0-9._-]{0,23}$/u;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/u;

function clean(value: unknown, max = 120) {
  return typeof value === "string"
    ? stripUnsafeControlOrBidi(value)
        .replace(/\s+/gu, " ")
        .trim()
        .slice(0, max)
    : "";
}

function canonicalAssetKey(result: VelmereSearchResult) {
  const symbol = clean(result.symbol, 24).toUpperCase();
  if (SYMBOL_RE.test(symbol)) return symbol;

  const id = clean(result.id, 80);
  if (EVM_ADDRESS_RE.test(id)) return id.toLowerCase();
  return null;
}

/** Delete-only cleanup. Legacy values are never read or migrated. */
export function purgeLegacyPass468HandoffStorage() {
  if (typeof window === "undefined") return 0;
  try {
    const keys: string[] = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(LEGACY_STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) window.sessionStorage.removeItem(key);
    return keys.length;
  } catch {
    return 0;
  }
}

export function buildPass468HandoffPacket(
  result: VelmereSearchResult,
  _depth: Pass468PdfDepth,
  target: Pass468HandoffTarget,
): Pass468BrowserShieldOrbitHandoff {
  return {
    version: "browser-shield-orbit-handoff-v2",
    assetKey: canonicalAssetKey(result),
    target,
    trustedForDisplayOnly: true,
    requiresFreshTargetScan: true,
    containsCustomerQuery: false,
    containsTier: false,
    containsSourceClaims: false,
    browserPersistenceAllowed: false,
  };
}

/**
 * Compatibility shim: a handoff is no longer stored in sessionStorage.
 * Returning true means the packet is structurally safe for route construction,
 * not that any browser authority was persisted.
 */
export function writePass468HandoffPacket(packet: Pass468BrowserShieldOrbitHandoff) {
  purgeLegacyPass468HandoffStorage();
  return packet.version === "browser-shield-orbit-handoff-v2"
    && packet.browserPersistenceAllowed === false;
}

/** Legacy browser packets are never trusted or restored. */
export function readPass468HandoffPacket(_payloadId?: string | null) {
  purgeLegacyPass468HandoffStorage();
  return null;
}

export function buildPass468HandoffHref(
  locale: string,
  packet: Pass468BrowserShieldOrbitHandoff,
) {
  const safeLocale = locale === "de" || locale === "en" ? locale : "pl";
  const path = packet.target === "orbit" ? "shield-map" : "market-integrity";
  const params = new URLSearchParams();
  if (packet.assetKey) params.set("asset", packet.assetKey);
  params.set("from", "velmere-browser");
  params.set("view", packet.target === "orbit" ? "orbit" : "full");
  const query = params.toString();
  return `/${safeLocale}/${path}${query ? `?${query}` : ""}`;
}
