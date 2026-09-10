import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2570AuditSourceQuorumReport } from "./audit-source-quorum-runtime";

declare const process: { env: Record<string, string | undefined> };

export const PASS2571_AUDIT_PROVIDER_INTELLIGENCE_ID = "audit-provider-intelligence" as const;

export type Pass2571Tier = "basic" | "pro" | "advanced";
export type Pass2571ProviderState = "ready" | "needs_key" | "planned" | "blocked";
export type Pass2571ProviderPriority = "primary" | "fallback" | "manual" | "later";

export type Pass2571ProviderLane = {
  id: string;
  label: string;
  sourceFamily: string;
  tier: Pass2571Tier[];
  priority: Pass2571ProviderPriority;
  state: Pass2571ProviderState;
  envKeys: string[];
  timeoutMs: number;
  freshnessTarget: string;
  claimBoundary: string;
  givesBasic: string;
  givesPro: string;
  givesAdvanced: string;
  missingFallback: string;
};

export type Pass2571AuditProviderIntelligenceReport = {
  passId: typeof PASS2571_AUDIT_PROVIDER_INTELLIGENCE_ID;
  generatedAt: string;
  locale: string;
  target: {
    projectName?: string;
    contractAddress?: string;
    chain: string;
    auditUrl?: string;
    docsUrl?: string;
    githubUrl?: string;
    website?: string;
  };
  rule: string;
  internetScope: string;
  tierBudgets: Record<Pass2571Tier, { maxLanes: number; output: string; gate: string }>;
  sourceFamilies: string[];
  providerMatrix: Pass2571ProviderLane[];
  runtimePlan: Array<{ step: number; label: string; action: string; boundary: string }>;
  basicSurfaceRows: Array<{ label: string; source: string; output: string }>;
  proPdfRows: Array<{ label: string; source: string; output: string }>;
  advancedRows: Array<{ label: string; source: string; output: string }>;
  readiness: {
    readyProviders: number;
    needsKeyProviders: number;
    plannedProviders: number;
    blockedProviders: number;
    liveCoverageLabel: string;
  };
  nextImplementationBacklog: string[];
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[<>{}\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function hasAnyEnv(keys: string[]) {
  return keys.some((key) => Boolean(process.env[key]?.trim()));
}

function envState(keys: string[], fallback: Pass2571ProviderState = "planned"): Pass2571ProviderState {
  if (!keys.length) return fallback;
  return hasAnyEnv(keys) ? "ready" : "needs_key";
}

function providerLane(args: Omit<Pass2571ProviderLane, "state"> & { state?: Pass2571ProviderState }): Pass2571ProviderLane {
  return {
    ...args,
    state: args.state ?? envState(args.envKeys),
  };
}

export function buildPass2571AuditProviderIntelligenceReport(input: Partial<AuditReviewSubmission> & {
  locale?: string;
  sourceQuorum?: Pass2570AuditSourceQuorumReport | null;
}): Pass2571AuditProviderIntelligenceReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? "ethereum";
  const target = {
    projectName: clean(input.projectName, 90),
    contractAddress: clean(input.contractAddress, 96),
    chain,
    auditUrl: clean(input.auditUrl, 260),
    docsUrl: clean(input.docsUrl, 260),
    githubUrl: clean(input.githubUrl, 260),
    website: clean(input.website, 260),
  };

  const providerMatrix: Pass2571ProviderLane[] = [
    providerLane({
      id: "explorer-primary-etherscan-v2",
      label: "Explorer primary",
      sourceFamily: "Explorer / source code / ABI",
      tier: ["basic", "pro", "advanced"],
      priority: "primary",
      envKeys: ["ETHERSCAN_API_KEY"],
      timeoutMs: 2600,
      freshnessTarget: "live request / no-store",
      claimBoundary: "Verified/source claims require explorer response; otherwise show pending/missing.",
      givesBasic: t(locale, "format kontraktu, explorer lane, verified-source pending/confirmed", "Contract Format, Explorer Lane, Verified-Source pending/confirmed", "contract format, explorer lane, verified-source pending/confirmed"),
      givesPro: t(locale, "ABI/source, creator, proxy hints, compiler, source freshness", "ABI/Source, Creator, Proxy Hints, Compiler, Source Freshness", "ABI/source, creator, proxy hints, compiler, source freshness"),
      givesAdvanced: t(locale, "manual source/bytecode/proxy interpretation", "Manual Source/Bytecode/Proxy Interpretation", "manual source/bytecode/proxy interpretation"),
      missingFallback: t(locale, "Nie claimuj verified source bez explorer proof.", "Kein Verified-Source Claim ohne Explorer Proof.", "Do not claim verified source without explorer proof."),
    }),
    providerLane({
      id: "explorer-fallback-blockscout",
      label: "Explorer fallback",
      sourceFamily: "Fallback explorer / source code",
      tier: ["pro", "advanced"],
      priority: "fallback",
      envKeys: [],
      state: "planned",
      timeoutMs: 2600,
      freshnessTarget: "live fallback if primary fails",
      claimBoundary: "Fallback can confirm or challenge explorer primary; conflicts lower confidence.",
      givesBasic: t(locale, "nie wymagane w Basic", "nicht fuer Basic erforderlich", "not required in Basic"),
      givesPro: t(locale, "second explorer/source check", "zweiter Explorer/Source Check", "second explorer/source check"),
      givesAdvanced: t(locale, "manual conflict resolution", "manuelle Konfliktloesung", "manual conflict resolution"),
      missingFallback: t(locale, "Jeżeli fallback nie działa, oznacz lane jako partial.", "Wenn Fallback ausfaellt, Lane als partial markieren.", "If fallback is unavailable, mark lane partial."),
    }),
    providerLane({
      id: "security-flags-goplus",
      label: "Security flags primary",
      sourceFamily: "Token security / passive flags",
      tier: ["basic", "pro", "advanced"],
      priority: "primary",
      envKeys: ["GOPLUS_API_KEY"],
      timeoutMs: 2400,
      freshnessTarget: "live / max 15 min cache later",
      claimBoundary: "Security flags are warnings, not final proof of safety or danger.",
      givesBasic: t(locale, "honeypot/tax/blacklist quick warnings gdy dostępne", "Honeypot/Tax/Blacklist Quick Warnings falls verfuegbar", "honeypot/tax/blacklist quick warnings when available"),
      givesPro: t(locale, "cross-source security flag table", "Cross-source Security Flag Tabelle", "cross-source security flag table"),
      givesAdvanced: t(locale, "manual flag interpretation", "manuelle Flag Interpretation", "manual flag interpretation"),
      missingFallback: t(locale, "Brak security API nie może blokować Basic; pokaż missing.", "Security API Ausfall blockiert Basic nicht; Missing anzeigen.", "Security API absence must not block Basic; show missing."),
    }),
    providerLane({
      id: "security-flags-honeypot",
      label: "Security flags fallback",
      sourceFamily: "Honeypot/tax simulation style passive data",
      tier: ["pro", "advanced"],
      priority: "fallback",
      envKeys: ["HONEYPOT_API_KEY"],
      timeoutMs: 2400,
      freshnessTarget: "live / max 15 min cache later",
      claimBoundary: "Never provide exploit steps; only customer-safe flags.",
      givesBasic: t(locale, "headline fallback jeśli Basic ma provider", "Headline Fallback wenn Basic Provider hat", "headline fallback if Basic has provider"),
      givesPro: t(locale, "buy/sell tax and honeypot-like warning lane", "Buy/Sell Tax und Honeypot-like Warning Lane", "buy/sell tax and honeypot-like warning lane"),
      givesAdvanced: t(locale, "manual simulated-trade interpretation", "manuelle Simulated-Trade Interpretation", "manual simulated-trade interpretation"),
      missingFallback: t(locale, "Jeżeli provider nie odpowie, wynik zostaje partial.", "Wenn Provider nicht antwortet, Ergebnis bleibt partial.", "If provider does not respond, result stays partial."),
    }),
    providerLane({
      id: "dex-liquidity-dexscreener",
      label: "DEX liquidity",
      sourceFamily: "DEX pairs / liquidity / venue",
      tier: ["basic", "pro", "advanced"],
      priority: "primary",
      envKeys: [],
      state: "planned",
      timeoutMs: 2600,
      freshnessTarget: "live / max 5 min cache later",
      claimBoundary: "Liquidity visibility is not liquidity lock proof.",
      givesBasic: t(locale, "czy są publiczne pary i widoczna płynność", "ob oeffentliche Pairs und sichtbare Liquiditaet existieren", "whether public pairs and visible liquidity exist"),
      givesPro: t(locale, "pair age, liquidity USD, volume, venue risk", "Pair Age, Liquidity USD, Volume, Venue Risk", "pair age, liquidity USD, volume, venue risk"),
      givesAdvanced: t(locale, "manual liquidity-change and lock-proof review", "manueller Liquidity-Change und Lock-Proof Review", "manual liquidity-change and lock-proof review"),
      missingFallback: t(locale, "Brak par DEX nie znaczy scam — oznacz unknown.", "Keine DEX Pairs bedeutet nicht Scam — Unknown markieren.", "Missing DEX pairs does not mean scam — mark unknown."),
    }),
    providerLane({
      id: "market-metadata-coingecko",
      label: "Market metadata",
      sourceFamily: "Market metadata / project links",
      tier: ["basic", "pro", "advanced"],
      priority: "primary",
      envKeys: ["COINGECKO_API_KEY"],
      timeoutMs: 2600,
      freshnessTarget: "live / max 15 min cache later",
      claimBoundary: "Market listing is presence evidence, not safety proof.",
      givesBasic: t(locale, "symbol/name/logo/links jeśli dopasowane", "Symbol/Name/Logo/Links falls gematcht", "symbol/name/logo/links when matched"),
      givesPro: t(locale, "market cap, supply, volume, official links cross-check", "Market Cap, Supply, Volume, Official Links Cross-check", "market cap, supply, volume, official links cross-check"),
      givesAdvanced: t(locale, "manual mismatch and impersonation review", "manueller Mismatch/Impersonation Review", "manual mismatch and impersonation review"),
      missingFallback: t(locale, "Brak listingu nie jest automatycznie negatywny.", "Kein Listing ist nicht automatisch negativ.", "Missing listing is not automatically negative."),
    }),
    providerLane({
      id: "holders-concentration",
      label: "Holder concentration",
      sourceFamily: "Holders / supply concentration",
      tier: ["pro", "advanced"],
      priority: "primary",
      envKeys: ["ETHERSCAN_API_KEY", "COVALENT_API_KEY", "MORALIS_API_KEY"],
      timeoutMs: 3200,
      freshnessTarget: "live / max 15 min cache later",
      claimBoundary: "Top holder labels need evidence; exchange/burn wallets must be labeled separately.",
      givesBasic: t(locale, "Basic pokazuje tylko pending/limited", "Basic zeigt nur pending/limited", "Basic shows pending/limited only"),
      givesPro: t(locale, "top holders, concentration, exchange/burn label lane", "Top Holders, Concentration, Exchange/Burn Label Lane", "top holders, concentration, exchange/burn label lane"),
      givesAdvanced: t(locale, "manual relation/deployer/owner clustering", "manual Relation/Deployer/Owner Clustering", "manual relation/deployer/owner clustering"),
      missingFallback: t(locale, "Jeżeli holder API nie działa, Pro PDF musi pokazać missing.", "Wenn Holder API ausfaellt, muss Pro PDF missing zeigen.", "If holder API fails, Pro PDF must show missing."),
    }),
    providerLane({
      id: "defi-context-defillama",
      label: "DeFi context",
      sourceFamily: "Protocol / TVL / DeFi presence",
      tier: ["pro", "advanced"],
      priority: "fallback",
      envKeys: [],
      state: "planned",
      timeoutMs: 2600,
      freshnessTarget: "live / max 30 min cache later",
      claimBoundary: "TVL/protocol presence is context, not a safety guarantee.",
      givesBasic: t(locale, "nie wymagane w Basic", "nicht in Basic erforderlich", "not required in Basic"),
      givesPro: t(locale, "protocol presence, TVL context, category", "Protocol Presence, TVL Context, Kategorie", "protocol presence, TVL context, category"),
      givesAdvanced: t(locale, "manual protocol/docs/contract matching", "manuelles Protocol/Docs/Contract Matching", "manual protocol/docs/contract matching"),
      missingFallback: t(locale, "Brak DeFiLlama match nie jest werdyktem bezpieczeństwa.", "Kein DeFiLlama Match ist kein Safety Verdict.", "Missing DeFiLlama match is not a safety verdict."),
    }),
    providerLane({
      id: "docs-repo-osint",
      label: "Docs / repo / public audit",
      sourceFamily: "Project docs / GitHub / public audit scope",
      tier: ["basic", "pro", "advanced"],
      priority: "manual",
      envKeys: ["GITHUB_TOKEN", "SERP_API_KEY", "TAVILY_API_KEY"],
      timeoutMs: 3400,
      freshnessTarget: "live / max 60 min cache later",
      claimBoundary: "Docs/audit must match the submitted address, date and scope.",
      givesBasic: t(locale, "czy użytkownik podał audit/docs/repo/website", "ob User Audit/Docs/Repo/Website angegeben hat", "whether user provided audit/docs/repo/website"),
      givesPro: t(locale, "scope/date/address matching and source freshness", "Scope/Date/Address Matching und Source Freshness", "scope/date/address matching and source freshness"),
      givesAdvanced: t(locale, "manual OSINT and authenticity review", "manual OSINT und Authenticity Review", "manual OSINT and authenticity review"),
      missingFallback: t(locale, "Nie zgaduj repo/audytu bez potwierdzenia.", "Repo/Audit ohne Bestaetigung nicht raten.", "Do not guess repo/audit without confirmation."),
    }),
    providerLane({
      id: "advanced-human-operator",
      label: "Human operator review",
      sourceFamily: "Manual review / custom scope / private delivery",
      tier: ["advanced"],
      priority: "manual",
      envKeys: [],
      state: "blocked",
      timeoutMs: 0,
      freshnessTarget: "after receipt + scope confirmation",
      claimBoundary: "Advanced starts only after paid receipt/scope; no private data leaks into public Basic.",
      givesBasic: t(locale, "niedostępne", "nicht verfuegbar", "unavailable"),
      givesPro: t(locale, "nie wymagane do testowego PDF", "nicht fuer Test PDF erforderlich", "not required for test PDF"),
      givesAdvanced: t(locale, "operator notes, custom scope, private delivery, versioned re-check", "Operator Notes, Custom Scope, Private Delivery, Versioned Re-check", "operator notes, custom scope, private delivery, versioned re-check"),
      missingFallback: t(locale, "Bez receipt/scope nie pokazuj jako uruchomione.", "Ohne Receipt/Scope nicht als gestartet anzeigen.", "Without receipt/scope, do not show as started."),
    }),
  ];

  const readyProviders = providerMatrix.filter((lane) => lane.state === "ready").length;
  const needsKeyProviders = providerMatrix.filter((lane) => lane.state === "needs_key").length;
  const plannedProviders = providerMatrix.filter((lane) => lane.state === "planned").length;
  const blockedProviders = providerMatrix.filter((lane) => lane.state === "blocked").length;

  return {
    passId: PASS2571_AUDIT_PROVIDER_INTELLIGENCE_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target,
    rule: t(
      locale,
      "Velmère nie udaje pełnej wiedzy: każdy provider ma lane, timeout, fallback i granicę claimu.",
      "Velmère taeuscht keine volle Gewissheit vor: jeder Provider hat Lane, Timeout, Fallback und Claim Boundary.",
      "Velmère does not pretend full knowledge: every provider has a lane, timeout, fallback and claim boundary.",
    ),
    internetScope: t(
      locale,
      "Bierzemy szeroki internetowy kontekst, ale tylko z kontrolowanych providerów, no-store runtime i missing-evidence zamiast halucynacji.",
      "Wir nutzen breiten Internet-Kontext, aber nur ueber kontrollierte Provider, No-store Runtime und Missing-Evidence statt Halluzination.",
      "We use broad internet context, but only through controlled providers, no-store runtime and missing-evidence instead of hallucination.",
    ),
    tierBudgets: {
      basic: {
        maxLanes: 6,
        output: t(locale, "publiczny mini-raport na stronie", "oeffentlicher Mini-Report auf der Seite", "public mini-report on page"),
        gate: t(locale, "darmowy / bez konta", "kostenlos / ohne Konto", "free / no account"),
      },
      pro: {
        maxLanes: 14,
        output: t(locale, "PDF + source quorum + permissions/liquidity/holders", "PDF + Source Quorum + Permissions/Liquidity/Holders", "PDF + source quorum + permissions/liquidity/holders"),
        gate: t(locale, "na razie free QA, później płatny", "jetzt free QA, spaeter bezahlt", "free QA now, paid later"),
      },
      advanced: {
        maxLanes: 20,
        output: t(locale, "manual review + prywatny raport + re-check", "Manual Review + Private Report + Re-check", "manual review + private report + re-check"),
        gate: t(locale, "po receipt i scope", "nach Receipt und Scope", "after receipt and scope"),
      },
    },
    sourceFamilies: Array.from(new Set(providerMatrix.map((lane) => lane.sourceFamily))),
    providerMatrix,
    runtimePlan: [
      { step: 1, label: "Input normalization", action: t(locale, "contract/url/project -> normalized target", "Contract/URL/Projekt -> normalized target", "contract/url/project -> normalized target"), boundary: "redact unsafe input" },
      { step: 2, label: "Provider fan-out", action: t(locale, "odpal kontrolowane adaptery z timeoutem", "kontrollierte Adapter mit Timeout starten", "run controlled adapters with timeout"), boundary: "no long blocking request" },
      { step: 3, label: "Source quorum", action: t(locale, "confirmed/partial/missing/blocking", "confirmed/partial/missing/blocking", "confirmed/partial/missing/blocking"), boundary: "no claim without source" },
      { step: 4, label: "Risk score", action: t(locale, "score zależy od coverage + flag + braków", "Score haengt von Coverage + Flags + Luecken ab", "score depends on coverage + flags + gaps"), boundary: "no guarantee" },
      { step: 5, label: "Basic / Pro / Advanced output", action: t(locale, "Basic page, Pro PDF, Advanced manual", "Basic Seite, Pro PDF, Advanced Manual", "Basic page, Pro PDF, Advanced manual"), boundary: "no private data on public Basic" },
    ],
    basicSurfaceRows: providerMatrix
      .filter((lane) => lane.tier.includes("basic"))
      .slice(0, 8)
      .map((lane) => ({ label: lane.label, source: lane.sourceFamily, output: lane.givesBasic })),
    proPdfRows: providerMatrix
      .filter((lane) => lane.tier.includes("pro"))
      .slice(0, 12)
      .map((lane) => ({ label: lane.label, source: lane.sourceFamily, output: lane.givesPro })),
    advancedRows: providerMatrix
      .filter((lane) => lane.tier.includes("advanced"))
      .slice(0, 12)
      .map((lane) => ({ label: lane.label, source: lane.sourceFamily, output: lane.givesAdvanced })),
    readiness: {
      readyProviders,
      needsKeyProviders,
      plannedProviders,
      blockedProviders,
      liveCoverageLabel: `${readyProviders} ready / ${needsKeyProviders} key-needed / ${plannedProviders} planned / ${blockedProviders} blocked`,
    },
    nextImplementationBacklog: [
      "PASS2572: server-only provider client with timeout/circuit breaker helpers.",
      "PASS2573: Etherscan/Blockscout source adapter and ABI/source parser seed.",
      "PASS2574: DEX liquidity + market metadata adapters with second-source arbitration.",
      "PASS2575: security flags adapter and customer-safe flag normalizer.",
      "PASS2576: Pro PDF multi-page sections with provider evidence tables.",
      "PASS2577: Advanced manual review scope/receipt/private delivery split.",
    ],
  };
}
