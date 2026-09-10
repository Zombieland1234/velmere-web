import { z } from "zod";

export const vlmLocaleSchema = z.enum(["pl", "en", "de"]);
export const vlmDepthSchema = z.enum(["basic", "pro", "advanced"]);
export const vlmSurfaceSchema = z.enum(["shield", "shield_pro", "real_markets", "shield_map", "lens", "angel", "admin"]);
export const vlmProviderModeSchema = z.enum(["gemini_live", "deterministic_fallback"]);
export const vlmVerdictSchema = z.enum(["calm", "observe", "review", "high_risk"]);
export const vlmFreshnessSchema = z.enum(["fresh", "aging", "stale", "unknown"]);

export const vlmSourceSchema = z.object({
  id: z.string().min(1).max(180),
  provider: z.string().min(1).max(100),
  label: z.string().min(1).max(180),
  observedAt: z.string().datetime().nullable(),
  url: z.string().url().max(700).optional(),
  quality: z.number().min(0).max(100),
  providerFamily: z.string().min(1).max(120).optional(),
  receiptId: z.string().min(1).max(180).optional(),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  capabilities: z.array(z.string().min(1).max(100)).max(32).optional(),
});

export const vlmFactEvidenceBindingSchema = z.object({
  sourceId: z.string().min(1).max(180),
  receiptId: z.string().min(1).max(180),
  providerFamily: z.string().min(1).max(120),
  fieldPath: z.string().min(1).max(180),
  capability: z.string().min(1).max(100),
  valueHash: z.string().regex(/^[a-f0-9]{64}$/i),
  observedAt: z.string().datetime(),
});

export const vlmFactSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(180),
  value: z.union([z.string().max(500), z.number().finite(), z.null()]),
  sourceIds: z.array(z.string().min(1).max(180)).max(8),
  observedAt: z.string().datetime().nullable(),
  freshness: vlmFreshnessSchema,
  evidenceBindings: z.array(vlmFactEvidenceBindingSchema).max(8).optional(),
  providerFamilyCount: z.number().int().min(0).max(8).optional(),
  quorumState: z.enum(["confirmed", "single_source", "internal_only", "missing", "stale", "conflicted"]).optional(),
});

export const vlmFindingSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(160),
  explanation: z.string().min(1).max(900),
  severity: z.enum(["info", "watch", "warning", "critical"]),
  confidence: z.number().min(0).max(100),
  sourceIds: z.array(z.string().min(1).max(180)).max(8),
  factIds: z.array(z.string().min(1).max(100)).max(12).optional(),
});

export const vlmContradictionSchema = z.object({
  description: z.string().min(1).max(500),
  sourceIds: z.array(z.string().min(1).max(180)).min(1).max(8),
});

export const vlmReportSchema = z.object({
  executiveSummary: z.string().min(1).max(2200),
  marketStructure: z.string().min(1).max(2200),
  liquidityAnalysis: z.string().min(1).max(2200),
  holderAnalysis: z.string().min(1).max(2200),
  contractAnalysis: z.string().min(1).max(2200),
  sourceAssessment: z.string().min(1).max(2200),
  riskScenarios: z.string().min(1).max(2200),
  conclusion: z.string().min(1).max(2200),
});

export const vlmDiagnosticsSchema = z.object({
  model: z.string().max(120).optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  attempts: z.number().int().nonnegative().optional(),
  fallbackReason: z.string().max(500).optional(),
  cached: z.boolean().optional(),
  schemaValid: z.boolean().optional(),
  sourceCount: z.number().int().nonnegative().optional(),
  contradictionCount: z.number().int().nonnegative().optional(),
  missingDataCount: z.number().int().nonnegative().optional(),
  promptTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
  estimatedCostUsd: z.number().nonnegative().optional(),
  toolCalls: z.number().int().min(0).max(3).optional(),
  evidenceQuorumStatus: z.enum(["strong", "mixed", "weak"]).optional(),
  evidenceQuorumRatio: z.number().min(0).max(1).optional(),
  weakFactIds: z.array(z.string().min(1).max(100)).max(16).optional(),
  sourceIntegrityStatus: z.enum(["trusted", "degraded", "quarantined"]).optional(),
  sourceIntegrityScore: z.number().min(0).max(100).optional(),
  sourceIntegrityPenalty: z.number().min(0).max(60).optional(),
  quarantinedSourceIds: z.array(z.string().min(1).max(180)).max(16).optional(),
  temporalConsistencyStatus: z.enum(["current", "aging", "stale", "invalid"]).optional(),
  temporalConsistencyScore: z.number().min(0).max(100).optional(),
  temporalConsistencyPenalty: z.number().min(0).max(70).optional(),
  staleTemporalFactIds: z.array(z.string().min(1).max(100)).max(16).optional(),
  narrativeDriftStatus: z.enum(["stable", "watch", "drift", "locked"]).optional(),
  narrativeDriftScore: z.number().min(0).max(100).optional(),
  narrativeDriftPenalty: z.number().min(0).max(45).optional(),
  narrativeDriftReasons: z.array(z.string().min(1).max(120)).max(10).optional(),
  decisionReversibilityTier: z.enum(["high", "medium", "low", "unknown"]).optional(),
  decisionReversibilityScore: z.number().min(0).max(100).optional(),
  decisionReversibilityPenalty: z.number().min(0).max(20).optional(),
  verdictGovernorStatus: z.enum(["publishable", "conditional", "operator_review", "blocked"]).optional(),
  verdictAssetFamily: z.enum(["erc20_contract", "native_crypto", "equity", "fund_etf", "index", "fx_pair", "commodity", "real_estate", "exchange_equity", "unknown"]).optional(),
  missingProofLanes: z.array(z.string().min(1).max(120)).max(16).optional(),
  riskConfidenceDelta: z.number().min(0).max(100).optional(),
});

export const vlmBrainOutputSchema = z.object({
  schemaVersion: z.literal("velmere.vlm.output.v3"),
  traceId: z.string().uuid(),
  generatedAt: z.string().datetime(),
  locale: vlmLocaleSchema,
  depth: vlmDepthSchema,
  providerMode: vlmProviderModeSchema,
  asset: z.object({
    id: z.string().min(1).max(180),
    symbol: z.string().min(1).max(30),
    name: z.string().min(1).max(140),
    assetClass: z.string().min(1).max(80),
  }),
  verdict: vlmVerdictSchema,
  headline: z.string().min(1).max(200),
  summary: z.string().min(1).max(2200),
  confidence: z.number().min(0).max(100),
  facts: z.array(vlmFactSchema).max(36),
  keyFindings: z.array(vlmFindingSchema).min(1).max(24),
  contradictions: z.array(vlmContradictionSchema).max(12),
  missingData: z.array(z.string().min(1).max(260)).max(24),
  nextChecks: z.array(z.string().min(1).max(320)).min(1).max(14),
  sources: z.array(vlmSourceSchema).max(24),
  report: vlmReportSchema,
  diagnostics: vlmDiagnosticsSchema.optional(),
});

export type VlmLocale = z.infer<typeof vlmLocaleSchema>;
export type VlmDepth = z.infer<typeof vlmDepthSchema>;
export type VlmSurface = z.infer<typeof vlmSurfaceSchema>;
export type VlmProviderMode = z.infer<typeof vlmProviderModeSchema>;
export type VlmFreshness = z.infer<typeof vlmFreshnessSchema>;
export type VlmBrainOutput = z.infer<typeof vlmBrainOutputSchema>;
export type VlmFact = z.infer<typeof vlmFactSchema>;
export type VlmSource = z.infer<typeof vlmSourceSchema>;

export const VLM_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", enum: ["velmere.vlm.output.v3"] },
    traceId: { type: "string" },
    generatedAt: { type: "string" },
    locale: { type: "string", enum: ["pl", "en", "de"] },
    depth: { type: "string", enum: ["basic", "pro", "advanced"] },
    providerMode: { type: "string", enum: ["gemini_live"] },
    asset: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string" }, symbol: { type: "string" }, name: { type: "string" }, assetClass: { type: "string" },
      },
      required: ["id", "symbol", "name", "assetClass"],
    },
    verdict: { type: "string", enum: ["calm", "observe", "review", "high_risk"] },
    headline: { type: "string" },
    summary: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 100 },
    facts: {
      type: "array", maxItems: 36,
      items: {
        type: "object", additionalProperties: false,
        properties: {
          id: { type: "string" }, label: { type: "string" }, value: { anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }] },
          sourceIds: { type: "array", maxItems: 8, items: { type: "string" } }, observedAt: { anyOf: [{ type: "string" }, { type: "null" }] },
          freshness: { type: "string", enum: ["fresh", "aging", "stale", "unknown"] },
          evidenceBindings: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, properties: { sourceId: { type: "string" }, receiptId: { type: "string" }, providerFamily: { type: "string" }, fieldPath: { type: "string" }, capability: { type: "string" }, valueHash: { type: "string" }, observedAt: { type: "string" } }, required: ["sourceId", "receiptId", "providerFamily", "fieldPath", "capability", "valueHash", "observedAt"] } },
          providerFamilyCount: { type: "number", minimum: 0, maximum: 8 },
          quorumState: { type: "string", enum: ["confirmed", "single_source", "internal_only", "missing", "stale", "conflicted"] },
        },
        required: ["id", "label", "value", "sourceIds", "observedAt", "freshness"],
      },
    },
    keyFindings: {
      type: "array", minItems: 1, maxItems: 24,
      items: {
        type: "object", additionalProperties: false,
        properties: {
          id: { type: "string" }, title: { type: "string" }, explanation: { type: "string" },
          severity: { type: "string", enum: ["info", "watch", "warning", "critical"] }, confidence: { type: "number", minimum: 0, maximum: 100 },
          sourceIds: { type: "array", maxItems: 8, items: { type: "string" } },
          factIds: { type: "array", maxItems: 12, items: { type: "string" } },
        },
        required: ["id", "title", "explanation", "severity", "confidence", "sourceIds"],
      },
    },
    contradictions: {
      type: "array", maxItems: 12,
      items: { type: "object", additionalProperties: false, properties: { description: { type: "string" }, sourceIds: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } } }, required: ["description", "sourceIds"] },
    },
    missingData: { type: "array", maxItems: 24, items: { type: "string" } },
    nextChecks: { type: "array", minItems: 1, maxItems: 14, items: { type: "string" } },
    sources: {
      type: "array", maxItems: 24,
      items: {
        type: "object", additionalProperties: false,
        properties: {
          id: { type: "string" }, provider: { type: "string" }, label: { type: "string" }, observedAt: { anyOf: [{ type: "string" }, { type: "null" }] }, url: { type: "string" }, quality: { type: "number", minimum: 0, maximum: 100 }, providerFamily: { type: "string" }, receiptId: { type: "string" }, payloadHash: { type: "string" }, capabilities: { type: "array", maxItems: 32, items: { type: "string" } },
        },
        required: ["id", "provider", "label", "observedAt", "quality"],
      },
    },
    report: {
      type: "object", additionalProperties: false,
      properties: {
        executiveSummary: { type: "string" }, marketStructure: { type: "string" }, liquidityAnalysis: { type: "string" }, holderAnalysis: { type: "string" }, contractAnalysis: { type: "string" }, sourceAssessment: { type: "string" }, riskScenarios: { type: "string" }, conclusion: { type: "string" },
      },
      required: ["executiveSummary", "marketStructure", "liquidityAnalysis", "holderAnalysis", "contractAnalysis", "sourceAssessment", "riskScenarios", "conclusion"],
    },
    diagnostics: {
      type: "object", additionalProperties: false,
      properties: {
        model: { type: "string" }, latencyMs: { type: "number" }, attempts: { type: "number" }, fallbackReason: { type: "string" }, cached: { type: "boolean" }, schemaValid: { type: "boolean" }, sourceCount: { type: "number" }, contradictionCount: { type: "number" }, missingDataCount: { type: "number" }, promptTokens: { type: "number" }, outputTokens: { type: "number" }, totalTokens: { type: "number" }, estimatedCostUsd: { type: "number" }, toolCalls: { type: "number" }, evidenceQuorumStatus: { type: "string", enum: ["strong", "mixed", "weak"] }, evidenceQuorumRatio: { type: "number", minimum: 0, maximum: 1 }, weakFactIds: { type: "array", maxItems: 16, items: { type: "string" } }, sourceIntegrityStatus: { type: "string", enum: ["trusted", "degraded", "quarantined"] }, sourceIntegrityScore: { type: "number", minimum: 0, maximum: 100 }, sourceIntegrityPenalty: { type: "number", minimum: 0, maximum: 60 }, quarantinedSourceIds: { type: "array", maxItems: 16, items: { type: "string" } }, temporalConsistencyStatus: { type: "string", enum: ["current", "aging", "stale", "invalid"] }, temporalConsistencyScore: { type: "number", minimum: 0, maximum: 100 }, temporalConsistencyPenalty: { type: "number", minimum: 0, maximum: 70 }, staleTemporalFactIds: { type: "array", maxItems: 16, items: { type: "string" } }, narrativeDriftStatus: { type: "string", enum: ["stable", "watch", "drift", "locked"] }, narrativeDriftScore: { type: "number", minimum: 0, maximum: 100 }, narrativeDriftPenalty: { type: "number", minimum: 0, maximum: 45 }, narrativeDriftReasons: { type: "array", maxItems: 10, items: { type: "string" } }, decisionReversibilityTier: { type: "string", enum: ["high", "medium", "low", "unknown"] }, decisionReversibilityScore: { type: "number", minimum: 0, maximum: 100 }, decisionReversibilityPenalty: { type: "number", minimum: 0, maximum: 20 },
      },
    },
  },
  required: ["schemaVersion", "traceId", "generatedAt", "locale", "depth", "providerMode", "asset", "verdict", "headline", "summary", "confidence", "facts", "keyFindings", "contradictions", "missingData", "nextChecks", "sources", "report"],
} as const;
