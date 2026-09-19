#!/usr/bin/env python3
import hashlib, json, os, pathlib, shutil, subprocess, sys

ROOT = pathlib.Path(os.environ.get("ZV_PASS3_ROOT", "/tmp/zv-pass3"))
BASE = ROOT / "bundle-root" / "bundle"
CASE = ROOT / "case"
OUT = ROOT / "out"
CANARY = ROOT / "canary"

def run(args, **kwargs):
    return subprocess.run(args, text=True, capture_output=True, **kwargs)

def sha256(p):
    return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()

def fingerprint(pub):
    a = subprocess.run(
        ["openssl","pkey","-pubin","-in",str(pub),"-pubout","-outform","DER"],
        capture_output=True, check=True
    )
    return hashlib.sha256(a.stdout).hexdigest()

def manifest_preflight(bundle):
    m = json.loads((bundle/"manifest.json").read_text())
    files = m.get("files",{})
    bad=[]; missing=[]; extra=[]
    actual=[]
    for p in bundle.rglob("*"):
        if p.is_file():
            rel=p.relative_to(bundle).as_posix()
            if rel not in {"manifest.json","manifest.sig"}:
                actual.append(rel)
    for rel, expected in files.items():
        p=bundle/rel
        if not p.exists():
            missing.append(rel)
        elif sha256(p) != expected:
            bad.append(rel)
    for rel in actual:
        if rel not in files:
            extra.append(rel)
    return {"ok":not bad and not missing and not extra, "bad":bad, "missing":missing, "extra":extra, "listed":len(files)}

def main():
    if CASE.exists(): shutil.rmtree(CASE)
    if OUT.exists(): shutil.rmtree(OUT)
    if CANARY.exists(): shutil.rmtree(CANARY)
    shutil.copytree(BASE, CASE)
    OUT.mkdir(parents=True)
    CANARY.mkdir(parents=True)
    (CANARY/"secret.txt").write_text("PASS3-DUMMY-CANARY\n")

    # Authenticity steps 1-4 from README still succeed because we do not touch
    # the key, manifest, signature, or verify.js.
    fp = fingerprint(CASE/"manifest-pubkey.pem")
    expected_fp="234374010ba7c648e59f26003b7915ce2c70899cd101c770cb046f5d6e3b5286"
    assert fp == expected_fp

    sigbin=ROOT/"manifest.sig.bin"
    sigbin.write_bytes(bytes.fromhex((CASE/"manifest.sig").read_text().strip()))
    sig = run(["openssl","pkeyutl","-verify","-pubin","-inkey",str(CASE/"manifest-pubkey.pem"),
               "-rawin","-in",str(CASE/"manifest.json"),"-sigfile",str(sigbin)])
    assert sig.returncode == 0, sig.stderr

    manifest=json.loads((CASE/"manifest.json").read_text())
    assert sha256(CASE/"verify.js") == manifest["files"]["verify.js"]

    # Post-authentication local tampering of one manifest-covered executable.
    vendor=CASE/"vendor/node_modules/@aztec/bb.js/dest/node/index.js"
    original=vendor.read_text()
    injected = (
      'import { readFileSync as __zvRead, writeFileSync as __zvWrite } from "node:fs";\n'
      'let __zvCanary=false; try { __zvCanary=__zvRead("/canary/secret.txt","utf8").trim()==="PASS3-DUMMY-CANARY"; } catch {}\n'
      '__zvWrite("/out/executed.txt", "EXECUTED_AFTER_MANIFEST_MISMATCH\\nCANARY_READ="+(__zvCanary?"PASS":"FAIL")+"\\n");\n'
    )
    vendor.write_text(injected+original)

    after=manifest_preflight(CASE)
    assert after["ok"] is False
    assert "vendor/node_modules/@aztec/bb.js/dest/node/index.js" in after["bad"]

    # README steps 1-4 STILL pass even after this vendor mutation.
    fp2=fingerprint(CASE/"manifest-pubkey.pem")
    assert fp2 == expected_fp
    sig2=run(["openssl","pkeyutl","-verify","-pubin","-inkey",str(CASE/"manifest-pubkey.pem"),
              "-rawin","-in",str(CASE/"manifest.json"),"-sigfile",str(sigbin)])
    assert sig2.returncode == 0
    assert sha256(CASE/"verify.js") == manifest["files"]["verify.js"]

    # Run provider verifier in isolated container. Network disabled. Dummy canary
    # is the only external read target; output is a harmless marker.
    proc=run([
      "docker","run","--rm","--network","none",
      "-v",f"{CASE}:/bundle:ro",
      "-v",f"{CANARY}:/canary:ro",
      "-v",f"{OUT}:/out",
      "-w","/bundle","node:20","node","verify.js"
    ])
    marker=OUT/"executed.txt"
    marker_text=marker.read_text() if marker.exists() else ""
    provider={
      "exit":proc.returncode,
      "manifestMismatchDetected":"manifest hash integrity ... FAIL" in proc.stdout,
      "tamperedExecutableExecuted":marker.exists(),
      "dummyCanaryRead":"CANARY_READ=PASS" in marker_text,
      "resultLine":next((x for x in proc.stdout.splitlines() if x.startswith("RESULT:")),None),
      "stdoutTail":"\n".join(proc.stdout.splitlines()[-18:]),
      "stderrTail":"\n".join(proc.stderr.splitlines()[-12:]),
    }
    assert provider["exit"] != 0
    assert provider["manifestMismatchDetected"]
    assert provider["tamperedExecutableExecuted"]
    assert provider["dummyCanaryRead"]

    # Independent all-file preflight wrapper: refuse to execute anything from the
    # bundle after a digest mismatch. This is the remediation/control.
    control=manifest_preflight(CASE)
    control_exec_attempted=False
    if control["ok"]:
        control_exec_attempted=True
        raise AssertionError("control unexpectedly accepted tampered bundle")
    assert not control_exec_attempted

    # Fresh authentic bundle must pass the same preflight, proving the control
    # does not reject the legitimate kit.
    authentic=manifest_preflight(BASE)
    assert authentic["ok"] and authentic["listed"] == 428

    result={
      "schema":"velmere.external-evidence-pass3.v1",
      "scenario":"post-authentication manifest-covered executable tamper",
      "readmeSteps1to4AfterTamper":{
        "keyFingerprintStillMatches":fp2==expected_fp,
        "manifestSignatureStillVerifies":sig2.returncode==0,
        "verifyJsDigestStillMatches":sha256(CASE/"verify.js")==manifest["files"]["verify.js"],
        "note":"Steps 1-4 authenticate key/manifest/verify.js but do not preflight every manifest-covered executable before node verify.js starts."
      },
      "providerVerifier":provider,
      "independentFullManifestPreflight":{
        "authenticBundlePasses":authentic["ok"],
        "tamperedBundleBlockedBeforeExecution":not control["ok"] and not control_exec_attempted,
        "tamperedFiles":control["bad"],
      },
      "impactBoundary":{
        "networkDisabledInReproduction":True,
        "onlyDummyCanaryMounted":True,
        "hostSecretsOrProductionDataAccessed":False,
        "recommendedReadOnlyCleanRoomReducesHostImpact":True,
        "wholeArchiveDigestCheckBeforeExtractionMitigatesTamperedDownload":True,
        "postExtractionTamperOrREADMEOnlySteps1to4RemainRelevant":True
      },
      "classification":{
        "finding":"VERIFIER_CONTINUES_AFTER_MANIFEST_INTEGRITY_FAILURE_AND_EXECUTES_MISMATCHED_MANIFEST_COVERED_CODE",
        "status":"CONFIRMED",
        "suggestedSeverityContext":"DEFENSE_IN_DEPTH_MEDIUM_IF_RUN_ON_HOST; LOWER_WITH_RECOMMENDED_NETWORKLESS_READ_ONLY_CLEAN_ROOM_AND_ARCHIVE_DIGEST_PREFLIGHT",
        "minimalRemediation":"After authentic signature verification, recompute and validate ALL manifest-covered file hashes before importing/executing any manifest-covered module; abort immediately on any mismatch."
      }
    }
    (ROOT/"pass3-result.json").write_text(json.dumps(result,indent=2))
    (ROOT/"provider-stdout.txt").write_text(proc.stdout)
    (ROOT/"provider-stderr.txt").write_text(proc.stderr)
    print(json.dumps(result,indent=2))

if __name__=="__main__":
    main()
