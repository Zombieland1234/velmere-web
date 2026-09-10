import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2574AuditClaimLedgerReport, Pass2574EvidenceGrade } from "./audit-claim-ledger";
import type { Pass2589SourceFreshnessRecheckOrchestratorReport } from "./source-freshness-recheck-orchestrator";
import type { Pass2590RiskFormulaEvidenceWeightingContractReport } from "./risk-formula-evidence-weighting-contract";
import type { Pass2592ProviderConflictArbitrationMatrixReport, Pass2592ConflictState } from "./provider-conflict-arbitration-matrix";

export const PASS2593_EVIDENCE_NARRATIVE_CLAIM_LEDGER_EXPLAINABILITY_ID = "evidence-narrative-claim-ledger-explainability" as const;

export type Pass2593NarrativeState =
  | "fact_safe"
  | "qualified"
  | "missing_evidence"
  | "conflict"
  | "operator_only"
  | "blocked";

export type Pass2593NarrativeFamily =
  | "identity"
  | "source_code"
  | "permissions"
  | "liquidity"
  | "holders"
  | "market"
  | "freshness"
  | "score"
  | "delivery";

export type Pass2593NarrativeRow = {
  id: string;
  family: Pass2593NarrativeFamily;
  label: string;
  state: Pass2593NarrativeState;
  claim: string;
  whyItMatters: string;
  customerLine: string;
  proPdfLine: string;
  operatorLine: string;
  evidence: string[];
  missing: string[];
  confidenceImpact: number;
  canShowAsFact: boolean;
  shouldDisplayPublicly: boolean;
  blocksFinalSign: boolean;
};

export type Pass2593PublicRow = {
  label: string;
  state: Pass2593NarrativeState;
  output: string;
};

export type Pass2593EvidenceNarrativeClaimLedgerExplainabilityReport = {
  passId: typeof PASS2593_EVIDENCE_NARRATIVE_CLAIM_LEDGER_EXPLAINABILITY_ID;
  generatedAt: string;
  locale: string;
  target: {
    chain: string;
    contractAddress?: string;
    projectName?: string;
  };
  rule: string;
  customerRule: string;
  proRule: string;
  operatorRule: string;
  summary: {
    rows: number;
    factSafe: number;
    qualified: number;
    missingEvidence: number;
    conflicts: number;
    operatorOnly: number;
    blocked: number;
    publicRows: number;
    finalSignBlockers: number;
    explainabilityReadiness: number;
    confidenceNarrativeCap: number;
    canShowPlainLanguageSummary: boolean;
    canFinalSignNarrative: boolean;
    topNarrativeGap: string;
  };
  narrativeRows: Pass2593NarrativeRow[];
  customerRows: Pass2593PublicRow[];
  proPdfRows: Pass2593PublicRow[];
  operatorRows: Pass2593PublicRow[];
  explainabilityContract: {
    version: string;
    invariant: string;
    customerCopyRules: string[];
    proPdfRules: string[];
    operatorRules: string[];
  };
  visualMergeContract: {
    publicSlot: string;
    proPdfSlot: string;
    operatorSlot: string;
    rule: string;
    keepWired: string[];
    doNotExpose: string[];
  };
  nextImplementationBacklog: string[];
};

type BuilderInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  claimLedger?: Pass2574AuditClaimLedgerReport | null;
  providerConflictArbitrationMatrix?: Pass2592ProviderConflictArbitrationMatrixReport | null;
  riskFormulaEvidenceWeightingContract?: Pass2590RiskFormulaEvidenceWeightingContractReport | null;
  sourceFreshnessRecheckOrchestrator?: Pass2589SourceFreshnessRecheckOrchestratorReport | null;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(C0_OR_TEMPLATE_META_PATTERN, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function uniq(values: string[], max = 6) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).slice(0, max);
}

function familyFromClaim(category: string): Pass2593NarrativeFamily {
  if (category === "identity") return "identity";
  if (category === "source_code" || category === "docs_repo" || category === "public_audit") return "source_code";
  if (category === "permissions" || category === "security_flags") return "permissions";
  if (category === "liquidity") return "liquidity";
  if (category === "holders") return "holders";
  if (category === "market") return "market";
  return "score";
}

function stateFromGrade(grade: Pass2574EvidenceGrade): Pass2593NarrativeState {
  if (grade === "confirmed") return "fact_safe";
  if (grade === "partial") return "qualified";
  if (grade === "blocked") return "blocked";
  if (grade === "missing") return "missing_evidence";
  return "operator_only";
}

function stateFromConflict(state: Pass2592ConflictState): Pass2593NarrativeState {
  if (state === "aligned") return "fact_safe";
  if (state === "partial_alignment" || state === "missing_counterparty" || state === "freshness_conflict") return "qualified";
  if (state === "needs_operator") return "operator_only";
  if (state === "blocked") return "blocked";
  return "conflict";
}

function confidenceImpactFor(state: Pass2593NarrativeState) {
  const table: Record<Pass2593NarrativeState, number> = {
    fact_safe: 0,
    qualified: 7,
    missing_evidence: 14,
    conflict: 22,
    operator_only: 18,
    blocked: 28,
  };
  return table[state];
}

function statusWord(locale: string, state: Pass2593NarrativeState) {
  if (state === "fact_safe") return t(locale, "fakt bezpieczny", "faktensicher", "fact-safe");
  if (state === "qualified") return t(locale, "z zastrzeżeniem", "eingeschraenkt", "qualified");
  if (state === "missing_evidence") return t(locale, "brakuje dowodu", "fehlender Beleg", "missing evidence");
  if (state === "conflict") return t(locale, "konflikt źródeł", "Quellenkonflikt", "source conflict");
  if (state === "blocked") return t(locale, "zablokowane", "blockiert", "blocked");
  return t(locale, "tylko operator", "nur Operator", "operator-only");
}

function why(locale: string, family: Pass2593NarrativeFamily, state: Pass2593NarrativeState) {
  if (state === "fact_safe") {
    return t(locale, "Ten element może być pokazany jako fakt, bo ma wystarczający stan dowodu.", "Dieses Element kann als Fakt gezeigt werden, weil der Belegzustand ausreicht.", "This element can be shown as a fact because the evidence state is sufficient.");
  }
  if (state === "conflict") {
    return t(locale, "Źródła nie mówią tego samego, więc narracja musi pokazać konflikt zamiast ukrywać go w score.", "Quellen widersprechen sich, daher muss die Narrative den Konflikt zeigen.", "Sources disagree, so the narrative must show the conflict instead of hiding it inside the score.");
  }
  if (family === "freshness") {
    return t(locale, "Świeżość danych wpływa na confidence i może wymusić re-check lub nową wersję raportu.", "Datenfrische beeinflusst Confidence und kann Re-check oder neue Version erzwingen.", "Freshness affects confidence and may require a re-check or a new report version.");
  }
  if (family === "score") {
    return t(locale, "Score musi wyjaśniać wagę dowodów i braki, inaczej wygląda jak losowa liczba.", "Der Score muss Gewichtung und Luecken erklaeren, sonst wirkt er zufaellig.", "The score must explain evidence weights and gaps, otherwise it looks like a random number.");
  }
  if (state === "missing_evidence") {
    return t(locale, "Brak dowodu nie oznacza automatycznie oszustwa, ale blokuje mocny werdykt.", "Fehlender Beleg bedeutet nicht automatisch Betrug, blockiert aber ein starkes Urteil.", "Missing evidence does not automatically mean fraud, but it blocks a strong verdict.");
  }
  return t(locale, "Ten claim wymaga kwalifikacji lub ręcznej weryfikacji przed mocnym werdyktem.", "Dieser Claim braucht Qualifizierung oder manuelle Pruefung.", "This claim needs qualification or manual review before a strong verdict.");
}

function publicLine(locale: string, label: string, state: Pass2593NarrativeState, missing: string[]) {
  const status = statusWord(locale, state);
  if (state === "fact_safe") return t(locale, `${label}: ${status}; może zostać pokazane jako potwierdzony element raportu.`, `${label}: ${status}; kann als bestaetigter Berichtsteil gezeigt werden.`, `${label}: ${status}; can be shown as a confirmed report element.`);
  if (state === "conflict") return t(locale, `${label}: ${status}; Velmère obniża confidence i pokazuje spór źródeł.`, `${label}: ${status}; Velmère senkt Confidence und zeigt den Quellenkonflikt.`, `${label}: ${status}; Velmère lowers confidence and shows the source dispute.`);
  if (state === "blocked") return t(locale, `${label}: ${status}; potrzebny provider, klucz lub operator.`, `${label}: ${status}; Provider, Key oder Operator noetig.`, `${label}: ${status}; provider, key or operator required.`);
  if (state === "operator_only") return t(locale, `${label}: ${status}; nie pokazujemy jako faktu w Basic.`, `${label}: ${status}; nicht als Fakt in Basic zeigen.`, `${label}: ${status}; not shown as a Basic fact.`);
  return t(locale, `${label}: ${status}; ${missing[0] || "potrzebne drugie źródło lub świeższe dane"}.`, `${label}: ${status}; ${missing[0] || "zweite Quelle oder frischere Daten noetig"}.`, `${label}: ${status}; ${missing[0] || "a second source or fresher data is needed"}.`);
}

function publicAllowed(state: Pass2593NarrativeState) {
  return state === "fact_safe" || state === "qualified" || state === "missing_evidence" || state === "conflict";
}

export function buildPass2593EvidenceNarrativeClaimLedgerExplainabilityReport(input: BuilderInput): Pass2593EvidenceNarrativeClaimLedgerExplainabilityReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? input.claimLedger?.target.chain ?? input.providerConflictArbitrationMatrix?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? input.claimLedger?.target.contractAddress ?? input.providerConflictArbitrationMatrix?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? input.claimLedger?.target.projectName ?? input.providerConflictArbitrationMatrix?.target.projectName;

  const claimRows: Pass2593NarrativeRow[] = (input.claimLedger?.claims ?? []).slice(0, 14).map((claim) => {
    const family = familyFromClaim(claim.category);
    const state = stateFromGrade(claim.grade);
    const missing = uniq(claim.missing.length ? claim.missing : [claim.canShowAsFact ? "" : "second independent evidence lane required"]);
    return {
      id: `claim-${claim.id}`,
      family,
      label: claim.label,
      state,
      claim: claim.claim,
      whyItMatters: why(locale, family, state),
      customerLine: publicLine(locale, claim.label, state, missing),
      proPdfLine: `${claim.label}; claim=${claim.claim}; grade=${claim.grade}; confidence=${claim.confidence}/100; factSafe=${claim.canShowAsFact}; missing=${missing.join(" | ") || "none"}`,
      operatorLine: `${claim.advancedAction} Confidence impact=${confidenceImpactFor(state)}. Source family=${claim.sourceFamily}.`,
      evidence: claim.canShowAsFact ? [claim.sourceFamily, claim.customerLine].filter(Boolean).slice(0, 3) : [],
      missing,
      confidenceImpact: confidenceImpactFor(state),
      canShowAsFact: claim.canShowAsFact && state === "fact_safe",
      shouldDisplayPublicly: publicAllowed(state),
      blocksFinalSign: state === "blocked" || state === "operator_only" || (state === "missing_evidence" && (family === "permissions" || family === "liquidity" || family === "source_code")),
    };
  });

  const conflictRows: Pass2593NarrativeRow[] = (input.providerConflictArbitrationMatrix?.conflictMatrix ?? []).slice(0, 10).map((row) => {
    const state = stateFromConflict(row.state);
    const family = row.family === "source_code" || row.family === "permissions" || row.family === "liquidity" || row.family === "holders" || row.family === "market" || row.family === "freshness" || row.family === "delivery" || row.family === "identity" ? row.family : "score";
    const missing = uniq(row.signals.flatMap((signal) => signal.missing).concat(row.action), 5);
    const evidence = uniq(row.signals.flatMap((signal) => signal.evidence).concat(row.primaryProvider), 5);
    return {
      id: `conflict-${row.id}`,
      family,
      label: row.label,
      state,
      claim: row.customerLine,
      whyItMatters: why(locale, family, state),
      customerLine: publicLine(locale, row.label, state, missing),
      proPdfLine: `${row.label}; conflict=${row.state}; severity=${row.severity}; riskDelta=${row.riskDelta}; confidencePenalty=${row.confidencePenalty}; providers=${[row.primaryProvider, ...row.counterpartyProviders].join("/")}`,
      operatorLine: `${row.operatorLine} Action=${row.action}. Blocks final=${row.blocksFinalSign}.`,
      evidence,
      missing,
      confidenceImpact: clamp(row.confidencePenalty, 0, 40),
      canShowAsFact: row.canShowAsFact && state === "fact_safe",
      shouldDisplayPublicly: publicAllowed(state),
      blocksFinalSign: row.blocksFinalSign,
    };
  });

  const riskRows: Pass2593NarrativeRow[] = input.riskFormulaEvidenceWeightingContract ? [
    {
      id: "score-risk-formula-explanation",
      family: "score",
      label: t(locale, "Score / confidence narrative", "Score / Confidence Narrative", "Score / confidence narrative"),
      state: input.riskFormulaEvidenceWeightingContract.summary.canIssueProScore ? "qualified" : "operator_only",
      claim: `finalRiskScore=${input.riskFormulaEvidenceWeightingContract.summary.finalRiskScore ?? "unavailable"}; confidence=${input.riskFormulaEvidenceWeightingContract.summary.formulaConfidence}; coverage=${input.riskFormulaEvidenceWeightingContract.summary.evidenceCoverage}`,
      whyItMatters: why(locale, "score", input.riskFormulaEvidenceWeightingContract.summary.canIssueProScore ? "qualified" : "operator_only"),
      customerLine: t(locale, `Score wynika z dowodów, braków i świeżości; confidence ${input.riskFormulaEvidenceWeightingContract.summary.formulaConfidence}/100.`, `Score basiert auf Belegen, Luecken und Freshness; Confidence ${input.riskFormulaEvidenceWeightingContract.summary.formulaConfidence}/100.`, `Score is derived from evidence, gaps and freshness; confidence ${input.riskFormulaEvidenceWeightingContract.summary.formulaConfidence}/100.`),
      proPdfLine: `riskFormula=${input.riskFormulaEvidenceWeightingContract.summary.finalRiskScore === null ? "unavailable" : `${input.riskFormulaEvidenceWeightingContract.summary.finalRiskScore}/100`}; confidence=${input.riskFormulaEvidenceWeightingContract.summary.formulaConfidence}/100; blockers=${input.riskFormulaEvidenceWeightingContract.summary.blockingLanes}`,
      operatorLine: `Do not present score without formula rows, blocker rows and freshness rows. Band=${input.riskFormulaEvidenceWeightingContract.summary.scoreBand}.`,
      evidence: [input.riskFormulaEvidenceWeightingContract.scoreBoundary],
      missing: input.riskFormulaEvidenceWeightingContract.summary.blockingLanes ? [`blocking lanes: ${input.riskFormulaEvidenceWeightingContract.summary.blockingLanes}`] : [],
      confidenceImpact: input.riskFormulaEvidenceWeightingContract.summary.canIssueProScore ? 6 : 18,
      canShowAsFact: false,
      shouldDisplayPublicly: true,
      blocksFinalSign: !input.riskFormulaEvidenceWeightingContract.summary.canFinalSignAdvancedScore,
    },
  ] : [];

  const freshnessRows: Pass2593NarrativeRow[] = input.sourceFreshnessRecheckOrchestrator ? [
    {
      id: "freshness-recheck-narrative",
      family: "freshness",
      label: t(locale, "Re-check / version narrative", "Re-check / Versionsnarrative", "Re-check / version narrative"),
      state: input.sourceFreshnessRecheckOrchestrator.summary.mustCreateNewVersion ? "qualified" : "fact_safe",
      claim: `next=${input.sourceFreshnessRecheckOrchestrator.summary.nextRecheckAt}; newVersion=${input.sourceFreshnessRecheckOrchestrator.summary.mustCreateNewVersion}`,
      whyItMatters: why(locale, "freshness", "qualified"),
      customerLine: t(locale, `Raport ma re-check ${input.sourceFreshnessRecheckOrchestrator.summary.nextRecheckAt}; istotna zmiana tworzy nową wersję, nie cichą edycję.`, `Bericht hat Re-check ${input.sourceFreshnessRecheckOrchestrator.summary.nextRecheckAt}; wesentliche Aenderung erzeugt neue Version.`, `Report has re-check ${input.sourceFreshnessRecheckOrchestrator.summary.nextRecheckAt}; material change creates a new version, not a silent edit.`),
      proPdfLine: `orchestratorReadiness=${input.sourceFreshnessRecheckOrchestrator.summary.orchestratorReadiness}; next=${input.sourceFreshnessRecheckOrchestrator.summary.nextRecheckAt}; newVersion=${input.sourceFreshnessRecheckOrchestrator.summary.mustCreateNewVersion}`,
      operatorLine: "If a source changes materially, append a new version and keep the old receipt immutable.",
      evidence: [input.sourceFreshnessRecheckOrchestrator.noSilentMutationRule],
      missing: input.sourceFreshnessRecheckOrchestrator.summary.blocked ? ["blocked re-check lane requires operator review"] : [],
      confidenceImpact: input.sourceFreshnessRecheckOrchestrator.summary.mustCreateNewVersion ? 10 : 2,
      canShowAsFact: !input.sourceFreshnessRecheckOrchestrator.summary.mustCreateNewVersion,
      shouldDisplayPublicly: true,
      blocksFinalSign: input.sourceFreshnessRecheckOrchestrator.summary.blocked > 0,
    },
  ] : [];

  const narrativeRows = [...claimRows, ...conflictRows, ...riskRows, ...freshnessRows].slice(0, 32);
  const factSafe = narrativeRows.filter((row) => row.state === "fact_safe").length;
  const qualified = narrativeRows.filter((row) => row.state === "qualified").length;
  const missingEvidence = narrativeRows.filter((row) => row.state === "missing_evidence").length;
  const conflicts = narrativeRows.filter((row) => row.state === "conflict").length;
  const operatorOnly = narrativeRows.filter((row) => row.state === "operator_only").length;
  const blocked = narrativeRows.filter((row) => row.state === "blocked").length;
  const publicRows = narrativeRows.filter((row) => row.shouldDisplayPublicly).length;
  const finalSignBlockers = narrativeRows.filter((row) => row.blocksFinalSign).length;
  const confidencePenalty = narrativeRows.reduce((sum, row) => sum + row.confidenceImpact, 0);
  const explainabilityReadiness = clamp(100 - (missingEvidence * 8 + conflicts * 10 + operatorOnly * 7 + blocked * 14), 0, 100);
  const confidenceNarrativeCap = clamp(100 - Math.ceil(confidencePenalty / 3), 20, 92);
  const topGap = narrativeRows.find((row) => row.blocksFinalSign)?.label ?? narrativeRows.find((row) => row.state !== "fact_safe")?.label ?? t(locale, "brak krytycznej luki", "keine kritische Luecke", "no critical gap");

  const customerRows = narrativeRows
    .filter((row) => row.shouldDisplayPublicly)
    .slice(0, 10)
    .map((row) => ({ label: row.label, state: row.state, output: row.customerLine }));
  const proPdfRows = narrativeRows.slice(0, 18).map((row) => ({ label: row.label, state: row.state, output: row.proPdfLine }));
  const operatorRows = narrativeRows.filter((row) => row.blocksFinalSign || row.state !== "fact_safe").slice(0, 16).map((row) => ({ label: row.label, state: row.state, output: row.operatorLine }));

  return {
    passId: PASS2593_EVIDENCE_NARRATIVE_CLAIM_LEDGER_EXPLAINABILITY_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { chain, ...(contractAddress ? { contractAddress } : {}), ...(projectName ? { projectName } : {}) },
    rule: "Every customer-facing claim must explain whether it is fact-safe, qualified, missing, conflicted or operator-only.",
    customerRule: t(locale, "Basic pokazuje proste wyjaśnienie: co jest faktem, co ma zastrzeżenie i czego brakuje.", "Basic zeigt einfach: was Fakt ist, was eingeschraenkt ist und was fehlt.", "Basic explains what is fact-safe, what is qualified and what is missing."),
    proRule: "Pro PDF gets the claim state, evidence reason, missing proof and confidence impact for each narrative row.",
    operatorRule: "Operator notes remain private; Basic/Pro never expose internal review notes, private pointers or debug/pass language.",
    summary: {
      rows: narrativeRows.length,
      factSafe,
      qualified,
      missingEvidence,
      conflicts,
      operatorOnly,
      blocked,
      publicRows,
      finalSignBlockers,
      explainabilityReadiness,
      confidenceNarrativeCap,
      canShowPlainLanguageSummary: publicRows >= 4 && blocked < 3,
      canFinalSignNarrative: finalSignBlockers === 0 && conflicts === 0 && blocked === 0,
      topNarrativeGap: topGap,
    },
    narrativeRows,
    customerRows,
    proPdfRows,
    operatorRows,
    explainabilityContract: {
      version: "pass2593.v1",
      invariant: "No customer-facing sentence may convert missing, partial or conflicted evidence into a fact.",
      customerCopyRules: [
        "Use plain language labels: fact-safe, qualified, missing evidence, source conflict.",
        "State uncertainty directly; never hide it behind score alone.",
        "Do not expose private operator notes, receipt internals or provider debug output.",
      ],
      proPdfRules: [
        "Show each claim state with reason, missing proof and confidence impact.",
        "Append conflicts and freshness limitations before the final risk narrative.",
        "Keep PDF customer-safe; private pointers stay in operator vault.",
      ],
      operatorRules: [
        "Resolve blockers before final sign-off.",
        "Do not upgrade a conflicted claim without a source-backed note.",
        "Material evidence changes require version bump and receipt replay.",
      ],
    },
    visualMergeContract: {
      publicSlot: "security.audit.basic.evidenceNarrativeExplainability",
      proPdfSlot: "security.audit.proPdf.claimNarrativeAppendix",
      operatorSlot: "security.audit.operator.narrativeResolutionQueue",
      rule: "Visual redesign can replace the cards, but must keep state, label, output, confidence cap and topNarrativeGap wired.",
      keepWired: ["summary.explainabilityReadiness", "summary.confidenceNarrativeCap", "summary.topNarrativeGap", "customerRows", "proPdfRows", "operatorRows"],
      doNotExpose: ["operatorLine", "private delivery pointers", "raw debug payload", "API keys", "seed phrase or exploit content"],
    },
    nextImplementationBacklog: [
      "PASS2594 — Manual resolution queue for conflicted narrative rows.",
      "PASS2595 — Customer-safe premium PDF wording cleanup and localization QA.",
      "PASS2596 — UI compact evidence timeline for mobile without scroll overload.",
      "PASS2597 — Regression fixtures for narrative text drift and overclaim detection.",
    ],
  };
}
