# C14-P08 — Dependency Audit

**Status:** PASS with documented residual risks  
**Repository:** `Zombieland1234/velmere-web`  
**Branch:** `parallel/c14-p08-dependencies`  
**Base SHA:** `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`  
**Qualified dependency SHA:** `536eaaf73db89716ee6f25e081f7c610036725c6`  
**Qualification run:** GitHub Actions `35294189890`  
**Evidence artifact:** `c14-p08-dependency-evidence-35294189890`, digest `sha256:a713e86ba0875d4a3d7aa55f5583cc5e85a0f450b19eba309ba3c116ebd3a68d`  
**Runtime qualified:** Node `24.18.0`, npm `11.16.0`  
**Assessment:** **8/10 → 9/10**

## Executive summary

C14-P08 audited direct, development and transitive dependencies, lockfile integrity, install scripts, deprecated packages, runtime version contracts, static package use, update compatibility and supply-chain controls.

One direct update was accepted:

- `@walletconnect/ethereum-provider 2.23.9 → 2.23.10`

This is a deliberately narrow patch-level update. WalletConnect 2.23.10 includes security-relevant hardening in its dependency family, including rejecting line breaks in SIWE/CAIP-122 statements, rejecting plaintext TYPE_2 relay envelopes, and enforcing controller authorization for session updates. The update also realigned its transitive Reown/WalletConnect subtree. It was accepted only after a clean install, integrity checks, TypeScript, 340 current-route regressions, WalletConnect import smoke, changed-file lint and production build all passed.

No mass upgrade was performed. The remaining 37 newer direct versions were inventoried and deferred unless a concrete security or compatibility benefit justified changing them.

## 1. Dependency inventory

### Runtime dependencies — 22

| Package | Qualified version |
|---|---:|
| @redis/client | 6.2.1 |
| @stripe/stripe-js | 7.9.0 |
| @supabase/supabase-js | 2.108.1 |
| @tanstack/react-query | 5.101.0 |
| @walletconnect/ethereum-provider | **2.23.10** |
| clsx | 2.1.1 |
| cmdk | 1.1.1 |
| framer-motion | 12.40.0 |
| lucide-react | 0.475.0 |
| next | 16.3.5 |
| next-intl | 4.13.0 |
| react | 19.2.7 |
| react-dom | 19.2.7 |
| stripe | 22.2.0 |
| swr | 2.4.1 |
| tailwind-merge | 2.6.1 |
| three | 0.184.0 |
| viem | 2.54.6 |
| wagmi | 3.7.3 |
| ws | 8.21.0 |
| zod | 3.25.76 |
| zustand | 4.5.7 |

### devDependencies — 23

| Package | Qualified version |
|---|---:|
| @electric-sql/pglite | 0.5.4 |
| @eslint/js | 10.0.1 |
| @next/eslint-plugin-next | 16.3.5 |
| @playwright/test | 1.60.0 |
| @types/node | 24.13.3 |
| @types/react | 19.2.17 |
| @types/react-dom | 19.2.3 |
| @types/three | 0.184.1 |
| @typescript-eslint/parser | 8.65.0 |
| autoprefixer | 10.5.0 |
| axe-core | 4.12.0 |
| esbuild | 0.28.1 |
| eslint | 10.8.0 |
| eslint-plugin-react-hooks | 7.1.1 |
| globals | 17.3.0 |
| playwright | 1.60.0 |
| postcss | 8.5.26 |
| postcss-selector-parser | 6.1.4 |
| solc | 0.8.37 |
| tailwindcss | 3.4.19 |
| tsx | 4.22.4 |
| typescript | 5.9.3 |
| typescript-eslint | 8.65.0 |

### Transitive / lockfile summary

| Check | Result |
|---|---:|
| lockfileVersion | 3 |
| package paths excluding root | 669 |
| unique package names | 589 |
| names present at multiple versions | 31 |
| registry-resolved tarballs | 669 / 669 |
| non-registry resolved packages | 0 |
| remote packages missing integrity | 0 |
| npm audit findings | **0** |
| deprecated packages | 1 |
| direct packages with newer versions | 37 |

The WalletConnect patch reduced lock package paths from **672 → 669** and duplicate package names from **32 → 31**. This was an incidental deduplication benefit, not the reason for upgrading.

## 2. Supply-chain controls

Confirmed controls:

- `.npmrc` pins the npm registry and has `engine-strict=true`, `save-exact=true`, and `ignore-scripts=true`.
- Every resolved remote package in the qualified lockfile comes from `https://registry.npmjs.org/`.
- Every remote lock entry has an integrity hash.
- C14-P08 adds `scripts/c14/dependency-audit.mjs`, which fails closed if:
  - package.json and lockfile root dependencies disagree,
  - WalletConnect drops below the qualified security baseline,
  - any non-registry resolution appears,
  - any remote package lacks integrity,
  - a package with an install script is not explicitly denylisted,
  - a new deprecated package appears.
- The C14 workflow uses commit-SHA-pinned GitHub Actions.
- Clean qualification uses `npm ci --ignore-scripts`.

### Packages declaring install scripts

All six are explicitly denied in `allowScripts`:

| Package | Version |
|---|---:|
| @parcel/watcher | 2.6.0 |
| @reown/appkit | 1.8.19 |
| @swc/core | 1.15.47 |
| esbuild | 0.28.1 |
| fsevents | 2.3.2 |
| fsevents (tsx subtree) | 2.3.3 |

No install script was required for the clean install or successful production qualification.

## 3. Deprecated package

One deprecated transitive remains:

`@safe-global/safe-gateway-typescript-sdk@3.23.1`

Observed path:

`@reown/appkit-utils@1.8.19 → @safe-global/safe-apps-sdk@9.1.0 → @safe-global/safe-gateway-typescript-sdk@3.23.1`

It is currently maintenance debt, not an `npm audit` vulnerability. It was not replaced opportunistically because it is owned transitively by the AppKit/Safe integration and a forced override could change wallet behavior. Removal/replacement should be qualified with Safe/wallet-specific browser flows.

Upstream deprecation reference: https://www.npmjs.com/package/@safe-global/safe-gateway-typescript-sdk

## 4. Security-motivated update performed

### @walletconnect/ethereum-provider 2.23.9 → 2.23.10

Reason: narrow patch with concrete upstream security hardening. WalletConnect 2.23.10 release notes include:

- rejection of SIWE/CAIP-122 statements containing line breaks,
- rejection of plaintext TYPE_2 envelopes over relay transport,
- controller authorization enforcement on session updates.

The direct provider update brings the corresponding `@walletconnect/*@2.23.10` family into the primary subtree. It also changed Reown AppKit from the prior custom `1.8.17-wc-circular-dependencies-fix.0` build to `1.8.19`; this transitive movement was explicitly covered by the full qualification.

Upstream release notes: https://github.com/WalletConnect/walletconnect-monorepo/releases

No CVE claim is made here; this is upstream-documented hardening.

## 5. Static unused / redundant candidates

A source-level import/reference scan found the following candidates. They were **not removed** because absence of a direct import does not by itself prove safe deletion in this repository's generated/historical/test tooling.

| Package | Finding | Decision |
|---|---|---|
| @stripe/stripe-js | no direct application import found | defer; verify intended browser Stripe ownership before removal |
| ws | no direct application import found; transitive ws consumers exist | defer; direct pin may affect dedupe/resolution |
| @electric-sql/pglite | no direct current-source import found | defer; test/historical harness ownership needs confirmation |
| @playwright/test | no direct import; repository uses `playwright` directly | defer; remove only with browser harness qualification |
| axe-core | no direct current-source import found | defer; accessibility tooling ownership needs confirmation |
| postcss-selector-parser | no direct runtime/test import found; historical hardening/config references exist | defer |

`@walletconnect/ethereum-provider` also has no direct import, but it is **not classified unused**: the project uses Wagmi WalletConnect connectors and this package participates in that connector dependency/peer surface.

## 6. Runtime version contract

Qualified runtime:

- Node `24.18.0`
- npm `11.16.0`

The project Volta/CI qualification is exact, but `package.json` still declares `engines.node >=20.0.0`. In addition, `vercel.json` disables npm engine-strict for install. Therefore the repository's public engine contract is broader than the actually qualified release runtime.

This was not changed in P08 because deployment/runtime policy is cross-cutting and should be reconciled with the Vercel/deployment workstream rather than silently tightened in a dependency branch.

## 7. Updates deferred

`npm outdated` after the accepted patch still reports **37** direct packages with newer releases.

### Patch-level newer releases — deferred

| Package | Current | Latest | Reason |
|---|---:|---:|---|
| @electric-sql/pglite | 0.5.4 | 0.5.8 | no demonstrated security need; ownership uncertain |
| esbuild | 0.28.1 | 0.28.2 | build tool patch; current build passes |
| postcss | 8.5.26 | 8.5.28 | toolchain churn without concrete need |
| wagmi | 3.7.3 | 3.7.7 | wallet behavior requires focused qualification |
| ws | 8.21.0 | 8.21.3 | robustness fixes available, but direct-use ownership is unclear and audit is clean |

### Minor-level newer releases — deferred

`@playwright/test 1.60.0→1.63.0`, `@supabase/supabase-js 2.108.1→2.116.0`, `@tanstack/react-query 5.101.0→5.103.1`, `@types/react 19.2.17→19.3.0`, `@types/react-dom 19.2.3→19.3.0`, `@types/three 0.184.1→0.186.0`, `@typescript-eslint/parser 8.65.0→8.70.0`, `@walletconnect/ethereum-provider 2.23.10→2.25.0`, `autoprefixer 10.5.0→10.6.1`, `axe-core 4.12.0→4.13.0`, `eslint 10.8.0→10.10.0`, `globals 17.3.0→17.12.0`, `next-intl 4.13.0→4.14.5`, `playwright 1.60.0→1.63.0`, `react 19.2.7→19.3.0`, `react-dom 19.2.7→19.3.0`, `stripe 22.2.0→22.6.2`, `swr 2.4.1→2.5.1`, `three 0.184.0→0.186.0`, `tsx 4.22.4→4.23.13`, `typescript-eslint 8.65.0→8.70.0`, `viem 2.54.6→2.56.7`.

Reason: no individually demonstrated security requirement in this audit. Several should move as coupled stacks: Playwright packages together; React/React DOM/types together; ESLint/typescript-eslint/globals together; wallet libraries together.

### Major-level newer releases — deferred

| Package | Current | Latest | Reason |
|---|---:|---:|---|
| @stripe/stripe-js | 7.9.0 | 9.16.0 | major browser payments API surface |
| @types/node | 24.13.3 | 26.6.1 | should track qualified Node 24, not leap to Node 26 types |
| framer-motion | 12.40.0 | 13.4.0 | UI/runtime major |
| lucide-react | 0.475.0 | 1.47.0 | major UI dependency |
| postcss-selector-parser | 6.1.4 | 7.1.6 | major build/parser change |
| tailwind-merge | 2.6.1 | 3.7.0 | major styling behavior |
| tailwindcss | 3.4.19 | 4.3.3 | major build/CSS migration |
| typescript | 5.9.3 | 7.0.2 | compiler major; broad code/test impact |
| zod | 3.25.76 | 4.6.5 | schema/runtime semantics major |
| zustand | 4.5.7 | 5.0.15 | state library major |

None of these were changed on P08.

## 8. Qualification results

Canonical run: `35294189890` against exact SHA `536eaaf73db89716ee6f25e081f7c610036725c6`.

| Gate | Result |
|---|---|
| exact source SHA binding | PASS |
| Node 24.18.0 / npm 11.16.0 identity | PASS |
| clean `npm ci --ignore-scripts` | PASS |
| deterministic dependency integrity guard | PASS |
| `npm audit` | PASS — 0 vulnerabilities at all severities |
| `npm outdated` inventory | PASS — 37 recorded |
| complete `npm ls --all` tree | PASS |
| strict TypeScript `tsc --noEmit --strict` | PASS |
| audit-worker prerequisite build | PASS |
| current route regression suite | **PASS — 340/340** |
| WalletConnect ESM import smoke | PASS |
| P08 changed-file ESLint | PASS |
| production build | PASS |
| package/lockfile immutability after qualification | PASS |
| evidence artifact upload | PASS |

Repository-wide ESLint was also run diagnostically. It reports **343 warnings and 0 errors**, matching pre-existing repository lint debt rather than a dependency-update regression. P08 does not modify UI/source files to hide those warnings.

The production build modifies generated `next-env.d.ts`; the qualification explicitly checks that `package.json` and `package-lock.json` remain unchanged after all gates.

## 9. Files changed by P08

- `package.json`
- `package-lock.json`
- `scripts/c14/dependency-audit.mjs`
- `.github/workflows/c14-p08-dependencies.yml`
- this handoff report

No UI code was changed.

## 10. Residual risks

1. Deprecated Safe Gateway SDK remains transitively present.
2. Runtime contract drift remains between broad `engines.node >=20` and exact qualified Node 24.18.0; Vercel install currently disables engine-strict.
3. Six static unused/redundant candidates require owner-specific removal qualification.
4. Thirty-one package names still occur at multiple versions; the largest duplicates include semver and wallet/crypto dependency families.
5. One dev lock entry (`memorystream@0.3.1`) lacks explicit license metadata in the lockfile.
6. Registry URL + integrity checks materially harden supply-chain admission, but do not by themselves prove publisher identity for every future package version.
7. Repository-wide lint baseline remains 343 warnings; this is not introduced by P08 but is unresolved quality debt.

## 11. Score

### 8/10 → 9/10

Improvement is justified by:

- retaining `npm audit = 0`,
- applying one concrete security-hardening patch instead of bulk version churn,
- reducing the lock graph slightly,
- adding deterministic registry/integrity/install-script/deprecation gates,
- qualifying the update through clean install, strict TypeScript, 340 regressions, WalletConnect smoke and production build.

A 10/10 is not claimed because the deprecated transitive dependency, runtime-contract drift, unused candidates, duplicate-version debt and broader supply-chain provenance limitations remain open.
