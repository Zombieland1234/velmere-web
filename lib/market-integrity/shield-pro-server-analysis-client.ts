import { createBrowserSecureId } from "@/lib/runtime/browser-secure-id";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import type {
  AnalysisLocale,
  AnalysisResult,
  AnalysisSignal,
  AnalysisTier,
  VlmAnalysisAsset,
} from "@/lib/market-integrity/vlm-analysis";

const SHIELD_PRO_ANALYSIS_ENDPOINT = "/api/market-integrity/vlm";
const SHIELD_PRO_ANALYSIS_TIMEOUT_MS = 15_000;
const SHIELD_PRO_RESPONSE_MAX_BYTES = 1_048_576;
const SHIELD_PRO_PACKET_MAX_AGE_MS = 10 * 60_000;
const SAFE_REQUEST_ID = /^[A-Za-z0-9:._-]{8,160}$/u;
const FORBIDDEN_BIDI_TEXT = /[\u202a-\u202e\u2066-\u2069]/u;

type ShieldProPaidTier = Extract<AnalysisTier, "pro" | "advanced">;
type ShieldProFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ShieldProPayload = {
  mode?: unknown;
  result?: unknown;
  kernel?: unknown;
  publicEvidencePacket?: unknown;
  commercialDelivery?: unknown;
  access?: unknown;
};

type StrictPacket = {
  observedAt: string;
  sourceCount: number;
  providers: string[];
  evidenceIdsByFinding: Map<string, string[]>;
};

type StrictKernelFinding = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "watch" | "high" | "critical";
  evidenceIds: string[];
};

type StrictPaidPayload = {
  riskScore: number;
  verdict: string;
  summary: string;
  dataQuality: string;
  completedAt: string;
  sourceCount: number;
  providers: string[];
  findings: StrictKernelFinding[];
  packet: StrictPacket;
};

export type ShieldProServerAnalysisErrorCode =
  | "shield_pro_entitlement_required"
  | "shield_pro_paid_response_invalid"
  | "shield_pro_server_unavailable";

export class ShieldProServerAnalysisError extends Error {
  readonly code: ShieldProServerAnalysisErrorCode;
  readonly status: number;

  constructor(code: ShieldProServerAnalysisErrorCode, status: number) {
    super(code);
    this.name = "ShieldProServerAnalysisError";
    this.code = code;
    this.status = status;
  }
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasForbiddenText(value: string) {
  return FORBIDDEN_BIDI_TEXT.test(value) || Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim();
  if (!normalized || normalized.length > maxLength || hasForbiddenText(normalized)) return null;
  return normalized;
}

function integer(value: unknown, min: number, max: number): number | null {
  return Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max
    ? Number(value)
    : null;
}

function finite(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function exactStringArray(value: unknown, maxItems: number, maxItemLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const rows: string[] = [];
  for (const item of value) {
    const normalized = text(item, maxItemLength);
    if (!normalized) return null;
    rows.push(normalized);
  }
  return rows;
}

function normalizedIdentity(value: unknown) {
  return text(value, 96)?.toUpperCase().replace(/\s+/gu, " ") ?? null;
}

function currentTimestamp(value: unknown, now: number): string | null {
  const candidate = text(value, 64);
  const timestamp = candidate ? Date.parse(candidate) : Number.NaN;
  const age = now - timestamp;
  if (!candidate || !Number.isFinite(timestamp) || age < -60_000 || age > SHIELD_PRO_PACKET_MAX_AGE_MS) return null;
  return new Date(timestamp).toISOString();
}

function validateCommercialBoundary(payload: ShieldProPayload, tier: ShieldProPaidTier) {
  const delivery = object(payload.commercialDelivery);
  const access = object(payload.access);
  const blockers = exactStringArray(delivery?.blockers, 32, 160);
  const accessMode = text(access?.accessMode, 64);
  const accessModeValid = accessMode === "server_entitlement"
    || accessMode === (tier === "pro" ? "paid_pro" : "paid_advanced");
  return delivery?.state === "paid_delivery_ready"
    && delivery.deliveryAllowed === true
    && delivery.captureAllowed === true
    && blockers !== null
    && blockers.length === 0
    && access?.depth === tier
    && access.paidRequired === true
    && accessModeValid;
}

function validatePacket(
  value: unknown,
  args: { asset: VlmAnalysisAsset; tier: ShieldProPaidTier; requestId: string; now: number },
): StrictPacket | null {
  const packet = object(value);
  const packetAsset = object(packet?.asset);
  const binding = object(packet?.requestBinding);
  const sourceHealth = object(packet?.sourceHealth);
  const claimPolicy = object(packet?.claimPolicy);
  const expectedSymbol = normalizedIdentity(args.asset.symbol);
  const expectedId = args.asset.id ? normalizedIdentity(args.asset.id) : null;
  const packetId = normalizedIdentity(packetAsset?.id ?? packetAsset?.marketId);
  const providers = exactStringArray(packet?.providers, 12, 120);
  const sourceCount = integer(packet?.sourceCount, 1, 1_000);
  const providerCount = integer(packet?.providerCount, 1, 100);
  const observedAt = currentTimestamp(packet?.observedAt, args.now);
  const issuedAt = currentTimestamp(binding?.issuedAt, args.now);
  const schema = text(packet?.schemaVersion, 96);

  if ((schema !== "velmere.vlm.public-evidence.v1" && schema !== "velmere.vlm.public-evidence-packet.v3")
    || packet?.surface !== "shield_pro"
    || packet?.depth !== args.tier
    || normalizedIdentity(packetAsset?.symbol) !== expectedSymbol
    || (expectedId !== null && packetId !== expectedId)
    || binding?.requestId !== args.requestId
    || normalizedIdentity(binding?.query) !== expectedSymbol
    || binding?.depth !== args.tier
    || binding?.surface !== "shield_pro"
    || !observedAt
    || !issuedAt
    || !providers
    || sourceCount === null
    || providerCount === null
    || providerCount !== new Set(providers.map((provider) => provider.toLowerCase())).size
    || sourceCount < providerCount
    || sourceHealth?.evidenceQuorum !== "strong"
    || sourceHealth.integrity !== "trusted"
    || sourceHealth.temporal !== "current"
    || claimPolicy?.noUnsupportedLiquidityClaims !== true
    || claimPolicy.noHolderClaimsWithoutHolderData !== true
    || claimPolicy.noContractClaimsWithoutContractData !== true) {
    return null;
  }

  return {
    observedAt,
    sourceCount,
    providers,
    evidenceIdsByFinding: new Map<string, string[]>(),
  };
}

function findingSeverity(value: unknown): StrictKernelFinding["severity"] | null {
  if (value === "info" || value === "watch" || value === "high" || value === "critical") return value;
  return null;
}

function validateKernel(
  value: unknown,
  args: { tier: ShieldProPaidTier; now: number; packet: StrictPacket },
) {
  const kernel = object(value);
  const findingsValue = kernel?.findings;
  const sourceCount = integer(kernel?.sourceCount, 1, 1_000);
  const generatedAt = currentTimestamp(kernel?.generatedAt, args.now);
  const verdict = text(kernel?.headline, 240);
  const summary = text(kernel?.summary, 2_000);
  if (!kernel
    || kernel.depth !== args.tier
    || (kernel.surface !== "shield" && kernel.surface !== "shield_pro")
    || kernel.status !== "ready"
    || kernel.numericVerdictPublished !== true
    || sourceCount === null
    || sourceCount !== args.packet.sourceCount
    || !generatedAt
    || !verdict
    || !summary
    || !Array.isArray(findingsValue)
    || findingsValue.length < 1
    || findingsValue.length > 20) {
    return null;
  }

  const findings: StrictKernelFinding[] = [];
  const findingIds = new Set<string>();
  for (const value of findingsValue) {
    const finding = object(value);
    const id = text(finding?.id, 96);
    const title = text(finding?.title, 180);
    const body = text(finding?.body, 2_000);
    const severity = findingSeverity(finding?.severity);
    const confidenceCap = finite(finding?.confidence, 0, 100);
    const evidenceIds = exactStringArray(finding?.evidenceIds, 12, 120);
    if (!id || findingIds.has(id) || !title || !body || !severity || confidenceCap === null || !evidenceIds || evidenceIds.length < 1) {
      return null;
    }
    findingIds.add(id);
    args.packet.evidenceIdsByFinding.set(id, evidenceIds);
    findings.push({ id, title, body, severity, evidenceIds });
  }
  return { verdict, summary, generatedAt, findings };
}

function validatePaidPayload(
  value: unknown,
  args: { asset: VlmAnalysisAsset; tier: ShieldProPaidTier; requestId: string; now: number },
): StrictPaidPayload | null {
  const payload = object(value) as ShieldProPayload | null;
  if (!payload || !validateCommercialBoundary(payload, args.tier)) return null;
  const packet = validatePacket(payload.publicEvidencePacket, args);
  if (!packet) return null;

  const result = object(payload.result);
  const token = object(result?.token);
  const expectedSymbol = normalizedIdentity(args.asset.symbol);
  const expectedId = args.asset.id ? normalizedIdentity(args.asset.id) : null;
  const resultId = normalizedIdentity(token?.marketId ?? token?.id);
  const riskScore = finite(result?.score, 0, 100);
  const dataQuality = text(result?.dataQuality, 160);
  const generatedAt = currentTimestamp(result?.generatedAt, args.now);
  const dataSources = exactStringArray(result?.dataSources, 20, 120);
  if (!result
    || result.numericVerdictPublished !== true
    || riskScore === null
    || normalizedIdentity(token?.symbol) !== expectedSymbol
    || (expectedId !== null && resultId !== expectedId)
    || !dataQuality
    || !generatedAt
    || !dataSources
    || dataSources.length < packet.providers.length) {
    return null;
  }

  const kernel = validateKernel(payload.kernel, { tier: args.tier, now: args.now, packet });
  if (!kernel) return null;
  return {
    riskScore,
    verdict: kernel.verdict,
    summary: kernel.summary,
    dataQuality,
    completedAt: generatedAt,
    sourceCount: packet.sourceCount,
    providers: packet.providers,
    findings: kernel.findings,
    packet,
  };
}

function tone(severity: StrictKernelFinding["severity"]): AnalysisSignal["tone"] {
  if (severity === "critical") return "negative";
  if (severity === "high" || severity === "watch") return "warning";
  return "neutral";
}

function toAnalysisResult(payload: StrictPaidPayload, tier: ShieldProPaidTier): AnalysisResult {
  const signals: AnalysisSignal[] = payload.findings.map((finding) => ({
    id: finding.id,
    group: "intelligence",
    name: finding.title,
    value: finding.severity.toUpperCase(),
    interpretation: finding.body,
    description: finding.body,
    reason: "Server kernel finding bound to the exact Shield Pro request and public evidence packet.",
    impact: "Use this bounded risk explanation with its named evidence references; it is not an execution instruction.",
    status: finding.severity,
    tone: tone(finding.severity),
    visual: "scan",
    score: null,
    series: [],
    evidence: finding.evidenceIds.map((evidenceId) => ({
      id: evidenceId,
      source: "Server evidence reference",
      timestamp: payload.packet.observedAt,
      note: `Bound reference ${evidenceId}`,
    })),
    provenanceState: "DERIVED",
    inputFields: finding.evidenceIds,
    derivation: "Server-owned VLM kernel finding; numeric confidence remains withheld without a calibration artifact.",
  }));
  return {
    tier,
    verdict: payload.verdict,
    riskScore: Math.round(payload.riskScore * 100) / 100,
    confidence: null,
    sourceCount: payload.sourceCount,
    dataQuality: payload.dataQuality,
    summary: payload.summary,
    completedAt: payload.completedAt,
    signals,
  };
}

function normalizeRequestId(value: string | undefined) {
  const requestId = value ?? createBrowserSecureId("shield-pro-analysis");
  if (!SAFE_REQUEST_ID.test(requestId)) throw new ShieldProServerAnalysisError("shield_pro_paid_response_invalid", 400);
  return requestId;
}

export async function runShieldProServerAnalysis(
  asset: VlmAnalysisAsset,
  tier: ShieldProPaidTier,
  options: {
    locale: AnalysisLocale;
    signal?: AbortSignal;
    fetchImpl?: ShieldProFetch;
    requestId?: string;
    now?: number;
  },
): Promise<AnalysisResult> {
  const symbol = text(asset.symbol, 32);
  if (!symbol) throw new ShieldProServerAnalysisError("shield_pro_paid_response_invalid", 400);
  const requestId = normalizeRequestId(options.requestId);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(options.signal?.reason ?? new DOMException("Aborted", "AbortError"));
  if (options.signal?.aborted) abortFromCaller();
  else options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timer = globalThis.setTimeout(
    () => controller.abort(new DOMException("Shield Pro analysis timed out", "TimeoutError")),
    SHIELD_PRO_ANALYSIS_TIMEOUT_MS,
  );

  let response: Response;
  try {
    response = await fetchImpl(SHIELD_PRO_ANALYSIS_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        query: symbol,
        locale: options.locale,
        depth: tier,
        surface: "shield_pro",
        prompt: `Evidence-bound Shield Pro ${tier} risk explanation for ${symbol}; no trading instruction.`,
        requestId,
      }),
      signal: controller.signal,
    });
  } catch {
    if (options.signal?.aborted) throw options.signal.reason ?? new DOMException("Aborted", "AbortError");
    throw new ShieldProServerAnalysisError("shield_pro_server_unavailable", 503);
  } finally {
    globalThis.clearTimeout(timer);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }

  if (response.status === 401 || response.status === 402 || response.status === 403) {
    throw new ShieldProServerAnalysisError("shield_pro_entitlement_required", response.status);
  }
  if (!response.ok) throw new ShieldProServerAnalysisError("shield_pro_server_unavailable", response.status || 503);

  let raw: unknown;
  try {
    raw = await readJsonResponseBounded<unknown>(response, SHIELD_PRO_RESPONSE_MAX_BYTES, {
      timeoutMs: SHIELD_PRO_ANALYSIS_TIMEOUT_MS,
      operation: "shield_pro_analysis_response",
      jsonMaxDepth: 48,
      jsonMaxNodes: 100_000,
    });
  } catch {
    throw new ShieldProServerAnalysisError("shield_pro_paid_response_invalid", response.status);
  }
  const validated = validatePaidPayload(raw, {
    asset,
    tier,
    requestId,
    now: options.now ?? Date.now(),
  });
  if (!validated) throw new ShieldProServerAnalysisError("shield_pro_paid_response_invalid", response.status);
  return toAnalysisResult(validated, tier);
}
