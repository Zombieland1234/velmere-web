# Velmère products and limitations — current source truth

## Canonical topology

C13 `PRODUCT_MANIFEST.json` is generated from `lib/product/vlm-canonical-product-topology.ts` and records 20 customer-facing rows. `config/p66/p66-owner-product-topology.json` defines the same owner-corrected model: 10 product families, 15 tiered rows and 5 standalone rows.

### Tiered families

| Family | Rows | Current commercial-role interpretation |
| --- | --- | --- |
| Audit | `audit-basic`, `audit-pro`, `audit-advanced` | Basic `FREE_CORE`; Pro `CONTROLLED_BETA_CANDIDATE`; Advanced `NOT_FOR_SALE` |
| Browser | `browser-basic`, `browser-pro`, `browser-advanced` | Basic `FREE_CORE`; Pro/Advanced `NOT_FOR_SALE` |
| Shield | `shield-basic`, `shield-pro`, `shield-advanced` | Basic `FREE_CORE_ACTION_REQUIRED`; Pro/Advanced `NOT_FOR_SALE` |
| Shield Pro | `shield-pro-basic`, `shield-pro-pro`, `shield-pro-advanced` | Basic `FREE_OR_ENTITLED_BASELINE_ACTION_REQUIRED`; Pro/Advanced `NOT_FOR_SALE` |
| Real Markets | `real-markets-basic`, `real-markets-pro`, `real-markets-advanced` | Basic `FREE_REFERENCE_ACTION_REQUIRED`; Pro/Advanced `NOT_FOR_SALE` |

### Standalone families

- Shield Map — `FREE_REFERENCE_ACTION_REQUIRED`.
- Market Impact — `FREE_MODULE_ACTION_REQUIRED`.
- Whale Watch — `FREE_MODULE_ACTION_REQUIRED`.
- Angel — `FREE_INFORMATIONAL_ACTION_REQUIRED`.
- Risk Indicator — `FREE_DESCRIPTIVE_ACTION_REQUIRED`.

**CONFIRMED** — PDF is an output artifact of Audit and Browser in the P66 model, not a separate customer product family.

**CONFIRMED** — C13 deliberately records `activeOrSellableCount` as `NOT_ASSUMED`. A `commercialRole` label is not a sale-readiness certificate.

## Legacy topology warning

`config/pass36/a102r44p34-canonical-product-topology.json` and older PASS35 product-cell material use a 17-row model and include historical concepts such as PDF as a family or different standalone/tier mappings. Those files may remain necessary for historical receipt replay, but they do not override the P66 source topology executed by C13.

`config/pass36/current-release-authority.json` also retains R44P34/R44P35 historical counters. Use those counters only in their named historical scope.

## Product limitations

| Claim | Status | Current evidence |
| --- | --- | --- |
| Release is LIVE | BLOCKED | Current release authority says `LIVE=false` |
| Sale is enabled | BLOCKED | `saleEnabled=false`; C13 `RELEASE_GATE=NO_GO` |
| Production is approved | BLOCKED | `productionApproved=false` |
| World-class completion is proven | BLOCKED | `worldClassProven=false` |
| Audit independent real labels prove customer accuracy | BLOCKED | Current authority says `auditCustomerAccuracyProven=false` and independent labels unavailable |
| Real Stripe TEST lifecycle is verified | BLOCKED | C13 open gate |
| All product surfaces have hosted E2E | BLOCKED | C13 open gate |
| Provider rights are globally approved | BLOCKED | `global_provider_enforcement` remains open; rights evidence is incomplete/stale |
| Independent external retest is complete | BLOCKED | Current authority and C13 gate say no |
| Local/synthetic matrices exist | CONFIRMED | Multiple local matrices and C13 exact-source tests exist, within their stated scopes |
| Those local matrices prove real customer value or purchase worthiness | BLOCKED | Current authority records customer proof/value gaps |

## Terminology

Do not describe Lens, Brain, the historical 33 contexts, or PASS35 cell rows as extra current customer-facing products unless the current P66 topology is intentionally changed and requalified. They remain implementation/history concepts where present in source.
