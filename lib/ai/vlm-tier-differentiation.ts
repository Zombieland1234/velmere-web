import type { VlmBrainOutput, VlmDepth, VlmLocale, VlmSurface } from "./vlm-contract";
import { detectPass2281AssetContract } from "./worldclass-output-contract";

export const PASS2174_VLM_TIER_DIFFERENTIATION_ID = "pass2174-vlm-tier-differentiation-v1" as const;
export const PASS2218_VLM_PRO_SIMPLIFICATION_ID = "pass2218-vlm-pro-three-lane-simplification-v1" as const;
export const PASS2783_VLM_COMMERCIAL_TIER_DIFFERENTIATION_ID = "pass2783-basic-free-pro-paid-advanced-paid-tier-differentiation" as const;

export type VlmTierFeature =
  | "summary_brief"
  | "priority_signals"
  | "source_freshness"
  | "missing_data"
  | "scenario_matrix"
  | "evidence_rows"
  | "contradiction_scan"
  | "what_would_change_my_mind"
  | "proof_capsule"
  | "operator_appendix";

export type VlmTierDifferentiationContract = {
  schemaVersion: typeof PASS2174_VLM_TIER_DIFFERENTIATION_ID;
  depth: VlmDepth;
  locale: VlmLocale;
  surface: VlmSurface | "browser" | "pdf";
  access: "free" | "paid_pro" | "paid_advanced";
  label: string;
  enginePromise: string;
  publicBoundary: string;
  brainBudget: {
    targetFindings: string;
    maxFacts: number;
    maxFindings: number;
    maxSources: number;
    maxContradictions: number;
    maxMissingData: number;
    maxNextChecks: number;
    maxOutputTokensHint: number;
  };
  pdfBudget: {
    pages: string;
    sections: string[];
    evidenceRows: number;
    includesAppendix: boolean;
    includesProofCapsule: boolean;
  };
  enabledFeatures: VlmTierFeature[];
  lockedFeatures: VlmTierFeature[];
  proofRule: string;
};

const TIER_ORDER: Record<VlmDepth, number> = { basic: 1, pro: 2, advanced: 3 };

function localizedCopy(locale: VlmLocale) {
  if (locale === "de") {
    return {
      basicLabel: "Basic — freie schnelle Prüfung",
      proLabel: "Pro — Einladungs-Beta mit verpflichtender manueller QA",
      advancedLabel: "Advanced — nicht zum Verkauf",
      basicPromise: "Kurzer menschlicher Risk Brief mit den wichtigsten sichtbaren Signalen und klaren Datenlücken; keine Rug-Pull- oder Squeeze-Schlüsse.",
      proPromise: "Einladungs-Beta mit bestätigten Signalen, Source Freshness, begrenzten Evidence Rows und nächsten Checks; vor jeder Lieferung ist manuelle QA Pflicht.",
      advancedPromise: "Lokaler Evidence Mode mit Contradiction Scan und Proof-Capsule-Struktur; nicht zum Verkauf und ohne Human-Review- oder Zertifizierungsclaim.",
      boundary: "Risikoprüfung ohne Anlageberatung, ROI-Versprechen oder Sicherheitszertifikat.",
      paid: "Public checkout is disabled: Pro is invitation-only beta with mandatory manual QA; Advanced is not for sale. Wallet connect is not release proof.",
    };
  }
  if (locale === "en") {
    return {
      basicLabel: "Basic — free fast review",
      proLabel: "Pro — invitation-only beta with mandatory manual QA",
      advancedLabel: "Advanced — not for sale",
      basicPromise: "Short human risk brief with the most visible signals and explicit data gaps; no rug-pull or squeeze conclusions.",
      proPromise: "Invitation-only beta lane with confirmed signals, source freshness, limited evidence rows and next checks; mandatory manual QA before any delivery.",
      advancedPromise: "Local evidence mode with contradiction scan and proof-capsule structure; not for sale and without human-review or certification claims.",
      boundary: "Risk review without investment advice, ROI promises or safety certification.",
      paid: "Public checkout is disabled: Pro is invitation-only beta with mandatory manual QA; Advanced is not for sale. Wallet connect is not release proof.",
    };
  }
  return {
    basicLabel: "Basic — darmowy szybki przegląd",
    proLabel: "Pro — beta na zaproszenie z obowiązkowym manual QA",
    advancedLabel: "Advanced — niedostępny w sprzedaży",
    basicPromise: "Krótki risk brief dla człowieka z najważniejszymi widocznymi sygnałami i jasnymi brakami danych; bez rug-pull/squeeze wniosków.",
    proPromise: "Beta Pro na zaproszenie z potwierdzonymi sygnałami, source freshness, ograniczonymi evidence rows i następnymi checkami; przed dostawą obowiązuje manual QA.",
    advancedPromise: "Lokalny evidence mode z contradiction scan i strukturą proof capsule; niedostępny w sprzedaży, bez claimu human-review i certyfikacji.",
    boundary: "Analiza ryzyka bez porady inwestycyjnej, obietnic ROI i certyfikatu bezpieczeństwa.",
    paid: "Publiczny checkout jest wyłączony: Pro jest wyłącznie betą na zaproszenie z obowiązkowym manual QA; Advanced nie jest na sprzedaż. Sam connect wallet nie jest dowodem dopuszczenia.",
  };
}

export function buildVlmTierDifferentiationContract(args: {
  depth: VlmDepth;
  locale?: VlmLocale;
  surface?: VlmSurface | "browser" | "pdf";
}): VlmTierDifferentiationContract {
  const locale = args.locale ?? "en";
  const depth = args.depth;
  const copy = localizedCopy(locale);
  if (depth === "basic") {
    return {
      schemaVersion: PASS2174_VLM_TIER_DIFFERENTIATION_ID,
      depth,
      locale,
      surface: args.surface ?? "shield",
      access: "free",
      label: copy.basicLabel,
      enginePromise: copy.basicPromise,
      publicBoundary: copy.boundary,
      brainBudget: {
        targetFindings: "8-10 concise supported findings",
        maxFacts: 10,
        maxFindings: 10,
        maxSources: 4,
        maxContradictions: 2,
        maxMissingData: 6,
        maxNextChecks: 4,
        maxOutputTokensHint: 1700,
      },
      pdfBudget: {
        pages: "1-2",
        sections: ["brief", "marketData", "sources", "missing", "next"],
        evidenceRows: 3,
        includesAppendix: false,
        includesProofCapsule: false,
      },
      enabledFeatures: ["summary_brief", "priority_signals", "source_freshness", "missing_data"],
      lockedFeatures: ["contradiction_scan", "what_would_change_my_mind", "proof_capsule", "operator_appendix"],
      proofRule: "Basic must stay short, useful and honest; it must not hide missing data or pretend to be a full audit.",
    };
  }
  if (depth === "pro") {
    return {
      schemaVersion: PASS2174_VLM_TIER_DIFFERENTIATION_ID,
      depth,
      locale,
      surface: args.surface ?? "shield",
      access: "paid_pro",
      label: copy.proLabel,
      enginePromise: copy.proPromise,
      publicBoundary: `${copy.boundary} ${copy.paid}`,
      brainBudget: {
        targetFindings: "10-12 supported findings grouped into confirmed signals, source freshness, limited evidence rows, gaps and next checks",
        maxFacts: 14,
        maxFindings: 12,
        maxSources: 6,
        maxContradictions: 4,
        maxMissingData: 8,
        maxNextChecks: 5,
        maxOutputTokensHint: 2100,
      },
      pdfBudget: {
        pages: "3-5",
        sections: ["brief", "marketData", "sources", "secondProvider", "missing", "next", "signature"],
        evidenceRows: 8,
        includesAppendix: false,
        includesProofCapsule: false,
      },
      enabledFeatures: [
        "summary_brief",
        "priority_signals",
        "source_freshness",
        "missing_data",
        "scenario_matrix",
        "evidence_rows",
        "contradiction_scan",
        "what_would_change_my_mind",
      ],
      lockedFeatures: ["proof_capsule", "operator_appendix"],
      proofRule: "Pro is invitation-only and requires mandatory manual QA before delivery; it stays simpler than Advanced: limited evidence rows, three decision lanes, no operator appendix and no proof-capsule claim.",
    };
  }
  return {
    schemaVersion: PASS2174_VLM_TIER_DIFFERENTIATION_ID,
    depth,
    locale,
    surface: args.surface ?? "shield",
    access: "paid_advanced",
    label: copy.advancedLabel,
    enginePromise: copy.advancedPromise,
    publicBoundary: `${copy.boundary} ${copy.paid}`,
    brainBudget: {
      targetFindings: "20+ supported findings when data allows; never pad unsupported findings",
      maxFacts: 30,
      maxFindings: 24,
      maxSources: 16,
      maxContradictions: 10,
      maxMissingData: 16,
      maxNextChecks: 12,
      maxOutputTokensHint: 3600,
    },
    pdfBudget: {
      pages: "8-12",
      sections: ["brief", "marketData", "sources", "secondProvider", "missing", "next", "signature", "proofCapsule", "operatorAppendix"],
      evidenceRows: 14,
      includesAppendix: true,
      includesProofCapsule: true,
    },
    enabledFeatures: [
      "summary_brief",
      "priority_signals",
      "source_freshness",
      "missing_data",
      "scenario_matrix",
      "evidence_rows",
      "contradiction_scan",
      "what_would_change_my_mind",
      "proof_capsule",
      "operator_appendix",
    ],
    lockedFeatures: [],
    proofRule: "Advanced is not for sale. Its local evidence mode may be tested, but no public checkout, customer delivery, human-review claim, certification claim or investment advice is allowed.",
  };
}

function appendSentence(value: string, sentence: string, max = 2200) {
  const compact = `${value.replace(/\s+/g, " ").trim()} ${sentence}`.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : compact.slice(0, Math.max(0, max - 3)).trimEnd() + "...";
}

function tierSentence(locale: VlmLocale, depth: VlmDepth) {
  if (locale === "de") {
    if (depth === "basic") return "Basic zeigt nur den schnellen, bestätigten Kern; Pro und Advanced vertiefen Quellen, Szenarien und Proofs.";
    if (depth === "pro") return "Pro ergänzt Quellenfrische, Szenarien und Datenlücken; Advanced bleibt für Proof Capsule und Operator-Anhang reserviert.";
    return "Advanced enthält Evidence Mode, Contradiction Scan und die wichtigste Bedingung, die die Einschätzung ändern würde.";
  }
  if (locale === "en") {
    if (depth === "basic") return "Basic shows only the fast confirmed core; Pro and Advanced expand sources, scenarios and proof structure.";
    if (depth === "pro") return "Pro adds source freshness, scenarios and data gaps; Advanced remains reserved for proof capsule and operator appendix.";
    return "Advanced includes evidence mode, contradiction scan and the most important condition that would change the assessment.";
  }
  if (depth === "basic") return "Basic pokazuje tylko szybki potwierdzony rdzeń; Pro i Advanced rozszerzają źródła, scenariusze i proof structure.";
  if (depth === "pro") return "Pro dodaje source freshness, scenariusze i braki danych; Advanced zostaje dla proof capsule i załącznika operatora.";
  return "Advanced zawiera evidence mode, contradiction scan i najważniejszy warunek, który mógłby zmienić ocenę.";
}

export function applyVlmBrainTierDifferentiation(output: VlmBrainOutput): VlmBrainOutput {
  const contract = buildVlmTierDifferentiationContract({ depth: output.depth, locale: output.locale, surface: "shield" });
  const budget = contract.brainBudget;
  const tierNote = tierSentence(output.locale, output.depth);
  const nextChecks = output.nextChecks.slice(0, budget.maxNextChecks);
  const assetContract = detectPass2281AssetContract(`${output.asset.symbol} ${output.asset.name} ${output.asset.assetClass}`);
  const realAssetBoundary = assetContract
    ? output.locale === "de"
      ? `${assetContract.canonical}: nicht anwendbar ohne Scope: ${assetContract.notApplicableWithoutScope.slice(0, 3).join(", ")}. Quellenlücken deckeln Konfidenz; sie sind kein Fake-Risiko.`
      : output.locale === "en"
        ? `${assetContract.canonical}: not applicable without scope: ${assetContract.notApplicableWithoutScope.slice(0, 3).join(", ")}. Source gaps cap confidence; they are not fake risk.`
        : `${assetContract.canonical}: nie dotyczy bez scope: ${assetContract.notApplicableWithoutScope.slice(0, 3).join(", ")}. Braki źródeł tną confidence; nie udają ryzyka.`
    : null;
  const advancedChangeMind = output.depth === "advanced"
    ? output.locale === "de"
      ? "Was die Einschätzung ändern würde: ein frischer unabhängiger Provider, bessere Liquiditätsdaten oder ein sauberer Widerspruch zum Hauptsignal."
      : output.locale === "en"
        ? "What would change the assessment: a fresh independent provider, stronger liquidity data or a clean contradiction to the leading signal."
        : "Co zmieniłoby ocenę: świeży niezależny provider, mocniejsze dane płynności albo czysty kontrdowód wobec głównego sygnału."
    : null;

  const report: VlmBrainOutput["report"] = {
    executiveSummary: appendSentence(output.report.executiveSummary, tierNote),
    marketStructure: output.report.marketStructure,
    liquidityAnalysis: output.report.liquidityAnalysis,
    holderAnalysis: output.depth === "basic"
      ? appendSentence(output.report.holderAnalysis, output.locale === "pl" ? "Basic nie udaje pełnego holder proof; pokazuje tylko widoczne ograniczenia." : output.locale === "de" ? "Basic simuliert keinen vollständigen Holder Proof; es zeigt nur sichtbare Grenzen." : "Basic does not pretend to be full holder proof; it shows only visible limits.")
      : output.report.holderAnalysis,
    contractAnalysis: output.report.contractAnalysis,
    sourceAssessment: appendSentence(output.report.sourceAssessment, `${contract.proofRule} ${realAssetBoundary ?? ""}`.trim()),
    riskScenarios: output.depth === "basic" ? output.report.riskScenarios.slice(0, 900) : output.report.riskScenarios,
    conclusion: appendSentence(output.report.conclusion, [advancedChangeMind ?? contract.publicBoundary, realAssetBoundary].filter(Boolean).join(" ")),
  };

  return {
    ...output,
    summary: appendSentence(output.summary, tierNote),
    facts: output.facts.slice(0, budget.maxFacts),
    keyFindings: output.keyFindings.slice(0, budget.maxFindings),
    contradictions: output.contradictions.slice(0, budget.maxContradictions),
    missingData: output.missingData.slice(0, budget.maxMissingData),
    nextChecks: (advancedChangeMind ? [...nextChecks, advancedChangeMind] : nextChecks).slice(0, budget.maxNextChecks),
    sources: output.sources.slice(0, budget.maxSources),
    report,
    diagnostics: {
      ...output.diagnostics,
      outputTokens: output.diagnostics?.outputTokens,
    },
  };
}

export function compareVlmTierDifferentiation(locale: VlmLocale = "en") {
  const tiers: VlmDepth[] = ["basic", "pro", "advanced"];
  return tiers.map((depth) => buildVlmTierDifferentiationContract({ depth, locale, surface: "shield" }));
}

export function isTierAtLeast(current: VlmDepth, minimum: VlmDepth) {
  return TIER_ORDER[current] >= TIER_ORDER[minimum];
}
