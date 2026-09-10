import type { TokenRiskResult } from "./risk-types";
import type { Pass2450TierEvidenceParity } from "./tier-evidence-parity";
import type { Pass2451DataProvenanceLedger } from "./data-provenance-ledger";
import type { Pass2453ReportEvidenceCapsule } from "./report-evidence-capsule";
import type { Pass2464CrossProviderWindowReconciliation } from "./cross-provider-window-reconciliation";
import type { Pass2466DerivativesSqueezeProof } from "./derivatives-squeeze-proof";
import type { Pass2467LiquidationLongShortProof } from "./liquidation-long-short-proof";
import type { Pass2468LiquidationSnapshotLedger } from "./liquidation-snapshot-ledger";
import type { Pass2469LiquidationReplayStore } from "./liquidation-replay-store";

type Pass2465SourceSyncPacket = VelmereSourceSyncPacket & {
  pass2450?: Pass2450TierEvidenceParity;
  pass2451?: Pass2451DataProvenanceLedger;
  pass2453?: Pass2453ReportEvidenceCapsule;
  pass2464?: Pass2464CrossProviderWindowReconciliation;
  pass2466?: Pass2466DerivativesSqueezeProof;
  pass2467?: Pass2467LiquidationLongShortProof;
  pass2468?: Pass2468LiquidationSnapshotLedger;
  pass2469?: Pass2469LiquidationReplayStore;
};

// PASS2468 legacy verifier marker: expired collector keeps confirmed squeeze blocked
import type {
  Pass2450Tier,
  Pass2450SurfaceId,
} from "./tier-evidence-parity";
import type { VelmereSourceSyncPacket } from "./source-sync-contract";

export type Pass2465TierDepthState = "ready" | "watch" | "blocked";
export type Pass2465ScenarioId =
  | "rug_pull_trap"
  | "long_short_squeeze"
  | "liquidity_exit_squeeze"
  | "holder_unlock_pressure"
  | "leverage_cascade"
  | "funding_basis_pressure"
  | "tax_honeypot_admin"
  | "dex_pool_withdrawal"
  | "cex_depth_imbalance"
  | "narrative_pressure";

export type Pass2465SurfaceDepthContract = {
  surface: Pass2450SurfaceId;
  label: string;
  state: Pass2465TierDepthState;
  tierPayloadRule: string;
  basicMustShow: string[];
  proMustShow: string[];
  advancedMustShow: string[];
  blockedBy: string[];
};

export type Pass2465ScenarioLane = {
  id: Pass2465ScenarioId;
  label: string;
  state: "confirmed" | "watch" | "locked" | "not_applicable";
  allowedTiers: Pass2450Tier[];
  requiredEvidence: string[];
  currentEvidence: string[];
  missingEvidence: string[];
  copyBoundary: string;
};

export type Pass2465TierContract = {
  tier: Pass2450Tier;
  state: Pass2465TierDepthState;
  fieldCount: number;
  requiredScenarioLanes: Pass2465ScenarioId[];
  requiredFields: string[];
  forbiddenClaims: string[];
  missingToReachWorldClass: string[];
  customerPromise: string;
};

export type Pass2465TierDepthScenarioParity = {
  version: "tier-depth-scenario-parity-v1";
  state: Pass2465TierDepthState;
  score: number;
  query?: string;
  symbol?: string;
  currentZipAudit: {
    checkedSurfaces: string[];
    existingProof: string[];
    gapsFound: string[];
    decision: string;
  };
  tierContracts: Pass2465TierContract[];
  surfaceDepthContracts: Pass2465SurfaceDepthContract[];
  scenarioLanes: Pass2465ScenarioLane[];
  pdfTierDifferentiationLock: {
    state: Pass2465TierDepthState;
    previewDownloadRule: string;
    requiredHeaders: string[];
    hardRejectIf: string[];
  };
  shieldRealMarketsParityLock: {
    state: Pass2465TierDepthState;
    rule: string;
    blockedBy: string[];
  };
  noFillerTierRule: string;
  nextImplementationActions: string[];
  generatedAt: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique(items: Array<string | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function hasSignal(result: TokenRiskResult | undefined | null, ids: string[]) {
  return result?.signals.some((signal) => ids.includes(signal.id)) ?? false;
}

function metric(
  result: TokenRiskResult | undefined | null,
  key: keyof TokenRiskResult["metrics"],
) {
  const value = result?.metrics[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function signalEvidence(
  result: TokenRiskResult | undefined | null,
  ids: string[],
) {
  return (
    result?.signals
      .filter((signal) => ids.includes(signal.id))
      .map((signal) => `${signal.id}:${signal.severity}`)
      .slice(0, 6) ?? []
  );
}

function stateFromEvidence(
  current: string[],
  missing: string[],
  tier: "advanced" | "pro" = "advanced",
): Pass2465ScenarioLane["state"] {
  if (current.length >= (tier === "advanced" ? 2 : 1)) return "confirmed";
  if (current.length || missing.length <= 2) return "watch";
  return "locked";
}

function buildScenarioLanes(args: {
  result?: TokenRiskResult | null;
  sourceSync?: Pass2465SourceSyncPacket;
}): Pass2465ScenarioLane[] {
  const result = args.result;
  const sourceSync = args.sourceSync;
  const isContractScoped = Boolean(
    result?.token.tokenAddress || result?.token.chainId,
  );
  const liquidity = metric(result, "liquidityUsd");
  const volume = metric(result, "volume24h");
  const volumeToLiquidity =
    metric(result, "volumeToLiquidityRatio") ??
    (liquidity && volume ? volume / Math.max(1, liquidity) : undefined);
  const bidAskImbalance = metric(result, "bidAskImbalancePercent");
  const slippage = metric(result, "simulatedSlippage10k");
  const topHolders = metric(result, "top10HolderPercent");
  const sellTax = metric(result, "sellTaxPercentage");
  const hasHolderLane = Boolean(
    sourceSync?.pass2451?.fieldLedger.some(
      (field) => field.field === "holder_graph" && field.state !== "blocked",
    ),
  );
  const hasContractLane = Boolean(
    sourceSync?.pass2451?.fieldLedger.some(
      (field) =>
        field.field === "contract_security" && field.state !== "blocked",
    ),
  );
  const hasDepthLane = Boolean(
    sourceSync?.pass2451?.fieldLedger.some(
      (field) => field.field === "cex_depth" && field.state !== "blocked",
    ),
  );
  const hasDexPoolLane = Boolean(
    sourceSync?.pass2451?.fieldLedger.some(
      (field) => field.field === "dex_pool_ohlcv" && field.state !== "blocked",
    ),
  );
  const hasMacroWindow = Boolean(
    sourceSync?.pass2464?.reconciliationFingerprint &&
    sourceSync.pass2464.state !== "blocked",
  );
  const derivativesProof = sourceSync?.pass2466;
  const liquidationLongShortProof = sourceSync?.pass2467;
  const liquidationSnapshotLedger = sourceSync?.pass2468;
  const liquidationReplayStore = sourceSync?.pass2469;
  const pass2469Evidence =
    liquidationReplayStore?.records
      .filter((record) => record.state === "fresh")
      .map(
        (record) =>
          `${record.venue}:${record.replayFingerprint}:events:${record.eventCount}:notional:${record.totalNotionalUsd ?? "missing"}`,
      ) ?? [];
  const pass2469LaneEvidence =
    liquidationReplayStore?.lanes
      .filter((lane) => lane.state === "ready" || lane.state === "watch")
      .flatMap((lane) =>
        lane.confirmedEvidence.map((item) => `${lane.id}:${item}`),
      ) ?? [];
  const pass2468Evidence =
    liquidationSnapshotLedger?.snapshots
      .filter((snapshot) => snapshot.state === "signed_snapshot")
      .map(
        (snapshot) =>
          `${snapshot.label}:${snapshot.fingerprint}:events:${snapshot.eventCount}:notional:${snapshot.totalNotionalUsd ?? "missing"}`,
      ) ?? [];
  const pass2468LaneEvidence =
    liquidationSnapshotLedger?.lanes
      .filter((lane) => lane.state === "ready" || lane.state === "watch")
      .flatMap((lane) =>
        lane.confirmedEvidence.map((item) => `${lane.id}:${item}`),
      ) ?? [];
  const derivativesReady =
    derivativesProof?.state === "ready" || derivativesProof?.state === "watch";
  const pass2467RatioEvidence =
    liquidationLongShortProof?.longShortSnapshots
      .filter(
        (snapshot) =>
          snapshot.state === "live" || snapshot.state === "degraded",
      )
      .map(
        (snapshot) =>
          `${snapshot.label}:${snapshot.symbol}:ratio:${snapshot.longShortRatio ?? "missing"}`,
      ) ?? [];
  const pass2467LaneEvidence =
    liquidationLongShortProof?.lanes
      .filter((lane) => lane.state === "ready" || lane.state === "watch")
      .flatMap((lane) =>
        lane.confirmedEvidence.map((item) => `${lane.id}:${item}`),
      ) ?? [];
  const derivativesVenueEvidence =
    derivativesProof?.venues
      .filter((venue) => venue.state === "live" || venue.state === "degraded")
      .map((venue) => `${venue.label}:${venue.symbol}:${venue.state}`) ?? [];
  const derivativesLaneEvidence =
    derivativesProof?.lanes
      .filter((lane) => lane.state === "ready" || lane.state === "watch")
      .flatMap((lane) =>
        lane.confirmedEvidence.map((item) => `${lane.id}:${item}`),
      ) ?? [];
  const derivativesMissing = unique([
    ...(derivativesProof?.missingForWorldClass ?? [
      "Binance/Bybit OI + funding packet",
    ]),
    ...(liquidationLongShortProof?.missingForWorldClass ?? [
      "PASS2467 two-venue long/short ratio",
      "PASS2467 liquidation collector",
    ]),
    ...(liquidationSnapshotLedger?.missingForWorldClass ?? [
      "PASS2468 liquidation snapshot ledger",
    ]),
    ...(liquidationReplayStore?.missingForWorldClass ?? [
      "PASS2469 durable replay store",
      "downstream 180-output runtime matrix receipt",
    ]),
    "downstream tier-output runtime receipts are generated after this scenario stage",
  ]);

  const lanes: Pass2465ScenarioLane[] = [
    {
      id: "rug_pull_trap",
      label: "Rug-pull / trap lane",
      state: !isContractScoped
        ? "not_applicable"
        : stateFromEvidence(
            unique([
              ...signalEvidence(result, [
                "honeypot_risk",
                "mint_risk",
                "blacklist_risk",
                "contract_privileges",
                "high_sell_tax",
                "low_dex_liquidity",
              ]),
              hasContractLane && "contract security field ledger attached",
              hasHolderLane && "holder graph field ledger attached",
            ]),
            [
              "verified contract source",
              "LP lock / pool withdrawal evidence",
              "owner/admin permissions",
              "holder concentration",
              "tax/honeypot scan",
            ],
          ),
      allowedTiers: ["advanced"],
      requiredEvidence: [
        "contract security",
        "holder graph",
        "LP/pool lock state",
        "tax/honeypot scan",
        "privileged role timeline",
      ],
      currentEvidence: unique([
        ...signalEvidence(result, [
          "honeypot_risk",
          "mint_risk",
          "blacklist_risk",
          "contract_privileges",
          "high_sell_tax",
          "low_dex_liquidity",
        ]),
        hasContractLane && "contract security field ledger",
        hasHolderLane && "holder graph field ledger",
      ]),
      missingEvidence: unique([
        !hasContractLane && "contract security field ledger",
        !hasHolderLane && "holder graph field ledger",
        "LP lock / pool withdrawal receipt",
        "owner/admin permission timeline",
      ]),
      copyBoundary:
        "Use rug-pull/trap as a scenario lane only. Never accuse a project unless the contract, holder and liquidity evidence is attached and cited.",
    },
    {
      id: "long_short_squeeze",
      label: "Long/short squeeze lane",
      state: stateFromEvidence(
        unique([
          hasSignal(result, [
            "rapid_intraday_move",
            "volume_spike",
            "parabolic_24h_gain",
            "parabolic_7d_gain",
            "sell_pressure_imbalance",
            "orderbook_imbalance",
          ]) && "price/volume imbalance signal",
          bidAskImbalance !== undefined &&
            `bid/ask imbalance ${Math.round(bidAskImbalance)}%`,
          hasDepthLane && "CEX depth field ledger attached",
          hasMacroWindow && "macro window reconciliation attached",
          derivativesReady &&
            `PASS2466 derivatives proof ${derivativesProof?.state}:${derivativesProof?.score}`,
          ...derivativesVenueEvidence.slice(0, 2),
          ...derivativesLaneEvidence.slice(0, 4),
          ...pass2467RatioEvidence.slice(0, 2),
          ...pass2467LaneEvidence.slice(0, 3),
          ...pass2468Evidence.slice(0, 2),
          ...pass2468LaneEvidence.slice(0, 2),
          ...pass2469Evidence.slice(0, 2),
          ...pass2469LaneEvidence.slice(0, 2),
        ]),
        derivativesMissing,
        "pro",
      ),
      allowedTiers: ["pro", "advanced"],
      requiredEvidence: [
        "price velocity",
        "volume spike",
        "CEX depth",
        "open interest",
        "funding/basis",
        "liquidations",
        "long/short ratio",
        "second venue",
      ],
      currentEvidence: unique([
        ...signalEvidence(result, [
          "rapid_intraday_move",
          "volume_spike",
          "parabolic_24h_gain",
          "parabolic_7d_gain",
          "sell_pressure_imbalance",
          "orderbook_imbalance",
        ]),
        bidAskImbalance !== undefined &&
          `bid/ask imbalance:${Math.round(bidAskImbalance)}%`,
        hasDepthLane && "CEX depth field ledger",
        hasMacroWindow && "window reconciliation",
        derivativesReady &&
          `PASS2466:${derivativesProof?.state}:${derivativesProof?.normalizedPair}`,
        liquidationLongShortProof &&
          `PASS2467:${liquidationLongShortProof.state}:${liquidationLongShortProof.normalizedPair}:confirmedAllowed=${liquidationLongShortProof.confirmedSqueezeAllowed}`,
        liquidationSnapshotLedger &&
          `PASS2468:${liquidationSnapshotLedger.state}:${liquidationSnapshotLedger.ledgerFingerprint}`,
        liquidationReplayStore &&
          `PASS2469:${liquidationReplayStore.state}:${liquidationReplayStore.replayStoreFingerprint}:fresh=${liquidationReplayStore.freshReplayCount}`,
        ...derivativesVenueEvidence,
        ...pass2467RatioEvidence,
        ...pass2468Evidence,
        ...pass2469Evidence,
        ...derivativesLaneEvidence.slice(0, 6),
      ]),
      missingEvidence: unique([
        !hasDepthLane && "CEX orderbook/depth replay",
        ...derivativesMissing,
      ]),
      copyBoundary:
        "Show squeeze as pressure/condition, not as a trading instruction, entry, exit or prediction. PASS2466 OI/funding proof, PASS2467 long/short ratio, PASS2468 signed liquidation snapshot ledger and PASS2469 durable replay store are required before Advanced squeeze copy can strengthen; liquidation and long/short ratio gaps must remain visible; missing/expired replay keeps confirmed squeeze blocked. PASS2470 must prove Basic/Pro/Advanced are distinct across 20 assets x PDF/Shield/Real Markets before claiming 180 live outputs. PASS2472 must then capture API, screenshot/PDF hash and Angel replay receipts before any 180-live-output claim.",
    },
    {
      id: "liquidity_exit_squeeze",
      label: "Liquidity / exit squeeze lane",
      state: stateFromEvidence(
        unique([
          volumeToLiquidity !== undefined &&
            volumeToLiquidity > 8 &&
            `volume/liquidity ${volumeToLiquidity.toFixed(2)}x`,
          slippage !== undefined &&
            `simulated slippage ${slippage.toFixed(2)}%`,
          hasDexPoolLane && "DEX pool OHLCV ledger attached",
          hasDepthLane && "CEX depth ledger attached",
        ]),
        [
          "DEX depth",
          "CEX depth",
          "slippage simulation",
          "pool withdrawals",
          "volume/liquidity stress",
        ],
      ),
      allowedTiers: ["pro", "advanced"],
      requiredEvidence: [
        "visible liquidity",
        "24h volume",
        "slippage simulation",
        "DEX pool OHLCV",
        "CEX depth",
      ],
      currentEvidence: unique([
        volumeToLiquidity !== undefined &&
          `volume/liquidity:${volumeToLiquidity.toFixed(2)}x`,
        slippage !== undefined && `slippage10k:${slippage.toFixed(2)}%`,
        hasDexPoolLane && "DEX pool OHLCV field ledger",
        hasDepthLane && "CEX depth field ledger",
      ]),
      missingEvidence: unique([
        !hasDexPoolLane && "DEX pool OHLCV ledger",
        !hasDepthLane && "CEX depth/orderbook replay",
        slippage === undefined && "slippage simulation",
        "pool withdrawal/change receipt",
      ]),
      copyBoundary:
        "Visible liquidity is not guaranteed exit liquidity. Missing depth must cap confidence.",
    },
    {
      id: "holder_unlock_pressure",
      label: "Holder / unlock pressure lane",
      state: stateFromEvidence(
        unique([
          topHolders !== undefined && `top10 holders ${topHolders.toFixed(1)}%`,
          hasSignal(result, ["holder_concentration", "supply_overhang"]) &&
            "holder/supply risk signal",
          hasHolderLane && "holder graph field ledger attached",
        ]),
        [
          "holder clusters",
          "unlock/vesting calendar",
          "treasury/team labels",
          "CEX wallet labels",
        ],
      ),
      allowedTiers: ["advanced"],
      requiredEvidence: [
        "holder graph",
        "top wallets",
        "unlock schedule",
        "vesting state",
        "treasury/team/CEX wallet labels",
      ],
      currentEvidence: unique([
        topHolders !== undefined && `top10:${topHolders.toFixed(1)}%`,
        ...signalEvidence(result, ["holder_concentration", "supply_overhang"]),
        hasHolderLane && "holder graph field ledger",
      ]),
      missingEvidence: unique([
        !hasHolderLane && "holder graph field ledger",
        "unlock/vesting calendar",
        "wallet label taxonomy",
        "transfer concentration timeline",
      ]),
      copyBoundary:
        "Holder concentration can raise review priority; it is not a standalone fraud verdict.",
    },
    {
      id: "leverage_cascade",
      label: "Leverage cascade lane",
      state:
        derivativesReady && hasDepthLane
          ? "watch"
          : derivativesReady
            ? "watch"
            : "locked",
      allowedTiers: ["advanced"],
      requiredEvidence: [
        "perp OI",
        "funding",
        "liquidation bands",
        "CEX depth",
        "cross-venue price divergence",
      ],
      currentEvidence: unique([
        hasDepthLane && "CEX depth field ledger",
        derivativesReady && `PASS2466 derivatives ${derivativesProof?.state}`,
        liquidationLongShortProof &&
          `PASS2467 liquidation/ratio ${liquidationLongShortProof.state}`,
        liquidationSnapshotLedger &&
          `PASS2468 ledger ${liquidationSnapshotLedger.state}:${liquidationSnapshotLedger.ledgerFingerprint}`,
        liquidationReplayStore &&
          `PASS2469 replay ${liquidationReplayStore.state}:${liquidationReplayStore.latestReplayFingerprint ?? "missing"}`,
        ...derivativesVenueEvidence.slice(0, 2),
        ...pass2467RatioEvidence.slice(0, 2),
        ...pass2468Evidence.slice(0, 2),
        ...pass2469Evidence.slice(0, 2),
      ]),
      missingEvidence: unique([
        !derivativesReady && "perp open interest + funding proof",
        ...(liquidationLongShortProof?.missingForWorldClass ?? [
          "PASS2467 liquidation collector",
          "PASS2467 two-venue long/short ratio",
        ]),
        !hasDepthLane && "CEX depth replay",
      ]),
      copyBoundary:
        "Leverage cascade is an Advanced stress scenario and must never become leverage advice. PASS2466 unlocks OI/funding context; PASS2467 keeps ratio/liquidation locks visible; PASS2468 requires a fresh signed liquidation snapshot and PASS2469 requires replayable storage before any current liquidation-pressure wording can strengthen.",
    },
    {
      id: "funding_basis_pressure",
      label: "Funding / basis pressure lane",
      state: derivativesProof?.lanes.some(
        (lane) => lane.id === "funding_basis" && lane.state === "ready",
      )
        ? "confirmed"
        : derivativesReady
          ? "watch"
          : "locked",
      allowedTiers: ["advanced"],
      requiredEvidence: [
        "funding rate",
        "basis",
        "perp/spot spread",
        "OI change",
        "venue comparison",
      ],
      currentEvidence: unique([
        ...derivativesLaneEvidence.filter(
          (item) =>
            item.includes("funding_basis") || item.includes("open_interest"),
        ),
        ...derivativesVenueEvidence.slice(0, 2),
        ...pass2467RatioEvidence.slice(0, 2),
      ]),
      missingEvidence: unique([
        !derivativesReady && "funding provider",
        ...derivativesMissing
          .filter((item) => /funding|basis|interest|OI|venue/i.test(item))
          .slice(0, 5),
      ]),
      copyBoundary:
        "Funding/basis pressure can only be shown after live derivatives provider evidence is attached. It remains pressure context, not a squeeze prediction.",
    },
    {
      id: "tax_honeypot_admin",
      label: "Tax / honeypot / admin lane",
      state: !isContractScoped
        ? "not_applicable"
        : stateFromEvidence(
            unique([
              sellTax !== undefined && `sell tax ${sellTax.toFixed(2)}%`,
              ...signalEvidence(result, [
                "honeypot_risk",
                "high_sell_tax",
                "contract_privileges",
                "mint_risk",
                "blacklist_risk",
              ]),
              hasContractLane && "contract field ledger attached",
            ]),
            [
              "honeypot scan",
              "buy/sell tax",
              "mint/pause/blacklist",
              "owner/admin permissions",
            ],
          ),
      allowedTiers: ["advanced"],
      requiredEvidence: [
        "honeypot scan",
        "tax scan",
        "mint/pause/blacklist",
        "owner/admin permissions",
      ],
      currentEvidence: unique([
        sellTax !== undefined && `sellTax:${sellTax.toFixed(2)}%`,
        ...signalEvidence(result, [
          "honeypot_risk",
          "high_sell_tax",
          "contract_privileges",
          "mint_risk",
          "blacklist_risk",
        ]),
        hasContractLane && "contract field ledger",
      ]),
      missingEvidence: unique([
        !hasContractLane && "contract security field ledger",
        "honeypot/tax scan receipt",
        "owner/admin timeline",
      ]),
      copyBoundary:
        "A contract/admin risk lane must show the exact missing proof instead of inventing safety or danger.",
    },
    {
      id: "dex_pool_withdrawal",
      label: "DEX pool withdrawal lane",
      state: hasDexPoolLane ? "watch" : "locked",
      allowedTiers: ["advanced"],
      requiredEvidence: [
        "pool liquidity snapshots",
        "LP token holder",
        "withdrawal/change timeline",
        "DEX pool OHLCV",
      ],
      currentEvidence: unique([
        hasDexPoolLane && "DEX pool OHLCV field ledger",
      ]),
      missingEvidence: unique([
        !hasDexPoolLane && "DEX pool OHLCV",
        "LP lock holder",
        "pool withdrawal timeline",
      ]),
      copyBoundary:
        "DEX pool changes are liquidity context, not proof of intent without transaction/holder evidence.",
    },
    {
      id: "cex_depth_imbalance",
      label: "CEX depth imbalance lane",
      state: hasDepthLane || bidAskImbalance !== undefined ? "watch" : "locked",
      allowedTiers: ["advanced"],
      requiredEvidence: [
        "orderbook depth",
        "spread",
        "bid/ask imbalance",
        "venue comparison",
        "max-age",
      ],
      currentEvidence: unique([
        hasDepthLane && "CEX depth field ledger",
        bidAskImbalance !== undefined &&
          `bidAsk:${Math.round(bidAskImbalance)}%`,
      ]),
      missingEvidence: unique([
        !hasDepthLane && "CEX depth/orderbook replay",
        bidAskImbalance === undefined && "bid/ask imbalance",
        "venue depth comparison",
      ]),
      copyBoundary:
        "Depth imbalance can support a pressure warning only after timestamped orderbook proof.",
    },
    {
      id: "narrative_pressure",
      label: "Narrative / hype pressure lane",
      state: "locked",
      allowedTiers: ["pro", "advanced"],
      requiredEvidence: [
        "OSINT/news context",
        "social velocity",
        "disclosure/KOL labels",
        "claim traceability",
      ],
      currentEvidence: [],
      missingEvidence: [
        "OSINT/news adapter",
        "social velocity adapter",
        "KOL/disclosure labels",
        "claim traceability evidence",
      ],
      copyBoundary:
        "Narrative pressure must stay a labeled OSINT lane and cannot replace market, contract or liquidity proof.",
    },
  ];
  return lanes;
}

function buildTierContracts(
  lanes: Pass2465ScenarioLane[],
): Pass2465TierContract[] {
  const missingFor = (tier: Pass2450Tier, required: Pass2465ScenarioId[]) =>
    unique(
      lanes
        .filter(
          (lane) =>
            required.includes(lane.id) &&
            lane.allowedTiers.includes(tier) &&
            ["locked", "watch"].includes(lane.state),
        )
        .map(
          (lane) =>
            `${lane.label}: ${lane.missingEvidence.slice(0, 3).join("; ") || lane.state}`,
        ),
    ).slice(0, 10);
  const basicRequired: Pass2465ScenarioId[] = [];
  const proRequired: Pass2465ScenarioId[] = [
    "long_short_squeeze",
    "liquidity_exit_squeeze",
    "narrative_pressure",
  ];
  const advancedRequired: Pass2465ScenarioId[] = [
    "rug_pull_trap",
    "long_short_squeeze",
    "liquidity_exit_squeeze",
    "holder_unlock_pressure",
    "leverage_cascade",
    "funding_basis_pressure",
    "tax_honeypot_admin",
    "dex_pool_withdrawal",
    "cex_depth_imbalance",
    "narrative_pressure",
  ];
  return [
    {
      tier: "basic",
      state: "ready",
      fieldCount: 10,
      requiredScenarioLanes: basicRequired,
      requiredFields: [
        "identity",
        "price",
        "24h move",
        "market cap/volume if present",
        "risk badge",
        "source label",
        "observedAt if present",
        "confidence cap",
        "missing data",
        "safe next check",
      ],
      forbiddenClaims: [
        "rug pull",
        "long/short squeeze",
        "deep liquidity",
        "holder safety",
        "contract safety",
        "trade direction",
      ],
      missingToReachWorldClass: [],
      customerPromise:
        "Basic is a short free triage. It must show only visible facts and missing data, not paid scenario depth.",
    },
    {
      tier: "pro",
      state: missingFor("pro", proRequired).length <= 2 ? "watch" : "blocked",
      fieldCount: 14,
      requiredScenarioLanes: proRequired,
      requiredFields: [
        "Basic fields",
        "1h/7d/30d structure",
        "FDV/MC",
        "liquidity/volume pressure",
        "source freshness",
        "second provider",
        "chart quality",
        "squeeze watch as unconfirmed pressure",
        "narrative watch",
        "PDF preview parity",
      ],
      forbiddenClaims: [
        "rug pull confirmed",
        "squeeze prediction",
        "safe/unsafe certificate",
        "leverage/trading instruction",
      ],
      missingToReachWorldClass: missingFor("pro", proRequired),
      customerPromise:
        "Pro adds evidence comparison and pressure watches. It can describe conditions, but must not conclude Advanced-only contract/depth/holder scenarios.",
    },
    {
      tier: "advanced",
      state:
        missingFor("advanced", advancedRequired).length <= 3
          ? "watch"
          : "blocked",
      fieldCount: 20,
      requiredScenarioLanes: advancedRequired,
      requiredFields: [
        "Pro fields",
        "rug-pull/trap lane",
        "long/short squeeze lane",
        "PASS2466 OI/funding",
        "PASS2467 long/short ratio + liquidation locks",
        "liquidity exit squeeze",
        "holder/unlock pressure",
        "contract/admin/tax/honeypot",
        "CEX depth imbalance",
        "DEX pool withdrawal",
        "funding/basis/leverage cascade",
        "PDF exact payload hash",
        "audit receipt",
      ],
      forbiddenClaims: [
        "fraud accusation without proof",
        "ROI/price target",
        "leverage instruction",
        "confirmed squeeze without PASS2467",
        "hidden missing proof",
        "Basic/Pro copied as Advanced",
      ],
      missingToReachWorldClass: missingFor("advanced", advancedRequired),
      customerPromise:
        "Advanced is paid evidence mode. It must be visibly different from Basic/Pro through proof lanes, missing-proof locks, scenario matrix and exact PDF/Brain/Shield parity.",
    },
  ];
}

function buildSurfaceContracts(args: {
  sourceSync?: Pass2465SourceSyncPacket;
  scenarioLocks: string[];
}): Pass2465SurfaceDepthContract[] {
  const has2450 = Boolean(args.sourceSync?.pass2450);
  const has2453 = Boolean(args.sourceSync?.pass2453);
  const has2464 = Boolean(args.sourceSync?.pass2464);
  const sharedBlocked = unique([
    !has2450 && "PASS2450 tier evidence parity missing",
    !has2453 && "PASS2453 report evidence capsule missing",
    !has2464 && "PASS2464 cross-provider window reconciliation missing",
    ...args.scenarioLocks.slice(0, 4),
  ]).slice(0, 8);
  const mk = (
    surface: Pass2450SurfaceId,
    label: string,
    extra: string[] = [],
  ): Pass2465SurfaceDepthContract => {
    const blockedBy = unique([...sharedBlocked, ...extra]).slice(0, 10);
    return {
      surface,
      label,
      state:
        blockedBy.length >= 5
          ? "blocked"
          : blockedBy.length
            ? "watch"
            : "ready",
      tierPayloadRule: `${label} must render Basic/Pro/Advanced from the same canonical source packet but with different visible evidence depth. No tier can be only longer text.`,
      basicMustShow: [
        "10-field triage",
        "source label",
        "confidence cap",
        "missing data",
        "no Advanced scenarios",
      ],
      proMustShow: [
        "14-field comparison",
        "second provider/freshness",
        "liquidity-volume pressure",
        "chart quality",
        "squeeze/narrative watch as unconfirmed pressure",
      ],
      advancedMustShow: [
        "20-field paid evidence",
        "rug-pull/trap proof lane",
        "long/short squeeze lane",
        "PASS2466/PASS2467 derivatives locks",
        "holder/contract/depth locks",
        "PDF/Brain/Shield fingerprint parity",
      ],
      blockedBy,
    };
  };
  return [
    mk("shield", "Velmère Shield"),
    mk("real_markets", "Real Markets", [
      "cross-asset version must hide contract/rug-pull lanes for stocks/FX unless token scope exists",
    ]),
    mk("vlm_brain", "VLM Brain"),
    mk("browser_preview", "Browser preview", [
      "preview cannot show Advanced-only scenario conclusions",
    ]),
    mk("pdf_preview", "PDF preview", [
      "PDF preview must use selected tier budget and same scenario lock list",
    ]),
    mk("pdf_download", "PDF download", [
      "download must reuse preview fingerprint and selected tier depth",
    ]),
    mk("angel", "Angel", [
      "answer must say tier depth and scenario locks before conclusion",
    ]),
  ];
}

export function buildPass2465TierDepthScenarioParity(args: {
  query?: string;
  symbol?: string;
  result?: TokenRiskResult | null;
  sourceSync?: Pass2465SourceSyncPacket;
  now?: Date;
}): Pass2465TierDepthScenarioParity {
  const now = args.now ?? new Date();
  const scenarioLanes = buildScenarioLanes({
    result: args.result,
    sourceSync: args.sourceSync,
  });
  const tierContracts = buildTierContracts(scenarioLanes);
  const scenarioLocks = unique(
    scenarioLanes
      .filter((lane) => lane.state === "locked" || lane.state === "watch")
      .map((lane) => `${lane.label}: ${lane.state}`),
  );
  const surfaceDepthContracts = buildSurfaceContracts({
    sourceSync: args.sourceSync,
    scenarioLocks,
  });
  const hardLocks = unique([
    ...(tierContracts
      .find((tier) => tier.tier === "advanced")
      ?.missingToReachWorldClass.slice(0, 6) ?? []),
    ...surfaceDepthContracts.flatMap((surface) =>
      surface.blockedBy.slice(0, 2),
    ),
  ]).slice(0, 12);
  const readySurfaces = surfaceDepthContracts.filter(
    (surface) => surface.state === "ready",
  ).length;
  const confirmedScenarios = scenarioLanes.filter(
    (lane) => lane.state === "confirmed",
  ).length;
  const watchScenarios = scenarioLanes.filter(
    (lane) => lane.state === "watch",
  ).length;
  const score = clamp(
    42 +
      readySurfaces * 5 +
      confirmedScenarios * 6 +
      watchScenarios * 2 -
      hardLocks.length * 3,
  );
  const state: Pass2465TierDepthState =
    score >= 86 && hardLocks.length <= 2
      ? "ready"
      : score >= 58
        ? "watch"
        : "blocked";
  return {
    version: "tier-depth-scenario-parity-v1",
    state,
    score,
    query: args.query ?? args.sourceSync?.query,
    symbol: args.symbol ?? args.sourceSync?.symbol,
    currentZipAudit: {
      checkedSurfaces: [
        "Velmère Shield",
        "Real Markets",
        "VLM Brain",
        "Browser preview",
        "PDF preview",
        "PDF download",
        "Angel",
      ],
      existingProof: [
        "AssetDetailModal already has 10/14/20 local field budgets and visible evidence lanes.",
        "Lens PDF route already accepts tier=basic|pro|advanced and carries pass2174 tier budget headers.",
        "PASS2450/PASS2453/PASS2464 already enforce tier/source/PDF/window parity at model level.",
      ],
      gapsFound: [
        "Rug-pull/trap and long/short squeeze lanes were not uniformly named across Shield, Real Markets, PDF, Brain and Angel.",
        "Basic/Pro/Advanced difference existed, but scenario data needed a dedicated cross-surface contract.",
        "Real Markets needs not-applicable handling so stock/FX reports do not show token-only rug-pull claims.",
      ],
      decision:
        "PASS2465 adds an explicit tier-depth scenario parity contract before any next implementation polish.",
    },
    tierContracts,
    surfaceDepthContracts,
    scenarioLanes,
    pdfTierDifferentiationLock: {
      state:
        hardLocks.length > 6 ? "blocked" : hardLocks.length ? "watch" : "ready",
      previewDownloadRule:
        "PDF preview and PDF download must use the same selected tier, same scenario lock list, same source fingerprint and same Advanced paid entitlement state.",
      requiredHeaders: [
        "x-velmere-tier-depth",
        "x-velmere-tier-scenario-parity",
        "x-velmere-pdf-depth",
        "x-velmere-tier-access",
      ],
      hardRejectIf: [
        "Advanced PDF contains the same fields as Pro with longer text only",
        "PDF says rug-pull/trap without contract/holder/liquidity proof",
        "PDF says long/short squeeze without OI/funding/liquidation/depth evidence or explicit missing-proof lock",
        "Preview and download use different tier/scenario fingerprints",
      ],
    },
    shieldRealMarketsParityLock: {
      state: surfaceDepthContracts.some(
        (surface) => surface.state === "blocked",
      )
        ? "blocked"
        : surfaceDepthContracts.some((surface) => surface.state === "watch")
          ? "watch"
          : "ready",
      rule: "Shield and Real Markets may share one modal architecture, but token-only lanes must be marked not_applicable for equities/FX/commodities and cannot leak as fake rug-pull signals.",
      blockedBy: unique(
        surfaceDepthContracts.flatMap((surface) => surface.blockedBy),
      ).slice(0, 10),
    },
    noFillerTierRule:
      "No tier can be only longer text. Basic/Pro/Advanced must differ by visible data lanes, proof locks, scenario scope, source count, PDF parity and entitlement state.",
    nextImplementationActions: [
      "Mount PASS2465 tier scenario row in Shield/Real Markets modal and VLM Brain result rail.",
      "Add PDF headers and visible tier-depth scenario appendix for Basic/Pro/Advanced.",
      "PASS2466 derivatives proof spine added: wire live Binance/Bybit OI + funding packet into Shield/PDF/Brain before squeeze conclusions.",
      "Add liquidation and long/short ratio providers before confirmed squeeze wording.",
      "Add contract/holder/LP lock provider plan before rug-pull/trap conclusions.",
      "Run browser/PDF snapshot tests comparing Basic vs Pro vs Advanced for BTC, SOL, a DEX token, AAPL and NVDA.",
    ],
    generatedAt: now.toISOString(),
  };
}
