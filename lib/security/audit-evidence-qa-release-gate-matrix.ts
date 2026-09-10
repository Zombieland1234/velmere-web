import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2585PremiumProPdfTemplateContractReport } from "./premium-pro-pdf-template-contract";
import type { Pass2586AdvancedOperatorConsoleMergeReport } from "./advanced-operator-console-merge";
import type { Pass2587ServerPaymentAccountDeliveryGateReport } from "./server-payment-account-delivery-gate";
import type { Pass2589SourceFreshnessRecheckOrchestratorReport } from "./source-freshness-recheck-orchestrator";
import type { Pass2590RiskFormulaEvidenceWeightingContractReport } from "./risk-formula-evidence-weighting-contract";
import type { Pass2591RiskCalibrationGoldenFixtureHarnessReport } from "./risk-calibration-golden-fixture-harness";
import type { Pass2592ProviderConflictArbitrationMatrixReport } from "./provider-conflict-arbitration-matrix";
import type { Pass2593EvidenceNarrativeClaimLedgerExplainabilityReport } from "./evidence-narrative-claim-ledger-explainability";

export const PASS2594_AUDIT_EVIDENCE_QA_RELEASE_GATE_MATRIX_ID = "audit-evidence-qa-release-gate-matrix" as const;

export type Pass2594QaStatus = "pass" | "watch" | "fail" | "blocked" | "operator_review";
export type Pass2594QaLayer = "basic" | "pro_pdf" | "advanced" | "delivery" | "score" | "source" | "visual_merge";

export type Pass2594QaGate = {
  id: string;
  layer: Pass2594QaLayer;
  label: string;
  status: Pass2594QaStatus;
  severity: "low" | "medium" | "high" | "critical";
  customerLine: string;
  proPdfLine: string;
  operatorLine: string;
  evidenceRefs: string[];
  failureRefs: string[];
  fixAction: string;
  blocksBasicRelease: boolean;
  blocksProPdfRelease: boolean;
  blocksAdvancedFinalSign: boolean;
};

export type Pass2594QaRow = {
  label: string;
  status: Pass2594QaStatus;
  output: string;
};

export type Pass2594AuditEvidenceQaReleaseGateMatrixReport = {
  passId: typeof PASS2594_AUDIT_EVIDENCE_QA_RELEASE_GATE_MATRIX_ID;
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
    gates: number;
    pass: number;
    watch: number;
    fail: number;
    blocked: number;
    operatorReview: number;
    criticalBlockers: number;
    releaseReadiness: number;
    basicReleaseReadiness: number;
    proPdfReleaseReadiness: number;
    advancedFinalReadiness: number;
    canReleaseBasicPublic: boolean;
    canRenderProPdf: boolean;
    canReleaseAdvancedDeterministically: boolean;
    /** Legacy compatibility alias; identical to deterministic Advanced release readiness. */
    canFinalSignAdvanced: boolean;
    topReleaseBlocker: string;
  };
  gates: Pass2594QaGate[];
  customerRows: Pass2594QaRow[];
  proPdfRows: Pass2594QaRow[];
  operatorRows: Pass2594QaRow[];
  qaContract: {
    version: string;
    invariant: string;
    basicReleaseRules: string[];
    proPdfReleaseRules: string[];
    advancedReleaseRules: string[];
    regressionRules: string[];
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
  premiumProPdfTemplateContract?: Pass2585PremiumProPdfTemplateContractReport | null;
  advancedOperatorConsoleMerge?: Pass2586AdvancedOperatorConsoleMergeReport | null;
  serverPaymentAccountDeliveryGate?: Pass2587ServerPaymentAccountDeliveryGateReport | null;
  sourceFreshnessRecheckOrchestrator?: Pass2589SourceFreshnessRecheckOrchestratorReport | null;
  riskFormulaEvidenceWeightingContract?: Pass2590RiskFormulaEvidenceWeightingContractReport | null;
  riskCalibrationGoldenFixtureHarness?: Pass2591RiskCalibrationGoldenFixtureHarnessReport | null;
  providerConflictArbitrationMatrix?: Pass2592ProviderConflictArbitrationMatrixReport | null;
  evidenceNarrativeClaimLedgerExplainability?: Pass2593EvidenceNarrativeClaimLedgerExplainabilityReport | null;
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

function uniq(values: string[], max = 8) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).slice(0, max);
}

function readiness(gates: Pass2594QaGate[], filter: (gate: Pass2594QaGate) => boolean) {
  const scoped = gates.filter(filter);
  if (!scoped.length) return 0;
  const penalty = scoped.reduce((sum, gate) => {
    const value = gate.status === "pass" ? 0 : gate.status === "watch" ? 8 : gate.status === "operator_review" ? 14 : gate.status === "fail" ? 24 : 32;
    const severity = gate.severity === "critical" ? 1.25 : gate.severity === "high" ? 1.1 : gate.severity === "medium" ? 1 : 0.75;
    return sum + value * severity;
  }, 0);
  return clamp(100 - penalty / scoped.length, 0, 100);
}

function gate(args: Pass2594QaGate): Pass2594QaGate {
  return {
    ...args,
    evidenceRefs: uniq(args.evidenceRefs),
    failureRefs: uniq(args.failureRefs),
  };
}

function row(label: string, status: Pass2594QaStatus, output: string): Pass2594QaRow {
  return { label, status, output };
}

function statusFrom(ok: boolean, watch: boolean, hardBlock: boolean): Pass2594QaStatus {
  if (hardBlock) return "blocked";
  if (ok) return "pass";
  if (watch) return "watch";
  return "operator_review";
}

function rowState(status: Pass2594QaStatus, locale: string) {
  if (status === "pass") return t(locale, "zaliczone", "bestanden", "passed");
  if (status === "watch") return t(locale, "obserwuj", "beobachten", "watch");
  if (status === "fail") return t(locale, "niezaliczone", "fehlgeschlagen", "failed");
  if (status === "blocked") return t(locale, "zablokowane", "blockiert", "blocked");
  return t(locale, "operator", "Operator", "operator review");
}

export function buildPass2594AuditEvidenceQaReleaseGateMatrixReport(input: BuilderInput): Pass2594AuditEvidenceQaReleaseGateMatrixReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96);
  const projectName = clean(input.projectName || input.website || input.auditUrl, 140);

  const pdf = input.premiumProPdfTemplateContract;
  const delivery = input.serverPaymentAccountDeliveryGate;
  const recheck = input.sourceFreshnessRecheckOrchestrator;
  const formula = input.riskFormulaEvidenceWeightingContract;
  const calibration = input.riskCalibrationGoldenFixtureHarness;
  const conflicts = input.providerConflictArbitrationMatrix;
  const narrative = input.evidenceNarrativeClaimLedgerExplainability;

  const formulaOk = Boolean(formula?.summary.canShowBasicScore && formula.summary.formulaConfidence >= 45);
  const calibrationOk = Boolean(calibration?.summary.canIssueProCalibration && calibration.summary.maxDrift <= 16);
  const conflictOk = Boolean(conflicts && conflicts.summary.blockingConflicts === 0 && conflicts.summary.canShowUnifiedVerdict);
  const narrativeOk = Boolean(narrative && narrative.summary.explainabilityReadiness >= 45 && narrative.summary.canShowPlainLanguageSummary);
  const pdfOk = Boolean(pdf?.summary.canRenderCustomerPdf && !pdf.summary.debugCopyBlocked);
  const deliveryOk = Boolean(delivery?.summary.canOpenProDownload || delivery?.summary.canEnterAdvancedQueue);
  const advancedOk = Boolean(delivery?.summary.canDeliverAdvancedPrivately);
  const recheckOk = Boolean(recheck && !recheck.summary.mustCreateNewVersion && recheck.summary.orchestratorReadiness >= 45);

  const gates: Pass2594QaGate[] = [
    gate({
      id: "qa-no-random-risk-score",
      layer: "score",
      label: "No random risk score",
      status: statusFrom(formulaOk, Boolean(formula), !formula),
      severity: "critical",
      customerLine: formulaOk
        ? t(locale, "Score ma formułę, coverage i confidence cap.", "Score hat Formel, Coverage und Confidence-Cap.", "Score has formula, coverage and confidence cap.")
        : t(locale, "Score pozostaje ograniczony, dopóki formuła i coverage nie są wystarczające.", "Score bleibt begrenzt, bis Formel und Coverage ausreichen.", "Score stays limited until formula and coverage are sufficient."),
      proPdfLine: `Formula confidence ${formula?.summary.formulaConfidence ?? 0}/100; final risk ${formula?.summary.finalRiskScore ?? "n/a"}; blockers ${formula?.summary.blockingLanes ?? "n/a"}.`,
      operatorLine: "QA must fail any report that shows a confident score without formula, coverage and missing-evidence caps.",
      evidenceRefs: ["pass2590", "risk formula", "evidence coverage"],
      failureRefs: formulaOk ? [] : [formula?.summary.nextCriticalStep ?? "risk formula missing or too weak"],
      fixAction: "Raise formula coverage, lower confidence cap, or hide confident score until enough evidence exists.",
      blocksBasicRelease: !formulaOk,
      blocksProPdfRelease: !formulaOk,
      blocksAdvancedFinalSign: !formulaOk,
    }),
    gate({
      id: "qa-no-silent-provider-conflict",
      layer: "source",
      label: "No silent provider conflict",
      status: statusFrom(conflictOk, Boolean(conflicts), !conflicts),
      severity: conflicts?.summary.blockingConflicts ? "critical" : "high",
      customerLine: conflictOk
        ? t(locale, "Konflikty źródeł nie blokują skrótu Basic.", "Quellenkonflikte blockieren die Basic-Zusammenfassung nicht.", "Provider conflicts do not block the Basic summary.")
        : t(locale, "Jeżeli źródła się różnią, wynik musi pokazać konflikt i obniżyć confidence.", "Wenn Quellen abweichen, muss das Ergebnis den Konflikt zeigen und Confidence senken.", "If sources diverge, the result must show the conflict and lower confidence."),
      proPdfLine: `Conflict readiness ${conflicts?.summary.arbitrationReadiness ?? 0}/100; blocking conflicts ${conflicts?.summary.blockingConflicts ?? "n/a"}; penalty ${conflicts?.summary.totalConfidencePenalty ?? "n/a"}.`,
      operatorLine: "No silent majority vote: conflicts must be visible in operator rows before Pro/Advanced release.",
      evidenceRefs: ["pass2592", "conflict matrix"],
      failureRefs: conflictOk ? [] : [conflicts?.summary.nextCriticalConflict ?? "provider conflict arbitration missing"],
      fixAction: "Add counterparty provider, mark missing lane, or escalate to operator review.",
      blocksBasicRelease: false,
      blocksProPdfRelease: !conflictOk,
      blocksAdvancedFinalSign: !conflictOk,
    }),
    gate({
      id: "qa-plain-language-claim-ledger",
      layer: "basic",
      label: "Plain-language claim ledger",
      status: statusFrom(narrativeOk, Boolean(narrative), !narrative),
      severity: "high",
      customerLine: narrativeOk
        ? t(locale, "Raport tłumaczy fakty, braki i zastrzeżenia językiem klienta.", "Bericht erklaert Fakten, Luecken und Einschraenkungen kundenfreundlich.", "Report explains facts, gaps and limitations in customer language.")
        : t(locale, "Basic nie może pokazywać suchego score bez wyjaśnienia claimów.", "Basic darf keinen nackten Score ohne Claim-Erklaerung zeigen.", "Basic cannot show a bare score without claim explanation."),
      proPdfLine: `Explainability ${narrative?.summary.explainabilityReadiness ?? 0}/100; conflicts ${narrative?.summary.conflicts ?? "n/a"}; missing evidence ${narrative?.summary.missingEvidence ?? "n/a"}.`,
      operatorLine: "Customer copy must not convert missing/partial/conflict claims into facts.",
      evidenceRefs: ["pass2593", "claim ledger", "customer rows"],
      failureRefs: narrativeOk ? [] : [narrative?.summary.topNarrativeGap ?? "plain-language narrative missing"],
      fixAction: "Add customer-safe claim rows for facts, gaps and conflicts before release.",
      blocksBasicRelease: !narrativeOk,
      blocksProPdfRelease: !narrativeOk,
      blocksAdvancedFinalSign: !narrativeOk,
    }),
    gate({
      id: "qa-pro-pdf-customer-safe",
      layer: "pro_pdf",
      label: "Pro PDF customer-safe template",
      status: statusFrom(pdfOk, Boolean(pdf), !pdf),
      severity: "critical",
      customerLine: pdfOk
        ? t(locale, "PDF Pro ma sloty customer-safe i blokadę debug/operator języka.", "Pro-PDF hat kundenfreundliche Slots und blockiert Debug/Operator-Sprache.", "Pro PDF has customer-safe slots and blocks debug/operator language.")
        : t(locale, "PDF Pro nie może zawierać debugów, pass-logów ani prywatnego payloadu.", "Pro-PDF darf keine Debugs, Pass-Logs oder private Payloads enthalten.", "Pro PDF cannot contain debug text, pass logs or private payload."),
      proPdfLine: `PDF readiness ${pdf?.summary.proPdfReadiness ?? 0}/100; customer-safe ${pdf?.summary.customerSafeReadiness ?? 0}/100; debug blocked ${pdf?.summary.debugCopyBlocked ?? "n/a"}.`,
      operatorLine: "Pro PDF release gate requires customer-safe lines and redaction firewall before export.",
      evidenceRefs: ["pass2585", "customer PDF lines", "redaction firewall"],
      failureRefs: pdfOk ? [] : [pdf?.summary.nextCriticalStep ?? "premium PDF template missing"],
      fixAction: "Move operator/debug payload to operator rows and keep only contracted customer-safe lines in PDF.",
      blocksBasicRelease: false,
      blocksProPdfRelease: !pdfOk,
      blocksAdvancedFinalSign: !pdfOk,
    }),
    gate({
      id: "qa-payment-private-delivery-boundary",
      layer: "delivery",
      label: "Payment/account delivery boundary",
      status: statusFrom(deliveryOk, Boolean(delivery), !delivery),
      severity: "critical",
      customerLine: deliveryOk
        ? t(locale, "Dostęp płatny jest związany z receipt i kontem, nie z samym wallet connect.", "Bezahlter Zugang ist an Receipt und Konto gebunden, nicht nur Wallet Connect.", "Paid access is bound to receipt and account, not wallet connect alone.")
        : t(locale, "Pro/Advanced wymaga server-side receipt przed prywatną dostawą.", "Pro/Advanced braucht serverseitigen Receipt vor privater Lieferung.", "Pro/Advanced requires server-side receipt before private delivery."),
      proPdfLine: `Delivery readiness ${delivery?.summary.deliveryReadiness ?? 0}/100; Pro download ${delivery?.summary.proDownloadReadiness ?? 0}/100; account ${delivery?.summary.accountDeliveryReadiness ?? 0}/100.`,
      operatorLine: "Wallet identity is not payment proof; QA must fail replay-unsafe unlocks.",
      evidenceRefs: ["pass2587", "server receipt", "account delivery"],
      failureRefs: deliveryOk ? [] : [delivery?.summary.nextBlockingGate ?? "server receipt gate missing"],
      fixAction: "Require server-verified entitlement and replay-safe receipt before paid delivery.",
      blocksBasicRelease: false,
      blocksProPdfRelease: !deliveryOk,
      blocksAdvancedFinalSign: !deliveryOk,
    }),
    gate({
      id: "qa-recheck-version-mutation-boundary",
      layer: "delivery",
      label: "Re-check / version mutation boundary",
      status: statusFrom(recheckOk, Boolean(recheck), !recheck),
      severity: "high",
      customerLine: recheckOk
        ? t(locale, "Raport ma re-check plan i nie mutuje starej wersji po cichu.", "Bericht hat Re-check-Plan und mutiert alte Versionen nicht still.", "Report has a re-check plan and does not silently mutate old versions.")
        : t(locale, "Jeżeli źródła wygasły, system musi utworzyć nową wersję lub oznaczyć wynik jako ograniczony.", "Wenn Quellen ablaufen, muss das System neue Version erstellen oder Ergebnis begrenzen.", "If sources expire, the system must create a new version or mark the result limited."),
      proPdfLine: `Re-check readiness ${recheck?.summary.orchestratorReadiness ?? 0}/100; next ${recheck?.summary.nextRecheckAt ?? "n/a"}; new version ${recheck?.summary.mustCreateNewVersion ?? "n/a"}.`,
      operatorLine: "No silent mutation: stale source changes must create a new version, diff, or frozen receipt state.",
      evidenceRefs: ["pass2589", "scheduled re-check", "no silent mutation"],
      failureRefs: recheckOk ? [] : [recheck?.summary.nextBlockingLane ?? "re-check orchestrator missing"],
      fixAction: "Schedule re-check, freeze stale report, or issue new version with diff.",
      blocksBasicRelease: false,
      blocksProPdfRelease: !recheckOk,
      blocksAdvancedFinalSign: !recheckOk,
    }),
    gate({
      id: "qa-calibration-regression",
      layer: "score",
      label: "Calibration / regression fixture gate",
      status: statusFrom(calibrationOk, Boolean(calibration), !calibration),
      severity: "high",
      customerLine: calibrationOk
        ? t(locale, "Score przechodzi fixture’y kalibracyjne bez nadmiernego driftu.", "Score besteht Kalibrierungs-Fixtures ohne zu starken Drift.", "Score passes calibration fixtures without excessive drift.")
        : t(locale, "Zmiana silnika wymaga fixture’y, żeby wynik nie dryfował.", "Engine-Aenderung braucht Fixtures, damit der Score nicht driftet.", "Engine changes need fixtures so the score does not drift."),
      proPdfLine: `Calibration readiness ${calibration?.summary.calibrationReadiness ?? 0}/100; max drift ${calibration?.summary.maxDrift ?? "n/a"}; failed ${calibration?.summary.failed ?? "n/a"}.`,
      operatorLine: "Regression fixtures must pass before promoting formula or provider changes to release.",
      evidenceRefs: ["pass2591", "golden fixtures"],
      failureRefs: calibrationOk ? [] : [calibration?.summary.nextCriticalStep ?? "calibration fixture missing or drifting"],
      fixAction: "Add golden fixture coverage and block release when max drift exceeds threshold.",
      blocksBasicRelease: false,
      blocksProPdfRelease: !calibrationOk,
      blocksAdvancedFinalSign: !calibrationOk,
    }),
    gate({
      id: "qa-advanced-deterministic-delivery",
      layer: "advanced",
      label: "Advanced deterministic delivery controls",
      status: statusFrom(advancedOk, false, !advancedOk),
      severity: "critical",
      customerLine: advancedOk
        ? t(locale, "Advanced przeszedł deterministyczne bramki płatności, zakresu, redakcji, replay i prywatnej dostawy.", "Advanced hat die deterministischen Gates fuer Zahlung, Scope, Redaction, Replay und private Delivery bestanden.", "Advanced passed deterministic payment, scope, redaction, replay and private-delivery gates.")
        : t(locale, "Advanced nie może być tylko dłuższym AI tekstem; wymaga server receipt, zakresu, redakcji, replay i prywatnej ścieżki dostawy.", "Advanced darf nicht nur laengerer AI-Text sein; Server-Receipt, Scope, Redaction, Replay und private Delivery sind erforderlich.", "Advanced cannot be just longer AI text; it requires server receipt, scope, redaction, replay and a private delivery path."),
      proPdfLine: `Advanced deterministic delivery ${delivery?.summary.canDeliverAdvancedPrivately ? "ready" : "blocked"}; delivery readiness ${delivery?.summary.deliveryReadiness ?? 0}/100; next ${delivery?.summary.nextBlockingGate ?? "missing"}.`,
      operatorLine: "Advanced delivery authority comes from deterministic server payment/scope/redaction/replay/private-queue gates; optional operator QA is observational only.",
      evidenceRefs: ["pass2587", "server payment/account delivery gate", "deterministic delivery state"],
      failureRefs: advancedOk ? [] : [delivery?.summary.nextBlockingGate ?? "deterministic Advanced delivery blocked"],
      fixAction: "Satisfy server receipt, entitlement scope, account/private-queue, redaction and replay gates before Advanced delivery.",
      blocksBasicRelease: false,
      blocksProPdfRelease: false,
      blocksAdvancedFinalSign: !advancedOk,
    }),
  ];

  const pass = gates.filter((item) => item.status === "pass").length;
  const watch = gates.filter((item) => item.status === "watch").length;
  const fail = gates.filter((item) => item.status === "fail").length;
  const blocked = gates.filter((item) => item.status === "blocked").length;
  const operatorReview = gates.filter((item) => item.status === "operator_review").length;
  const criticalBlockers = gates.filter((item) => item.severity === "critical" && (item.status === "blocked" || item.status === "fail" || item.blocksAdvancedFinalSign)).length;
  const basicReleaseReadiness = readiness(gates, (item) => item.blocksBasicRelease || item.layer === "basic" || item.layer === "score");
  const proPdfReleaseReadiness = readiness(gates, (item) => item.blocksProPdfRelease || item.layer === "pro_pdf" || item.layer === "source" || item.layer === "score");
  const advancedFinalReadiness = readiness(gates, (item) => item.blocksAdvancedFinalSign || item.layer === "advanced" || item.layer === "delivery");
  const releaseReadiness = clamp((basicReleaseReadiness + proPdfReleaseReadiness + advancedFinalReadiness) / 3, 0, 100);
  const topReleaseBlocker = gates.find((item) => item.status === "blocked" || item.status === "fail" || item.blocksAdvancedFinalSign)?.fixAction ?? t(locale, "Kontynuować live provider QA i visual merge.", "Live-Provider-QA und Visual-Merge fortsetzen.", "Continue live provider QA and visual merge.");

  const publicRows = gates.filter((item) => item.layer !== "advanced" || item.status !== "pass").slice(0, 8);

  return {
    passId: PASS2594_AUDIT_EVIDENCE_QA_RELEASE_GATE_MATRIX_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { chain, contractAddress, projectName },
    rule: "Every customer-visible audit result must pass release QA across source conflict, score formula, claim narrative, PDF safety, payment delivery, re-check and deterministic Advanced delivery authority.",
    customerRule: t(locale, "Velmère pokazuje tylko wynik, który przeszedł bramki QA: score, źródła, claimy, PDF, delivery i re-check.", "Velmère zeigt nur Ergebnisse, die QA-Gates fuer Score, Quellen, Claims, PDF, Delivery und Re-check bestehen.", "Velmère shows only results that pass QA gates for score, sources, claims, PDF, delivery and re-check."),
    proRule: "Pro PDF includes release QA rows and must not ship if customer-safe, conflict or formula gates fail.",
    operatorRule: "Advanced delivery is blocked until deterministic payment, scope, evidence sufficiency, redaction, conflict arbitration, replay and private-delivery gates pass; optional QA notes are non-gating.",
    summary: {
      gates: gates.length,
      pass,
      watch,
      fail,
      blocked,
      operatorReview,
      criticalBlockers,
      releaseReadiness,
      basicReleaseReadiness,
      proPdfReleaseReadiness,
      advancedFinalReadiness,
      canReleaseBasicPublic: !gates.some((item) => item.blocksBasicRelease),
      canRenderProPdf: !gates.some((item) => item.blocksProPdfRelease),
      canReleaseAdvancedDeterministically: !gates.some((item) => item.blocksAdvancedFinalSign),
      canFinalSignAdvanced: !gates.some((item) => item.blocksAdvancedFinalSign),
      topReleaseBlocker,
    },
    gates,
    customerRows: publicRows.map((item) => row(item.label, item.status, `${rowState(item.status, locale)} — ${item.customerLine}`)),
    proPdfRows: gates.map((item) => row(item.label, item.status, `${item.proPdfLine} Fix: ${item.fixAction}`)),
    operatorRows: gates.map((item) => row(item.label, item.status, `${item.operatorLine} Failure refs: ${item.failureRefs.join("; ") || "none"}`)),
    qaContract: {
      version: "pass2594.qa.release-gate.v1",
      invariant: "Release QA is a gate, not a decoration: failed or blocked evidence gates must reduce output certainty or block delivery.",
      basicReleaseRules: [
        "Basic may remain public, but cannot present missing/conflict/partial evidence as fact.",
        "Basic score must be capped by formula confidence, narrative gaps and missing evidence.",
        "Basic must never ask for wallet seed, private key, custody or active testing access.",
      ],
      proPdfReleaseRules: [
        "Pro PDF cannot contain debug, pass-log, private operator payload or API-key state.",
        "Pro PDF must show conflict/freshness/claim caveats when they affect confidence.",
        "Pro PDF download needs server-side entitlement or customer-safe test mode only.",
      ],
      advancedReleaseRules: [
        "Advanced final delivery requires server receipt, scope/consent, evidence sufficiency, redaction, replay safety and deterministic private-delivery readiness.",
        "Payment/account delivery cannot lower technical risk score or bypass deterministic evidence, redaction, replay or delivery blockers.",
        "Deterministic delivery must use the latest re-check/version receipt and must not mutate an older report silently.",
      ],
      regressionRules: [
        "Provider conflict, formula and narrative changes must run golden fixtures before release.",
        "Max score drift above threshold blocks Pro/Advanced promotion.",
        "Visual redesign must keep QA slot wiring instead of rebuilding the engine.",
      ],
    },
    visualMergeContract: {
      publicSlot: "Basic Audit -> Release QA Matrix",
      proPdfSlot: "Pro PDF -> Release QA Appendix / Quality Gate",
      operatorSlot: "Advanced Console -> Final QA Checklist",
      rule: "User visual redesign can replace layout, but must keep releaseReadiness, canReleaseBasicPublic, canRenderProPdf, canReleaseAdvancedDeterministically and topReleaseBlocker wired.",
      keepWired: [
        "summary.releaseReadiness",
        "summary.basicReleaseReadiness",
        "summary.proPdfReleaseReadiness",
        "summary.advancedFinalReadiness",
        "summary.canReleaseBasicPublic",
        "summary.canRenderProPdf",
        "summary.canReleaseAdvancedDeterministically",
        "summary.canFinalSignAdvanced",
        "summary.topReleaseBlocker",
        "customerRows",
        "proPdfRows",
        "operatorRows",
      ],
      doNotExpose: [
        "private operator notes",
        "raw provider payloads",
        "API keys / payment secrets",
        "debug/pass-log language in customer PDF",
      ],
    },
    nextImplementationBacklog: [
      "PASS2595 — real provider response schema fixtures with negative conflict samples.",
      "PASS2596 — Pro PDF visual-ready renderer contract with section IDs and no-debug assertion.",
      "PASS2597 — Optional Advanced QA console UI with deterministic delivery blockers and non-gating reviewer observations.",
      "PASS2598 — end-to-end release gate harness for Basic/Pro/Advanced parity.",
      "PASS2599 — local full build/typecheck and browser smoke pack once node_modules are available.",
    ],
  };
}
