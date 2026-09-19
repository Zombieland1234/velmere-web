#!/usr/bin/env python3
"""Verify exported source/CI identity, not application safety or release readiness.

No network, archive extraction, code execution, credentials, database access or
third-party packages. Expected SHA-256 digests must come from a trusted channel.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import stat
import sys
from typing import Any
import zipfile

MAX_MEMBER_BYTES = 128 * 1024 * 1024
MAX_TOTAL_BYTES = 512 * 1024 * 1024
MAX_MEMBERS = 20000


class Refusal(ValueError):
    """The supplied artifacts do not prove the requested handoff."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise Refusal(message)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hash_text(value: Any, length: int, name: str) -> str:
    require(isinstance(value, str) and re.fullmatch(rf"[0-9a-f]{{{length}}}", value) is not None,
            f"Invalid {name}")
    return value


def integer(value: Any, name: str) -> int:
    require(type(value) is int and value >= 0, f"Invalid {name}")
    return value


def relative_path(value: Any) -> str:
    require(isinstance(value, str) and bool(value), "Empty or non-string path")
    require(not any(ord(c) < 32 or ord(c) == 127 for c in value), "Control character in path")
    require("\\" not in value and not value.startswith("/") and ":" not in value,
            "Non-relative POSIX path")
    require(all(p not in ("", ".", "..") for p in value.split("/")), "Non-canonical path")
    return value


def json_bytes(data: bytes, name: str) -> Any:
    def no_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            require(key not in result, f"Duplicate JSON key in {name}")
            result[key] = value
        return result
    try:
        return json.loads(data.decode("utf-8"), object_pairs_hook=no_duplicate_keys,
                          parse_constant=lambda value: (_ for _ in ()).throw(Refusal(f"Invalid JSON constant: {value}")))
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise Refusal(f"Invalid JSON in {name}") from exc


class Archive:
    """Read bounded, flat-file ZIP membership without extracting any member."""
    def __init__(self, data: bytes, name: str):
        self.name = name
        try:
            self.zip = zipfile.ZipFile(io.BytesIO(data))
            infos = self.zip.infolist()
        except (zipfile.BadZipFile, OSError) as exc:
            raise Refusal(f"Invalid ZIP: {name}") from exc
        require(len(infos) <= MAX_MEMBERS, f"Too many members: {name}")
        require(sum(i.file_size for i in infos) <= MAX_TOTAL_BYTES, f"ZIP exceeds size limit: {name}")
        self.files: dict[str, zipfile.ZipInfo] = {}
        for info in infos:
            require(not info.is_dir(), f"Explicit directory member not supported: {name}")
            path = relative_path(info.filename)
            require(path not in self.files, f"Duplicate ZIP member: {path}")
            require(not info.flag_bits & 1, "Encrypted ZIP member")
            require(not stat.S_ISLNK(info.external_attr >> 16), "ZIP symlink member")
            require(info.file_size <= MAX_MEMBER_BYTES, f"ZIP member exceeds limit: {path}")
            self.files[path] = info

    def read(self, path: str) -> bytes:
        require(path in self.files, f"Missing member in {self.name}: {path}")
        try:
            return self.zip.read(self.files[path])
        except (zipfile.BadZipFile, RuntimeError, OSError) as exc:
            raise Refusal(f"Unreadable member in {self.name}: {path}") from exc

    def json(self, path: str) -> Any:
        return json_bytes(self.read(path), path)


def artifact(path: Path, expected: str) -> tuple[Archive, str]:
    expected = hash_text(expected, 64, "artifact SHA-256")
    require(path.is_file(), f"Missing artifact: {path.name}")
    require(path.stat().st_size <= MAX_TOTAL_BYTES, f"Artifact exceeds size limit: {path.name}")
    data = path.read_bytes()
    actual = digest(data)
    require(actual == expected, f"Artifact digest mismatch: {path.name}")
    return Archive(data, path.name), actual


def git_object_sha(kind: str, data: bytes) -> str:
    # Git object IDs here are SHA-1 by repository format; content also uses SHA-256.
    return hashlib.sha1(kind.encode("ascii") + b" " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def git_tree(entries: list[dict[str, Any]]) -> str:
    root: dict[str, Any] = {}
    for entry in entries:
        path = relative_path(entry["path"])
        mode = entry.get("mode")
        require(mode in ("100644", "100755", "120000"), f"Unsupported Git mode: {path}")
        blob = hash_text(entry.get("blobSha"), 40, f"blob SHA: {path}")
        parts = path.split("/")
        node = root
        for component in parts[:-1]:
            if component not in node:
                node[component] = {}
            require(isinstance(node[component], dict), f"File/directory collision: {path}")
            node = node[component]
        require(parts[-1] not in node, f"Duplicate/colliding source path: {path}")
        node[parts[-1]] = (mode, blob)

    def encode(node: dict[str, Any]) -> str:
        items = sorted(node.items(), key=lambda item: item[0].encode("utf-8") + (b"/" if isinstance(item[1], dict) else b""))
        contents = bytearray()
        for name, value in items:
            mode, sha = ("40000", encode(value)) if isinstance(value, dict) else value
            contents.extend(mode.encode("ascii") + b" " + name.encode("utf-8") + b"\0" + bytes.fromhex(sha))
        return git_object_sha("tree", bytes(contents))
    return encode(root)


def check_file_manifest(archive: Archive, entries: Any, *, source: bool = False) -> set[str]:
    require(isinstance(entries, list) and bool(entries), "Missing/non-list/empty file manifest")
    names: set[str] = set()
    for entry in entries:
        require(isinstance(entry, dict), "Invalid manifest entry")
        path = relative_path(entry.get("path"))
        require(path not in names, f"Duplicate manifest path: {path}")
        names.add(path)
        data = archive.read(path)
        require(len(data) == integer(entry.get("bytes"), "manifest byte count"), f"Size mismatch: {path}")
        require(digest(data) == hash_text(entry.get("sha256"), 64, "file SHA-256"), f"Content mismatch: {path}")
        if source:
            require(git_object_sha("blob", data) == hash_text(entry.get("blobSha"), 40, "blob SHA"), f"Git blob mismatch: {path}")
    return names


def tap_counts(data: bytes) -> dict[str, int]:
    try:
        text = data.decode("utf-8")
    except UnicodeError as exc:
        raise Refusal("Non-UTF-8 regression log") from exc
    require(re.search(r"^Bail out!", text, flags=re.MULTILINE) is None, "TAP bailout")
    counts: dict[str, int] = {}
    for key in ("tests", "pass", "fail", "cancelled", "skipped", "todo"):
        matches = re.findall(rf"^# {key} ([0-9]+)\s*$", text, flags=re.MULTILINE)
        require(len(matches) == 1, f"Missing or repeated top-level TAP count: {key}")
        counts[key] = int(matches[0])
    plans = re.findall(r"^1\.\.([0-9]+)\s*$", text, flags=re.MULTILINE)
    require(len(plans) == 1 and int(plans[0]) == counts["tests"], "TAP plan/count mismatch")
    passed = re.findall(r"^ok ([0-9]+)(?:\s|$)", text, flags=re.MULTILINE)
    require(passed == [str(i) for i in range(1, counts["tests"] + 1)], "TAP top-level results/count mismatch")
    require(not re.search(r"^not ok ", text, flags=re.MULTILINE), "TAP nonpassing result")
    require(counts["tests"] > 0 and counts["pass"] == counts["tests"], "Regression suite is empty or incomplete")
    require(all(counts[key] == 0 for key in ("fail", "cancelled", "skipped", "todo")), "Regression suite has failures/skips/cancellations/todos")
    return counts


def verify(args: argparse.Namespace) -> dict[str, Any]:
    src, src_digest = artifact(args.source_artifact, args.source_artifact_sha256)
    core, core_digest = artifact(args.core_artifact, args.core_artifact_sha256)
    require(set(src.files) == {"SOURCE.zip", "SOURCE_MANIFEST.json"}, "Unexpected source artifact layout")
    manifest = src.json("SOURCE_MANIFEST.json")
    require(isinstance(manifest, dict), "Invalid source manifest")
    commit = hash_text(manifest.get("sourceSha"), 40, "source commit")
    claimed_tree = hash_text(manifest.get("treeSha"), 40, "manifest tree")
    if args.expected_source_sha is not None:
        require(commit == hash_text(args.expected_source_sha, 40, "expected source commit"), "Expected source commit does not match")
    expected_tree = hash_text(args.expected_tree_sha, 40, "expected tree")
    source_data = src.read("SOURCE.zip")
    require(digest(source_data) == hash_text(manifest.get("sourceArchiveSha256"), 64, "inner source archive hash"), "Inner source archive mismatch")
    source = Archive(source_data, "SOURCE.zip")
    verified_names = check_file_manifest(source, manifest.get("files"), source=True)
    require(set(source.files) == verified_names, "Unmanifested source files")
    omitted = manifest.get("omitted")
    require(isinstance(omitted, list), "Missing explicit omissions inventory")
    for entry in omitted:
        require(isinstance(entry, dict), "Invalid omission")
        path = relative_path(entry.get("path"))
        require(path not in verified_names, "Omitted path is also present")
        integer(entry.get("bytes"), "omitted byte count")
        hash_text(entry.get("sha256"), 64, "omitted SHA-256")
        require(isinstance(entry.get("reason"), str) and bool(entry["reason"]), "Missing omission reason")
    computed_tree = git_tree(manifest["files"] + omitted)
    require(computed_tree == claimed_tree, "Reconstructed tree does not match source manifest")
    require(computed_tree == expected_tree, "Expected candidate tree does not match exported source")
    if args.expected_source_files is not None:
        require(len(verified_names) == integer(args.expected_source_files, "expected source file count"), "Expected source file count does not match")

    core_names = check_file_manifest(core, core.json("EVIDENCE_MANIFEST.json"))
    require(set(core.files) == core_names | {"EVIDENCE_MANIFEST.json"}, "Unmanifested evidence files")
    identity = core.json("IDENTITY.json")
    require(isinstance(identity, dict), "Invalid CI identity")
    require(identity.get("sourceSha") == commit and identity.get("tree") == computed_tree, "CI identity/source mismatch")
    for key in ("runId", "branch"):
        require(isinstance(manifest.get(key), str) and bool(manifest[key]), f"Missing source {key}")
        require(identity.get(key) == manifest[key], f"CI {key} mismatch")
    require(isinstance(identity.get("attempt"), str) and identity["attempt"].isdigit() and int(identity["attempt"]) > 0, "Missing CI attempt")

    qualification = core.json("QUALIFICATION.json")
    require(isinstance(qualification, list) and bool(qualification), "Missing qualification records")
    records: dict[str, Any] = {}
    for record in qualification:
        require(isinstance(record, dict), "Invalid qualification record")
        key = record.get("id")
        require(isinstance(key, str) and bool(key) and key not in records, "Duplicate/invalid qualification record")
        records[key] = record
        require(record.get("sourceSha") == commit, f"Stale qualification record: {key}")
        integer(record.get("exitCode"), f"exit code: {key}")
        logfile = relative_path(record.get("log"))
        require(logfile in core_names, f"Unmanifested qualification log: {key}")
        require(digest(core.read(logfile)) == hash_text(record.get("logSha256"), 64, "log SHA-256"), f"Qualification log mismatch: {key}")
    require("combined-regressions" in records, "Missing combined-regressions record")
    regression = records["combined-regressions"]
    require(regression["exitCode"] == 0, "Combined-regressions command failed")
    counts = tap_counts(core.read(regression["log"]))
    recorded_counts = regression.get("counts")
    require(isinstance(recorded_counts, dict), "Missing recorded counts")
    require(all(type(recorded_counts.get(k)) is int and recorded_counts[k] == v for k, v in counts.items()), "Recorded counts do not match TAP")
    require(counts["tests"] == integer(args.expected_test_count, "expected regression count"), "Expected regression count does not match")
    inventory = core.json("TEST_FILES.json")
    require(isinstance(inventory, dict), "Invalid test inventory")
    unique = inventory.get("uniqueFiles")
    require(isinstance(unique, list) and bool(unique), "Missing unique test file inventory")
    for name in unique:
        relative_path(name)
    require(len(unique) == len(set(unique)), "Duplicated test files")
    for group in ("baseFiles", "newFiles"):
        require(isinstance(inventory.get(group), list), f"Missing test group: {group}")
        for path in inventory[group]:
            relative_path(path)
    require(set(inventory["baseFiles"] + inventory["newFiles"]) == set(unique), "Test group inventory mismatch")
    require(set(unique).issubset(verified_names), "Registered test missing from verified source")
    command = regression.get("command")
    require(isinstance(command, list) and all(isinstance(x, str) for x in command), "Invalid test command")
    require("--test" in command and "--test-reporter=tap" in command, "Not the expected TAP test command")
    command_tests = [x for x in command if re.search(r"\.test\.(?:ts|tsx|js|mjs|cjs)$", x)]
    require(len(command_tests) == len(set(command_tests)) and set(command_tests) == set(unique), "Executed and registered test files differ")
    require(len(unique) == integer(args.expected_test_files, "expected test file count"), "Expected test file count does not match")

    gate = core.json("CORE_GATE.json")
    require(isinstance(gate, dict) and gate.get("sourceSha") == commit, "Stale or missing core gate")
    failed = sorted(key for key, value in records.items() if value["exitCode"] != 0)
    require(isinstance(gate.get("failedChecks"), list) and sorted(gate["failedChecks"]) == failed, "Core gate failure summary differs from execution")
    require(gate.get("status") in ("GO", "NO_GO"), "Invalid core gate status")
    require(not failed or gate["status"] == "NO_GO", "Core gate claims GO despite failures")
    return {
        "schema": "velmere.handoff-verification.v1",
        "identityStatus": "VERIFIED_EXPORTED_CONTENT" if not omitted else "VERIFIED_EXPORT_WITH_DECLARED_OMISSIONS",
        "sourceSha": commit, "reconstructedTreeSha": computed_tree,
        "runId": identity["runId"], "attempt": identity["attempt"], "branch": identity["branch"],
        "verifiedSourceFiles": len(verified_names), "verifiedEvidenceFiles": len(core_names),
        "omittedFilesNotByteVerified": [{"path": e["path"], "reason": e["reason"]} for e in omitted],
        "standaloneSourceComplete": not omitted,
        "artifacts": {"sourceSha256": src_digest, "coreSha256": core_digest},
        "regressionCounts": counts, "registeredTestFiles": len(unique),
        "qualificationFailures": failed, "coreDeclaredStatus": gate["status"],
        "releaseStatus": "NO_GO", "releaseApproved": False,
        "scope": "EXISTING_SOURCE_AND_CI_EVIDENCE_VERIFICATION_NOT_TEST_REEXECUTION",
        "limitations": ["Artifact digests require an independently trusted retrieval channel.",
                        "Matching hashes do not establish correctness or truth of a publisher's tests.",
                        "Declared missing blobs reconstruct identity but their bytes were not supplied.",
                        "No proof of hosted Auth/Stripe, full product E2E, deployed parity or external audit.",
                        "A provenance verifier never promotes an application to GO."],
    }


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source-artifact", type=Path, required=True)
    p.add_argument("--source-artifact-sha256", required=True)
    p.add_argument("--core-artifact", type=Path, required=True)
    p.add_argument("--core-artifact-sha256", required=True)
    p.add_argument("--expected-source-sha")
    p.add_argument("--expected-tree-sha", required=True)
    p.add_argument("--expected-test-count", type=int, required=True)
    p.add_argument("--expected-test-files", type=int, required=True)
    p.add_argument("--expected-source-files", type=int)
    p.add_argument("--output", type=Path)
    return p


def main() -> int:
    args = parser().parse_args()
    try:
        result = verify(args)
        code = 0
    except (Refusal, OSError, KeyError, TypeError, ValueError, zipfile.BadZipFile) as exc:
        result = {"schema": "velmere.handoff-verification.v1", "identityStatus": "REFUSED",
                  "releaseStatus": "NO_GO", "releaseApproved": False,
                  "reason": str(exc), "scope": "EXISTING_SOURCE_AND_CI_EVIDENCE_VERIFICATION_NOT_TEST_REEXECUTION"}
        code = 1
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        # Never overwrite an earlier evidence result silently.
        try:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            with args.output.open("x", encoding="utf-8") as handle:
                handle.write(text)
        except OSError as exc:
            print(f"Cannot create output: {exc}", file=sys.stderr)
            return 2
    print(text, end="")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
