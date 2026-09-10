import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2821DeliveryStatus } from "@/lib/market-integrity/top1-customer-delivery-ledger";

export type Pass2822TokenState =
  | "not_required"
  | "issued"
  | "missing"
  | "consumed"
  | "expired"
  | "revoked"
  | "payload_mismatch";

export type Pass2822VaultState = "ready" | "metadata_only" | "locked" | "blocked";
export type Pass2822DeliveryState = "available" | "resend_required" | "metadata_only" | "blocked";
export type Pass2822ReleaseStatus = "pass" | "warn" | "block";
export type Pass2822TimelineEventKind =
  | "receipt_bound"
  | "token_issued"
  | "download_consumed"
  | "vault_written"
  | "email_notice_sent"
  | "resend_requested"
  | "token_blocked";

export type Pass2822AccountVaultEvent = {
  kind: Pass2822TimelineEventKind;
  status: "prepared" | "required" | "blocked" | "complete";
  rule: string;
};

export type Pass2822AccountVaultTokenConsumptionGate = {
  schemaVersion: "pass2822_account_vault_token_consumption_gate_v1";
  surface: string;
  tier: VelmereTier;
  tokenState: Pass2822TokenState;
  vaultState: Pass2822VaultState;
  deliveryState: Pass2822DeliveryState;
  tokenEnvelope: {
    oneTimeTokenRequired: boolean;
    tokenPresent: boolean;
    issuedAt: string | null;
    expiresAt: string | null;
    consumedAt: string | null;
    revokedAt: string | null;
    expiresInMinutes: number;
    replayCount: number;
    payloadHashBound: boolean;
    deliveredPayloadHashMatches: boolean;
    sourceReceiptRootBound: boolean;
    rule: string;
  };
  accountVaultEnvelope: {
    accountBound: boolean;
    serverReceiptPresent: boolean;
    storageMode: "full_report_reference" | "metadata_only" | "none";
    rawProviderSecretsStored: false;
    operatorPrivateNotesStoredForCustomer: false;
    rule: string;
  };
  resendPolicy: {
    resendAllowed: boolean;
    requiresFreshToken: boolean;
    reason: string;
  };
  timeline: Pass2822AccountVaultEvent[];
  releaseGate: {
    status: Pass2822ReleaseStatus;
    reasons: string[];
  };
};

export const PASS2822_ACCOUNT_VAULT_TOKEN_ACCEPTANCE_GATES = [
  "PASS2822: One-time report tokens have explicit issued/consumed/expired/revoked/payload-mismatch states; missing state cannot silently render paid evidence.",
  "PASS2822: Consumed, expired, revoked or payload-mismatched tokens downgrade delivery to metadata-only or blocked and require a fresh server-side token issue.",
  "PASS2822: Account vault writes are references to reportId/payloadHash/sourceReceiptRoot/serverReceipt only; they never store provider secrets or hidden prompts.",
  "PASS2822: Email resend never reuses a consumed token; resend creates a new token tied to the same payloadHash/sourceReceiptRoot after entitlement is rechecked.",
  "PASS2822: Basic may be metadata-delivered without a paid token, but Pro/Advanced delivery requires account binding, server receipt and unconsumed one-time token.",
  "PASS2822: Runtime degraded/circuit-open or PDF cleanroom blocked states prevent full report download even when a token exists.",
] as const;

function isoPlusMinutes(iso: string, minutes: number) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function isExpired(nowIso: string, issuedAt: string | null | undefined, expiresInMinutes: number) {
  if (!issuedAt) return false;
  const expiresAt = isoPlusMinutes(issuedAt, expiresInMinutes);
  if (!expiresAt) return false;
  return new Date(nowIso).getTime() > new Date(expiresAt).getTime();
}

export function buildPass2822AccountVaultTokenConsumptionGate(args: {
  surface: string;
  tier: VelmereTier;
  accountBound: boolean;
  serverReceiptPresent: boolean;
  reportToken?: string | null;
  reportTokenStatus?: "issued" | "consumed" | "expired" | "revoked" | null;
  payloadHash?: string | null;
  deliveredPayloadHash?: string | null;
  sourceReceiptRoot?: string | null;
  customerDeliveryStatus?: Pass2821DeliveryStatus | null;
  pdfCleanroomStatus?: string | null;
  runtimeState?: string | null;
  issuedAt?: string | null;
  consumedAt?: string | null;
  revokedAt?: string | null;
  now?: string;
  expiresInMinutes?: number;
  replayCount?: number;
  resendRequested?: boolean;
  chargebackOrRevoked?: boolean;
}): Pass2822AccountVaultTokenConsumptionGate {
  const now = args.now ?? new Date().toISOString();
  const expiresInMinutes = Math.max(1, Math.min(args.expiresInMinutes ?? (args.tier === "Advanced" ? 5 : args.tier === "Pro" ? 10 : 15), 60));
  const paidTier = args.tier === "Pro" || args.tier === "Advanced";
  const oneTimeTokenRequired = paidTier;
  const tokenPresent = Boolean(args.reportToken);
  const payloadHashBound = Boolean(args.payloadHash);
  const sourceReceiptRootBound = Boolean(args.sourceReceiptRoot);
  const deliveredPayloadHashMatches = !args.deliveredPayloadHash || !args.payloadHash || args.deliveredPayloadHash === args.payloadHash;
  const replayCount = Math.max(0, args.replayCount ?? 0);

  let tokenState: Pass2822TokenState = oneTimeTokenRequired ? "missing" : "not_required";
  if (tokenPresent) tokenState = "issued";
  if (tokenPresent && isExpired(now, args.issuedAt, expiresInMinutes)) tokenState = "expired";
  if (args.reportTokenStatus === "expired") tokenState = "expired";
  if (args.reportTokenStatus === "consumed" || args.consumedAt) tokenState = "consumed";
  if (args.reportTokenStatus === "revoked" || args.revokedAt || args.chargebackOrRevoked) tokenState = "revoked";
  if (!deliveredPayloadHashMatches) tokenState = "payload_mismatch";

  const hardBlocks: string[] = [];
  const warnings: string[] = [];
  if (args.pdfCleanroomStatus === "blocked") hardBlocks.push("PDF cleanroom blocked full report delivery.");
  if (args.runtimeState === "circuit_open") hardBlocks.push("Runtime circuit is open; delivery must not expose source-looking evidence.");
  if (args.customerDeliveryStatus === "blocked") hardBlocks.push("Customer delivery ledger is already blocked.");
  if (tokenState === "revoked") hardBlocks.push("Report token was revoked or chargeback/revocation policy fired.");
  if (tokenState === "payload_mismatch") hardBlocks.push("Delivered payload hash does not match the report payload hash.");
  if (paidTier && tokenState === "consumed") warnings.push("Report token already consumed; resend requires a fresh server-issued token.");
  if (paidTier && tokenState === "expired") warnings.push("Report token expired; full delivery requires a fresh token.");
  if (paidTier && tokenState === "missing") warnings.push("Paid tier is missing a one-time report token.");
  if (paidTier && !args.accountBound) warnings.push("Paid tier is not account-bound.");
  if (paidTier && !args.serverReceiptPresent) warnings.push("Paid tier is missing server-side payment receipt.");
  if (!payloadHashBound) warnings.push("Payload hash missing; vault can only store redacted metadata.");
  if (!sourceReceiptRootBound) warnings.push("Source receipt root missing; vault cannot claim receipt parity.");
  if (args.customerDeliveryStatus === "queued_redacted") warnings.push("Customer delivery ledger is queued/redacted.");
  if (args.runtimeState === "degraded") warnings.push("Runtime degraded; use metadata-only delivery until provider state recovers.");
  if (replayCount > 0) warnings.push("Replay attempt observed; token consumption path needs operator-visible event ledger.");

  const releaseStatus: Pass2822ReleaseStatus = hardBlocks.length ? "block" : warnings.length ? "warn" : "pass";
  const vaultState: Pass2822VaultState = hardBlocks.length
    ? "blocked"
    : args.accountBound && args.serverReceiptPresent && payloadHashBound && sourceReceiptRootBound && (tokenState === "issued" || tokenState === "not_required")
      ? "ready"
      : args.accountBound && payloadHashBound
        ? "metadata_only"
        : "locked";
  const deliveryState: Pass2822DeliveryState = hardBlocks.length
    ? "blocked"
    : releaseStatus === "pass"
      ? "available"
      : args.resendRequested || tokenState === "expired" || tokenState === "consumed" || tokenState === "missing"
        ? "resend_required"
        : "metadata_only";

  const tokenProblem = tokenState === "missing" || tokenState === "expired" || tokenState === "consumed";
  const resendAllowed = !hardBlocks.length && paidTier && Boolean(args.accountBound && args.serverReceiptPresent && payloadHashBound && sourceReceiptRootBound) && tokenProblem;

  return {
    schemaVersion: "pass2822_account_vault_token_consumption_gate_v1",
    surface: args.surface,
    tier: args.tier,
    tokenState,
    vaultState,
    deliveryState,
    tokenEnvelope: {
      oneTimeTokenRequired,
      tokenPresent,
      issuedAt: args.issuedAt ?? null,
      expiresAt: args.issuedAt ? isoPlusMinutes(args.issuedAt, expiresInMinutes) : null,
      consumedAt: args.consumedAt ?? null,
      revokedAt: args.revokedAt ?? null,
      expiresInMinutes,
      replayCount,
      payloadHashBound,
      deliveredPayloadHashMatches,
      sourceReceiptRootBound,
      rule: "Download/account/email/API delivery must consume an unexpired one-time token bound to the same payloadHash and sourceReceiptRoot; consumed or mismatched tokens cannot render paid evidence.",
    },
    accountVaultEnvelope: {
      accountBound: args.accountBound,
      serverReceiptPresent: args.serverReceiptPresent,
      storageMode: vaultState === "ready" ? "full_report_reference" : vaultState === "metadata_only" ? "metadata_only" : "none",
      rawProviderSecretsStored: false,
      operatorPrivateNotesStoredForCustomer: false,
      rule: "Account vault stores delivery timeline + report references only; provider secrets, hidden prompts and operator-private notes stay outside customer storage.",
    },
    resendPolicy: {
      resendAllowed,
      requiresFreshToken: paidTier && (tokenProblem || Boolean(args.resendRequested)),
      reason: resendAllowed
        ? "Entitlement appears present but token is missing/expired/consumed, so resend may issue a fresh payload-bound token."
        : hardBlocks[0] ?? warnings[0] ?? "No resend needed; delivery gate is currently clean.",
    },
    timeline: [
      {
        kind: "receipt_bound",
        status: args.serverReceiptPresent ? "complete" : paidTier ? "required" : "prepared",
        rule: "Server receipt must be bound before Pro/Advanced delivery can leave metadata-only mode.",
      },
      {
        kind: "token_issued",
        status: tokenState === "issued" || tokenState === "not_required" ? "complete" : tokenState === "missing" ? "required" : "blocked",
        rule: "Token issue event must contain payloadHash, sourceReceiptRoot, accountId and expiry window.",
      },
      {
        kind: "download_consumed",
        status: tokenState === "consumed" ? "complete" : tokenState === "expired" || tokenState === "revoked" || tokenState === "payload_mismatch" ? "blocked" : "prepared",
        rule: "Download can be consumed once; subsequent attempts are replay events and only get metadata/error copy.",
      },
      {
        kind: "vault_written",
        status: vaultState === "ready" || vaultState === "metadata_only" ? "complete" : vaultState === "blocked" ? "blocked" : "required",
        rule: "Vault write records status timeline and report references, not a new report payload.",
      },
      {
        kind: "email_notice_sent",
        status: args.accountBound ? "prepared" : "required",
        rule: "Email remains notice/link-first; attachments require the same unexpired token and account vault state.",
      },
      {
        kind: args.resendRequested ? "resend_requested" : "token_blocked",
        status: hardBlocks.length ? "blocked" : resendAllowed ? "prepared" : "complete",
        rule: "Resend must recheck entitlement and issue a new token rather than reviving a consumed/expired one.",
      },
    ],
    releaseGate: {
      status: releaseStatus,
      reasons: [...hardBlocks, ...warnings],
    },
  };
}
