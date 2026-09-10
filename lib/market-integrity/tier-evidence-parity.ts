import { sha256Token } from "../security/cryptographic-digest";
import type { Pass2449ChartOverlayReconciler } from "./chart-overlay-reconciler";
import type { VelmereSourceSyncPacket } from "./source-sync-contract";

type Pass2450SourceSyncPacket = Omit<VelmereSourceSyncPacket, "pass2449"> & {
  pass2444?: { blockers: string[]; score?: number };
  pass2446?: { score?: number };
  pass2449?: Pass2449ChartOverlayReconciler;
};

export type Pass2450Tier = "basic" | "pro" | "advanced";
export type Pass2450State = "ready" | "watch" | "blocked";
export type Pass2450SurfaceId =
  | "shield"
  | "real_markets"
  | "vlm_brain"
  | "browser_preview"
  | "pdf_preview"
  | "pdf_download"
  | "angel";

export type Pass2450TierContract = {
  tier: Pass2450Tier;
  state: Pass2450State;
  minSourceCount: number;
  valuePromise: string;
  visibleFields: string[];
  requiredProof: string[];
  missingProof: string[];
  copyBoundary: string;
};

export type Pass2450SurfaceContract = {
  surface: Pass2450SurfaceId;
  label: string;
  state: Pass2450State;
  mustSharePayloadWith: string[];
  requiredMounts: string[];
  attachedProof: string[];
  missingProof: string[];
  driftAction: string;
};

export type Pass2450TierEvidenceParity = {
  version: "tier-evidence-parity-v1";
  state: Pass2450State;
  score: number;
  query?: string;
  symbol?: string;
  range?: string;
  sourceFingerprint: string;
  sourceSyncState: string;
  tierContracts: Pass2450TierContract[];
  surfaceContracts: Pass2450SurfaceContract[];
  missingForWorldClass: string[];
  hardRules: string[];
  innovationBacklog: string[];
  uiBadges: string[];
  generatedAt: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique(items: Array<string | null | undefined | false>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function tinyHash(input: unknown) {
  return `p2450_${sha256Token(JSON.stringify(input), 16)}`;
}

function stateFromMissing(score: number, missing: string[]): Pass2450State {
  if (score >= 84 && missing.length <= 2) return "ready";
  if (score >= 58 && missing.length <= 8) return "watch";
  return "blocked";
}

function getAdvancedBlockers(
  sourceSync?: Pass2450SourceSyncPacket,
  chartOverlay?: Pass2449ChartOverlayReconciler,
) {
  return unique([
    ...(sourceSync?.pass2444?.blockers ?? []),
    ...(sourceSync?.pass2445?.fieldSla
      ?.filter((field) => field.status === "blocked")
      .map((field) => `SLA: ${field.label}`) ?? []),
    ...(sourceSync?.pass2447?.tierLocks.find((tier) => tier.tier === "advanced")
      ?.blockedBy ?? []),
    ...(sourceSync?.pass2448?.fieldContracts
      .filter((field) => field.currentState === "blocked")
      .map((field) => `methodology: ${field.label}`) ?? []),
    ...(chartOverlay?.tierLocks.find((tier) => tier.tier === "advanced")
      ?.blockedBy ?? []),
    ...(sourceSync?.pass2449?.tierLocks.find((tier) => tier.tier === "advanced")
      ?.blockedBy ?? []),
  ]).slice(0, 18);
}

function buildTierContracts(args: {
  sourceSync?: Pass2450SourceSyncPacket;
  chartOverlay?: Pass2449ChartOverlayReconciler;
  payloadFingerprint?: string;
}): Pass2450TierContract[] {
  const sourceCount = args.sourceSync?.sourceCount ?? 0;
  const sourceMissing = args.sourceSync?.missingForWorldClass ?? [];
  const advancedBlockers = getAdvancedBlockers(
    args.sourceSync,
    args.chartOverlay,
  );
  const hasChart = Boolean(
    (args.chartOverlay?.windowContract.actualPoints ??
      args.sourceSync?.pass2449?.windowContract.actualPoints ??
      0) > 0,
  );
  const hasFingerprint = Boolean(args.payloadFingerprint);
  const basicMissing = unique([
    sourceCount < 1 && "one live/partial market provider",
    !hasChart && "visible chart path",
    sourceMissing.find((item) => item.toLowerCase().includes("price")) &&
      "price proof",
  ]);
  const proMissing = unique([
    sourceCount < 2 && "second source lane",
    ...(args.sourceSync?.pass2447?.state === "blocked"
      ? ["field consensus radar"]
      : []),
    ...(args.sourceSync?.pass2448?.state === "blocked"
      ? ["provider methodology registry"]
      : []),
    ...(args.chartOverlay?.state === "blocked" ||
    args.sourceSync?.pass2449?.state === "blocked"
      ? ["chart overlay reconciler"]
      : []),
    !hasFingerprint && "canonical payload fingerprint",
  ]);
  const advancedMissing = unique([
    ...advancedBlockers,
    sourceCount < 3 && "three-provider quorum",
    !hasFingerprint && "Shield/Brain/Browser/PDF shared payload fingerprint",
    "live holder-flow graph or explicit missing-data badge",
    "order-book/depth replay or explicit missing-data badge",
    "PDF preview/download exact payload parity mount",
  ]).slice(0, 18);

  return [
    {
      tier: "basic",
      state: basicMissing.length ? "watch" : "ready",
      minSourceCount: 1,
      valuePromise:
        "Fast public risk snapshot: identity, price, 24h move, market cap/volume if present, confidence cap and missing-data badge.",
      visibleFields: [
        "identity",
        "price",
        "24h move",
        "market cap",
        "volume",
        "risk label",
        "source label",
        "missing data",
        "confidence cap",
        "safe next step",
      ],
      requiredProof: [
        "one live/partial market lane",
        "visible source label",
        "safe no-advice copy",
        "short chart path when available",
      ],
      missingProof: basicMissing,
      copyBoundary:
        "Basic must stay short. It may show what is missing, but cannot imply Advanced-level certainty.",
    },
    {
      tier: "pro",
      state: proMissing.length <= 2 ? "watch" : "blocked",
      minSourceCount: 2,
      valuePromise:
        "Evidence comparison layer: methodology, consensus radar, chart quality, source age and visible blockers.",
      visibleFields: [
        "Basic fields",
        "1h/7d/30d",
        "FDV/MC",
        "liquidity/volume",
        "DefiLlama TVL",
        "provider age",
        "consensus radar",
        "chart gaps",
        "PDF preview parity",
        "source SLA",
        "methodology",
        "operator next step",
        "safe summary",
        "confidence waterfall",
      ],
      requiredProof: [
        "two provider lanes",
        "PASS2447 consensus",
        "PASS2448 methodology",
        "PASS2449 chart overlay",
        "payload fingerprint",
      ],
      missingProof: proMissing,
      copyBoundary:
        "Pro can compare evidence and contradictions, but still cannot call missing holder/depth data proven.",
    },
    {
      tier: "advanced",
      state:
        advancedMissing.length <= 3 && sourceCount >= 3 ? "watch" : "blocked",
      minSourceCount: 3,
      valuePromise:
        "Paid deep proof layer: long-range chart, second overlay, source quorum, holder/depth locks, PDF parity and customer-safe conclusion.",
      visibleFields: [
        "Pro fields",
        "2Y/5Y/MAX chart",
        "second chart overlay",
        "CEX depth",
        "DEX pool OHLCV",
        "holder-flow",
        "contract security",
        "TVL/fundamentals",
        "contradiction radar",
        "stress scenarios",
        "PDF exact payload",
        "hash parity",
        "evidence export",
        "source freshness SLA",
        "human-safe conclusion",
        "audit receipt",
        "locale parity",
        "operator review",
        "blocked proof ledger",
        "world-class score",
      ],
      requiredProof: [
        "three-provider quorum",
        "long-range chart continuity",
        "second overlay",
        "holder/depth proof or visible lock",
        "PDF preview/download hash parity",
        "no-filler conclusion",
      ],
      missingProof: advancedMissing,
      copyBoundary:
        "Advanced must be visibly different from Pro. If deep lanes are missing, show a paid-grade missing-proof ledger instead of confident filler.",
    },
  ];
}

function buildSurfaceContracts(args: {
  sourceSync?: Pass2450SourceSyncPacket;
  chartOverlay?: Pass2449ChartOverlayReconciler;
  payloadFingerprint?: string;
}): Pass2450SurfaceContract[] {
  const hasSourceSync = Boolean(args.sourceSync);
  const hasChartOverlay = Boolean(
    args.chartOverlay ?? args.sourceSync?.pass2449,
  );
  const hasConsensus = Boolean(args.sourceSync?.pass2447);
  const hasMethodology = Boolean(args.sourceSync?.pass2448);
  const hasFingerprint = Boolean(args.payloadFingerprint);

  const sharedMissing = unique([
    !hasSourceSync && "sourceSync packet",
    !hasConsensus && "PASS2447 consensus",
    !hasMethodology && "PASS2448 methodology",
    !hasChartOverlay && "PASS2449 chart overlay",
    !hasFingerprint && "canonical payload fingerprint",
  ]);

  const surface = (
    surfaceId: Pass2450SurfaceId,
    label: string,
    extraMissing: string[] = [],
  ): Pass2450SurfaceContract => {
    const missingProof = unique([...sharedMissing, ...extraMissing]).slice(
      0,
      10,
    );
    return {
      surface: surfaceId,
      label,
      state: stateFromMissing(90 - missingProof.length * 12, missingProof),
      mustSharePayloadWith: [
        "Shield",
        "Real Markets",
        "VLM Brain",
        "Browser preview",
        "PDF preview",
        "PDF download",
        "Angel",
      ].filter((item) => item !== label),
      requiredMounts: [
        "tier badge",
        "source count",
        "confidence cap",
        "missing-proof ledger",
        "payload fingerprint",
        "provider methodology",
        "chart overlay badge",
      ],
      attachedProof: unique([
        hasSourceSync && "sourceSync",
        hasConsensus && "consensus radar",
        hasMethodology && "methodology registry",
        hasChartOverlay && "chart overlay",
        hasFingerprint && "payload fingerprint",
      ]),
      missingProof,
      driftAction:
        "If this surface does not share the canonical packet, show payload_drift and downgrade Advanced wording to missing-proof mode.",
    };
  };

  return [
    surface("shield", "Shield"),
    surface("real_markets", "Real Markets", [
      "cross-asset parity proof for stocks/FX/commodities/ETF",
    ]),
    surface("vlm_brain", "VLM Brain", ["Brain right rail PASS2450 mount"]),
    surface("browser_preview", "Browser preview", [
      "compact preview must not exceed Basic proof depth",
    ]),
    surface("pdf_preview", "PDF preview", ["A4 locale parity PL/EN/DE"]),
    surface("pdf_download", "PDF download", [
      "download must reuse preview payload hash",
    ]),
    surface("angel", "Angel", [
      "answer order: tier -> source -> missing proof -> conclusion",
    ]),
  ];
}

export function buildPass2450TierEvidenceParity(args: {
  query?: string;
  symbol?: string;
  range?: string;
  sourceSync?: Pass2450SourceSyncPacket;
  chartOverlay?: Pass2449ChartOverlayReconciler;
  payloadFingerprint?: string;
}): Pass2450TierEvidenceParity {
  const tierContracts = buildTierContracts(args);
  const surfaceContracts = buildSurfaceContracts(args);
  const missingForWorldClass = unique([
    ...tierContracts.flatMap((tier) =>
      tier.missingProof.map((item) => `${tier.tier}: ${item}`),
    ),
    ...surfaceContracts.flatMap((surface) =>
      surface.missingProof.map((item) => `${surface.label}: ${item}`),
    ),
  ]).slice(0, 28);
  const upstreamScores = [
    args.sourceSync?.pass2444?.score,
    args.sourceSync?.pass2445?.score,
    args.sourceSync?.pass2446?.score,
    args.sourceSync?.pass2447?.score,
    args.sourceSync?.pass2448?.score,
    args.chartOverlay?.score ?? args.sourceSync?.pass2449?.score,
  ].filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  const upstreamScore = upstreamScores.length
    ? upstreamScores.reduce((sum, value) => sum + value, 0) /
      upstreamScores.length
    : 32;
  const tierPenalty =
    tierContracts.reduce((sum, tier) => sum + tier.missingProof.length, 0) *
    2.4;
  const surfacePenalty =
    surfaceContracts.reduce(
      (sum, surface) => sum + surface.missingProof.length,
      0,
    ) * 1.2;
  const score = clamp(
    upstreamScore +
      (args.payloadFingerprint ? 8 : 0) -
      tierPenalty -
      surfacePenalty,
  );
  const state = stateFromMissing(score, missingForWorldClass);
  const sourceFingerprint =
    args.payloadFingerprint ??
    tinyHash({
      query: args.query ?? args.sourceSync?.query,
      symbol: args.symbol ?? args.sourceSync?.symbol,
      range: args.range,
      sourceCount: args.sourceSync?.sourceCount,
      states: {
        p2447: args.sourceSync?.pass2447?.state,
        p2448: args.sourceSync?.pass2448?.state,
        p2449: args.chartOverlay?.state ?? args.sourceSync?.pass2449?.state,
      },
    });

  return {
    version: "tier-evidence-parity-v1",
    state,
    score,
    query: args.query ?? args.sourceSync?.query,
    symbol: args.symbol ?? args.sourceSync?.symbol,
    range: args.range,
    sourceFingerprint,
    sourceSyncState: args.sourceSync?.quorumState ?? "chart_only",
    tierContracts,
    surfaceContracts,
    missingForWorldClass,
    hardRules: [
      "Basic, Pro and Advanced must differ by visible evidence depth, not by longer AI text.",
      "PDF preview and PDF download must share the same sourceFingerprint or show payload_drift.",
      "Angel cannot upgrade missing holder/depth/long-chart lanes into confident wording.",
      "Real Markets and Shield can share architecture, but cross-asset providers must stay asset-class specific.",
      "Planned providers are roadmap lanes, not evidence, until an adapter/env key/payload is live.",
    ],
    innovationBacklog: [
      "Surface Drift Sentinel: compare sourceFingerprint across Shield, Brain, Browser and PDF in the browser runtime.",
      "Tier Value Receipt: show exactly which extra fields Advanced unlocked in the current report.",
      "No-Filler Governor: block long AI paragraphs when tier missingProof is longer than attachedProof.",
      "PDF Replay Capsule: regenerate PDF from the same canonical packet stored in account evidence ledger.",
      "Provider Proof Timeline: show when each source field changed, not only the latest value.",
    ],
    uiBadges: [
      `Tier parity: ${state}`,
      `World-class score: ${score}/100`,
      `Fingerprint: ${sourceFingerprint}`,
      `Missing proof: ${missingForWorldClass.length}`,
    ],
    generatedAt: new Date().toISOString(),
  };
}
