import {
  VLM_BRAIN_CALIBRATION_HASH,
  VLM_BRAIN_CALIBRATION_MANIFEST,
  VLM_BRAIN_CALIBRATION_VERSION,
  type VlmBrainCalibrationHash,
  type VlmBrainCalibrationVersion,
} from "./vlm-brain-calibration";
import { createSecureRuntimeId } from "@/lib/runtime/secure-runtime-id";

export type VlmBrainKernelSurface =
  | "shield"
  | "real_markets"
  | "shield_map"
  | "browser"
  | "lens"
  | "audit"
  | "product"
  | "shop"
  | "admin"
  | "angel";

export type VlmBrainKernelDepth = "basic" | "pro" | "advanced";
export type VlmBrainKernelLocale = "pl" | "en" | "de";
export type VlmBrainKernelStatus = "ready" | "needs_review" | "blocked";
export type VlmBrainKernelSeverity = "info" | "watch" | "warning" | "critical";
export type VlmBrainKernelFreshness = "fresh" | "aging" | "stale" | "unknown";
export type VlmBrainKernelFreshnessProfile = keyof typeof VLM_BRAIN_CALIBRATION_MANIFEST.freshnessProfiles;
export type VlmBrainKernelTimestampStatus = "valid" | "missing" | "invalid" | "future_skew";
export type VlmBrainKernelEvidenceQuality = "strong" | "medium" | "weak" | "missing";
export type VlmBrainKernelEvidenceIndependence = "independent" | "same_provider" | "derived" | "operator" | "unknown";
export type VlmBrainKernelProviderMetadataStatus = "explicit" | "partial" | "inferred";
export type VlmBrainKernelMarketSessionProfile = keyof typeof VLM_BRAIN_CALIBRATION_MANIFEST.sessionPolicy.profiles;
export type VlmBrainKernelSessionState = "open" | "closed" | "not_applicable";
export type VlmBrainKernelProviderHealthStatus = "healthy" | "unknown" | "degraded" | "breached" | "quarantined";

export type VlmBrainKernelEvidenceItem = {
  id: string;
  label: string;
  source: string;
  providerFamily: string;
  independence: VlmBrainKernelEvidenceIndependence;
  providerMetadataStatus: VlmBrainKernelProviderMetadataStatus;
  sourceTimestamp: string | null;
  timestampStatus?: VlmBrainKernelTimestampStatus;
  sourceAgeMs?: number | null;
  effectiveFreshness?: VlmBrainKernelFreshness;
  freshnessProfile: VlmBrainKernelFreshnessProfile;
  marketSessionProfile: VlmBrainKernelMarketSessionProfile;
  marketClosureDates: string[];
  sessionState?: VlmBrainKernelSessionState;
  sessionAdjustedAgeMs?: number | null;
  providerLatencyMs?: number | null;
  providerLatencyP50Ms?: number | null;
  providerLatencyP95Ms?: number | null;
  providerLatencyP99Ms?: number | null;
  providerTelemetrySampleCount?: number;
  providerTelemetryUpdatedAt?: string | null;
  providerSlaMs?: number | null;
  providerLatencyRatio?: number | null;
  providerLatencyEvaluationMs?: number | null;
  providerFailureStreak?: number;
  providerClockSkewStreak?: number;
  providerInvalidTimestampStreak?: number;
  providerSlaBreachStreak?: number;
  providerQuarantined?: boolean;
  providerHealthStatus?: VlmBrainKernelProviderHealthStatus;
  quarantineReason?: string | null;
  quality: VlmBrainKernelEvidenceQuality;
  freshness: VlmBrainKernelFreshness;
  confidence: number;
  value?: string | number | boolean | null;
  observedAt?: string | null;
  missingReason?: string;
  receiptId?: string;
  payloadHash?: string;
  capabilities?: string[];
  timestampProvenance?: "provider" | "transport_received" | "missing" | "invalid";
  receiptProviderFamily?: string;
  providerRootFamily?: string;
};

export type VlmBrainKernelFinding = {
  id: string;
  title: string;
  body: string;
  severity: VlmBrainKernelSeverity;
  confidence: number;
  evidenceIds: string[];
};

export type VlmBrainKernelAction = {
  id: string;
  title: string;
  body: string;
  required: boolean;
  owner: "ai" | "operator" | "user" | "provider" | "system";
};

export type VlmBrainKernelMissingData = {
  id: string;
  label: string;
  reason: string;
  blocksPublish?: boolean;
};

export type VlmBrainKernelInput<TInput = unknown> = {
  surface: VlmBrainKernelSurface;
  depth?: VlmBrainKernelDepth;
  locale?: VlmBrainKernelLocale;
  input: TInput;
  evidence?: VlmBrainKernelEvidenceItem[];
  intent?: string;
  memoryKey?: string;
  generatedAt?: string;
};

export type VlmBrainKernelOutput<TPayload = unknown> = {
  schemaVersion: "velmere.vlm.kernel.v1";
  calibrationVersion: VlmBrainCalibrationVersion;
  calibrationHash: VlmBrainCalibrationHash;
  traceId: string;
  generatedAt: string;
  surface: VlmBrainKernelSurface;
  depth: VlmBrainKernelDepth;
  locale: VlmBrainKernelLocale;
  status: VlmBrainKernelStatus;
  confidence: number;
  confidenceCap: number;
  sourceCount: number;
  sourceFamilies: string[];
  sourceMetadataCoverage: number;
  explicitMetadataEvidenceCount: number;
  partialMetadataEvidenceCount: number;
  inferredMetadataEvidenceCount: number;
  sourceTimestampCoverage: number;
  sourceTimestampValidCoverage: number;
  freshEvidenceCount: number;
  agingEvidenceCount: number;
  staleEvidenceCount: number;
  invalidTimestampCount: number;
  futureSkewEvidenceCount: number;
  freshnessProfileCounts: Record<VlmBrainKernelFreshnessProfile, number>;
  marketSessionProfileCounts: Record<VlmBrainKernelMarketSessionProfile, number>;
  sessionPausedEvidenceCount: number;
  providerHealthyCount: number;
  providerUnknownCount: number;
  providerDegradedCount: number;
  providerBreachedCount: number;
  providerQuarantinedCount: number;
  providerTelemetryEvidenceCount: number;
  providerP95BreachedCount: number;
  evidenceQuality: VlmBrainKernelEvidenceQuality;
  headline: string;
  summary: string;
  findings: VlmBrainKernelFinding[];
  missingData: VlmBrainKernelMissingData[];
  nextActions: VlmBrainKernelAction[];
  evidence: VlmBrainKernelEvidenceItem[];
  memory: {
    key?: string;
    writeRecommended: boolean;
    changeSummary: string;
  };
  payload: TPayload;
};

const SURFACE_LABELS: Record<VlmBrainKernelSurface, { pl: string; en: string; de: string }> = {
  shield: { pl: "Shield", en: "Shield", de: "Shield" },
  real_markets: { pl: "Real Markets", en: "Real Markets", de: "Real Markets" },
  shield_map: { pl: "Mapa Shield", en: "Shield Map", de: "Shield Map" },
  browser: { pl: "Browser", en: "Browser", de: "Browser" },
  lens: { pl: "Lens PDF", en: "Lens PDF", de: "Lens PDF" },
  audit: { pl: "Audyt", en: "Audit", de: "Audit" },
  product: { pl: "Product Brain", en: "Product Brain", de: "Product Brain" },
  shop: { pl: "Sklep", en: "Shop", de: "Shop" },
  admin: { pl: "Admin", en: "Admin", de: "Admin" },
  angel: { pl: "Angel", en: "Angel", de: "Angel" },
};

function clampPercent(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(VLM_BRAIN_CALIBRATION_MANIFEST.confidenceNormalization.percentMax, Math.round(value)));
}

/** Accepts either a 0..1 ratio or a 0..100 percent. */
export function normalizeVlmKernelConfidence(value: number | null | undefined, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return clampPercent(fallback);
  if (value > 0 && value <= VLM_BRAIN_CALIBRATION_MANIFEST.confidenceNormalization.ratioMax) {
    return clampPercent(value * VLM_BRAIN_CALIBRATION_MANIFEST.confidenceNormalization.percentMax);
  }
  return clampPercent(value);
}

function traceId(surface: VlmBrainKernelSurface): string {
  return createSecureRuntimeId(`vlm-${surface}`);
}

function normalizeLocale(locale?: VlmBrainKernelLocale): VlmBrainKernelLocale {
  return locale === "en" || locale === "de" ? locale : "pl";
}

function normalizeDepth(depth?: VlmBrainKernelDepth): VlmBrainKernelDepth {
  return depth === "basic" || depth === "pro" || depth === "advanced" ? depth : "basic";
}

function qualityCeiling(quality: VlmBrainKernelEvidenceQuality): number {
  return VLM_BRAIN_CALIBRATION_MANIFEST.qualityCeilings[quality];
}

function freshnessFactor(freshness: VlmBrainKernelFreshness): number {
  return VLM_BRAIN_CALIBRATION_MANIFEST.freshnessFactors[freshness];
}

function normalizeEvaluationTime(referenceTime?: string): string {
  const parsed = Date.parse(String(referenceTime ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

const FRESHNESS_PROFILE_KEYS = Object.keys(
  VLM_BRAIN_CALIBRATION_MANIFEST.freshnessProfiles,
) as VlmBrainKernelFreshnessProfile[];
const MARKET_SESSION_PROFILE_KEYS = Object.keys(
  VLM_BRAIN_CALIBRATION_MANIFEST.sessionPolicy.profiles,
) as VlmBrainKernelMarketSessionProfile[];

function normalizeMarketSessionProfile(
  profile: VlmBrainKernelMarketSessionProfile | null | undefined,
  freshnessProfile: VlmBrainKernelFreshnessProfile,
): VlmBrainKernelMarketSessionProfile {
  if (profile && MARKET_SESSION_PROFILE_KEYS.includes(profile)) return profile;
  return VLM_BRAIN_CALIBRATION_MANIFEST.sessionPolicy.defaultByFreshnessProfile[freshnessProfile];
}

function localDateKey(timestampMs: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestampMs));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function zonedDateTimeToUtcMs(dateKey: string, minuteOfDay: number, timezone: string): number {
  const shiftedDate = minuteOfDay >= 1440 ? shiftDateKey(dateKey, Math.floor(minuteOfDay / 1440)) : dateKey;
  const minute = ((minuteOfDay % 1440) + 1440) % 1440;
  const [year, month, day] = shiftedDate.split("-").map(Number);
  const hour = Math.floor(minute / 60);
  const minutePart = minute % 60;
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minutePart, 0, 0);
  let guess = desiredAsUtc;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
    const actualAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), 0, 0);
    const delta = desiredAsUtc - actualAsUtc;
    guess += delta;
    if (delta === 0) break;
  }
  return guess;
}

function marketSessionStateAt(
  timestampMs: number,
  profile: VlmBrainKernelMarketSessionProfile,
  closureDates: readonly string[],
): VlmBrainKernelSessionState {
  const policy = VLM_BRAIN_CALIBRATION_MANIFEST.sessionPolicy.profiles[profile];
  if (!policy.pausesFreshness) return profile === "always_open" ? "open" : "not_applicable";
  const dateKey = localDateKey(timestampMs, policy.timezone);
  if (closureDates.includes(dateKey)) return "closed";
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (!(policy.weekdays as readonly number[]).includes(weekday)) return "closed";
  const openMs = zonedDateTimeToUtcMs(dateKey, policy.openMinute, policy.timezone);
  const closeMs = zonedDateTimeToUtcMs(dateKey, policy.closeMinute, policy.timezone);
  return timestampMs >= openMs && timestampMs < closeMs ? "open" : "closed";
}

function sessionAdjustedAgeMs(
  sourceMs: number,
  evaluatedAtMs: number,
  profile: VlmBrainKernelMarketSessionProfile,
  closureDates: readonly string[],
): number {
  const rawAge = Math.max(0, evaluatedAtMs - sourceMs);
  const policy = VLM_BRAIN_CALIBRATION_MANIFEST.sessionPolicy.profiles[profile];
  if (!policy.pausesFreshness || rawAge === 0) return rawAge;
  const startKey = localDateKey(sourceMs, policy.timezone);
  const endKey = localDateKey(evaluatedAtMs, policy.timezone);
  const maxDays = VLM_BRAIN_CALIBRATION_MANIFEST.sessionPolicy.maxSessionLookbackDays;
  const calendarSpanDays = Math.ceil(rawAge / 86_400_000) + 3;
  if (calendarSpanDays > maxDays) return rawAge;
  const closures = new Set(closureDates);
  let activeMs = 0;
  let key = shiftDateKey(startKey, -1);
  const stopKey = shiftDateKey(endKey, 1);
  for (let guard = 0; guard <= maxDays + 4 && key <= stopKey; guard += 1, key = shiftDateKey(key, 1)) {
    if (closures.has(key)) continue;
    const [year, month, day] = key.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (!(policy.weekdays as readonly number[]).includes(weekday)) continue;
    const openMs = zonedDateTimeToUtcMs(key, policy.openMinute, policy.timezone);
    const closeMs = zonedDateTimeToUtcMs(key, policy.closeMinute, policy.timezone);
    const overlapStart = Math.max(sourceMs, openMs);
    const overlapEnd = Math.min(evaluatedAtMs, closeMs);
    if (overlapEnd > overlapStart) activeMs += overlapEnd - overlapStart;
  }
  return Math.max(0, activeMs);
}

function evaluateProviderHealth(item: VlmBrainKernelEvidenceItem): {
  status: VlmBrainKernelProviderHealthStatus;
  slaMs: number;
  latencyRatio: number | null;
  latencyEvaluationMs: number | null;
  quarantineReason: string | null;
} {
  const policy = VLM_BRAIN_CALIBRATION_MANIFEST.providerHealthPolicy;
  const slaMs = Number.isFinite(item.providerSlaMs) && Number(item.providerSlaMs) > 0
    ? Number(item.providerSlaMs)
    : policy.defaultSlaMsByFreshnessProfile[item.freshnessProfile];
  const thresholds = policy.quarantineThresholds;
  const quarantineReason = item.providerQuarantined
    ? "explicit_provider_quarantine"
    : (item.providerClockSkewStreak ?? 0) >= thresholds.clockSkewStreak
      ? "clock_skew_streak"
      : (item.providerInvalidTimestampStreak ?? 0) >= thresholds.invalidTimestampStreak
        ? "invalid_timestamp_streak"
        : (item.providerSlaBreachStreak ?? 0) >= thresholds.slaBreachStreak
          ? "sla_breach_streak"
          : (item.providerFailureStreak ?? 0) >= thresholds.failureStreak
            ? "provider_failure_streak"
            : null;
  if (quarantineReason) return { status: "quarantined", slaMs, latencyRatio: null, latencyEvaluationMs: null, quarantineReason };
  const currentLatency = Number.isFinite(item.providerLatencyMs) && Number(item.providerLatencyMs) >= 0
    ? Number(item.providerLatencyMs)
    : null;
  const percentilePolicy = policy.percentileEvaluation;
  const p95Latency = (item.providerTelemetrySampleCount ?? 0) >= percentilePolicy.minSamples
    && Number.isFinite(item.providerLatencyP95Ms)
    && Number(item.providerLatencyP95Ms) >= 0
      ? Number(item.providerLatencyP95Ms)
      : null;
  const latencyEvaluationMs = currentLatency === null
    ? p95Latency
    : p95Latency === null
      ? currentLatency
      : Math.max(currentLatency, p95Latency);
  if (latencyEvaluationMs === null) {
    return { status: "unknown", slaMs, latencyRatio: null, latencyEvaluationMs: null, quarantineReason: null };
  }
  const latencyRatio = latencyEvaluationMs / slaMs;
  if (latencyRatio > policy.breachedRatio) return { status: "breached", slaMs, latencyRatio, latencyEvaluationMs, quarantineReason: null };
  if (latencyRatio > policy.degradedRatio) return { status: "degraded", slaMs, latencyRatio, latencyEvaluationMs, quarantineReason: null };
  return { status: "healthy", slaMs, latencyRatio, latencyEvaluationMs, quarantineReason: null };
}

function normalizeFreshnessProfile(
  profile: VlmBrainKernelFreshnessProfile | null | undefined,
  _source: string,
  _providerFamily: string,
): VlmBrainKernelFreshnessProfile {
  if (profile && FRESHNESS_PROFILE_KEYS.includes(profile)) return profile;
  return VLM_BRAIN_CALIBRATION_MANIFEST.timestampPolicy.defaultProfile;
}

function derivedFreshnessFromAge(
  ageMs: number,
  profile: VlmBrainKernelFreshnessProfile,
): Exclude<VlmBrainKernelFreshness, "unknown"> {
  const policy = VLM_BRAIN_CALIBRATION_MANIFEST.freshnessProfiles[profile];
  if (ageMs <= policy.freshMaxAgeMs) return "fresh";
  if (ageMs <= policy.agingMaxAgeMs) return "aging";
  return "stale";
}

function conservativeFreshness(
  declared: VlmBrainKernelFreshness,
  derived: Exclude<VlmBrainKernelFreshness, "unknown">,
): VlmBrainKernelFreshness {
  if (declared === "unknown") return derived;
  const rank: Record<Exclude<VlmBrainKernelFreshness, "unknown">, number> = { fresh: 0, aging: 1, stale: 2 };
  return rank[declared] >= rank[derived] ? declared : derived;
}

export function validateVlmEvidenceTimestamp(
  item: VlmBrainKernelEvidenceItem,
  referenceTime?: string,
): VlmBrainKernelEvidenceItem {
  const evaluatedAt = Date.parse(normalizeEvaluationTime(referenceTime));
  const freshnessProfile = normalizeFreshnessProfile(item.freshnessProfile, item.source, item.providerFamily);
  const marketSessionProfile = normalizeMarketSessionProfile(item.marketSessionProfile, freshnessProfile);
  const marketClosureDates = Array.from(new Set((item.marketClosureDates ?? []).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))).sort();
  const providerHealth = evaluateProviderHealth({ ...item, freshnessProfile, marketSessionProfile, marketClosureDates });
  const healthFactor = VLM_BRAIN_CALIBRATION_MANIFEST.providerHealthPolicy.confidenceFactors[providerHealth.status];
  const healthAdjustedConfidence = normalizeVlmKernelConfidence(item.confidence, 0) * healthFactor;
  const rawTimestamp = String(item.sourceTimestamp ?? item.observedAt ?? "").trim();
  if (!rawTimestamp) {
    return {
      ...item,
      freshnessProfile,
      marketSessionProfile,
      marketClosureDates,
      sessionState: marketSessionStateAt(evaluatedAt, marketSessionProfile, marketClosureDates),
      sessionAdjustedAgeMs: null,
      providerSlaMs: providerHealth.slaMs,
      providerLatencyRatio: providerHealth.latencyRatio,
      providerLatencyEvaluationMs: providerHealth.latencyEvaluationMs,
      providerHealthStatus: providerHealth.status,
      quarantineReason: providerHealth.quarantineReason,
      confidence: normalizeVlmKernelConfidence(healthAdjustedConfidence, 0),
      sourceTimestamp: null,
      timestampStatus: "missing",
      sourceAgeMs: null,
      effectiveFreshness: VLM_BRAIN_CALIBRATION_MANIFEST.timestampPolicy.missingTimestampFreshness,
      freshness: VLM_BRAIN_CALIBRATION_MANIFEST.timestampPolicy.missingTimestampFreshness,
    };
  }

  const parsed = Date.parse(rawTimestamp);
  if (!Number.isFinite(parsed)) {
    return {
      ...item,
      freshnessProfile,
      marketSessionProfile,
      marketClosureDates,
      sessionState: marketSessionStateAt(evaluatedAt, marketSessionProfile, marketClosureDates),
      sessionAdjustedAgeMs: null,
      providerSlaMs: providerHealth.slaMs,
      providerLatencyRatio: providerHealth.latencyRatio,
      providerLatencyEvaluationMs: providerHealth.latencyEvaluationMs,
      providerHealthStatus: providerHealth.status,
      quarantineReason: providerHealth.quarantineReason,
      sourceTimestamp: rawTimestamp,
      timestampStatus: "invalid",
      sourceAgeMs: null,
      effectiveFreshness: "stale",
      freshness: "stale",
      confidence: VLM_BRAIN_CALIBRATION_MANIFEST.timestampPolicy.invalidTimestampConfidence,
    };
  }

  const signedAgeMs = evaluatedAt - parsed;
  if (signedAgeMs < -VLM_BRAIN_CALIBRATION_MANIFEST.timestampPolicy.maxFutureSkewMs) {
    return {
      ...item,
      freshnessProfile,
      marketSessionProfile,
      marketClosureDates,
      sessionState: marketSessionStateAt(evaluatedAt, marketSessionProfile, marketClosureDates),
      sessionAdjustedAgeMs: null,
      providerSlaMs: providerHealth.slaMs,
      providerLatencyRatio: providerHealth.latencyRatio,
      providerLatencyEvaluationMs: providerHealth.latencyEvaluationMs,
      providerHealthStatus: providerHealth.status,
      quarantineReason: providerHealth.quarantineReason,
      sourceTimestamp: new Date(parsed).toISOString(),
      timestampStatus: "future_skew",
      sourceAgeMs: signedAgeMs,
      effectiveFreshness: "stale",
      freshness: "stale",
      confidence: VLM_BRAIN_CALIBRATION_MANIFEST.timestampPolicy.invalidTimestampConfidence,
    };
  }

  const sourceAgeMs = Math.max(0, signedAgeMs);
  const adjustedAgeMs = sessionAdjustedAgeMs(parsed, evaluatedAt, marketSessionProfile, marketClosureDates);
  const derivedFreshness = derivedFreshnessFromAge(adjustedAgeMs, freshnessProfile);
  const effectiveFreshness = conservativeFreshness(item.freshness, derivedFreshness);
  return {
    ...item,
    freshnessProfile,
    marketSessionProfile,
    marketClosureDates,
    sessionState: marketSessionStateAt(evaluatedAt, marketSessionProfile, marketClosureDates),
    sessionAdjustedAgeMs: adjustedAgeMs,
    providerSlaMs: providerHealth.slaMs,
    providerLatencyRatio: providerHealth.latencyRatio,
    providerLatencyEvaluationMs: providerHealth.latencyEvaluationMs,
    providerHealthStatus: providerHealth.status,
    quarantineReason: providerHealth.quarantineReason,
    confidence: normalizeVlmKernelConfidence(healthAdjustedConfidence, 0),
    sourceTimestamp: new Date(parsed).toISOString(),
    timestampStatus: "valid",
    sourceAgeMs,
    effectiveFreshness,
    freshness: effectiveFreshness,
  };
}

/**
 * Collapses quote/history/chart endpoints from the same vendor into one family.
 * This stops one provider from masquerading as several independent sources.
 */
export function vlmKernelSourceFamily(source: string): string {
  const normalized = String(source || "")
    .trim()
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/^www\./, "")
    .replace(/[\s_:/\\|.-]+/g, " ");

  const aliases: Array<[RegExp, string]> = [
    [/\bbinance\b/, "binance"],
    [/\byahoo(?: finance)?\b/, "yahoo-finance"],
    [/\bstooq\b/, "stooq"],
    [/\bcoin\s*gecko\b/, "coingecko"],
    [/\bcoin\s*market\s*cap\b/, "coinmarketcap"],
    [/\bdex\s*screener\b/, "dexscreener"],
    [/\bdefi\s*llama\b/, "defillama"],
    [/\bpolygon\b/, "polygon"],
    [/\btwelve\s*data\b/, "twelvedata"],
    [/\balpha\s*vantage\b/, "alphavantage"],
    [/\bfinnhub\b/, "finnhub"],
    [/\bmexc\b/, "mexc"],
    [/\bgithub\b/, "github"],
    [/\bsemgrep\b/, "semgrep-cloud"],
    [/\bprintful\b/, "printful"],
    [/\btapstitch\b/, "tapstitch"],
    [/\bvlm memory\b|\bvlmere memory\b/, "vlm-memory"],
    [/\brisk engine\b|\bvlm risk engine\b/, "vlm-risk-engine"],
    [/\baudit brain\b/, "vlm-audit-brain"],
  ];

  for (const [pattern, family] of aliases) {
    if (pattern.test(normalized)) return family;
  }

  return normalized || "unknown-source";
}

export function normalizeVlmProviderFamily(providerFamily: string | null | undefined, source: string): string {
  const explicit = String(providerFamily ?? "").trim();
  return vlmKernelSourceFamily(explicit || source);
}

function inferEvidenceIndependence(source: string, providerFamily: string): VlmBrainKernelEvidenceIndependence {
  const normalized = `${source} ${providerFamily}`.toLowerCase();
  if (/operator|manual|intake/.test(normalized)) return "operator";
  if (/^vlm-|velmere-|risk-engine|audit-brain|gap-detector|memory|runtime|parity|claim-source/.test(providerFamily) || /vlm|velmere|risk engine|audit brain|gap detector|memory|runtime|parity/.test(normalized)) return "derived";
  return "unknown";
}

function countsAsIndependentSource(item: VlmBrainKernelEvidenceItem): boolean {
  if (item.providerMetadataStatus !== "explicit") return false;
  if ((VLM_BRAIN_CALIBRATION_MANIFEST.independenceExcluded as readonly string[]).includes(item.independence)) return false;
  if (item.independence === "independent" || item.independence === "same_provider") return true;
  return false;
}

function dedupeMissingData(items: VlmBrainKernelMissingData[]): VlmBrainKernelMissingData[] {
  const byId = new Map<string, VlmBrainKernelMissingData>();
  for (const item of items) {
    const id = String(item.id || item.label || "missing").trim();
    const previous = byId.get(id);
    if (!previous) {
      byId.set(id, { ...item, id });
      continue;
    }
    byId.set(id, {
      ...previous,
      blocksPublish: Boolean(previous.blocksPublish || item.blocksPublish),
      reason: previous.reason.length >= item.reason.length ? previous.reason : item.reason,
    });
  }
  return Array.from(byId.values());
}

export function createVlmKernelEvidenceItem(input: {
  id: string;
  label: string;
  source: string;
  providerFamily?: string;
  independence?: VlmBrainKernelEvidenceIndependence;
  sourceTimestamp?: string | null;
  freshnessProfile?: VlmBrainKernelFreshnessProfile;
  marketSessionProfile?: VlmBrainKernelMarketSessionProfile;
  marketClosureDates?: string[];
  providerLatencyMs?: number | null;
  providerLatencyP50Ms?: number | null;
  providerLatencyP95Ms?: number | null;
  providerLatencyP99Ms?: number | null;
  providerTelemetrySampleCount?: number;
  providerTelemetryUpdatedAt?: string | null;
  providerSlaMs?: number | null;
  providerFailureStreak?: number;
  providerClockSkewStreak?: number;
  providerInvalidTimestampStreak?: number;
  providerSlaBreachStreak?: number;
  providerQuarantined?: boolean;
  quality?: VlmBrainKernelEvidenceQuality;
  freshness?: VlmBrainKernelFreshness;
  confidence?: number;
  value?: string | number | boolean | null;
  observedAt?: string | null;
  missingReason?: string;
  receiptId?: string;
  payloadHash?: string;
  capabilities?: string[];
  timestampProvenance?: "provider" | "transport_received" | "missing" | "invalid";
  receiptProviderFamily?: string;
  providerRootFamily?: string;
}): VlmBrainKernelEvidenceItem {
  const quality = input.quality ?? (input.missingReason ? "missing" : "medium");
  const hasProviderFamily = Object.prototype.hasOwnProperty.call(input, "providerFamily") && Boolean(String(input.providerFamily ?? "").trim());
  const hasIndependence = Object.prototype.hasOwnProperty.call(input, "independence") && Boolean(input.independence);
  const hasSourceTimestamp = Object.prototype.hasOwnProperty.call(input, "sourceTimestamp") || Object.prototype.hasOwnProperty.call(input, "observedAt");
  const explicitMetadataFields = [hasProviderFamily, hasIndependence, hasSourceTimestamp].filter(Boolean).length;
  const providerMetadataStatus: VlmBrainKernelProviderMetadataStatus = explicitMetadataFields === 3
    ? "explicit"
    : explicitMetadataFields > 0
      ? "partial"
      : "inferred";
  const providerFamily = normalizeVlmProviderFamily(input.providerFamily, input.source);
  const independence = input.independence ?? inferEvidenceIndependence(input.source, providerFamily);
  return {
    id: input.id,
    label: input.label,
    source: input.source,
    providerFamily,
    independence,
    providerMetadataStatus,
    sourceTimestamp: input.sourceTimestamp ?? input.observedAt ?? null,
    freshnessProfile: normalizeFreshnessProfile(input.freshnessProfile, input.source, providerFamily),
    marketSessionProfile: normalizeMarketSessionProfile(
      input.marketSessionProfile,
      normalizeFreshnessProfile(input.freshnessProfile, input.source, providerFamily),
    ),
    marketClosureDates: Array.from(new Set((input.marketClosureDates ?? []).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))).sort(),
    providerLatencyMs: input.providerLatencyMs ?? null,
    providerLatencyP50Ms: input.providerLatencyP50Ms ?? null,
    providerLatencyP95Ms: input.providerLatencyP95Ms ?? null,
    providerLatencyP99Ms: input.providerLatencyP99Ms ?? null,
    providerTelemetrySampleCount: Math.max(0, Math.trunc(input.providerTelemetrySampleCount ?? 0)),
    providerTelemetryUpdatedAt: input.providerTelemetryUpdatedAt ?? null,
    providerSlaMs: input.providerSlaMs ?? null,
    providerFailureStreak: Math.max(0, Math.trunc(input.providerFailureStreak ?? 0)),
    providerClockSkewStreak: Math.max(0, Math.trunc(input.providerClockSkewStreak ?? 0)),
    providerInvalidTimestampStreak: Math.max(0, Math.trunc(input.providerInvalidTimestampStreak ?? 0)),
    providerSlaBreachStreak: Math.max(0, Math.trunc(input.providerSlaBreachStreak ?? 0)),
    providerQuarantined: Boolean(input.providerQuarantined),
    quality,
    freshness: input.freshness ?? "unknown",
    // No confidence supplied means no confidence claim. Adapters must opt in explicitly.
    confidence: normalizeVlmKernelConfidence(input.confidence, 0),
    value: input.value,
    observedAt: input.observedAt ?? null,
    missingReason: input.missingReason,
    receiptId: input.receiptId,
    payloadHash: input.payloadHash,
    capabilities: Array.from(new Set((input.capabilities ?? []).map((item) => item.trim()).filter(Boolean))).sort(),
    timestampProvenance: input.timestampProvenance,
    receiptProviderFamily: input.receiptProviderFamily,
    providerRootFamily: input.providerRootFamily,
  };
}

export function evaluateVlmKernelEvidence(
  evidence: VlmBrainKernelEvidenceItem[],
  referenceTime?: string,
): {
  evidence: VlmBrainKernelEvidenceItem[];
  sourceCount: number;
  sourceFamilies: string[];
  sourceMetadataCoverage: number;
  explicitMetadataEvidenceCount: number;
  partialMetadataEvidenceCount: number;
  inferredMetadataEvidenceCount: number;
  sourceTimestampCoverage: number;
  sourceTimestampValidCoverage: number;
  freshEvidenceCount: number;
  agingEvidenceCount: number;
  staleEvidenceCount: number;
  invalidTimestampCount: number;
  futureSkewEvidenceCount: number;
  freshnessProfileCounts: Record<VlmBrainKernelFreshnessProfile, number>;
  marketSessionProfileCounts: Record<VlmBrainKernelMarketSessionProfile, number>;
  sessionPausedEvidenceCount: number;
  providerHealthyCount: number;
  providerUnknownCount: number;
  providerDegradedCount: number;
  providerBreachedCount: number;
  providerQuarantinedCount: number;
  providerTelemetryEvidenceCount: number;
  providerP95BreachedCount: number;
  confidenceCap: number;
  evidenceQuality: VlmBrainKernelEvidenceQuality;
  missingData: VlmBrainKernelMissingData[];
} {
  const evaluatedAt = normalizeEvaluationTime(referenceTime);
  const normalizedEvidence = evidence.map((item) => {
    const providerFamily = normalizeVlmProviderFamily(item.providerFamily, item.source);
    const normalized = {
      ...item,
      providerFamily,
      independence: item.independence ?? inferEvidenceIndependence(item.source, providerFamily),
      providerMetadataStatus: item.providerMetadataStatus ?? "inferred",
      sourceTimestamp: item.sourceTimestamp ?? item.observedAt ?? null,
      freshnessProfile: normalizeFreshnessProfile(item.freshnessProfile, item.source, providerFamily),
      marketSessionProfile: normalizeMarketSessionProfile(
        item.marketSessionProfile,
        normalizeFreshnessProfile(item.freshnessProfile, item.source, providerFamily),
      ),
      marketClosureDates: item.marketClosureDates ?? [],
      confidence: normalizeVlmKernelConfidence(item.confidence, 0),
    };
    return validateVlmEvidenceTimestamp(normalized, evaluatedAt);
  });

  const timestampIssues: VlmBrainKernelMissingData[] = normalizedEvidence
    .filter((item) => item.timestampStatus === "invalid" || item.timestampStatus === "future_skew")
    .map((item) => ({
      id: `${item.id}.source_timestamp`,
      label: `${item.label} timestamp`,
      reason: item.timestampStatus === "future_skew"
        ? "Source timestamp exceeds the allowed future clock skew and was excluded from confidence."
        : "Source timestamp is invalid and was excluded from confidence.",
      blocksPublish: false,
    }));

  const providerIssues: VlmBrainKernelMissingData[] = normalizedEvidence
    .filter((item) => item.providerHealthStatus === "degraded" || item.providerHealthStatus === "breached" || item.providerHealthStatus === "quarantined")
    .map((item) => ({
      id: `${item.id}.provider_health`,
      label: `${item.label} provider health`,
      reason: item.providerHealthStatus === "quarantined"
        ? `Provider was quarantined (${item.quarantineReason ?? "health policy"}) and excluded from confidence/source quorum.`
        : item.providerHealthStatus === "breached"
          ? "Provider response latency exceeded the critical SLA ratio and confidence was reduced."
          : "Provider response latency exceeded its SLA and confidence was reduced.",
      blocksPublish: item.providerHealthStatus === "quarantined",
    }));

  const missingData = dedupeMissingData([
    ...normalizedEvidence
      .filter((item) => item.quality === "missing" || item.missingReason)
      .map((item) => ({
        id: item.id,
        label: item.label,
        reason: item.missingReason ?? "Missing or unverified evidence.",
        blocksPublish: item.quality === "missing",
      })),
    ...timestampIssues,
    ...providerIssues,
    ...normalizedEvidence
      .filter((item) => (item.independence === "independent" || item.independence === "same_provider") && item.providerMetadataStatus !== "explicit")
      .map((item) => ({
        id: `${item.id}.provider_metadata`,
        label: `${item.label} provider metadata`,
        reason: "External evidence is missing an explicit providerFamily, independence or sourceTimestamp field and was excluded from source counting.",
        blocksPublish: false,
      })),
  ]);

  const credibleEvidence = normalizedEvidence.filter(
    (item) => item.quality !== "missing" && !item.missingReason && item.confidence > 0
      && item.timestampStatus !== "invalid" && item.timestampStatus !== "future_skew"
      && item.providerHealthStatus !== "quarantined",
  );
  const independentEvidence = credibleEvidence.filter(countsAsIndependentSource);
  const sourceFamilies = Array.from(new Set(independentEvidence.map((item) => item.providerFamily))).sort();
  const sourceCount = sourceFamilies.length;
  const explicitMetadataEvidenceCount = normalizedEvidence.filter((item) => item.providerMetadataStatus === "explicit").length;
  const partialMetadataEvidenceCount = normalizedEvidence.filter((item) => item.providerMetadataStatus === "partial").length;
  const inferredMetadataEvidenceCount = normalizedEvidence.filter((item) => item.providerMetadataStatus === "inferred").length;
  const sourceMetadataCoverage = normalizedEvidence.length
    ? clampPercent((explicitMetadataEvidenceCount / normalizedEvidence.length) * 100)
    : 0;
  const sourceTimestampCoverage = normalizedEvidence.length
    ? clampPercent((normalizedEvidence.filter((item) => Boolean(item.sourceTimestamp)).length / normalizedEvidence.length) * 100)
    : 0;
  const sourceTimestampValidCoverage = normalizedEvidence.length
    ? clampPercent((normalizedEvidence.filter((item) => item.timestampStatus === "valid").length / normalizedEvidence.length) * 100)
    : 0;
  const freshEvidenceCount = normalizedEvidence.filter((item) => item.timestampStatus === "valid" && item.effectiveFreshness === "fresh").length;
  const agingEvidenceCount = normalizedEvidence.filter((item) => item.timestampStatus === "valid" && item.effectiveFreshness === "aging").length;
  const staleEvidenceCount = normalizedEvidence.filter((item) => item.timestampStatus === "valid" && item.effectiveFreshness === "stale").length;
  const invalidTimestampCount = normalizedEvidence.filter((item) => item.timestampStatus === "invalid").length;
  const futureSkewEvidenceCount = normalizedEvidence.filter((item) => item.timestampStatus === "future_skew").length;
  const freshnessProfileCounts = FRESHNESS_PROFILE_KEYS.reduce((counts, profile) => {
    counts[profile] = normalizedEvidence.filter((item) => item.freshnessProfile === profile).length;
    return counts;
  }, {} as Record<VlmBrainKernelFreshnessProfile, number>);
  const marketSessionProfileCounts = MARKET_SESSION_PROFILE_KEYS.reduce((counts, profile) => {
    counts[profile] = normalizedEvidence.filter((item) => item.marketSessionProfile === profile).length;
    return counts;
  }, {} as Record<VlmBrainKernelMarketSessionProfile, number>);
  const sessionPausedEvidenceCount = normalizedEvidence.filter((item) =>
    item.sourceAgeMs !== null && item.sourceAgeMs !== undefined
      && item.sessionAdjustedAgeMs !== null && item.sessionAdjustedAgeMs !== undefined
      && item.sessionAdjustedAgeMs < item.sourceAgeMs,
  ).length;
  const providerHealthyCount = normalizedEvidence.filter((item) => item.providerHealthStatus === "healthy").length;
  const providerUnknownCount = normalizedEvidence.filter((item) => item.providerHealthStatus === "unknown").length;
  const providerDegradedCount = normalizedEvidence.filter((item) => item.providerHealthStatus === "degraded").length;
  const providerBreachedCount = normalizedEvidence.filter((item) => item.providerHealthStatus === "breached").length;
  const providerQuarantinedCount = normalizedEvidence.filter((item) => item.providerHealthStatus === "quarantined").length;
  const providerTelemetryEvidenceCount = normalizedEvidence.filter((item) => (item.providerTelemetrySampleCount ?? 0) > 0).length;
  const providerP95BreachedCount = normalizedEvidence.filter((item) =>
    (item.providerTelemetrySampleCount ?? 0) >= VLM_BRAIN_CALIBRATION_MANIFEST.providerHealthPolicy.percentileEvaluation.minSamples
      && Number.isFinite(item.providerLatencyP95Ms)
      && Number(item.providerLatencyP95Ms) > Number(item.providerSlaMs ?? 0) * VLM_BRAIN_CALIBRATION_MANIFEST.providerHealthPolicy.breachedRatio,
  ).length;

  const timestampMetrics = {
    sourceTimestampCoverage,
    sourceTimestampValidCoverage,
    freshEvidenceCount,
    agingEvidenceCount,
    staleEvidenceCount,
    invalidTimestampCount,
    futureSkewEvidenceCount,
    freshnessProfileCounts,
    marketSessionProfileCounts,
    sessionPausedEvidenceCount,
    providerHealthyCount,
    providerUnknownCount,
    providerDegradedCount,
    providerBreachedCount,
    providerQuarantinedCount,
    providerTelemetryEvidenceCount,
    providerP95BreachedCount,
  };

  if (credibleEvidence.length === 0 || sourceCount === 0) {
    return {
      evidence: normalizedEvidence,
      sourceCount: 0,
      sourceFamilies: [],
      sourceMetadataCoverage,
      explicitMetadataEvidenceCount,
      partialMetadataEvidenceCount,
      inferredMetadataEvidenceCount,
      ...timestampMetrics,
      confidenceCap: 0,
      evidenceQuality: "missing",
      missingData: dedupeMissingData([
        ...missingData,
        { id: "evidence.none", label: "Evidence", reason: "No confidence-bearing evidence packet was provided.", blocksPublish: true },
      ]),
    };
  }

  const adjustedScores = credibleEvidence.map((item) => {
    const bounded = Math.min(item.confidence, qualityCeiling(item.quality));
    return bounded * freshnessFactor(item.effectiveFreshness ?? item.freshness);
  });
  const averageAdjusted = adjustedScores.reduce((sum, value) => sum + value, 0) / adjustedScores.length;
  const sourceCeiling = sourceCount >= 3
    ? VLM_BRAIN_CALIBRATION_MANIFEST.sourceCeilings.threePlus
    : sourceCount === 2
      ? VLM_BRAIN_CALIBRATION_MANIFEST.sourceCeilings.two
      : VLM_BRAIN_CALIBRATION_MANIFEST.sourceCeilings.one;
  const blockingMissingCount = missingData.filter((item) => item.blocksPublish).length;
  const nonBlockingMissingCount = missingData.length - blockingMissingCount;
  const missingPenalty = Math.min(
    VLM_BRAIN_CALIBRATION_MANIFEST.missingPenalties.max,
    blockingMissingCount * VLM_BRAIN_CALIBRATION_MANIFEST.missingPenalties.blocking
      + nonBlockingMissingCount * VLM_BRAIN_CALIBRATION_MANIFEST.missingPenalties.nonBlocking,
  );
  const coverageFactor = credibleEvidence.length / Math.max(1, normalizedEvidence.length);
  const coverageAdjusted = averageAdjusted * (
    VLM_BRAIN_CALIBRATION_MANIFEST.coverageBlend.base
      + coverageFactor * VLM_BRAIN_CALIBRATION_MANIFEST.coverageBlend.evidenceRatioWeight
  );
  const cap = clampPercent(Math.min(sourceCeiling, coverageAdjusted - missingPenalty), 0);
  const evidenceQuality: VlmBrainKernelEvidenceQuality = cap >= VLM_BRAIN_CALIBRATION_MANIFEST.evidenceQualityBands.strongMin
    ? "strong"
    : cap >= VLM_BRAIN_CALIBRATION_MANIFEST.evidenceQualityBands.mediumMin
      ? "medium"
      : cap >= VLM_BRAIN_CALIBRATION_MANIFEST.evidenceQualityBands.weakMin
        ? "weak"
        : "missing";

  return {
    evidence: normalizedEvidence,
    sourceCount,
    sourceFamilies,
    sourceMetadataCoverage,
    explicitMetadataEvidenceCount,
    partialMetadataEvidenceCount,
    inferredMetadataEvidenceCount,
    ...timestampMetrics,
    confidenceCap: cap,
    evidenceQuality,
    missingData,
  };
}

function localizedKernelCopy(locale: VlmBrainKernelLocale) {
  if (locale === "de") return {
    ready: "Bereit für die nächste Aktion",
    review: "Manuelle Prüfung empfohlen",
    blocked: "Blockiert bis fehlende Daten geprüft sind",
    summary: "Der zentrale VLM Brain Kernel hat Evidenz, Konfidenz, fehlende Daten und nächste Schritte in einem einheitlichen Ergebnis zusammengeführt.",
    missing: "Fehlende Daten begrenzen die Konfidenz.",
    next: "Fehlende Nachweise prüfen und Ergebnis erneut berechnen.",
    memory: "Neue Analyse speichern, damit spätere Läufe Änderungen erkennen können.",
  };
  if (locale === "en") return {
    ready: "Ready for the next action",
    review: "Manual review recommended",
    blocked: "Blocked until missing data is verified",
    summary: "The central VLM Brain Kernel merged evidence, confidence, missing data and next actions into one unified result.",
    missing: "Missing data limits confidence.",
    next: "Verify missing evidence and recalculate the result.",
    memory: "Store this analysis so later runs can detect changes.",
  };
  return {
    ready: "Gotowe do kolejnego kroku",
    review: "Zalecana ręczna weryfikacja",
    blocked: "Zablokowane do czasu potwierdzenia brakujących danych",
    summary: "Centralny VLM Brain Kernel połączył evidence, confidence, braki danych i następne kroki w jeden wspólny wynik.",
    missing: "Braki danych ograniczają pewność.",
    next: "Zweryfikuj brakujące dowody i przelicz wynik ponownie.",
    memory: "Zapisz analizę, żeby kolejne uruchomienia wykrywały zmiany.",
  };
}

export function runVlmBrainKernel<TPayload = unknown>(input: VlmBrainKernelInput, payload: TPayload, additions?: {
  findings?: VlmBrainKernelFinding[];
  nextActions?: VlmBrainKernelAction[];
  missingData?: VlmBrainKernelMissingData[];
  confidence?: number;
  headline?: string;
  summary?: string;
  status?: VlmBrainKernelStatus;
}): VlmBrainKernelOutput<TPayload> {
  const locale = normalizeLocale(input.locale);
  const depth = normalizeDepth(input.depth);
  const generatedAt = normalizeEvaluationTime(input.generatedAt);
  const evidenceState = evaluateVlmKernelEvidence(input.evidence ?? [], generatedAt);
  const evidence = evidenceState.evidence;
  const copy = localizedKernelCopy(locale);
  const mergedMissing = dedupeMissingData([...evidenceState.missingData, ...(additions?.missingData ?? [])]);
  const hasBlockingMissing = mergedMissing.some((item) => item.blocksPublish);
  const confidenceCap = evidenceState.confidenceCap;
  const requestedConfidence = normalizeVlmKernelConfidence(additions?.confidence, confidenceCap);
  const confidence = clampPercent(Math.min(requestedConfidence, confidenceCap), 0);

  let status: VlmBrainKernelStatus;
  if (hasBlockingMissing || additions?.status === "blocked") status = "blocked";
  else if (
    evidenceState.sourceCount < VLM_BRAIN_CALIBRATION_MANIFEST.statusRules.readyMinSources
    || confidence < VLM_BRAIN_CALIBRATION_MANIFEST.statusRules.readyMinConfidence
    || additions?.status === "needs_review"
  ) status = "needs_review";
  else status = "ready";

  const surfaceLabel = SURFACE_LABELS[input.surface]?.[locale] ?? input.surface;
  const defaultHeadline = status === "blocked" ? copy.blocked : status === "needs_review" ? copy.review : copy.ready;
  const normalizedFindings = (additions?.findings ?? []).map((finding) => ({
    ...finding,
    confidence: Math.min(normalizeVlmKernelConfidence(finding.confidence, 0), confidenceCap),
    evidenceIds: Array.from(new Set((finding.evidenceIds ?? []).filter(Boolean))),
  }));
  const missingFinding: VlmBrainKernelFinding | null = mergedMissing.length
    ? {
        id: "kernel.missing-data",
        title: copy.missing,
        body: mergedMissing.map((item) => `${item.label}: ${item.reason}`).join(" ").slice(0, 900),
        severity: hasBlockingMissing ? "warning" : "watch",
        confidence,
        evidenceIds: mergedMissing.map((item) => item.id),
      }
    : null;

  const nextActions = additions?.nextActions?.length
    ? additions.nextActions.map((action) => ({ ...action, required: status === "blocked" ? true : action.required }))
    : [{ id: "kernel.next.verify", title: copy.next, body: copy.next, required: status !== "ready", owner: "operator" as const }];

  return {
    schemaVersion: "velmere.vlm.kernel.v1",
    calibrationVersion: VLM_BRAIN_CALIBRATION_VERSION,
    calibrationHash: VLM_BRAIN_CALIBRATION_HASH,
    traceId: traceId(input.surface),
    generatedAt,
    surface: input.surface,
    depth,
    locale,
    status,
    confidence,
    confidenceCap,
    sourceCount: evidenceState.sourceCount,
    sourceFamilies: evidenceState.sourceFamilies,
    sourceMetadataCoverage: evidenceState.sourceMetadataCoverage,
    explicitMetadataEvidenceCount: evidenceState.explicitMetadataEvidenceCount,
    partialMetadataEvidenceCount: evidenceState.partialMetadataEvidenceCount,
    inferredMetadataEvidenceCount: evidenceState.inferredMetadataEvidenceCount,
    sourceTimestampCoverage: evidenceState.sourceTimestampCoverage,
    sourceTimestampValidCoverage: evidenceState.sourceTimestampValidCoverage,
    freshEvidenceCount: evidenceState.freshEvidenceCount,
    agingEvidenceCount: evidenceState.agingEvidenceCount,
    staleEvidenceCount: evidenceState.staleEvidenceCount,
    invalidTimestampCount: evidenceState.invalidTimestampCount,
    futureSkewEvidenceCount: evidenceState.futureSkewEvidenceCount,
    freshnessProfileCounts: evidenceState.freshnessProfileCounts,
    marketSessionProfileCounts: evidenceState.marketSessionProfileCounts,
    sessionPausedEvidenceCount: evidenceState.sessionPausedEvidenceCount,
    providerHealthyCount: evidenceState.providerHealthyCount,
    providerUnknownCount: evidenceState.providerUnknownCount,
    providerDegradedCount: evidenceState.providerDegradedCount,
    providerBreachedCount: evidenceState.providerBreachedCount,
    providerQuarantinedCount: evidenceState.providerQuarantinedCount,
    providerTelemetryEvidenceCount: evidenceState.providerTelemetryEvidenceCount,
    providerP95BreachedCount: evidenceState.providerP95BreachedCount,
    evidenceQuality: evidenceState.evidenceQuality,
    headline: additions?.headline ?? `${surfaceLabel}: ${defaultHeadline}`,
    summary: additions?.summary ?? copy.summary,
    findings: [...normalizedFindings, ...(missingFinding ? [missingFinding] : [])],
    missingData: mergedMissing,
    nextActions,
    evidence,
    memory: {
      key: input.memoryKey,
      writeRecommended: Boolean(input.memoryKey),
      changeSummary: copy.memory,
    },
    payload,
  };
}
