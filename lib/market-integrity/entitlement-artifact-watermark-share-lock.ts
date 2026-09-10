import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "../security/ascii-control-characters";

import { createHash } from "node:crypto";
import type { Pass2496EntitlementSessionDeviceAnomalyLock } from "./entitlement-session-device-anomaly-lock";

export const PASS2497_ENTITLEMENT_ARTIFACT_WATERMARK_SHARE_LOCK_ID = "entitlement-artifact-watermark-share-lock-v1" as const;

export type Pass2497WatermarkShareState =
  | "watermarked_delivery_allowed"
  | "watermark_replay_required"
  | "share_leak_review_required"
  | "session_blocked"
  | "expired_download_blocked"
  | "blocked";

export type Pass2497WatermarkAccessMode =
  | "paid_artifact_watermarked"
  | "watermark_replay_only"
  | "share_leak_review_only"
  | "access_denied"
  | "blocked";

export type Pass2497WatermarkSurface =
  | "pdf_download"
  | "browser_preview"
  | "account_console"
  | "account_message_card"
  | "vlm_brain"
  | "angel"
  | "admin_console";

export type Pass2497WatermarkInput = {
  sessionLedgerKey?: string;
  artifactHash?: string;
  deliveryManifestKey?: string;
  customerPseudonymHash?: string;
  watermarkFingerprint?: string;
  signedDownloadUrlFingerprint?: string;
  downloadNonceFingerprint?: string;
  shareLeakSignal?: string;
  signedAt?: string;
  expiresAt?: string;
  requestSurface?: string;
  locale?: string;
};

export type Pass2497WatermarkSurfaceBinding = {
  surface: Pass2497WatermarkSurface;
  mustReplaySessionLedgerKey: true;
  mustReplayWatermarkFingerprint: true;
  mustUseShortLivedSignedUrl: true;
  mustDenyPublicCache: true;
  paidArtifactCopyAllowed: boolean;
  requiredVisibleCopy: string;
};

export type Pass2497EntitlementArtifactWatermarkShareLock = {
  version: typeof PASS2497_ENTITLEMENT_ARTIFACT_WATERMARK_SHARE_LOCK_ID;
  state: Pass2497WatermarkShareState;
  accessMode: Pass2497WatermarkAccessMode;
  query?: string;
  symbol?: string;
  pass2496SessionLedgerKey?: string;
  requestedSessionLedgerKey?: string;
  sessionLedgerMatch: boolean;
  artifactHashPresent: boolean;
  deliveryManifestKeyPresent: boolean;
  customerPseudonymHashPresent: boolean;
  watermarkFingerprintPresent: boolean;
  signedDownloadUrlPresent: boolean;
  downloadNoncePresent: boolean;
  downloadExpiryActive: boolean;
  shareLeakSignalPresent: boolean;
  publicCacheDenied: true;
  rawCustomerDataDenied: true;
  screenshotShareCannotProveEntitlement: true;
  finalPaidWatermarkedArtifactAllowed: boolean;
  shareLeakReviewRequired: boolean;
  linkedPass2496State?: string;
  linkedPass2496AccessMode?: string;
  blockers: string[];
  watermarkRequirements: string[];
  forbiddenArtifactUnlocks: string[];
  surfaceWatermarkBindings: Pass2497WatermarkSurfaceBinding[];
  customerMessage: string;
  operatorMessage: string;
  redactionBoundary: string;
  nextImplementationActions: string[];
  watermarkLedgerKey: string;
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

function normalizeKey(value?: string) {
  return bounded(value, 260, "").toUpperCase().replace(/[^A-Z0-9:_-]/g, "").slice(0, 260);
}

function normalizeSymbol(value?: string) {
  return bounded(value, 40).toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 32);
}

function isFuture(value?: string) {
  const text = bounded(value, 80, "");
  if (!text) return false;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) && parsed > Date.now();
}

function unique<T>(items: Array<T | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function resolveState(args: {
  pass2496?: Pass2496EntitlementSessionDeviceAnomalyLock | null;
  sessionLedgerMatch: boolean;
  artifactHashPresent: boolean;
  deliveryManifestKeyPresent: boolean;
  customerPseudonymHashPresent: boolean;
  watermarkFingerprintPresent: boolean;
  signedDownloadUrlPresent: boolean;
  downloadNoncePresent: boolean;
  downloadExpiryActive: boolean;
  shareLeakSignalPresent: boolean;
}): Pass2497WatermarkShareState {
  if (!args.pass2496 || args.pass2496.state === "blocked") return "blocked";
  if (!args.pass2496.finalPaidSessionAccessAllowed) return "session_blocked";
  if (args.shareLeakSignalPresent) return "share_leak_review_required";
  if (!args.downloadExpiryActive) return "expired_download_blocked";
  if (!args.sessionLedgerMatch || !args.artifactHashPresent || !args.deliveryManifestKeyPresent || !args.customerPseudonymHashPresent || !args.watermarkFingerprintPresent || !args.signedDownloadUrlPresent || !args.downloadNoncePresent) return "watermark_replay_required";
  return "watermarked_delivery_allowed";
}

function modeFor(state: Pass2497WatermarkShareState): Pass2497WatermarkAccessMode {
  if (state === "watermarked_delivery_allowed") return "paid_artifact_watermarked";
  if (state === "share_leak_review_required") return "share_leak_review_only";
  if (state === "watermark_replay_required") return "watermark_replay_only";
  if (state === "session_blocked" || state === "expired_download_blocked") return "access_denied";
  return "blocked";
}

function buildSurfaceBindings(args: { allowed: boolean; state: Pass2497WatermarkShareState; ledgerKey: string }): Pass2497WatermarkSurfaceBinding[] {
  const surfaces: Pass2497WatermarkSurface[] = ["pdf_download", "browser_preview", "account_console", "account_message_card", "vlm_brain", "angel", "admin_console"];
  const baseCopy = args.allowed
    ? "PASS2497 paid artifact is session-bound, watermarked and served through a short-lived signed download URL."
    : `PASS2497 blocks paid artifact copy until watermark/signed-URL replay is clear (${args.state}).`;
  return surfaces.map((surface) => ({
    surface,
    mustReplaySessionLedgerKey: true,
    mustReplayWatermarkFingerprint: true,
    mustUseShortLivedSignedUrl: true,
    mustDenyPublicCache: true,
    paidArtifactCopyAllowed: args.allowed,
    requiredVisibleCopy: `${baseCopy} watermarkLedgerKey=${args.ledgerKey} surface=${surface}`,
  }));
}

export function buildPass2497EntitlementArtifactWatermarkShareLock(args: {
  query?: string;
  symbol?: string;
  pass2496?: Pass2496EntitlementSessionDeviceAnomalyLock | null;
  watermark?: Pass2497WatermarkInput | null;
}): Pass2497EntitlementArtifactWatermarkShareLock {
  const requestedSessionLedgerKey = normalizeKey(args.watermark?.sessionLedgerKey);
  const pass2496SessionLedgerKey = normalizeKey(args.pass2496?.sessionLedgerKey);
  const artifactHash = normalizeKey(args.watermark?.artifactHash);
  const deliveryManifestKey = normalizeKey(args.watermark?.deliveryManifestKey);
  const customerPseudonymHash = normalizeKey(args.watermark?.customerPseudonymHash);
  const watermarkFingerprint = normalizeKey(args.watermark?.watermarkFingerprint);
  const signedDownloadUrlFingerprint = normalizeKey(args.watermark?.signedDownloadUrlFingerprint);
  const downloadNonceFingerprint = normalizeKey(args.watermark?.downloadNonceFingerprint);
  const shareLeakSignal = bounded(args.watermark?.shareLeakSignal, 80, "").toLowerCase().replace(/[^a-z0-9:_-]/g, "");
  const sessionLedgerMatch = Boolean(pass2496SessionLedgerKey && requestedSessionLedgerKey && pass2496SessionLedgerKey === requestedSessionLedgerKey);
  const artifactHashPresent = Boolean(artifactHash);
  const deliveryManifestKeyPresent = Boolean(deliveryManifestKey);
  const customerPseudonymHashPresent = Boolean(customerPseudonymHash);
  const watermarkFingerprintPresent = Boolean(watermarkFingerprint);
  const signedDownloadUrlPresent = Boolean(signedDownloadUrlFingerprint);
  const downloadNoncePresent = Boolean(downloadNonceFingerprint);
  const downloadExpiryActive = isFuture(args.watermark?.expiresAt);
  const shareLeakSignalPresent = Boolean(shareLeakSignal && shareLeakSignal !== "none" && shareLeakSignal !== "clear");
  const state = resolveState({
    pass2496: args.pass2496,
    sessionLedgerMatch,
    artifactHashPresent,
    deliveryManifestKeyPresent,
    customerPseudonymHashPresent,
    watermarkFingerprintPresent,
    signedDownloadUrlPresent,
    downloadNoncePresent,
    downloadExpiryActive,
    shareLeakSignalPresent,
  });
  const accessMode = modeFor(state);
  const finalPaidWatermarkedArtifactAllowed = state === "watermarked_delivery_allowed";
  const shareLeakReviewRequired = state === "share_leak_review_required";
  const blockers = unique([
    !args.pass2496 && "PASS2496 session/device anomaly lock missing",
    args.pass2496 && !args.pass2496.finalPaidSessionAccessAllowed && "PASS2496 finalPaidSessionAccessAllowed=false",
    !pass2496SessionLedgerKey && "PASS2496 sessionLedgerKey missing",
    !requestedSessionLedgerKey && "requested sessionLedgerKey missing",
    requestedSessionLedgerKey && !sessionLedgerMatch && "requested sessionLedgerKey does not match PASS2496",
    !artifactHashPresent && "artifactHash missing",
    !deliveryManifestKeyPresent && "deliveryManifestKey missing",
    !customerPseudonymHashPresent && "customer pseudonym hash missing",
    !watermarkFingerprintPresent && "watermark fingerprint missing",
    !signedDownloadUrlPresent && "signed download URL fingerprint missing",
    !downloadNoncePresent && "download nonce fingerprint missing",
    !downloadExpiryActive && "download URL expiry missing or expired",
    shareLeakSignalPresent && "share/leak signal requires support review before more paid artifact reads",
  ]).slice(0, 14);
  const watermarkLedgerKey = `PASS2497-${hash({
    version: PASS2497_ENTITLEMENT_ARTIFACT_WATERMARK_SHARE_LOCK_ID,
    query: bounded(args.query, 120),
    symbol: normalizeSymbol(args.symbol),
    pass2496SessionLedgerKey,
    requestedSessionLedgerKey,
    artifactHash,
    deliveryManifestKey,
    customerPseudonymHash,
    watermarkFingerprint,
    signedDownloadUrlFingerprint,
    downloadNonceFingerprint,
    shareLeakSignal,
  })}`;
  const surfaceWatermarkBindings = buildSurfaceBindings({ allowed: finalPaidWatermarkedArtifactAllowed, state, ledgerKey: watermarkLedgerKey });
  const customerMessage = finalPaidWatermarkedArtifactAllowed
    ? "Paid Advanced artifact delivery is watermarked, session-bound and protected by a short-lived signed download URL."
    : shareLeakReviewRequired
      ? "Paid Advanced artifact access is paused for share/leak review before more downloads are allowed."
      : "Paid Advanced artifact delivery is blocked until the watermark and signed download replay match the session ledger.";
  const operatorMessage = finalPaidWatermarkedArtifactAllowed
    ? "PASS2497 clear: PASS2496 session replay, artifact hash, delivery manifest, pseudonymous watermark, signed URL, nonce and expiry are aligned."
    : `PASS2497 blocked/review: ${blockers.join("; ") || "watermark ledger replay incomplete"}.`;
  const fingerprint = `PASS2497-${hash({ state, accessMode, finalPaidWatermarkedArtifactAllowed, blockers, watermarkLedgerKey })}`;
  return {
    version: PASS2497_ENTITLEMENT_ARTIFACT_WATERMARK_SHARE_LOCK_ID,
    state,
    accessMode,
    query: bounded(args.query, 120) || undefined,
    symbol: normalizeSymbol(args.symbol) || undefined,
    pass2496SessionLedgerKey: pass2496SessionLedgerKey || undefined,
    requestedSessionLedgerKey: requestedSessionLedgerKey || undefined,
    sessionLedgerMatch,
    artifactHashPresent,
    deliveryManifestKeyPresent,
    customerPseudonymHashPresent,
    watermarkFingerprintPresent,
    signedDownloadUrlPresent,
    downloadNoncePresent,
    downloadExpiryActive,
    shareLeakSignalPresent,
    publicCacheDenied: true,
    rawCustomerDataDenied: true,
    screenshotShareCannotProveEntitlement: true,
    finalPaidWatermarkedArtifactAllowed,
    shareLeakReviewRequired,
    linkedPass2496State: args.pass2496?.state,
    linkedPass2496AccessMode: args.pass2496?.accessMode,
    blockers,
    watermarkRequirements: [
      "Replay the exact PASS2496 sessionLedgerKey before any paid artifact read.",
      "Bind artifactHash + deliveryManifestKey + customerPseudonymHash to a visible watermarkFingerprint.",
      "Serve paid PDFs/reports only through short-lived signed URLs with one downloadNonceFingerprint.",
      "Deny public-cache, screenshot-share and copied-link access even when the user previously paid.",
      "Expose PASS2497 watermarkLedgerKey on PDF download, Browser preview, account console, VLM Brain and Angel.",
    ],
    forbiddenArtifactUnlocks: [
      "public cached PDF URL",
      "copied signed download URL after expiry",
      "shared screenshot as entitlement proof",
      "raw wallet address as customer watermark",
      "localStorage paid artifact flag",
      "checkout success redirect",
      "account vault token without PASS2496 session replay",
    ],
    surfaceWatermarkBindings,
    customerMessage,
    operatorMessage,
    redactionBoundary: "PASS2497 exposes pseudonymous hashes and watermark state only; raw customer identity, IP address, wallet signatures, card data and raw PDF bytes remain server-only.",
    nextImplementationActions: [
      "Stamp paid Advanced PDFs with customerPseudonymHash + artifactHash + PASS2497 watermarkLedgerKey.",
      "Issue short-lived signed download URLs from the account vault only after PASS2496 and PASS2497 replay.",
      "Rotate downloadNonceFingerprint after each successful read and deny copied links after expiry.",
      "Add support review workflow when shareLeakSignal is present before allowing another download.",
    ],
    watermarkLedgerKey,
    fingerprint,
    generatedAt: new Date().toISOString(),
  };
}
