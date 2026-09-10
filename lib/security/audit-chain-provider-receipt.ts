import { createHash } from "node:crypto";

export const PASS35_A4_CHAIN_RECEIPT_ID = "pass35-a4-provider-bound-chain-receipt" as const;

export type Pass35A4ChainInput = {
  schemaVersion: "velmere.pass35.audit-a4-chain-input.v1";
  inputClass: "SYNTHETIC_OFFLINE" | "CUSTOMER_SUPPLIED_UNVERIFIED" | "CUSTOMER_SUPPLIED_VERIFIED";
  caseRef: string;
  observedAt: string;
  chainId: string;
  chainName: string;
  contractAddress: string;
  blockTag: "latest" | `0x${string}`;
  deploymentTxHash?: string | null;
  provider: {
    providerId: string;
    providerFamily: string;
    endpointClass: "LOCAL_TEST" | "STAGING" | "PRODUCTION";
    configurationSha256: string;
    commercialRightsEvidenceSha256?: string | null;
  };
};

export type Pass35A4ChainReceipt = {
  schemaVersion: "velmere.pass35.audit-a4-chain-receipt.v1";
  engineId: typeof PASS35_A4_CHAIN_RECEIPT_ID;
  caseRef: string;
  inputClass: Pass35A4ChainInput["inputClass"];
  provider: {
    providerId: string;
    providerFamily: string;
    endpointClass: Pass35A4ChainInput["provider"]["endpointClass"];
    endpointIdentitySha256: string | null;
    configurationSha256: string | null;
    commercialRightsEvidenceSha256: string | null;
  };
  target: {
    chainId: string;
    chainName: string;
    contractAddress: string;
    blockTag: string;
    deploymentTxHash: string | null;
  };
  observations: {
    observedChainIdHex: string | null;
    observedChainIdDecimal: string | null;
    observedBlockNumberHex: string | null;
    observedBlockNumberDecimal: string | null;
    runtimeBytecode: string | null;
    runtimeBytecodeSha256: string | null;
    runtimeByteLength: number | null;
    transactionReceiptSha256: string | null;
    transactionSha256: string | null;
    deploymentReceiptContractAddress: string | null;
    deploymentReceiptBlockNumber: string | null;
  };
  rpc: {
    methodCount: number;
    methods: string[];
    rawResponseRootSha256: string | null;
  };
  blockers: string[];
  realProviderExecution: boolean;
  paidGateEligible: boolean;
  promotionAllowed: false;
  receiptSha256: string;
  truthBoundary: string;
};

const DIGEST = /^(?:sha256:)?[a-f0-9]{64}$/i;
const ADDRESS = /^0x[a-f0-9]{40}$/i;
const TX_HASH = /^0x[a-f0-9]{64}$/i;
const CASE_REF = /^AUD-[A-Z0-9-]{8,64}$/;
const HEX_QUANTITY = /^0x(?:0|[1-9a-f][0-9a-f]*)$/i;
const HEX_BYTES = /^0x(?:[a-f0-9]{2})*$/i;

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalDigest(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (!DIGEST.test(text)) return null;
  return text.startsWith("sha256:") ? text : `sha256:${text}`;
}

function normalizeAddress(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  return ADDRESS.test(text) ? text : null;
}

function normalizeQuantity(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  return HEX_QUANTITY.test(text) ? text : null;
}

function quantityToDecimal(value: string | null): string | null {
  if (!value) return null;
  try { return BigInt(value).toString(10); } catch { return null; }
}

function endpointPolicy(input: Pass35A4ChainInput, rpcUrl: string): { endpointIdentitySha256: string | null; blocker: string | null } {
  let parsed: URL;
  try { parsed = new URL(rpcUrl); } catch { return { endpointIdentitySha256: null, blocker: "a4_rpc_url_invalid" }; }
  if (parsed.username || parsed.password) return { endpointIdentitySha256: null, blocker: "a4_rpc_url_credentials_forbidden" };
  const hostname = parsed.hostname.toLowerCase();
  const loopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (input.inputClass === "SYNTHETIC_OFFLINE") {
    if (!loopback || !["http:", "https:"].includes(parsed.protocol)) return { endpointIdentitySha256: null, blocker: "a4_synthetic_rpc_must_be_loopback" };
  } else if (parsed.protocol !== "https:" || loopback) return { endpointIdentitySha256: null, blocker: "a4_real_rpc_requires_non_loopback_https" };
  const identity = `${parsed.protocol}//${parsed.hostname.toLowerCase()}:${parsed.port || (parsed.protocol === "https:" ? "443" : "80")}${parsed.pathname}`;
  return { endpointIdentitySha256: sha256(identity), blocker: null };
}

function validateInput(input: Pass35A4ChainInput): string[] {
  const blockers: string[] = [];
  const add = (ok: unknown, code: string) => { if (!ok) blockers.push(code); };
  add(input?.schemaVersion === "velmere.pass35.audit-a4-chain-input.v1", "a4_chain_schema_invalid");
  add(["SYNTHETIC_OFFLINE", "CUSTOMER_SUPPLIED_UNVERIFIED", "CUSTOMER_SUPPLIED_VERIFIED"].includes(input?.inputClass), "a4_chain_input_class_invalid");
  add(CASE_REF.test(String(input?.caseRef ?? "")), "a4_chain_case_ref_invalid");
  add(/^\d+$/.test(String(input?.chainId ?? "")), "a4_chain_expected_id_invalid");
  add(normalizeAddress(input?.contractAddress) !== null, "a4_chain_contract_address_invalid");
  add(input?.blockTag === "latest" || normalizeQuantity(input?.blockTag) !== null, "a4_chain_block_tag_invalid");
  if (input?.deploymentTxHash != null) add(TX_HASH.test(String(input.deploymentTxHash)), "a4_chain_deployment_tx_invalid");
  add(/^[a-z0-9][a-z0-9_.-]{2,80}$/i.test(String(input?.provider?.providerId ?? "")), "a4_chain_provider_id_invalid");
  add(/^[a-z0-9][a-z0-9_.-]{2,80}$/i.test(String(input?.provider?.providerFamily ?? "")), "a4_chain_provider_family_invalid");
  add(["LOCAL_TEST", "STAGING", "PRODUCTION"].includes(input?.provider?.endpointClass), "a4_chain_endpoint_class_invalid");
  add(canonicalDigest(input?.provider?.configurationSha256) !== null, "a4_chain_provider_config_digest_invalid");
  if (input?.provider?.commercialRightsEvidenceSha256 != null) add(canonicalDigest(input.provider.commercialRightsEvidenceSha256) !== null, "a4_chain_provider_rights_digest_invalid");
  return [...new Set(blockers)].sort();
}

export async function collectProviderBoundChainReceipt(
  input: Pass35A4ChainInput,
  options: { rpcUrl: string; fetchImpl?: typeof fetch; timeoutMs?: number }
): Promise<Pass35A4ChainReceipt> {
  const blockers = validateInput(input);
  const endpoint = endpointPolicy(input, options.rpcUrl);
  if (endpoint.blocker) blockers.push(endpoint.blocker);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 10000, 1000), 30000);
  const rawResponses: Array<{ method: string; response: unknown }> = [];
  let rpcId = 0;

  async function rpc(method: string, params: unknown[]): Promise<unknown> {
    rpcId += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(options.rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: rpcId, method, params }),
        signal: controller.signal,
        redirect: "error",
      });
      if (!response.ok) throw new Error(`http_${response.status}`);
      const body = await response.json() as { jsonrpc?: unknown; id?: unknown; result?: unknown; error?: unknown };
      if (body?.jsonrpc !== "2.0" || body?.id !== rpcId || body?.error != null) throw new Error(`rpc_invalid_response:${method}`);
      rawResponses.push({ method, response: body });
      return body.result;
    } finally { clearTimeout(timer); }
  }

  let observedChainIdHex: string | null = null;
  let observedBlockNumberHex: string | null = null;
  let runtimeBytecode: string | null = null;
  let txReceipt: unknown = null;
  let tx: unknown = null;
  if (!blockers.length) {
    try {
      observedChainIdHex = normalizeQuantity(await rpc("eth_chainId", []));
      if (!observedChainIdHex) blockers.push("a4_rpc_chain_id_invalid");
      else if (quantityToDecimal(observedChainIdHex) !== input.chainId) blockers.push("a4_rpc_chain_id_mismatch");
      observedBlockNumberHex = normalizeQuantity(await rpc("eth_blockNumber", []));
      if (!observedBlockNumberHex) blockers.push("a4_rpc_block_number_invalid");
      const codeResult = await rpc("eth_getCode", [input.contractAddress.toLowerCase(), input.blockTag]);
      runtimeBytecode = typeof codeResult === "string" && HEX_BYTES.test(codeResult) ? codeResult.toLowerCase() : null;
      if (!runtimeBytecode || runtimeBytecode === "0x") blockers.push("a4_rpc_runtime_bytecode_missing");
      if (input.deploymentTxHash) {
        txReceipt = await rpc("eth_getTransactionReceipt", [input.deploymentTxHash.toLowerCase()]);
        tx = await rpc("eth_getTransactionByHash", [input.deploymentTxHash.toLowerCase()]);
        const receiptAddress = normalizeAddress((txReceipt as { contractAddress?: unknown })?.contractAddress);
        if (receiptAddress !== input.contractAddress.toLowerCase()) blockers.push("a4_rpc_deployment_receipt_contract_mismatch");
        const receiptStatus = normalizeQuantity((txReceipt as { status?: unknown })?.status);
        if (receiptStatus !== "0x1") blockers.push("a4_rpc_deployment_receipt_not_success");
        const txHash = String((tx as { hash?: unknown })?.hash ?? "").toLowerCase();
        if (txHash !== input.deploymentTxHash.toLowerCase()) blockers.push("a4_rpc_transaction_hash_mismatch");
      }
    } catch (error) {
      blockers.push(`a4_rpc_execution_failed:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const runtimeBytes = runtimeBytecode && runtimeBytecode !== "0x" ? Buffer.from(runtimeBytecode.slice(2), "hex") : null;
  const normalizedBlockers = [...new Set(blockers)].sort();
  const realProviderExecution = normalizedBlockers.length === 0
    && input.inputClass !== "SYNTHETIC_OFFLINE"
    && input.provider.endpointClass !== "LOCAL_TEST";
  const paidGateEligible = realProviderExecution
    && input.inputClass === "CUSTOMER_SUPPLIED_VERIFIED"
    && input.provider.endpointClass === "PRODUCTION"
    && canonicalDigest(input.provider.commercialRightsEvidenceSha256) !== null;
  const core = {
    schemaVersion: "velmere.pass35.audit-a4-chain-receipt.v1" as const,
    engineId: PASS35_A4_CHAIN_RECEIPT_ID,
    caseRef: input.caseRef,
    inputClass: input.inputClass,
    provider: {
      providerId: input.provider.providerId,
      providerFamily: input.provider.providerFamily,
      endpointClass: input.provider.endpointClass,
      endpointIdentitySha256: endpoint.endpointIdentitySha256,
      configurationSha256: canonicalDigest(input.provider.configurationSha256),
      commercialRightsEvidenceSha256: canonicalDigest(input.provider.commercialRightsEvidenceSha256),
    },
    target: {
      chainId: input.chainId,
      chainName: input.chainName,
      contractAddress: input.contractAddress.toLowerCase(),
      blockTag: input.blockTag,
      deploymentTxHash: input.deploymentTxHash?.toLowerCase() ?? null,
    },
    observations: {
      observedChainIdHex,
      observedChainIdDecimal: quantityToDecimal(observedChainIdHex),
      observedBlockNumberHex,
      observedBlockNumberDecimal: quantityToDecimal(observedBlockNumberHex),
      runtimeBytecode,
      runtimeBytecodeSha256: runtimeBytes ? sha256(runtimeBytes) : null,
      runtimeByteLength: runtimeBytes?.length ?? null,
      transactionReceiptSha256: txReceipt ? sha256(stable(txReceipt)) : null,
      transactionSha256: tx ? sha256(stable(tx)) : null,
      deploymentReceiptContractAddress: normalizeAddress((txReceipt as { contractAddress?: unknown } | null)?.contractAddress),
      deploymentReceiptBlockNumber: normalizeQuantity((txReceipt as { blockNumber?: unknown } | null)?.blockNumber),
    },
    rpc: {
      methodCount: rawResponses.length,
      methods: rawResponses.map((row) => row.method),
      rawResponseRootSha256: rawResponses.length ? sha256(stable(rawResponses)) : null,
    },
    blockers: normalizedBlockers,
    realProviderExecution,
    paidGateEligible,
    promotionAllowed: false as const,
    truthBoundary: input.inputClass === "SYNTHETIC_OFFLINE"
      ? "This receipt proves RPC binding and fail-closed validation against a local synthetic provider only. It is not commercial provider, rights, staging or LIVE evidence."
      : "This receipt binds one provider response set, chain, block selector, deployed code and optional deployment transaction. It does not prove source correctness, audit completeness, provider independence or customer value.",
  };
  return { ...core, receiptSha256: sha256(stable(core)) };
}
