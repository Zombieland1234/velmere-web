import type { P82CurrentDeploymentReadonlyQuorumReceipt } from "@/lib/security/audit-current-deployment-readonly-quorum-v2";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Hex } from "@/lib/security/cryptographic-digest";

export const VERIFY_CANONICAL_DEPLOYMENT_IDENTITY_V1 =
  "velmere.verify-canonical-deployment-identity.v1" as const;
export const VERIFY_CANONICAL_DEPLOYMENT_IDENTITY_DOMAIN =
  `${VERIFY_CANONICAL_DEPLOYMENT_IDENTITY_V1}\u001f` as const;

export type VerifyCanonicalDeploymentIdentity = {
  schemaVersion: typeof VERIFY_CANONICAL_DEPLOYMENT_IDENTITY_V1;
  chainId: string;
  contractAddress: string;
  runtimeBytecodeSha256: string;
  proxyKind: "EIP_1167_COMPATIBLE_MINIMAL_PROXY" | "NO_PROXY";
  implementationAddress: string | null;
  implementationBytecodeSha256: string | null;
  trustedForwarderSelector: string;
  trustedForwarderAddress: string;
  trustedForwarderState: "ACTIVE" | "INACTIVE";
  negativeControlAddress: string;
  negativeControlState: "INACTIVE";
};

const ADDRESS = /^0x[a-f0-9]{40}$/;
const HASH4 = /^0x[a-f0-9]{8}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;

function canonicalAddress(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ADDRESS.test(normalized) ? normalized : null;
}

function canonicalDigest(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return DIGEST.test(normalized) ? normalized : null;
}

export function buildVerifyCanonicalDeploymentIdentity(
  input: Omit<VerifyCanonicalDeploymentIdentity, "schemaVersion">,
): { identity: VerifyCanonicalDeploymentIdentity; digest: string } | null {
  const chainId = String(input.chainId ?? "").trim();
  const contractAddress = canonicalAddress(input.contractAddress);
  const runtimeBytecodeSha256 = canonicalDigest(input.runtimeBytecodeSha256);
  const trustedForwarderSelector = String(input.trustedForwarderSelector ?? "").trim().toLowerCase();
  const trustedForwarderAddress = canonicalAddress(input.trustedForwarderAddress);
  const negativeControlAddress = canonicalAddress(input.negativeControlAddress);
  if (
    !/^[1-9][0-9]{0,19}$/.test(chainId)
    || !contractAddress
    || !runtimeBytecodeSha256
    || !HASH4.test(trustedForwarderSelector)
    || !trustedForwarderAddress
    || !negativeControlAddress
    || !["ACTIVE", "INACTIVE"].includes(input.trustedForwarderState)
    || input.negativeControlState !== "INACTIVE"
    || contractAddress === negativeControlAddress
    || trustedForwarderAddress === negativeControlAddress
  ) return null;

  const proxyKind = input.proxyKind;
  const implementationAddress = input.implementationAddress === null
    ? null
    : canonicalAddress(input.implementationAddress);
  const implementationBytecodeSha256 = input.implementationBytecodeSha256 === null
    ? null
    : canonicalDigest(input.implementationBytecodeSha256);
  if (
    (proxyKind === "EIP_1167_COMPATIBLE_MINIMAL_PROXY"
      && (!implementationAddress || !implementationBytecodeSha256))
    || (proxyKind === "NO_PROXY"
      && (implementationAddress !== null || implementationBytecodeSha256 !== null))
    || !["EIP_1167_COMPATIBLE_MINIMAL_PROXY", "NO_PROXY"].includes(proxyKind)
  ) return null;

  const identity: VerifyCanonicalDeploymentIdentity = {
    schemaVersion: VERIFY_CANONICAL_DEPLOYMENT_IDENTITY_V1,
    chainId,
    contractAddress,
    runtimeBytecodeSha256,
    proxyKind,
    implementationAddress,
    implementationBytecodeSha256,
    trustedForwarderSelector,
    trustedForwarderAddress,
    trustedForwarderState: input.trustedForwarderState,
    negativeControlAddress,
    negativeControlState: "INACTIVE",
  };
  return {
    identity,
    digest: sha256Hex(`${VERIFY_CANONICAL_DEPLOYMENT_IDENTITY_DOMAIN}${canonicalJson(identity)}`),
  };
}

export function deriveVerifyCanonicalDeploymentIdentityFromP82(
  receipt: P82CurrentDeploymentReadonlyQuorumReceipt,
) {
  if (
    receipt.deployment.proxyKind !== "EIP_1167_COMPATIBLE_MINIMAL_PROXY"
    || !receipt.proof.exactBlockConsensusProven
    || !receipt.proof.currentRuntimeStateProven
    || !receipt.proof.currentProxyImplementationProven
    || !receipt.deployment.runtimeBytecodeSha256
    || !receipt.deployment.implementationAddress
    || !receipt.deployment.implementationBytecodeSha256
    || receipt.trustedForwarder.state === "WITHHELD"
    || receipt.trustedForwarder.negativeControlState !== "INACTIVE"
  ) return null;
  return buildVerifyCanonicalDeploymentIdentity({
    chainId: receipt.target.chainId,
    contractAddress: receipt.target.address,
    runtimeBytecodeSha256: receipt.deployment.runtimeBytecodeSha256,
    proxyKind: "EIP_1167_COMPATIBLE_MINIMAL_PROXY",
    implementationAddress: receipt.deployment.implementationAddress,
    implementationBytecodeSha256: receipt.deployment.implementationBytecodeSha256,
    trustedForwarderSelector: receipt.trustedForwarder.selector,
    trustedForwarderAddress: receipt.trustedForwarder.address,
    trustedForwarderState: receipt.trustedForwarder.state,
    negativeControlAddress: receipt.trustedForwarder.negativeControlAddress,
    negativeControlState: "INACTIVE",
  });
}
