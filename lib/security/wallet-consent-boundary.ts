import { ASCII_CONTROL_PATTERN } from "./ascii-control-characters";

export const PASS634_WALLET_BOUNDARY_VERSION = "pass634-consent-wallet-boundary" as const;

export type Pass634WalletAction =
  | "connect_read_only"
  | "sign_message"
  | "sign_typed_data"
  | "send_transaction"
  | "approve_token";

export type Pass634WalletConsentInput = {
  action: Pass634WalletAction;
  chainId?: string | number | null;
  value?: string | number | bigint | null;
  contract?: string | null;
  spender?: string | null;
  approvalAmount?: string | null;
  typedDataDomain?: string | null;
  nonce?: string | number | null;
  deadline?: string | number | null;
  requestText?: string | null;
};

export type Pass634WalletConsentBoundary = {
  version: typeof PASS634_WALLET_BOUNDARY_VERSION;
  state: "read_only" | "review" | "blocked";
  action: Pass634WalletAction;
  requiresSignature: boolean;
  requiresTransaction: boolean;
  chainLabel: string;
  valueLabel: string;
  contractLabel: string;
  spenderLabel: string;
  approvalMode: "none" | "exact" | "unlimited" | "unknown";
  blockers: string[];
  confirmations: string[];
  humanSummary: string;
  boundary: string;
};

function clean(value: unknown, fallback = "not provided", max = 120) {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).replace(ASCII_CONTROL_PATTERN, "").trim().slice(0, max) || fallback;
}

function looksUnlimited(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase().replace(/[_\s]/g, "");
  return normalized === "max" || normalized === "unlimited" || normalized === "infinite" || normalized === "-1" ||
    normalized === "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" ||
    normalized === "115792089237316195423570985008687907853269984665640564039457584007913129639935";
}

export function buildPass634WalletConsentBoundary(input: Pass634WalletConsentInput): Pass634WalletConsentBoundary {
  const requestText = clean(input.requestText, "", 500).toLowerCase();
  const blockers: string[] = [];
  const requiresSignature = input.action === "sign_message" || input.action === "sign_typed_data";
  const requiresTransaction = input.action === "send_transaction" || input.action === "approve_token";
  const chainLabel = clean(input.chainId, "not selected");
  const valueLabel = clean(input.value, requiresTransaction ? "unknown" : "0");
  const contractLabel = clean(input.contract);
  const spenderLabel = clean(input.spender);
  const approvalMode = input.action !== "approve_token"
    ? "none"
    : looksUnlimited(input.approvalAmount)
      ? "unlimited"
      : input.approvalAmount
        ? "exact"
        : "unknown";

  if (/(seed phrase|recovery phrase|private key|secret key|mnemonic)/i.test(requestText)) blockers.push("secret_recovery_material_requested");
  if (requiresTransaction && chainLabel === "not selected") blockers.push("chain_not_disclosed");
  if (requiresTransaction && contractLabel === "not provided") blockers.push("contract_not_disclosed");
  if (input.action === "approve_token" && spenderLabel === "not provided") blockers.push("spender_not_disclosed");
  if (input.action === "approve_token" && approvalMode === "unknown") blockers.push("approval_amount_not_disclosed");
  if (approvalMode === "unlimited") blockers.push("unlimited_approval_forbidden");
  if (input.action === "sign_typed_data" && !input.typedDataDomain) blockers.push("typed_data_domain_missing");
  if (input.action === "sign_typed_data" && input.nonce == null) blockers.push("nonce_missing");
  if (input.action === "sign_typed_data" && input.deadline == null) blockers.push("deadline_missing");

  const state = blockers.length > 0
    ? "blocked"
    : input.action === "connect_read_only"
      ? "read_only"
      : "review";
  const confirmations = input.action === "connect_read_only"
    ? ["No signature", "No transaction", "No token approval", "Address and network only"]
    : [
      `Chain: ${chainLabel}`,
      `Action: ${input.action}`,
      `Value: ${valueLabel}`,
      `Contract: ${contractLabel}`,
      ...(input.action === "approve_token" ? [`Spender: ${spenderLabel}`, `Approval: ${approvalMode}`] : []),
    ];

  return {
    version: PASS634_WALLET_BOUNDARY_VERSION,
    state,
    action: input.action,
    requiresSignature,
    requiresTransaction,
    chainLabel,
    valueLabel,
    contractLabel,
    spenderLabel,
    approvalMode,
    blockers,
    confirmations,
    humanSummary: state === "read_only"
      ? "Read-only wallet connection: no signature, transaction or approval is requested."
      : state === "blocked"
        ? "Wallet action is blocked until every chain, value, contract and consent boundary is explicit."
        : "Review the exact chain, action, value and contract before confirming in the wallet.",
    boundary: "Velmère never requests seed phrases or private keys and never hides unlimited token approval behind a generic connect action.",
  };
}
