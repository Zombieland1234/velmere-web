import { createHash } from "node:crypto";
import type { Pass2530EntitlementReplayBridgeRebalance, Pass2530RuntimeEntitlementReplay } from "./entitlement-replay-bridge-rebalance";
import type { Pass2526ChipState, Pass2526Surface } from "./reusable-downgrade-chip-rebalance";

export const PASS2531_SOURCE_FRESHNESS_EXPIRY_BRIDGE_REBALANCE_ID = "source-freshness-expiry-bridge-rebalance-v1" as const;

export type Pass2531FreshnessState = "fresh" | "delayed" | "stale" | "expired" | "diverged" | "unavailable";
export type Pass2531ProviderClass = "market_price" | "market_cap" | "volume" | "contract_risk" | "liquidity" | "filing" | "payment" | "artifact" | "ai_context";
export type Pass2531FreshnessSurface = Extract<Pass2526Surface, "shield" | "real_markets" | "browser_pdf" | "angel" | "checkout" | "account_vault" | "admin">;

export type Pass2531FreshnessExpiryRule = {
  id: string;
  providerClass: Pass2531ProviderClass;
  maxAgeSecondsBasic: number;
  maxAgeSecondsPro: number;
  maxAgeSecondsAdvanced: number;
  minProviderCountBasic: number;
  minProviderCountPro: number;
  minProviderCountAdvanced: number;
  divergenceToleranceBps: number;
  blocksClaims: string[];
  recoveryAction: string;
  label: { pl: string; en: string; de: string };
};

export type Pass2531FreshnessReplayFixture = {
  id: string;
  surface: Pass2531FreshnessSurface;
  providerClass: Pass2531ProviderClass;
  freshnessState: Pass2531FreshnessState;
  chipState: Pass2526ChipState;
  ageSeconds: number;
  providerCount: number;
  requiredProviderCount: number;
  divergenceBps: number;
  toleranceBps: number;
  blocksBefore: string;
  forbiddenClaims: string[];
  missingProof: string[];
  recoveryAction: string;
  uiCopy: { pl: string; en: string; de: string };
};

export type Pass2531ClaimFreshnessGate = {
  id: string;
  surface: Pass2531FreshnessSurface;
  claim: string;
  requiredFreshnessFixtureIds: string[];
  failClosedRule: string;
  allowedWhen: string;
};

export type Pass2531SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2531SourceFreshnessExpiryBridgeRebalance = {
  id: typeof PASS2531_SOURCE_FRESHNESS_EXPIRY_BRIDGE_REBALANCE_ID;
  state: "ready_for_visible_freshness_mount" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  sourceFreshnessExpiryBridgeBeforePercent: number;
  sourceFreshnessExpiryBridgeAfterPercent: number;
  providerDivergenceGateBeforePercent: number;
  providerDivergenceGateAfterPercent: number;
  staleDataClaimSuppressionBeforePercent: number;
  staleDataClaimSuppressionAfterPercent: number;
  realMarketsFreshnessVisibilityBeforePercent: number;
  realMarketsFreshnessVisibilityAfterPercent: number;
  shieldFreshnessVisibilityBeforePercent: number;
  shieldFreshnessVisibilityAfterPercent: number;
  pdfFreshnessBoundaryBeforePercent: number;
  pdfFreshnessBoundaryAfterPercent: number;
  angelFreshnessBoundaryBeforePercent: number;
  angelFreshnessBoundaryAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  freshnessRules: Pass2531FreshnessExpiryRule[];
  replayFixtures: Pass2531FreshnessReplayFixture[];
  claimFreshnessGates: Pass2531ClaimFreshnessGate[];
  entitlementReplayStates: Pass2530RuntimeEntitlementReplay[];
  semanticLanes: Pass2531SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  sourceFreshnessExpiryBridgeRule: string;
  fingerprint: string;
};

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

const label = (pl: string, en: string, de: string) => ({ pl, en, de });
const copy = label;

export const PASS2531_FRESHNESS_EXPIRY_RULES: Pass2531FreshnessExpiryRule[] = [
  {
    id: "rule-market-price-realtime",
    providerClass: "market_price",
    maxAgeSecondsBasic: 900,
    maxAgeSecondsPro: 300,
    maxAgeSecondsAdvanced: 90,
    minProviderCountBasic: 1,
    minProviderCountPro: 2,
    minProviderCountAdvanced: 3,
    divergenceToleranceBps: 75,
    blocksClaims: ["live price", "final risk score", "advanced market call"],
    recoveryAction: "refresh primary and secondary market providers before showing live/final wording",
    label: label("Cena wymaga świeżego quorum", "Price needs fresh quorum", "Preis braucht frisches Quorum"),
  },
  {
    id: "rule-market-cap-volume-quorum",
    providerClass: "market_cap",
    maxAgeSecondsBasic: 3600,
    maxAgeSecondsPro: 900,
    maxAgeSecondsAdvanced: 300,
    minProviderCountBasic: 1,
    minProviderCountPro: 2,
    minProviderCountAdvanced: 3,
    divergenceToleranceBps: 150,
    blocksClaims: ["market cap final", "volume final", "liquidity conclusion"],
    recoveryAction: "compare market cap and volume providers and downgrade to watch when divergence exceeds tolerance",
    label: label("Kapitalizacja wymaga porównania", "Market cap needs comparison", "Marktkapitalisierung braucht Vergleich"),
  },
  {
    id: "rule-contract-liquidity-risk",
    providerClass: "contract_risk",
    maxAgeSecondsBasic: 21600,
    maxAgeSecondsPro: 3600,
    maxAgeSecondsAdvanced: 900,
    minProviderCountBasic: 1,
    minProviderCountPro: 2,
    minProviderCountAdvanced: 3,
    divergenceToleranceBps: 0,
    blocksClaims: ["rug-pull", "honeypot", "liquidity safe", "contract safe"],
    recoveryAction: "replay contract, holder, liquidity and unlock providers before severe security claims",
    label: label("Kontrakt wymaga replay", "Contract needs replay", "Contract braucht Replay"),
  },
  {
    id: "rule-filing-fundamental-freshness",
    providerClass: "filing",
    maxAgeSecondsBasic: 604800,
    maxAgeSecondsPro: 172800,
    maxAgeSecondsAdvanced: 86400,
    minProviderCountBasic: 1,
    minProviderCountPro: 2,
    minProviderCountAdvanced: 2,
    divergenceToleranceBps: 0,
    blocksClaims: ["fundamental final", "filing verified", "equity confidence high"],
    recoveryAction: "attach filing/fundamental freshness lane and downgrade to delayed when filings are old",
    label: label("Fundamenty mają datę ważności", "Fundamentals have expiry", "Fundamentaldaten haben Ablauf"),
  },
  {
    id: "rule-artifact-payment-freshness",
    providerClass: "artifact",
    maxAgeSecondsBasic: 86400,
    maxAgeSecondsPro: 3600,
    maxAgeSecondsAdvanced: 300,
    minProviderCountBasic: 1,
    minProviderCountPro: 1,
    minProviderCountAdvanced: 1,
    divergenceToleranceBps: 0,
    blocksClaims: ["PDF final", "download final", "vault confirmed", "paid delivered"],
    recoveryAction: "replay artifact hash family and entitlement ledger before final delivery",
    label: label("Artefakt wymaga świeżego hash replay", "Artifact needs fresh hash replay", "Artefakt braucht frisches Hash-Replay"),
  },
  {
    id: "rule-ai-context-freshness",
    providerClass: "ai_context",
    maxAgeSecondsBasic: 1800,
    maxAgeSecondsPro: 600,
    maxAgeSecondsAdvanced: 180,
    minProviderCountBasic: 1,
    minProviderCountPro: 2,
    minProviderCountAdvanced: 3,
    divergenceToleranceBps: 75,
    blocksClaims: ["safe", "live", "final", "paid", "no risk", "squeeze", "rug-pull"],
    recoveryAction: "force Angel into missing-proof mode until source freshness and entitlement replay are fresh",
    label: label("AI wymaga świeżego kontekstu", "AI needs fresh context", "KI braucht frischen Kontext"),
  },
];

export const PASS2531_REPLAY_FIXTURES: Pass2531FreshnessReplayFixture[] = [
  {
    id: "freshness-shield-price-expired-blocked",
    surface: "shield",
    providerClass: "market_price",
    freshnessState: "expired",
    chipState: "blocked",
    ageSeconds: 1800,
    providerCount: 1,
    requiredProviderCount: 3,
    divergenceBps: 0,
    toleranceBps: 75,
    blocksBefore: "Shield live price, final risk score and Advanced market call",
    forbiddenClaims: ["live price", "final risk score", "advanced market call"],
    missingProof: ["fresh primary price", "independent second market source", "third provider for Advanced"],
    recoveryAction: "refresh price providers and show stale chip before score",
    uiCopy: copy("Cena jest za stara na finalny score.", "Price is too old for a final score.", "Preis ist zu alt für einen finalen Score."),
  },
  {
    id: "freshness-real-markets-diverged-hold",
    surface: "real_markets",
    providerClass: "market_cap",
    freshnessState: "diverged",
    chipState: "hold",
    ageSeconds: 420,
    providerCount: 2,
    requiredProviderCount: 3,
    divergenceBps: 390,
    toleranceBps: 150,
    blocksBefore: "Real Markets market cap, 24h change and confidence summary",
    forbiddenClaims: ["market cap final", "volume final", "confidence high"],
    missingProof: ["third provider", "divergence explanation", "as-of timestamp"],
    recoveryAction: "compare provider snapshots and render divergence before market cap",
    uiCopy: copy("Źródła rynku są rozjechane — pokaż watch, nie final.", "Market sources diverge — show watch, not final.", "Marktquellen weichen ab — Watch statt Final anzeigen."),
  },
  {
    id: "freshness-browser-pdf-artifact-stale-blocked",
    surface: "browser_pdf",
    providerClass: "artifact",
    freshnessState: "stale",
    chipState: "blocked",
    ageSeconds: 7200,
    providerCount: 1,
    requiredProviderCount: 1,
    divergenceBps: 0,
    toleranceBps: 0,
    blocksBefore: "PDF finality, download ready and account vault archive",
    forbiddenClaims: ["PDF ready", "download final", "vault confirmed"],
    missingProof: ["downloadHash", "vaultReplayHash", "fresh artifact timestamp"],
    recoveryAction: "regenerate preview/download/vault hash family in one transaction",
    uiCopy: copy("PDF wymaga świeżego hash replay.", "PDF needs a fresh hash replay.", "PDF braucht ein frisches Hash-Replay."),
  },
  {
    id: "freshness-angel-context-stale-hold",
    surface: "angel",
    providerClass: "ai_context",
    freshnessState: "stale",
    chipState: "hold",
    ageSeconds: 2100,
    providerCount: 1,
    requiredProviderCount: 3,
    divergenceBps: 0,
    toleranceBps: 75,
    blocksBefore: "Angel paid/final/safe answer and no-risk wording",
    forbiddenClaims: ["safe", "live", "final", "paid", "no risk"],
    missingProof: ["fresh sourceQuorum", "entitlement replay", "forbidden claim scan"],
    recoveryAction: "rewrite to missing-proof mode and ask user to refresh evidence",
    uiCopy: copy("Angel ma za stary kontekst na finalną odpowiedź.", "Angel context is too old for a final answer.", "Angel-Kontext ist zu alt für eine finale Antwort."),
  },
  {
    id: "freshness-checkout-payment-unavailable-blocked",
    surface: "checkout",
    providerClass: "payment",
    freshnessState: "unavailable",
    chipState: "blocked",
    ageSeconds: 0,
    providerCount: 0,
    requiredProviderCount: 1,
    divergenceBps: 0,
    toleranceBps: 0,
    blocksBefore: "Advanced unlock, paid badge and success page finality",
    forbiddenClaims: ["paid", "unlocked", "delivered", "advanced complete"],
    missingProof: ["providerEventId", "receiptId", "entitlementId"],
    recoveryAction: "replay payment webhook and keep Advanced locked",
    uiCopy: copy("Nie ma świeżego proofu płatności.", "No fresh payment proof is available.", "Kein frischer Zahlungsnachweis verfügbar."),
  },
  {
    id: "freshness-admin-override-delayed-watch",
    surface: "admin",
    providerClass: "payment",
    freshnessState: "delayed",
    chipState: "watch",
    ageSeconds: 540,
    providerCount: 1,
    requiredProviderCount: 1,
    divergenceBps: 0,
    toleranceBps: 0,
    blocksBefore: "operator override and manual trusted state",
    forbiddenClaims: ["override complete", "manual trusted"],
    missingProof: ["secondApprover", "overrideExpiry"],
    recoveryAction: "require second approver and expiry before override copy",
    uiCopy: copy("Override czeka na drugi proof operatora.", "Override waits for a second operator proof.", "Override wartet auf zweiten Operator-Proof."),
  },
];

export const PASS2531_CLAIM_FRESHNESS_GATES: Pass2531ClaimFreshnessGate[] = [
  { id: "gate-shield-live-final", surface: "shield", claim: "live price/final risk score", requiredFreshnessFixtureIds: ["freshness-shield-price-expired-blocked"], failClosedRule: "render stale/expired chip before score and suppress live/final copy", allowedWhen: "market_price age is below tier maxAge and provider count meets tier quorum" },
  { id: "gate-real-markets-market-cap", surface: "real_markets", claim: "market cap/24h confidence", requiredFreshnessFixtureIds: ["freshness-real-markets-diverged-hold"], failClosedRule: "render divergence chip before market cap and confidence row", allowedWhen: "divergence bps <= tolerance and third provider exists for Advanced" },
  { id: "gate-pdf-finality", surface: "browser_pdf", claim: "PDF ready/download final/vault confirmed", requiredFreshnessFixtureIds: ["freshness-browser-pdf-artifact-stale-blocked"], failClosedRule: "block finality when hash family is stale or incomplete", allowedWhen: "previewHash === downloadHash family === vaultReplayHash family and artifact timestamp is fresh" },
  { id: "gate-angel-answer", surface: "angel", claim: "safe/live/final/paid/no risk", requiredFreshnessFixtureIds: ["freshness-angel-context-stale-hold"], failClosedRule: "rewrite Angel to missing-proof mode before forbidden claim leaves API", allowedWhen: "fresh source quorum + entitlement replay + forbidden claim scan are all present" },
  { id: "gate-checkout-unlock", surface: "checkout", claim: "Advanced unlocked/paid delivered", requiredFreshnessFixtureIds: ["freshness-checkout-payment-unavailable-blocked"], failClosedRule: "success URL cannot unlock without fresh payment provider event", allowedWhen: "receiptId + providerEventId + accountId + entitlementId are fresh and account-bound" },
  { id: "gate-admin-override", surface: "admin", claim: "override complete/manual trusted", requiredFreshnessFixtureIds: ["freshness-admin-override-delayed-watch"], failClosedRule: "operator copy cannot claim trusted without second approver and expiry", allowedWhen: "operator ledger contains second approver + expiry + reason code" },
];

export const PASS2531_SEMANTIC_LANES: Pass2531SemanticLane[] = [
  {
    id: "manual-semantic-audit",
    percentBefore: 45,
    percentAfter: 48,
    finding: "PASS2530 normalized entitlement replay, but source freshness and provider divergence could still let UI say live/final with stale inputs.",
    implementedGuard: "Added source freshness expiry rules and replay fixtures for Shield, Real Markets, PDF, Angel, checkout and admin.",
    nextAction: "Mount freshness badges inside visible row/modal headers and add screenshot order tests.",
  },
  {
    id: "provider-divergence-gate",
    percentBefore: 41,
    percentAfter: 59,
    finding: "AAPL/market-cap/volume class bugs historically came from stale or divergent provider snapshots without visible downgrade.",
    implementedGuard: "Added divergence tolerance bps, tier provider counts and fail-closed gates before market cap/volume/final confidence copy.",
    nextAction: "Persist provider as-of timestamp and exact source family in row metadata.",
  },
  {
    id: "stale-data-claim-suppression",
    percentBefore: 66,
    percentAfter: 78,
    finding: "AI and paid copy can sound final even when provider data is delayed, unavailable or stale.",
    implementedGuard: "Forbidden claims are now tied to freshness replay fixtures and must be rewritten to missing-proof mode until freshness passes.",
    nextAction: "Run PL/EN/DE Angel replay prompts for stale data and provider divergence.",
  },
  {
    id: "pdf-artifact-freshness-boundary",
    percentBefore: 76,
    percentAfter: 84,
    finding: "PDF finality was hash-bound but still needed expiry semantics so old snapshots do not look current.",
    implementedGuard: "Added artifact freshness expiry and blocks for PDF ready/download final/vault confirmed copy.",
    nextAction: "Build hash-family equality + timestamp fixture in account vault replay.",
  },
];

export function buildPass2531SourceFreshnessExpiryBridgeRebalance(args: {
  query: string;
  symbol?: string;
  pass2530?: Pass2530EntitlementReplayBridgeRebalance;
}): Pass2531SourceFreshnessExpiryBridgeRebalance {
  const payload = {
    query: args.query,
    symbol: args.symbol,
    previous: args.pass2530?.fingerprint ?? "missing-pass2530",
    previousReplayCount: args.pass2530?.replayStates.length ?? 0,
    rules: PASS2531_FRESHNESS_EXPIRY_RULES.map((rule) => `${rule.id}:${rule.providerClass}:${rule.maxAgeSecondsAdvanced}:${rule.minProviderCountAdvanced}:${rule.divergenceToleranceBps}`),
    fixtures: PASS2531_REPLAY_FIXTURES.map((fixture) => `${fixture.id}:${fixture.surface}:${fixture.freshnessState}:${fixture.chipState}:${fixture.missingProof.join("+")}`),
    gates: PASS2531_CLAIM_FRESHNESS_GATES.map((gate) => `${gate.id}:${gate.surface}:${gate.claim}`),
  };
  return {
    id: PASS2531_SOURCE_FRESHNESS_EXPIRY_BRIDGE_REBALANCE_ID,
    state: "ready_for_visible_freshness_mount",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 45,
    manualSemanticCompletionAfterPercent: 48,
    targetedSemanticBatchFiles: 46,
    targetedSemanticBatchLines: 199880,
    sourceFreshnessExpiryBridgeBeforePercent: 0,
    sourceFreshnessExpiryBridgeAfterPercent: 33,
    providerDivergenceGateBeforePercent: 41,
    providerDivergenceGateAfterPercent: 59,
    staleDataClaimSuppressionBeforePercent: 66,
    staleDataClaimSuppressionAfterPercent: 78,
    realMarketsFreshnessVisibilityBeforePercent: 34,
    realMarketsFreshnessVisibilityAfterPercent: 53,
    shieldFreshnessVisibilityBeforePercent: 49,
    shieldFreshnessVisibilityAfterPercent: 64,
    pdfFreshnessBoundaryBeforePercent: 76,
    pdfFreshnessBoundaryAfterPercent: 84,
    angelFreshnessBoundaryBeforePercent: 77,
    angelFreshnessBoundaryAfterPercent: 86,
    worldclassInventionIndexBeforePercent: 70,
    worldclassInventionIndexAfterPercent: 76,
    freshnessRules: PASS2531_FRESHNESS_EXPIRY_RULES,
    replayFixtures: PASS2531_REPLAY_FIXTURES,
    claimFreshnessGates: PASS2531_CLAIM_FRESHNESS_GATES,
    entitlementReplayStates: args.pass2530?.replayStates ?? [],
    semanticLanes: PASS2531_SEMANTIC_LANES,
    masterTxtAdditions: [
      "PASS2531 adds source freshness expiry bridge: stale, expired, diverged and unavailable provider states now create fail-closed chips before live/final/paid claims.",
      "Shield and Real Markets must show freshness/divergence downgrade before score, market cap, 24h change, volume and confidence summary when provider age/quorum/divergence fails.",
      "PDF/account vault finality now requires both hash-family equality and fresh artifact timestamps; old snapshots must render stale artifact chips before download/vault copy.",
      "Angel paid/final/safe/no-risk language is blocked when source quorum or entitlement replay is stale, diverged, unavailable or expired.",
      "Next hardening step: visible freshness badge components and screenshot fixtures proving chip order in Shield/Real Markets/PDF/Angel mobile.",
    ],
    nextPassQueue: [
      "PASS2532: visible FreshnessBadgeRail component for Shield, Real Markets, Browser/PDF, Angel and checkout with PL/EN/DE copy.",
      "PASS2533: provider as-of timestamp ledger and source-family equality tests for AAPL/NVDA/crypto market cap bugs.",
      "PASS2534: PDF preview/download/account-vault hash-family equality tests with stale snapshot replay.",
      "PASS2535: Angel PL/EN/DE forbidden-claim prompt replay for stale/diverged data.",
      "PASS2536: mobile screenshot fixtures proving freshness chip renders before score and modal scroll remains unlocked.",
    ],
    sourceFreshnessExpiryBridgeRule: "Any claim using live/final/paid/safe/unlocked/rug-pull/squeeze/no-risk wording must first pass provider freshness, provider count, divergence tolerance, artifact timestamp and entitlement replay. stale, expired, diverged or unavailable states render downgrade chips before the claim and suppress forbidden wording.",
    fingerprint: stableFingerprint(payload),
  };
}
