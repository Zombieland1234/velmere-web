import crypto from "node:crypto";
import { verifyAuditCompilerAstReviewLayer } from "./audit-compiler-ast-review-layer.mjs";
import { verifyAuditCompilerDeploymentBinding, verifyAuditEip1967ProxyBinding } from "./audit-compiler-deployment-binding.mjs";

export const AUDIT_COMPILER_CANONICAL_PACKET_SCHEMA = "velmere.pass36.a102r44p39.audit-compiler-canonical-packet.v1";
const TIERS = ["basic", "pro", "advanced"];
const sha256 = (value) => `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
const stable = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
};

function minimalFinding(row) {
  return {
    findingId: `AST-${crypto.createHash("sha256").update(`${row.ruleId}|${row.sourcePath}|${row.line}|${row.title}`).digest("hex").slice(0, 16).toUpperCase()}`,
    ruleId: row.ruleId,
    severity: row.severity,
    title: row.title,
    sourcePath: row.sourcePath,
    line: row.line,
    confidenceState: "NOT_CALIBRATED",
    evidenceState: "COMPILER_BACKED_BOUNDED_REVIEW_SIGNAL",
  };
}

export function buildAuditCompilerCanonicalPacket({ tier, caseRef, reviewLayer, deploymentBinding = null, proxyBinding = null, locale = "en" }) {
  if (!TIERS.includes(tier)) throw new Error(`audit_packet_tier_invalid:${tier}`);
  if (!verifyAuditCompilerAstReviewLayer(reviewLayer) || reviewLayer.accepted !== true) throw new Error("audit_packet_review_layer_invalid");
  if (deploymentBinding && !verifyAuditCompilerDeploymentBinding(deploymentBinding)) throw new Error("audit_packet_deployment_binding_invalid");
  if (proxyBinding && !verifyAuditEip1967ProxyBinding(proxyBinding)) throw new Error("audit_packet_proxy_binding_invalid");
  const identities = reviewLayer.findings.map(minimalFinding).sort((a, b) => a.findingId.localeCompare(b.findingId));
  const findings = identities.map((identity) => {
    const full = reviewLayer.findings.find((row) => row.ruleId === identity.ruleId && row.sourcePath === identity.sourcePath && row.line === identity.line && row.title === identity.title);
    return {
      ...identity,
      ...(tier === "basic" ? {} : {
        description: full?.description ?? "",
        safeRemediation: full?.safeRemediation ?? "",
        excerpt: full?.excerpt ?? "",
        compilerEvidenceSha256: reviewLayer.evidenceSha256,
      }),
      ...(tier === "advanced" ? {
        limitations: [...(full?.limitations ?? [])],
        deploymentBindingSha256: deploymentBinding?.bindingSha256 ?? null,
        proxyBindingSha256: proxyBinding?.proxyBindingSha256 ?? null,
      } : {}),
    };
  });
  const findingIdentitySha256 = sha256(stable(identities));
  const severitySha256 = sha256(stable(identities.map(({ findingId, severity }) => ({ findingId, severity }))));
  const core = {
    schemaVersion: AUDIT_COMPILER_CANONICAL_PACKET_SCHEMA,
    caseRef,
    tier,
    locale,
    availability: tier === "advanced" ? "NOT_FOR_SALE" : tier === "pro" ? "INVITATION_ONLY_CONTROLLED_BETA" : "FREE_ACTION_REQUIRED",
    findingConfidence: "NOT_CALIBRATED",
    findingCount: identities.length,
    findingIdentitySha256,
    severitySha256,
    reviewLayerSha256: reviewLayer.reviewLayerSha256,
    deploymentBindingStatus: deploymentBinding?.status ?? "NOT_SUPPLIED",
    proxyBindingStatus: proxyBinding?.status ?? "NOT_APPLICABLE",
    findings,
    registers: {
      contradictionRegister: [],
      missingProofRegister: [
        "independent_ground_truth_missing",
        "exploitability_not_proven",
        "real_protocol_accuracy_not_proven",
        ...(deploymentBinding?.creditBoundary?.realChainObservationCredit === false ? ["real_chain_observation_missing"] : []),
      ],
    },
    customerTruth: {
      analysisCompleted: true,
      contractSafeClaimAllowed: false,
      certificationClaimAllowed: false,
      humanReviewIncluded: false,
      independentReviewPerformed: false,
      exploitabilityProven: false,
      numericFindingConfidenceAllowed: false,
      tierChangesFindingTruth: false,
      detailDepth: tier === "basic" ? "SUMMARY" : tier === "pro" ? "EVIDENCE_AND_REMEDIATION" : "FULL_EVIDENCE_GOVERNANCE_APPENDIX",
      nextSafeAction: "Review the compiler-backed signal, reproduce it with targeted tests, and obtain independent adjudication before treating it as a vulnerability claim.",
    },
    creditBoundary: {
      localPacketParityCredit: true,
      customerPathIntegrationCredit: false,
      independentGroundTruthCredit: false,
      customerCredit: false,
      paidSaleCredit: false,
      liveCredit: false,
      worldClassCredit: false,
    },
  };
  return { ...core, packetSha256: sha256(stable(core)) };
}


function packetIdentity(row) {
  return {
    findingId: row?.findingId,
    ruleId: row?.ruleId,
    severity: row?.severity,
    title: row?.title,
    sourcePath: row?.sourcePath,
    line: row?.line,
    confidenceState: row?.confidenceState,
    evidenceState: row?.evidenceState,
  };
}

export function verifyAuditCompilerCanonicalPacket(value) {
  if (!value || typeof value !== "object") return false;
  const { packetSha256, ...core } = value;
  const tier = String(value.tier ?? "");
  const findings = Array.isArray(value.findings) ? value.findings : null;
  if (value.schemaVersion !== AUDIT_COMPILER_CANONICAL_PACKET_SCHEMA
    || !TIERS.includes(tier)
    || typeof value.caseRef !== "string" || value.caseRef.length === 0
    || typeof packetSha256 !== "string" || packetSha256 !== sha256(stable(core))
    || findings === null || value.findingCount !== findings.length) return false;
  const identities = findings.map(packetIdentity).sort((a, b) => String(a.findingId).localeCompare(String(b.findingId)));
  if (new Set(identities.map((row) => row.findingId)).size !== identities.length
    || identities.some((row) => typeof row.findingId !== "string" || row.confidenceState !== "NOT_CALIBRATED" || row.evidenceState !== "COMPILER_BACKED_BOUNDED_REVIEW_SIGNAL")
    || value.findingIdentitySha256 !== sha256(stable(identities))
    || value.severitySha256 !== sha256(stable(identities.map(({ findingId, severity }) => ({ findingId, severity }))))) return false;
  const expectedAvailability = tier === "advanced" ? "NOT_FOR_SALE" : tier === "pro" ? "INVITATION_ONLY_CONTROLLED_BETA" : "FREE_ACTION_REQUIRED";
  const expectedDepth = tier === "basic" ? "SUMMARY" : tier === "pro" ? "EVIDENCE_AND_REMEDIATION" : "FULL_EVIDENCE_GOVERNANCE_APPENDIX";
  const depthValid = tier === "basic"
    ? findings.every((row) => !("description" in row) && !("safeRemediation" in row) && !("limitations" in row))
    : tier === "pro"
      ? findings.every((row) => typeof row.description === "string" && typeof row.safeRemediation === "string" && typeof row.excerpt === "string" && !("limitations" in row))
      : findings.every((row) => typeof row.description === "string" && typeof row.safeRemediation === "string" && Array.isArray(row.limitations));
  return value.availability === expectedAvailability
    && value.findingConfidence === "NOT_CALIBRATED"
    && value.customerTruth?.detailDepth === expectedDepth
    && value.customerTruth?.contractSafeClaimAllowed === false
    && value.customerTruth?.certificationClaimAllowed === false
    && value.customerTruth?.humanReviewIncluded === false
    && value.customerTruth?.independentReviewPerformed === false
    && value.customerTruth?.exploitabilityProven === false
    && value.customerTruth?.numericFindingConfidenceAllowed === false
    && value.customerTruth?.tierChangesFindingTruth === false
    && value.creditBoundary?.customerPathIntegrationCredit === false
    && value.creditBoundary?.independentGroundTruthCredit === false
    && value.creditBoundary?.customerCredit === false
    && value.creditBoundary?.paidSaleCredit === false
    && value.creditBoundary?.liveCredit === false
    && value.creditBoundary?.worldClassCredit === false
    && depthValid;
}

export function verifyAuditCompilerPacketSet(packets) {
  const rows = [];
  const check = (id, ok, detail = null) => rows.push({ id, passed: Boolean(ok), detail });
  check("three-tiers", Array.isArray(packets) && packets.length === 3 && TIERS.every((tier) => packets.some((row) => row?.tier === tier)));
  const ordered = TIERS.map((tier) => packets.find((row) => row?.tier === tier));
  check("schemas-and-self-digests", ordered.every((row) => verifyAuditCompilerCanonicalPacket(row)));
  check("same-case", new Set(ordered.map((row) => row?.caseRef)).size === 1);
  check("same-finding-count", new Set(ordered.map((row) => row?.findingCount)).size === 1);
  check("same-finding-identity", new Set(ordered.map((row) => row?.findingIdentitySha256)).size === 1);
  check("same-severity", new Set(ordered.map((row) => row?.severitySha256)).size === 1);
  check("confidence-not-calibrated", ordered.every((row) => row?.findingConfidence === "NOT_CALIBRATED" && row?.customerTruth?.numericFindingConfidenceAllowed === false));
  check("tier-does-not-change-truth", ordered.every((row) => row?.customerTruth?.tierChangesFindingTruth === false));
  check("depth-increases", ordered[0]?.findings.every((row) => !("description" in row)) && ordered[1]?.findings.every((row) => "description" in row) && ordered[2]?.findings.every((row) => "limitations" in row));
  check("availability", ordered[0]?.availability === "FREE_ACTION_REQUIRED" && ordered[1]?.availability === "INVITATION_ONLY_CONTROLLED_BETA" && ordered[2]?.availability === "NOT_FOR_SALE");
  check("no-promotion", ordered.every((row) => row?.creditBoundary?.paidSaleCredit === false && row?.creditBoundary?.liveCredit === false && row?.creditBoundary?.worldClassCredit === false));
  const failed = rows.filter((row) => !row.passed);
  return { status: failed.length ? "FAIL_AUDIT_COMPILER_PACKET_SET" : "PASS_AUDIT_COMPILER_PACKET_SET", checks: rows.length, passed: rows.length - failed.length, failed: failed.length, rows };
}
