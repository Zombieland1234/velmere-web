> C14-P03 documentation note (2026-09-18): this is a historical stage record, not current release truth. The audited C13 source baseline is `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df` and remains `NO_GO`. See `/docs/CURRENT_STATE.md` and `/docs/CLAIM_LEDGER.md`. Historical SHAs and bounded observations below are preserved rather than rewritten.

# C10 final receipt regression qualification

Base product: C9 `80385a0bc9dbcff17c2a42e78c6dfc0f24ab407d`.
PDF receipt fix integrated at `2d85faf0258b3232e22940ec935fe6ce4d9fc4f7`.

The prior rendered PDF silently omitted an RPC block hash because the generic address privacy filter matched the first 40 hex characters. The fix permits only an exact typed public block observation with `independentlyVerified=false`. Arbitrary addresses, appended private tokens and verification claims remain rejected. Tests exercise the actual render plan, not just an in-memory report object. Reference UI copy now explicitly separates a reference profile from performed analysis.

Run all current regressions, strict application/test TypeScript, build, scanner/inventory, browser flows and the same 2472-case CGT comparison at this trigger's own SHA. Earlier green subsets must not be relabelled as final-source qualification. The whole release remains NO_GO. No production promotion, LIVE payment or customer-data modification is authorized by this file.
