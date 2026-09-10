/**
 * Velmère Multi-Provider Failover & Quorum Engine
 * Orchestrates Primary -> Secondary -> Tertiary failover across independent data upstreams.
 * Invariant: TRUTH OVER COVERAGE. Never hallucinate data on provider failure.
 */

import { FieldObservationAttempt, FieldCompletenessDiagnosis, diagnoseFieldCompleteness } from "./completeness-root-cause-engine";

export interface ProviderQueryConfig<T> {
  providerName: string;
  fetcher: () => Promise<T>;
  timeoutMs?: number;
}

export interface MultiProviderResult<T> {
  success: boolean;
  value: T | null;
  selectedProvider: string | null;
  attempts: FieldObservationAttempt[];
  elapsedMs: number;
}

/**
 * Executes a failover sequence across prioritized providers.
 * If Primary fails or is rate-limited, immediately attempts Secondary, then Tertiary.
 */
export async function executeMultiProviderFailover<T>(
  providers: ProviderQueryConfig<T>[]
): Promise<MultiProviderResult<T>> {
  const attempts: FieldObservationAttempt[] = [];
  const startTime = Date.now();

  for (const provider of providers) {
    const attemptStart = new Date().toISOString();
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), provider.timeoutMs || 3000)
      );

      const value = await Promise.race([provider.fetcher(), timeoutPromise]);

      if (value !== null && value !== undefined && value !== "") {
        attempts.push({
          provider: provider.providerName,
          timestamp: attemptStart,
          status: "SUCCESS",
        });

        return {
          success: true,
          value,
          selectedProvider: provider.providerName,
          attempts,
          elapsedMs: Date.now() - startTime,
        };
      } else {
        attempts.push({
          provider: provider.providerName,
          timestamp: attemptStart,
          status: "FAILED",
          errorMessage: "Provider returned empty or null value",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isRateLimit = message.includes("429") || message.toLowerCase().includes("rate limit");
      const isTimeout = message.toLowerCase().includes("timeout");

      attempts.push({
        provider: provider.providerName,
        timestamp: attemptStart,
        status: isRateLimit ? "RATE_LIMITED" : isTimeout ? "TIMEOUT" : "FAILED",
        httpStatus: isRateLimit ? 429 : 500,
        errorMessage: message,
      });
    }
  }

  return {
    success: false,
    value: null,
    selectedProvider: null,
    attempts,
    elapsedMs: Date.now() - startTime,
  };
}

/**
 * Validates whether two numerical observations from different providers meet quorum consensus.
 * Tolerance is expressed as a maximum allowed percentage difference (e.g. 0.02 = 2%).
 */
export function verifyQuorumConsensus(
  val1: number,
  val2: number,
  maxDivergencePct = 0.02
): { consensus: boolean; divergencePct: number } {
  if (val1 <= 0 || val2 <= 0) {
    return { consensus: false, divergencePct: 1.0 };
  }

  const diff = Math.abs(val1 - val2);
  const avg = (val1 + val2) / 2;
  const divergence = diff / avg;

  return {
    consensus: divergence <= maxDivergencePct,
    divergencePct: divergence,
  };
}
