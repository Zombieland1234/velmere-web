"""Reuse the full-application checker with C6D tests and a distinct output directory."""
from pathlib import Path
source=Path('scripts/c6c/qualify.py').read_text()
source=source.replace('/tmp/c6c-evidence','/tmp/c6d-evidence')
needle="'scripts/c6c/actual-app-regressions.test.ts'"
assert source.count(needle)==1
source=source.replace(needle,needle+",'scripts/c6d/rpc-pdf-boundaries.test.ts'")
exec(compile(source,'scripts/c6d/qualify.py','exec'))
