export type ContractLensSignalId =
  | "address_validity"
  | "owner_control"
  | "proxy_upgrade"
  | "mint_permission"
  | "pause_permission"
  | "blacklist_permission"
  | "tax_logic"
  | "liquidity_lock"
  | "verified_source";

export type ContractLensSignalTone = "calm" | "review" | "elevated" | "blocked";
export type ContractLensSourceMode = "preview" | "missing" | "manual_review" | "adapter_ready";

export type ContractLensSignal = {
  id: ContractLensSignalId;
  label: string;
  tone: ContractLensSignalTone;
  score: number;
  whyItMatters: string;
  missingData: string[];
  nextOperatorStep: string;
  sourceMode: ContractLensSourceMode;
};

export type ContractLensPreviewInput = {
  chain?: string;
  address?: string;
  symbol?: string;
};

export type ContractLensPreview = {
  schemaVersion: "velmere-contract-lens-preview-v1";
  mode: "contract_lens_preview_only";
  chain: string;
  address: string;
  symbol: string;
  signals: ContractLensSignal[];
  overallTone: ContractLensSignalTone;
  sourceConfidence: number;
  storageWritePerformed: false;
  externalFetchPerformed: false;
  productionBoundary: string;
};

const defaultSignals: ContractLensSignal[] = [
  {
    id: "address_validity",
    label: "Address validity",
    tone: "review",
    score: 48,
    whyItMatters: "A contract readout needs chain and address context before any permission check can be trusted.",
    missingData: ["chain parser", "address checksum/format validation", "contract existence check"],
    nextOperatorStep: "Validate chain/address first, then open owner/proxy/permission checks.",
    sourceMode: "missing",
  },
  {
    id: "owner_control",
    label: "Owner control",
    tone: "elevated",
    score: 70,
    whyItMatters: "Owner control can affect upgrades, permissions and emergency actions.",
    missingData: ["owner address", "renounce state", "multisig/custody context"],
    nextOperatorStep: "Attach contract analyzer result and label owner as unknown until verified.",
    sourceMode: "manual_review",
  },
  {
    id: "proxy_upgrade",
    label: "Proxy upgrade",
    tone: "review",
    score: 58,
    whyItMatters: "Upgradeable contracts can change behavior after launch, so implementation and admin state matter.",
    missingData: ["proxy pattern", "implementation address", "admin address"],
    nextOperatorStep: "Check proxy slots and analyzer version before summarizing risk.",
    sourceMode: "manual_review",
  },
  {
    id: "mint_permission",
    label: "Mint permission",
    tone: "review",
    score: 57,
    whyItMatters: "Mint permissions can change supply assumptions and affect float analysis.",
    missingData: ["mint function detection", "role list", "supply source"],
    nextOperatorStep: "Keep mint status as review-required until analyzer confirms permissions.",
    sourceMode: "manual_review",
  },
  {
    id: "pause_permission",
    label: "Pause permission",
    tone: "review",
    score: 52,
    whyItMatters: "Pause controls can affect transfers, exits or app access depending on implementation.",
    missingData: ["pause function detection", "role/owner permissions"],
    nextOperatorStep: "Check whether pause exists and who can trigger it.",
    sourceMode: "manual_review",
  },
  {
    id: "blacklist_permission",
    label: "Blacklist permission",
    tone: "elevated",
    score: 66,
    whyItMatters: "Blacklist controls can restrict addresses or transfers. Missing data should not be treated as neutral.",
    missingData: ["blacklist function detection", "role mapping", "source code verification"],
    nextOperatorStep: "Flag as unknown until source/analyzer confirms the permission surface.",
    sourceMode: "manual_review",
  },
  {
    id: "tax_logic",
    label: "Tax logic",
    tone: "review",
    score: 55,
    whyItMatters: "Transfer tax or fee logic can affect execution, liquidity and user expectations.",
    missingData: ["buy/sell fee detection", "max wallet checks", "fee destination"],
    nextOperatorStep: "Require analyzer output before showing fee/tax summary.",
    sourceMode: "manual_review",
  },
  {
    id: "liquidity_lock",
    label: "Liquidity lock",
    tone: "blocked",
    score: 76,
    whyItMatters: "Liquidity lock status matters for exit conditions, but it needs LP/token/source verification.",
    missingData: ["LP token holder", "lock provider/source", "unlock timestamp"],
    nextOperatorStep: "Do not claim liquidity is locked or unlocked until the source ledger exists.",
    sourceMode: "missing",
  },
  {
    id: "verified_source",
    label: "Verified source",
    tone: "blocked",
    score: 74,
    whyItMatters: "Unverified or unavailable source code limits all permission checks.",
    missingData: ["verified source code", "compiler metadata", "analyzer version"],
    nextOperatorStep: "Treat contract analysis as partial until verified source or bytecode analyzer output is attached.",
    sourceMode: "missing",
  },
];

function cleanValue(value: string | undefined, fallback: string) {
  return (value ?? fallback).replace(/[<>]/g, "").trim().slice(0, 96) || fallback;
}

function overallToneFromSignals(signals: ContractLensSignal[]): ContractLensSignalTone {
  if (signals.some((signal) => signal.tone === "blocked")) return "blocked";
  if (signals.some((signal) => signal.tone === "elevated")) return "elevated";
  if (signals.some((signal) => signal.tone === "review")) return "review";
  return "calm";
}

export function createContractLensPreview(input: ContractLensPreviewInput = {}): ContractLensPreview {
  const chain = cleanValue(input.chain, "unknown-chain");
  const address = cleanValue(input.address, "address-needed");
  const symbol = cleanValue(input.symbol, "TOKEN");
  const signals = defaultSignals;

  return {
    schemaVersion: "velmere-contract-lens-preview-v1",
    mode: "contract_lens_preview_only",
    chain,
    address,
    symbol,
    signals,
    overallTone: overallToneFromSignals(signals),
    sourceConfidence: 36,
    storageWritePerformed: false,
    externalFetchPerformed: false,
    productionBoundary:
      "Contract Lens preview only. It requires a server-only analyzer, chain/address validation and source ledger before any production claim.",
  };
}

export function getContractLensReadinessSummary() {
  const preview = createContractLensPreview();
  const blocked = preview.signals.filter((signal) => signal.tone === "blocked").length;
  const review = preview.signals.filter((signal) => signal.tone === "review" || signal.tone === "elevated").length;

  return {
    schemaVersion: "velmere-contract-lens-readiness-v1",
    signalCount: preview.signals.length,
    blocked,
    review,
    adapterProgress: 52,
    nextCriticalStep: "Implement server-only chain/address validator and contract analyzer envelope.",
  };
}
