const SAFE_QUERY = /^[A-Za-z0-9][A-Za-z0-9 .^=/_:-]{0,119}$/u;
const EVM_ADDRESS = /^(?:address:)?(0[xX][a-fA-F0-9]{40})$/u;
const MARKET_ID = /^[a-z0-9][a-z0-9._/-]{0,119}$/u;
const CHAIN_ID = /^[a-z0-9][a-z0-9._:-]{0,79}$/u;
const SYMBOL = /^[A-Z0-9.^=/-]{1,32}$/u;
const PROVIDER_ID = /^[a-z0-9][a-z0-9._:-]{0,79}$/u;
const RECEIPT_ID = /^p4644_[a-f0-9]{24}$/u;

type UnknownRecord = Record<string, unknown>;

type CanonicalIdentityCommon = {
  providerId: string;
  providerFamily: string;
  requested: string;
  resolvedSymbol: string;
  resolvedQuote: "USD";
  receiptId: string;
};

export type ShieldMapCanonicalCustomerIdentity =
  | (CanonicalIdentityCommon & {
      namespace: "symbol_or_market";
      resolvedMarketId: string;
    })
  | (CanonicalIdentityCommon & {
      namespace: "address";
      resolvedAddress: string;
      resolvedChainId: string;
    });

export type ShieldMapCustomerIdentityResult =
  | { ok: true; value: ShieldMapCanonicalCustomerIdentity }
  | {
      ok: false;
      code:
        | "shield_map_customer_query_invalid"
        | "shield_map_customer_binding_invalid"
        | "shield_map_customer_query_mismatch"
        | "shield_map_customer_namespace_mismatch"
        | "shield_map_customer_token_mismatch";
    };

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function normalizeRequestedQuery(value: string) {
  const query = value.trim().replace(/\s+/gu, " ");
  if (!query || query.normalize("NFKC") !== query || !SAFE_QUERY.test(query) || query.includes("%")) {
    return null;
  }
  return {
    requested: query.toLowerCase().replace(/[^a-z0-9:.^=\-_/]+/gu, ""),
    requestedAddress: query.match(EVM_ADDRESS)?.[1]?.toLowerCase() ?? null,
  };
}

function normalizedLower(value: unknown, pattern: RegExp) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  return pattern.test(normalized) ? normalized : "";
}

function normalizedUpper(value: unknown, pattern: RegExp) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toUpperCase();
  return pattern.test(normalized) ? normalized : "";
}

function isAbsent(value: unknown) {
  return value === undefined || value === null || value === "";
}

export function verifyShieldMapCustomerIdentity(args: {
  requestedQuery: string;
  binding: unknown;
  token: unknown;
}): ShieldMapCustomerIdentityResult {
  const query = normalizeRequestedQuery(args.requestedQuery);
  if (!query) return { ok: false, code: "shield_map_customer_query_invalid" };

  const binding = asRecord(args.binding);
  const token = asRecord(args.token);
  if (!binding || !token) {
    return { ok: false, code: "shield_map_customer_binding_invalid" };
  }

  const providerId = normalizedLower(binding.providerId, PROVIDER_ID);
  const providerFamily = normalizedLower(binding.providerFamily, PROVIDER_ID);
  const requested = typeof binding.requested === "string" ? binding.requested.trim().toLowerCase() : "";
  const resolvedSymbol = normalizedUpper(binding.resolvedSymbol, SYMBOL);
  const tokenSymbol = normalizedUpper(token.symbol, SYMBOL);
  const receiptId = typeof binding.receiptId === "string" && RECEIPT_ID.test(binding.receiptId)
    ? binding.receiptId
    : "";
  if (
    !providerId
    || !providerFamily
    || !resolvedSymbol
    || !tokenSymbol
    || binding.resolvedQuote !== "USD"
    || !receiptId
  ) {
    return { ok: false, code: "shield_map_customer_binding_invalid" };
  }
  if (requested !== query.requested) {
    return { ok: false, code: "shield_map_customer_query_mismatch" };
  }
  if (resolvedSymbol !== tokenSymbol) {
    return { ok: false, code: "shield_map_customer_token_mismatch" };
  }

  if (query.requestedAddress) {
    if (binding.namespace !== "address" || !isAbsent(binding.resolvedMarketId)) {
      return { ok: false, code: "shield_map_customer_namespace_mismatch" };
    }
    const resolvedAddress = normalizedLower(binding.resolvedAddress, /^0x[a-f0-9]{40}$/u);
    const tokenAddress = normalizedLower(token.tokenAddress, /^0x[a-f0-9]{40}$/u);
    const resolvedChainId = normalizedLower(binding.resolvedChainId, CHAIN_ID);
    const tokenChainId = normalizedLower(token.chainId, CHAIN_ID);
    if (
      !resolvedAddress
      || !tokenAddress
      || !resolvedChainId
      || !tokenChainId
      || resolvedAddress !== query.requestedAddress
      || resolvedAddress !== tokenAddress
      || resolvedChainId !== tokenChainId
    ) {
      return { ok: false, code: "shield_map_customer_token_mismatch" };
    }
    return {
      ok: true,
      value: {
        namespace: "address",
        providerId,
        providerFamily,
        requested,
        resolvedAddress,
        resolvedChainId,
        resolvedSymbol,
        resolvedQuote: "USD",
        receiptId,
      },
    };
  }

  if (
    binding.namespace !== "symbol_or_market"
    || !isAbsent(binding.resolvedAddress)
    || !isAbsent(binding.resolvedChainId)
  ) {
    return { ok: false, code: "shield_map_customer_namespace_mismatch" };
  }
  const resolvedMarketId = normalizedLower(binding.resolvedMarketId, MARKET_ID);
  const tokenMarketId = normalizedLower(token.marketId, MARKET_ID);
  if (!resolvedMarketId || !tokenMarketId || resolvedMarketId !== tokenMarketId) {
    return { ok: false, code: "shield_map_customer_token_mismatch" };
  }
  return {
    ok: true,
    value: {
      namespace: "symbol_or_market",
      providerId,
      providerFamily,
      requested,
      resolvedMarketId,
      resolvedSymbol,
      resolvedQuote: "USD",
      receiptId,
    },
  };
}
