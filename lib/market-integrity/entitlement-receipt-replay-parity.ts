import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "../security/ascii-control-characters";

import { createHash } from "node:crypto";
import type { Pass2490AdvancedCtaEntitlementContract, Pass2490SurfaceId } from "./advanced-cta-entitlement-contract";

export const PASS2491_ENTITLEMENT_RECEIPT_REPLAY_PARITY_ID = "entitlement-receipt-replay-parity-v1" as const;

export type Pass2491ReceiptReplayState = "unlock_allowed" | "receipt_required" | "parity_watch" | "blocked";
export type Pass2491UnlockMode = "paid_verdict_unlocked" | "missing_proof_map_unlocked" | "pre_receipt_locked" | "blocked";
export type Pass2491SurfaceId = Pass2490SurfaceId | "account_console";

export type Pass2491ReceiptReplayInput = {
  receiptId?: string;
  serverReceiptFingerprint?: string;
  pass2490Fingerprint?: string;
  productScope?: "paid_verdict" | "missing_proof_map" | "qa_preview" | "blocked" | string;
  ctaMode?: string;
  surface?: string;
  locale?: string;
  contextHash?: string;
  assetId?: string;
  symbol?: string;
  pdfHash?: string;
  angelReplayFingerprint?: string;
  checkoutSessionId?: string;
};

export type Pass2491SurfaceReplayBinding = {
  surface: Pass2491SurfaceId;
  expectedReceiptFingerprint: string;
  expectedPass2490Fingerprint: string;
  requiredVisibleCopy: string;
  replayRequired: boolean;
  unlockCopyAllowed: boolean;
};

export type Pass2491EntitlementReceiptReplayParity = {
  version: typeof PASS2491_ENTITLEMENT_RECEIPT_REPLAY_PARITY_ID;
  state: Pass2491ReceiptReplayState;
  query?: string;
  symbol?: string;
  unlockMode: Pass2491UnlockMode;
  finalPaidVerdictUnlockAllowed: boolean;
  missingProofMapUnlockAllowed: boolean;
  receiptReplayRequired: true;
  walletOnlyUnlockAllowed: false;
  serverReceiptPresent: boolean;
  receiptFingerprintMatchesPass2490: boolean;
  productScopeMatchesCtaMode: boolean;
  surfaceReplayParityReady: boolean;
  receiptRedactionBoundary: string;
  receiptReplayKey: string;
  accountConsoleCopy: string;
  customerMessage: string;
  operatorMessage: string;
  blockers: string[];
  replayRequirements: string[];
  surfaceReplayBindings: Pass2491SurfaceReplayBinding[];
  forbiddenUnlockStates: string[];
  nextImplementationActions: string[];
  linkedPass2490Fingerprint?: string;
  receiptFingerprint?: string;
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

function normalizeSymbol(value?: string) {
  return bounded(value, 40).toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 32);
}

function normalizeScope(value?: string): Pass2491ReceiptReplayInput["productScope"] {
  const clean = bounded(value, 40).toLowerCase();
  if (clean === "paid_verdict" || clean === "missing_proof_map" || clean === "qa_preview" || clean === "blocked") return clean;
  return clean || undefined;
}

function normalizeSurface(value?: string): Pass2491SurfaceId | undefined {
  const clean = bounded(value, 40).toLowerCase();
  if (["shield", "real_markets", "browser_pdf", "vlm_brain", "angel", "checkout", "account_console"].includes(clean)) return clean as Pass2491SurfaceId;
  return undefined;
}

function receiptPresent(receipt?: Pass2491ReceiptReplayInput | null) {
  return Boolean(receipt?.receiptId && receipt?.serverReceiptFingerprint && receipt?.contextHash);
}

function expectedPass2490Fingerprint(pass2490?: Pass2490AdvancedCtaEntitlementContract | null) {
  return bounded(pass2490?.fingerprint, 96, "");
}

function receiptFingerprintFor(receipt?: Pass2491ReceiptReplayInput | null) {
  const explicit = bounded(receipt?.serverReceiptFingerprint, 128, "");
  if (explicit) return explicit.toUpperCase();
  return "";
}

function productScopeMatches(pass2490?: Pass2490AdvancedCtaEntitlementContract | null, receipt?: Pass2491ReceiptReplayInput | null) {
  if (!pass2490 || !receiptPresent(receipt)) return false;
  const scope = normalizeScope(receipt?.productScope);
  if (pass2490.ctaMode === "paid_advanced_verdict") return scope === "paid_verdict";
  if (pass2490.ctaMode === "advanced_missing_proof_map") return scope === "missing_proof_map";
  if (pass2490.ctaMode === "advanced_qa_preview") return scope === "qa_preview";
  return false;
}

function pass2490FingerprintMatches(pass2490?: Pass2490AdvancedCtaEntitlementContract | null, receipt?: Pass2491ReceiptReplayInput | null) {
  if (!pass2490 || !receiptPresent(receipt)) return false;
  return bounded(receipt?.pass2490Fingerprint, 96, "").toUpperCase() === expectedPass2490Fingerprint(pass2490).toUpperCase();
}

function resolveState(args: {
  pass2490?: Pass2490AdvancedCtaEntitlementContract | null;
  receipt?: Pass2491ReceiptReplayInput | null;
  fingerprintMatches: boolean;
  scopeMatches: boolean;
}): Pass2491ReceiptReplayState {
  if (!args.pass2490 || args.pass2490.state === "blocked") return "blocked";
  if (!receiptPresent(args.receipt)) return "receipt_required";
  if (!args.fingerprintMatches || !args.scopeMatches) return "parity_watch";
  if (args.pass2490.finalPaidVerdictAllowed || args.pass2490.missingProofMapPaidAllowed) return "unlock_allowed";
  return "blocked";
}

function unlockModeFor(state: Pass2491ReceiptReplayState, pass2490?: Pass2490AdvancedCtaEntitlementContract | null): Pass2491UnlockMode {
  if (state === "unlock_allowed" && pass2490?.finalPaidVerdictAllowed) return "paid_verdict_unlocked";
  if (state === "unlock_allowed" && pass2490?.missingProofMapPaidAllowed) return "missing_proof_map_unlocked";
  if (state === "receipt_required" || state === "parity_watch") return "pre_receipt_locked";
  return "blocked";
}

function unique<T>(items: Array<T | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function surfaceBindings(args: {
  state: Pass2491ReceiptReplayState;
  pass2490?: Pass2490AdvancedCtaEntitlementContract | null;
  receiptFingerprint: string;
  expectedPass2490Fingerprint: string;
}): Pass2491SurfaceReplayBinding[] {
  const surfaces: Pass2491SurfaceId[] = ["checkout", "account_console", "shield", "real_markets", "browser_pdf", "vlm_brain", "angel"];
  const unlockCopyAllowed = args.state === "unlock_allowed";
  const copy = unlockCopyAllowed
    ? args.pass2490?.finalPaidVerdictAllowed
      ? "Paid Advanced verdict unlocked by receipt replay."
      : "Paid Advanced missing-proof map unlocked by receipt replay."
    : args.state === "receipt_required"
      ? "Receipt replay required before unlock copy."
      : "Receipt parity mismatch; keep Advanced locked.";
  return surfaces.map((surface) => ({
    surface,
    expectedReceiptFingerprint: args.receiptFingerprint || "server-receipt-required",
    expectedPass2490Fingerprint: args.expectedPass2490Fingerprint || "pass2490-required",
    requiredVisibleCopy: `${copy} surface=${surface}`,
    replayRequired: true,
    unlockCopyAllowed,
  }));
}

export function buildPass2491EntitlementReceiptReplayParity(args: {
  query?: string;
  symbol?: string;
  pass2490?: Pass2490AdvancedCtaEntitlementContract | null;
  receipt?: Pass2491ReceiptReplayInput | null;
}): Pass2491EntitlementReceiptReplayParity {
  const expected2490 = expectedPass2490Fingerprint(args.pass2490);
  const receiptFingerprint = receiptFingerprintFor(args.receipt);
  const fingerprintMatches = pass2490FingerprintMatches(args.pass2490, args.receipt);
  const scopeMatches = productScopeMatches(args.pass2490, args.receipt);
  const serverReceiptPresent = receiptPresent(args.receipt);
  const state = resolveState({ pass2490: args.pass2490, receipt: args.receipt, fingerprintMatches, scopeMatches });
  const unlockMode = unlockModeFor(state, args.pass2490);
  const normalizedSurface = normalizeSurface(args.receipt?.surface);
  const surfaceReplayParityReady = state === "unlock_allowed" && Boolean(normalizedSurface);
  const blockers = unique([
    !args.pass2490 && "PASS2490 advanced CTA entitlement contract missing",
    args.pass2490?.state === "blocked" && "PASS2490 blocks Advanced CTA",
    !serverReceiptPresent && "server receipt replay missing",
    serverReceiptPresent && !fingerprintMatches && "receipt PASS2490 fingerprint mismatch",
    serverReceiptPresent && !scopeMatches && "receipt productScope does not match PASS2490 ctaMode",
    serverReceiptPresent && !normalizedSurface && "receipt surface missing or invalid",
    state !== "unlock_allowed" && "Advanced unlock copy remains locked",
  ]).slice(0, 16);
  const replayKey = `PASS2491-${hash({
    query: args.query,
    symbol: normalizeSymbol(args.symbol || args.pass2490?.symbol || args.receipt?.symbol),
    expected2490,
    receiptFingerprint,
    receiptId: bounded(args.receipt?.receiptId, 120, ""),
    productScope: normalizeScope(args.receipt?.productScope),
    state,
    unlockMode,
  })}`;
  const fingerprint = hash({
    version: PASS2491_ENTITLEMENT_RECEIPT_REPLAY_PARITY_ID,
    replayKey,
    expected2490,
    receiptFingerprint,
    state,
    unlockMode,
    blockers: blockers.slice(0, 8),
  });
  const finalPaidVerdictUnlockAllowed = unlockMode === "paid_verdict_unlocked";
  const missingProofMapUnlockAllowed = unlockMode === "missing_proof_map_unlocked";
  return {
    version: PASS2491_ENTITLEMENT_RECEIPT_REPLAY_PARITY_ID,
    state,
    query: args.query,
    symbol: normalizeSymbol(args.symbol || args.pass2490?.symbol || args.receipt?.symbol),
    unlockMode,
    finalPaidVerdictUnlockAllowed,
    missingProofMapUnlockAllowed,
    receiptReplayRequired: true,
    walletOnlyUnlockAllowed: false,
    serverReceiptPresent,
    receiptFingerprintMatchesPass2490: fingerprintMatches,
    productScopeMatchesCtaMode: scopeMatches,
    surfaceReplayParityReady,
    receiptRedactionBoundary: "PASS2491 stores receipt fingerprints, context hashes, product scope and replay metadata only. Do not store raw card data, raw wallet signatures, secret keys, raw PDFs, raw screenshots or trading instructions.",
    receiptReplayKey: replayKey,
    accountConsoleCopy: finalPaidVerdictUnlockAllowed
      ? "Account receipt unlocks Advanced paid evidence verdict for this exact scope."
      : missingProofMapUnlockAllowed
        ? "Account receipt unlocks Advanced missing-proof map only; it is not a final verdict."
        : "Account receipt replay is required before Advanced unlock copy can appear.",
    customerMessage: finalPaidVerdictUnlockAllowed
      ? "Advanced is unlocked for this exact receipt, product scope and PASS2490 fingerprint."
      : missingProofMapUnlockAllowed
        ? "Advanced missing-proof map is unlocked; missing lanes remain part of the paid transparency product."
        : "Advanced remains locked until a server receipt with matching product scope, context hash and PASS2490 fingerprint is replayed.",
    operatorMessage: finalPaidVerdictUnlockAllowed || missingProofMapUnlockAllowed
      ? "Persist PASS2491 replayKey to account console, PDF receipt, Angel replay and checkout session metadata."
      : "Do not show paid Advanced unlock state; collect server receipt, product scope and PASS2490 fingerprint first.",
    blockers,
    replayRequirements: [
      "server receipt id and fingerprint bound to checkout session",
      "contextHash must match symbol/assetId/surface/locale/depth=advanced",
      "productScope must match PASS2490 ctaMode: paid_verdict, missing_proof_map or qa_preview",
      "PASS2490 fingerprint must match the checkout intent and the generated Advanced surface",
      "account console, PDF download, Shield/Real Markets modal, VLM Brain and Angel must expose the same PASS2491 replayKey",
    ],
    surfaceReplayBindings: surfaceBindings({ state, pass2490: args.pass2490, receiptFingerprint, expectedPass2490Fingerprint: expected2490 }),
    forbiddenUnlockStates: [
      "wallet connected = paid Advanced unlocked",
      "Stripe redirect success without replayed server receipt = Advanced unlocked",
      "receipt scope missing but PDF/Angel says paid verdict",
      "PASS2490 fingerprint mismatch but final verdict copy shown",
      "missing-proof map receipt described as final paid verdict",
    ],
    nextImplementationActions: state === "unlock_allowed"
      ? ["Show PASS2491 replayKey in account console", "Attach replayKey to PDF receipt footer", "Pass replayKey into Angel answer metadata", "Open PASS2492 artifact delivery ledger before delivered paid report copy"]
      : ["Add server-side receipt replay to checkout success", "Bind productScope to PASS2490 ctaMode", "Store PASS2491 replayKey with entitlement ledger before unlock", "Capture PDF preview/download hashes and accountDeliveryId for PASS2492"],
    linkedPass2490Fingerprint: expected2490 || undefined,
    receiptFingerprint: receiptFingerprint || undefined,
    fingerprint,
    generatedAt: new Date().toISOString(),
  };
}
