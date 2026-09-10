import {
  buildVlmCustomerTruthReasons,
  resolveVlmConfidenceClass,
  resolveVlmTruthState,
  uniqueVlmTruthStrings,
  type VlmCustomerLocale,
  type VlmEvidenceOrigin,
  type VlmStandaloneCustomerTruthEnvelope,
  type VlmTruthReasonCode,
} from "../product/vlm-standalone-customer-truth";
import {
  buildVlmStandaloneInsightContract,
  type VlmReportContextDepth,
  type VlmStandaloneInsightContract,
} from "../product/vlm-standalone-insight-contract";
import type { WhaleFlowWindow, WhaleWatchAlert } from "./whale-watch-types";

export type WhaleWatchCustomerTruth = VlmStandaloneCustomerTruthEnvelope & {
  productId: "whale-watch";
  transferIsTradeClaimAllowed: false;
  buyOrSellIntentClaimAllowed: false;
  verifiedEntityAttributionRequiresSignedArtifact: true;
  unverifiedDisplayLabel: "UNCLASSIFIED";
  labelExpiryEnforced: true;
  labelSignatureEnforced: true;
  correctionWorkflowStatus: "DESIGNED_NOT_OPERATIONALLY_PROVEN";
  verifiedLabelArtifactCount: number;
  verifiedLabelHolderCount: number;
  unclassifiedHolderCount: number;
  transferCount: number;
  monitoringContinuityStatus: "MISSING_CONTINUOUS_EXTERNAL_MONITORING";
  contract: VlmStandaloneInsightContract;
};

function localizedSummary(args: {
  locale: VlmCustomerLocale;
  transferCount: number;
  verifiedLabels: number;
  unclassified: number;
  fixtureOnly: boolean;
}) {
  if (args.locale === "pl") {
    return `Whale Watch pokazuje ${args.transferCount} sprawdzalnych zdarzeń i ${args.verifiedLabels} zweryfikowanych etykiet. ${args.unclassified} pozycji pozostaje UNCLASSIFIED. Transfer nie dowodzi kupna ani sprzedaży${args.fixtureOnly ? "; dane są testowe" : ""}.`;
  }
  if (args.locale === "de") {
    return `Whale Watch zeigt ${args.transferCount} überprüfbare Ereignisse und ${args.verifiedLabels} verifizierte Labels. ${args.unclassified} Positionen bleiben UNCLASSIFIED. Ein Transfer beweist weder Kauf noch Verkauf${args.fixtureOnly ? "; die Daten sind Testdaten" : ""}.`;
  }
  return `Whale Watch shows ${args.transferCount} verifiable events and ${args.verifiedLabels} verified labels. ${args.unclassified} entries remain UNCLASSIFIED. A transfer does not prove a buy or sale${args.fixtureOnly ? "; the data is fixture-only" : ""}.`;
}

export function buildWhaleWatchCustomerTruth(args: {
  locale?: VlmCustomerLocale;
  reportContextDepth?: VlmReportContextDepth;
  evidenceStatus: "verified_live" | "verified_staging" | "fixture_only" | "unavailable";
  providerFamilies: string[];
  holderCount: number;
  verifiedLabelHolderCount: number;
  unclassifiedHolderCount: number;
  verifiedLabelArtifactCount: number;
  transferCount: number;
  flowWindows: WhaleFlowWindow[];
  alerts: WhaleWatchAlert[];
  blockers: string[];
  labelErrors: string[];
}): WhaleWatchCustomerTruth {
  const locale = args.locale ?? "en";
  const fixtureOnly = args.evidenceStatus === "fixture_only";
  const unavailable = args.evidenceStatus === "unavailable";
  const reasonCodes: VlmTruthReasonCode[] = ["TRANSFER_NOT_TRADE", "REAL_CUSTOMER_PROOF_MISSING"];
  if (unavailable) reasonCodes.push("NO_BOUND_EVIDENCE", "MISSING_DATA");
  if (fixtureOnly) reasonCodes.push("FIXTURE_ONLY");
  if (args.providerFamilies.length < 2 && !unavailable) reasonCodes.push("SINGLE_SOURCE_ONLY");
  if (args.unclassifiedHolderCount > 0) reasonCodes.push("LABEL_UNVERIFIED");
  if (args.labelErrors.some((value) => /expired|signature|validity|future|observed/i.test(value))) reasonCodes.push("LABEL_EXPIRED_OR_INVALID");
  if (args.blockers.some((value) => value.includes("stale"))) reasonCodes.push("STALE_DATA");
  if (args.blockers.some((value) => value.includes("mismatch") || value.includes("conflict"))) reasonCodes.push("SOURCE_CONFLICT");
  const reasonCards = buildVlmCustomerTruthReasons(reasonCodes, locale, 8);

  const evidenceOrigins: VlmEvidenceOrigin[] = uniqueVlmTruthStrings([
    args.holderCount > 0 || args.transferCount > 0 ? "BLOCKCHAIN_DIRECT" : null,
    args.providerFamilies.length > 0 ? "PROVIDER" : null,
    "VELMERE_DERIVED",
    fixtureOnly ? "FIXTURE" : null,
  ], 8) as VlmEvidenceOrigin[];

  const evidenceRef = `whale-watch:${args.verifiedLabelArtifactCount}:${args.transferCount}:${args.holderCount}`;
  const contract = buildVlmStandaloneInsightContract({
    productId: "whale-watch",
    reportContextDepth: args.reportContextDepth ?? "basic",
    state: unavailable ? "withheld" : fixtureOnly || args.blockers.length > 0 ? "limited" : "available",
    facts: [
      { id: "holder-count", label: "Observed holder rows", value: args.holderCount, sourceClass: "BLOCKCHAIN_DIRECT", evidenceRefs: [evidenceRef], observedAt: null },
      { id: "transfer-count", label: "Observed transfer rows", value: args.transferCount, sourceClass: "BLOCKCHAIN_DIRECT", evidenceRefs: [evidenceRef], observedAt: null },
      { id: "verified-labels", label: "Verified wallet labels", value: args.verifiedLabelHolderCount, sourceClass: "PROVIDER", evidenceRefs: [evidenceRef], observedAt: null },
      { id: "unclassified", label: "UNCLASSIFIED holders", value: args.unclassifiedHolderCount, sourceClass: "VELMERE_DERIVED", evidenceRefs: [evidenceRef], observedAt: null },
    ],
    calculations: [
      ...args.flowWindows.map((window) => ({ id: `flow-${window.window}`, label: `${window.window} net exchange flow USD`, value: window.netExchangeFlowUsd, sourceClass: "VELMERE_DERIVED" as const, evidenceRefs: [evidenceRef], observedAt: null })),
      ...args.alerts.slice(0, 6).map((alert) => ({ id: `alert-${alert.id}`, label: `Alert ${alert.id}`, value: alert.severity, sourceClass: "VELMERE_DERIVED" as const, evidenceRefs: [evidenceRef], observedAt: null })),
    ],
    assumptions: [
      { id: "transfer-not-trade", text: "A transfer is not proof of a buy, sale or market intention.", evidenceRefs: [] },
      { id: "label-needs-proof", text: "Entity attribution requires a current signed label artifact.", evidenceRefs: [] },
      { id: "unclassified-safe-state", text: "Unverified or expired labels remain UNCLASSIFIED.", evidenceRefs: [] },
    ],
    simulations: [{ id: "holder-exit-stress", text: "Holder exit stress is a simulation and is only shown when Market Impact evidence exists.", evidenceRefs: [evidenceRef] }],
    conflicts: args.labelErrors.map((error, index) => ({ id: `label-error-${index + 1}`, text: error, evidenceRefs: [evidenceRef] })),
    missingProof: [
      ...args.blockers,
      "continuous external monitoring and alert-delivery receipt",
      "operational label correction, dispute and expiry workflow",
      "trade-level evidence proving buy or sale intent",
    ],
    limitations: [
      "Transfer does not equal trade.",
      "Exchange inflow does not guarantee a sale.",
      "Entity attribution is withheld without a current signed label artifact.",
      "Whale activity is descriptive evidence, not investment advice.",
    ],
    nextSafeActions: reasonCards.map((reason) => reason.nextSafeAction),
  });

  return {
    schemaVersion: "velmere.standalone-customer-truth.v1",
    contractId: "pass36-a102r44p35-standalone-customer-truth",
    productId: "whale-watch",
    reportContextDepth: args.reportContextDepth ?? null,
    reportContextChangesExplanationOnly: true,
    truthState: resolveVlmTruthState({
      unavailable,
      fixtureOnly,
      stale: reasonCodes.includes("STALE_DATA"),
      conflicted: reasonCodes.includes("SOURCE_CONFLICT"),
      blockingReasons: reasonCards.filter((reason) => reason.severity === "BLOCK").length,
      evidenceCount: args.holderCount + args.transferCount,
    }),
    confidenceClass: resolveVlmConfidenceClass({
      calibrated: false,
      verified: !unavailable && !fixtureOnly,
      evidenceCount: args.providerFamilies.length,
    }),
    evidenceOrigins,
    facts: uniqueVlmTruthStrings([
      `holder_count=${args.holderCount}`,
      `transfer_count=${args.transferCount}`,
      `verified_label_holder_count=${args.verifiedLabelHolderCount}`,
      `unclassified_holder_count=${args.unclassifiedHolderCount}`,
      `verified_label_artifact_count=${args.verifiedLabelArtifactCount}`,
      ...args.flowWindows.map((window) => `${window.window}:events=${window.eventCount}:net_exchange_flow_usd=${window.netExchangeFlowUsd}`),
    ], 12),
    calculations: uniqueVlmTruthStrings([
      "holder concentration and HHI/Gini",
      "24h/7d/30d categorized flow aggregation",
      "holder-exit stress joined to Market Impact when available",
      ...args.alerts.slice(0, 4).map((alert) => `alert:${alert.id}:${alert.severity}`),
    ], 10),
    assumptions: [
      "Verified labels describe the signed artifact, not permanent real-world identity.",
      "Unverified, expired or invalid labels remain UNCLASSIFIED.",
      "A transfer can represent custody, treasury, bridge, collateral or internal movement.",
      "Exchange attribution does not prove an immediate market trade.",
    ],
    simulations: ["holder exit stress when a valid Market Impact snapshot exists"],
    conflicts: uniqueVlmTruthStrings([
      ...args.labelErrors,
      ...args.blockers.filter((value) => value.includes("mismatch") || value.includes("conflict")),
    ], 8),
    missingProof: uniqueVlmTruthStrings([
      ...args.blockers,
      "continuous external monitoring and alert-delivery receipt",
      "operational label correction, dispute and expiry workflow",
      "trade-level evidence proving buy or sale intent",
    ], 12),
    limitations: [
      "Transfer does not equal trade.",
      "Exchange inflow does not guarantee a sale.",
      "Entity attribution is withheld without a current signed label artifact.",
      "Whale activity is descriptive evidence, not investment advice.",
    ],
    nextSafeCheck: reasonCards.find((reason) => reason.severity === "BLOCK")?.nextSafeAction
      ?? reasonCards.find((reason) => reason.severity === "WATCH")?.nextSafeAction
      ?? "Inspect the destination, label provenance and subsequent on-chain flow before interpreting intent.",
    probabilityClaimAllowed: false,
    investmentRecommendationAllowed: false,
    leverageRecommendationAllowed: false,
    guaranteedOutcomeClaimAllowed: false,
    customerSummary: localizedSummary({
      locale,
      transferCount: args.transferCount,
      verifiedLabels: args.verifiedLabelHolderCount,
      unclassified: args.unclassifiedHolderCount,
      fixtureOnly,
    }),
    reasonCards,
    transferIsTradeClaimAllowed: false,
    buyOrSellIntentClaimAllowed: false,
    verifiedEntityAttributionRequiresSignedArtifact: true,
    unverifiedDisplayLabel: "UNCLASSIFIED",
    labelExpiryEnforced: true,
    labelSignatureEnforced: true,
    correctionWorkflowStatus: "DESIGNED_NOT_OPERATIONALLY_PROVEN",
    verifiedLabelArtifactCount: args.verifiedLabelArtifactCount,
    verifiedLabelHolderCount: args.verifiedLabelHolderCount,
    unclassifiedHolderCount: args.unclassifiedHolderCount,
    transferCount: args.transferCount,
    monitoringContinuityStatus: "MISSING_CONTINUOUS_EXTERNAL_MONITORING",
    contract,
  };
}
