import type { MarketIntegrityRow } from "@/lib/market-integrity/market-row-types";

/**
 * Initial render has no observed market data. Historical constants and generated
 * candles must never impersonate a provider observation. Keep SSR and hydration
 * identical; the existing loading/empty UI handles this state until the server
 * returns source-bound rows.
 */
export function getShieldInstantBootstrapRows(): MarketIntegrityRow[] {
  return [];
}
