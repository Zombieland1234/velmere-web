import {
  applyDurableRateLimit,
  type DurableRateLimitDecision,
  type DurableRateLimitOptions,
} from "@/lib/security/durable-rate-limit";

export const SEC_EDGAR_REFERENCE_POLICY_ID = "sec-edgar-official-reference-policy-v1" as const;
export const SEC_EDGAR_API_DOCUMENTATION_URL = "https://www.sec.gov/search-filings/edgar-application-programming-interfaces" as const;
export const SEC_EDGAR_REUSE_FAQ_URL = "https://www.sec.gov/about/webmaster-frequently-asked-questions" as const;
export const SEC_EDGAR_PRIVACY_AND_SECURITY_URL = "https://www.sec.gov/about/privacy-information" as const;
export const SEC_EDGAR_POLICY_REVIEWED_AT = "2026-08-21T15:00:00.000Z" as const;
export const SEC_EDGAR_POLICY_VALID_UNTIL = "2026-08-28T23:59:59.999Z" as const;
export const SEC_EDGAR_REQUIRED_ATTRIBUTION = "Source: U.S. Securities and Exchange Commission (SEC) EDGAR." as const;

export const SEC_EDGAR_FAIR_ACCESS_POLICY = Object.freeze({
  officialMaximumRequestsPerSecond: 10,
  requests: 8,
  windowMs: 1_000,
  scope: "data.sec.gov across all SEC EDGAR request kinds",
  productionStateRequired: "durable_distributed_rate_limit",
} as const);

export const SEC_EDGAR_CACHE_POLICY = Object.freeze({
  positiveTtlMs: 21_600_000,
  negativeTtlMs: 300_000,
  positiveTtlSeconds: 21_600,
  negativeTtlSeconds: 300,
  staleWhileRevalidateAllowed: false,
} as const);

export const SEC_EDGAR_CUSTOMER_BOUNDARY = Object.freeze({
  schemaVersion: "velmere.sec-edgar.official-reference-boundary.v1",
  providerId: "sec_edgar",
  sourceClass: "official_public_regulator_reference",
  attribution: SEC_EDGAR_REQUIRED_ATTRIBUTION,
  referenceOnly: true,
  liveClaimed: false,
  executableQuote: false,
  marketPriceFieldEligible: false,
  thirdPartyContentExcluded: true,
  thirdPartyExclusionExamples: ["CUSIP identifiers", "third-party marks, seals and logos"],
  noAffiliationOrEndorsementClaim: true,
  permittedTechnicalFields: [
    "issuer identity",
    "filing form",
    "filing date",
    "report date",
    "accession lineage",
    "public XBRL company facts",
  ],
  forbiddenSubstitutions: [
    "real-time quote",
    "executable price",
    "exchange order book",
    "ETF holdings composition",
  ],
  legalAdviceProvided: false,
  rightsCertificationClaimed: false,
  productionEgressAuthorized: false,
  customerDisplayAuthorized: false,
  customerFinalCredit: false,
  truthBoundary:
    "SEC EDGAR data in this lane is dated official reference and filing evidence only. Third-party content is excluded. This engineering boundary is not legal advice, a rights certificate, a live or executable market-data claim, or Customer FINAL credit.",
} as const);

export type SecEdgarReferenceKind = "submissions" | "companyfacts";

export type SecEdgarUserAgentInspection =
  | {
      ok: true;
      state: "identified_operator";
      productIdentity: string;
      operatorIdentity: string;
      contactSyntaxPresent: true;
    }
  | {
      ok: false;
      state: "blocked";
      reason:
        | "sec_user_agent_missing"
        | "sec_user_agent_control_character"
        | "sec_user_agent_secret_material_forbidden"
        | "sec_user_agent_format_invalid"
        | "sec_user_agent_operator_identity_invalid";
    };

const SEC_USER_AGENT_PATTERN = /^(Velmere\/\d+\.\d+(?:\.\d+)?) \(([^;()]{2,80}); contact=([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)\)$/u;
const SECRET_MATERIAL_PATTERN = /(?:api[ _-]?key|authorization|bearer|password|secret|token)\s*[:=]/iu;
const PLACEHOLDER_OPERATOR_PATTERN = /^(?:example|n\/a|operator|owner|test|tbd|todo|unknown)$/iu;

/**
 * SEC fair-access guidance requires an identified requester. Velmere never
 * invents a default contact: the complete value must be owner-controlled
 * configuration, contain no secret material and match this narrow grammar:
 * `Velmere/<version> (<operator identity>; contact=<email syntax>)`.
 */
export function inspectSecEdgarOperatorUserAgent(value?: string | null): SecEdgarUserAgentInspection {
  const candidate = String(value ?? "").trim();
  if (!candidate) return { ok: false, state: "blocked", reason: "sec_user_agent_missing" };
  if (Array.from(candidate).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  })) {
    return { ok: false, state: "blocked", reason: "sec_user_agent_control_character" };
  }
  if (SECRET_MATERIAL_PATTERN.test(candidate)) {
    return { ok: false, state: "blocked", reason: "sec_user_agent_secret_material_forbidden" };
  }
  if (candidate.length > 180) return { ok: false, state: "blocked", reason: "sec_user_agent_format_invalid" };
  const match = SEC_USER_AGENT_PATTERN.exec(candidate);
  if (!match) return { ok: false, state: "blocked", reason: "sec_user_agent_format_invalid" };
  const operatorIdentity = match[2].trim();
  if (!/[A-Za-z]/u.test(operatorIdentity) || PLACEHOLDER_OPERATOR_PATTERN.test(operatorIdentity)) {
    return { ok: false, state: "blocked", reason: "sec_user_agent_operator_identity_invalid" };
  }
  return {
    ok: true,
    state: "identified_operator",
    productIdentity: match[1],
    operatorIdentity,
    contactSyntaxPresent: true,
  };
}

function normalizeSecEdgarCik(value: string) {
  const candidate = String(value ?? "").trim();
  if (!/^\d{1,10}$/u.test(candidate) || /^0+$/u.test(candidate)) return null;
  return candidate.padStart(10, "0");
}

export type SecEdgarReferenceRequest =
  | {
      ok: false;
      reason:
        | "sec_cik_invalid"
        | "sec_user_agent_missing"
        | "sec_user_agent_control_character"
        | "sec_user_agent_secret_material_forbidden"
        | "sec_user_agent_format_invalid"
        | "sec_user_agent_operator_identity_invalid"
        | "sec_policy_review_expired";
    }
  | {
      ok: true;
      kind: SecEdgarReferenceKind;
      cik: string;
      url: string;
      headers: { accept: "application/json"; "user-agent": string };
      timeoutMs: 8_000;
      maxResponseBytes: 4_194_304;
      cacheTtlMs: typeof SEC_EDGAR_CACHE_POLICY.positiveTtlMs;
      negativeCacheTtlMs: typeof SEC_EDGAR_CACHE_POLICY.negativeTtlMs;
      policyReviewedAt: typeof SEC_EDGAR_POLICY_REVIEWED_AT;
      policyValidUntil: typeof SEC_EDGAR_POLICY_VALID_UNTIL;
      referencePolicy: typeof SEC_EDGAR_CUSTOMER_BOUNDARY;
    };

export function buildSecEdgarReferenceRequest(args: {
  kind: SecEdgarReferenceKind;
  cik: string;
  userAgent?: string | null;
  now?: Date;
}): SecEdgarReferenceRequest {
  const cik = normalizeSecEdgarCik(args.cik);
  if (!cik) return { ok: false, reason: "sec_cik_invalid" };
  const userAgent = inspectSecEdgarOperatorUserAgent(args.userAgent);
  if (!userAgent.ok) return { ok: false, reason: userAgent.reason };
  const nowMs = (args.now ?? new Date()).getTime();
  const policyExpiryMs = Date.parse(SEC_EDGAR_POLICY_VALID_UNTIL);
  if (!Number.isFinite(nowMs) || nowMs > policyExpiryMs) {
    return { ok: false, reason: "sec_policy_review_expired" };
  }
  return {
    ok: true,
    kind: args.kind,
    cik,
    url: args.kind === "submissions"
      ? `https://data.sec.gov/submissions/CIK${cik}.json`
      : `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
    headers: { accept: "application/json", "user-agent": String(args.userAgent).trim() },
    timeoutMs: 8_000,
    maxResponseBytes: 4_194_304,
    cacheTtlMs: SEC_EDGAR_CACHE_POLICY.positiveTtlMs,
    negativeCacheTtlMs: SEC_EDGAR_CACHE_POLICY.negativeTtlMs,
    policyReviewedAt: SEC_EDGAR_POLICY_REVIEWED_AT,
    policyValidUntil: SEC_EDGAR_POLICY_VALID_UNTIL,
    referencePolicy: SEC_EDGAR_CUSTOMER_BOUNDARY,
  };
}

export class SecEdgarFairAccessError extends Error {
  readonly decision: DurableRateLimitDecision;

  constructor(decision: DurableRateLimitDecision) {
    const storeUnavailable = decision.mode === "unavailable"
      || decision.mode === "disabled"
      || decision.degraded
      || decision.reason === "rate_limit_store_unavailable";
    super(storeUnavailable ? "sec_edgar_rate_limit_store_unavailable" : "sec_edgar_rate_limit_exceeded");
    this.name = "SecEdgarFairAccessError";
    this.decision = decision;
  }
}

export const secEdgarReferencePolicyDependencies: {
  reserveRateLimit: (options: DurableRateLimitOptions) => Promise<DurableRateLimitDecision>;
} = {
  reserveRateLimit: applyDurableRateLimit,
};

/** Reserves one globally shared SEC request unit before any provider socket. */
export async function reserveSecEdgarFairAccess() {
  const decision = await secEdgarReferencePolicyDependencies.reserveRateLimit({
    namespace: "sec-edgar:fair-access",
    key: "data.sec.gov",
    limit: SEC_EDGAR_FAIR_ACCESS_POLICY.requests,
    windowMs: SEC_EDGAR_FAIR_ACCESS_POLICY.windowMs,
    cost: 1,
  });
  if (!decision.ok || decision.mode === "disabled" || decision.degraded) {
    throw new SecEdgarFairAccessError(decision);
  }
  return decision;
}
