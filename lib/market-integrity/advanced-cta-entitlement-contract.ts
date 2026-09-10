import { createHash } from "node:crypto";
import type { Pass2489TierCommercialValueContract } from "./tier-commercial-value-contract";

export const PASS2490_ADVANCED_CTA_ENTITLEMENT_CONTRACT_ID = "advanced-cta-entitlement-contract-v1" as const;

export type Pass2490CtaState = "paid_cta_allowed" | "missing_proof_map_allowed" | "qa_preview_only" | "blocked";
export type Pass2490CtaMode = "paid_advanced_verdict" | "advanced_missing_proof_map" | "advanced_qa_preview" | "disabled";
export type Pass2490SurfaceId = "shield" | "real_markets" | "browser_pdf" | "vlm_brain" | "angel" | "checkout";

export type Pass2490SurfaceBinding = {
  surface: Pass2490SurfaceId;
  requiredVisibleCopy: string;
  requiredFingerprint: string;
  ctaAllowed: boolean;
  finalVerdictCopyAllowed: boolean;
};

export type Pass2490AdvancedCtaEntitlementContract = {
  version: typeof PASS2490_ADVANCED_CTA_ENTITLEMENT_CONTRACT_ID;
  state: Pass2490CtaState;
  query?: string;
  symbol?: string;
  ctaMode: Pass2490CtaMode;
  checkoutProductMode: "paid_verdict" | "missing_proof_map" | "qa_preview" | "blocked";
  paidCheckoutAllowed: boolean;
  finalPaidVerdictAllowed: boolean;
  missingProofMapPaidAllowed: boolean;
  walletOnlyUnlockAllowed: false;
  serverReceiptRequired: true;
  ctaLabel: string;
  customerMessage: string;
  operatorMessage: string;
  hardLocks: string[];
  entitlementRequirements: string[];
  checkoutDisclosureCards: Array<{ label: string; body: string; state: "ready" | "watch" | "blocked" }>;
  surfaceBindings: Pass2490SurfaceBinding[];
  forbiddenCopy: string[];
  nextImplementationActions: string[];
  linkedPass2489Fingerprint?: string;
  fingerprint: string;
  generatedAt: string;
};

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32).toUpperCase();
}

function normalizeSymbol(value?: string) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 32);
}

function unique<T>(items: Array<T | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function resolveState(pass2489?: Pass2489TierCommercialValueContract | null): Pass2490CtaState {
  if (!pass2489) return "blocked";
  if (pass2489.paidAdvancedAllowed && pass2489.advancedCopyMode === "paid_verdict_allowed") return "paid_cta_allowed";
  if (pass2489.advancedCopyMode === "sell_as_missing_proof_map_only" && pass2489.advancedWorthChargingForMissingProofMap) return "missing_proof_map_allowed";
  if (pass2489.advancedCopyMode === "free_preview_only") return "qa_preview_only";
  return "blocked";
}

function ctaModeFor(state: Pass2490CtaState): Pass2490CtaMode {
  if (state === "paid_cta_allowed") return "paid_advanced_verdict";
  if (state === "missing_proof_map_allowed") return "advanced_missing_proof_map";
  if (state === "qa_preview_only") return "advanced_qa_preview";
  return "disabled";
}

function checkoutModeFor(state: Pass2490CtaState): Pass2490AdvancedCtaEntitlementContract["checkoutProductMode"] {
  if (state === "paid_cta_allowed") return "paid_verdict";
  if (state === "missing_proof_map_allowed") return "missing_proof_map";
  if (state === "qa_preview_only") return "qa_preview";
  return "blocked";
}

function ctaLabelFor(state: Pass2490CtaState) {
  if (state === "paid_cta_allowed") return "Buy Advanced evidence verdict";
  if (state === "missing_proof_map_allowed") return "Open Advanced missing-proof map";
  if (state === "qa_preview_only") return "Preview Advanced QA";
  return "Advanced locked";
}

function customerMessageFor(state: Pass2490CtaState) {
  if (state === "paid_cta_allowed") {
    return "Advanced may be sold as a source-bound paid evidence verdict because the commercial value contract, paid fuse and provenance locks are all aligned.";
  }
  if (state === "missing_proof_map_allowed") {
    return "Advanced can be shown only as a premium missing-proof map: you are paying for proof transparency, not a final verdict.";
  }
  if (state === "qa_preview_only") {
    return "Advanced remains a QA preview until the premium lanes and receipt parity are ready.";
  }
  return "Advanced checkout and verdict copy stay locked until the PASS2489 value contract exists and is visible.";
}

function operatorMessageFor(state: Pass2490CtaState) {
  if (state === "paid_cta_allowed") return "Enable paid Advanced CTA only with server receipt, product scope and PASS2490 fingerprint stored on the entitlement ledger.";
  if (state === "missing_proof_map_allowed") return "Do not use final-verdict copy; checkout label and receipt must explicitly say Advanced missing-proof map.";
  if (state === "qa_preview_only") return "Keep CTA as preview/test; do not request paid final-verdict checkout.";
  return "Block CTA and route operator to evidence hydration/backfill tasks.";
}

function disclosureCards(state: Pass2490CtaState, pass2489?: Pass2489TierCommercialValueContract | null): Pass2490AdvancedCtaEntitlementContract["checkoutDisclosureCards"] {
  const locks = pass2489?.paidVerdictBlockers ?? [];
  return [
    {
      label: "Advanced copy mode",
      body: pass2489?.advancedCopyMode ?? "blocked: missing PASS2489 contract",
      state: state === "paid_cta_allowed" ? "ready" : state === "missing_proof_map_allowed" ? "watch" : "blocked",
    },
    {
      label: "What customer buys",
      body: state === "paid_cta_allowed" ? "Source-bound paid evidence verdict." : state === "missing_proof_map_allowed" ? "Premium map of missing and ready proof lanes." : "QA preview only, no paid conclusion.",
      state: state === "paid_cta_allowed" ? "ready" : state === "missing_proof_map_allowed" ? "watch" : "blocked",
    },
    {
      label: "Receipt rule",
      body: "Server receipt and product scope are required; wallet connect alone never unlocks Advanced.",
      state: "ready",
    },
    {
      label: "Visible blockers",
      body: locks.length ? locks.slice(0, 3).join(" · ") : state === "paid_cta_allowed" ? "No paid-verdict blocker from PASS2489." : "Premium blockers must stay visible before checkout.",
      state: locks.length ? "watch" : state === "paid_cta_allowed" ? "ready" : "blocked",
    },
  ];
}

function buildSurfaceBindings(args: {
  state: Pass2490CtaState;
  pass2489?: Pass2489TierCommercialValueContract | null;
  fingerprint: string;
}): Pass2490SurfaceBinding[] {
  const finalVerdictCopyAllowed = args.state === "paid_cta_allowed";
  const ctaAllowed = args.state === "paid_cta_allowed" || args.state === "missing_proof_map_allowed";
  const mode = args.pass2489?.advancedCopyMode ?? "blocked";
  const copy = finalVerdictCopyAllowed
    ? "Advanced paid verdict allowed with source-bound limits."
    : ctaAllowed
      ? "Advanced missing-proof map only; no final verdict copy."
      : "Advanced QA/blocked; no paid CTA.";
  return (["shield", "real_markets", "browser_pdf", "vlm_brain", "angel", "checkout"] as Pass2490SurfaceId[]).map((surface) => ({
    surface,
    requiredVisibleCopy: `${copy} copyMode=${mode}`,
    requiredFingerprint: args.fingerprint,
    ctaAllowed,
    finalVerdictCopyAllowed,
  }));
}

export function buildPass2490AdvancedCtaEntitlementContract(args: {
  query?: string;
  symbol?: string;
  pass2489?: Pass2489TierCommercialValueContract | null;
}): Pass2490AdvancedCtaEntitlementContract {
  const state = resolveState(args.pass2489);
  const ctaMode = ctaModeFor(state);
  const checkoutProductMode = checkoutModeFor(state);
  const hardLocks = unique([
    !args.pass2489 && "PASS2489 tier commercial value contract missing",
    ...(args.pass2489?.paidVerdictBlockers ?? []),
    state !== "paid_cta_allowed" && "final paid-verdict copy not allowed",
    state === "qa_preview_only" && "Advanced is QA preview only",
    state === "blocked" && "Advanced CTA blocked",
  ]).slice(0, 16);
  const baseFingerprint = hash({
    version: PASS2490_ADVANCED_CTA_ENTITLEMENT_CONTRACT_ID,
    query: args.query,
    symbol: normalizeSymbol(args.symbol || args.pass2489?.symbol),
    state,
    ctaMode,
    pass2489Fingerprint: args.pass2489?.fingerprint,
    pass2489Mode: args.pass2489?.advancedCopyMode,
    hardLocks: hardLocks.slice(0, 8),
  });
  const surfaceBindings = buildSurfaceBindings({ state, pass2489: args.pass2489, fingerprint: baseFingerprint });
  return {
    version: PASS2490_ADVANCED_CTA_ENTITLEMENT_CONTRACT_ID,
    state,
    query: args.query,
    symbol: normalizeSymbol(args.symbol || args.pass2489?.symbol),
    ctaMode,
    checkoutProductMode,
    paidCheckoutAllowed: state === "paid_cta_allowed" || state === "missing_proof_map_allowed",
    finalPaidVerdictAllowed: state === "paid_cta_allowed",
    missingProofMapPaidAllowed: state === "missing_proof_map_allowed",
    walletOnlyUnlockAllowed: false,
    serverReceiptRequired: true,
    ctaLabel: ctaLabelFor(state),
    customerMessage: customerMessageFor(state),
    operatorMessage: operatorMessageFor(state),
    hardLocks,
    entitlementRequirements: [
      "server receipt id bound to productId, symbol/assetId, surface, locale and depth=advanced",
      "PASS2490 fingerprint must be stored with the checkout intent and PASS2491 receipt replay",
      "Wallet address can identify context but cannot unlock paid Advanced without server receipt",
      "PDF preview, PDF download, Shield/Real Markets modal, VLM Brain and Angel must share the same ctaMode",
      "If ctaMode=advanced_missing_proof_map, the receipt and UI must not say final verdict",
    ],
    checkoutDisclosureCards: disclosureCards(state, args.pass2489),
    surfaceBindings,
    forbiddenCopy: [
      "Buy Advanced for guaranteed safety",
      "Buy Advanced for entry/exit/leverage instruction",
      "Paid verdict allowed when ctaMode is advanced_missing_proof_map or advanced_qa_preview",
      "Wallet connected = paid entitlement",
      "Advanced is worth buying because it has longer text or more visual polish",
    ],
    nextImplementationActions: state === "paid_cta_allowed"
      ? ["Persist PASS2490 fingerprint in entitlement ledger", "Capture checkout receipt replay through PASS2491 and delivered artifact parity through PASS2492", "Show PASS2491 receipt replay key and PASS2492 deliveryManifestKey in account console"]
      : state === "missing_proof_map_allowed"
        ? ["Rename checkout product to Advanced missing-proof map", "Show blockers before payment", "Hydrate missing lanes before final-verdict CTA"]
        : ["Keep Advanced free/QA preview", "Complete PASS2489 blockers", "Add server-side entitlement receipt + PASS2491 replay parity + PASS2492 artifact delivery parity before paid surface"],
    linkedPass2489Fingerprint: args.pass2489?.fingerprint,
    fingerprint: baseFingerprint,
    generatedAt: new Date().toISOString(),
  };
}
