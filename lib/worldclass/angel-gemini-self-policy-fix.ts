export const PASS2206_ANGEL_GEMINI_SELF_POLICY_FIX_ID = "angel-gemini-self-policy-fix" as const;

export type Pass2206AngelGeminiSelfPolicyFixProof = {
  id: typeof PASS2206_ANGEL_GEMINI_SELF_POLICY_FIX_ID;
  status: "PASS_STATIC_ONLY" | "PASS_RUNTIME" | "FAIL";
  fixedSurfaces: string[];
  requiredRuntimeChecks: string[];
  safetyBoundaries: string[];
};

export function buildPass2206AngelGeminiSelfPolicyFixProof(): Pass2206AngelGeminiSelfPolicyFixProof {
  return {
    id: PASS2206_ANGEL_GEMINI_SELF_POLICY_FIX_ID,
    status: "PASS_STATIC_ONLY",
    fixedSurfaces: [
      "/api/angel text provider path",
      "trusted server-authored systemInstruction",
      "untrusted user prompt inspection",
      "/api/security/angel-gemini-health safe diagnostics",
    ],
    requiredRuntimeChecks: [
      "Next.js shows Environments: .env.local",
      "GET /api/security/angel-gemini-health returns configured=true without exposing key",
      "POST /api/security/angel-gemini-health returns providerMode=gemini_live or a concrete provider error",
      "POST /api/angel no longer falls back with fallbackReason=security_policy for a harmless message",
      "Angel UI replies with Gemini latency/model diagnostics when Gemini works",
    ],
    safetyBoundaries: [
      "Do not expose GEMINI_API_KEY or full environment values.",
      "Only server-authored systemInstruction is trusted; user prompt remains blocked by inspectVlmText.",
      "Provider output hard-block still rejects secret material, role confusion, encoded payload and data-exfiltration content.",
      "Health endpoint returns redacted diagnostics only.",
    ],
  };
}
