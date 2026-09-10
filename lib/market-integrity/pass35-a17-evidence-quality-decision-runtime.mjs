import { createHash } from "node:crypto";

const sha256 = (value) => `sha256:${createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex")}`;
const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const round = (value) => Number(value.toFixed(6));
const TIERS = ["basic", "pro", "advanced"];
const DECISION_SURFACES = ["shield", "real_markets", "market_impact", "whale_watch"];
const EVIDENCE_FLOORS = Object.freeze({ basic: 1, pro: 2, advanced: 3 });
const RIGHTS_SCORE = Object.freeze({ SELL_ELIGIBLE: 1, DISPLAY_ONLY: 0.7, UNVERIFIED: 0.35, WITHHELD: 0, WITHDRAWN: 0 });

function ensureIso(value, code) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return parsed;
}

function parseEvidenceFamily(evidenceId) {
  const marker = ".evidence.";
  const index = String(evidenceId).indexOf(marker);
  return index >= 0 ? String(evidenceId).slice(index + marker.length) : String(evidenceId).split(/[.:]/u).at(-1) || "unknown";
}

function normalizeClaimText(value) {
  return String(value).toLowerCase().replace(/\b(?:not|no|without|absence|unavailable|missing)\b/gu, " NEG ").replace(/[^a-z0-9]+/gu, " ").trim();
}

function contradictionKey(claim) {
  const fromId = String(claim.claimId).replace(/\.(?:positive|negative|yes|no|present|absent)$/u, "");
  return fromId || normalizeClaimText(claim.text).slice(0, 96);
}

function polarity(claim) {
  const source = `${claim.claimId} ${claim.text}`.toLowerCase();
  return /\b(?:not|no|without|absence|unavailable|missing|negative|absent)\b/u.test(source) ? -1 : 1;
}

function detectContradictions(packet) {
  const rows = [];
  const grouped = new Map();
  for (const claim of packet.claims ?? []) {
    const key = contradictionKey(claim);
    const list = grouped.get(key) ?? [];
    list.push(claim);
    grouped.set(key, list);
  }
  for (const [key, claims] of grouped) {
    const polarities = new Set(claims.map(polarity));
    if (polarities.size > 1) {
      rows.push({
        contradictionId: `contr_${sha256({ key, claims: claims.map((claim) => claim.claimId) }).slice(-24)}`,
        type: "OPPOSING_CLAIMS",
        key,
        claimIds: claims.map((claim) => claim.claimId).sort(),
        material: claims.some((claim) => ["high", "critical"].includes(claim.severity)),
      });
    }
  }
  for (const explicit of packet.contradictions ?? []) {
    rows.push({
      contradictionId: `contr_${sha256(explicit).slice(-24)}`,
      type: "EXPLICIT_PACKET_CONTRADICTION",
      key: String(explicit),
      claimIds: [],
      material: true,
    });
  }
  const unique = new Map(rows.map((row) => [row.contradictionId, row]));
  return [...unique.values()].sort((left, right) => left.contradictionId.localeCompare(right.contradictionId));
}

function analyzePacket(packetRecord, nowMs) {
  const packet = packetRecord.packet;
  const tier = packetRecord.tier;
  if (!TIERS.includes(tier)) throw new Error(`a17_tier_invalid:${tier}`);
  const createdAtMs = ensureIso(packet.createdAt, "a17_packet_created_at_invalid");
  const validUntilMs = ensureIso(packet.validUntil, "a17_packet_valid_until_invalid");
  const evidenceIds = [...new Set((packet.claims ?? []).flatMap((claim) => claim.evidenceIds ?? []))].sort();
  const evidenceFamilies = [...new Set(evidenceIds.map(parseEvidenceFamily).filter((family) => family !== "scope_boundary"))].sort();
  const provenanceRows = packet.provenance ?? [];
  const staleFields = provenanceRows.filter((row) => {
    const observedAt = ensureIso(row.observedAt, "a17_provenance_observed_at_invalid");
    return nowMs > observedAt + row.maxAgeMs;
  }).map((row) => row.fieldId).sort();
  const withheldFields = provenanceRows.filter((row) => ["WITHHELD", "WITHDRAWN"].includes(row.rightsState)).map((row) => row.fieldId).sort();
  const unverifiedFields = provenanceRows.filter((row) => row.rightsState === "UNVERIFIED").map((row) => row.fieldId).sort();
  const rightsQuality = provenanceRows.length
    ? provenanceRows.reduce((sum, row) => sum + (RIGHTS_SCORE[row.rightsState] ?? 0), 0) / provenanceRows.length
    : 0;
  const averageConfidence = packet.claims.length
    ? packet.claims.reduce((sum, claim) => sum + (claim.confidence ?? 0), 0) / packet.claims.length
    : 0;
  const supportedClaimCount = packet.claims.filter((claim) => Array.isArray(claim.evidenceIds) && claim.evidenceIds.length > 0).length;
  const evidenceCoverage = packet.claims.length ? supportedClaimCount / packet.claims.length : 0;
  const contradictions = detectContradictions(packet);
  const materialContradictions = contradictions.filter((row) => row.material);
  const evidenceFloor = EVIDENCE_FLOORS[tier];
  const evidenceFloorMet = evidenceFamilies.length >= evidenceFloor;
  const packetExpired = nowMs > validUntilMs;
  const hardBlockers = [];
  if (!evidenceFloorMet) hardBlockers.push("EVIDENCE_FAMILY_FLOOR_NOT_MET");
  if (staleFields.length) hardBlockers.push("STALE_PROVENANCE");
  if (withheldFields.length) hardBlockers.push("WITHHELD_OR_WITHDRAWN_RIGHTS");
  if (packetExpired) hardBlockers.push("PACKET_EXPIRED");
  if (materialContradictions.length) hardBlockers.push("MATERIAL_CONTRADICTION");
  if (!packet.packetHash || !packet.factsHash) hardBlockers.push("PACKET_INTEGRITY_MISSING");
  const warningFlags = [];
  if (unverifiedFields.length) warningFlags.push("UNVERIFIED_RIGHTS_PRESENT");
  if ((packet.missingProof ?? []).length) warningFlags.push("MISSING_PROOF_PRESENT");
  if (evidenceCoverage < 1) warningFlags.push("UNSUPPORTED_CLAIMS_PRESENT");
  const qualityScore = round(Math.max(0, Math.min(1,
    averageConfidence * 0.24
    + evidenceCoverage * 0.26
    + Math.min(1, evidenceFamilies.length / evidenceFloor) * 0.2
    + rightsQuality * 0.2
    + (hardBlockers.length ? 0 : 0.1)
  )));
  const outcome = hardBlockers.length
    ? "ABSTAIN"
    : warningFlags.length
      ? "LIMITED_OFFLINE"
      : "READY_OFFLINE";
  const sourceClaimIds = packet.claims.map((claim) => claim.claimId).sort();
  const safeNextChecks = [...new Set([
    ...hardBlockers,
    ...(packet.missingProof ?? []).map((row) => `RESOLVE_${String(row).toUpperCase()}`),
    ...(warningFlags.includes("UNVERIFIED_RIGHTS_PRESENT") ? ["VERIFY_PROVIDER_RIGHTS"] : []),
  ])].sort();
  const channelDecisions = (packetRecord.projections ?? []).filter((projection) => ["brain", "angel", "pdf"].includes(projection.channel)).map((projection) => ({
    channel: projection.channel,
    packetId: projection.packetId,
    packetHash: projection.packetHash,
    factsHash: projection.factsHash,
    sourceClaimIds,
    outputClaimIds: [...projection.claimIds].sort(),
    addsFacts: projection.addsFacts,
    abstained: outcome === "ABSTAIN",
    outcome,
    qualityScore,
    safeNextChecks,
  }));
  return {
    surfaceId: packetRecord.surfaceId,
    tier,
    packetId: packet.packetId,
    packetHash: packet.packetHash,
    factsHash: packet.factsHash,
    createdAtMs,
    validUntilMs,
    evidenceFloor,
    evidenceFamilies,
    evidenceFamilyCount: evidenceFamilies.length,
    evidenceFloorMet,
    evidenceCoverage: round(evidenceCoverage),
    rightsQuality: round(rightsQuality),
    averageConfidence: round(averageConfidence),
    staleFields,
    withheldFields,
    unverifiedFields,
    contradictions,
    materialContradictionCount: materialContradictions.length,
    hardBlockers,
    warningFlags,
    qualityScore,
    outcome,
    safeNextChecks,
    sourceClaimIds,
    channelDecisions,
  };
}

function buildIntegratedDecisionPacket(tier, packetAnalyses, packetRecords) {
  const expected = DECISION_SURFACES.map((surfaceId) => packetAnalyses.find((row) => row.surfaceId === surfaceId && row.tier === tier));
  const missingSurfaces = DECISION_SURFACES.filter((_, index) => !expected[index]);
  const present = expected.filter(Boolean);
  const sourceRecords = packetRecords.filter((row) => DECISION_SURFACES.includes(row.surfaceId) && row.tier === tier);
  const sourceClaimIds = [...new Set(sourceRecords.flatMap((row) => row.packet.claims.map((claim) => claim.claimId)))].sort();
  const hardBlockers = [...new Set([
    ...(missingSurfaces.length ? ["REQUIRED_SURFACE_MISSING"] : []),
    ...present.flatMap((row) => row.hardBlockers),
  ])].sort();
  const warningFlags = [...new Set(present.flatMap((row) => row.warningFlags))].sort();
  const qualityScore = present.length ? round(present.reduce((sum, row) => sum + row.qualityScore, 0) / present.length) : 0;
  const outcome = hardBlockers.length ? "ABSTAIN" : warningFlags.length ? "LIMITED_OFFLINE" : "READY_OFFLINE";
  const core = {
    schemaVersion: "velmere.pass35.a17.cross-surface-decision-packet.v1",
    decisionPacketId: `a17_decision_${tier}`,
    tier,
    requiredSurfaces: DECISION_SURFACES,
    sourcePacketIds: sourceRecords.map((row) => row.packet.packetId).sort(),
    sourcePacketHashes: sourceRecords.map((row) => row.packet.packetHash).sort(),
    sourceFactsHashes: sourceRecords.map((row) => row.packet.factsHash).sort(),
    sourceClaimIds,
    outputClaimIds: sourceClaimIds,
    addedFactCount: 0,
    missingSurfaces,
    hardBlockers,
    warningFlags,
    qualityScore,
    outcome,
    abstained: outcome === "ABSTAIN",
    safeNextChecks: [...new Set([...hardBlockers, ...present.flatMap((row) => row.safeNextChecks)])].sort(),
    productionEligible: false,
    paidDeliveryAllowed: false,
    liveClaimed: false,
  };
  return { ...core, packetSha256: sha256(core) };
}

export function runPass35A17EvidenceQualityDecisionRuntime({ parityRuntime, evaluatedAt = "2026-07-23T04:00:00.000Z" } = {}) {
  if (!parityRuntime || !Array.isArray(parityRuntime.packets)) throw new Error("a17_parity_runtime_missing");
  const nowMs = ensureIso(evaluatedAt, "a17_evaluated_at_invalid");
  const packetAnalyses = parityRuntime.packets.map((record) => analyzePacket(record, nowMs));
  const integratedDecisionPackets = TIERS.map((tier) => buildIntegratedDecisionPacket(tier, packetAnalyses, parityRuntime.packets));
  const channelDecisions = packetAnalyses.flatMap((row) => row.channelDecisions);
  const addedFactViolations = channelDecisions.filter((row) => row.addsFacts || JSON.stringify(row.sourceClaimIds) !== JSON.stringify(row.outputClaimIds)).length;
  const hardBlockedPackets = packetAnalyses.filter((row) => row.outcome === "ABSTAIN").length;
  const core = {
    schemaVersion: "velmere.pass35.a17.evidence-quality-decision-runtime.v1",
    runtimeId: "pass35-a17-evidence-quality-decision-v1",
    sourceRevisionId: parityRuntime.sourceRevisionId,
    evaluatedAt,
    packetDenominator: packetAnalyses.length,
    channelDecisionDenominator: channelDecisions.length,
    integratedDecisionPacketDenominator: integratedDecisionPackets.length,
    decisionSurfaces: DECISION_SURFACES,
    evidenceFloors: EVIDENCE_FLOORS,
    packetAnalyses,
    channelDecisions,
    integratedDecisionPackets,
    addedFactViolations,
    hardBlockedPackets,
    contradictionCount: packetAnalyses.reduce((sum, row) => sum + row.contradictions.length, 0),
    materialContradictionCount: packetAnalyses.reduce((sum, row) => sum + row.materialContradictionCount, 0),
    allChannelsBoundToSourceClaims: addedFactViolations === 0,
    sellEnabled: false,
    paidDeliveryAllowed: false,
    liveClaimed: false,
    truthBoundary: "A17 evaluates evidence quality, contradictions and cross-surface decision completeness over canonical offline packets. It does not convert synthetic/display-only inputs into live, sell-eligible or customer-proven evidence.",
  };
  return { ...core, integrity: { algorithm: "sha256", digest: sha256(core) } };
}

export function verifyPass35A17EvidenceQualityDecisionRuntime(value) {
  try {
    if (value?.schemaVersion !== "velmere.pass35.a17.evidence-quality-decision-runtime.v1") return false;
    if (value.packetDenominator !== 21 || value.channelDecisionDenominator !== 63 || value.integratedDecisionPacketDenominator !== 3) return false;
    if (value.addedFactViolations !== 0 || !value.allChannelsBoundToSourceClaims || value.sellEnabled || value.liveClaimed) return false;
    const { integrity, ...core } = value;
    if (integrity?.digest !== sha256(core)) return false;
    return value.integratedDecisionPackets.every((packet) => packet.addedFactCount === 0
      && JSON.stringify(packet.sourceClaimIds) === JSON.stringify(packet.outputClaimIds)
      && !packet.productionEligible
      && !packet.paidDeliveryAllowed);
  } catch {
    return false;
  }
}
