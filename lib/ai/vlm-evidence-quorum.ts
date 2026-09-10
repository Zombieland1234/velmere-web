import type { VlmFact, VlmSource } from "./vlm-contract";
import { pass4644FieldValueHash } from "@/lib/market-integrity/provider-evidence-receipt";

export type VlmFactQuorumStatus =
  | "confirmed"
  | "single_source"
  | "internal_only"
  | "missing"
  | "stale"
  | "conflicted";

export type VlmEvidenceQuorumFact = {
  factId: string;
  status: VlmFactQuorumStatus;
  sourceCount: number;
  providerCount: number;
  sourceIds: string[];
  reasons: string[];
};

export type VlmEvidenceQuorum = {
  status: "strong" | "mixed" | "weak";
  requiredProviderCount: number;
  confirmedFactCount: number;
  checkedFactCount: number;
  singleSourceFactCount: number;
  internalOnlyFactCount: number;
  missingFactCount: number;
  staleFactCount: number;
  conflictedFactCount: number;
  quorumRatio: number;
  weakFactIds: string[];
  facts: VlmEvidenceQuorumFact[];
  reasons: string[];
};

const INTERNAL_SOURCE_ID = "internal:risk-engine";
const DETERMINISTIC_FACT_IDS = new Set(["risk-score", "asset-class", "venue-source-coverage"]);

function normalizeProvider(value: string) {
  return value.trim().toLowerCase();
}

function freshnessPenalty(fact: VlmFact, sources: VlmSource[]) {
  if (fact.freshness === "stale" || fact.freshness === "unknown") return true;
  return sources.some((source) => {
    if (!source.observedAt) return true;
    const age = Date.now() - new Date(source.observedAt).getTime();
    return !Number.isFinite(age) || age < 0 || age > 6 * 60 * 60_000;
  });
}

export function evaluateVlmEvidenceQuorum(input: {
  sources: VlmSource[];
  facts: VlmFact[];
  conflictCount: number;
  requiredProviderCount?: number;
  quarantinedSourceIds?: string[];
}): VlmEvidenceQuorum {
  const requiredProviderCount = Math.max(2, input.requiredProviderCount ?? 2);
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const quarantinedSourceIds = new Set(input.quarantinedSourceIds ?? []);
  const factsToCheck = input.facts.filter((fact) => fact.value !== null && !DETERMINISTIC_FACT_IDS.has(fact.id));
  const factSupport = factsToCheck.map((fact): VlmEvidenceQuorumFact => {
    const exactBindings = (fact.evidenceBindings ?? []).filter((binding) => {
      const source = sourceById.get(binding.sourceId);
      return Boolean(
        source
        && fact.sourceIds.includes(binding.sourceId)
        && source.receiptId === binding.receiptId
        && source.payloadHash
        && binding.valueHash === pass4644FieldValueHash(fact.value)
        && normalizeProvider(source.provider) === normalizeProvider(binding.providerFamily)
        && source.observedAt === binding.observedAt,
      );
    });
    const rawSourceIds = exactBindings.map((binding) => binding.sourceId);
    const sourceIds = (Array.from(
      new Set(rawSourceIds.filter((sourceId): sourceId is string => typeof sourceId === "string" && sourceId.length > 0)),
    ) as string[]).slice(0, 8);
    const resolvedSources = sourceIds
      .map((sourceId) => sourceById.get(sourceId))
      .filter((source): source is VlmSource => Boolean(source))
      .filter((source) => !quarantinedSourceIds.has(source.id));
    const externalSources = resolvedSources.filter((source) => source.id !== INTERNAL_SOURCE_ID);
    const providerCount = new Set(exactBindings.map((binding) => normalizeProvider(binding.providerFamily)).filter(Boolean)).size;
    const reasons: string[] = [];

    if (input.conflictCount > 0 && sourceIds.length > 0) {
      reasons.push("Source conflict is present in this packet.");
      return { factId: fact.id, status: "conflicted", sourceCount: externalSources.length, providerCount, sourceIds, reasons };
    }
    if (!sourceIds.length || !resolvedSources.length) {
      reasons.push(quarantinedSourceIds.size > 0
        ? "No usable non-quarantined field-level receipt binding supports this populated fact."
        : "No exact field-level receipt binding is attached to this populated fact.");
      return { factId: fact.id, status: "missing", sourceCount: 0, providerCount: 0, sourceIds, reasons };
    }
    if (!externalSources.length) {
      reasons.push("Only the internal deterministic engine supports this fact.");
      return { factId: fact.id, status: "internal_only", sourceCount: 0, providerCount: 0, sourceIds, reasons };
    }
    if (freshnessPenalty(fact, externalSources)) {
      reasons.push("At least one supporting source is stale or has an unknown timestamp.");
      return { factId: fact.id, status: "stale", sourceCount: externalSources.length, providerCount, sourceIds, reasons };
    }
    if (providerCount < requiredProviderCount || externalSources.length < requiredProviderCount) {
      reasons.push("The fact is supported by fewer than two independent external providers.");
      return { factId: fact.id, status: "single_source", sourceCount: externalSources.length, providerCount, sourceIds, reasons };
    }

    reasons.push("The fact meets the independent-source quorum.");
    return { factId: fact.id, status: "confirmed", sourceCount: externalSources.length, providerCount, sourceIds, reasons };
  });

  const count = (status: VlmFactQuorumStatus) => factSupport.filter((fact) => fact.status === status).length;
  const confirmedFactCount = count("confirmed");
  const singleSourceFactCount = count("single_source");
  const internalOnlyFactCount = count("internal_only");
  const missingFactCount = count("missing");
  const staleFactCount = count("stale");
  const conflictedFactCount = count("conflicted");
  const checkedFactCount = factSupport.length;
  const quorumRatio = checkedFactCount ? Number((confirmedFactCount / checkedFactCount).toFixed(3)) : 0;
  const weakFactIds = factSupport
    .filter((fact) => fact.status !== "confirmed")
    .map((fact) => fact.factId)
    .slice(0, 16);

  const reasons: string[] = [];
  if (!checkedFactCount) reasons.push("No externally checkable market facts are available.");
  if (quorumRatio < 0.75) reasons.push("Fewer than 75% of populated market facts meet the two-provider quorum.");
  if (singleSourceFactCount > 0) reasons.push("Some facts are still single-provider observations.");
  if (internalOnlyFactCount > 0) reasons.push("Some facts rely only on the internal deterministic engine.");
  if (missingFactCount > 0) reasons.push("Some populated facts have no usable source identifier.");
  if (quarantinedSourceIds.size > 0) reasons.push("Quarantined source records are excluded from evidence quorum.");
  if (staleFactCount > 0) reasons.push("Some evidence is stale or lacks reliable timestamps.");
  if (conflictedFactCount > 0) reasons.push("Conflicting evidence blocks strong confidence.");

  const status: VlmEvidenceQuorum["status"] = quorumRatio >= 0.75 && conflictedFactCount === 0 && staleFactCount === 0
    ? "strong"
    : quorumRatio >= 0.45 && conflictedFactCount === 0
      ? "mixed"
      : "weak";

  return {
    status,
    requiredProviderCount,
    confirmedFactCount,
    checkedFactCount,
    singleSourceFactCount,
    internalOnlyFactCount,
    missingFactCount,
    staleFactCount,
    conflictedFactCount,
    quorumRatio,
    weakFactIds,
    facts: factSupport,
    reasons: reasons.slice(0, 12),
  };
}
