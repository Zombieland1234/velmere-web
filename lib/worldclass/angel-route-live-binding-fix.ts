export const PASS2207_ANGEL_ROUTE_LIVE_BINDING_FIX_ID = "angel-route-live-binding-fix" as const;

export type Pass2207AngelRouteLiveBindingFixProof = {
  id: typeof PASS2207_ANGEL_ROUTE_LIVE_BINDING_FIX_ID;
  status: "PASS_STATIC_ONLY" | "PASS_RUNTIME" | "FAIL";
  fixedSurfaces: string[];
  rootCause: string;
  requiredRuntimeChecks: string[];
  safetyBoundaries: string[];
};

export function buildPass2207AngelRouteLiveBindingFixProof(): Pass2207AngelRouteLiveBindingFixProof {
  return {
    id: PASS2207_ANGEL_ROUTE_LIVE_BINDING_FIX_ID,
    status: "PASS_STATIC_ONLY",
    rootCause:
      "Gemini health check was live, but /api/angel could still self-block because trusted server-authored catalog / operating context lived inside the provider prompt and was inspected as untrusted text.",
    fixedSurfaces: [
      "generateTextWithVlmProvider securityInspectionText override",
      "/api/angel passes raw user conversation as untrusted inspection target",
      "/api/angel still sends full sanitized catalog and operating context to Gemini",
      "/api/angel fallback diagnostics now expose a redacted providerError and model-not-found reason",
    ],
    requiredRuntimeChecks: [
      "POST /api/security/angel-gemini-health returns providerMode=gemini_live and ok=true",
      "POST /api/angel with harmless PL message returns providerMode=gemini_live",
      "Angel UI no longer replies with the local-mode fallback after model is gemini-2.5-flash",
      "Malicious user prompt is still blocked by /api/angel before provider call",
      "No GEMINI_API_KEY or raw env values appear in API responses",
    ],
    safetyBoundaries: [
      "Trusted server context can bypass prompt self-inspection only inside provider plumbing; user message/history cannot.",
      "Raw user conversation is inspected at route level and provider level.",
      "Provider output hard-block still rejects secrets, role confusion, encoded payloads and data exfiltration.",
      "Fallback diagnostics stay redacted and must not leak keys or raw environment values.",
    ],
  };
}
