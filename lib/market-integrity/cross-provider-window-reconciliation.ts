import { sha256Token } from "../security/cryptographic-digest";
import type {
  Pass2463EndpointWindowContract,
  Pass2463HistoricalRangeWindowLedger,
  Pass2463ProviderId,
  Pass2463RangeId,
  Pass2463RangeWindowState,
} from "./historical-range-window-ledger";
import type { VelmereSourceSyncPacket } from "./source-sync-contract";

type Pass2464SourceSyncPacket = VelmereSourceSyncPacket & {
  pass2463?: Pass2463HistoricalRangeWindowLedger;
};

export type Pass2464WindowReconciliationState = "ready" | "watch" | "blocked";
export type Pass2464ProviderWindowState =
  | "aligned"
  | "context_only"
  | "needs_replay"
  | "needs_mapping"
  | "planned"
  | "not_applicable"
  | "blocked";
export type Pass2464ProviderWindowRole =
  | "primary_market_history"
  | "candle_confirmation"
  | "dex_pool_overlay"
  | "cex_venue_overlay"
  | "defi_context"
  | "live_pair_edge"
  | "holder_flow";

export type Pass2464ProviderWindowComparison = {
  provider: Pass2463ProviderId;
  role: Pass2464ProviderWindowRole;
  label: string;
  comparisonState: Pass2464ProviderWindowState;
  expectedFromUnix: number;
  expectedToUnix: number;
  providerFromUnix?: number;
  providerToUnix?: number;
  windowDeltaSeconds?: number;
  requiredReplay: string[];
  overlayEligibility: "eligible" | "context_only" | "blocked" | "planned";
  allowedSurfaceUse: string[];
  noMixBoundary: string;
};

export type Pass2464WindowPairingRule = {
  id: string;
  state: Pass2464WindowReconciliationState;
  requires: string[];
  blockedBy: string[];
  copyRule: string;
};

export type Pass2464PdfWindowParity = {
  state: "same_reconciled_window" | "blocked_until_reconciled_window";
  previewFingerprint: string;
  downloadFingerprint: string;
  hardRejectIf: string[];
};

export type Pass2464CrossProviderWindowReconciliation = {
  version: "cross-provider-window-reconciliation-v1";
  state: Pass2464WindowReconciliationState;
  score: number;
  query?: string;
  symbol?: string;
  requestedRange: Pass2463RangeId;
  primaryProvider: "coingecko";
  primaryWindowFingerprint: string;
  reconciliationFingerprint: string;
  providerComparisons: Pass2464ProviderWindowComparison[];
  pairingRules: Pass2464WindowPairingRule[];
  pdfWindowParity: Pass2464PdfWindowParity;
  surfaceHardLocks: string[];
  replayOrder: string[];
  nextActions: string[];
  noMixedWindowRule: string;
  generatedAt: string;
};

function unique(items: Array<string | false | null | undefined | 0>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function smallHash(input: unknown) {
  return `pass2464-${sha256Token(stableSerialize(input), 16)}`;
}

function numberParam(
  contract: Pass2463EndpointWindowContract | undefined,
  keys: string[],
) {
  if (!contract) return undefined;
  for (const key of keys) {
    const value = contract.normalizedParams[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function secondsFromMs(value?: number) {
  if (value === undefined) return undefined;
  return value > 10_000_000_000 ? Math.floor(value / 1000) : value;
}

function roleForProvider(
  provider: Pass2463ProviderId,
): Pass2464ProviderWindowRole {
  if (provider === "coingecko") return "primary_market_history";
  if (provider === "coingecko_ohlc") return "candle_confirmation";
  if (provider === "geckoterminal") return "dex_pool_overlay";
  if (provider === "binance") return "cex_venue_overlay";
  if (provider === "defillama") return "defi_context";
  if (provider === "dexscreener") return "live_pair_edge";
  return "holder_flow";
}

function allowedSurfaceUse(provider: Pass2463ProviderId) {
  if (provider === "coingecko")
    return [
      "chart",
      "vlm_brain",
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "angel",
    ];
  if (provider === "coingecko_ohlc")
    return ["chart_candles", "vlm_brain", "pdf_candle_section"];
  if (provider === "geckoterminal")
    return [
      "chart_overlay",
      "dex_liquidity_context",
      "advanced_reconciliation",
    ];
  if (provider === "binance")
    return ["cex_overlay", "depth_edge", "advanced_reconciliation"];
  if (provider === "defillama")
    return ["tvl_annotation", "protocol_context", "chain_context"];
  if (provider === "dexscreener")
    return ["live_pair_edge", "liquidity_snapshot", "fdv_volume_context"];
  return ["planned_holder_flow", "advanced_concentration_context"];
}

function comparisonState(args: {
  provider: Pass2463ProviderId;
  endpointState: Pass2463EndpointWindowContract["windowState"];
  from?: number;
  to?: number;
  expectedFrom: number;
  expectedTo: number;
  delta?: number;
}): Pass2464ProviderWindowState {
  if (args.endpointState === "planned") return "planned";
  if (args.endpointState === "not_applicable") return "not_applicable";
  if (args.endpointState === "blocked_missing_mapping") return "needs_mapping";
  if (args.endpointState === "blocked_missing_timestamp") return "blocked";
  if (args.provider === "defillama" || args.provider === "dexscreener")
    return "context_only";
  if (args.from === undefined || args.to === undefined) return "needs_replay";
  if ((args.delta ?? 0) > 24 * 60 * 60) return "needs_replay";
  if (
    args.endpointState === "ready_to_fetch" ||
    args.endpointState === "configured"
  )
    return "aligned";
  return "blocked";
}

function buildProviderComparisons(
  ledger: Pass2463HistoricalRangeWindowLedger,
): Pass2464ProviderWindowComparison[] {
  const expectedFrom = ledger.normalizedWindow.fromUnix;
  const expectedTo = ledger.normalizedWindow.toUnix;
  return ledger.endpointWindows.map((contract) => {
    const from = secondsFromMs(
      numberParam(contract, [
        "from",
        "targetFrom",
        "startTime",
        "snapshotAtUnix",
      ]),
    );
    const to = secondsFromMs(
      numberParam(contract, [
        "to",
        "before_timestamp",
        "endTime",
        "snapshotAtUnix",
      ]),
    );
    const delta =
      from !== undefined && to !== undefined
        ? Math.max(Math.abs(from - expectedFrom), Math.abs(to - expectedTo))
        : undefined;
    const state = comparisonState({
      provider: contract.provider,
      endpointState: contract.windowState,
      from,
      to,
      expectedFrom,
      expectedTo,
      delta,
    });
    const overlayEligibility =
      state === "aligned" &&
      !["defillama", "dexscreener"].includes(contract.provider)
        ? "eligible"
        : state === "context_only"
          ? "context_only"
          : state === "planned"
            ? "planned"
            : "blocked";
    return {
      provider: contract.provider,
      role: roleForProvider(contract.provider),
      label: contract.label,
      comparisonState: state,
      expectedFromUnix: expectedFrom,
      expectedToUnix: expectedTo,
      providerFromUnix: from,
      providerToUnix: to,
      windowDeltaSeconds: delta,
      requiredReplay: unique([
        state === "needs_mapping" && "resolve provider mapping before overlay",
        state === "needs_replay" &&
          "replay endpoint using exact normalized fromUnix/toUnix",
        state === "blocked" && "attach observedAt/max-age before any proof use",
        state === "context_only" &&
          "show as context annotation, not price/overlay proof",
        state === "planned" &&
          "keep visible as roadmap task until adapter/key/live observedAt exist",
        contract.missing.length &&
          `source missing: ${contract.missing.slice(0, 3).join("; ")}`,
      ]),
      overlayEligibility,
      allowedSurfaceUse: allowedSurfaceUse(contract.provider),
      noMixBoundary: contract.noMixBoundary,
    };
  });
}

function buildPairingRules(
  comparisons: Pass2464ProviderWindowComparison[],
  historicalState: Pass2463RangeWindowState,
): Pass2464WindowPairingRule[] {
  const primary = comparisons.find((item) => item.provider === "coingecko");
  const overlayCandidates = comparisons.filter((item) =>
    ["coingecko_ohlc", "geckoterminal", "binance"].includes(item.provider),
  );
  const alignedOverlays = overlayCandidates.filter(
    (item) => item.comparisonState === "aligned",
  );
  const contextOnly = comparisons.filter(
    (item) => item.comparisonState === "context_only",
  );
  const mappingLocks = comparisons.filter(
    (item) => item.comparisonState === "needs_mapping",
  );
  const replayLocks = comparisons.filter(
    (item) => item.comparisonState === "needs_replay",
  );
  const state: Pass2464WindowReconciliationState =
    !primary || primary.comparisonState !== "aligned"
      ? "blocked"
      : alignedOverlays.length >= 1 &&
          mappingLocks.length === 0 &&
          replayLocks.length === 0 &&
          historicalState !== "blocked"
        ? "ready"
        : "watch";
  return [
    {
      id: "primary_market_window",
      state: primary?.comparisonState === "aligned" ? "ready" : "blocked",
      requires: [
        "CoinGecko market_chart/range",
        "exact fromUnix",
        "exact toUnix",
        "raw point count",
        "rangeWindowFingerprint",
      ],
      blockedBy: primary?.requiredReplay ?? [
        "primary CoinGecko range window missing",
      ],
      copyRule:
        "Primary macro chart must identify the exact window and point count before any 2Y/5Y/MAX copy.",
    },
    {
      id: "second_overlay_window",
      state: alignedOverlays.length
        ? "ready"
        : mappingLocks.length || replayLocks.length
          ? "watch"
          : "blocked",
      requires: [
        "CoinGecko OHLC/range or GeckoTerminal pool OHLCV or Binance klines",
        "same normalized window",
        "same range label",
        "visible overlay status",
      ],
      blockedBy: unique(
        [...mappingLocks, ...replayLocks].map(
          (item) => `${item.label}: ${item.requiredReplay.join(" | ")}`,
        ),
      ).slice(0, 6),
      copyRule:
        "Advanced macro wording needs one aligned overlay; otherwise render the overlay lane as missing/replay-required.",
    },
    {
      id: "context_annotation_window",
      state: contextOnly.length ? "ready" : "watch",
      requires: [
        "DefiLlama TVL/protocol/chain window",
        "DEX Screener live edge",
        "no-mix boundary",
      ],
      blockedBy: contextOnly.length
        ? []
        : ["context lanes missing or unresolved"],
      copyRule:
        "Context lanes can annotate risk but cannot substitute for price/candle/depth history.",
    },
    {
      id: "surface_reconciliation",
      state,
      requires: [
        "Chart",
        "VLM Brain",
        "Browser",
        "PDF preview",
        "PDF download",
        "Angel",
        "same reconciliationFingerprint",
      ],
      blockedBy: unique(
        comparisons.flatMap((item) =>
          item.requiredReplay.map((reason) => `${item.provider}: ${reason}`),
        ),
      ).slice(0, 8),
      copyRule:
        "All surfaces must reuse the reconciled window manifest or downgrade to watch/blocked.",
    },
  ];
}

export function buildPass2464CrossProviderWindowReconciliation(args: {
  query?: string;
  symbol?: string;
  sourceSync?: Pass2464SourceSyncPacket;
  historicalRangeWindow?: Pass2463HistoricalRangeWindowLedger;
  payloadFingerprint?: string;
  now?: Date;
}): Pass2464CrossProviderWindowReconciliation {
  const now = args.now ?? new Date();
  const ledger = args.historicalRangeWindow ?? args.sourceSync?.pass2463;
  const providerComparisons = ledger ? buildProviderComparisons(ledger) : [];
  const pairingRules = ledger
    ? buildPairingRules(providerComparisons, ledger.state)
    : [];
  const primary = providerComparisons.find(
    (item) => item.provider === "coingecko",
  );
  const eligibleOverlayCount = providerComparisons.filter(
    (item) =>
      item.overlayEligibility === "eligible" && item.provider !== "coingecko",
  ).length;
  const hardLocks = unique([
    !ledger && "PASS2463 range ledger missing",
    primary?.comparisonState !== "aligned" &&
      "primary CoinGecko macro window not aligned",
    eligibleOverlayCount < 1 && "no aligned second overlay window",
    ...providerComparisons
      .filter((item) =>
        ["needs_mapping", "needs_replay", "blocked"].includes(
          item.comparisonState,
        ),
      )
      .map((item) => `${item.label}: ${item.comparisonState}`),
  ]).slice(0, 12);
  const state: Pass2464WindowReconciliationState =
    !ledger || primary?.comparisonState !== "aligned"
      ? "blocked"
      : hardLocks.length === 0 && eligibleOverlayCount >= 1
        ? "ready"
        : "watch";
  const reconciliationFingerprint = smallHash({
    version: "cross-provider-window-reconciliation-v1",
    query: args.query ?? args.sourceSync?.query ?? ledger?.query,
    symbol: args.symbol ?? args.sourceSync?.symbol ?? ledger?.symbol,
    requestedRange: ledger?.requestedRange,
    primaryWindowFingerprint: ledger?.rangeWindowFingerprint,
    providerComparisons: providerComparisons.map((item) => ({
      provider: item.provider,
      state: item.comparisonState,
      from: item.providerFromUnix,
      to: item.providerToUnix,
      delta: item.windowDeltaSeconds,
    })),
    payloadFingerprint: args.payloadFingerprint,
  });
  const score = clamp(
    26 +
      providerComparisons.filter((item) => item.comparisonState === "aligned")
        .length *
        10 +
      eligibleOverlayCount * 12 +
      pairingRules.filter((rule) => rule.state === "ready").length * 6 -
      hardLocks.length * 6,
  );
  return {
    version: "cross-provider-window-reconciliation-v1",
    state,
    score,
    query: args.query ?? args.sourceSync?.query ?? ledger?.query,
    symbol: args.symbol ?? args.sourceSync?.symbol ?? ledger?.symbol,
    requestedRange: ledger?.requestedRange ?? "2y",
    primaryProvider: "coingecko",
    primaryWindowFingerprint: ledger?.rangeWindowFingerprint ?? "missing",
    reconciliationFingerprint,
    providerComparisons,
    pairingRules,
    pdfWindowParity: {
      state: hardLocks.length
        ? "blocked_until_reconciled_window"
        : "same_reconciled_window",
      previewFingerprint: `${reconciliationFingerprint}:preview`,
      downloadFingerprint: `${reconciliationFingerprint}:download`,
      hardRejectIf: unique([
        "PDF preview/download use different reconciliationFingerprint",
        "PDF uses chart points from another range window",
        "Browser preview hides overlay replay locks",
        "Angel summarizes macro trend without provider window states",
        ...hardLocks.slice(0, 6),
      ]),
    },
    surfaceHardLocks: hardLocks,
    replayOrder: [
      "1. Fetch CoinGecko market_chart/range for the normalized window and persist raw points.",
      "2. Fetch CoinGecko OHLC/range when tier/key supports candles; otherwise keep candles locked.",
      "3. Resolve GeckoTerminal network+pool and replay OHLCV until fromUnix.",
      "4. Resolve Binance spot symbol and chunk klines by 1000 limit where applicable.",
      "5. Attach DefiLlama TVL/protocol/chain metrics as context annotation only. DefiLlama is TVL/protocol/chain/fundamentals context, not price/contract/liquidity proof.",
      "6. Attach DEX Screener pair snapshot only as live edge liquidity/FDV/volume anchor. DEX Screener gives pair/snapshot liquidity and volume context, not macro history.",
      "7. Recompute reconciliationFingerprint and reuse it across Chart, Brain, Browser, PDF and Angel.",
    ],
    nextActions: unique([
      "Create canonical window manifest store keyed by reconciliationFingerprint.",
      "Show provider window state and delta seconds in every macro chart surface.",
      "Block Advanced if primary and overlay windows are not aligned.",
      "Persist preview/download PDF fingerprints from the same reconciled manifest.",
      eligibleOverlayCount < 1 &&
        "Resolve at least one second overlay: CoinGecko OHLC, GeckoTerminal pool or Binance klines.",
      hardLocks.length &&
        "Route hard locks into operator action queue before making customer-facing claims.",
    ]),
    noMixedWindowRule:
      "Never compare a 2Y CoinGecko line with a 7D pool sparkline, a live DEX snapshot or a DefiLlama TVL window as if they were the same chart evidence. Different windows must be labeled, reconciled or blocked.",
    generatedAt: now.toISOString(),
  };
}
