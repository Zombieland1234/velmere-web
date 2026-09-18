# C14-P02 — Source provenance / integrity

**Branch:** \`parallel/c14-p02-source-provenance\`  
**Base branch:** \`c13/authority-source-boundaries-20260918\`  
**Base SHA:** \`4cb45bbcf910f0517d4a5d265682cd2f7e4e41df\`  
**C13 tree SHA:** \`a5268de961923bf0982506167396cda14c0a1381\`  
**Implementation SHA before this handoff:** \`6242f0cb6e5897bc8e29c397f224b008f2f328ff\`  
**Merge:** none  
**Runtime product changes:** none  
**Overall source/provenance score:** **8/10 -> 9/10**

## 1. Executive result

C13 committed-source integrity is now strongly proven. The exact C13 Git commit has 3975 tracked blobs, all regular mode \`100644\`, with no symlinks, executable blobs or submodules. The C13 distributable source ZIP contains 3973 files and declares exactly two exclusions. Reconstructing a repository from those 3973 ZIP entries plus the two declared excluded resources produces **the exact C13 Git tree SHA**:

\`a5268de961923bf0982506167396cda14c0a1381\`

This closes the checkout-vs-ZIP integrity question for C13 at the Git-tree level, in addition to SHA-256 validation of every included file.

The historical \`VELMERE_SOURCE_R13F-UI2.zip\` was also recovered from the Library and checked directly. It is **not byte-identical to C13** and no Git ancestry from UI2 into the C13 repository is proven. The correct status remains:

\`NOT_IDENTICAL_AND_NO_GIT_ANCESTRY_PROVEN\`

At the same time, the packages have a strong content relationship: 3662 paths overlap, 3413 are byte-identical, and all 977 historical script paths that C13 references but lacks are present in UI2. That is useful provenance evidence, but it is not identity proof.

## 2. Exact C13 anchor

Verified against GitHub Git objects and the C13 Actions artifacts:

- commit: \`4cb45bbcf910f0517d4a5d265682cd2f7e4e41df\`
- tree: \`a5268de961923bf0982506167396cda14c0a1381\`
- parent: \`f3273ae496f6deced552dc0d2de3c553d0f06621\`
- tracked blobs: **3975**
- tree entries including directories: **4403**
- directories: **428**
- blob modes: **3975 x 100644**
- symlinks: **0**
- executables: **0**
- submodules: **0**
- commit signature status: **unsigned**
- C14 canonical SHA-256 aggregate over all 3975 tracked paths/bytes:
  \`f48c8e37e93b4992dbc5c9d9eca40f932321e3b674fd879b42625e22ef4f71cc\`

Canonical aggregate format is frozen in \`scripts/c14/source-provenance-lock.json\`:

\`UTF8(path) NUL decimal(bytes) NUL lowercase_sha256(bytes) LF\`, sorted by UTF-8 path bytes.

This supplements Git's tree identity with a SHA-256 commitment over every tracked file byte sequence, path and size.

## 3. C13 source artifact

GitHub Actions run: \`35289099092\`

Source artifact:

- artifact: \`c13-source-35289099092\`
- artifact id: \`10525382939\`
- outer artifact SHA-256:
  \`a6648114f681f483476990a3ccb04b1c3fabef11f66554cebe7c2f48a5f3c7dc\`
- inner source: \`VELMERE_SOURCE_C13.zip\`
- inner ZIP SHA-256:
  \`766e739094325d5824f76cfdb03c3ecec9712825e9fd102f5b2f738065ab7ea9\`
- inner ZIP entries: **3973**
- manifest entries: **3973**
- missing entries: **0**
- unexpected entries: **0**
- SHA-256/size mismatches: **0**
- duplicate names: **0**
- unsafe traversal names: **0**
- CRC: **PASS**
- \`originalUI2ZipIdentityConfirmed\`: **false**

Evidence artifact:

- artifact: \`c13-evidence-35289099092\`
- artifact id: \`10526031537\`
- outer SHA-256:
  \`2091e7cdf61d83c068c9f916d6060d2cddc706ec82f5667613e0b222fc25cb93\`
- evidence manifest files: **122**

The Actions run remains release \`NO_GO\` for unrelated open gates. Artifact integrity is independent of that release decision.

## 4. Checkout vs ZIP — exact resolution

The full C13 checkout has **3975** tracked files. The distributable C13 source ZIP has **3973** files.

The only declared exclusions are:

| Path | Bytes | SHA-256 | Status |
|---|---:|---|---|
| \`lib/security/pro-audit-pdf/embedded-font-data.ts\` | 37477 | \`e0b08419f49573415c9d2537420fe6277752a1662c15f5d5d9c0f1d2d83d9fb9\` | excluded from C13 ZIP |
| \`r7-runtime/external-assets/manrope-pdf-latin-plus-ext.ttf\` | 46464 | \`a07eea516ecb22957f162d68a559462c9af0534487669969d500f8e92aece0fa\` | excluded from C13 ZIP |

Independent reconstruction performed in C14-P02:

1. extract the 3973 exact C13 ZIP files;
2. source the two excluded bytes from the anchored Git commit;
3. verify the exclusion SHA-256 values;
4. force ordinary file mode;
5. \`git add -f -A\`;
6. \`git write-tree\`.

Observed rebuilt tree:

\`a5268de961923bf0982506167396cda14c0a1381\`

Expected C13 tree:

\`a5268de961923bf0982506167396cda14c0a1381\`

**Result: exact match.**

Therefore there is no additional hidden checkout-vs-ZIP content difference beyond the two declared excluded resources.

## 5. Chain of custody

### First observed recovery snapshot

The earliest C6 provenance workflow inspected is commit:

\`05d5ce6afb5364b5184de14e745857f6757f3344\`

Parent:

\`f29294570da87e05ac4063e24b1749254a112703\`

The C6 commit itself changed only \`.github/workflows/c6-recovery-qualification.yml\`. Run \`35174090708\` archived the exact repository before running project code.

C6 source identity recorded:

- source SHA: \`05d5ce6afb5364b5184de14e745857f6757f3344\`
- tracked files: **3828**
- inner exact GitHub snapshot SHA-256:
  \`a08807d01fba0c269c9ccb42a3417fab5ce795831bc4b19fe26f7fc4b2bb8f84\`
- outer artifact SHA-256:
  \`5b2b58acd934814133e9fc8466c182cf5f8d90895167794a3cba5fee86c52878\`
- workflow scope:
  \`EXACT_GITHUB_SNAPSHOT_NOT_CONFIRMED_UI2\`
- UI2 hash recorded by workflow:
  \`3a12adb21c24a5bd8fab696b233a255539d7aeb42e430bf6ad059848da28e2f6\`

That historical workflow already correctly refused to claim UI2 identity.

### Preserved source stages

| Stage | Source SHA | Tree SHA | ZIP included | Excluded | Inner ZIP SHA-256 |
|---|---|---|---:|---:|---|
| C6B | \`ffa40ec83c5f742a02243fc01cd320952fa11d70\` | \`d685dba5c9f7f0f4c07df2a9cce0624687ab43eb\` | 3842 | 0 | \`672143936de4b2ffb0e5ee792b0da6a03e79e4cf3eef2894d3c564c8b43611a6\` |
| C6C | \`cb34427bae770760c9d11474eefdaefb35613847\` | \`a7ab5dbf289fabd6865fcc3a9c3056851e500ca4\` | 3846 | 1 | \`0c4cfe51ec217da1fe9c89bc153ae41ce5809de8bfcf1d59c9c48a23fa3b1725\` |
| C6D | \`84cddafad09868d3d8e51595420a5157dfe79367\` | \`49dd0ca250041d9541fb70088a61fe12578976af\` | 3853 | 1 | \`15a22a8c5819ca0e2de0c77c0c9245613189cc27a44dd48af6bab6ffc7226d48\` |
| C6E | \`aca5e67105dc02b25a8058b3e41fdd47312f7d26\` | \`41f50b7a5f3525499e42b8270ebc2ff0c7c955e1\` | 3856 | 2 | \`a869c5cbd0479f046224735f7690f1881c219fb2f45ede4f82c344a06e2f38b0\` |
| C7 | \`61a43c4169cd7f1d7937617b0fde9ca7268dd82d\` | \`716ef54174a074958d3231b8f57a262caa44ffdd\` | 3873 | 0 | \`ac732dcb8f1e6edd572384cab478341c41d39863024d0945eca5fc59630148a4\` |
| C8 | \`0609ef1c5aeecfab6de3ada8144efaa089064c71\` | \`7f7dac449b54e131c33a0e01ab9703eed1867621\` | 3882 | 2 | \`c5d31ffa7b6f4dff7784ebc2daf1a661fcbafdaaaf6bf01a6e1201f069c52d53\` |
| C9 | \`80385a0bc9dbcff17c2a42e78c6dfc0f24ab407d\` | \`96429ed850028a68b8a96d6f623fbf42a95ae347\` | 3900 | 2 | \`4f1dba162dded4a170c3f5bc7fee721947aaeeb5de341820905a63fae0228eae\` |
| C10 | \`8841c625ede6452de55bd57c1024759d6dc53845\` | \`ab6ea698f7593a77b48ffe77714b142de8bc1194\` | 3918 | 2 | \`88ced9481d5369cd6b8397ccfbf143271d8461c11d67cc8e0fffff9e97091a99\` |
| C11 | \`9ca2860e4133e9f8695076b50f323c7825a1c7b3\` | \`51dd328fe580c155b3b22c91f517cc4c852889a9\` | 3935 | 2 | \`501d976e998c0637a98901f5aee7df4e0326e7b4bddca3e385ff26efa332eb4a\` |
| C12 | \`9a176fe2e844ccf7166bf1bd7552f1bec79584cb\` | \`5edd50f23bc534d15fb8ee008856ee1c4df4e40b\` | 3954 | 2 | \`370219e47495a158364f5bc08511e0afdf5d9ffd13aa3f17f017b37dab7c788c\` |
| C13 | \`4cb45bbcf910f0517d4a5d265682cd2f7e4e41df\` | \`a5268de961923bf0982506167396cda14c0a1381\` | 3973 | 2 | \`766e739094325d5824f76cfdb03c3ecec9712825e9fd102f5b2f738065ab7ea9\` |

### Git ancestry edges

All checked edges are strict descendant relationships with previous stage as merge base and \`behind_by=0\`:

- C6 recovery -> C6B: +7 commits
- C6B -> C6C: +2
- C6C -> C6D: +2
- C6D -> C6E: +2
- C6E -> C7: +18
- C7 -> C8: +5
- C8 -> C9: +6
- C9 -> C10: +11
- C10 -> C11: +4
- C11 -> C12: +6
- C12 -> C13: +6

The checker now enforces these ancestry relationships automatically.

## 6. Font/export-policy discontinuities

The source bytes themselves remain trackable, but historical ZIP export policy was not constant:

- initial C6 snapshot: exact Git archive, all tracked files;
- C6B: exact Git archive, all tracked files;
- C6C/C6D: excludes only the tracked TTF;
- C6E: excludes both declared font resources;
- C7: includes both resources again (\`excluded=0\`);
- C8-C13: excludes both resources.

This is an export-policy discontinuity and is now documented explicitly.

Relationship to UI2:

- \`lib/security/pro-audit-pdf/embedded-font-data.ts\` is present in UI2 and byte-identical to C13:
  \`e0b08419f49573415c9d2537420fe6277752a1662c15f5d5d9c0f1d2d83d9fb9\`
- \`r7-runtime/external-assets/manrope-pdf-latin-plus-ext.ttf\` is **not present in UI2**; it is already present in the first C6 repository snapshot. Its pre-C6 origin is therefore not proven by UI2.

## 7. UI2 direct comparison

The actual Library file \`VELMERE_SOURCE_R13F-UI2.zip\` was materialized and checked.

Observed:

- bytes: **109,334,650**
- SHA-256:
  \`3a12adb21c24a5bd8fab696b233a255539d7aeb42e430bf6ad059848da28e2f6\`
- file entries: **14,141**
- CRC: **PASS**

This matches the retained UI2 package summary.

Embedded historical manifest:

- path: \`VELMERE_HANDOFF/ORIGINAL_SOURCE_MANIFEST.json\`
- SHA-256:
  \`570b809f54ac4befca6aa95ceb689f57ed696c164b461aeb46a8a9be10c7c076\`
- recorded \`sourceCommit\`:
  \`671132a95a497e45c128a4dc364d6823edaf4168\`
- included count: **13,860**
- excluded count: **3,646**

The external UI2 package summary records:

- source manifest file count: **14,139**
- source aggregate SHA-256:
  \`61984ac64fe4ab1b7c31f63bb07f003e71e330b8bc767630f6af589bacc37bdb\`

### C13 vs UI2

- C13 tracked files: **3975**
- UI2 file entries: **14,141**
- overlapping paths: **3662**
- overlapping paths byte-identical: **3413**
- same path, different bytes: **249**
- C13-only paths: **313**
- UI2-only paths: **10,479**

This is not an identity result.

The large UI2-only set is dominated by historical \`scripts/\`, \`artifacts/\`, verification corpora, reports, tests, handoff and evidence trees.

The C13 inventory reports:

- package script names with missing literal referenced files: **892**
- unique missing historical script paths: **977**

C14-P02 checked the actual UI2 ZIP: **all 977 / 977 missing C13 paths are present in UI2**.

That is strong evidence that the current recovered repository omitted a historical tooling/test layer that existed in UI2. It must not be silently treated as a complete byte-for-byte continuation of UI2.

### C6 initial snapshot vs UI2

For additional chronology context:

- C6 tracked files: 3828
- UI2 file entries: 14,141
- overlapping paths: 3662
- byte-identical overlap: 3438
- changed at same path: 224
- C6-only: 166
- UI2-only: 10,479

The first C6 workflow was committed on 2026-09-17, while its parent repository content already existed before that recovery run. UI2 itself records a different source lineage and package structure. No Git object links the UI2 package to the velmere-web ancestry checked here.

Therefore **content relationship is proven; Git ancestry/identity is not**.

## 8. Missing historical resources and repository/handoff state

At the C13 anchor:

- tracked \`artifacts/\` contains only the R7 provider policy evidence subtree;
- no tracked \`_handoff/\` directory existed;
- historical source packages are preserved mainly as GitHub Actions artifacts and Library files, not as committed repository payloads.

The 977 missing literal script references are a real recoverability/completeness gap. They are already surfaced by C13 as \`missing-historical-scripts\`, and C14-P02 now links all 977 paths to UI2, but does **not** restore them because that would expand source/runtime/test behavior rather than merely prove provenance.

## 9. Working-tree drift observed during C13 evidence run

C13 evidence records:

\` M next-env.d.ts\`

This is a post-build working-tree mutation. It is **not** a discrepancy in the committed source artifact because C13 source packaging uses exact committed bytes via \`git show HEAD:path\`.

The source ZIP/tree reconstruction proves the committed source independently of that working-tree mutation.

## 10. New automated checker and tests

Added without changing product runtime:

- \`scripts/c14/source-provenance-lock.json\`
- \`scripts/c14/source_provenance_check.py\`
- \`scripts/c14/test_source_provenance_check.py\`
- \`.github/workflows/c14-p02-source-provenance.yml\`

Default checker verifies:

1. exact C13 commit tree;
2. 3975 tracked blobs and file modes;
3. SHA-256 aggregate over every C13 tracked path/size/content;
4. C6->C13 Git ancestry edges.

Optional source-artifact mode additionally verifies:

1. outer artifact SHA-256;
2. SOURCE_IDENTITY commit/tree/count;
3. inner ZIP SHA-256 and CRC;
4. duplicate/path traversal checks;
5. all 3973 per-file SHA-256/size records;
6. exact two-file exclusion set;
7. per-file ZIP vs Git bytes;
8. reconstruction to the exact C13 Git tree.

Optional UI2 mode verifies:

1. exact UI2 package SHA-256 and CRC;
2. C13/UI2 overlap/exact/different/only counts;
3. all 977 missing C13 script paths are present in UI2;
4. embedded original UI2 source manifest hash/sourceCommit;
5. the two distinct font relationships;
6. it never upgrades the result to UI2 identity.

Commands:

\`\`\`bash
python3 scripts/c14/source_provenance_check.py

python3 scripts/c14/source_provenance_check.py \
  --source-artifact /path/to/c13-source-35289099092.zip

python3 scripts/c14/source_provenance_check.py \
  --ui2 /path/to/VELMERE_SOURCE_R13F-UI2.zip
\`\`\`

Helper test suite: **5/5 PASS** locally.

The source-artifact optional mode was integration-tested against the actual downloaded C13 artifact: **PASS**.

The UI2 optional mode was integration-tested against the actual Library UI2 ZIP: **PASS**, while retaining \`identity=NOT_PROVEN\`.

GitHub Actions run \`35293031409\` on the P02 branch completed the provenance job successfully, including syntax/tests and the immutable C13 Git-anchor/ancestry verification.

## 11. What is proven

**PROVEN**

- requested P02 branch was created from exact C13 SHA;
- exact C13 commit/tree identity;
- exact count and mode of every tracked C13 blob;
- independent SHA-256 aggregate of all C13 tracked bytes;
- exact C13 source artifact outer and inner hashes;
- 3973 manifest/ZIP entries match per-file SHA-256 and size;
- exactly two C13 ZIP exclusions;
- C13 ZIP + those two anchored exclusions reconstruct exact C13 Git tree;
- preserved C6B/C6C/C6D/C6E/C7/C8/C9/C10/C11/C12/C13 source artifacts and their recorded identities were inspected;
- strict Git ancestry from observed C6 recovery through C13;
- historical change in font-export policy;
- actual UI2 package hash/CRC/count;
- measurable C13/UI2 content relationship;
- all 977 C13 missing historical script references exist in UI2;
- no product runtime code was changed by C14-P02.

## 12. What is still not proven

**NOT PROVEN**

1. \`VELMERE_SOURCE_R13F-UI2.zip\` is the exact parent/source of the velmere-web C6/C13 Git lineage.
2. C13 is byte-identical to UI2. It is demonstrably not.
3. A Git ancestry link from UI2's recorded \`671132a95a497e45c128a4dc364d6823edaf4168\` source identity into \`Zombieland1234/velmere-web\`.
4. Exact pre-\`f292945...\` provenance for every file already present in the velmere-web repository.
5. Original provenance of the TTF resource before the first C6 snapshot.
6. Completeness of recovered historical tooling: 977 referenced historical scripts remain absent from C13.
7. Author authenticity via signed Git commits; inspected anchor commits are unsigned.
8. Permanent availability of ephemeral Actions artifacts after their retention window. Their hashes/identities are now locked in the P02 provenance record, but the artifacts themselves can expire.

## 13. Unreported / newly surfaced discrepancies

The audit found no hidden extra difference between the C13 checkout and C13 source ZIP beyond the two declared exclusions.

Newly quantified or newly connected provenance facts are:

- C7 temporarily reversed the font-exclusion packaging policy and included both resources.
- C6C/C6D excluded only the TTF, while C6E and C8-C13 excluded two resources.
- the second C13-excluded resource (TTF) is absent from UI2 and therefore cannot be attributed to UI2 from current evidence.
- all 977 historical script references missing from C13 are physically present in UI2.
- C13 and UI2 share 3413 byte-identical paths but also have 249 same-path byte differences, 313 C13-only paths and 10,479 UI2-only paths.
- C13 evidence has a dirty \`next-env.d.ts\` after build, while the committed source artifact remains exact.

## 14. Score

**Source i pochodzenie: 8/10 -> 9/10.**

Why it increased:

- exact Git anchor and full-file SHA-256 aggregate are locked;
- checkout-vs-ZIP is reconstructed to the exact tree;
- preserved source artifacts are chained through ancestry;
- UI2 was finally checked as the actual ZIP rather than inferred from notes;
- automated CI now makes provenance drift fail closed.

Why it is not 10/10:

- UI2-to-Git ancestry remains unproven and the packages are not identical;
- 977 historical referenced scripts are absent from C13;
- pre-C6 origin of some bytes, including the TTF, is not fully documented;
- commits are unsigned;
- historical Actions artifacts are retention-bound.

No score was increased by changing application runtime.
