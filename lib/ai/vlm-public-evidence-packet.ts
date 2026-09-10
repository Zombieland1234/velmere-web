import type { VlmBrainEnvelope } from "@/lib/ai/vlm-brain";

export type VlmPublicEvidencePacket = ReturnType<typeof buildPublicVlmEvidencePacket>;

export function buildPublicVlmEvidencePacket(ai: VlmBrainEnvelope) {
  const packet = ai.facts;
  const factsWithValue = packet.facts.filter((fact) => fact.value !== null).length;
  const missingFacts = packet.facts.filter((fact) => fact.value === null).length;
  const sourceProviders = Array.from(new Set(packet.sources.map((source) => source.provider).filter(Boolean)));
  const sourceCount = packet.sources.length;
  const evidenceQuorum = packet.sourceArbitration.evidenceQuorum.status;
  const integrity = packet.sourceArbitration.sourceIntegrity.status;
  const temporal = packet.sourceArbitration.temporalConsistency.status;
  const limit = ai.depth === "advanced" ? { missing: 16, next: 10 } : ai.depth === "pro" ? { missing: 8, next: 5 } : { missing: 5, next: 3 };

  return {
    schemaVersion: "velmere.vlm.public-evidence-packet.v3" as const,
    evidenceCapsule: {
      schemaVersion: ai.evidenceCapsule.schemaVersion,
      capsuleId: ai.evidenceCapsule.capsuleId,
      replayId: ai.evidenceCapsule.replayId,
      status: ai.evidenceCapsule.status,
      contextHash: ai.evidenceCapsule.contextHash,
      receiptHash: ai.evidenceCapsule.receiptHash,
      evidenceRows: ai.evidenceCapsule.auditEvidenceRows.length,
      sourceLineageRows: ai.evidenceCapsule.sourceLineage.length,
      missingProofRows: ai.evidenceCapsule.missingProof.length,
      riskConfidenceDelta: ai.evidenceCapsule.riskConfidenceDelta,
      exportPolicy: ai.evidenceCapsule.exportPolicy,
    },
    asset: packet.asset,
    observedAt: packet.observedAt,
    depth: ai.depth,
    surface: ai.surface,
    confidenceCap: packet.confidenceCap,
    sourceCount,
    providerCount: sourceProviders.length,
    providers: sourceProviders.slice(0, 8),
    factsWithValue,
    missingFacts,
    missingData: packet.missingData.slice(0, limit.missing),
    nextChecks: packet.nextChecks.slice(0, limit.next),
    sourceHealth: { evidenceQuorum, integrity, temporal },
    claimPolicy: {
      noUnsupportedLiquidityClaims: !packet.facts.some((fact) => /slippage|liquidity/i.test(fact.id) && fact.value !== null),
      noHolderClaimsWithoutHolderData: !packet.facts.some((fact) => /holder/i.test(fact.id) && fact.value !== null),
      noContractClaimsWithoutContractData: !packet.asset.contractAddress,
      publicRule: "Every visible claim must map to a source, fact value or explicit missing-data lane.",
    },
  };
}

// PASS2786 public packet bridge: evidenceCapsule · capsuleId · replayId · contextHash · receiptHash · shared Brain Angel PDF Audit proof payload
