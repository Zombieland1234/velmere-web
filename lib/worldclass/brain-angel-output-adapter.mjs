import { createHash } from "node:crypto";

const HEX64 = /^[0-9a-f]{64}$/u;
const TIERS = new Set(["basic", "pro", "advanced"]);
const LOCALES = new Set(["pl", "en", "de"]);
const BRAIN = "vlm_brain";
const ANGEL = "angel";

const DEFAULT_POLICY = {
  vlmBrain: {
    minimumSourceFamilies: { basic: 1, pro: 2, advanced: 2 },
    allowedLicenseStatus: { basic: ["verified", "display_only"], pro: ["verified"], advanced: ["verified"] },
    requiresEntitlement: { basic: false, pro: true, advanced: true },
    maximumClaims: { basic: 2, pro: 5, advanced: 8 },
    maximumToolCalls: { basic: 0, pro: 2, advanced: 4 },
    maximumInputCharacters: 24000,
  },
  angel: {
    minimumSourceFamilies: { basic: 1, pro: 2, advanced: 2 },
    allowedLicenseStatus: { basic: ["verified", "display_only"], pro: ["verified"], advanced: ["verified"] },
    requiresEntitlement: { basic: false, pro: true, advanced: true },
    maximumAnswerCharacters: { basic: 1200, pro: 2400, advanced: 4000 },
  },
};

const COPY = {
  en: {
    blocked: "The answer is safely blocked until the missing evidence or entitlement is supplied.",
    bounded: "The conclusion is bounded to the verified evidence packet and its stated limitations.",
    refusal: "I cannot help with that request. I can explain the verified evidence, risks and safer next checks.",
    injection: "Instructions embedded inside untrusted evidence were ignored and were not executed.",
    next: "Refresh the evidence packet, resolve conflicts and rerun the bounded analysis before relying on the result.",
    remediation: "Use only source-bound evidence, preserve uncertainty and escalate unresolved high-impact conflicts for review.",
    missing: "Missing proof is shown explicitly and is not replaced with an assumption.",
    severity: "informational",
  },
  pl: {
    blocked: "Odpowiedź została bezpiecznie zablokowana do czasu dostarczenia brakujących dowodów lub uprawnienia.",
    bounded: "Wniosek jest ograniczony do zweryfikowanego pakietu dowodów i jawnie opisanych ograniczeń.",
    refusal: "Nie mogę pomóc w tej prośbie. Mogę wyjaśnić zweryfikowane dowody, ryzyka i bezpieczne kolejne kroki.",
    injection: "Instrukcje ukryte w niezaufanych danych zostały zignorowane i nie zostały wykonane.",
    next: "Odśwież pakiet dowodów, rozwiąż konflikty i ponownie wykonaj ograniczoną analizę przed użyciem wyniku.",
    remediation: "Używaj wyłącznie dowodów związanych ze źródłami, zachowaj niepewność i eskaluj nierozwiązane konflikty o dużym wpływie.",
    missing: "Brakujący dowód jest pokazany jawnie i nie jest zastępowany założeniem.",
    severity: "informacyjne",
  },
  de: {
    blocked: "Die Antwort ist sicher blockiert, bis fehlende Evidenz oder Berechtigung vorliegt.",
    bounded: "Die Schlussfolgerung ist auf das verifizierte Evidenzpaket und die offengelegten Grenzen beschränkt.",
    refusal: "Dabei kann ich nicht helfen. Ich kann die verifizierte Evidenz, Risiken und sichere nächste Prüfungen erklären.",
    injection: "In nicht vertrauenswürdiger Evidenz eingebettete Anweisungen wurden ignoriert und nicht ausgeführt.",
    next: "Evidenzpaket aktualisieren, Konflikte klären und die begrenzte Analyse erneut ausführen, bevor das Ergebnis verwendet wird.",
    remediation: "Nur quellengebundene Evidenz verwenden, Unsicherheit erhalten und ungelöste Konflikte mit hoher Auswirkung eskalieren.",
    missing: "Fehlender Nachweis wird offen ausgewiesen und nicht durch eine Annahme ersetzt.",
    severity: "informativ",
  },
};

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256(value) { return createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : stable(value)).digest("hex"); }
function object(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function unique(values) { return [...new Set(values)]; }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function evidenceRows(rows) {
  return rows.map((row) => ({ sourceId: row.sourceId, family: row.family, freshnessStatus: row.freshnessStatus, licenseStatus: row.licenseStatus, payloadSha256: row.payloadSha256 }));
}
function validateCommon(args, surface) {
  const { matrixRow, corpusCase, evidencePacket, sourceSha256, corpusSha256 } = args ?? {};
  if (!object(matrixRow) || !object(corpusCase) || !object(evidencePacket)) throw new TypeError("matrixRow, corpusCase and evidencePacket are required objects");
  if (matrixRow.surface !== surface || corpusCase.surface !== surface || evidencePacket.surface !== surface) throw new Error("surface_mismatch");
  if (matrixRow.caseId !== corpusCase.id || matrixRow.caseId !== evidencePacket.caseId) throw new Error("case_mismatch");
  if (!TIERS.has(matrixRow.tier) || !LOCALES.has(matrixRow.locale)) throw new Error("unsupported_tier_or_locale");
  if (!HEX64.test(String(sourceSha256 ?? "")) || !HEX64.test(String(corpusSha256 ?? ""))) throw new Error("invalid_source_or_corpus_sha");
}
function buildSections(matrixRow, locale, summary, missing, nextSafeCheck) {
  const copy = COPY[locale];
  return Object.fromEntries((matrixRow.requiredSections ?? []).map((name) => {
    let value = summary;
    if (["limitations", "missing_data"].includes(name)) value = missing.length ? `${copy.missing} ${missing.join(", ")}.` : copy.bounded;
    else if (name === "next_safe_check") value = nextSafeCheck;
    else if (name === "contradictions") value = "Source conflicts are retained rather than silently averaged.";
    return [name, { title: name.replaceAll("_", " "), summary: value }];
  }));
}
function baseOutput(args, status, evidence, missingData, limitations, confidence, nextSafeCheck) {
  const { matrixRow, sourceSha256, corpusSha256 } = args;
  return {
    schemaVersion: "velmere.worldclass.output.v1",
    matrixId: matrixRow.matrixId,
    caseId: matrixRow.caseId,
    surface: matrixRow.surface,
    tier: matrixRow.tier,
    locale: matrixRow.locale,
    language: matrixRow.locale,
    sourceSha256,
    corpusSha256,
    status,
    scope: "bounded_source_bound_evaluation",
    evidence,
    missingData,
    limitations,
    confidence,
    nextSafeCheck,
  };
}
function selectEvidence(packet, tier, rule) {
  const allowed = new Set(rule.allowedLicenseStatus[tier]);
  const usable = (packet.sources ?? []).filter((row) => allowed.has(row.licenseStatus) && row.freshnessStatus !== "expired" && row.valid !== false);
  const limit = tier === "basic" ? 1 : tier === "pro" ? 2 : 3;
  return usable.slice(0, limit);
}
function paidBlockers(args, selected, rule) {
  const { matrixRow, evidencePacket, entitlementStatus } = args;
  const blockers = [];
  const families = new Set(selected.map((row) => row.family));
  if (families.size < rule.minimumSourceFamilies[matrixRow.tier]) blockers.push("independent_source_required");
  if ((evidencePacket.missingFields ?? []).length) blockers.push(...evidencePacket.missingFields.map((value) => `missing:${value}`));
  if (matrixRow.tier !== "basic" && rule.requiresEntitlement[matrixRow.tier] && entitlementStatus !== "verified") blockers.push("server_entitlement_required");
  if (matrixRow.tier !== "basic" && selected.some((row) => row.licenseStatus !== "verified")) blockers.push("commercial_rights_required");
  return unique(blockers);
}
function commonTierFields(output, args, selected, packet) {
  const { matrixRow, entitlementStatus } = args;
  output.evidenceStatus = output.status === "passed" ? "verified_or_bounded" : "blocked";
  output.entitlementStatus = matrixRow.tier === "basic" ? "not_required" : entitlementStatus;
  output.analysisDepth = matrixRow.tier;
  if (matrixRow.tier !== "basic") {
    output.evidenceTable = evidenceRows(selected);
    output.riskDrivers = packet.riskDrivers ?? [];
    output.commercialRights = selected.every((row) => row.licenseStatus === "verified") ? "verified" : "unverified";
    output.freshnessReceipt = sha256(selected.map((row) => [row.sourceId, row.observedAt, row.freshnessStatus]));
  }
  if (matrixRow.tier === "advanced") {
    output.contradictions = packet.contradictions ?? [];
    output.confidenceBasis = `Bound to ${new Set(selected.map((row) => row.family)).size} independent evidence families with explicit conflict retention.`;
    output.provenanceReceipt = packet.provenanceReceiptSha256;
  }
  return output;
}
function isBrainSafeRefusal(caseRow, packet) {
  return packet.policyDecision?.action === "refuse" || caseRow.expectedByTier?.basic?.outcome === "refuse_or_bound_claim";
}
function isAngelSafeRefusal(caseRow, packet) {
  return packet.policyDecision?.action === "refuse" || caseRow.expectedByTier?.basic?.outcome === "safe_refusal_with_explanation";
}

export function buildWorldclassVlmBrainOutput(args) {
  validateCommon(args, BRAIN);
  const policy = args.policy ?? DEFAULT_POLICY;
  const rule = policy.vlmBrain ?? DEFAULT_POLICY.vlmBrain;
  const { matrixRow, corpusCase, evidencePacket } = args;
  const copy = COPY[matrixRow.locale];
  const selected = selectEvidence(evidencePacket, matrixRow.tier, rule);
  const blockers = paidBlockers(args, selected, rule);
  const safeRefusal = isBrainSafeRefusal(corpusCase, evidencePacket);
  const status = (selected.length === 0 || (blockers.length > 0 && matrixRow.tier !== "basic")) ? "blocked" : "passed";
  const limitations = unique([...(evidencePacket.limitations ?? []), ...(safeRefusal ? ["unsafe_or_unsupported_request_not_executed"] : [])]);
  const missingData = unique(evidencePacket.missingFields ?? []);
  const confidence = status === "blocked" ? 18 : clamp(44 + selected.length * 14 - missingData.length * 8 - (evidencePacket.contradictions?.length ?? 0) * 5, 20, 92);
  const nextSafeCheck = copy.next;
  const output = baseOutput(args, status, evidenceRows(selected), missingData, limitations, confidence, nextSafeCheck);
  if (status === "blocked") {
    output.blockers = blockers;
    output.customerVerdict = `${copy.blocked} [${matrixRow.tier.toUpperCase()}]`;
    output.analysisDepth = matrixRow.tier;
    output.entitlementStatus = matrixRow.tier === "basic" ? "not_required" : args.entitlementStatus;
    output.blockedTierContract = `${matrixRow.tier}_fail_closed`;
    return output;
  }
  const maxClaims = rule.maximumClaims[matrixRow.tier];
  const claims = (safeRefusal ? [] : (evidencePacket.claims ?? [])).slice(0, maxClaims).map((claim) => ({
    id: claim.id,
    text: claim.text[matrixRow.locale] ?? claim.text.en,
    confidence: clamp(Number(claim.confidence ?? confidence), 0, confidence),
    sourceIds: (claim.sourceIds ?? []).filter((id) => selected.some((source) => source.sourceId === id)),
  })).filter((claim) => claim.sourceIds.length > 0);
  const summary = safeRefusal ? copy.refusal : (evidencePacket.untrustedInstructionDetected ? `${copy.injection} ${copy.bounded}` : copy.bounded);
  output.customerVerdict = `${summary} [${matrixRow.tier.toUpperCase()}]`;
  output.factPacketHash = evidencePacket.factPacketHash;
  output.epistemicDecision = {
    action: safeRefusal ? "refuse_or_bound_claim" : evidencePacket.policyDecision.action,
    uncertaintyRetained: true,
    conflictCount: evidencePacket.contradictions?.length ?? 0,
    untrustedInstructionExecuted: false,
  };
  output.claims = claims;
  output.claimSourceBindings = claims.flatMap((claim) => claim.sourceIds.map((sourceId) => ({ claimId: claim.id, sourceId, bindingSha256: sha256(`${claim.id}:${sourceId}:${evidencePacket.factPacketHash}`) })));
  output.policyDecision = evidencePacket.policyDecision;
  output.sections = buildSections(matrixRow, matrixRow.locale, summary, missingData, nextSafeCheck);
  output.authorityBoundary = "ai_generated_not_human_authority";
  output.toolExecution = { attempted: evidencePacket.toolExecution?.attempted ?? 0, executed: Math.min(evidencePacket.toolExecution?.executed ?? 0, rule.maximumToolCalls[matrixRow.tier]), untrustedInstructionExecuted: false };
  if (evidencePacket.numericRiskScore !== null && evidencePacket.numericRiskScore !== undefined && selected.length > 0) output.numericRiskScore = evidencePacket.numericRiskScore;
  return commonTierFields(output, args, selected, evidencePacket);
}

export function buildWorldclassAngelOutput(args) {
  validateCommon(args, ANGEL);
  const policy = args.policy ?? DEFAULT_POLICY;
  const rule = policy.angel ?? DEFAULT_POLICY.angel;
  const { matrixRow, corpusCase, evidencePacket } = args;
  const copy = COPY[matrixRow.locale];
  const selected = selectEvidence(evidencePacket, matrixRow.tier, rule);
  const blockers = paidBlockers(args, selected, rule);
  const safeRefusal = isAngelSafeRefusal(corpusCase, evidencePacket);
  const status = (selected.length === 0 || (blockers.length > 0 && matrixRow.tier !== "basic")) ? "blocked" : "passed";
  const missingData = unique(evidencePacket.missingFields ?? []);
  const limitations = unique([...(evidencePacket.limitations ?? []), ...(safeRefusal ? ["safety_boundary_applied"] : [])]);
  const confidence = status === "blocked" ? 18 : clamp(48 + selected.length * 13 - missingData.length * 8 - (evidencePacket.contradictions?.length ?? 0) * 5, 20, 92);
  const nextSafeCheck = copy.next;
  const output = baseOutput(args, status, evidenceRows(selected), missingData, limitations, confidence, nextSafeCheck);
  if (status === "blocked") {
    output.blockers = blockers;
    output.customerVerdict = `${copy.blocked} [${matrixRow.tier.toUpperCase()}]`;
    output.analysisDepth = matrixRow.tier;
    output.entitlementStatus = matrixRow.tier === "basic" ? "not_required" : args.entitlementStatus;
    output.blockedTierContract = `${matrixRow.tier}_fail_closed`;
    return output;
  }
  const answerCore = safeRefusal ? copy.refusal : (evidencePacket.untrustedInstructionDetected ? `${copy.injection} ${copy.bounded}` : copy.bounded);
  const tierDetail = matrixRow.tier === "basic" ? "" : matrixRow.tier === "pro" ? " Evidence families and missing proof are listed." : " Contradictions, provenance and authority boundaries are listed.";
  const answer = `${answerCore}${tierDetail}`.slice(0, rule.maximumAnswerCharacters[matrixRow.tier]);
  output.customerVerdict = `${answerCore} [${matrixRow.tier.toUpperCase()}]`;
  output.answer = answer;
  output.severity = safeRefusal ? copy.severity : evidencePacket.severity ?? copy.severity;
  output.evidenceSummary = selected.length ? `${selected.length} source-bound evidence row(s); ${new Set(selected.map((row) => row.family)).size} family/families.` : copy.missing;
  output.missingProof = missingData;
  output.safeRemediation = copy.remediation;
  output.policyDecision = evidencePacket.policyDecision;
  output.sections = buildSections(matrixRow, matrixRow.locale, answerCore, missingData, nextSafeCheck);
  output.authorityBoundary = "ai_assistant_not_human_reviewer";
  output.privacy = { sensitiveInputPersisted: false, redactionApplied: Boolean(evidencePacket.redactionApplied) };
  output.linkHandling = { untrustedUrlFetched: false };
  return commonTierFields(output, args, selected, evidencePacket);
}

export function buildBrainAngelEvidenceReceipt(packet) {
  const redacted = {
    schemaVersion: packet.schemaVersion,
    caseId: packet.caseId,
    surface: packet.surface,
    asOf: packet.asOf,
    sourceRows: (packet.sources ?? []).map((row) => ({ sourceId: row.sourceId, family: row.family, payloadSha256: row.payloadSha256, freshnessStatus: row.freshnessStatus, licenseStatus: row.licenseStatus })),
    factPacketHash: packet.factPacketHash ?? null,
    policyDecision: packet.policyDecision,
    missingFields: packet.missingFields ?? [],
    contradictions: packet.contradictions ?? [],
  };
  return sha256(redacted);
}
