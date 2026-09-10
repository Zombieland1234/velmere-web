/**
 * Velmère Audit Merkle Commitment Engine (V2 Directive Section 43.5)
 * Commits all analytical findings and sections into a cryptographic Merkle Root.
 * Basic tier embeds the root commitment; Pro & Advanced tiers provide cryptographic inclusion proofs.
 */

import crypto from "crypto";

export interface LeafProvenanceMetadata {
  chainId?: string;
  blockNumber?: number;
  blockHash?: string;
  contractAddress?: string;
  bytecodeHash?: string;
  implementationAddress?: string;
  implementationBytecodeHash?: string;
  rpcEndpointIdentity?: string;
  retrievalTimestamp?: string;
  analysisVersion?: string;
  schemaVersion?: string;
}

export interface MerkleLeaf {
  sectionId: string;
  leafHash: string;
  requiredTier: "basic" | "pro" | "advanced";
  description: string;
  provenance?: LeafProvenanceMetadata;
}

export interface MerkleInclusionProof {
  sectionId: string;
  leafHash: string;
  leafIndex: number;
  root: string;
  siblingPath: Array<{
    position: "left" | "right";
    hash: string;
  }>;
}

export interface MerkleCommitmentPackage {
  merkleRoot: string;
  leafCount: number;
  leaves: MerkleLeaf[];
  generateProof(sectionId: string): MerkleInclusionProof | null;
  verifyProof(proof: MerkleInclusionProof): boolean;
}

function hashPair(left: string, right: string): string {
  return crypto
    .createHash("sha256")
    .update(`pair:${left}:${right}`)
    .digest("hex");
}

export interface SemanticReportContext {
  riskScore?: number;
  auditQualityScore?: number;
  targetAddress?: string;
  chainId?: string;
  reportId?: string;
  tier?: string;
  locale?: string;
}

export function buildAuditMerkleCommitment(
  sections: Array<{
    id: string;
    requiredTier: "basic" | "pro" | "advanced";
    title: string;
    data?: unknown;
    sampleSummaryLines?: string[];
  }>,
  provenance?: LeafProvenanceMetadata,
  semanticContext?: SemanticReportContext
): MerkleCommitmentPackage {
  const leaves: MerkleLeaf[] = sections.map((s) => {
    const serialized = JSON.stringify({
      id: s.id,
      tier: s.requiredTier,
      title: s.title,
      sampleLines: s.sampleSummaryLines || [],
      ...(s.data ? { data: s.data } : {}),
      ...(provenance ? { provenance } : {}),
      ...(semanticContext ? { semanticContext } : {}),
    });
    const leafHash = crypto.createHash("sha256").update(serialized).digest("hex");
    return {
      sectionId: s.id,
      leafHash,
      requiredTier: s.requiredTier,
      description: s.title,
      provenance,
    };
  });

  // Calculate Merkle Tree layers
  let currentLayer = leaves.map((l) => l.leafHash);
  const layers: string[][] = [currentLayer];

  if (currentLayer.length === 0) {
    const emptyRoot = crypto.createHash("sha256").update("EMPTY_TREE").digest("hex");
    return {
      merkleRoot: `sha256:${emptyRoot}`,
      leafCount: 0,
      leaves: [],
      generateProof: () => null,
      verifyProof: () => false,
    };
  }

  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;
      nextLayer.push(hashPair(left, right));
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  const merkleRoot = `sha256:${layers[layers.length - 1][0]}`;

  function generateProof(sectionId: string): MerkleInclusionProof | null {
    const index = leaves.findIndex((l) => l.sectionId === sectionId);
    if (index === -1) return null;

    const proofPath: Array<{ position: "left" | "right"; hash: string }> = [];
    let idx = index;

    for (let layerIdx = 0; layerIdx < layers.length - 1; layerIdx++) {
      const layer = layers[layerIdx];
      const isRight = idx % 2 === 1;
      const pairIdx = isRight ? idx - 1 : idx + 1;

      if (pairIdx < layer.length) {
        proofPath.push({
          position: isRight ? "left" : "right",
          hash: layer[pairIdx],
        });
      } else {
        // Odd node paired with itself
        proofPath.push({
          position: "right",
          hash: layer[idx],
        });
      }

      idx = Math.floor(idx / 2);
    }

    return {
      sectionId,
      leafHash: leaves[index].leafHash,
      leafIndex: index,
      root: merkleRoot,
      siblingPath: proofPath,
    };
  }

  function verifyProof(proof: MerkleInclusionProof): boolean {
    let currentHash = proof.leafHash;
    for (const step of proof.siblingPath) {
      if (step.position === "left") {
        currentHash = hashPair(step.hash, currentHash);
      } else {
        currentHash = hashPair(currentHash, step.hash);
      }
    }
    return `sha256:${currentHash}` === proof.root;
  }

  return {
    merkleRoot,
    leafCount: leaves.length,
    leaves,
    generateProof,
    verifyProof,
  };
}
