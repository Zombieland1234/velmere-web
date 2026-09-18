"""Exact-byte internal review of raw Gitleaks hits. Never claims history/env clean."""
from pathlib import Path
import argparse, hashlib, json, sys


def triage(root: Path, policy: dict, hits: list, scanner_exit: int, scanner_version: str) -> dict:
    errors = []
    if scanner_exit not in (0, 1):
        errors.append('SCANNER_EXECUTION_FAILED')
    if scanner_version.strip() != policy.get('scannerVersion'):
        errors.append('SCANNER_VERSION_MISMATCH')
    if not isinstance(hits, list) or not isinstance(policy.get('entries'), list):
        return {'passed': False, 'errors': errors + ['INVALID_REPORT_OR_POLICY_SHAPE']}
    fields = ('path', 'ruleId', 'startLine', 'endLine', 'startColumn', 'endColumn')
    key = lambda e: tuple(e.get(f) for f in fields)
    approved = {key(e): e for e in policy['entries']}
    if len(approved) != len(policy['entries']):
        errors.append('DUPLICATE_POLICY_ENTRY')
    observed = set()
    root = root.resolve()
    for hit in hits:
        if not isinstance(hit, dict):
            errors.append('INVALID_HIT'); continue
        source_path = Path(str(hit.get('File', '')))
        source_path = source_path if source_path.is_absolute() else root / source_path
        try:
            rel = source_path.resolve().relative_to(root)
        except ValueError:
            errors.append('HIT_OUTSIDE_SCANNED_ROOT'); continue
        record = dict(path=rel.as_posix(), ruleId=hit.get('RuleID'), startLine=hit.get('StartLine'),
                      endLine=hit.get('EndLine'), startColumn=hit.get('StartColumn'), endColumn=hit.get('EndColumn'))
        identity = key(record)
        if identity in observed:
            errors.append('DUPLICATE_SCANNER_HIT')
        observed.add(identity)
        entry = approved.get(identity)
        if entry is None:
            errors.append('UNREVIEWED_FINDING'); continue
        if hit.get('Secret') != 'REDACTED':
            errors.append('UNREDACTED_SECRET_FIELD')
        if not source_path.is_file() or source_path.is_symlink():
            errors.append('SOURCE_NOT_REGULAR_FILE'); continue
        if hashlib.sha256(source_path.read_bytes()).hexdigest() != entry.get('fileSha256'):
            errors.append('REVIEWED_FILE_BYTES_CHANGED')
        if not entry.get('reason'):
            errors.append('REVIEW_REASON_MISSING')
    if observed != set(approved):
        errors.append('SCANNER_POLICY_COVERAGE_MISMATCH')
    if bool(hits) != (scanner_exit == 1):
        errors.append('SCANNER_EXIT_REPORT_MISMATCH')
    return {'passed': not errors, 'rawFindings': len(hits), 'reviewedEntries': len(approved),
            'errors': errors, 'reviewType': policy.get('reviewType'), 'scope': policy.get('scope'),
            'rawScannerResult': 'FINDINGS' if hits else 'NO_FINDINGS',
            'historyVerified': False, 'environmentVerified': False, 'independentReview': False}


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('root', type=Path); ap.add_argument('policy', type=Path); ap.add_argument('report', type=Path)
    ap.add_argument('--scanner-exit', required=True, type=int); ap.add_argument('--scanner-version', required=True)
    args = ap.parse_args()
    try:
        result = triage(args.root, json.loads(args.policy.read_text()), json.loads(args.report.read_text()), args.scanner_exit, args.scanner_version)
    except (OSError, ValueError, TypeError, KeyError):
        result = {'passed': False, 'errors': ['TRIAGE_INPUT_OR_EXECUTION_ERROR']}
    print(json.dumps(result, indent=2))
    sys.exit(0 if result['passed'] else 1)
