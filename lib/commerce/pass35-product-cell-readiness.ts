import { createHash } from "node:crypto";
import catalogSource from "../../config/pass35/product-cell-catalog.json" with { type: "json" };

export const PASS35_PRODUCT_CELL_GATE_ID = "PASS35_PC00_PRODUCT_CELL_CHECKOUT_GATE" as const;

export const PASS35_LEGACY_PRODUCT_IDS = [
  "vlm_pro_analysis_single",
  "vlm_advanced_analysis_single",
  "vlm_pro_pdf_single",
  "vlm_advanced_pdf_single",
  "vlm_pro_audit_review",
  "vlm_advanced_audit_human_review",
] as const;

export type Pass35LegacyProductId = (typeof PASS35_LEGACY_PRODUCT_IDS)[number];
export type Pass35CheckoutSurface = "shield" | "real-markets" | "browser" | "audit";
export type Pass35ProductTier = "basic" | "pro" | "advanced";
export type Pass35ProductCellRole = "FLAGSHIP" | "REQUIRED_DEPENDENCY" | "EXPERIMENT" | "PARKED" | "REMOVE";

const READINESS_KEYS = [
  "catalogApproved",
  "flagshipApproved",
  "organizationApproved",
  "legalApproved",
  "providerRightsApproved",
  "securityStagingProven",
  "tierValueProven",
  "paymentLifecycleStagingProven",
  "capacityApproved",
  "canonicalPacketProven",
] as const;

type Pass35ReadinessKey = (typeof READINESS_KEYS)[number];
type Pass35ProductCellReadiness = Record<Pass35ReadinessKey, boolean>;

export type Pass35ProductCell = {
  productCellId: string;
  productFamily: string;
  surface: string;
  acceptedCheckoutSurfaces: Pass35CheckoutSurface[];
  tier: Pass35ProductTier;
  role: Pass35ProductCellRole;
  roleReason: string;
  candidateSku: string;
  legacyProductIds: Pass35LegacyProductId[];
  currentStatus: string;
  sellEnabled: boolean;
  sellBlockedReasons: string[];
  requiredGates: string[];
  readiness: Pass35ProductCellReadiness;
};

type Pass35LegacySkuMapping = {
  legacyProductId: Pass35LegacyProductId;
  productCellId: string;
  requiredSurfaces: Pass35CheckoutSurface[];
  requiredTier: "pro" | "advanced";
  mappingMode: "DERIVE_WHEN_PRODUCT_CELL_ID_OMITTED";
  status: string;
};

type Pass35ProductCellCatalog = {
  schemaVersion: string;
  passId: string;
  status: string;
  generatedFrom: string;
  truthBoundary: string;
  catalogPolicy: {
    flagshipSelected: boolean;
    catalogApproved: boolean;
    sellByDefault: boolean;
    legacySkuMayAuthorizeCharge: boolean;
    missingProductCellMayBeDerivedOnlyFromExactLegacySurfaceAndTier: boolean;
    unknownOrAmbiguousBindingFailsClosed: boolean;
  };
  legacySkuMappings: Pass35LegacySkuMapping[];
  productCells: Pass35ProductCell[];
};

const LEGACY_IDS = new Set<string>(PASS35_LEGACY_PRODUCT_IDS);
const CHECKOUT_SURFACES = new Set<string>(["shield", "real-markets", "browser", "audit"]);
const TIERS = new Set<string>(["basic", "pro", "advanced"]);
const ROLES = new Set<string>(["FLAGSHIP", "REQUIRED_DEPENDENCY", "EXPERIMENT", "PARKED", "REMOVE"]);
const CELL_ID = /^[a-z0-9]+(?:_[a-z0-9]+)*$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`pass35_product_cell_catalog_invalid:${label}`);
}

function validateCatalog(value: unknown): Pass35ProductCellCatalog {
  if (!isRecord(value)) throw new Error("pass35_product_cell_catalog_invalid:root");
  if (value.schemaVersion !== "velmere.pass35.product-cell-catalog.v1") {
    throw new Error("pass35_product_cell_catalog_invalid:schema_version");
  }
  if (!isRecord(value.catalogPolicy) || !Array.isArray(value.legacySkuMappings) || !Array.isArray(value.productCells)) {
    throw new Error("pass35_product_cell_catalog_invalid:top_level_shape");
  }

  const policy = value.catalogPolicy;
  for (const key of [
    "flagshipSelected",
    "catalogApproved",
    "sellByDefault",
    "legacySkuMayAuthorizeCharge",
    "missingProductCellMayBeDerivedOnlyFromExactLegacySurfaceAndTier",
    "unknownOrAmbiguousBindingFailsClosed",
  ]) {
    if (typeof policy[key] !== "boolean") throw new Error(`pass35_product_cell_catalog_invalid:policy:${key}`);
  }

  const cells = value.productCells as unknown[];
  const cellIds = new Set<string>();
  const parsedCells: Pass35ProductCell[] = [];
  for (const [index, raw] of cells.entries()) {
    if (!isRecord(raw)) throw new Error(`pass35_product_cell_catalog_invalid:cell:${index}`);
    assertString(raw.productCellId, `cell:${index}:productCellId`);
    assertString(raw.productFamily, `cell:${index}:productFamily`);
    assertString(raw.surface, `cell:${index}:surface`);
    assertString(raw.roleReason, `cell:${index}:roleReason`);
    assertString(raw.candidateSku, `cell:${index}:candidateSku`);
    assertString(raw.currentStatus, `cell:${index}:currentStatus`);
    if (!CELL_ID.test(raw.productCellId as string) || cellIds.has(raw.productCellId as string)) {
      throw new Error(`pass35_product_cell_catalog_invalid:cell_id:${String(raw.productCellId)}`);
    }
    cellIds.add(raw.productCellId as string);
    if (!TIERS.has(String(raw.tier))) throw new Error(`pass35_product_cell_catalog_invalid:tier:${String(raw.productCellId)}`);
    if (!ROLES.has(String(raw.role))) throw new Error(`pass35_product_cell_catalog_invalid:role:${String(raw.productCellId)}`);
    if (!Array.isArray(raw.acceptedCheckoutSurfaces) || raw.acceptedCheckoutSurfaces.some((item) => !CHECKOUT_SURFACES.has(String(item)))) {
      throw new Error(`pass35_product_cell_catalog_invalid:checkout_surfaces:${String(raw.productCellId)}`);
    }
    if (!Array.isArray(raw.legacyProductIds) || raw.legacyProductIds.some((item) => !LEGACY_IDS.has(String(item)))) {
      throw new Error(`pass35_product_cell_catalog_invalid:legacy_products:${String(raw.productCellId)}`);
    }
    if (typeof raw.sellEnabled !== "boolean" || !Array.isArray(raw.sellBlockedReasons) || !Array.isArray(raw.requiredGates)) {
      throw new Error(`pass35_product_cell_catalog_invalid:sell_contract:${String(raw.productCellId)}`);
    }
    const readiness = raw.readiness;
    if (!isRecord(readiness) || READINESS_KEYS.some((key) => typeof readiness[key] !== "boolean")) {
      throw new Error(`pass35_product_cell_catalog_invalid:readiness:${String(raw.productCellId)}`);
    }
    if (raw.sellEnabled && (raw.sellBlockedReasons.length > 0 || READINESS_KEYS.some((key) => readiness[key] !== true))) {
      throw new Error(`pass35_product_cell_catalog_invalid:unsafe_sell_enable:${String(raw.productCellId)}`);
    }
    parsedCells.push(raw as unknown as Pass35ProductCell);
  }

  const mappings = value.legacySkuMappings as unknown[];
  const mappedLegacyIds = new Set<string>();
  const parsedMappings: Pass35LegacySkuMapping[] = [];
  for (const [index, raw] of mappings.entries()) {
    if (!isRecord(raw)) throw new Error(`pass35_product_cell_catalog_invalid:mapping:${index}`);
    if (!LEGACY_IDS.has(String(raw.legacyProductId)) || mappedLegacyIds.has(String(raw.legacyProductId))) {
      throw new Error(`pass35_product_cell_catalog_invalid:legacy_mapping:${String(raw.legacyProductId)}`);
    }
    mappedLegacyIds.add(String(raw.legacyProductId));
    if (!cellIds.has(String(raw.productCellId))) {
      throw new Error(`pass35_product_cell_catalog_invalid:mapping_cell:${String(raw.productCellId)}`);
    }
    if (!Array.isArray(raw.requiredSurfaces) || raw.requiredSurfaces.length === 0 || raw.requiredSurfaces.some((item) => !CHECKOUT_SURFACES.has(String(item)))) {
      throw new Error(`pass35_product_cell_catalog_invalid:mapping_surfaces:${String(raw.legacyProductId)}`);
    }
    if (raw.requiredTier !== "pro" && raw.requiredTier !== "advanced") {
      throw new Error(`pass35_product_cell_catalog_invalid:mapping_tier:${String(raw.legacyProductId)}`);
    }
    if (raw.mappingMode !== "DERIVE_WHEN_PRODUCT_CELL_ID_OMITTED") {
      throw new Error(`pass35_product_cell_catalog_invalid:mapping_mode:${String(raw.legacyProductId)}`);
    }
    const cell = parsedCells.find((item) => item.productCellId === raw.productCellId);
    if (!cell || cell.tier !== raw.requiredTier || !cell.legacyProductIds.includes(raw.legacyProductId as Pass35LegacyProductId)) {
      throw new Error(`pass35_product_cell_catalog_invalid:mapping_cell_contract:${String(raw.legacyProductId)}`);
    }
    if ((raw.requiredSurfaces as unknown[]).some((surface) => !cell.acceptedCheckoutSurfaces.includes(surface as Pass35CheckoutSurface))) {
      throw new Error(`pass35_product_cell_catalog_invalid:mapping_surface_contract:${String(raw.legacyProductId)}`);
    }
    parsedMappings.push(raw as unknown as Pass35LegacySkuMapping);
  }

  if (mappedLegacyIds.size !== PASS35_LEGACY_PRODUCT_IDS.length || PASS35_LEGACY_PRODUCT_IDS.some((id) => !mappedLegacyIds.has(id))) {
    throw new Error("pass35_product_cell_catalog_invalid:legacy_mapping_incomplete");
  }

  return {
    ...(value as unknown as Pass35ProductCellCatalog),
    catalogPolicy: policy as Pass35ProductCellCatalog["catalogPolicy"],
    legacySkuMappings: parsedMappings,
    productCells: parsedCells,
  };
}

export const PASS35_PRODUCT_CELL_CATALOG = validateCatalog(catalogSource);

const cellsById = new Map(PASS35_PRODUCT_CELL_CATALOG.productCells.map((cell) => [cell.productCellId, cell]));

function exactString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function bindingHash(args: {
  legacyProductId: Pass35LegacyProductId;
  productCellId: string;
  surface: Pass35CheckoutSurface;
  tier: "pro" | "advanced";
}) {
  return createHash("sha256")
    .update(JSON.stringify([PASS35_PRODUCT_CELL_GATE_ID, args.legacyProductId, args.productCellId, args.surface, args.tier]))
    .digest("hex");
}

export type Pass35ProductCellBindingVerdict =
  | {
      ok: true;
      chargeAllowed: false;
      passId: typeof PASS35_PRODUCT_CELL_GATE_ID;
      legacyProductId: Pass35LegacyProductId;
      productCell: Pass35ProductCell;
      surface: Pass35CheckoutSurface;
      tier: "pro" | "advanced";
      bindingSha256: string;
      derivedFromLegacy: boolean;
    }
  | {
      ok: false;
      chargeAllowed: false;
      passId: typeof PASS35_PRODUCT_CELL_GATE_ID;
      error:
        | "invalid_legacy_product_id"
        | "invalid_product_cell_id"
        | "product_cell_surface_tier_mismatch"
        | "product_cell_binding_mismatch"
        | "ambiguous_product_cell_binding";
      status: 400 | 409;
      legacyProductId?: string;
      requestedProductCellId?: string;
      surface?: string;
      tier?: string;
      expectedProductCellId?: string;
    };

export function resolvePass35ProductCellBinding(args: {
  legacyProductId: unknown;
  requestedProductCellId?: unknown;
  surface: unknown;
  tier: unknown;
}): Pass35ProductCellBindingVerdict {
  const legacyProductId = exactString(args.legacyProductId);
  const requestedWasProvided = args.requestedProductCellId !== undefined && args.requestedProductCellId !== null;
  const requestedProductCellId = exactString(args.requestedProductCellId);
  const surface = exactString(args.surface);
  const tier = exactString(args.tier);

  if (!LEGACY_IDS.has(legacyProductId)) {
    return { ok: false, chargeAllowed: false, passId: PASS35_PRODUCT_CELL_GATE_ID, error: "invalid_legacy_product_id", status: 400, legacyProductId };
  }
  if (requestedWasProvided && (!requestedProductCellId || !CELL_ID.test(requestedProductCellId) || !cellsById.has(requestedProductCellId))) {
    return {
      ok: false,
      chargeAllowed: false,
      passId: PASS35_PRODUCT_CELL_GATE_ID,
      error: "invalid_product_cell_id",
      status: 400,
      legacyProductId,
      requestedProductCellId,
      surface,
      tier,
    };
  }

  const matches = PASS35_PRODUCT_CELL_CATALOG.legacySkuMappings.filter((mapping) =>
    mapping.legacyProductId === legacyProductId && mapping.requiredTier === tier && mapping.requiredSurfaces.includes(surface as Pass35CheckoutSurface),
  );
  if (matches.length === 0) {
    return {
      ok: false,
      chargeAllowed: false,
      passId: PASS35_PRODUCT_CELL_GATE_ID,
      error: "product_cell_surface_tier_mismatch",
      status: 409,
      legacyProductId,
      requestedProductCellId: requestedProductCellId || undefined,
      surface,
      tier,
    };
  }
  if (matches.length !== 1) {
    return {
      ok: false,
      chargeAllowed: false,
      passId: PASS35_PRODUCT_CELL_GATE_ID,
      error: "ambiguous_product_cell_binding",
      status: 409,
      legacyProductId,
      requestedProductCellId: requestedProductCellId || undefined,
      surface,
      tier,
    };
  }

  const mapping = matches[0];
  if (requestedProductCellId && requestedProductCellId !== mapping.productCellId) {
    return {
      ok: false,
      chargeAllowed: false,
      passId: PASS35_PRODUCT_CELL_GATE_ID,
      error: "product_cell_binding_mismatch",
      status: 409,
      legacyProductId,
      requestedProductCellId,
      expectedProductCellId: mapping.productCellId,
      surface,
      tier,
    };
  }

  const productCell = cellsById.get(mapping.productCellId);
  if (!productCell) throw new Error(`pass35_product_cell_catalog_invalid:runtime_cell_missing:${mapping.productCellId}`);
  const safeSurface = surface as Pass35CheckoutSurface;
  const safeTier = tier as "pro" | "advanced";
  return {
    ok: true,
    chargeAllowed: false,
    passId: PASS35_PRODUCT_CELL_GATE_ID,
    legacyProductId: legacyProductId as Pass35LegacyProductId,
    productCell,
    surface: safeSurface,
    tier: safeTier,
    bindingSha256: bindingHash({ legacyProductId: legacyProductId as Pass35LegacyProductId, productCellId: productCell.productCellId, surface: safeSurface, tier: safeTier }),
    derivedFromLegacy: !requestedProductCellId,
  };
}

export type Pass35ProductCellCheckoutVerdict =
  | (Extract<Pass35ProductCellBindingVerdict, { ok: false }> & { readinessEvaluated: false })
  | {
      ok: false;
      chargeAllowed: false;
      passId: typeof PASS35_PRODUCT_CELL_GATE_ID;
      error: "product_cell_not_sell_ready";
      status: 503;
      readinessEvaluated: true;
      legacyProductId: Pass35LegacyProductId;
      productCell: Pass35ProductCell;
      surface: Pass35CheckoutSurface;
      tier: "pro" | "advanced";
      bindingSha256: string;
      derivedFromLegacy: boolean;
      blockers: string[];
    }
  | {
      ok: true;
      chargeAllowed: true;
      passId: typeof PASS35_PRODUCT_CELL_GATE_ID;
      readinessEvaluated: true;
      legacyProductId: Pass35LegacyProductId;
      productCell: Pass35ProductCell;
      surface: Pass35CheckoutSurface;
      tier: "pro" | "advanced";
      bindingSha256: string;
      derivedFromLegacy: boolean;
      blockers: [];
    };

export function evaluatePass35ProductCellCheckout(args: {
  legacyProductId: unknown;
  requestedProductCellId?: unknown;
  surface: unknown;
  tier: unknown;
}): Pass35ProductCellCheckoutVerdict {
  const binding = resolvePass35ProductCellBinding(args);
  if (!binding.ok) return { ...binding, readinessEvaluated: false };

  const blockers = new Set<string>();
  const policy = PASS35_PRODUCT_CELL_CATALOG.catalogPolicy;
  if (!policy.catalogApproved) blockers.add("PASS35_CATALOG_NOT_APPROVED");
  if (!policy.flagshipSelected) blockers.add("PASS35_FLAGSHIP_NOT_SELECTED");
  if (policy.legacySkuMayAuthorizeCharge !== true) blockers.add("PASS35_LEGACY_SKU_CHARGE_NOT_AUTHORIZED");
  if (binding.productCell.role !== "FLAGSHIP" && binding.productCell.role !== "REQUIRED_DEPENDENCY") {
    blockers.add(`PASS35_ROLE_NOT_SELLABLE:${binding.productCell.role}`);
  }
  if (!binding.productCell.sellEnabled) blockers.add("PASS35_PRODUCT_CELL_SELL_DISABLED");
  for (const reason of binding.productCell.sellBlockedReasons) blockers.add(reason);
  for (const key of READINESS_KEYS) {
    if (!binding.productCell.readiness[key]) blockers.add(`PASS35_READINESS_NOT_PROVEN:${key}`);
  }

  const blockerList = Array.from(blockers).sort();
  if (blockerList.length > 0) {
    return {
      ...binding,
      ok: false,
      chargeAllowed: false,
      error: "product_cell_not_sell_ready",
      status: 503,
      readinessEvaluated: true,
      blockers: blockerList,
    };
  }

  return {
    ...binding,
    ok: true,
    chargeAllowed: true,
    readinessEvaluated: true,
    blockers: [],
  };
}

export function listPass35ProductCells() {
  return PASS35_PRODUCT_CELL_CATALOG.productCells.map((cell) => ({ ...cell, acceptedCheckoutSurfaces: [...cell.acceptedCheckoutSurfaces], legacyProductIds: [...cell.legacyProductIds], sellBlockedReasons: [...cell.sellBlockedReasons], requiredGates: [...cell.requiredGates], readiness: { ...cell.readiness } }));
}
