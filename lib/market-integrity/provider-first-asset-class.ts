import type { VelmereMarketAssetClass } from "./risk-types";
import { inferPass4646AssetClass } from "./universal-asset-identity";
import { resolvePass481Identity } from "./asset-identity-registry";

export type Pass4648ProviderAssetMetadata = {
  symbol?: string | null;
  name?: string | null;
  quoteType?: string | null;
  typeDisp?: string | null;
  instrumentType?: string | null;
  exchange?: string | null;
  fullExchangeName?: string | null;
  market?: string | null;
};

export type Pass4648AssetClassResolution = {
  schemaVersion: "pass4648_provider_first_asset_class_v1";
  assetClass: VelmereMarketAssetClass;
  source: "provider_metadata" | "verified_identity_registry" | "deterministic_symbol_syntax" | "declared_alias" | "unresolved";
  verified: boolean;
  blockers: string[];
  providerType: string | null;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeType(value: unknown) {
  return clean(value).toUpperCase().replace(/[\s_-]+/g, " ");
}

function providerTypeToClass(value: string): VelmereMarketAssetClass | null {
  if (!value) return null;
  if (/CRYPTO|DIGITAL ASSET|TOKEN|COIN/.test(value)) return "crypto";
  if (/ETF|EXCHANGE TRADED|MUTUAL FUND|CLOSED END FUND|FUND/.test(value)) return "etf";
  if (/REIT|REAL ESTATE/.test(value)) return "real_estate";
  if (/INDEX|INDICES/.test(value)) return "index";
  if (/CURRENCY|FOREX|FOREIGN EXCHANGE|FX/.test(value)) return "fx";
  if (/FUTURE|COMMODITY|METAL|ENERGY|AGRICULTUR/.test(value)) return "commodity";
  if (/EXCHANGE OPERATOR/.test(value)) return "exchange_equity";
  if (/EQUITY|STOCK|COMMON SHARE|ADR|DEPOSITARY RECEIPT/.test(value)) return "stock";
  return null;
}

function registryClass(value: string): VelmereMarketAssetClass | null {
  const identity = resolvePass481Identity(value);
  if (!identity) return null;
  switch (identity.assetClass) {
    case "stock": return "stock";
    case "etf": return "etf";
    case "fx": return "fx";
    case "commodity": return "commodity";
    case "real_estate": return "real_estate";
    case "index": return "index";
    case "crypto":
    case "exchange_token": return "crypto";
    default: return null;
  }
}

function deterministicSyntaxClass(symbol: string, name: string): VelmereMarketAssetClass | null {
  const inferred = inferPass4646AssetClass({
    provider: "pass4648_deterministic_syntax",
    symbol,
    name,
  });
  // Plain listed tickers are ambiguous without provider metadata: an ETF and
  // an equity use the same syntax. Only structurally deterministic classes are
  // accepted here.
  return ["crypto", "index", "fx", "commodity"].includes(inferred) ? inferred : null;
}

export function resolvePass4648ProviderFirstAssetClass(args: {
  symbol: string;
  name?: string | null;
  declaredAssetClass?: VelmereMarketAssetClass | null;
  providerMetadata?: Pass4648ProviderAssetMetadata | null;
}): Pass4648AssetClassResolution {
  const metadata = args.providerMetadata ?? {};
  const providerType = [metadata.quoteType, metadata.typeDisp, metadata.instrumentType]
    .map(normalizeType)
    .find(Boolean) ?? null;
  const providerClass = providerTypeToClass(providerType ?? "");
  if (providerClass) {
    return {
      schemaVersion: "pass4648_provider_first_asset_class_v1",
      assetClass: providerClass,
      source: "provider_metadata",
      verified: true,
      blockers: [],
      providerType,
    };
  }

  const registered = registryClass(args.symbol) ?? registryClass(args.name ?? "");
  if (registered) {
    return {
      schemaVersion: "pass4648_provider_first_asset_class_v1",
      assetClass: registered,
      source: "verified_identity_registry",
      verified: true,
      blockers: providerType ? ["provider_type_unrecognized_registry_fallback_used"] : [],
      providerType,
    };
  }

  const deterministic = deterministicSyntaxClass(args.symbol, args.name ?? "");
  if (deterministic) {
    return {
      schemaVersion: "pass4648_provider_first_asset_class_v1",
      assetClass: deterministic,
      source: "deterministic_symbol_syntax",
      verified: true,
      blockers: [],
      providerType,
    };
  }

  if (args.declaredAssetClass && args.declaredAssetClass !== "unknown" && args.declaredAssetClass !== "stock") {
    return {
      schemaVersion: "pass4648_provider_first_asset_class_v1",
      assetClass: args.declaredAssetClass,
      source: "declared_alias",
      verified: true,
      blockers: [],
      providerType,
    };
  }

  return {
    schemaVersion: "pass4648_provider_first_asset_class_v1",
    assetClass: "unknown",
    source: "unresolved",
    verified: false,
    blockers: ["provider_metadata_required_for_listed_instrument_classification"],
    providerType,
  };
}
