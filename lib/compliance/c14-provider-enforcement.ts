import pass21Registry from "../../config/pass21/provider-commercial-rights-registry.json";
import pass36Matrix from "../../config/pass36/a102r44p18-official-provider-rights-decision-matrix.json";
import p65Policy from "../../config/p65/P65_CURRENT_FREE_LEGAL_SOURCE_POLICY.json";
import p90Registry from "../../config/p90/audit-provider-field-rights-currentness-registry.json";
import ecbReview from "../../artifacts/r7/providers/R7_ECB_USAGE_POLICY_REVIEW_20260824.json";

export const C14_PROVIDER_ENFORCEMENT_VERSION =
  "velmere.c14-p22.provider-enforcement.v1" as const;

export const C14_RUNTIME_PROVIDER_IDS = Object.freeze([
  "coingecko",
  "dexscreener",
  "geckoterminal",
  "defillama",
  "binance",
  "bybit",
  "mexc",
  "kraken",
  "coinbase",
  "goplus",
  "honeypot_is",
  "etherscan_family",
  "alchemy",
  "quicknode",
  "sec_edgar",
  "stooq",
  "yahoo_finance",
  "alpha_vantage",
  "finnhub",
  "twelve_data",
  "fred",
  "ecb",
  "eia",
  "cftc",
  "github_source",
] as const);

export type C14ProviderOperation =
  | "fetch"
  | "storage"
  | "cache"
  | "display"
  | "export"
  | "redistribution"
  | "derivative_data"
  | "pdf_export"
  | "llm_inference";

export type C14ProviderChannel = "internal_diagnostic" | "customer";
export type C14ProviderDataClass = "raw" | "derived" | "mixed";
export type C14ProviderState = "CONFIRMED" | "BLOCKED" | "UNVERIFIED" | "EXPIRED";

export type C14ProviderOperationRequest = {
  providerId: string;
  operation: C14ProviderOperation;
  channel: C14ProviderChannel;
  nowMs?: number;
  cacheTtlSeconds?: number;
  dataClass?: C14ProviderDataClass;
  attributionPresent?: boolean;
};

export type C14ProviderOperationDecision = {
  schemaVersion: typeof C14_PROVIDER_ENFORCEMENT_VERSION;
  providerId: string;
  canonicalProviderId: string;
  operation: C14ProviderOperation;
  channel: C14ProviderChannel;
  allowed: boolean;
  state: C14ProviderState;
  code: string;
  blockers: string[];
  evidencePaths: string[];
  attributionRequired: boolean | null;
  requiredAttribution: string | null;
  cacheTtlSecondsRequested: number | null;
  cacheTtlSecondsMaximum: number | null;
  currentPlanOrTier: string | null;
  requiredPlanOrConsent: string | null;
  expiresAt: string | null;
  reverifyBy: string | null;
};

export type C14ProviderMatrixRow = {
  providerId: string;
  canonicalProviderId: string;
  evidencePaths: string[];
  technicalState: string | null;
  fetch: C14ProviderState;
  storage: C14ProviderState;
  cache: C14ProviderState;
  ttlSecondsMaximum: number | null;
  export: C14ProviderState;
  redistribution: C14ProviderState;
  attribution: "REQUIRED" | "NOT_REQUIRED" | "UNVERIFIED";
  derivativeData: C14ProviderState;
  expiration: "CURRENT" | "EXPIRED" | "UNSPECIFIED";
  expiresAt: string | null;
  reverifyBy: string | null;
  revocation: "RE_EVALUATE_EACH_OPERATION" | "UNVERIFIED";
  planTierRestriction: string | null;
  requiredPlanOrConsent: string | null;
  customerDisplayAllowed: boolean;
  commercialUseAllowed: boolean;
  rawRedistributionAllowed: boolean;
  derivedUseAllowed: boolean;
  retentionAllowed: boolean;
  rawCacheAllowed: boolean;
  pdfExportAllowed: boolean;
  aiRagAllowed: boolean;
  internalDiagnosticAllowed: boolean;
  requiredAttribution: string | null;
  blockers: string[];
};

const PASS21_PATH = "config/pass21/provider-commercial-rights-registry.json";
const PASS36_PATH = "config/pass36/a102r44p18-official-provider-rights-decision-matrix.json";
const P65_PATH = "config/p65/P65_CURRENT_FREE_LEGAL_SOURCE_POLICY.json";
const P90_PATH = "config/p90/audit-provider-field-rights-currentness-registry.json";
const ECB_PATH = "artifacts/r7/providers/R7_ECB_USAGE_POLICY_REVIEW_20260824.json";

type LooseRecord = Record<string, unknown>;

function record(value: unknown): LooseRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function records(value: unknown): LooseRecord[] {
  return Array.isArray(value) ? value.map(record).filter((item): item is LooseRecord => item !== null) : [];
}

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function objectAt(value: unknown, key: string): LooseRecord | null {
  return record(record(value)?.[key]);
}

function textAt(value: unknown, key: string): string | null {
  return clean(record(value)?.[key]);
}

function boolAt(value: unknown, key: string): boolean | null {
  return bool(record(value)?.[key]);
}

const ALIASES: Readonly<Record<string, string>> = Object.freeze({
  ecb: "ecb_statistics",
  etherscan: "etherscan-v2",
  etherscan_family: "etherscan-v2",
  dexscreener: "dexscreener-api",
  goplus: "goplus-token-security",
  honeypot_is: "honeypot-is",
});

export function canonicalC14ProviderId(providerId: string) {
  const normalized = providerId.trim().toLowerCase();
  return ALIASES[normalized] ?? normalized;
}

function sourceById(path: string, canonicalProviderId: string): LooseRecord | null {
  if (path === PASS21_PATH) {
    return records(record(pass21Registry)?.providers).find((row) => textAt(row, "id") === canonicalProviderId) ?? null;
  }
  if (path === PASS36_PATH) {
    return records(record(pass36Matrix)?.providers).find((row) => textAt(row, "providerId") === canonicalProviderId) ?? null;
  }
  if (path === P65_PATH) {
    return records(record(p65Policy)?.sources).find((row) => textAt(row, "id") === canonicalProviderId) ?? null;
  }
  if (path === P90_PATH) {
    return records(record(p90Registry)?.providers).find((row) => textAt(row, "providerId") === canonicalProviderId) ?? null;
  }
  return null;
}

function evidencePathsFor(canonicalProviderId: string) {
  const paths: string[] = [];
  for (const path of [PASS21_PATH, PASS36_PATH, P65_PATH, P90_PATH]) {
    if (sourceById(path, canonicalProviderId)) paths.push(path);
  }
  if (canonicalProviderId === "ecb_statistics") paths.push(ECB_PATH);
  return paths;
}

function allProviderIds() {
  const ids = new Set<string>(C14_RUNTIME_PROVIDER_IDS.map(String));
  for (const row of records(record(pass21Registry)?.providers)) {
    const id = textAt(row, "id");
    if (id) ids.add(id);
  }
  for (const row of records(record(pass36Matrix)?.providers)) {
    const id = textAt(row, "providerId");
    if (id) ids.add(id);
  }
  for (const row of records(record(p65Policy)?.sources)) {
    const id = textAt(row, "id");
    if (id) ids.add(id);
  }
  for (const row of records(record(p90Registry)?.providers)) {
    const id = textAt(row, "providerId");
    if (id) ids.add(id);
  }
  return [...ids].sort();
}

function explicitInternalDiagnostic(canonicalProviderId: string) {
  const p90 = sourceById(P90_PATH, canonicalProviderId);
  if (boolAt(objectAt(p90, "rights"), "internalDiagnosticAllowed") === true) return true;
  const p36 = sourceById(PASS36_PATH, canonicalProviderId);
  if (boolAt(p36, "internalDiagnosticAllowed") === true) return true;
  const p65 = sourceById(P65_PATH, canonicalProviderId);
  const credit = textAt(p65, "creditLimit") ?? "";
  if (/INTERNAL_(?:DIAGNOSTIC|EVALUATION)_ONLY/u.test(credit)) return true;
  if (textAt(p65, "engineeringRightsState") === "PASS_BOUNDED_PRIMARY_SOURCE_TERMS") return true;
  return false;
}

function currentDeadline(canonicalProviderId: string) {
  if (canonicalProviderId === "ecb_statistics") {
    return { expiresAt: clean(record(ecbReview)?.validUntil), reverifyBy: null };
  }
  if (sourceById(P90_PATH, canonicalProviderId)) {
    return { expiresAt: null, reverifyBy: clean(record(p90Registry)?.reverifyBy) };
  }
  return { expiresAt: null, reverifyBy: null };
}

function expiredAt(canonicalProviderId: string, nowMs: number) {
  const deadline = currentDeadline(canonicalProviderId);
  const values = [deadline.expiresAt, deadline.reverifyBy].filter((value): value is string => Boolean(value));
  return values.some((value) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && nowMs >= parsed;
  });
}

function explicitAttribution(canonicalProviderId: string): { required: boolean | null; text: string | null } {
  if (canonicalProviderId === "ecb_statistics") {
    const approved = objectAt(ecbReview, "approvedUse");
    return {
      required: true,
      text: textAt(approved, "attribution"),
    };
  }
  const p65 = sourceById(P65_PATH, canonicalProviderId);
  const p65Required = boolAt(p65, "attributionRequired");
  if (p65Required !== null) return {
    required: p65Required,
    text: p65Required ? textAt(p65, "requiredNotice") : null,
  };
  const p90 = sourceById(P90_PATH, canonicalProviderId);
  const p90Required = boolAt(p90, "attributionRequired");
  if (p90Required !== null) return { required: p90Required, text: null };
  const p21 = sourceById(PASS21_PATH, canonicalProviderId);
  const tiers = objectAt(p21, "tiersObserved");
  if (tiers) {
    const attributionValues = Object.values(tiers)
      .map((value) => textAt(value, "attribution"))
      .filter((value): value is string => Boolean(value));
    if (attributionValues.length) {
      return { required: true, text: attributionValues.join(" | ") };
    }
  }
  return { required: null, text: null };
}

function rightsFacts(canonicalProviderId: string) {
  const p65 = sourceById(P65_PATH, canonicalProviderId);
  const p90 = sourceById(P90_PATH, canonicalProviderId);
  const p36 = sourceById(PASS36_PATH, canonicalProviderId);
  const p21 = sourceById(PASS21_PATH, canonicalProviderId);
  const p90Rights = objectAt(p90, "rights");
  const p36Rights = objectAt(p36, "rights");
  const ecbApproved = canonicalProviderId === "ecb_statistics" ? objectAt(ecbReview, "approvedUse") : null;

  const customerDisplayAllowed =
    boolAt(p65, "customerDisplayAllowed") === true
    || boolAt(p36Rights, "customerDeliveryAllowed") === true
    || boolAt(p90Rights, "customerDerivedDisplayAllowed") === true
    || boolAt(p21, "displayUseAllowed") === true;

  const commercialUseAllowed =
    boolAt(p65, "commercialUseAllowed") === true
    || boolAt(p36Rights, "commercialUseAllowed") === true
    || boolAt(p21, "commercialUseAllowed") === true;

  const rawRedistributionAllowed = ecbApproved
    ? boolAt(ecbApproved, "publicBulkRedistribution") === true
    : boolAt(p65, "rawRedistributionAllowed") === true
      || boolAt(p36Rights, "redistributionAllowed") === true
      || boolAt(p90Rights, "rawRedistributionAllowed") === true
      || boolAt(p21, "redistributionAllowed") === true;

  const derivedUseAllowed =
    boolAt(p65, "derivedUseAllowed") === true
    || boolAt(p36Rights, "derivedAnalyticsExternalAllowed") === true;

  const retentionAllowed =
    boolAt(p90Rights, "derivedEvidenceRetentionAllowed") === true
    || boolAt(p36Rights, "retentionAllowed") === true
    || boolAt(ecbApproved, "accountArtifactRetention") === true;

  const rawCacheAllowed =
    boolAt(p36Rights, "cachingAllowed") === true
    || boolAt(ecbApproved, "rawResponseCaching") === true;

  const pdfExportAllowed =
    boolAt(p90Rights, "pdfDerivedExportAllowed") === true
    || boolAt(p36Rights, "pdfExportAllowed") === true
    || boolAt(ecbApproved, "basicPdfExport") === true;

  const aiRagAllowed =
    boolAt(p90Rights, "aiRagAllowed") === true
    || boolAt(p36Rights, "aiRagAllowed") === true;

  const technicalState =
    textAt(p90, "technicalState")
    ?? textAt(p21, "technicalState")
    ?? textAt(p65, "engineeringRightsState");

  const planTierRestriction =
    textAt(p90, "currentPlanEvidence")
    ?? textAt(p36, "currentPlanEvidence")
    ?? textAt(p21, "tier")
    ?? textAt(p65, "engineeringRightsState");
  const requiredPlanOrConsent =
    textAt(p36, "requiredPlanOrConsent")
    ?? textAt(p21, "requiredPlanOrConsent")
    ?? null;

  const blockers = new Set<string>();
  for (const row of [p90, p36]) {
    const list = record(row)?.blockers;
    if (Array.isArray(list)) for (const item of list) if (typeof item === "string") blockers.add(item);
  }
  if (p65 && boolAt(p65, "commercialUseAllowed") === false) {
    blockers.add(textAt(p65, "engineeringRightsState") ?? "commercial_use_not_approved");
  }
  if (p21 && boolAt(p21, "commercialUseAllowed") === false) {
    blockers.add(textAt(p21, "rightsState") ?? "commercial_use_not_approved");
  }

  return {
    customerDisplayAllowed,
    commercialUseAllowed,
    rawRedistributionAllowed,
    derivedUseAllowed,
    retentionAllowed,
    rawCacheAllowed,
    pdfExportAllowed,
    aiRagAllowed,
    internalDiagnosticAllowed: explicitInternalDiagnostic(canonicalProviderId),
    technicalState,
    planTierRestriction,
    requiredPlanOrConsent,
    blockers: [...blockers].sort(),
  };
}

function stateForBoolean(value: boolean, evidence: boolean, expired: boolean): C14ProviderState {
  if (expired) return "EXPIRED";
  if (value) return "CONFIRMED";
  return evidence ? "BLOCKED" : "UNVERIFIED";
}

export function buildC14ProviderEnforcementMatrix(nowMs = Date.now()): C14ProviderMatrixRow[] {
  if (!Number.isFinite(nowMs)) throw new TypeError("invalid_provider_policy_clock");
  return allProviderIds().map((providerId) => {
    const canonicalProviderId = canonicalC14ProviderId(providerId);
    const evidencePaths = evidencePathsFor(canonicalProviderId);
    const hasEvidence = evidencePaths.length > 0;
    const facts = rightsFacts(canonicalProviderId);
    const attribution = explicitAttribution(canonicalProviderId);
    const deadline = currentDeadline(canonicalProviderId);
    const expired = expiredAt(canonicalProviderId, nowMs);
    const cacheState = stateForBoolean(facts.rawCacheAllowed, hasEvidence, expired);
    return {
      providerId,
      canonicalProviderId,
      evidencePaths,
      technicalState: facts.technicalState,
      fetch: stateForBoolean(facts.internalDiagnosticAllowed, hasEvidence, expired),
      storage: stateForBoolean(facts.retentionAllowed, hasEvidence, expired),
      cache: cacheState,
      ttlSecondsMaximum: facts.rawCacheAllowed ? null : 0,
      export: stateForBoolean(facts.pdfExportAllowed || facts.rawRedistributionAllowed, hasEvidence, expired),
      redistribution: stateForBoolean(facts.rawRedistributionAllowed, hasEvidence, expired),
      attribution: attribution.required === true ? "REQUIRED" : attribution.required === false ? "NOT_REQUIRED" : "UNVERIFIED",
      derivativeData: stateForBoolean(facts.derivedUseAllowed, hasEvidence, expired),
      expiration: expired ? "EXPIRED" : (deadline.expiresAt || deadline.reverifyBy) ? "CURRENT" : "UNSPECIFIED",
      expiresAt: deadline.expiresAt,
      reverifyBy: deadline.reverifyBy,
      revocation: hasEvidence ? "RE_EVALUATE_EACH_OPERATION" : "UNVERIFIED",
      planTierRestriction: facts.planTierRestriction,
      requiredPlanOrConsent: facts.requiredPlanOrConsent,
      customerDisplayAllowed: facts.customerDisplayAllowed && !expired,
      commercialUseAllowed: facts.commercialUseAllowed && !expired,
      rawRedistributionAllowed: facts.rawRedistributionAllowed && !expired,
      derivedUseAllowed: facts.derivedUseAllowed && !expired,
      retentionAllowed: facts.retentionAllowed && !expired,
      rawCacheAllowed: facts.rawCacheAllowed && !expired,
      pdfExportAllowed: facts.pdfExportAllowed && !expired,
      aiRagAllowed: facts.aiRagAllowed && !expired,
      internalDiagnosticAllowed: facts.internalDiagnosticAllowed && !expired,
      requiredAttribution: attribution.text,
      blockers: [
        ...facts.blockers,
        ...(expired ? ["rights_review_or_permission_expired"] : []),
        ...(!hasEvidence ? ["provider_rights_evidence_missing"] : []),
      ],
    };
  });
}

function matrixRow(providerId: string, nowMs: number) {
  const normalized = providerId.trim().toLowerCase();
  const canonical = canonicalC14ProviderId(normalized);
  return buildC14ProviderEnforcementMatrix(nowMs)
    .find((row) => row.providerId === normalized || row.canonicalProviderId === canonical) ?? null;
}

function externalAttributionBlockers(
  row: C14ProviderMatrixRow,
  attributionPresent: boolean | undefined,
) {
  if (row.attribution === "REQUIRED" && attributionPresent !== true) return ["required_attribution_missing"];
  if (row.attribution === "UNVERIFIED") return ["attribution_requirement_unverified"];
  return [];
}

export function evaluateC14ProviderOperation(
  request: C14ProviderOperationRequest,
): C14ProviderOperationDecision {
  const nowMs = request.nowMs ?? Date.now();
  if (!Number.isFinite(nowMs)) throw new TypeError("invalid_provider_policy_clock");
  const providerId = request.providerId.trim().toLowerCase();
  const canonicalProviderId = canonicalC14ProviderId(providerId);
  const row = matrixRow(providerId, nowMs);
  const base = {
    schemaVersion: C14_PROVIDER_ENFORCEMENT_VERSION,
    providerId,
    canonicalProviderId,
    operation: request.operation,
    channel: request.channel,
    evidencePaths: row?.evidencePaths ?? [],
    attributionRequired: row?.attribution === "REQUIRED" ? true : row?.attribution === "NOT_REQUIRED" ? false : null,
    requiredAttribution: row?.requiredAttribution ?? null,
    cacheTtlSecondsRequested: request.cacheTtlSeconds ?? null,
    cacheTtlSecondsMaximum: row?.ttlSecondsMaximum ?? 0,
    currentPlanOrTier: row?.planTierRestriction ?? null,
    requiredPlanOrConsent: row?.requiredPlanOrConsent ?? null,
    expiresAt: row?.expiresAt ?? null,
    reverifyBy: row?.reverifyBy ?? null,
  };
  if (!row) {
    return { ...base, allowed: false, state: "UNVERIFIED", code: "PROVIDER_UNVERIFIED", blockers: ["provider_rights_evidence_missing"] };
  }
  if (row.expiration === "EXPIRED") {
    return { ...base, allowed: false, state: "EXPIRED", code: "RIGHTS_REVIEW_EXPIRED", blockers: [...row.blockers] };
  }

  if (request.channel === "internal_diagnostic" && request.operation === "fetch") {
    if (row.internalDiagnosticAllowed) {
      return { ...base, allowed: true, state: "CONFIRMED", code: "ALLOW_INTERNAL_DIAGNOSTIC_FETCH", blockers: [] };
    }
    return {
      ...base,
      allowed: false,
      state: row.evidencePaths.length ? "BLOCKED" : "UNVERIFIED",
      code: row.evidencePaths.length ? "INTERNAL_FETCH_NOT_GRANTED" : "PROVIDER_UNVERIFIED",
      blockers: [...row.blockers, "internal_diagnostic_fetch_not_explicitly_granted"],
    };
  }

  if (request.operation === "cache") {
    const ttl = request.cacheTtlSeconds;
    if (!Number.isSafeInteger(ttl) || (ttl ?? 0) <= 0) {
      return { ...base, allowed: false, state: "BLOCKED", code: "CACHE_TTL_REQUIRED", blockers: ["positive_cache_ttl_required"] };
    }
    if (!row.rawCacheAllowed) {
      return { ...base, allowed: false, state: row.evidencePaths.length ? "BLOCKED" : "UNVERIFIED", code: "CACHE_NOT_GRANTED", blockers: [...row.blockers, "raw_cache_not_explicitly_granted"] };
    }
    if (row.ttlSecondsMaximum !== null && ttl! > row.ttlSecondsMaximum) {
      return { ...base, allowed: false, state: "BLOCKED", code: "CACHE_TTL_EXCEEDED", blockers: ["cache_ttl_exceeds_approved_maximum"] };
    }
    if (request.channel === "internal_diagnostic") {
      return { ...base, allowed: true, state: "CONFIRMED", code: "ALLOW_INTERNAL_DIAGNOSTIC_CACHE", blockers: [] };
    }
  }

  if (request.channel === "internal_diagnostic") {
    if (request.operation === "storage" && row.retentionAllowed) {
      return { ...base, allowed: true, state: "CONFIRMED", code: "ALLOW_INTERNAL_RETENTION", blockers: [] };
    }
    return {
      ...base,
      allowed: false,
      state: row.evidencePaths.length ? "BLOCKED" : "UNVERIFIED",
      code: "INTERNAL_OPERATION_NOT_GRANTED",
      blockers: [...row.blockers, "internal_operation_not_explicitly_granted"],
    };
  }

  const attributionBlockers = externalAttributionBlockers(row, request.attributionPresent);
  const blockers = [...row.blockers, ...attributionBlockers];
  let permitted = false;
  let reason = "OPERATION_NOT_GRANTED";

  switch (request.operation) {
    case "fetch":
    case "display":
      permitted = row.commercialUseAllowed && row.customerDisplayAllowed;
      reason = "CUSTOMER_DISPLAY_NOT_GRANTED";
      break;
    case "storage":
      permitted = row.commercialUseAllowed && row.retentionAllowed;
      reason = "RETENTION_NOT_GRANTED";
      break;
    case "cache":
      permitted = row.commercialUseAllowed && row.rawCacheAllowed;
      reason = "CACHE_NOT_GRANTED";
      break;
    case "pdf_export":
      permitted = row.commercialUseAllowed && row.pdfExportAllowed;
      reason = "PDF_EXPORT_NOT_GRANTED";
      break;
    case "export":
      if (request.dataClass === "raw") {
        permitted = row.commercialUseAllowed && row.rawRedistributionAllowed;
        reason = "RAW_EXPORT_NOT_GRANTED";
      } else {
        permitted = row.commercialUseAllowed && row.derivedUseAllowed && row.customerDisplayAllowed;
        reason = "DERIVED_EXPORT_NOT_GRANTED";
      }
      break;
    case "redistribution":
      permitted = request.dataClass === "raw"
        ? row.commercialUseAllowed && row.rawRedistributionAllowed
        : row.commercialUseAllowed && row.derivedUseAllowed && row.customerDisplayAllowed;
      reason = "REDISTRIBUTION_NOT_GRANTED";
      break;
    case "derivative_data":
      permitted = row.commercialUseAllowed && row.derivedUseAllowed;
      reason = "DERIVATIVE_USE_NOT_GRANTED";
      break;
    case "llm_inference":
      permitted = row.commercialUseAllowed && row.aiRagAllowed;
      reason = "AI_RAG_NOT_GRANTED";
      break;
  }

  if (!permitted) blockers.push(reason.toLowerCase());
  if (attributionBlockers.length) permitted = false;
  return {
    ...base,
    allowed: permitted,
    state: permitted ? "CONFIRMED" : row.evidencePaths.length ? "BLOCKED" : "UNVERIFIED",
    code: permitted ? "ALLOW" : reason,
    blockers: Array.from(new Set(blockers)).sort(),
  };
}

export function c14ProviderCacheAllowed(args: {
  providerId: string;
  ttlSeconds: number;
  nowMs?: number;
}) {
  return evaluateC14ProviderOperation({
    providerId: args.providerId,
    operation: "cache",
    channel: "internal_diagnostic",
    cacheTtlSeconds: args.ttlSeconds,
    nowMs: args.nowMs,
  }).allowed;
}
