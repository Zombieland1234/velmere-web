# C14-P23 — PROVIDER RIGHTS / LICENSES / CONSENTS / PARTNERSHIPS

**Date:** 2026-09-18  
**Repository:** `Zombieland1234/velmere-web`  
**Base SHA:** `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`  
**Branch:** `parallel/c14-p23-provider-rights`  
**Baseline score:** **3/10**  
**C14-P23 score:** **6/10**  
**Release effect:** no customer-facing provider right was silently activated; existing runtime rights gates remain fail-closed.

> Engineering evidence classification only. This report is not legal advice and does not substitute for counsel review of a contract, order form, exchange/data license, trademark license, or jurisdiction-specific obligation.

## 1. Scope and evidence reviewed

C14-P23 separated the provider state into seven independent dimensions:

1. API/service access,
2. processing / derived use,
3. cache / storage,
4. redistribution / export,
5. commercial use,
6. logo / trademark,
7. formal partnership.

Evidence reviewed included:

- current source at the exact base SHA;
- `config/pass21/provider-commercial-rights-registry.json`;
- `config/pass22/provider-rights-evidence-manifest.json`;
- `config/pass36/a102r44p18-official-provider-rights-decision-matrix.json`;
- provider-rights resolver / validator / delivery gate code;
- prior provider MASTER retained in the user library, including the C12/C11/C10/C9 history;
- current Gmail correspondence for the providers/counterparties listed below;
- current official provider Terms/docs/pricing/brand pages where available.

No email was sent by C14-P23. No draft was sent. No plan, subscription, license or add-on was purchased.

## 2. Critical source-level finding

At the base SHA, `config/pass22/provider-rights-evidence-manifest.json` contains **zero approved evidence records**. The existing runtime resolver requires reviewed evidence, legal review, document hashes, effective/expiry checks and purpose-specific rights before returning an allowed production decision.

That fail-closed design is correct for this pass. C14-P23 therefore **did not convert business emails into runtime `APPROVED` rights**. Instead it added a separate evidence ledger and seven-dimension classification policy.

New files:

- `config/c14/p23-provider-rights-policy.json`
- `config/c14/p23-provider-rights-ledger.json`
- `_handoff/parallel/C14-P23-PROVIDER-RIGHTS.md` (this report)

## 3. Provider matrix

Legend: **YES** = confirmed in reviewed evidence; **COND** = confirmed only under a plan/license/scope; **LIMITED** = narrower than the full requested right; **PENDING** = approval discussion exists but right is not granted; **NO/UNKNOWN** = not sufficiently evidenced; **N/A** = not materially applicable to the integration.

| Provider | API | Processing | Cache/storage | Redistribution/export | Commercial | Logo/trademark | Formal partnership |
|---|---|---|---|---|---|---|---|
| Tatum | YES | YES | LIMITED | YES (written, broad) | YES (written consent) | PENDING | PENDING / not formed |
| Alpha Vantage | COND | COND | COND | LIMITED | COND | UNKNOWN | NO |
| Twelve Data | YES pre-launch / COND launch | COND | COND | LIMITED | COND | UNKNOWN | NO |
| DEX Screener | YES | LIMITED | UNKNOWN | raw restricted; derived export unconfirmed | YES | NO/UNKNOWN | NO |
| Sourcify | YES v2 | LIMITED | UNKNOWN | UNKNOWN | UNKNOWN | **YES** | NO |
| Chainlink | LIMITED technical access | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | PENDING | NO |
| Resend | YES | N/A data-feed sense | N/A data-feed sense | N/A | YES service use | **YES** | NO |
| GoPlus | YES public API | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NO |

## 4. Provider → confirmed rights → missing rights → evidence

### Tatum

**Confirmed rights**

- Tatum wrote that the Free plan should normally cover the described testing use case, subject to volume/limits.
- Daniel Tavares wrote that once raw data is obtained, Velmère is free to **index, prepare, curate, build on and resell it to customers and partners**.
- PAYG capacity can begin with real usage, with custom/enterprise options later.

**Important boundary**

The current public Tatum Terms (last updated 2026-07-23) use a default non-commercial license and require written permission for commercial/API-related uses. The direct email is therefore materially important as specific written consent and must be preserved/reviewed as such; it should not be generalized beyond its literal scope.

**Missing**

- unambiguous permission for the Tatum logo in the proposed website placement;
- exact retention limits / dataset-specific carve-outs;
- accepted partner/referral/co-selling agreement;
- hashed reviewed evidence suitable for the existing runtime gate.

**Evidence**

- Gmail message `1a0ab263e6c0aa3e`, Daniel Tavares, Tatum, 2026-09-16.
- https://tatum.io/terms-of-use

**Relationship status:** written data-use consent + pilot/partnership discussion. **Not a formal partnership.**

### Alpha Vantage

**Confirmed rights**

Alpha Vantage stated in writing that a commercial license is required before go-live even if Velmère only displays derivative values. Under the described commercial license, the provider stated that internal ingestion, derivative works, external display and caching are supported, and attribution is not required.

**Missing**

- no active commercial license/order form was found;
- raw-feed redistribution was not granted;
- exact retention/cache duration remains unspecified;
- no logo/trademark permission;
- no partnership agreement.

**Evidence**

- Gmail message `1a0ab096b4c18a64`, Alden Waterhouse, Alpha Vantage, 2026-09-16.
- https://www.alphavantage.co/terms_of_service/
- https://www.alphavantage.co/documentation/

The email's commercial prices/startup discount are an offer, not an entitlement or purchased plan.

### Twelve Data

**Confirmed rights**

Twelve Data explicitly answered yes for the described commercial path to:

- software/AI analysis;
- derived metrics;
- selected customer-facing display;
- PDF/JSON reports;
- temporary caching/storage for analysis, auditability and reproducibility;
- derived customer reports without exposing the raw API feed or credentials.

The provider also wrote that Velmère can remain on the free tier for internal development until official launch and may use it for a short beta; a Business plan is required at official commercial launch. For the described Venture scope, the provider confirmed US market data, FX, crypto and commodities display without additional licensing; other markets may require add-ons/direct licensing.

Current public guidance states that Business plans allow commercial display/internal usage subject to exchange licensing, while redistribution of data requires a separate agreement.

**Missing**

- active Business plan at launch;
- separate raw-data redistribution agreement if ever needed;
- market-specific approvals outside the confirmed scope;
- exact cache/retention duration;
- logo permission;
- formal partnership.

**Evidence**

- Gmail message `1a0aaa3756198ef2`, Liam / Twelve Data, 2026-09-16.
- https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage
- https://twelvedata.com/pricing-business

Pricing note: the provider email identified Venture 610 at USD 149/month for the discussed use case. The current public Business pricing page presents Venture as a family starting at USD 149/month while also surfacing higher-credit selections. Do not copy one displayed price as a universal plan price.

### DEX Screener

**Confirmed rights**

DEX Screener support stated that the published API Terms are the complete agreement, and confirmed that commercial use is allowed under Section 4, subject to rate limits and the Section 1 restriction against products whose primary purpose directly competes with DEX Screener. Support also stated that only the free API is currently offered.

The API Terms grant a limited API license and prohibit making/reselling the API Services to third parties.

**Missing / limited**

- no explicit cache/retention permission located;
- no separate explicit confirmation for derived PDF/JSON export;
- logo/wordmark permission was **not granted**: support specifically declined to authorize matters outside the published API Terms;
- no partnership.

**Evidence**

- Gmail message `1a040cf24aea45c3`, DEX Screener Support, 2026-08-27.
- https://docs.dexscreener.com/api/api-terms-and-conditions
- https://docs.dexscreener.com/api/reference

### Sourcify

**Confirmed rights**

- Sourcify API v2 is the current public API; v1 was shut down on 2026-07-07.
- Sourcify gave Velmère explicit written permission to display the official Sourcify **name/logo** for the factual attribution described in the request and pointed to the official asset repository.

**Missing / limited**

- no broad downstream commercial-data license was located in the reviewed API/brand evidence;
- do not infer a blanket right to redistribute verified source code: underlying source/content licenses can differ;
- cache/retention and redistribution scope for retrieved source artifacts remains to be defined if Velmère stores/exports them;
- logo permission is not a partnership/sponsorship/certification.

**Evidence**

- Gmail message `1a041bc3fdd694b6`, Sourcify / Argot Collective, 2026-08-27.
- https://docs.sourcify.dev/docs/api/
- https://sourcify.dev/server/api-docs/
- https://github.com/sourcifyeth/assets

### Chainlink

**Confirmed**

Public Data Feeds/docs and official brand assets exist. Chainlink Business Development responded to Velmère and offered to coordinate the branding/attribution question with the appropriate Chainlink team.

**Not confirmed**

That email is **not** final logo approval. It explicitly describes a process to confirm what is permitted. C14-P23 found no Velmère-specific written commercial redistribution/customer-report license and no formal partnership agreement.

**Evidence**

- Gmail thread/message `1a049951cbe3c382`, Jasper Alvarado, Chainlink Labs Business Development.
- https://chain.link/data-feeds
- https://chain.link/brand-assets

**Correction to older wording:** a positive BD response must not be summarized as “logo permission received.” Status is **branding approval pending**.

### Resend

**Confirmed rights**

Resend Customer Success replied to Velmère's exact proposed factual infrastructure attribution and said it sounds okay as long as the Resend brand guidelines are followed. This is a specific written logo/wordmark permission for the described use.

Ordinary Resend service/API use remains governed by the applicable account Terms/AUP/DPA.

**Missing / boundary**

- this is brand permission, not a formal partnership;
- provider-data redistribution categories are not the relevant legal model for transactional email infrastructure;
- privacy/DPA/subprocessor/recipient-consent review remains a separate operational compliance topic.

**Evidence**

- Gmail message `1a04144d95825dcf`, Brian / Resend, 2026-08-27.
- https://resend.com/legal/terms-of-service
- https://resend.com/brand
- https://resend.com/handbook/design/what-are-our-brand-guidelines

### GoPlus

**Confirmed**

GoPlus currently describes the Security API publicly as an **open, license-free Web3 security data API** and publishes a free/rate-limited path plus paid capacity tiers.

**Not confirmed**

The phrase “license-free” is not sufficient to invent answers to Velmère's specific downstream questions. C14-P23 found no provider reply to the 2026-09-16 email asking about:

- commercial SaaS use,
- paid PDF/JSON reports,
- storage for evidence/reproducibility,
- source attribution/logo,
- partnership/referral/co-marketing.

Those remain unconfirmed.

**Evidence**

- Velmère outgoing Gmail message `1a0aaae80e92bf00`; no provider reply located.
- https://www.gopluslabs.io/en/security-api
- https://docs.gopluslabs.io/reference/support

## 5. Relationship / “partnership” truth table

These counterparties are kept separate from provider licensing because collaboration interest is not a data license and a pilot is not a formal partnership.

| Counterparty | Verified status | Partnership wording allowed now? |
|---|---|---|
| Bolyra | exploratory exchange; counterparty explicitly left it there pending a deployed workflow / decision owner | **No** |
| NeuroForge | exploratory methodology comparison; explicitly “rather than an active design partnership” | **No** |
| EVE Verified | bounded methodology exchange/reproduction proceeded | **No public partnership/certification claim** |
| PrivateDAO | pilot accepted; PrivateDAO proposed formal technical collaboration, but Velmère's reviewed response made the framework a proposal for review, not an already accepted public partnership | **No, not yet** |
| ZeroVaultID | private bounded pilot accepted; publication referencing ZeroVaultID requires prior written approval | **No** |
| PactVerity | bounded no-charge reproducibility/methodology review; no endorsement/certification | **No** |

Evidence IDs are preserved in `config/c14/p23-provider-rights-ledger.json`.

## 6. Providers not freshly re-verified in C14-P23

The following entries remain under their base-registry fail-closed state and **receive no new rights from this pass**:

`alchemy`, `angel_external`, `arkham`, `binance`, `coinbase`, `coingecko`, `coinmarketcap`, `coinpaprika`, `contrado`, `defillama`, `blockaid`, `etherscan`, `gemini`, `kraken`, `openai`, `polygon`, `printful`, `pyth`, `quicknode`, `rwa_xyz`, `stripe`, `supabase`, `tapstitch`.

This list is deliberate. C14-P23 does not convert old summaries into fresh approval merely to increase coverage.

## 7. Patches

### Added seven-dimension policy

`config/c14/p23-provider-rights-policy.json`

Prevents collapsing distinct facts such as API access, commercial use, export rights, logo permission and partnership into one “provider approved” flag.

### Added evidence ledger

`config/c14/p23-provider-rights-ledger.json`

Records:

- confirmed rights;
- missing rights;
- evidence IDs/official URLs;
- current plan/contract boundary;
- relationship status;
- explicit `runtimeGrantEligible: false` for the freshly reviewed provider records.

### Runtime behavior intentionally unchanged

No existing production allow-bit was changed. No record was inserted into the strict `pass22` approval manifest. The code-level legal/hash gate remains authoritative.

## 8. Validation

- Branch was created directly from base SHA `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`.
- Both new JSON metadata files were fetched back from the branch and parsed successfully.
- Policy exposes exactly **7** right dimensions.
- Ledger contains **8** freshly reviewed provider records and **6** collaboration-counterparty classifications.
- Existing production rights activation remains unchanged/fail-closed.
- No email was sent.
- No plan was purchased.

Because this pass changes documentation/metadata only and deliberately does not modify runtime code, a full product regression suite is not claimed as evidence for provider rights. The relevant regression is semantic: no newly discovered email can bypass the pre-existing reviewed-evidence/legal/hash gate.

## 9. Score: 3/10 → 6/10

Why the score increases:

- current provider emails were read literally rather than inherited from an old MASTER;
- current official Terms/docs/pricing were cross-checked for the highest-priority cases;
- API rights, processing, caching, export, commercial use, logo rights and partnership are now represented separately;
- several materially useful rights are actually evidenced:
  - Tatum written data-use/processing/resale consent,
  - Twelve Data plan-conditional processing/report/cache rights,
  - Alpha Vantage plan-conditional commercial/derived/cache rights,
  - DEX Screener commercial API use,
  - Sourcify logo permission,
  - Resend logo permission;
- relationship claims were downgraded where the evidence only supports pilot/exploratory status.

Why this is not 7–10/10:

- the strict production evidence manifest is still empty;
- no legal-reviewed document hashes were activated;
- Alpha Vantage/Twelve Data commercial rights require plans/licenses not evidenced as purchased;
- important cache/retention/export details remain unresolved for several providers;
- Chainlink branding remains pending;
- GoPlus has not answered the commercial-rights request;
- 23 base-registry providers were not freshly re-verified in this pass;
- no formal provider partnership is currently evidenced.

## 10. Next evidence needed for a future score increase

1. Preserve the Tatum written consent as a stable evidence artifact, hash it, and obtain appropriate legal/authority review against the current Terms.
2. Before Alpha Vantage or Twelve Data production activation, retain the actual order form/license/plan evidence and map dataset/market scope.
3. Resolve cache/retention/export scope for DEX Screener and any provider whose values will appear in downloadable reports.
4. Obtain final Chainlink brand/trademark confirmation for the exact Velmère placement if the logo will be used.
5. Obtain a GoPlus written answer for the exact paid-report/storage/export use case.
6. Freshly re-review the remaining base-registry providers using primary sources rather than inherited summaries.
7. Only call a relationship a formal partnership after evidence of mutual acceptance/execution exists.

**C14-P23 conclusion:** the provider-rights state is substantially more truthful and auditable than C13, but production enablement must remain fail-closed until the existing evidence/legal/hash requirements are satisfied.
