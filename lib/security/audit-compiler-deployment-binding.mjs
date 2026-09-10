import crypto from "node:crypto";
import { verifySolidityCompilerAstEvidence } from "./solidity-compiler-ast-runtime.mjs";

export const AUDIT_COMPILER_DEPLOYMENT_BINDING_SCHEMA = "velmere.pass36.a102r44p39.audit-compiler-deployment-binding.v1";
export const AUDIT_EIP1967_PROXY_BINDING_SCHEMA = "velmere.pass36.a102r44p39.audit-eip1967-proxy-binding.v1";
export const EIP1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

const ADDRESS = /^0x[a-f0-9]{40}$/u;
const WORD = /^0x[a-f0-9]{64}$/u;
const DIGEST = /^sha256:[a-f0-9]{64}$/u;
const sha256 = (value) => `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
const stable = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
};

function normalizeHex(value) {
  const text = String(value ?? "").toLowerCase().replace(/^0x/u, "");
  return /^(?:[a-f0-9]{2})+$/u.test(text) ? text : null;
}

function stripMetadata(value) {
  const hex = normalizeHex(value);
  if (!hex || hex.length < 4) return { core: hex, metadataBytes: 0, stripped: false };
  const metadataBytes = Number.parseInt(hex.slice(-4), 16);
  const suffixLength = (metadataBytes + 2) * 2;
  if (!Number.isInteger(metadataBytes) || metadataBytes <= 0 || suffixLength >= hex.length) return { core: hex, metadataBytes: 0, stripped: false };
  return { core: hex.slice(0, -suffixLength), metadataBytes, stripped: true };
}

export function buildAuditCompilerDeploymentBinding({ evidence, sourceFiles, sourcePath, contractName, deployedRuntimeBytecode, chainId = null, address = null, blockNumber = null, evidenceClass = "LOCAL_SUPPLIED_RUNTIME_SNAPSHOT" }) {
  const compilerVerification = verifySolidityCompilerAstEvidence(evidence, sourceFiles);
  const artifact = evidence?.bytecodeArtifacts?.find((row) => row.sourcePath === sourcePath && row.contractName === contractName) ?? null;
  const compiled = normalizeHex(artifact?.deployedBytecode);
  const deployed = normalizeHex(deployedRuntimeBytecode);
  const compiledCore = stripMetadata(compiled);
  const deployedCore = stripMetadata(deployed);
  let status = "BLOCKED";
  if (compilerVerification.ok && artifact && compiled && deployed) {
    if (compiled === deployed) status = "EXACT_MATCH";
    else if (compiledCore.core && compiledCore.core === deployedCore.core && (compiledCore.stripped || deployedCore.stripped)) status = "MATCH_AFTER_SOLIDITY_METADATA_STRIP";
    else status = "MISMATCH";
  }
  const blockers = [
    !compilerVerification.ok ? "compiler_evidence_invalid" : null,
    !artifact ? "compiled_contract_artifact_missing" : null,
    !compiled ? "compiled_runtime_bytecode_missing_or_invalid" : null,
    !deployed ? "deployed_runtime_bytecode_missing_or_invalid" : null,
    address !== null && !ADDRESS.test(String(address).toLowerCase()) ? "contract_address_invalid" : null,
    blockNumber !== null && (!Number.isInteger(blockNumber) || blockNumber < 0) ? "block_number_invalid" : null,
    status === "MISMATCH" ? "runtime_bytecode_mismatch" : null,
  ].filter(Boolean);
  const core = {
    schemaVersion: AUDIT_COMPILER_DEPLOYMENT_BINDING_SCHEMA,
    status,
    sourcePath,
    contractName,
    chainId: chainId === null ? null : String(chainId),
    address: address === null ? null : String(address).toLowerCase(),
    blockNumber,
    evidenceClass,
    compilerEvidenceSha256: evidence?.evidenceSha256 ?? null,
    sourceBundleSha256: evidence?.inputIdentity?.sourceBundleSha256 ?? null,
    settingsSha256: evidence?.inputIdentity?.settingsSha256 ?? null,
    compiledRuntimeSha256: compiled ? sha256(Buffer.from(compiled, "hex")) : null,
    deployedRuntimeSha256: deployed ? sha256(Buffer.from(deployed, "hex")) : null,
    compiledCoreSha256: compiledCore.core ? sha256(Buffer.from(compiledCore.core, "hex")) : null,
    deployedCoreSha256: deployedCore.core ? sha256(Buffer.from(deployedCore.core, "hex")) : null,
    compiledMetadataBytes: compiledCore.metadataBytes,
    deployedMetadataBytes: deployedCore.metadataBytes,
    blockers,
    creditBoundary: {
      localSuppliedBytecodeBindingCredit: blockers.length === 0 && ["EXACT_MATCH", "MATCH_AFTER_SOLIDITY_METADATA_STRIP"].includes(status),
      providerRetrievedBytecodeCredit: false,
      realChainObservationCredit: false,
      sourceVerificationCredit: false,
      exploitabilityCredit: false,
      customerCredit: false,
      saleCredit: false,
      liveCredit: false,
    },
    truthBoundary: "A match proves equality between exact compiler output and supplied runtime bytes under the recorded normalization. It does not prove that the bytes were retrieved from the claimed chain, block or address.",
  };
  return { ...core, bindingSha256: sha256(stable(core)) };
}

export function verifyAuditCompilerDeploymentBinding(value) {
  if (!value || typeof value !== "object") return false;
  const { bindingSha256, ...core } = value;
  const status = String(value.status ?? "");
  const blockers = Array.isArray(value.blockers) ? value.blockers : null;
  const accepted = ["EXACT_MATCH", "MATCH_AFTER_SOLIDITY_METADATA_STRIP"].includes(status);
  const digestFields = [
    value.compilerEvidenceSha256,
    value.sourceBundleSha256,
    value.settingsSha256,
    value.compiledRuntimeSha256,
    value.deployedRuntimeSha256,
    value.compiledCoreSha256,
    value.deployedCoreSha256,
  ];
  const common = value.schemaVersion === AUDIT_COMPILER_DEPLOYMENT_BINDING_SCHEMA
    && DIGEST.test(String(bindingSha256 ?? ""))
    && bindingSha256 === sha256(stable(core))
    && blockers !== null
    && ["EXACT_MATCH", "MATCH_AFTER_SOLIDITY_METADATA_STRIP", "MISMATCH", "BLOCKED"].includes(status)
    && (value.address === null || ADDRESS.test(String(value.address)))
    && (value.blockNumber === null || (Number.isInteger(value.blockNumber) && value.blockNumber >= 0))
    && digestFields.every((entry) => entry === null || DIGEST.test(String(entry)))
    && value.creditBoundary?.providerRetrievedBytecodeCredit === false
    && value.creditBoundary?.realChainObservationCredit === false
    && value.creditBoundary?.sourceVerificationCredit === false
    && value.creditBoundary?.exploitabilityCredit === false
    && value.creditBoundary?.customerCredit === false
    && value.creditBoundary?.saleCredit === false
    && value.creditBoundary?.liveCredit === false;
  if (!common) return false;
  if (status === "EXACT_MATCH") {
    return blockers.length === 0
      && value.compiledRuntimeSha256 === value.deployedRuntimeSha256
      && value.creditBoundary?.localSuppliedBytecodeBindingCredit === true;
  }
  if (status === "MATCH_AFTER_SOLIDITY_METADATA_STRIP") {
    return blockers.length === 0
      && value.compiledCoreSha256 === value.deployedCoreSha256
      && (Number(value.compiledMetadataBytes) > 0 || Number(value.deployedMetadataBytes) > 0)
      && value.creditBoundary?.localSuppliedBytecodeBindingCredit === true;
  }
  if (status === "MISMATCH") {
    return blockers.includes("runtime_bytecode_mismatch")
      && value.creditBoundary?.localSuppliedBytecodeBindingCredit === false;
  }
  return blockers.length > 0 && accepted === false && value.creditBoundary?.localSuppliedBytecodeBindingCredit === false;
}

export function buildAuditEip1967ProxyBinding({ implementationBinding, proxyAddress, implementationAddress, implementationSlot = EIP1967_IMPLEMENTATION_SLOT, rawImplementationStorageWord, proxyRuntimeBytecode, chainId = null, blockNumber = null, evidenceClass = "LOCAL_SUPPLIED_EIP1967_SNAPSHOT" }) {
  const normalizedProxy = String(proxyAddress ?? "").toLowerCase();
  const normalizedImplementation = String(implementationAddress ?? "").toLowerCase();
  const normalizedSlot = String(implementationSlot ?? "").toLowerCase();
  const word = String(rawImplementationStorageWord ?? "").toLowerCase();
  const parsedImplementation = WORD.test(word) ? `0x${word.slice(-40)}` : null;
  const proxyRuntime = normalizeHex(proxyRuntimeBytecode);
  const implementationBindingValid = verifyAuditCompilerDeploymentBinding(implementationBinding);
  const blockers = [
    !implementationBindingValid ? "implementation_binding_invalid" : null,
    !ADDRESS.test(normalizedProxy) ? "proxy_address_invalid" : null,
    !ADDRESS.test(normalizedImplementation) ? "implementation_address_invalid" : null,
    normalizedSlot !== EIP1967_IMPLEMENTATION_SLOT ? "implementation_slot_not_eip1967" : null,
    !WORD.test(word) ? "implementation_storage_word_invalid" : null,
    parsedImplementation !== normalizedImplementation ? "implementation_slot_address_mismatch" : null,
    !proxyRuntime ? "proxy_runtime_bytecode_missing_or_invalid" : null,
    blockNumber !== null && (!Number.isInteger(blockNumber) || blockNumber < 0) ? "block_number_invalid" : null,
    implementationBinding?.status !== "EXACT_MATCH" && implementationBinding?.status !== "MATCH_AFTER_SOLIDITY_METADATA_STRIP" ? "implementation_runtime_not_bound" : null,
  ].filter(Boolean);
  const core = {
    schemaVersion: AUDIT_EIP1967_PROXY_BINDING_SCHEMA,
    status: blockers.length === 0 ? "BOUND_LOCAL_EIP1967_SNAPSHOT" : "BLOCKED",
    proxyAddress: normalizedProxy || null,
    implementationAddress: normalizedImplementation || null,
    parsedImplementationAddress: parsedImplementation,
    implementationSlot: normalizedSlot,
    rawImplementationStorageWordSha256: WORD.test(word) ? sha256(Buffer.from(word.slice(2), "hex")) : null,
    proxyRuntimeSha256: proxyRuntime ? sha256(Buffer.from(proxyRuntime, "hex")) : null,
    implementationBindingSha256: implementationBinding?.bindingSha256 ?? null,
    chainId: chainId === null ? null : String(chainId),
    blockNumber,
    evidenceClass,
    blockers,
    creditBoundary: {
      localSuppliedProxyBindingCredit: blockers.length === 0,
      providerRetrievedStorageCredit: false,
      realChainObservationCredit: false,
      upgradeGovernanceCredit: false,
      customerCredit: false,
      saleCredit: false,
      liveCredit: false,
    },
    truthBoundary: "The supplied EIP-1967 slot word, proxy bytes and compiler-bound implementation bytes are internally consistent. No RPC retrieval, chain finality, admin governance or live upgrade safety is proven.",
  };
  return { ...core, proxyBindingSha256: sha256(stable(core)) };
}

export function verifyAuditEip1967ProxyBinding(value) {
  if (!value || typeof value !== "object") return false;
  const { proxyBindingSha256, ...core } = value;
  const status = String(value.status ?? "");
  const blockers = Array.isArray(value.blockers) ? value.blockers : null;
  const common = value.schemaVersion === AUDIT_EIP1967_PROXY_BINDING_SCHEMA
    && DIGEST.test(String(proxyBindingSha256 ?? ""))
    && proxyBindingSha256 === sha256(stable(core))
    && blockers !== null
    && ["BOUND_LOCAL_EIP1967_SNAPSHOT", "BLOCKED"].includes(status)
    && ADDRESS.test(String(value.proxyAddress ?? ""))
    && ADDRESS.test(String(value.implementationAddress ?? ""))
    && (value.parsedImplementationAddress === null || ADDRESS.test(String(value.parsedImplementationAddress)))
    && value.implementationSlot === EIP1967_IMPLEMENTATION_SLOT
    && (value.rawImplementationStorageWordSha256 === null || DIGEST.test(String(value.rawImplementationStorageWordSha256)))
    && (value.proxyRuntimeSha256 === null || DIGEST.test(String(value.proxyRuntimeSha256)))
    && DIGEST.test(String(value.implementationBindingSha256 ?? ""))
    && (value.blockNumber === null || (Number.isInteger(value.blockNumber) && value.blockNumber >= 0))
    && value.creditBoundary?.providerRetrievedStorageCredit === false
    && value.creditBoundary?.realChainObservationCredit === false
    && value.creditBoundary?.upgradeGovernanceCredit === false
    && value.creditBoundary?.customerCredit === false
    && value.creditBoundary?.saleCredit === false
    && value.creditBoundary?.liveCredit === false;
  if (!common) return false;
  if (status === "BOUND_LOCAL_EIP1967_SNAPSHOT") {
    return blockers.length === 0
      && value.parsedImplementationAddress === value.implementationAddress
      && value.creditBoundary?.localSuppliedProxyBindingCredit === true;
  }
  return blockers.length > 0 && value.creditBoundary?.localSuppliedProxyBindingCredit === false;
}
