from pathlib import Path
source=Path('scripts/c6c/qualify.py').read_text().replace('/tmp/c6c-evidence','/tmp/c6e-evidence')
needle="'scripts/c6c/actual-app-regressions.test.ts'"
assert source.count(needle)==1
source=source.replace(needle,needle+",'scripts/c6d/rpc-pdf-boundaries.test.ts','scripts/c6e/pdf-evidence-boundary.test.ts'")
exec(compile(source,'scripts/c6e/qualify.py','exec'))
