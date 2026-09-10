import type { DefiLlamaRiskLane } from "./defillama-adapter";
import type {
  Pass2445FieldSla,
  Pass2445ProviderSla,
  Pass2445WorldClassSourceSlaLedger,
} from "./worldclass-source-sla-ledger";
import type { Pass2446DefiLlamaExpansion } from "./defillama-expansion";
import type {
  VelmereSourceSyncLane,
  VelmereSourceSyncPacket,
} from "./source-sync-contract";

type Pass2446SourceSyncInput = Omit<
  VelmereSourceSyncPacket,
  "pass2445" | "pass2446"
> & {
  pass2445?: Pass2445WorldClassSourceSlaLedger;
};

export type Pass2446ProviderHealth =
  "live" | "watch" | "degraded" | "missing" | "planned" | "not_applicable";

export type Pass2446ProviderRow = {
  providerId: string;
  label: string;
  roleGroup:
    "market" | "dex" | "cex" | "defi" | "security" | "onchain" | "manual";
  health: Pass2446ProviderHealth;
  observedAt?: string;
  maxAgeSeconds: number;
  ageSeconds?: number;
  stale: boolean;
  confirmedFields: string[];
  missingFields: string[];
  coverageScore: number;
  confidenceCap: number;
  customerBadge: string;
  operatorAction: string;
  boundary: string;
};

export type Pass2446TierRibbon = {
  tier: "basic" | "pro" | "advanced";
  state: "ready" | "watch" | "blocked";
  score: number;
  label: string;
  visibleFields: string[];
  blockedBy: string[];
  copyBoundary: string;
};

export type Pass2446ProviderObservabilityBoard = {
  version: "provider-observability-board-v1";
  overallState: "ready" | "watch" | "blocked";
  score: number;
  providerRows: Pass2446ProviderRow[];
  tierRibbon: Pass2446TierRibbon[];
  defillamaExpansion?: Pass2446DefiLlamaExpansion;
  proofCapsule: {
    requiredTargets: string[];
    checksumPolicy: string;
    driftAction: string;
    currentStatus: "planned" | "partial" | "ready";
  };
  worldClassUxRules: string[];
  nextOps: string[];
  generatedAt: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique(items: Array<string | null | undefined | false>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function secondsSince(iso?: string, now = Date.now()) {
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.round((now - parsed) / 1000));
}

function roleGroup(id: string): Pass2446ProviderRow["roleGroup"] {
  if (id === "coingecko" || id === "yahoo-finance" || id === "sec-xbrl")
    return "market";
  if (id === "dexscreener") return "dex";
  if (id === "binance") return "cex";
  if (id === "defillama") return "defi";
  if (id === "goplus") return "security";
  if (id === "bitquery") return "onchain";
  return "manual";
}

function healthFromLane(
  lane?: VelmereSourceSyncLane,
  planned?: boolean,
): Pass2446ProviderHealth {
  if (planned) return "planned";
  if (!lane) return "missing";
  if (lane.state === "confirmed") return "live";
  if (lane.state === "partial") return "watch";
  if (lane.state === "degraded") return "degraded";
  if (lane.state === "not_applicable") return "not_applicable";
  return "missing";
}

function rowFromLane(args: {
  lane?: VelmereSourceSyncLane;
  provider?: Pass2445ProviderSla;
  fallbackId: string;
  fallbackLabel: string;
  now: number;
}): Pass2446ProviderRow {
  const { lane, provider, fallbackId, fallbackLabel, now } = args;
  const id = lane?.id ?? provider?.id ?? fallbackId;
  const maxAgeSeconds = provider?.maxAgeSeconds ?? 300;
  const ageSeconds = secondsSince(
    lane?.observedAt ?? provider?.observedAt,
    now,
  );
  const stale =
    ageSeconds !== undefined
      ? ageSeconds > maxAgeSeconds
      : provider?.liveState !== "planned" && lane?.state !== "not_applicable";
  const confirmedFields = unique([
    ...(lane?.confirmedFields ?? []),
    ...(provider?.fields ?? []),
  ]);
  const missingFields = unique([
    ...(lane?.missingFields ?? []),
    ...(provider?.missing ?? []),
  ]);
  const denominator = Math.max(
    confirmedFields.length + missingFields.length,
    1,
  );
  const coverageScore = clamp((confirmedFields.length / denominator) * 100);
  const health = healthFromLane(lane, provider?.liveState === "planned");
  return {
    providerId: id,
    label: lane?.label ?? provider?.label ?? fallbackLabel,
    roleGroup: roleGroup(id),
    health,
    observedAt: lane?.observedAt ?? provider?.observedAt,
    maxAgeSeconds,
    ageSeconds,
    stale,
    confirmedFields: confirmedFields.slice(0, 16),
    missingFields: missingFields.slice(0, 16),
    coverageScore,
    confidenceCap: clamp(
      Math.min(lane?.confidenceCap ?? 100, provider?.confidenceCap ?? 100),
    ),
    customerBadge:
      health === "live" && !stale
        ? "live proof"
        : health === "watch"
          ? "partial proof"
          : health === "planned"
            ? "planned adapter"
            : health === "not_applicable"
              ? "not applicable"
              : stale
                ? "stale/missing timestamp"
                : "missing proof",
    operatorAction:
      health === "live" && !stale
        ? "Keep in evidence packet and show field timestamp."
        : health === "planned"
          ? "Build adapter contract before exposing as Advanced proof."
          : stale
            ? "Refresh provider or lower confidence before showing Advanced copy."
            : "Show missing lane visibly and do not let AI fill it with prose.",
    boundary:
      lane?.boundary ??
      provider?.customerBoundary ??
      "Provider evidence is a confidence lane, not a guarantee.",
  };
}

function ribbonForTier(
  tier: Pass2445FieldSla["tier"],
  fields: Pass2445FieldSla[],
): Pass2446TierRibbon {
  const scoped = fields.filter((field) => field.tier === tier);
  const ready = scoped.filter((field) => field.status === "ready").length;
  const watch = scoped.filter((field) => field.status === "watch").length;
  const blocked = scoped.filter((field) => field.status === "blocked").length;
  const score = clamp(
    ((ready + watch * 0.55) / Math.max(scoped.length, 1)) * 100,
  );
  const state: Pass2446TierRibbon["state"] =
    blocked > 0 && tier === "advanced"
      ? "blocked"
      : score >= 76
        ? "ready"
        : score >= 42
          ? "watch"
          : "blocked";
  return {
    tier,
    state,
    score,
    label:
      tier === "basic"
        ? "Basic: visible facts"
        : tier === "pro"
          ? "Pro: context and contradictions"
          : "Advanced: proof-locked analysis",
    visibleFields: scoped.map((field) => field.label).slice(0, 8),
    blockedBy: scoped
      .flatMap((field) =>
        field.status === "ready"
          ? []
          : field.missingProviders.map(
              (provider) => `${field.label}: ${provider}`,
            ),
      )
      .slice(0, 8),
    copyBoundary:
      tier === "advanced"
        ? "Advanced copy may be detailed only when blockers are visible; missing depth/holder/chart proof must be part of the answer."
        : "This tier must stay useful and short without pretending unavailable sources are confirmed.",
  };
}

function scoreHealth(row: Pass2446ProviderRow) {
  const base =
    row.health === "live"
      ? 1
      : row.health === "watch"
        ? 0.66
        : row.health === "not_applicable"
          ? 0.72
          : row.health === "planned"
            ? 0.25
            : row.health === "degraded"
              ? 0.34
              : 0.12;
  const stalePenalty =
    row.stale && row.health !== "planned" && row.health !== "not_applicable"
      ? 0.22
      : 0;
  return Math.max(0, base - stalePenalty) * (0.5 + row.coverageScore / 200);
}

export function buildPass2446ProviderObservabilityBoard(args: {
  sourceSync: Pass2446SourceSyncInput;
  defiLlama?: DefiLlamaRiskLane | null;
  defillamaExpansion?: Pass2446DefiLlamaExpansion;
}): Pass2446ProviderObservabilityBoard {
  const now = Date.now();
  const pass2445: Pass2445WorldClassSourceSlaLedger | undefined =
    args.sourceSync.pass2445;
  const providerRows = (pass2445?.providerReadiness ?? []).map((provider) =>
    rowFromLane({
      lane: args.sourceSync.lanes.find((lane) => lane.id === provider.id),
      provider,
      fallbackId: provider.id,
      fallbackLabel: provider.label,
      now,
    }),
  );

  for (const lane of args.sourceSync.lanes) {
    if (!providerRows.some((row) => row.providerId === lane.id)) {
      providerRows.push(
        rowFromLane({
          lane,
          fallbackId: lane.id,
          fallbackLabel: lane.label,
          now,
        }),
      );
    }
  }

  const tierRibbon = ["basic", "pro", "advanced"].map((tier) =>
    ribbonForTier(tier as Pass2445FieldSla["tier"], pass2445?.fieldSla ?? []),
  );
  const providerScore =
    providerRows.reduce((sum, row) => sum + scoreHealth(row), 0) /
    Math.max(providerRows.length, 1);
  const tierScore =
    tierRibbon.reduce((sum, tier) => sum + tier.score, 0) /
    Math.max(tierRibbon.length * 100, 1);
  const score = clamp((providerScore * 0.58 + tierScore * 0.42) * 100);
  const advancedBlocked = tierRibbon.some(
    (tier) => tier.tier === "advanced" && tier.state === "blocked",
  );
  const overallState: Pass2446ProviderObservabilityBoard["overallState"] =
    score >= 78 && !advancedBlocked
      ? "ready"
      : score >= 45
        ? "watch"
        : "blocked";

  return {
    version: "provider-observability-board-v1",
    overallState,
    score,
    providerRows: providerRows.sort(
      (a, b) =>
        a.roleGroup.localeCompare(b.roleGroup) ||
        a.providerId.localeCompare(b.providerId),
    ),
    tierRibbon,
    defillamaExpansion: args.defillamaExpansion,
    proofCapsule: {
      requiredTargets: [
        "Shield modal",
        "VLM Brain",
        "Browser compact preview",
        "PDF preview",
        "PDF download",
        "Angel answer",
      ],
      checksumPolicy:
        "Every target must read the same sourceSync payload hash; if hashes differ, show drift warning and block Advanced PDF claim strength.",
      driftAction:
        "Fallback to source-safe summary, log operator event and regenerate PDF from canonical payload only.",
      currentStatus: "partial",
    },
    worldClassUxRules: [
      "Show provider badges as compact evidence, not marketing decoration.",
      "Basic/Pro/Advanced must display visible data-depth differences before a user clicks the tier.",
      "Every missing provider should lower confidence and remain visible in PDF/Angel/Shield.",
      "DefiLlama TVL, fees, stablecoin and bridge lanes are protocol context only; never a safety certificate.",
      "Long charts must show coverage, gaps and overlay readiness before macro wording is allowed.",
    ],
    nextOps: unique([
      ...(args.defillamaExpansion?.nextOps ?? []),
      "Render Source SLA Ribbon above Shield/VLM Brain chart.",
      "Persist proof capsule hash in PDF preview and PDF download routes.",
      "Add provider observability board to operator/admin diagnostics.",
      "Add second venue overlay for BTC/ETH/SOL daily candles.",
      "Attach holder-flow provider only to Advanced and redact wallet labels safely.",
    ]).slice(0, 12),
    generatedAt: new Date().toISOString(),
  };
}
