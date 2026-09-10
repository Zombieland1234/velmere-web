/**
 * VELMÈRE ULTIMATE EVIDENCE-FIRST AUDIT PLATFORM
 * MERKLE TREE ENGINE FOR EVIDENCE VERIFICATION
 * 
 * Computes deterministic cryptographic evidenceRoot over all artifact leaf hashes.
 */

import crypto from "crypto";

export function sha256(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function computeMerkleRoot(leafHashes: string[]): string {
  if (leafHashes.length === 0) {
    return "0000000000000000000000000000000000000000000000000000000000000000";
  }

  // Sort leaf hashes to guarantee canonical determinism
  let currentLevel = [...leafHashes].sort();

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        const combined = currentLevel[i] + currentLevel[i + 1];
        nextLevel.push(sha256(combined));
      } else {
        // Odd number of leaves: duplicate last element
        const combined = currentLevel[i] + currentLevel[i];
        nextLevel.push(sha256(combined));
      }
    }
    currentLevel = nextLevel;
  }

  return currentLevel[0];
}
