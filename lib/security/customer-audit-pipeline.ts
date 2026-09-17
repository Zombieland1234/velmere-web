import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json";
import { sha256Digest } from "./cryptographic-digest";
import { buildCanonicalAuditReport, isTierSufficient, type AuditTier, type CanonicalAuditReportModel, type CanonicalFinding, type CanonicalReportSection, type FullAuditReportInput } from "./audit-canonical-report";
import { BENCHMARK_20_CONTRACTS } from "./contract-audit-profiles";
import { MASTER_50_ASSETS } from "./corpus/master-50-assets";
import { acquireAuditRuntimeSnapshot } from "./audit-runtime-snapshot";
import { executeFullAuditV2 } from "./v2/master-audit-orchestrator";
import { disassembleBytecode } from "./v2/evm-cfg-dataflow-engine";

export interface CustomerAnalysisReceipt {
  schemaVersion: "velmere.customer-analysis-receipt.v1";
  status: "REFERENCE_ONLY" | "STATIC_ANALYSIS_COMPLETED" | "ANALYSIS_UNAVAILABLE";
  sourceSha: string | null;
  engineVersion: string | null;
  inputBytecodeSha256: string | null;
  resultSha256: string | null;
  chainId: string;
  address: string;
  blockNumber: string | null;
  blockHash: string | null;
  blockTimestamp: string | null;
  observedAt: string | null;
  providerOrigin: string | null;
  snapshotBinding: "EIP1898_BLOCK_HASH_REQUIRE_CANONICAL" | null;
  independentlyVerified: false;
  targetBytecodeExecuted: false;
  providerRightsVerified: false;
  customerScope: "AVAILABLE_STATIC_HEURISTICS_NOT_AUDIT_CERTIFICATION";
  limitations: string[];
  findingsCount: number;
  errorCode?: string;
}
export const customerAuditPipelineDependencies = {
  acquire: acquireAuditRuntimeSnapshot,
  execute: executeFullAuditV2,
};
const maxFindings = 128;
const sectionSpecs = [
  ["overview", "Overview", "basic"], ["contract_identity", "Target identity", "basic"],
  ["basic_findings", "Static review candidates", "basic"],
  ["pro_permission_parser", "Permissions review scope", "pro"],
  ["pro_liquidity_depth", "Liquidity review scope", "pro"], ["pro_attack_surface", "Attack surface review scope", "pro"],
  ["advanced_bytecode_diff", "Version comparison scope", "advanced"], ["advanced_multi_version", "Historical comparison scope", "advanced"],
  ["advanced_human_review", "Independent review", "advanced"],
] as const;
const unknown = "NOT_VERIFIED: no independent target or exploit verification. Missing findings do not establish safety.";

/** Customer JSON/PDF/SSR share this projection. Legacy profiles never authorize
 * confidence, percent coverage, formal results, attestations or live observations.
 * The caller MUST authorize before calling and again after final rendering.
 */
export async function buildCustomerAuditReport(
  input: FullAuditReportInput,
  tier: AuditTier,
  signal?: AbortSignal,
): Promise<CanonicalAuditReportModel> {
  const address = input.contractAddress.toLowerCase();
  const chainId = String(input.chainId ?? "56");
  const source = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  const sourceSha = source && /^[a-f0-9]{40}$/.test(source) ? source : null;
  const profile = BENCHMARK_20_CONTRACTS[address];
  const knownAsset = MASTER_50_ASSETS.find(a => a.address.toLowerCase() === address && a.chainId === chainId);
  const reference = input.analysisMode !== "runtime" && Boolean(profile || knownAsset);
  // Only exact known references use the old builder. Its untrusted claims are
  // not spread into the output: below is an explicit allowlist projection.
  const legacy = reference ? buildCanonicalAuditReport(input, tier) : undefined;
  const receipt: CustomerAnalysisReceipt = {
    schemaVersion: "velmere.customer-analysis-receipt.v1", status: reference ? "REFERENCE_ONLY" : "ANALYSIS_UNAVAILABLE",
    sourceSha, engineVersion: null, inputBytecodeSha256: null, resultSha256: null,
    chainId, address, blockNumber: null, blockHash: null, blockTimestamp: null,
    observedAt: null, providerOrigin: null, snapshotBinding: null,
    independentlyVerified: false, targetBytecodeExecuted: false, providerRightsVerified: false,
    customerScope: "AVAILABLE_STATIC_HEURISTICS_NOT_AUDIT_CERTIFICATION",
    limitations: ["NO_SECURITY_CERTIFICATION", "NO_FORMAL_PROOF", "NO_INDEPENDENT_REVIEW", "PROVIDER_RIGHTS_NOT_ATTESTED", "DETECTOR_COVERAGE_NOT_QUALIFIED"],
    findingsCount: 0,
  };
  let findings: CanonicalFinding[] = [];
  if (reference) {
    receipt.limitations.push("REFERENCE_PROFILE_NOT_CURRENT_TARGET_ANALYSIS");
    findings = (legacy?.sections.flatMap(s => !s.isLocked ? s.data?.findings ?? [] : []) ?? []).map(f => ({
      id: f.id, swcId: f.swcId, severity: f.severity, title: `Reference candidate: ${f.title}`,
      category: "REFERENCE_PROFILE", description: "Reference information only; no current target analysis was executed.",
      evidence: "REFERENCE_ONLY: profile text is not current execution evidence.",
      recommendation: "Validate against an exact current target snapshot before relying on this candidate.",
      requiredTier: f.requiredTier, remediationState: "unresolved", retestStatus: "NOT_EXECUTED",
    }));
  } else if (/^0x[a-f0-9]{40}$/.test(address)) {
    const acquisition = await customerAuditPipelineDependencies.acquire(address, chainId, signal);
    if (!acquisition.ok) receipt.errorCode = acquisition.error;
    else {
      const snap = acquisition.snapshot;
      // Reject even injected/stale adapter output that does not bind the request.
      const byteDigest = /^0x(?:[a-f0-9]{2})+$/i.test(snap.bytecode)
        ? `sha256:${createHash("sha256").update(Buffer.from(snap.bytecode.slice(2), "hex")).digest("hex")}` : null;
      if (snap.address !== address || snap.chainId !== chainId || snap.binding !== "EIP1898_BLOCK_HASH_REQUIRE_CANONICAL" ||
          snap.independentlyVerified !== false || byteDigest !== snap.bytecodeSha256 || !/^0x[a-f0-9]{64}$/.test(snap.blockHash)) {
        receipt.errorCode = "runtime_snapshot_identity_mismatch";
      } else {
        Object.assign(receipt, { inputBytecodeSha256: snap.bytecodeSha256, blockNumber: snap.blockNumber, blockHash: snap.blockHash,
          blockTimestamp: snap.blockTimestamp, observedAt: snap.observedAt, providerOrigin: snap.providerOrigin, snapshotBinding: snap.binding });
        try {
          if (snap.bytecode.length > 2 + 24 * 1024 * 2) throw new Error("runtime_analysis_input_limit");
          const { instructions } = disassembleBytecode(snap.bytecode);
          if (instructions.length > 8192 || instructions.filter(i => i.name === "JUMPDEST").length > 1024) throw new Error("runtime_analysis_complexity_limit");
          if (signal?.aborted) throw new Error("request_aborted");
          const started = performance.now();
          const block = Number(BigInt(snap.blockNumber));
          if (!Number.isSafeInteger(block) || block < 0) throw new Error("runtime_block_out_of_range");
          const result = customerAuditPipelineDependencies.execute({
            contractAddress: address, chainId, bytecode: snap.bytecode,
            blockNumber: block, contractName: input.contractName, tier: tier.toUpperCase() as "BASIC" | "PRO" | "ADVANCED", fuzzIterations: 0,
          });
          // This check rejects late success; it is not preemption of synchronous JS.
          if (performance.now() - started > 3000) throw new Error("runtime_analysis_budget_exceeded");
          if (signal?.aborted) throw new Error("request_aborted");
          if (result.snapshot.contractAddress.toLowerCase() !== address || result.snapshot.chainId !== chainId || result.snapshot.blockNumber !== block || result.snapshot.bytecodeSha256.replace(/^0x/, "sha256:") !== snap.bytecodeSha256) throw new Error("runtime_result_identity_mismatch");
          receipt.engineVersion = result.snapshot.engineVersion;
          receipt.status = "STATIC_ANALYSIS_COMPLETED";
          receipt.limitations.push(...result.scores.coverage.limitations, "SOURCE_NOT_PROVIDED", "TARGET_EVM_NOT_EXECUTED", "SYNCHRONOUS_ENGINE_NOT_PREEMPTIBLE");
          findings = result.findings.slice(0, maxFindings).map((f, index) => ({
            id: `${f.findingId}:${index}`, swcId: f.taxonomy?.swcId, cweId: f.taxonomy?.cweId,
            severity: f.severity, title: `Heuristic candidate: ${f.title.replace(/^Heuristic candidate:\s*/i, "")}`,
            category: f.analysisMethod ?? "STATIC_HEURISTIC", description: f.impact,
            evidence: `${f.evidence.hashProof}; method=${f.analysisMethod ?? "STATIC_HEURISTIC"}; target execution NOT PERFORMED`,
            recommendation: f.remediation.strategy, requiredTier: "basic", remediationState: "unresolved", retestStatus: "NOT_EXECUTED",
          }));
          if (result.findings.length > maxFindings) receipt.limitations.push(`FINDINGS_TRUNCATED:${result.findings.length - maxFindings}`);
          // Full V2's findings alone are preserved; synthetic fuzz/formal/score
          // metadata is never promoted into customer execution evidence.
          receipt.resultSha256 = sha256Digest(canonicalJson({ inputBytecodeSha256: snap.bytecodeSha256, chainId, address,
            blockHash: snap.blockHash, engineVersion: receipt.engineVersion, findings }));
        } catch (error) {
          receipt.status = "ANALYSIS_UNAVAILABLE";
          const code = error instanceof Error ? error.message : "runtime_analysis_failed";
          receipt.errorCode = /^(runtime_|request_aborted)/.test(code) ? code : "runtime_analysis_failed";
          findings = []; receipt.resultSha256 = null;
        }
      }
    }
  } else receipt.errorCode = "unsupported_non_evm_target";
  if (signal?.aborted) { receipt.status = "ANALYSIS_UNAVAILABLE"; receipt.errorCode = "request_aborted"; findings = []; receipt.resultSha256 = null; }
  receipt.findingsCount = findings.length;
  receipt.limitations = [...new Set(receipt.limitations)].sort();
  const specs = legacy?.sections ?? sectionSpecs.map(([id, title, requiredTier]) => ({ id, title, requiredTier, subtitle: "Available evidence only", isLocked: false, data: null }));
  const sections: CanonicalReportSection[] = specs.map(s => {
    const locked = !isTierSufficient(tier, s.requiredTier);
    const sectionFindings = s.id === "basic_findings" ? findings.filter(f => isTierSufficient(tier, f.requiredTier ?? "basic")) : [];
    return { id: s.id, title: s.title, subtitle: unknown, requiredTier: s.requiredTier, isLocked: locked,
      ...(locked ? { lockTierNotice: "Current entitlement required. No additional verified method is implied." } : {}),
      data: locked ? null : {
        paragraphs: [s.id === "overview" ? `${receipt.status}. ${unknown}` : "No independently verified execution evidence for this section."],
        ...(sectionFindings.length ? { findings: sectionFindings } : {}),
        ...(s.id === "advanced_human_review" ? { reviewerState: { status: "not_commissioned" as const } } : {}),
      },
    };
  });
  const report: CanonicalAuditReportModel = {
    schemaVersion: "velmere.canonical-audit-report.v1", reportId: input.reportId, ...(input.caseRef ? { caseRef: input.caseRef } : {}),
    target: { contractAddress: address, contractName: input.contractName, chainId, network: input.network ?? "Unknown", tokenSymbol: input.tokenSymbol },
    locale: input.locale ?? "en", createdAt: new Date().toISOString(), clientEntitlementTier: tier,
    verdict: { riskScore: null, riskLabel: "NOT_SCORED", confidenceScore: null, auditQualityScore: null,
      summary: `${receipt.status}. ${unknown}`, evidenceCoverage: null, verificationStatus: "UNVERIFIED", releaseDecision: "NOT_VERIFIED" },
    sections, humanReviewEvidencePresent: false, reportDigest: "",
    executionEvidence: { sourceMode: reference ? "reference-profile" : receipt.status === "STATIC_ANALYSIS_COMPLETED" ? "unverified-static-analysis" : "insufficient-evidence", qualification: "NOT_VERIFIED" },
    runtimeAnalysis: receipt,
  };
  const { reportDigest: _omitted, ...core } = report;
  void _omitted;
  return { ...report, reportDigest: sha256Digest(canonicalJson(core)) };
}
