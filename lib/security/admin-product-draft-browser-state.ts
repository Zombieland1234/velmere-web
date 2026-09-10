import type { ProductImportDraft } from "@/lib/products/types";
import { parseStrictJsonText } from "@/lib/security/strict-json-boundary";

export const PASS36_A102R12_ADMIN_PRODUCT_DRAFT_BROWSER_STATE_BOUNDARY_ID =
  "pass36-a102r12-admin-product-draft-current-tab-scope-v1" as const;

export const LEGACY_ADMIN_PRODUCT_DRAFT_STORAGE_KEYS = [
  "velmere-admin-import-drafts-v2",
  "velmere-admin-import-selected-v2",
] as const;

const MAX_DRAFTS = 100;
const MAX_SELECTED_IDS = 100;
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
const SAFE_SCOPE_DIGEST = /^[a-f0-9]{16,64}$/;

type RemovableStorage = Pick<Storage, "removeItem">;

export type AdminProductDraftCurrentTabSnapshot = {
  scopeDigest: string;
  drafts: ProductImportDraft[];
  selectedDraftIds: string[];
};

export type AdminProductDraftCurrentTabWriteResult =
  | { stored: true; draftCount: number; selectedCount: number; bytes: number }
  | { stored: false; reason: "invalid_scope" | "snapshot_too_large" | "invalid_snapshot" };

let currentScopeDigest = "";
let currentSnapshot: AdminProductDraftCurrentTabSnapshot | null = null;
let legacyStoragePurged = false;

function normalizeScopeDigest(value: unknown) {
  const clean = String(value ?? "").trim().toLowerCase();
  return SAFE_SCOPE_DIGEST.test(clean) ? clean : "";
}

export function purgeLegacyAdminProductDraftBrowserState(
  storage?: RemovableStorage | null,
) {
  if (legacyStoragePurged && storage === undefined) return 0;
  const target = storage ?? (
    typeof window !== "undefined" ? window.localStorage : null
  );
  if (!target) return 0;
  let attempted = 0;
  for (const key of LEGACY_ADMIN_PRODUCT_DRAFT_STORAGE_KEYS) {
    try {
      target.removeItem(key);
      attempted += 1;
    } catch {
      // Legacy admin drafts are deleted without reading, parsing or migration.
    }
  }
  if (storage === undefined) legacyStoragePurged = true;
  return attempted;
}

function cloneAndValidateSnapshot(input: AdminProductDraftCurrentTabSnapshot) {
  const serialized = JSON.stringify(input);
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > MAX_SNAPSHOT_BYTES) {
    return { ok: false as const, reason: "snapshot_too_large" as const, bytes };
  }
  try {
    const parsed = parseStrictJsonText<AdminProductDraftCurrentTabSnapshot>(serialized, {
      maxBytes: MAX_SNAPSHOT_BYTES,
      maxDepth: 64,
      maxNodes: 150_000,
      requireObject: true,
    });
    if (!Array.isArray(parsed.drafts) || !Array.isArray(parsed.selectedDraftIds)) {
      return { ok: false as const, reason: "invalid_snapshot" as const, bytes };
    }
    const drafts = parsed.drafts.slice(0, MAX_DRAFTS);
    const draftIds = new Set(
      drafts
        .map((draft) => String(draft?.draftId ?? "").trim())
        .filter(Boolean),
    );
    const selectedDraftIds = Array.from(new Set(
      parsed.selectedDraftIds
        .map((id) => String(id ?? "").trim())
        .filter((id) => draftIds.has(id)),
    )).slice(0, MAX_SELECTED_IDS);
    return {
      ok: true as const,
      value: {
        scopeDigest: parsed.scopeDigest,
        drafts,
        selectedDraftIds,
      },
      bytes,
    };
  } catch {
    return { ok: false as const, reason: "invalid_snapshot" as const, bytes };
  }
}

function bindCurrentTabScope(scopeDigest: string) {
  if (currentScopeDigest && currentScopeDigest !== scopeDigest) {
    currentSnapshot = null;
  }
  currentScopeDigest = scopeDigest;
}

export function readAdminProductDraftCurrentTabState(
  scopeDigestInput: unknown,
): AdminProductDraftCurrentTabSnapshot | null {
  purgeLegacyAdminProductDraftBrowserState();
  const scopeDigest = normalizeScopeDigest(scopeDigestInput);
  if (!scopeDigest) return null;
  bindCurrentTabScope(scopeDigest);
  if (!currentSnapshot || currentSnapshot.scopeDigest !== scopeDigest) return null;
  const cloned = cloneAndValidateSnapshot(currentSnapshot);
  return cloned.ok ? cloned.value : null;
}

export function writeAdminProductDraftCurrentTabState(input: {
  scopeDigest: unknown;
  drafts: ProductImportDraft[];
  selectedDraftIds: string[];
}): AdminProductDraftCurrentTabWriteResult {
  purgeLegacyAdminProductDraftBrowserState();
  const scopeDigest = normalizeScopeDigest(input.scopeDigest);
  if (!scopeDigest) return { stored: false, reason: "invalid_scope" };
  bindCurrentTabScope(scopeDigest);
  const cloned = cloneAndValidateSnapshot({
    scopeDigest,
    drafts: Array.isArray(input.drafts) ? input.drafts.slice(0, MAX_DRAFTS) : [],
    selectedDraftIds: Array.isArray(input.selectedDraftIds)
      ? input.selectedDraftIds.slice(0, MAX_SELECTED_IDS)
      : [],
  });
  if (!cloned.ok) return { stored: false, reason: cloned.reason };
  currentSnapshot = cloned.value;
  return {
    stored: true,
    draftCount: cloned.value.drafts.length,
    selectedCount: cloned.value.selectedDraftIds.length,
    bytes: cloned.bytes,
  };
}

export function clearAdminProductDraftCurrentTabState(scopeDigestInput: unknown) {
  purgeLegacyAdminProductDraftBrowserState();
  const scopeDigest = normalizeScopeDigest(scopeDigestInput);
  if (!scopeDigest || currentScopeDigest !== scopeDigest) return false;
  currentSnapshot = null;
  return true;
}

export function resetAdminProductDraftCurrentTabStateForTests() {
  currentScopeDigest = "";
  currentSnapshot = null;
  legacyStoragePurged = false;
}
