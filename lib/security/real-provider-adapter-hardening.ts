import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

declare const process: { env?: Record<string, string | undefined> } | undefined;

type Pass2582AuditReviewSubmissionLike = {
  projectName?: string;
  contractAddress?: string;
  chain?: string;
  auditUrl?: string;
  website?: string;
  docsUrl?: string;
  githubUrl?: string;
  bountyScope?: string;
  contactEmail?: string;
  reviewLevel?: string;
};

type Pass2582VersionedRecheckReceiptLike = {
  summary: { canFinalSign: boolean };
};

type Pass2582ProviderIntelligenceLane = {
  id: string;
  state?: "ready" | "needs_key" | "planned" | "blocked";
  envKeys: string[];
};

type Pass2582ProviderIntelligenceLike = {
  providerMatrix: Pass2582ProviderIntelligenceLane[];
};

type Pass2582RuntimeStateLike =
  | "confirmed"
  | "partial"
  | "missing"
  | "blocked"
  | "timeout"
  | "error"
  | "not_run";

type Pass2582RuntimeLaneLike = {
  id: string;
  state: Pass2582RuntimeStateLike;
  evidence: string[];
  missing: string[];
};

type Pass2582ProviderRuntimeLike = {
  target: {
    contractAddress?: string;
    projectName?: string;
    chain: string;
    chainId: string;
  };
  lanes: Pass2582RuntimeLaneLike[];
};

export const PASS2582_REAL_PROVIDER_ADAPTER_HARDENING_ID = "real-provider-adapter-hardening" as const;

export type Pass2582AdapterState =
  | "usable"
  | "needs_key"
  | "missing_input"
  | "degraded"
  | "timeout"
  | "error"
  | "planned"
  | "blocked";

export type Pass2582AdapterLane = {
  id: string;
  provider: string;
  sourceLane: string;
  state: Pass2582AdapterState;
  endpointFamily: string;
  docsReference: string;
  envKeys: string[];
  requiresKey: boolean;
  supportedChains: string[];
  timeoutMs: number;
  cacheTtlSeconds: number;
  mapsTo: string[];
  runtimeLaneId?: string;
  runtimeState?: Pass2582RuntimeStateLike;
  freshnessClass: "live" | "short_cache" | "static" | "manual";
  customerClaimBoundary: string;
  failSoftBehavior: string;
  evidence: string[];
  missing: string[];
};

export type Pass2582SchemaField = {
  field: string;
  required: boolean;
  output: string;
};

export type Pass2582AdapterRow = {
  label: string;
  state: Pass2582AdapterState;
  output: string;
};

export type Pass2582RealProviderAdapterHardeningReport = {
  passId: typeof PASS2582_REAL_PROVIDER_ADAPTER_HARDENING_ID;
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
  operatorRule: string;
  adapterContract: {
    schemaVersion: string;
    runtimeMode: string;
    cachePolicy: string;
    redactionPolicy: string;
    noClaimRule: string;
  };
  standardResultSchema: Pass2582SchemaField[];
  providerAdapters: Pass2582AdapterLane[];
  sourceLaneMap: Array<{ lane: string; primary: string; fallback: string; proofRule: string }>;
  summary: {
    totalAdapters: number;
    usable: number;
    needsKey: number;
    missingInput: number;
    degraded: number;
    timeout: number;
    error: number;
    planned: number;
    blocked: number;
    runtimeCoverage: string;
    nextCriticalAdapter: string;
    canFinalSignWithCurrentAdapters: boolean;
  };
  publicRows: Pass2582AdapterRow[];
  proPdfRows: Pass2582AdapterRow[];
  operatorRows: Pass2582AdapterRow[];
  releaseGates: string[];
  nextImplementationBacklog: string[];
};

type BuilderInput = Partial<Pass2582AuditReviewSubmissionLike> & {
  locale?: string;
  providerIntelligence?: Pass2582ProviderIntelligenceLike | null;
  providerRuntime?: Pass2582ProviderRuntimeLike | null;
  versionedRecheckReceipt?: Pass2582VersionedRecheckReceiptLike | null;
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

function hasEnv(keys: string[]) {
  return keys.some((key) => Boolean((typeof process === "undefined" ? undefined : process.env?.[key])?.trim()));
}

function findRuntime(runtime: Pass2582ProviderRuntimeLike | null | undefined, runtimeLaneId: string) {
  return runtime?.lanes.find((lane) => lane.id === runtimeLaneId) ?? null;
}

function findProvider(intelligence: Pass2582ProviderIntelligenceLike | null | undefined, id: string) {
  return intelligence?.providerMatrix.find((provider) => provider.id === id) ?? null;
}

function stateFromRuntime(runtimeLane: Pass2582RuntimeLaneLike | null, providerLane: Pass2582ProviderIntelligenceLane | null, requiresKey: boolean, contractAddress?: string): Pass2582AdapterState {
  if (!contractAddress && runtimeLane?.id !== "runtime-market-metadata" && runtimeLane?.id !== "runtime-docs-repo-audit") return "missing_input";
  if (!runtimeLane) {
    if (providerLane?.state === "planned") return "planned";
    if (providerLane?.state === "blocked") return "blocked";
    if (requiresKey && providerLane?.envKeys.length && !hasEnv(providerLane.envKeys)) return "needs_key";
    return "planned";
  }
  if (runtimeLane.state === "confirmed") return "usable";
  if (runtimeLane.state === "partial") return "degraded";
  if (runtimeLane.state === "missing") return "missing_input";
  if (runtimeLane.state === "timeout") return "timeout";
  if (runtimeLane.state === "error") return "error";
  if (runtimeLane.state === "blocked") return requiresKey && runtimeLane.missing.some((item) => /api[_ -]?key|key/i.test(item)) ? "needs_key" : "blocked";
  return "planned";
}

function stateRank(state: Pass2582AdapterState) {
  const ranks: Record<Pass2582AdapterState, number> = {
    usable: 0,
    degraded: 1,
    needs_key: 2,
    missing_input: 3,
    timeout: 4,
    error: 5,
    planned: 6,
    blocked: 7,
  };
  return ranks[state];
}

function stateLabel(locale: string, state: Pass2582AdapterState) {
  const labels: Record<Pass2582AdapterState, string> = {
    usable: t(locale, "używalny", "nutzbar", "usable"),
    needs_key: t(locale, "brak klucza", "Key fehlt", "needs key"),
    missing_input: t(locale, "brak inputu", "Input fehlt", "missing input"),
    degraded: t(locale, "częściowy", "teilweise", "degraded"),
    timeout: t(locale, "timeout", "Timeout", "timeout"),
    error: t(locale, "błąd", "Fehler", "error"),
    planned: t(locale, "zaplanowany", "geplant", "planned"),
    blocked: t(locale, "zablokowany", "blockiert", "blocked"),
  };
  return labels[state];
}

function adapter(args: Omit<Pass2582AdapterLane, "state" | "evidence" | "missing" | "runtimeState"> & {
  locale: string;
  providerLane: Pass2582ProviderIntelligenceLane | null;
  runtimeLane: Pass2582RuntimeLaneLike | null;
  contractAddress?: string;
  fallbackEvidence?: string[];
  fallbackMissing?: string[];
}): Pass2582AdapterLane {
  const state = stateFromRuntime(args.runtimeLane, args.providerLane, args.requiresKey, args.contractAddress);
  return {
    id: args.id,
    provider: args.provider,
    sourceLane: args.sourceLane,
    state,
    endpointFamily: args.endpointFamily,
    docsReference: args.docsReference,
    envKeys: args.envKeys,
    requiresKey: args.requiresKey,
    supportedChains: args.supportedChains,
    timeoutMs: args.timeoutMs,
    cacheTtlSeconds: args.cacheTtlSeconds,
    mapsTo: args.mapsTo,
    runtimeLaneId: args.runtimeLaneId,
    runtimeState: args.runtimeLane?.state,
    freshnessClass: args.freshnessClass,
    customerClaimBoundary: args.customerClaimBoundary,
    failSoftBehavior: args.failSoftBehavior,
    evidence: (args.runtimeLane?.evidence.length ? args.runtimeLane.evidence : args.fallbackEvidence ?? []).slice(0, 6),
    missing: (args.runtimeLane?.missing.length ? args.runtimeLane.missing : args.fallbackMissing ?? []).slice(0, 6),
  };
}

function row(label: string, state: Pass2582AdapterState, output: string): Pass2582AdapterRow {
  return { label, state, output };
}

function buildAdapters(input: BuilderInput, locale: string, chainId: string): Pass2582AdapterLane[] {
  const contractAddress = clean(input.contractAddress, 96) ?? input.providerRuntime?.target.contractAddress;
  const intelligence = input.providerIntelligence;
  const runtime = input.providerRuntime;
  const docsEvidence = [input.auditUrl ? "auditUrl submitted" : "", input.docsUrl ? "docsUrl submitted" : "", input.githubUrl ? "githubUrl submitted" : "", input.website ? "website submitted" : ""].filter(Boolean);

  return [
    adapter({
      locale,
      id: "adapter-etherscan-v2-source-abi",
      provider: "Etherscan V2",
      sourceLane: "explorer-source-abi",
      endpointFamily: "contract/getsourcecode + contract/getabi",
      docsReference: "Etherscan API V2 contract source/ABI endpoints; unified chainid model for 50+ EVM chains.",
      envKeys: ["ETHERSCAN_API_KEY"],
      requiresKey: true,
      supportedChains: ["1", "56", "137", "42161", "10", "8453", "43114", "250", "59144", "5000"],
      timeoutMs: 2600,
      cacheTtlSeconds: 0,
      mapsTo: ["verified source", "ABI", "compiler", "proxy hint", "permission parser input"],
      runtimeLaneId: "runtime-explorer-source",
      runtimeLane: findRuntime(runtime, "runtime-explorer-source"),
      providerLane: findProvider(intelligence, "explorer-primary-etherscan-v2"),
      contractAddress,
      freshnessClass: "live",
      customerClaimBoundary: "No verified-source, ABI or owner/admin claim without explorer evidence.",
      failSoftBehavior: "If key, chain or provider fails, keep source lane blocked/missing and lower confidence instead of inventing source details.",
      fallbackEvidence: [`chainId ${chainId}`, contractAddress ? "contract format valid" : ""].filter(Boolean),
      fallbackMissing: contractAddress ? ["ETHERSCAN_API_KEY or live explorer response"] : ["contractAddress"],
    }),
    adapter({
      locale,
      id: "adapter-dexscreener-token-pairs",
      provider: "DEX Screener",
      sourceLane: "dex-liquidity-pairs",
      endpointFamily: "latest/dex/tokens/{address}",
      docsReference: "DEX Screener API reference for token profiles, boosts, pairs and liquidity style metadata.",
      envKeys: [],
      requiresKey: false,
      supportedChains: ["evm token address lanes; provider chainId returned in payload"],
      timeoutMs: 2600,
      cacheTtlSeconds: 300,
      mapsTo: ["pair discovery", "liquidity visibility", "volume", "DEX venue", "pair age later"],
      runtimeLaneId: "runtime-dex-liquidity",
      runtimeLane: findRuntime(runtime, "runtime-dex-liquidity"),
      providerLane: findProvider(intelligence, "dex-liquidity-dexscreener"),
      contractAddress,
      freshnessClass: "short_cache",
      customerClaimBoundary: "Liquidity visibility is not liquidity lock proof and does not prove safety.",
      failSoftBehavior: "If no pairs are returned, mark unknown; do not label scam only because liquidity is absent.",
      fallbackMissing: contractAddress ? ["public DEX pair evidence"] : ["contractAddress"],
    }),
    adapter({
      locale,
      id: "adapter-goplus-token-security",
      provider: "GoPlus Token Security",
      sourceLane: "security-flags-primary",
      endpointFamily: "token_security/{chain_id}",
      docsReference: "GoPlus Token Security API for passive token risk flags and real-time token security data.",
      envKeys: ["GOPLUS_API_KEY"],
      requiresKey: false,
      supportedChains: ["EVM chainId", "Solana beta handled in later non-EVM adapter"],
      timeoutMs: 2400,
      cacheTtlSeconds: 900,
      mapsTo: ["tax flags", "honeypot flag", "blacklist flag", "owner/permission hints"],
      runtimeLaneId: "runtime-security-flags-goplus",
      runtimeLane: findRuntime(runtime, "runtime-security-flags-goplus"),
      providerLane: findProvider(intelligence, "security-flags-goplus"),
      contractAddress,
      freshnessClass: "short_cache",
      customerClaimBoundary: "Security flags are warnings and need cross-checking; never turn one flag into a final verdict alone.",
      failSoftBehavior: "Provider absence keeps flags partial/missing; Basic remains usable with a visible gap.",
      fallbackMissing: contractAddress ? ["GoPlus token security response"] : ["contractAddress"],
    }),
    adapter({
      locale,
      id: "adapter-honeypot-passive-check",
      provider: "Honeypot.is",
      sourceLane: "honeypot-tax-fallback",
      endpointFamily: "v2/IsHoneypot",
      docsReference: "Honeypot.is API checks whether a token behaves like a honeypot and returns taxes/simulation-style risk details.",
      envKeys: ["HONEYPOT_API_KEY"],
      requiresKey: false,
      supportedChains: ["1", "56", "137", "42161", "10", "8453"],
      timeoutMs: 2400,
      cacheTtlSeconds: 900,
      mapsTo: ["honeypot warning", "buy tax", "sell tax", "simulation summary"],
      runtimeLaneId: "runtime-honeypot-passive",
      runtimeLane: findRuntime(runtime, "runtime-honeypot-passive"),
      providerLane: findProvider(intelligence, "security-flags-honeypot"),
      contractAddress,
      freshnessClass: "short_cache",
      customerClaimBoundary: "Only show customer-safe risk flags; do not output exploit or bypass guidance.",
      failSoftBehavior: "If unavailable, show missing honeypot/tax fallback and require Pro/Advanced re-check.",
      fallbackMissing: contractAddress ? ["Honeypot.is passive result"] : ["contractAddress"],
    }),
    adapter({
      locale,
      id: "adapter-coingecko-search-identity",
      provider: "CoinGecko Search",
      sourceLane: "market-identity-metadata",
      endpointFamily: "search query endpoint",
      docsReference: "CoinGecko Search Queries endpoint for coin/category/market discovery; token price and metadata endpoints remain a Pro lane later.",
      envKeys: ["COINGECKO_API_KEY"],
      requiresKey: false,
      supportedChains: ["cross-chain market identity"],
      timeoutMs: 2600,
      cacheTtlSeconds: 900,
      mapsTo: ["market identity", "symbol/name candidate", "metadata links later", "logo later"],
      runtimeLaneId: "runtime-market-metadata",
      runtimeLane: findRuntime(runtime, "runtime-market-metadata"),
      providerLane: findProvider(intelligence, "market-metadata-coingecko"),
      contractAddress: contractAddress ?? input.projectName,
      freshnessClass: "short_cache",
      customerClaimBoundary: "Market listing is identity evidence only, not safety proof.",
      failSoftBehavior: "If no match or rate limit occurs, keep identity partial and ask for official links/docs.",
      fallbackMissing: input.projectName || contractAddress ? ["confirmed market metadata match"] : ["projectName or contractAddress"],
    }),
    adapter({
      locale,
      id: "adapter-defillama-protocol-context",
      provider: "DeFiLlama",
      sourceLane: "protocol-tvl-context",
      endpointFamily: "protocols / tvl / chains context",
      docsReference: "DeFiLlama free API and methodology separate TVL/protocol context from safety proof; do not mix Free and Pro APIs.",
      envKeys: [],
      requiresKey: false,
      supportedChains: ["protocol slug / chain context"],
      timeoutMs: 2600,
      cacheTtlSeconds: 1800,
      mapsTo: ["protocol presence", "TVL context", "chain/category context", "not a safety proof"],
      runtimeLaneId: undefined,
      runtimeLane: null,
      providerLane: findProvider(intelligence, "defi-protocol-defillama"),
      contractAddress: input.projectName ?? input.website,
      freshnessClass: "short_cache",
      customerClaimBoundary: "TVL is protocol context, not a source-code or exploit-safety guarantee.",
      failSoftBehavior: "If no protocol match, mark not found and do not punish token risk without other evidence.",
      fallbackEvidence: input.projectName || input.website ? ["target ready for protocol matching"] : [],
      fallbackMissing: input.projectName || input.website ? ["live DeFiLlama adapter not executed in this pass"] : ["projectName or website"],
    }),
    adapter({
      locale,
      id: "adapter-submitted-docs-scope",
      provider: "Submitted public sources",
      sourceLane: "docs-repo-audit-scope",
      endpointFamily: "customer-submitted URLs",
      docsReference: "Velmère submitted-source adapter; no web trust claim until address/date/scope match.",
      envKeys: [],
      requiresKey: false,
      supportedChains: ["any public docs/audit/repo URL"],
      timeoutMs: 0,
      cacheTtlSeconds: 0,
      mapsTo: ["audit URL", "docs URL", "GitHub URL", "website", "scope matching later"],
      runtimeLaneId: "runtime-docs-repo-audit",
      runtimeLane: findRuntime(runtime, "runtime-docs-repo-audit"),
      providerLane: null,
      contractAddress: input.auditUrl || input.docsUrl || input.githubUrl || input.website,
      freshnessClass: "static",
      customerClaimBoundary: "Submitted docs are untrusted until scope/date/address matching confirms them.",
      failSoftBehavior: "Show source submitted, then keep authenticity partial until Pro/Advanced matching.",
      fallbackEvidence: docsEvidence,
      fallbackMissing: docsEvidence.length ? ["scope/date/address matching"] : ["auditUrl", "docsUrl", "githubUrl", "website"],
    }),
  ].sort((a, b) => stateRank(a.state) - stateRank(b.state));
}

export function buildPass2582RealProviderAdapterHardeningReport(input: BuilderInput): Pass2582RealProviderAdapterHardeningReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? input.providerRuntime?.target.chain ?? "ethereum";
  const chainId = clean(input.providerRuntime?.target.chainId, 20) ?? chainIdFrom(chain);
  const contractAddress = clean(input.contractAddress, 96) ?? input.providerRuntime?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? input.providerRuntime?.target.projectName;
  const providerAdapters = buildAdapters(input, locale, chainId);
  const counts = providerAdapters.reduce((acc, item) => {
    acc[item.state] = (acc[item.state] ?? 0) + 1;
    return acc;
  }, {} as Record<Pass2582AdapterState, number>);
  const usable = counts.usable ?? 0;
  const degraded = counts.degraded ?? 0;
  const nextCriticalAdapter = providerAdapters.find((item) => item.state !== "usable")?.provider ?? "none";
  const canFinalSignWithCurrentAdapters = Boolean(input.versionedRecheckReceipt?.summary.canFinalSign) && usable >= 4 && (counts.error ?? 0) === 0 && (counts.timeout ?? 0) === 0;

  const publicRows = providerAdapters.slice(0, 7).map((item) => row(
    item.provider,
    item.state,
    `${stateLabel(locale, item.state)} · ${item.sourceLane} · ${item.customerClaimBoundary}`,
  ));
  const proPdfRows = providerAdapters.slice(0, 9).map((item) => row(
    `${item.provider} / ${item.endpointFamily}`,
    item.state,
    `${item.docsReference} Evidence ${item.evidence.length}; missing ${item.missing.length}; TTL ${item.cacheTtlSeconds}s.`,
  ));
  const operatorRows = providerAdapters.map((item) => row(
    item.id,
    item.state,
    `maps=${item.mapsTo.join(" | ")} · timeout=${item.timeoutMs}ms · fail-soft=${item.failSoftBehavior}`,
  ));

  return {
    passId: PASS2582_REAL_PROVIDER_ADAPTER_HARDENING_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { contractAddress, projectName, chain, chainId },
    rule: t(
      locale,
      "PASS2582 utwardza realne providery: każdy adapter ma jeden schemat, źródło, timeout, TTL, fail-soft i granicę claimu.",
      "PASS2582 haertet reale Provider: jeder Adapter hat ein Schema, Quelle, Timeout, TTL, Fail-soft und Claim-Grenze.",
      "PASS2582 hardens real providers: every adapter has one schema, source, timeout, TTL, fail-soft behavior and claim boundary.",
    ),
    customerRule: t(
      locale,
      "Basic widzi tylko bezpieczny status źródeł. Brak API albo timeout obniża confidence, ale nie tworzy fałszywych claimów.",
      "Basic sieht nur sicheren Quellenstatus. Fehlender API-Key oder Timeout senkt Confidence, erzeugt aber keine falschen Claims.",
      "Basic sees only safe source status. Missing API keys or timeouts lower confidence but never create fake claims.",
    ),
    operatorRule: "Provider adapter output is append-only evidence input. It must not overwrite report receipts or final Advanced verdicts without a new versioned re-check.",
    adapterContract: {
      schemaVersion: "velmere-provider-adapter.v1",
      runtimeMode: "server-only no-store fetch fan-out, then normalized adapter rows",
      cachePolicy: "source freshness remains visible; DEX/security/market lanes use short TTL; explorer final-source claims use live/no-store for final sign-off",
      redactionPolicy: "no API keys, raw private payloads or operator-only notes in customer rows",
      noClaimRule: "no claim without provider state + evidence/missing rows + source lane mapping",
    },
    standardResultSchema: [
      { field: "providerId", required: true, output: "stable adapter id for replay and receipts" },
      { field: "sourceLane", required: true, output: "exact evidence lane used by source quorum / claim ledger" },
      { field: "state", required: true, output: "usable / degraded / needs_key / missing_input / timeout / error / planned / blocked" },
      { field: "fetchedAt", required: true, output: "runtime timestamp or static/submitted timestamp" },
      { field: "latencyMs", required: false, output: "provider latency inside timeout boundary" },
      { field: "httpStatus", required: false, output: "provider status without leaking secrets" },
      { field: "evidence", required: true, output: "customer-safe evidence rows" },
      { field: "missing", required: true, output: "explicit missing evidence rows" },
      { field: "cacheTtlSeconds", required: true, output: "freshness/expiry contract for re-check" },
      { field: "claimBoundary", required: true, output: "what the adapter is allowed to prove" },
    ],
    providerAdapters,
    sourceLaneMap: [
      { lane: "explorer-source-abi", primary: "Etherscan V2", fallback: "Blockscout later", proofRule: "source/ABI claims only after explorer proof" },
      { lane: "dex-liquidity-pairs", primary: "DEX Screener", fallback: "GeckoTerminal/CoinGecko onchain later", proofRule: "liquidity visible is not lock proof" },
      { lane: "security-flags", primary: "GoPlus", fallback: "Honeypot.is", proofRule: "flags are advisory until cross-source confirmed" },
      { lane: "market-identity", primary: "CoinGecko", fallback: "official links/docs", proofRule: "listing is identity evidence, not safety" },
      { lane: "protocol-context", primary: "DeFiLlama", fallback: "manual protocol match", proofRule: "TVL/context does not prove contract safety" },
      { lane: "docs-scope", primary: "submitted docs/audit/repo", fallback: "operator manual match", proofRule: "scope/date/address must match" },
    ],
    summary: {
      totalAdapters: providerAdapters.length,
      usable,
      needsKey: counts.needs_key ?? 0,
      missingInput: counts.missing_input ?? 0,
      degraded,
      timeout: counts.timeout ?? 0,
      error: counts.error ?? 0,
      planned: counts.planned ?? 0,
      blocked: counts.blocked ?? 0,
      runtimeCoverage: `${usable + degraded}/${providerAdapters.length} usable-or-degraded adapters`,
      nextCriticalAdapter,
      canFinalSignWithCurrentAdapters,
    },
    publicRows,
    proPdfRows,
    operatorRows,
    releaseGates: [
      "Etherscan source/ABI adapter must fail-soft when key or chain is missing.",
      "DEX liquidity adapter must not convert no-pair into scam by itself.",
      "GoPlus and Honeypot flags must stay advisory until cross-source confirmation.",
      "CoinGecko/DeFiLlama context cannot be treated as security proof.",
      "Submitted docs/audit URLs remain partial until scope/date/address match.",
      "Adapter output must feed receipt/re-check lifecycle instead of mutating reports silently.",
    ],
    nextImplementationBacklog: [
      "PASS2583: ABI/source extraction lane with owner/admin/mint/pause/blacklist/proxy signatures.",
      "PASS2584: DEX pair matrix + LP lock/ownership + top-holder concentration adapter.",
      "PASS2585: Pro PDF premium template slots fed by adapter rows without debug/pass language.",
      "PASS2586: operator console merge with final-sign checklist and redaction controls.",
      "PASS2587: provider circuit breaker + rate-limit budget + replayable request receipts.",
    ],
  };
}
