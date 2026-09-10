import { buildPass2279AuditOutputQualityMatrix } from "@/lib/ai/audit-output-quality";
import {
  buildPass2280TierRuntimeExpectation,
} from "@/lib/ai/audit-output-regression";
import { buildPass2280OutputAuditMatrix, detectPass2280AssetPolicy } from "@/lib/ai/audit-output-perfection";
import {
  buildPass2281AngelPremiumAuditScaffold,
  buildPass2281WorldclassOutputContract,
  detectPass2281AssetContract,
} from "@/lib/ai/worldclass-output-contract";
import {
  buildPass2282AngelAuditScaffold,
  buildPass2282LiveOutputAuditHarness,
  buildPass2282VisibleOutputPlan,
} from "@/lib/ai/live-output-audit-harness";
import {
  buildPass2283AngelDirective,
  buildPass2283AuditRegressionPack,
  buildPass2283OutputQualityGate,
} from "@/lib/ai/worldclass-output-payment-qa";
import { buildPass2284AngelDirective, buildPass2284LiveOutputQualityLedger, buildPass2284RegressionMatrix } from "@/lib/ai/live-output-quality-ledger";
import { buildPass2288AngelDirective } from "@/lib/ai/claim-proof-firewall";
import { independentProviderFamilies, reconcileEvidenceLanes } from "@/lib/ai/evidence-normalization";
import { verifyVlmAnalysisReceipt, type VlmAnalysisReceipt } from "@/lib/ai/vlm-analysis-receipt";
import type { VlmCanonicalFactPacket } from "@/lib/ai/vlm-fact-packet";
import type { VlmBrainOutput } from "@/lib/ai/vlm-contract";
import { inspectVlmText } from "@/lib/ai/vlm-security";
import { buildAngelStandaloneAnswerContract } from "@/lib/intelligence/vlm-standalone-decision-support";
import type { AngelGroundingRow } from "@/lib/ai/angel-grounding-boundary";
import { pass4644FieldValueHash } from "@/lib/market-integrity/provider-evidence-receipt";
export type AngelLocale = "pl" | "en" | "de";
export type AngelDepth = "basic" | "pro" | "advanced";

export type AngelSignedAnalysisContext = {
  receipt: VlmAnalysisReceipt;
  facts: VlmCanonicalFactPacket;
  output: VlmBrainOutput;
};

export type AngelEvidenceContextInput = {
  asset?: string | null;
  symbol?: string | null;
  depth?: AngelDepth | null;
  confidenceCap?: number | null;
  riskScore?: number | null;
  providers?: string[] | null;
  sourceHealth?: {
    evidenceQuorum?: string | null;
    integrity?: string | null;
    temporal?: string | null;
  } | null;
  missingData?: string[] | null;
  nextChecks?: string[] | null;
  claimPolicy?: Record<string, unknown> | null;
  confirmedLanes?: string[] | null;
  limitedLanes?: string[] | null;
  missingLanes?: string[] | null;
  lockedLanes?: string[] | null;
  /** Client-carried but server-signed analysis. Unsigned scalar fields above are never authoritative. */
  serverAnalysis?: AngelSignedAnalysisContext | null;
};

export type AngelEvidenceGuide = ReturnType<typeof buildAngelEvidenceGuide>;

const ASSET_PATTERNS: Array<{ symbol: string; canonical: string; re: RegExp }> = [
  { symbol: "BTC", canonical: "bitcoin", re: /\b(bitcoin|btc)\b/i },
  { symbol: "ETH", canonical: "ethereum", re: /\b(ethereum|eth)\b/i },
  { symbol: "SOL", canonical: "solana", re: /\b(solana|sol)\b/i },
  { symbol: "BNB", canonical: "bnb", re: /\b(bnb|binance coin)\b/i },
  { symbol: "USDT", canonical: "tether", re: /\b(usdt|tether)\b/i },
  { symbol: "USDC", canonical: "usd-coin", re: /\b(usdc|usd coin)\b/i },
  { symbol: "DOGE", canonical: "dogecoin", re: /\b(doge|dogecoin)\b/i },
  { symbol: "S&P 500", canonical: "sp-500", re: /\b(s&p\s?500|sp500|\^gspc)\b/i },
  { symbol: "SPY", canonical: "spy", re: /\b(spy|spdr s&p 500)\b/i },
  { symbol: "QQQ", canonical: "qqq", re: /\b(qqq|nasdaq 100|\^ndx)\b/i },
  { symbol: "DAX", canonical: "dax", re: /\b(dax|\^gdaxi)\b/i },
  { symbol: "VIX", canonical: "vix", re: /\b(vix|\^vix)\b/i },
  { symbol: "AAPL", canonical: "apple", re: /\b(aapl|apple)\b/i },
  { symbol: "NVDA", canonical: "nvidia", re: /\b(nvda|nvidia)\b/i },
  { symbol: "GOOGL", canonical: "alphabet", re: /\b(googl|google|alphabet)\b/i },
  { symbol: "MSFT", canonical: "microsoft", re: /\b(msft|microsoft)\b/i },
  { symbol: "AMZN", canonical: "amazon", re: /\b(amzn|amazon)\b/i },
  { symbol: "META", canonical: "meta", re: /\b(meta|facebook)\b/i },
  { symbol: "TSLA", canonical: "tesla", re: /\b(tsla|tesla)\b/i },
  { symbol: "ADS.DE", canonical: "adidas", re: /\b(ads\.de|adidas)\b/i },
  { symbol: "BMW.DE", canonical: "bmw", re: /\b(bmw\.de|bmw)\b/i },
  { symbol: "MC.PA", canonical: "lvmh", re: /\b(mc\.pa|lvmh)\b/i },
];

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function sanitizeLane(value: unknown, max = 96) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function inspectSerializedAngelEvidenceContext(provided?: AngelEvidenceContextInput | null) {
  if (!provided) return inspectVlmText("", 48_000);
  let serialized: string;
  try {
    serialized = JSON.stringify(provided);
  } catch {
    serialized = "[unserializable evidence context]";
  }
  return inspectVlmText(serialized, 48_000);
}

export function resolveServerOwnedAngelEvidenceContext(provided?: AngelEvidenceContextInput | null) {
  const inspection = inspectSerializedAngelEvidenceContext(provided);
  if (!inspection.safe) {
    return { verified: false as const, reason: "evidence_context_security_rejected", context: null, inspection, groundingRows: [] as AngelGroundingRow[] };
  }
  const signed = provided?.serverAnalysis;
  if (!signed?.receipt || !signed.facts || !signed.output) {
    return { verified: false as const, reason: "server_signed_analysis_required", context: null, inspection, groundingRows: [] as AngelGroundingRow[] };
  }
  let verification;
  try {
    verification = verifyVlmAnalysisReceipt({ receipt: signed.receipt, facts: signed.facts, output: signed.output });
  } catch {
    return { verified: false as const, reason: "server_signed_analysis_malformed", context: null, inspection, groundingRows: [] as AngelGroundingRow[] };
  }
  if (!verification.valid) {
    return { verified: false as const, reason: `server_signed_analysis_invalid:${verification.reasons.join("|")}`, context: null, inspection, groundingRows: [] as AngelGroundingRow[] };
  }
  const receiptBoundSources = signed.facts.sources.filter((source) =>
    source.id !== "internal:risk-engine"
    && Boolean(source.receiptId)
    && Boolean(source.payloadHash)
    && Boolean(source.observedAt),
  );
  const confirmedFacts = signed.facts.facts.filter((fact) => fact.value !== null && fact.quorumState === "confirmed" && (fact.evidenceBindings?.length ?? 0) >= 2);
  const limitedFacts = signed.facts.facts.filter((fact) => fact.value !== null && ["single_source", "stale", "conflicted"].includes(fact.quorumState ?? "missing"));
  const missingFacts = signed.facts.facts.filter((fact) => fact.value === null || fact.quorumState === "missing");
  const sourceById = new Map(signed.facts.sources.map((source) => [source.id, source]));
  const quorumByFactId = new Map(signed.facts.sourceArbitration.evidenceQuorum.facts.map((fact) => [fact.factId, fact]));
  const groundingRows: AngelGroundingRow[] = signed.facts.facts.flatMap((fact) => {
    if (fact.value === null || !fact.observedAt) return [];
    const exactBindings = (fact.evidenceBindings ?? []).filter((binding) => {
      const source = sourceById.get(binding.sourceId);
      return Boolean(
        source
        && source.id !== "internal:risk-engine"
        && source.receiptId === binding.receiptId
        && source.observedAt === binding.observedAt
        && typeof source.payloadHash === "string"
        && /^[a-f0-9]{64}$/i.test(source.payloadHash)
        && binding.valueHash === pass4644FieldValueHash(fact.value)
        && source.provider.trim().toLowerCase() === binding.providerFamily.trim().toLowerCase()
        && fact.sourceIds.includes(binding.sourceId),
      );
    });
    const sourceIds = unique(exactBindings.map((binding) => sanitizeLane(binding.sourceId, 180))).slice(0, 8);
    const providerFamilies = independentProviderFamilies(exactBindings.map((binding) => sanitizeLane(binding.providerFamily, 120))).slice(0, 8);
    const receiptIds = unique(exactBindings.map((binding) => sanitizeLane(binding.receiptId, 180))).slice(0, 8);
    if (!sourceIds.length || !providerFamilies.length || !receiptIds.length) return [];
    const quorumState = quorumByFactId.get(fact.id)?.status ?? fact.quorumState ?? "missing";
    return [{
      citationId: `E${String(1)}` as AngelGroundingRow["citationId"],
      factId: sanitizeLane(fact.id, 100),
      label: sanitizeLane(fact.label, 180),
      value: typeof fact.value === "number" ? fact.value : sanitizeLane(fact.value, 500),
      observedAt: fact.observedAt,
      freshness: fact.freshness,
      quorumState,
      sourceIds,
      providerFamilies,
      receiptIds,
    }];
  }).slice(0, 24).map((row, index) => ({
    ...row,
    citationId: `E${index + 1}` as AngelGroundingRow["citationId"],
  }));
  const context: AngelEvidenceContextInput = {
    asset: signed.facts.asset.id,
    symbol: signed.facts.asset.symbol,
    depth: signed.output.depth,
    confidenceCap: Math.min(signed.facts.confidenceCap, signed.output.confidence),
    riskScore: signed.facts.verdictGovernor.status === "publishable" ? signed.facts.verdictGovernor.riskScore : null,
    providers: receiptBoundSources.map((source) => source.provider),
    sourceHealth: {
      evidenceQuorum: signed.facts.sourceArbitration.evidenceQuorum.status,
      integrity: signed.facts.sourceArbitration.sourceIntegrity.status,
      temporal: signed.facts.sourceArbitration.temporalConsistency.status,
    },
    missingData: signed.facts.missingData,
    nextChecks: signed.facts.nextChecks,
    claimPolicy: {
      status: signed.facts.verdictGovernor.status,
      blockedClaims: signed.facts.verdictGovernor.blockedClaims,
      receiptId: signed.receipt.receiptId,
    },
    confirmedLanes: confirmedFacts.map((fact) => fact.id),
    limitedLanes: limitedFacts.map((fact) => fact.id),
    missingLanes: missingFacts.map((fact) => fact.id),
    lockedLanes: signed.facts.verdictGovernor.missingProofLanes,
  };
  return { verified: true as const, reason: "server_signed_analysis_verified", context, inspection, verification, groundingRows };
}

function detectAssets(text: string, provided?: AngelEvidenceContextInput | null) {
  const found = ASSET_PATTERNS.filter((asset) => asset.re.test(text)).map((asset) => asset.symbol);
  const providedSymbol = sanitizeLane(provided?.symbol ?? provided?.asset, 32).toUpperCase();
  return unique([providedSymbol, ...found]).slice(0, 6);
}

function detectAskedTiers(text: string, requestedDepth: AngelDepth) {
  const lower = text.toLowerCase();
  const tiers: AngelDepth[] = [];
  if (/\bbasic\b|podstaw|basis|grund/i.test(lower)) tiers.push("basic");
  if (/\bpro\b|professional|średni|sredni/i.test(lower)) tiers.push("pro");
  if (/\badvanced\b|zaawans|paid|płat|plat|bezahlt/i.test(lower)) tiers.push("advanced");
  return unique([requestedDepth, ...tiers]) as AngelDepth[];
}

function tierAdds(depth: AngelDepth, locale: AngelLocale) {
  if (locale === "de") {
    if (depth === "basic") return ["Identität", "Preis", "Risiko", "Primärquelle", "fehlende Daten"];
    if (depth === "pro") return ["Basic-Lanes", "Trendstruktur", "Feed-Health", "zweite Quelle falls vorhanden", "nächster Check"];
    return ["Pro-Lanes", "Orderbook/Spread nur mit Proof", "Holder/Supply nur mit Proof", "Contract/Admin nur mit Proof", "Narrative/OSINT nur mit Quelle", "Evidence packet", "Audit-Evidenztabelle", "Source-Gaps vor Verdict"];
  }
  if (locale === "pl") {
    if (depth === "basic") return ["tożsamość", "cena", "ryzyko", "główne źródło", "brakujące dane"];
    if (depth === "pro") return ["Basic lanes", "struktura trendu", "feed health", "drugie źródło jeśli istnieje", "następny check"];
    return ["Pro lanes", "orderbook/spread tylko z proofem", "holder/supply tylko z proofem", "contract/admin tylko z proofem", "narrative/OSINT tylko ze źródłem", "evidence packet", "tabela dowodów audytu", "source gaps przed verdict"];
  }
  if (depth === "basic") return ["identity", "price", "risk", "primary source", "missing data"];
  if (depth === "pro") return ["Basic lanes", "trend structure", "feed health", "second source when present", "next check"];
  return ["Pro lanes", "orderbook/spread only with proof", "holder/supply only with proof", "contract/admin only with proof", "narrative/OSINT only with source", "evidence packet", "audit evidence table", "source gaps before verdict"];
}

function localizedRules(locale: AngelLocale) {
  if (locale === "de") {
    return [
      "Keine Orderbook-, Spread-, Slippage-, Holder-, Supply-, Contract- oder Admin-Claims ohne Evidenzlane.",
      "Wenn Daten fehlen, nenne die Lücke zuerst und erhöhe Confidence nicht künstlich.",
      "Erkläre Basic/Pro/Advanced als unterschiedliche Proof-Tiefe, nicht nur längeren Text.",
      "Keine ROI-, Kurs- oder Kaufversprechen.",
      "Advanced ist nicht zum Verkauf. Interne Evidence kann Scope, Quellen, Lücken, Severity, Remediation und Quellenkonfidenz zeigen, darf aber nicht als Kundenprodukt oder Zertifikat erscheinen.",
      "Ein statischer 35/100-Wert darf nie als Live-Beweis erscheinen; erkläre Risk-Score vs Confidence-Cap und fehlende Quellen.",
      "PASS2278: eine Audit-Antwort braucht ein minimalistisches Layout: 1) vorsichtiger Verdict, 2) bestätigte Quellen, 3) Lücken, 4) nächster sicherer Test, 5) was Advanced freischaltet.",
      "PASS2279: Quellenlücken vor dem Verdict zeigen; BTC/native Crypto bekommt keine ERC20-Contract/Admin-Lanes; NVDA/SPY/S&P 500 bekommen keine DEX/Holder-Lanes; Wallet Connect ist kein Payment-Proof.",
      "PASS2280: Jede Angel/PDF/Shield-Ausgabe muss eine echte Tier-Differenz zeigen: Basic = Triage, Pro = Source-Cadence/Zweitprovider, Advanced = paid evidence table/contradiction scan mit serverseitigem Entitlement.",
      "PASS2280: Basic/Pro/Advanced unterscheiden sich durch Proof-Tiefe; fehlende Quellen bei BTC/NVDA/SPY/S&P500 deckeln Confidence und werden nicht zu Fake-Risiko.",
      "PASS2281: Angel antwortet quellengebunden und trennt Risiko von Konfidenz. Pro ist Beta nur auf Einladung; Advanced ist nicht zum Verkauf.",
      "PASS2282: Vor jeder starken Aussage stehen Asset-Familie, bestätigte Quellen, fehlende Nachweise, Risiko vs. Konfidenz und die Grenze Advanced NOT_FOR_SALE.",
      buildPass2283AngelDirective("de"),
      buildPass2288AngelDirective("de"),
    ];
  }
  if (locale === "pl") {
    return [
      "Nie wolno claimować orderbooku, spreadu, slippage, holderów, supply, kontraktu ani admin risk bez evidence lane.",
      "Jeśli danych brakuje, najpierw pokaż lukę i nie pompuj confidence.",
      "Basic/Pro/Advanced tłumacz jako różną głębokość proofu, nie tylko dłuższy tekst.",
      "Bez ROI, obietnic ceny i zachęcania do kupna.",
      "Advanced nie jest na sprzedaż. Wewnętrzne evidence może pokazywać zakres, źródła, braki, severity, remediation i source confidence, ale nie może być dostarczane klientowi ani udawać certyfikatu.",
      "Statyczne 35/100 nie może wyglądać jak live-proof; tłumacz różnicę między risk score, confidence cap i brakującymi źródłami.",
      "PASS2278: odpowiedź audytowa ma mieć minimalny układ: 1) werdykt ostrożny, 2) potwierdzone źródła, 3) braki, 4) następny bezpieczny test, 5) co odblokowuje Advanced.",
      "PASS2279: przed verdict pokaż source gaps; BTC/native crypto nie dostaje ERC20 contract/admin lanes; NVDA/SPY/S&P 500 nie dostają DEX/holder lanes; wallet connect nie jest payment proof.",
      "PASS2280: każda odpowiedź Angel/PDF/Shield ma pokazać prawdziwą różnicę tierów: Basic = triage, Pro = source-cadence/drugi provider, Advanced = płatna evidence table/contradiction scan po server-side entitlemencie.",
      "PASS2280: Basic/Pro/Advanced różnią się głębokością proofu; braki źródeł dla BTC/NVDA/SPY/S&P500 tną confidence, ale nie udają ryzyka.",
      "PASS2281: Angel odpowiada źródłowo i rozdziela ryzyko od pewności. Pro jest betą na zaproszenie; Advanced nie jest na sprzedaż.",
      "PASS2282: przed każdą mocną tezą widoczne są: rodzina aktywa, potwierdzone źródła, braki, ryzyko vs. pewność oraz granica Advanced NOT_FOR_SALE.",
      buildPass2283AngelDirective("pl"),
      buildPass2288AngelDirective("pl"),
    ];
  }
  return [
    "Never claim orderbook, spread, slippage, holders, supply, contract or admin risk without an evidence lane.",
    "If data is missing, state the gap first and do not inflate confidence.",
    "Explain Basic/Pro/Advanced as different proof depth, not just longer text.",
    "No ROI, price promises or buy recommendations.",
    "Advanced is not for sale. Internal evidence may show scope, sources, gaps, severity, remediation, and source confidence, but it cannot be delivered as a customer product or certification.",
    "A static 35/100 must never look like live proof; explain risk score vs confidence cap and missing sources.",
    "PASS2278: an audit answer must use a minimal layout: 1) cautious verdict, 2) confirmed sources, 3) gaps, 4) next safe test, 5) what unlocks Advanced.",
    "PASS2279: show source gaps before verdict; BTC/native crypto does not get ERC20 contract/admin lanes; NVDA/SPY/S&P 500 do not get DEX/holder lanes; wallet connect is not payment proof.",
    "PASS2280: every Angel/PDF/Shield answer must show true tier difference: Basic = triage, Pro = source cadence/second provider, Advanced = paid evidence table/contradiction scan after server-side entitlement.",
    "PASS2280: Basic/Pro/Advanced must differ by proof depth; BTC/NVDA/SPY/S&P500 missing-source gaps cap confidence and must not become fake risk claims.",
    "PASS2281: Angel must remain source-bound and separate risk from confidence. Pro is invitation-only beta; Advanced is not for sale.",
    "PASS2282: before any strong claim, show asset family, confirmed sources, missing evidence, risk vs. confidence, and the Advanced NOT_FOR_SALE boundary.",
    buildPass2283AngelDirective("en"),
    buildPass2284AngelDirective("en"),
    buildPass2288AngelDirective("en"),
  ];
}

function publicSummary(args: {
  locale: AngelLocale;
  assets: string[];
  askedTiers: AngelDepth[];
  providers: string[];
  confidenceCap: number | null;
  missingLanes: string[];
  lockedLanes: string[];
}) {
  const assetText = args.assets.length ? args.assets.join(", ") : args.locale === "pl" ? "brak konkretnego aktywa" : args.locale === "de" ? "kein konkretes Asset" : "no concrete asset";
  const providers = args.providers.length ? args.providers.join(", ") : args.locale === "pl" ? "brak potwierdzonego providera" : args.locale === "de" ? "kein bestätigter Provider" : "no confirmed provider";
  const cap = typeof args.confidenceCap === "number" ? `${Math.round(args.confidenceCap)}%` : args.locale === "pl" ? "limit zależny od źródeł" : args.locale === "de" ? "quellenabhängiges Limit" : "source-dependent cap";
  const missing = args.missingLanes.length ? args.missingLanes.slice(0, 5).join(", ") : args.locale === "pl" ? "braki trzeba ujawnić per lane" : args.locale === "de" ? "Lücken je Lane offenlegen" : "gaps must be shown per lane";
  const locked = args.lockedLanes.length ? args.lockedLanes.slice(0, 5).join(", ") : args.locale === "pl" ? "Advanced lanes zostają zamknięte bez proofu" : args.locale === "de" ? "Advanced-Lanes bleiben ohne Proof gesperrt" : "Advanced lanes stay locked without proof";
  if (args.locale === "de") return `Evidenzkontext: Asset ${assetText}; Quellen ${providers}; Confidence-Cap ${cap}; fehlend: ${missing}; gesperrt: ${locked}.`;
  if (args.locale === "pl") return `Kontekst dowodów: aktywo ${assetText}; źródła ${providers}; confidence cap ${cap}; braki: ${missing}; zablokowane: ${locked}.`;
  return `Evidence context: asset ${assetText}; sources ${providers}; confidence cap ${cap}; missing: ${missing}; locked: ${locked}.`;
}

export function buildAngelEvidenceGuide(args: {
  locale: AngelLocale;
  requestedDepth: AngelDepth;
  runtimeLane: string;
  conversation: string;
  paidAccessVerified?: boolean | null;
  provided?: AngelEvidenceContextInput | null;
}) {
  const authority = resolveServerOwnedAngelEvidenceContext(args.provided);
  const provided = authority.context;
  const paidAccessVerified = Boolean(args.paidAccessVerified);
  const assets = detectAssets(args.conversation, provided);
  const askedTiers = detectAskedTiers(args.conversation, args.requestedDepth);
  const rawProviders = unique((provided?.providers ?? []).map((provider) => sanitizeLane(provider, 64)));
  const providers = independentProviderFamilies(rawProviders);
  const confirmedLanes = unique([
    ...(provided?.confirmedLanes ?? []).map((lane) => sanitizeLane(lane)),
    ...(providers.length ? [args.locale === "pl" ? "primary source" : "primary source"] : []),
  ]).slice(0, 10);
  const limitedLanes = unique([...(provided?.limitedLanes ?? []).map((lane) => sanitizeLane(lane))]).slice(0, 10);
  const providedMissing = [...(provided?.missingLanes ?? []), ...(provided?.missingData ?? [])].map((lane) => sanitizeLane(lane));
  const hasRealMarketAsset = assets.some((asset) => ["S&P 500", "SPY", "QQQ", "DAX", "VIX", "AAPL", "NVDA", "GOOGL", "MSFT", "AMZN", "META", "TSLA"].includes(asset));
  const hasNativeCryptoAsset = assets.some((asset) => ["BTC", "ETH", "SOL", "BNB"].includes(asset));
  const defaultMissing = hasRealMarketAsset
    ? ["independent second market source", "quote freshness", "filing/fundamental freshness", "source cadence"]
    : hasNativeCryptoAsset
      ? ["independent second native-market source", "venue depth snapshot", "persistent history snapshot", "cross-venue confirmation"]
      : args.runtimeLane === "markets" || assets.length
        ? ["orderbook depth", "spread/slippage", "holder concentration", "contract/admin controls", "cross-venue confirmation"]
        : ["source coverage", "proof lane", "external confirmation"];
  const laneState = reconcileEvidenceLanes({
    required: defaultMissing,
    confirmed: confirmedLanes,
    limited: limitedLanes,
    explicitMissing: providedMissing,
  });
  const missingLanes = laneState.missing.slice(0, 12);
  const lockedLanes = unique([
    ...(provided?.lockedLanes ?? []).map((lane) => sanitizeLane(lane)),
    args.locale === "de" ? "Advanced: Orderbook/Spread ohne Quelle" : args.locale === "pl" ? "Advanced: orderbook/spread bez źródła" : "Advanced: orderbook/spread without source",
    args.locale === "de" ? "Advanced: Holder/Supply ohne Quelle" : args.locale === "pl" ? "Advanced: holder/supply bez źródła" : "Advanced: holders/supply without source",
    hasNativeCryptoAsset || hasRealMarketAsset
      ? (args.locale === "de" ? "Advanced: Contract/Admin nicht anwendbar ohne Token-Contract-Scope" : args.locale === "pl" ? "Advanced: contract/admin nie dotyczy bez scope kontraktu tokena" : "Advanced: contract/admin not applicable without token-contract scope")
      : (args.locale === "de" ? "Advanced: Contract/Admin ohne Quelle" : args.locale === "pl" ? "Advanced: contract/admin bez źródła" : "Advanced: contract/admin without source"),
  ]).slice(0, 10);
  const confidenceCap = authority.verified && typeof provided?.confidenceCap === "number" && Number.isFinite(provided.confidenceCap)
    ? Math.max(0, Math.min(100, provided.confidenceCap))
    : 0;
  const tierRules = askedTiers.map((tier) => ({
    tier,
    adds: tierAdds(tier, args.locale),
    pass2280: buildPass2280TierRuntimeExpectation(tier),
  }));
  const answerRules = localizedRules(args.locale);
  const pass2279QualityMatrix = buildPass2279AuditOutputQualityMatrix();
  const pass2280OutputAuditMatrix = buildPass2280OutputAuditMatrix();
  const pass2280AssetPolicy = detectPass2280AssetPolicy([args.conversation, assets.join(" ")].join(" "));
  const pass2281WorldclassOutputContract = buildPass2281WorldclassOutputContract();
  const pass2281AssetContract = detectPass2281AssetContract([args.conversation, assets.join(" ")].join(" "));
  const pass2281AngelScaffold = buildPass2281AngelPremiumAuditScaffold({
    locale: args.locale,
    depth: args.requestedDepth,
    assetHint: assets[0] ?? args.conversation,
    sourceCount: providers.length,
    missingCount: missingLanes.length,
    hasSecondProvider: providers.length >= 2,
  });
  const pass2282LiveOutputAuditHarness = buildPass2282LiveOutputAuditHarness();
  const pass2282VisibleOutputPlan = buildPass2282VisibleOutputPlan({
    depth: args.requestedDepth,
    assetText: [assets[0] ?? "", args.conversation].join(" "),
    confirmedSources: providers,
    locale: args.locale,
  });
  const pass2282AngelScaffold = buildPass2282AngelAuditScaffold({
    locale: args.locale,
    depth: args.requestedDepth,
    assetText: assets[0] ?? args.conversation,
    confirmedSources: providers,
    missingLanes,
    confidenceCap,
  });
  const pass2283AuditRegressionPack = buildPass2283AuditRegressionPack();
  const pass2283OutputQualityGate = buildPass2283OutputQualityGate({
    surface: args.runtimeLane === "pdf" ? "pdf" : args.runtimeLane === "markets" ? "real_markets" : args.runtimeLane === "audit" ? "angel" : "angel",
    depth: args.requestedDepth,
    assetText: [assets[0] ?? "", args.conversation].join(" "),
    confirmedSources: providers,
    missingLanes,
    confidenceCap,
    paidAccessVerified,
  });
  const pass2284RegressionMatrix = buildPass2284RegressionMatrix();
  const pass2284LiveOutputLedger = buildPass2284LiveOutputQualityLedger({
    surface: args.runtimeLane === "pdf" ? "pdf" : args.runtimeLane === "markets" ? "real_markets" : args.runtimeLane === "audit" ? "angel" : "angel",
    depth: args.requestedDepth,
    assetText: [assets[0] ?? "", args.conversation].join(" "),
    confirmedSources: providers,
    missingLanes,
    rawScore: provided?.riskScore ?? null,
    confidenceCap,
    paidAccessVerified,
    customerOutputText: args.conversation,
  });
  const standaloneAnswerContract = buildAngelStandaloneAnswerContract({
    locale: args.locale,
    reportContextDepth: args.requestedDepth,
    confirmedFactCount: laneState.confirmed.length,
    providerFamilyCount: providers.length,
    unresolvedSourceConflict: laneState.conflicts.length > 0 || provided?.sourceHealth?.evidenceQuorum === "conflict",
    missingProof: missingLanes,
    nextSafeChecks: provided?.nextChecks,
  });

  return {
    schemaVersion: "velmere.angel.evidence-guide.v1" as const,
    authority: {
      verified: authority.verified,
      reason: authority.reason,
      clientScalarEvidenceIgnored: true,
    },
    pass2279QualityMatrix,
    pass2280OutputAuditMatrix,
    pass2280AssetPolicy,
    pass2281WorldclassOutputContract,
    pass2281AssetContract,
    pass2281AngelScaffold,
    pass2282LiveOutputAuditHarness,
    pass2282VisibleOutputPlan,
    pass2282AngelScaffold,
    pass2283AuditRegressionPack,
    pass2283OutputQualityGate,
    pass2284RegressionMatrix,
    pass2284LiveOutputLedger,
    standaloneAnswerContract,
    runtimeLane: args.runtimeLane,
    requestedDepth: args.requestedDepth,
    mentionedAssets: assets,
    askedTiers,
    sourceState: {
      providers,
      rawProviders,
      providerCount: providers.length,
      confidenceCap,
      riskScore: authority.verified && typeof provided?.riskScore === "number" ? provided.riskScore : null,
      sourceHealth: provided?.sourceHealth ?? null,
    },
    groundingRows: authority.verified ? authority.groundingRows : [],
    lanes: {
      confirmed: laneState.confirmed,
      limited: laneState.limited,
      missing: missingLanes,
      locked: lockedLanes,
      conflicts: laneState.conflicts,
    },
    tierRules,
    answerRules,
    claimPolicy: provided?.claimPolicy ?? null,
    publicSummary: publicSummary({
      locale: args.locale,
      assets,
      askedTiers,
      providers,
      confidenceCap,
      missingLanes,
      lockedLanes,
    }),
  };
}

// PASS2284 markers: Angel live output ledger · confirmed sources before verdict · Advanced NOT_FOR_SALE server-side receipt · wallet connect is not payment proof
// PASS2288 markers: Angel answer policy includes claim-proof firewall directive · no verdict outruns source proof · static 35 source-gap priority · no token lanes for equities/indices/ETFs
