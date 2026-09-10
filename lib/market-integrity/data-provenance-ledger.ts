import type { Pass2449ChartOverlayReconciler } from "./chart-overlay-reconciler";
import type { Pass2450TierEvidenceParity } from "./tier-evidence-parity";
import type {
  VelmereSourceSyncLane,
  VelmereSourceSyncPacket,
} from "./source-sync-contract";

type Pass2451SourceSyncPacket = Omit<VelmereSourceSyncPacket, "pass2449"> & {
  pass2449?: Pass2449ChartOverlayReconciler;
  pass2450?: Pass2450TierEvidenceParity;
};

export type Pass2451LedgerState = "ready" | "watch" | "blocked";
export type Pass2451FieldId =
  | "identity"
  | "price"
  | "market_cap"
  | "volume"
  | "liquidity"
  | "fdv"
  | "tvl"
  | "chart_history"
  | "cex_depth"
  | "dex_pool_ohlcv"
  | "holder_graph"
  | "contract_security"
  | "pdf_parity";

export type Pass2451FieldProvenance = {
  field: Pass2451FieldId;
  label: string;
  state: Pass2451LedgerState;
  canonicalProvider: string;
  allowedProviders: string[];
  liveProviders: string[];
  plannedProviders: string[];
  forbiddenUses: string[];
  freshnessTargetSeconds: number;
  observedAt: string | null;
  confirmedEvidence: string[];
  missingEvidence: string[];
  tierAccess: {
    basic: "visible" | "badge_only" | "locked";
    pro: "visible" | "badge_only" | "locked";
    advanced: "visible" | "badge_only" | "locked";
  };
};

export type Pass2451DataProvenanceLedger = {
  version: "data-provenance-ledger-v1";
  state: Pass2451LedgerState;
  score: number;
  query?: string;
  symbol?: string;
  fieldLedger: Pass2451FieldProvenance[];
  sourceHealth: Array<{
    provider: string;
    state: VelmereSourceSyncLane["state"] | "planned";
    confirmedFields: string[];
    missingFields: string[];
    observedAt: string | null;
    cadence: string;
    boundary: string;
  }>;
  freshnessEnvelope: {
    state: Pass2451LedgerState;
    maxStaleFields: number;
    staleFields: string[];
    timecodeRule: string;
  };
  advancedLocks: string[];
  surfaceMounts: string[];
  riskEngineRules: string[];
  nextWorldClassIntegrations: string[];
  generatedAt: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique(items: Array<string | null | undefined | false>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function hasAny(texts: string[], needles: string[]) {
  const lower = texts.map((item) => item.toLowerCase());
  return needles.some((needle) => lower.some((item) => item.includes(needle)));
}

function findLiveProviders(
  sourceSync: VelmereSourceSyncPacket | undefined,
  providerIds: string[],
) {
  return (sourceSync?.lanes ?? [])
    .filter(
      (lane) =>
        providerIds.includes(lane.id) &&
        ["confirmed", "partial"].includes(lane.state),
    )
    .map((lane) => lane.label);
}

function findObservedAt(
  sourceSync: VelmereSourceSyncPacket | undefined,
  providerIds: string[],
) {
  return (
    (sourceSync?.lanes ?? [])
      .filter((lane) => providerIds.includes(lane.id))
      .map((lane) => lane.observedAt)
      .find(Boolean) ?? null
  );
}

function confirmedByField(
  sourceSync: VelmereSourceSyncPacket | undefined,
  needles: string[],
) {
  return unique(
    (sourceSync?.lanes ?? []).flatMap((lane) =>
      lane.confirmedFields
        .filter((field) =>
          needles.some((needle) => field.toLowerCase().includes(needle)),
        )
        .map((field) => `${lane.label}: ${field}`),
    ),
  );
}

function missingByField(
  sourceSync: VelmereSourceSyncPacket | undefined,
  needles: string[],
) {
  return unique(
    (sourceSync?.lanes ?? []).flatMap((lane) =>
      lane.missingFields
        .filter((field) =>
          needles.some((needle) => field.toLowerCase().includes(needle)),
        )
        .map((field) => `${lane.label}: ${field}`),
    ),
  );
}

function stateFromEvidence(
  confirmed: string[],
  missing: string[],
  minConfirmed = 1,
): Pass2451LedgerState {
  if (confirmed.length >= minConfirmed && missing.length <= 1) return "ready";
  if (confirmed.length >= 1 || missing.length <= 3) return "watch";
  return "blocked";
}

function buildField(args: {
  field: Pass2451FieldId;
  label: string;
  canonicalProvider: string;
  allowedProviders: string[];
  plannedProviders?: string[];
  providerIds: string[];
  confirmedEvidence: string[];
  missingEvidence: string[];
  forbiddenUses: string[];
  freshnessTargetSeconds: number;
  sourceSync?: Pass2451SourceSyncPacket;
  minConfirmed?: number;
  tierAccess?: Pass2451FieldProvenance["tierAccess"];
}): Pass2451FieldProvenance {
  const liveProviders = findLiveProviders(args.sourceSync, args.providerIds);
  const confirmedEvidence = unique(args.confirmedEvidence);
  const missingEvidence = unique(args.missingEvidence);
  return {
    field: args.field,
    label: args.label,
    state: stateFromEvidence(
      confirmedEvidence,
      missingEvidence,
      args.minConfirmed ?? 1,
    ),
    canonicalProvider: args.canonicalProvider,
    allowedProviders: args.allowedProviders,
    liveProviders,
    plannedProviders: args.plannedProviders ?? [],
    forbiddenUses: args.forbiddenUses,
    freshnessTargetSeconds: args.freshnessTargetSeconds,
    observedAt: findObservedAt(args.sourceSync, args.providerIds),
    confirmedEvidence,
    missingEvidence,
    tierAccess: args.tierAccess ?? {
      basic: "visible",
      pro: "visible",
      advanced: "visible",
    },
  };
}

export function buildPass2451DataProvenanceLedger(args: {
  query?: string;
  symbol?: string;
  sourceSync?: Pass2451SourceSyncPacket;
  chartOverlay?: Pass2449ChartOverlayReconciler;
  tierEvidence?: Pass2450TierEvidenceParity;
  payloadFingerprint?: string;
}): Pass2451DataProvenanceLedger {
  const sourceSync = args.sourceSync;
  const chartOverlay = args.chartOverlay ?? sourceSync?.pass2449;
  const tierEvidence = args.tierEvidence ?? sourceSync?.pass2450;
  const allConfirmed = (sourceSync?.lanes ?? []).flatMap(
    (lane) => lane.confirmedFields,
  );
  const chartPoints = chartOverlay?.windowContract.actualPoints ?? 0;
  const chartMissing = unique([
    ...(chartOverlay?.windowContract.missingFields ?? []),
    ...(chartOverlay?.tierLocks.find((tier) => tier.tier === "advanced")
      ?.blockedBy ?? []),
  ]);
  const advancedTierMissing =
    tierEvidence?.tierContracts.find((tier) => tier.tier === "advanced")
      ?.missingProof ?? [];

  const fieldLedger: Pass2451FieldProvenance[] = [
    buildField({
      field: "identity",
      label: "Identity / symbol / logo",
      canonicalProvider: "CoinGecko or DEX Screener token profile",
      allowedProviders: [
        "CoinGecko",
        "DEX Screener",
        "GeckoTerminal",
        "manual verified asset registry",
      ],
      providerIds: ["coingecko", "dexscreener"],
      confirmedEvidence: confirmedByField(sourceSync, [
        "logo",
        "image",
        "symbol",
        "identity",
      ]),
      missingEvidence: unique([
        !hasAny(allConfirmed, ["logo", "image"]) && "logo/image provenance",
        "canonical slug/address mapping",
      ]),
      forbiddenUses: [
        "Do not merge assets by ticker only; ticker collisions must be resolved by id/address/chain.",
      ],
      freshnessTargetSeconds: 86_400,
    }),
    buildField({
      field: "price",
      label: "Price",
      canonicalProvider:
        "CoinGecko listed market or DEX pool price for token-address scope",
      allowedProviders: [
        "CoinGecko",
        "DEX Screener",
        "GeckoTerminal pool OHLCV",
        "Binance venue price",
      ],
      providerIds: ["coingecko", "dexscreener", "binance"],
      confirmedEvidence: confirmedByField(sourceSync, ["price"]),
      missingEvidence: unique([
        ...missingByField(sourceSync, ["price"]),
        "second provider timestamp for Advanced",
      ]),
      forbiddenUses: [
        "Do not call a DEX pool price the global price without a badge.",
      ],
      freshnessTargetSeconds: 90,
      minConfirmed: 1,
    }),
    buildField({
      field: "market_cap",
      label: "Market cap",
      canonicalProvider:
        "CoinGecko market data / DEX Screener FDV only when MC missing",
      allowedProviders: ["CoinGecko", "DEX Screener", "CoinMarketCap planned"],
      plannedProviders: ["CoinMarketCap"],
      providerIds: ["coingecko", "dexscreener"],
      confirmedEvidence: confirmedByField(sourceSync, ["market cap"]),
      missingEvidence: unique([
        ...missingByField(sourceSync, ["market cap"]),
        "circulating supply provenance",
      ]),
      forbiddenUses: [
        "Do not substitute FDV for market cap without a visible label.",
      ],
      freshnessTargetSeconds: 180,
    }),
    buildField({
      field: "volume",
      label: "Volume",
      canonicalProvider:
        "CoinGecko market volume plus venue/pair volume cross-check",
      allowedProviders: [
        "CoinGecko",
        "DEX Screener",
        "Binance",
        "GeckoTerminal",
      ],
      providerIds: ["coingecko", "dexscreener", "binance"],
      confirmedEvidence: confirmedByField(sourceSync, ["volume"]),
      missingEvidence: unique([
        ...missingByField(sourceSync, ["volume"]),
        "wash/venue quality context for Advanced",
      ]),
      forbiddenUses: ["Do not treat volume as exit liquidity."],
      freshnessTargetSeconds: 180,
    }),
    buildField({
      field: "liquidity",
      label: "DEX liquidity / visible depth",
      canonicalProvider:
        "DEX Screener pair liquidity + GeckoTerminal pool overlay",
      allowedProviders: [
        "DEX Screener",
        "GeckoTerminal",
        "Bitquery pool events planned",
      ],
      plannedProviders: ["Bitquery liquidity events"],
      providerIds: ["dexscreener"],
      confirmedEvidence: confirmedByField(sourceSync, ["liquidity"]),
      missingEvidence: unique([
        ...missingByField(sourceSync, ["liquidity"]),
        "stress sell depth",
        "pool event history",
      ]),
      forbiddenUses: [
        "Visible liquidity is not guaranteed exit depth under stress.",
      ],
      freshnessTargetSeconds: 90,
      tierAccess: { basic: "badge_only", pro: "visible", advanced: "visible" },
    }),
    buildField({
      field: "fdv",
      label: "FDV / valuation spread",
      canonicalProvider: "CoinGecko or DEX Screener FDV with MC comparison",
      allowedProviders: ["CoinGecko", "DEX Screener"],
      providerIds: ["coingecko", "dexscreener"],
      confirmedEvidence: confirmedByField(sourceSync, ["fdv"]),
      missingEvidence: unique([
        ...missingByField(sourceSync, ["fdv"]),
        "unlock/vesting supply schedule",
      ]),
      forbiddenUses: ["FDV/MC gap is a warning context, not a fraud claim."],
      freshnessTargetSeconds: 300,
      tierAccess: { basic: "badge_only", pro: "visible", advanced: "visible" },
    }),
    buildField({
      field: "tvl",
      label: "TVL / protocol fundamentals",
      canonicalProvider: "DefiLlama protocol / chain lane",
      allowedProviders: [
        "DefiLlama",
        "Token Terminal planned",
        "Artemis planned",
      ],
      plannedProviders: ["Token Terminal", "Artemis"],
      providerIds: ["defillama"],
      confirmedEvidence: confirmedByField(sourceSync, [
        "tvl",
        "protocol",
        "chain",
      ]),
      missingEvidence: unique([
        ...missingByField(sourceSync, ["tvl", "protocol", "chain"]),
        "TVL methodology note",
      ]),
      forbiddenUses: [
        "TVL is context, not a safety certificate or exit-depth proof.",
      ],
      freshnessTargetSeconds: 900,
      tierAccess: { basic: "badge_only", pro: "visible", advanced: "visible" },
    }),
    buildField({
      field: "chart_history",
      label: "Chart history / 2Y-5Y-MAX continuity",
      canonicalProvider:
        "CoinGecko market_chart with second overlay where possible",
      allowedProviders: [
        "CoinGecko market_chart",
        "CoinGecko OHLC",
        "Binance klines",
        "GeckoTerminal pool OHLCV",
        "manual CSV backfill with checksum",
      ],
      providerIds: ["coingecko", "binance", "dexscreener"],
      confirmedEvidence: unique([
        chartPoints > 0 && `${chartPoints} chart points`,
        ...(chartOverlay?.providerOverlays
          .filter((lane) => lane.state === "ready" || lane.state === "watch")
          .map((lane) => lane.label) ?? []),
      ]),
      missingEvidence: unique([
        ...(chartMissing.length ? chartMissing : []),
        chartPoints <= 0 && "canonical chart points",
      ]),
      forbiddenUses: [
        "Never stretch a 7d sparkline into 2Y/5Y macro commentary.",
      ],
      freshnessTargetSeconds: 3_600,
      tierAccess: { basic: "badge_only", pro: "visible", advanced: "visible" },
    }),
    buildField({
      field: "cex_depth",
      label: "CEX order-book depth",
      canonicalProvider: "Binance depth + second venue planned",
      allowedProviders: ["Binance", "MEXC planned", "Coinbase/Kraken planned"],
      plannedProviders: ["MEXC", "Coinbase", "Kraken"],
      providerIds: ["binance"],
      confirmedEvidence: confirmedByField(sourceSync, [
        "depth",
        "order-book",
        "orderbook",
      ]),
      missingEvidence: unique([
        ...missingByField(sourceSync, ["depth", "order-book", "orderbook"]),
        "second venue depth",
        "10k/50k sell shock replay",
      ]),
      forbiddenUses: ["One venue depth cannot prove global liquidity."],
      freshnessTargetSeconds: 30,
      tierAccess: { basic: "locked", pro: "badge_only", advanced: "visible" },
    }),
    buildField({
      field: "dex_pool_ohlcv",
      label: "DEX pool OHLCV",
      canonicalProvider:
        "GeckoTerminal pool OHLCV + DEX Screener pair snapshot",
      allowedProviders: [
        "GeckoTerminal",
        "DEX Screener",
        "Bitquery DEX trades planned",
      ],
      plannedProviders: ["Bitquery DEX trades"],
      providerIds: ["dexscreener"],
      confirmedEvidence: unique(
        chartOverlay?.providerOverlays
          .filter(
            (lane) =>
              lane.provider === "geckoterminal_pool_ohlcv" &&
              lane.state !== "blocked",
          )
          .map((lane) => lane.label) ?? [],
      ),
      missingEvidence: unique([
        "network + pool address",
        "pool OHLCV payload",
        "pair event history",
      ]),
      forbiddenUses: [
        "Pool OHLCV must be labeled by pool address; pools can diverge.",
      ],
      freshnessTargetSeconds: 120,
      tierAccess: { basic: "locked", pro: "badge_only", advanced: "visible" },
    }),
    buildField({
      field: "holder_graph",
      label: "Holder graph / wallet concentration",
      canonicalProvider:
        "Bitquery holders planned + security provider snapshot",
      allowedProviders: [
        "Bitquery holders",
        "GoPlus/security provider",
        "Etherscan labels planned",
      ],
      plannedProviders: ["Bitquery holders", "Etherscan labels"],
      providerIds: ["goplus"],
      confirmedEvidence: confirmedByField(sourceSync, ["holder"]),
      missingEvidence: unique([
        ...missingByField(sourceSync, ["holder"]),
        "CEX/team/LP labels",
        "holder history",
      ]),
      forbiddenUses: [
        "Missing holder data is uncertainty, not proof of safety or danger.",
      ],
      freshnessTargetSeconds: 3_600,
      tierAccess: { basic: "locked", pro: "badge_only", advanced: "visible" },
    }),
    buildField({
      field: "contract_security",
      label: "Contract security / taxes / privileged roles",
      canonicalProvider:
        "GoPlus/security provider + source verification snapshot",
      allowedProviders: [
        "GoPlus",
        "Etherscan/Sourcify planned",
        "manual audit report",
      ],
      plannedProviders: ["Etherscan", "Sourcify"],
      providerIds: ["goplus"],
      confirmedEvidence: confirmedByField(sourceSync, [
        "tax",
        "honeypot",
        "mint",
        "admin",
        "contract",
      ]),
      missingEvidence: unique([
        ...missingByField(sourceSync, ["contract", "tax", "holder"]),
        "verified source hash",
        "privileged role timeline",
      ]),
      forbiddenUses: [
        "Do not expose exploit instructions; show safe remediation/missing proof only.",
      ],
      freshnessTargetSeconds: 86_400,
      tierAccess: { basic: "badge_only", pro: "visible", advanced: "visible" },
    }),
    buildField({
      field: "pdf_parity",
      label: "PDF preview/download parity",
      canonicalProvider: "Velmère canonical source packet hash",
      allowedProviders: [
        "sourceFingerprint",
        "payload fingerprint",
        "PDF preview",
        "PDF download",
      ],
      providerIds: [],
      confirmedEvidence: unique([
        tierEvidence?.sourceFingerprint &&
          `sourceFingerprint ${tierEvidence.sourceFingerprint}`,
        args.payloadFingerprint && `payload ${args.payloadFingerprint}`,
      ]),
      missingEvidence: unique([
        !tierEvidence?.sourceFingerprint && "sourceFingerprint",
        ...advancedTierMissing.filter((item) =>
          item.toLowerCase().includes("pdf"),
        ),
      ]),
      forbiddenUses: [
        "Preview and downloaded PDF must not use different payloads or different language lanes.",
      ],
      freshnessTargetSeconds: 0,
      tierAccess: { basic: "badge_only", pro: "visible", advanced: "visible" },
    }),
  ];

  const blockedFields = fieldLedger.filter(
    (field) => field.state === "blocked",
  );
  const watchFields = fieldLedger.filter((field) => field.state === "watch");
  const score = clamp(
    100 -
      blockedFields.length * 8 -
      watchFields.length * 3 +
      Math.min(8, (sourceSync?.sourceCount ?? 0) * 2),
  );
  const state: Pass2451LedgerState =
    blockedFields.length >= 5 ? "blocked" : score >= 82 ? "ready" : "watch";
  const staleFields = fieldLedger
    .filter(
      (field) =>
        field.observedAt === null &&
        field.freshnessTargetSeconds > 0 &&
        field.state !== "blocked",
    )
    .map((field) => field.label);
  const freshnessState: Pass2451LedgerState =
    staleFields.length > 5 ? "blocked" : staleFields.length ? "watch" : "ready";

  return {
    version: "data-provenance-ledger-v1",
    state,
    score,
    query: args.query ?? sourceSync?.query,
    symbol: args.symbol ?? sourceSync?.symbol,
    fieldLedger,
    sourceHealth: (sourceSync?.lanes ?? []).map((lane) => ({
      provider: lane.label,
      state: lane.state,
      confirmedFields: lane.confirmedFields,
      missingFields: lane.missingFields,
      observedAt: lane.observedAt ?? null,
      cadence: lane.cadence,
      boundary: lane.boundary,
    })),
    freshnessEnvelope: {
      state: freshnessState,
      maxStaleFields: 2,
      staleFields,
      timecodeRule:
        "Every visible numeric field should show provider, field role and observedAt/max-age; if unavailable, show missing timestamp instead of treating the value as live.",
    },
    advancedLocks: unique([
      ...blockedFields.map(
        (field) =>
          `${field.label}: ${field.missingEvidence.slice(0, 2).join(", ")}`,
      ),
      ...advancedTierMissing.slice(0, 8),
    ]).slice(0, 14),
    surfaceMounts: [
      "Shield row: provider/timecode badge beside price and risk",
      "Real Markets modal: cross-asset source field labels",
      "VLM Brain: Data Provenance tab before conclusion",
      "Browser compact result: one-line provider/missing proof",
      "PDF preview/download: identical sourceFingerprint and locale",
      "Angel: answer order data provenance -> missing proof -> safe conclusion",
    ],
    riskEngineRules: [
      "Risk score cannot increase because a field is missing; missing fields only cap confidence and add review tasks.",
      "Provider roles are exclusive: TVL cannot prove security, volume cannot prove exit liquidity, FDV cannot replace market cap.",
      "Advanced can show paid-grade missing proof; it must not create filler when holders/depth/chart overlays are absent.",
      "Any manual/operator backfill must include source URL, checksum, timestamp and visible manual label.",
    ],
    nextWorldClassIntegrations: [
      "Bitquery live holder/transfer graph for ERC-20 and Solana SPL tokens.",
      "MEXC/Coinbase/Kraken second venue candle/depth adapters for large caps.",
      "Token Terminal/Artemis normalized fees/revenue/fundamentals for protocols.",
      "Sourcify/Etherscan verified source hash lane for contract security.",
      "PDF hash parity verifier across PL/EN/DE and preview/download.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
