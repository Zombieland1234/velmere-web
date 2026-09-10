export function buildSecurityReadinessSnapshot() {
  return {
    schemaVersion: "velmere-security-readiness-v1",
    mode: "security_headers_api_guard_preview",
    generatedAt: new Date().toISOString(),
    implemented: [
      "Content-Security-Policy",
      "HSTS",
      "frame deny",
      "nosniff",
      "referrer policy",
      "permissions policy",
      "COOP",
      "CORP",
      "origin agent cluster",
      "DNS prefetch off",
      "cross-domain policy none",
      "API JSON no-store helper",
      "API method/query/rate-limit guard",
      "token icon SSRF/content-type/size guard",
    ],
    notImplemented: [
      "full WAF",
      "bot management",
      "durable distributed rate-limit store",
      "penetration test",
      "CSP nonce rollout",
      "production SIEM",
    ],
    boundary:
      "Security hardening reduces common web risk but is not a guarantee. Production still needs secret review, dependency scanning, provider settings and real browser/security testing.",
  };
}
