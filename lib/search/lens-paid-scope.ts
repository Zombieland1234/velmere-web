export type LensPaidScopeResolution =
  | {
      ok: true;
      assetId: string;
      symbol: string;
    }
  | {
      ok: false;
      error: "canonical_paid_scope_invalid" | "paid_asset_scope_mismatch";
      conflicts: Array<"asset_id" | "symbol">;
    };

function trimmed(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

/**
 * Paid access is always evaluated against the immutable server-frozen report.
 * Client headers are assertions only: they may agree with the canonical scope,
 * but they can never replace it.
 */
export function resolveLensPaidScope(args: {
  canonicalAssetId: string;
  canonicalSymbol: string;
  assertedAssetId?: string | null;
  assertedSymbol?: string | null;
}): LensPaidScopeResolution {
  const canonicalAssetId = trimmed(args.canonicalAssetId);
  const canonicalSymbol = trimmed(args.canonicalSymbol)?.toUpperCase() ?? null;
  if (!canonicalAssetId || !canonicalSymbol) {
    return { ok: false, error: "canonical_paid_scope_invalid", conflicts: [] };
  }

  const assertedAssetId = trimmed(args.assertedAssetId);
  const assertedSymbol = trimmed(args.assertedSymbol)?.toUpperCase() ?? null;
  const conflicts: Array<"asset_id" | "symbol"> = [];
  if (assertedAssetId && assertedAssetId !== canonicalAssetId) conflicts.push("asset_id");
  if (assertedSymbol && assertedSymbol !== canonicalSymbol) conflicts.push("symbol");
  if (conflicts.length > 0) {
    return { ok: false, error: "paid_asset_scope_mismatch", conflicts };
  }
  return { ok: true, assetId: canonicalAssetId, symbol: canonicalSymbol };
}
