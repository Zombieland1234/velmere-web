import {
  getVlmCanonicalCustomerProduct,
  type VlmCanonicalProductFamily,
  type VlmCanonicalProductId,
  type VlmCanonicalReportTier,
} from "./vlm-canonical-product-topology";

export const VLM_TIERED_TABLE_CUSTOMER_CONTRACT_ID =
  "velmere.current-execution.tiered-table-customer-contract.v1" as const;

export const VLM_TIERED_TABLE_PRODUCT_IDS = Object.freeze([
  "shield-basic",
  "shield-pro",
  "shield-advanced",
  "shield-pro-basic",
  "shield-pro-pro",
  "shield-pro-advanced",
  "real-markets-basic",
  "real-markets-pro",
  "real-markets-advanced",
] as const satisfies readonly VlmCanonicalProductId[]);

export type VlmTieredTableProductId = (typeof VLM_TIERED_TABLE_PRODUCT_IDS)[number];
export type VlmTieredTableFamily = Extract<VlmCanonicalProductFamily, "shield" | "shield-pro" | "real-markets">;

export const VLM_CUSTOMER_DATA_STATES = Object.freeze([
  "LOADING",
  "READY",
  "PARTIAL",
  "STALE",
  "WITHHELD",
  "UNAVAILABLE",
  "ERROR_CUSTOMER_SAFE",
] as const);

export type VlmCustomerDataState = (typeof VLM_CUSTOMER_DATA_STATES)[number];

export const VLM_MARKET_SEMANTIC_CLASSES = Object.freeze([
  "REFERENCE",
  "INDICATIVE",
  "DELAYED",
  "OFFICIAL_CLOSE",
  "CURRENT_QUOTE",
  "VENUE_QUOTE",
  "EXECUTABLE_QUOTE",
  "DERIVED",
  "HISTORICAL",
] as const);

export type VlmMarketSemanticClass = (typeof VLM_MARKET_SEMANTIC_CLASSES)[number];

export const VLM_FIELD_RIGHTS_STATES = Object.freeze([
  "GREEN_EXACT",
  "GREEN_CONDITIONAL",
  "AMBER_REVIEW",
  "RED_BLOCKED",
  "GRAY_UNKNOWN",
] as const);

export type VlmFieldRightsState = (typeof VLM_FIELD_RIGHTS_STATES)[number];

export type VlmCustomerTableValue =
  | string
  | number
  | boolean
  | readonly string[]
  | readonly number[]
  | null;

export type VlmTieredTableContractRow = Readonly<{
  productId: VlmTieredTableProductId;
  family: VlmTieredTableFamily;
  tier: VlmCanonicalReportTier;
}>;

export const VLM_TIERED_TABLE_CONTRACT_ROWS = Object.freeze(
  VLM_TIERED_TABLE_PRODUCT_IDS.map((productId): VlmTieredTableContractRow => {
    const product = getVlmCanonicalCustomerProduct(productId);
    if (
      !product
      || product.productClass !== "TIERED_PRODUCT"
      || product.tier === null
      || (product.family !== "shield" && product.family !== "shield-pro" && product.family !== "real-markets")
    ) {
      throw new Error(`tiered_table_product_topology_mismatch:${productId}`);
    }
    return Object.freeze({ productId, family: product.family, tier: product.tier });
  }),
);

export type VlmTieredTableBoundaryInput = Readonly<{
  requestedProductId: VlmTieredTableProductId;
  analyzedProductId: VlmTieredTableProductId;
  deliveredProductId: VlmTieredTableProductId;
  rightsState: VlmFieldRightsState;
  conditionalRightsSatisfied?: boolean;
  sourceState: VlmCustomerDataState;
  sourceSemanticClass: VlmMarketSemanticClass;
  customerSemanticClass: VlmMarketSemanticClass;
  sourceObservedAt: string | null;
  evaluatedAt: string;
  maxAgeSeconds: number;
  value: VlmCustomerTableValue;
  riskScore: number | null;
  confidence: number | null;
  customerErrorCode?: string | null;
  derivedFromReceiptIds?: readonly string[];
}>;

export type VlmTieredTableBoundaryReason =
  | "ready"
  | "loading"
  | "partial"
  | "stale"
  | "rights_blocked"
  | "tier_identity_mismatch"
  | "source_unavailable"
  | "source_timestamp_invalid"
  | "semantic_class_mismatch"
  | "derivation_receipt_missing"
  | "customer_safe_error";

export type VlmTieredTableCustomerProjection = Readonly<{
  schemaVersion: typeof VLM_TIERED_TABLE_CUSTOMER_CONTRACT_ID;
  productId: VlmTieredTableProductId;
  family: VlmTieredTableFamily;
  tier: VlmCanonicalReportTier;
  state: VlmCustomerDataState;
  reason: VlmTieredTableBoundaryReason;
  semanticClass: VlmMarketSemanticClass;
  rightsState: VlmFieldRightsState;
  value: VlmCustomerTableValue;
  riskScore: number | null;
  confidence: number | null;
  sourceObservedAt: string | null;
  evaluatedAt: string;
  customerErrorCode: string | null;
  liveClaimed: boolean;
  executableQuoteClaimed: boolean;
  silentTierDowngradeAllowed: false;
}>;

const SAFE_ERROR_CODE = /^[a-z][a-z0-9_]{2,95}$/u;
const SAFE_RECEIPT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/u;

function isExactIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 20 || value.length > 35) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function finitePercent(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

function safeText(value: string): boolean {
  if (value.length > 2_048 || value !== value.normalize("NFKC")) return false;
  return !Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f
      || (codePoint >= 0x7f && codePoint <= 0x9f)
      || (codePoint >= 0x202a && codePoint <= 0x202e)
      || (codePoint >= 0x2066 && codePoint <= 0x2069);
  });
}

function safeValue(value: VlmCustomerTableValue): VlmCustomerTableValue {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return safeText(value) ? value : null;
  if (value.length > 512) return null;
  if (value.every((item) => typeof item === "number" && Number.isFinite(item))) return Object.freeze([...value] as number[]);
  if (value.every((item) => typeof item === "string" && safeText(item))) return Object.freeze([...value] as string[]);
  return null;
}

function rightsAllowed(input: VlmTieredTableBoundaryInput): boolean {
  return input.rightsState === "GREEN_EXACT"
    || (input.rightsState === "GREEN_CONDITIONAL" && input.conditionalRightsSatisfied === true);
}

function semanticClassesCompatible(input: VlmTieredTableBoundaryInput): boolean {
  if (input.customerSemanticClass === input.sourceSemanticClass) return true;
  if (input.customerSemanticClass === "HISTORICAL" && input.sourceSemanticClass === "OFFICIAL_CLOSE") return true;
  if (input.customerSemanticClass !== "DERIVED") return false;
  return (input.derivedFromReceiptIds ?? []).some((receiptId) => SAFE_RECEIPT_ID.test(receiptId));
}

function tieredContractRow(productId: VlmTieredTableProductId): VlmTieredTableContractRow {
  const row = VLM_TIERED_TABLE_CONTRACT_ROWS.find((candidate) => candidate.productId === productId);
  if (!row) throw new Error(`tiered_table_product_not_registered:${productId}`);
  return row;
}

function projection(args: {
  row: VlmTieredTableContractRow;
  input: VlmTieredTableBoundaryInput;
  state: VlmCustomerDataState;
  reason: VlmTieredTableBoundaryReason;
  value?: VlmCustomerTableValue;
  riskScore?: number | null;
  confidence?: number | null;
  sourceObservedAt?: string | null;
  customerErrorCode?: string | null;
}): VlmTieredTableCustomerProjection {
  const liveClaimed = args.state === "READY"
    && (args.input.customerSemanticClass === "CURRENT_QUOTE" || args.input.customerSemanticClass === "VENUE_QUOTE");
  const executableQuoteClaimed = args.state === "READY"
    && args.input.customerSemanticClass === "EXECUTABLE_QUOTE";
  return Object.freeze({
    schemaVersion: VLM_TIERED_TABLE_CUSTOMER_CONTRACT_ID,
    productId: args.row.productId,
    family: args.row.family,
    tier: args.row.tier,
    state: args.state,
    reason: args.reason,
    semanticClass: args.input.customerSemanticClass,
    rightsState: args.input.rightsState,
    value: args.value ?? null,
    riskScore: args.riskScore ?? null,
    confidence: args.confidence ?? null,
    sourceObservedAt: args.sourceObservedAt ?? null,
    evaluatedAt: args.input.evaluatedAt,
    customerErrorCode: args.customerErrorCode ?? null,
    liveClaimed,
    executableQuoteClaimed,
    silentTierDowngradeAllowed: false,
  });
}

export function evaluateVlmTieredTableCustomerBoundary(
  input: VlmTieredTableBoundaryInput,
): VlmTieredTableCustomerProjection {
  const row = tieredContractRow(input.requestedProductId);

  if (input.analyzedProductId !== row.productId || input.deliveredProductId !== row.productId) {
    return projection({ row, input, state: "WITHHELD", reason: "tier_identity_mismatch" });
  }

  if (!rightsAllowed(input)) {
    // GRAY_UNKNOWN behaves exactly like RED_BLOCKED for customer output.
    return projection({ row, input, state: "WITHHELD", reason: "rights_blocked" });
  }

  if (input.sourceState === "LOADING") {
    return projection({ row, input, state: "LOADING", reason: "loading" });
  }
  if (input.sourceState === "WITHHELD") {
    return projection({ row, input, state: "WITHHELD", reason: "rights_blocked" });
  }
  if (input.sourceState === "UNAVAILABLE") {
    return projection({ row, input, state: "UNAVAILABLE", reason: "source_unavailable" });
  }
  if (input.sourceState === "ERROR_CUSTOMER_SAFE") {
    const customerErrorCode = typeof input.customerErrorCode === "string" && SAFE_ERROR_CODE.test(input.customerErrorCode)
      ? input.customerErrorCode
      : "customer_data_unavailable";
    return projection({
      row,
      input,
      state: "ERROR_CUSTOMER_SAFE",
      reason: "customer_safe_error",
      customerErrorCode,
    });
  }

  if (!semanticClassesCompatible(input)) {
    const reason = input.customerSemanticClass === "DERIVED"
      ? "derivation_receipt_missing"
      : "semantic_class_mismatch";
    return projection({ row, input, state: "WITHHELD", reason });
  }

  if (!isExactIsoTimestamp(input.evaluatedAt) || !isExactIsoTimestamp(input.sourceObservedAt)) {
    return projection({ row, input, state: "UNAVAILABLE", reason: "source_timestamp_invalid" });
  }

  const maxAgeSeconds = Number.isFinite(input.maxAgeSeconds) && input.maxAgeSeconds >= 0
    ? input.maxAgeSeconds
    : 0;
  const ageSeconds = Math.max(0, (Date.parse(input.evaluatedAt) - Date.parse(input.sourceObservedAt)) / 1_000);
  const state = ageSeconds > maxAgeSeconds || input.sourceState === "STALE"
    ? "STALE" as const
    : input.sourceState === "PARTIAL"
      ? "PARTIAL" as const
      : "READY" as const;
  const reason = state === "STALE" ? "stale" : state === "PARTIAL" ? "partial" : "ready";
  const value = safeValue(input.value);
  if (value === null && input.value !== null) {
    return projection({ row, input, state: "UNAVAILABLE", reason: "source_unavailable" });
  }

  return projection({
    row,
    input,
    state,
    reason,
    value,
    riskScore: finitePercent(input.riskScore),
    confidence: finitePercent(input.confidence),
    sourceObservedAt: input.sourceObservedAt,
  });
}
