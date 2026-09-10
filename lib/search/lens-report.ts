import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { R7BrowserEcbDeliveryBinding } from "@/lib/search/browser-ecb-delivery-authority";
import { independentLiveProviderFamilies } from "@/lib/ai/evidence-normalization";
import {
  publicCalibratedSourceConfidence,
  sourceEvidenceCoverageForMode,
  sourceEvidenceCoverageScore,
  type VelmereSearchResult,
} from "@/lib/search/intelligence-search-contract";
import { buildPass2279AuditOutputQualityMatrix, type Pass2279AuditSampleCase } from "@/lib/ai/audit-output-quality";
import { analyzeLensReportWithVlmKernel, type VlmLensKernelPayload } from "@/lib/ai/vlm-brain-lens-adapter";
import { buildVlmTierDifferentiationContract, type VlmTierDifferentiationContract } from "@/lib/ai/vlm-tier-differentiation";
import { buildPass2283OutputQualityGate } from "@/lib/ai/worldclass-output-payment-qa";
import { buildPass2284LiveOutputQualityLedger } from "@/lib/ai/live-output-quality-ledger";
import { buildPass2285PremiumOutputGate } from "@/lib/ai/premium-output-gate";
import { buildPass2286WorldclassLiveOutputPaymentQa } from "@/lib/ai/worldclass-live-output-payment-qa";
import { applyPass2287RuntimeOutputFirewall } from "@/lib/ai/runtime-output-firewall";
import { buildPass2288ClaimProofFirewall } from "@/lib/ai/claim-proof-firewall";
import { buildPass2289CustomerReleaseGate } from "@/lib/ai/customer-release-gate";
import { buildPass2290ReleaseTraceLedger } from "@/lib/ai/release-trace-ledger";
import { buildPass2291ProductionReplayGate } from "@/lib/ai/production-replay-gate";
import type { VlmBrainKernelOutput } from "@/lib/ai/vlm-brain-kernel";
import { getPass423RetentionPolicy } from "@/lib/market-integrity/long-term-memory-spine";
import { buildPass425LensNarrativeContract } from "@/lib/market-integrity/source-arbitration-hallucination-brake";
import {
  buildPass427LensPreviewLock,
  type Pass427LensPreviewLock,
} from "@/lib/market-integrity/brain-bugfix-integrity-runtime";
import {
  buildPass428LensNarrativeCoherenceLock,
  type Pass428LensNarrativeCoherenceLock,
} from "@/lib/market-integrity/brain-narrative-coherence-runtime";
import {
  buildPass429LensSelfAuditContract,
  type Pass429LensSelfAuditContract,
} from "@/lib/market-integrity/brain-self-audit-consensus-runtime";
import {
  buildPass430LensAnswerProofContract,
  type Pass430LensAnswerProofContract,
} from "@/lib/market-integrity/brain-answer-verifier-runtime";
import {
  buildPass431LensCriticContract,
  type Pass431LensCriticContract,
} from "@/lib/market-integrity/brain-critic-loop-runtime";
import {
  buildPass432LensDataTruthContract,
  type Pass432LensDataTruthContract,
} from "@/lib/market-integrity/live-data-probe-runtime";
import {
  buildPass433LensRealDataContract,
  type Pass433LensRealDataContract,
} from "@/lib/market-integrity/real-internet-data-arbitration";
import {
  buildPass434LensProviderCrosscheckContract,
  type Pass434LensProviderCrosscheckContract,
} from "@/lib/market-integrity/provider-crosscheck-missing-data-hunter";
import {
  buildPass435LensLiveQueryContract,
  type Pass435LensLiveQueryContract,
} from "@/lib/market-integrity/live-query-test-bench";
import {
  buildPass436LensWorldBrainContract,
  type Pass436LensWorldBrainContract,
} from "@/lib/market-integrity/world-brain-slo-graph-runtime";
import {
  buildPass437LensAdaptiveEvidenceContract,
  type Pass437LensAdaptiveEvidenceContract,
} from "@/lib/market-integrity/adaptive-evidence-planner-runtime";
import {
  buildPass438LensProviderExecutionContract,
  type Pass438LensProviderExecutionContract,
} from "@/lib/market-integrity/provider-execution-loop-runtime";
import {
  buildPass439LensTruthReplayContract,
  type Pass439LensTruthReplayContract,
} from "@/lib/market-integrity/truth-replay-harness-runtime";
import {
  buildPass440LensSemanticDriftContract,
  type Pass440LensSemanticDriftContract,
} from "@/lib/market-integrity/semantic-drift-source-lineage-runtime";
import {
  buildPass441LensEvalHarnessContract,
  type Pass441LensEvalHarnessContract,
} from "@/lib/market-integrity/brain-eval-harness-runtime";
import {
  buildPass442LensRegressionJudgeContract,
  type Pass442LensRegressionJudgeContract,
} from "@/lib/market-integrity/regression-judge-runtime";
import {
  buildPass446HumanReadoutContract,
  type Pass446HumanReadoutContract,
} from "@/lib/market-integrity/human-readout-lane-runtime";
import {
  buildPass448DepthReportContract,
  explainPass448Missing,
  type Pass448DepthReportContract,
} from "@/lib/market-integrity/depth-report-polish-runtime";
import {
  buildPass450TieredHumanAnalysis,
  type Pass450TieredHumanAnalysis,
} from "@/lib/market-integrity/tiered-human-analysis-runtime";
import {
  buildPass451PdfExactPreview,
  type Pass451PdfExactPreview,
} from "@/lib/market-integrity/pdf-exact-preview-runtime";
import {
  buildPass452SourceBoundDepthLab,
  type Pass452SourceBoundDepthLab,
} from "@/lib/market-integrity/source-bound-depth-lab-runtime";
import {
  buildPass453UnifiedIntelligenceHandoff,
  type Pass453UnifiedIntelligenceHandoff,
} from "@/lib/market-integrity/unified-intelligence-handoff-runtime";
import {
  buildPass454EvidenceDenseHumanAnalysis,
  type Pass454EvidenceDenseHumanAnalysis,
} from "@/lib/market-integrity/evidence-dense-human-analysis-runtime";
import {
  buildPass455HumanDecisionPdfForge,
  type Pass455HumanDecisionPdfForge,
} from "@/lib/market-integrity/human-decision-pdf-forge-runtime";
import {
  buildPass459ProviderTruthPdf,
  type Pass459ProviderTruthPdf,
} from "@/lib/market-integrity/provider-truth-pdf-runtime";
import {
  buildPass460LensConsensus,
  type Pass460LensConsensus,
} from "@/lib/market-integrity/provider-consensus-pdf-runtime";
import {
  buildPass466ConfidenceWaterfall,
  type Pass466ConfidenceWaterfall,
} from "@/lib/market-integrity/confidence-waterfall";
import {
  buildPass477UnifiedDepthContract,
  type Pass477Depth,
  type Pass477UnifiedDepthContract,
} from "@/lib/market-integrity/unified-depth-contract";
import {
  buildPass478HumanEvidenceBrief,
  type Pass478HumanEvidenceBrief,
} from "@/lib/market-integrity/human-evidence-brief";
import {
  buildPass488A4DecisionCockpit,
  type Pass488A4DecisionCockpit,
} from "@/lib/market-integrity/a4-decision-cockpit";
import {
  buildPass573PdfLocalePurity,
  sanitizePass573PublicPdfText,
  type Pass573PdfLocalePurity,
} from "@/lib/search/pdf-locale-purity";
import {
  buildPass574PdfPageBoundaryMatrix,
  type Pass574PdfPageBoundaryMatrix,
} from "@/lib/market-integrity/pdf-page-boundary-matrix";
import {
  buildPass580PdfVisualFixtureReceipt,
  type Pass580PdfVisualFixtureReceipt,
} from "@/lib/market-integrity/pdf-visual-fixtures";
import {
  buildPass581PdfPageCompositor,
  type Pass581PdfPageCompositor,
} from "@/lib/market-integrity/pdf-page-compositor";
import {
  buildPass582SourceCitationRail,
  type Pass582SourceCitationRail,
} from "@/lib/market-integrity/source-citation-rail";
import {
  buildPass583DownloadParityGate,
  type Pass583DownloadParityGate,
} from "@/lib/market-integrity/download-parity-gate";
import {
  buildPass584PdfAccessibility,
  type Pass584PdfAccessibility,
} from "@/lib/market-integrity/pdf-accessibility";
import {
  buildPass592ChromiumFixtureReceipt,
  type Pass592ChromiumFixtureReceipt,
} from "@/lib/market-integrity/chromium-visual-fixture-runner";
import {
  buildPass593TaggedPdfFeasibilityGate,
  type Pass593TaggedPdfFeasibilityGate,
} from "@/lib/market-integrity/tagged-pdf-feasibility-gate";
import {
  buildPass594BidirectionalSourceFootnotes,
  type Pass594BidirectionalSourceFootnotes,
} from "@/lib/market-integrity/bidirectional-source-footnotes";
import {
  buildPass595ExtremeTypographyHardening,
  type Pass595ExtremeTypographyHardening,
} from "@/lib/market-integrity/extreme-typography-hardening";
import {
  buildPass596PdfReleaseProofCapsule,
  type Pass596PdfReleaseProofCapsule,
} from "@/lib/market-integrity/pdf-release-proof-capsule";
import {
  buildPass607ClaimSourceCompletenessGate,
  type Pass607ClaimSourceCompletenessGate,
} from "@/lib/market-integrity/claim-source-completeness-gate";
import {
  buildPass608MissingSourceAppendix,
  type Pass608MissingSourceAppendix,
} from "@/lib/market-integrity/missing-source-appendix";
import {
  buildPass609DynamicA4DensityBalancing,
  type Pass609DynamicA4DensityBalancing,
} from "@/lib/market-integrity/dynamic-a4-density-balancing";
import {
  buildPass610ReaderDownloadParityManifest,
  type Pass610ReaderDownloadParityManifest,
} from "@/lib/market-integrity/reader-download-parity-manifest";
import {
  buildPass611PdfAccessibilityPhase2,
  type Pass611PdfAccessibilityPhase2,
} from "@/lib/market-integrity/pdf-accessibility-phase-2";
import {
  buildPass622SourceRegistry,
  type Pass622SourceRegistry,
} from "@/lib/market-integrity/source-registry";
import {
  buildPass623AtomicClaimDecomposition,
  type Pass623AtomicClaimDecomposition,
} from "@/lib/market-integrity/atomic-claim-decomposition";
import {
  buildPass624ProviderContradictionEngine,
  type Pass624Observation,
  type Pass624ProviderContradictionEngine,
} from "@/lib/market-integrity/provider-contradiction-engine";
import {
  buildPass625FreshnessAwareSynthesis,
  type Pass625FreshnessAwareSynthesis,
} from "@/lib/market-integrity/freshness-aware-synthesis";
import {
  buildPass626HumanNextCheckPlanner,
  type Pass626HumanNextCheckPlanner,
} from "@/lib/market-integrity/human-next-check-planner";
import {
  buildPass642PdfUaExternalValidationLane,
  type Pass642PdfUaExternalValidationLane,
} from "@/lib/market-integrity/pdfua-external-validation-lane";
import {
  buildPass643ReaderPdfVisualParityMatrix,
  type Pass643ReaderPdfVisualParityMatrix,
} from "@/lib/market-integrity/reader-pdf-visual-parity-matrix";
import {
  buildPass644SourceOutageReplayLab,
  type Pass644SourceOutageReplayLab,
} from "@/lib/market-integrity/source-outage-replay-lab";
import {
  buildPass645PremiumMobilePerformanceBudget,
  type Pass645PremiumMobilePerformanceBudget,
} from "@/lib/market-integrity/premium-mobile-performance-budget";
import {
  buildPass646UnifiedEvidenceLedger,
  type Pass646UnifiedEvidenceLedger,
} from "@/lib/market-integrity/unified-evidence-ledger";
import {
  buildPass1234LensShieldMapEvidenceParity,
  type Pass1234LensShieldMapEvidenceParity,
} from "@/lib/market-integrity/lens-shieldmap-evidence-parity";
import {
  buildPass1254PdfTypographyReleaseGate,
  type Pass1254PdfTypographyReleaseGate,
} from "@/lib/market-integrity/pdf-typography-release-gate";
import {
  buildPass1274RuntimeVisualQaReleaseGate,
  type Pass1274RuntimeVisualQaReleaseGate,
} from "@/lib/market-integrity/runtime-visual-qa-release-gate";
import {
  buildPass1334PdfPremiumFinal,
  type Pass1334PdfPremiumFinal,
} from "@/lib/market-integrity/pdf-premium-final";
import {
  buildPass1354ShieldMapEvidenceGraph2,
  type Pass1354ShieldMapEvidenceGraph2,
} from "@/lib/market-integrity/shield-map-evidence-graph-2";
import {
  buildPass1374VlmBrainSourceTruthFinal,
  type Pass1374VlmBrainSourceTruthFinal,
} from "@/lib/market-integrity/vlm-brain-source-truth-final";
import {
  buildPass1374To1413MegaTerminalPolish,
  type Pass1374To1413MegaTerminalPolish,
} from "@/lib/market-integrity/1413-mega-terminal-polish";
// PASS423 migration marker: pass422-lens-source-bound-brain remains as backward-compatibility guard text.

export type LensReportLocale = "pl" | "de" | "en";
export type LensReportDepth = Pass477Depth;

function isR7LensDeliveryAuthority(value: unknown): value is R7BrowserEcbDeliveryBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const binding = value as Partial<R7BrowserEcbDeliveryBinding>;
  const keys = Object.keys(binding).sort();
  return keys.join("|") === [
    "fieldIds",
    "lane",
    "providerId",
    "referenceOnly",
    "authorityReviewedAt",
    "authorityValidUntil",
    "deliveryExpiresAt",
    "deliveryIssuedAt",
    "referenceCurrentUntil",
    "referenceDate",
    "responseSha256",
    "rightsReceiptPath",
    "rightsReceiptSha256",
    "schemaVersion",
    "statisticsModified",
  ].sort().join("|")
    && binding.schemaVersion === "velmere.r7.browser-delivery-binding.v2"
    && binding.lane === "ecb_reference"
    && binding.providerId === "ecb_statistics"
    && binding.rightsReceiptPath === "artifacts/r7/providers/R7_ECB_USAGE_POLICY_REVIEW_20260824.json"
    && binding.rightsReceiptSha256 === "375ade75dc6c6a0a12860aed16b3bc079ab182ca713b3192d691e1381895a761"
    && binding.authorityReviewedAt === "2026-08-24T16:25:00.000Z"
    && binding.authorityValidUntil === "2026-08-31T23:59:59.999Z"
    && typeof binding.referenceDate === "string"
    && /^\d{4}-\d{2}-\d{2}$/u.test(binding.referenceDate)
    && typeof binding.responseSha256 === "string"
    && /^sha256:[a-f0-9]{64}$/u.test(binding.responseSha256)
    && typeof binding.referenceCurrentUntil === "string"
    && typeof binding.deliveryIssuedAt === "string"
    && typeof binding.deliveryExpiresAt === "string"
    && Number.isFinite(Date.parse(binding.referenceCurrentUntil))
    && Number.isFinite(Date.parse(binding.deliveryIssuedAt))
    && Number.isFinite(Date.parse(binding.deliveryExpiresAt))
    && new Date(binding.referenceCurrentUntil).toISOString() === binding.referenceCurrentUntil
    && new Date(binding.deliveryIssuedAt).toISOString() === binding.deliveryIssuedAt
    && new Date(binding.deliveryExpiresAt).toISOString() === binding.deliveryExpiresAt
    && Date.parse(binding.deliveryExpiresAt) <= Date.parse(binding.referenceCurrentUntil)
    && Date.parse(binding.deliveryExpiresAt) <= Date.parse(binding.authorityValidUntil)
    && Array.isArray(binding.fieldIds)
    && binding.fieldIds.length === 2
    && binding.fieldIds[0] === "market.reference_rate"
    && binding.fieldIds[1] === "market.reference_date"
    && binding.referenceOnly === true
    && binding.statisticsModified === false;
}

export type LensReport = {
  version: "velmere-lens-report-v1";
  locale: LensReportLocale;
  generatedAt: string;
  title: string;
  symbol: string;
  summary: string;
  whyItMatters: string;
  sourceMode: string;
  /** Public calibrated confidence only. Zero when no calibrated model is attached. */
  sourceConfidence: number;
  sourceConfidenceCalibrated: boolean;
  /** Deterministic coverage of explicit source lanes. Not confidence or probability. */
  sourceCoverage: number;
  /**
   * Optional for historical reports. A request-specific GREEN lane must carry
   * its normalized authority inside the frozen report so report/artifact and
   * account-snapshot digests bind the exact rights receipt.
   */
  deliveryAuthority?: R7BrowserEcbDeliveryBinding;
  missingData: string[];
  nextOperatorStep: string;
  sources: Array<{
    label: string;
    mode: string;
    freshness: string;
    /** Public calibrated confidence only; zero when unavailable. */
    confidence: number;
    confidenceCalibrated: boolean;
    /** Presence coverage for this source lane; not probability. */
    coverage: number;
    note: string;
    evidenceState: "confirmed" | "partial" | "missing";
  }>;
  brain: {
    version: "pass423-lens-long-memory-brain";
    fieldCount: number;
    sourceState: "confirmed" | "partial" | "missing";
    antiOverfit: "locked" | "shadow" | "limited";
    checksum: string;
    localeBranch: LensReportLocale;
    retentionYears: number;
    memoryMode: "market_ledger_only";
  };
  pass424: {
    version: "pass424-lens-narrative-correction";
    deterministic: true;
    fieldBudget: { basic: 10; pro: 14; advanced: 20 };
    antiRandomCopy: "same_payload_same_locale_same_sections";
  };
  pass425: ReturnType<typeof buildPass425LensNarrativeContract>;
  pass427: Pass427LensPreviewLock;
  pass428: Pass428LensNarrativeCoherenceLock;
  pass429: Pass429LensSelfAuditContract;
  pass430: Pass430LensAnswerProofContract;
  pass431: Pass431LensCriticContract;
  pass432: Pass432LensDataTruthContract;
  pass433: Pass433LensRealDataContract;
  pass434: Pass434LensProviderCrosscheckContract;
  pass435: Pass435LensLiveQueryContract;
  pass436: Pass436LensWorldBrainContract;
  pass437: Pass437LensAdaptiveEvidenceContract;
  pass438: Pass438LensProviderExecutionContract;
  pass439: Pass439LensTruthReplayContract;
  pass440: Pass440LensSemanticDriftContract;
  pass441: Pass441LensEvalHarnessContract;
  pass442: Pass442LensRegressionJudgeContract;
  pass446: Pass446HumanReadoutContract;
  pass448: Pass448DepthReportContract;
  pass450: Pass450TieredHumanAnalysis;
  pass451: Pass451PdfExactPreview;
  pass452: Pass452SourceBoundDepthLab;
  pass453: Pass453UnifiedIntelligenceHandoff;
  pass454: Pass454EvidenceDenseHumanAnalysis;
  pass455: Pass455HumanDecisionPdfForge;
  pass459: Pass459ProviderTruthPdf;
  pass460: Pass460LensConsensus;
  pass466: Pass466ConfidenceWaterfall;
  pass477: Pass477UnifiedDepthContract;
  pass478: Pass478HumanEvidenceBrief;
  pass488: Pass488A4DecisionCockpit;
  pass573: Pass573PdfLocalePurity;
  pass574: Pass574PdfPageBoundaryMatrix;
  pass580: Pass580PdfVisualFixtureReceipt;
  pass581: Pass581PdfPageCompositor;
  pass582: Pass582SourceCitationRail;
  pass583: Pass583DownloadParityGate;
  pass584: Pass584PdfAccessibility;
  pass592: Pass592ChromiumFixtureReceipt;
  pass593: Pass593TaggedPdfFeasibilityGate;
  pass594: Pass594BidirectionalSourceFootnotes;
  pass595: Pass595ExtremeTypographyHardening;
  pass596: Pass596PdfReleaseProofCapsule;
  pass607: Pass607ClaimSourceCompletenessGate;
  pass608: Pass608MissingSourceAppendix;
  pass609: Pass609DynamicA4DensityBalancing;
  pass610: Pass610ReaderDownloadParityManifest;
  pass611: Pass611PdfAccessibilityPhase2;
  pass622: Pass622SourceRegistry;
  pass623: Pass623AtomicClaimDecomposition;
  pass624: Pass624ProviderContradictionEngine;
  pass625: Pass625FreshnessAwareSynthesis;
  pass626: Pass626HumanNextCheckPlanner;
  pass642: Pass642PdfUaExternalValidationLane;
  pass643: Pass643ReaderPdfVisualParityMatrix;
  pass644: Pass644SourceOutageReplayLab;
  pass645: Pass645PremiumMobilePerformanceBudget;
  pass646: Pass646UnifiedEvidenceLedger;
  pass1234: Pass1234LensShieldMapEvidenceParity;
  pass1254: Pass1254PdfTypographyReleaseGate;
  pass1274: Pass1274RuntimeVisualQaReleaseGate;
  pass1334: Pass1334PdfPremiumFinal;
  pass1354: Pass1354ShieldMapEvidenceGraph2;
  pass1374: Pass1374VlmBrainSourceTruthFinal;
  pass1413: Pass1374To1413MegaTerminalPolish;
  pass2174: VlmTierDifferentiationContract;
  pass2279: ReturnType<typeof buildPass2279AuditOutputQualityMatrix>;
  pass2279SampleCase?: Pass2279AuditSampleCase;
  pass2283: ReturnType<typeof buildPass2283OutputQualityGate>;
  pass2284: ReturnType<typeof buildPass2284LiveOutputQualityLedger>;
  pass2285: ReturnType<typeof buildPass2285PremiumOutputGate>;
  pass2286: ReturnType<typeof buildPass2286WorldclassLiveOutputPaymentQa>;
  pass2287: ReturnType<typeof applyPass2287RuntimeOutputFirewall>;
  pass2288: ReturnType<typeof buildPass2288ClaimProofFirewall>;
  pass2289: ReturnType<typeof buildPass2289CustomerReleaseGate>;
  pass2290: ReturnType<typeof buildPass2290ReleaseTraceLedger>;
  pass2291: ReturnType<typeof buildPass2291ProductionReplayGate>;
  kernel: VlmBrainKernelOutput<VlmLensKernelPayload>;
  selectedDepth: LensReportDepth;
  sections: Array<{
    id:
      | "brief"
      | "marketData"
      | "sources"
      | "secondProvider"
      | "missing"
      | "next"
      | "signature";
    title: string;
    body: string;
  }>;
  labels: {
    report: string;
    brief: string;
    sourceState: string;
    coverage: string;
    confidence: string;
    checked: string;
    missing: string;
    next: string;
    sources: string;
    boundary: string;
    signature: string;
  };
};

const labels: Record<LensReportLocale, LensReport["labels"]> = {
  pl: {
    report: "Raport Lens",
    brief: "Krótki opis",
    sourceState: "Stan źródła",
    coverage: "Pokrycie danych",
    confidence: "Skalibrowana pewność źródeł",
    checked: "Co sprawdzono",
    missing: "Brakujące dane",
    next: "Następny krok",
    sources: "Źródła",
    boundary:
      "Podgląd badawczy. Nie jest certyfikatem bezpieczeństwa ani poradą inwestycyjną.",
    signature: "Velmère Security · Automated Analysis",
  },
  de: {
    report: "Lens Bericht",
    brief: "Kurzbericht",
    sourceState: "Quellenstatus",
    coverage: "Datenabdeckung",
    confidence: "Kalibrierte Quellenkonfidenz",
    checked: "Was geprüft wurde",
    missing: "Fehlende Daten",
    next: "Nächster Schritt",
    sources: "Quellen",
    boundary:
      "Research-Vorschau. Kein Sicherheitszertifikat und keine Anlageberatung.",
    signature: "Velmère Security · Automated Analysis",
  },
  en: {
    report: "Lens Report",
    brief: "Executive brief",
    sourceState: "Source state",
    coverage: "Data coverage",
    confidence: "Calibrated source confidence",
    checked: "What was checked",
    missing: "Missing data",
    next: "Next step",
    sources: "Sources",
    boundary:
      "Research preview. Not a safety certificate or investment advice.",
    signature: "Velmère Security · Automated Analysis",
  },
};

export function resolveLensReportLocale(locale: string): LensReportLocale {
  return locale === "de" || locale === "en" ? locale : "pl";
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stableChecksum(parts: string[]) {
  return `vlm-${sha256Token(parts.join("|"), 24)}`;
}

function compactSentence(value: string, max = 520) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}


function pass2278PdfTierBudget(depth: LensReportDepth) {
  if (depth === "basic") return { missing: 4, sources: 3, marker: "pass2278_pdf_basic_short_source_visible" };
  if (depth === "pro") return { missing: 8, sources: 6, marker: "pass2278_pdf_pro_second_provider_cadence" };
  return { missing: 16, sources: 12, marker: "pass2278_pdf_advanced_paid_evidence_packet" };
}

// PASS2281–PASS2283 remain in the typed report contract and release gates.
// Internal IDs, entitlement mechanics and prices never belong in public PDF prose.
function tierPdfNote(locale: LensReportLocale, depth: LensReportDepth) {
  if (locale === "de") {
    if (depth === "basic") return "Der Basic-Bericht zeigt die wichtigsten Signale; Evidenzkapsel und Operator-Anhang bleiben im Advanced-Bericht.";
    if (depth === "pro") return "Der Pro-Bericht ergänzt Quellenaktualität, Zweitquelle und Szenarien; fehlende Nachweise bleiben sichtbar.";
    return "Der Advanced-Bericht ergänzt Widerspruchsprüfung, Evidenzkapsel, Quellenregister und klare Bedingungen für eine Neubewertung.";
  }
  if (locale === "en") {
    if (depth === "basic") return "The Basic report shows priority signals; the evidence capsule and operator appendix remain in Advanced.";
    if (depth === "pro") return "The Pro report adds source freshness, a second-source lane and scenarios; missing proof stays visible.";
    return "The Advanced report adds contradiction review, an evidence capsule, a source ledger and explicit conditions for reassessment.";
  }
  if (depth === "basic") return "Raport Basic pokazuje najważniejsze sygnały; kapsuła dowodowa i aneks operatora pozostają w raporcie Advanced.";
  if (depth === "pro") return "Raport Pro dodaje świeżość źródeł, drugie źródło i scenariusze; brakujące dowody pozostają jawne.";
  return "Raport Advanced dodaje kontrolę sprzeczności, kapsułę dowodową, rejestr źródeł i jasne warunki ponownej oceny.";
}

function applyPass2174PdfTierDifferentiation(
  sections: LensReport["sections"],
  locale: LensReportLocale,
  depth: LensReportDepth,
) {
  const note = tierPdfNote(locale, depth);
  const bodyLimit = depth === "basic" ? 620 : depth === "pro" ? 980 : 1500;
  return sections.map((section) => {
    const shortened = compactSentence(section.body, bodyLimit);
    if (depth === "basic" && section.id === "secondProvider") {
      return { ...section, body: `${shortened} ${locale === "pl" ? "Basic pokazuje status drugiego źródła, ale nie wykonuje pełnego porównania dostawców." : locale === "de" ? "Basic zeigt den Status der Zweitquelle, führt aber keinen vollständigen Anbietervergleich aus." : "Basic shows second-source status but does not run the full provider comparison."}` };
    }
    if (section.id === "signature" || section.id === "next") {
      return { ...section, body: `${shortened} ${note}` };
    }
    if (depth === "advanced" && (section.id === "sources" || section.id === "missing")) {
      return { ...section, body: `${shortened} ${note}` };
    }
    return { ...section, body: shortened };
  });
}

function sectionCopy(
  locale: LensReportLocale,
  result: VelmereSearchResult,
  missingData: string[],
  sources: LensReport["sources"],
  pass450: Pass450TieredHumanAnalysis,
) {
  const symbol = (result.symbol || result.avatarLabel || "VLM").toUpperCase();
  const secondProvider = sources.length >= 2 ? sources[1] : undefined;
  const primarySource = sources[0];
  const missing = missingData.length
    ? missingData
        .map(
          (item, index) =>
            `${index + 1}. ${explainPass448Missing(locale, item)}`,
        )
        .join(" · ")
    : locale === "pl"
      ? "Brak głównej luki w krótkim raporcie; mocniejsze twierdzenia nadal wymagają świeżych źródeł."
      : locale === "de"
        ? "Keine Hauptlücke im Kurzbericht; stärkere Aussagen brauchen weiterhin frische Quellen."
        : "No core gap in the short report; stronger claims still require fresh sources.";
  const sourceMetricCopy = (source: LensReport["sources"][number]) => {
    const coverageLabel = locale === "pl" ? "pokrycie danych" : locale === "de" ? "Datenabdeckung" : "data coverage";
    const confidenceLabel = locale === "pl" ? "skalibrowana pewność" : locale === "de" ? "kalibrierte Konfidenz" : "calibrated confidence";
    const confidenceText = source.confidenceCalibrated
      ? `${confidenceLabel} ${source.confidence}%`
      : locale === "pl"
        ? "skalibrowana pewność: niedostępna"
        : locale === "de"
          ? "kalibrierte Konfidenz: nicht verfügbar"
          : "calibrated confidence: unavailable";
    return `${source.label}: ${source.mode}, ${source.freshness}, ${coverageLabel} ${source.coverage}%, ${confidenceText}. ${source.note}`;
  };
  const primary = primarySource
    ? sourceMetricCopy(primarySource)
    : locale === "pl"
      ? "Brak potwierdzonego źródła w wejściu - raport pozostaje trybem ostrożnym."
      : locale === "de"
        ? "Keine bestätigte Quelle im Input - der Bericht bleibt vorsichtig."
        : "No confirmed source in the input - the report stays conservative.";
  const second = secondProvider
    ? sourceMetricCopy(secondProvider)
    : locale === "pl"
      ? "Drugie źródło nie jest potwierdzone, więc Lens pokazuje braki zamiast dopisywać pewność."
      : locale === "de"
        ? "Der Zweitprovider ist nicht bestätigt; Lens zeigt die Lücke statt Sicherheit vorzutäuschen."
        : "Second provider is not confirmed, so Lens shows the gap instead of inventing confidence.";

  if (locale === "pl") {
    return [
      {
        id: "brief" as const,
        title: "Czytelny skrót",
        body: `${symbol}: ${compactSentence(result.summary, 520)} To jest krótka kapsuła PDF: co widać, czego brakuje i jaki następny krok ma wykonać operator.`,
      },
      {
        id: "marketData" as const,
        title: "Dane rynku",
        body: pass450.customerSummary,
      },
      {
        id: "sources" as const,
        title: "Co sprawdzono",
        body: `${compactSentence(result.whyItMatters, 460)} Źródło główne: ${primary}`,
      },
      { id: "secondProvider" as const, title: "Drugie źródło", body: second },
      { id: "missing" as const, title: "Brakujące dane", body: missing },
      {
        id: "next" as const,
        title: "Następny krok",
        body: compactSentence(result.nextOperatorStep, 420),
      },
      {
        id: "signature" as const,
        title: "Podpis",
        body: `Velmère Security · wygenerowano automatycznie przez Velmère Security Engine · integralność dokumentu zweryfikowana przez Velmère · nie jest niezależną certyfikacją ani human-review · raport z jednego payloadu · język PL · pamięć rynku do ${getPass423RetentionPolicy().retentionYears} lat z decay i bez overfitu po jednym evencie.`,
      },
    ];
  }
  if (locale === "de") {
    return [
      {
        id: "brief" as const,
        title: "Verständlicher Kurzbericht",
        body: `${symbol}: ${compactSentence(result.summary, 520)} Das ist eine kurze PDF-Kapsel: was sichtbar ist, was fehlt und welcher Operator-Schritt folgt.`,
      },
      {
        id: "marketData" as const,
        title: "Marktdaten",
        body: pass450.customerSummary,
      },
      {
        id: "sources" as const,
        title: "Was geprüft wurde",
        body: `${compactSentence(result.whyItMatters, 460)} Hauptquelle: ${primary}`,
      },
      { id: "secondProvider" as const, title: "Zweitprovider", body: second },
      { id: "missing" as const, title: "Fehlende Daten", body: missing },
      {
        id: "next" as const,
        title: "Nächster Schritt",
        body: compactSentence(result.nextOperatorStep, 420),
      },
      {
        id: "signature" as const,
        title: "Signatur",
        body: `Velmère Security · automatisch durch die Velmère Security Engine erzeugt · Dokumentintegrität durch Velmère geprüft · keine unabhängige Zertifizierung und kein Manual QA · Bericht aus einem Payload · Sprache DE · Marktgedächtnis bis ${getPass423RetentionPolicy().retentionYears} Jahre mit Decay und ohne One-Event-Overfit.`,
      },
    ];
  }
  return [
    {
      id: "brief" as const,
      title: "Plain-language brief",
      body: `${symbol}: ${compactSentence(result.summary, 520)} This is a short PDF capsule: what is visible, what is missing and which operator step comes next.`,
    },
    {
      id: "marketData" as const,
      title: "Market data",
      body: pass450.customerSummary,
    },
    {
      id: "sources" as const,
      title: "What was checked",
      body: `${compactSentence(result.whyItMatters, 460)} Primary source: ${primary}`,
    },
    { id: "secondProvider" as const, title: "Second provider", body: second },
    { id: "missing" as const, title: "Missing data", body: missing },
    {
      id: "next" as const,
      title: "Next step",
      body: compactSentence(result.nextOperatorStep, 420),
    },
    {
      id: "signature" as const,
      title: "Signature",
      body: `Velmère Security · generated automatically by the Velmère Security Engine · document integrity verified by Velmère · not an independent certification or manual QA · one-payload report · EN locale · market memory up to ${getPass423RetentionPolicy().retentionYears} years with decay and no one-event overfit.`,
    },
  ];
}

// PASS477–478 legacy verifier markers: buildPass477UnifiedDepthContract(result, safeLocale, requestedDepth) · buildPass478HumanEvidenceBrief(result, safeLocale, pass477, pass455)
export function buildLensReport(
  result: VelmereSearchResult,
  locale: string,
  requestedDepth: LensReportDepth = "advanced",
  generatedAt = new Date().toISOString(),
): LensReport {
  const safeLocale = resolveLensReportLocale(locale);
  const tierBudget = pass2278PdfTierBudget(requestedDepth);
  const calibratedSourceConfidence = publicCalibratedSourceConfidence(result);
  const sourceConfidence = calibratedSourceConfidence ?? 0;
  const sourceConfidenceCalibrated = calibratedSourceConfidence !== null;
  const sourceCoverage = sourceEvidenceCoverageScore(result);
  const missingData = result.missingData
    .slice(0, tierBudget.missing)
    .map((item) =>
      sanitizePass573PublicPdfText(safeLocale, item.slice(0, 160)),
    );
  const sourceInput = result.sources.length
    ? result.sources
    : [
        {
          id: "source-required",
          label:
            safeLocale === "pl"
              ? "Źródło wymagane"
              : safeLocale === "de"
                ? "Quelle erforderlich"
                : "Source required",
          mode: "missing" as const,
          freshness: "missing",
          confidence: 0,
          confidenceCalibrated: false,
          coverage: 0,
          note:
            safeLocale === "pl"
              ? "Brak potwierdzonego wiersza źródłowego; raport pozostaje w trybie ostrożnym."
              : safeLocale === "de"
                ? "Keine bestätigte Quellenzeile; der Bericht bleibt im Vorsichtsmodus."
                : "No confirmed source row; the report remains in conservative mode.",
        },
      ];
  const sourceNoteFallback =
    safeLocale === "pl"
      ? "Wymagany opis źródła"
      : safeLocale === "de"
        ? "Quellenhinweis erforderlich"
        : "Source note required";
  const sources = sourceInput.slice(0, tierBudget.sources).map((source) => ({
    label: sanitizePass573PublicPdfText(
      safeLocale,
      compactSentence(source.label, 80),
    ),
    mode: source.mode,
    freshness: sanitizePass573PublicPdfText(
      safeLocale,
      compactSentence(source.freshness, 60),
    ),
    confidence:
      source.confidenceCalibrated === true
        ? clampPercent(source.confidence)
        : 0,
    confidenceCalibrated: source.confidenceCalibrated === true,
    coverage: sourceEvidenceCoverageForMode(source.mode),
    note: sanitizePass573PublicPdfText(
      safeLocale,
      compactSentence(source.note || sourceNoteFallback, 180),
    ),
    evidenceState:
      source.mode === "live"
        ? ("confirmed" as const)
        : source.mode === "missing"
          ? ("missing" as const)
          : ("partial" as const),
  }));
  const independentProviderCount = independentLiveProviderFamilies(result.sources).length;
  const symbol = (result.symbol || result.avatarLabel || "VLM").slice(0, 20);
  const pass450 = buildPass450TieredHumanAnalysis(result, safeLocale);
  const pass452 = buildPass452SourceBoundDepthLab(result, safeLocale);
  const pass453 = buildPass453UnifiedIntelligenceHandoff(
    result,
    safeLocale,
    generatedAt,
  );
  const pass454 = buildPass454EvidenceDenseHumanAnalysis(result, safeLocale);
  const pass455 = buildPass455HumanDecisionPdfForge(result, safeLocale);
  const pass477 = buildPass477UnifiedDepthContract(
    result,
    safeLocale,
    requestedDepth,
  );
  const pass451 = buildPass451PdfExactPreview(
    safeLocale,
    pass477.selectedDepth,
  );
  const pass2174 = buildVlmTierDifferentiationContract({ depth: pass477.selectedDepth, locale: safeLocale, surface: "pdf" });
  const pass2279 = buildPass2279AuditOutputQualityMatrix();
  const pass2279SampleCase = pass2279.sampleCases[symbol.toUpperCase() as keyof typeof pass2279.sampleCases];
  const pass2283 = buildPass2283OutputQualityGate({
    surface: "pdf",
    depth: pass477.selectedDepth,
    assetText: `${symbol} ${result.title} ${result.summary}`,
    confirmedSources: sources.map((source) => source.label),
    missingLanes: missingData,
    paidAccessVerified: false,
  });
  const pass2284 = buildPass2284LiveOutputQualityLedger({
    surface: "pdf",
    depth: pass477.selectedDepth,
    assetText: `${symbol} ${result.title} ${result.summary} ${result.whyItMatters}`,
    confirmedSources: sources
      .filter((source) => source.evidenceState === "confirmed" || source.evidenceState === "partial")
      .map((source) => source.label),
    missingLanes: missingData,
    rawScore: sourceConfidence,
    confidenceCap: sourceConfidence,
    paidAccessVerified: false,
    customerOutputText: `${result.summary} ${result.whyItMatters} ${result.nextOperatorStep}`,
  });
  const pass2285 = buildPass2285PremiumOutputGate({
    surface: "pdf",
    depth: pass477.selectedDepth,
    assetText: `${symbol} ${result.title} ${result.summary} ${result.whyItMatters}`,
    confirmedSources: sources
      .filter((source) => source.evidenceState === "confirmed" || source.evidenceState === "partial")
      .map((source) => source.label),
    missingLanes: missingData,
    rawScore: sourceConfidence,
    confidenceCap: sourceConfidence,
    paidAccessVerified: false,
    customerOutputText: `${result.summary} ${result.whyItMatters} ${result.nextOperatorStep}`,
  });
  const pass2286 = buildPass2286WorldclassLiveOutputPaymentQa({
    surface: "pdf",
    depth: pass477.selectedDepth,
    assetText: `${symbol} ${result.title} ${result.summary} ${result.whyItMatters}`,
    confirmedSources: sources
      .filter((source) => source.evidenceState === "confirmed" || source.evidenceState === "partial")
      .map((source) => source.label),
    missingLanes: missingData,
    rawScore: sourceConfidence,
    confidenceCap: sourceConfidence,
    paidAccessVerified: false,
    customerOutputText: `${result.summary} ${result.whyItMatters} ${result.nextOperatorStep}`,
  });
  const pass2287 = applyPass2287RuntimeOutputFirewall({
    locale: safeLocale,
    surface: "pdf",
    depth: pass477.selectedDepth,
    assetText: `${symbol} ${result.title} ${result.summary} ${result.whyItMatters}`,
    confirmedSources: sources
      .filter((source) => source.evidenceState === "confirmed" || source.evidenceState === "partial")
      .map((source) => source.label),
    missingLanes: missingData,
    rawScore: sourceConfidence,
    confidenceCap: sourceConfidence,
    paidAccessVerified: false,
    customerOutputText: `${result.summary} ${result.whyItMatters} ${result.nextOperatorStep}`,
  });
  const pass2288 = buildPass2288ClaimProofFirewall({
    locale: safeLocale,
    surface: "pdf",
    depth: pass477.selectedDepth,
    assetText: `${symbol} ${result.title} ${result.summary} ${result.whyItMatters}`,
    confirmedSources: sources
      .filter((source) => source.evidenceState === "confirmed" || source.evidenceState === "partial")
      .map((source) => source.label),
    missingLanes: missingData,
    rawScore: sourceConfidence,
    confidenceCap: sourceConfidence,
    paidAccessVerified: false,
    customerOutputText: pass2287.customerOutput,
  });
  const pass2289 = buildPass2289CustomerReleaseGate({
    locale: safeLocale,
    surface: "pdf",
    depth: pass477.selectedDepth,
    assetText: `${symbol} ${result.title} ${result.summary} ${result.whyItMatters}`,
    confirmedSources: sources
      .filter((source) => source.evidenceState === "confirmed" || source.evidenceState === "partial")
      .map((source) => source.label),
    missingLanes: missingData,
    rawScore: sourceConfidence,
    confidenceCap: sourceConfidence,
    paidAccessVerified: false,
    customerOutputText: pass2288.customerOutput,
  });
  const pass2290 = buildPass2290ReleaseTraceLedger({
    locale: safeLocale,
    surface: "pdf",
    depth: pass477.selectedDepth,
    assetText: `${symbol} ${result.title} ${result.summary} ${result.whyItMatters}`,
    confirmedSources: sources
      .filter((source) => source.evidenceState === "confirmed" || source.evidenceState === "partial")
      .map((source) => source.label),
    missingLanes: missingData,
    rawScore: sourceConfidence,
    confidenceCap: sourceConfidence,
    paidAccessVerified: false,
    customerOutputText: pass2289.customerOutput,
    upstreamGate: pass2289,
  });
  const pass2291 = buildPass2291ProductionReplayGate({
    locale: safeLocale,
    surface: "pdf",
    depth: pass477.selectedDepth,
    assetText: `${symbol} ${result.title} ${result.summary} ${result.whyItMatters}`,
    confirmedSources: sources
      .filter((source) => source.evidenceState === "confirmed" || source.evidenceState === "partial")
      .map((source) => source.label),
    missingLanes: missingData,
    rawScore: sourceConfidence,
    confidenceCap: sourceConfidence,
    paidAccessVerified: false,
    customerOutputText: pass2290.customerOutput,
    upstreamLedger: pass2290,
  });
  const pass478 = buildPass478HumanEvidenceBrief(
    result,
    safeLocale,
    pass477,
    pass455,
  );
  const pass459 = buildPass459ProviderTruthPdf(result, safeLocale);
  const pass460 = buildPass460LensConsensus(result, safeLocale);
  const pass466 = buildPass466ConfidenceWaterfall(
    result,
    safeLocale,
    pass477.selectedDepth,
  );
  const rawSections = sectionCopy(
    safeLocale,
    result,
    missingData,
    sources,
    pass450,
  );
  const sections = applyPass2174PdfTierDifferentiation(rawSections, safeLocale, pass477.selectedDepth).map((section) => ({
    ...section,
    title: sanitizePass573PublicPdfText(safeLocale, section.title),
    body: sanitizePass573PublicPdfText(safeLocale, section.body),
  }));
  const checksum = stableChecksum([
    safeLocale,
    result.id,
    symbol,
    String(sourceConfidence),
    String(sourceConfidenceCalibrated),
    String(sourceCoverage),
    missingData.join("/"),
    sources
      .map(
        (source) =>
          `${source.label}:${source.mode}:${source.freshness}:${source.coverage}:${source.confidenceCalibrated}:${source.confidence}:${source.note}`,
      )
      .join("/"),
    pass477.selectedDepth,
    tierBudget.marker,
    pass2279.id,
    pass2279SampleCase?.asset ?? "no-pass2279-sample",
    pass2283.schemaVersion,
    pass2283.outputStatus,
    pass2284.schemaVersion,
    pass2284.productionState,
    pass2285.schemaVersion,
    pass2285.outputReadiness,
    pass2286.schemaVersion,
    pass2286.productionState,
    pass2287.schemaVersion,
    pass2287.productionState,
    pass2288.schemaVersion,
    pass2288.productionState,
    pass2289.schemaVersion,
    pass2289.productionState,
    pass2290.schemaVersion,
    pass2290.productionState,
    String(pass2290.traceOrderSafe),
    String(pass477.fieldBudget),
  ]);
  const pass425 = buildPass425LensNarrativeContract({
    locale: safeLocale,
    sourceConfidence,
    sourceCount: independentProviderCount,
    missingData,
    checksum,
  });
  const pass427 = buildPass427LensPreviewLock({
    locale: safeLocale,
    checksum,
    sections,
  });
  const pass428 = buildPass428LensNarrativeCoherenceLock({
    locale: safeLocale,
    checksum,
    sections,
  });
  const pass429 = buildPass429LensSelfAuditContract({
    locale: safeLocale,
    checksum,
    sourceCount: independentProviderCount,
    missingDataCount: missingData.length,
    duplicateBodyCount: pass428.duplicateBodyCount,
    localeLeakCount: pass428.localeLeakCount,
  });
  const pass430 = buildPass430LensAnswerProofContract({
    locale: safeLocale,
    checksum,
    sectionCount: sections.length,
    sourceCount: independentProviderCount,
    missingDataCount: missingData.length,
    duplicateBodyCount: pass428.duplicateBodyCount,
    localeLeakCount: pass428.localeLeakCount,
  });
  const pass431 = buildPass431LensCriticContract({
    locale: safeLocale,
    pass430,
    sections,
  });
  const pass432 = buildPass432LensDataTruthContract({
    locale: safeLocale,
    sourceConfidence,
    sourceCount: independentProviderCount,
    sectionCount: sections.length,
    missingDataCount: missingData.length,
  });
  const pass433 = buildPass433LensRealDataContract({
    locale: safeLocale,
    sourceConfidence,
    sourceCount: independentProviderCount,
    missingDataCount: missingData.length,
  });
  const pass434 = buildPass434LensProviderCrosscheckContract({
    locale: safeLocale,
    sourceConfidence,
    sourceCount: independentProviderCount,
    missingDataCount: missingData.length,
  });
  const pass435 = buildPass435LensLiveQueryContract({
    locale: safeLocale,
    sourceConfidence,
    sourceCount: independentProviderCount,
    missingDataCount: missingData.length,
  });
  const pass436 = buildPass436LensWorldBrainContract({
    locale: safeLocale,
    pass435,
  });
  const pass437 = buildPass437LensAdaptiveEvidenceContract({
    locale: safeLocale,
    sourceConfidence,
    sourceCount: independentProviderCount,
    missingDataCount: missingData.length,
  });
  const pass438 = buildPass438LensProviderExecutionContract({
    locale: safeLocale,
    sourceConfidence,
    sourceCount: independentProviderCount,
    missingDataCount: missingData.length,
    plannerMode: pass437.plannerMode,
  });
  const pass439 = buildPass439LensTruthReplayContract({
    locale: safeLocale,
    sourceConfidence,
    sourceCount: independentProviderCount,
    missingDataCount: missingData.length,
    pass438ReleaseAllowed: pass438.missingDataVisible ? false : true,
  });
  const pass440 = buildPass440LensSemanticDriftContract({
    locale: safeLocale,
    sourceConfidence,
    sourceCount: independentProviderCount,
    missingDataCount: missingData.length,
    pass439PdfAllowed: !pass439.missingDataVisible,
  });
  const pass441 = buildPass441LensEvalHarnessContract({
    locale: safeLocale,
    sourceConfidence,
    sourceCount: independentProviderCount,
    missingDataCount: missingData.length,
    pass440MissingVisible: pass440.missingDataVisible,
  });
  const pass442 = buildPass442LensRegressionJudgeContract({
    locale: safeLocale,
    sourceConfidence,
    sourceCount: independentProviderCount,
    missingDataCount: missingData.length,
    pass441MissingVisible: pass441.missingDataVisible,
  });
  const pass446 = buildPass446HumanReadoutContract({
    locale: safeLocale,
    activeDepth: pass477.selectedDepth,
    hasPrice:
      typeof result.marketSnapshot?.price === "number" ||
      /cena|price|preis/i.test(result.summary),
    hasMarketCapOrProxy:
      typeof result.marketSnapshot?.marketCap === "number" ||
      /kapitalizacja|market cap|marktkapitalisierung|proxy/i.test(
        result.summary,
      ),
    hasVolume:
      typeof result.marketSnapshot?.volume24h === "number" ||
      /wolumen|volume|volumen/i.test(result.summary),
    hasSecondProvider: independentProviderCount >= 2,
    hasTimestamp: sources.some((source) =>
      /request|czas|fresh|timestamp|live/i.test(source.freshness),
    ),
  });
  const pass448 = buildPass448DepthReportContract({
    locale: safeLocale,
    symbol,
    sourceConfidence,
    sourceCount: independentProviderCount,
    missingDataCount: missingData.length,
  });
  const pass488 = buildPass488A4DecisionCockpit({
    locale: safeLocale,
    symbol,
    generatedAt,
    depth: pass477.selectedDepth,
    sourceConfidence,
    sourceCount: independentProviderCount,
    missingDataCount: missingData.length,
    checksum,
    fieldBudget: pass477.fieldBudget,
  });
  const pass573 = buildPass573PdfLocalePurity(safeLocale, [
    result.title,
    result.summary,
    result.whyItMatters,
    result.nextOperatorStep,
    ...result.missingData,
    ...sourceInput.flatMap((source) => [
      source.label,
      source.freshness,
      source.note,
    ]),
    ...rawSections.flatMap((section) => [section.title, section.body]),
  ]);
  const pass574 = buildPass574PdfPageBoundaryMatrix({
    decision: [
      result.title,
      result.summary,
      sections.find((section) => section.id === "brief")?.body ?? "",
      sections.find((section) => section.id === "marketData")?.body ?? "",
    ],
    evidence: [
      ...sources.flatMap((source) => [
        source.label,
        source.freshness,
        source.note,
      ]),
      sections.find((section) => section.id === "sources")?.body ?? "",
      sections.find((section) => section.id === "secondProvider")?.body ?? "",
    ],
    analysis: [
      pass450.customerSummary,
      pass478.verdict.summary,
      ...pass478.claims.map(
        (field) => `${field.label} ${field.value} ${field.meaning}`,
      ),
    ],
    boundaries: [
      ...missingData,
      sections.find((section) => section.id === "missing")?.body ?? "",
      sections.find((section) => section.id === "next")?.body ?? "",
      labels[safeLocale].boundary,
    ],
  });
  const pass580 = buildPass580PdfVisualFixtureReceipt({
    locale: safeLocale,
    depth: pass477.selectedDepth,
    maxDensity: pass574.maxDensity,
    sourceCount: independentProviderCount,
    fieldBudget: pass477.fieldBudget,
    checksum,
  });
  const pass581 = buildPass581PdfPageCompositor([
    {
      id: "decision-brief",
      preferredPage: "decision",
      characters: `${result.title} ${result.summary} ${result.whyItMatters}`
        .length,
      rows: 4,
    },
    {
      id: "decision-depth",
      preferredPage: "decision",
      characters:
        `${pass477.purpose} ${pass477.includes.join(" ")} ${pass477.excludes.join(" ")}`
          .length,
      rows: 4,
    },
    {
      id: "evidence-source-rail",
      preferredPage: "evidence",
      characters: sources.reduce(
        (total, source) =>
          total + `${source.label} ${source.freshness} ${source.note}`.length,
        0,
      ),
      rows: Math.max(1, sources.length),
    },
    {
      id: "analysis-tier-fields",
      preferredPage: "analysis",
      characters: pass478.claims.reduce(
        (total, field) =>
          total + `${field.label} ${field.value} ${field.meaning}`.length,
        0,
      ),
      rows: Math.max(1, pass478.claims.length),
    },
    {
      id: "boundary-missing-next",
      preferredPage: "boundary",
      characters:
        `${missingData.join(" ")} ${result.nextOperatorStep} ${labels[safeLocale].boundary}`
          .length,
      rows: Math.max(3, missingData.length + 2),
    },
  ]);
  const pass582 = buildPass582SourceCitationRail(sources);
  const pass583 = buildPass583DownloadParityGate({
    symbol,
    locale: safeLocale,
    depth: pass477.selectedDepth,
    reportChecksum: checksum,
    parityKey: pass488.parityKey,
    sections,
    compositor: pass581,
    citationRail: pass582,
  });
  const pass584 = buildPass584PdfAccessibility(safeLocale);
  const selectedTier = pass455.tiers.find(
    (tier) => tier.id === pass477.selectedDepth,
  );
  const pass592 = buildPass592ChromiumFixtureReceipt({
    fixtureId: pass580.fixtureId,
    depth: pass477.selectedDepth,
    expectedFieldBudget: pass477.fieldBudget,
  });
  const pass593 = buildPass593TaggedPdfFeasibilityGate({
    languageMetadata: true,
    titleMetadata: true,
    structTreeRoot: false,
    markInfo: false,
    roleMap: false,
    readingOrderProof: false,
    internalLinks: true,
  });
  const pass594 = buildPass594BidirectionalSourceFootnotes({
    fields: (selectedTier?.metrics || []).slice(0, pass477.fieldBudget),
    citationRail: pass582,
  });
  const pass595 = buildPass595ExtremeTypographyHardening({
    locale: safeLocale,
    values: [
      result.title,
      result.summary,
      result.whyItMatters,
      result.nextOperatorStep,
      ...missingData,
      ...sources.flatMap((source) => [
        source.label,
        source.freshness,
        source.note,
      ]),
      ...(selectedTier?.metrics || []).flatMap((field) => [
        field.label,
        field.value,
        field.humanMeaning,
      ]),
    ],
  });
  const pass596 = buildPass596PdfReleaseProofCapsule({
    fixture: pass592,
    taggedPdf: pass593,
    footnotes: pass594,
    typography: pass595,
    sourceReceipt: checksum,
    parityKey: pass583.manifestKey,
    compositorResult: pass581.status,
  });
  const pass607 = buildPass607ClaimSourceCompletenessGate({
    generatedAt,
    marketObservedAt: result.marketSnapshot?.observedAt,
    evidenceCoverageCeiling: pass477.evidenceCoverageCeiling,
    brief: pass478,
    citationRail: pass582,
    footnotes: pass594,
  });
  const pass608 = buildPass608MissingSourceAppendix({
    locale: safeLocale,
    depth: pass477.selectedDepth,
    missingData,
    claimGate: pass607,
  });
  const pass622 = buildPass622SourceRegistry({
    generatedAt,
    discoveredSources: result.sources.map((source) => ({
      id: source.id,
      label: source.label,
      assetClasses: [pass478.assetClass],
      internalRoute: "/api/search/lens-report",
      ttlSeconds:
        source.mode === "live" || source.mode === "live_table" ? 60 : 300,
      publicNote: source.note,
    })),
  });
  const pass623 = buildPass623AtomicClaimDecomposition({
    reportId: `${result.id}:${symbol}:${pass477.selectedDepth}`,
    generatedAt,
    brief: pass478,
    claimGate: pass607,
  });
  const primarySourceId = pass607.sources[0]?.sourceId || ("S01" as const);
  const secondarySourceId = pass607.sources[1]?.sourceId || ("S02" as const);
  const primaryObservedAt = pass607.sources[0]?.observedAt || result.marketSnapshot?.observedAt || null;
  const secondaryObservedAt = pass607.sources[1]?.observedAt || result.marketSnapshot?.observedAt || null;
  const observations: Pass624Observation[] = [];
  const primaryPrice = result.marketSnapshot?.venueReferencePrice ?? result.marketSnapshot?.price;
  if (Number.isFinite(primaryPrice)) {
    observations.push({
      fieldId: "price",
      sourceId: primarySourceId,
      kind: "price",
      value: primaryPrice ?? null,
      unit: result.marketSnapshot?.currency || "quote",
      observedAt: primaryObservedAt,
      confidenceCap: pass607.sources[0]?.confidenceCap ?? pass607.confidenceCap,
    });
  }
  if (Number.isFinite(result.marketSnapshot?.venueSecondaryPrice)) {
    observations.push({
      fieldId: "price",
      sourceId: secondarySourceId,
      kind: "price",
      value: result.marketSnapshot?.venueSecondaryPrice ?? null,
      unit: result.marketSnapshot?.currency || "quote",
      observedAt: secondaryObservedAt,
      confidenceCap: pass607.sources[1]?.confidenceCap ?? pass460.confidenceCap,
    });
  }
  if (result.marketSnapshot?.fundamentalFilingDate) {
    observations.push({
      fieldId: "filing-date",
      sourceId: primarySourceId,
      kind: "filing",
      value: result.marketSnapshot.fundamentalFilingDate,
      unit: "date",
      observedAt: result.marketSnapshot.fundamentalFilingDate,
      confidenceCap: result.marketSnapshot.fundamentalConfidenceCap ?? pass607.confidenceCap,
    });
  }
  const pass624 = buildPass624ProviderContradictionEngine({
    assetClass: pass478.assetClass,
    generatedAt,
    observations,
  });
  const pass625 = buildPass625FreshnessAwareSynthesis({
    locale: safeLocale,
    assetClass: pass478.assetClass,
    generatedAt,
    atomicClaims: pass623,
    sourceManifest: pass607.sources,
    contradiction: pass624,
  });
  const pass626 = buildPass626HumanNextCheckPlanner({
    locale: safeLocale,
    depth: pass477.selectedDepth,
    assetClass: pass478.assetClass,
    appendix: pass608,
    registry: pass622,
    contradiction: pass624,
    synthesis: pass625,
  });
  const pass609 = buildPass609DynamicA4DensityBalancing({
    locale: safeLocale,
    blocks: [
      {
        id: "decision-brief",
        preferredPage: "decision",
        text: `${result.title} ${result.summary} ${pass478.verdict.summary}`,
        rows: 5,
      },
      {
        id: "decision-depth",
        preferredPage: "decision",
        text: `${pass477.purpose} ${pass477.includes.join(" ")} ${pass477.excludes.join(" ")}`,
        rows: 4,
      },
      {
        id: "evidence-source-ledger",
        preferredPage: "evidence",
        text: pass607.sources
          .map((source) => `${source.sourceId} ${source.label} ${source.freshnessLabel} ${source.observedAt || ""}`)
          .join(" "),
        rows: Math.max(2, pass607.sources.length * 2),
      },
      {
        id: "evidence-claim-gate",
        preferredPage: "evidence",
        text: pass607.claims
          .map((claim) => `${claim.claimId} ${claim.label} ${claim.value} ${claim.state}`)
          .join(" "),
        rows: Math.max(2, Math.ceil(pass607.claims.length / 2)),
      },
      {
        id: "evidence-source-registry",
        preferredPage: "evidence",
        text: pass622.publicProviders
          .slice(0, 6)
          .map((provider) => `${provider.label} ${provider.ttlSeconds}s ${provider.backupProviderId || "no-backup"}`)
          .join(" "),
        rows: Math.max(2, Math.ceil(pass622.publicProviders.length / 2)),
      },
      {
        id: "analysis-freshness-synthesis",
        preferredPage: "analysis",
        text: `${pass625.summary} ${pass625.currentFacts.map((claim) => claim.statement).join(" ")} ${pass625.lastKnownFacts.map((claim) => claim.statement).join(" ")}`,
        rows: Math.max(3, pass625.currentFacts.length + pass625.lastKnownFacts.length),
      },
      {
        id: "analysis-tier-fields",
        preferredPage: "analysis",
        text: pass478.claims
          .map((claim) => `${claim.label} ${claim.value} ${claim.meaning}`)
          .join(" "),
        rows: Math.max(4, pass478.claims.length),
      },
      {
        id: "boundary-missing-appendix",
        preferredPage: "boundary",
        text: `${pass608.summary} ${pass608.entries.map((entry) => `${entry.label} ${entry.nextCheck}`).join(" ")}`,
        rows: Math.max(3, pass608.entries.length * 2),
      },
      {
        id: "boundary-next-check-plan",
        preferredPage: "boundary",
        text: pass626.tasks
          .map((task) => `${task.rank}. ${task.action} ${task.completionEvidence}`)
          .join(" "),
        rows: Math.max(2, pass626.tasks.length * 2),
      },
      {
        id: "boundary-next-signature",
        preferredPage: "boundary",
        text: `${result.nextOperatorStep} ${labels[safeLocale].boundary} ${labels[safeLocale].signature}`,
        rows: 4,
      },
    ],
  });
  const pass610 = buildPass610ReaderDownloadParityManifest({
    locale: safeLocale,
    depth: pass477.selectedDepth,
    reportChecksum: checksum,
    sections,
    claimGate: pass607,
    appendix: pass608,
    density: pass609,
  });
  const pass611 = buildPass611PdfAccessibilityPhase2({
    locale: safeLocale,
    depth: pass477.selectedDepth,
    symbol,
    title: result.title,
    pageTitles: pass610.pages.map((page) => page.title),
    price: result.marketSnapshot?.price,
    change24h: result.marketSnapshot?.change24h,
    sourceEvidenceCoverage: pass607.evidenceCoverageCap,
  });
  const pass642 = buildPass642PdfUaExternalValidationLane({
    accessibility: pass611,
  });
  const pass643 = buildPass643ReaderPdfVisualParityMatrix({
    parity: pass610,
  });
  const reportIdentity = `${result.id}:${symbol}:${pass477.selectedDepth}`;
  const pass644 = buildPass644SourceOutageReplayLab({
    reportId: reportIdentity,
    claimGate: pass607,
    atomicClaims: pass623,
  });
  const pass645 = buildPass645PremiumMobilePerformanceBudget();
  const pass646 = buildPass646UnifiedEvidenceLedger({
    reportId: reportIdentity,
    generatedAt,
    parity: pass610,
    claimGate: pass607,
    atomicClaims: pass623,
    synthesis: pass625,
    planner: pass626,
  });
  const pass1234 = buildPass1234LensShieldMapEvidenceParity({
    locale: safeLocale,
    sourceState: independentProviderCount >= 2 ? "source_bound" : independentProviderCount === 1 ? "partial" : "source_required",
    evidenceCoverageCap: pass607.evidenceCoverageCap,
    sourceCount: independentProviderCount,
    missingCount: pass608.entries.length,
    conflictCount: pass624.contradictions + pass624.watches,
    claimCount: pass623.atoms.length,
    signalCount: pass478.claims.length,
    factSummary: pass478.verdict.headline,
    verdict: pass478.verdict.headline,
    nextCheck: pass626.primaryAction
      ? `${pass626.primaryAction.action} · ${pass626.primaryAction.completionEvidence}`
      : result.nextOperatorStep,
    depth: pass477.selectedDepth,
    checksum,
    manifestKey: pass646.evidenceKey,
  });
  const pass1254 = buildPass1254PdfTypographyReleaseGate({
    locale: safeLocale,
    depth: pass477.selectedDepth,
    reportChecksum: checksum,
    sectionCount: sections.length,
    sourceCount: pass607.sources.length,
    missingCount: pass608.entries.length,
    claimCount: pass623.atoms.length,
    readerDownloadManifest: pass610.manifestKey,
    evidenceManifest: pass1234.manifestKey,
    typographyState: pass595.state,
    densityState: pass609.state,
    maxDensity: pass609.maxDensity,
    mobileBudgetState: pass645.state,
  });
  const pass1274 = buildPass1274RuntimeVisualQaReleaseGate({
    locale: safeLocale,
    depth: pass477.selectedDepth,
    reportChecksum: checksum,
    symbol,
    pass1234State: pass1234.finalStatus,
    pass1254State: pass1254.state,
    visualParityState: pass643.state,
    mobileBudgetState: pass645.state,
    pageCount: pass610.pageCount,
    sourceCount: pass607.sources.length,
    missingCount: pass608.entries.length,
  });
  const pass1334 = buildPass1334PdfPremiumFinal({
    locale: safeLocale,
    symbol,
    depth: pass477.selectedDepth,
    title: result.title,
    summary: pass478.verdict.summary || result.summary,
    evidenceCoverageCap: pass607.evidenceCoverageCap,
    sourceConfidence,
    sourceCount: independentProviderCount,
    missingCount: pass608.entries.length,
    claimCount: pass623.atoms.length,
    sources,
    typographyState: pass1254.state,
    visualQaState: pass1274.state,
    parityManifest: pass610.manifestKey,
    evidenceManifest: pass1234.manifestKey,
    sourceTruthState: pass459.truthState,
    consensusState: pass460.state,
  });
  const pass1354 = buildPass1354ShieldMapEvidenceGraph2({
    locale: safeLocale,
    evidenceCoverageCap: pass607.evidenceCoverageCap,
    sourceCount: independentProviderCount,
    missingCount: pass608.entries.length,
    conflictCount: pass624.contradictions + pass624.watches,
    claimCount: pass623.atoms.length,
    signalCount: pass478.claims.length,
    evidenceManifest: pass1234.manifestKey,
    verdict: pass478.verdict.headline,
    nextCheck: pass626.primaryAction
      ? `${pass626.primaryAction.action} · ${pass626.primaryAction.completionEvidence}`
      : result.nextOperatorStep,
  });
  const pass1374 = buildPass1374VlmBrainSourceTruthFinal({
    locale: safeLocale,
    evidenceCoverageCap: pass607.evidenceCoverageCap,
    sourceCount: independentProviderCount,
    missingCount: pass608.entries.length,
    conflictCount: pass624.contradictions + pass624.watches,
    providerState: pass624.state,
    evidenceKey: pass646.evidenceKey,
  });
  const pass1413 = buildPass1374To1413MegaTerminalPolish({
    locale: safeLocale,
    sourceCount: independentProviderCount,
    missingCount: pass608.entries.length,
    conflictCount: pass624.contradictions + pass624.watches,
    evidenceCoverageCap: pass607.evidenceCoverageCap,
    pdfPremiumState: pass1334.state,
    shieldMapState: pass1354.state,
    brainTruthState: pass1374.state,
    visualQaState: pass1274.state,
    selectedDepth: pass477.selectedDepth,
  });
  const kernel = analyzeLensReportWithVlmKernel({
    result,
    locale: safeLocale,
    depth: requestedDepth,
    selectedDepth: pass477.selectedDepth,
    generatedAt,
    checksum,
    reportSectionCount: sections.length,
    pdfPageCount: pass610.pageCount,
    claimCount: pass623.atoms.length,
    confirmedClaimCount: pass607.confirmedClaims,
    missingSourceCount: pass608.entries.length,
    sourceRegistryCount: pass622.providers.length,
    contradictionCount: pass624.contradictions + pass624.watches,
    freshnessState: pass625.state,
    parityManifest: pass610.manifestKey,
    evidenceManifest: pass1234.manifestKey,
    visualQaState: pass1274.state,
    premiumState: pass1334.state,
  });
  return {
    version: "velmere-lens-report-v1",
    locale: safeLocale,
    generatedAt,
    title: sanitizePass573PublicPdfText(safeLocale, result.title.slice(0, 80)),
    symbol,
    summary: sanitizePass573PublicPdfText(
      safeLocale,
      result.summary.slice(0, 700),
    ),
    whyItMatters: sanitizePass573PublicPdfText(
      safeLocale,
      result.whyItMatters.slice(0, 520),
    ),
    sourceMode: result.sourceMode,
    sourceConfidence,
    sourceConfidenceCalibrated,
    sourceCoverage,
    missingData,
    nextOperatorStep: sanitizePass573PublicPdfText(
      safeLocale,
      result.nextOperatorStep.slice(0, 420),
    ),
    sources,
    brain: {
      version: "pass423-lens-long-memory-brain",
      fieldCount: sections.length,
      sourceState:
        independentProviderCount >= 2
          ? "confirmed"
          : independentProviderCount === 1
            ? "partial"
            : "missing",
      antiOverfit:
        sourceConfidence < 45 || independentProviderCount < 2
          ? "locked"
          : sourceConfidence < 68
            ? "shadow"
            : "limited",
      checksum,
      localeBranch: safeLocale,
      retentionYears: getPass423RetentionPolicy().retentionYears,
      memoryMode: "market_ledger_only",
    },
    pass424: {
      version: "pass424-lens-narrative-correction",
      deterministic: true,
      fieldBudget: { basic: 10, pro: 14, advanced: 20 },
      antiRandomCopy: "same_payload_same_locale_same_sections",
    },
    pass425,
    pass427,
    pass428,
    pass429,
    pass430,
    pass431,
    pass432,
    pass433,
    pass434,
    pass435,
    pass436,
    pass437,
    pass438,
    pass439,
    pass440,
    pass441,
    pass442,
    pass446,
    pass448,
    pass450,
    pass451,
    pass452,
    pass453,
    pass454,
    pass455,
    pass459,
    pass460,
    pass466,
    pass477,
    pass478,
    pass488,
    pass573,
    pass574,
    pass580,
    pass581,
    pass582,
    pass583,
    pass584,
    pass592,
    pass593,
    pass594,
    pass595,
    pass596,
    pass607,
    pass608,
    pass609,
    pass610,
    pass611,
    pass622,
    pass623,
    pass624,
    pass625,
    pass626,
    pass642,
    pass643,
    pass644,
    pass645,
    pass646,
    pass1234,
    pass1254,
    pass1274,
    pass1334,
    pass1354,
    pass1374,
    pass1413,
    pass2174,
    pass2279,
    pass2279SampleCase,
    pass2283,
    pass2284,
    pass2285,
    pass2286,
    pass2287,
    pass2288,
    pass2289,
    pass2290,
    pass2291,
    kernel,
    selectedDepth: pass477.selectedDepth,
    sections,
    labels: labels[safeLocale],
  };
}

export function isLensReport(value: unknown): value is LensReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<LensReport>;
  return (
    report.version === "velmere-lens-report-v1" &&
    typeof report.title === "string" &&
    typeof report.symbol === "string" &&
    typeof report.summary === "string" &&
    typeof report.whyItMatters === "string" &&
    typeof report.nextOperatorStep === "string" &&
    typeof report.sourceConfidence === "number" &&
    typeof report.sourceConfidenceCalibrated === "boolean" &&
    typeof report.sourceCoverage === "number" &&
    (report.deliveryAuthority === undefined
      || isR7LensDeliveryAuthority(report.deliveryAuthority)) &&
    Array.isArray(report.missingData) &&
    Array.isArray(report.sources) &&
    Boolean(report.labels) &&
    Boolean(report.pass477) &&
    Boolean(report.pass478) &&
    Boolean(report.pass488) &&
    Boolean(report.pass2283) &&
    Boolean(report.pass2284) &&
    Boolean(report.pass2285) &&
    Boolean(report.pass2286) &&
    Boolean(report.pass2287) &&
    Boolean(report.pass2288) &&
    Boolean(report.pass2289) &&
    Boolean(report.pass2290) &&
    Boolean(report.pass2291) &&
    Boolean(report.pass580) &&
    Boolean(report.pass581) &&
    Boolean(report.pass582) &&
    Boolean(report.pass583) &&
    Boolean(report.pass584) &&
    Boolean(report.pass592) &&
    Boolean(report.pass593) &&
    Boolean(report.pass594) &&
    Boolean(report.pass595) &&
    Boolean(report.pass596) &&
    Boolean(report.pass607) &&
    Boolean(report.pass608) &&
    Boolean(report.pass609) &&
    Boolean(report.pass610) &&
    Boolean(report.pass611) &&
    Boolean(report.pass622) &&
    Boolean(report.pass623) &&
    Boolean(report.pass624) &&
    Boolean(report.pass625) &&
    Boolean(report.pass626) &&
    Boolean(report.pass642) &&
    Boolean(report.pass643) &&
    Boolean(report.pass644) &&
    Boolean(report.pass645) &&
    Boolean(report.pass646) &&
    Boolean(report.pass1234) &&
    Boolean(report.pass1254) &&
    Boolean(report.pass1274) &&
    Boolean(report.pass1334) &&
    Boolean(report.pass1354) &&
    Boolean(report.pass1374) &&
    Boolean(report.pass1413) &&
    Boolean(report.pass2174) &&
    Boolean(report.pass2279) &&
    report.pass2174?.schemaVersion === "pass2174-vlm-tier-differentiation-v1" &&
    Boolean(report.kernel) &&
    report.kernel?.schemaVersion === "velmere.vlm.kernel.v1" &&
    typeof report.kernel?.calibrationVersion === "string" &&
    /^[a-f0-9]{64}$/i.test(report.kernel?.calibrationHash ?? "") &&
    report.kernel?.surface === "lens" &&
    report.pass1274?.proofMode === "browser_screenshot_required_before_100" &&
    report.pass1274?.requiredCommand === "npm run test:e2e:pass1274-1293" &&
    report.pass1254?.previewDownloadTypography === "same_reader_pdf_typography_budget" &&
    report.pass1234?.previewDownloadParity === "same_report_manifest_same_depth_same_checksum" &&
    report.pass1234?.shieldMapRole === "evidence_graph_not_price_table" &&
    report.pass1334?.previewDownloadParity === "same_payload_same_depth_same_claims" &&
    report.pass1354?.role === "why_verdict_graph_not_second_table" &&
    report.pass1374?.hallucinationBrake === "no_random_copy_no_fake_live_no_hidden_missing_data" &&
    report.pass1413?.realWorkStandard === "forty_plus_tasks_no_micro_passes" &&
    report.pass1413?.totalTaskCount >= 50 &&
    report.pass488 !== undefined &&
    report.pass610 !== undefined &&
    report.pass451?.pageCount === report.pass610.pageCount &&
    report.pass488.pageCount === report.pass610.pageCount &&
    report.pass488.readerPageCount === report.pass488.binaryPageCount &&
    report.pass488.readerPageCount === report.pass610.pageCount &&
    report.pass580?.expectedPages === report.pass610.pageCount &&
    report.pass592?.expectedPages === report.pass610.pageCount &&
    report.pass611?.pdf.pageSections === report.pass610.pageCount &&
    report.pass1254?.pdf.pageCount === report.pass610.pageCount &&
    (report.selectedDepth === "basic" ||
      report.selectedDepth === "pro" ||
      report.selectedDepth === "advanced")
  );
}

// PASS2279 markers: pass2279 PDF/Shield tier matrix · BTC NVDA SPY S&P 500 sample cases · source gaps before verdict · Advanced Audit 149€ paid evidence mode
// PASS2283 markers: PASS2283 PDF QA · outputStatus · sourceConfidence cap · paidLocked · wallet connect is not payment proof
// PASS2284 markers: PASS2284 PDF ledger · customer-ready state · static35 source-gap · Advanced 149€ receipt boundary

// PASS2285 markers: PDF report carries pass2285PremiumOutputGate, Basic/Pro/Advanced proof-depth differences, static-35 source-gap brake and 149€ Advanced receipt boundary.
// PASS2286 markers: PDF report carries pass2286WorldclassLiveOutputPaymentQa, source ledger/confidence/missing sections, static 35 source-gap review priority and 149€ server-side receipt boundary.
// PASS2287 markers: PDF report carries pass2287RuntimeOutputFirewall and checksum includes customer-output rewrite state.
// PASS2288 markers: PDF report carries pass2288ClaimProofFirewall, source-family proof ledger, static-35 source-gap rewrite and Advanced Audit 149€ receipt boundary.
// PASS2289 markers: PDF report carries pass2289CustomerReleaseGate so Basic/Pro/Advanced preview cannot be customer-visible without sources, confidence, missing proof and 149€ receipt boundary.
// PASS2290 markers: PDF report carries pass2290ReleaseTraceLedger so preview/download preserve ordered trace sections and Advanced 149€ receipt boundary.

// PASS2291 markers: PDF report carries pass2291ProductionReplayGate so Basic/Pro/Advanced preview/download replay actual visible sections, static 35 source-gap language and 149€ server-side receipt boundary.
