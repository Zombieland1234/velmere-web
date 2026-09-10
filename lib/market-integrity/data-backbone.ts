import { z } from "zod";
import type { TokenRiskInput } from "./risk-types";

export const velmereDataBackboneVersion = "velmere_data_backbone_v1_pass104";

const finiteNumber = z.number().finite();
const nonNegativeNumber = finiteNumber.nonnegative().max(Number.MAX_SAFE_INTEGER);
const positiveNumber = finiteNumber.positive().max(Number.MAX_SAFE_INTEGER);
const marketMovePercent = finiteNumber.min(-100).max(1_000_000);
const boundedPercent = finiteNumber.min(0).max(100);
const signedPercent = finiteNumber.min(-100).max(100);
const optionalNonNegativeNumber = nonNegativeNumber.optional();
const optionalPositiveNumber = positiveNumber.optional();
const optionalMarketMovePercent = marketMovePercent.optional();
const optionalBoundedPercent = boundedPercent.optional();
const optionalUrlString = z.union([z.string().url(), z.literal(""), z.undefined()]).transform((value: string | undefined) => value || undefined);

export const tokenRiskInputSchema = z.object({
  marketId: z.string().trim().min(1).max(140).optional(),
  symbol: z.string().trim().min(1).max(32).transform((value: string) => value.toUpperCase()),
  name: z.string().trim().min(1).max(160),
  image: optionalUrlString,
  rank: z.number().int().positive().max(1_000_000_000).optional(),
  chainId: z.string().trim().min(1).max(64).optional(),
  tokenAddress: z.string().trim().min(1).max(140).optional(),
  pairAddress: z.string().trim().min(1).max(140).optional(),
  dexId: z.string().trim().min(1).max(64).optional(),
  url: optionalUrlString,
  currentPrice: optionalPositiveNumber,
  athPrice: optionalPositiveNumber,
  marketCap: optionalNonNegativeNumber,
  fdv: optionalNonNegativeNumber,
  liquidityUsd: optionalNonNegativeNumber,
  volume24h: optionalNonNegativeNumber,
  averageVolume7d: optionalNonNegativeNumber,
  priceChange1h: optionalMarketMovePercent,
  priceChange6h: optionalMarketMovePercent,
  priceChange24h: optionalMarketMovePercent,
  priceChange7d: optionalMarketMovePercent,
  priceChange14d: optionalMarketMovePercent,
  priceChange30d: optionalMarketMovePercent,
  buys24h: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  sells24h: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  top10HolderPercent: optionalBoundedPercent,
  holderCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  hadRebrandAfterCrash: z.boolean().optional(),
  abnormalExchangeDeposits: z.boolean().optional(),
  suspiciousContractPrivileges: z.boolean().optional(),
  orderBookDepthDropPercent: optionalBoundedPercent,
  simulatedSlippage10k: optionalBoundedPercent,
  bidAskImbalancePercent: signedPercent.optional(),
  circulatingSupply: optionalNonNegativeNumber,
  totalSupply: optionalNonNegativeNumber,
  maxSupply: optionalNonNegativeNumber,
  buyTaxPercentage: optionalBoundedPercent,
  sellTaxPercentage: optionalBoundedPercent,
  isHoneypot: z.boolean().optional(),
  canMintNewTokens: z.boolean().optional(),
  canPauseTrading: z.boolean().optional(),
  canBlacklist: z.boolean().optional(),
  sparkline7d: z.array(positiveNumber).max(512).optional(),
  dataSources: z.array(z.string().trim().min(1).max(120)).max(32).optional(),
  providerHealthScore: optionalBoundedPercent,
  sourceDivergenceBps: nonNegativeNumber.max(1_000_000).optional(),
  freshnessSeconds: z.number().int().nonnegative().max(10 * 365 * 24 * 60 * 60).optional(),
  freshnessState: z.enum(["fresh", "aging", "stale", "missing"]).optional(),
  consensusState: z.enum(["aligned", "watch", "divergent", "stale", "single_source", "unavailable"]).optional(),
  assetClass: z.enum(["crypto", "stock", "etf", "index", "fx", "commodity", "real_estate", "exchange_equity", "unknown"]).optional(),
}).strict();

export type TokenRiskInputSchema = z.infer<typeof tokenRiskInputSchema>;

export type DataBackboneValidationResult<T> =
  | { ok: true; data: T; warnings: string[] }
  | { ok: false; data: null; warnings: string[]; error: string };

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return value;
}

function normalizeArrayNumbers(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.map(normalizeNumber);
}

export function sanitizeTokenRiskInput(raw: unknown): Partial<TokenRiskInput> {
  if (!raw || typeof raw !== "object") return {};
  const input = raw as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...input };

  for (const key of [
    "rank",
    "currentPrice",
    "athPrice",
    "marketCap",
    "fdv",
    "liquidityUsd",
    "volume24h",
    "averageVolume7d",
    "priceChange1h",
    "priceChange6h",
    "priceChange24h",
    "priceChange7d",
    "priceChange14d",
    "priceChange30d",
    "buys24h",
    "sells24h",
    "top10HolderPercent",
    "holderCount",
    "orderBookDepthDropPercent",
    "simulatedSlippage10k",
    "bidAskImbalancePercent",
    "circulatingSupply",
    "totalSupply",
    "maxSupply",
    "buyTaxPercentage",
    "sellTaxPercentage",
    "providerHealthScore",
    "sourceDivergenceBps",
    "freshnessSeconds",
  ]) {
    if (key in normalized) normalized[key] = normalizeNumber(normalized[key]);
  }

  if ("sparkline7d" in normalized) normalized.sparkline7d = normalizeArrayNumbers(normalized.sparkline7d);

  return normalized as Partial<TokenRiskInput>;
}

export function validateTokenRiskInput(raw: unknown): DataBackboneValidationResult<TokenRiskInput> {
  const sanitized = sanitizeTokenRiskInput(raw);
  const parsed = tokenRiskInputSchema.safeParse(sanitized);

  if (!parsed.success) {
    return {
      ok: false,
      data: null,
      warnings: parsed.error.issues.map((issue: { path: Array<string | number>; message: string }) => `${issue.path.join(".") || "root"}: ${issue.message}`),
      error: "Token risk input failed data-backbone validation.",
    };
  }

  const warnings: string[] = [];
  if (!parsed.data.currentPrice) warnings.push("currentPrice missing");
  if (!parsed.data.marketCap && !parsed.data.fdv) warnings.push("marketCap/fdv missing");
  if (!parsed.data.liquidityUsd) warnings.push("liquidityUsd missing");
  if (!parsed.data.dataSources?.length) warnings.push("dataSources missing");

  return { ok: true, data: parsed.data as TokenRiskInput, warnings };
}

export function assertTokenRiskInput(raw: unknown): TokenRiskInput {
  const result = validateTokenRiskInput(raw);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export const envSchema = z.object({
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(10).optional(),
  ETHERSCAN_API_KEY: z.string().min(6).optional(),
  ALCHEMY_API_KEY: z.string().min(6).optional(),
  COINGECKO_API_KEY: z.string().min(6).optional(),
  COINGECKO_DEMO_API_KEY: z.string().min(6).optional(),
  COINGECKO_PRO_API_KEY: z.string().min(6).optional(),
  DEFILLAMA_PRO_API_KEY: z.string().min(6).optional(),
}).passthrough();

export function validateRuntimeEnv(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.safeParse(env);
  return {
    ok: parsed.success,
    warnings: parsed.success ? [] : parsed.error.issues.map((issue: { path: Array<string | number>; message: string }) => `${issue.path.join(".")}: ${issue.message}`),
    configured: {
      supabase: Boolean(env.SUPABASE_SERVICE_ROLE_KEY && (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL)),
      upstash: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
      etherscan: Boolean(env.ETHERSCAN_API_KEY),
      alchemy: Boolean(env.ALCHEMY_API_KEY),
      coingecko: Boolean(env.COINGECKO_API_KEY || env.COINGECKO_DEMO_API_KEY || env.COINGECKO_PRO_API_KEY),
      defillamaPro: Boolean(env.DEFILLAMA_PRO_API_KEY),
      walletConnect: Boolean(env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID),
    },
  };
}
