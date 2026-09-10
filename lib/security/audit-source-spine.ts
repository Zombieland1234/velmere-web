export const PASS2569_AUDIT_SOURCE_SPINE_ID = "audit-source-spine";

export type Pass2569AuditTier = "basic" | "pro" | "advanced";
export type Pass2569SourceLaneStatus =
  | "basic_ready"
  | "pro_deep"
  | "advanced_manual"
  | "optional_internal_qa"
  | "missing_allowed"
  | "adapter_planned"
  | "blocked_without_consent";

export type Pass2569SourceLane = {
  id: string;
  label: string;
  tier: Pass2569AuditTier[];
  status: Pass2569SourceLaneStatus;
  sourceFamily: string;
  adapterTarget: string;
  basicOutput: string;
  proOutput: string;
  advancedOutput: string;
  claimRule: string;
  missingRule: string;
  noGo: string[];
};

export type Pass2569AuditSourceSpine = {
  passId: typeof PASS2569_AUDIT_SOURCE_SPINE_ID;
  generatedAt: string;
  locale: string;
  productRule: string;
  sourceQuorumRule: string;
  tiers: Record<Pass2569AuditTier, string[]>;
  lanes: Pass2569SourceLane[];
  scoringInputs: string[];
  safetyBoundaries: string[];
  nextImplementationQueue: string[];
};

function localize(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

export function buildPass2569AuditSourceSpine(locale = "en"): Pass2569AuditSourceSpine {
  const lanes: Pass2569SourceLane[] = [
    {
      id: "explorer-source-code",
      label: localize(locale, "Explorer / kod źródłowy", "Explorer / Quellcode", "Explorer / source code"),
      tier: ["basic", "pro", "advanced"],
      status: "basic_ready",
      sourceFamily: "Etherscan V2 + chain explorers + Blockscout fallback",
      adapterTarget: "contract source, ABI, verification status, compiler, proxy markers, creator tx",
      basicOutput: localize(locale, "Zweryfikowany / niezweryfikowany / brak danych", "Verifiziert / nicht verifiziert / fehlt", "Verified / unverified / missing"),
      proOutput: localize(locale, "ABI/source parser + permission map", "ABI/Source Parser + Permission Map", "ABI/source parser + permission map"),
      advancedOutput: localize(locale, "Automatyczne porównanie source/bytecode/proxy — bez human review", "Automatischer Source/Bytecode/Proxy-Vergleich — ohne Human Review", "Automated source/bytecode/proxy comparison — no human review included"),
      claimRule: "Never claim source is verified without explorer/source confirmation.",
      missingRule: "If source is not available, show confidence cap and no source-level certainty.",
      noGo: ["no fake verified badge", "no source certainty from UI only"],
    },
    {
      id: "token-market-metadata",
      label: localize(locale, "Token metadata / market data", "Token Metadata / Market Data", "Token metadata / market data"),
      tier: ["basic", "pro", "advanced"],
      status: "basic_ready",
      sourceFamily: "CoinGecko + market metadata fallback",
      adapterTarget: "name, symbol, image, links, market cap, supply, volume, categories",
      basicOutput: localize(locale, "Nazwa, symbol, obraz, podstawowe market dane", "Name, Symbol, Bild, Basis-Market-Daten", "Name, symbol, image and basic market data"),
      proOutput: localize(locale, "Cross-check supply/market/links", "Cross-check Supply/Market/Links", "Supply, market and links cross-check"),
      advancedOutput: localize(locale, "Automatyczna kontrola zgodności projektu i kontraktu — bez human review", "Automatischer Projekt/Contract-Abgleich — ohne Human Review", "Automated project and contract consistency checks — no human review included"),
      claimRule: "Metadata does not prove safety; it only supports identity and market presence.",
      missingRule: "If token not found, keep result as unknown rather than inventing metadata.",
      noGo: ["no safety claim from listing", "no social hype scoring"],
    },
    {
      id: "dex-liquidity-pairs",
      label: localize(locale, "DEX liquidity / pairs", "DEX Liquidity / Pairs", "DEX liquidity / pairs"),
      tier: ["basic", "pro", "advanced"],
      status: "basic_ready",
      sourceFamily: "DEX Screener + DEX pair discovery + liquidity adapters",
      adapterTarget: "pairs, liquidity USD, volume, pair age, FDV, price changes, DEX venue",
      basicOutput: localize(locale, "Widoczność rynku i liquidity status", "Market-Sichtbarkeit und Liquidity Status", "Market visibility and liquidity status"),
      proOutput: localize(locale, "Liquidity depth, pair age, venue risk, exit-risk notes", "Liquidity Tiefe, Pair Age, Venue Risk", "Liquidity depth, pair age, venue risk and exit-risk notes"),
      advancedOutput: localize(locale, "Rozszerzone dowody pooli, locków i zmian liquidity — bez manual review", "Erweiterte Evidenz zu Pools, Locks und Liquidity — ohne Manual Review", "Expanded pool, lock and liquidity-change evidence — no manual review included"),
      claimRule: "Liquidity visibility is not the same as liquidity lock.",
      missingRule: "If liquidity lock is not confirmed, mark it missing even when liquidity exists.",
      noGo: ["no locked-liquidity claim without lock proof", "no rug-pull certainty from one pair"],
    },
    {
      id: "security-signal-apis",
      label: localize(locale, "Security signal APIs", "Security Signal APIs", "Security signal APIs"),
      tier: ["basic", "pro", "advanced"],
      status: "basic_ready",
      sourceFamily: "GoPlus + Honeypot-style passive checks + internal parser",
      adapterTarget: "honeypot-like warnings, tax, blacklist, owner flags, proxy flags, holder hints",
      basicOutput: localize(locale, "Szybkie flagi: tax/honeypot/blacklist/owner", "Quick Flags: Tax/Honeypot/Blacklist/Owner", "Quick flags: tax/honeypot/blacklist/owner"),
      proOutput: localize(locale, "Cross-source risk explanation + false-positive guard", "Cross-source Risk Explanation + False-positive Guard", "Cross-source risk explanation + false-positive guard"),
      advancedOutput: localize(locale, "Rozszerzona automatyczna mapa ryzyk i wyjątków — bez human review", "Erweiterte automatisierte Risiko- und Ausnahme-Evidenz — ohne Human Review", "Expanded automated risk and exception evidence — no human review included"),
      claimRule: "Security API flags are advisory; never output exploit instructions.",
      missingRule: "If provider fails, show unavailable and use internal parser only as partial evidence.",
      noGo: ["no exploit payloads", "no guaranteed-safe output"],
    },
    {
      id: "permissions-parser",
      label: localize(locale, "Owner / permissions parser", "Owner / Permission Parser", "Owner / permissions parser"),
      tier: ["basic", "pro", "advanced"],
      status: "pro_deep",
      sourceFamily: "ABI/source parser + OpenZeppelin-style role/access patterns",
      adapterTarget: "owner, roles, mint, burn, pause, blacklist, fees, tax, limits, upgradeability",
      basicOutput: localize(locale, "Basic widzi tylko główne flagi", "Basic sieht nur Haupt-Flags", "Basic shows only headline flags"),
      proOutput: localize(locale, "Pełna mapa permission risk", "Volle Permission Risk Map", "Full permission risk map"),
      advancedOutput: localize(locale, "Rozszerzone dowody uprawnień i edge-case — bez manualnej interpretacji", "Erweiterte Permission- und Edge-Case-Evidenz — ohne manuelle Interpretation", "Expanded permission and edge-case evidence — no manual interpretation included"),
      claimRule: "Permission risk must be tied to explicit ABI/source evidence.",
      missingRule: "If source/ABI is missing, show bytecode-limited review only.",
      noGo: ["no admin claim without function evidence"],
    },
    {
      id: "holders-supply-concentration",
      label: localize(locale, "Holders / supply concentration", "Holder / Supply Konzentration", "Holders / supply concentration"),
      tier: ["basic", "pro", "advanced"],
      status: "pro_deep",
      sourceFamily: "Explorer holders + DEX/token APIs + internal concentration equation",
      adapterTarget: "top holders, deployer relation, contract wallets, exchanges, burn wallets, concentration score",
      basicOutput: localize(locale, "Basic status: partial / missing / visible", "Basic Status: partial / fehlt / sichtbar", "Basic status: partial / missing / visible"),
      proOutput: localize(locale, "Top holder risk + concentration equation", "Top Holder Risk + Konzentrationsgleichung", "Top holder risk + concentration equation"),
      advancedOutput: localize(locale, "Rozszerzone relacje holderów z provenance etykiet — bez human review", "Erweiterte Holder-Beziehungen mit Label-Provenienz — ohne Human Review", "Expanded holder relationships with label provenance — no human review included"),
      claimRule: "Exchange/burn/contract wallets must be labelled before concentration penalty.",
      missingRule: "If holder API is unavailable, do not infer concentration from market cap.",
      noGo: ["no whale claim without holder data"],
    },
    {
      id: "defi-protocol-context",
      label: localize(locale, "DeFi / protocol context", "DeFi / Protocol Context", "DeFi / protocol context"),
      tier: ["pro", "advanced"],
      status: "pro_deep",
      sourceFamily: "DeFiLlama + protocol adapters",
      adapterTarget: "protocol identity, TVL, chain context, category, stablecoin/protocol presence",
      basicOutput: localize(locale, "Nie wymagane w Basic", "Nicht in Basic erforderlich", "Not required in Basic"),
      proOutput: localize(locale, "TVL/protocol context, not safety proof", "TVL/Protocol Context, kein Safety Proof", "TVL/protocol context, not safety proof"),
      advancedOutput: localize(locale, "Automatyczna kontrola zgodności protokołu, docs i kontraktu", "Automatischer Abgleich von Protocol, Docs und Contract", "Automated protocol, docs and contract consistency checks"),
      claimRule: "TVL is context only, never a proof of safety.",
      missingRule: "If no protocol match, keep it missing and do not penalize non-DeFi tokens too hard.",
      noGo: ["no safe because TVL", "no fake protocol match"],
    },
    {
      id: "docs-repo-audit-match",
      label: localize(locale, "Docs / repo / public audit matching", "Docs / Repo / Public Audit Matching", "Docs / repo / public audit matching"),
      tier: ["basic", "pro", "advanced"],
      status: "pro_deep",
      sourceFamily: "Submitted URLs + website links + GitHub/docs + public audit references",
      adapterTarget: "repo freshness, audit PDF match, scope match, docs contract address match",
      basicOutput: localize(locale, "Czy coś publicznego istnieje", "Ob etwas Öffentliches existiert", "Whether public evidence exists"),
      proOutput: localize(locale, "Czy dokumenty pasują do kontraktu i chaina", "Ob Docs zum Contract und Chain passen", "Whether docs match the contract and chain"),
      advancedOutput: localize(locale, "Automatyczny scope/freshness check — bez human review", "Automatischer Scope-/Freshness-Check — ohne Human Review", "Automated scope and freshness checks — no human review included"),
      claimRule: "Public audit only counts if it matches contract, chain and version/scope.",
      missingRule: "If audit link exists but does not match target, mark as mismatch, not found.",
      noGo: ["no audit-found claim from project homepage only"],
    },
    {
      id: "manual-human-review",
      label: localize(locale, "Opcjonalne wewnętrzne QA — nie jest częścią produktu", "Optionales internes QA — kein Produktbestandteil", "Optional internal QA — not a product requirement"),
      tier: ["advanced"],
      status: "optional_internal_qa",
      sourceFamily: "Optional internal QA only; zero customer feature credit",
      adapterTarget: "non-blocking internal quality observation only; never a customer entitlement, release gate or delivery prerequisite",
      basicOutput: localize(locale, "Nie zawiera human review", "Enthält kein Human Review", "No human review included"),
      proOutput: localize(locale, "Nie zawiera human review", "Enthält kein Human Review", "No human review included"),
      advancedOutput: localize(locale, "NOT_FOR_SALE — Advanced pozostaje automatyczny; opcjonalne QA nie blokuje wyniku", "NOT_FOR_SALE — Advanced bleibt automatisiert; optionales QA blockiert das Ergebnis nicht", "NOT_FOR_SALE — Advanced remains automated; optional QA never blocks the result"),
      claimRule: "No current SKU may claim manual QA, human review or operator sign-off; optional internal QA has zero customer feature credit.",
      missingRule: "Do not treat absence of optional human QA as missing product evidence or reduce product confidence because of it.",
      noGo: ["no fake analyst note", "no human-review claim", "no operator-signoff claim", "no private data leak"],
    },
  ];

  return {
    passId: PASS2569_AUDIT_SOURCE_SPINE_ID,
    generatedAt: "2026-06-23T00:00:00.000Z",
    locale,
    productRule: "Basic is a free limited prescreen; Pro is invitation-only automated beta; Advanced is NOT_FOR_SALE and includes no human review or operator sign-off.",
    sourceQuorumRule:
      "Every claim needs source lane + status + confidence + missing-evidence rule. Missing sources are shown, not hidden.",
    tiers: {
      basic: [
        "contract identity",
        "chain detection",
        "token metadata",
        "explorer/source status",
        "quick security flags",
        "basic DEX/liquidity visibility",
        "missing-evidence summary",
        "public verdict on page",
      ],
      pro: [
        "everything in Basic",
        "downloadable PDF",
        "permission map",
        "liquidity/holder review",
        "source matrix",
        "docs/repo/audit matching",
        "deeper risk notes",
        "Velmere conclusion",
      ],
      advanced: [
        "everything in Basic and Pro",
        "widest automated evidence scope",
        "version comparison",
        "conflict and missing-proof registers",
        "private delivery design only",
        "versioned report design",
        "re-check model",
        "NOT_FOR_SALE and no human review",
      ],
    },
    lanes,
    scoringInputs: [
      "source verification confidence",
      "permission risk",
      "liquidity visibility and lock proof",
      "holder concentration",
      "security API flags",
      "docs/repo/audit match",
      "market/protocol context",
      "missing-evidence penalty",
    ],
    safetyBoundaries: [
      "No seed phrase, no private key, no wallet custody.",
      "No exploit instructions or unauthorized active testing.",
      "No guaranteed safe claim.",
      "No fake source certainty.",
      "No investment advice.",
      "Future human review — currently unavailable",
      "No current SKU may claim manual QA, human review or operator sign-off",
    ],
    nextImplementationQueue: [
      "Implement live Etherscan/Blockscout adapter with environment keys.",
      "Implement CoinGecko token metadata adapter.",
      "Implement DEX Screener pair/liquidity adapter.",
      "Implement GoPlus/Honeypot passive security adapter.",
      "Implement source quorum engine and confidence equation.",
      "Expand Pro PDF from 1-page test PDF to multi-page report.",
      "Keep Advanced NOT_FOR_SALE until qualified reviewers, independent adjudication, signed review receipts and private-delivery operations are proven.",
    ],
  };
}

export function buildPass2569AuditSourceMatrix(locale = "en") {
  const spine = buildPass2569AuditSourceSpine(locale);
  return spine.lanes.map((lane) => ({
    id: lane.id,
    label: lane.label,
    status: lane.status,
    family: lane.sourceFamily,
    basic: lane.basicOutput,
    pro: lane.proOutput,
    advanced: lane.advancedOutput,
    rule: lane.claimRule,
  }));
}

export function pass2569ScoreConfidenceFromSourceStates(states: Array<"confirmed" | "partial" | "missing" | "failed">) {
  if (!states.length) return 32;
  const score = states.reduce((sum, state) => {
    if (state === "confirmed") return sum + 1;
    if (state === "partial") return sum + 0.55;
    if (state === "failed") return sum + 0.15;
    return sum;
  }, 0);
  return Math.max(18, Math.min(94, Math.round((score / states.length) * 100)));
}
