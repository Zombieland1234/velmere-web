export const PUBLIC_SECURITY_STATUS_SCHEMA =
  "velmere.public-security-status.v1" as const;

/**
 * Public security routes deliberately expose only coarse, non-operational
 * truth. Provider modes, limiter state, recent events, fingerprints, payment
 * identifiers, rule weights and operator data belong to authenticated control
 * plane routes.
 */
export function buildPublicSecurityStatus() {
  return {
    schemaVersion: PUBLIC_SECURITY_STATUS_SCHEMA,
    releaseState: "pre_release_no_go" as const,
    live: false,
    saleEnabled: false,
    productionApproved: false,
    assurance: "not_independently_assured" as const,
    evidence: {
      local: "partial" as const,
      exactRuntime: "requires_final_frozen_build" as const,
      browser: "requires_final_frozen_build" as const,
      staging: "blocked_external" as const,
      providerRights: "blocked_external" as const,
      legal: "blocked_external" as const,
      customerValue: "blocked_external" as const,
    },
    limitations: [
      "No LIVE, sale, production approval or independent-assurance claim is active.",
      "Operational telemetry and evidence are available only through authenticated control-plane routes.",
      "External staging, provider-rights, legal and customer evidence remain separate release gates.",
    ],
  };
}
