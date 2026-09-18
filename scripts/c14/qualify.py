"""C14-P25 isolated resilience qualification. Never targets production services."""
from pathlib import Path
import subprocess, json, datetime, hashlib, os, sys

out = Path("/tmp/c14-p25-evidence")
out.mkdir(parents=True, exist_ok=True)
sha = os.environ.get("GITHUB_SHA", "local-uncommitted")
checks = [
    ("clean-install", ["npm", "ci", "--ignore-scripts", "--no-fund"], 600),
    ("c14-test-typescript", ["node_modules/.bin/tsc", "-p", "tsconfig.c14-tests.json", "--pretty", "false"], 480),
    ("c14-identity-window-resilience", ["node_modules/.bin/tsx", "--test", "scripts/c14/identity-window-resilience.test.ts"], 180),
    ("c14-durable-job-resilience", ["node_modules/.bin/tsx", "--test", "scripts/c14/durable-job-resilience.test.ts"], 240),
    ("c14-private-redis-resilience", ["node_modules/.bin/tsx", "--test", "scripts/c14/redis-resilience.test.ts"], 240),
    ("c12-private-redis-regression", ["bash", "scripts/c12/redis-tests.sh"], 240),
    ("strict-typescript", ["node_modules/.bin/tsc", "--noEmit", "--strict", "--pretty", "false"], 600),
    ("c14-eslint", ["node_modules/.bin/eslint",
      "lib/security/redis-fixed-window.ts",
      "lib/security/native-redis-rate-limit.ts",
      "lib/security/durable-rate-limit.ts",
      "lib/jobs/durable-computation-replay.ts",
      "lib/jobs/durable-computation-worker.ts",
      "scripts/c14", "--max-warnings", "0"], 300),
]
rows = []
for name, command, timeout in checks:
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log = out / f"{name}.log"
    with log.open("wb") as stream:
        try:
            code = subprocess.run(command, stdout=stream, stderr=subprocess.STDOUT, timeout=timeout, check=False).returncode
        except subprocess.TimeoutExpired:
            code = 124
        except OSError as error:
            stream.write(str(error).encode())
            code = 127
    rows.append({
        "id": name,
        "sourceSha": sha,
        "startedAt": started,
        "finishedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "command": command,
        "exitCode": code,
        "result": "PASS" if code == 0 else "TIMEOUT" if code == 124 else "FAIL",
        "scope": "PRIVATE_EPHEMERAL_REDIS_AND_SYNTHETIC_DEPENDENCY_INJECTION_NO_PRODUCTION_TRAFFIC",
        "log": log.name,
        "logSha256": hashlib.sha256(log.read_bytes()).hexdigest(),
    })
    (out / "QUALIFICATION.json").write_text(json.dumps(rows, indent=2))
    print(name, code, flush=True)

manifest = []
for path in sorted(out.glob("*")):
    if path.is_file() and path.name != "EVIDENCE_MANIFEST.json":
        manifest.append({"path": path.name, "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
(out / "EVIDENCE_MANIFEST.json").write_text(json.dumps({
    "schemaVersion": "velmere.c14-p25.resilience-evidence.v1",
    "sourceSha": sha,
    "recordedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "productionTrafficGenerated": False,
    "files": manifest,
}, indent=2))
if any(row["exitCode"] != 0 for row in rows):
    sys.exit(1)
