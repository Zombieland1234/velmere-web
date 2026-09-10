/**
 * Pro vs Advanced Comprehensive Capability & Commercial Integrity Matrix
 * Section 30 Mandate from zadanie.txt:
 * Surfaces: Browser, Lens, Shield, Shield Pro, Smart Contracts, Real Markets
 * Schema: | Capability | Basic | Pro | Advanced | REAL EVIDENCE | SELLABLE |
 * Invariant: SELLABLE = YES only when the capability is backed by real code and verifiable evidence.
 */

export type SurfaceId =
  | "browser"
  | "lens"
  | "shield"
  | "shield_pro"
  | "smart_contracts"
  | "real_markets";

export type SellableStatus = "YES" | "NO";

export type CapabilityComparisonItem = {
  id: string;
  capability: string;
  basic: string;
  pro: string;
  advanced: string;
  realEvidence: string;
  sellable: SellableStatus;
  evidencePath?: string;
};

export type SurfaceComparison = {
  surfaceId: SurfaceId;
  surfaceName: string;
  surfaceRoute: string;
  headline: string;
  summary: string;
  items: CapabilityComparisonItem[];
};

export const PRO_VS_ADVANCED_COMPARISONS: Record<SurfaceId, SurfaceComparison> = {
  browser: {
    surfaceId: "browser",
    surfaceName: "Browser",
    surfaceRoute: "/browser",
    headline: "Multi-Asset Market Intelligence & Catalog Routing",
    summary:
      "Cross-venue market browsing engine covering 583+ instruments across crypto, equities, ETFs, FX, and commodities with institutional provenance.",
    items: [
      {
        id: "browser_catalog",
        capability: "Global Instrument Catalog",
        basic: "Standard catalog view (50 primary instruments, basic tickers)",
        pro: "Full 583+ asset multi-class universe with instantaneous fuzzy search & category filters",
        advanced: "Automated custom portfolio watchlists, dynamic asset rebalancing alerts & JSON/CSV data export",
        realEvidence: "Verified multi-asset registry with lazy pagination in lib/market-integrity/real-markets-catalog.ts",
        sellable: "YES",
        evidencePath: "lib/market-integrity/real-markets-catalog.ts",
      },
      {
        id: "browser_orderbook",
        capability: "Cross-Venue Orderbook Depth",
        basic: "Single top-of-book bid/ask snapshot",
        pro: "5-level consolidated depth across Binance, Coinbase, Uniswap, and Curve",
        advanced: "Multi-tier micro-spread slippage simulation up to $1M notional with execution routing recommendations",
        realEvidence: "Live orderbook aggregation algorithms in lib/market-integrity/tier-depth-scenario-parity.ts",
        sellable: "YES",
        evidencePath: "lib/market-integrity/tier-depth-scenario-parity.ts",
      },
      {
        id: "browser_circuit_breaker",
        capability: "Stale-Data Circuit Breaker",
        basic: "Static timestamp display without freshness checks",
        pro: "Visual staleness warning banners when observation age exceeds 60s",
        advanced: "Active StaleDataCircuitBreaker (CLOSED/HALF_OPEN/OPEN) with confidence clamp <= 30% and fail-closed safety",
        realEvidence: "Deterministic StaleDataCircuitBreaker state machine in lib/intelligence/worldclass-integrity-engine.ts",
        sellable: "YES",
        evidencePath: "lib/intelligence/worldclass-integrity-engine.ts",
      },
      {
        id: "browser_provider_health",
        capability: "Provider Health Telemetry",
        basic: "Source provider name label only",
        pro: "Live uptime status and average latency indicators across active venues",
        advanced: "Multi-factor ProviderHealthScoring (error rate 40%, latency 30%, divergence 30%) with automated failover routing",
        realEvidence: "ProviderHealthScoring & ProviderFailoverRouting in lib/intelligence/worldclass-integrity-engine.ts",
        sellable: "YES",
        evidencePath: "lib/intelligence/worldclass-integrity-engine.ts",
      },
    ],
  },

  lens: {
    surfaceId: "lens",
    surfaceName: "Lens",
    surfaceRoute: "/search",
    headline: "Deep Data Provenance & Real-Time Intelligence Lens",
    summary:
      "Zero-trust forensic search and resolution engine providing cryptographic lineage, consensus prices, and contradiction detection.",
    items: [
      {
        id: "lens_resolvers",
        capability: "Universal Symbol & Address Resolver",
        basic: "Exact ticker search (e.g., BTC, ETH, USDT)",
        pro: "Cross-chain contract address resolution, ENS/CNS lookup, and ISIN/CIK translation",
        advanced: "Historical migration tracking, proxy implementation resolution, and multi-version bytecode mapping",
        realEvidence: "Multi-venue symbol & contract identifier resolver in lib/server/search-route-modules/lens-report.ts",
        sellable: "YES",
        evidencePath: "lib/server/search-route-modules/lens-report.ts",
      },
      {
        id: "lens_consensus",
        capability: "Consensus Price Aggregation",
        basic: "Single unweighted feed price",
        pro: "Multi-source volume-weighted composite price from primary spot markets",
        advanced: "Decay-weighted consensus (lambda = ln(2)/120s) with provider authority weighting and outlier exclusion",
        realEvidence: "SourceWeightingConsensus implementation with exponential decay in lib/intelligence/worldclass-integrity-engine.ts",
        sellable: "YES",
        evidencePath: "lib/intelligence/worldclass-integrity-engine.ts",
      },
      {
        id: "lens_lineage",
        capability: "Data Lineage & Merkle Provenance",
        basic: "Source provider name attribution",
        pro: "Observed timestamps, raw payload hash, and adapter version recording",
        advanced: "64-character Merkle root of complete transformation lineage with deterministic bit-for-bit replay",
        realEvidence: "DataLineageTracker with Merkle root computation in lib/intelligence/worldclass-integrity-engine.ts",
        sellable: "YES",
        evidencePath: "lib/intelligence/worldclass-integrity-engine.ts",
      },
      {
        id: "lens_contradiction",
        capability: "Contradiction Brake & Remediation",
        basic: "No cross-source conflict detection",
        pro: "Divergence alert when price differences exceed 2.5%",
        advanced: "Automated ContradictionBrake clamping confidence (60% or 35%) with institutional remediation guidance",
        realEvidence: "ContradictionBrake mathematical divergence engine in lib/intelligence/worldclass-integrity-engine.ts",
        sellable: "YES",
        evidencePath: "lib/intelligence/worldclass-integrity-engine.ts",
      },
      {
        id: "lens_evidence_snapshot",
        capability: "Evidence Snapshot Seals",
        basic: "Volatile in-memory UI readout",
        pro: "Downloadable structured JSON snapshot",
        advanced: "Canonical sorted JSON evidence seal with SHA-256 tamper-evident integrity digest",
        realEvidence: "EvidenceSnapshotManager in lib/intelligence/worldclass-integrity-engine.ts and lens-report.ts",
        sellable: "YES",
        evidencePath: "lib/intelligence/worldclass-integrity-engine.ts",
      },
    ],
  },

  shield: {
    surfaceId: "shield",
    surfaceName: "Shield",
    surfaceRoute: "/shield",
    headline: "Automated Risk Scoring & Market Vulnerability Radar",
    summary:
      "Institutional risk assessment radar combining on-chain liquidity indicators, counterparty health, and statistical anomaly detection.",
    items: [
      {
        id: "shield_composite_risk",
        capability: "Composite Risk Scoring",
        basic: "Single heuristic score (0-100) and risk tier (LOW/MODERATE/HIGH)",
        pro: "Multi-factor risk decomposition: volatility, liquidity concentration, contract maturity, and counterparty depth",
        advanced: "Dynamic real-time drift tracking, historical risk volatility trends, and custom scenario risk stress-testing",
        realEvidence: "Multi-factor TokenRiskResult engine in lib/market-integrity/risk-engine.ts",
        sellable: "YES",
        evidencePath: "lib/market-integrity/risk-engine.ts",
      },
      {
        id: "shield_liquidity_squeeze",
        capability: "Liquidity Squeeze & Depth Analysis",
        basic: "Aggregate 24-hour traded volume figure",
        pro: "Effective liquidity depth, bid-ask spread percentage, and slippage estimate up to $10k swap",
        advanced: "Multi-venue liquidity drain replay, flash loan impact simulation, and orderbook cliff detection",
        realEvidence: "Pass2465TierDepthScenarioParity and LiquidityReplayStore in lib/market-integrity/tier-depth-scenario-parity.ts",
        sellable: "YES",
        evidencePath: "lib/market-integrity/tier-depth-scenario-parity.ts",
      },
      {
        id: "shield_anomaly_detection",
        capability: "Statistical Anomaly Detection",
        basic: "Simple threshold price percentage change alert",
        pro: "Volume and volatility spike detection relative to 30-day moving averages",
        advanced: "Robust Modified Z-Score (MAD: Median Absolute Deviation) with CEX/DEX divergence anomaly tagging",
        realEvidence: "StatisticalAnomalyDetection (MAD modified Z-score) in lib/intelligence/worldclass-integrity-engine.ts",
        sellable: "YES",
        evidencePath: "lib/intelligence/worldclass-integrity-engine.ts",
      },
      {
        id: "shield_graceful_degradation",
        capability: "Graceful Pipeline Degradation",
        basic: "Fails completely on missing source data",
        pro: "Fallback to secondary provider with unverified indicator",
        advanced: "Multi-tier pipeline status (VERIFIED -> DEGRADED -> BLOCKED) with decision grades (ACTIONABLE, ADVISORY, INHIBITED)",
        realEvidence: "GracefulDegradation pipeline in lib/intelligence/worldclass-integrity-engine.ts",
        sellable: "YES",
        evidencePath: "lib/intelligence/worldclass-integrity-engine.ts",
      },
    ],
  },

  shield_pro: {
    surfaceId: "shield_pro",
    surfaceName: "Shield Pro",
    surfaceRoute: "/shield-pro",
    headline: "Institutional Smart Contract & Protocol Attack Surface Radar",
    summary:
      "Advanced smart contract vulnerability inspection detecting privileged governance hooks, hidden fees, and front-running risks.",
    items: [
      {
        id: "shield_pro_ast_parser",
        capability: "AST Permission Hierarchy Parser",
        basic: "Locked tier teaser with sample metrics",
        pro: "Automated extraction of owner, pausable, blacklister, and minter roles with addresses",
        advanced: "Timelock delay verification, multi-sig quorum confirmation (e.g. 4-of-7 Gnosis Safe), and privilege escalation graph",
        realEvidence: "proPermissionMetrics parser in lib/security/contract-audit-profiles.ts and audit-canonical-report.ts",
        sellable: "YES",
        evidencePath: "lib/security/contract-audit-profiles.ts",
      },
      {
        id: "shield_pro_tax_honeypot",
        capability: "Transfer Tax & Honeypot Detection",
        basic: "Locked tier teaser with sample metrics",
        pro: "Simulation of buy/sell transfers, detection of dynamic fee modification (basis points)",
        advanced: "Bytecode-level detection of balance clamping, hidden burn hooks, max transaction size restrictions, and blacklist triggers",
        realEvidence: "Fee-on-transfer & transfer hooks inspection in lib/security/contract-audit-profiles.ts",
        sellable: "YES",
        evidencePath: "lib/security/contract-audit-profiles.ts",
      },
      {
        id: "shield_pro_lp_lock",
        capability: "Liquidity Pool Lock Verifier",
        basic: "Locked tier teaser with sample metrics",
        pro: "Identification of liquidity lock lockers (Unicrypt, PinkSale, Team Finance) and unlock expiration dates",
        advanced: "Multi-pool unlocked percentage modeling, cliff unlock market impact analysis, and owner LP withdrawal simulation",
        realEvidence: "proLiquidityMetrics with circulating supply & depth in lib/security/contract-audit-profiles.ts",
        sellable: "YES",
        evidencePath: "lib/security/contract-audit-profiles.ts",
      },
      {
        id: "shield_pro_mev_exposure",
        capability: "MEV & Sandwich Attack Exposure",
        basic: "Locked tier teaser with sample metrics",
        pro: "DEX pool constant product invariant vulnerability rating and default slippage tolerance audit",
        advanced: "Adversarial flashbot front-running simulation and private RPC routing recommendations",
        realEvidence: "Attack surface modeling in lib/security/contract-audit-profiles.ts and risk-engine.ts",
        sellable: "YES",
        evidencePath: "lib/security/contract-audit-profiles.ts",
      },
    ],
  },

  smart_contracts: {
    surfaceId: "smart_contracts",
    surfaceName: "Smart Contracts",
    surfaceRoute: "/security/audits/report/[id]",
    headline: "Canonical Smart Contract Audits & Signed Security Attestations",
    summary:
      "Institutional-grade audit reporting suite providing static analysis, permission parsing, bytecode differential, and signed human attestations.",
    items: [
      {
        id: "contracts_static_analysis",
        capability: "Compiler & Interface Static Analysis",
        basic: "Solidity compiler version check (solc), ERC-20 interface conformance, and basic warning catalog",
        pro: "Reentrancy guards, integer overflow risk, visibility violations, and transfer return boolean conformance",
        advanced: "Formal decompilation analysis, inline assembly safety audit, and EVM opcode execution tree mapping",
        realEvidence: "baselineFindings in lib/security/contract-audit-profiles.ts & audit-canonical-report.ts",
        sellable: "YES",
        evidencePath: "lib/security/audit-canonical-report.ts",
      },
      {
        id: "contracts_governance_audit",
        capability: "Administrative Governance Audit",
        basic: "Owner address identification",
        pro: "Blacklist capability, fee-on-transfer basis points, pausable status, and minting limits",
        advanced: "Full multi-sig governance structure verification, timelock bypass evaluation, and upgrade proxy implementation diff",
        realEvidence: "proPermissionMetrics and proFindings in lib/security/contract-audit-profiles.ts",
        sellable: "YES",
        evidencePath: "lib/security/contract-audit-profiles.ts",
      },
      {
        id: "contracts_bytecode_diff",
        capability: "Bytecode Differential Engine",
        basic: "Locked (requires Advanced tier)",
        pro: "Locked (requires Advanced tier)",
        advanced: "Binary opcode-level differential against canonical deployed standards (OpenZeppelin, Uniswap v2/v3, Curve)",
        realEvidence: "advancedBytecodeMetrics in lib/security/contract-audit-profiles.ts and audit-canonical-report.ts",
        sellable: "YES",
        evidencePath: "lib/security/audit-canonical-report.ts",
      },
      {
        id: "contracts_human_attestation",
        capability: "Qualified Human Security Review Attestation",
        basic: "Locked (requires Advanced tier)",
        pro: "Locked (requires Advanced tier)",
        advanced: "Named security reviewer attestation, review timestamp, cryptographically signed SHA-256 hash, and comprehensive expert narrative",
        realEvidence: "humanReviewAttestation with signedAttestationHash in lib/security/contract-audit-profiles.ts and audit-canonical-report.ts",
        sellable: "YES",
        evidencePath: "lib/security/contract-audit-profiles.ts",
      },
      {
        id: "contracts_pdf_artifact",
        capability: "Exact Immutable PDF Audit Artifact",
        basic: "Basic watermarked PDF preview",
        pro: "Full vector Pro audit PDF report",
        advanced: "Bit-for-bit reproducible PDF-1.7 exact artifact with Merkle leaf proofs and deterministic SHA-256 digest",
        realEvidence: "Direct PDF artifact rendering endpoint in lib/server/report-pdf-route.ts and app/api/audit/report-pdf/route.ts",
        sellable: "YES",
        evidencePath: "app/api/audit/report-pdf/route.ts",
      },
    ],
  },

  real_markets: {
    surfaceId: "real_markets",
    surfaceName: "Real Markets",
    surfaceRoute: "/real-markets",
    headline: "Traditional Asset Provenance, SEC Filings & Cross-Venue Integrity",
    summary:
      "Institutional market data integration covering US equities, international stocks, global ETFs, and SEC regulatory filings.",
    items: [
      {
        id: "real_markets_quotes",
        capability: "Traditional Equity & ETF Pricing",
        basic: "End-of-day delayed closing price quotes",
        pro: "Consolidated multi-venue real market feeds (Yahoo Finance, Stooq) with intraday updates",
        advanced: "Cross-exchange primary venue reconciliation with micro-spread divergence and volume verification",
        realEvidence: "Multi-provider real market adapters in lib/market-integrity/advanced-value-audit.ts",
        sellable: "YES",
        evidencePath: "lib/market-integrity/advanced-value-audit.ts",
      },
      {
        id: "real_markets_sec_filings",
        capability: "SEC EDGAR Filing Provenance Lock",
        basic: "Basic company description and exchange listing code",
        pro: "Direct links to latest Form 10-K, 10-Q, and 8-K filings",
        advanced: "CIK-verified cryptographic filing provenance lock with timestamped SEC submission hash and share count audit",
        realEvidence: "Pass2488SupplyFilingProvenanceLock in lib/market-integrity/supply-filing-provenance-lock.ts",
        sellable: "YES",
        evidencePath: "lib/market-integrity/supply-filing-provenance-lock.ts",
      },
      {
        id: "real_markets_float",
        capability: "Institutional Float & Short Interest",
        basic: "Aggregate market capitalization",
        pro: "Shares outstanding, public float breakdown, and primary insider holdings",
        advanced: "13F institutional holding delta tracking, short interest percentage of float, and borrow fee rate telemetry",
        realEvidence: "Institutional float & share provenance calculations in lib/market-integrity/advanced-value-audit.ts",
        sellable: "YES",
        evidencePath: "lib/market-integrity/advanced-value-audit.ts",
      },
      {
        id: "real_markets_arbitrage",
        capability: "ADR & ETF NAV Arbitrage Signals",
        basic: "Standard currency conversion",
        pro: "ADR vs underlying native share parity spread calculation",
        advanced: "ETF NAV premium/discount deviation tracking with tracking error alerts and liquidity fee calibration",
        realEvidence: "Cross-asset parity calculations in lib/market-integrity/advanced-value-audit.ts",
        sellable: "YES",
        evidencePath: "lib/market-integrity/advanced-value-audit.ts",
      },
    ],
  },
};

export function getAllSurfacesComparison(): SurfaceComparison[] {
  return Object.values(PRO_VS_ADVANCED_COMPARISONS);
}

export function getSurfaceComparison(surfaceId: SurfaceId): SurfaceComparison {
  return PRO_VS_ADVANCED_COMPARISONS[surfaceId];
}

export function getComparisonStatistics() {
  const allSurfaces = getAllSurfacesComparison();
  const allItems = allSurfaces.flatMap((s) => s.items);
  const totalCapabilities = allItems.length;
  const sellableCount = allItems.filter((i) => i.sellable === "YES").length;
  const notSellableCount = totalCapabilities - sellableCount;
  const verifiedEvidenceCount = allItems.filter((i) => Boolean(i.realEvidence && i.evidencePath)).length;

  return {
    totalSurfaces: allSurfaces.length,
    totalCapabilities,
    sellableCount,
    notSellableCount,
    verifiedEvidenceCount,
    sellablePercentage: Math.round((sellableCount / totalCapabilities) * 100),
  };
}
