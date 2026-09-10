import crypto from "node:crypto";
import { verifySolidityCompilerAstEvidence } from "./solidity-compiler-ast-runtime.mjs";
import { verifyAuditCompilerDeploymentBinding, verifyAuditEip1967ProxyBinding } from "./audit-compiler-deployment-binding.mjs";

export const AUDIT_COMPILER_AST_REVIEW_LAYER_SCHEMA = "velmere.pass36.a102r44p39.audit-compiler-ast-review-layer.v2";

const stable = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
};
const sha256 = (value) => `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;

export function buildAuditCompilerAstReviewLayer({ evidence, sourceFiles, deploymentBinding = null, proxyBinding = null }) {
  const verification = verifySolidityCompilerAstEvidence(evidence, sourceFiles);
  const deploymentBindingVerified = deploymentBinding ? verifyAuditCompilerDeploymentBinding(deploymentBinding) : false;
  const proxyBindingVerified = proxyBinding ? verifyAuditEip1967ProxyBinding(proxyBinding) : false;
  const accepted = verification.ok === true;
  const findings = accepted
    ? (evidence?.findings ?? []).map((finding) => ({
      referenceSeed: `${finding.sourcePath}:${finding.astNodeId ?? 0}:compiler-ast:${finding.ruleId}`,
      ruleId: finding.ruleId,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      safeRemediation: finding.remediation,
      sourcePath: finding.sourcePath,
      line: finding.line,
      astNodeId: finding.astNodeId ?? null,
      excerpt: finding.excerpt,
      limitations: [...(finding.limitations ?? [])],
      confidenceState: "NOT_CALIBRATED",
      compilerBacked: true,
      reviewPriorityOnly: true,
      legacyCompilerBounded: finding.ruleId === "AST_LEGACY_UNCHECKED_MULTIPLICATION_ECONOMIC_SINK",
      broadArithmeticCoverageProven: false,
      exploitabilityProven: false,
      independentReview: false,
    }))
    : [];
  const core = {
    schemaVersion: AUDIT_COMPILER_AST_REVIEW_LAYER_SCHEMA,
    status: accepted ? "ACCEPTED_LOCAL_COMPILER_AST_REVIEW_LAYER" : "REJECTED_INVALID_COMPILER_AST_EVIDENCE",
    accepted,
    evidenceSha256: accepted ? evidence?.evidenceSha256 ?? null : null,
    analyzerId: accepted ? evidence?.analyzerId ?? null : null,
    analyzerClass: accepted ? evidence?.analyzerClass ?? null : null,
    compilerVersion: accepted ? evidence?.compiler?.version ?? null : null,
    sourceBundleSha256: accepted ? evidence?.inputIdentity?.sourceBundleSha256 ?? null : null,
    verificationChecks: verification.checks,
    failedChecks: verification.failed,
    findings,
    findingCount: findings.length,
    deploymentBinding: deploymentBindingVerified ? { status: deploymentBinding.status, bindingSha256: deploymentBinding.bindingSha256 } : null,
    proxyBinding: proxyBindingVerified ? { status: proxyBinding.status, proxyBindingSha256: proxyBinding.proxyBindingSha256 } : null,
    creditBoundary: {
      localSuppliedDeploymentBindingCredit: deploymentBindingVerified && deploymentBinding?.creditBoundary?.localSuppliedBytecodeBindingCredit === true,
      localSuppliedProxyBindingCredit: proxyBindingVerified && proxyBinding?.creditBoundary?.localSuppliedProxyBindingCredit === true,
      localCompilerAstReviewLayerCredit: accepted,
      findingConfidenceCalibrated: false,
      broadArithmeticCoverageCredit: false,
      formalAccuracyCredit: false,
      exploitabilityCredit: false,
      independentGroundTruthCredit: false,
      realProtocolAccuracyCredit: false,
      customerCredit: false,
      saleCredit: false,
      liveCredit: false,
      worldClassCredit: false,
    },
    truthBoundary: accepted
      ? "Accepted exact compiler-AST evidence is a bounded local review-priority lane. Legacy multiplication rows cover only unsigned external-parameter taint reaching enumerated economic sinks on exact compilers below 0.8; they do not establish broad arithmetic coverage, exploitability, complete recall, formal accuracy, real-protocol accuracy or customer safety."
      : "Rejected compiler-AST evidence contributes no audit finding, release, sale or customer credit.",
  };
  return { ...core, reviewLayerSha256: sha256(stable(core)) };
}

export function verifyAuditCompilerAstReviewLayer(value) {
  if (!value || typeof value !== "object") return false;
  const { reviewLayerSha256, ...core } = value;
  return value.schemaVersion === AUDIT_COMPILER_AST_REVIEW_LAYER_SCHEMA
    && typeof reviewLayerSha256 === "string"
    && reviewLayerSha256 === sha256(stable(core))
    && Array.isArray(value.findings)
    && value.findings.every((row) => row.confidenceState === "NOT_CALIBRATED" && row.compilerBacked === true && row.reviewPriorityOnly === true && row.broadArithmeticCoverageProven === false && row.exploitabilityProven === false && row.independentReview === false)
    && value.creditBoundary?.broadArithmeticCoverageCredit === false
    && value.creditBoundary?.formalAccuracyCredit === false
    && value.creditBoundary?.saleCredit === false
    && value.creditBoundary?.liveCredit === false
    && value.creditBoundary?.worldClassCredit === false;
}
