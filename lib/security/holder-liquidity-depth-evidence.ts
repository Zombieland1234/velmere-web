import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2572AuditProviderRuntimeReport } from "./audit-provider-runtime-client";
import type { Pass2577AuditLiquidityHolderLockRiskReport } from "./audit-liquidity-holder-lock-risk";
import type { Pass2582RealProviderAdapterHardeningReport } from "./real-provider-adapter-hardening";
import type { Pass2583ContractSourceAbiExtractionReport } from "./contract-source-abi-extraction";

export const PASS2584_HOLDER_LIQUIDITY_DEPTH_EVIDENCE_ID = "holder-liquidity-depth-evidence" as const;

export type Pass2584EvidenceState =
  | "confirmed"
  | "partial"
  | "queued"
  | "missing_input"
  | "needs_key"
  | "blocked";

export type Pass2584EvidenceSeverity = "info" | "watch" | "elevated" | "critical";

export type Pass2584EvidenceFamily =
  | "dex_pair_matrix"
  | "lp_lock_ownership"
  | "top_holder_concentration"
  | "deployer_owner_relation"
  | "supply_float"
  | "exit_liquidity_pressure"
  | "freshness_replay";

export type Pass2584EvidenceRow = {
  label: string;
  state: Pass2584EvidenceState;
  severity: Pass2584EvidenceSeverity;
  output: string;
};

export type Pass2584DepthLane = {
  id: string;
  family: Pass2584EvidenceFamily;
  label: string;
  state: Pass2584EvidenceState;
  severity: Pass2584EvidenceSeverity;
  providers: string[];
  requiredFields: string[];
  observedEvidence: string[];
  missingEvidence: string[];
  customerLine: string;
  proPdfLine: string;
  operatorAction: string;
  riskDelta: number;
  confidenceDelta: number;
  freshnessTtlSeconds: number;
  canShowInBasic: boolean;
  requiresPro: boolean;
  blocksFinalSign: boolean;
};

export type Pass2584HolderLiquidityDepthEvidenceReport = {
  passId: typeof PASS2584_HOLDER_LIQUIDITY_DEPTH_EVIDENCE_ID;
  generatedAt: string;
  locale: string;
  target: {
    contractAddress?: string;
    projectName?: string;
    chain: string;
    chainId: string;
  };
  rule: string;
  customerRule: string;
  proRule: string;
  operatorRule: string;
  depthContract: {
    schemaVersion: string;
    pairMatrixRule: string;
    holderRule: string;
    lockRule: string;
    deployerRule: string;
    finalSignRule: string;
  };
  depthLanes: Pass2584DepthLane[];
  summary: {
    totalLanes: number;
    confirmed: number;
    partial: number;
    queued: number;
    missingInput: number;
    needsKey: number;
    blocked: number;
    elevatedOrCritical: number;
    blockers: number;
    riskDelta: number;
    confidenceDelta: number;
    depthReadiness: number;
    nextCriticalStep: string;
    canFeedReportAssembler: boolean;
    canFinalSignLiquidityDepth: boolean;
  };
  publicRows: Pass2584EvidenceRow[];
  proPdfRows: Pass2584EvidenceRow[];
  operatorRows: Pass2584EvidenceRow[];
  scoringHints: Array<{ label: string; impact: string }>;
  nextImplementationBacklog: string[];
};

type BuilderInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  providerRuntime?: Pass2572AuditProviderRuntimeReport | null;
  liquidityHolderRisk?: Pass2577AuditLiquidityHolderLockRiskReport | null;
  realProviderAdapterHardening?: Pass2582RealProviderAdapterHardeningReport | null;
  contractSourceAbiExtraction?: Pass2583ContractSourceAbiExtractionReport | null;
  holderLiquidityEvidence?: Pass2584RawHolderLiquidityEvidence | null;
};

export type Pass2584RawHolderLiquidityEvidence = {
  contractAddress: string;
  chainId: string;
  provider: string;
  observedAt: string;
  responseDigest: string;
  dexPairs?: Array<{
    pairAddress: string;
    dexId: string;
    liquidityUsd: number;
    volume24h: number;
    pairCreatedAt: string;
  }>;
  lpLock?: {
    lpTokenAddress: string;
    lpOwner: string;
    lockerAddress: string;
    unlockTime: string;
    lockTxHash: string;
  };
  holderConcentration?: {
    top10Percent: number;
    top20Percent: number;
    excludedSystemAddresses: string[];
    holderCount: number;
  };
  deployerOwner?: {
    deployer: string;
    owner?: string;
    admin?: string;
    multisig?: string;
    topHolderOverlap: boolean;
  };
  supply?: {
    totalSupply: string;
    decimals: number;
    burnedSupply: string;
    lockedSupply: string;
    circulatingHint: string;
  };
  exitPressure?: {
    liquidityUsd: number;
    volume24h: number;
    topHolderPercent: number;
    sellTaxPercent: number;
    transferRestrictionsObserved: boolean;
  };
};

const CHAIN_ID_BY_NAME: Record<string, string> = {
  eth: "1",
  ethereum: "1",
  mainnet: "1",
  bsc: "56",
  binance: "56",
  bnb: "56",
  polygon: "137",
  matic: "137",
  arbitrum: "42161",
  optimism: "10",
  base: "8453",
  avalanche: "43114",
  avax: "43114",
  fantom: "250",
  linea: "59144",
  mantle: "5000",
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(C0_OR_TEMPLATE_META_PATTERN, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function chainIdFrom(chain: string | undefined) {
  const normalized = String(chain || "ethereum").trim().toLowerCase();
  return CHAIN_ID_BY_NAME[normalized] || (/^\d+$/.test(normalized) ? normalized : "1");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function stateWeight(state: Pass2584EvidenceState) {
  if (state === "confirmed") return 18;
  if (state === "partial") return 11;
  if (state === "queued") return 7;
  if (state === "needs_key") return 5;
  if (state === "blocked") return 3;
  return 0;
}

function isAddress(value: unknown) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isTxHash(value: unknown) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

function isDigest(value: unknown) {
  return typeof value === "string" && /^(?:sha256:)?[a-fA-F0-9]{64}$/.test(value);
}

function finite(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isTimestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function numericString(value: unknown) {
  return typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value);
}

function rawIdentityMatches(raw: Pass2584RawHolderLiquidityEvidence | null | undefined, contractAddress: string | undefined, chainId: string) {
  return Boolean(
    raw &&
    isAddress(raw.contractAddress) &&
    raw.contractAddress.toLowerCase() === contractAddress?.toLowerCase() &&
    raw.chainId === chainId &&
    typeof raw.provider === "string" && raw.provider.trim() &&
    isTimestamp(raw.observedAt) &&
    isDigest(raw.responseDigest),
  );
}

function stateForTypedEvidence(args: {
  hasContract: boolean;
  identityValid: boolean;
  complete: boolean;
  observed: number;
  needsKey: boolean;
  blocked: boolean;
}): Pass2584EvidenceState {
  if (!args.hasContract) return "missing_input";
  if (args.identityValid && args.complete) return "confirmed";
  if (args.identityValid && args.observed > 0) return "partial";
  if (args.blocked) return "blocked";
  if (args.needsKey) return "needs_key";
  return "queued";
}

function observedRows(entries: Array<[string, unknown]>) {
  return entries.flatMap(([key, value]) => {
    if (value === undefined || value === null || value === "") return [];
    if (Array.isArray(value)) return value.length ? [`${key}=${value.join(",")}`] : [];
    return [`${key}=${String(value)}`];
  });
}

function row(label: string, state: Pass2584EvidenceState, severity: Pass2584EvidenceSeverity, output: string): Pass2584EvidenceRow {
  return { label, state, severity, output };
}

function stateLine(locale: string, state: Pass2584EvidenceState) {
  if (state === "confirmed") return t(locale, "potwierdzone", "bestaetigt", "confirmed");
  if (state === "partial") return t(locale, "częściowe", "teilweise", "partial");
  if (state === "queued") return t(locale, "w kolejce", "in Warteschlange", "queued");
  if (state === "needs_key") return t(locale, "wymaga klucza", "braucht Key", "needs key");
  if (state === "blocked") return t(locale, "zablokowane", "blockiert", "blocked");
  return t(locale, "brak inputu", "fehlender Input", "missing input");
}

function lineFor(locale: string, family: Pass2584EvidenceFamily, state: Pass2584EvidenceState) {
  const status = stateLine(locale, state);
  if (family === "dex_pair_matrix") return t(locale, `DEX pair matrix: ${status}; bez pary/liquidity USD Basic nie może wyciągać mocnych wniosków o exit capacity.`, `DEX Pair Matrix: ${status}; ohne Pair/Liquidity USD darf Basic keine starken Aussagen zur Exit Capacity machen.`, `DEX pair matrix: ${status}; without pair/liquidity USD, Basic cannot make strong exit-capacity claims.`);
  if (family === "lp_lock_ownership") return t(locale, `LP lock/ownership: ${status}; final wymaga dowodu lockera, właściciela LP albo jawnego missing proof.`, `LP Lock/Ownership: ${status}; final braucht Locker-, LP-Owner- oder Missing-Proof.`, `LP lock/ownership: ${status}; final requires locker, LP owner or explicit missing-proof evidence.`);
  if (family === "top_holder_concentration") return t(locale, `Top holders: ${status}; Pro musi pokazać koncentrację i wyłączyć burn/LP/CEX z nieuczciwego liczenia.`, `Top Holders: ${status}; Pro muss Konzentration zeigen und Burn/LP/CEX sauber behandeln.`, `Top holders: ${status}; Pro must show concentration and treat burn/LP/CEX addresses fairly.`);
  if (family === "deployer_owner_relation") return t(locale, `Deployer/owner relation: ${status}; operator ma porównać deployer, owner, admin, multisig i top holders.`, `Deployer/Owner Relation: ${status}; Operator vergleicht Deployer, Owner, Admin, Multisig und Top Holders.`, `Deployer/owner relation: ${status}; operator compares deployer, owner, admin, multisig and top holders.`);
  if (family === "supply_float") return t(locale, `Supply/float: ${status}; totalSupply, decimals i circulating/locked supply muszą być rozdzielone.`, `Supply/Float: ${status}; totalSupply, decimals und circulating/locked Supply muessen getrennt werden.`, `Supply/float: ${status}; totalSupply, decimals and circulating/locked supply must stay separated.`);
  if (family === "exit_liquidity_pressure") return t(locale, `Exit pressure: ${status}; liquidity, volume, tax i holder concentration muszą wejść do jednego score, bez ROI obietnic.`, `Exit Pressure: ${status}; Liquidity, Volume, Tax und Holder-Konzentration gehen in einen Score, ohne ROI-Versprechen.`, `Exit pressure: ${status}; liquidity, volume, tax and holder concentration feed one score, without ROI promises.`);
  return t(locale, `Freshness replay: ${status}; holder/liquidity dane muszą mieć timestamp i TTL.`, `Freshness Replay: ${status}; Holder/Liquidity Daten brauchen Timestamp und TTL.`, `Freshness replay: ${status}; holder/liquidity data needs timestamp and TTL.`);
}

function buildLane(input: {
  id: string;
  locale: string;
  family: Pass2584EvidenceFamily;
  label: string;
  severity: Pass2584EvidenceSeverity;
  providers: string[];
  requiredFields: string[];
  state: Pass2584EvidenceState;
  evidence: string[];
  missing: string[];
  riskDelta: number;
  confidenceDelta: number;
  ttl: number;
  requiresPro?: boolean;
  blocksFinal?: boolean;
}): Pass2584DepthLane {
  const customerLine = lineFor(input.locale, input.family, input.state);
  return {
    id: input.id,
    family: input.family,
    label: input.label,
    state: input.state,
    severity: input.severity,
    providers: input.providers,
    requiredFields: input.requiredFields,
    observedEvidence: input.evidence.slice(0, 8),
    missingEvidence: input.missing.slice(0, 8),
    customerLine,
    proPdfLine: `${input.label}; state=${input.state}; providers=${input.providers.join("+")}; fields=${input.requiredFields.join(",")}; evidence=${input.evidence.slice(0, 3).join(" | ") || "none"}; missing=${input.missing.slice(0, 4).join(" | ") || "none"}`,
    operatorAction: `Queue operator validation for ${input.family}: compare provider payloads, timestamp, excluded system addresses, and final-sign blocker state before Advanced delivery.`,
    riskDelta: input.state === "confirmed" ? -Math.abs(input.riskDelta) : Math.abs(input.riskDelta),
    confidenceDelta: input.state === "confirmed" ? Math.abs(input.confidenceDelta) : -Math.abs(input.confidenceDelta),
    freshnessTtlSeconds: input.ttl,
    canShowInBasic: true,
    requiresPro: Boolean(input.requiresPro),
    blocksFinalSign: Boolean(input.blocksFinal) && input.state !== "confirmed",
  };
}

export function buildPass2584HolderLiquidityDepthEvidenceReport(input: BuilderInput = {}): Pass2584HolderLiquidityDepthEvidenceReport {
  const locale = input.locale || "en";
  const chain = clean(input.chain, 40) || "ethereum";
  const chainId = chainIdFrom(chain);
  const contractAddress = clean(input.contractAddress, 80);
  const projectName = clean(input.projectName, 120);
  const hasContract = Boolean(contractAddress && /^0x[a-fA-F0-9]{40}$/.test(contractAddress));
  const raw = input.holderLiquidityEvidence;
  const identityValid = rawIdentityMatches(raw, contractAddress, chainId);
  const needsKey = Boolean(input.realProviderAdapterHardening?.summary.needsKey);
  const providerBlocked = Boolean(input.realProviderAdapterHardening?.summary.blocked || input.realProviderAdapterHardening?.summary.error);
  const pair = identityValid ? raw?.dexPairs?.find((item) => isAddress(item.pairAddress)) : undefined;
  const pairEvidence = pair ? observedRows([
    ["pairAddress", pair.pairAddress],
    ["dexId", pair.dexId],
    ["liquidityUsd", finite(pair.liquidityUsd) ? pair.liquidityUsd : undefined],
    ["volume24h", finite(pair.volume24h) ? pair.volume24h : undefined],
    ["pairCreatedAt", isTimestamp(pair.pairCreatedAt) ? pair.pairCreatedAt : undefined],
  ]) : [];
  const pairState = stateForTypedEvidence({
    hasContract,
    identityValid,
    complete: Boolean(pair && isAddress(pair.pairAddress) && pair.dexId.trim() && finite(pair.liquidityUsd) && finite(pair.volume24h) && isTimestamp(pair.pairCreatedAt)),
    observed: pairEvidence.length,
    needsKey: false,
    blocked: false,
  });

  const lock = identityValid ? raw?.lpLock : undefined;
  const lockEvidence = lock ? observedRows([
    ["lpTokenAddress", isAddress(lock.lpTokenAddress) ? lock.lpTokenAddress : undefined],
    ["lpOwner", isAddress(lock.lpOwner) ? lock.lpOwner : undefined],
    ["lockerAddress", isAddress(lock.lockerAddress) ? lock.lockerAddress : undefined],
    ["unlockTime", isTimestamp(lock.unlockTime) ? lock.unlockTime : undefined],
    ["lockTxHash", isTxHash(lock.lockTxHash) ? lock.lockTxHash : undefined],
  ]) : [];
  const lockState = stateForTypedEvidence({
    hasContract,
    identityValid,
    complete: Boolean(lock && isAddress(lock.lpTokenAddress) && isAddress(lock.lpOwner) && isAddress(lock.lockerAddress) && isTimestamp(lock.unlockTime) && isTxHash(lock.lockTxHash)),
    observed: lockEvidence.length,
    needsKey,
    blocked: providerBlocked,
  });

  const holders = identityValid ? raw?.holderConcentration : undefined;
  const holderEvidence = holders ? observedRows([
    ["top10Percent", finite(holders.top10Percent, 0, 100) ? holders.top10Percent : undefined],
    ["top20Percent", finite(holders.top20Percent, 0, 100) ? holders.top20Percent : undefined],
    ["holderCount", finite(holders.holderCount, 0) && Number.isInteger(holders.holderCount) ? holders.holderCount : undefined],
    ["excludedSystemAddresses", holders.excludedSystemAddresses.filter(isAddress)],
  ]) : [];
  const holderState = stateForTypedEvidence({
    hasContract,
    identityValid,
    complete: Boolean(holders && finite(holders.top10Percent, 0, 100) && finite(holders.top20Percent, 0, 100) && Number.isInteger(holders.holderCount) && holders.holderCount >= 0 && holders.excludedSystemAddresses.every(isAddress)),
    observed: holderEvidence.length,
    needsKey,
    blocked: false,
  });

  const relation = identityValid ? raw?.deployerOwner : undefined;
  const relationEvidence = relation ? observedRows([
    ["deployer", isAddress(relation.deployer) ? relation.deployer : undefined],
    ["owner", isAddress(relation.owner) ? relation.owner : undefined],
    ["admin", isAddress(relation.admin) ? relation.admin : undefined],
    ["multisig", isAddress(relation.multisig) ? relation.multisig : undefined],
    ["topHolderOverlap", typeof relation.topHolderOverlap === "boolean" ? relation.topHolderOverlap : undefined],
  ]) : [];
  const relationState = stateForTypedEvidence({
    hasContract,
    identityValid,
    complete: Boolean(relation && isAddress(relation.deployer) && (isAddress(relation.owner) || isAddress(relation.admin) || isAddress(relation.multisig)) && typeof relation.topHolderOverlap === "boolean"),
    observed: relationEvidence.length,
    needsKey,
    blocked: false,
  });

  const supply = identityValid ? raw?.supply : undefined;
  const supplyEvidence = supply ? observedRows([
    ["totalSupply", numericString(supply.totalSupply) ? supply.totalSupply : undefined],
    ["decimals", Number.isInteger(supply.decimals) && supply.decimals >= 0 && supply.decimals <= 255 ? supply.decimals : undefined],
    ["burnedSupply", numericString(supply.burnedSupply) ? supply.burnedSupply : undefined],
    ["lockedSupply", numericString(supply.lockedSupply) ? supply.lockedSupply : undefined],
    ["circulatingHint", numericString(supply.circulatingHint) ? supply.circulatingHint : undefined],
  ]) : [];
  const supplyState = stateForTypedEvidence({
    hasContract,
    identityValid,
    complete: Boolean(supply && numericString(supply.totalSupply) && Number.isInteger(supply.decimals) && supply.decimals >= 0 && supply.decimals <= 255 && numericString(supply.burnedSupply) && numericString(supply.lockedSupply) && numericString(supply.circulatingHint)),
    observed: supplyEvidence.length,
    needsKey,
    blocked: false,
  });

  const exit = identityValid ? raw?.exitPressure : undefined;
  const exitEvidence = exit ? observedRows([
    ["liquidityUsd", finite(exit.liquidityUsd) ? exit.liquidityUsd : undefined],
    ["volume24h", finite(exit.volume24h) ? exit.volume24h : undefined],
    ["topHolderPercent", finite(exit.topHolderPercent, 0, 100) ? exit.topHolderPercent : undefined],
    ["sellTaxPercent", finite(exit.sellTaxPercent, 0, 100) ? exit.sellTaxPercent : undefined],
    ["transferRestrictionsObserved", typeof exit.transferRestrictionsObserved === "boolean" ? exit.transferRestrictionsObserved : undefined],
  ]) : [];
  const exitState = stateForTypedEvidence({
    hasContract,
    identityValid,
    complete: Boolean(exit && pairState === "confirmed" && holderState === "confirmed" && finite(exit.liquidityUsd) && finite(exit.volume24h) && finite(exit.topHolderPercent, 0, 100) && finite(exit.sellTaxPercent, 0, 100) && typeof exit.transferRestrictionsObserved === "boolean"),
    observed: exitEvidence.length,
    needsKey,
    blocked: providerBlocked,
  });

  const evidenceAgeMs = identityValid && raw ? Date.now() - Date.parse(raw.observedAt) : Number.POSITIVE_INFINITY;
  const freshnessEvidence = identityValid && raw ? observedRows([
    ["provider", raw.provider],
    ["observedAt", raw.observedAt],
    ["responseDigest", raw.responseDigest],
  ]) : [];
  const freshnessState: Pass2584EvidenceState = !hasContract
    ? "missing_input"
    : identityValid && evidenceAgeMs >= 0 && evidenceAgeMs <= 90_000
      ? "confirmed"
      : identityValid && evidenceAgeMs >= 0 && evidenceAgeMs <= 3_600_000
        ? "partial"
        : providerBlocked
          ? "blocked"
          : "queued";

  const lanes = [
    buildLane({
      id: "dex-pair-matrix",
      locale,
      family: "dex_pair_matrix",
      label: "DEX pair matrix",
      severity: "elevated",
      providers: ["DEX Screener", "Honeypot.is", "DeFiLlama"],
      requiredFields: ["chainId", "pairAddress", "dexId", "liquidityUsd", "volume24h", "pairCreatedAt"],
      state: pairState,
      evidence: pairEvidence,
      missing: pairState === "confirmed" ? [] : ["pairAddress", "liquidityUsd", "volume24h", "pairCreatedAt"],
      riskDelta: 13,
      confidenceDelta: 10,
      ttl: 90,
      requiresPro: true,
      blocksFinal: true,
    }),
    buildLane({
      id: "lp-lock-ownership-proof",
      locale,
      family: "lp_lock_ownership",
      label: "LP lock / ownership proof",
      severity: "critical",
      providers: ["Explorer", "GoPlus", "Honeypot.is", "Locker allowlist"],
      requiredFields: ["lpTokenAddress", "lpOwner", "lockerAddress", "unlockTime", "lockTxHash"],
      state: lockState,
      evidence: lockEvidence,
      missing: lockState === "confirmed" ? [] : ["lpOwner", "locker proof", "unlock time", "lock transaction"],
      riskDelta: 18,
      confidenceDelta: 12,
      ttl: 3600,
      requiresPro: true,
      blocksFinal: true,
    }),
    buildLane({
      id: "top-holder-concentration-output",
      locale,
      family: "top_holder_concentration",
      label: "Top holder concentration output",
      severity: "elevated",
      providers: ["Explorer", "GoPlus", "Honeypot.is"],
      requiredFields: ["top10Percent", "top20Percent", "excludedSystemAddresses", "holderCount"],
      state: holderState,
      evidence: holderEvidence,
      missing: holderState === "confirmed" ? [] : ["top10Percent", "holderCount", "system address exclusions"],
      riskDelta: 16,
      confidenceDelta: 11,
      ttl: 300,
      requiresPro: true,
      blocksFinal: true,
    }),
    buildLane({
      id: "deployer-owner-relation-queue",
      locale,
      family: "deployer_owner_relation",
      label: "Deployer / owner relation queue",
      severity: "elevated",
      providers: ["Explorer", "Source/ABI", "Operator review"],
      requiredFields: ["deployer", "owner", "admin", "multisig", "topHolderOverlap"],
      state: relationState,
      evidence: relationEvidence,
      missing: relationState === "confirmed" ? [] : ["contract creator", "owner/admin read", "top holder overlap"],
      riskDelta: 14,
      confidenceDelta: 9,
      ttl: 1800,
      requiresPro: true,
      blocksFinal: true,
    }),
    buildLane({
      id: "supply-float-boundary",
      locale,
      family: "supply_float",
      label: "Supply / float boundary",
      severity: "watch",
      providers: ["Explorer", "Source/ABI", "CoinGecko/market metadata"],
      requiredFields: ["totalSupply", "decimals", "burnedSupply", "lockedSupply", "circulatingHint"],
      state: supplyState,
      evidence: supplyEvidence,
      missing: supplyState === "confirmed" ? [] : ["totalSupply", "decimals", "locked/burned supply split"],
      riskDelta: 8,
      confidenceDelta: 7,
      ttl: 1800,
      requiresPro: true,
      blocksFinal: false,
    }),
    buildLane({
      id: "exit-liquidity-pressure-score",
      locale,
      family: "exit_liquidity_pressure",
      label: "Exit liquidity pressure score",
      severity: "critical",
      providers: ["DEX Screener", "Holder lane", "Permission parser", "Tax/fee lane"],
      requiredFields: ["liquidityUsd", "volume24h", "topHolderPercent", "sellTax", "transferRestrictions"],
      state: exitState,
      evidence: exitEvidence,
      missing: (exitState as Pass2584EvidenceState) === "confirmed" ? [] : ["liquidityUsd", "volume24h", "topHolderPercent", "sellTax", "transfer restriction proof"],
      riskDelta: 20,
      confidenceDelta: 14,
      ttl: 90,
      requiresPro: true,
      blocksFinal: true,
    }),
    buildLane({
      id: "freshness-replay-timecode",
      locale,
      family: "freshness_replay",
      label: "Freshness replay timecode",
      severity: "watch",
      providers: ["Provider runtime", "Receipt/re-check plan"],
      requiredFields: ["observedAt", "ttlSeconds", "providerLatency", "recheckTrigger"],
      state: freshnessState,
      evidence: freshnessEvidence,
      missing: freshnessState === "partial" || (freshnessState as Pass2584EvidenceState) === "confirmed" ? [] : ["observedAt", "ttlSeconds", "recheck trigger"],
      riskDelta: 6,
      confidenceDelta: 8,
      ttl: 90,
      requiresPro: false,
      blocksFinal: false,
    }),
  ];

  const counts = {
    confirmed: lanes.filter((lane) => lane.state === "confirmed").length,
    partial: lanes.filter((lane) => lane.state === "partial").length,
    queued: lanes.filter((lane) => lane.state === "queued").length,
    missingInput: lanes.filter((lane) => lane.state === "missing_input").length,
    needsKey: lanes.filter((lane) => lane.state === "needs_key").length,
    blocked: lanes.filter((lane) => lane.state === "blocked").length,
  };
  const blockers = lanes.filter((lane) => lane.blocksFinalSign).length;
  const elevatedOrCritical = lanes.filter((lane) => lane.severity === "elevated" || lane.severity === "critical").length;
  const riskDelta = clamp(lanes.reduce((sum, lane) => sum + lane.riskDelta, 0), -30, 50);
  const confidenceDelta = clamp(lanes.reduce((sum, lane) => sum + lane.confidenceDelta, 0), -35, 35);
  const depthReadiness = clamp(lanes.reduce((sum, lane) => sum + stateWeight(lane.state), 0), 0, 100);
  const nextCriticalStep = !hasContract
    ? "Collect a valid token contract address before holder/liquidity depth evidence."
    : blockers
      ? "Confirm DEX pair matrix, LP lock/ownership and top-holder concentration before Advanced sign-off."
      : "Attach freshness replay and Pro PDF columns to the final report assembler.";

  const publicRows = lanes.slice(0, 7).map((lane) => row(lane.label, lane.state, lane.severity, lane.customerLine));
  const proPdfRows = lanes.flatMap((lane) => [
    row(lane.label, lane.state, lane.severity, lane.proPdfLine),
    row(`${lane.label} — missing proof`, lane.missingEvidence.length ? lane.state : "confirmed", lane.severity, lane.missingEvidence.join("; ") || "No missing proof recorded in this lane."),
  ]).slice(0, 18);
  const operatorRows = lanes.map((lane) => row(`${lane.label} operator action`, lane.blocksFinalSign ? "queued" : lane.state, lane.severity, lane.operatorAction));

  return {
    passId: PASS2584_HOLDER_LIQUIDITY_DEPTH_EVIDENCE_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { contractAddress, projectName, chain, chainId },
    rule: t(
      locale,
      "PASS2584 zamienia holder/liquidity z ogólnego ryzyka w głęboką evidence lane: DEX pairs, LP ownership/locks, top holders, deployer relation, supply/float i exit pressure muszą mieć jawne pola, TTL i missing proof.",
      "PASS2584 macht aus Holder/Liquidity eine tiefe Evidence Lane: DEX Pairs, LP Ownership/Locks, Top Holders, Deployer Relation, Supply/Float und Exit Pressure brauchen klare Felder, TTL und Missing Proof.",
      "PASS2584 turns holder/liquidity from a broad risk into a deep evidence lane: DEX pairs, LP ownership/locks, top holders, deployer relation, supply/float and exit pressure need explicit fields, TTL and missing proof.",
    ),
    customerRule: t(
      locale,
      "Basic pokazuje tylko status głębokości dowodów i braki; nie obiecuje bezpieczeństwa ani ceny.",
      "Basic zeigt nur Evidence-Depth Status und Luecken; keine Sicherheits- oder Preisversprechen.",
      "Basic shows only evidence-depth status and gaps; it does not promise safety or price outcomes.",
    ),
    proRule: t(
      locale,
      "Pro PDF dostaje pary, LP owner/lock, koncentrację holderów, deployer/owner relation, supply/float i freshness TTL jako oddzielne tabele.",
      "Pro PDF bekommt Pairs, LP Owner/Lock, Holder-Konzentration, Deployer/Owner Relation, Supply/Float und Freshness TTL als getrennte Tabellen.",
      "Pro PDF receives pairs, LP owner/lock, holder concentration, deployer/owner relation, supply/float and freshness TTL as separate tables.",
    ),
    operatorRule: "Advanced final sign-off is blocked when DEX pair matrix, LP lock/ownership or top-holder concentration is missing or stale.",
    depthContract: {
      schemaVersion: "pass2584.holder-liquidity-depth.v1",
      pairMatrixRule: "pairAddress, dexId, liquidityUsd, volume24h and pairCreatedAt are separate required fields",
      holderRule: "top-holder concentration must exclude known burn/LP/CEX/system addresses when labelled",
      lockRule: "LP lock claims require locker address, owner, unlock time and transaction proof or explicit missing proof",
      deployerRule: "deployer, owner, proxy admin and top-holder overlap must be compared before Advanced delivery",
      finalSignRule: "no Advanced final sign-off while critical holder/liquidity depth lanes are unconfirmed",
    },
    depthLanes: lanes,
    summary: {
      totalLanes: lanes.length,
      confirmed: counts.confirmed,
      partial: counts.partial,
      queued: counts.queued,
      missingInput: counts.missingInput,
      needsKey: counts.needsKey,
      blocked: counts.blocked,
      elevatedOrCritical,
      blockers,
      riskDelta,
      confidenceDelta,
      depthReadiness,
      nextCriticalStep,
      canFeedReportAssembler: identityValid && (counts.confirmed > 0 || counts.partial > 0),
      canFinalSignLiquidityDepth: identityValid && blockers === 0 && counts.blocked === 0 && counts.missingInput === 0,
    },
    publicRows,
    proPdfRows,
    operatorRows,
    scoringHints: [
      { label: "Exit pressure", impact: "liquidityUsd + volume24h + topHolderPercent + sellTax + transfer restrictions" },
      { label: "LP confidence", impact: "lockerAddress + unlockTime + LP owner proof improves confidence; missing lock proof blocks Advanced final" },
      { label: "Holder fairness", impact: "burn/LP/CEX/system addresses must be excluded or tagged before concentration scoring" },
      { label: "Freshness replay", impact: "holder/liquidity TTL expiry should trigger PASS2581 re-check and new receipt version" },
    ],
    nextImplementationBacklog: [
      "Wire DEX Screener token-pairs payload into pair matrix with liquidityUsd, volume24h and pairCreatedAt.",
      "Wire Honeypot.is pairs/top-holders payload into holder and liquidity depth lanes.",
      "Wire GoPlus holder/liquidity/security fields into concentration and lock/ownership proof lanes.",
      "Add explorer holder-list adapter with burn/LP/CEX/system address exclusion policy.",
      "Feed PASS2584 riskDelta/confidenceDelta into PASS2578 report assembler and Advanced final-sign blockers.",
      "Add premium Pro PDF holder/liquidity tables without exposing raw operator notes in Basic.",
    ],
  };
}
