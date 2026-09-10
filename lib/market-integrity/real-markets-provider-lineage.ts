import {
  buildPass612OneSourceStateContract,
  type Pass612SourceState,
} from "@/lib/market-integrity/one-source-state-contract";

export type Pass619ProviderLineageInput = {
  assetId: string;
  assetClass: string;
  provider?: string | null;
  backupProvider?: string | null;
  state?: string | null;
  sourceTimestamp?: string | number | null;
  candles?: number | null;
  expectedCandles?: number | null;
  currentPrice?: number | null;
  confidenceCap?: number | null;
  freshnessBudgetSeconds?: number;
  missingReason?: string | null;
  generatedAt?: string | number;
};

export type Pass619ProviderLineage = {
  version: "real-markets-provider-lineage";
  assetId: string;
  assetClass: string;
  provider: string;
  backupProvider: string | null;
  state: Pass612SourceState;
  observedAt: string | null;
  ageSeconds: number | null;
  coveragePercent: number;
  confidenceCap: number;
  missingCount: number;
  hasExecutablePrice: boolean;
  chartReady: boolean;
  boundary: string;
};

function requestedState(value: string | null | undefined): Pass612SourceState {
  const state = String(value ?? "").toLowerCase();
  if (state === "live" || state === "source_bound" || state === "aligned") return "live";
  if (state === "partial" || state === "review" || state === "single_source") return "partial";
  if (state === "stale" || state === "aging") return "stale";
  if (state === "fallback" || state === "compatibility_adapter") return "fallback";
  return "offline";
}

export function buildPass619ProviderLineage(
  input: Pass619ProviderLineageInput,
): Pass619ProviderLineage {
  const provider = input.provider?.trim() || "source unavailable";
  const hasPrice = Number.isFinite(input.currentPrice);
  const candleCount = Math.max(0, Math.round(input.candles ?? 0));
  const contract = buildPass612OneSourceStateContract({
    generatedAt: input.generatedAt,
    layers: [
      {
        id: `${input.assetId}:quote`,
        label: "quote",
        provider,
        backupProvider: input.backupProvider,
        requestedState: requestedState(input.state),
        observedAt: input.sourceTimestamp,
        timestampKind: input.sourceTimestamp ? "provider" : "none",
        recordCount: hasPrice ? 1 : 0,
        expectedRecords: 1,
        hasFallback: Boolean(input.backupProvider),
        error: hasPrice ? null : input.missingReason || "price unavailable",
        freshnessBudgetSeconds: input.freshnessBudgetSeconds,
        required: true,
      },
      {
        id: `${input.assetId}:candles`,
        label: "candles",
        provider,
        backupProvider: input.backupProvider,
        requestedState: requestedState(input.state),
        observedAt: input.sourceTimestamp,
        timestampKind: input.sourceTimestamp ? "provider" : "none",
        recordCount: candleCount,
        expectedRecords: Math.max(2, input.expectedCandles ?? 48),
        hasFallback: Boolean(input.backupProvider),
        error: candleCount > 1 ? null : input.missingReason || "candles unavailable",
        freshnessBudgetSeconds: input.freshnessBudgetSeconds,
        required: true,
      },
    ],
  });
  const quoteLayer = contract.layers[0];
  const candleLayer = contract.layers[1];
  const sourceCap = Math.min(
    contract.confidenceCap,
    Number.isFinite(input.confidenceCap) ? Math.max(0, Math.min(100, input.confidenceCap!)) : 100,
  );
  const missingCount = contract.layers.filter(
    (layer) => layer.state === "offline" || layer.state === "fallback" || layer.coveragePercent < 75,
  ).length;

  return {
    version: "real-markets-provider-lineage",
    assetId: input.assetId,
    assetClass: input.assetClass,
    provider,
    backupProvider: input.backupProvider?.trim() || null,
    state: contract.aggregateState,
    observedAt: quoteLayer?.observedAt ?? candleLayer?.observedAt ?? null,
    ageSeconds: quoteLayer?.ageSeconds ?? candleLayer?.ageSeconds ?? null,
    coveragePercent: Math.min(
      quoteLayer?.coveragePercent ?? 0,
      candleLayer?.coveragePercent ?? 0,
    ),
    confidenceCap: sourceCap,
    missingCount,
    hasExecutablePrice: hasPrice && contract.aggregateState !== "offline",
    chartReady: candleCount > 1 && candleLayer?.state !== "offline",
    boundary:
      "Price, provider, timestamp, backup route, freshness and confidence travel as one lineage object. Missing or route-time-only evidence cannot appear as live provider data.",
  };
}
