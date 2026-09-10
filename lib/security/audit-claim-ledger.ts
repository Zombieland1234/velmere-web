import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2570AuditSourceQuorumReport, Pass2570SourceState } from "./audit-source-quorum-runtime";
import type { Pass2572AuditProviderRuntimeReport, Pass2572RuntimeLane, Pass2572RuntimeState } from "./audit-provider-runtime-client";
import type { Pass2573AuditRuntimeConfidenceReport } from "./audit-runtime-confidence";
import { verifyAuditAdjudicatedAuthorityEvidence, type AuditAdjudicatedAuthorityEvidence } from "./audit-adjudicated-authority-evidence";
import type { P78Erc2771MulticallResult } from "./erc2771-multicall-context-detector";
import { verifyP79HistoricalDeploymentContextAdjudication, type P79HistoricalDeploymentContextAdjudication } from "./audit-deployment-context-adjudicator";
import {
  verifyP82CurrentDeploymentReadonlyQuorumReceiptFromEnvironment,
  type P82CurrentDeploymentReadonlyQuorumReceipt,
} from "./audit-current-deployment-readonly-quorum-v2";
import { sha256Digest } from "./cryptographic-digest";

export const PASS2574_AUDIT_CLAIM_LEDGER_ID = "audit-claim-ledger" as const;

export type Pass2574ClaimCategory =
  | "identity"
  | "source_code"
  | "permissions"
  | "liquidity"
  | "holders"
  | "market"
  | "public_audit"
  | "docs_repo"
  | "security_flags"
  | "runtime";

export type Pass2574EvidenceGrade =
  | "confirmed"
  | "partial"
  | "missing"
  | "blocked"
  | "not_run";

export type Pass2574AuditClaim = {
  id: string;
  category: Pass2574ClaimCategory;
  label: string;
  grade: Pass2574EvidenceGrade;
  sourceFamily: string;
  claim: string;
  customerLine: string;
  proPdfLine: string;
  advancedAction: string;
  canShowAsFact: boolean;
  confidence: number;
  missing: string[];
  adverseKind?: "deployment_identity" | "historical_exploit";
  findingKind?: "current_deployment_configuration";
  adverseRiskFloor?: number;
  adverseSeverity?: "watch" | "elevated" | "critical";
  evidenceRefs?: string[];
};

export type Pass2574AuditClaimLedgerReport = {
  passId: typeof PASS2574_AUDIT_CLAIM_LEDGER_ID;
  generatedAt: string;
  locale: string;
  target: {
    contractAddress?: string;
    projectName?: string;
    chain: string;
  };
  rule: string;
  customerRule: string;
  proRule: string;
  advancedRule: string;
  summary: {
    totalClaims: number;
    confirmed: number;
    partial: number;
    missing: number;
    blocked: number;
    factSafeClaims: number;
    publicDisplayClaims: number;
  };
  customerRows: Array<{ label: string; status: Pass2574EvidenceGrade; output: string }>;
  proPdfRows: Array<{ label: string; status: Pass2574EvidenceGrade; output: string }>;
  advancedQueue: string[];
  claims: Pass2574AuditClaim[];
};

type ClaimLedgerInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  sourceQuorum?: Pass2570AuditSourceQuorumReport | null;
  providerRuntime?: Pass2572AuditProviderRuntimeReport | null;
  runtimeConfidence?: Pass2573AuditRuntimeConfidenceReport | null;
  authorityEvidence?: AuditAdjudicatedAuthorityEvidence | null;
  sourceContextIntegrity?: P78Erc2771MulticallResult | null;
  deploymentContextEvidence?: P79HistoricalDeploymentContextAdjudication | null;
  currentDeploymentQuorumEvidence?: P82CurrentDeploymentReadonlyQuorumReceipt | null;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[<>{}\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toGrade(state: Pass2572RuntimeState | Pass2570SourceState | undefined): Pass2574EvidenceGrade {
  if (state === "confirmed") return "confirmed";
  if (state === "partial") return "partial";
  if (state === "blocked") return "blocked";
  if (state === "missing" || state === "timeout" || state === "error") return "missing";
  return "not_run";
}

function confidenceForGrade(grade: Pass2574EvidenceGrade, fallback = 42) {
  if (grade === "confirmed") return 86;
  if (grade === "partial") return 58;
  if (grade === "blocked") return 36;
  if (grade === "missing") return 24;
  return fallback;
}

function categoryForLane(lane: Pass2572RuntimeLane): Pass2574ClaimCategory {
  const text = `${lane.id} ${lane.label} ${lane.provider} ${lane.claim}`.toLowerCase();
  if (/explorer|source|abi|verified/.test(text)) return "source_code";
  if (/goplus|honeypot|security|tax|blacklist|pause|mint|proxy|owner/.test(text)) return "security_flags";
  if (/dex|liquidity|pair|pool/.test(text)) return "liquidity";
  if (/holder|supply|concentration/.test(text)) return "holders";
  if (/market|coingecko|metadata|price/.test(text)) return "market";
  if (/audit/.test(text)) return "public_audit";
  if (/docs|repo|github|website/.test(text)) return "docs_repo";
  return "runtime";
}

function categoryForQuorum(label: string, family: string): Pass2574ClaimCategory {
  const text = `${label} ${family}`.toLowerCase();
  if (/identity|contract|token/.test(text)) return "identity";
  if (/source|explorer|abi|verified/.test(text)) return "source_code";
  if (/owner|admin|permission|proxy|mint|freeze|blacklist|tax/.test(text)) return "permissions";
  if (/liquidity|dex|pool/.test(text)) return "liquidity";
  if (/holder|supply|concentration/.test(text)) return "holders";
  if (/market|metadata|price/.test(text)) return "market";
  if (/audit/.test(text)) return "public_audit";
  if (/docs|repo|github|website/.test(text)) return "docs_repo";
  return "runtime";
}

function statusWord(locale: string, grade: Pass2574EvidenceGrade) {
  if (grade === "confirmed") return t(locale, "potwierdzone", "bestaetigt", "confirmed");
  if (grade === "partial") return t(locale, "częściowe", "teilweise", "partial");
  if (grade === "blocked") return t(locale, "wymaga klucza", "braucht Key", "needs key");
  if (grade === "missing") return t(locale, "brak dowodu", "fehlender Beleg", "missing evidence");
  return t(locale, "nie uruchomiono", "nicht ausgefuehrt", "not run");
}

function customerLine(locale: string, label: string, grade: Pass2574EvidenceGrade, evidence: string[], missing: string[]) {
  const lead = statusWord(locale, grade);
  if (grade === "confirmed") {
    return t(locale, `${lead}: ${evidence[0] || label}`, `${lead}: ${evidence[0] || label}`, `${lead}: ${evidence[0] || label}`);
  }
  if (grade === "partial") {
    return t(locale, `${lead}: mamy sygnał, ale potrzeba drugiego źródła.`, `${lead}: Signal vorhanden, aber zweite Quelle noetig.`, `${lead}: signal exists, but a second source is needed.`);
  }
  if (grade === "blocked") {
    return t(locale, `${lead}: provider gotowy, ale brakuje konfiguracji.`, `${lead}: Provider bereit, aber Konfiguration fehlt.`, `${lead}: provider is ready, but configuration is missing.`);
  }
  return t(locale, `${lead}: ${missing[0] || "nie potwierdzono publicznie"}`, `${lead}: ${missing[0] || "nicht oeffentlich bestaetigt"}`, `${lead}: ${missing[0] || "not publicly confirmed"}`);
}

function proLine(lane: Pass2572RuntimeLane, grade: Pass2574EvidenceGrade) {
  return `${lane.provider}: ${lane.claim}; state=${grade}; evidence=${lane.evidence.length}; missing=${lane.missing.length}; timeout=${lane.timeoutMs}ms; latency=${lane.latencyMs ?? 0}ms`;
}

function advancedAction(locale: string, category: Pass2574ClaimCategory, grade: Pass2574EvidenceGrade) {
  if (grade === "confirmed") {
    return t(locale, "Zachować w raporcie jako fakt z cytowaniem źródła.", "Im Bericht als belegte Tatsache behalten.", "Keep in the report as a sourced fact.");
  }
  if (category === "permissions" || category === "security_flags" || category === "source_code") {
    return t(locale, "Uruchomić automatyczne mapowanie permissions/source oraz evidence resolution przed mocnym werdyktem.", "Automatisches Permissions/Source-Mapping und Evidence Resolution vor einem starken Urteil ausführen.", "Run automated permissions/source mapping and evidence resolution before a strong verdict.");
  }
  if (category === "liquidity" || category === "holders") {
    return t(locale, "Potwierdzić drugim źródłem płynność, holderów i lock evidence.", "Liquiditaet, Holder und Lock Evidence mit zweiter Quelle pruefen.", "Confirm liquidity, holders and lock evidence with a second source.");
  }
  return t(locale, "Oznaczyć jako missing evidence i nie sprzedawać jako fakt.", "Als Missing Evidence markieren, nicht als Fakt darstellen.", "Mark as missing evidence and do not sell it as fact.");
}

function uniqueClaims(claims: Pass2574AuditClaim[]) {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = `${claim.category}:${claim.label}:${claim.sourceFamily}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildPass2574AuditClaimLedgerReport(input: ClaimLedgerInput): Pass2574AuditClaimLedgerReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? input.sourceQuorum?.target.chain ?? input.providerRuntime?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? input.providerRuntime?.target.contractAddress ?? input.sourceQuorum?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? input.providerRuntime?.target.projectName ?? input.sourceQuorum?.target.projectName;

  const runtimeClaims: Pass2574AuditClaim[] = (input.providerRuntime?.lanes ?? []).map((lane) => {
    const grade = toGrade(lane.state);
    const category = categoryForLane(lane);
    return {
      id: `runtime-${lane.id}`,
      category,
      label: lane.label,
      grade,
      sourceFamily: lane.provider,
      claim: lane.claim,
      customerLine: customerLine(locale, lane.label, grade, lane.evidence, lane.missing),
      proPdfLine: proLine(lane, grade),
      advancedAction: advancedAction(locale, category, grade),
      canShowAsFact: grade === "confirmed",
      confidence: confidenceForGrade(grade),
      missing: lane.missing,
    };
  });

  const quorumClaims: Pass2574AuditClaim[] = (input.sourceQuorum?.lanes ?? []).map((lane) => {
    const grade = toGrade(lane.state);
    const category = categoryForQuorum(lane.label, lane.family);
    return {
      id: `quorum-${lane.id}`,
      category,
      label: lane.label,
      grade,
      sourceFamily: lane.family,
      claim: lane.basicValue || lane.label,
      customerLine: customerLine(locale, lane.label, grade, lane.evidence, lane.missing),
      proPdfLine: `${lane.family}: ${lane.label}; state=${grade}; confidence=${lane.confidence}/100; evidence=${lane.evidence.length}; missing=${lane.missing.length}`,
      advancedAction: advancedAction(locale, category, grade),
      canShowAsFact: grade === "confirmed",
      confidence: clamp(lane.confidence, 0, 100),
      missing: lane.missing,
    };
  });

  const authorityEvidence = input.authorityEvidence;
  const authorityClaims: Pass2574AuditClaim[] = authorityEvidence?.state === "confirmed" && verifyAuditAdjudicatedAuthorityEvidence(authorityEvidence)
    ? [{
        id: `authority-${authorityEvidence.category}-${authorityEvidence.evidenceDigest.replace(/^sha256:/, "").slice(0, 16)}`,
        category: "identity",
        label: "Deployment identity",
        grade: "confirmed",
        sourceFamily: authorityEvidence.authorityRoots.join(" + "),
        claim: authorityEvidence.finding ?? "Confirmed deployment-identity contradiction",
        customerLine: authorityEvidence.customerLine ?? "Confirmed deployment-identity contradiction.",
        proPdfLine: authorityEvidence.proPdfLine ?? "Confirmed deployment-identity contradiction.",
        advancedAction: t(locale, "Zweryfikować aktualny runtime bytecode z niezależnego RPC quorum przed twierdzeniem o exploitability.", "Aktuellen Runtime-Bytecode mit unabhaengigem RPC-Quorum pruefen, bevor Exploitability behauptet wird.", "Verify current runtime bytecode with independent RPC quorum before making an exploitability claim."),
        canShowAsFact: true,
        confidence: clamp(authorityEvidence.confidence, 0, 100),
        missing: authorityEvidence.blockers,
        adverseKind: "deployment_identity",
        adverseRiskFloor: authorityEvidence.riskFloor ?? undefined,
        evidenceRefs: authorityEvidence.receipts.map((item) => item.receiptDigest),
      }]
    : [];

  const deploymentContextEvidence = input.deploymentContextEvidence;
  const historicalDeploymentClaims: Pass2574AuditClaim[] = deploymentContextEvidence?.classification === "HISTORICAL_DEPLOYMENT_BOUND_UPSTREAM_REPLAY"
    && verifyP79HistoricalDeploymentContextAdjudication(deploymentContextEvidence)
    && deploymentContextEvidence.historicalFinding.factEligible
    ? [{
        id: `p79-historical-deployment-${deploymentContextEvidence.deploymentBinding?.recordId ?? "unknown"}`,
        category: "security_flags",
        label: "Historical deployment-bound exploit",
        grade: "confirmed",
        sourceFamily: "historical-deployment:upstream-replay",
        claim: deploymentContextEvidence.historicalFinding.title ?? "Historical deployment-bound exploit confirmed",
        customerLine: deploymentContextEvidence.historicalFinding.customerLine ?? "Historical deployment-bound incident confirmed; current exploitability is not proven.",
        proPdfLine: deploymentContextEvidence.historicalFinding.proPdfLine ?? "historicalDeploymentBound=true; independentVelmereReplay=false; currentExploitabilityProven=false",
        advancedAction: t(
          locale,
          "Uruchomić niezależny replay Velmère na autoryzowanym archival RPC, a następnie pobrać current bytecode i trusted-forwarder state z niezależnego RPC quorum przed jakimkolwiek current lub FINAL claimem.",
          "Einen unabhängigen Velmère-Replay auf autorisiertem Archiv-RPC ausführen und danach aktuellen Bytecode und Trusted-Forwarder-State über unabhängiges RPC-Quorum binden, bevor ein Current- oder FINAL-Claim erlaubt wird.",
          "Run an independent Velmère replay on an authorized archival RPC, then bind current bytecode and trusted-forwarder state through independent RPC quorum before any current or FINAL claim.",
        ),
        canShowAsFact: true,
        confidence: clamp(deploymentContextEvidence.confidence, 0, 100),
        missing: deploymentContextEvidence.blockers,
        adverseKind: "historical_exploit",
        adverseSeverity: "critical",
        evidenceRefs: deploymentContextEvidence.evidenceRefs.slice(0, 8),
      }]
    : [];

  const currentDeploymentQuorumEvidence = input.currentDeploymentQuorumEvidence;
  const currentDeploymentQuorumClaims: Pass2574AuditClaim[] = currentDeploymentQuorumEvidence
    && verifyP82CurrentDeploymentReadonlyQuorumReceiptFromEnvironment(currentDeploymentQuorumEvidence)
    && currentDeploymentQuorumEvidence.customerCurrentRuntimeFactEligible
    && currentDeploymentQuorumEvidence.customerTrustedForwarderFactEligible
    && currentDeploymentQuorumEvidence.proof.currentRuntimeStateProven
    && currentDeploymentQuorumEvidence.proof.currentProxyImplementationProven
    && currentDeploymentQuorumEvidence.proof.currentTrustedForwarderStateProven
    && currentDeploymentQuorumEvidence.snapshot.blockNumber !== null
    && currentDeploymentQuorumEvidence.snapshot.blockHash
    && currentDeploymentQuorumEvidence.snapshot.stateRoot
    && currentDeploymentQuorumEvidence.deployment.runtimeBytecodeSha256
    && currentDeploymentQuorumEvidence.deployment.implementationAddress
    && currentDeploymentQuorumEvidence.deployment.implementationBytecodeSha256
    && currentDeploymentQuorumEvidence.trustedForwarder.state !== "WITHHELD"
    && currentDeploymentQuorumEvidence.trustedForwarder.negativeControlState === "INACTIVE"
    ? [{
        id: `p82-current-deployment-${currentDeploymentQuorumEvidence.receiptDigest.replace(/^sha256:/, "").slice(0, 20)}`,
        category: "runtime",
        label: "Current deployment configuration",
        grade: "confirmed",
        sourceFamily: "current-chain:exact-block-readonly-quorum",
        claim: `Exact-block read-only quorum confirmed current runtime, EIP-1167 implementation and trusted-forwarder state at BSC block ${currentDeploymentQuorumEvidence.snapshot.blockNumber}.`,
        customerLine: t(
          locale,
          `Niezależny read-only quorum potwierdził aktualny runtime, implementację proxy i stan trusted forwardera w dokładnym bloku BSC ${currentDeploymentQuorumEvidence.snapshot.blockNumber}. Trusted forwarder jest ${currentDeploymentQuorumEvidence.trustedForwarder.state === "ACTIVE" ? "aktywny" : "nieaktywny"}. Nie dowodzi to aktualnej exploitability.`,
          `Ein unabhängiges Read-only-Quorum bestätigte aktuellen Runtime-Code, Proxy-Implementierung und Trusted-Forwarder-State im exakten BSC-Block ${currentDeploymentQuorumEvidence.snapshot.blockNumber}. Der Trusted Forwarder ist ${currentDeploymentQuorumEvidence.trustedForwarder.state === "ACTIVE" ? "aktiv" : "inaktiv"}. Dies beweist keine aktuelle Exploitability.`,
          `An independent read-only quorum confirmed the current runtime, proxy implementation and trusted-forwarder state at exact BSC block ${currentDeploymentQuorumEvidence.snapshot.blockNumber}. The trusted forwarder is ${currentDeploymentQuorumEvidence.trustedForwarder.state.toLowerCase()}. This does not prove current exploitability.`,
        ),
        proPdfLine: `currentDeployment=${currentDeploymentQuorumEvidence.target.address}; snapshotBlock=${currentDeploymentQuorumEvidence.snapshot.blockNumber}; blockHash=${currentDeploymentQuorumEvidence.snapshot.blockHash}; stateRoot=${currentDeploymentQuorumEvidence.snapshot.stateRoot}; runtimeSha256=${currentDeploymentQuorumEvidence.deployment.runtimeBytecodeSha256}; proxy=EIP_1167_COMPATIBLE_MINIMAL_PROXY; implementation=${currentDeploymentQuorumEvidence.deployment.implementationAddress}; implementationSha256=${currentDeploymentQuorumEvidence.deployment.implementationBytecodeSha256}; trustedForwarder=${currentDeploymentQuorumEvidence.trustedForwarder.address}; trustedForwarderState=${currentDeploymentQuorumEvidence.trustedForwarder.state}; negativeControl=INACTIVE; currentExploitabilityProven=false; independentReplay=false`,
        advancedAction: t(
          locale,
          "Związać ten sam snapshot z niezależnym autoryzowanym replayem, prawami źródeł i immutable customer/PDF bytes przed jakimkolwiek FINAL claimem.",
          "Denselben Snapshot mit unabhängigem autorisiertem Replay, Quellenrechten und unveränderlichen Customer/PDF-Bytes binden, bevor ein FINAL-Claim zulässig ist.",
          "Bind the same snapshot to an independent authorized replay, source rights and immutable customer/PDF bytes before any FINAL claim.",
        ),
        canShowAsFact: true,
        confidence: 96,
        missing: [
          "independent Velmere replay on the exact state snapshot",
          "current exploitability adjudication remains separate and unproven",
          "immutable real customer artifact and exact-Windows release proof",
        ],
        findingKind: "current_deployment_configuration",
        evidenceRefs: [
          currentDeploymentQuorumEvidence.receiptDigest,
          currentDeploymentQuorumEvidence.snapshot.blockHash,
          currentDeploymentQuorumEvidence.snapshot.stateRoot,
          currentDeploymentQuorumEvidence.deployment.runtimeBytecodeSha256,
          currentDeploymentQuorumEvidence.deployment.implementationBytecodeSha256,
        ],
      }]
    : [];

  const sourceContextIntegrity = input.sourceContextIntegrity;
  const sourceContextClaims: Pass2574AuditClaim[] = sourceContextIntegrity?.classification === "SOURCE_PATTERN_RISK_SIGNAL"
    ? [{
        id: "p78-erc2771-multicall-context-source-signal",
        category: "security_flags",
        label: "ERC2771 + Multicall context integrity",
        grade: "partial",
        sourceFamily: "verified_source_cross_file",
        claim: "Verified source contains the historical ERC2771 + Multicall forwarded-context risk pattern; current deployment exploitability is not proven.",
        customerLine: t(
          locale,
          "Zweryfikowane źródło zawiera historyczny wzorzec ryzyka ERC2771 + Multicall. To jest sygnał źródłowy, nie dowód, że aktualny deployment jest exploitable.",
          "Die verifizierte Source enthält das historische ERC2771 + Multicall Risikomuster. Das ist ein Source-Signal, kein Beweis für Exploitability des aktuellen Deployments.",
          "Verified source contains the historical ERC2771 + Multicall risk pattern. This is a source-level signal, not proof that the current deployment is exploitable.",
        ),
        proPdfLine: `sourceSignal=ERC2771_MULTICALL_CONTEXT; classification=${sourceContextIntegrity.classification}; mitigation=${sourceContextIntegrity.mitigation ?? "none"}; compositionContracts=${sourceContextIntegrity.compositionContracts.join(",") || "unknown"}; trustedForwarderConfigurationObserved=${sourceContextIntegrity.trustedForwarderConfigurationObserved}; trustedForwarderRuntimeState=${sourceContextIntegrity.trustedForwarderRuntimeState}; exploitabilityProven=false`,
        advancedAction: t(
          locale,
          "Automatycznie związać exact deployed bytecode, current trusted-forwarder state i fork/replay z tym samym snapshotem przed eskalacją severity lub FINAL.",
          "Exact deployed Bytecode, aktuellen Trusted-Forwarder-State und Fork/Replay automatisiert an denselben Snapshot binden, bevor Severity oder FINAL eskaliert werden.",
          "Automatically bind exact deployed bytecode, current trusted-forwarder state and fork/replay to the same snapshot before escalating severity or FINAL.",
        ),
        canShowAsFact: false,
        confidence: 58,
        missing: [
          "exact deployed bytecode binding",
          "trusted-forwarder runtime state at an exact block",
          "independent replay/adjudication of affected privileges",
        ],
        evidenceRefs: sourceContextIntegrity.evidence.slice(0, 8).map((item) => `verified-source:${item.kind}:${sha256Digest(`${item.path}|${item.line}|${item.kind}`).replace(/^sha256:/, "").slice(0, 24)}`),
      }]
    : [];

  const derivedConfidence = input.runtimeConfidence;
  const derivedClaims: Pass2574AuditClaim[] = derivedConfidence
    ? [
        {
          id: "derived-runtime-confidence",
          category: "runtime",
          label: "Evidence confidence",
          grade: derivedConfidence.overall.sourceConfidence >= 62 ? "confirmed" : derivedConfidence.overall.sourceConfidence >= 42 ? "partial" : "missing",
          sourceFamily: "Velmere confidence engine",
          claim: `coverage=${derivedConfidence.overall.sourceCoverageScore}/100; confidence=${derivedConfidence.overall.sourceConfidence}/100; risk=${derivedConfidence.overall.riskScore}/100`,
          customerLine: derivedConfidence.basicSummary,
          proPdfLine: `PASS2573 adjusted risk=${derivedConfidence.overall.riskScore}; confidence=${derivedConfidence.overall.sourceConfidence}; coverage=${derivedConfidence.overall.sourceCoverageScore}`,
          advancedAction: t(locale, "Użyć jako summary, ale bazować werdykt na pojedynczych claims.", "Als Summary nutzen, Verdict auf einzelne Claims stuetzen.", "Use as a summary, but base verdict on individual claims."),
          canShowAsFact: true,
          confidence: derivedConfidence.overall.sourceConfidence,
          missing: derivedConfidence.topMissingEvidence,
        },
      ]
    : [];

  const claims = uniqueClaims([...authorityClaims, ...historicalDeploymentClaims, ...currentDeploymentQuorumClaims, ...sourceContextClaims, ...runtimeClaims, ...quorumClaims, ...derivedClaims]).slice(0, 24);
  const confirmed = claims.filter((claim) => claim.grade === "confirmed").length;
  const partial = claims.filter((claim) => claim.grade === "partial").length;
  const missing = claims.filter((claim) => claim.grade === "missing" || claim.grade === "not_run").length;
  const blocked = claims.filter((claim) => claim.grade === "blocked").length;
  const factSafeClaims = claims.filter((claim) => claim.canShowAsFact).length;

  const customerRows = claims.slice(0, 10).map((claim) => ({
    label: claim.label,
    status: claim.grade,
    output: claim.customerLine,
  }));
  const proPdfRows = claims.slice(0, 16).map((claim) => ({
    label: claim.label,
    status: claim.grade,
    output: claim.proPdfLine,
  }));
  const advancedQueue = claims
    .filter((claim) => claim.grade !== "confirmed" || claim.category === "permissions" || claim.category === "security_flags")
    .slice(0, 10)
    .map((claim) => `${claim.label}: ${claim.advancedAction}`);

  return {
    passId: PASS2574_AUDIT_CLAIM_LEDGER_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { contractAddress, projectName, chain },
    rule: t(
      locale,
      "PASS2574 wymusza Claim -> Source -> Grade -> Customer Line -> Pro PDF Line, żeby Basic/Pro nie sprzedawał braków jako faktów.",
      "PASS2574 erzwingt Claim -> Source -> Grade -> Customer Line -> Pro PDF Line, damit Basic/Pro Luecken nicht als Fakten verkauft.",
      "PASS2574 enforces Claim -> Source -> Grade -> Customer Line -> Pro PDF Line so Basic/Pro never sells missing evidence as fact.",
    ),
    customerRule: t(
      locale,
      "Basic pokazuje tylko publiczne, pasywne claims i jasno oznacza missing evidence.",
      "Basic zeigt nur oeffentliche passive Claims und markiert Missing Evidence klar.",
      "Basic shows only public passive claims and clearly marks missing evidence.",
    ),
    proRule: t(
      locale,
      "Pro PDF dostaje pełniejszy ledger: provider, latency, missing, confidence i actions.",
      "Pro PDF bekommt den volleren Ledger: Provider, Latenz, Missing, Confidence und Actions.",
      "Pro PDF receives the fuller ledger: provider, latency, missing, confidence and actions.",
    ),
    advancedRule: t(
      locale,
      "Advanced automatycznie rozwiązuje claims wymagające głębszej weryfikacji permissions, liquidity, holderów i source freshness; human review pozostaje tylko opcjonalnym QA poza entitlementem.",
      "Advanced löst Claims für tiefere Permissions-, Liquiditäts-, Holder- und Source-Freshness-Prüfung automatisiert; Human Review bleibt optionales QA außerhalb des Entitlements.",
      "Advanced automatically resolves claims requiring deeper permissions, liquidity, holder and source freshness verification; human review remains optional QA outside the entitlement.",
    ),
    summary: {
      totalClaims: claims.length,
      confirmed,
      partial,
      missing,
      blocked,
      factSafeClaims,
      publicDisplayClaims: customerRows.length,
    },
    customerRows,
    proPdfRows,
    advancedQueue,
    claims,
  };
}
