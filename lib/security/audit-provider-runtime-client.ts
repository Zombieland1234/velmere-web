import { readResponseBytesBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256BytesDigest, sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  reservePass4824AuditProviderBudgets,
  type Pass4824ProviderBudgetReservation,
} from "@/lib/security/audit-provider-budget";
import { parseStrictJsonBytes } from "@/lib/security/strict-json-boundary";
import {
  buildAuditProviderEvidenceDimensions,
  PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID,
} from "./audit-provider-evidence-dimensions";
import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2571AuditProviderIntelligenceReport } from "./audit-provider-intelligence";

declare const process: { env: Record<string, string | undefined> };

export const LEGACY_PASS2572_AUDIT_PROVIDER_RUNTIME_CLIENT_ID = "audit-provider-runtime-client" as const;
export const P89_PASS2572_AUDIT_PROVIDER_RUNTIME_CLIENT_ID = "audit-provider-runtime-client-p89-v2" as const;
export const PASS2572_AUDIT_PROVIDER_RUNTIME_CLIENT_ID = "audit-provider-runtime-client-p90-v3" as const;

export type Pass2572RuntimeState =
  | "confirmed"
  | "partial"
  | "missing"
  | "blocked"
  | "timeout"
  | "error"
  | "not_run";

export type Pass2572ProviderFamily =
  | "block_explorer"
  | "dex_market"
  | "contract_risk"
  | "contract_simulation"
  | "market_metadata"
  | "source_verification"
  | "submitted_sources"
  | "human_review";

export type Pass2572RuntimeIdentity = {
  verification: "exact_response" | "request_bound" | "unverified";
  requestedAddress?: string;
  resolvedAddress?: string;
  requestedChainId?: string;
  resolvedChainId?: string;
  matched: boolean;
};

export type Pass4807ProviderLineage = {
  providerId: string;
  upstreamRoot: string;
  correlationGroup: string;
  independenceEligible: boolean;
  transport: "direct_api" | "submitted_source" | "human_review";
};

export type Pass4807SourceTimestampProvenance =
  | "provider"
  | "chain_block"
  | "retrieval_snapshot"
  | "transport_received"
  | "missing"
  | "invalid";

export type Pass4807ProviderResponseReceipt = {
  observedAt: string;
  /** Exact timestamp used by the P90 field-currentness gate. */
  sourceObservedAt: string;
  /** Retrieval time is explicit and never masquerades as a provider timestamp. */
  sourceTimestampProvenance: Pass4807SourceTimestampProvenance;
  statusCode: number;
  contentType: string;
  bodyBytes: number;
  bodyDigest: string;
  requestUrlDigest: string;
  relatedResponseDigests: string[];
};

export type Pass2572RuntimeLane = {
  id: string;
  label: string;
  provider: string;
  providerFamily?: Pass2572ProviderFamily;
  lineage: Pass4807ProviderLineage;
  receipt?: Pass4807ProviderResponseReceipt;
  identity?: Pass2572RuntimeIdentity;
  state: Pass2572RuntimeState;
  /** True only when the response is usable for the exact requested target; HTTP success alone is insufficient. */
  liveExecutionEligible: boolean;
  tier: Array<"basic" | "pro" | "advanced">;
  claim: string;
  sourceUrl?: string;
  evidence: string[];
  missing: string[];
  latencyMs?: number;
  timeoutMs: number;
  noStore: boolean;
  boundary: string;
};

export type Pass2572ProviderPrivateStaticEvidence = {
  contractAddress: string;
  chainId: string;
  provider: string;
  observedAt: string;
  responseDigest: string;
  sourceText?: string;
  abiText?: string;
};

export type Pass2572AuditProviderRuntimeReport = {
  passId: typeof PASS2572_AUDIT_PROVIDER_RUNTIME_CLIENT_ID;
  generatedAt: string;
  locale: string;
  target: {
    contractAddress?: string;
    projectName?: string;
    chain: string;
    chainId: string;
    auditUrl?: string;
    docsUrl?: string;
    githubUrl?: string;
    website?: string;
  };
  rule: string;
  runtimeMode: string;
  lanes: Pass2572RuntimeLane[];
  summary: {
    confirmed: number;
    confirmedResponses: number;
    partial: number;
    missing: number;
    blocked: number;
    timedOut: number;
    errors: number;
    evidenceDimensionVersion: typeof PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID;
    successfulLiveProviderExecutions: number;
    successfulLiveProviderIds: string[];
    duplicateStrictLanesRejected: number;
    duplicateLiveLanesRejected: number;
    independentUpstreamRoots: string[];
    strictUpstreamQuorumMet: boolean;
    liveProviderCoverage: string;
    confidenceHint: string;
  };
  basicRows: Array<{ label: string; status: Pass2572RuntimeState; output: string }>;
  proRows: Array<{ label: string; status: Pass2572RuntimeState; output: string }>;
  advancedRows: Array<{ label: string; status: Pass2572RuntimeState; output: string }>;
  nextQueue: string[];
};

type RuntimeInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  providerIntelligence?: Pass2571AuditProviderIntelligenceReport | null;
};

type SafeFetchResult = {
  ok: boolean;
  status: number;
  url: string;
  data?: unknown;
  text?: string;
  error?: string;
  latencyMs: number;
  timedOut: boolean;
  observedAt: string;
  contentType: string;
  bodyBytes: number;
  bodyDigest?: string;
};

const PASS4824_PROVIDER_REPORT_CACHE_TTL_MS = 30_000;
const PASS4824_PROVIDER_REPORT_CACHE_MAX_ENTRIES = 256;
const pass4824ProviderReportCache = new Map<string, {
  expiresAt: number;
  value: Pass2572AuditProviderRuntimeReport;
}>();
const pass4824ProviderReportInFlight = new Map<string, Promise<Pass2572AuditProviderRuntimeReport>>();

const PASS2572_PRIVATE_STATIC_EVIDENCE_TTL_MS = 60_000;
const PASS2572_PRIVATE_STATIC_EVIDENCE_MAX_ENTRIES = 32;
const pass2572PrivateStaticEvidenceByReceipt = new Map<string, {
  expiresAt: number;
  value: Pass2572ProviderPrivateStaticEvidence;
}>();

function prunePass2572PrivateStaticEvidence(now = Date.now()) {
  for (const [key, entry] of pass2572PrivateStaticEvidenceByReceipt) {
    if (entry.expiresAt <= now) pass2572PrivateStaticEvidenceByReceipt.delete(key);
  }
  while (pass2572PrivateStaticEvidenceByReceipt.size > PASS2572_PRIVATE_STATIC_EVIDENCE_MAX_ENTRIES) {
    const oldest = pass2572PrivateStaticEvidenceByReceipt.keys().next().value as string | undefined;
    if (!oldest) break;
    pass2572PrivateStaticEvidenceByReceipt.delete(oldest);
  }
}

function storePass2572PrivateStaticEvidence(receiptDigest: string | undefined, value: Pass2572ProviderPrivateStaticEvidence) {
  if (!receiptDigest || !/^[a-f0-9]{64}$/i.test(receiptDigest)) return;
  prunePass2572PrivateStaticEvidence();
  pass2572PrivateStaticEvidenceByReceipt.delete(receiptDigest);
  pass2572PrivateStaticEvidenceByReceipt.set(receiptDigest, {
    expiresAt: Date.now() + PASS2572_PRIVATE_STATIC_EVIDENCE_TTL_MS,
    value: structuredClone(value),
  });
  prunePass2572PrivateStaticEvidence();
}


export const pass4824AuditProviderRuntimeClientDependencies: {
  brokeredEgressFetch: typeof brokeredEgressFetch;
} = {
  brokeredEgressFetch,
};

const CHAIN_ID_BY_NAME: Record<string, string> = {
  eth: "1",
  ethereum: "1",
  mainnet: "1",
  bsc: "56",
  binance: "56",
  "bnb smart chain": "56",
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
  ancient8: "888888888",
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[<>{}\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function chainIdFrom(chain: string | undefined) {
  const normalized = String(chain || "ethereum").trim().toLowerCase();
  return CHAIN_ID_BY_NAME[normalized] || (/^\d+$/.test(normalized) ? normalized : "1");
}

const DEX_CHAIN_TO_NUMERIC: Record<string, string> = {
  ethereum: "1", eth: "1", bsc: "56", polygon: "137", arbitrum: "42161", optimism: "10",
  base: "8453", avalanche: "43114", fantom: "250", linea: "59144", mantle: "5000", ancient8: "888888888",
};

function dexChainMatches(value: unknown, requestedChainId: string) {
  const chain = String(value ?? "").trim().toLowerCase();
  return chain === requestedChainId || DEX_CHAIN_TO_NUMERIC[chain] === requestedChainId;
}

function normalizedAddress(value: unknown) {
  const address = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^0x[a-f0-9]{40}$/.test(address) ? address : undefined;
}

/* PASS4144_PROVIDER_RUNTIME_EVM_ADDRESS_TYPE_GUARD: narrows provider URL inputs before encodeURIComponent. */
function isEvmAddress(value: string | undefined): value is string {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
}

/* PASS4144_PROVIDER_RUNTIME_EVIDENCE_COMPACT_GUARD: no undefined rows inside lane evidence arrays. */
function compactEvidenceRows(rows: Array<string | false | null | undefined>): string[] {
  return rows.filter((row): row is string => typeof row === "string" && row.length > 0);
}

function env(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return { key, value };
  }
  return null;
}

function summarizeJson(value: unknown, max = 180) {
  try {
    return JSON.stringify(value).slice(0, max);
  } catch {
    return "unserializable provider payload";
  }
}

async function safeFetchJson(url: string, timeoutMs: number): Promise<SafeFetchResult> {
  const started = Date.now();
  const observedAt = new Date().toISOString();
  try {
    const response = await pass4824AuditProviderRuntimeClientDependencies.brokeredEgressFetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "user-agent": "VelmereAuditRuntime/4807",
      },
    }, {
      profile: "audit_provider_runtime",
      timeoutMs,
      maxResponseBytes: 2_097_152,
      operation: "audit_runtime_provider",
    });
    const bytes = await readResponseBytesBounded(response, 2_097_152);
    let text = "";
    let data: unknown = undefined;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      data = text ? parseStrictJsonBytes(bytes, {
        maxBytes: 2_097_152,
        maxDepth: 40,
        maxNodes: 75_000,
        requireObject: false,
      }) : undefined;
    } catch {
      text = "";
      data = undefined;
    }
    return {
      ok: response.ok,
      status: response.status,
      url,
      data,
      text: text.slice(0, 320),
      latencyMs: Date.now() - started,
      timedOut: false,
      observedAt,
      contentType: (response.headers.get("content-type") ?? "application/octet-stream").split(";", 1)[0]!.trim().toLowerCase(),
      bodyBytes: bytes.byteLength,
      bodyDigest: sha256BytesDigest(bytes).replace(/^sha256:/, ""),
    };
  } catch (error) {
    const timedOut = error instanceof Error && /abort|timeout/i.test(error.name + error.message);
    return {
      ok: false,
      status: 0,
      url,
      error: error instanceof Error ? error.message.slice(0, 180) : "provider fetch failed",
      latencyMs: Date.now() - started,
      timedOut,
      observedAt,
      contentType: "application/octet-stream",
      bodyBytes: 0,
    };
  }
}

const PASS4807_LINEAGE_BY_LANE: Record<string, Pass4807ProviderLineage> = {
  "runtime-explorer-source": { providerId: "etherscan-v2", upstreamRoot: "etherscan", correlationGroup: "evm-explorer", independenceEligible: true, transport: "direct_api" },
  "runtime-dex-liquidity": { providerId: "dexscreener-api", upstreamRoot: "dexscreener", correlationGroup: "dex-market-index", independenceEligible: true, transport: "direct_api" },
  "runtime-security-flags-goplus": { providerId: "goplus-token-security", upstreamRoot: "gopluslabs", correlationGroup: "contract-risk-index", independenceEligible: true, transport: "direct_api" },
  "runtime-honeypot-passive": { providerId: "honeypot-is", upstreamRoot: "honeypot-is", correlationGroup: "contract-simulation", independenceEligible: true, transport: "direct_api" },
  "runtime-market-metadata": { providerId: "coingecko-search", upstreamRoot: "coingecko", correlationGroup: "market-metadata-index", independenceEligible: true, transport: "direct_api" },
  "runtime-sourcify-verification": { providerId: "sourcify-v2", upstreamRoot: "sourcify", correlationGroup: "independent-source-recompilation", independenceEligible: true, transport: "direct_api" },
  "runtime-docs-repo-audit": { providerId: "submitted-public-source", upstreamRoot: "submitted-source", correlationGroup: "customer-submitted-source", independenceEligible: false, transport: "submitted_source" },
  "runtime-advanced-human-review": { providerId: "velmere-operator-review", upstreamRoot: "velmere-human-review", correlationGroup: "human-review", independenceEligible: false, transport: "human_review" },
};

function lineageForLane(id: string): Pass4807ProviderLineage {
  return PASS4807_LINEAGE_BY_LANE[id] ?? {
    providerId: "unknown-provider",
    upstreamRoot: "unknown-upstream",
    correlationGroup: "unknown-correlation",
    independenceEligible: false,
    transport: "direct_api",
  };
}

function receiptFromFetch(result: SafeFetchResult, related: SafeFetchResult[] = []): Pass4807ProviderResponseReceipt | undefined {
  if (!result.bodyDigest) return undefined;
  return {
    observedAt: result.observedAt,
    sourceObservedAt: result.observedAt,
    sourceTimestampProvenance: "retrieval_snapshot",
    statusCode: result.status,
    contentType: result.contentType,
    bodyBytes: result.bodyBytes,
    bodyDigest: related.length
      ? sha256Digest(canonicalJson([result.bodyDigest, ...related.map((item) => item.bodyDigest ?? null)])).replace(/^sha256:/, "")
      : result.bodyDigest,
    requestUrlDigest: sha256Digest(result.url).replace(/^sha256:/, ""),
    relatedResponseDigests: related.map((item) => item.bodyDigest).filter((item): item is string => Boolean(item)),
  };
}

/* PASS4145_PROVIDER_SOURCE_URL_REDACTION_GUARD: source URLs shown to customers never include query strings, API keys or unsupported schemes. */
function sanitizeProviderSourceUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

function lane(args: Omit<Pass2572RuntimeLane, "noStore" | "lineage" | "liveExecutionEligible"> & { noStore?: boolean; lineage?: Pass4807ProviderLineage; liveExecutionEligible?: boolean }): Pass2572RuntimeLane {
  return {
    ...args,
    liveExecutionEligible: args.liveExecutionEligible ?? false,
    lineage: args.lineage ?? lineageForLane(args.id),
    identity: args.identity ?? { verification: "unverified", matched: false },
    // PASS4145_PROVIDER_LANE_OUTPUT_COMPACT_GUARD: all outward lane rows are compacted and source URLs are redacted at the shared boundary.
    sourceUrl: sanitizeProviderSourceUrl(args.sourceUrl),
    noStore: args.noStore ?? true,
    evidence: compactEvidenceRows(args.evidence).slice(0, 6),
    missing: compactEvidenceRows(args.missing).slice(0, 6),
  };
}

function stateFromFetch(result: SafeFetchResult, positive: boolean, missingText: string): Pick<Pass2572RuntimeLane, "state" | "evidence" | "missing" | "latencyMs"> {
  if (result.timedOut) {
    return { state: "timeout", evidence: [], missing: [missingText, "provider timed out inside Velmère timeout boundary"], latencyMs: result.latencyMs };
  }
  if (!result.ok) {
    return { state: result.status === 404 ? "missing" : "error", evidence: [], missing: [missingText, `provider status ${result.status || "network_error"}`], latencyMs: result.latencyMs };
  }
  if (!positive) {
    return { state: "partial", evidence: ["provider returned a response, but usable evidence was limited"], missing: [missingText], latencyMs: result.latencyMs };
  }
  return { state: "confirmed", evidence: ["provider returned usable public evidence"], missing: [], latencyMs: result.latencyMs };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

async function explorerLane(contractAddress: string | undefined, chainId: string, locale: string): Promise<Pass2572RuntimeLane> {
  const timeoutMs = 3000;
  const key = env(["ETHERSCAN_API_KEY"]);
  if (!isEvmAddress(contractAddress)) {
    return lane({
      id: "runtime-explorer-source",
      label: "Explorer source / ABI",
      provider: "Etherscan V2",
      providerFamily: "block_explorer",
      identity: { verification: "unverified", matched: false },
      state: "missing",
      tier: ["basic", "pro", "advanced"],
      claim: t(locale, "Nie podano poprawnego adresu EVM.", "Keine gueltige EVM Adresse angegeben.", "No valid EVM address was provided."),
      evidence: [],
      missing: [t(locale, "Explorer source wymaga adresu 0x.", "Explorer Source braucht eine 0x Adresse.", "Explorer source requires a 0x address.")],
      timeoutMs,
      boundary: "No verified-source claim without explorer response identity binding.",
    });
  }
  if (!key) {
    return lane({
      id: "runtime-explorer-source",
      label: "Explorer source / ABI",
      provider: "Etherscan V2",
      providerFamily: "block_explorer",
      identity: { verification: "request_bound", requestedAddress: contractAddress.toLowerCase(), requestedChainId: chainId, matched: false },
      state: "blocked",
      tier: ["basic", "pro", "advanced"],
      claim: t(locale, "Explorer gotowy, ale brakuje klucza API.", "Explorer bereit, aber API Key fehlt.", "Explorer runtime is ready, but API key is missing."),
      evidence: [`chainId ${chainId}`, "contract format valid"],
      missing: ["ETHERSCAN_API_KEY"],
      timeoutMs,
      boundary: "No source/ABI certainty until API key confirms it.",
    });
  }
  const sourceUrl = `https://api.etherscan.io/v2/api?chainid=${encodeURIComponent(chainId)}&module=contract&action=getsourcecode&address=${encodeURIComponent(contractAddress)}&apikey=${encodeURIComponent(key.value)}`;
  const identityUrl = `https://api.etherscan.io/v2/api?chainid=${encodeURIComponent(chainId)}&module=contract&action=getcontractcreation&contractaddresses=${encodeURIComponent(contractAddress)}&apikey=${encodeURIComponent(key.value)}`;
  const [sourceResult, identityResult] = await Promise.all([
    safeFetchJson(sourceUrl, timeoutMs),
    safeFetchJson(identityUrl, timeoutMs),
  ]);
  const data = asRecord(sourceResult.data);
  const rows = Array.isArray(data?.result) ? data.result : [];
  const first = asRecord(rows[0]);
  const sourceCode = typeof first?.SourceCode === "string" ? first.SourceCode.trim() : "";
  const abi = typeof first?.ABI === "string" ? first.ABI.trim() : "";
  const sourcePositive = Boolean(first && (sourceCode || (abi && abi !== "Contract source code not verified")));
  const identityData = asRecord(identityResult.data);
  const identityRows = Array.isArray(identityData?.result) ? identityData.result : [];
  const identityFirst = asRecord(identityRows[0]);
  const resolvedAddress = normalizedAddress(identityFirst?.contractAddress ?? identityFirst?.contract_address);
  const identityMatched = resolvedAddress === contractAddress.toLowerCase();
  const state: Pass2572RuntimeState = sourceResult.timedOut || identityResult.timedOut
    ? "timeout"
    : !sourceResult.ok
      ? sourceResult.status === 404 ? "missing" : "error"
      : sourcePositive && identityMatched
        ? "confirmed"
        : sourcePositive ? "partial" : "missing";
  const providerReceipt = receiptFromFetch(sourceResult, [identityResult]);
  if (state === "confirmed" && providerReceipt?.bodyDigest && sourceResult.bodyDigest) {
    storePass2572PrivateStaticEvidence(providerReceipt.bodyDigest, {
      contractAddress: contractAddress.toLowerCase(),
      chainId,
      provider: "Etherscan V2",
      observedAt: sourceResult.observedAt,
      responseDigest: sourceResult.bodyDigest,
      ...(sourceCode ? { sourceText: sourceCode } : {}),
      ...(abi && abi !== "Contract source code not verified" ? { abiText: abi } : {}),
    });
  }
  return lane({
    id: "runtime-explorer-source",
    label: "Explorer source / ABI",
    provider: "Etherscan V2",
    providerFamily: "block_explorer",
    receipt: providerReceipt,
    identity: {
      verification: identityMatched ? "exact_response" : "request_bound",
      requestedAddress: contractAddress.toLowerCase(),
      resolvedAddress,
      requestedChainId: chainId,
      resolvedChainId: identityMatched ? chainId : undefined,
      matched: identityMatched,
    },
    state,
    liveExecutionEligible: Boolean(sourceResult.ok && sourcePositive && identityMatched),
    tier: ["basic", "pro", "advanced"],
    claim: sourcePositive && identityMatched
      ? "Explorer returned content-bound source/ABI evidence and echoed the exact contract identity through the same upstream."
      : sourcePositive
        ? "Explorer returned source/ABI, but exact contract identity was not independently echoed by the response."
        : "Explorer lane could not confirm source/ABI yet.",
    sourceUrl: "https://api.etherscan.io/v2/api",
    evidence: compactEvidenceRows([
      sourcePositive ? "source/ABI response received" : "",
      identityMatched ? `resolvedAddress: ${resolvedAddress}` : "",
      first?.ContractName ? `contractName: ${String(first.ContractName).slice(0, 80)}` : "",
      first?.CompilerVersion ? `compiler: ${String(first.CompilerVersion).slice(0, 80)}` : "",
      first?.Proxy ? `proxy: ${String(first.Proxy).slice(0, 20)}` : "",
      first?.Implementation ? `implementation: ${String(first.Implementation).slice(0, 96)}` : "",
      sourceResult.bodyDigest ? `responseDigest: ${sourceResult.bodyDigest}` : "",
    ]),
    missing: compactEvidenceRows([
      !sourcePositive ? "verified source / ABI unavailable" : "",
      !identityMatched ? "exact contract identity not echoed by explorer response" : "",
      !identityResult.ok ? `identity endpoint status ${identityResult.status || "network_error"}` : "",
    ]),
    latencyMs: Math.max(sourceResult.latencyMs, identityResult.latencyMs),
    timeoutMs,
    boundary: "Verified/source claims require content plus exact response identity; request binding alone cannot enter paid quorum.",
  });
}

async function dexScreenerLane(contractAddress: string | undefined, chainId: string, locale: string): Promise<Pass2572RuntimeLane> {
  const timeoutMs = 2600;
  if (!isEvmAddress(contractAddress)) {
    return lane({
      id: "runtime-dex-liquidity",
      label: "DEX liquidity / pairs",
      provider: "DEX Screener",
      providerFamily: "dex_market",
      identity: { verification: "unverified", matched: false },
      state: "missing",
      tier: ["basic", "pro", "advanced"],
      claim: t(locale, "Brak adresu EVM do sprawdzenia par DEX.", "Keine EVM Adresse fuer DEX Pairs.", "No EVM address for DEX pair lookup."),
      evidence: [],
      missing: ["contractAddress"],
      timeoutMs,
      boundary: "Missing DEX pairs is not a scam claim.",
    });
  }
  const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(contractAddress)}`;
  const result = await safeFetchJson(url, timeoutMs);
  const data = asRecord(result.data);
  const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
  const requestedAddress = contractAddress.toLowerCase();
  const exactPairs = pairs.map(asRecord).filter((pair): pair is Record<string, unknown> => {
    if (!pair || !dexChainMatches(pair.chainId, chainId)) return false;
    const baseToken = asRecord(pair.baseToken);
    const quoteToken = asRecord(pair.quoteToken);
    return normalizedAddress(baseToken?.address) === requestedAddress || normalizedAddress(quoteToken?.address) === requestedAddress;
  });
  const exactPair = exactPairs[0] ?? null;
  const positive = exactPairs.length > 0;
  const base = stateFromFetch(result, positive, pairs.length ? "DEX returned candidates but none matched the requested contract and chain" : "no public DEX pair evidence returned");
  const first = exactPair ?? asRecord(pairs[0]);
  const liquidity = asRecord(first?.liquidity);
  return lane({
    id: "runtime-dex-liquidity",
    label: "DEX liquidity / pairs",
    provider: "DEX Screener",
    providerFamily: "dex_market",
    receipt: receiptFromFetch(result),
    identity: { verification: positive ? "exact_response" : "unverified", requestedAddress, resolvedAddress: positive ? requestedAddress : undefined, requestedChainId: chainId, resolvedChainId: positive ? chainId : undefined, matched: positive },
    state: base.state,
    liveExecutionEligible: Boolean(result.ok && positive),
    tier: ["basic", "pro", "advanced"],
    claim: positive ? "Public DEX pair evidence found." : "DEX lane did not confirm public pairs.",
    sourceUrl: url,
    evidence: [
      ...base.evidence,
      positive ? `matchingPairs: ${exactPairs.length}` : pairs.length ? `unmatchedCandidates: ${pairs.length}` : "",
      first?.chainId ? `chain: ${String(first.chainId).slice(0, 40)}` : "",
      first?.dexId ? `dex: ${String(first.dexId).slice(0, 40)}` : "",
      liquidity?.usd ? `liquidityUsd: ${String(liquidity.usd).slice(0, 40)}` : "",
    ].filter((row): row is string => typeof row === "string" && row.length > 0),
    missing: base.missing,
    latencyMs: base.latencyMs,
    timeoutMs,
    boundary: "Liquidity visibility is not lock proof; lock remains separate evidence.",
  });
}

async function goPlusLane(contractAddress: string | undefined, chainId: string): Promise<Pass2572RuntimeLane> {
  const timeoutMs = 2400;
  if (!isEvmAddress(contractAddress)) {
    return lane({
      id: "runtime-security-flags-goplus",
      label: "Security flags",
      provider: "GoPlus Token Security",
      providerFamily: "contract_risk",
      identity: { verification: "unverified", matched: false },
      state: "missing",
      tier: ["basic", "pro", "advanced"],
      claim: "Security flag runtime requires a valid EVM contract.",
      evidence: [],
      missing: ["contractAddress"],
      timeoutMs,
      boundary: "Security flags are advisory warnings, not proof of safety.",
    });
  }
  const url = `https://api.gopluslabs.io/api/v1/token_security/${encodeURIComponent(chainId)}?contract_addresses=${encodeURIComponent(contractAddress)}`;
  const result = await safeFetchJson(url, timeoutMs);
  const data = asRecord(result.data);
  const resultRecord = asRecord(data?.result);
  const token = resultRecord ? asRecord(resultRecord[contractAddress.toLowerCase()] ?? resultRecord[contractAddress]) : null;
  const positive = Boolean(token && Object.keys(token).length);
  const base = stateFromFetch(result, positive, "token security flags unavailable");
  const buyTax = token?.buy_tax != null ? String(token.buy_tax) : undefined;
  const sellTax = token?.sell_tax != null ? String(token.sell_tax) : undefined;
  const isHoneypot = token?.is_honeypot != null ? String(token.is_honeypot) : undefined;
  return lane({
    id: "runtime-security-flags-goplus",
    label: "Security flags",
    provider: "GoPlus Token Security",
    providerFamily: "contract_risk",
    receipt: receiptFromFetch(result),
    identity: { verification: positive ? "exact_response" : "unverified", requestedAddress: contractAddress.toLowerCase(), resolvedAddress: positive ? contractAddress.toLowerCase() : undefined, requestedChainId: chainId, resolvedChainId: positive ? chainId : undefined, matched: positive },
    state: base.state,
    liveExecutionEligible: Boolean(result.ok && positive),
    tier: ["basic", "pro", "advanced"],
    claim: positive ? "Passive token security flags returned." : "Security flags not confirmed yet.",
    sourceUrl: `https://api.gopluslabs.io/api/v1/token_security/${chainId}`,
    evidence: [
      ...base.evidence,
      buyTax ? `buyTax: ${buyTax}` : "",
      sellTax ? `sellTax: ${sellTax}` : "",
      isHoneypot ? `honeypotFlag: ${isHoneypot}` : "",
    ].filter((row): row is string => typeof row === "string" && row.length > 0),
    missing: base.missing,
    latencyMs: base.latencyMs,
    timeoutMs,
    boundary: "Never output exploit steps; flags are customer-safe warnings only.",
  });
}

async function honeypotLane(contractAddress: string | undefined, chainId: string): Promise<Pass2572RuntimeLane> {
  const timeoutMs = 2400;
  if (!isEvmAddress(contractAddress)) {
    return lane({
      id: "runtime-honeypot-passive",
      label: "Honeypot passive check",
      provider: "Honeypot.is",
      providerFamily: "contract_simulation",
      identity: { verification: "unverified", matched: false },
      state: "missing",
      tier: ["pro", "advanced"],
      claim: "Honeypot passive lane requires a valid EVM contract.",
      evidence: [],
      missing: ["contractAddress"],
      timeoutMs,
      boundary: "Passive simulation data is advisory and must not become exploit guidance.",
    });
  }
  const url = `https://api.honeypot.is/v2/IsHoneypot?address=${encodeURIComponent(contractAddress)}&chainID=${encodeURIComponent(chainId)}`;
  const result = await safeFetchJson(url, timeoutMs);
  const data = asRecord(result.data);
  const simulation = asRecord(data?.simulationResult);
  const summary = asRecord(data?.summary);
  const token = asRecord(data?.token);
  const resolvedAddress = normalizedAddress(token?.address ?? data?.tokenAddress ?? simulation?.tokenAddress);
  const identityMatched = resolvedAddress === contractAddress.toLowerCase();
  const positive = Boolean(identityMatched && data && (simulation || summary || data.honeypotResult));
  const base = stateFromFetch(result, positive, identityMatched ? "honeypot passive result unavailable" : "provider response did not prove the requested contract identity");
  return lane({
    id: "runtime-honeypot-passive",
    label: "Honeypot passive check",
    provider: "Honeypot.is",
    providerFamily: "contract_simulation",
    receipt: receiptFromFetch(result),
    identity: { verification: identityMatched ? "exact_response" : "unverified", requestedAddress: contractAddress.toLowerCase(), resolvedAddress, requestedChainId: chainId, resolvedChainId: identityMatched ? chainId : undefined, matched: identityMatched },
    state: base.state,
    liveExecutionEligible: Boolean(result.ok && positive),
    tier: ["pro", "advanced"],
    claim: positive ? "Passive honeypot-style evidence returned." : "Honeypot-style evidence not confirmed yet.",
    sourceUrl: "https://api.honeypot.is/v2/IsHoneypot",
    evidence: [
      ...base.evidence,
      summary ? `summary: ${summarizeJson(summary, 120)}` : "",
      simulation ? `simulation: ${summarizeJson(simulation, 120)}` : "",
    ].filter((row): row is string => typeof row === "string" && row.length > 0),
    missing: base.missing,
    latencyMs: base.latencyMs,
    timeoutMs,
    boundary: "Do not provide exploit or bypass instructions; only show risk flags.",
  });
}

async function coinGeckoLane(projectName: string | undefined, contractAddress: string | undefined): Promise<Pass2572RuntimeLane> {
  const timeoutMs = 2600;
  const query = projectName || contractAddress;
  if (!query) {
    return lane({
      id: "runtime-market-metadata",
      label: "Market metadata",
      provider: "CoinGecko search",
      providerFamily: "market_metadata",
      identity: { verification: "unverified", matched: false },
      state: "missing",
      tier: ["basic", "pro", "advanced"],
      claim: "Market metadata lane needs a project name or contract.",
      evidence: [],
      missing: ["projectName or contractAddress"],
      timeoutMs,
      boundary: "Market presence does not prove safety.",
    });
  }
  const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
  const result = await safeFetchJson(url, timeoutMs);
  const data = asRecord(result.data);
  const coins = Array.isArray(data?.coins) ? data.coins : [];
  const positive = coins.length > 0;
  const base = stateFromFetch(result, positive, "market metadata search returned no confirmed match");
  const first = asRecord(coins[0]);
  return lane({
    id: "runtime-market-metadata",
    label: "Market metadata",
    provider: "CoinGecko search",
    providerFamily: "market_metadata",
    receipt: receiptFromFetch(result),
    identity: { verification: "unverified", requestedAddress: contractAddress?.toLowerCase(), matched: false },
    state: positive ? "partial" : base.state,
    liveExecutionEligible: Boolean(result.ok && positive),
    tier: ["basic", "pro", "advanced"],
    claim: positive ? "Market metadata candidate found." : "No market metadata candidate confirmed.",
    sourceUrl: "https://api.coingecko.com/api/v3/search",
    evidence: [
      ...base.evidence,
      positive ? `matches: ${coins.length}` : "",
      first?.name ? `name: ${String(first.name).slice(0, 80)}` : "",
      first?.symbol ? `symbol: ${String(first.symbol).slice(0, 24)}` : "",
    ].filter((row): row is string => typeof row === "string" && row.length > 0),
    missing: base.missing,
    latencyMs: base.latencyMs,
    timeoutMs,
    boundary: "Listing/metadata is identity evidence, not a safety proof.",
  });
}


export type Pass4827SourcifyLookupClassification = {
  requestedAddress: string;
  requestedChainId: string;
  resolvedAddress?: string;
  resolvedChainId?: string;
  identityMatched: boolean;
  match?: string;
  creationMatch?: string;
  runtimeMatch?: string;
  verifiedAt?: string;
  matchIdDigest?: string;
  exactRuntimeVerification: boolean;
  verifiedButNotExact: boolean;
  unsafeRawFieldsPresent: boolean;
  blockers: string[];
};

const SOURCIFY_RAW_FIELD_PATTERN = /^(?:abi|source|sources|metadata|compilerInput|standardJsonInput|runtimeBytecode|creationBytecode|bytecode|storageLayout)$/i;

/** Pure, bounded parser for the minimal Sourcify v2 lookup response. */
export function parsePass4827SourcifyLookupResponse(
  value: unknown,
  requestedAddressInput: string,
  requestedChainIdInput: string,
): Pass4827SourcifyLookupClassification {
  const data = asRecord(value);
  const requestedAddress = normalizedAddress(requestedAddressInput) ?? "";
  const requestedChainId = /^\d{1,20}$/.test(requestedChainIdInput.trim()) ? requestedChainIdInput.trim() : "";
  const resolvedAddress = normalizedAddress(data?.address);
  const resolvedChainId = typeof data?.chainId === "string" || typeof data?.chainId === "number" ? String(data.chainId) : undefined;
  const match = typeof data?.match === "string" ? data.match.slice(0, 32) : undefined;
  const creationMatch = typeof data?.creationMatch === "string" ? data.creationMatch.slice(0, 32) : undefined;
  const runtimeMatch = typeof data?.runtimeMatch === "string" ? data.runtimeMatch.slice(0, 32) : undefined;
  const verifiedAt = typeof data?.verifiedAt === "string" && Number.isFinite(Date.parse(data.verifiedAt)) ? data.verifiedAt : undefined;
  const matchId = typeof data?.matchId === "string" || typeof data?.matchId === "number" ? String(data.matchId) : undefined;
  const unsafeRawFieldsPresent = Boolean(data && Object.keys(data).some((key) => SOURCIFY_RAW_FIELD_PATTERN.test(key)));
  const identityMatched = Boolean(requestedAddress && requestedChainId && resolvedAddress === requestedAddress && resolvedChainId === requestedChainId);
  const blockers = compactEvidenceRows([
    !data ? "response_object_missing" : "",
    !requestedAddress ? "requested_address_invalid" : "",
    !requestedChainId ? "requested_chain_id_invalid" : "",
    !identityMatched ? "exact_chain_address_identity_missing" : "",
    unsafeRawFieldsPresent ? "raw_sensitive_fields_present" : "",
  ]);
  const exactRuntimeVerification = blockers.length === 0 && match === "exact_match" && runtimeMatch === "exact_match";
  const verifiedButNotExact = blockers.length === 0 && !exactRuntimeVerification
    && (match === "match" || creationMatch === "match" || runtimeMatch === "match");
  return {
    requestedAddress,
    requestedChainId,
    resolvedAddress,
    resolvedChainId,
    identityMatched,
    creationMatch,
    runtimeMatch,
    verifiedAt,
    matchIdDigest: matchId ? sha256Digest(matchId) : undefined,
    exactRuntimeVerification,
    verifiedButNotExact,
    unsafeRawFieldsPresent,
    blockers,
  };
}


async function sourcifyLane(contractAddress: string | undefined, chainId: string, locale: string): Promise<Pass2572RuntimeLane> {
  const timeoutMs = 2600;
  if (!isEvmAddress(contractAddress)) {
    return lane({
      id: "runtime-sourcify-verification",
      label: "Independent source verification",
      provider: "Sourcify API v2",
      providerFamily: "source_verification",
      identity: { verification: "unverified", matched: false },
      state: "missing",
      tier: ["basic", "pro", "advanced"],
      claim: t(locale, "Brak poprawnego adresu EVM do lookupu Sourcify.", "Keine gueltige EVM Adresse fuer Sourcify Lookup.", "No valid EVM address for Sourcify lookup."),
      evidence: [],
      missing: ["contractAddress"],
      timeoutMs,
      boundary: "No source-verification claim without an exact chain/address response. Verification status never proves security or current exploitability.",
    });
  }
  // Deliberately request only the minimal v2 lookup response. Raw Solidity, ABI,
  // metadata, compiler input and bytecode never cross this public provider lane.
  const requestedAddress = contractAddress.toLowerCase();
  const url = `https://sourcify.dev/server/v2/contract/${encodeURIComponent(chainId)}/${encodeURIComponent(contractAddress)}`;
  const result = await safeFetchJson(url, timeoutMs);
  const classification = parsePass4827SourcifyLookupResponse(result.data, requestedAddress, chainId);
  const {
    resolvedAddress,
    resolvedChainId,
    identityMatched,
    creationMatch,
    runtimeMatch,
    exactRuntimeVerification,
    verifiedButNotExact,
    verifiedAt,
    matchIdDigest,
  } = classification;
  const base = stateFromFetch(
    result,
    exactRuntimeVerification || verifiedButNotExact,
    identityMatched ? "Sourcify did not return a usable verification classification" : "Sourcify response did not prove the requested chain/address identity",
  );
  const state: Pass2572RuntimeState = exactRuntimeVerification ? "confirmed" : verifiedButNotExact ? "partial" : base.state;
  return lane({
    id: "runtime-sourcify-verification",
    label: "Independent source verification",
    provider: "Sourcify API v2",
    providerFamily: "source_verification",
    receipt: receiptFromFetch(result),
    identity: {
      verification: identityMatched ? "exact_response" : "unverified",
      requestedAddress,
      resolvedAddress,
      requestedChainId: chainId,
      resolvedChainId,
      matched: identityMatched,
    },
    state,
    liveExecutionEligible: Boolean(result.ok && identityMatched && (exactRuntimeVerification || verifiedButNotExact)),
    tier: ["basic", "pro", "advanced"],
    claim: exactRuntimeVerification
      ? "An exact runtime source-verification record was returned for the requested chain and address."
      : verifiedButNotExact
        ? "A non-exact source-verification record was returned for the requested chain and address."
        : "No identity-bound Sourcify verification record was confirmed.",
    sourceUrl: "https://sourcify.dev/server/v2/contract",
    evidence: compactEvidenceRows([
      exactRuntimeVerification ? "verificationClass: exact_runtime_match" : verifiedButNotExact ? "verificationClass: non_exact_match" : "",
      creationMatch ? `creationMatch: ${creationMatch.slice(0, 32)}` : "",
      runtimeMatch ? `runtimeMatch: ${runtimeMatch.slice(0, 32)}` : "",
      verifiedAt ? `verifiedAtHistorical: ${verifiedAt}` : "",
      matchIdDigest ? `matchReferenceDigest: ${matchIdDigest}` : "",
    ]),
    missing: compactEvidenceRows([
      ...base.missing,
      !identityMatched ? "exact chain/address identity" : "",
      identityMatched && !exactRuntimeVerification ? "exact runtime recompilation match" : "",
      !verifiedAt ? "provider verification timestamp" : "",
      ...classification.blockers,
    ]),
    latencyMs: base.latencyMs,
    timeoutMs,
    boundary: "Sourcify lookup is read-only. An exact match proves a bounded source/recompilation relationship at verification time; it does not prove current runtime state, safety, absence of vulnerabilities, trusted-forwarder configuration or exploitability. Raw source, ABI, metadata and bytecode are not requested or redistributed.",
  });
}

function docsLane(input: RuntimeInput, locale: string): Pass2572RuntimeLane {
  const evidence = compactEvidenceRows([input.auditUrl ? "audit URL submitted" : "", input.docsUrl ? "docs URL submitted" : "", input.githubUrl ? "GitHub URL submitted" : "", input.website ? "website submitted" : ""]);
  return lane({
    id: "runtime-docs-repo-audit",
    label: "Docs / repo / audit scope",
    provider: "Submitted public sources",
    providerFamily: "submitted_sources",
    identity: { verification: "unverified", matched: false },
    state: evidence.length ? "partial" : "missing",
    tier: ["basic", "pro", "advanced"],
    claim: evidence.length
      ? t(locale, "Użytkownik podał publiczne źródła do dopasowania scope.", "User hat oeffentliche Quellen fuer Scope-Matching angegeben.", "User provided public sources for scope matching.")
      : t(locale, "Nie podano docs/repo/audytu do dopasowania.", "Keine Docs/Repo/Audit fuer Matching angegeben.", "No docs/repo/audit was submitted for matching."),
    evidence,
    missing: evidence.length ? ["scope/date/address matching reserved for Pro/Advanced"] : ["auditUrl", "docsUrl", "githubUrl"],
    timeoutMs: 0,
    boundary: "Never guess repo/audit authenticity without matching address, date and scope.",
  });
}

function advancedLane(locale: string): Pass2572RuntimeLane {
  return lane({
    id: "runtime-advanced-human-review",
    label: "Advanced analysis verification",
    provider: "Velmère operator",
    providerFamily: "human_review",
    identity: { verification: "unverified", matched: false },
    state: "blocked",
    tier: ["advanced"],
    claim: t(locale, "Advanced wymaga receipt i potwierdzonego scope.", "Advanced braucht Receipt und bestaetigten Scope.", "Advanced requires receipt and confirmed scope."),
    evidence: [],
    missing: ["payment receipt", "operator scope", "private delivery boundary"],
    timeoutMs: 0,
    boundary: "No private/manual review claim on public Basic output.",
  });
}

function outputForLane(lane: Pass2572RuntimeLane, tier: "basic" | "pro" | "advanced") {
  const prefix = lane.evidence[0] || lane.missing[0] || lane.claim;
  if (tier === "basic") return `${lane.provider}: ${prefix}`;
  if (tier === "pro") return `${lane.provider} [upstream=${lane.lineage.upstreamRoot}]: ${lane.claim} Evidence rows: ${lane.evidence.length}; missing rows: ${lane.missing.length}; content receipt: ${lane.receipt ? "yes" : "no"}.`;
  return `${lane.provider} [upstream=${lane.lineage.upstreamRoot}; correlation=${lane.lineage.correlationGroup}]: ${lane.claim} Boundary: ${lane.boundary}`;
}

async function buildUncachedPass2572AuditProviderRuntimeReport(input: RuntimeInput): Promise<Pass2572AuditProviderRuntimeReport> {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? "ethereum";
  const chainId = chainIdFrom(chain);
  const contractAddress = clean(input.contractAddress, 96);
  const projectName = clean(input.projectName, 90);
  const target = {
    contractAddress,
    projectName,
    chain,
    chainId,
    auditUrl: clean(input.auditUrl, 260),
    docsUrl: clean(input.docsUrl, 260),
    githubUrl: clean(input.githubUrl, 260),
    website: clean(input.website, 260),
  };

  const reservations: Pass4824ProviderBudgetReservation[] = [];
  if (isEvmAddress(contractAddress)) {
    if (env(["ETHERSCAN_API_KEY"])) reservations.push({ providerId: "etherscan-v2", cost: 2 });
    reservations.push(
      { providerId: "dexscreener-api", cost: 1 },
      { providerId: "goplus-token-security", cost: 1 },
      { providerId: "honeypot-is", cost: 1 },
      { providerId: "sourcify-v2", cost: 1 },
    );
  }
  if (projectName || contractAddress) reservations.push({ providerId: "coingecko-search", cost: 1 });
  await reservePass4824AuditProviderBudgets(reservations);

  const [explorer, dex, goplus, honeypot, coingecko, sourcify] = await Promise.all([
    explorerLane(contractAddress, chainId, locale),
    dexScreenerLane(contractAddress, chainId, locale),
    goPlusLane(contractAddress, chainId),
    honeypotLane(contractAddress, chainId),
    coinGeckoLane(projectName, contractAddress),
    sourcifyLane(contractAddress, chainId, locale),
  ]);

  const lanes = [explorer, dex, goplus, honeypot, coingecko, sourcify, docsLane(input, locale), advancedLane(locale)];
  const confirmed = lanes.filter((item) => item.state === "confirmed").length;
  const partial = lanes.filter((item) => item.state === "partial").length;
  const missing = lanes.filter((item) => item.state === "missing" || item.state === "not_run").length;
  const blocked = lanes.filter((item) => item.state === "blocked").length;
  const timedOut = lanes.filter((item) => item.state === "timeout").length;
  const errors = lanes.filter((item) => item.state === "error").length;
  const evidenceDimensions = buildAuditProviderEvidenceDimensions(lanes);
  const strictConfirmed = evidenceDimensions.strictReceiptCount;
  const independentUpstreamRoots = evidenceDimensions.independentUpstreamRoots;
  const live = evidenceDimensions.successfulLiveLaneCount;

  return {
    passId: PASS2572_AUDIT_PROVIDER_RUNTIME_CLIENT_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target,
    rule: t(
      locale,
      "PASS2572 odpala kontrolowane źródła z timeoutem i pokazuje missing-evidence zamiast zgadywania.",
      "PASS2572 startet kontrollierte Quellen mit Timeout und zeigt Missing-Evidence statt Raten.",
      "PASS2572 runs controlled providers with timeouts and shows missing-evidence instead of guessing.",
    ),
    runtimeMode: "server-only no-store fetch fan-out; no seed phrase; no exploit instructions; no active testing without consent",
    lanes,
    summary: {
      confirmed: strictConfirmed,
      confirmedResponses: confirmed,
      partial,
      missing,
      blocked,
      timedOut,
      errors,
      evidenceDimensionVersion: PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID,
      successfulLiveProviderExecutions: evidenceDimensions.successfulLiveLaneCount,
      successfulLiveProviderIds: evidenceDimensions.successfulLiveProviderIds,
      duplicateStrictLanesRejected: evidenceDimensions.duplicateStrictLanesRejected,
      duplicateLiveLanesRejected: evidenceDimensions.duplicateLiveLanesRejected,
      independentUpstreamRoots,
      strictUpstreamQuorumMet: independentUpstreamRoots.length >= 2,
      liveProviderCoverage: `${strictConfirmed} strict exact-identity contributors; ${evidenceDimensions.successfulLiveLaneCount}/${lanes.length} successful direct-provider contributors; ${independentUpstreamRoots.length} independent strict upstream roots`,
      confidenceHint: live >= 4
        ? t(locale, "mocniejsze pokrycie źródeł", "staerkere Quellenabdeckung", "stronger source coverage")
        : live >= 2
          ? t(locale, "średnie pokrycie źródeł", "mittlere Quellenabdeckung", "medium source coverage")
          : t(locale, "ograniczone pokrycie źródeł", "begrenzte Quellenabdeckung", "limited source coverage"),
    },
    basicRows: lanes
      .filter((item) => item.tier.includes("basic"))
      .slice(0, 8)
      .map((item) => ({ label: item.label, status: item.state, output: outputForLane(item, "basic") })),
    proRows: lanes
      .filter((item) => item.tier.includes("pro"))
      .slice(0, 10)
      .map((item) => ({ label: item.label, status: item.state, output: outputForLane(item, "pro") })),
    advancedRows: lanes
      .filter((item) => item.tier.includes("advanced"))
      .slice(0, 10)
      .map((item) => ({ label: item.label, status: item.state, output: outputForLane(item, "advanced") })),
    nextQueue: [
      "Bind current field-level provider rights/currentness before any customer or commercial promotion.",
      "Persist and observe the upstream-lineage and content receipts on staging before commercial promotion.",
      "Expand contract-bytecode and proxy implementation binding beyond explorer metadata.",
      "Add dedicated holder cluster and lock provider receipts instead of text-derived placeholders.",
      "Run the declared 50-contract paid-tier cohort with false-positive, false-negative and missing-data review.",
    ],
  };
}

function pass4824ProviderReportCacheKey(input: RuntimeInput) {
  return sha256Digest(canonicalJson({
    locale: input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en",
    chain: clean(input.chain, 40) ?? "ethereum",
    contractAddress: clean(input.contractAddress, 96)?.toLowerCase() ?? null,
    projectName: clean(input.projectName, 90)?.toLowerCase() ?? null,
    auditUrl: clean(input.auditUrl, 260) ?? null,
    docsUrl: clean(input.docsUrl, 260) ?? null,
    githubUrl: clean(input.githubUrl, 260) ?? null,
    website: clean(input.website, 260) ?? null,
    reviewLevel: input.reviewLevel ?? null,
    etherscanApiConfigured: Boolean(env(["ETHERSCAN_API_KEY"])),
  }));
}

function prunePass4824ProviderReportCache(now: number) {
  for (const [key, entry] of pass4824ProviderReportCache) {
    if (entry.expiresAt <= now) pass4824ProviderReportCache.delete(key);
  }
  while (pass4824ProviderReportCache.size > PASS4824_PROVIDER_REPORT_CACHE_MAX_ENTRIES) {
    const oldest = pass4824ProviderReportCache.keys().next().value as string | undefined;
    if (!oldest) break;
    pass4824ProviderReportCache.delete(oldest);
  }
}

export function readPass2572AuditProviderPrivateStaticEvidence(
  report: Pass2572AuditProviderRuntimeReport | null | undefined,
): Pass2572ProviderPrivateStaticEvidence | null {
  if (!report) return null;
  prunePass2572PrivateStaticEvidence();
  const lane = report.lanes.find((item) => item.id === "runtime-explorer-source");
  if (
    !lane?.receipt?.bodyDigest ||
    lane.state !== "confirmed" ||
    lane.identity?.verification !== "exact_response" ||
    lane.identity.matched !== true ||
    !report.target.contractAddress ||
    lane.identity.requestedAddress?.toLowerCase() !== report.target.contractAddress.toLowerCase() ||
    lane.identity.resolvedAddress?.toLowerCase() !== report.target.contractAddress.toLowerCase() ||
    lane.identity.requestedChainId !== report.target.chainId ||
    lane.identity.resolvedChainId !== report.target.chainId
  ) return null;
  const entry = pass2572PrivateStaticEvidenceByReceipt.get(lane.receipt.bodyDigest);
  if (!entry || entry.expiresAt <= Date.now()) {
    pass2572PrivateStaticEvidenceByReceipt.delete(lane.receipt.bodyDigest);
    return null;
  }
  const evidence = entry.value;
  if (
    evidence.contractAddress.toLowerCase() !== report.target.contractAddress.toLowerCase() ||
    evidence.chainId !== report.target.chainId ||
    !/^[a-f0-9]{64}$/i.test(evidence.responseDigest)
  ) return null;
  return structuredClone(evidence);
}

export function resetPass4824AuditProviderRuntimeCacheForTests() {
  pass4824ProviderReportCache.clear();
  pass4824ProviderReportInFlight.clear();
  pass2572PrivateStaticEvidenceByReceipt.clear();
}

export async function buildPass2572AuditProviderRuntimeReport(input: RuntimeInput): Promise<Pass2572AuditProviderRuntimeReport> {
  const key = pass4824ProviderReportCacheKey(input);
  const now = Date.now();
  const cached = pass4824ProviderReportCache.get(key);
  if (cached && cached.expiresAt > now) return structuredClone(cached.value);
  const existing = pass4824ProviderReportInFlight.get(key);
  if (existing) return structuredClone(await existing);

  prunePass4824ProviderReportCache(now);
  const operation = buildUncachedPass2572AuditProviderRuntimeReport(input);
  pass4824ProviderReportInFlight.set(key, operation);
  try {
    const value = await operation;
    pass4824ProviderReportCache.set(key, {
      expiresAt: Date.now() + PASS4824_PROVIDER_REPORT_CACHE_TTL_MS,
      value: structuredClone(value),
    });
    prunePass4824ProviderReportCache(Date.now());
    return structuredClone(value);
  } finally {
    if (pass4824ProviderReportInFlight.get(key) === operation) {
      pass4824ProviderReportInFlight.delete(key);
    }
  }
}
