import type { TokenRiskResult } from "./risk-types";
import { parseRiskScore } from "./risk-score-availability";
import type { Pass2449ChartOverlayReconciler } from "./chart-overlay-reconciler";
import type { Pass2450TierEvidenceParity } from "./tier-evidence-parity";
import type { Pass2451DataProvenanceLedger } from "./data-provenance-ledger";
import type { VelmereSourceSyncPacket } from "./source-sync-contract";

type Pass2452SourceSyncPacket = Omit<VelmereSourceSyncPacket, "pass2449"> & {
  pass2449?: Pass2449ChartOverlayReconciler;
  pass2450?: Pass2450TierEvidenceParity;
  pass2451?: Pass2451DataProvenanceLedger;
};

export type Pass2452CalibrationState = "ready" | "watch" | "blocked";
export type Pass2452ComponentId =
  | "price_volatility"
  | "liquidity_exit_depth"
  | "valuation_spread"
  | "defillama_fundamentals"
  | "chart_regime"
  | "holder_contract_security"
  | "source_provenance"
  | "surface_parity"
  | "freshness_sla";

export type Pass2452RiskComponent = {
  id: Pass2452ComponentId;
  label: string;
  state: Pass2452CalibrationState;
  direction: "risk_up" | "risk_down" | "confidence_only" | "blocked";
  rawImpact: number;
  calibratedImpact: number;
  confidenceCap: number;
  attachedEvidence: string[];
  missingProof: string[];
  forbiddenShortcut: string;
  tierVisibility: {
    basic: "visible" | "badge_only" | "locked";
    pro: "visible" | "badge_only" | "locked";
    advanced: "visible" | "badge_only" | "locked";
  };
};

export type Pass2452RiskCalibrationKernel = {
  version: "risk-calibration-kernel-v1";
  state: Pass2452CalibrationState;
  calibratedRiskScore: number | null;
  confidenceCap: number;
  uncertaintyPercent: number;
  query?: string;
  symbol?: string;
  components: Pass2452RiskComponent[];
  tierValueReceipt: Array<{
    tier: "basic" | "pro" | "advanced";
    allowedEvidence: string[];
    blockedEvidence: string[];
    copyStrength: "summary" | "evidence_context" | "advanced_review";
  }>;
  scoreCaps: {
    dataCompletenessCap: number;
    provenanceCap: number;
    chartCap: number;
    holderDepthCap: number;
    finalCap: number;
  };
  noFillerGovernor: {
    state: Pass2452CalibrationState;
    rule: string;
    blockedPhrases: string[];
    requiredBeforeAdvancedConclusion: string[];
  };
  empiricalValidation: {
    status: "not_available" | "holdout_validated" | "expired" | "rejected";
    probabilityInterpretationAllowed: boolean;
    scoreInterpretation: "evidence_ranking_not_event_probability";
    requiredProof: string[];
  };
  surfaceMounts: string[];
  nextWorldClassIntegrations: string[];
  generatedAt: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function n(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function pct(value?: number) {
  if (value === undefined) return "source required";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;
}

function money(value?: number) {
  if (value === undefined) return "source required";
  if (Math.abs(value) >= 1_000_000_000)
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(Math.abs(value) < 1 ? 6 : 2)}`;
}

function unique(items: Array<string | null | undefined | false>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function stateFromMissing(
  attached: string[],
  missing: string[],
  impact: number,
): Pass2452CalibrationState {
  if (!attached.length && missing.length >= 2) return "blocked";
  if (missing.length >= 4 || Math.abs(impact) >= 24) return "watch";
  return "ready";
}

function component(
  args: Omit<
    Pass2452RiskComponent,
    "rawImpact" | "calibratedImpact" | "confidenceCap" | "state"
  > & {
    rawImpact: number;
    sourceCap: number;
  },
): Pass2452RiskComponent {
  const attachedEvidence = unique(args.attachedEvidence);
  const missingProof = unique(args.missingProof).slice(0, 8);
  const state = stateFromMissing(
    attachedEvidence,
    missingProof,
    args.rawImpact,
  );
  const missingPenalty = Math.min(18, missingProof.length * 3);
  const confidenceCap = clamp(args.sourceCap - missingPenalty);
  const calibratedImpact = Math.round(args.rawImpact * (confidenceCap / 100));
  return {
    ...args,
    state,
    attachedEvidence,
    missingProof,
    confidenceCap,
    calibratedImpact,
  };
}

function fieldState(
  provenance: Pass2451DataProvenanceLedger | undefined,
  field: string,
) {
  return provenance?.fieldLedger.find((item) => item.field === field);
}

export function buildPass2452RiskCalibrationKernel(args: {
  query?: string;
  symbol?: string;
  result?: TokenRiskResult | null;
  sourceSync?: Pass2452SourceSyncPacket;
  chartOverlay?: Pass2449ChartOverlayReconciler;
  tierEvidence?: Pass2450TierEvidenceParity;
  dataProvenance?: Pass2451DataProvenanceLedger;
}): Pass2452RiskCalibrationKernel {
  const result = args.result ?? null;
  const metrics = result?.metrics;
  const chartOverlay = args.chartOverlay ?? args.sourceSync?.pass2449;
  const tierEvidence = args.tierEvidence ?? args.sourceSync?.pass2450;
  const dataProvenance = args.dataProvenance ?? args.sourceSync?.pass2451;
  const confidenceBase =
    args.sourceSync?.confidenceCap ?? result?.confidence ?? 38;
  const change24h = n(metrics?.priceChange24h);
  const change7d = n(metrics?.priceChange7d);
  const change30d = n(metrics?.priceChange30d);
  const liquidity = n(metrics?.liquidityUsd);
  const marketCap = n(metrics?.marketCap);
  const volume = n(metrics?.volume24h);
  const fdv = n(metrics?.fdv);
  const tvlField = fieldState(dataProvenance, "tvl");
  const chartField = fieldState(dataProvenance, "chart_history");
  const holderField = fieldState(dataProvenance, "holder_graph");
  const pdfField = fieldState(dataProvenance, "pdf_parity");

  const volatilityImpact = Math.min(
    32,
    Math.abs(change24h ?? 0) * 0.7 +
      Math.abs(change7d ?? 0) * 0.25 +
      Math.abs(change30d ?? 0) * 0.1,
  );
  const liquidityCoverage =
    liquidity && marketCap
      ? (liquidity / Math.max(marketCap, 1)) * 100
      : undefined;
  const volumeToLiquidity =
    volume && liquidity ? volume / Math.max(liquidity, 1) : undefined;
  const liquidityImpact =
    liquidityCoverage === undefined
      ? 16
      : liquidityCoverage < 0.25
        ? 34
        : liquidityCoverage < 1
          ? 24
          : volumeToLiquidity !== undefined && volumeToLiquidity > 15
            ? 22
            : 6;
  const fdvMcRatio =
    fdv && marketCap ? fdv / Math.max(marketCap, 1) : undefined;
  const valuationImpact =
    fdvMcRatio === undefined
      ? 8
      : fdvMcRatio > 8
        ? 26
        : fdvMcRatio > 4
          ? 18
          : fdvMcRatio > 2
            ? 10
            : 2;
  const chartImpact =
    chartOverlay?.state === "ready"
      ? -4
      : chartOverlay?.state === "watch"
        ? 8
        : 18;
  const provenanceBlocked =
    dataProvenance?.fieldLedger.filter((field) => field.state === "blocked")
      .length ?? 4;
  const provenanceWatch =
    dataProvenance?.fieldLedger.filter((field) => field.state === "watch")
      .length ?? 0;
  const freshnessImpact =
    dataProvenance?.freshnessEnvelope.state === "ready"
      ? 0
      : dataProvenance?.freshnessEnvelope.state === "watch"
        ? 8
        : 20;

  const components: Pass2452RiskComponent[] = [
    component({
      id: "price_volatility",
      label: "Price volatility / momentum shock",
      direction: volatilityImpact >= 10 ? "risk_up" : "confidence_only",
      rawImpact: volatilityImpact,
      sourceCap: confidenceBase,
      attachedEvidence: unique([
        change24h !== undefined && `24h change ${pct(change24h)}`,
        change7d !== undefined && `7d change ${pct(change7d)}`,
        change30d !== undefined && `30d change ${pct(change30d)}`,
      ]),
      missingProof: unique([
        change24h === undefined && "24h change",
        change7d === undefined && "7d change",
        change30d === undefined && "30d change",
        "second venue momentum cross-check for Advanced",
      ]),
      forbiddenShortcut:
        "Volatility is not a prediction and cannot be converted into ROI language.",
      tierVisibility: { basic: "visible", pro: "visible", advanced: "visible" },
    }),
    component({
      id: "liquidity_exit_depth",
      label: "Liquidity / exit-depth pressure",
      direction: "risk_up",
      rawImpact: liquidityImpact,
      sourceCap:
        fieldState(dataProvenance, "liquidity")?.state === "ready" ? 82 : 56,
      attachedEvidence: unique([
        liquidity !== undefined && `visible liquidity ${money(liquidity)}`,
        volume !== undefined && `24h volume ${money(volume)}`,
        liquidityCoverage !== undefined &&
          `liquidity/MC ${liquidityCoverage.toFixed(3)}%`,
        volumeToLiquidity !== undefined &&
          `volume/liquidity ${volumeToLiquidity.toFixed(2)}x`,
      ]),
      missingProof: unique([
        liquidity === undefined && "visible liquidity",
        volume === undefined && "24h volume",
        liquidityCoverage === undefined &&
          "market cap or liquidity for coverage",
        "stress sell depth replay",
        "DEX pool event history",
      ]),
      forbiddenShortcut:
        "Visible liquidity is not guaranteed exit liquidity under stress.",
      tierVisibility: {
        basic: "badge_only",
        pro: "visible",
        advanced: "visible",
      },
    }),
    component({
      id: "valuation_spread",
      label: "FDV / market-cap spread",
      direction:
        fdvMcRatio !== undefined && fdvMcRatio > 2
          ? "risk_up"
          : "confidence_only",
      rawImpact: valuationImpact,
      sourceCap: fieldState(dataProvenance, "fdv")?.state === "ready" ? 78 : 58,
      attachedEvidence: unique([
        fdv !== undefined && `FDV ${money(fdv)}`,
        marketCap !== undefined && `market cap ${money(marketCap)}`,
        fdvMcRatio !== undefined && `FDV/MC ${fdvMcRatio.toFixed(2)}x`,
      ]),
      missingProof: unique([
        fdv === undefined && "FDV",
        marketCap === undefined && "market cap",
        "unlock/vesting supply schedule",
        "circulating supply source proof",
      ]),
      forbiddenShortcut:
        "FDV cannot replace market cap and cannot prove insider unlock risk alone.",
      tierVisibility: {
        basic: "badge_only",
        pro: "visible",
        advanced: "visible",
      },
    }),
    component({
      id: "defillama_fundamentals",
      label: "DefiLlama fundamentals / TVL context",
      direction: tvlField?.state === "ready" ? "confidence_only" : "blocked",
      rawImpact:
        tvlField?.state === "ready" ? -3 : tvlField?.state === "watch" ? 6 : 14,
      sourceCap: tvlField?.state === "ready" ? 80 : 46,
      attachedEvidence: tvlField?.confirmedEvidence ?? [],
      missingProof: unique([
        ...(tvlField?.missingEvidence ?? ["matched protocol TVL"]),
        "TVL methodology note",
      ]),
      forbiddenShortcut:
        "TVL is fundamentals context, not a security certificate or exit-depth proof.",
      tierVisibility: {
        basic: "badge_only",
        pro: "visible",
        advanced: "visible",
      },
    }),
    component({
      id: "chart_regime",
      label: "2Y/5Y/MAX chart regime quality",
      direction:
        chartOverlay?.state === "ready" ? "confidence_only" : "blocked",
      rawImpact: chartImpact,
      sourceCap: chartField?.state === "ready" ? 84 : 52,
      attachedEvidence: unique([
        chartOverlay?.windowContract.actualPoints !== undefined &&
          `${chartOverlay.windowContract.actualPoints} chart points`,
        chartOverlay?.state && `overlay ${chartOverlay.state}`,
        ...(chartField?.confirmedEvidence ?? []),
      ]),
      missingProof: unique([
        ...(chartField?.missingEvidence ?? []),
        ...(chartOverlay?.tierLocks.find((tier) => tier.tier === "advanced")
          ?.blockedBy ?? []),
      ]),
      forbiddenShortcut:
        "Never produce macro regime conclusions from a short sparkline.",
      tierVisibility: {
        basic: "badge_only",
        pro: "visible",
        advanced: "visible",
      },
    }),
    component({
      id: "holder_contract_security",
      label: "Holder graph / contract security",
      direction: holderField?.state === "ready" ? "confidence_only" : "blocked",
      rawImpact:
        holderField?.state === "ready"
          ? 0
          : holderField?.state === "watch"
            ? 10
            : 20,
      sourceCap: holderField?.state === "ready" ? 76 : 44,
      attachedEvidence: unique([
        ...(holderField?.confirmedEvidence ?? []),
        ...(fieldState(dataProvenance, "contract_security")
          ?.confirmedEvidence ?? []),
      ]),
      missingProof: unique([
        ...(holderField?.missingEvidence ?? ["holder graph"]),
        ...(fieldState(dataProvenance, "contract_security")?.missingEvidence ??
          []),
      ]),
      forbiddenShortcut:
        "Missing holder data is uncertainty, not proof that an asset is safe or unsafe.",
      tierVisibility: {
        basic: "locked",
        pro: "badge_only",
        advanced: "visible",
      },
    }),
    component({
      id: "source_provenance",
      label: "Field-by-field data provenance",
      direction: provenanceBlocked ? "blocked" : "confidence_only",
      rawImpact: provenanceBlocked * 5 + provenanceWatch * 2,
      sourceCap: dataProvenance?.score ?? 34,
      attachedEvidence: unique(
        dataProvenance?.fieldLedger
          .filter((field) => field.state === "ready")
          .map((field) => `${field.label}: ready`) ?? [],
      ),
      missingProof: unique(
        dataProvenance?.advancedLocks ?? ["data provenance ledger"],
      ),
      forbiddenShortcut:
        "A number without provider/timecode must be labeled as missing timestamp.",
      tierVisibility: { basic: "visible", pro: "visible", advanced: "visible" },
    }),
    component({
      id: "surface_parity",
      label: "Shield / Brain / Browser / PDF parity",
      direction: pdfField?.state === "ready" ? "confidence_only" : "blocked",
      rawImpact: pdfField?.state === "ready" ? 0 : 14,
      sourceCap: tierEvidence?.score ?? 48,
      attachedEvidence: unique([
        tierEvidence?.sourceFingerprint &&
          `sourceFingerprint ${tierEvidence.sourceFingerprint}`,
        ...(pdfField?.confirmedEvidence ?? []),
      ]),
      missingProof: unique([
        ...(pdfField?.missingEvidence ?? ["PDF preview/download parity"]),
        ...(tierEvidence?.surfaceContracts.flatMap(
          (surface) => surface.missingProof,
        ) ?? []),
      ]),
      forbiddenShortcut:
        "PDF preview/download and VLM Brain must not run on different source packets.",
      tierVisibility: {
        basic: "badge_only",
        pro: "visible",
        advanced: "visible",
      },
    }),
    component({
      id: "freshness_sla",
      label: "Freshness SLA / stale data budget",
      direction:
        dataProvenance?.freshnessEnvelope.state === "ready"
          ? "confidence_only"
          : "blocked",
      rawImpact: freshnessImpact,
      sourceCap: dataProvenance?.freshnessEnvelope.state === "ready" ? 82 : 50,
      attachedEvidence: unique(
        dataProvenance?.sourceHealth
          .filter((source) => source.observedAt)
          .map((source) => `${source.provider}: ${source.observedAt}`) ?? [],
      ),
      missingProof: unique(
        dataProvenance?.freshnessEnvelope.staleFields ?? [
          "provider observedAt timestamps",
        ],
      ),
      forbiddenShortcut:
        "Stale data can explain uncertainty only; it must not support live claims.",
      tierVisibility: { basic: "visible", pro: "visible", advanced: "visible" },
    }),
  ];

  const finalCap = clamp(
    Math.min(...components.map((item) => item.confidenceCap), confidenceBase),
  );
  const baselineRiskScore = parseRiskScore(result?.score);
  const calibratedRiskScore = baselineRiskScore === null
    ? null
    : clamp(
        baselineRiskScore +
          components.reduce((sum, item) => sum + item.calibratedImpact, 0) /
            Math.max(1, components.length),
      );
  const missingCount = components.reduce(
    (sum, item) => sum + item.missingProof.length,
    0,
  );
  const blockedComponents = components.filter(
    (item) => item.state === "blocked",
  );
  const uncertaintyPercent = clamp(100 - finalCap + Math.min(22, missingCount));
  const state: Pass2452CalibrationState =
    calibratedRiskScore === null || blockedComponents.length >= 4
      ? "blocked"
      : finalCap >= 70 && uncertaintyPercent <= 38
        ? "ready"
        : "watch";
  const advancedBlocked = unique([
    calibratedRiskScore === null &&
      "Risk calibration: verified TokenRiskResult.score baseline",
    ...blockedComponents.flatMap((item) =>
      item.missingProof.map((proof) => `${item.label}: ${proof}`),
    ),
  ]).slice(0, 12);

  return {
    version: "risk-calibration-kernel-v1",
    state,
    calibratedRiskScore,
    confidenceCap: finalCap,
    uncertaintyPercent,
    query: args.query ?? args.sourceSync?.query,
    symbol: args.symbol ?? args.sourceSync?.symbol,
    components,
    tierValueReceipt: [
      {
        tier: "basic",
        allowedEvidence: [
          "identity",
          "price",
          "24h move",
          calibratedRiskScore === null
            ? "risk score unavailable badge"
            : "top risk flag",
          "missing data badge",
          "confidence cap",
        ],
        blockedEvidence: unique([
          calibratedRiskScore === null &&
            "risk score until a verified baseline is attached",
          "holder graph",
          "order-book depth",
          "2Y/5Y/MAX macro regime",
          "PDF replay capsule",
        ]),
        copyStrength: "summary",
      },
      {
        tier: "pro",
        allowedEvidence: [
          "Basic evidence",
          "liquidity/volume pressure",
          "FDV/MC spread",
          "DefiLlama TVL context",
          "chart quality badge",
        ],
        blockedEvidence: [
          "holder clusters",
          "second venue depth",
          "stress sell replay",
          "auditable PDF parity receipt",
        ],
        copyStrength: "evidence_context",
      },
      {
        tier: "advanced",
        allowedEvidence: [
          "field provenance",
          "chart overlay",
          "tier fingerprint",
          "source consensus",
          "missing-proof ledger",
          "risk calibration components",
        ],
        blockedEvidence: advancedBlocked.length
          ? advancedBlocked
          : ["none visible in current kernel"],
        copyStrength: "advanced_review",
      },
    ],
    scoreCaps: {
      dataCompletenessCap: clamp(100 - missingCount * 2),
      provenanceCap: dataProvenance?.score ?? 34,
      chartCap: chartOverlay?.score ?? 42,
      holderDepthCap:
        holderField?.state === "ready"
          ? 78
          : holderField?.state === "watch"
            ? 52
            : 38,
      finalCap,
    },
    noFillerGovernor: {
      state: calibratedRiskScore === null
        ? "blocked"
        : advancedBlocked.length
          ? "watch"
          : "ready",
      rule: "If missingProof is longer than attachedEvidence for a component, AI may explain the gap but cannot write a confident conclusion from it.",
      blockedPhrases: [
        "guaranteed safe",
        "certified safe",
        "no risk",
        "will pump",
        "will recover",
        "exit liquidity confirmed",
      ],
      requiredBeforeAdvancedConclusion: unique([
        calibratedRiskScore === null &&
          "verified TokenRiskResult.score baseline",
        "field provenance observedAt/max-age",
        "2Y/5Y/MAX chart overlay or visible lock",
        "holder/depth proof or visible missing-proof lock",
        "same sourceFingerprint across Shield/Brain/Browser/PDF",
        "DefiLlama TVL methodology boundary when TVL appears",
      ]),
    },
    empiricalValidation: {
      status: "not_available",
      probabilityInterpretationAllowed: false,
      scoreInterpretation: "evidence_ranking_not_event_probability",
      requiredProof: [
        "signed chronological holdout calibration profile",
        "declared outcome definition and observation horizon",
        "purged split proving feature timestamps precede outcomes",
        "holdout AUROC, Brier skill and calibration error gates",
        "expiry and tamper verification at delivery time",
      ],
    },
    surfaceMounts: [
      "Shield modal: show calibratedRiskScore or an explicit unavailable state, confidenceCap and top 3 score drivers before narrative.",
      "Real Markets: show source-specific score caps so equities/FX/crypto do not share fake proof.",
      "VLM Brain: add Risk Calibration tab with components and no-filler rule.",
      "Browser/PDF: print tier value receipt so Advanced value is visible and auditable.",
      "Angel: answer order calibration -> blockers -> missing proof -> calm conclusion.",
    ],
    nextWorldClassIntegrations: [
      "Backtest calibration weights against historical scam/high-volatility/blue-chip cohorts.",
      "Add stress sell replay using Binance depth + DEX pool reserves where allowed.",
      "Store calibration snapshots for before/after comparison in account/PDF evidence ledger.",
      "Add Real Markets calibration profiles for equities, commodities, ETFs, FX and REITs.",
      "Add operator-adjustable but logged weighting model with public methodology notes.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
