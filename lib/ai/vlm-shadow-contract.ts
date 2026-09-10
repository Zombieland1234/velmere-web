import { z } from "zod";

export const vlmShadowIssueCodeSchema = z.enum([
  "unsupported_claim",
  "source_mismatch",
  "confidence_too_high",
  "causal_overreach",
  "missing_counterargument",
  "unsafe_decision_copy",
  "contradiction_ignored",
  "material_omission",
]);

export const vlmShadowReviewSchema = z.object({
  schemaVersion: z.literal("velmere.vlm.shadow.v1"),
  verdict: z.enum(["approve", "revise", "reject"]),
  confidenceCap: z.number().min(0).max(100),
  riskScore: z.number().min(0).max(100),
  issues: z.array(z.object({
    code: vlmShadowIssueCodeSchema,
    findingId: z.string().min(1).max(100).optional(),
    sourceIds: z.array(z.string().min(1).max(180)).max(8),
  }).strict()).max(12),
  missingChallenges: z.array(z.enum([
    "strongest_counterevidence",
    "benign_alternative",
    "adverse_alternative",
    "reversal_condition",
    "highest_value_missing_evidence",
  ])).max(5),
}).strict();

export type VlmShadowReview = z.infer<typeof vlmShadowReviewSchema>;

export const VLM_SHADOW_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", enum: ["velmere.vlm.shadow.v1"] },
    verdict: { type: "string", enum: ["approve", "revise", "reject"] },
    confidenceCap: { type: "number", minimum: 0, maximum: 100 },
    riskScore: { type: "number", minimum: 0, maximum: 100 },
    issues: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: {
            type: "string",
            enum: [
              "unsupported_claim",
              "source_mismatch",
              "confidence_too_high",
              "causal_overreach",
              "missing_counterargument",
              "unsafe_decision_copy",
              "contradiction_ignored",
              "material_omission",
            ],
          },
          findingId: { type: "string" },
          sourceIds: { type: "array", maxItems: 8, items: { type: "string" } },
        },
        required: ["code", "sourceIds"],
      },
    },
    missingChallenges: {
      type: "array",
      maxItems: 5,
      items: {
        type: "string",
        enum: [
          "strongest_counterevidence",
          "benign_alternative",
          "adverse_alternative",
          "reversal_condition",
          "highest_value_missing_evidence",
        ],
      },
    },
  },
  required: ["schemaVersion", "verdict", "confidenceCap", "riskScore", "issues", "missingChallenges"],
} as const;
