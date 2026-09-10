"use client";

const MAX_BUCKET_ROWS = 100;

type Listener = () => void;

const buckets = new Map<string, readonly unknown[]>();
const listeners = new Set<Listener>();
let revision = 0;

export const LEGACY_PRIVATE_ACCOUNT_STORAGE_KEYS = [
  "velmere:pass4543:asset-action-ledger",
  "velmere:pass4546:asset-report-composer",
  "velmere:pass4546:shield-pro-terminal-report-composer",
  "velmere:pass4547:asset-report-vault-bridge",
  "velmere:pass4547:shield-pro-report-vault-bridge",
  "velmere:pass4549:account-report-review-state",
  "velmere:pass4550:account-report-pdf-package",
  "velmere:pass4551:account-report-package-delivery",
  "velmere:pass4552:account-report-release-gate",
  "velmere:pass4553:account-customer-release-receipt",
  "velmere:pass4554:account-download-manifest",
  "velmere:pass4555:account-download-access-capsule",
  "velmere:pass4556:account-download-consumption-ledger",
  "velmere:pass4557:account-download-closeout-receipt",
  "velmere:pass4558:account-post-closeout-attestation",
  "velmere:pass4559:account-public-proof-index",
] as const;

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function notify() {
  revision += 1;
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // One UI subscriber must not block the remaining subscribers.
    }
  }
}

export function readPrivateAccountTabArray<T>(key: string): T[] {
  const stored = buckets.get(key) ?? [];
  return cloneValue(stored) as T[];
}

export function writePrivateAccountTabArray<T>(key: string, values: readonly T[]) {
  buckets.set(key, cloneValue(values.slice(0, MAX_BUCKET_ROWS)));
  notify();
}

export function clearPrivateAccountTabStore(keys?: readonly string[]) {
  if (keys) {
    for (const key of keys) buckets.delete(key);
  } else {
    buckets.clear();
  }
  notify();
}

export function subscribePrivateAccountTabStore(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPrivateAccountTabStoreSnapshot() {
  const rows = [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value.length}`);
  return `${revision}|${rows.join("|")}`;
}

export function purgeLegacyPrivateAccountLocalStorage() {
  if (typeof window === "undefined") return 0;
  let removed = 0;
  try {
    for (const key of LEGACY_PRIVATE_ACCOUNT_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
      removed += 1;
    }
  } catch {
    // Storage may be unavailable. No legacy value is ever read or migrated.
  }
  return removed;
}
