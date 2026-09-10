/**
 * Velmère Furnace — World-Class Institutional Smart Contract Audit
 * Canonical Audit Object Model (V3 Integrated Master Specification)
 *
 * Adheres to:
 * CLAIM == OBSERVATION == EXECUTION RECORD == EVIDENCE == ARTIFACT
 * Zero synthetic claims. Zero invented completeness. Fail closed.
 */

import { createHash } from 'node:crypto';

export type SourceProvenanceStatus =
  | 'SOURCE_VERIFIED_EXACT'
  | 'SOURCE_UNVERIFIED'
  | 'BYTECODE_ONLY';

export type ReviewerLifecycleState =
  | 'AUTOMATED_ONLY'
  | 'PARTIALLY_VERIFIED'
  | 'FORMALLY_VERIFIED'
  | 'HUMAN_REVIEWED';

export type ExecutionStatus =
  | 'SUPPORTED'
  | 'REGISTERED'
  | 'SCHEDULED'
  | 'EXECUTED'
  | 'FAILED_TO_EXECUTE'
  | 'TIMEOUT'
  | 'RESULT_AVAILABLE';

export interface AuditTarget {
  readonly chainId: string;
  readonly contractAddress: string;
  readonly contractName: string;
  readonly tokenSymbol?: string;
  readonly deploymentBlockNumber?: number;
  readonly deploymentBlockHash?: string;
  readonly snapshotBlockNumber: number;
  readonly snapshotBlockHash: string;
  readonly snapshotTimestamp: string;
  readonly runtimeBytecodeSha256: string;
  readonly creationBytecodeSha256?: string;
  readonly compilerVersion: string;
  readonly optimizerSettings: {
    readonly enabled: boolean;
    readonly runs: number;
  };
  readonly evmVersion: string;
  readonly sourceProvenance: SourceProvenanceStatus;
  readonly metadataHash?: string;
}

export interface DeploymentSnapshot {
  readonly chainId: string;
  readonly blockNumber: number;
  readonly blockHash: string;
  readonly runtimeBytecodeHash: string;
  readonly observedAt: string;
  readonly rpcEndpointClass: 'ARCHIVE_NODE' | 'FULL_NODE' | 'PINNED_FIXTURE';
}

export interface CompilationProvenance {
  readonly compiler: 'solc' | 'vyper';
  readonly version: string;
  readonly commitHash: string;
  readonly standardJsonInputSha256: string;
  readonly optimizer: {
    readonly enabled: boolean;
    readonly runs: number;
  };
  readonly evmVersion: string;
  readonly libraries: Record<string, string>;
  readonly remappings: string[];
}

export interface ReviewerState {
  readonly status: ReviewerLifecycleState;
  readonly reviewedBy?: string;
  readonly reviewDate?: string;
  readonly signedAttestationHash?: string;
  readonly externalAttestationRef?: string;
}

/**
 * Validates that reviewer claims do not invent synthetic human sign-offs.
 * If status is HUMAN_REVIEWED, a valid signedAttestationHash and reviewedBy MUST exist.
 * Otherwise, status MUST be AUTOMATED_ONLY, PARTIALLY_VERIFIED, or FORMALLY_VERIFIED.
 */
export function validateReviewerTruth(state: ReviewerState): void {
  if (state.status === 'HUMAN_REVIEWED') {
    if (!state.reviewedBy || !state.signedAttestationHash || state.signedAttestationHash.length < 32) {
      throw new Error(
        '[FAIL-CLOSED REALITY PRINCIPLE] Cannot claim HUMAN_REVIEWED without verified external reviewer evidence and signature digest.'
      );
    }
    const forbiddenSyntheticNames = [
      'principal auditor',
      'lead auditor',
      'velmère institutional principal auditor',
      'independent reviewer',
      'automation council',
    ];
    if (forbiddenSyntheticNames.some((n) => state.reviewedBy?.toLowerCase().includes(n))) {
      throw new Error(
        `[FAIL-CLOSED REALITY PRINCIPLE] Forbidden synthetic reviewer name detected: "${state.reviewedBy}". Must be an authentic external individual or entity.`
      );
    }
  }
}

export interface EvmAuditScopeMatrix {
  readonly staticAstAnalysis: boolean;
  readonly dynamicSimulation: boolean;
  readonly formalVerification: boolean;
  readonly economicMevInspection: boolean;
  readonly proxyAuthorityInspection: boolean;
  readonly fuzzCampaignExecuted: boolean;
  readonly forkTestExecuted: boolean;
}

export function computeSha256(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}
