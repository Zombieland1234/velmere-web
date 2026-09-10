export function applyPass35A17EvidenceFamilyRegistry(productContract, registry) {
  if (registry?.schemaVersion !== "velmere.pass35.a17.evidence-family-registry.v1") throw new Error("a17_evidence_registry_schema_invalid");
  const product = JSON.parse(JSON.stringify(productContract));
  const seen = new Set();
  for (const rule of registry.rules ?? []) {
    const key = `${rule.surfaceId}:${rule.tier}`;
    if (seen.has(key)) throw new Error(`a17_evidence_registry_duplicate:${key}`);
    seen.add(key);
    if (!Number.isSafeInteger(rule.floor) || rule.floor < 1 || !Array.isArray(rule.families) || rule.families.length < rule.floor) throw new Error(`a17_evidence_registry_rule_invalid:${key}`);
    if (new Set(rule.families).size !== rule.families.length) throw new Error(`a17_evidence_registry_family_duplicate:${key}`);
    const surface = product.surfaces.find((row) => row.surfaceId === rule.surfaceId);
    const tier = surface?.tiers?.[rule.tier];
    if (!tier) throw new Error(`a17_evidence_registry_target_missing:${key}`);
    tier.requiredEvidenceFamilies = [...rule.families];
    tier.evidenceFamilyFloor = rule.floor;
  }
  const expected = product.surfaces.length * 3;
  if (seen.size !== expected) throw new Error(`a17_evidence_registry_coverage:${seen.size}/${expected}`);
  product.a17EvidenceFamilyRegistry = {
    schemaVersion: registry.schemaVersion,
    path: "config/pass35/a17-evidence-family-registry.json",
    ruleCount: seen.size,
    allCellsExplicit: true,
    truthBoundary: registry.truthBoundary,
  };
  return product;
}

export function verifyPass35A17EvidenceFamilyRegistry(productContract, registry) {
  try {
    const product = applyPass35A17EvidenceFamilyRegistry(productContract, registry);
    return registry.rules.every((rule) => {
      const tier = product.surfaces.find((row) => row.surfaceId === rule.surfaceId)?.tiers?.[rule.tier];
      return tier?.evidenceFamilyFloor === rule.floor && JSON.stringify(tier.requiredEvidenceFamilies) === JSON.stringify(rule.families);
    });
  } catch {
    return false;
  }
}
