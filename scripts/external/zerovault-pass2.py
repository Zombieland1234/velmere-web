#!/usr/bin/env python3
import hashlib, json, os, pathlib, shutil, stat, struct, subprocess, sys, zipfile

EXPECTED_ARCHIVE_SHA = "fe876ce644321c2f22b3cd2c565b25ea6c5452912dfdc905a100f31b49e3efac"
EXPECTED_ARCHIVE_BYTES = 4510686
EXPECTED_ENTRIES = 430
EXPECTED_FP = "234374010ba7c648e59f26003b7915ce2c70899cd101c770cb046f5d6e3b5286"
EXPECTED_VERIFY_SHA = "e9fa708bf48ae88354d60ebc379dacb277d2f425b64895aeb6b5206c6114cdb4"

ZIP = pathlib.Path(os.environ["ZV_ZIP"]).resolve()
BASE = pathlib.Path(os.environ["ZV_BUNDLE"]).resolve()
OUT = pathlib.Path(os.environ.get("ZV_PASS2_OUT", "/tmp/zv-pass2")).resolve()
NODE_IMAGE = os.environ.get("ZV_NODE_IMAGE", "node:20")
OUT.mkdir(parents=True, exist_ok=True)
CASES = OUT / "cases"
if CASES.exists():
    shutil.rmtree(CASES)
CASES.mkdir()

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def run(cmd, **kwargs):
    return subprocess.run(cmd, check=True, **kwargs)

def docker_verify(case: pathlib.Path, marker_dir: pathlib.Path | None = None):
    cmd = ["docker", "run", "--rm", "--network", "none", "-v", f"{case}:/bundle:ro", "-w", "/bundle"]
    if marker_dir is not None:
        marker_dir.mkdir(parents=True, exist_ok=True)
        cmd += ["-v", f"{marker_dir}:/out"]
    cmd += [NODE_IMAGE, "node", "verify.js"]
    return subprocess.run(cmd, text=True, capture_output=True, timeout=120)

def fingerprint(pub: pathlib.Path) -> str:
    p1 = subprocess.Popen(["openssl", "pkey", "-pubin", "-in", str(pub), "-pubout", "-outform", "DER"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    p2 = subprocess.run(["openssl", "dgst", "-sha256"], stdin=p1.stdout, text=True, capture_output=True, check=True)
    p1.wait()
    return p2.stdout.strip().split()[-1]

def regen_and_sign(case: pathlib.Path):
    key = case / ".velmere-attacker.key"
    sigbin = case / ".velmere-sig.bin"
    run(["openssl", "genpkey", "-algorithm", "Ed25519", "-out", str(key)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    run(["openssl", "pkey", "-in", str(key), "-pubout", "-out", str(case / "manifest-pubkey.pem")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    files = {}
    for p in sorted(case.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(case).as_posix()
        if rel in {"manifest.json", "manifest.sig", ".velmere-attacker.key", ".velmere-sig.bin"}:
            continue
        files[rel] = sha256(p.read_bytes())
    manifest = {"algo": "sha256", "fileCount": len(files), "files": files}
    (case / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    run(["openssl", "pkeyutl", "-sign", "-inkey", str(key), "-rawin", "-in", str(case / "manifest.json"), "-out", str(sigbin)])
    (case / "manifest.sig").write_text(sigbin.read_bytes().hex() + "\n")
    fp = fingerprint(case / "manifest-pubkey.pem")
    key.unlink()
    sigbin.unlink()
    return fp

DOMAIN_TAG = b"ZVID:OPENA:V1" + b"\x00" * 3

def enc_text(s: str) -> bytes:
    b = s.encode("utf-8")
    return struct.pack(">I", len(b)) + b

def compute_opena(f: dict) -> str:
    parts = [DOMAIN_TAG]
    for key in ["srcAuthority", "customer", "destAuthority", "closeC", "kScalar", "piClose", "sigSrc", "sigCust", "sigDst", "nullifier", "destCtx"]:
        parts.append(enc_text(f[key]))
    parts.append(struct.pack(">I", len(f["checks"])) + b"".join(enc_text(x) for x in f["checks"]))
    return hashlib.sha3_256(b"".join(parts)).hexdigest()

def load(case, rel):
    return json.loads((case / rel).read_text())

def save(case, rel, obj):
    (case / rel).write_text(json.dumps(obj, indent=2) + "\n")

def mutate_run_ledger(case):
    r = load(case, "artifacts/run.json")
    r["runId"] = "velmere-fabricated-run"
    r["packageId"] = "00" * 32
    r["parties"]["alice"] = "Different-Customer::1220deadbeef"
    r["parties"]["zvCanton"] = "Different-Dest::1220cafebabe"
    save(case, "artifacts/run.json", r)
    l = load(case, "artifacts/ledger-refs.json")
    l["positiveOpen"]["offset"] = 999999999
    l["positiveOpen"]["updateId"] = "00" * 32
    l["positiveOpen"]["commandId"] = "fabricated-command"
    l["positiveOpen"]["createdContractIds"] = {k: "fake-" + k for k in l["positiveOpen"]["createdContractIds"]}
    save(case, "artifacts/ledger-refs.json", l)

def mutate_opaque_rail_tokens(case):
    s = load(case, "artifacts/sigma.json")
    for k in ["piClose", "sigSrc", "sigCust", "sigDst"]:
        s["fields"][k] = "NOT-A-PROOF-" + k
    s["openA"] = compute_opena(s["fields"])
    save(case, "artifacts/sigma.json", s)

def mutate_destination_only(case):
    d = load(case, "artifacts/destination-context.json")
    d["components"]["destEpoch"] = "E999"
    d["sealed"] = "|".join(d["components"][k] for k in ["destChainId", "destAuthAddr", "railVersion", "destEpoch"])
    save(case, "artifacts/destination-context.json", d)
    # Deliberately do NOT update sigma.fields.destCtx. This probes missing cross-artifact binding.

def mutate_negative_text(case):
    n = load(case, "artifacts/negative-controls.json")
    for row in n["controls"]:
        row["assertText"] = f"Check {row['check']} failed: THIS TEXT WAS NEVER PRODUCED BY CANTON"
    save(case, "artifacts/negative-controls.json", n)

def mutate_nullifier(case):
    n = load(case, "artifacts/nullifier.json")
    n["nullifier"] = "arbitrary-chosen-label"
    save(case, "artifacts/nullifier.json", n)
    s = load(case, "artifacts/sigma.json")
    s["fields"]["nullifier"] = "arbitrary-chosen-label"
    s["openA"] = compute_opena(s["fields"])
    save(case, "artifacts/sigma.json", s)

def mutate_manifest_metadata(case):
    m = load(case, "manifest.json")
    m["algo"] = "md5"
    m["fileCount"] = 999999
    save(case, "manifest.json", m)
    # regen_and_sign will replace manifest; this mutation is handled specially below.

def semantic_case(name, mutator):
    case = CASES / name
    shutil.copytree(BASE, case)
    mutator(case)
    fp = regen_and_sign(case)
    proc = docker_verify(case)
    return {
        "case": name,
        "providerVerifierExit": proc.returncode,
        "providerVerifier7of7": "RESULT: 7/7 PASS" in proc.stdout,
        "attackerFingerprint": fp,
        "externalAnchorWouldReject": fp != EXPECTED_FP,
        "stdoutTail": "\n".join(proc.stdout.splitlines()[-8:]),
        "stderrTail": "\n".join(proc.stderr.splitlines()[-5:]),
    }

# 1) Archive structure / extraction safety.
archive_bytes = ZIP.read_bytes()
archive = {
    "sha256": sha256(archive_bytes),
    "bytes": len(archive_bytes),
}
assert archive["sha256"] == EXPECTED_ARCHIVE_SHA
assert archive["bytes"] == EXPECTED_ARCHIVE_BYTES
with zipfile.ZipFile(ZIP) as z:
    infos = z.infolist()
    traversal, symlinks = [], []
    uncomp = comp = 0
    max_ratio = (0.0, None)
    for i in infos:
        uncomp += i.file_size
        comp += i.compress_size
        norm = os.path.normpath(i.filename)
        if i.filename.startswith("/") or norm.startswith("../") or "/.." in i.filename.replace("\\", "/"):
            traversal.append(i.filename)
        mode = (i.external_attr >> 16) & 0xFFFF
        if stat.S_ISLNK(mode):
            symlinks.append(i.filename)
        ratio = (i.file_size / i.compress_size) if i.compress_size else (float("inf") if i.file_size else 1.0)
        if ratio > max_ratio[0]:
            max_ratio = (ratio, i.filename)
    archive.update({
        "entries": len(infos),
        "uncompressedBytes": uncomp,
        "compressedPayloadBytes": comp,
        "overallCompressionRatio": uncomp / comp,
        "maxSingleEntryCompressionRatio": max_ratio[0],
        "maxRatioEntry": max_ratio[1],
        "pathTraversalEntries": traversal,
        "symlinkEntries": symlinks,
    })
assert archive["entries"] == EXPECTED_ENTRIES
assert not traversal and not symlinks

# 2) Original manifest completeness and all-file mutation matrix.
manifest = load(BASE, "manifest.json")
listed = manifest["files"]
assert len(listed) == 428
on_disk = []
for p in BASE.rglob("*"):
    if p.is_file():
        rel = p.relative_to(BASE).as_posix()
        if rel not in {"manifest.json", "manifest.sig"}:
            on_disk.append(rel)
assert set(on_disk) == set(listed)
mutation_matrix = []
for rel, expected in listed.items():
    b = (BASE / rel).read_bytes()
    pos = len(b) // 2
    mutated = (b[:pos] + bytes([b[pos] ^ 1]) + b[pos + 1:]) if b else b"X"
    changed = sha256(mutated)
    mutation_matrix.append({"file": rel, "detected": changed != expected, "size": len(b)})
assert all(r["detected"] for r in mutation_matrix)

# 3) Static verifier reachability / semantics.
verify_source = (BASE / "verify.js").read_text()
static = {
    "verifyJsSha256": sha256((BASE / "verify.js").read_bytes()),
    "runJsonReadByVerifier": 'readJSON("artifacts/run.json")' in verify_source,
    "ledgerRefsReadByVerifier": 'readJSON("artifacts/ledger-refs.json")' in verify_source,
    "destinationContextRead": 'readJSON("artifacts/destination-context.json")' in verify_source,
    "sigmaRead": 'readJSON("artifacts/sigma.json")' in verify_source,
    "nullifierRead": 'readJSON("artifacts/nullifier.json")' in verify_source,
    "negativeControlsRead": 'readJSON("artifacts/negative-controls.json")' in verify_source,
    "manifestFileCountValidated": "manifest.fileCount" in verify_source,
    "manifestAlgoValidated": "manifest.algo" in verify_source,
    "sigmaDestCtxCrossCheckedToDestinationArtifact": "s.fields.destCtx" in verify_source[verify_source.find("function checkConsistency"):verify_source.find("// [6]")],
    "runPartyCrossBindingPresent": "run.json" in verify_source[verify_source.find("function checkConsistency"):verify_source.find("// [6]")],
    "assertedInFieldsValidated": "assertedInFields" in verify_source,
}
assert static["verifyJsSha256"] == EXPECTED_VERIFY_SHA
assert static["runJsonReadByVerifier"] is False
assert static["ledgerRefsReadByVerifier"] is False

# 4) Semantic re-signing cases. These are NOT claims of breaking authentic signatures:
# every case must be rejected by the out-of-band fingerprint before its verifier output is trusted.
semantic = [
    semantic_case("forged_run_and_ledger", mutate_run_ledger),
    semantic_case("opaque_rail_tokens", mutate_opaque_rail_tokens),
    semantic_case("destination_artifact_crosslink_gap", mutate_destination_only),
    semantic_case("fabricated_negative_control_text", mutate_negative_text),
    semantic_case("arbitrary_nullifier", mutate_nullifier),
]

# Combined semantic contradiction.
def combined(case):
    mutate_run_ledger(case)
    mutate_opaque_rail_tokens(case)
    mutate_destination_only(case)
    mutate_negative_text(case)
    mutate_nullifier(case)
semantic.append(semantic_case("combined_semantic_forgery", combined))
assert all(x["providerVerifier7of7"] and x["externalAnchorWouldReject"] for x in semantic)

# 5) Manifest metadata fields algo/fileCount are not consumed by verify.js.
meta_case = CASES / "manifest_metadata_ignored"
shutil.copytree(BASE, meta_case)
fp = regen_and_sign(meta_case)
m = load(meta_case, "manifest.json")
m["algo"] = "md5"
m["fileCount"] = 999999
save(meta_case, "manifest.json", m)
key = meta_case / ".velmere-meta.key"
sigbin = meta_case / ".velmere-meta.sig.bin"
run(["openssl", "genpkey", "-algorithm", "Ed25519", "-out", str(key)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
run(["openssl", "pkey", "-in", str(key), "-pubout", "-out", str(meta_case / "manifest-pubkey.pem")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
# pubkey changed, so refresh its manifest entry while preserving deliberately false algo/fileCount.
m["files"]["manifest-pubkey.pem"] = sha256((meta_case / "manifest-pubkey.pem").read_bytes())
save(meta_case, "manifest.json", m)
run(["openssl", "pkeyutl", "-sign", "-inkey", str(key), "-rawin", "-in", str(meta_case / "manifest.json"), "-out", str(sigbin)])
(meta_case / "manifest.sig").write_text(sigbin.read_bytes().hex() + "\n")
meta_fp = fingerprint(meta_case / "manifest-pubkey.pem")
key.unlink(); sigbin.unlink()
meta_proc = docker_verify(meta_case)
manifest_metadata = {
    "providerVerifierExit": meta_proc.returncode,
    "providerVerifier7of7": "RESULT: 7/7 PASS" in meta_proc.stdout,
    "algo": "md5",
    "fileCount": 999999,
    "externalAnchorWouldReject": meta_fp != EXPECTED_FP,
}
assert manifest_metadata["providerVerifier7of7"]

# 6) Fail-open execution-order control: a signed-manifest mismatch in vendored executable
# is detected by check 1, but execution currently continues into the mismatched module.
failopen = CASES / "vendor_failopen"
shutil.copytree(BASE, failopen)
vendor = failopen / "vendor/node_modules/@aztec/bb.js/dest/node/index.js"
vendor.write_text(
    'import { writeFileSync as __velmereWrite } from "node:fs";\n'
    '__velmereWrite("/out/executed.txt", "EXECUTED_AFTER_MANIFEST_MISMATCH\\n");\n'
    + vendor.read_text()
)
marker = OUT / "failopen-marker"
if marker.exists():
    shutil.rmtree(marker)
proc = docker_verify(failopen, marker)
marker_file = marker / "executed.txt"
failopen_result = {
    "exit": proc.returncode,
    "manifestMismatchDetected": "manifest hash integrity ... FAIL" in proc.stdout,
    "mismatchedExecutableRanAfterDetection": marker_file.exists(),
    "marker": marker_file.read_text().strip() if marker_file.exists() else None,
    "finalResult": next((x for x in proc.stdout.splitlines() if x.startswith("RESULT:")), None),
}
assert failopen_result["manifestMismatchDetected"]
assert failopen_result["mismatchedExecutableRanAfterDetection"]
# The web page's archive SHA check is a meaningful mitigation: modifying this executable changes
# the archive/bundle bytes and is caught if the published archive digest is verified before extraction.

# 7) Claim-to-evidence matrix for Velmere.
claims = [
    {"id":"ZV-ARCHIVE","claim":"Exact published archive received","status":"PASS","basis":"Archive SHA-256 and byte count match independently published current-kit anchor."},
    {"id":"ZV-KEY","claim":"Bundle signing key matches current ZeroVaultID published key and is not currently revoked","status":"PASS","basis":"Independent SPKI fingerprint plus current default-branch revocation check."},
    {"id":"ZV-SIGNATURE","claim":"manifest.json is signed under the matched key","status":"PASS","basis":"Independent OpenSSL Ed25519 verification."},
    {"id":"ZV-FILES","claim":"All 428 manifest-covered files match signed digests","status":"PASS","basis":"Independent full manifest replay; 428/428 one-byte mutation controls changed digest."},
    {"id":"ZV-CLOSEC","claim":"Close_C equals the Pedersen result for the published six inputs","status":"PASS","basis":"Provider verifier recomputation succeeds in clean room using pinned vendored bb.js; independent alternate implementation NOT_RUN."},
    {"id":"ZV-OPENA","claim":"openA equals SHA3-256 of the canonical published Sigma fields","status":"PASS","basis":"Recomputation check passes; encoding is explicit and uses standard SHA3-256."},
    {"id":"ZV-RUN","claim":"run.json reflects a real Canton run","status":"INSUFFICIENT_EVIDENCE","basis":"Verifier never reads run.json semantically; signature proves signer attribution, not external truth."},
    {"id":"ZV-LEDGER","claim":"ledger-refs.json identifiers correspond to live/recorded Canton ledger state","status":"NOT_VERIFIED","basis":"No live ledger lookup or independent ledger replay in bundle."},
    {"id":"ZV-RAIL12","claim":"Rail checks 1 and 2 were actually proven by inclusion proofs/signatures in this bundle","status":"NOT_VERIFIED","basis":"piClose/sigSrc/sigCust/sigDst are opaque placeholder labels; semantic forgery remains 7/7 under a non-authentic re-signing key."},
    {"id":"ZV-RAIL345","claim":"Canton enforced Rail checks 3-5 in the referenced run","status":"NOT_VERIFIED","basis":"Bundle points at attested references; it does not reproduce Canton enforcement."},
    {"id":"ZV-NEG","claim":"Negative-control texts were actually emitted by Canton","status":"NOT_VERIFIED","basis":"Check 6 validates only string shape; fabricated texts preserving prefix still yield 7/7 under re-signing."},
    {"id":"ZV-DESTLINK","claim":"destination-context.json is cross-bound to sigma.fields.destCtx","status":"WARN","basis":"Missing cross-artifact comparison: deliberately contradictory values can still produce 7/7 after re-signing."},
    {"id":"ZV-PARTYLINK","claim":"run.json party identities are cross-bound to Sigma authorities/customer","status":"WARN","basis":"No run.json semantic read or cross-binding in verifier."},
    {"id":"ZV-NULLIFIER","claim":"Nullifier has cryptographic derivation/uniqueness proof in this bundle","status":"NOT_VERIFIED","basis":"Nullifier is a chosen label; verifier checks only equality at two sites."},
    {"id":"ZV-HIDING","claim":"Close_C demonstrates confidentiality/hiding for this bundle","status":"NOT_APPLICABLE","basis":"All commitment inputs including rho are published; bundle explicitly demonstrates reproducibility, not hiding."},
    {"id":"ZV-UNLINK","claim":"Fresh pseudonym is unlinkable from source customer in this run","status":"FAIL","basis":"alice, aliceB, and zvCanton share the same participant fingerprint in run.json."},
    {"id":"ZV-PROD","claim":"This constitutes a production security certification of ZeroVaultID","status":"NOT_VERIFIED","basis":"Scope is one public LocalNet evidence kit."},
    {"id":"ZV-FAILCLOSED","claim":"After check 1 detects a manifest-covered executable mismatch, no mismatched executable code runs","status":"FAIL","basis":"Controlled vendor mutation: check 1 reported FAIL, then modified bb.js module executed a harmless marker before verifier exited nonzero. Published archive SHA verification mitigates tampered-download scenario, but verifier itself is not fail-fast here."},
]

result = {
    "schema": "velmere.external-evidence-pass2.v1",
    "archive": archive,
    "manifest": {
        "declaredFileCount": manifest.get("fileCount"),
        "actualManifestEntries": len(listed),
        "actualCoveredFiles": len(on_disk),
        "all428OneByteMutationsDetectedByDigest": sum(1 for r in mutation_matrix if r["detected"]),
    },
    "staticVerifierSemantics": static,
    "semanticResigningCases": semantic,
    "manifestMetadataIgnoredCase": manifest_metadata,
    "executionOrderFinding": failopen_result,
    "claims": claims,
    "notes": [
        "Semantic re-signing cases use an attacker key and are expected to be rejected by the mandatory out-of-band fingerprint check. They demonstrate claim scope, not a signature break.",
        "The execution-order finding uses the authentic signed manifest unchanged, modifies one vendored executable after signing, observes check 1 FAIL, and confirms that modified code still executes later in check 3.",
        "The Cert Seal web page publishes and asks reviewers to verify the whole-archive SHA-256 before extraction; following that step mitigates the tampered-download path for the execution-order finding.",
    ],
}
(OUT / "pass2-result.json").write_text(json.dumps(result, indent=2))
(OUT / "all428-mutation-matrix.json").write_text(json.dumps(mutation_matrix, indent=2))
# Preserve combined semantic forged bundle for Velmere integrity-only boundary testing.
combined_dir = CASES / "combined_semantic_forgery"
shutil.make_archive(str(OUT / "combined-semantic-forgery"), "zip", combined_dir)
print(json.dumps({
    "archive": archive,
    "all428": result["manifest"]["all428OneByteMutationsDetectedByDigest"],
    "semantic7of7": sum(1 for x in semantic if x["providerVerifier7of7"]),
    "failopen": failopen_result,
    "claims": {s: sum(1 for c in claims if c["status"] == s) for s in sorted({c["status"] for c in claims})},
}, indent=2))
