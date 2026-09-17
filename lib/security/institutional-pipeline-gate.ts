/**

VELMÈRE — Unified Institutional Audit Pipeline




Architecture:




SmartContractAnalyzer




     |




     v

Canonical findings




     |




     +-------> Z3 Formal Verification




     |                 |




     |                 v




     |          Formal claim results




     |                 |




     +-----------> Evidence leaves




                       |




                       v




                 Merkle bundle




                       |




                       v




               Two-dimensional score




                       |




                       v




               PDF / report builder




Security invariants:




UNKNOWN is never PASS.




NOT_RUN is never PASS.




solver absence cannot create formal proof.




AST findings are never silently converted to formal proof.




all institutional evidence is content-addressed.




Merkle root is deterministic.




scoring is performed only after evidence normalization.
*/

import {
createHash,
timingSafeEqual,
} from "node:crypto";

/* -------------------------------------------------------------------------- /
/ TYPES /
/ -------------------------------------------------------------------------- */

export type AuditTier = "BASIC" | "PRO" | "ADVANCED";

export type ChainId = number;

export type FindingSeverity =
| "INFO"
| "LOW"
| "MEDIUM"
| "HIGH"
| "CRITICAL";

export type FormalStatus =
| "PROVED"
| "FALSIFIED"
| "UNKNOWN"
| "NOT_RUN"
| "ERROR";

export type EvidenceKind =
| "AST_FINDING"
| "BYTECODE"
| "SOURCE"
| "ABI"
| "TRANSACTION_TRACE"
| "FORMAL_PROOF"
| "FORMAL_COUNTEREXAMPLE"
| "SCORING"
| "SYSTEM_METADATA";

export type RiskClass =
| "INFORMATIONAL"
| "LOW"
| "MEDIUM"
| "HIGH"
| "CRITICAL"
| "UNDETERMINED";

/**

AST output MUST be factual.




A finding says:

"The detector found X."




It does NOT say:

"The invariant is mathematically proven."
*/
export interface AstFinding {
id: string;
detectorId: string;
title: string;
description: string;
severity: FindingSeverity;
contractAddress: string;
chainId: ChainId;
sourceLocation?: {
file?: string;
line?: number;
column?: number;
};
evidenceRefs: string[];
confidence: number; // [0,1]
}

/**

Result of the formal engine.




Important:

solverAvailable MUST be true for PROVED / FALSIFIED.
*/
export interface FormalVerificationResult {
invariantId: string;
status: FormalStatus;
solverName: string;
solverVersion: string;
solverAvailable: boolean;
durationMs: number;

/**

Canonical SMT input hash.
*/
inputSha256: string;

/**

Canonical result/model hash.
*/
outputSha256: string;

/**

For PROVED, optional proof metadata.

For FALSIFIED, must contain counterexample metadata.
*/
proofCertificate?: {
kind: "UNSAT_CERTIFICATE" | "SAT_MODEL";
model?: Record<string, string | number | boolean>;
theoremHash?: string;
};

  proofType?: "BOUNDED_MODEL_PROOF" | "INDUCTIVE_PROOF" | "SAT_COUNTEREXAMPLE" | "UNKNOWN" | "TIMEOUT" | "NOT_MODELED";
  modelBound?: number;
  bound?: {
    transitionDepth: number;
    maxLoopUnroll?: number;
  };
  property?: {
    id: string;
    name: string;
    logic: string;
  };
  model?: {
    version: string;
    engine: string;
  };
  assumptions?: string[];
  excludedBehaviors?: string[];
  formalCoverage?: {
    functionsAnalyzed: number;
    stateVariablesAnalyzed: number;
    cfgEdgesAnalyzed: number;
  };
  disclaimer?: string;
  scope?: string;

  diagnostics: string[];
}

export interface ContractIdentity {
address: string;
chainId: ChainId;
network: string;
bytecodeSha256: string;
blockNumber?: number;
blockHash?: string;
sourceVerified: boolean;
isProxy: boolean;
implementationAddress?: string;
implementationSha256?: string;
analysisVersion?: string;
}

export interface CanonicalEvidence {
evidenceId: string;
kind: EvidenceKind;
type: string;
title: string;
payload: unknown;
source: string;
timestamp: string;
sha256: string;
}

export interface MerkleLeaf {
evidenceId: string;
canonicalBytesHex: string;
leafHash: string;
}

export interface EvidenceBundle {
schemaVersion: "VELMERE-EVIDENCE-BUNDLE-V1";
bundleId: string;
createdAt: string;
contract: ContractIdentity;
tier: AuditTier;

sortingRule: "UTF8_BYTEWISE_ASCENDING_V1";
hashAlgorithm: "SHA-256";

leaves: MerkleLeaf[];
merkleRoot: string;

formalSummary: {
proved: number;
falsified: number;
unknown: number;
notRun: number;
errors: number;
solverAvailable: boolean;
};

integrity: {
verified: boolean;
};
}

export interface CvssScore {
version: "3.1";
vector: string;
baseScore: number;
}

export type DASPClass =
| "ACCESS_CONTROL"
| "ARITHMETIC"
| "MANIPULATION"
| "RISKY_ORACLES"
| "REENTRANCY"
| "UNEXPECTED_FUNCTIONALITY"
| "DENIAL_OF_SERVICE"
| "OTHER";

export interface SecurityScore {
securityScore: number; // 0..100
auditConfidence: number; // 0..100
}

export interface FindingRisk {
findingId: string;
severity: FindingSeverity;
cvss?: CvssScore;
dasp?: DASPClass;
}

export interface ScoreResult {
score: SecurityScore;
classification: RiskClass;
findingRisks: FindingRisk[];
}

export interface PdfLayoutMetrics {
pageCount: number;
overflow: boolean;
pages: Array<{
page: number;
contentHeightPt: number;
budgetHeightPt: number;
remainingHeightPt: number;
}>;
}

export interface GeneratedReport {
pdfBytes: Uint8Array;
sha256: string;
layout: PdfLayoutMetrics;
}

export interface AuditOutput {
identity: ContractIdentity;
findings: AstFinding[];
formalResults: FormalVerificationResult[];
evidenceBundle: EvidenceBundle;
score: ScoreResult;
report: GeneratedReport;
}

/* -------------------------------------------------------------------------- /
/ ADAPTER API /
/ -------------------------------------------------------------------------- */

export interface SmartContractAnalyzerAdapter {
analyze(input: {
address: string;
chainId: ChainId;
tier: AuditTier;
}): Promise<{
identity: ContractIdentity;
findings: AstFinding[];

/**
 * Raw factual evidence supplied by the analyzer.
 * Never pre-label this as "verified".
 */
evidence: CanonicalEvidence[];

}>;
}

export interface FormalEngineAdapter {
/**

Runs formal verification for an explicitly named invariant.
*/
verify(input: {
invariantId: string;
contract: ContractIdentity;
findings: AstFinding[];
}): Promise<FormalVerificationResult>;
}

export interface TwoDimensionalScorerAdapter {
score(input: {
tier: AuditTier;
findings: AstFinding[];
formalResults: FormalVerificationResult[];
evidenceBundle: EvidenceBundle;
}): Promise<ScoreResult>;
}

export interface TierReportBuilderAdapter {
build(input: {
tier: AuditTier;
contract: ContractIdentity;
findings: AstFinding[];
formalResults: FormalVerificationResult[];
evidenceBundle: EvidenceBundle;
score: ScoreResult;
}): Promise<GeneratedReport>;
}

/* -------------------------------------------------------------------------- /
/ CANONICAL SERIALIZATION /
/ -------------------------------------------------------------------------- */

/**

Recursive canonical JSON:




object keys sorted lexicographically




array order preserved




no whitespace




The canonical bytes are then encoded UTF-8 and hashed.
*/
export function canonicalize(value: unknown): string {
if (value === null || value === undefined) {
return "null";
}

if (typeof value === "string") {
return JSON.stringify(value);
}

if (typeof value === "number") {
if (!Number.isFinite(value)) {
throw new Error("Non-finite number is forbidden in evidence.");
}

return JSON.stringify(value);

}

if (typeof value === "boolean") {
return value ? "true" : "false";
}

if (Array.isArray(value)) {
return `[${value.map(canonicalize).join(",")}]`;
}

if (typeof value === "object") {
const object = value as Record<string, unknown>;

const keys = Object.keys(object)
  .filter((key) => object[key] !== undefined)
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

return `{${keys
  .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
  .join(",")}}`;

}

throw new Error(`Unsupported value in canonical evidence: ${typeof value}`);
}

export function sha256Bytes(bytes: Uint8Array): string {
return createHash("sha256").update(bytes).digest("hex");
}

export function sha256Canonical(value: unknown): string {
const canonical = canonicalize(value);
const bytes = new TextEncoder().encode(canonical);

return sha256Bytes(bytes);
}

/* -------------------------------------------------------------------------- /
/ MERKLE IMPLEMENTATION /
/ -------------------------------------------------------------------------- */

/**

Required institutional ordering:




UTF8_BYTEWISE_ASCENDING_V1




Sort by actual UTF-8 bytes, NOT localeCompare.
*/
export function compareUtf8Bytewise(a: Uint8Array, b: Uint8Array): number {
const length = Math.min(a.length, b.length);

for (let i = 0; i < length; i += 1) {
if (a[i] !== b[i]) {
return a[i] - b[i];
}
}

return a.length - b.length;
}

export function sortLeavesUtf8(
leaves: MerkleLeaf[],
): MerkleLeaf[] {
return [...leaves].sort((a, b) => {
const aBytes = hexToBytes(a.leafHash);
const bBytes = hexToBytes(b.leafHash);

return compareUtf8Bytewise(aBytes, bBytes);

});
}

function hexToBytes(hex: string): Uint8Array {
if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
throw new Error("Invalid hex.");
}

const result = new Uint8Array(hex.length / 2);

for (let i = 0; i < result.length; i += 1) {
result[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
}

return result;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
const result = new Uint8Array(a.length + b.length);
result.set(a, 0);
result.set(b, a.length);
return result;
}

function hashPair(aHex: string, bHex: string): string {
const a = hexToBytes(aHex);
const b = hexToBytes(bHex);

return sha256Bytes(concatBytes(a, b));
}

/**

Odd-node policy:




The final unpaired node is duplicated.




This must remain fixed forever for V1 compatibility.
*/
export function calculateMerkleRoot(
leaves: MerkleLeaf[],
): string {
if (leaves.length === 0) {
throw new Error("Evidence bundle cannot contain zero leaves.");
}

let level = sortLeavesUtf8(leaves).map((leaf) => leaf.leafHash);

while (level.length > 1) {
const next: string[] = [];

for (let i = 0; i < level.length; i += 2) {
  const left = level[i];
  const right = level[i + 1] ?? left;

  next.push(hashPair(left, right));
}

level = next;

}

return level[0];
}

/* -------------------------------------------------------------------------- /
/ FORMAL GUARDRAILS /
/ -------------------------------------------------------------------------- */

export function assertFormalTruth(
result: FormalVerificationResult,
): void {
const isPositiveFormalResult =
result.status === "PROVED" ||
result.status === "FALSIFIED";

if (isPositiveFormalResult && !result.solverAvailable) {
throw new Error(`FORMAL_INTEGRITY_VIOLATION: ${result.invariantId} is ${result.status} but solverAvailable=false.`);
}

if (
result.status === "PROVED" &&
result.proofCertificate?.kind !== "UNSAT_CERTIFICATE"
) {
throw new Error(`FORMAL_INTEGRITY_VIOLATION: PROVED invariant ${result.invariantId} lacks UNSAT certificate.`);
}

if (
result.status === "FALSIFIED" &&
result.proofCertificate?.kind !== "SAT_MODEL"
) {
throw new Error(`FORMAL_INTEGRITY_VIOLATION: FALSIFIED invariant ${result.invariantId} lacks SAT counterexample model.`);
}

/**

UNKNOWN / NOT_RUN / ERROR are intentionally allowed inside

the evidence bundle, but they cannot later become PASS.
*/
}

export function assertNoUnknownPass(
formalResults: FormalVerificationResult[],
passedInvariantIds: string[],
): void {
const statusById = new Map(
formalResults.map((result) => [
result.invariantId,
result.status,
]),
);

for (const invariantId of passedInvariantIds) {
const status = statusById.get(invariantId);

if (status !== "PROVED") {
  throw new Error(
    `UNKNOWN_IS_NEVER_PASS: ${invariantId} has status=${String(status)}.`,
  );
}

}
}

/* -------------------------------------------------------------------------- /
/ EVIDENCE CONSTRUCTION /
/ -------------------------------------------------------------------------- */

function formalResultToEvidence(
result: FormalVerificationResult,
timestamp: string,
): CanonicalEvidence {
assertFormalTruth(result);

const kind =
result.status === "FALSIFIED"
? "FORMAL_COUNTEREXAMPLE"
: "FORMAL_PROOF";

const payload = {
invariantId: result.invariantId,
status: result.status,
solverName: result.solverName,
solverVersion: result.solverVersion,
solverAvailable: result.solverAvailable,
durationMs: result.durationMs,
inputSha256: result.inputSha256,
outputSha256: result.outputSha256,
proofCertificate: result.proofCertificate ?? null,
diagnostics: [...result.diagnostics],
};

return {
evidenceId: `formal:${result.invariantId}:${result.outputSha256}`,
kind,
type: "formal-verification-result",
title: `Formal verification — ${result.invariantId}`,
payload,
source: "vlm-smt-engine",
timestamp,
sha256: sha256Canonical(payload),
};
}

export function evidenceToLeaf(
evidence: CanonicalEvidence,
): MerkleLeaf {
const canonical = canonicalize({
evidenceId: evidence.evidenceId,
kind: evidence.kind,
type: evidence.type,
title: evidence.title,
payload: evidence.payload,
source: evidence.source,
timestamp: evidence.timestamp,
sha256: evidence.sha256,
});

const bytes = new TextEncoder().encode(canonical);

return {
evidenceId: evidence.evidenceId,
canonicalBytesHex: bytesToHex(bytes),
leafHash: sha256Bytes(bytes),
};
}

function bytesToHex(bytes: Uint8Array): string {
return Array.from(bytes)
.map((byte) => byte.toString(16).padStart(2, "0"))
.join("");
}

/* -------------------------------------------------------------------------- /
/ BUNDLE VALIDATION /
/ -------------------------------------------------------------------------- */

export function verifyEvidenceBundle(
bundle: EvidenceBundle,
): boolean {
for (const leaf of bundle.leaves) {
  try {
    const bytes = hexToBytes(leaf.canonicalBytesHex);
    const computedHash = sha256Bytes(bytes);
    const hA = Buffer.from(computedHash, "hex");
    const hB = Buffer.from(leaf.leafHash, "hex");
    if (hA.length !== hB.length || !timingSafeEqual(hA, hB)) {
      return false;
    }
  } catch {
    return false;
  }
}

const leaves = [...bundle.leaves];

const recomputedRoot = calculateMerkleRoot(leaves);

const a = Buffer.from(recomputedRoot, "hex");
const b = Buffer.from(bundle.merkleRoot, "hex");

if (a.length !== b.length) {
return false;
}

if (!timingSafeEqual(a, b)) {
return false;
}

return true;
}

function buildEvidenceBundle(input: {
bundleId: string;
createdAt: string;
tier: AuditTier;
contract: ContractIdentity;
evidence: CanonicalEvidence[];
formalResults: FormalVerificationResult[];
}): EvidenceBundle {
const formalEvidence = input.formalResults.map((result) =>
formalResultToEvidence(result, input.createdAt),
);

const allEvidence = [...input.evidence, ...formalEvidence];

if (allEvidence.length === 0) {
throw new Error(
  "Evidence bundle generation aborted: no evidence was produced.",
);

}

const leaves = allEvidence.map(evidenceToLeaf);

/**

Deterministic ordering is established by calculateMerkleRoot().

We additionally persist the canonical ordering in the bundle itself.
*/
const sortedLeaves = sortLeavesUtf8(leaves);

const merkleRoot = calculateMerkleRoot(sortedLeaves);

const formalSummary = input.formalResults.reduce(
(summary, result) => {
if (result.status === "PROVED") {
summary.proved += 1;
} else if (result.status === "FALSIFIED") {
summary.falsified += 1;
} else if (result.status === "UNKNOWN") {
summary.unknown += 1;
} else if (result.status === "NOT_RUN") {
summary.notRun += 1;
} else if (result.status === "ERROR") {
summary.errors += 1;
}

  if (result.solverAvailable) {
    summary.solverAvailable = true;
  }

  return summary;
},
{
  proved: 0,
  falsified: 0,
  unknown: 0,
  notRun: 0,
  errors: 0,
  solverAvailable: false,
},

);

const bundle: EvidenceBundle = {
schemaVersion: "VELMERE-EVIDENCE-BUNDLE-V1",
bundleId: input.bundleId,
createdAt: input.createdAt,
contract: input.contract,
tier: input.tier,
sortingRule: "UTF8_BYTEWISE_ASCENDING_V1",
hashAlgorithm: "SHA-256",
leaves: sortedLeaves,
merkleRoot,
formalSummary,
integrity: {
verified: false,
},
};

/**

Never trust the first root calculation.

Recalculate from the serialized bundle and verify the result.
*/
const verified = verifyEvidenceBundle(bundle);

if (!verified) {
throw new Error(
"Evidence bundle generation aborted: Merkle root verification failed.",
);
}

bundle.integrity.verified = true;

/**

A verified bundle must remain verified after serialization.

This catches accidental mutation / serialization mismatches.
*/
const roundTrip = JSON.parse(
canonicalize(bundle),
) as EvidenceBundle;

if (!verifyEvidenceBundle(roundTrip)) {
throw new Error(
"Evidence bundle generation aborted: canonical round-trip integrity failed.",
);
}

return bundle;
}

/* -------------------------------------------------------------------------- /
/ RELEASE-GATE PRIMITIVES /
/ -------------------------------------------------------------------------- */

export interface ReleaseGateFailure {
code: string;
message: string;
severity: "BLOCKER" | "HIGH" | "MEDIUM";
context?: Record<string, unknown>;
}

export type ReleaseDecision = "PASS" | "CONDITIONAL" | "BLOCKED" | "NOT_VERIFIED";

export interface ReleaseGateResult {
passed: boolean;
releaseDecision: ReleaseDecision;
failures: ReleaseGateFailure[];
warnings: string[];
checks: {
evidenceIntegrity: boolean;
formalIntegrity: boolean;
unknownPassProtection: boolean;
scoringIntegrity: boolean;
pdfIntegrity: boolean;
criticalFindingsProtection: boolean;
proxyEvidenceIntegrity: boolean;
};
}

function fail(
failures: ReleaseGateFailure[],
code: string,
message: string,
severity: ReleaseGateFailure["severity"] = "BLOCKER",
context?: Record<string, unknown>,
): void {
failures.push({
code,
message,
severity,
context,
});
}

/* -------------------------------------------------------------------------- /
/ FORMAL RELEASE POLICY /
/ -------------------------------------------------------------------------- */

/**

Advanced and Pro can contain UNKNOWN formal claims.




They simply cannot represent those claims as PROVED / PASS.
*/
export function validateFormalReleasePolicy(
tier: AuditTier,
formalResults: FormalVerificationResult[],
): ReleaseGateFailure[] {
const failures: ReleaseGateFailure[] = [];

for (const result of formalResults) {
try {
assertFormalTruth(result);
} catch (error) {
fail(
failures,
"FORMAL_RESULT_INVALID",
error instanceof Error ? error.message : String(error),
"BLOCKER",
{
invariantId: result.invariantId,
status: result.status,
},
);
}

if (
  result.status === "PROVED" &&
  result.solverAvailable !== true
) {
  fail(
    failures,
    "NO_SOLVER_NO_PROOF",
    `Invariant ${result.invariantId} is PROVED without an available solver.`,
  );
}

if (
  result.status === "UNKNOWN" ||
  result.status === "NOT_RUN" ||
  result.status === "ERROR"
) {
  if (tier === "ADVANCED") {
    fail(
      failures,
      "UNRESOLVED_FORMAL_RESULT",
      `Invariant ${result.invariantId} status is ${result.status}; unresolved formal result blocks ADVANCED institutional release.`,
      "BLOCKER",
    );
  }
  continue;
}

if (
  result.status === "FALSIFIED"
) {
  if (result.proofCertificate?.kind !== "SAT_MODEL") {
    fail(
      failures,
      "FALSIFICATION_WITHOUT_MODEL",
      `Invariant ${result.invariantId} is FALSIFIED without a SAT model.`,
    );
  }
  if (tier === "ADVANCED") {
    fail(
      failures,
      "FORMAL_INVARIANT_FALSIFIED",
      `Invariant ${result.invariantId} was FALSIFIED; counterexample blocks ADVANCED institutional release.`,
      "BLOCKER",
    );
  }
}

if (
  result.status === "PROVED" &&
  result.proofCertificate?.kind !== "UNSAT_CERTIFICATE"
) {
  fail(
    failures,
    "PROOF_WITHOUT_UNSAT_CERTIFICATE",
    `Invariant ${result.invariantId} is PROVED without an UNSAT certificate.`,
  );
}

}

/**
 * The tier itself is intentionally checked here because this is the
 * institutional release policy.
 */
if (
  tier !== "BASIC" &&
  formalResults.length === 0
) {
  /*
   * Pro / Advanced are not allowed to fabricate a formal layer merely
   * because the solver returned no claims.
   *
   * This is a warning-level condition at this layer because an adapter
   * may legitimately determine that no applicable invariant exists.
   */
}

return failures;
}

/* -------------------------------------------------------------------------- /
/ SCORE CONSISTENCY GUARDS /
/ -------------------------------------------------------------------------- */

function assertScoreRange(score: number, field: string): void {
if (
!Number.isFinite(score) ||
score < 0 ||
score > 100
) {
throw new Error(`SCORING_INTEGRITY_VIOLATION: ${field} must be between 0 and 100.`);
}
}

export function validateScoreIntegrity(
score: ScoreResult,
): ReleaseGateFailure[] {
const failures: ReleaseGateFailure[] = [];

try {
assertScoreRange(
score.score.securityScore,
"securityScore",
);
} catch (error) {
fail(
failures,
"INVALID_SECURITY_SCORE",
error instanceof Error ? error.message : String(error),
);
}

try {
assertScoreRange(
score.score.auditConfidence,
"auditConfidence",
);
} catch (error) {
fail(
failures,
"INVALID_AUDIT_CONFIDENCE",
error instanceof Error ? error.message : String(error),
);
}

const severityRank: Record<FindingSeverity, number> = {
INFO: 0,
LOW: 1,
MEDIUM: 2,
HIGH: 3,
CRITICAL: 4,
};

const findingSeverity = new Map<string, FindingSeverity>();

for (const risk of score.findingRisks) {
const previous = findingSeverity.get(risk.findingId);

if (
  previous !== undefined &&
  severityRank[risk.severity] < severityRank[previous]
) {
  fail(
    failures,
    "SEVERITY_DOWNGRADE_DETECTED",
    `Finding ${risk.findingId} was downgraded inside the normalized scoring result.`,
    "HIGH",
    {
      previous,
      current: risk.severity,
    },
  );
}

findingSeverity.set(risk.findingId, risk.severity);

if (risk.cvss !== undefined) {
  if (risk.cvss.version !== "3.1") {
    fail(
      failures,
      "CVSS_VERSION_MISMATCH",
      `Finding ${risk.findingId} uses unsupported CVSS version ${risk.cvss.version}.`,
    );
  }

  if (
    !Number.isFinite(risk.cvss.baseScore) ||
    risk.cvss.baseScore < 0 ||
    risk.cvss.baseScore > 10
  ) {
    fail(
      failures,
      "INVALID_CVSS_BASE_SCORE",
      `Finding ${risk.findingId} has invalid CVSS v3.1 base score.`,
    );
  }

  if (
    typeof risk.cvss.vector !== "string" ||
    !risk.cvss.vector.startsWith("CVSS:3.1/")
  ) {
    fail(
      failures,
      "INVALID_CVSS_VECTOR",
      `Finding ${risk.findingId} does not contain a valid CVSS v3.1 vector prefix.`,
    );
  }
}

}

return failures;
}

/* -------------------------------------------------------------------------- /
/ PDF RELEASE GUARDS /
/ -------------------------------------------------------------------------- */

export function validatePdfLayout(
report: GeneratedReport,
): ReleaseGateFailure[] {
const failures: ReleaseGateFailure[] = [];

if (!(report.pdfBytes instanceof Uint8Array)) {
fail(
failures,
"PDF_BYTES_INVALID",
"Report builder did not return Uint8Array PDF bytes.",
);

return failures;

}

if (report.pdfBytes.length === 0) {
fail(
failures,
"PDF_EMPTY",
"Generated PDF is empty.",
);
}

if (!Number.isInteger(report.layout.pageCount)) {
fail(
failures,
"PDF_PAGE_COUNT_INVALID",
"PDF page count is not an integer.",
);
}

if (
report.layout.pageCount !== report.layout.pages.length
) {
fail(
failures,
"PDF_PAGE_COUNT_MISMATCH",
"PDF pageCount does not match page metrics length.",
);
}

for (const page of report.layout.pages) {
if (page.contentHeightPt < 0) {
fail(failures, "PDF_NEGATIVE_CONTENT_HEIGHT", `Page ${page.page} reports negative content height.`);
}

if (page.budgetHeightPt <= 0) {
  fail(
    failures,
    "PDF_INVALID_BUDGET",
    `Page ${page.page} has an invalid customer-safe budget.`,
  );
}

if (page.remainingHeightPt < -0.01) {
  fail(
    failures,
    "PDF_OVERFLOW",
    `Page ${page.page} exceeds customer-safe layout budget.`,
    "BLOCKER",
    {
      contentHeightPt: page.contentHeightPt,
      budgetHeightPt: page.budgetHeightPt,
      remainingHeightPt: page.remainingHeightPt,
    },
  );
}

}

if (report.layout.overflow) {
fail(
failures,
"PDF_OVERFLOW_FLAGGED",
"Tier report builder explicitly flagged layout overflow.",
);
}

if (!/^[0-9a-f]{64}$/i.test(report.sha256)) {
fail(
failures,
"PDF_HASH_INVALID",
"Generated PDF SHA-256 is invalid.",
);
} else {
const recomputed = sha256Bytes(report.pdfBytes);

if (recomputed.toLowerCase() !== report.sha256.toLowerCase()) {
  fail(
    failures,
    "PDF_HASH_MISMATCH",
    "Generated PDF hash does not match its actual bytes.",
  );
}

}

return failures;
}

/* -------------------------------------------------------------------------- /
/ COMPLETE RELEASE GATE /
/ -------------------------------------------------------------------------- */

export function evaluateReleaseGate(
output: AuditOutput,
): ReleaseGateResult {
const failures: ReleaseGateFailure[] = [];
const warnings: string[] = [];

let evidenceIntegrity: boolean;
let unknownPassProtection = false;

/* ----------------------------- Evidence -------------------------------- */

try {
evidenceIntegrity =
output.evidenceBundle.integrity.verified &&
verifyEvidenceBundle(output.evidenceBundle);
} catch {
evidenceIntegrity = false;
}

if (!evidenceIntegrity) {
fail(
failures,
"EVIDENCE_MERKLE_INVALID",
"Institutional evidence bundle failed Merkle verification.",
);
}

/* ------------------------------ Formal --------------------------------- */

const formalFailures = validateFormalReleasePolicy(
output.evidenceBundle.tier,
output.formalResults,
);

failures.push(...formalFailures);

const formalIntegrity = formalFailures.length === 0;

/* ---------------------------- Unknown PASS ------------------------------ */

const passedInvariantEvidenceIds =
output.evidenceBundle.leaves
.filter((leaf) =>
leaf.evidenceId.startsWith("formal:"),
)
.map((leaf) => leaf.evidenceId);

try {
/**
* A formal leaf itself is not a PASS.
*
* We therefore inspect actual results and prohibit any result that
* claims PROVED without satisfying assertFormalTruth().
*/
for (const result of output.formalResults) {
if (
result.status === "UNKNOWN" ||
result.status === "NOT_RUN" ||
result.status === "ERROR"
) {
/*
* These states are valid unresolved states.
*/
continue;
}

  if (
    result.status === "PROVED" &&
    !result.solverAvailable
  ) {
    throw new Error(
      `UNKNOWN_IS_NEVER_PASS: ${result.invariantId}`,
    );
  }

  if (
    result.status === "PROVED" &&
    result.proofCertificate?.kind !==
      "UNSAT_CERTIFICATE"
  ) {
    throw new Error(
      `UNKNOWN_IS_NEVER_PASS: ${result.invariantId}`,
    );
  }
}

void passedInvariantEvidenceIds;

unknownPassProtection = true;

} catch (error) {
fail(
failures,
"UNKNOWN_IS_NEVER_PASS",
error instanceof Error ? error.message : String(error),
);
}

/* ------------------------------- Score --------------------------------- */

const scoringFailures = validateScoreIntegrity(
output.score,
);

failures.push(...scoringFailures);
const scoringIntegrity = scoringFailures.length === 0;

/* -------------------------------- PDF ---------------------------------- */

const pdfFailures = validatePdfLayout(output.report);

failures.push(...pdfFailures);
const pdfIntegrity = pdfFailures.length === 0;

/* ------------------------ Critical Exploits Guard ----------------------- */

const hasCriticalFindings =
  output.findings.some((f) => f.severity === "CRITICAL") ||
  output.score.findingRisks.some((r) => r.severity === "CRITICAL");

if (hasCriticalFindings) {
  fail(
    failures,
    "CRITICAL_EXPLOIT_PRESENT",
    "Confirmed or unresolved CRITICAL vulnerability present; institutional release is strictly BLOCKED regardless of numeric score.",
    "BLOCKER",
  );
}

const criticalFindingsProtection = !hasCriticalFindings;

/* ---------------------- Proxy Evidence Completeness --------------------- */

const missingProxyImplementation =
  output.identity.isProxy &&
  (!output.identity.implementationAddress ||
    output.identity.implementationAddress ===
      "0x0000000000000000000000000000000000000000");

if (missingProxyImplementation) {
  fail(
    failures,
    "MISSING_PROXY_IMPLEMENTATION",
    "Proxy contract lacks verified implementation address/bytecode; institutional release is BLOCKED under INCOMPLETE_PROXY_EVIDENCE.",
    "BLOCKER",
  );
}

const proxyEvidenceIntegrity = !missingProxyImplementation;

/* ------------------------ Formal Results Categorization ----------------- */

for (const result of output.formalResults) {
  if (
    result.status === "FALSIFIED" ||
    result.proofCertificate?.kind === "SAT_MODEL" ||
    result.proofType === "SAT_COUNTEREXAMPLE"
  ) {
    fail(
      failures,
      "FORMAL_COUNTEREXAMPLE_FOUND",
      `Formal invariant '${result.invariantId}' falsified with SAT counterexample; vulnerability confirmed in state machine. Institutional release BLOCKED.`,
      "BLOCKER",
    );
  } else if (
    output.evidenceBundle.tier === "ADVANCED" &&
    ((result.status as string) === "UNKNOWN" ||
      (result.status as string) === "TIMEOUT" ||
      result.proofType === "UNKNOWN" ||
      result.proofType === "TIMEOUT")
  ) {
    fail(
      failures,
      "FORMAL_PROOF_INCOMPLETE",
      `Advanced tier requires conclusive proof; formal invariant '${result.invariantId}' returned ${result.status}. Institutional release BLOCKED.`,
      "BLOCKER",
    );
  } else if (result.status === "ERROR") {
    fail(
      failures,
      "FORMAL_ANALYSIS_FAILED",
      `Formal verification engine encountered error analyzing invariant '${result.invariantId}'. Institutional release BLOCKED.`,
      "BLOCKER",
    );
  }
}

/**
Informational warning rather than silent normalization.
*/
if (output.formalResults.some(
(result) =>
result.status === "UNKNOWN" ||
result.status === "NOT_RUN" ||
result.status === "ERROR",
)) {
warnings.push(
"One or more formal claims remain unresolved; unresolved claims must not be presented as proven.",
);
}

const passed =
failures.length === 0 &&
evidenceIntegrity &&
formalIntegrity &&
unknownPassProtection &&
scoringIntegrity &&
pdfIntegrity &&
criticalFindingsProtection &&
proxyEvidenceIntegrity;

let releaseDecision: ReleaseDecision;
if (failures.some((f) => f.severity === "BLOCKER")) {
  releaseDecision = "BLOCKED";
} else if (
  (output.evidenceBundle.tier === "ADVANCED" && !output.identity.sourceVerified) ||
  output.formalResults.some((r) => r.status === "NOT_RUN" || r.proofType === "NOT_MODELED")
) {
  releaseDecision = "NOT_VERIFIED";
} else if (failures.length > 0 || warnings.length > 0) {
  releaseDecision = "CONDITIONAL";
} else {
  releaseDecision = "PASS";
}

return {
passed,
releaseDecision,
failures,
warnings,
checks: {
evidenceIntegrity,
formalIntegrity,
unknownPassProtection,
scoringIntegrity,
pdfIntegrity,
criticalFindingsProtection,
proxyEvidenceIntegrity,
},
};
}

/* -------------------------------------------------------------------------- /
/ PIPELINE OPTIONS /
/ -------------------------------------------------------------------------- */

export interface UnifiedAuditPipelineOptions {
clock?: () => Date;
bundleIdFactory?: (input: {
contract: ContractIdentity;
tier: AuditTier;
createdAt: string;
}) => string;

/**

Applicable formal invariants for the current deployment.




Do not blindly run invariants against contracts where their semantics

do not apply. Applicability must be explicit.
*/
invariantSelector?: (input: {
contract: ContractIdentity;
findings: AstFinding[];
tier: AuditTier;
}) => string[];
}

/* -------------------------------------------------------------------------- /
/ PIPELINE CLASS /
/ -------------------------------------------------------------------------- */

export class UnifiedAuditPipeline {
private readonly clock: () => Date;

private readonly bundleIdFactory: NonNullable<
UnifiedAuditPipelineOptions["bundleIdFactory"]
>;

private readonly invariantSelector: NonNullable<
UnifiedAuditPipelineOptions["invariantSelector"]
>;

public constructor(
private readonly analyzer: SmartContractAnalyzerAdapter,
private readonly formalEngine: FormalEngineAdapter,
private readonly scorer: TwoDimensionalScorerAdapter,
private readonly reportBuilder: TierReportBuilderAdapter,
options: UnifiedAuditPipelineOptions = {},
) {
this.clock =
options.clock ??
(() => new Date());

this.bundleIdFactory =
  options.bundleIdFactory ??
  ((input) =>
    [
      "velmere",
      input.tier.toLowerCase(),
      input.contract.chainId,
      input.contract.address.toLowerCase(),
      input.contract.bytecodeSha256,
    ].join(":"));

this.invariantSelector =
  options.invariantSelector ??
  ((input) => {
    /**
     * Default formal set.
     *
     * An actual production integration should replace this selector
     * with contract-aware applicability logic.
     */
    if (input.tier === "BASIC") {
      return [];
    }

    return [
      "defi.solvency",
      "defi.collateral-conservation",
      "defi.reentrancy-impossibility",
      "defi.nonce-monotonicity",
    ];
  });

}

public async run(input: {
address: string;
chainId: ChainId;
tier: AuditTier;
}): Promise<AuditOutput> {
const createdAt = this.clock().toISOString();

/* ----------------------------- ANALYSIS -------------------------------- */

const analyzed =
  await this.analyzer.analyze({
    address: input.address,
    chainId: input.chainId,
    tier: input.tier,
  });

if (
  analyzed.identity.address.toLowerCase() !==
  input.address.toLowerCase()
) {
  throw new Error(
    "Pipeline aborted: analyzer returned a different contract address.",
  );
}

if (analyzed.identity.chainId !== input.chainId) {
  throw new Error(
    "Pipeline aborted: analyzer returned a different chain ID.",
  );
}

/* -------------------------- FINDING SANITY ----------------------------- */

for (const finding of analyzed.findings) {
  if (
    finding.confidence < 0 ||
    finding.confidence > 1 ||
    !Number.isFinite(finding.confidence)
  ) {
    throw new Error(
      `Pipeline aborted: finding ${finding.id} has invalid confidence.`,
    );
  }

  if (
    finding.contractAddress.toLowerCase() !==
    analyzed.identity.address.toLowerCase()
  ) {
    throw new Error(
      `Pipeline aborted: finding ${finding.id} targets another contract.`,
    );
  }

  if (finding.chainId !== analyzed.identity.chainId) {
    throw new Error(
      `Pipeline aborted: finding ${finding.id} targets another chain.`,
    );
  }
}

/* -------------------------- FORMAL VERIFICATION ------------------------ */

const invariantIds =
  this.invariantSelector({
    contract: analyzed.identity,
    findings: analyzed.findings,
    tier: input.tier,
  });

const formalResults: FormalVerificationResult[] = [];

/**
 * Sequential execution is deliberate.
 *
 * It makes solver evidence ordering deterministic and prevents shared
 * solver-state adapters from accidentally contaminating one another.
 */
for (const invariantId of invariantIds) {
  let result: FormalVerificationResult;

  try {
    result =
      await this.formalEngine.verify({
        invariantId,
        contract: analyzed.identity,
        findings: analyzed.findings,
      });
  } catch (error) {
    /**
     * A crashed solver is represented as ERROR, never PASS.
     *
     * The result is still preserved as institutional evidence so that
     * the audit cannot quietly omit the failed verification step.
     */
    const diagnostics = [
      error instanceof Error
        ? error.message
        : String(error),
    ];

    result = {
      invariantId,
      status: "ERROR",
      solverName: "unknown",
      solverVersion: "unknown",
      solverAvailable: false,
      durationMs: 0,
      inputSha256: sha256Canonical({
        invariantId,
        contract: analyzed.identity,
      }),
      outputSha256: sha256Canonical({
        invariantId,
        status: "ERROR",
        diagnostics,
      }),
      diagnostics,
    };
  }

  assertFormalTruth(result);
  formalResults.push(result);
}

/* --------------------------- EVIDENCE BUNDLE --------------------------- */

const bundle =
  buildEvidenceBundle({
    bundleId:
      this.bundleIdFactory({
        contract: analyzed.identity,
        tier: input.tier,
        createdAt,
      }),
    createdAt,
    contract: analyzed.identity,
    tier: input.tier,
    evidence: analyzed.evidence,
    formalResults,
  });

if (!bundle.integrity.verified) {
  throw new Error(
    "Pipeline aborted: evidence bundle is not verified.",
  );
}

/* ------------------------------- SCORE -------------------------------- */

const score =
  await this.scorer.score({
    tier: input.tier,
    findings: analyzed.findings,
    formalResults,
    evidenceBundle: bundle,
  });

const scoreFailures =
  validateScoreIntegrity(score);

if (scoreFailures.length > 0) {
  throw new Error(
    [
      "Pipeline aborted: scoring integrity failed.",
      ...scoreFailures.map(
        (failure) =>
          `${failure.code}: ${failure.message}`,
      ),
    ].join("\n"),
  );
}

/* -------------------------------- REPORT ------------------------------- */

const report =
  await this.reportBuilder.build({
    tier: input.tier,
    contract: analyzed.identity,
    findings: analyzed.findings,
    formalResults,
    evidenceBundle: bundle,
    score,
  });

const pdfFailures = validatePdfLayout(report);

if (pdfFailures.length > 0) {
  throw new Error(
    [
      "Pipeline aborted: PDF release validation failed.",
      ...pdfFailures.map(
        (failure) =>
          `${failure.code}: ${failure.message}`,
      ),
    ].join("\n"),
  );
}

/* ---------------------------- FINAL GATE ------------------------------- */

const output: AuditOutput = {
  identity: analyzed.identity,
  findings: analyzed.findings,
  formalResults,
  evidenceBundle: bundle,
  score,
  report,
};

const gate = evaluateReleaseGate(output);

if (!gate.passed) {
  const details = gate.failures
    .map(
      (failure) =>
        `[${failure.severity}] ${failure.code}: ${failure.message}`,
    )
    .join("\n");

  throw new Error(
    `Institutional release gate FAILED.\n${details}`,
  );
}

return output;

}
}

/* -------------------------------------------------------------------------- /
/ STANDALONE INTEGRATION HELPERS /
/ -------------------------------------------------------------------------- */

export interface PipelineFactory {
create(): UnifiedAuditPipeline;
}

/**

Runs the supplied pipeline and applies the institutional release gate

again outside of the pipeline itself.




This intentional double evaluation is useful in CI because it catches

accidental mutation performed by a caller after pipeline completion.
*/
export async function runInstitutionalAudit(
pipeline: UnifiedAuditPipeline,
input: {
address: string;
chainId: ChainId;
tier: AuditTier;
},
): Promise<AuditOutput> {
const output = await pipeline.run(input);

const gate = evaluateReleaseGate(output);

if (!gate.passed) {
throw new Error(
[
"Institutional post-run verification FAILED.",
...gate.failures.map(
(failure) =>
`${failure.code}: ${failure.message}`,
),
].join("\n"),
);
}

return output;
}

/**

Serializes an evidence bundle using the exact canonical representation.




Never use JSON.stringify(bundle) as the institutional serialization.
*/
export function serializeEvidenceBundle(
bundle: EvidenceBundle,
): Uint8Array {
return new TextEncoder().encode(
canonicalize(bundle),
);
}

export function hashEvidenceBundle(
bundle: EvidenceBundle,
): string {
return sha256Bytes(
serializeEvidenceBundle(bundle),
);
}

/**

External tamper test helper.




Makes a deep canonical copy, mutates exactly one field and verifies that

the original Merkle root can no longer validate it.
*/
export function assertBundleTamperDetected(
bundle: EvidenceBundle,
): void {
const clone =
JSON.parse(
canonicalize(bundle),
) as EvidenceBundle;

if (clone.leaves.length === 0) {
throw new Error(
"Cannot perform tamper test against an empty bundle.",
);
}

const first = clone.leaves[0];

first.canonicalBytesHex =
first.canonicalBytesHex.length > 2
? `${first.canonicalBytesHex.slice(0, -2)}00`
: "00";

const valid = verifyEvidenceBundle(clone);

if (valid) {
throw new Error(
"ANTI_TAMPER_FAILURE: mutated evidence bundle still verifies.",
);
}
}

/**

Tests that UNKNOWN cannot be represented as an accepted formal proof.
*/
export function assertUnknownCannotPass(
invariantId = "test.unknown-invariant",
): void {
const unknown: FormalVerificationResult = {
invariantId,
status: "UNKNOWN",
solverName: "Z3",
solverVersion: "5.1.0",
solverAvailable: true,
durationMs: 1,
inputSha256:
sha256Canonical({
invariantId,
input: "test",
}),
outputSha256:
sha256Canonical({
invariantId,
result: "unknown",
}),
diagnostics: [],
};

let blocked = false;

try {
assertNoUnknownPass(
[unknown],
[invariantId],
);
} catch {
blocked = true;
}

if (!blocked) {
throw new Error(
"UNKNOWN_IS_NEVER_PASS invariant was violated.",
);
}
}
