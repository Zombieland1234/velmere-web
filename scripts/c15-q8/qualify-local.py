"""Qualify the frozen local Q8 scope without claiming a remote commit or release GO."""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys

BASE = '57a29cfccb9b5e3718ae89c8426e7155a0c086ee'
EXPECTED_TESTS = 965


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--historical-git-dir', type=Path)
    args = parser.parse_args()
    root, out = Path.cwd().resolve(), args.out.resolve()
    # Never replace evidence from a previous execution.
    out.mkdir(parents=True, exist_ok=False)
    files = json.loads((root / 'scripts/c15-q8/TEST_FILES.json').read_text())
    if not isinstance(files, list) or len(files) != len(set(files)) or len(files) != 57:
        raise ValueError('Expected the frozen 57-file test manifest without duplicates.')
    for filename in files:
        path = (root / filename).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError('Missing or unsafe test path: ' + str(filename))
    env = dict(os.environ, CI='1', NEXT_TELEMETRY_DISABLED='1',
               VELMERE_CANONICAL_ORIGIN='http://localhost:3000',
               VELMERE_LOOPBACK_HTTP_BROWSER_PROOF='true',
               NODE_OPTIONS='--max-old-space-size=2048', RAYON_NUM_THREADS='2')
    for name in ('GITHUB_SHA', 'C6_SOURCE_SHA', 'GIT_DIR', 'GIT_WORK_TREE'):
        env.pop(name, None)
    historical = None
    if args.historical_git_dir:
        historical = args.historical_git_dir.resolve()
        raw = subprocess.check_output(['git', '--git-dir=' + str(historical), 'show',
            '0609ef1c5aeecfab6de3ada8144efaa089064c71:app/api/audit/report/route.ts'])
        blob = hashlib.sha1(f'blob {len(raw)}\0'.encode() + raw).hexdigest()
        if blob != '158f0f6294d56925089e1baace57ba26d09aafdc':
            raise ValueError('Historical source blob mismatch.')
    checks = [
        ('worker', ['node', 'scripts/c11/build-audit-worker.mjs'], 180),
        ('regressions', ['node', 'node_modules/tsx/dist/cli.mjs', '--test',
                         '--test-reporter=tap', *files], 900),
        ('strict', ['node', 'node_modules/typescript/bin/tsc', '--noEmit',
                    '--strict', '--pretty', 'false'], 240),
    ]
    configs = sorted(root.glob('tsconfig.c*-tests.json'))
    checks += [(f'types-{cfg.stem}', ['node', 'node_modules/typescript/bin/tsc',
                '-p', str(cfg), '--pretty', 'false'], 240) for cfg in configs]
    checks += [
        ('lint', ['node', 'node_modules/eslint/bin/eslint.js', '.', '--max-warnings',
                  '0', '--format', 'json', '--output-file', str(out / 'eslint.json')], 300),
        ('build', ['npm', 'run', 'build'], 900),
    ]
    result = dict(candidateCommitSha=None, baseSha=BASE,
                  scope='LOCAL_REGISTERED_SCOPE_NOT_HOSTED_OR_STRIPE_TEST',
                  expectedRegressionCases=EXPECTED_TESTS, files=files, checks=[])
    for name, command, timeout in checks:
        child_env = env.copy()
        if name == 'regressions' and historical:
            child_env['GIT_DIR'] = str(historical)
        log = out / (name + '.log')
        started = datetime.datetime.now(datetime.timezone.utc).isoformat()
        with log.open('xb') as stream:
            try:
                process = subprocess.Popen(command, env=child_env, stdout=stream,
                    stderr=subprocess.STDOUT, start_new_session=True)
                try:
                    code = process.wait(timeout)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                    code = 124
            except OSError as error:
                stream.write(str(error).encode())
                code = 127
        text, counts = log.read_text(errors='replace'), {}
        for key in ('tests', 'pass', 'fail', 'skipped', 'cancelled', 'todo'):
            matches = re.findall(r'^# ' + key + r' (\d+)\s*$', text, re.M)
            if matches:
                counts[key] = int(matches[-1])
        row = dict(name=name, command=command, exitCode=code, counts=counts,
                   startedAt=started,
                   finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   log=log.name, logSha256=hashlib.sha256(log.read_bytes()).hexdigest())
        result['checks'].append(row)
        (out / 'RESULTS.json').write_text(json.dumps(result, indent=2))
        print(name, code, counts, flush=True)
    failures = [row['name'] for row in result['checks'] if row['exitCode'] != 0]
    regression = next(row for row in result['checks'] if row['name'] == 'regressions')
    expected = dict(tests=EXPECTED_TESTS, **{'pass': EXPECTED_TESTS}, fail=0,
                    skipped=0, cancelled=0, todo=0)
    if regression['counts'] != expected:
        failures.append('regression_registration_or_counts')
    if len(configs) != 15:
        failures.append('typescript_configuration_count')
    gate = dict(localGate='FAIL' if failures else 'PASS', failures=failures,
                releaseApproved=False,
                releaseStatus='NO_GO',
                interpretation='Only local recorded scope; no hosted/auth/payment/native-PostgreSQL/generalization approval.')
    with (out / 'GATE.json').open('x') as stream:
        json.dump(gate, stream, indent=2)
    print(json.dumps(gate), flush=True)
    return 1 if failures else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print('Qualification failed: ' + str(error), file=sys.stderr)
        sys.exit(2)
