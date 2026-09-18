#!/usr/bin/env python3
"""C14-P29 offline release-evidence verifier.

This verifier validates evidence structure and conservative release gates.
It does not claim independent external review and it never promotes a build.
"""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
from typing import Any

def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--evidence", required=True, type=Path)
    ap.add_argument("--sql", type=Path)
    ap.add_argument("--benchmark", type=Path)
    ap.add_argument("--criteria", type=Path, default=Path(__file__).with_name("release-criteria.json"))
    ap.add_argument("--base-sha", required=True)
    ap.add_argument("--output", type=Path)
    args = ap.parse_args()

    criteria = read_json(args.criteria)
    subject = args.base_sha
    rows: list[dict[str, Any]] = []

    def gate(gate_id: str, passed: bool, detail: Any, scope: str = "AUTOMATED") -> None:
        rows.append({
            "id": gate_id,
            "result": "PASS" if passed else "FAIL",
            "scope": scope,
            "detail": detail,
        })

    gate("criteria_subject_sha", criteria.get("subjectSha") == subject,
         {"expected": subject, "criteria": criteria.get("subjectSha")})

    ev = args.evidence
    identity = read_json(ev / "SOURCE_IDENTITY.json")
    gate("source_identity_exact_sha",
         identity.get("sourceSha") == subject,
         {"sourceSha": identity.get("sourceSha"), "treeSha": identity.get("treeSha")})
    gate("original_ui2_identity",
         identity.get("originalUI2ZipIdentityConfirmed") is True,
         {"originalUI2ZipIdentityConfirmed": identity.get("originalUI2ZipIdentityConfirmed")},
         "PROVENANCE")

    manifest = read_json(ev / "EVIDENCE_MANIFEST.json")
    manifest_errors: list[str] = []
    for item in manifest.get("files", []):
        p = ev / item["path"]
        if not p.is_file():
            manifest_errors.append(f"missing:{item['path']}")
            continue
        if p.stat().st_size != item.get("bytes"):
            manifest_errors.append(f"size:{item['path']}")
        if sha256(p) != item.get("sha256"):
            manifest_errors.append(f"sha256:{item['path']}")
    gate("evidence_manifest_integrity",
         manifest.get("sourceSha") == subject and not manifest_errors,
         {"files": len(manifest.get("files", [])), "errors": manifest_errors[:20]})

    qualification = read_json(ev / "QUALIFICATION.json")
    q_fail = [r["id"] for r in qualification if r.get("result") != "PASS"]
    gate("qualification_matrix_complete",
         len(qualification) == criteria["requiredQualificationChecks"]
         and all(r.get("sourceSha") == subject for r in qualification),
         {"count": len(qualification), "required": criteria["requiredQualificationChecks"]})
    gate("qualification_all_pass",
         not q_fail,
         {"failed": q_fail})

    lock = read_json(ev / "LOCKFILE_PARITY.json")
    gate("lockfile_parity",
         lock.get("sourceSha") == subject and lock.get("unchanged") is True,
         lock)

    config = read_json(ev / "CONFIG_PREFLIGHT_MATRIX.json")
    config_rows = config.get("cases", [])
    gate("config_preflight_matrix",
         config.get("sourceSha") == subject
         and config.get("expectedCases") == criteria["requiredConfigPreflightCases"]
         and config.get("recordedCases") == criteria["requiredConfigPreflightCases"]
         and len(config_rows) == criteria["requiredConfigPreflightCases"]
         and all(r.get("passed") is True for r in config_rows),
         {"expected": config.get("expectedCases"), "recorded": config.get("recordedCases"),
          "passed": sum(1 for r in config_rows if r.get("passed") is True)})

    eslint = read_json(ev / "eslint.json")
    eslint_errors = sum(int(x.get("errorCount", 0)) for x in eslint)
    eslint_warnings = sum(int(x.get("warningCount", 0)) for x in eslint)
    gate("eslint_zero_warning",
         eslint_errors == 0 and eslint_warnings <= criteria["eslintMaxWarnings"],
         {"errors": eslint_errors, "warnings": eslint_warnings,
          "maxWarnings": criteria["eslintMaxWarnings"]})

    leaks = read_json(ev / "GITLEAKS_REDACTED.json")
    gate("gitleaks_zero_unresolved",
         len(leaks) <= criteria["gitleaksMaxUnresolvedFindings"],
         {"unresolvedFindings": len(leaks),
          "max": criteria["gitleaksMaxUnresolvedFindings"],
          "ruleCounts": {
              rule: sum(1 for x in leaks if x.get("RuleID") == rule)
              for rule in sorted({x.get("RuleID") for x in leaks})
          }})

    inventory = read_json(ev / "SOURCE_INVENTORY.json")
    missing_map = inventory.get("scriptsWithMissingReferencedFiles", {})
    missing_paths = sorted({p for paths in missing_map.values() for p in paths})
    gate("package_script_literal_path_integrity",
         len(missing_map) <= criteria["packageScriptsWithMissingLiteralPathsMax"],
         {"scriptsWithMissingPaths": len(missing_map),
          "uniqueMissingPaths": len(missing_paths),
          "max": criteria["packageScriptsWithMissingLiteralPathsMax"]})

    additional = read_json(ev / "ADDITIONAL_CHECKS.json")
    required_additional = {
        "product-manifest", "scanner-setup", "sbom",
        "built-worker-file-traces", "actual-built-browser-observations",
        "production-mode-runtime-e2e",
    }
    add_by_id = {r["id"]: r for r in additional}
    bad_additional = [
        name for name in sorted(required_additional)
        if name not in add_by_id or add_by_id[name].get("exitCode") != 0
    ]
    gate("required_additional_checks",
         not bad_additional,
         {"required": sorted(required_additional), "failedOrMissing": bad_additional})

    prod = read_json(ev / "production-e2e" / "RESULTS.json")
    prod_rows = prod.get("rows", [])
    gate("selfhosted_production_mode_e2e",
         prod.get("sourceSha") == subject
         and len(prod_rows) == criteria["requiredProductionE2ECases"]
         and all(r.get("result") == "PASS" for r in prod_rows),
         {"scope": prod.get("scope"), "count": len(prod_rows),
          "passed": sum(1 for r in prod_rows if r.get("result") == "PASS")})
    gate("hosted_vercel_product_e2e",
         False,
         {"reason": "Self-hosted production-mode evidence explicitly says NOT_VERCEL_OR_STRIPE."},
         "MANUAL_REQUIRED")

    if args.sql:
        checks = read_json(args.sql / "CHECKS.json")
        sql_rows = checks.get("checks", [])
        gate("shield_database_fixture",
             checks.get("sourceSha") == subject
             and len(sql_rows) == criteria["requiredShieldDatabaseChecks"]
             and all(r.get("result") == "PASS" for r in sql_rows),
             {"scope": checks.get("scope"), "count": len(sql_rows),
              "passed": sum(1 for r in sql_rows if r.get("result") == "PASS")})
    else:
        gate("shield_database_fixture", False, {"reason": "SQL evidence directory not supplied"})

    if args.benchmark:
        comparison = read_json(args.benchmark / "COMPARISON.json")
        candidate = comparison.get("candidate", {})
        totals = candidate.get("totalAssessmentPairs", {})
        tp = int(totals.get("tp", 0)); fp = int(totals.get("fp", 0))
        fn = int(totals.get("fn", 0)); tn = int(totals.get("tn", 0))
        precision = tp / (tp + fp) if tp + fp else None
        recall = tp / (tp + fn) if tp + fn else None
        specificity = tn / (tn + fp) if tn + fp else None
        completed_ok = (
            candidate.get("sourceSha") == subject
            and candidate.get("completed") == comparison.get("uniqueCases")
            and candidate.get("timeouts") == 0
            and candidate.get("errors") == 0
        )
        gate("benchmark_execution_integrity", completed_ok, {
            "uniqueCases": comparison.get("uniqueCases"),
            "completed": candidate.get("completed"),
            "timeouts": candidate.get("timeouts"),
            "errors": candidate.get("errors"),
            "precision": precision,
            "recall": recall,
            "specificity": specificity,
        })
        stability = comparison.get("stabilitySubset", {})
        gate("benchmark_stability_subset",
             criteria["benchmark"]["requireStableSubset"] is False
             or stability.get("unstable") == [],
             stability)
        novel = (
            comparison.get("allCasesPreviouslyObservedInC9") is False
            and int(comparison.get("newUniqueCases", 0)) > 0
        )
        gate("benchmark_novel_holdout",
             (not criteria["benchmark"]["requireNovelHoldout"]) or novel,
             {"allCasesPreviouslyObservedInC9": comparison.get("allCasesPreviouslyObservedInC9"),
              "newUniqueCases": comparison.get("newUniqueCases")})
        gate("benchmark_independent_ground_truth_or_external_review",
             False,
             {"reason": "Current package does not establish independently audited ground truth or external review."},
             "MANUAL_REQUIRED")
    else:
        gate("benchmark_execution_integrity", False, {"reason": "Benchmark evidence directory not supplied"})
        gate("benchmark_stability_subset", False, {"reason": "Benchmark evidence directory not supplied"})
        gate("benchmark_novel_holdout", False, {"reason": "Benchmark evidence directory not supplied"})
        gate("benchmark_independent_ground_truth_or_external_review", False,
             {"reason": "Benchmark evidence directory not supplied"}, "MANUAL_REQUIRED")

    # These gates deliberately stay red until evidence outside this internal validator exists.
    for manual in criteria["manualReleaseGates"]:
        gate(manual, False, {
            "reason": "No independently sufficient evidence supplied to C14-P29. "
                      "This internal validator cannot self-attest this gate."
        }, "MANUAL_OR_EXTERNAL_REQUIRED")

    failed = [r["id"] for r in rows if r["result"] != "PASS"]
    verdict = {
        "schema": "velmere.c14-p29.release-validation.v1",
        "subjectSha": subject,
        "decision": "NO_GO" if failed else "GO",
        "externalAuditClaimed": False,
        "policy": criteria["policy"],
        "passCount": sum(1 for r in rows if r["result"] == "PASS"),
        "failCount": len(failed),
        "failedGates": failed,
        "gates": rows,
    }
    text = json.dumps(verdict, indent=2, sort_keys=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8")
    print(text, end="")
    return 1 if failed else 0

if __name__ == "__main__":
    raise SystemExit(main())
