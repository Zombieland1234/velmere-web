export type ProductProvider =
  | "manual"
  | "printful"
  | "tapstitch"
  | "external";

export type ProductStatus =
  | "draft"
  | "coming_soon"
  | "active"
  | "sold_out"
  | "archived"
  | "vlm_locked";

export type FulfilmentMode =
  | "disabled"
  | "external_link"
  | "manual"
  | "automatic";

export type LocalizedString = {
  pl: string;
  en: string;
  de: string;
};

export type SupportedCurrency = "EUR";

export type ProductVariant = {
  id: string;
  title: string;
  size?: string;
  color?: string;
  sku?: string;
  providerVariantId?: string;
  /** Provider availability mapped by Printful/Tapstitch/CSV/operator. */
  providerStatus?: "synced" | "unsynced" | "unknown";
  /** Optional stock or availability quantity from provider/export. Undefined means not supplied. */
  stockQuantity?: number;
  price?: {
    amount: number;
    currency: SupportedCurrency;
  };
  available?: boolean;
};

export type ProductImage = {
  url: string;
  alt: LocalizedString;
  width?: number;
  height?: number;
};

export type ProductSizeMeasurement = {
  size: string;
  /** All values are operator/provider-confirmed centimetres unless explicitly stated in the note. */
  chest?: string;
  length?: string;
  shoulders?: string;
  sleeve?: string;
  waist?: string;
  hip?: string;
  thigh?: string;
  rise?: string;
  inseam?: string;
};

export type ProductTruthProfile = {
  material: LocalizedString;
  composition: LocalizedString;
  weight?: string;
  fit: LocalizedString;
  care: LocalizedString[];
  sizeGuide: {
    note: LocalizedString;
    measurements: ProductSizeMeasurement[];
  };
  deliveryNote: LocalizedString;
  returnNote: LocalizedString;
  launchNote?: LocalizedString;
};


export type ProductBrainMissingField = {
  id: string;
  label: string;
  reason: string;
  blocksActivePublish: boolean;
};

export type ProductBrainChecklistItem = {
  id: string;
  label: string;
  status: "pass" | "review" | "block";
  owner: "ai" | "operator" | "provider" | "system";
};

export type ProductBrainReadiness = {
  score: number;
  level: "ready" | "review" | "blocked";
  canPublishComingSoon: boolean;
  canPublishActive: boolean;
  missing: ProductBrainMissingField[];
  checklist: ProductBrainChecklistItem[];
};

export type ProductBrainResult = {
  schemaVersion: "velmere.product.brain.v2";
  createdAt: string;
  detected: {
    garmentType: string;
    confidence: number;
    color?: string;
    fit?: string;
    weight?: string;
    sizes: string[];
    materialHint?: string;
    provider: ProductProvider;
  };
  providerAdapter: {
    name: ProductProvider;
    sourceQuality: "strong" | "medium" | "weak";
    variantMappingStatus: "complete" | "partial" | "missing";
    imageStatus: "complete" | "partial" | "missing";
    priceStatus: "complete" | "partial" | "missing";
    stockStatus: "complete" | "partial" | "missing" | "not_applicable";
    sizeGuideStatus: "complete" | "partial" | "missing";
    warnings: string[];
  };
  naming: {
    title: LocalizedString;
    seoTitle: LocalizedString;
    metaDescription: LocalizedString;
    altText: LocalizedString;
  };
  readiness: ProductBrainReadiness;
};

export type Product = {
  id: string;
  slug: string;
  provider: ProductProvider;
  providerProductId?: string;
  providerVariantIds?: Record<string, string>;
  externalUrl?: string;

  status: ProductStatus;
  fulfilmentMode: FulfilmentMode;

  title: LocalizedString;
  description: LocalizedString;
  shortDescription: LocalizedString;
  truth?: ProductTruthProfile;

  price: {
    amount: number;
    currency: SupportedCurrency;
  };

  images: ProductImage[];
  variants: ProductVariant[];

  tags: string[];
  collection?: string;
  isVlmLocked?: boolean;

  importSource?: {
    type: "url" | "printful" | "csv";
    sourceUrl?: string;
    importedAt: string;
    warnings?: string[];
  };
};

export type ProductImportDraft = {
  draftId: string;
  product: Product;
  warnings: string[];
  validationErrors: string[];
  brain?: ProductBrainResult;
};
