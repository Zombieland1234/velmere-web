#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import io
import json
from pathlib import Path
import unittest
import warnings
import zipfile

MODULE_PATH = Path(__file__).with_name("source_provenance_check.py")
SPEC = importlib.util.spec_from_file_location("source_provenance_check", MODULE_PATH)
assert SPEC and SPEC.loader
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)


class ProvenanceHelperTests(unittest.TestCase):
    def test_canonical_aggregate_is_order_stable(self) -> None:
        records = {
            "b.txt": {"bytes": 1, "sha256": checker.sha256_bytes(b"b")},
            "a.txt": {"bytes": 1, "sha256": checker.sha256_bytes(b"a")},
        }
        self.assertEqual(
            checker.canonical_aggregate(records),
            "0ed6dc03fecee0dbc5608651eeb3f2ddb9b1150fdaf90ab2477b11a983d582b6",
        )

    def test_parse_ls_tree(self) -> None:
        raw = (
            b"100644 blob 0123456789012345678901234567890123456789 3\talpha.txt\0"
            b"100644 blob 1111111111111111111111111111111111111111 4\tdir/beta.txt\0"
        )
        rows = checker.parse_ls_tree(raw)
        self.assertEqual(rows[0]["path"], "alpha.txt")
        self.assertEqual(rows[0]["bytes"], 3)
        self.assertEqual(rows[1]["path"], "dir/beta.txt")

    def test_zip_traversal_is_rejected(self) -> None:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("../escape.txt", b"x")
        buf.seek(0)
        with zipfile.ZipFile(buf) as zf:
            with self.assertRaises(checker.CheckError):
                checker.safe_zip_names(zf)

    def test_duplicate_zip_name_is_rejected(self) -> None:
        buf = io.BytesIO()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with zipfile.ZipFile(buf, "w") as zf:
                zf.writestr("dup.txt", b"a")
                zf.writestr("dup.txt", b"b")
        buf.seek(0)
        with zipfile.ZipFile(buf) as zf:
            with self.assertRaises(checker.CheckError):
                checker.safe_zip_names(zf)

    def test_lock_never_promotes_ui2_identity(self) -> None:
        lock = json.loads(
            Path(__file__).with_name("source-provenance-lock.json").read_text()
        )
        self.assertEqual(
            lock["ui2"]["identityStatus"],
            "NOT_IDENTICAL_AND_NO_GIT_ANCESTRY_PROVEN",
        )
        self.assertNotEqual(
            lock["ui2"]["c13Comparison"]["byteIdenticalOverlaps"],
            lock["ui2"]["c13Comparison"]["c13TrackedFiles"],
        )
        self.assertEqual(
            lock["chain"][-1]["sourceSha"],
            lock["anchor"]["sourceSha"],
        )
        self.assertEqual(
            lock["chain"][-1]["treeSha"],
            lock["anchor"]["treeSha"],
        )


if __name__ == "__main__":
    unittest.main()
