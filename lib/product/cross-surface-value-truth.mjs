import { createHash } from "node:crypto";

const REVISION = "VELMERE_PASS36_A94R2_ROUTE_AST_ORPHAN_LOCK_PDF_AND_CROSS_SURFACE_VALUE_TRUTH_CHECKPOINT";
const PARENT = "VELMERE_PASS36_A94R1_ACTION_REQUIRED_LOCAL_HARDENING_CHECKPOINT";

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sealCrossSurfacePolicy(policy) {
  const { integritySha256: _ignored, ...core } = policy;
  return { ...core, integritySha256: sha256(canonicalJson(core)) };
}

export function crossSurfacePolicyDigestValid(policy) {
  if (!policy || typeof policy !== "object" || typeof policy.integritySha256 !== "string") return false;
  const { integritySha256, ...core } = policy;
  return integritySha256 === sha256(canonicalJson(core));
}

export function evaluateCrossSurfaceValueTruth(input) {
  const {
    policy,
    authority,
    state,
    pdfSummary,
    routeRegistry,
    auditPolicy,
    auditIntake,
    pdfRetention,
    shieldPolicy,
    realMarketsPolicy,
    impactWhalePolicy,
    brainAngelRiskPolicy,
    semanticPolicy,
    currentDescendant = null,
    descendantChain = [],
  } = input;
  const checks = [];
  const check = (id, passed, detail = null) => checks.push({ id, passed: Boolean(passed), detail });

  check("policy:integrity", crossSurfacePolicyDigestValid(policy), policy.integritySha256);
  check("policy:revision", policy.revisionId === REVISION && policy.parentRevisionId === PARENT, { revisionId: policy.revisionId, parentRevisionId: policy.parentRevisionId });
  const authorityIsFrozenRevision = authority.authorityRevisionId === REVISION && authority.parentRevisionId === PARENT;
  const noPromotionDescendant = (entry) => Boolean(
    entry
      && ["ACTION_REQUIRED_NON_PASS", "REJECTED_DRAFT_NO_SOURCE_AUTHORITY"].includes(entry.checkpointClass)
      && entry.claims?.liveProven === false
      && entry.claims?.saleEnabled === false
      && entry.claims?.productionApproved === false
      && entry.claims?.worldClassProven === false
  );
  const authorityIsBoundImmediateDescendant = Boolean(
    currentDescendant
      && currentDescendant.revisionId === authority.authorityRevisionId
      && currentDescendant.parentRevisionId === REVISION
      && authority.parentRevisionId === REVISION
      && authority.currentSource?.revisionId === authority.authorityRevisionId
      && authority.currentSource?.parentRevisionId === REVISION
      && noPromotionDescendant(currentDescendant)
  );
  const chain = Array.isArray(descendantChain) ? descendantChain : [];
  const authorityIsBoundDescendantChain = Boolean(
    chain.length > 0
      && chain[0]?.parentRevisionId === REVISION
      && chain.every((entry, index) => noPromotionDescendant(entry)
        && (index === 0 || entry.parentRevisionId === chain[index - 1].revisionId))
      && chain.at(-1)?.revisionId === authority.authorityRevisionId
      && authority.parentRevisionId === chain.at(-1)?.parentRevisionId
      && authority.currentSource?.revisionId === authority.authorityRevisionId
      && authority.currentSource?.parentRevisionId === authority.parentRevisionId
  );
  check("authority:current-or-bound-descendant", authorityIsFrozenRevision || authorityIsBoundImmediateDescendant || authorityIsBoundDescendantChain, { current: authority.authorityRevisionId, parent: authority.parentRevisionId, descendantRevision: currentDescendant?.revisionId ?? null, descendantParent: currentDescendant?.parentRevisionId ?? null, descendantChain: chain.map((entry) => ({ revisionId: entry.revisionId, parentRevisionId: entry.parentRevisionId })) });
  check("state:current", state.revisionId === REVISION && state.parentRevisionId === PARENT && state.checkpointClass === "ACTION_REQUIRED_NON_PASS", state.revisionId);
  check("state:no-pass-credit", Object.values(state.passCredit ?? {}).every((value) => value === false), state.passCredit);
  check("authority:no-promotion", authority.claims?.decision === "NO_GO" && authority.claims?.liveProven === false && authority.claims?.saleEnabled === false && authority.claims?.worldClassProven === false, authority.claims);
  check("policy:no-promotion", Object.values(policy.claims ?? {}).every((value) => value === false), policy.claims);

  check("audit:policy-denominators", auditPolicy.requiredCaseCount === 50 && auditPolicy.fixtureDenominators?.tierOutputs === 150 && auditPolicy.fixtureDenominators?.toolReceipts === 200, auditPolicy.fixtureDenominators);
  check("audit:real-truth", auditIntake.requiredCases === 50 && auditIntake.summary?.evidenceReady === 0 && auditIntake.summary?.officialToolReceipts === 0 && auditIntake.summary?.tierOutputsSupplied === 0, auditIntake.summary);
  check("audit:tier-value", auditPolicy.tierRequirements?.basic?.minimumMaterialFields === 8 && auditPolicy.tierRequirements?.pro?.minimumMaterialFields === 16 && auditPolicy.tierRequirements?.advanced?.minimumMaterialFields === 24 && auditPolicy.tierRequirements?.advanced?.humanReviewRequired === true, auditPolicy.tierRequirements);
  check("audit:consolidated", policy.surfaces?.audit?.realCaseDenominator === 50 && policy.surfaces?.audit?.tierOutputDenominator === 150 && policy.surfaces?.audit?.officialToolRunDenominator === 200 && policy.surfaces?.audit?.realCasesVerified === 0 && policy.surfaces?.audit?.officialToolRunsExecuted === 0, policy.surfaces?.audit);

  check("pdf:retention", pdfRetention.corpus?.pdfCount === 450 && pdfRetention.corpus?.pageCount === 2100 && pdfRetention.corpus?.byTier?.basic === 150 && pdfRetention.corpus?.byTier?.pro === 150 && pdfRetention.corpus?.byTier?.advanced === 150, pdfRetention.corpus);
  check("pdf:independent-qa", pdfSummary.qa?.documents === 450 && pdfSummary.qa?.pages === 2100 && pdfSummary.qa?.blankPages === 0 && pdfSummary.qa?.edgeContactPages === 0 && pdfSummary.qa?.pypdfPassed === 450 && pdfSummary.qa?.pdfinfoPassed === 450 && pdfSummary.qa?.pdftotextPassed === 450 && pdfSummary.qa?.ghostscriptSamplePassed === 45, pdfSummary.qa);
  check("pdf:real-truth", pdfSummary.realCustomerPdfs === 0 && pdfSummary.productionBrowserRuns === 0 && pdfSummary.secureCustomerDeliveries === 0 && pdfSummary.saleEnabled === false, { realCustomerPdfs: pdfSummary.realCustomerPdfs, productionBrowserRuns: pdfSummary.productionBrowserRuns, secureCustomerDeliveries: pdfSummary.secureCustomerDeliveries });
  check("pdf:page-contract", policy.surfaces?.pdf?.pageContract?.basic === 2 && policy.surfaces?.pdf?.pageContract?.pro === 4 && policy.surfaces?.pdf?.pageContract?.advanced === 8, policy.surfaces?.pdf?.pageContract);

  check("shield:denominator", authority.planes?.shieldFullCatalogTierMatrix?.activeAssets === 318 && state.denominators?.shieldAssets?.required === 318 && state.denominators?.shieldAssets?.unavailableOrBlocked === 318, { authority: authority.planes?.shieldFullCatalogTierMatrix, state: state.denominators?.shieldAssets });
  check("shield:real-truth", authority.planes?.shieldFullCatalogTierMatrix?.realFullCatalogSnapshotsVerified === 0 && authority.planes?.shieldFullCatalogTierMatrix?.rightsApprovedAssets === 0 && authority.planes?.shieldFullCatalogTierMatrix?.productionBrowserAssets === 0 && authority.planes?.shieldFullCatalogTierMatrix?.customerValueLabeledAssets === 0 && authority.planes?.shieldFullCatalogTierMatrix?.paidGateEligible === false, authority.planes?.shieldFullCatalogTierMatrix);
  check("shield:tier-value", shieldPolicy.tierRequirements?.basic?.minimumMaterialFields === 3 && shieldPolicy.tierRequirements?.pro?.minimumMaterialFields === 15 && shieldPolicy.tierRequirements?.advanced?.minimumMaterialFields === 23, shieldPolicy.tierRequirements);

  check("shield-pro-map:denominator", authority.planes?.shieldProMapFullDepth?.activeAssets === 318 && state.denominators?.shieldProMapAssets?.required === 318 && state.denominators?.shieldProMapAssets?.unavailableOrBlocked === 318, { authority: authority.planes?.shieldProMapFullDepth, state: state.denominators?.shieldProMapAssets });
  check("shield-pro-map:real-truth", authority.planes?.shieldProMapFullDepth?.realFullDepthCasesVerified === 0 && authority.planes?.shieldProMapFullDepth?.realEntitlementsVerified === 0 && authority.planes?.shieldProMapFullDepth?.rightsApprovedAssets === 0 && authority.planes?.shieldProMapFullDepth?.paidGateEligible === false, authority.planes?.shieldProMapFullDepth);

  check("real-markets:denominator", authority.planes?.realMarketsCrossAssetFullMatrix?.totalInstruments === 583 && state.denominators?.realMarketsInstruments?.required === 583 && state.denominators?.realMarketsInstruments?.unavailableOrBlocked === 583, { authority: authority.planes?.realMarketsCrossAssetFullMatrix, state: state.denominators?.realMarketsInstruments });
  check("real-markets:real-truth", authority.planes?.realMarketsCrossAssetFullMatrix?.realEvidenceRowsVerified === 0 && authority.planes?.realMarketsCrossAssetFullMatrix?.rightsApprovedRows === 0 && authority.planes?.realMarketsCrossAssetFullMatrix?.productionBrowserRows === 0 && authority.planes?.realMarketsCrossAssetFullMatrix?.customerValueLabeledRows === 0 && authority.planes?.realMarketsCrossAssetFullMatrix?.paidGateEligible === false, authority.planes?.realMarketsCrossAssetFullMatrix);
  check("real-markets:tier-value", realMarketsPolicy.tierRequirements?.basic?.minimumMaterialFields === 4 && realMarketsPolicy.tierRequirements?.pro?.minimumMaterialFields === 14 && realMarketsPolicy.tierRequirements?.advanced?.minimumMaterialFields === 24, realMarketsPolicy.tierRequirements);

  check("impact-whale:denominator", authority.planes?.marketImpactWhaleWatchMatrix?.activeAssets === 318 && state.denominators?.marketImpactWhaleWatchAssets?.required === 318, { authority: authority.planes?.marketImpactWhaleWatchMatrix, state: state.denominators?.marketImpactWhaleWatchAssets });
  check("impact-whale:real-truth", authority.planes?.marketImpactWhaleWatchMatrix?.realEvidenceRowsVerified === 0 && authority.planes?.marketImpactWhaleWatchMatrix?.rightsApprovedRows === 0 && authority.planes?.marketImpactWhaleWatchMatrix?.realizedSlippageRows === 0 && authority.planes?.marketImpactWhaleWatchMatrix?.continuousMonitoringRows === 0 && authority.planes?.marketImpactWhaleWatchMatrix?.paidGateEligible === false, authority.planes?.marketImpactWhaleWatchMatrix);
  check("impact-whale:tier-shape", impactWhalePolicy.tierRequirements?.market_impact?.advanced?.minimumVenues === 3 && impactWhalePolicy.tierRequirements?.whale_watch?.advanced?.requireTransfers === true && impactWhalePolicy.tierRequirements?.whale_watch?.advanced?.requireExitStress === true, impactWhalePolicy.tierRequirements);

  check("brain-angel-risk:denominator", brainAngelRiskPolicy.realExit?.minimumVerifiedCases === 300 && semanticPolicy.realExit?.minimumVerifiedCases === 300 && state.denominators?.brainAngelRiskRealEval?.required === 300, { a88: brainAngelRiskPolicy.realExit, a88r1: semanticPolicy.realExit, state: state.denominators?.brainAngelRiskRealEval });
  check("brain-angel-risk:real-truth", authority.planes?.brainAngelRiskMultilingualEval?.realEvalCasesVerified === 0 && authority.planes?.brainAngelRiskMultilingualEval?.realModelExecutions === 0 && authority.planes?.brainAngelRiskMultilingualEval?.rightsApprovedCases === 0 && authority.planes?.brainAngelRiskMultilingualEval?.independentAdjudications === 0 && authority.planes?.brainAngelRiskMultilingualEval?.customerDecisionUtilityLabels === 0 && authority.planes?.brainAngelRiskMultilingualEval?.realCalibrationWindowsClosed === 0 && authority.planes?.brainAngelRiskMultilingualEval?.paidGateEligible === false, authority.planes?.brainAngelRiskMultilingualEval);

  const routeAstCreditConsistent = routeRegistry.exactAstReparseCredit === true
    ? routeRegistry.parser?.source === "PROJECT_DEPENDENCY"
      && routeRegistry.parser?.exactToolchainCreditEligible === true
      && typeof routeRegistry.parser?.moduleSha256 === "string"
      && /^[a-f0-9]{64}$/u.test(routeRegistry.parser.moduleSha256)
      && Number.isSafeInteger(routeRegistry.parser?.moduleByteLength)
      && routeRegistry.parser.moduleByteLength > 0
    : routeRegistry.exactAstReparseCredit === false
      && routeRegistry.parser?.exactToolchainCreditEligible === false;
  check("route-ast:registry-credit-consistency", routeRegistry.fileCount >= 250 && routeAstCreditConsistent, { fileCount: routeRegistry.fileCount, exactAstReparseCredit: routeRegistry.exactAstReparseCredit, parser: routeRegistry.parser });
  check("sku:basic", state.skuDecisions?.basic?.decision === "PILOT_ONLY" && state.skuDecisions?.basic?.paid === false && policy.skuDecisions?.basic?.paid === false, state.skuDecisions?.basic);
  check("sku:pro", state.skuDecisions?.pro?.decision === "BLOCKED_RIGHTS" && state.skuDecisions?.pro?.paid === false && policy.skuDecisions?.pro?.paid === false, state.skuDecisions?.pro);
  check("sku:advanced", state.skuDecisions?.advanced?.decision === "BLOCKED_ACCURACY" && state.skuDecisions?.advanced?.paid === false && policy.skuDecisions?.advanced?.paid === false, state.skuDecisions?.advanced);

  const failures = checks.filter((row) => !row.passed);
  return {
    schemaVersion: "velmere.pass36.a94r2.cross-surface-value-truth-evaluation.v1",
    revisionId: REVISION,
    status: failures.length ? "FAIL_CROSS_SURFACE_VALUE_TRUTH" : "PASS_LOCAL_CROSS_SURFACE_VALUE_TRUTH_NO_PAID_OR_REAL_CREDIT",
    checks,
    failures,
    summary: { checks: checks.length, passed: checks.length - failures.length, failed: failures.length },
    realEvidenceCreditsGranted: 0,
    paidSkuCreditsGranted: 0,
    liveProven: false,
    saleEnabled: false,
    truthBoundary: policy.truthBoundary,
  };
}

export const A94R2_CROSS_SURFACE_REVISION = REVISION;
export const A94R2_CROSS_SURFACE_PARENT = PARENT;
