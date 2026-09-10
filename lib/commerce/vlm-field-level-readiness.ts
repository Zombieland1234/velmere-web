import type {
  VlmCommercialProductFamily,
} from "@/lib/commerce/vlm-commercial-readiness";
import type { VlmCurrentSkuTier } from "@/lib/commerce/vlm-current-sku-truth";

export const PASS36_R44P21_FIELD_LEVEL_READINESS_ID =
  "pass36-a102r44p21-field-level-modular-commercial-readiness" as const;

export type VlmFieldSourceClass =
  | "VELMERE_OWNED"
  | "PUBLIC_BLOCKCHAIN_DIRECT"
  | "VELMERE_DERIVED"
  | "USER_SUPPLIED"
  | "EXTERNAL_PROVIDER"
  | "PUBLIC_REGULATOR_DATA"
  | "MANUAL_REVIEW"
  | "SYNTHETIC_FIXTURE";

export type VlmFieldAvailabilityState =
  | "AVAILABLE_OWNED"
  | "AVAILABLE_PUBLIC_CHAIN"
  | "AVAILABLE_DERIVED"
  | "AVAILABLE_USER_SUPPLIED"
  | "AVAILABLE_PUBLIC_REGULATOR"
  | "AVAILABLE_RIGHTS_APPROVED_PROVIDER"
  | "AVAILABLE_MANUAL_REVIEW"
  | "BLOCKED_RIGHTS"
  | "BLOCKED_DATA"
  | "BLOCKED_CALIBRATION"
  | "BLOCKED_OPERATIONS"
  | "UNAVAILABLE"
  | "SYNTHETIC_ONLY";

export type VlmFieldAlternativeStrategy =
  | "DIRECT_CHAIN_QUERY"
  | "VELMERE_DERIVATION"
  | "PUBLIC_REGULATOR_API"
  | "USER_SUPPLIED_SIGNED_SNAPSHOT"
  | "RIGHTS_APPROVED_PROVIDER"
  | "CACHE_WITHIN_TERMS"
  | "MANUAL_VERIFICATION"
  | "HIDE_FIELD"
  | "NO_SAFE_SUBSTITUTE";

export type VlmFieldAlternative = Readonly<{
  strategy: VlmFieldAlternativeStrategy;
  zeroBudgetPossible: boolean;
  preservesRequiredSemantics: boolean;
  notes: string;
}>;

export type VlmFieldDefinitionScope = VlmCommercialProductFamily | "pdf-artifact";

export type VlmFieldDefinition = Readonly<{
  id: string;
  family: VlmFieldDefinitionScope;
  label: string;
  sourceClass: VlmFieldSourceClass;
  includedTiers: readonly VlmCurrentSkuTier[];
  requiredTiers: readonly VlmCurrentSkuTier[];
  criticalTiers: readonly VlmCurrentSkuTier[];
  valueWeight: number;
  canHideWhenUnavailable: boolean;
  coreDeliverable: boolean;
  alternative: VlmFieldAlternative;
}>;

export type VlmFieldEvidence = Readonly<{
  availability: VlmFieldAvailabilityState;
  evidenceId?: string | null;
  freshnessObservedAt?: string | null;
  alternativeReady?: boolean;
  notes?: string | null;
}>;

export type VlmFieldEvidenceById = Readonly<Record<string, VlmFieldEvidence | undefined>>;

export type VlmFieldEvaluation = Readonly<{
  fieldId: string;
  label: string;
  sourceClass: VlmFieldSourceClass;
  required: boolean;
  critical: boolean;
  valueWeight: number;
  availability: VlmFieldAvailabilityState;
  directlyReady: boolean;
  alternativeReady: boolean;
  effectiveReady: boolean;
  hidden: boolean;
  blocker: string | null;
  alternative: VlmFieldAlternative;
}>;

export type VlmFieldLevelReadiness = Readonly<{
  schemaVersion: typeof PASS36_R44P21_FIELD_LEVEL_READINESS_ID;
  family: VlmCommercialProductFamily;
  tier: VlmCurrentSkuTier;
  customerFacingTier: VlmCurrentSkuTier | null;
  standaloneProduct: boolean;
  fields: readonly VlmFieldEvaluation[];
  fieldCount: number;
  requiredFieldCount: number;
  criticalFieldCount: number;
  readyFieldCount: number;
  blockedFieldIds: readonly string[];
  hiddenFieldIds: readonly string[];
  blockers: readonly string[];
  fieldCompletionBps: number;
  criticalFieldCompletionBps: number;
  valueCompletionBps: number;
  ownOnchainDerivedCompletionBps: number;
  providerFieldCompletionBps: number;
  coreDeliverable: boolean;
  deliveryMode: "FULL" | "CORE_ONLY_WITH_HIDDEN_OPTIONAL_FIELDS" | "BLOCKED_CORE";
}>;

const ALL = ["basic", "pro", "advanced"] as const;
const PRO_ADV = ["pro", "advanced"] as const;
const ADV = ["advanced"] as const;

const alt = (
  strategy: VlmFieldAlternativeStrategy,
  zeroBudgetPossible: boolean,
  preservesRequiredSemantics: boolean,
  notes: string,
): VlmFieldAlternative => ({ strategy, zeroBudgetPossible, preservesRequiredSemantics, notes });

const F = (
  family: VlmFieldDefinitionScope,
  id: string,
  label: string,
  sourceClass: VlmFieldSourceClass,
  includedTiers: readonly VlmCurrentSkuTier[],
  requiredTiers: readonly VlmCurrentSkuTier[],
  criticalTiers: readonly VlmCurrentSkuTier[],
  valueWeight: number,
  canHideWhenUnavailable: boolean,
  coreDeliverable: boolean,
  alternative: VlmFieldAlternative,
): VlmFieldDefinition => ({
  family, id, label, sourceClass, includedTiers, requiredTiers, criticalTiers,
  valueWeight, canHideWhenUnavailable, coreDeliverable, alternative,
});

/**
 * Canonical field catalogue. Provider restrictions are scoped to individual
 * fields; they never erase Velmère-owned, direct-chain, derived or regulator
 * fields from the same product.
 */
export const VLM_FIELD_DEFINITIONS: readonly VlmFieldDefinition[] = [
  // Audit — 9
  F("audit", "audit_intake_identity", "Exact target and scope identity", "VELMERE_OWNED", ALL, ALL, ALL, 10, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "A report cannot exist without an exact target and scope.")),
  F("audit", "source_bytecode_binding", "Source-to-bytecode binding", "PUBLIC_BLOCKCHAIN_DIRECT", ALL, ALL, ALL, 14, false, true, alt("USER_SUPPLIED_SIGNED_SNAPSHOT", true, true, "Accept a hash-bound source and deployment bundle when direct chain retrieval is unavailable.")),
  F("audit", "official_tool_receipts", "Official tool execution receipts", "VELMERE_DERIVED", ALL, ALL, ALL, 13, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Do not claim tool coverage without physical receipts.")),
  F("audit", "finding_synthesis", "Finding synthesis and contradiction handling", "VELMERE_OWNED", ALL, ALL, ALL, 14, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Core Velmère analysis.")),
  F("audit", "evidence_completeness", "Evidence completeness register", "VELMERE_DERIVED", ALL, ALL, ALL, 9, false, true, alt("VELMERE_DERIVATION", true, true, "Derive only from physically bound evidence.")),
  F("audit", "remediation_guidance", "Safe remediation guidance", "VELMERE_OWNED", ALL, ALL, [], 8, false, true, alt("MANUAL_VERIFICATION", false, true, "A qualified reviewer may replace automated remediation when needed.")),
  F("audit", "manual_quality_control", "Automated quality-control receipt", "VELMERE_DERIVED", PRO_ADV, PRO_ADV, PRO_ADV, 12, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Require a deterministic automated QC receipt with conflict checks, decision and correction receipt.")),
  F("audit", "independent_adjudication", "Independent automated adjudication", "VELMERE_DERIVED", ADV, ADV, ADV, 14, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Advanced requires an independently replayed automated adjudication path; human review is optional QA only.")),
  F("audit", "market_context_appendix", "Optional market context appendix", "EXTERNAL_PROVIDER", ALL, [], [], 6, true, false, alt("HIDE_FIELD", true, false, "Hide the optional market appendix until commercial rights are approved.")),

  // PDF — 8
  F("pdf-artifact", "pdf_packet_truth", "Packet-to-document semantic parity", "VELMERE_DERIVED", ALL, ALL, ALL, 15, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "The PDF must match the source packet.")),
  F("pdf-artifact", "pdf_safe_renderer", "Safe deterministic renderer", "VELMERE_OWNED", ALL, ALL, ALL, 14, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "No active content or unsafe actions.")),
  F("pdf-artifact", "pdf_localization", "PL/EN/DE localization", "VELMERE_OWNED", ALL, ALL, [], 10, false, true, alt("MANUAL_VERIFICATION", false, true, "A native-language reviewer can replace automated localization QA.")),
  F("pdf-artifact", "pdf_font_unicode", "Embedded fonts and ToUnicode", "VELMERE_OWNED", ALL, ALL, ALL, 10, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Required for searchable customer documents.")),
  F("pdf-artifact", "pdf_visual_qa", "A4 visual and clipping QA", "VELMERE_DERIVED", ALL, ALL, ALL, 12, false, true, alt("MANUAL_VERIFICATION", false, true, "Manual all-page visual QA is an acceptable substitute.")),
  F("pdf-artifact", "pdf_secure_delivery", "Account-bound secure delivery", "VELMERE_OWNED", PRO_ADV, PRO_ADV, PRO_ADV, 12, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Paid delivery requires private storage and entitlement enforcement.")),
  F("pdf-artifact", "pdf_independent_qa", "Independent automated customer-document QA", "VELMERE_DERIVED", ADV, ADV, ADV, 15, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Advanced customer delivery needs an independently replayed automated PDF QA receipt; optional human QA does not gate delivery.")),
  F("pdf-artifact", "pdf_market_appendix", "Optional market-data appendix", "EXTERNAL_PROVIDER", ALL, [], [], 5, true, false, alt("HIDE_FIELD", true, false, "Generate the audit PDF without provider-derived market fields.")),

  // Browser — 8
  F("browser", "browser_route_identity", "Exact route and asset identity", "VELMERE_OWNED", ALL, ALL, ALL, 13, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Never fuzzy-promote an unknown target.")),
  F("browser", "browser_onchain_lookup", "Direct on-chain lookup", "PUBLIC_BLOCKCHAIN_DIRECT", ALL, ALL, [], 12, false, true, alt("USER_SUPPLIED_SIGNED_SNAPSHOT", true, true, "Accept a hash-bound user-supplied chain snapshot.")),
  F("browser", "browser_analysis_summary", "Velmère analysis summary", "VELMERE_DERIVED", ALL, ALL, ALL, 14, false, true, alt("VELMERE_DERIVATION", true, true, "Derived from the bound analysis packet.")),
  F("browser", "browser_evidence_explorer", "Evidence explorer", "VELMERE_OWNED", ALL, ALL, [], 10, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Core product UX.")),
  F("browser", "browser_pdf_parity", "Browser/PDF fact parity", "VELMERE_DERIVED", ALL, ALL, ALL, 13, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Customer must receive the same facts in both surfaces.")),
  F("browser", "browser_current_quote", "Current market quote", "EXTERNAL_PROVIDER", ALL, PRO_ADV, PRO_ADV, 10, true, false, alt("HIDE_FIELD", true, false, "Hide quote panels while preserving on-chain and audit browsing.")),
  F("browser", "browser_history_chart", "Current historical chart", "EXTERNAL_PROVIDER", PRO_ADV, PRO_ADV, PRO_ADV, 10, true, false, alt("USER_SUPPLIED_SIGNED_SNAPSHOT", true, true, "Use a signed user-provided history snapshot for bounded analysis.")),
  F("browser", "browser_accessibility", "Keyboard, zoom and screen-reader behavior", "VELMERE_OWNED", ALL, ALL, ALL, 8, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Accessibility is part of the core deliverable.")),

  // Shield — 11
  F("shield", "shield_exact_identity", "Exact chain/address identity", "PUBLIC_BLOCKCHAIN_DIRECT", ALL, ALL, ALL, 12, false, true, alt("USER_SUPPLIED_SIGNED_SNAPSHOT", true, true, "Accept a signed target bundle when a direct node is unavailable.")),
  F("shield", "shield_bytecode", "Deployed bytecode and permissions", "PUBLIC_BLOCKCHAIN_DIRECT", ALL, ALL, ALL, 12, false, true, alt("USER_SUPPLIED_SIGNED_SNAPSHOT", true, true, "Use a hash-bound bytecode snapshot.")),
  F("shield", "shield_transfer_evidence", "Transfer and event evidence", "PUBLIC_BLOCKCHAIN_DIRECT", ALL, ALL, [], 10, false, true, alt("DIRECT_CHAIN_QUERY", true, true, "Query a self-operated RPC/indexer.")),
  F("shield", "shield_holder_concentration", "Holder concentration", "VELMERE_DERIVED", ALL, ALL, [], 10, false, true, alt("VELMERE_DERIVATION", true, true, "Compute from a self-indexed holder snapshot.")),
  F("shield", "shield_risk_explanation", "Risk explanation and missing-proof register", "VELMERE_OWNED", ALL, ALL, ALL, 12, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Core Velmère value.")),
  F("shield", "shield_quote", "Current quote", "EXTERNAL_PROVIDER", ALL, [], [], 8, true, false, alt("HIDE_FIELD", true, false, "Hide current price while keeping security analysis available.")),
  F("shield", "shield_market_cap", "Market capitalization", "EXTERNAL_PROVIDER", ALL, [], [], 7, true, false, alt("VELMERE_DERIVATION", true, false, "Derive only when supply and rights-approved/reference price are available.")),
  F("shield", "shield_volume", "Current volume", "EXTERNAL_PROVIDER", ALL, [], [], 7, true, false, alt("HIDE_FIELD", true, false, "Do not fabricate volume.")),
  F("shield", "shield_order_book", "Current order-book depth", "EXTERNAL_PROVIDER", PRO_ADV, PRO_ADV, PRO_ADV, 12, false, true, alt("USER_SUPPLIED_SIGNED_SNAPSHOT", true, true, "Use a signed bounded order-book snapshot for one analysis.")),
  F("shield", "shield_provider_quorum", "Independent provider quorum", "VELMERE_DERIVED", PRO_ADV, PRO_ADV, ADV, 10, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "A single provider cannot prove quorum.")),
  F("shield", "shield_signed_labels", "Signed entity labels", "MANUAL_REVIEW", ADV, ADV, ADV, 10, false, true, alt("HIDE_FIELD", true, false, "Show UNCLASSIFIED_ADDRESS instead of an unverified entity name.")),

  // Shield Pro — independent product family, 9 fields
  F("shield-pro", "shield_pro_terminal_query", "Terminal query result and exact target identity", "VELMERE_OWNED", ALL, ALL, ALL, 12, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Shield Pro must produce a real query result, not visual theatre.")),
  F("shield-pro", "shield_pro_evidence_provenance", "Evidence provenance and source status", "VELMERE_DERIVED", ALL, ALL, ALL, 12, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Every displayed claim needs a bound evidence/source state.")),
  F("shield-pro", "shield_pro_market_observed_at", "Market observation timestamp", "EXTERNAL_PROVIDER", ALL, ALL, ALL, 10, false, true, alt("USER_SUPPLIED_SIGNED_SNAPSHOT", true, true, "A hash-bound customer-supplied snapshot may support a bounded non-live analysis.")),
  F("shield-pro", "shield_pro_market_price", "Current or honestly delayed/reference market value", "EXTERNAL_PROVIDER", ALL, ALL, ALL, 10, false, true, alt("USER_SUPPLIED_SIGNED_SNAPSHOT", true, true, "Never promote reference or stale data to a live/executable quote.")),
  F("shield-pro", "shield_pro_risk_evidence", "Evidence-backed risk state with limitations", "VELMERE_DERIVED", ALL, ALL, ALL, 12, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Risk output requires a real evidence-bound execution.")),
  F("shield-pro", "shield_pro_provider_quorum", "Independent provider quorum and conflict state", "VELMERE_DERIVED", PRO_ADV, PRO_ADV, ADV, 10, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "A single source cannot prove provider quorum.")),
  F("shield-pro", "shield_pro_diagnostics", "Terminal diagnostics and safe operator actions", "VELMERE_DERIVED", PRO_ADV, PRO_ADV, PRO_ADV, 10, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Paid depth must add decision-relevant diagnostics, not styling.")),
  F("shield-pro", "shield_pro_signal_correlation", "Multi-signal correlation with provenance", "VELMERE_DERIVED", ADV, ADV, ADV, 12, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Advanced correlation requires exact matched-input evidence and conflict handling.")),
  F("shield-pro", "shield_pro_replay_handoff", "Replayable governed evidence handoff", "VELMERE_OWNED", ADV, ADV,  ADV, 12, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Advanced team handoff must be physically implemented and replayable before credit.")),

  // Shield Map — 8
  F("shield-map", "map_globe_runtime", "Globe rendering and interaction", "VELMERE_OWNED", ALL, ALL, ALL, 14, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Core map UX.")),
  F("shield-map", "map_transfer_graph", "On-chain transfer graph", "PUBLIC_BLOCKCHAIN_DIRECT", ALL, ALL, [], 14, false, true, alt("DIRECT_CHAIN_QUERY", true, true, "Build from a self-operated node/indexer.")),
  F("shield-map", "map_bridge_events", "Bridge event graph", "PUBLIC_BLOCKCHAIN_DIRECT", ALL, ALL, [], 10, false, true, alt("DIRECT_CHAIN_QUERY", true, true, "Index canonical bridge events directly.")),
  F("shield-map", "map_clustering", "Velmère clustering", "VELMERE_DERIVED", ALL, ALL, [], 12, false, true, alt("VELMERE_DERIVATION", true, true, "Compute clusters from bound graph evidence.")),
  F("shield-map", "map_entity_labels", "Entity labels", "EXTERNAL_PROVIDER", ALL, [], [], 10, true, false, alt("HIDE_FIELD", true, false, "Keep the address visible and label it UNCLASSIFIED.")),
  F("shield-map", "map_signed_label_registry", "Signed label registry", "MANUAL_REVIEW", PRO_ADV, PRO_ADV, PRO_ADV, 14, false, true, alt("USER_SUPPLIED_SIGNED_SNAPSHOT", true, true, "Accept a signed customer label with provenance and expiry.")),
  F("shield-map", "map_corrections", "Label correction workflow", "VELMERE_OWNED", PRO_ADV, PRO_ADV, ADV, 10, false, true, alt("MANUAL_VERIFICATION", false, true, "Operate a correction and appeal workflow.")),
  F("shield-map", "map_paid_operations", "Paid map support and incident operations", "MANUAL_REVIEW", ADV, ADV, ADV, 16, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Advanced requires staffed operations.")),

  // Real Markets — 11
  F("real-markets", "markets_instrument_identity", "Exact instrument identity", "VELMERE_OWNED", ALL, ALL, ALL, 10, false, true, alt("PUBLIC_REGULATOR_API", true, true, "Use official identifiers and filings where available.")),
  F("real-markets", "markets_normalization", "Cross-asset normalization", "VELMERE_OWNED", ALL, ALL, ALL, 11, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Core Velmère schema.")),
  F("real-markets", "markets_conflict_state", "Freshness and conflict classification", "VELMERE_DERIVED", ALL, ALL, ALL, 10, false, true, alt("VELMERE_DERIVATION", true, true, "Classify only bound observations.")),
  F("real-markets", "markets_company_facts", "Official company facts", "PUBLIC_REGULATOR_DATA", ALL, [], [], 8, true, false, alt("PUBLIC_REGULATOR_API", true, false, "Use SEC or equivalent official APIs with required identification and rate limits.")),
  F("real-markets", "markets_reference_fx", "Reference FX rates", "PUBLIC_REGULATOR_DATA", ALL, [], [], 7, true, false, alt("PUBLIC_REGULATOR_API", true, false, "Use official reference rates and label them non-executable.")),
  F("real-markets", "markets_current_quote", "Current quote", "EXTERNAL_PROVIDER", ALL, PRO_ADV, PRO_ADV, 12, true, false, alt("HIDE_FIELD", true, false, "Basic may remain a reference surface without realtime price.")),
  F("real-markets", "markets_history", "Current price history", "EXTERNAL_PROVIDER", ALL, PRO_ADV, PRO_ADV, 10, true, false, alt("USER_SUPPLIED_SIGNED_SNAPSHOT", true, true, "Accept a signed history import for bounded analysis.")),
  F("real-markets", "markets_volume", "Current trading volume", "EXTERNAL_PROVIDER", ALL, PRO_ADV, PRO_ADV, 8, true, false, alt("HIDE_FIELD", true, false, "Never invent volume.")),
  F("real-markets", "markets_corporate_actions", "Corporate actions and corrections", "PUBLIC_REGULATOR_DATA", PRO_ADV, PRO_ADV, ADV, 9, false, true, alt("MANUAL_VERIFICATION", false, true, "Verify against official issuer/exchange disclosures.")),
  F("real-markets", "markets_order_book", "Current market depth", "EXTERNAL_PROVIDER", ADV, ADV, ADV, 9, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Advanced market-depth claims require a licensed feed.")),
  F("real-markets", "markets_provider_failover", "Independent provider failover", "VELMERE_DERIVED", PRO_ADV, PRO_ADV, ADV, 6, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Failover requires at least one independent alternative.")),

  // Market Impact — 8
  F("market-impact", "impact_simulation_engine", "Impact simulation engine", "VELMERE_OWNED", ALL, ALL, ALL, 16, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Core simulation value.")),
  F("market-impact", "impact_assumptions", "Assumptions and uncertainty", "VELMERE_OWNED", ALL, ALL, ALL, 12, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Simulation must disclose assumptions.")),
  F("market-impact", "impact_user_snapshot", "User-supplied order-book snapshot", "USER_SUPPLIED", ALL, [], [], 9, true, false, alt("USER_SUPPLIED_SIGNED_SNAPSHOT", true, false, "Optional bounded simulation input.")),
  F("market-impact", "impact_amm_reserves", "On-chain AMM reserves", "PUBLIC_BLOCKCHAIN_DIRECT", ALL, [], [], 10, true, false, alt("DIRECT_CHAIN_QUERY", true, false, "Use direct pool state for on-chain simulation.")),
  F("market-impact", "impact_live_order_book", "Current centralized order book", "EXTERNAL_PROVIDER", PRO_ADV, PRO_ADV, PRO_ADV, 14, false, true, alt("USER_SUPPLIED_SIGNED_SNAPSHOT", true, true, "Use a signed snapshot for a bounded report, not a LIVE claim.")),
  F("market-impact", "impact_curve", "Derived impact curve", "VELMERE_DERIVED", ALL, ALL, ALL, 12, false, true, alt("VELMERE_DERIVATION", true, true, "Derive from bound inputs.")),
  F("market-impact", "impact_realized_slippage", "Realized-slippage validation", "VELMERE_DERIVED", PRO_ADV, PRO_ADV, ADV, 14, false, true, alt("MANUAL_VERIFICATION", false, true, "Compare prediction with executed outcomes.")),
  F("market-impact", "impact_outcome_review", "Independent outcome review", "MANUAL_REVIEW", ADV, ADV, ADV, 13, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Advanced needs independent outcome review.")),

  // Whale Watch — 8
  F("whale-watch", "whale_transfers", "On-chain transfers", "PUBLIC_BLOCKCHAIN_DIRECT", ALL, ALL, ALL, 15, false, true, alt("DIRECT_CHAIN_QUERY", true, true, "Index transfer logs directly.")),
  F("whale-watch", "whale_holder_balances", "Holder balances", "PUBLIC_BLOCKCHAIN_DIRECT", ALL, ALL, [], 12, false, true, alt("DIRECT_CHAIN_QUERY", true, true, "Use a self-operated indexer.")),
  F("whale-watch", "whale_concentration", "Concentration metrics", "VELMERE_DERIVED", ALL, ALL, [], 12, false, true, alt("VELMERE_DERIVATION", true, true, "Compute from bound balances.")),
  F("whale-watch", "whale_event_correlation", "Event correlation", "VELMERE_DERIVED", ALL, ALL, [], 10, false, true, alt("VELMERE_DERIVATION", true, true, "Correlate only physical events.")),
  F("whale-watch", "whale_entity_labels", "Exchange, treasury and fund labels", "EXTERNAL_PROVIDER", ALL, [], [], 10, true, false, alt("HIDE_FIELD", true, false, "Use UNCLASSIFIED_ADDRESS without a verified label.")),
  F("whale-watch", "whale_signed_labels", "Signed current labels", "MANUAL_REVIEW", PRO_ADV, PRO_ADV, PRO_ADV, 15, false, true, alt("USER_SUPPLIED_SIGNED_SNAPSHOT", true, true, "Accept a signed label with provenance, expiry and reviewer identity.")),
  F("whale-watch", "whale_label_corrections", "Label correction and appeal workflow", "VELMERE_OWNED", PRO_ADV, PRO_ADV, ADV, 12, false, true, alt("MANUAL_VERIFICATION", false, true, "Operate correction and appeal receipts.")),
  F("whale-watch", "whale_independent_review", "Independent label review", "MANUAL_REVIEW", ADV, ADV, ADV, 14, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Advanced requires independent label review.")),

  // Angel — 8
  F("angel", "angel_policy_boundary", "Safety and advice boundary", "VELMERE_OWNED", ALL, ALL, ALL, 15, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Core safety requirement.")),
  F("angel", "angel_evidence_binding", "Evidence and citation binding", "VELMERE_DERIVED", ALL, ALL, ALL, 14, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Responses must be evidence-bound.")),
  F("angel", "angel_onchain_facts", "Direct on-chain facts", "PUBLIC_BLOCKCHAIN_DIRECT", ALL, ALL, [], 12, false, true, alt("USER_SUPPLIED_SIGNED_SNAPSHOT", true, true, "Use a signed chain snapshot when direct RPC is unavailable.")),
  F("angel", "angel_abstention", "Abstention and missing-proof handling", "VELMERE_OWNED", ALL, ALL, ALL, 12, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Never invent unavailable facts.")),
  F("angel", "angel_market_context", "Current market context", "EXTERNAL_PROVIDER", ALL, [], [], 10, true, false, alt("HIDE_FIELD", true, false, "Answer only from on-chain facts and disclose missing freshness.")),
  F("angel", "angel_real_unseen_eval", "Independent unseen evaluation", "MANUAL_REVIEW", PRO_ADV, PRO_ADV, PRO_ADV, 14, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Pro/Advanced require independently labeled evaluation.")),
  F("angel", "angel_customer_utility", "Customer decision-utility evidence", "MANUAL_REVIEW", PRO_ADV, ADV, ADV, 11, false, true, alt("MANUAL_VERIFICATION", false, true, "Collect consented comprehension and utility labels.")),
  F("angel", "angel_advanced_workflow", "Advanced evidence workflow", "VELMERE_OWNED", ADV, ADV, ADV, 12, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Advanced must add a material professional workflow.")),

  // Risk — 7
  F("risk", "risk_descriptive_level", "Descriptive risk level", "VELMERE_DERIVED", ALL, ALL, ALL, 17, false, true, alt("VELMERE_DERIVATION", true, true, "Derive from bound factors without pretending to probability.")),
  F("risk", "risk_factor_register", "Risk factors and contradictions", "VELMERE_OWNED", ALL, ALL, ALL, 15, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Core risk explanation.")),
  F("risk", "risk_onchain_evidence", "On-chain evidence", "PUBLIC_BLOCKCHAIN_DIRECT", ALL, ALL, [], 13, false, true, alt("USER_SUPPLIED_SIGNED_SNAPSHOT", true, true, "Use a signed snapshot when direct RPC is unavailable.")),
  F("risk", "risk_market_inputs", "Current market inputs", "EXTERNAL_PROVIDER", ALL, [], [], 9, true, false, alt("HIDE_FIELD", true, false, "Provide descriptive technical risk without current market probability.")),
  F("risk", "risk_probability_calibration", "Probability calibration", "VELMERE_DERIVED", PRO_ADV, PRO_ADV, PRO_ADV, 17, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "No percentage without real calibration windows.")),
  F("risk", "risk_outcome_labels", "Independent outcome labels", "MANUAL_REVIEW", PRO_ADV, PRO_ADV, ADV, 15, false, true, alt("MANUAL_VERIFICATION", false, true, "Collect preregistered outcome labels.")),
  F("risk", "risk_advanced_governance", "Advanced model governance", "MANUAL_REVIEW", ADV, ADV, ADV, 14, false, true, alt("NO_SAFE_SUBSTITUTE", false, false, "Advanced requires model governance, drift and appeal workflows.")),
] as const;

const SOURCE_READY_STATE: Readonly<Partial<Record<VlmFieldSourceClass, VlmFieldAvailabilityState>>> = {
  VELMERE_OWNED: "AVAILABLE_OWNED",
  PUBLIC_BLOCKCHAIN_DIRECT: "AVAILABLE_PUBLIC_CHAIN",
  VELMERE_DERIVED: "AVAILABLE_DERIVED",
  USER_SUPPLIED: "AVAILABLE_USER_SUPPLIED",
  PUBLIC_REGULATOR_DATA: "AVAILABLE_PUBLIC_REGULATOR",
  EXTERNAL_PROVIDER: "AVAILABLE_RIGHTS_APPROVED_PROVIDER",
  MANUAL_REVIEW: "AVAILABLE_MANUAL_REVIEW",
};

function isTier(rows: readonly VlmCurrentSkuTier[], tier: VlmCurrentSkuTier): boolean {
  return rows.includes(tier);
}

export function validateVlmFieldDefinitions(
  definitions: readonly VlmFieldDefinition[] = VLM_FIELD_DEFINITIONS,
): void {
  if (definitions.length === 0) throw new Error("field_catalog_empty");
  const ids = new Set<string>();
  let weight = 0;
  for (const row of definitions) {
    if (!row.id.trim()) throw new Error("field_id_empty");
    if (ids.has(row.id)) throw new Error(`field_id_duplicate:${row.id}`);
    ids.add(row.id);
    if (!Number.isInteger(row.valueWeight) || row.valueWeight <= 0 || row.valueWeight > 100) {
      throw new Error(`field_weight_invalid:${row.id}`);
    }
    weight += row.valueWeight;
    if (row.includedTiers.length === 0) throw new Error(`field_tiers_empty:${row.id}`);
    for (const tier of row.requiredTiers) {
      if (!isTier(row.includedTiers, tier)) throw new Error(`required_tier_not_included:${row.id}:${tier}`);
    }
    for (const tier of row.criticalTiers) {
      if (!isTier(row.requiredTiers, tier)) throw new Error(`critical_tier_not_required:${row.id}:${tier}`);
    }
    if (row.coreDeliverable && row.requiredTiers.length === 0) throw new Error(`core_field_not_required:${row.id}`);
    if (!row.canHideWhenUnavailable && row.alternative.strategy === "HIDE_FIELD" && row.alternative.preservesRequiredSemantics) {
      throw new Error(`invalid_hide_semantics:${row.id}`);
    }
  }
  if (weight <= 0) throw new Error("field_catalog_zero_weight");
}

export function isVlmFieldDirectlyReady(
  definition: VlmFieldDefinition,
  evidence: VlmFieldEvidence | undefined,
): boolean {
  if (!evidence) return false;
  if (definition.sourceClass === "SYNTHETIC_FIXTURE") return false;
  return SOURCE_READY_STATE[definition.sourceClass] === evidence.availability;
}

function bps(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.floor((numerator * 10_000) / denominator);
}

export function fieldsForVlmProduct(
  family: VlmCommercialProductFamily,
  tier: VlmCurrentSkuTier,
): readonly VlmFieldDefinition[] {
  return VLM_FIELD_DEFINITIONS.filter((row) => row.family === family && isTier(row.includedTiers, tier));
}

export function fieldsForVlmArtifact(
  artifact: "pdf-artifact",
  tier: VlmCurrentSkuTier,
): readonly VlmFieldDefinition[] {
  return VLM_FIELD_DEFINITIONS.filter((row) => row.family === artifact && isTier(row.includedTiers, tier));
}

export function evaluateVlmFieldLevelReadiness(args: {
  family: VlmCommercialProductFamily;
  tier: VlmCurrentSkuTier;
  standaloneProduct?: boolean;
  evidence: VlmFieldEvidenceById;
  definitions?: readonly VlmFieldDefinition[];
}): VlmFieldLevelReadiness {
  const definitions = args.definitions ?? VLM_FIELD_DEFINITIONS;
  validateVlmFieldDefinitions(definitions);
  const standaloneProduct = args.standaloneProduct === true;
  // Standalone products have one customer profile. Legacy PRO/ADV field tags are retained only
  // as historical/context metadata, so no field disappears merely because the policy adapter
  // uses the Basic-shaped tier. Basic-required fields define the current core blocker set;
  // legacy higher-context fields remain visible as optional/uncredited until explicitly rebound.
  const selected = definitions.filter((row) => row.family === args.family && (standaloneProduct || isTier(row.includedTiers, args.tier)));
  if (selected.length === 0) throw new Error(`field_catalog_family_tier_empty:${args.family}:${args.tier}`);

  const fields: VlmFieldEvaluation[] = selected.map((definition) => {
    const evidence = args.evidence[definition.id];
    const required = standaloneProduct ? isTier(definition.requiredTiers, "basic") : isTier(definition.requiredTiers, args.tier);
    const critical = standaloneProduct ? isTier(definition.criticalTiers, "basic") : isTier(definition.criticalTiers, args.tier);
    const directlyReady = isVlmFieldDirectlyReady(definition, evidence);
    const alternativeReady = !directlyReady
      && evidence?.alternativeReady === true
      && definition.alternative.strategy !== "NO_SAFE_SUBSTITUTE"
      && (!required || definition.alternative.preservesRequiredSemantics === true);
    const substituteProvidesField = alternativeReady && definition.alternative.strategy !== "HIDE_FIELD";
    const effectiveReady = directlyReady || substituteProvidesField;
    const hidden = !directlyReady
      && !required
      && definition.canHideWhenUnavailable
      && definition.alternative.strategy === "HIDE_FIELD";
    const availability = evidence?.availability ?? "UNAVAILABLE";
    const blocker = required && !effectiveReady
      ? `${critical ? "critical_field_blocked" : "field_blocked"}:${definition.id}:${availability}`
      : null;
    return {
      fieldId: definition.id,
      label: definition.label,
      sourceClass: definition.sourceClass,
      required,
      critical,
      valueWeight: definition.valueWeight,
      availability,
      directlyReady,
      alternativeReady,
      effectiveReady,
      hidden,
      blocker,
      alternative: definition.alternative,
    };
  });

  const required = fields.filter((row) => row.required);
  const critical = fields.filter((row) => row.critical);
  const valueWeight = fields.reduce((sum, row) => sum + row.valueWeight, 0);
  const readyValueWeight = fields.filter((row) => row.effectiveReady).reduce((sum, row) => sum + row.valueWeight, 0);
  const ownClasses = new Set<VlmFieldSourceClass>([
    "VELMERE_OWNED", "PUBLIC_BLOCKCHAIN_DIRECT", "VELMERE_DERIVED", "USER_SUPPLIED", "PUBLIC_REGULATOR_DATA",
  ]);
  const ownFields = fields.filter((row) => ownClasses.has(row.sourceClass));
  const providerFields = fields.filter((row) => row.sourceClass === "EXTERNAL_PROVIDER");
  const coreDeliverable = required.every((row) => row.effectiveReady);
  const allReady = fields.every((row) => row.effectiveReady);

  return {
    schemaVersion: PASS36_R44P21_FIELD_LEVEL_READINESS_ID,
    family: args.family,
    tier: args.tier,
    customerFacingTier: standaloneProduct ? null : args.tier,
    standaloneProduct,
    fields,
    fieldCount: fields.length,
    requiredFieldCount: required.length,
    criticalFieldCount: critical.length,
    readyFieldCount: fields.filter((row) => row.effectiveReady).length,
    blockedFieldIds: fields.filter((row) => row.required && !row.effectiveReady).map((row) => row.fieldId),
    hiddenFieldIds: fields.filter((row) => row.hidden).map((row) => row.fieldId),
    blockers: fields.flatMap((row) => row.blocker ? [row.blocker] : []),
    fieldCompletionBps: bps(required.filter((row) => row.effectiveReady).length, required.length),
    criticalFieldCompletionBps: bps(critical.filter((row) => row.effectiveReady).length, critical.length),
    valueCompletionBps: bps(readyValueWeight, valueWeight),
    ownOnchainDerivedCompletionBps: bps(ownFields.filter((row) => row.effectiveReady).length, ownFields.length),
    providerFieldCompletionBps: bps(providerFields.filter((row) => row.directlyReady).length, providerFields.length),
    coreDeliverable,
    deliveryMode: allReady ? "FULL" : coreDeliverable ? "CORE_ONLY_WITH_HIDDEN_OPTIONAL_FIELDS" : "BLOCKED_CORE",
  };
}

export function buildVlmFieldSourceClassCounts(
  definitions: readonly VlmFieldDefinition[] = VLM_FIELD_DEFINITIONS,
): Record<VlmFieldSourceClass, number> {
  const counts: Record<VlmFieldSourceClass, number> = {
    VELMERE_OWNED: 0,
    PUBLIC_BLOCKCHAIN_DIRECT: 0,
    VELMERE_DERIVED: 0,
    USER_SUPPLIED: 0,
    EXTERNAL_PROVIDER: 0,
    PUBLIC_REGULATOR_DATA: 0,
    MANUAL_REVIEW: 0,
    SYNTHETIC_FIXTURE: 0,
  };
  for (const row of definitions) counts[row.sourceClass] += 1;
  return counts;
}
