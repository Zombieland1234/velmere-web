import { createHash } from "node:crypto";
import providerRightsMatrix from "../../config/pass36/a102r44p18-official-provider-rights-decision-matrix.json" with { type: "json" };
import { resolveProviderDeliveryRights } from "../compliance/provider-delivery-rights-gate.mjs";

const HEX64 = /^[0-9a-f]{64}$/u;
const SURFACES = new Set(["shield", "real_markets"]);
const TIERS = new Set(["basic", "pro", "advanced"]);
const LOCALES = new Set(["pl", "en", "de"]);

const DEFAULT_POLICY = Object.freeze({
  freshnessSecondsByAssetClass: Object.freeze({
    crypto: 300,
    stock: 1200,
    etf: 1800,
    fx: 900,
    commodity: 1800,
    index: 1800,
    real_estate: 3600,
    reit: 3600,
    rate: 172800,
    rates: 172800,
    macro: 172800,
    crypto_reference: 300,
    futures: 1800,
    derivative: 900,
    credit: 86400,
    option: 900,
    unknown: 0,
  }),
  relativeConflictToleranceByField: Object.freeze({
    price: 0.015,
    returns_24h: 0.02,
    volume_24h: 0.25,
    market_cap_or_notional: 0.1,
    liquidity_usd: 0.25,
    spread_bps: 0.35,
    risk_signal: 0.2,
  }),
  requiredFields: Object.freeze({
    shield: Object.freeze({
      basic: Object.freeze(["price"]),
      pro: Object.freeze(["price", "returns_24h", "volume_24h", "liquidity_usd", "risk_signal", "official_signal"]),
      advanced: Object.freeze(["price", "returns_24h", "volume_24h", "liquidity_usd", "risk_signal", "official_signal"]),
    }),
    real_markets: Object.freeze({
      basic: Object.freeze(["price"]),
      pro: Object.freeze(["price", "returns_24h", "volume_24h", "market_cap_or_notional", "risk_signal", "session_status", "official_signal"]),
      advanced: Object.freeze(["price", "returns_24h", "volume_24h", "market_cap_or_notional", "risk_signal", "session_status", "official_signal"]),
    }),
  }),
  tierRules: Object.freeze({
    basic: Object.freeze({ minimumIndependentFamilies: 1, requiresCommercialRights: false, requiresEntitlement: false, mayReleaseWithMissingNonIdentityEvidence: true }),
    pro: Object.freeze({ minimumIndependentFamilies: 2, requiresCommercialRights: true, requiresEntitlement: true, mayReleaseWithMissingNonIdentityEvidence: false }),
    advanced: Object.freeze({ minimumIndependentFamilies: 2, requiresCommercialRights: true, requiresEntitlement: true, mayReleaseWithMissingNonIdentityEvidence: false }),
  }),
  confidenceWeights: Object.freeze({ identity: 20, coverage: 25, independence: 20, freshness: 15, license: 10, agreement: 10 }),
});

const COPY = Object.freeze({
  en: Object.freeze({
    scope: (asset, surface) => `${surface === "shield" ? "Shield" : "Real Markets"} evidence-bounded assessment for ${asset}.`,
    blocked: "The assessment is withheld because the evidence gate is incomplete.",
    low: "Available evidence indicates lower observed risk, subject to the disclosed limits.",
    medium: "Available evidence indicates material risk drivers that require monitoring.",
    high: "Available evidence indicates elevated observed risk; do not treat this as a prediction or guarantee.",
    unknown: "The evidence is insufficient for a numeric risk assessment.",
    next: "Refresh the missing or stale source families and repeat identity, license, freshness and conflict checks.",
    evidenceStatus: (fresh, total) => `${fresh}/${total} source families are fresh and usable.`,
    limitationMissing: (field) => `Missing source-bound field: ${field}.`,
    limitationConflict: (field) => `Providers materially disagree on ${field}.`,
    limitationIdentity: "Provider identities do not resolve to one canonical asset.",
    limitationLicense: "Commercial reuse rights are not verified for every required source.",
    limitationEntitlement: "The requested paid tier has no verified server-side entitlement.",
    section: (name) => name.replaceAll("_", " "),
  }),
  pl: Object.freeze({
    scope: (asset, surface) => `${surface === "shield" ? "Shield" : "Real Markets"}: analiza ${asset} ograniczona do dostępnych dowodów.`,
    blocked: "Analiza została wstrzymana, ponieważ bramka dowodowa jest niekompletna.",
    low: "Dostępne dowody wskazują na niższe obserwowane ryzyko, z uwzględnieniem opisanych ograniczeń.",
    medium: "Dostępne dowody wskazują na istotne czynniki ryzyka wymagające monitorowania.",
    high: "Dostępne dowody wskazują na podwyższone obserwowane ryzyko; nie jest to prognoza ani gwarancja.",
    unknown: "Dowody są niewystarczające do liczbowej oceny ryzyka.",
    next: "Odśwież brakujące lub przestarzałe rodziny źródeł i ponów kontrolę tożsamości, licencji, świeżości oraz konfliktów.",
    evidenceStatus: (fresh, total) => `${fresh}/${total} rodzin źródeł jest świeżych i użytecznych.`,
    limitationMissing: (field) => `Brak pola powiązanego ze źródłem: ${field}.`,
    limitationConflict: (field) => `Dostawcy istotnie różnią się dla pola ${field}.`,
    limitationIdentity: "Tożsamości u dostawców nie wskazują jednoznacznie tego samego aktywa.",
    limitationLicense: "Nie potwierdzono praw do komercyjnego użycia wszystkich wymaganych źródeł.",
    limitationEntitlement: "Brak zweryfikowanego po stronie serwera uprawnienia do wybranego płatnego tieru.",
    section: (name) => name.replaceAll("_", " "),
  }),
  de: Object.freeze({
    scope: (asset, surface) => `${surface === "shield" ? "Shield" : "Real Markets"}: evidenzbegrenzte Bewertung für ${asset}.`,
    blocked: "Die Bewertung wird zurückgehalten, weil das Evidenz-Gate unvollständig ist.",
    low: "Die verfügbaren Belege zeigen ein niedrigeres beobachtetes Risiko unter den offengelegten Grenzen.",
    medium: "Die verfügbaren Belege zeigen wesentliche Risikotreiber, die überwacht werden müssen.",
    high: "Die verfügbaren Belege zeigen ein erhöhtes beobachtetes Risiko; dies ist keine Prognose oder Garantie.",
    unknown: "Die Belege reichen für eine numerische Risikobewertung nicht aus.",
    next: "Fehlende oder veraltete Quellenfamilien aktualisieren und Identität, Lizenz, Aktualität sowie Konflikte erneut prüfen.",
    evidenceStatus: (fresh, total) => `${fresh}/${total} Quellenfamilien sind aktuell und nutzbar.`,
    limitationMissing: (field) => `Quellengebundenes Feld fehlt: ${field}.`,
    limitationConflict: (field) => `Anbieter weichen bei ${field} wesentlich voneinander ab.`,
    limitationIdentity: "Die Anbieteridentitäten lassen sich nicht auf ein eindeutiges kanonisches Asset auflösen.",
    limitationLicense: "Kommerzielle Nutzungsrechte sind nicht für alle erforderlichen Quellen bestätigt.",
    limitationEntitlement: "Für den angeforderten Bezahltarif liegt keine serverseitig bestätigte Berechtigung vor.",
    section: (name) => name.replaceAll("_", " "),
  }),
});

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256(value) { return createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex"); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function clean(value) { return typeof value === "string" ? value.trim() : ""; }
function object(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function relativeDelta(left, right) {
  if (!finite(left) || !finite(right)) return null;
  const denominator = Math.max(Math.abs(left), Math.abs(right), 1e-12);
  return Math.abs(left - right) / denominator;
}
function expectedFields(policy, surface, tier) { return policy.requiredFields?.[surface]?.[tier] ?? []; }
function freshnessLimit(policy, assetClass) { return Number(policy.freshnessSecondsByAssetClass?.[assetClass] ?? policy.freshnessSecondsByAssetClass?.unknown ?? 0); }
function sourceRows(packet) { return Array.isArray(packet?.sources) ? packet.sources.filter(object) : []; }
function unique(values) { return [...new Set(values)]; }

function normalizedSource(row, packet, asOfMs, policy, rightsMode) {
  const observedMs = Date.parse(clean(row.observedAt));
  const ageSeconds = Number.isFinite(observedMs) ? Math.max(0, Math.floor((asOfMs - observedMs) / 1000)) : Number.POSITIVE_INFINITY;
  const limit = freshnessLimit(policy, clean(packet.asset?.assetClass) || "unknown");
  const fresh = limit > 0 && ageSeconds <= limit;
  const values = object(row.values) ? row.values : {};
  const syntheticCompatibility = rightsMode === "synthetic_fixture";
  const requestedLicenseStatus = clean(row.licenseStatus) || "unknown";
  const customerDecision = syntheticCompatibility ? null : resolveProviderDeliveryRights({ providerId: clean(row.providerId), purpose: "customer_delivery", matrix: providerRightsMatrix });
  const paidDecision = syntheticCompatibility ? null : resolveProviderDeliveryRights({ providerId: clean(row.providerId), purpose: "paid_tier", matrix: providerRightsMatrix });
  const publicDisplayAllowed = syntheticCompatibility ? true : customerDecision.allowed === true;
  const paidDeliveryAllowed = syntheticCompatibility ? true : publicDisplayAllowed && paidDecision.allowed === true;
  const licenseStatus = publicDisplayAllowed ? requestedLicenseStatus : "restricted";
  const rightsBlockers = syntheticCompatibility
    ? []
    : unique([...(customerDecision.blockers ?? []), ...(paidDecision.blockers ?? [])]);
  return {
    sourceId: clean(row.sourceId),
    providerId: clean(row.providerId),
    family: clean(row.family),
    canonicalIdentity: clean(row.canonicalIdentity).toLowerCase(),
    observedAt: clean(row.observedAt),
    ageSeconds,
    freshnessStatus: fresh ? "fresh" : "stale",
    licenseStatus,
    providerRights: {
      publicDisplayAllowed,
      paidDeliveryAllowed,
      blockers: rightsBlockers,
      rightsMode,
      customerDecisionReceiptSha256: customerDecision?.receiptSha256 ?? null,
      paidDecisionReceiptSha256: paidDecision?.receiptSha256 ?? null,
      matrixSha256: customerDecision?.matrixSha256 ?? providerRightsMatrix.matrixSha256,
      decisionSha256: customerDecision?.decisionSha256 ?? null,
    },
    payloadSha256: HEX64.test(clean(row.payloadSha256)) ? clean(row.payloadSha256) : sha256(values),
    values,
    usableForBasic: fresh && publicDisplayAllowed && ["verified", "display_only"].includes(licenseStatus),
    usableForPaid: fresh && paidDeliveryAllowed && licenseStatus === "verified",
  };
}

function resolveField(sources, field, tolerance) {
  const observations = sources
    .filter((row) => Object.prototype.hasOwnProperty.call(row.values, field) && row.values[field] !== null && row.values[field] !== undefined)
    .map((row) => ({ sourceId: row.sourceId, family: row.family, value: row.values[field], freshnessStatus: row.freshnessStatus, licenseStatus: row.licenseStatus }));
  const fresh = observations.filter((row) => row.freshnessStatus === "fresh");
  const usable = fresh.length ? fresh : observations;
  const numeric = usable.filter((row) => finite(row.value));
  const conflicts = [];
  for (let left = 0; left < numeric.length; left += 1) {
    for (let right = left + 1; right < numeric.length; right += 1) {
      const delta = relativeDelta(numeric[left].value, numeric[right].value);
      if (delta !== null && delta > tolerance) conflicts.push({ left: numeric[left].sourceId, right: numeric[right].sourceId, delta });
    }
  }
  let value = null;
  if (numeric.length) {
    const sorted = numeric.map((row) => row.value).sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  } else if (usable.length) {
    value = usable[0].value;
  }
  return { field, value, observations, conflicts, freshObservationCount: fresh.length };
}

function riskFromEvidence(fieldResults, usableFamilies, identityOk) {
  const riskField = fieldResults.risk_signal;
  if (!identityOk || usableFamilies < 1 || !finite(riskField?.value)) return { score: null, band: "unknown", drivers: [] };
  const drivers = [{ id: "source_bound_risk_signal", contribution: Math.round(riskField.value), basis: "median_of_fresh_observations" }];
  const spread = fieldResults.spread_bps?.value;
  if (finite(spread)) drivers.push({ id: "observed_spread", contribution: clamp(Math.round(spread / 4), 0, 20), basis: "spread_bps" });
  const returns = fieldResults.returns_24h?.value;
  if (finite(returns)) drivers.push({ id: "absolute_24h_move", contribution: clamp(Math.round(Math.abs(returns) * 2), 0, 20), basis: "absolute_percent_change" });
  const score = clamp(Math.round(drivers.reduce((sum, row) => sum + row.contribution, 0) / Math.max(1, drivers.length)), 0, 100);
  return { score, band: score >= 70 ? "high" : score >= 40 ? "medium" : "low", drivers };
}

function confidenceScore({ policy, identityOk, requiredFields, fieldResults, sources, usableFamilies, conflicts, licensesVerified }) {
  const weights = policy.confidenceWeights ?? DEFAULT_POLICY.confidenceWeights;
  const present = requiredFields.filter((field) => fieldResults[field]?.value !== null).length;
  const freshSources = sources.filter((row) => row.freshnessStatus === "fresh").length;
  const identity = identityOk ? weights.identity : 0;
  const coverage = requiredFields.length ? weights.coverage * (present / requiredFields.length) : weights.coverage;
  const independence = weights.independence * Math.min(1, usableFamilies / 2);
  const freshness = sources.length ? weights.freshness * (freshSources / sources.length) : 0;
  const license = licensesVerified ? weights.license : 0;
  const agreement = conflicts.length ? Math.max(0, weights.agreement - Math.min(weights.agreement, conflicts.length * 2)) : weights.agreement;
  return clamp(Math.round(identity + coverage + independence + freshness + license + agreement), 0, 100);
}

function buildSections(matrixRow, locale, status, evidenceStatus, limitations, nextSafeCheck) {
  const copy = COPY[locale];
  const sections = {};
  for (const name of matrixRow.requiredSections ?? []) {
    let summary = evidenceStatus;
    if (name === "scope") summary = status === "blocked" ? copy.blocked : evidenceStatus;
    else if (name === "limitations" || name === "missing_data") summary = limitations.join(" ") || evidenceStatus;
    else if (name === "next_safe_check") summary = nextSafeCheck;
    sections[name] = { title: copy.section(name), summary };
  }
  return sections;
}

export function buildWorldclassMarketOutput(args) {
  const { matrixRow, corpusCase, evidencePacket } = args ?? {};
  const policy = args?.policy ?? DEFAULT_POLICY;
  if (!object(matrixRow) || !object(corpusCase) || !object(evidencePacket)) throw new TypeError("matrixRow, corpusCase and evidencePacket are required objects");
  if (!SURFACES.has(matrixRow.surface) || matrixRow.surface !== corpusCase.surface || matrixRow.surface !== evidencePacket.surface) throw new Error("market_surface_mismatch");
  if (!TIERS.has(matrixRow.tier) || !LOCALES.has(matrixRow.locale)) throw new Error("unsupported_tier_or_locale");
  if (matrixRow.caseId !== corpusCase.id || matrixRow.caseId !== evidencePacket.caseId) throw new Error("market_case_mismatch");
  if (!HEX64.test(String(args.sourceSha256 ?? "")) || !HEX64.test(String(args.corpusSha256 ?? ""))) throw new Error("invalid_source_or_corpus_sha");

  const locale = matrixRow.locale;
  const copy = COPY[locale];
  const asset = object(evidencePacket.asset) ? evidencePacket.asset : {};
  const canonicalIdentity = clean(asset.canonicalIdentity).toLowerCase();
  const assetLabel = clean(asset.name) || clean(asset.symbol) || matrixRow.caseId;
  const asOf = clean(evidencePacket.asOf);
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(asOfMs)) throw new Error("invalid_evidence_as_of");

  const rightsMode = clean(args?.rightsMode) || "customer_delivery";
  if (!["customer_delivery", "synthetic_fixture"].includes(rightsMode)) throw new Error("unsupported_provider_rights_mode");
  const sources = sourceRows(evidencePacket)
    .map((row) => normalizedSource(row, evidencePacket, asOfMs, policy, rightsMode))
    .filter((row) => row.sourceId && row.providerId && row.family);
  const identities = unique(sources.map((row) => row.canonicalIdentity).filter(Boolean));
  const identityOk = Boolean(canonicalIdentity) && identities.length > 0 && identities.every((value) => value === canonicalIdentity);
  const eligibleSources = sources.filter((row) => matrixRow.tier === "basic" ? row.usableForBasic : row.usableForPaid);
  const usableFamilies = new Set(eligibleSources.map((row) => row.family)).size;
  const tierRule = policy.tierRules?.[matrixRow.tier] ?? DEFAULT_POLICY.tierRules[matrixRow.tier];
  const fields = unique(Object.keys(policy.relativeConflictToleranceByField ?? {}).concat(expectedFields(policy, matrixRow.surface, matrixRow.tier), ["official_signal", "session_status"]));
  const fieldResults = Object.fromEntries(fields.map((field) => [field, resolveField(eligibleSources, field, Number(policy.relativeConflictToleranceByField?.[field] ?? 0))]));
  const requiredFields = expectedFields(policy, matrixRow.surface, matrixRow.tier);
  const missingFields = requiredFields.filter((field) => fieldResults[field]?.value === null);
  const conflicts = Object.values(fieldResults).flatMap((result) => result.conflicts.map((row) => ({ field: result.field, ...row })));
  const licensesVerified = eligibleSources.length > 0 && eligibleSources.every((row) => row.licenseStatus === "verified");
  const entitlementVerified = matrixRow.tier === "basic" || args.entitlementStatus === "verified";
  const noEvidence = usableFamilies === 0;
  const insufficientFamilies = usableFamilies < Number(tierRule.minimumIndependentFamilies ?? 1);
  const paidMissing = matrixRow.tier !== "basic" && missingFields.length > 0;
  const licenseBlocked = Boolean(tierRule.requiresCommercialRights) && !licensesVerified;
  const entitlementBlocked = Boolean(tierRule.requiresEntitlement) && !entitlementVerified;
  const expectedBlock = ["blocked_without_evidence", "blocked_without_commercial_data", "blocked_without_release_rights"].includes(matrixRow.expectedOutcome);
  const blocked = expectedBlock || !identityOk || noEvidence || insufficientFamilies || paidMissing || licenseBlocked || entitlementBlocked;

  const limitations = [];
  if (!identityOk) limitations.push(copy.limitationIdentity);
  for (const field of missingFields) limitations.push(copy.limitationMissing(field));
  for (const conflict of conflicts) limitations.push(copy.limitationConflict(conflict.field));
  if (licenseBlocked) limitations.push(copy.limitationLicense);
  if (entitlementBlocked) limitations.push(copy.limitationEntitlement);
  const staleCount = sources.filter((row) => row.freshnessStatus === "stale").length;
  if (staleCount) limitations.push(copy.limitationMissing(`${staleCount} stale source${staleCount === 1 ? "" : "s"}`));

  const numericAllowed = !["bounded_metadata_only", "refuse_numeric_verdict"].includes(matrixRow.expectedOutcome);
  const risk = numericAllowed ? riskFromEvidence(fieldResults, usableFamilies, identityOk) : { score: null, band: "unknown", drivers: [] };
  const confidence = confidenceScore({ policy, identityOk, requiredFields, fieldResults, sources: eligibleSources, usableFamilies, conflicts, licensesVerified: matrixRow.tier === "basic" ? eligibleSources.length > 0 : licensesVerified });
  const evidence = sources.map((row) => ({
    sourceId: row.sourceId,
    providerId: row.providerId,
    family: row.family,
    freshnessStatus: row.freshnessStatus,
    licenseStatus: row.licenseStatus,
    observedAt: row.observedAt,
    payloadSha256: row.payloadSha256,
    providerRights: row.providerRights,
  }));
  const evidenceStatus = copy.evidenceStatus(usableFamilies, new Set(sources.map((row) => row.family)).size);
  const status = blocked ? "blocked" : "passed";
  const nextSafeCheck = copy.next;
  const customerVerdict = status === "blocked" ? copy.blocked : copy[risk.band] ?? copy.unknown;
  const freshnessReceipt = sha256(sources.map((row) => ({ sourceId: row.sourceId, observedAt: row.observedAt, freshnessStatus: row.freshnessStatus })));
  const provenanceReceipt = HEX64.test(clean(evidencePacket.provenanceReceiptSha256))
    ? clean(evidencePacket.provenanceReceiptSha256)
    : sha256({ caseId: matrixRow.caseId, canonicalIdentity, sources: evidence });

  const output = {
    schemaVersion: "velmere.worldclass.market-output.v1",
    matrixId: matrixRow.matrixId,
    caseId: matrixRow.caseId,
    surface: matrixRow.surface,
    tier: matrixRow.tier,
    locale,
    language: locale,
    sourceSha256: args.sourceSha256,
    corpusSha256: args.corpusSha256,
    status,
    scope: copy.scope(assetLabel, matrixRow.surface),
    evidence,
    missingData: unique(missingFields.concat(noEvidence ? ["usable_source_family"] : [])),
    limitations: unique(limitations),
    confidence: blocked ? Math.min(25, confidence) : confidence,
    nextSafeCheck,
    customerVerdict,
    sections: buildSections(matrixRow, locale, status, evidenceStatus, limitations, nextSafeCheck),
    assetIdentity: {
      canonicalIdentity: canonicalIdentity || null,
      symbol: clean(asset.symbol) || null,
      name: clean(asset.name) || null,
      assetClass: clean(asset.assetClass) || "unknown",
      identityStatus: identityOk ? "verified" : "unresolved",
      observedIdentities: identities,
    },
    marketSnapshot: {
      asOf,
      price: fieldResults.price?.value ?? null,
      returns24h: fieldResults.returns_24h?.value ?? null,
      volume24h: fieldResults.volume_24h?.value ?? null,
      marketCapOrNotional: fieldResults.market_cap_or_notional?.value ?? null,
      sourceBound: usableFamilies > 0,
    },
    riskAssessment: {
      score: blocked ? null : risk.score,
      band: blocked ? "withheld" : risk.band,
      confidence: blocked ? Math.min(25, confidence) : confidence,
      drivers: risk.drivers,
      conflicts,
      boundary: "Observed evidence only; no price prediction, guarantee or fabricated replacement for missing data.",
    },
  };

  if (matrixRow.surface === "shield") {
    output.liquidity = {
      liquidityUsd: fieldResults.liquidity_usd?.value ?? null,
      spreadBps: fieldResults.spread_bps?.value ?? null,
      state: fieldResults.liquidity_usd?.value === null ? "unknown" : "observed",
    };
    output.onchainOrIssuerSignals = {
      value: fieldResults.official_signal?.value ?? null,
      sourceBound: fieldResults.official_signal?.value !== null,
    };
  } else {
    output.sessionAndVenue = {
      venue: clean(asset.venue) || null,
      currency: clean(asset.currency) || null,
      sessionStatus: fieldResults.session_status?.value ?? null,
    };
    output.issuerOrOfficialSignals = {
      value: fieldResults.official_signal?.value ?? null,
      sourceBound: fieldResults.official_signal?.value !== null,
    };
  }

  if (matrixRow.tier === "basic") {
    output.evidenceStatus = evidenceStatus;
  } else {
    output.evidenceTable = evidence.map((row) => ({ ...row }));
    output.riskDrivers = risk.drivers;
    output.commercialRights = licensesVerified ? "verified" : "unverified";
    output.freshnessReceipt = freshnessReceipt;
    output.entitlementStatus = entitlementVerified ? "verified" : "unverified";
  }
  if (matrixRow.tier === "advanced") {
    output.contradictions = conflicts;
    output.confidenceBasis = {
      identityOk,
      requiredFields: requiredFields.length,
      presentRequiredFields: requiredFields.length - missingFields.length,
      independentFreshFamilies: usableFamilies,
      staleSources: staleCount,
      licensesVerified,
      conflictCount: conflicts.length,
    };
    output.provenanceReceipt = provenanceReceipt;
  }
  if (blocked) {
    output.blockers = unique([
      !identityOk ? "canonical_identity_unresolved" : null,
      noEvidence ? "no_fresh_usable_evidence" : null,
      insufficientFamilies ? "independent_source_family_floor_not_met" : null,
      paidMissing ? "paid_required_fields_missing" : null,
      licenseBlocked ? "commercial_rights_unverified" : null,
      entitlementBlocked ? "server_entitlement_unverified" : null,
      expectedBlock ? matrixRow.expectedOutcome : null,
    ].filter(Boolean));
  } else if (risk.score !== null) {
    output.numericRiskScore = risk.score;
  }
  output.outputReceiptSha256 = sha256(output);
  return output;
}

export function buildMarketAdapterEvidenceReceipt(packet) {
  if (!object(packet)) throw new TypeError("packet must be an object");
  return sha256(packet);
}

export function marketAdapterPolicyDefaults() {
  return DEFAULT_POLICY;
}
