import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

import {
  AUDIT_CURRENT_DEPLOYMENT_FUTURE_SKEW_MS,
  AUDIT_CURRENT_DEPLOYMENT_MAX_AGE_MS,
  currentDeploymentTimestampBlocker,
} from "./audit-current-deployment-freshness-policy";
import { canonicalJson } from "./canonical-json";
import { sha256Digest } from "./cryptographic-digest";
import {
  extractP79Eip1167Implementation,
  findP79HistoricalDeploymentGroundTruthRecord,
  verifyP79HistoricalDeploymentGroundTruthRecord,
} from "./audit-historical-deployment-ground-truth";

export const P82_CURRENT_DEPLOYMENT_READONLY_QUORUM_ID = "p82-current-deployment-readonly-quorum.v2" as const;
export const P82_IS_TRUSTED_FORWARDER_SELECTOR = "0x572b6c05" as const;

export const P82_READONLY_RPC_METHODS = [
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_call",
] as const;

export type P82ReadonlyRpcMethod = typeof P82_READONLY_RPC_METHODS[number];
export type P82ExecutionClass = "LOCAL_DETERMINISTIC_FIXTURE" | "PUBLIC_READONLY_CURRENT";
export type P82TransportClass = "DEFAULT_NETWORK_STACK" | "INJECTED_TEST_TRANSPORT";
export type P82RightsStatus =
  | "LOCAL_FIXTURE_ONLY"
  | "PUBLIC_DOMAIN"
  | "OPEN_COMMERCIAL_ALLOWED"
  | "PUBLIC_REUSE_ALLOWED"
  | "DERIVED_USE_ONLY_ALLOWED"
  | "ALLOWED_WITH_ATTRIBUTION"
  | "AMBIGUOUS_BLOCKED"
  | "EXPIRED_REVERIFY_REQUIRED";

export type P82CurrentDeploymentProviderConfig = {
  providerId: string;
  operatorId: string;
  providerFamily: string;
  correlationGroup: string;
  rpcUrl: string;
  rights: {
    status: P82RightsStatus;
    evidenceSha256: string;
    termsCheckedAt: string;
    reverifyBy: string;
    derivedUseAllowed: boolean;
    displayAllowed: boolean;
    attributionRequired: boolean;
  };
};

export type P82CurrentDeploymentReadonlyQuorumInput = {
  schemaVersion: "velmere.p82.current-deployment-readonly-quorum-input.v2";
  executionClass: P82ExecutionClass;
  caseRef: string;
  chainId: "56";
  chainName: "BSC";
  targetAddress: string;
  trustedForwarderAddress: string;
  negativeControlAddress: string;
  historicalBinding: {
    recordId: string;
    runtimeBytecodeSha256: string;
    implementationAddress: string;
  };
  confirmationDepth: number;
  maxHeadSkew: number;
  minimumProviderCount: number;
  providers: P82CurrentDeploymentProviderConfig[];
};

export type P82CurrentDeploymentReadonlyQuorumReceipt = {
  schemaVersion: "velmere.p82.current-deployment-readonly-quorum-receipt.v2";
  engineId: typeof P82_CURRENT_DEPLOYMENT_READONLY_QUORUM_ID;
  generatedAt: string;
  executionClass: P82ExecutionClass;
  transportClass: P82TransportClass;
  caseRef: string;
  target: {
    chainId: "56";
    chainName: "BSC";
    address: string;
    trustedForwarderAddress: string;
    negativeControlAddress: string;
    historicalRecordId: string;
  };
  policy: {
    confirmationDepth: number;
    maxHeadSkew: number;
    minimumProviderCount: number;
    configuredProviderCount: number;
    allowedMethods: P82ReadonlyRpcMethod[];
    transactionMethodsUsed: false;
    arbitraryRpcMethodAccepted: false;
    customerSuppliedEndpointAccepted: false;
    exactBlockRequired: true;
    providerConflictFailsClosed: true;
    semanticOutlierDiscardAllowed: false;
  };
  providerDiversity: {
    providerIdCount: number;
    operatorCount: number;
    familyCount: number;
    correlationGroupCount: number;
    endpointIdentityCount: number;
    publicHostnameCount: number;
    independenceBoundary: "DECLARED_CONFIGURATION_DIVERSITY_NOT_NETWORK_INDEPENDENCE_PROOF";
  };
  providers: Array<{
    providerId: string;
    operatorId: string;
    providerFamily: string;
    correlationGroup: string;
    endpointClass: "LOOPBACK_FIXTURE" | "PUBLIC_HTTPS";
    endpointIdentitySha256: string;
    hostnameIdentitySha256: string | null;
    resolvedAddressSetSha256: string | null;
    transportBinding: "INJECTED_TEST_TRANSPORT" | "PINNED_PUBLIC_ADDRESS" | "NOT_ESTABLISHED";
    connectedAddressSha256: string | null;
    rightsStatus: P82RightsStatus;
    rightsEvidenceSha256: string;
    rightsCurrent: boolean;
    technicalStatus: "PASS" | "FAILED";
    observedHeadBlock: number | null;
    snapshotObservationSha256: string | null;
    rawResponseRootSha256: string | null;
    methodCount: number;
    blockerCodes: string[];
  }>;
  snapshot: {
    headMin: number | null;
    headMax: number | null;
    headSkew: number | null;
    blockNumber: number | null;
    blockHash: string | null;
    parentHash: string | null;
    stateRoot: string | null;
    timestamp: number | null;
    timestampIso: string | null;
  };
  deployment: {
    runtimeBytecodeSha256: string | null;
    runtimeByteLength: number | null;
    proxyKind: "EIP_1167_COMPATIBLE_MINIMAL_PROXY" | "UNRESOLVED";
    implementationAddress: string | null;
    implementationBytecodeSha256: string | null;
    implementationByteLength: number | null;
    historicalRuntimeRelation: "MATCHES_PINNED_HISTORICAL_RUNTIME" | "DIFFERS_FROM_PINNED_HISTORICAL_RUNTIME" | "WITHHELD";
    historicalImplementationRelation: "MATCHES_PINNED_HISTORICAL_IMPLEMENTATION" | "DIFFERS_FROM_PINNED_HISTORICAL_IMPLEMENTATION" | "WITHHELD";
  };
  trustedForwarder: {
    selector: typeof P82_IS_TRUSTED_FORWARDER_SELECTOR;
    address: string;
    state: "ACTIVE" | "INACTIVE" | "WITHHELD";
    callResultSha256: string | null;
    negativeControlAddress: string;
    negativeControlState: "INACTIVE" | "UNEXPECTED_ACTIVE" | "WITHHELD";
    negativeControlCallResultSha256: string | null;
  };
  rpc: {
    methods: P82ReadonlyRpcMethod[];
    methodCount: number;
    rawResponseRootSha256: string | null;
    requestRootSha256: string | null;
  };
  rights: {
    allConfiguredProvidersCurrent: boolean;
    allConfiguredProvidersDerivedUseAllowed: boolean;
    allConfiguredProvidersDisplayAllowed: boolean;
    customerFactRightsEligible: boolean;
    rawProviderPayloadRedistributed: false;
    rawRuntimeBytecodeRedistributed: false;
    rawImplementationBytecodeRedistributed: false;
  };
  proof: {
    exactBlockConsensusProven: boolean;
    currentRuntimeStateProven: boolean;
    currentProxyImplementationProven: boolean;
    currentTrustedForwarderStateProven: boolean;
    currentExploitabilityProven: false;
    independentReplayProven: false;
  };
  classification:
    | "PASS_EXACT_BLOCK_RUNTIME_PROXY_FORWARDER_QUORUM"
    | "PASS_EXACT_BLOCK_RUNTIME_PROXY_QUORUM_FORWARDER_WITHHELD"
    | "PASS_EXACT_BLOCK_RUNTIME_QUORUM_PROXY_WITHHELD"
    | "WITHHELD_CONFIGURATION"
    | "WITHHELD_PROVIDER_QUORUM"
    | "WITHHELD_PROVIDER_CONFLICT"
    | "WITHHELD_TARGET_IDENTITY";
  customerCurrentRuntimeFactEligible: boolean;
  customerTrustedForwarderFactEligible: boolean;
  riskScoreFloor: null;
  customerFinalEligible: false;
  auditFinalPdfEligible: false;
  promotionAllowed: false;
  blockers: string[];
  truthBoundary: string;
  receiptDigest: string;
  signature: {
    keyId: string;
    hmacSha256: string;
  };
};

export type P82ReceiptSigning = { keyId: string; secret: string };
export type P82HostResolution = { address: string; family: number };
export type P82CurrentDeploymentQuorumOptions = {
  fetchImpl?: typeof fetch;
  resolveHostImpl?: (hostname: string) => Promise<P82HostResolution[]>;
  timeoutMs?: number;
  maxResponseBytes?: number;
  now?: () => Date;
  signing: P82ReceiptSigning;
};

const ADDRESS = /^0x[a-f0-9]{40}$/;
const HASH32 = /^0x[a-f0-9]{64}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const HEX_QUANTITY = /^0x(?:0|[1-9a-f][0-9a-f]*)$/;
const HEX_BYTES = /^0x(?:[a-f0-9]{2})*$/;
const SAFE_ID = /^[a-z0-9][a-z0-9_.-]{1,79}$/;
const CASE_REF = /^AUD-[A-Z0-9-]{8,80}$/;
const SIGNING_KEY_ID = /^[a-z0-9][a-z0-9_.-]{2,80}$/i;
const MAX_PROVIDER_COUNT = 7;
const MIN_PROVIDER_COUNT = 3;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_CODE_BYTES = 64 * 1024;
const FORBIDDEN_RPC_PREFIXES = ["eth_send", "personal_", "admin_", "debug_", "trace_", "txpool_"];
const RIGHTS_ELIGIBLE = new Set<P82RightsStatus>([
  "PUBLIC_DOMAIN",
  "OPEN_COMMERCIAL_ALLOWED",
  "PUBLIC_REUSE_ALLOWED",
  "DERIVED_USE_ONLY_ALLOWED",
  "ALLOWED_WITH_ATTRIBUTION",
]);

function sha256Bytes(value: Uint8Array | string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function normalizeDigest(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  return SHA256.test(text) ? text : null;
}

function normalizeAddress(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  return ADDRESS.test(text) ? text : null;
}

function normalizeHash32(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  return HASH32.test(text) ? text : null;
}

function normalizeQuantity(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  return HEX_QUANTITY.test(text) ? text : null;
}

function quantityToSafeNumber(value: unknown): number | null {
  const normalized = normalizeQuantity(value);
  if (!normalized) return null;
  try {
    const parsed = BigInt(normalized);
    if (parsed < 0n || parsed > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(parsed);
  } catch {
    return null;
  }
}

function numberToQuantity(value: number): `0x${string}` {
  return `0x${Math.max(0, Math.trunc(value)).toString(16)}`;
}

function normalizeCode(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (!HEX_BYTES.test(text) || text === "0x") return null;
  const byteLength = (text.length - 2) / 2;
  return byteLength > 0 && byteLength <= MAX_CODE_BYTES ? text : null;
}

function codeByteLength(value: string | null): number | null {
  return value ? (value.length - 2) / 2 : null;
}

function normalizeDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function isPrivateOrReservedIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 192 && b === 88 && parts[2] === 99)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && parts[2] === 100)
    || (a === 203 && b === 0 && parts[2] === 113)
    || a >= 224;
}

function mappedIpv6ToIpv4(address: string): string | null {
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if (dotted) return dotted[1];
  const hex = /^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/.exec(address);
  if (!hex) return null;
  const value = (Number.parseInt(hex[1], 16) << 16) | Number.parseInt(hex[2], 16);
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 0xff).join(".");
}

function normalizeConnectedAddress(value: unknown): string | null {
  const raw = String(value ?? "").trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const family = isIP(raw);
  if (family === 4) return raw;
  if (family !== 6) return null;
  try {
    return new URL(`http://[${raw}]/`).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return null;
  }
}

function isPrivateOrReservedIpv6(address: string): boolean {
  const normalized = normalizeConnectedAddress(address) ?? "";
  const mappedIpv4 = mappedIpv6ToIpv4(normalized);
  if (mappedIpv4) return isPrivateOrReservedIpv4(mappedIpv4);
  return normalized === "::"
    || normalized === "::1"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || /^fe[89ab]/.test(normalized)
    || normalized.startsWith("ff")
    || normalized.startsWith("100:")
    || normalized.startsWith("2001:0:")
    || normalized.startsWith("2001:2:")
    || normalized.startsWith("2001:db8:")
    || normalized.startsWith("2002:")
    || normalized.startsWith("64:ff9b:");
}

function isPublicIp(address: string): boolean {
  const normalized = normalizeConnectedAddress(address);
  if (!normalized) return false;
  const family = isIP(normalized);
  if (family === 4) return !isPrivateOrReservedIpv4(normalized);
  if (family === 6) return !isPrivateOrReservedIpv6(normalized);
  return false;
}

async function defaultResolveHost(hostname: string): Promise<P82HostResolution[]> {
  const rows = await dnsLookup(hostname, { all: true, verbatim: true });
  return rows.map((row) => ({ address: row.address, family: row.family }));
}

function encodeAddressCall(selector: string, address: string): string {
  return `${selector}${address.slice(2).padStart(64, "0")}`;
}

function parseCanonicalBool(value: unknown): boolean | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(text)) return null;
  if (text === `0x${"0".repeat(64)}`) return false;
  if (text === `0x${"0".repeat(63)}1`) return true;
  return null;
}

function validSigning(signing: P82ReceiptSigning): boolean {
  return SIGNING_KEY_ID.test(String(signing?.keyId ?? "")) && String(signing?.secret ?? "").length >= 32;
}

function hmacDigest(secret: string, receiptDigest: string): string {
  return `hmac-sha256:${createHmac("sha256", secret).update(receiptDigest).digest("hex")}`;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isRightsCurrent(provider: P82CurrentDeploymentProviderConfig, now: Date): boolean {
  const checked = normalizeDate(provider.rights.termsCheckedAt);
  const reverify = normalizeDate(provider.rights.reverifyBy);
  if (!checked || !reverify) return false;
  return Date.parse(checked) <= now.getTime() && Date.parse(reverify) >= now.getTime();
}

function endpointIdentity(parsed: URL): string {
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  return `${parsed.protocol}//${parsed.hostname.toLowerCase()}:${port}${parsed.pathname}`;
}

type PreparedProvider = {
  config: P82CurrentDeploymentProviderConfig;
  parsed: URL;
  endpointClass: "LOOPBACK_FIXTURE" | "PUBLIC_HTTPS";
  endpointIdentitySha256: string;
  hostnameIdentitySha256: string | null;
  resolvedAddresses: string[];
  resolvedAddressSetSha256: string | null;
  rightsCurrent: boolean;
};

async function prepareProviders(
  input: P82CurrentDeploymentReadonlyQuorumInput,
  resolveHost: (hostname: string) => Promise<P82HostResolution[]>,
  now: Date,
): Promise<{ prepared: PreparedProvider[]; blockers: string[] }> {
  const blockers: string[] = [];
  const prepared: PreparedProvider[] = [];
  for (const provider of input.providers) {
    let parsed: URL;
    try {
      parsed = new URL(provider.rpcUrl);
    } catch {
      blockers.push(`p82_provider_url_invalid:${provider.providerId}`);
      continue;
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      blockers.push(`p82_provider_url_secret_or_query_forbidden:${provider.providerId}`);
      continue;
    }
    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    if (parsed.pathname.length > 160
      || pathSegments.some((part) => part.length > 96)
      || pathSegments.some((part) => /^(?:[a-f0-9]{32,}|[a-z0-9_-]{48,})$/i.test(part))) {
      blockers.push(`p82_provider_url_path_unbounded_or_token_like:${provider.providerId}`);
      continue;
    }
    const loopback = isLoopbackHost(parsed.hostname);
    let endpointClass: PreparedProvider["endpointClass"];
    let resolvedAddresses: string[] = [];
    let resolvedAddressSetSha256: string | null = null;
    if (input.executionClass === "LOCAL_DETERMINISTIC_FIXTURE") {
      if (!loopback || !["http:", "https:"].includes(parsed.protocol)) {
        blockers.push(`p82_fixture_endpoint_must_be_loopback:${provider.providerId}`);
        continue;
      }
      endpointClass = "LOOPBACK_FIXTURE";
    } else {
      if (parsed.protocol !== "https:" || loopback) {
        blockers.push(`p82_current_endpoint_requires_public_https:${provider.providerId}`);
        continue;
      }
      if ((parsed.port && parsed.port !== "443") || isIP(parsed.hostname) !== 0) {
        blockers.push(`p82_current_endpoint_requires_dns_hostname_https_443:${provider.providerId}`);
        continue;
      }
      let resolutions: P82HostResolution[];
      try {
        resolutions = await resolveHost(parsed.hostname);
      } catch {
        blockers.push(`p82_provider_dns_resolution_failed:${provider.providerId}`);
        continue;
      }
      const addresses = uniqueSorted(resolutions.map((row) => normalizeConnectedAddress(row.address)).filter((address): address is string => Boolean(address)));
      if (!addresses.length || addresses.some((address) => !isPublicIp(address))) {
        blockers.push(`p82_provider_dns_non_public_address:${provider.providerId}`);
        continue;
      }
      resolvedAddresses = addresses;
      resolvedAddressSetSha256 = sha256Digest(canonicalJson(addresses));
      endpointClass = "PUBLIC_HTTPS";
    }
    prepared.push({
      config: provider,
      parsed,
      endpointClass,
      endpointIdentitySha256: sha256Digest(endpointIdentity(parsed)),
      hostnameIdentitySha256: endpointClass === "PUBLIC_HTTPS" ? sha256Digest(parsed.hostname.toLowerCase()) : null,
      resolvedAddresses,
      resolvedAddressSetSha256,
      rightsCurrent: isRightsCurrent(provider, now),
    });
  }
  return { prepared, blockers: uniqueSorted(blockers) };
}

function validateInput(input: P82CurrentDeploymentReadonlyQuorumInput, signing: P82ReceiptSigning): string[] {
  const blockers: string[] = [];
  const add = (ok: unknown, code: string) => { if (!ok) blockers.push(code); };
  add(input?.schemaVersion === "velmere.p82.current-deployment-readonly-quorum-input.v2", "p82_input_schema_invalid");
  add(["LOCAL_DETERMINISTIC_FIXTURE", "PUBLIC_READONLY_CURRENT"].includes(input?.executionClass), "p82_execution_class_invalid");
  add(CASE_REF.test(String(input?.caseRef ?? "")), "p82_case_ref_invalid");
  add(input?.chainId === "56" && input?.chainName === "BSC", "p82_chain_identity_invalid");
  add(normalizeAddress(input?.targetAddress) !== null, "p82_target_address_invalid");
  add(normalizeAddress(input?.trustedForwarderAddress) !== null, "p82_trusted_forwarder_address_invalid");
  add(normalizeAddress(input?.negativeControlAddress) !== null, "p82_negative_control_address_invalid");
  const normalizedTarget = normalizeAddress(input?.targetAddress);
  const normalizedForwarder = normalizeAddress(input?.trustedForwarderAddress);
  const normalizedNegative = normalizeAddress(input?.negativeControlAddress);
  add(normalizedNegative !== normalizedForwarder, "p82_negative_control_must_differ");
  add(normalizedNegative !== normalizedTarget, "p82_negative_control_must_differ_from_target");
  add(normalizedNegative !== "0x0000000000000000000000000000000000000000", "p82_negative_control_zero_address_forbidden");
  add(SAFE_ID.test(String(input?.historicalBinding?.recordId ?? "")), "p82_historical_record_id_invalid");
  add(normalizeDigest(input?.historicalBinding?.runtimeBytecodeSha256) !== null, "p82_historical_runtime_digest_invalid");
  add(normalizeAddress(input?.historicalBinding?.implementationAddress) !== null, "p82_historical_implementation_invalid");
  const canonicalRecord = findP79HistoricalDeploymentGroundTruthRecord({ chain: input?.chainName, contractAddress: normalizedTarget });
  add(Boolean(canonicalRecord && verifyP79HistoricalDeploymentGroundTruthRecord(canonicalRecord)), "p82_canonical_historical_record_missing_or_invalid");
  if (canonicalRecord) {
    add(input?.historicalBinding?.recordId === canonicalRecord.recordId, "p82_historical_record_binding_mismatch");
    add(normalizeDigest(input?.historicalBinding?.runtimeBytecodeSha256) === canonicalRecord.deployment.runtimeBytecodeDigest, "p82_historical_runtime_binding_mismatch");
    add(normalizeAddress(input?.historicalBinding?.implementationAddress) === canonicalRecord.deployment.implementationAddress, "p82_historical_implementation_binding_mismatch");
    add(normalizedForwarder === canonicalRecord.incident.trustedForwarderAddress, "p82_historical_forwarder_binding_mismatch");
    add(normalizedNegative !== canonicalRecord.deployment.implementationAddress, "p82_negative_control_must_differ_from_implementation");
  }
  add(Number.isInteger(input?.confirmationDepth) && input.confirmationDepth >= 15 && input.confirmationDepth <= 2_048, "p82_confirmation_depth_invalid");
  add(Number.isInteger(input?.maxHeadSkew) && input.maxHeadSkew >= 0 && input.maxHeadSkew <= 32, "p82_head_skew_invalid");
  add(Number.isInteger(input?.minimumProviderCount) && input.minimumProviderCount >= MIN_PROVIDER_COUNT && input.minimumProviderCount <= MAX_PROVIDER_COUNT, "p82_minimum_provider_count_invalid");
  add(Array.isArray(input?.providers) && input.providers.length >= input.minimumProviderCount && input.providers.length <= MAX_PROVIDER_COUNT, "p82_provider_count_invalid");
  add(validSigning(signing), "p82_signing_configuration_invalid");

  const providerIds: string[] = [];
  const operators: string[] = [];
  const families: string[] = [];
  const correlations: string[] = [];
  for (const provider of Array.isArray(input?.providers) ? input.providers : []) {
    add(SAFE_ID.test(String(provider?.providerId ?? "")), "p82_provider_id_invalid");
    add(SAFE_ID.test(String(provider?.operatorId ?? "")), "p82_provider_operator_invalid");
    add(SAFE_ID.test(String(provider?.providerFamily ?? "")), "p82_provider_family_invalid");
    add(SAFE_ID.test(String(provider?.correlationGroup ?? "")), "p82_provider_correlation_invalid");
    add(typeof provider?.rpcUrl === "string" && provider.rpcUrl.length >= 8 && provider.rpcUrl.length <= 512, "p82_provider_url_length_invalid");
    add([
      "LOCAL_FIXTURE_ONLY", "PUBLIC_DOMAIN", "OPEN_COMMERCIAL_ALLOWED", "PUBLIC_REUSE_ALLOWED",
      "DERIVED_USE_ONLY_ALLOWED", "ALLOWED_WITH_ATTRIBUTION", "AMBIGUOUS_BLOCKED", "EXPIRED_REVERIFY_REQUIRED",
    ].includes(provider?.rights?.status), "p82_provider_rights_status_invalid");
    add(normalizeDigest(provider?.rights?.evidenceSha256) !== null, "p82_provider_rights_digest_invalid");
    add(normalizeDate(provider?.rights?.termsCheckedAt) !== null, "p82_provider_terms_checked_invalid");
    add(normalizeDate(provider?.rights?.reverifyBy) !== null, "p82_provider_reverify_invalid");
    add(typeof provider?.rights?.derivedUseAllowed === "boolean", "p82_provider_derived_rights_invalid");
    add(typeof provider?.rights?.displayAllowed === "boolean", "p82_provider_display_rights_invalid");
    add(typeof provider?.rights?.attributionRequired === "boolean", "p82_provider_attribution_invalid");
    providerIds.push(String(provider?.providerId ?? ""));
    operators.push(String(provider?.operatorId ?? ""));
    families.push(String(provider?.providerFamily ?? ""));
    correlations.push(String(provider?.correlationGroup ?? ""));
  }
  add(new Set(providerIds).size === providerIds.length, "p82_duplicate_provider_id");
  add(new Set(operators).size >= input.minimumProviderCount, "p82_insufficient_operator_diversity");
  add(new Set(families).size >= input.minimumProviderCount, "p82_insufficient_provider_family_diversity");
  add(new Set(correlations).size >= input.minimumProviderCount, "p82_insufficient_correlation_group_diversity");
  return uniqueSorted(blockers);
}

type RpcDigest = { method: P82ReadonlyRpcMethod; requestSha256: string; responseSha256: string };
type ProviderInternalObservation = {
  prepared: PreparedProvider;
  methodDigests: RpcDigest[];
  blockers: string[];
  semanticConflict: boolean;
  headBlock: number | null;
  block: { number: number; hash: string; parentHash: string; stateRoot: string; timestamp: number } | null;
  runtimeCode: string | null;
  implementationAddress: string | null;
  implementationCode: string | null;
  trustedForwarderValue: boolean | null;
  trustedForwarderResultDigest: string | null;
  negativeControlValue: boolean | null;
  negativeControlResultDigest: string | null;
  transportBinding: "INJECTED_TEST_TRANSPORT" | "PINNED_PUBLIC_ADDRESS" | "NOT_ESTABLISHED";
  connectedAddressSha256: string | null;
};

function makeObservation(prepared: PreparedProvider): ProviderInternalObservation {
  return {
    prepared,
    methodDigests: [],
    blockers: [],
    semanticConflict: false,
    headBlock: null,
    block: null,
    runtimeCode: null,
    implementationAddress: null,
    implementationCode: null,
    trustedForwarderValue: null,
    trustedForwarderResultDigest: null,
    negativeControlValue: null,
    negativeControlResultDigest: null,
    transportBinding: "NOT_ESTABLISHED",
    connectedAddressSha256: null,
  };
}

type RpcHttpResult = {
  statusCode: number;
  contentType: string;
  contentEncoding: string;
  declaredLength: number | null;
  buffer: Uint8Array;
  transportBinding: "INJECTED_TEST_TRANSPORT" | "PINNED_PUBLIC_ADDRESS";
  connectedAddressSha256: string | null;
};

function combineChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function pinnedHttpsPost(args: {
  prepared: PreparedProvider;
  requestBody: string;
  timeoutMs: number;
  maxResponseBytes: number;
}): Promise<RpcHttpResult> {
  const allowedAddresses = uniqueSorted(args.prepared.resolvedAddresses.map(normalizeConnectedAddress).filter((value): value is string => Boolean(value)));
  const pinnedAddress = allowedAddresses[0];
  if (!pinnedAddress || !isPublicIp(pinnedAddress)) throw new Error("rpc_pinned_address_missing");
  return await new Promise<RpcHttpResult>((resolve, reject) => {
    let settled = false;
    let connectedAddressSha256: string | null = null;
    const finishReject = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const request = httpsRequest(args.prepared.parsed, {
      method: "POST",
      agent: false,
      servername: args.prepared.parsed.hostname,
      headers: {
        accept: "application/json",
        "accept-encoding": "identity",
        "content-type": "application/json",
        "content-length": String(new TextEncoder().encode(args.requestBody).byteLength),
        "x-velmere-purpose": "defensive-read-only-current-deployment-validation",
      },
      lookup: (_hostname, _options, callback) => callback(null, pinnedAddress, isIP(pinnedAddress)),
    }, (response) => {
      const statusCode = Number(response.statusCode ?? 0);
      const contentTypeValue = response.headers["content-type"];
      const contentEncodingValue = response.headers["content-encoding"];
      const contentLengthValue = response.headers["content-length"];
      const contentType = Array.isArray(contentTypeValue) ? contentTypeValue.join(",") : String(contentTypeValue ?? "");
      const contentEncoding = Array.isArray(contentEncodingValue) ? contentEncodingValue.join(",") : String(contentEncodingValue ?? "");
      const declaredLength = contentLengthValue === undefined
        ? null
        : Number(Array.isArray(contentLengthValue) ? contentLengthValue[0] : contentLengthValue);
      if (declaredLength !== null && (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > args.maxResponseBytes)) {
        request.destroy(new Error("rpc_response_too_large"));
        return;
      }
      const chunks: Uint8Array[] = [];
      let total = 0;
      response.on("data", (chunk: Uint8Array | string) => {
        const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : new Uint8Array(chunk);
        total += bytes.byteLength;
        if (total > args.maxResponseBytes) {
          request.destroy(new Error("rpc_response_too_large"));
          return;
        }
        chunks.push(bytes);
      });
      response.on("error", (error: Error) => finishReject(error));
      response.on("end", () => {
        if (settled) return;
        if (!connectedAddressSha256) {
          finishReject(new Error("rpc_connected_address_not_prevalidated"));
          return;
        }
        settled = true;
        resolve({
          statusCode,
          contentType,
          contentEncoding,
          declaredLength,
          buffer: combineChunks(chunks, total),
          transportBinding: "PINNED_PUBLIC_ADDRESS",
          connectedAddressSha256,
        });
      });
    });
    request.on("socket", (socket) => {
      socket.once("secureConnect", () => {
        const connectedAddress = normalizeConnectedAddress(socket.remoteAddress);
        if (!connectedAddress || !allowedAddresses.includes(connectedAddress) || !isPublicIp(connectedAddress)) {
          request.destroy(new Error("rpc_connected_address_not_prevalidated"));
          return;
        }
        connectedAddressSha256 = sha256Digest(connectedAddress);
      });
    });
    request.setTimeout(args.timeoutMs, () => {
      const error = new Error("rpc_timeout");
      error.name = "AbortError";
      request.destroy(error);
    });
    request.on("error", (error: Error) => finishReject(error));
    request.end(args.requestBody);
  });
}

async function rpcHttpPost(args: {
  observation: ProviderInternalObservation;
  requestBody: string;
  fetchImpl?: typeof fetch;
  timeoutMs: number;
  maxResponseBytes: number;
}): Promise<RpcHttpResult> {
  if (!args.fetchImpl) {
    return pinnedHttpsPost({
      prepared: args.observation.prepared,
      requestBody: args.requestBody,
      timeoutMs: args.timeoutMs,
      maxResponseBytes: args.maxResponseBytes,
    });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const response = await args.fetchImpl(args.observation.prepared.config.rpcUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "accept-encoding": "identity",
        "content-type": "application/json",
        "x-velmere-purpose": "defensive-read-only-current-deployment-validation",
      },
      body: args.requestBody,
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
    });
    const declaredLengthText = response.headers.get("content-length");
    const declaredLength = declaredLengthText === null ? null : Number(declaredLengthText);
    if (declaredLength !== null && (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > args.maxResponseBytes)) {
      throw new Error("rpc_response_too_large");
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > args.maxResponseBytes) throw new Error("rpc_response_too_large");
    return {
      statusCode: response.status,
      contentType: String(response.headers.get("content-type") ?? ""),
      contentEncoding: String(response.headers.get("content-encoding") ?? ""),
      declaredLength,
      buffer,
      transportBinding: "INJECTED_TEST_TRANSPORT",
      connectedAddressSha256: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function rpcCall(args: {
  observation: ProviderInternalObservation;
  method: P82ReadonlyRpcMethod;
  params: unknown[];
  fetchImpl?: typeof fetch;
  timeoutMs: number;
  maxResponseBytes: number;
}): Promise<unknown> {
  if (!P82_READONLY_RPC_METHODS.includes(args.method)) throw new Error("rpc_method_not_allowlisted");
  if (FORBIDDEN_RPC_PREFIXES.some((prefix) => args.method.startsWith(prefix))) throw new Error("rpc_transaction_or_privileged_method_forbidden");
  const id = `p82-${args.observation.prepared.config.providerId}-${args.observation.methodDigests.length + 1}`;
  const requestBody = canonicalJson({ jsonrpc: "2.0", id, method: args.method, params: args.params });
  const response = await rpcHttpPost({
    observation: args.observation,
    requestBody,
    fetchImpl: args.fetchImpl,
    timeoutMs: args.timeoutMs,
    maxResponseBytes: args.maxResponseBytes,
  });
  if (response.statusCode < 200 || response.statusCode > 299) throw new Error("rpc_http_failure");
  if (response.contentEncoding && response.contentEncoding.toLowerCase() !== "identity") throw new Error("rpc_content_encoding_invalid");
  const contentType = response.contentType.toLowerCase();
  if (contentType && !contentType.includes("json")) throw new Error("rpc_content_type_invalid");
  args.observation.transportBinding = response.transportBinding;
  args.observation.connectedAddressSha256 = response.connectedAddressSha256;
  const text = new TextDecoder().decode(response.buffer);
  const responseSha256 = sha256Bytes(response.buffer);
  args.observation.methodDigests.push({
    method: args.method,
    requestSha256: sha256Bytes(requestBody),
    responseSha256,
  });
  let body: { jsonrpc?: unknown; id?: unknown; result?: unknown; error?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    throw new Error("rpc_json_invalid");
  }
  if (!body || body.jsonrpc !== "2.0" || body.id !== id || Object.prototype.hasOwnProperty.call(body, "error")) {
    throw new Error("rpc_envelope_invalid");
  }
  return body.result;
}

function consensus<T>(values: T[], serialize: (value: T) => string = (value) => canonicalJson(value)): { value: T | null; conflict: boolean } {
  if (!values.length) return { value: null, conflict: false };
  const first = serialize(values[0]);
  return values.every((value) => serialize(value) === first)
    ? { value: values[0], conflict: false }
    : { value: null, conflict: true };
}

function successfulStageDiversityBlockers(
  observations: ProviderInternalObservation[],
  minimumProviderCount: number,
  stage: "head" | "snapshot" | "implementation" | "proxy_forwarder",
  requirePublicHostnameDiversity: boolean,
): string[] {
  const blockers: string[] = [];
  const configs = observations.map((row) => row.prepared);
  const requireCount = (count: number, dimension: string) => {
    if (count < minimumProviderCount) blockers.push(`p82_${stage}_successful_${dimension}_diversity_insufficient`);
  };
  requireCount(configs.length, "provider");
  requireCount(new Set(configs.map((row) => row.config.providerId)).size, "provider_id");
  requireCount(new Set(configs.map((row) => row.config.operatorId)).size, "operator");
  requireCount(new Set(configs.map((row) => row.config.providerFamily)).size, "provider_family");
  requireCount(new Set(configs.map((row) => row.config.correlationGroup)).size, "correlation_group");
  requireCount(new Set(configs.map((row) => row.endpointIdentitySha256)).size, "endpoint_identity");
  if (requirePublicHostnameDiversity) {
    requireCount(new Set(configs.map((row) => row.hostnameIdentitySha256).filter(Boolean)).size, "public_hostname");
  }
  return uniqueSorted(blockers);
}

function providerRawRoot(observation: ProviderInternalObservation): string | null {
  return observation.methodDigests.length
    ? sha256Digest(canonicalJson(observation.methodDigests.map((row) => row.responseSha256)))
    : null;
}

function providerRequestRoot(observation: ProviderInternalObservation): string | null {
  return observation.methodDigests.length
    ? sha256Digest(canonicalJson(observation.methodDigests.map((row) => row.requestSha256)))
    : null;
}

function providerSnapshotDigest(observation: ProviderInternalObservation): string | null {
  if (!observation.block || !observation.runtimeCode) return null;
  return sha256Digest(canonicalJson({
    block: observation.block,
    runtimeBytecodeSha256: sha256Bytes(observation.runtimeCode),
    implementationAddress: observation.implementationAddress,
    implementationBytecodeSha256: observation.implementationCode ? sha256Bytes(observation.implementationCode) : null,
    trustedForwarderValue: observation.trustedForwarderValue,
    trustedForwarderResultSha256: observation.trustedForwarderResultDigest,
    negativeControlValue: observation.negativeControlValue,
    negativeControlResultSha256: observation.negativeControlResultDigest,
    transportBinding: observation.transportBinding,
    connectedAddressSha256: observation.connectedAddressSha256,
  }));
}

function emptyReceiptBase(args: {
  input: P82CurrentDeploymentReadonlyQuorumInput;
  now: Date;
  transportClass: P82TransportClass;
  prepared: PreparedProvider[];
  blockers: string[];
}): Omit<P82CurrentDeploymentReadonlyQuorumReceipt, "receiptDigest" | "signature"> {
  const providers = Array.isArray(args.input.providers) ? args.input.providers : [];
  const safeTargetAddress = normalizeAddress(args.input.targetAddress) ?? "0x0000000000000000000000000000000000000000";
  const safeForwarderAddress = normalizeAddress(args.input.trustedForwarderAddress) ?? "0x0000000000000000000000000000000000000000";
  const safeNegativeAddress = normalizeAddress(args.input.negativeControlAddress) ?? "0x0000000000000000000000000000000000000001";
  const endpointIdentities = args.prepared.map((row) => row.endpointIdentitySha256);
  const publicHosts = args.prepared.filter((row) => row.endpointClass === "PUBLIC_HTTPS").map((row) => row.parsed.hostname.toLowerCase());
  const rightsCurrent = providers.length > 0 && providers.every((provider) => isRightsCurrent(provider, args.now));
  const derivedAllowed = providers.length > 0 && providers.every((provider) => provider.rights.derivedUseAllowed && RIGHTS_ELIGIBLE.has(provider.rights.status));
  const displayAllowed = providers.length > 0 && providers.every((provider) => provider.rights.displayAllowed && RIGHTS_ELIGIBLE.has(provider.rights.status));
  return {
    schemaVersion: "velmere.p82.current-deployment-readonly-quorum-receipt.v2",
    engineId: P82_CURRENT_DEPLOYMENT_READONLY_QUORUM_ID,
    generatedAt: args.now.toISOString(),
    executionClass: args.input.executionClass,
    transportClass: args.transportClass,
    caseRef: args.input.caseRef,
    target: {
      chainId: "56",
      chainName: "BSC",
      address: safeTargetAddress,
      trustedForwarderAddress: safeForwarderAddress,
      negativeControlAddress: safeNegativeAddress,
      historicalRecordId: SAFE_ID.test(String(args.input.historicalBinding?.recordId ?? "")) ? args.input.historicalBinding.recordId : "invalid-record",
    },
    policy: {
      confirmationDepth: Number.isInteger(args.input.confirmationDepth) ? args.input.confirmationDepth : 0,
      maxHeadSkew: Number.isInteger(args.input.maxHeadSkew) ? args.input.maxHeadSkew : 0,
      minimumProviderCount: Number.isInteger(args.input.minimumProviderCount) ? args.input.minimumProviderCount : MIN_PROVIDER_COUNT,
      configuredProviderCount: providers.length,
      allowedMethods: [...P82_READONLY_RPC_METHODS],
      transactionMethodsUsed: false,
      arbitraryRpcMethodAccepted: false,
      customerSuppliedEndpointAccepted: false,
      exactBlockRequired: true,
      providerConflictFailsClosed: true,
      semanticOutlierDiscardAllowed: false,
    },
    providerDiversity: {
      providerIdCount: new Set(providers.map((row) => row.providerId)).size,
      operatorCount: new Set(providers.map((row) => row.operatorId)).size,
      familyCount: new Set(providers.map((row) => row.providerFamily)).size,
      correlationGroupCount: new Set(providers.map((row) => row.correlationGroup)).size,
      endpointIdentityCount: new Set(endpointIdentities).size,
      publicHostnameCount: new Set(publicHosts).size,
      independenceBoundary: "DECLARED_CONFIGURATION_DIVERSITY_NOT_NETWORK_INDEPENDENCE_PROOF",
    },
    providers: args.prepared.map((row) => ({
      providerId: row.config.providerId,
      operatorId: row.config.operatorId,
      providerFamily: row.config.providerFamily,
      correlationGroup: row.config.correlationGroup,
      endpointClass: row.endpointClass,
      endpointIdentitySha256: row.endpointIdentitySha256,
      hostnameIdentitySha256: row.hostnameIdentitySha256,
      resolvedAddressSetSha256: row.resolvedAddressSetSha256,
      transportBinding: "NOT_ESTABLISHED" as const,
      connectedAddressSha256: null,
      rightsStatus: row.config.rights.status,
      rightsEvidenceSha256: row.config.rights.evidenceSha256,
      rightsCurrent: row.rightsCurrent,
      technicalStatus: "FAILED" as const,
      observedHeadBlock: null,
      snapshotObservationSha256: null,
      rawResponseRootSha256: null,
      methodCount: 0,
      blockerCodes: [],
    })),
    snapshot: { headMin: null, headMax: null, headSkew: null, blockNumber: null, blockHash: null, parentHash: null, stateRoot: null, timestamp: null, timestampIso: null },
    deployment: {
      runtimeBytecodeSha256: null,
      runtimeByteLength: null,
      proxyKind: "UNRESOLVED",
      implementationAddress: null,
      implementationBytecodeSha256: null,
      implementationByteLength: null,
      historicalRuntimeRelation: "WITHHELD",
      historicalImplementationRelation: "WITHHELD",
    },
    trustedForwarder: {
      selector: P82_IS_TRUSTED_FORWARDER_SELECTOR,
      address: safeForwarderAddress,
      state: "WITHHELD",
      callResultSha256: null,
      negativeControlAddress: safeNegativeAddress,
      negativeControlState: "WITHHELD",
      negativeControlCallResultSha256: null,
    },
    rpc: { methods: [], methodCount: 0, rawResponseRootSha256: null, requestRootSha256: null },
    rights: {
      allConfiguredProvidersCurrent: rightsCurrent,
      allConfiguredProvidersDerivedUseAllowed: derivedAllowed,
      allConfiguredProvidersDisplayAllowed: displayAllowed,
      customerFactRightsEligible: rightsCurrent && derivedAllowed && displayAllowed,
      rawProviderPayloadRedistributed: false,
      rawRuntimeBytecodeRedistributed: false,
      rawImplementationBytecodeRedistributed: false,
    },
    proof: {
      exactBlockConsensusProven: false,
      currentRuntimeStateProven: false,
      currentProxyImplementationProven: false,
      currentTrustedForwarderStateProven: false,
      currentExploitabilityProven: false,
      independentReplayProven: false,
    },
    classification: "WITHHELD_CONFIGURATION",
    customerCurrentRuntimeFactEligible: false,
    customerTrustedForwarderFactEligible: false,
    riskScoreFloor: null,
    customerFinalEligible: false,
    auditFinalPdfEligible: false,
    promotionAllowed: false,
    blockers: uniqueSorted(args.blockers),
    truthBoundary: "Read-only exact-block quorum can prove current runtime/proxy/configuration facts only. It never proves exploitability, authorizes transactions, creates a risk-score floor, or grants Customer FINAL/Audit FINAL PDF.",
  };
}

function signReceipt(
  body: Omit<P82CurrentDeploymentReadonlyQuorumReceipt, "receiptDigest" | "signature">,
  signing: P82ReceiptSigning,
): P82CurrentDeploymentReadonlyQuorumReceipt {
  const receiptDigest = sha256Digest(canonicalJson(body));
  return {
    ...body,
    receiptDigest,
    signature: { keyId: signing.keyId, hmacSha256: hmacDigest(signing.secret, receiptDigest) },
  };
}

function rpcFailureCode(stage: "head" | "snapshot" | "proxy", error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") return `p82_${stage}_rpc_timeout`;
  const message = error instanceof Error ? error.message : "";
  const allowed = new Set([
    "rpc_method_not_allowlisted",
    "rpc_transaction_or_privileged_method_forbidden",
    "rpc_http_failure",
    "rpc_response_too_large",
    "rpc_content_encoding_invalid",
    "rpc_content_type_invalid",
    "rpc_pinned_address_missing",
    "rpc_connected_address_not_prevalidated",
    "rpc_json_invalid",
    "rpc_envelope_invalid",
  ]);
  return allowed.has(message) ? `p82_${stage}_${message}` : `p82_${stage}_transport_failed`;
}

export async function collectP82CurrentDeploymentReadonlyQuorum(
  input: P82CurrentDeploymentReadonlyQuorumInput,
  options: P82CurrentDeploymentQuorumOptions,
): Promise<P82CurrentDeploymentReadonlyQuorumReceipt> {
  const fetchImpl = options.fetchImpl;
  const resolveHost = options.resolveHostImpl ?? defaultResolveHost;
  const timeoutMs = Math.min(30_000, Math.max(1_000, Math.trunc(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)));
  const maxResponseBytes = Math.min(1024 * 1024, Math.max(4_096, Math.trunc(options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES)));
  const now = options.now?.() ?? new Date();
  const transportClass: P82TransportClass = options.fetchImpl || options.resolveHostImpl
    ? "INJECTED_TEST_TRANSPORT"
    : "DEFAULT_NETWORK_STACK";
  const inputBlockers = validateInput(input, options.signing);
  const preparedResult = inputBlockers.length
    ? { prepared: [] as PreparedProvider[], blockers: [] as string[] }
    : await prepareProviders(input, resolveHost, now);
  const initialBlockers = uniqueSorted([...inputBlockers, ...preparedResult.blockers]);
  let body = emptyReceiptBase({ input, now, transportClass, prepared: preparedResult.prepared, blockers: initialBlockers });
  if (initialBlockers.length) return signReceipt(body, options.signing);

  if (input.executionClass === "PUBLIC_READONLY_CURRENT") {
    const hostCount = new Set(preparedResult.prepared.map((row) => row.parsed.hostname.toLowerCase())).size;
    if (hostCount < input.minimumProviderCount) {
      body = { ...body, blockers: ["p82_insufficient_public_hostname_diversity"], classification: "WITHHELD_CONFIGURATION" };
      return signReceipt(body, options.signing);
    }
  }
  if (new Set(preparedResult.prepared.map((row) => row.endpointIdentitySha256)).size !== preparedResult.prepared.length) {
    body = { ...body, blockers: ["p82_duplicate_endpoint_identity"], classification: "WITHHELD_CONFIGURATION" };
    return signReceipt(body, options.signing);
  }

  const observations = preparedResult.prepared.map(makeObservation);
  await Promise.all(observations.map(async (observation) => {
    try {
      const chainId = quantityToSafeNumber(await rpcCall({ observation, method: "eth_chainId", params: [], fetchImpl, timeoutMs, maxResponseBytes }));
      if (chainId !== 56) {
        observation.semanticConflict = true;
        observation.blockers.push("p82_chain_id_mismatch");
        return;
      }
      const head = quantityToSafeNumber(await rpcCall({ observation, method: "eth_blockNumber", params: [], fetchImpl, timeoutMs, maxResponseBytes }));
      if (head === null || head <= input.confirmationDepth) {
        observation.semanticConflict = true;
        observation.blockers.push("p82_head_block_invalid");
        return;
      }
      observation.headBlock = head;
    } catch (error) {
      observation.blockers.push(rpcFailureCode("head", error));
    }
  }));

  const semanticHeadConflict = observations.some((row) => row.semanticConflict);
  const headSuccess = observations.filter((row) => row.headBlock !== null && !row.semanticConflict);
  if (semanticHeadConflict) {
    body = finalizeProviderRows(body, observations);
    body = { ...body, blockers: uniqueSorted([...body.blockers, "p82_semantic_head_conflict"]), classification: "WITHHELD_PROVIDER_CONFLICT" };
    return signReceipt(finalizeRpcRoots(body, observations), options.signing);
  }
  if (headSuccess.length < input.minimumProviderCount) {
    body = finalizeProviderRows(body, observations);
    body = { ...body, blockers: uniqueSorted([...body.blockers, "p82_insufficient_head_quorum"]), classification: "WITHHELD_PROVIDER_QUORUM" };
    return signReceipt(finalizeRpcRoots(body, observations), options.signing);
  }
  const headDiversityBlockers = successfulStageDiversityBlockers(
    headSuccess,
    input.minimumProviderCount,
    "head",
    input.executionClass === "PUBLIC_READONLY_CURRENT",
  );
  if (headDiversityBlockers.length) {
    body = finalizeProviderRows(body, observations);
    body = { ...body, blockers: uniqueSorted([...body.blockers, ...headDiversityBlockers]), classification: "WITHHELD_PROVIDER_QUORUM" };
    return signReceipt(finalizeRpcRoots(body, observations), options.signing);
  }
  const headNumbers = headSuccess.map((row) => row.headBlock as number);
  const headMin = Math.min(...headNumbers);
  const headMax = Math.max(...headNumbers);
  const headSkew = headMax - headMin;
  if (headSkew > input.maxHeadSkew) {
    body = finalizeProviderRows(body, observations);
    body = {
      ...body,
      snapshot: { ...body.snapshot, headMin, headMax, headSkew },
      blockers: uniqueSorted([...body.blockers, "p82_head_skew_exceeded"]),
      classification: "WITHHELD_PROVIDER_CONFLICT",
    };
    return signReceipt(finalizeRpcRoots(body, observations), options.signing);
  }
  const snapshotBlock = headMin - input.confirmationDepth;
  const snapshotTag = numberToQuantity(snapshotBlock);

  await Promise.all(headSuccess.map(async (observation) => {
    try {
      const blockResult = await rpcCall({ observation, method: "eth_getBlockByNumber", params: [snapshotTag, false], fetchImpl, timeoutMs, maxResponseBytes });
      const block = blockResult as Record<string, unknown> | null;
      const number = quantityToSafeNumber(block?.number);
      const hash = normalizeHash32(block?.hash);
      const parentHash = normalizeHash32(block?.parentHash);
      const stateRoot = normalizeHash32(block?.stateRoot);
      const timestamp = quantityToSafeNumber(block?.timestamp);
      if (number !== snapshotBlock || !hash || !parentHash || !stateRoot || timestamp === null || timestamp > 253_402_300_799) {
        observation.semanticConflict = true;
        observation.blockers.push("p82_exact_block_header_invalid");
        return;
      }
      observation.block = { number, hash, parentHash, stateRoot, timestamp };
      const runtimeCode = normalizeCode(await rpcCall({ observation, method: "eth_getCode", params: [input.targetAddress.toLowerCase(), snapshotTag], fetchImpl, timeoutMs, maxResponseBytes }));
      if (!runtimeCode) {
        observation.semanticConflict = true;
        observation.blockers.push("p82_target_runtime_missing_or_invalid");
        return;
      }
      observation.runtimeCode = runtimeCode;
    } catch (error) {
      observation.blockers.push(rpcFailureCode("snapshot", error));
    }
  }));

  const semanticSnapshotConflict = headSuccess.some((row) => row.semanticConflict);
  const snapshotSuccess = headSuccess.filter((row) => row.block && row.runtimeCode && !row.semanticConflict);
  if (semanticSnapshotConflict) {
    body = finalizeProviderRows(body, observations);
    body = { ...body, snapshot: { ...body.snapshot, headMin, headMax, headSkew, blockNumber: snapshotBlock }, blockers: uniqueSorted([...body.blockers, "p82_semantic_snapshot_conflict"]), classification: "WITHHELD_PROVIDER_CONFLICT" };
    return signReceipt(finalizeRpcRoots(body, observations), options.signing);
  }
  if (snapshotSuccess.length < input.minimumProviderCount) {
    body = finalizeProviderRows(body, observations);
    body = { ...body, snapshot: { ...body.snapshot, headMin, headMax, headSkew, blockNumber: snapshotBlock }, blockers: uniqueSorted([...body.blockers, "p82_insufficient_snapshot_quorum"]), classification: "WITHHELD_PROVIDER_QUORUM" };
    return signReceipt(finalizeRpcRoots(body, observations), options.signing);
  }
  const snapshotDiversityBlockers = successfulStageDiversityBlockers(
    snapshotSuccess,
    input.minimumProviderCount,
    "snapshot",
    input.executionClass === "PUBLIC_READONLY_CURRENT",
  );
  if (snapshotDiversityBlockers.length) {
    body = finalizeProviderRows(body, observations);
    body = {
      ...body,
      snapshot: { ...body.snapshot, headMin, headMax, headSkew, blockNumber: snapshotBlock },
      blockers: uniqueSorted([...body.blockers, ...snapshotDiversityBlockers]),
      classification: "WITHHELD_PROVIDER_QUORUM",
    };
    return signReceipt(finalizeRpcRoots(body, observations), options.signing);
  }

  const blockConsensus = consensus(snapshotSuccess.map((row) => row.block as NonNullable<ProviderInternalObservation["block"]>));
  const runtimeConsensus = consensus(snapshotSuccess.map((row) => row.runtimeCode as string));
  if (blockConsensus.conflict || runtimeConsensus.conflict || !blockConsensus.value || !runtimeConsensus.value) {
    snapshotSuccess.forEach((row) => { row.semanticConflict = true; row.blockers.push("p82_exact_block_or_runtime_conflict"); });
    body = finalizeProviderRows(body, observations);
    body = { ...body, snapshot: { ...body.snapshot, headMin, headMax, headSkew, blockNumber: snapshotBlock }, blockers: uniqueSorted([...body.blockers, "p82_exact_block_or_runtime_conflict"]), classification: "WITHHELD_PROVIDER_CONFLICT" };
    return signReceipt(finalizeRpcRoots(body, observations), options.signing);
  }

  const runtimeCode = runtimeConsensus.value;
  const runtimeDigest = sha256Bytes(runtimeCode);
  const implementationAddress = extractP79Eip1167Implementation(runtimeCode);
  const snapshotIdentity = blockConsensus.value;
  const snapshotTimeBlocker = currentDeploymentTimestampBlocker(snapshotIdentity.timestamp, now);
  if (snapshotTimeBlocker) {
    snapshotSuccess.forEach((row) => {
      row.semanticConflict = true;
      row.blockers.push(`p82_${snapshotTimeBlocker}`);
    });
    body = finalizeProviderRows(body, observations);
    body = {
      ...body,
      snapshot: {
        ...body.snapshot,
        headMin,
        headMax,
        headSkew,
        blockNumber: snapshotBlock,
        blockHash: snapshotIdentity.hash,
        parentHash: snapshotIdentity.parentHash,
        stateRoot: snapshotIdentity.stateRoot,
        timestamp: snapshotIdentity.timestamp,
        timestampIso: new Date(snapshotIdentity.timestamp * 1_000).toISOString(),
      },
      blockers: uniqueSorted([...body.blockers, `p82_${snapshotTimeBlocker}`]),
      classification: "WITHHELD_PROVIDER_QUORUM",
    };
    return signReceipt(finalizeRpcRoots(body, observations), options.signing);
  }
  body = {
    ...body,
    snapshot: {
      headMin,
      headMax,
      headSkew,
      blockNumber: snapshotBlock,
      blockHash: snapshotIdentity.hash,
      parentHash: snapshotIdentity.parentHash,
      stateRoot: snapshotIdentity.stateRoot,
      timestamp: snapshotIdentity.timestamp,
      timestampIso: new Date(snapshotIdentity.timestamp * 1000).toISOString(),
    },
    deployment: {
      ...body.deployment,
      runtimeBytecodeSha256: runtimeDigest,
      runtimeByteLength: codeByteLength(runtimeCode),
      historicalRuntimeRelation: runtimeDigest === input.historicalBinding.runtimeBytecodeSha256.toLowerCase()
        ? "MATCHES_PINNED_HISTORICAL_RUNTIME"
        : "DIFFERS_FROM_PINNED_HISTORICAL_RUNTIME",
    },
    proof: { ...body.proof, exactBlockConsensusProven: true, currentRuntimeStateProven: true },
  };

  if (!implementationAddress) {
    body = finalizeProviderRows(body, observations);
    body = {
      ...body,
      classification: "PASS_EXACT_BLOCK_RUNTIME_QUORUM_PROXY_WITHHELD",
      customerCurrentRuntimeFactEligible: false,
      customerTrustedForwarderFactEligible: false,
      blockers: uniqueSorted([...body.blockers, "p82_current_runtime_not_resolvable_as_eip1167_proxy"]),
    };
    return signReceipt(finalizeRpcRoots(body, observations), options.signing);
  }

  snapshotSuccess.forEach((row) => { row.implementationAddress = implementationAddress; });
  await Promise.all(snapshotSuccess.map(async (observation) => {
    try {
      const implementationCode = normalizeCode(await rpcCall({ observation, method: "eth_getCode", params: [implementationAddress, snapshotTag], fetchImpl, timeoutMs, maxResponseBytes }));
      if (!implementationCode) {
        observation.semanticConflict = true;
        observation.blockers.push("p82_implementation_runtime_missing_or_invalid");
        return;
      }
      observation.implementationCode = implementationCode;
      const forwarderResult = await rpcCall({
        observation,
        method: "eth_call",
        params: [{
          from: "0x0000000000000000000000000000000000000000",
          to: input.targetAddress.toLowerCase(),
          data: encodeAddressCall(P82_IS_TRUSTED_FORWARDER_SELECTOR, input.trustedForwarderAddress.toLowerCase()),
        }, snapshotTag],
        fetchImpl,
        timeoutMs,
        maxResponseBytes,
      });
      const forwarderValue = parseCanonicalBool(forwarderResult);
      if (forwarderValue === null) {
        observation.semanticConflict = true;
        observation.blockers.push("p82_forwarder_call_noncanonical_bool");
        return;
      }
      observation.trustedForwarderValue = forwarderValue;
      observation.trustedForwarderResultDigest = sha256Bytes(String(forwarderResult).toLowerCase());
      const negativeResult = await rpcCall({
        observation,
        method: "eth_call",
        params: [{
          from: "0x0000000000000000000000000000000000000000",
          to: input.targetAddress.toLowerCase(),
          data: encodeAddressCall(P82_IS_TRUSTED_FORWARDER_SELECTOR, input.negativeControlAddress.toLowerCase()),
        }, snapshotTag],
        fetchImpl,
        timeoutMs,
        maxResponseBytes,
      });
      const negativeValue = parseCanonicalBool(negativeResult);
      if (negativeValue === null) {
        observation.semanticConflict = true;
        observation.blockers.push("p82_negative_control_noncanonical_bool");
        return;
      }
      observation.negativeControlValue = negativeValue;
      observation.negativeControlResultDigest = sha256Bytes(String(negativeResult).toLowerCase());
    } catch (error) {
      observation.blockers.push(rpcFailureCode("proxy", error));
    }
  }));

  const semanticProxyConflict = snapshotSuccess.some((row) => row.semanticConflict);
  const proxySuccess = snapshotSuccess.filter((row) => row.implementationCode && row.trustedForwarderValue !== null && row.negativeControlValue !== null && !row.semanticConflict);
  if (semanticProxyConflict) {
    body = finalizeProviderRows(body, observations);
    body = {
      ...body,
      deployment: {
        ...body.deployment,
        proxyKind: "EIP_1167_COMPATIBLE_MINIMAL_PROXY",
        implementationAddress,
        historicalImplementationRelation: implementationAddress === input.historicalBinding.implementationAddress.toLowerCase()
          ? "MATCHES_PINNED_HISTORICAL_IMPLEMENTATION"
          : "DIFFERS_FROM_PINNED_HISTORICAL_IMPLEMENTATION",
      },
      blockers: uniqueSorted([...body.blockers, "p82_semantic_proxy_or_forwarder_conflict"]),
      classification: "WITHHELD_PROVIDER_CONFLICT",
    };
    return signReceipt(finalizeRpcRoots(body, observations), options.signing);
  }

  if (proxySuccess.length < input.minimumProviderCount) {
    const implementationSuccess = snapshotSuccess.filter((row) => row.implementationCode && !row.semanticConflict);
    const implementationDiversityBlockers = successfulStageDiversityBlockers(
      implementationSuccess,
      input.minimumProviderCount,
      "implementation",
      input.executionClass === "PUBLIC_READONLY_CURRENT",
    );
    const implementationCodeConsensus = implementationSuccess.length >= input.minimumProviderCount
      && implementationDiversityBlockers.length === 0
      ? consensus(implementationSuccess.map((row) => row.implementationCode as string))
      : { value: null as string | null, conflict: false };
    const implementationCode = implementationCodeConsensus.conflict ? null : implementationCodeConsensus.value;
    body = finalizeProviderRows(body, observations);
    body = {
      ...body,
      deployment: {
        ...body.deployment,
        proxyKind: "EIP_1167_COMPATIBLE_MINIMAL_PROXY",
        implementationAddress,
        implementationBytecodeSha256: implementationCode ? sha256Bytes(implementationCode) : null,
        implementationByteLength: codeByteLength(implementationCode),
        historicalImplementationRelation: implementationAddress === input.historicalBinding.implementationAddress.toLowerCase()
          ? "MATCHES_PINNED_HISTORICAL_IMPLEMENTATION"
          : "DIFFERS_FROM_PINNED_HISTORICAL_IMPLEMENTATION",
      },
      proof: { ...body.proof, currentProxyImplementationProven: Boolean(implementationCode) },
      classification: implementationCode
        ? "PASS_EXACT_BLOCK_RUNTIME_PROXY_QUORUM_FORWARDER_WITHHELD"
        : "WITHHELD_PROVIDER_QUORUM",
      customerCurrentRuntimeFactEligible: false,
      customerTrustedForwarderFactEligible: false,
      blockers: uniqueSorted([
        ...body.blockers,
        "p82_insufficient_forwarder_state_quorum",
        ...implementationDiversityBlockers,
        ...(implementationCodeConsensus.conflict ? ["p82_implementation_consensus_conflict"] : []),
      ]),
    };
    return signReceipt(finalizeRpcRoots(body, observations), options.signing);
  }

  const proxyForwarderDiversityBlockers = successfulStageDiversityBlockers(
    proxySuccess,
    input.minimumProviderCount,
    "proxy_forwarder",
    input.executionClass === "PUBLIC_READONLY_CURRENT",
  );
  if (proxyForwarderDiversityBlockers.length) {
    body = finalizeProviderRows(body, observations);
    body = {
      ...body,
      blockers: uniqueSorted([...body.blockers, ...proxyForwarderDiversityBlockers]),
      classification: "WITHHELD_PROVIDER_QUORUM",
      customerCurrentRuntimeFactEligible: false,
      customerTrustedForwarderFactEligible: false,
    };
    return signReceipt(finalizeRpcRoots(body, observations), options.signing);
  }

  const implementationConsensus = consensus(proxySuccess.map((row) => row.implementationCode as string));
  const forwarderConsensus = consensus(proxySuccess.map((row) => row.trustedForwarderValue as boolean));
  const forwarderDigestConsensus = consensus(proxySuccess.map((row) => row.trustedForwarderResultDigest as string));
  const negativeConsensus = consensus(proxySuccess.map((row) => row.negativeControlValue as boolean));
  const negativeDigestConsensus = consensus(proxySuccess.map((row) => row.negativeControlResultDigest as string));
  if (implementationConsensus.conflict || forwarderConsensus.conflict || forwarderDigestConsensus.conflict || negativeConsensus.conflict || negativeDigestConsensus.conflict
    || !implementationConsensus.value || forwarderConsensus.value === null || !forwarderDigestConsensus.value || negativeConsensus.value === null || !negativeDigestConsensus.value) {
    proxySuccess.forEach((row) => { row.semanticConflict = true; row.blockers.push("p82_proxy_or_forwarder_consensus_conflict"); });
    body = finalizeProviderRows(body, observations);
    body = { ...body, blockers: uniqueSorted([...body.blockers, "p82_proxy_or_forwarder_consensus_conflict"]), classification: "WITHHELD_PROVIDER_CONFLICT" };
    return signReceipt(finalizeRpcRoots(body, observations), options.signing);
  }

  const implementationCode = implementationConsensus.value;
  const negativeUnexpected = negativeConsensus.value === true;
  const fullForwarderProof = !negativeUnexpected;
  body = finalizeProviderRows(body, observations);
  body = {
    ...body,
    deployment: {
      ...body.deployment,
      proxyKind: "EIP_1167_COMPATIBLE_MINIMAL_PROXY",
      implementationAddress,
      implementationBytecodeSha256: sha256Bytes(implementationCode),
      implementationByteLength: codeByteLength(implementationCode),
      historicalImplementationRelation: implementationAddress === input.historicalBinding.implementationAddress.toLowerCase()
        ? "MATCHES_PINNED_HISTORICAL_IMPLEMENTATION"
        : "DIFFERS_FROM_PINNED_HISTORICAL_IMPLEMENTATION",
    },
    trustedForwarder: {
      selector: P82_IS_TRUSTED_FORWARDER_SELECTOR,
      address: input.trustedForwarderAddress.toLowerCase(),
      state: fullForwarderProof ? (forwarderConsensus.value ? "ACTIVE" : "INACTIVE") : "WITHHELD",
      callResultSha256: forwarderDigestConsensus.value,
      negativeControlAddress: input.negativeControlAddress.toLowerCase(),
      negativeControlState: negativeUnexpected ? "UNEXPECTED_ACTIVE" : "INACTIVE",
      negativeControlCallResultSha256: negativeDigestConsensus.value,
    },
    proof: {
      ...body.proof,
      currentProxyImplementationProven: true,
      currentTrustedForwarderStateProven: fullForwarderProof,
    },
    classification: fullForwarderProof
      ? "PASS_EXACT_BLOCK_RUNTIME_PROXY_FORWARDER_QUORUM"
      : "PASS_EXACT_BLOCK_RUNTIME_PROXY_QUORUM_FORWARDER_WITHHELD",
    blockers: fullForwarderProof ? body.blockers : uniqueSorted([...body.blockers, "p82_negative_control_unexpected_active"]),
  };
  const rightsEligible = body.rights.customerFactRightsEligible;
  const publicDefaultExecution = input.executionClass === "PUBLIC_READONLY_CURRENT" && transportClass === "DEFAULT_NETWORK_STACK";
  body = {
    ...body,
    customerCurrentRuntimeFactEligible: publicDefaultExecution && rightsEligible && fullForwarderProof,
    customerTrustedForwarderFactEligible: publicDefaultExecution && rightsEligible && fullForwarderProof,
  };
  return signReceipt(finalizeRpcRoots(body, observations), options.signing);
}

function finalizeProviderRows(
  body: Omit<P82CurrentDeploymentReadonlyQuorumReceipt, "receiptDigest" | "signature">,
  observations: ProviderInternalObservation[],
): Omit<P82CurrentDeploymentReadonlyQuorumReceipt, "receiptDigest" | "signature"> {
  const byId = new Map(observations.map((row) => [row.prepared.config.providerId, row]));
  return {
    ...body,
    providers: body.providers.map((provider) => {
      const observation = byId.get(provider.providerId);
      if (!observation) return provider;
      const technicalPass = observation.headBlock !== null && !observation.semanticConflict && observation.blockers.length === 0;
      return {
        ...provider,
        technicalStatus: technicalPass ? "PASS" : "FAILED",
        transportBinding: observation.transportBinding,
        connectedAddressSha256: observation.connectedAddressSha256,
        observedHeadBlock: observation.headBlock,
        snapshotObservationSha256: providerSnapshotDigest(observation),
        rawResponseRootSha256: providerRawRoot(observation),
        methodCount: observation.methodDigests.length,
        blockerCodes: uniqueSorted(observation.blockers),
      };
    }),
  };
}

function finalizeRpcRoots(
  body: Omit<P82CurrentDeploymentReadonlyQuorumReceipt, "receiptDigest" | "signature">,
  observations: ProviderInternalObservation[],
): Omit<P82CurrentDeploymentReadonlyQuorumReceipt, "receiptDigest" | "signature"> {
  const methods = uniqueSorted(observations.flatMap((row) => row.methodDigests.map((item) => item.method))) as P82ReadonlyRpcMethod[];
  const rawRoots = observations.map(providerRawRoot).filter((value): value is string => Boolean(value)).sort();
  const requestRoots = observations.map(providerRequestRoot).filter((value): value is string => Boolean(value)).sort();
  return {
    ...body,
    rpc: {
      methods,
      methodCount: observations.reduce((sum, row) => sum + row.methodDigests.length, 0),
      rawResponseRootSha256: rawRoots.length ? sha256Digest(canonicalJson(rawRoots)) : null,
      requestRootSha256: requestRoots.length ? sha256Digest(canonicalJson(requestRoots)) : null,
    },
  };
}

function unsignedReceipt(value: P82CurrentDeploymentReadonlyQuorumReceipt): Omit<P82CurrentDeploymentReadonlyQuorumReceipt, "receiptDigest" | "signature"> {
  const { receiptDigest: _receiptDigest, signature: _signature, ...body } = value;
  return body;
}

function containsForbiddenRawOrEndpoint(value: unknown): boolean {
  if (typeof value === "string") return /^0x[a-f0-9]{130,}$/i.test(value);
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsForbiddenRawOrEndpoint);
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => {
    if (["rpcUrl", "endpointUrl", "runtimeBytecode", "implementationBytecode", "rawResponse", "rawPayload", "privateKey", "secret"].includes(key)) return true;
    return containsForbiddenRawOrEndpoint(item);
  });
}

export function verifyP82CurrentDeploymentReadonlyQuorumReceipt(
  value: unknown,
  signing: P82ReceiptSigning,
  observedAt?: Date,
): value is P82CurrentDeploymentReadonlyQuorumReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value) || !validSigning(signing)) return false;
  try {
    const receipt = value as P82CurrentDeploymentReadonlyQuorumReceipt;
    if (receipt.schemaVersion !== "velmere.p82.current-deployment-readonly-quorum-receipt.v2" || receipt.engineId !== P82_CURRENT_DEPLOYMENT_READONLY_QUORUM_ID) return false;
    if (receipt.signature?.keyId !== signing.keyId || !/^hmac-sha256:[a-f0-9]{64}$/.test(receipt.signature?.hmacSha256 ?? "")) return false;
    if (receipt.receiptDigest !== sha256Digest(canonicalJson(unsignedReceipt(receipt)))) return false;
    if (!safeEqual(receipt.signature.hmacSha256, hmacDigest(signing.secret, receipt.receiptDigest))) return false;
    if (containsForbiddenRawOrEndpoint(receipt)) return false;
    const generatedAt = new Date(receipt.generatedAt);
    if (!Number.isFinite(generatedAt.getTime()) || generatedAt.toISOString() !== receipt.generatedAt) return false;
    if (observedAt && (!Number.isFinite(observedAt.getTime())
      || (
      generatedAt.getTime() > observedAt.getTime() + AUDIT_CURRENT_DEPLOYMENT_FUTURE_SKEW_MS
      || observedAt.getTime() - generatedAt.getTime() > AUDIT_CURRENT_DEPLOYMENT_MAX_AGE_MS
      ))) return false;
    if (receipt.target.chainId !== "56" || receipt.target.chainName !== "BSC") return false;
    if (!ADDRESS.test(receipt.target.address) || !ADDRESS.test(receipt.target.trustedForwarderAddress) || !ADDRESS.test(receipt.target.negativeControlAddress)) return false;
    if (receipt.target.negativeControlAddress === "0x0000000000000000000000000000000000000000"
      || receipt.target.negativeControlAddress === receipt.target.address
      || receipt.target.negativeControlAddress === receipt.target.trustedForwarderAddress) return false;
    if (receipt.policy.transactionMethodsUsed !== false || receipt.policy.arbitraryRpcMethodAccepted !== false || receipt.policy.customerSuppliedEndpointAccepted !== false) return false;
    if (!receipt.policy.exactBlockRequired || !receipt.policy.providerConflictFailsClosed || receipt.policy.semanticOutlierDiscardAllowed) return false;
    if (canonicalJson(receipt.policy.allowedMethods) !== canonicalJson(P82_READONLY_RPC_METHODS)) return false;
    if (!receipt.rpc.methods.every((method) => P82_READONLY_RPC_METHODS.includes(method))) return false;
    if (receipt.rpc.methods.some((method) => FORBIDDEN_RPC_PREFIXES.some((prefix) => method.startsWith(prefix)))) return false;
    if (receipt.rpc.methodCount !== receipt.providers.reduce((sum, row) => sum + row.methodCount, 0)) return false;
    if (receipt.proof.currentExploitabilityProven !== false || receipt.proof.independentReplayProven !== false) return false;
    if (receipt.customerFinalEligible !== false || receipt.auditFinalPdfEligible !== false || receipt.promotionAllowed !== false || receipt.riskScoreFloor !== null) return false;
    if (receipt.rights.rawProviderPayloadRedistributed || receipt.rights.rawRuntimeBytecodeRedistributed || receipt.rights.rawImplementationBytecodeRedistributed) return false;
    if (receipt.rights.customerFactRightsEligible
      && (!receipt.rights.allConfiguredProvidersCurrent || !receipt.rights.allConfiguredProvidersDerivedUseAllowed || !receipt.rights.allConfiguredProvidersDisplayAllowed)) return false;
    if (!Number.isInteger(receipt.policy.minimumProviderCount) || receipt.policy.minimumProviderCount < MIN_PROVIDER_COUNT || receipt.policy.minimumProviderCount > MAX_PROVIDER_COUNT) return false;
    if (!Number.isInteger(receipt.policy.configuredProviderCount) || receipt.policy.configuredProviderCount < receipt.policy.minimumProviderCount || receipt.policy.configuredProviderCount > MAX_PROVIDER_COUNT) return false;
    if (receipt.providerDiversity.independenceBoundary !== "DECLARED_CONFIGURATION_DIVERSITY_NOT_NETWORK_INDEPENDENCE_PROOF") return false;

    const classificationIsConfigurationWithheld = receipt.classification === "WITHHELD_CONFIGURATION";
    if (classificationIsConfigurationWithheld) {
      if (receipt.providers.length > receipt.policy.configuredProviderCount || receipt.customerCurrentRuntimeFactEligible || receipt.customerTrustedForwarderFactEligible) return false;
      if (receipt.proof.exactBlockConsensusProven || receipt.proof.currentRuntimeStateProven || receipt.proof.currentProxyImplementationProven || receipt.proof.currentTrustedForwarderStateProven) return false;
      if (receipt.providerDiversity.providerIdCount < 0 || receipt.providerDiversity.providerIdCount > receipt.policy.configuredProviderCount) return false;
      if (receipt.providerDiversity.operatorCount < 0 || receipt.providerDiversity.operatorCount > receipt.policy.configuredProviderCount) return false;
      if (receipt.providerDiversity.familyCount < 0 || receipt.providerDiversity.familyCount > receipt.policy.configuredProviderCount) return false;
      if (receipt.providerDiversity.correlationGroupCount < 0 || receipt.providerDiversity.correlationGroupCount > receipt.policy.configuredProviderCount) return false;
    } else {
      if (receipt.providers.length !== receipt.policy.configuredProviderCount) return false;
      if (receipt.providerDiversity.providerIdCount !== new Set(receipt.providers.map((row) => row.providerId)).size) return false;
      if (receipt.providerDiversity.operatorCount !== new Set(receipt.providers.map((row) => row.operatorId)).size) return false;
      if (receipt.providerDiversity.familyCount !== new Set(receipt.providers.map((row) => row.providerFamily)).size) return false;
      if (receipt.providerDiversity.correlationGroupCount !== new Set(receipt.providers.map((row) => row.correlationGroup)).size) return false;
      if (receipt.providerDiversity.endpointIdentityCount !== new Set(receipt.providers.map((row) => row.endpointIdentitySha256)).size) return false;
      if (receipt.providerDiversity.publicHostnameCount !== new Set(receipt.providers.map((row) => row.hostnameIdentitySha256).filter((item): item is string => Boolean(item))).size) return false;
      if (receipt.providerDiversity.providerIdCount !== receipt.providers.length) return false;
      if (receipt.providerDiversity.operatorCount < receipt.policy.minimumProviderCount
        || receipt.providerDiversity.familyCount < receipt.policy.minimumProviderCount
        || receipt.providerDiversity.correlationGroupCount < receipt.policy.minimumProviderCount
        || receipt.providerDiversity.endpointIdentityCount < receipt.policy.minimumProviderCount) return false;
    }

    const allowedRightsStatuses = new Set<P82RightsStatus>([
      "LOCAL_FIXTURE_ONLY", "PUBLIC_DOMAIN", "OPEN_COMMERCIAL_ALLOWED", "PUBLIC_REUSE_ALLOWED",
      "DERIVED_USE_ONLY_ALLOWED", "ALLOWED_WITH_ATTRIBUTION", "AMBIGUOUS_BLOCKED", "EXPIRED_REVERIFY_REQUIRED",
    ]);
    for (const row of receipt.providers) {
      if (!SAFE_ID.test(row.providerId) || !SAFE_ID.test(row.operatorId) || !SAFE_ID.test(row.providerFamily) || !SAFE_ID.test(row.correlationGroup)) return false;
      if (!SHA256.test(row.endpointIdentitySha256) || !SHA256.test(row.rightsEvidenceSha256)) return false;
      if (!allowedRightsStatuses.has(row.rightsStatus)) return false;
      if (!["LOOPBACK_FIXTURE", "PUBLIC_HTTPS"].includes(row.endpointClass)) return false;
      if (!["INJECTED_TEST_TRANSPORT", "PINNED_PUBLIC_ADDRESS", "NOT_ESTABLISHED"].includes(row.transportBinding)) return false;
      if (!["PASS", "FAILED"].includes(row.technicalStatus)) return false;
      if (row.hostnameIdentitySha256 !== null && !SHA256.test(row.hostnameIdentitySha256)) return false;
      if (row.resolvedAddressSetSha256 !== null && !SHA256.test(row.resolvedAddressSetSha256)) return false;
      if (row.connectedAddressSha256 !== null && !SHA256.test(row.connectedAddressSha256)) return false;
      if (row.snapshotObservationSha256 !== null && !SHA256.test(row.snapshotObservationSha256)) return false;
      if (row.rawResponseRootSha256 !== null && !SHA256.test(row.rawResponseRootSha256)) return false;
      if (!Number.isInteger(row.methodCount) || row.methodCount < 0) return false;
      if (!Array.isArray(row.blockerCodes) || row.blockerCodes.some((code) => typeof code !== "string" || code.length > 160)) return false;
      if (row.endpointClass === "LOOPBACK_FIXTURE") {
        if (row.hostnameIdentitySha256 !== null || row.resolvedAddressSetSha256 !== null || row.transportBinding === "PINNED_PUBLIC_ADDRESS" || row.connectedAddressSha256 !== null) return false;
      } else if (!row.hostnameIdentitySha256 || !row.resolvedAddressSetSha256) return false;
      if (row.transportBinding === "PINNED_PUBLIC_ADDRESS" && !row.connectedAddressSha256) return false;
      if (row.transportBinding !== "PINNED_PUBLIC_ADDRESS" && row.connectedAddressSha256 !== null) return false;
      if (row.technicalStatus === "PASS" && row.blockerCodes.length > 0) return false;
    }

    if (receipt.executionClass === "LOCAL_DETERMINISTIC_FIXTURE") {
      if (receipt.providers.some((row) => row.endpointClass !== "LOOPBACK_FIXTURE")) return false;
      if (receipt.providerDiversity.publicHostnameCount !== 0) return false;
      if (receipt.customerCurrentRuntimeFactEligible || receipt.customerTrustedForwarderFactEligible) return false;
    } else if (receipt.executionClass === "PUBLIC_READONLY_CURRENT") {
      if (!classificationIsConfigurationWithheld && receipt.providers.some((row) => row.endpointClass !== "PUBLIC_HTTPS" || !row.hostnameIdentitySha256 || !row.resolvedAddressSetSha256)) return false;
      if (!classificationIsConfigurationWithheld && receipt.providerDiversity.publicHostnameCount < receipt.policy.minimumProviderCount) return false;
    } else return false;

    if (receipt.transportClass === "INJECTED_TEST_TRANSPORT") {
      if (receipt.providers.some((row) => row.transportBinding === "PINNED_PUBLIC_ADDRESS" || row.connectedAddressSha256 !== null)) return false;
      if (receipt.providers.some((row) => row.technicalStatus === "PASS" && row.transportBinding !== "INJECTED_TEST_TRANSPORT")) return false;
      if (receipt.customerCurrentRuntimeFactEligible || receipt.customerTrustedForwarderFactEligible) return false;
    } else if (receipt.transportClass === "DEFAULT_NETWORK_STACK") {
      if (receipt.providers.some((row) => row.transportBinding === "INJECTED_TEST_TRANSPORT")) return false;
      if (receipt.executionClass === "PUBLIC_READONLY_CURRENT"
        && receipt.providers.some((row) => row.technicalStatus === "PASS" && (row.transportBinding !== "PINNED_PUBLIC_ADDRESS" || !row.connectedAddressSha256))) return false;
    } else return false;

    const canonicalRecord = classificationIsConfigurationWithheld
      ? null
      : findP79HistoricalDeploymentGroundTruthRecord({ chain: receipt.target.chainName, contractAddress: receipt.target.address });
    if (!classificationIsConfigurationWithheld) {
      if (!canonicalRecord || !verifyP79HistoricalDeploymentGroundTruthRecord(canonicalRecord)) return false;
      if (receipt.target.historicalRecordId !== canonicalRecord.recordId) return false;
      if (receipt.target.trustedForwarderAddress !== canonicalRecord.incident.trustedForwarderAddress) return false;
      if (receipt.trustedForwarder.address !== canonicalRecord.incident.trustedForwarderAddress) return false;
      if (receipt.target.negativeControlAddress === canonicalRecord.deployment.implementationAddress) return false;
    }
    if (receipt.trustedForwarder.selector !== P82_IS_TRUSTED_FORWARDER_SELECTOR) return false;
    if (receipt.trustedForwarder.address !== receipt.target.trustedForwarderAddress || receipt.trustedForwarder.negativeControlAddress !== receipt.target.negativeControlAddress) return false;

    if (receipt.proof.exactBlockConsensusProven) {
      if (receipt.snapshot.blockNumber === null || !receipt.snapshot.blockHash || !HASH32.test(receipt.snapshot.blockHash)
        || !receipt.snapshot.parentHash || !HASH32.test(receipt.snapshot.parentHash)
        || !receipt.snapshot.stateRoot || !HASH32.test(receipt.snapshot.stateRoot)
        || receipt.snapshot.timestamp === null || !receipt.snapshot.timestampIso
        || receipt.snapshot.timestampIso !== new Date(receipt.snapshot.timestamp * 1_000).toISOString()
        || currentDeploymentTimestampBlocker(receipt.snapshot.timestamp, new Date(receipt.generatedAt)) !== null) return false;
    }
    if (receipt.proof.currentRuntimeStateProven) {
      if (!receipt.proof.exactBlockConsensusProven || !receipt.deployment.runtimeBytecodeSha256 || !SHA256.test(receipt.deployment.runtimeBytecodeSha256) || !receipt.deployment.runtimeByteLength) return false;
      if (!canonicalRecord) return false;
      const expectedRuntimeRelation = receipt.deployment.runtimeBytecodeSha256 === canonicalRecord.deployment.runtimeBytecodeDigest
        ? "MATCHES_PINNED_HISTORICAL_RUNTIME"
        : "DIFFERS_FROM_PINNED_HISTORICAL_RUNTIME";
      if (receipt.deployment.historicalRuntimeRelation !== expectedRuntimeRelation) return false;
    }
    if (receipt.proof.currentProxyImplementationProven) {
      if (!receipt.proof.currentRuntimeStateProven || receipt.deployment.proxyKind !== "EIP_1167_COMPATIBLE_MINIMAL_PROXY" || !receipt.deployment.implementationAddress || !ADDRESS.test(receipt.deployment.implementationAddress)) return false;
      if (!receipt.deployment.implementationBytecodeSha256 || !SHA256.test(receipt.deployment.implementationBytecodeSha256) || !receipt.deployment.implementationByteLength) return false;
      if (!canonicalRecord) return false;
      const expectedImplementationRelation = receipt.deployment.implementationAddress === canonicalRecord.deployment.implementationAddress
        ? "MATCHES_PINNED_HISTORICAL_IMPLEMENTATION"
        : "DIFFERS_FROM_PINNED_HISTORICAL_IMPLEMENTATION";
      if (receipt.deployment.historicalImplementationRelation !== expectedImplementationRelation) return false;
    }
    if (receipt.proof.currentTrustedForwarderStateProven) {
      if (!receipt.proof.currentProxyImplementationProven || receipt.trustedForwarder.state === "WITHHELD" || receipt.trustedForwarder.negativeControlState !== "INACTIVE") return false;
      if (!receipt.trustedForwarder.callResultSha256 || !SHA256.test(receipt.trustedForwarder.callResultSha256)
        || !receipt.trustedForwarder.negativeControlCallResultSha256 || !SHA256.test(receipt.trustedForwarder.negativeControlCallResultSha256)) return false;
    }

    const fullClassification = receipt.classification === "PASS_EXACT_BLOCK_RUNTIME_PROXY_FORWARDER_QUORUM";
    if (fullClassification) {
      if (!receipt.proof.currentRuntimeStateProven || !receipt.proof.currentProxyImplementationProven || !receipt.proof.currentTrustedForwarderStateProven) return false;
      const successful = receipt.providers.filter((row) => row.technicalStatus === "PASS");
      if (successful.length < receipt.policy.minimumProviderCount) return false;
      if (new Set(successful.map((row) => row.providerId)).size < receipt.policy.minimumProviderCount
        || new Set(successful.map((row) => row.operatorId)).size < receipt.policy.minimumProviderCount
        || new Set(successful.map((row) => row.providerFamily)).size < receipt.policy.minimumProviderCount
        || new Set(successful.map((row) => row.correlationGroup)).size < receipt.policy.minimumProviderCount
        || new Set(successful.map((row) => row.endpointIdentitySha256)).size < receipt.policy.minimumProviderCount) return false;
      if (receipt.executionClass === "PUBLIC_READONLY_CURRENT"
        && new Set(successful.map((row) => row.hostnameIdentitySha256).filter((item): item is string => Boolean(item))).size < receipt.policy.minimumProviderCount) return false;
    } else if (receipt.classification === "PASS_EXACT_BLOCK_RUNTIME_PROXY_QUORUM_FORWARDER_WITHHELD") {
      if (!receipt.proof.currentRuntimeStateProven || !receipt.proof.currentProxyImplementationProven || receipt.proof.currentTrustedForwarderStateProven) return false;
    } else if (receipt.classification === "PASS_EXACT_BLOCK_RUNTIME_QUORUM_PROXY_WITHHELD") {
      if (!receipt.proof.currentRuntimeStateProven || receipt.proof.currentProxyImplementationProven || receipt.proof.currentTrustedForwarderStateProven) return false;
    } else if (!["WITHHELD_CONFIGURATION", "WITHHELD_PROVIDER_QUORUM", "WITHHELD_PROVIDER_CONFLICT", "WITHHELD_TARGET_IDENTITY"].includes(receipt.classification)) return false;

    const expectedCustomerFactEligibility = fullClassification
      && receipt.executionClass === "PUBLIC_READONLY_CURRENT"
      && receipt.transportClass === "DEFAULT_NETWORK_STACK"
      && receipt.rights.customerFactRightsEligible;
    if (receipt.customerCurrentRuntimeFactEligible !== expectedCustomerFactEligibility) return false;
    if (receipt.customerTrustedForwarderFactEligible !== expectedCustomerFactEligibility) return false;
    return true;
  } catch {
    return false;
  }
}

function signingFromEnvironmentForKey(keyId: string): P82ReceiptSigning | null {
  const currentKeyId = String(process.env.VELMERE_CURRENT_DEPLOYMENT_QUORUM_KEY_ID_CURRENT ?? "").trim();
  const currentSecret = String(process.env.VELMERE_CURRENT_DEPLOYMENT_QUORUM_SECRET_CURRENT ?? "");
  if (keyId === currentKeyId && validSigning({ keyId: currentKeyId, secret: currentSecret })) return { keyId: currentKeyId, secret: currentSecret };
  const previousKeyId = String(process.env.VELMERE_CURRENT_DEPLOYMENT_QUORUM_KEY_ID_PREVIOUS ?? "").trim();
  const previousSecret = String(process.env.VELMERE_CURRENT_DEPLOYMENT_QUORUM_SECRET_PREVIOUS ?? "");
  if (keyId === previousKeyId && validSigning({ keyId: previousKeyId, secret: previousSecret })) return { keyId: previousKeyId, secret: previousSecret };
  return null;
}

export function verifyP82CurrentDeploymentReadonlyQuorumReceiptFromEnvironment(
  value: unknown,
): value is P82CurrentDeploymentReadonlyQuorumReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keyId = String((value as { signature?: { keyId?: unknown } }).signature?.keyId ?? "");
  const signing = signingFromEnvironmentForKey(keyId);
  return signing ? verifyP82CurrentDeploymentReadonlyQuorumReceipt(value, signing, new Date()) : false;
}

function parseProviderConfigFromEnvironment(raw: string): P82CurrentDeploymentProviderConfig[] | null {
  if (!raw || raw.length > 32_768) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as P82CurrentDeploymentProviderConfig[] : null;
  } catch {
    return null;
  }
}

export async function collectP82CurrentDeploymentReadonlyQuorumFromEnvironment(args: {
  chain?: string | null;
  contractAddress?: string | null;
  timeoutMs?: number;
  maxResponseBytes?: number;
}): Promise<P82CurrentDeploymentReadonlyQuorumReceipt | null> {
  if (process.env.VELMERE_CURRENT_DEPLOYMENT_QUORUM_ENABLED !== "true") return null;
  const chain = String(args.chain ?? "").trim().toLowerCase();
  if (!["bsc", "bnb", "bnb-smart-chain", "binance-smart-chain", "56"].includes(chain)) return null;
  const targetAddress = normalizeAddress(args.contractAddress);
  if (!targetAddress) return null;
  const record = findP79HistoricalDeploymentGroundTruthRecord({ chain: "bsc", contractAddress: targetAddress });
  if (!record) return null;
  const keyId = String(process.env.VELMERE_CURRENT_DEPLOYMENT_QUORUM_KEY_ID_CURRENT ?? "").trim();
  const secret = String(process.env.VELMERE_CURRENT_DEPLOYMENT_QUORUM_SECRET_CURRENT ?? "");
  const signing = { keyId, secret };
  if (!validSigning(signing)) return null;
  const providers = parseProviderConfigFromEnvironment(String(process.env.VELMERE_BSC_CURRENT_RPC_QUORUM_CONFIG_JSON ?? ""));
  if (!providers) return null;
  const confirmationDepth = Number(process.env.VELMERE_BSC_CURRENT_RPC_CONFIRMATION_DEPTH ?? "64");
  const maxHeadSkew = Number(process.env.VELMERE_BSC_CURRENT_RPC_MAX_HEAD_SKEW ?? "8");
  const minimumProviderCount = Number(process.env.VELMERE_BSC_CURRENT_RPC_MINIMUM_PROVIDERS ?? "3");
  const input: P82CurrentDeploymentReadonlyQuorumInput = {
    schemaVersion: "velmere.p82.current-deployment-readonly-quorum-input.v2",
    executionClass: "PUBLIC_READONLY_CURRENT",
    caseRef: `AUD-P82-${record.recordId.toUpperCase().replace(/[^A-Z0-9-]/g, "-")}`.slice(0, 84),
    chainId: "56",
    chainName: "BSC",
    targetAddress,
    trustedForwarderAddress: record.incident.trustedForwarderAddress,
    negativeControlAddress: "0x0000000000000000000000000000000000000001",
    historicalBinding: {
      recordId: record.recordId,
      runtimeBytecodeSha256: record.deployment.runtimeBytecodeDigest,
      implementationAddress: record.deployment.implementationAddress,
    },
    confirmationDepth,
    maxHeadSkew,
    minimumProviderCount,
    providers,
  };
  try {
    return await collectP82CurrentDeploymentReadonlyQuorum(input, {
      signing,
      timeoutMs: args.timeoutMs,
      maxResponseBytes: args.maxResponseBytes,
    });
  } catch {
    return null;
  }
}
