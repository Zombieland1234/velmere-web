import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "../security/ascii-control-characters";

import { createHash } from "node:crypto";
import type { Pass2476RuntimeReceiptPdfHashRunner } from "./runtime-receipt-pdf-hash-runner";
import type { Pass2491EntitlementReceiptReplayParity } from "./entitlement-receipt-replay-parity";

export const PASS2492_ENTITLEMENT_ARTIFACT_DELIVERY_LEDGER_ID = "entitlement-artifact-delivery-ledger-v1" as const;

export type Pass2492ArtifactDeliveryState = "delivery_allowed" | "receipt_replay_required" | "artifact_parity_watch" | "blocked";
export type Pass2492ArtifactDeliveryMode = "paid_verdict_artifact_delivered" | "missing_proof_map_artifact_delivered" | "pre_delivery_locked" | "blocked";
export type Pass2492ArtifactSurface = "account_console" | "browser_pdf_preview" | "browser_pdf_download" | "shield_modal" | "real_markets_modal" | "vlm_brain" | "angel" | "checkout_success";

export type Pass2492ArtifactDeliveryInput = {
  previewHash?: string;
  downloadHash?: string;
  pdfHash?: string;
  accountDeliveryId?: string;
  accountDeliveryFingerprint?: string;
  angelReplayFingerprint?: string;
  brainReplayFingerprint?: string;
  modalReplayFingerprint?: string;
  checkoutSuccessFingerprint?: string;
  locale?: string;
  operatorId?: string;
};

export type Pass2492ArtifactSurfaceBinding = {
  surface: Pass2492ArtifactSurface;
  expectedDeliveryManifestKey: string;
  requiredVisibleCopy: string;
  mustShowReceiptReplayKey: boolean;
  mustShowPdfArtifactHash: boolean;
  mustShowAccountDeliveryId: boolean;
  deliveryCopyAllowed: boolean;
};

export type Pass2492EntitlementArtifactDeliveryLedger = {
  version: typeof PASS2492_ENTITLEMENT_ARTIFACT_DELIVERY_LEDGER_ID;
  state: Pass2492ArtifactDeliveryState;
  deliveryMode: Pass2492ArtifactDeliveryMode;
  query?: string;
  symbol?: string;
  artifactDeliveryAllowed: boolean;
  finalPaidVerdictArtifactAllowed: boolean;
  missingProofMapArtifactAllowed: boolean;
  receiptReplayRequired: true;
  walletOnlyDeliveryAllowed: false;
  rawArtifactStorageAllowed: false;
  previewDownloadHashMatch: boolean;
  pdfHashProvided: boolean;
  accountConsoleDeliveryReady: boolean;
  crossSurfaceReplayParityReady: boolean;
  pdfReceiptFooterRequired: true;
  deliveryManifestKey: string;
  linkedPass2491ReplayKey?: string;
  linkedPass2491Fingerprint?: string;
  linkedPass2476RunnerFingerprint?: string;
  artifactHash?: string;
  accountDeliveryFingerprint?: string;
  customerMessage: string;
  operatorMessage: string;
  blockers: string[];
  artifactRequirements: string[];
  surfaceArtifactBindings: Pass2492ArtifactSurfaceBinding[];
  forbiddenDeliveryStates: string[];
  redactionBoundary: string;
  nextImplementationActions: string[];
  fingerprint: string;
  generatedAt: string;
};

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32).toUpperCase();
}

function bounded(value: unknown, maxLength: number, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, "").trim().slice(0, maxLength) || fallback;
}

function normalizeFingerprint(value?: string) {
  return bounded(value, 180, "").toUpperCase().replace(/[^A-Z0-9:_-]/g, "").slice(0, 180);
}

function normalizeSymbol(value?: string) {
  return bounded(value, 40).toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 32);
}

function unique<T>(items: Array<T | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function resolveArtifactHash(input?: Pass2492ArtifactDeliveryInput | null, pass2476?: Pass2476RuntimeReceiptPdfHashRunner | null) {
  const explicit = normalizeFingerprint(input?.pdfHash);
  const preview = normalizeFingerprint(input?.previewHash);
  const download = normalizeFingerprint(input?.downloadHash);
  if (explicit) return explicit;
  if (preview && download && preview === download) return preview;
  const advancedPdfCell = pass2476?.cells.find((cell) => cell.tier === "advanced" && cell.pdfHashProvided);
  return normalizeFingerprint(advancedPdfCell?.pdfHashReceiptFingerprint);
}

function previewDownloadMatch(input?: Pass2492ArtifactDeliveryInput | null) {
  const preview = normalizeFingerprint(input?.previewHash);
  const download = normalizeFingerprint(input?.downloadHash);
  if (!preview && !download) return false;
  return Boolean(preview && download && preview === download);
}

function resolveState(args: {
  pass2491?: Pass2491EntitlementReceiptReplayParity | null;
  artifactHash: string;
  previewDownloadHashMatch: boolean;
  accountReady: boolean;
  replayParityReady: boolean;
}): Pass2492ArtifactDeliveryState {
  if (!args.pass2491 || args.pass2491.state === "blocked") return "blocked";
  if (!args.pass2491.finalPaidVerdictUnlockAllowed && !args.pass2491.missingProofMapUnlockAllowed) return "receipt_replay_required";
  if (!args.artifactHash || !args.previewDownloadHashMatch || !args.accountReady || !args.replayParityReady) return "artifact_parity_watch";
  return "delivery_allowed";
}

function deliveryModeFor(state: Pass2492ArtifactDeliveryState, pass2491?: Pass2491EntitlementReceiptReplayParity | null): Pass2492ArtifactDeliveryMode {
  if (state === "delivery_allowed" && pass2491?.finalPaidVerdictUnlockAllowed) return "paid_verdict_artifact_delivered";
  if (state === "delivery_allowed" && pass2491?.missingProofMapUnlockAllowed) return "missing_proof_map_artifact_delivered";
  if (state === "receipt_replay_required" || state === "artifact_parity_watch") return "pre_delivery_locked";
  return "blocked";
}

function surfaceBindings(args: {
  deliveryManifestKey: string;
  artifactHash: string;
  accountDeliveryId: string;
  deliveryAllowed: boolean;
  pass2491?: Pass2491EntitlementReceiptReplayParity | null;
}): Pass2492ArtifactSurfaceBinding[] {
  const surfaces: Pass2492ArtifactSurface[] = ["checkout_success", "account_console", "browser_pdf_preview", "browser_pdf_download", "shield_modal", "real_markets_modal", "vlm_brain", "angel"];
  const baseCopy = args.deliveryAllowed
    ? args.pass2491?.finalPaidVerdictUnlockAllowed
      ? "Paid Advanced artifact delivered from server receipt replay."
      : "Paid missing-proof map artifact delivered from server receipt replay."
    : "Advanced artifact delivery is locked until receipt replay, PDF hash and account delivery parity match.";
  return surfaces.map((surface) => ({
    surface,
    expectedDeliveryManifestKey: args.deliveryManifestKey,
    requiredVisibleCopy: `${baseCopy} surface=${surface}`,
    mustShowReceiptReplayKey: true,
    mustShowPdfArtifactHash: surface === "browser_pdf_preview" || surface === "browser_pdf_download" || surface === "account_console" || surface === "angel",
    mustShowAccountDeliveryId: surface === "account_console" || surface === "checkout_success" || surface === "angel",
    deliveryCopyAllowed: args.deliveryAllowed,
  }));
}

export function buildPass2492EntitlementArtifactDeliveryLedger(args: {
  query?: string;
  symbol?: string;
  pass2491?: Pass2491EntitlementReceiptReplayParity | null;
  pass2476?: Pass2476RuntimeReceiptPdfHashRunner | null;
  artifact?: Pass2492ArtifactDeliveryInput | null;
}): Pass2492EntitlementArtifactDeliveryLedger {
  const artifactHash = resolveArtifactHash(args.artifact, args.pass2476);
  const previewDownloadHashMatch = previewDownloadMatch(args.artifact);
  const accountDeliveryId = bounded(args.artifact?.accountDeliveryId, 140, "");
  const accountDeliveryFingerprint = normalizeFingerprint(args.artifact?.accountDeliveryFingerprint);
  const accountConsoleDeliveryReady = Boolean(accountDeliveryId && accountDeliveryFingerprint);
  const crossSurfaceReplayParityReady = Boolean(
    normalizeFingerprint(args.artifact?.angelReplayFingerprint)
      && normalizeFingerprint(args.artifact?.brainReplayFingerprint)
      && normalizeFingerprint(args.artifact?.modalReplayFingerprint)
      && normalizeFingerprint(args.artifact?.checkoutSuccessFingerprint),
  );
  const state = resolveState({
    pass2491: args.pass2491,
    artifactHash,
    previewDownloadHashMatch,
    accountReady: accountConsoleDeliveryReady,
    replayParityReady: crossSurfaceReplayParityReady,
  });
  const deliveryMode = deliveryModeFor(state, args.pass2491);
  const artifactDeliveryAllowed = state === "delivery_allowed";
  const finalPaidVerdictArtifactAllowed = deliveryMode === "paid_verdict_artifact_delivered";
  const missingProofMapArtifactAllowed = deliveryMode === "missing_proof_map_artifact_delivered";
  const deliveryManifestKey = `PASS2492-${hash({
    query: args.query,
    symbol: normalizeSymbol(args.symbol || args.pass2491?.symbol),
    pass2491ReplayKey: args.pass2491?.receiptReplayKey,
    artifactHash,
    accountDeliveryId,
    state,
    deliveryMode,
  })}`;
  const blockers = unique([
    !args.pass2491 && "PASS2491 receipt replay parity missing",
    args.pass2491?.state === "blocked" && "PASS2491 blocks receipt replay",
    args.pass2491 && !args.pass2491.finalPaidVerdictUnlockAllowed && !args.pass2491.missingProofMapUnlockAllowed && "PASS2491 has no unlockable receipt replay",
    !artifactHash && "PDF/report artifact hash missing",
    !previewDownloadHashMatch && "PDF preview/download hash parity missing",
    !accountConsoleDeliveryReady && "account console delivery id/fingerprint missing",
    !crossSurfaceReplayParityReady && "Angel/Brain/modal/checkout-success replay fingerprints missing",
    state !== "delivery_allowed" && "Advanced artifact delivery copy remains locked",
  ]).slice(0, 16);
  const fingerprint = hash({
    version: PASS2492_ENTITLEMENT_ARTIFACT_DELIVERY_LEDGER_ID,
    deliveryManifestKey,
    pass2491ReplayKey: args.pass2491?.receiptReplayKey,
    pass2491Fingerprint: args.pass2491?.fingerprint,
    pass2476RunnerFingerprint: args.pass2476?.runnerFingerprint,
    artifactHash,
    accountDeliveryFingerprint,
    state,
    deliveryMode,
    blockers: blockers.slice(0, 8),
  });

  return {
    version: PASS2492_ENTITLEMENT_ARTIFACT_DELIVERY_LEDGER_ID,
    state,
    deliveryMode,
    query: args.query,
    symbol: normalizeSymbol(args.symbol || args.pass2491?.symbol),
    artifactDeliveryAllowed,
    finalPaidVerdictArtifactAllowed,
    missingProofMapArtifactAllowed,
    receiptReplayRequired: true,
    walletOnlyDeliveryAllowed: false,
    rawArtifactStorageAllowed: false,
    previewDownloadHashMatch,
    pdfHashProvided: Boolean(artifactHash),
    accountConsoleDeliveryReady,
    crossSurfaceReplayParityReady,
    pdfReceiptFooterRequired: true,
    deliveryManifestKey,
    linkedPass2491ReplayKey: args.pass2491?.receiptReplayKey,
    linkedPass2491Fingerprint: args.pass2491?.fingerprint,
    linkedPass2476RunnerFingerprint: args.pass2476?.runnerFingerprint,
    artifactHash: artifactHash || undefined,
    accountDeliveryFingerprint: accountDeliveryFingerprint || undefined,
    customerMessage: finalPaidVerdictArtifactAllowed
      ? "Advanced paid report artifact is delivered for this exact receipt, PDF hash and account delivery scope."
      : missingProofMapArtifactAllowed
        ? "Advanced missing-proof report artifact is delivered; unresolved evidence lanes remain visible in the artifact."
        : "Advanced report delivery stays locked until server receipt replay, PDF preview/download hash parity and account console delivery match.",
    operatorMessage: artifactDeliveryAllowed
      ? "Persist PASS2492 deliveryManifestKey on account console, PDF footer, checkout success, VLM Brain and Angel replay metadata."
      : "Do not deliver paid Advanced artifact copy; finish PASS2491 receipt replay, PDF hash parity and account delivery binding first.",
    blockers,
    artifactRequirements: [
      "PASS2491 receiptReplayKey must be present and match the checkout/account scope",
      "PDF preview hash and PDF download hash must be identical for the same payload",
      "account console must store accountDeliveryId and accountDeliveryFingerprint",
      "Angel, VLM Brain, modal and checkout-success must expose replay fingerprints derived from the same deliveryManifestKey",
      "PDF footer must show the deliveryManifestKey, receiptReplayKey and artifact hash without raw payment or raw wallet data",
    ],
    surfaceArtifactBindings: surfaceBindings({
      deliveryManifestKey,
      artifactHash: artifactHash || "pdf-artifact-hash-required",
      accountDeliveryId: accountDeliveryId || "account-delivery-id-required",
      deliveryAllowed: artifactDeliveryAllowed,
      pass2491: args.pass2491,
    }),
    forbiddenDeliveryStates: [
      "checkout success page delivers Advanced without PASS2491 receipt replay",
      "PDF preview and download use different payload hashes",
      "account console says paid report delivered but Angel/Brain/modal use another replay key",
      "raw card data, raw wallet signatures or raw PDF bytes stored in the entitlement ledger",
      "missing-proof-map artifact described as final paid verdict",
    ],
    redactionBoundary: "PASS2492 stores deliveryManifestKey, artifact hashes, account delivery fingerprints and replay fingerprints only. It must not store raw card data, raw wallet signatures, secret keys, raw PDF bytes, screenshots or investment instructions.",
    nextImplementationActions: artifactDeliveryAllowed
      ? ["Render PASS2492 deliveryManifestKey in account console", "Attach PASS2492 footer to PDF preview/download", "Include PASS2492 key in Angel and VLM Brain replay metadata"]
      : ["Capture PDF preview/download hashes for the generated Advanced payload", "Create accountDeliveryId in server entitlement ledger", "Bind Angel/Brain/modal/checkout-success replay fingerprints to PASS2492 deliveryManifestKey"],
    fingerprint,
    generatedAt: new Date().toISOString(),
  };
}
