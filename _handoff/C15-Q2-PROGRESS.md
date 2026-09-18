# C15-Q2 — exact-source CI qualification

Internal integration and release qualification, not an external independent audit. NO_GO until all existing release criteria have evidence.

Base: e718df06d20a8129ffe261eef9c6c74cc5c91729 (C14B). Imported reviewed local Q1 source tree: df345f6309ec1e915b1c3b3f46f8e041152542cf. The initial integration commit is 994987a7f2a64d711fe56215c61b0abb7e7500e8. Exact Git tree parity was checked before adding this CI wiring.

The two existing qualification workflows now also run on c15/qualification-q2-20260918. No main/C13/C14 ref is changed and no production deployment is promoted. Core installation, strict configurations, build, accepted regressions, frozen seen-corpus comparison, isolated Redis/Basic runtime, isolated PostgreSQL/restore and secret checks retain their criteria. Artifacts retain historical c14 names; sourceSha, runId and branch identify the actual new run. No results are claimed before reading the completed exact-SHA artifacts.

Engine remains Velmère-V2.5.2 from Q1. The corpus uses pinned gsalzer/cgt f8cd72cf7fbbfebc809c454667eee271706a4b2b and default baseline e718; it is offline static analysis, not execution of corpus contracts or a blind holdout. GENERALIZATION UNVERIFIED. Third-party sources/runtime inputs and embedded fonts are not redistributed in the handoff.

The prior local Q1 evidence, failed attempts and private provider correspondence remain in the owner's delivery archive; private correspondence is not published here. Auth/Stripe TEST lifecycle, hosted paid E2E, global provider rights, full privacy/erasure and managed production disaster recovery remain open. No real payments, customer mutations, provider messages or purchases are authorized by this CI wiring.
