import type { VlmBrainOutput } from "./vlm-contract";
import type { VlmCanonicalFactPacket } from "./vlm-fact-packet";
import { inspectVlmText, sanitizeVlmText } from "./vlm-security";
import { recordVlmPolicyRejection } from "./vlm-security-events";
import { evaluateVlmDecisionReversibility } from "./vlm-narrative-drift";
import { inspectVlmAdviceBoundary } from "./vlm-advice-boundary";

export type ClaimFirewallResult = {
  ok: boolean;
  output?: VlmBrainOutput;
  rejectedClaims: string[];
};

type VlmFinding = VlmBrainOutput["keyFindings"][number];
type VlmContradiction = VlmBrainOutput["contradictions"][number];

function relatedFactIds(finding: VlmFinding, packet: VlmCanonicalFactPacket): string[] {
  const available = new Set(packet.facts.map((fact) => fact.id));
  let semantic: string[] = [];
  if (finding.id.startsWith("fact-")) {
    const id = finding.id.slice("fact-".length);
    semantic = available.has(id) ? [id] : [];
  } else if (finding.id === "deterministic-risk") {
    semantic = available.has("risk-score") ? ["risk-score"] : [];
  } else if (finding.id === "deterministic-risk-withheld") {
    semantic = (packet.sourceArbitration.evidenceQuorum.weakFactIds.length
      ? packet.sourceArbitration.evidenceQuorum.weakFactIds
      : ["asset-class"]).filter((id) => available.has(id)).slice(0, 12);
  } else if (finding.id === "evidence-quorum") {
    semantic = packet.sourceArbitration.evidenceQuorum.weakFactIds.filter((id) => available.has(id)).slice(0, 12);
  } else if (finding.id === "temporal-consistency") {
    semantic = packet.sourceArbitration.temporalConsistency.staleFactIds.filter((id) => available.has(id)).slice(0, 12);
  } else if (finding.id === "source-verdict-governor") {
    const weak = packet.sourceArbitration.evidenceQuorum.weakFactIds.filter((id) => available.has(id));
    semantic = (weak.length ? weak : packet.facts.filter((fact) => fact.value !== null && fact.id !== "risk-score").map((fact) => fact.id)).slice(0, 12);
  } else if (finding.id === "decision-reversibility") {
    semantic = ["liquidity-usd", "slippage-10k", "volume-24h", "price"].filter((id) => available.has(id));
  } else if (finding.id === "narrative-drift-lock") {
    semantic = packet.facts.filter((fact) => fact.value !== null && fact.id !== "asset-class").map((fact) => fact.id).slice(0, 12);
  } else if (finding.id.startsWith("signal-")) {
    const id = finding.id.toLowerCase();
    const candidates = /holder|ownership|whale/.test(id)
      ? ["holder-count", "top10-holder-percent"]
      : /liquidity|slippage|orderbook|spread/.test(id)
        ? ["liquidity-usd", "slippage-10k", "volume-24h"]
        : /tax|honeypot|mint|blacklist|contract|privilege/.test(id)
          ? ["sell-tax"]
          : /volume|wash/.test(id)
            ? ["volume-24h", "liquidity-usd"]
            : /drawdown|drop|gain|ath|move|pump|rebrand/.test(id)
              ? ["price-change-1h", "price-change-24h", "price-change-7d", "price-change-30d", "price"]
              : [];
    semantic = candidates.filter((candidate) => available.has(candidate));
  } else if (finding.id.startsWith("layer-") && packet.verdictGovernor.status === "publishable" && available.has("risk-score")) {
    semantic = ["risk-score"];
  }
  semantic = Array.from(new Set(semantic)).slice(0, 12);
  if (!finding.factIds?.length) return semantic;
  const explicit = Array.from(new Set(finding.factIds));
  // Model-authored factIds may narrow an already-known semantic mapping, never
  // invent one or redirect a claim to an unrelated, well-sourced fact.
  if (!semantic.length || explicit.some((id) => !semantic.includes(id))) return [];
  return semantic.filter((id) => explicit.includes(id));
}

function bindFindingToFacts(finding: VlmFinding, packet: VlmCanonicalFactPacket, allowedFactIds?: ReadonlySet<string>): VlmFinding | null {
  const factIds = relatedFactIds(finding, packet).filter((id) => !allowedFactIds || allowedFactIds.has(id));
  if (!factIds.length) return null;
  const facts = factIds.map((id) => packet.facts.find((fact) => fact.id === id)).filter((fact): fact is VlmCanonicalFactPacket["facts"][number] => Boolean(fact));
  const sourceIds = Array.from(new Set(facts.flatMap((fact) => fact.sourceIds))).slice(0, 8);
  if (!sourceIds.length) return null;
  const weak = facts.some((fact) => fact.quorumState === "single_source" || fact.quorumState === "stale" || fact.quorumState === "missing" || fact.quorumState === "conflicted");
  return {
    ...finding,
    factIds,
    sourceIds,
    confidence: weak ? Math.min(finding.confidence, 39) : finding.confidence,
  };
}

/** Final customer-output invariant: every finding resolves through fact IDs to exact receipt-bound sources. */
export function bindVlmFindingsToFacts(output: VlmBrainOutput, packet: VlmCanonicalFactPacket): VlmBrainOutput {
  const visibleFactIds = new Set(output.facts.map((fact) => fact.id));
  const bound = output.keyFindings
    .map((finding) => bindFindingToFacts(finding, packet, visibleFactIds))
    .filter((finding): finding is VlmFinding => Boolean(finding));
  const fallbackFact = output.facts.find((fact) => fact.id === "asset-class" && fact.sourceIds.length > 0)
    ?? output.facts.find((fact) => fact.sourceIds.length > 0);
  const keyFindings = bound.length || !fallbackFact ? bound : [{
    id: "insufficient-evidence",
    title: "Insufficient receipt-bound evidence",
    explanation: "No customer finding was released because claim-to-fact-to-receipt binding could not be proven.",
    severity: "watch" as const,
    confidence: 0,
    sourceIds: fallbackFact.sourceIds.slice(0, 8),
    factIds: [fallbackFact.id],
  }];
  return { ...output, keyFindings };
}

function numericTokens(value: string) {
  return value.match(/(?<![A-Za-z])[-+]?\d+(?:[.,]\d+)?%?/g) ?? [];
}

function normalizeToken(value: string) {
  return value.replace(",", ".").replace(/^\+/, "").replace(/\.0+$/, "").toLowerCase();
}

function allowedNumbers(packet: VlmCanonicalFactPacket) {
  const allowed = new Set(["1", "7", "10", "24", "30", "100"]);
  for (const fact of packet.facts) {
    if (typeof fact.value === "number") {
      const values = [fact.value, Math.round(fact.value), Number(fact.value.toFixed(2))];
      for (const value of values) allowed.add(normalizeToken(String(value)));
    }
    for (const token of numericTokens(fact.label)) allowed.add(normalizeToken(token));
  }
  allowed.add(normalizeToken(String(packet.deterministicScore)));
  allowed.add(normalizeToken(String(packet.confidenceCap)));
  return allowed;
}

function unsupportedNumbers(text: string, allowed: Set<string>) {
  return numericTokens(text).filter((token) => {
    const normalized = normalizeToken(token.replace("%", ""));
    return !allowed.has(normalized);
  });
}

const PROHIBITED_DECISION_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:buy|sell)\s+now\b/i, "trade-instruction"],
  [/\b(?:kup|sprzedaj)\s+(?:teraz|natychmiast)\b/i, "trade-instruction"],
  [/\bjetzt\s+(?:kaufen|verkaufen)\b/i, "trade-instruction"],
  [/\b(?:guaranteed|risk[- ]?free|definitely safe|safe investment)\b/i, "guarantee"],
  [/\b(?:gwarantowan\w*|bez ryzyka|pewna inwestycja|na pewno bezpieczn\w*)\b/i, "guarantee"],
  [/\b(?:garantiert|risikofrei|sichere anlage|definitiv sicher)\b/i, "guarantee"],
  [/\b(?:scam confirmed|fraud proven|criminal project)\b/i, "unsupported-accusation"],
  [/\b(?:potwierdzon\w* scam|udowodnion\w* oszustw\w*|projekt przestępcz\w*)\b/i, "unsupported-accusation"],
  [/\b(?:betrug bewiesen|scam bestätigt|kriminelles projekt)\b/i, "unsupported-accusation"],
  [/\b(?:last chance|do not miss out|act immediately)\b/i, "urgency-pressure"],
  [/\b(?:ostatnia szansa|nie przegap|działaj natychmiast)\b/i, "urgency-pressure"],
  [/\b(?:letzte chance|nicht verpassen|sofort handeln)\b/i, "urgency-pressure"],
];

function prohibitedDecisionClaims(text: string) {
  return PROHIBITED_DECISION_PATTERNS
    .filter(([pattern]) => pattern.test(text))
    .map(([, reason]) => reason);
}

export function applyVlmClaimFirewall(
  candidate: VlmBrainOutput,
  packet: VlmCanonicalFactPacket,
): ClaimFirewallResult {
  const allowedSourceIds = new Set(packet.allowedSourceIds);
  const allowedNumericTokens = allowedNumbers(packet);
  const weakFactIds = new Set(packet.sourceArbitration.evidenceQuorum.weakFactIds);
  const quorumIsStrong = packet.sourceArbitration.evidenceQuorum.status === "strong";
  const sourceIntegrity = packet.sourceArbitration.sourceIntegrity;
  const sourceIntegrityTrusted = sourceIntegrity.status === "trusted";
  const temporalConsistency = packet.sourceArbitration.temporalConsistency;
  const temporalCurrent = temporalConsistency.status === "current";
  const reversibility = evaluateVlmDecisionReversibility(packet);
  const rejectedClaims: string[] = [];

  const keyFindings = candidate.keyFindings
    .map((finding: VlmFinding) => {
      const boundFinding = bindFindingToFacts(finding, packet);
      const sourceIds = (boundFinding?.sourceIds ?? []).filter((sourceId: string) => allowedSourceIds.has(sourceId)).slice(0, 8);
      const findingText = `${finding.title} ${finding.explanation}`;
      const inspection = inspectVlmText(findingText, 1060);
      const adviceInspection = inspectVlmAdviceBoundary(findingText);
      const unsupported = unsupportedNumbers(findingText, allowedNumericTokens);
      const weakFindingId = finding.id.startsWith("fact-") ? finding.id.replace(/^fact-/, "") : null;
      const weakQuorumOverconfidence = Boolean(weakFindingId && weakFactIds.has(weakFindingId) && finding.confidence > 39);
      if (!boundFinding || !sourceIds.length || unsupported.length || !inspection.safe || !adviceInspection.allowed || weakQuorumOverconfidence) {
        const reason = !sourceIds.length
          ? "missing-fact-receipt-binding"
          : unsupported.length
            ? `unsupported-number:${unsupported.join(",")}`
            : !adviceInspection.allowed
              ? `advice-boundary:${adviceInspection.flags.join(",")}`
              : weakQuorumOverconfidence
                ? `weak-quorum-overconfidence:${weakFindingId}`
                : `security-policy:${inspection.flags.join(",")}`;
        rejectedClaims.push(`${finding.id}:${reason}`);
        return null;
      }
      return {
        ...boundFinding,
        title: sanitizeVlmText(finding.title, 160),
        explanation: sanitizeVlmText(finding.explanation, 900),
        confidence: Math.round(Math.min(finding.confidence, packet.confidenceCap)),
        sourceIds,
      };
    })
    .filter((finding: VlmFinding | null): finding is VlmFinding => Boolean(finding));

  const contradictions = candidate.contradictions
    .map((item: VlmContradiction) => {
      const inspection = inspectVlmText(item.description, 500);
      if (!inspection.safe) {
        rejectedClaims.push(`contradiction:security-policy:${inspection.flags.join(",")}`);
        return { description: "", sourceIds: [] };
      }
      return {
        description: sanitizeVlmText(item.description, 500),
        sourceIds: item.sourceIds.filter((sourceId: string) => allowedSourceIds.has(sourceId)).slice(0, 8),
      };
    })
    .filter((item: Pick<VlmContradiction, "description" | "sourceIds">) => item.description && item.sourceIds.length);

  const narrativeFields = [
    candidate.headline,
    candidate.summary,
    candidate.report.executiveSummary,
    candidate.report.marketStructure,
    candidate.report.liquidityAnalysis,
    candidate.report.holderAnalysis,
    candidate.report.contractAnalysis,
    candidate.report.sourceAssessment,
    candidate.report.riskScenarios,
    candidate.report.conclusion,
  ];
  for (const text of narrativeFields) {
    const inspection = inspectVlmText(text, 2200);
    if (!inspection.safe) rejectedClaims.push(`narrative:security-policy:${inspection.flags.join(",")}`);
    const unsupported = unsupportedNumbers(text, allowedNumericTokens);
    if (unsupported.length) rejectedClaims.push(`narrative:unsupported-number:${unsupported.join(",")}`);
    const prohibited = prohibitedDecisionClaims(text);
    if (prohibited.length) rejectedClaims.push(`narrative:prohibited-decision-copy:${prohibited.join(",")}`);
    const adviceInspection = inspectVlmAdviceBoundary(text);
    if (!adviceInspection.allowed) rejectedClaims.push(`narrative:advice-boundary:${adviceInspection.flags.join(",")}`);
    if (!quorumIsStrong && /\b(?:proven|definitive|confirmed safe|high confidence|udowodnion\w*|pewne|na pewno bezpieczn\w*|bewiesen|endgültig|sicher bestätigt)\b/i.test(text)) {
      rejectedClaims.push("narrative:weak-quorum-overclaim");
    }
    if (!sourceIntegrityTrusted && /\b(?:verified source coverage|robust sources|trusted source set|source integrity confirmed|zrodla zweryfikowane|solidne zrodla|zaufane zrodla|źr[oó]dła zweryfikowane|solidne źr[oó]dła|zaufane źr[oó]dła|quellenintegritaet bestaetigt|quellenintegrität bestätigt|robuste quellen|vertrauenswuerdige quellen|vertrauenswürdige quellen)\b/i.test(text)) {
      rejectedClaims.push("narrative:source-integrity-overclaim");
    }
    if (!temporalCurrent && /\b(?:live evidence|real[- ]time|up[- ]to[- ]date|freshly verified|current market proof|świeżo potwierdzon\w*|dane live|dane w czasie rzeczywistym|aktualny dowód|echtzeitdaten|aktuell verifiziert|frisch bestätigt|live[- ]daten)\b/i.test(text)) {
      rejectedClaims.push("narrative:temporal-consistency-overclaim");
    }
    if (/\b(?:ignore previous analysis|narrative can change freely|no narrative drift|pomiń poprzednią analizę|ignoruj poprzednią analizę|bez dryfu narracji|vorherige analyse ignorieren|kein narrative drift)\b/i.test(text)) {
      rejectedClaims.push("narrative:narrative-drift-bypass");
    }
    if (reversibility.tier !== "high" && /\b(?:fully reversible|easy to reverse|no execution friction|no slippage risk|łatw\w* do odwrócenia|bez poślizgu|bez tarcia wykonania|vollständig umkehrbar|leicht umkehrbar|kein slippage risiko)\b/i.test(text)) {
      rejectedClaims.push("narrative:decision-reversibility-overclaim");
    }
  }
  for (const text of [...candidate.missingData, ...candidate.nextChecks]) {
    const inspection = inspectVlmText(text, 320);
    if (!inspection.safe) rejectedClaims.push(`list-item:security-policy:${inspection.flags.join(",")}`);
    const adviceInspection = inspectVlmAdviceBoundary(text);
    if (!adviceInspection.allowed) rejectedClaims.push(`list-item:advice-boundary:${adviceInspection.flags.join(",")}`);
  }

  if (!keyFindings.length || rejectedClaims.some((claim) => claim.includes("security-policy") || claim.startsWith("narrative:"))) {
    recordVlmPolicyRejection({
      vector: "claim",
      reason: rejectedClaims.some((claim) => claim.includes("security-policy"))
        ? "output_security_policy"
        : "unsupported_or_prohibited_claim",
      score: 90,
      flags: rejectedClaims.some((claim) => claim.includes("security-policy"))
        ? ["prompt_injection"]
        : undefined,
    });
    return { ok: false, rejectedClaims };
  }

  return {
    ok: true,
    rejectedClaims,
    output: {
      ...candidate,
      asset: packet.asset,
      headline: sanitizeVlmText(candidate.headline, 200),
      summary: sanitizeVlmText(candidate.summary, 2200),
      confidence: Math.round(Math.min(candidate.confidence, packet.confidenceCap)),
      facts: packet.facts,
      sources: packet.sources,
      keyFindings,
      contradictions,
      missingData: Array.from(new Set([...packet.missingData, ...candidate.missingData.map((item: string) => sanitizeVlmText(item, 260))])).filter(Boolean).slice(0, 24),
      nextChecks: Array.from(new Set(candidate.nextChecks.map((item: string) => sanitizeVlmText(item, 320)))).filter(Boolean).slice(0, 14),
      report: {
        executiveSummary: sanitizeVlmText(candidate.report.executiveSummary, 2200),
        marketStructure: sanitizeVlmText(candidate.report.marketStructure, 2200),
        liquidityAnalysis: sanitizeVlmText(candidate.report.liquidityAnalysis, 2200),
        holderAnalysis: sanitizeVlmText(candidate.report.holderAnalysis, 2200),
        contractAnalysis: sanitizeVlmText(candidate.report.contractAnalysis, 2200),
        sourceAssessment: sanitizeVlmText(candidate.report.sourceAssessment, 2200),
        riskScenarios: sanitizeVlmText(candidate.report.riskScenarios, 2200),
        conclusion: sanitizeVlmText(candidate.report.conclusion, 2200),
      },
    },
  };
}
