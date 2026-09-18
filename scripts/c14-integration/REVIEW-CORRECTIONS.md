# Integration corrections

P28 raw-PUSH4-to-dispatcher narrowing is REJECTED. It removed observations used by oracle detectors and failed 12 unchanged C13 regressions. Nearby EQ/JUMPI does not prove calldata-dispatch semantics. The two selector assertions from the candidate are not admitted; their source and failed integration logs remain in the delivery evidence. Existing C13 CFG behavior is restored, and a preservation test is added. SWC-104 immediate-discard and taxonomy corrections are reviewed separately.

P18 scope checks are accepted with independent node:test coverage rather than counting assertions from a standalone script. Local reproduction reached the cross-surface assertion before the patch and passed after it. Original candidate test typing also needed correction; it is preserved in the candidate evidence, not treated as green expanded TypeScript.

P16 is admitted only as an isolated synthetic recovery drill. A new explicit localhost/disposable-cluster interlock prevents accidental invocation against a configured service database. It does not implement production backup or prove service RPO/RTO.

No canonical C13 test file, strict setting, or release criterion is weakened.
