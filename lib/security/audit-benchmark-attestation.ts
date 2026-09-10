import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PASS4656_WORLDCLASS_AUDIT_THRESHOLDS,
  type Pass4656AuditBenchmarkThresholds,
} from "./audit-benchmark-gate";

export type Pass4656AuditBenchmarkAttestationPayload = {
  schemaVersion: "pass4656_audit_benchmark_attestation_payload_v1";
  benchmarkFingerprint: string;
  generatedAt: string;
  expiresAt: string;
  signerKeyId: string;
  caseCount: number;
  vulnerableCaseCount: number;
  controlCaseCount: number;
  categoryCoverageCount: number;
  overallRecall: number;
  criticalRecall: number;
  highRecall: number;
  precision: number;
  controlFalsePositiveRate: number;
  evidenceBindingRate: number;
  preDisclosureOnly: boolean;
  independentReviewComplete: boolean;
  worldClassAuditReady: boolean;
};

export type Pass4656AuditBenchmarkAttestation = Omit<Pass4656AuditBenchmarkAttestationPayload, "schemaVersion"> & {
  schemaVersion: "pass4656_audit_benchmark_attestation_v1";
  signature: string;
};

export type Pass4656AuditBenchmarkReleaseProof = {
  schemaVersion: "pass4656_audit_benchmark_release_proof_v1";
  verified: boolean;
  keySlot: "current" | "previous" | null;
  benchmarkFingerprint: string | null;
  generatedAt: string | null;
  expiresAt: string | null;
  signerKeyId: string | null;
  metrics: {
    caseCount: number;
    vulnerableCaseCount: number;
    controlCaseCount: number;
    categoryCoverageCount: number;
    overallRecall: number;
    criticalRecall: number;
    highRecall: number;
    precision: number;
    controlFalsePositiveRate: number;
    evidenceBindingRate: number;
  } | null;
  blockers: string[];
};

export type Pass4656AuditBenchmarkSigningSecrets = {
  current: string | null;
  previous?: string | null;
};

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
}

function hmac(secret: string, payload: Pass4656AuditBenchmarkAttestationPayload) {
  return createHmac("sha256", secret).update(stableSerialize(payload)).digest("hex");
}

function validSecret(secret: string | null | undefined) {
  return typeof secret === "string" && secret.trim().length >= 32;
}

function safeEqualHex(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function finiteDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finiteRatio(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function payloadFromAttestation(attestation: Pass4656AuditBenchmarkAttestation): Pass4656AuditBenchmarkAttestationPayload {
  return {
    schemaVersion: "pass4656_audit_benchmark_attestation_payload_v1",
    benchmarkFingerprint: attestation.benchmarkFingerprint,
    generatedAt: attestation.generatedAt,
    expiresAt: attestation.expiresAt,
    signerKeyId: attestation.signerKeyId,
    caseCount: attestation.caseCount,
    vulnerableCaseCount: attestation.vulnerableCaseCount,
    controlCaseCount: attestation.controlCaseCount,
    categoryCoverageCount: attestation.categoryCoverageCount,
    overallRecall: attestation.overallRecall,
    criticalRecall: attestation.criticalRecall,
    highRecall: attestation.highRecall,
    precision: attestation.precision,
    controlFalsePositiveRate: attestation.controlFalsePositiveRate,
    evidenceBindingRate: attestation.evidenceBindingRate,
    preDisclosureOnly: attestation.preDisclosureOnly,
    independentReviewComplete: attestation.independentReviewComplete,
    worldClassAuditReady: attestation.worldClassAuditReady,
  };
}

function policyBlockers(
  payload: Pass4656AuditBenchmarkAttestationPayload,
  thresholds: Pass4656AuditBenchmarkThresholds,
  nowMs: number,
) {
  const generatedAt = finiteDate(payload.generatedAt);
  const expiresAt = finiteDate(payload.expiresAt);
  return [
    !/^[a-f0-9]{64}$/i.test(payload.benchmarkFingerprint) ? "benchmark_fingerprint_invalid" : null,
    !payload.signerKeyId.trim() ? "signer_key_id_missing" : null,
    generatedAt === null ? "generated_at_invalid" : null,
    expiresAt === null ? "expires_at_invalid" : null,
    generatedAt !== null && generatedAt > nowMs + 30_000 ? "generated_at_in_future" : null,
    expiresAt !== null && expiresAt <= nowMs ? "attestation_expired" : null,
    generatedAt !== null && expiresAt !== null && expiresAt <= generatedAt ? "attestation_window_invalid" : null,
    payload.caseCount < thresholds.minimumCases ? `case_count:${payload.caseCount}/${thresholds.minimumCases}` : null,
    payload.vulnerableCaseCount < thresholds.minimumVulnerableCases ? `vulnerable_cases:${payload.vulnerableCaseCount}/${thresholds.minimumVulnerableCases}` : null,
    payload.controlCaseCount < thresholds.minimumControlCases ? `control_cases:${payload.controlCaseCount}/${thresholds.minimumControlCases}` : null,
    payload.categoryCoverageCount < thresholds.minimumCategoryCoverage ? `category_coverage:${payload.categoryCoverageCount}/${thresholds.minimumCategoryCoverage}` : null,
    !finiteRatio(payload.overallRecall) || payload.overallRecall < thresholds.minimumOverallRecall ? `overall_recall:${payload.overallRecall}/${thresholds.minimumOverallRecall}` : null,
    !finiteRatio(payload.criticalRecall) || payload.criticalRecall < thresholds.minimumCriticalRecall ? `critical_recall:${payload.criticalRecall}/${thresholds.minimumCriticalRecall}` : null,
    !finiteRatio(payload.highRecall) || payload.highRecall < thresholds.minimumHighRecall ? `high_recall:${payload.highRecall}/${thresholds.minimumHighRecall}` : null,
    !finiteRatio(payload.precision) || payload.precision < thresholds.minimumPrecision ? `precision:${payload.precision}/${thresholds.minimumPrecision}` : null,
    !finiteRatio(payload.controlFalsePositiveRate) || payload.controlFalsePositiveRate > thresholds.maximumControlFalsePositiveRate
      ? `control_false_positive_rate:${payload.controlFalsePositiveRate}/${thresholds.maximumControlFalsePositiveRate}`
      : null,
    !finiteRatio(payload.evidenceBindingRate) || payload.evidenceBindingRate < thresholds.minimumEvidenceBindingRate
      ? `evidence_binding_rate:${payload.evidenceBindingRate}/${thresholds.minimumEvidenceBindingRate}`
      : null,
    payload.preDisclosureOnly ? null : "pre_disclosure_only_not_proven",
    payload.independentReviewComplete ? null : "independent_review_missing",
    payload.worldClassAuditReady ? null : "benchmark_not_worldclass_ready",
  ].filter((value): value is string => Boolean(value));
}

export function createPass4656AuditBenchmarkAttestation(args: {
  payload: Omit<Pass4656AuditBenchmarkAttestationPayload, "schemaVersion">;
  signingSecret: string;
}) : Pass4656AuditBenchmarkAttestation {
  if (!validSecret(args.signingSecret)) throw new Error("audit_benchmark_signing_secret_too_short");
  const payload: Pass4656AuditBenchmarkAttestationPayload = {
    schemaVersion: "pass4656_audit_benchmark_attestation_payload_v1",
    ...args.payload,
  };
  return {
    ...payload,
    schemaVersion: "pass4656_audit_benchmark_attestation_v1",
    signature: hmac(args.signingSecret.trim(), payload),
  };
}

export function verifyPass4656AuditBenchmarkAttestation(args: {
  attestation: Pass4656AuditBenchmarkAttestation | null | undefined;
  signingSecrets: Pass4656AuditBenchmarkSigningSecrets;
  thresholds?: Pass4656AuditBenchmarkThresholds;
  now?: Date;
}): Pass4656AuditBenchmarkReleaseProof {
  const attestation = args.attestation;
  const blockers: string[] = [];
  if (!attestation || attestation.schemaVersion !== "pass4656_audit_benchmark_attestation_v1") {
    return {
      schemaVersion: "pass4656_audit_benchmark_release_proof_v1",
      verified: false,
      keySlot: null,
      benchmarkFingerprint: null,
      generatedAt: null,
      expiresAt: null,
      signerKeyId: null,
      metrics: null,
      blockers: ["audit_benchmark_attestation_missing"],
    };
  }
  const payload = payloadFromAttestation(attestation);
  blockers.push(...policyBlockers(payload, args.thresholds ?? PASS4656_WORLDCLASS_AUDIT_THRESHOLDS, (args.now ?? new Date()).getTime()));

  let keySlot: "current" | "previous" | null = null;
  if (validSecret(args.signingSecrets.current) && safeEqualHex(attestation.signature, hmac(args.signingSecrets.current!.trim(), payload))) {
    keySlot = "current";
  } else if (validSecret(args.signingSecrets.previous) && safeEqualHex(attestation.signature, hmac(args.signingSecrets.previous!.trim(), payload))) {
    keySlot = "previous";
  } else {
    blockers.push("audit_benchmark_signature_invalid");
  }

  return {
    schemaVersion: "pass4656_audit_benchmark_release_proof_v1",
    verified: blockers.length === 0,
    keySlot,
    benchmarkFingerprint: payload.benchmarkFingerprint,
    generatedAt: payload.generatedAt,
    expiresAt: payload.expiresAt,
    signerKeyId: payload.signerKeyId,
    metrics: {
      caseCount: payload.caseCount,
      vulnerableCaseCount: payload.vulnerableCaseCount,
      controlCaseCount: payload.controlCaseCount,
      categoryCoverageCount: payload.categoryCoverageCount,
      overallRecall: payload.overallRecall,
      criticalRecall: payload.criticalRecall,
      highRecall: payload.highRecall,
      precision: payload.precision,
      controlFalsePositiveRate: payload.controlFalsePositiveRate,
      evidenceBindingRate: payload.evidenceBindingRate,
    },
    blockers: [...new Set(blockers)].sort(),
  };
}

export function resolvePass4656AuditBenchmarkReleaseProofFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
): Pass4656AuditBenchmarkReleaseProof {
  const raw = env.VELMERE_AUDIT_BENCHMARK_ATTESTATION_JSON?.trim();
  let attestation: Pass4656AuditBenchmarkAttestation | null = null;
  if (raw) {
    try {
      attestation = JSON.parse(raw) as Pass4656AuditBenchmarkAttestation;
    } catch {
      return {
        schemaVersion: "pass4656_audit_benchmark_release_proof_v1",
        verified: false,
        keySlot: null,
        benchmarkFingerprint: null,
        generatedAt: null,
        expiresAt: null,
        signerKeyId: null,
        metrics: null,
        blockers: ["audit_benchmark_attestation_json_invalid"],
      };
    }
  }
  const current = env.VELMERE_AUDIT_BENCHMARK_SIGNING_SECRET?.trim() || null;
  const previous = env.VELMERE_AUDIT_BENCHMARK_SIGNING_SECRET_PREVIOUS?.trim() || null;
  const forbidden = new Set([
    env.VELMERE_PROVIDER_RECEIPT_SIGNING_SECRET?.trim(),
    env.VELMERE_LENS_RENDER_TOKEN_SECRET?.trim(),
    env.STRIPE_WEBHOOK_SECRET?.trim(),
  ].filter((value): value is string => Boolean(value)));
  if (current && forbidden.has(current)) {
    return {
      schemaVersion: "pass4656_audit_benchmark_release_proof_v1",
      verified: false,
      keySlot: null,
      benchmarkFingerprint: attestation?.benchmarkFingerprint ?? null,
      generatedAt: attestation?.generatedAt ?? null,
      expiresAt: attestation?.expiresAt ?? null,
      signerKeyId: attestation?.signerKeyId ?? null,
      metrics: null,
      blockers: ["audit_benchmark_secret_reuse_forbidden"],
    };
  }
  return verifyPass4656AuditBenchmarkAttestation({
    attestation,
    signingSecrets: { current, previous },
    now,
  });
}
