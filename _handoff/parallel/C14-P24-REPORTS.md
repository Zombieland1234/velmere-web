# C14-P24 — Reporting system qualification

## Identity

- Base SHA: `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`
- Branch: `parallel/c14-p24-reports`
- Qualified code SHA: `33a0183810b7fd441524dc68029f782b542143ff`
- Final green workflow: GitHub Actions run `35293844602`
- Evidence artifact: `c14-p24-evidence-35293844602` (artifact id `10527104437`)
- Baseline score supplied by C13: **7/10**
- C14-P24 evidence-based score: **8/10**
- Production was not load-tested or attacked. Browser work ran against the local production build in CI.

## Result

The reporting subsystem improved materially, but this handoff does **not** claim 10/10. The qualified code has green focused regressions, legacy report regressions, strict TypeScript, production build and Chromium desktop/mobile checks. Remaining limitations are documented below, especially the external archive/restore backend, non-Latin PDF glyph coverage, lack of an independently anchored PKI/TSA trust root, and the fact that separate public JSON/PDF requests are fresh report generations rather than one immutable cross-request snapshot.

## Test evidence

### Red baseline

Run `35292607342` intentionally captured the pre-fix state. Focused C14 tests: **3 pass / 6 fail**.

Confirmed failures:
1. entitlement-filtered legacy report digest did not independently hash the delivered projection;
2. detached PDF did not carry the canonical model digest;
3. semantic linter accepted a tampered `reportDigest`;
4. semantic linter accepted pathological customer-visible finding length;
5. decomposed Unicode input was not NFC-normalized;
6. the account customer-safe report route had only an initial account authority read, leaving a delivery-time TOCTOU window.

### Final green qualification

Run `35293844602`:

- C14-P24 focused tests: **16/16 PASS**
- Existing C6d/C6e/C9/C12 report regressions: **57/57 PASS**
- Strict TypeScript: **PASS**
- Production build: **PASS**
- Playwright Chromium browser matrix: **PASS**
- Desktop viewport: 1440×1000
- Mobile viewport: 390×844
- XSS-shaped text rendered as inert text; no injected DOM node or executed handler
- supported Unicode `Café Żółć Über €`: preserved
- 980-character unbroken visible name: no document-level horizontal overflow
- JSON endpoint: 200 for Basic reference report
- anonymous Pro/Advanced requests: denied
- PDF endpoint: 200; byte digest, length and hardened response headers checked
- screenshots retained as `report-desktop.png` and `report-mobile.png`

The evidence artifact also contains source SHA, build log, TypeScript log and both test logs.

## Test matrix

| Area | Status | Evidence / notes |
|---|---|---|
| JSON schema | PASS | exact schema version checked; malformed types, duplicate parameters and oversized inputs fail closed; digest is independently recomputed |
| PDF generation | PASS | same canonical model is linted before render; PDF structure, digest, byte length and active-PDF-token checks exercised |
| Browser report | PASS | real Next production build + Chromium |
| Desktop | PASS | 1440×1000, XSS/Unicode/long-token scenarios, no horizontal overflow |
| Mobile | PASS | 390×844, same scenarios, no horizontal overflow |
| Storage integrity | PARTIAL | exact PDF/snapshot owner/digest/immutability code paths inspected; C14 did not execute a real durable Supabase write/read cycle |
| Archive / erase / restore | PARTIAL / BLOCKED E2E | local API boundaries hardened and tested structurally; backing `r7-audit-basic-customer-bridge` implementation is external/not present in this repository, so its backup/restore behavior cannot be independently qualified here |
| Download | PASS | preview/download helper checks exact bytes, PDF digest, safe filename; paid download flow rechecks authority before bytes |
| Authorization | PASS | final session/entitlement/case checks added to four older account/paid routes; C9 revocation regressions remain green |
| Tier restrictions | PASS | anonymous Pro refused rather than silently downgraded; locked sections remain data-null |
| Malformed data | PASS | malformed JSON/types, duplicate fields, bad chain/tier/locale/bytecode, oversized body/input are bounded/refused |
| Escaping / HTML injection / XSS | PASS | React browser view treats XSS-shaped name as text; no injected `#c14-p24-xss`; no handler execution; PDF bytes reject active tokens |
| Unicode | PASS for supported product locales | NFC normalization added; Polish/German/Euro test has zero PDF glyph replacements |
| Very long findings | PASS fail-closed | semantic text budgets reject over-budget customer-visible fields before JSON/HTML/PDF delivery |
| Empty findings | PASS | empty findings remain explicit NOT_VERIFIED and render to PDF |
| Confidence / coverage | PASS | unmeasured values stay null and require NOT_VERIFIED; existing contradiction/bounds logic preserved |
| Stale / recheck state | PASS at report policy layer | stale/future current-deployment timestamps fail closed; versioned receipt remains `recheck_required` and cannot final-sign until evidence is revalidated |
| Hash / integrity | PASS structurally, trust caveat below | delivered projection digest fixed; PDF embeds model digest; PKI signature now binds delivered projection digest |
| JSON ↔ PDF ↔ HTML semantics | PASS for the same canonical model; PARTIAL across separate requests | shared model/linter preserves target, tier, NOT_VERIFIED and measured/unmeasured semantics. Separate public JSON and PDF HTTP calls intentionally generate fresh report instances, so their report digests differ because identity/time differ; this is not an immutable cross-request snapshot |

## Confirmed product bugs fixed

### 1. Delivered projection digest / PKI mismatch

**Before:** `filterCanonicalReportByEntitlement` carried the internal report digest and attestation into the filtered object, then hashed the filtered object containing the old digest. The final customer projection was not independently hash-reproducible and the attestation signed the pre-projection digest.

**Patch:** remove inherited integrity fields from the hash core, hash the actual delivered projection, then sign the new projection digest.

File:
- `lib/security/audit-canonical-report.ts`

Regression:
- delivered projection hash recomputation;
- attestation signed digest equality;
- structural Ed25519 verification.

### 2. Detached PDF did not identify the canonical model digest

**Patch:** add `Report model SHA-256: <report.reportDigest>` to canonical PDF semantic lines. PDF byte hash remains a separate download-integrity value.

File:
- `lib/security/audit-canonical-report.ts`

### 3. Semantic gate accepted tampered integrity metadata

**Patch:** semantic linter now verifies:
- schema version;
- canonical report digest;
- PKI-to-report-digest binding when attestation exists;
- signature validity against the attestation key.

File:
- `lib/security/report-semantic-linter.ts`

### 4. No bounded customer-visible text policy

**Patch:** semantic budgets added for report identity, target, verdict, sections, metrics and finding fields. Unsafe C0/C1 controls and bidi override/isolate characters are rejected.

This prevents pathological data from being emitted differently by JSON, React or the PDF renderer.

File:
- `lib/security/report-semantic-linter.ts`

### 5. Unicode normalization mismatch

**Patch:** customer string inputs are normalized to NFC before report generation.

File:
- `lib/security/customer-report-request.ts`

### 6. Shared semantic gate was missing from the common report preparation path

**Patch:** the prepared customer report is asset-class resolved and semantically linted before JSON, RSC/HTML or PDF can serialize it.

File:
- `lib/security/customer-report-request.ts`

### 7. Delivery-time authorization TOCTOU windows in older report routes

Added final/current authority checks immediately before release in:

- `lib/server/lazy-route-modules/security--audit-watch--customer-safe-report.ts`
- `lib/server/lazy-route-modules/security--audit-watch--pro-pdf.ts`
- `lib/server/lazy-route-modules/security--audit-watch--pro-pdf--token.ts`
- `lib/server/security-route-modules/audit-report-assembler.ts`

The checks cover session identity, durable paid entitlement, tier/case binding and case state as applicable.

### 8. Basic exact-PDF route lacked the hardened browser response envelope

Added:
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy: sandbox`
- `Cross-Origin-Resource-Policy: same-origin`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`

File:
- `app/api/audit/basic/report/route.ts`

### 9. Archive restore accepted an unbounded JSON parse

**Before:** direct `request.json()`.

**Patch:** bounded 8 KiB JSON reader with depth limit, object requirement, duplicate-key rejection and dangerous-key rejection before the bridge request.

File:
- `app/api/audit/basic/report/restore/route.ts`

## Browser / injection findings

The browser matrix used an XSS-shaped customer name containing an `<img ... onerror=...>` payload plus Polish/German Unicode.

Observed:
- the payload remained text;
- no element with the injected id existed;
- the handler flag was never set;
- document-level horizontal overflow remained false on desktop and mobile;
- PDF output did not contain active PDF action tokens such as `/JavaScript`, `/Launch`, `/OpenAction`, `/AA` or `/EmbeddedFile`.

A test-harness failure during qualification was also investigated: requests to `127.0.0.1` were correctly refused by the canonical-host guard because CI declared `http://localhost:3000`. The harness was fixed to use the canonical origin; the product guard was not weakened.

## Semantic parity notes

For one in-memory canonical model:
- JSON digest is reproducible;
- PDF semantic lines identify that exact model digest;
- HTML receives the same model structure;
- locked tier data is null;
- unmeasured risk/confidence/coverage remain null;
- release state stays `NOT_VERIFIED`.

The live browser evidence also confirms the same target text, tier and analysis status across the visible report and API/PDF surfaces.

However, the public JSON and public PDF endpoints each generate a new report request. The final evidence shows different model digests for those two calls, while semantic state/tier/analysis status agree. Therefore this handoff does **not** claim byte- or snapshot-identical JSON↔PDF across independent HTTP requests. Exact immutable PDF/snapshot delivery exists in the account-owned artifact paths, but those durable paths require their own environment-backed qualification.

## Remaining limitations / blockers

1. **Archive/restore backend source unavailable in this repo.** The routes call `r7-audit-basic-customer-bridge`; its implementation was not found in the checkout. Full erase/backup/restore ownership, retention and restoration tests are therefore BLOCKED here.
2. **No real durable Supabase artifact E2E in C14-P24.** Store code is owner/hash/immutability bound, but this run did not prove a live durable write/read/restore cycle.
3. **PDF glyph coverage is intentionally limited.** PL/DE/EN characters used by the product are tested. The renderer can replace unsupported glyphs (for example broad CJK/emoji) and reports a replacement count; this is not full Unicode-font fidelity.
4. **PKI/TSA is not an independently trusted external attestation.** The current structural signature verifies against the public key carried with the attestation. C14-P24 fixed digest binding but does not claim external RFC 3161 authority or independent trust anchoring.
5. **Public JSON/PDF requests are fresh generations.** They are semantically constrained by the same model/linter, but not one durable immutable cross-request snapshot.

These limitations are why the result is **8/10, not 9/10 or 10/10**.

## Files added for C14-P24

- `scripts/c14/reports.test.ts`
- `scripts/c14/reports-browser.mjs`
- `.github/workflows/c14-p24-reports.yml`
- `_handoff/parallel/C14-P24-REPORTS.md`

## Score

**7/10 → 8/10**

Reason: integrity binding, shared semantic validation, Unicode normalization, input bounds, final authority checks, PDF hardening and real desktop/mobile XSS/overflow qualification are now materially stronger and green. A higher score is not justified until the external archive/restore implementation and durable storage path are independently exercised and cross-request snapshot semantics / trust anchoring are resolved or explicitly redesigned.
