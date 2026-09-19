"""Synthetic verifier tests. These are NOT Velmere product regression tests."""
from __future__ import annotations
import argparse
import copy
import io
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import zipfile

import verify_handoff as guard


def encode_json(value):
    return (json.dumps(value, sort_keys=True) + "\n").encode()


def archive_bytes(files):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path, data in files.items():
            archive.writestr(path, data)
    return output.getvalue()


def file_entry(path, data, source=False):
    result = {"path": path, "bytes": len(data), "sha256": guard.digest(data)}
    if source:
        result.update(mode="100644", blobSha=guard.git_object_sha("blob", data))
    return result


class HandoffTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = {
            "app.ts": b"export const fixture = true;\n",
            "scripts/release/a.test.ts": b"// Synthetic registry fixture A; never executed.\n",
            "scripts/release/b.test.ts": b"// Synthetic registry fixture B; never executed.\n",
        }
        self.test_names = list(self.source)[1:]
        entries = [file_entry(path, data, True) for path, data in self.source.items()]
        self.manifest = {"sourceSha": "1" * 40, "treeSha": guard.git_tree(entries),
                         "runId": "123", "branch": "fixture-only", "files": entries, "omitted": []}
        self.tap = (b"TAP version 13\nok 1 - fixture A\nok 2 - fixture B\n1..2\n"
                    b"# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n")
        counts = dict(tests=2, pass_=2, fail=0, cancelled=0, skipped=0, todo=0)
        counts["pass"] = counts.pop("pass_")
        self.qualification = [
            {"id": "combined-regressions", "sourceSha": "1" * 40, "exitCode": 0,
             "command": ["tsx", "--test", "--test-reporter=tap", *self.test_names],
             "counts": counts, "log": "combined-regressions.log", "logSha256": guard.digest(self.tap)},
            {"id": "eslint-zero-warning", "sourceSha": "1" * 40, "exitCode": 1,
             "command": ["eslint", "--max-warnings=0"], "log": "lint.log", "logSha256": guard.digest(b"warning\n")},
        ]
        self.core = {
            "IDENTITY.json": encode_json({"sourceSha": "1" * 40, "tree": self.manifest["treeSha"],
                                          "runId": "123", "branch": "fixture-only", "attempt": "1"}),
            "QUALIFICATION.json": encode_json(self.qualification),
            "TEST_FILES.json": encode_json({"baseFiles": self.test_names[:1], "newFiles": self.test_names[1:],
                                            "uniqueFiles": self.test_names}),
            "CORE_GATE.json": encode_json({"sourceSha": "1" * 40, "status": "NO_GO", "failedChecks": ["eslint-zero-warning"]}),
            "combined-regressions.log": self.tap, "lint.log": b"warning\n",
        }
        self.args = argparse.Namespace(
            source_artifact=self.root/"source.zip", core_artifact=self.root/"core.zip",
            expected_source_sha="1" * 40, expected_tree_sha=self.manifest["treeSha"],
            expected_test_count=2, expected_test_files=2, expected_source_files=3,
        )

    def change_core(self, name, change):
        value = json.loads(self.core[name]); change(value); self.core[name] = encode_json(value)

    def write(self, extra_core=None):
        inner = archive_bytes(self.source)
        self.manifest["sourceArchiveSha256"] = guard.digest(inner)
        source = archive_bytes({"SOURCE.zip": inner, "SOURCE_MANIFEST.json": encode_json(self.manifest)})
        core_files = dict(self.core)
        core_files["EVIDENCE_MANIFEST.json"] = encode_json([file_entry(path, data) for path, data in self.core.items()])
        if extra_core:
            core_files.update(extra_core)
        core = archive_bytes(core_files)
        self.args.source_artifact.write_bytes(source); self.args.core_artifact.write_bytes(core)
        self.args.source_artifact_sha256 = guard.digest(source); self.args.core_artifact_sha256 = guard.digest(core)

    def refuses(self, message, *, write=True):
        if write:
            self.write()
        with self.assertRaisesRegex(guard.Refusal, message):
            guard.verify(self.args)

    def test_matching_export_is_not_release_approval(self):
        self.write(); result = guard.verify(self.args)
        self.assertEqual(result["identityStatus"], "VERIFIED_EXPORTED_CONTENT")
        self.assertFalse(result["releaseApproved"])
        self.assertEqual(result["releaseStatus"], "NO_GO")
        self.assertEqual(result["qualificationFailures"], ["eslint-zero-warning"])

    def test_omissions_are_explicit_and_never_counted_as_verified_bytes(self):
        entry = file_entry("unavailable/resource.txt", b"declared but not supplied", True)
        entry["reason"] = "NOT_SUPPLIED"
        self.manifest["omitted"] = [entry]
        self.manifest["treeSha"] = guard.git_tree(self.manifest["files"] + [entry])
        self.args.expected_tree_sha = self.manifest["treeSha"]
        self.change_core("IDENTITY.json", lambda d: d.update(tree=self.manifest["treeSha"]))
        self.write(); result = guard.verify(self.args)
        self.assertFalse(result["standaloneSourceComplete"])
        self.assertEqual(result["verifiedSourceFiles"], 3)
        self.assertEqual(len(result["omittedFilesNotByteVerified"]), 1)

    def test_same_label_different_tree_refused(self):
        self.args.expected_tree_sha = "f" * 40
        self.refuses("Expected candidate tree")

    def test_different_expected_commit_refused(self):
        self.args.expected_source_sha = "f" * 40
        self.refuses("Expected source commit")

    def test_different_expected_regression_count_refused(self):
        self.args.expected_test_count = 1095
        self.refuses("Expected regression count")

    def test_different_expected_source_count_refused(self):
        self.args.expected_source_files = 4098
        self.refuses("Expected source file count")

    def test_different_expected_test_file_count_refused(self):
        self.args.expected_test_files = 63
        self.refuses("Expected test file count")

    def test_untrusted_artifact_digest_refused(self):
        self.write(); self.args.core_artifact_sha256 = "0" * 64
        self.refuses("Artifact digest mismatch", write=False)

    def test_changed_source_bytes_refused(self):
        self.source["app.ts"] = b"export const fixture = nope;\n"
        self.refuses("Size mismatch|Content mismatch")

    def test_false_blob_hash_refused(self):
        self.manifest["files"][0]["blobSha"] = "e" * 40
        self.refuses("Git blob mismatch")

    def test_unlisted_source_file_refused(self):
        self.source["unlisted.txt"] = b"extra"
        self.refuses("Unmanifested source")

    def test_missing_source_file_refused(self):
        del self.source["app.ts"]
        self.refuses("Missing member")

    def test_false_declared_tree_refused(self):
        self.manifest["treeSha"] = "b" * 40
        self.refuses("Reconstructed tree")

    def test_omitted_present_overlap_refused(self):
        entry = copy.deepcopy(self.manifest["files"][0]); entry["reason"] = "NOT_SUPPLIED"
        self.manifest["omitted"] = [entry]
        self.refuses("Omitted path is also present")

    def test_duplicate_manifest_entry_refused(self):
        self.manifest["files"].append(copy.deepcopy(self.manifest["files"][0]))
        self.refuses("Duplicate manifest")

    def test_core_from_other_source_refused(self):
        self.change_core("IDENTITY.json", lambda d: d.update(sourceSha="a" * 40))
        self.refuses("CI identity/source mismatch")

    def test_core_from_other_run_refused(self):
        self.change_core("IDENTITY.json", lambda d: d.update(runId="456"))
        self.refuses("CI runId mismatch")

    def test_stale_qualification_row_refused(self):
        self.change_core("QUALIFICATION.json", lambda d: d[0].update(sourceSha="a" * 40))
        self.refuses("Stale qualification record")

    def test_duplicate_qualification_row_refused(self):
        self.change_core("QUALIFICATION.json", lambda d: d.append(copy.deepcopy(d[0])))
        self.refuses("Duplicate/invalid qualification record")

    def test_tampered_log_refused(self):
        self.core["combined-regressions.log"] += b"modified"
        self.refuses("Qualification log mismatch")

    def test_reported_counts_must_match_tap(self):
        self.change_core("QUALIFICATION.json", lambda d: d[0]["counts"].update(tests=1095))
        self.refuses("Recorded counts do not match TAP")

    def test_repeated_tap_summaries_are_not_added(self):
        self.core["combined-regressions.log"] = self.tap + self.tap
        self.change_core("QUALIFICATION.json", lambda d: d[0].update(logSha256=guard.digest(self.tap + self.tap)))
        self.refuses("Missing or repeated top-level TAP count")

    def test_skipped_tap_case_is_refused(self):
        log = self.tap.replace(b"# skipped 0", b"# skipped 1")
        self.core["combined-regressions.log"] = log
        self.change_core("QUALIFICATION.json", lambda d: d[0].update(logSha256=guard.digest(log)))
        self.refuses("failures/skips/cancellations/todos")

    def test_tap_summary_without_results_is_refused(self):
        log = self.tap.replace(b"ok 2 - fixture B\n", b"")
        self.core["combined-regressions.log"] = log
        self.change_core("QUALIFICATION.json", lambda d: d[0].update(logSha256=guard.digest(log)))
        self.refuses("top-level results/count mismatch")

    def test_duplicate_test_registry_refused(self):
        self.change_core("TEST_FILES.json", lambda d: d["uniqueFiles"].append(self.test_names[0]))
        self.refuses("Duplicated test files")

    def test_registered_but_not_executed_test_refused(self):
        self.change_core("QUALIFICATION.json", lambda d: d[0]["command"].pop())
        self.refuses("Executed and registered test files differ")

    def test_failed_regression_command_refused(self):
        self.change_core("QUALIFICATION.json", lambda d: d[0].update(exitCode=1))
        self.refuses("Combined-regressions command failed")

    def test_summary_cannot_hide_failed_checks(self):
        self.change_core("CORE_GATE.json", lambda d: d.update(failedChecks=[]))
        self.refuses("failure summary differs")

    def test_go_with_failed_checks_is_refused(self):
        self.change_core("CORE_GATE.json", lambda d: d.update(status="GO"))
        self.refuses("claims GO despite failures")

    def test_unmanifested_evidence_is_refused(self):
        self.write({"unknown.log": b"not in inventory"})
        self.refuses("Unmanifested evidence", write=False)

    def test_missing_artifact_is_refused(self):
        self.write(); self.args.source_artifact.unlink()
        self.refuses("Missing artifact", write=False)

    def test_boolean_count_is_not_an_integer(self):
        self.manifest["files"][0]["bytes"] = True
        self.refuses("Invalid manifest byte count")

    def test_paths_are_not_normalized_into_different_files(self):
        for path in ("../escape", "/absolute", "a//b", "a/./b", "a/../b", "C:\\x", "a\x00b"):
            with self.subTest(path=path), self.assertRaises(guard.Refusal):
                guard.relative_path(path)

    def test_duplicate_zip_entries_are_refused(self):
        data = io.BytesIO()
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with zipfile.ZipFile(data, "w") as z:
                z.writestr("a", b"one"); z.writestr("a", b"two")
        with self.assertRaisesRegex(guard.Refusal, "Duplicate ZIP member"):
            guard.Archive(data.getvalue(), "duplicate fixture")

    def test_duplicate_json_keys_are_refused(self):
        with self.assertRaisesRegex(guard.Refusal, "Duplicate JSON key"):
            guard.json_bytes(b'{"value":1,"value":2}', "fixture")

    @unittest.skipUnless(shutil.which("git"), "Git needed for independent tree cross-check")
    def test_tree_matches_real_git_including_directory_sorting(self):
        repo = self.root/"git-fixture"; repo.mkdir()
        contents = {"a.c": b"one", "a/b": b"two", "a0": b"three", "z/zażółć.txt": b"unicode-name"}
        subprocess.run(["git", "init", "-q", str(repo)], check=True, capture_output=True)
        for name, data in contents.items():
            path = repo/name; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
        subprocess.run(["git", "-c", "core.autocrlf=false", "add", "--all"], cwd=repo, check=True, capture_output=True)
        actual = subprocess.run(["git", "write-tree"], cwd=repo, check=True, capture_output=True, text=True).stdout.strip()
        entries = [file_entry(path, data, True) for path, data in contents.items()]
        self.assertEqual(guard.git_tree(entries), actual)


if __name__ == "__main__":
    unittest.main(verbosity=2)
