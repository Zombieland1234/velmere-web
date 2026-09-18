# Velmère providers and commercial-rights truth

Technical integration and legal/commercial rights are separate facts.

## Current evidence boundary

The legacy provider-commercial-rights registry contains 28 rows:
- 22 `CODE_PRESENT`;
- 5 `NOT_INTEGRATED`;
- 1 `DIAGNOSTIC_ONLY`.

Its rights states are:
- 17 `UNVERIFIED`;
- 4 `RIGHTS_UNVERIFIED`;
- 1 `RIGHTS_UNVERIFIED_DESPITE_BRAND_RESPONSE`;
- 1 `RIGHTS_UNVERIFIED_PER_PLAN`;
- 3 `PARTIAL_PER_USE_CASE`;
- 1 `RIGHTS_RESTRICTED`;
- 1 `RIGHTS_RESTRICTED_FOR_COMMERCIAL`.

`config/pass22/provider-rights-evidence-manifest.json` currently contains an empty evidence array.

The newer field-rights/currentness registry under `config/p90` contains source captures whose `reverifyBy` dates include 2026-09-03. On the C14-P03 audit date, 2026-09-18, those captures are stale for a claim of current commercial approval. The R7 ECB usage-policy review has `validUntil=2026-08-31` and is likewise expired for current approval.

C13 therefore correctly keeps `global_provider_enforcement` open.

## Provider classification from the repository registry

### Technical code present

Alchemy, Alpha Vantage, Angel external, Binance, Coinbase, CoinGecko, CoinMarketCap, Contrado, DeFiLlama, Etherscan, Gemini, Kraken, OpenAI, Polygon, Printful, Pyth, QuickNode, Resend, Stripe, Supabase, Tapstitch and Twelve Data.

**PARTIAL** — this confirms code presence in the registry. It does not prove current credentials, live reachability, plan entitlement, commercial permission, redistribution rights or production use.

### Not integrated

Arkham, Chainlink, DEXScreener, Blockaid and RWA.xyz.

**CONFIRMED** — that is the registry state in the audited source. Chainlink's recorded brand response is not treated as a data-use license.

### Diagnostic only

CoinPaprika.

### Rights-specific exceptions

- Alpha Vantage: `RIGHTS_RESTRICTED_FOR_COMMERCIAL`.
- DeFiLlama: `RIGHTS_RESTRICTED`.
- CoinGecko, Etherscan, Twelve Data: `PARTIAL_PER_USE_CASE`.
- Pyth: `RIGHTS_UNVERIFIED_PER_PLAN`.
- Chainlink: `RIGHTS_UNVERIFIED_DESPITE_BRAND_RESPONSE`.
- All other registry rows remain unverified under their recorded state.

## Interpretation rules

1. `CODE_PRESENT` never means commercially approved.
2. A logo/brand permission never implies data/API redistribution rights.
3. A public/free endpoint never implies paid-product rights.
4. Historical terms captures must be re-verified after their currentness deadline.
5. Stripe and Supabase being technically connected does not prove the paid lifecycle or customer auth lifecycle.
6. No provider may be described as globally approved while the current evidence manifest is empty/stale and the C13 global-provider gate remains open.

Provider-rights claims should remain BLOCKED or PARTIAL until a current, attributable terms/contract record is captured and bound to the exact use case.
