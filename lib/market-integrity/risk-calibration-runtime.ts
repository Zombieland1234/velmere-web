import type { TokenRiskResult } from "./risk-types";
import {
  attachSignedRiskCalibrationToResult,
  type SignedRiskCalibrationDriftReceipt,
  type SignedRiskCalibrationProfile,
} from "./risk-empirical-calibration";

export const PASS4806_RISK_CALIBRATION_RUNTIME_ID = "pass4806-risk-calibration-runtime-v1";

export type Pass4806RiskCalibrationRuntimeStatus = {
  schemaVersion: "velmere.risk-calibration-runtime.v1";
  runtimeId: typeof PASS4806_RISK_CALIBRATION_RUNTIME_ID;
  status: "attached" | "not_configured" | "blocked";
  profileId: string | null;
  probabilityClaimAllowed: boolean;
  blockers: string[];
};

const MAX_ARTIFACT_BYTES = 768 * 1024;

function decodeJsonArtifact(args: { json?: string; base64?: string; artifact: string }) {
  const direct = args.json?.trim();
  const encoded = args.base64?.trim();
  if (!direct && !encoded) return null;
  if (direct && encoded) throw new Error(`${args.artifact}_multiple_sources_configured`);
  const source = direct ?? Buffer.from(encoded!, "base64").toString("utf8");
  if (Buffer.byteLength(source, "utf8") > MAX_ARTIFACT_BYTES) {
    throw new Error(`${args.artifact}_too_large`);
  }
  return JSON.parse(source) as unknown;
}

function appendCalibrationBlocker(result: TokenRiskResult, blocker: string): TokenRiskResult {
  return {
    ...result,
    uncertainty: result.uncertainty
      ? {
          ...result.uncertainty,
          empiricalCalibrationStatus: "not_available",
          probabilityClaimAllowed: false,
          calibrationProfileId: undefined,
          drivers: Array.from(new Set([...(result.uncertainty.drivers ?? []), blocker])),
        }
      : result.uncertainty,
    empiricalCalibration: undefined,
    limitations: Array.from(new Set([...(result.limitations ?? []), blocker])),
  };
}

export function applyConfiguredRiskCalibration(result: TokenRiskResult, now = new Date().toISOString()): {
  result: TokenRiskResult;
  runtime: Pass4806RiskCalibrationRuntimeStatus;
} {
  const profileJson = process.env.VELMERE_RISK_CALIBRATION_PROFILE_JSON;
  const profileBase64 = process.env.VELMERE_RISK_CALIBRATION_PROFILE_B64;
  const driftJson = process.env.VELMERE_RISK_CALIBRATION_DRIFT_JSON;
  const driftBase64 = process.env.VELMERE_RISK_CALIBRATION_DRIFT_B64;
  const signingSecret = process.env.VELMERE_RISK_CALIBRATION_SIGNING_SECRET?.trim() ?? "";
  const monitoringSecret = process.env.VELMERE_RISK_CALIBRATION_MONITORING_SECRET?.trim() ?? "";
  const anyConfigured = Boolean(profileJson?.trim() || profileBase64?.trim() || driftJson?.trim() || driftBase64?.trim() || signingSecret || monitoringSecret);

  if (!anyConfigured) {
    return {
      result: appendCalibrationBlocker(result, "Empirical risk calibration is not configured; probability claims are disabled."),
      runtime: {
        schemaVersion: "velmere.risk-calibration-runtime.v1",
        runtimeId: PASS4806_RISK_CALIBRATION_RUNTIME_ID,
        status: "not_configured",
        profileId: null,
        probabilityClaimAllowed: false,
        blockers: ["risk_calibration_not_configured"],
      },
    };
  }

  try {
    if (signingSecret.length < 32 || monitoringSecret.length < 32) {
      throw new Error("risk_calibration_runtime_secret_invalid");
    }
    const profile = decodeJsonArtifact({
      json: profileJson,
      base64: profileBase64,
      artifact: "risk_calibration_profile",
    }) as SignedRiskCalibrationProfile | null;
    const driftReceipt = decodeJsonArtifact({
      json: driftJson,
      base64: driftBase64,
      artifact: "risk_calibration_drift",
    }) as SignedRiskCalibrationDriftReceipt | null;
    if (!profile || !driftReceipt) throw new Error("risk_calibration_runtime_artifact_missing");
    if (profile.schemaVersion !== "velmere.risk-empirical-calibration.v2") {
      throw new Error("risk_calibration_profile_schema_invalid");
    }
    if (driftReceipt.schemaVersion !== "velmere.risk-calibration-drift.v2") {
      throw new Error("risk_calibration_drift_schema_invalid");
    }
    const calibratedResult = attachSignedRiskCalibrationToResult({
      result,
      profile,
      signingSecret,
      driftReceipt,
      monitoringSecret,
      now,
    });
    return {
      result: calibratedResult,
      runtime: {
        schemaVersion: "velmere.risk-calibration-runtime.v1",
        runtimeId: PASS4806_RISK_CALIBRATION_RUNTIME_ID,
        status: "attached",
        profileId: profile.profileId,
        probabilityClaimAllowed: true,
        blockers: [],
      },
    };
  } catch (error) {
    const blocker = error instanceof Error ? error.message : "risk_calibration_runtime_unknown_error";
    return {
      result: appendCalibrationBlocker(result, "Empirical risk calibration is blocked; probability claims are disabled."),
      runtime: {
        schemaVersion: "velmere.risk-calibration-runtime.v1",
        runtimeId: PASS4806_RISK_CALIBRATION_RUNTIME_ID,
        status: "blocked",
        profileId: null,
        probabilityClaimAllowed: false,
        blockers: [blocker],
      },
    };
  }
}
