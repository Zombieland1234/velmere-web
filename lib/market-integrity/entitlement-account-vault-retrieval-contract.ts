import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "../security/ascii-control-characters";

import { createHash } from "node:crypto";
import type { Pass2492EntitlementArtifactDeliveryLedger } from "./entitlement-artifact-delivery-ledger";

export const PASS2493_ENTITLEMENT_ACCOUNT_VAULT_RETRIEVAL_CONTRACT_ID = "entitlement-account-vault-retrieval-contract-v1" as const;

export type Pass2493VaultRetrievalState = "vault_delivery_ready" | "delivery_manifest_required" | "account_binding_required" | "artifact_hash_required" | "blocked";
export type Pass2493VaultRetrievalMode = "paid_report_vault_access" | "missing_proof_map_vault_access" | "pre_vault_locked" | "blocked";
export type Pass2493VaultSurface = "account_console" | "account_message_card" | "pdf_download" | "browser_preview" | "vlm_brain" | "angel" | "checkout_success";

export type Pass2493AccountVaultInput = {
  accountId?: string;
  accountEmailHash?: string;
  accountSessionFingerprint?: string;
  accountDeliveryId?: string;
  accountDeliveryFingerprint?: string;
  deliveryManifestKey?: string;
  artifactHash?: string;
  vaultReadTokenFingerprint?: string;
  requestSurface?: string;
  locale?: string;
};

export type Pass2493VaultSurfaceBinding = {
  surface: Pass2493VaultSurface;
  mustShowDeliveryManifestKey: boolean;
  mustShowAccountDeliveryId: boolean;
  mustVerifyVaultReadToken: boolean;
  publicCacheAllowed: false;
  rawArtifactBytesAllowed: false;
  retrievalCopyAllowed: boolean;
  requiredVisibleCopy: string;
};

export type Pass2493EntitlementAccountVaultRetrievalContract = {
  version: typeof PASS2493_ENTITLEMENT_ACCOUNT_VAULT_RETRIEVAL_CONTRACT_ID;
  state: Pass2493VaultRetrievalState;
  retrievalMode: Pass2493VaultRetrievalMode;
  query?: string;
  symbol?: string;
  accountVaultRetrievalAllowed: boolean;
  finalPaidVerdictVaultAccessAllowed: boolean;
  missingProofMapVaultAccessAllowed: boolean;
  accountSessionRequired: true;
  serverDeliveryManifestRequired: true;
  walletOnlyVaultAccessAllowed: false;
  localStorageUnlockAllowed: false;
  publicCacheAllowed: false;
  rawArtifactBytesAllowed: false;
  deliveryManifestMatchesPass2492: boolean;
  artifactHashMatchesDeliveryLedger: boolean;
  accountBindingReady: boolean;
  vaultReadTokenReady: boolean;
  linkedPass2492DeliveryManifestKey?: string;
  linkedPass2492ArtifactHash?: string;
  accountDeliveryId?: string;
  accountDeliveryFingerprint?: string;
  vaultRetrievalKey: string;
  customerMessage: string;
  operatorMessage: string;
  blockers: string[];
  vaultRequirements: string[];
  surfaceVaultBindings: Pass2493VaultSurfaceBinding[];
  forbiddenVaultStates: string[];
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

function normalizeKey(value?: string) {
  return bounded(value, 220, "").toUpperCase().replace(/[^A-Z0-9:_-]/g, "").slice(0, 220);
}

function normalizeSymbol(value?: string) {
  return bounded(value, 40).toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 32);
}

function unique<T>(items: Array<T | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function resolveArtifactHash(pass2492?: Pass2492EntitlementArtifactDeliveryLedger | null, accountVault?: Pass2493AccountVaultInput | null) {
  return normalizeKey(accountVault?.artifactHash) || normalizeKey(pass2492?.artifactHash);
}

function resolveState(args: {
  pass2492?: Pass2492EntitlementArtifactDeliveryLedger | null;
  deliveryManifestMatchesPass2492: boolean;
  artifactHashMatchesDeliveryLedger: boolean;
  accountBindingReady: boolean;
  vaultReadTokenReady: boolean;
}): Pass2493VaultRetrievalState {
  if (!args.pass2492 || args.pass2492.state === "blocked") return "blocked";
  if (!args.pass2492.artifactDeliveryAllowed) return "delivery_manifest_required";
  if (!args.deliveryManifestMatchesPass2492) return "delivery_manifest_required";
  if (!args.artifactHashMatchesDeliveryLedger) return "artifact_hash_required";
  if (!args.accountBindingReady || !args.vaultReadTokenReady) return "account_binding_required";
  return "vault_delivery_ready";
}

function retrievalModeFor(state: Pass2493VaultRetrievalState, pass2492?: Pass2492EntitlementArtifactDeliveryLedger | null): Pass2493VaultRetrievalMode {
  if (state === "vault_delivery_ready" && pass2492?.finalPaidVerdictArtifactAllowed) return "paid_report_vault_access";
  if (state === "vault_delivery_ready" && pass2492?.missingProofMapArtifactAllowed) return "missing_proof_map_vault_access";
  if (state === "delivery_manifest_required" || state === "artifact_hash_required" || state === "account_binding_required") return "pre_vault_locked";
  return "blocked";
}

function surfaceBindings(args: {
  retrievalAllowed: boolean;
  vaultRetrievalKey: string;
  pass2492?: Pass2492EntitlementArtifactDeliveryLedger | null;
}): Pass2493VaultSurfaceBinding[] {
  const surfaces: Pass2493VaultSurface[] = ["account_console", "account_message_card", "browser_preview", "pdf_download", "vlm_brain", "angel", "checkout_success"];
  const baseCopy = args.retrievalAllowed
    ? args.pass2492?.finalPaidVerdictArtifactAllowed
      ? "Paid Advanced report vault access is allowed from the server delivery manifest."
      : "Advanced missing-proof map vault access is allowed from the server delivery manifest."
    : "Report vault access is locked until PASS2492 delivery manifest, artifact hash and account binding are replay-verified.";
  return surfaces.map((surface) => ({
    surface,
    mustShowDeliveryManifestKey: true,
    mustShowAccountDeliveryId: surface === "account_console" || surface === "account_message_card" || surface === "angel",
    mustVerifyVaultReadToken: surface === "account_console" || surface === "pdf_download" || surface === "account_message_card",
    publicCacheAllowed: false,
    rawArtifactBytesAllowed: false,
    retrievalCopyAllowed: args.retrievalAllowed,
    requiredVisibleCopy: `${baseCopy} vaultKey=${args.vaultRetrievalKey} surface=${surface}`,
  }));
}

export function buildPass2493EntitlementAccountVaultRetrievalContract(args: {
  query?: string;
  symbol?: string;
  pass2492?: Pass2492EntitlementArtifactDeliveryLedger | null;
  accountVault?: Pass2493AccountVaultInput | null;
}): Pass2493EntitlementAccountVaultRetrievalContract {
  const requestedManifestKey = normalizeKey(args.accountVault?.deliveryManifestKey);
  const linkedManifestKey = normalizeKey(args.pass2492?.deliveryManifestKey);
  const deliveryManifestMatchesPass2492 = Boolean(linkedManifestKey && requestedManifestKey && linkedManifestKey === requestedManifestKey);
  const artifactHash = resolveArtifactHash(args.pass2492, args.accountVault);
  const linkedArtifactHash = normalizeKey(args.pass2492?.artifactHash);
  const requestedArtifactHash = normalizeKey(args.accountVault?.artifactHash);
  const artifactHashMatchesDeliveryLedger = Boolean(linkedArtifactHash && requestedArtifactHash && linkedArtifactHash === requestedArtifactHash);
  const accountDeliveryId = bounded(args.accountVault?.accountDeliveryId, 140, "");
  const accountDeliveryFingerprint = normalizeKey(args.accountVault?.accountDeliveryFingerprint);
  const accountSessionFingerprint = normalizeKey(args.accountVault?.accountSessionFingerprint);
  const accountId = bounded(args.accountVault?.accountId, 140, "");
  const vaultReadTokenFingerprint = normalizeKey(args.accountVault?.vaultReadTokenFingerprint);
  const accountBindingReady = Boolean(accountId && accountSessionFingerprint && accountDeliveryId && accountDeliveryFingerprint);
  const vaultReadTokenReady = Boolean(vaultReadTokenFingerprint);
  const state = resolveState({
    pass2492: args.pass2492,
    deliveryManifestMatchesPass2492,
    artifactHashMatchesDeliveryLedger,
    accountBindingReady,
    vaultReadTokenReady,
  });
  const retrievalMode = retrievalModeFor(state, args.pass2492);
  const accountVaultRetrievalAllowed = state === "vault_delivery_ready";
  const finalPaidVerdictVaultAccessAllowed = retrievalMode === "paid_report_vault_access";
  const missingProofMapVaultAccessAllowed = retrievalMode === "missing_proof_map_vault_access";
  const vaultRetrievalKey = `PASS2493-${hash({
    query: args.query,
    symbol: normalizeSymbol(args.symbol || args.pass2492?.symbol),
    linkedManifestKey,
    artifactHash,
    accountDeliveryId,
    accountSessionFingerprint,
    state,
    retrievalMode,
  })}`;
  const blockers = unique([
    !args.pass2492 && "PASS2492 artifact delivery ledger missing",
    args.pass2492 && !args.pass2492.artifactDeliveryAllowed && "PASS2492 artifact delivery not allowed yet",
    !deliveryManifestMatchesPass2492 && "deliveryManifestKey does not match PASS2492",
    !artifactHashMatchesDeliveryLedger && "artifact hash does not match PASS2492 artifact hash",
    !accountId && "account id missing",
    !accountSessionFingerprint && "account session fingerprint missing",
    !accountDeliveryId && "accountDeliveryId missing",
    !accountDeliveryFingerprint && "account delivery fingerprint missing",
    !vaultReadTokenReady && "server vault read token fingerprint missing",
    state !== "vault_delivery_ready" && "Advanced account vault retrieval copy remains locked",
  ]).slice(0, 16);
  const fingerprint = hash({
    version: PASS2493_ENTITLEMENT_ACCOUNT_VAULT_RETRIEVAL_CONTRACT_ID,
    vaultRetrievalKey,
    linkedManifestKey,
    linkedArtifactHash,
    accountDeliveryFingerprint,
    vaultReadTokenFingerprint,
    state,
    retrievalMode,
    blockers: blockers.slice(0, 8),
  });

  return {
    version: PASS2493_ENTITLEMENT_ACCOUNT_VAULT_RETRIEVAL_CONTRACT_ID,
    state,
    retrievalMode,
    query: bounded(args.query, 140, undefined as unknown as string),
    symbol: normalizeSymbol(args.symbol || args.pass2492?.symbol),
    accountVaultRetrievalAllowed,
    finalPaidVerdictVaultAccessAllowed,
    missingProofMapVaultAccessAllowed,
    accountSessionRequired: true,
    serverDeliveryManifestRequired: true,
    walletOnlyVaultAccessAllowed: false,
    localStorageUnlockAllowed: false,
    publicCacheAllowed: false,
    rawArtifactBytesAllowed: false,
    deliveryManifestMatchesPass2492,
    artifactHashMatchesDeliveryLedger,
    accountBindingReady,
    vaultReadTokenReady,
    linkedPass2492DeliveryManifestKey: linkedManifestKey || undefined,
    linkedPass2492ArtifactHash: linkedArtifactHash || undefined,
    accountDeliveryId: accountDeliveryId || undefined,
    accountDeliveryFingerprint: accountDeliveryFingerprint || undefined,
    vaultRetrievalKey,
    customerMessage: accountVaultRetrievalAllowed
      ? finalPaidVerdictVaultAccessAllowed
        ? "Paid Advanced report is available from the account vault with server receipt and artifact replay."
        : "Advanced missing-proof map is available from the account vault with server receipt and artifact replay."
      : "Advanced report vault access is locked until delivery manifest, artifact hash and account binding are verified server-side.",
    operatorMessage: accountVaultRetrievalAllowed
      ? "PASS2493 vault retrieval ready. Keep deliveryManifestKey, artifact hash and accountDeliveryId visible in the account console and PDF download footer."
      : `PASS2493 vault retrieval locked: ${blockers.join("; ") || "missing server vault inputs"}`,
    blockers,
    vaultRequirements: [
      "PASS2492 artifactDeliveryAllowed=true",
      "request deliveryManifestKey must match PASS2492 deliveryManifestKey",
      "request artifactHash must match PASS2492 artifactHash",
      "accountId + accountSessionFingerprint + accountDeliveryId + accountDeliveryFingerprint required",
      "server vaultReadTokenFingerprint required before report download",
      "no wallet-only, localStorage-only or public-cache unlock path",
    ],
    surfaceVaultBindings: surfaceBindings({ retrievalAllowed: accountVaultRetrievalAllowed, vaultRetrievalKey, pass2492: args.pass2492 }),
    forbiddenVaultStates: [
      "wallet connect alone unlocks account report",
      "checkout success page reads paid artifact from localStorage only",
      "public cached PDF URL becomes the access proof",
      "raw card data, raw wallet signature or raw PDF bytes stored inside the vault contract",
      "account card says delivered while PASS2492 delivery manifest is missing",
    ],
    redactionBoundary: "PASS2493 stores only account/session fingerprints, delivery manifest keys, artifact hashes, vault read token fingerprints and account delivery identifiers. It must not store raw card data, seed phrases, wallet private keys, raw signatures, raw PDF bytes or investment instructions.",
    nextImplementationActions: accountVaultRetrievalAllowed
      ? ["Show PASS2493 vaultRetrievalKey on account message card", "Attach vaultRetrievalKey to PDF download footer", "Keep Angel and VLM Brain from saying vault delivered without PASS2493"]
      : ["Create server-side vaultReadTokenFingerprint after PASS2492 delivery manifest", "Bind accountId/session to accountDeliveryId", "Match artifactHash to PASS2492 before enabling PDF download", "Render locked vault card in Account until replay is ready"],
    fingerprint,
    generatedAt: new Date().toISOString(),
  };
}
