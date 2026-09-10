import catalogSource from "../../config/pass35/product-cell-catalog.json" with { type: "json" };

import type {
  VlmPaidAccessContext,
  VlmPaidProductId,
} from "@/lib/commerce/vlm-paid-access";

export const PASS35_PAID_UI_STOP_SELL_ID =
  "PASS35_PC00_PAID_UI_STOP_SELL" as const;

type PaidTier = "pro" | "advanced";
type PaidSurface = Exclude<VlmPaidAccessContext["surface"], "unknown">;

type CatalogCell = {
  productCellId: string;
  role: string;
  acceptedCheckoutSurfaces: string[];
  tier: string;
  sellEnabled: boolean;
  sellBlockedReasons: string[];
  readiness: Record<string, boolean>;
};

type LegacyMapping = {
  legacyProductId: string;
  productCellId: string;
  requiredSurfaces: string[];
  requiredTier: string;
};

type Catalog = {
  catalogPolicy: {
    flagshipSelected: boolean;
    catalogApproved: boolean;
    legacySkuMayAuthorizeCharge: boolean;
    missingProductCellMayBeDerivedOnlyFromExactLegacySurfaceAndTier: boolean;
  };
  legacySkuMappings: LegacyMapping[];
  productCells: CatalogCell[];
};

const catalog = catalogSource as unknown as Catalog;
const cellsById = new Map(
  catalog.productCells.map((cell) => [cell.productCellId, cell]),
);

export type Pass35PaidUiStopSellVerdict =
  | {
      ok: true;
      checkoutAllowed: true;
      passId: typeof PASS35_PAID_UI_STOP_SELL_ID;
      productId: VlmPaidProductId;
      productCellId: string;
      surface: PaidSurface;
      tier: PaidTier;
      derivedFromLegacy: boolean;
      blockers: [];
    }
  | {
      ok: false;
      checkoutAllowed: false;
      passId: typeof PASS35_PAID_UI_STOP_SELL_ID;
      reason:
        | "invalid_ui_binding"
        | "unknown_or_ambiguous_legacy_mapping"
        | "product_cell_binding_mismatch"
        | "product_cell_not_sell_ready";
      productId?: string;
      productCellId?: string;
      expectedProductCellId?: string;
      surface?: string;
      tier?: string;
      derivedFromLegacy: boolean;
      blockers: string[];
    };

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Browser-safe mirror of the server checkout decision. Both decisions consume
 * the same canonical PASS35 catalog. This is a UX stop-sell only; the server
 * remains the authority and evaluates the binding again before account,
 * provider or Stripe work.
 */
export function resolvePass35PaidUiStopSell(args: {
  productId: unknown;
  requestedProductCellId?: unknown;
  surface: unknown;
  tier: unknown;
}): Pass35PaidUiStopSellVerdict {
  const productId = clean(args.productId);
  const requestedProductCellId = clean(args.requestedProductCellId);
  const requestedWasProvided =
    args.requestedProductCellId !== undefined &&
    args.requestedProductCellId !== null;
  const surface = clean(args.surface);
  const tier = clean(args.tier);

  if (
    !productId ||
    !surface ||
    (tier !== "pro" && tier !== "advanced") ||
    (requestedWasProvided && !requestedProductCellId)
  ) {
    return {
      ok: false,
      checkoutAllowed: false,
      passId: PASS35_PAID_UI_STOP_SELL_ID,
      reason: "invalid_ui_binding",
      productId,
      productCellId: requestedProductCellId || undefined,
      surface,
      tier,
      derivedFromLegacy: false,
      blockers: ["PASS35_UI_BINDING_INVALID"],
    };
  }

  const matches = catalog.legacySkuMappings.filter(
    (mapping) =>
      mapping.legacyProductId === productId &&
      mapping.requiredTier === tier &&
      mapping.requiredSurfaces.includes(surface),
  );
  if (matches.length !== 1) {
    return {
      ok: false,
      checkoutAllowed: false,
      passId: PASS35_PAID_UI_STOP_SELL_ID,
      reason: "unknown_or_ambiguous_legacy_mapping",
      productId,
      productCellId: requestedProductCellId || undefined,
      surface,
      tier,
      derivedFromLegacy: !requestedProductCellId,
      blockers: ["PASS35_UI_EXACT_LEGACY_SURFACE_TIER_MAPPING_REQUIRED"],
    };
  }

  const mapping = matches[0];
  if (
    requestedProductCellId &&
    requestedProductCellId !== mapping.productCellId
  ) {
    return {
      ok: false,
      checkoutAllowed: false,
      passId: PASS35_PAID_UI_STOP_SELL_ID,
      reason: "product_cell_binding_mismatch",
      productId,
      productCellId: requestedProductCellId,
      expectedProductCellId: mapping.productCellId,
      surface,
      tier,
      derivedFromLegacy: false,
      blockers: ["PASS35_UI_PRODUCT_CELL_BINDING_MISMATCH"],
    };
  }
  if (
    !requestedProductCellId &&
    !catalog.catalogPolicy
      .missingProductCellMayBeDerivedOnlyFromExactLegacySurfaceAndTier
  ) {
    return {
      ok: false,
      checkoutAllowed: false,
      passId: PASS35_PAID_UI_STOP_SELL_ID,
      reason: "invalid_ui_binding",
      productId,
      expectedProductCellId: mapping.productCellId,
      surface,
      tier,
      derivedFromLegacy: true,
      blockers: ["PASS35_UI_EXPLICIT_PRODUCT_CELL_REQUIRED"],
    };
  }

  const cell = cellsById.get(mapping.productCellId);
  if (
    !cell ||
    cell.tier !== tier ||
    !cell.acceptedCheckoutSurfaces.includes(surface)
  ) {
    return {
      ok: false,
      checkoutAllowed: false,
      passId: PASS35_PAID_UI_STOP_SELL_ID,
      reason: "product_cell_binding_mismatch",
      productId,
      productCellId: requestedProductCellId || mapping.productCellId,
      expectedProductCellId: mapping.productCellId,
      surface,
      tier,
      derivedFromLegacy: !requestedProductCellId,
      blockers: ["PASS35_UI_CATALOG_CELL_CONTRACT_INVALID"],
    };
  }

  const blockers = new Set<string>();
  if (!catalog.catalogPolicy.catalogApproved)
    blockers.add("PASS35_CATALOG_NOT_APPROVED");
  if (!catalog.catalogPolicy.flagshipSelected)
    blockers.add("PASS35_FLAGSHIP_NOT_SELECTED");
  if (!catalog.catalogPolicy.legacySkuMayAuthorizeCharge)
    blockers.add("PASS35_LEGACY_SKU_CHARGE_NOT_AUTHORIZED");
  if (cell.role !== "FLAGSHIP" && cell.role !== "REQUIRED_DEPENDENCY")
    blockers.add(`PASS35_ROLE_NOT_SELLABLE:${cell.role}`);
  if (!cell.sellEnabled) blockers.add("PASS35_PRODUCT_CELL_SELL_DISABLED");
  for (const reason of cell.sellBlockedReasons) blockers.add(reason);
  for (const [key, ready] of Object.entries(cell.readiness)) {
    if (!ready) blockers.add(`PASS35_READINESS_NOT_PROVEN:${key}`);
  }

  const blockerList = Array.from(blockers).sort();
  if (blockerList.length > 0) {
    return {
      ok: false,
      checkoutAllowed: false,
      passId: PASS35_PAID_UI_STOP_SELL_ID,
      reason: "product_cell_not_sell_ready",
      productId,
      productCellId: cell.productCellId,
      surface,
      tier,
      derivedFromLegacy: !requestedProductCellId,
      blockers: blockerList,
    };
  }

  return {
    ok: true,
    checkoutAllowed: true,
    passId: PASS35_PAID_UI_STOP_SELL_ID,
    productId: productId as VlmPaidProductId,
    productCellId: cell.productCellId,
    surface: surface as PaidSurface,
    tier,
    derivedFromLegacy: !requestedProductCellId,
    blockers: [],
  };
}

export function pass35PaidUiStopSellCopy(locale: unknown) {
  if (locale === "pl")
    return "Sprzedaż tej usługi jest wstrzymana do czasu zatwierdzenia produktu i wszystkich wymaganych dowodów.";
  if (locale === "de")
    return "Der Verkauf dieses Dienstes bleibt gesperrt, bis Produkt und erforderliche Nachweise genehmigt sind.";
  return "This service is not for sale until the product and all required evidence are approved.";
}

export class Pass35PaidUiStopSellError extends Error {
  readonly code = "product_cell_not_sell_ready";
  readonly verdict: Extract<Pass35PaidUiStopSellVerdict, { ok: false }>;

  constructor(verdict: Extract<Pass35PaidUiStopSellVerdict, { ok: false }>) {
    super("product_cell_not_sell_ready");
    this.name = "Pass35PaidUiStopSellError";
    this.verdict = verdict;
  }
}
