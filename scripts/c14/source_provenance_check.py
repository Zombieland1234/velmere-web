#!/usr/bin/env python3
"""Velmère C14-P02 source provenance checker.

Default mode verifies the immutable C13 Git anchor and the preserved
C6E -> C13 ancestry chain. Optional inputs verify the archived C13 source
artifact and historical R13F-UI2 package without promoting UI2 identity.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tempfile
import zipfile

HERE = Path(__file__).resolve().parent
LOCK_PATH = HERE / "source-provenance-lock.json"


class CheckError(RuntimeError):
    pass


def fail(message: str) -> None:
    raise CheckError(message)


def run_git(*args: str, cwd: Path | None = None, check: bool = True) -> bytes:
    proc = subprocess.run(
        ["git", *args],
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check and proc.returncode != 0:
        raise CheckError(
            f"git {' '.join(args)} failed ({proc.returncode}): "
            f"{proc.stderr.decode('utf-8', 'replace').strip()}"
        )
    return proc.stdout


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def safe_zip_names(zf: zipfile.ZipFile) -> list[str]:
    names = [item.filename for item in zf.infolist() if not item.is_dir()]
    if len(names) != len(set(names)):
        fail("ZIP contains duplicate file names")
    for name in names:
        p = PurePosixPath(name)
        if p.is_absolute() or ".." in p.parts or "\\" in name:
            fail(f"unsafe ZIP path: {name!r}")
    return names


def parse_ls_tree(raw: bytes) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for entry in raw.split(b"\0"):
        if not entry:
            continue
        meta, path = entry.split(b"\t", 1)
        mode, kind, object_id, size = meta.split(b" ", 3)
        rows.append(
            {
                "path": path.decode("utf-8", "surrogateescape"),
                "mode": mode.decode(),
                "kind": kind.decode(),
                "object": object_id.decode(),
                "bytes": int(size),
            }
        )
    return rows


def git_tree_rows(commit: str) -> list[dict[str, object]]:
    raw = run_git("ls-tree", "-rlz", "--full-tree", commit)
    rows = parse_ls_tree(raw)
    rows.sort(key=lambda row: str(row["path"]).encode("utf-8", "surrogateescape"))
    return rows


def hash_git_blobs(rows: list[dict[str, object]]) -> dict[str, dict[str, object]]:
    proc = subprocess.Popen(
        ["git", "cat-file", "--batch"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert proc.stdin is not None
    assert proc.stdout is not None
    result: dict[str, dict[str, object]] = {}
    try:
        for row in rows:
            object_id = str(row["object"])
            proc.stdin.write((object_id + "\n").encode())
            proc.stdin.flush()
            header = proc.stdout.readline()
            parts = header.rstrip(b"\n").split()
            if len(parts) != 3 or parts[1] != b"blob":
                fail(f"unexpected git cat-file header for {row['path']}: {header!r}")
            size = int(parts[2])
            data = proc.stdout.read(size)
            terminator = proc.stdout.read(1)
            if len(data) != size or terminator != b"\n":
                fail(f"short git cat-file read for {row['path']}")
            if size != int(row["bytes"]):
                fail(f"git size mismatch for {row['path']}")
            result[str(row["path"])] = {
                "bytes": size,
                "sha256": sha256_bytes(data),
                "mode": row["mode"],
                "object": object_id,
            }
    finally:
        if proc.stdin:
            proc.stdin.close()
        proc.wait(timeout=30)
    if proc.returncode != 0:
        err = proc.stderr.read().decode("utf-8", "replace") if proc.stderr else ""
        fail(f"git cat-file failed: {err.strip()}")
    return result


def canonical_aggregate(records: dict[str, dict[str, object]]) -> str:
    h = hashlib.sha256()
    for path in sorted(records, key=lambda p: p.encode("utf-8", "surrogateescape")):
        row = records[path]
        h.update(path.encode("utf-8", "surrogateescape"))
        h.update(b"\0")
        h.update(str(row["bytes"]).encode())
        h.update(b"\0")
        h.update(str(row["sha256"]).encode())
        h.update(b"\n")
    return h.hexdigest()


def verify_git(lock: dict) -> dict[str, dict[str, object]]:
    anchor = lock["anchor"]
    source_sha = anchor["sourceSha"]
    tree_sha = run_git("rev-parse", f"{source_sha}^{{tree}}").decode().strip()
    if tree_sha != anchor["treeSha"]:
        fail(f"C13 tree SHA mismatch: {tree_sha} != {anchor['treeSha']}")

    rows = git_tree_rows(source_sha)
    if len(rows) != anchor["trackedFileCount"]:
        fail(f"tracked file count mismatch: {len(rows)} != {anchor['trackedFileCount']}")
    bad = [row for row in rows if row["kind"] != "blob" or row["mode"] != anchor["allBlobMode"]]
    if bad:
        fail(f"unexpected non-regular Git entries: {bad[:5]}")

    records = hash_git_blobs(rows)
    aggregate = canonical_aggregate(records)
    if aggregate != anchor["canonicalTrackedFilesSha256"]:
        fail(
            "tracked-file SHA-256 aggregate mismatch: "
            f"{aggregate} != {anchor['canonicalTrackedFilesSha256']}"
        )

    for edge in lock["ancestry"]:
        proc = subprocess.run(
            ["git", "merge-base", "--is-ancestor", edge["from"], edge["to"]],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            check=False,
        )
        if proc.returncode != 0:
            fail(f"broken ancestry: {edge['from']} is not ancestor of {edge['to']}")

    return records


def verify_c13_source_artifact(
    path: Path,
    lock: dict,
    git_records: dict[str, dict[str, object]],
) -> None:
    expected = lock["c13SourceArtifact"]
    if sha256_file(path) != expected["outerArtifactSha256"]:
        fail("C13 outer source artifact SHA-256 mismatch")

    with zipfile.ZipFile(path) as outer:
        outer_names = safe_zip_names(outer)
        if outer.testzip() is not None:
            fail("C13 outer artifact CRC failure")
        required = {"SOURCE_IDENTITY.json", expected["innerZipName"]}
        if set(outer_names) != required:
            fail(f"unexpected C13 outer artifact members: {outer_names}")
        identity = json.loads(outer.read("SOURCE_IDENTITY.json"))
        inner_bytes = outer.read(expected["innerZipName"])

    anchor = lock["anchor"]
    if identity.get("sourceSha") != anchor["sourceSha"] or identity.get("treeSha") != anchor["treeSha"]:
        fail("C13 SOURCE_IDENTITY Git anchor mismatch")
    if identity.get("trackedFilesIncluded") != expected["includedFileCount"]:
        fail("C13 included-file count mismatch")
    if identity.get("originalUI2ZipIdentityConfirmed") is not False:
        fail("C13 artifact improperly claims UI2 identity")
    if sha256_bytes(inner_bytes) != expected["innerZipSha256"]:
        fail("C13 inner ZIP SHA-256 mismatch")

    with zipfile.ZipFile(io.BytesIO(inner_bytes)) as inner:
        names = safe_zip_names(inner)
        if inner.testzip() is not None:
            fail("C13 inner source ZIP CRC failure")
        if len(names) != expected["includedFileCount"]:
            fail("C13 inner source ZIP file count mismatch")
        manifest = {row["path"]: row for row in identity["files"]}
        if set(names) != set(manifest):
            fail("C13 inner ZIP paths differ from SOURCE_IDENTITY manifest")
        for name in names:
            raw = inner.read(name)
            row = manifest[name]
            if len(raw) != row["bytes"] or sha256_bytes(raw) != row["sha256"]:
                fail(f"C13 inner ZIP content mismatch: {name}")

        excluded = {row["path"]: row for row in expected["excluded"]}
        identity_excluded = {
            row["path"] for row in identity.get("excludedTrackedFiles", [])
        }
        if identity_excluded != set(excluded):
            fail("C13 excluded-resource list mismatch")
        if set(excluded) & set(names):
            fail("declared excluded resource unexpectedly present in C13 source ZIP")

        # Rebuild the complete Git tree from the distributable ZIP plus only
        # the two declared exclusions, taking those bytes from the anchor.
        with tempfile.TemporaryDirectory(prefix="velmere-c14-p02-") as tmp:
            root = Path(tmp)
            inner.extractall(root)
            for file_path in root.rglob("*"):
                if file_path.is_file():
                    file_path.chmod(0o644)
            for name, row in excluded.items():
                raw = run_git("show", f"{anchor['sourceSha']}:{name}")
                if len(raw) != row["bytes"] or sha256_bytes(raw) != row["sha256"]:
                    fail(f"excluded Git resource mismatch: {name}")
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(raw)
                target.chmod(0o644)
            run_git("init", "-q", cwd=root)
            run_git("add", "-f", "-A", cwd=root)
            rebuilt = run_git("write-tree", cwd=root).decode().strip()
            if rebuilt != anchor["treeSha"]:
                fail(f"reconstructed C13 tree mismatch: {rebuilt} != {anchor['treeSha']}")

    for path_name, row in manifest.items():
        git_row = git_records.get(path_name)
        if (
            git_row is None
            or git_row["bytes"] != row["bytes"]
            or git_row["sha256"] != row["sha256"]
        ):
            fail(f"C13 ZIP/Git SHA-256 mismatch: {path_name}")


def literal_missing_script_refs(
    source_sha: str,
    git_records: dict[str, dict[str, object]],
) -> set[str]:
    pkg = json.loads(run_git("show", f"{source_sha}:package.json").decode())
    refs: set[str] = set()
    pattern = re.compile(r"scripts/[\w./-]+\.(?:mjs|cjs|js|ts|py|sh)")
    for command in pkg.get("scripts", {}).values():
        for path in pattern.findall(command):
            if path not in git_records:
                refs.add(path)
    return refs


def verify_ui2(
    path: Path,
    lock: dict,
    git_records: dict[str, dict[str, object]],
) -> None:
    expected = lock["ui2"]
    if sha256_file(path) != expected["zipSha256"]:
        fail("UI2 ZIP SHA-256 mismatch")

    with zipfile.ZipFile(path) as zf:
        names = safe_zip_names(zf)
        if zf.testzip() is not None:
            fail("UI2 ZIP CRC failure")
        if len(names) != expected["zipFileEntries"]:
            fail(f"UI2 entry count mismatch: {len(names)} != {expected['zipFileEntries']}")
        ui2_names = set(names)
        c13_names = set(git_records)
        overlap = c13_names & ui2_names
        exact = 0
        different = 0
        for name in overlap:
            row = git_records[name]
            raw = zf.read(name)
            if len(raw) == row["bytes"] and sha256_bytes(raw) == row["sha256"]:
                exact += 1
            else:
                different += 1
        observed = {
            "c13TrackedFiles": len(c13_names),
            "ui2FileEntries": len(ui2_names),
            "overlappingPaths": len(overlap),
            "byteIdenticalOverlaps": exact,
            "differentBytesAtSamePath": different,
            "c13OnlyPaths": len(c13_names - ui2_names),
            "ui2OnlyPaths": len(ui2_names - c13_names),
        }
        for key, value in expected["c13Comparison"].items():
            if key in observed and observed[key] != value:
                fail(f"UI2/C13 comparison drift for {key}: {observed[key]} != {value}")

        missing_refs = literal_missing_script_refs(lock["anchor"]["sourceSha"], git_records)
        if len(missing_refs) != expected["c13Comparison"]["c13MissingReferencedScriptPaths"]:
            fail("C13 literal missing-script count drift")
        in_ui2 = missing_refs & ui2_names
        if len(in_ui2) != expected["c13Comparison"]["thoseMissingPathsPresentInUi2"]:
            fail("UI2 no longer contains all recorded C13 missing-script paths")

        origin = expected["embeddedOriginalSourceManifest"]
        origin_raw = zf.read(origin["path"])
        if sha256_bytes(origin_raw) != origin["sha256"]:
            fail("UI2 embedded ORIGINAL_SOURCE_MANIFEST SHA-256 mismatch")
        origin_json = json.loads(origin_raw)
        if origin_json.get("sourceCommit") != origin["sourceCommit"]:
            fail("UI2 embedded original sourceCommit mismatch")

        for rel in expected["fontRelationship"]:
            present = rel["path"] in ui2_names
            if present != rel["presentInUi2"]:
                fail(f"UI2 font presence drift: {rel['path']}")
            if present:
                same = (
                    sha256_bytes(zf.read(rel["path"]))
                    == git_records[rel["path"]]["sha256"]
                )
                if same != rel["sameSha256AsC13"]:
                    fail(f"UI2 font SHA relationship drift: {rel['path']}")


def load_lock() -> dict:
    return json.loads(LOCK_PATH.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-artifact",
        type=Path,
        help="GitHub Actions c13-source artifact ZIP",
    )
    parser.add_argument(
        "--ui2",
        type=Path,
        help="historical VELMERE_SOURCE_R13F-UI2.zip",
    )
    args = parser.parse_args()

    lock = load_lock()
    git_records = verify_git(lock)
    print(
        "PASS git-anchor",
        lock["anchor"]["sourceSha"],
        lock["anchor"]["treeSha"],
        len(git_records),
        lock["anchor"]["canonicalTrackedFilesSha256"],
    )

    if args.source_artifact:
        verify_c13_source_artifact(args.source_artifact, lock, git_records)
        print("PASS c13-source-artifact", args.source_artifact)

    if args.ui2:
        verify_ui2(args.ui2, lock, git_records)
        print("PASS ui2-comparison", args.ui2, "identity=NOT_PROVEN")

    print("C14-P02 provenance checks PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except CheckError as exc:
        print(f"C14-P02 FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
