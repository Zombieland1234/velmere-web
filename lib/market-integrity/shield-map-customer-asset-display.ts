import type { ShieldMapCanonicalCustomerIdentity } from "./shield-map-customer-identity";

const SYMBOL = /^[A-Z0-9.^=/-]{1,32}$/u;
const MARKET_ID = /^[a-z0-9][a-z0-9._/-]{0,119}$/u;
const CHAIN_ID = /^[a-z0-9][a-z0-9._:-]{0,79}$/u;
const ADDRESS = /^0x[a-f0-9]{40}$/u;
const PROVIDER_ID = /^[a-z0-9][a-z0-9._:-]{0,79}$/u;
const RECEIPT_ID = /^p4644_[a-f0-9]{24}(?:[a-f0-9]{40})?$/u;

type UnknownRecord = Record<string, unknown>;

export type ShieldMapCustomerAssetDisplay =
  | {
      state: "canonical_only";
      canonicalSymbol: string;
      canonicalIdentity: string;
      customerLabel: string;
      name: null;
      imageUrl: null;
      metadataState: "withheld";
      blocker: "field_level_receipt_and_rights_required";
    }
  | {
      state: "withheld";
      canonicalSymbol: null;
      canonicalIdentity: null;
      customerLabel: "WITHHELD";
      name: null;
      imageUrl: null;
      metadataState: "withheld";
      blocker: "canonical_identity_invalid";
    };

const WITHHELD: ShieldMapCustomerAssetDisplay = Object.freeze({
  state: "withheld",
  canonicalSymbol: null,
  canonicalIdentity: null,
  customerLabel: "WITHHELD",
  name: null,
  imageUrl: null,
  metadataState: "withheld",
  blocker: "canonical_identity_invalid",
});

function asPlainRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  return value as UnknownRecord;
}

function ownString(record: UnknownRecord, key: string) {
  if (!Object.prototype.hasOwnProperty.call(record, key)) return "";
  return typeof record[key] === "string" ? record[key].trim() : "";
}

function normalizeLower(record: UnknownRecord, key: string, pattern: RegExp) {
  const value = ownString(record, key).toLowerCase();
  return pattern.test(value) ? value : "";
}

function normalizeUpper(record: UnknownRecord, key: string, pattern: RegExp) {
  const value = ownString(record, key).toUpperCase();
  return pattern.test(value) ? value : "";
}

/**
 * Customer display projection for the Shield Map result header.
 *
 * The live payload currently has no exact field-level evidence and display-rights
 * binding for provider-derived token names or images. Those fields therefore stay
 * null even when present in `token`. Only the already verified canonical identity
 * may cross this boundary; a future metadata proof must be introduced and verified
 * separately before this projection can publish either field.
 */
export function projectShieldMapCustomerAssetDisplay(args: {
  identity: ShieldMapCanonicalCustomerIdentity | null;
  token: unknown;
}): ShieldMapCustomerAssetDisplay {
  const identity = asPlainRecord(args.identity);
  const token = asPlainRecord(args.token);
  if (!identity || !token) return WITHHELD;

  const providerId = normalizeLower(identity, "providerId", PROVIDER_ID);
  const providerFamily = normalizeLower(identity, "providerFamily", PROVIDER_ID);
  const receiptId = ownString(identity, "receiptId");
  const symbol = normalizeUpper(identity, "resolvedSymbol", SYMBOL);
  const tokenSymbol = normalizeUpper(token, "symbol", SYMBOL);
  if (
    !providerId
    || !providerFamily
    || !RECEIPT_ID.test(receiptId)
    || ownString(identity, "resolvedQuote") !== "USD"
    || !symbol
    || symbol !== tokenSymbol
  ) {
    return WITHHELD;
  }

  const namespace = ownString(identity, "namespace");
  if (namespace === "symbol_or_market") {
    const marketId = normalizeLower(identity, "resolvedMarketId", MARKET_ID);
    const tokenMarketId = normalizeLower(token, "marketId", MARKET_ID);
    if (!marketId || marketId !== tokenMarketId) return WITHHELD;
    return {
      state: "canonical_only",
      canonicalSymbol: symbol,
      canonicalIdentity: `market:${marketId}`,
      customerLabel: symbol,
      name: null,
      imageUrl: null,
      metadataState: "withheld",
      blocker: "field_level_receipt_and_rights_required",
    };
  }

  if (namespace === "address") {
    const address = normalizeLower(identity, "resolvedAddress", ADDRESS);
    const tokenAddress = normalizeLower(token, "tokenAddress", ADDRESS);
    const chainId = normalizeLower(identity, "resolvedChainId", CHAIN_ID);
    const tokenChainId = normalizeLower(token, "chainId", CHAIN_ID);
    if (!address || address !== tokenAddress || !chainId || chainId !== tokenChainId) {
      return WITHHELD;
    }
    return {
      state: "canonical_only",
      canonicalSymbol: symbol,
      canonicalIdentity: `${chainId}:${address}`,
      customerLabel: symbol,
      name: null,
      imageUrl: null,
      metadataState: "withheld",
      blocker: "field_level_receipt_and_rights_required",
    };
  }

  return WITHHELD;
}
