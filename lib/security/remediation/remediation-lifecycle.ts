/**
 * VELMÈRE REMEDIATION STATE MACHINE
 * 
 * Enforces strict transitions:
 * FOUND -> ACKNOWLEDGED -> FIX_IN_PROGRESS -> FIXED -> RETESTED -> RESOLVED -> REOPENED
 * 
 * Cannot mark FIXED without proof of code diff / commit.
 * Cannot mark RESOLVED without passing retest execution trace.
 */

export type RemediationState =
  | "FOUND"
  | "ACKNOWLEDGED"
  | "FIX_IN_PROGRESS"
  | "FIXED"
  | "RETESTED"
  | "RESOLVED"
  | "REOPENED";

export interface FindingRemediationRecord {
  findingId: string;
  currentState: RemediationState;
  stateHistory: {
    state: RemediationState;
    timestamp: string;
    actor: string;
    evidenceHash?: string;
    notes?: string;
  }[];
  fixCommitHash?: string;
  remediationDiff?: string;
  retestExecutionHash?: string;
  isResolved: boolean;
}

export class RemediationStateMachine {
  public static transition(
    record: FindingRemediationRecord,
    targetState: RemediationState,
    payload: {
      actor: string;
      evidenceHash?: string;
      notes?: string;
      fixCommitHash?: string;
      remediationDiff?: string;
      retestExecutionHash?: string;
      retestPassed?: boolean;
    },
  ): FindingRemediationRecord {
    const current = record.currentState;
    const now = new Date().toISOString();

    // Validate valid state transitions
    if (targetState === "ACKNOWLEDGED") {
      if (current !== "FOUND" && current !== "REOPENED") {
        throw new Error(`Cannot acknowledge finding from state ${current}.`);
      }
    } else if (targetState === "FIX_IN_PROGRESS") {
      if (current !== "ACKNOWLEDGED") {
        throw new Error(`Cannot start fix without prior acknowledgement.`);
      }
    } else if (targetState === "FIXED") {
      if (current !== "FIX_IN_PROGRESS") {
        throw new Error(`Cannot transition to FIXED directly from ${current}. Must be FIX_IN_PROGRESS.`);
      }
      if (!payload.fixCommitHash && !payload.remediationDiff) {
        throw new Error(`Cannot mark finding as FIXED without fixCommitHash or remediationDiff.`);
      }
      record.fixCommitHash = payload.fixCommitHash;
      record.remediationDiff = payload.remediationDiff;
    } else if (targetState === "RETESTED") {
      if (current !== "FIXED") {
        throw new Error(`Cannot retest finding unless marked FIXED.`);
      }
      if (!payload.retestExecutionHash) {
        throw new Error(`Cannot transition to RETESTED without retestExecutionHash.`);
      }
      record.retestExecutionHash = payload.retestExecutionHash;
      if (payload.retestPassed === false) {
        return this.transition(record, "REOPENED", {
          actor: payload.actor,
          notes: "Automated retest failed. Vulnerability remains exploitable.",
        });
      }
    } else if (targetState === "RESOLVED") {
      if (current !== "RETESTED") {
        throw new Error(`Cannot mark RESOLVED without successful RETESTED state.`);
      }
      record.isResolved = true;
    } else if (targetState === "REOPENED") {
      record.isResolved = false;
    }

    record.currentState = targetState;
    record.stateHistory.push({
      state: targetState,
      timestamp: now,
      actor: payload.actor,
      evidenceHash: payload.evidenceHash,
      notes: payload.notes,
    });

    return record;
  }
}
