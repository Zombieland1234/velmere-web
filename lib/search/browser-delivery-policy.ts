import rightsMatrix from "../../config/pass36/a102r44p18-official-provider-rights-decision-matrix.json";
import {
  resolveProviderDeliveryRights,
  type ProviderDeliveryPurpose,
  type ProviderDeliveryRightsResolution,
} from "../compliance/provider-delivery-rights-gate.mjs";
import { canonicalJson } from "../security/canonical-json";
import { sha256Digest } from "../security/cryptographic-digest";
import {
  normalizeR7BrowserEcbDeliveryBinding,
  resolveR7BrowserEcbDeliveryRights,
  type R7BrowserEcbDeliveryBinding,
} from "./browser-ecb-delivery-authority";

export const BROWSER_DELIVERY_POLICY_ID =
  "velmere.current-execution.browser-delivery-policy.v1" as const;

export type BrowserDeliverySurface =
  | "search"
  | "lens_preview"
  | "lens_pdf_basic"
  | "lens_pdf_paid";

const BROWSER_DELIVERY_SURFACES = Object.freeze([
  "search",
  "lens_preview",
  "lens_pdf_basic",
  "lens_pdf_paid",
] as const satisfies readonly BrowserDeliverySurface[]);

const DISPLAY_DERIVED_PERSISTED_PURPOSES = Object.freeze([
  "public_display",
  "commercial_product",
  "customer_delivery",
  "caching",
  "retention",
  "redistribution",
  "derived_analytics_external",
] as const satisfies readonly ProviderDeliveryPurpose[]);

const PREVIEW_PURPOSES = Object.freeze([
  ...DISPLAY_DERIVED_PERSISTED_PURPOSES,
  "ai_rag",
] as const satisfies readonly ProviderDeliveryPurpose[]);

const PDF_PURPOSES = Object.freeze([
  ...PREVIEW_PURPOSES,
  "pdf_export",
] as const satisfies readonly ProviderDeliveryPurpose[]);

const PAID_PDF_PURPOSES = Object.freeze([
  ...PDF_PURPOSES,
  "paid_tier",
] as const satisfies readonly ProviderDeliveryPurpose[]);

type BrowserProviderUse = Readonly<{
  providerId: string;
  purposes: readonly ProviderDeliveryPurpose[];
}>;

const SEARCH_PROVIDER_IDS = Object.freeze([
  "coingecko",
  "defillama",
  "alpha_vantage",
  "sec",
  "binance",
  "mexc",
  "coinbase",
] as const);

function providerUses(purposes: readonly ProviderDeliveryPurpose[]) {
  return SEARCH_PROVIDER_IDS.map((providerId) => Object.freeze({ providerId, purposes }));
}

const BROWSER_PROVIDER_USES = Object.freeze({
  search: Object.freeze(providerUses(DISPLAY_DERIVED_PERSISTED_PURPOSES)),
  lens_preview: Object.freeze(providerUses(PREVIEW_PURPOSES)),
  lens_pdf_basic: Object.freeze(providerUses(PDF_PURPOSES)),
  lens_pdf_paid: Object.freeze(providerUses(PAID_PDF_PURPOSES)),
} satisfies Record<BrowserDeliverySurface, readonly BrowserProviderUse[]>);

export type BrowserDerivedDeliveryBinding = Readonly<{
  schemaVersion: "velmere.browser.derived-delivery-binding.v1";
  mode: "derived_analytics";
  derivedAllowed: true;
}>;

export function normalizeBrowserDerivedDeliveryBinding(
  value: unknown,
): BrowserDerivedDeliveryBinding | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const b = value as Partial<BrowserDerivedDeliveryBinding>;
  if (b.mode === "derived_analytics" && b.derivedAllowed === true) {
    return Object.freeze({
      schemaVersion: "velmere.browser.derived-delivery-binding.v1",
      mode: "derived_analytics",
      derivedAllowed: true,
    });
  }
  return null;
}

export function resolveBrowserDerivedDeliveryRights(args: {
  purpose: ProviderDeliveryPurpose;
  providerId?: string;
}): ProviderDeliveryRightsResolution {
  const providerId = args.providerId ?? "velmere_derived_engine";
  const receipt = {
    schemaVersion: "velmere.pass36.a102r44p18.provider-delivery-rights-resolution.v2" as const,
    providerId,
    purpose: args.purpose,
    allowed: true,
    blockers: [] as string[],
    legalApprovalStatus: "OWNER_AUTHORIZED_BOUNDED_INTERNAL",
    engineeringClassification: "DERIVED_ANALYTICS_SYNTHESIS",
    requiredPlanOrConsent: null,
    sourceIds: ["velmere_derived_engine"],
    matrixSha256: null,
    decisionSha256: null,
    diagnosticOnly: false,
  };
  return {
    ...receipt,
    receiptSha256: sha256Digest(canonicalJson(receipt)).replace(/^sha256:/u, ""),
  };
}

export type BrowserProviderUseDecision = Readonly<{
  providerId: string;
  purposes: readonly ProviderDeliveryPurpose[];
  decisions: readonly ProviderDeliveryRightsResolution[];
  allowed: boolean;
}>;

export type BrowserDeliveryPreflight = Readonly<{
  schemaVersion: typeof BROWSER_DELIVERY_POLICY_ID;
  surface: BrowserDeliverySurface;
  state: "READY" | "WITHHELD_RIGHTS_UNVERIFIED";
  providerNetworkAllowed: boolean;
  customerDeliveryAllowed: boolean;
  liveClaimed: false;
  deliveryBinding: R7BrowserEcbDeliveryBinding | BrowserDerivedDeliveryBinding | null;
  providerUses: readonly BrowserProviderUseDecision[];
  decisionDigest: string;
}>;

export type BrowserCustomerSafeWithheld = Readonly<{
  schemaVersion: "velmere.current-execution.browser-customer-safe-withheld.v1";
  ok: false;
  mode: "withheld";
  availability: "WITHHELD";
  error: "browser_customer_data_delivery_unavailable";
  reason: "Customer-display and export rights for the required data are not verified.";
  results: readonly [];
  report: null;
  renderToken: null;
  artifact: null;
  liveClaimed: false;
  retryAfter: null;
}>;

export type BrowserCustomerProjection =
  | { allowed: true; status: number; payload: unknown }
  | { allowed: false; status: 503; payload: BrowserCustomerSafeWithheld };

function isBrowserDeliverySurface(value: unknown): value is BrowserDeliverySurface {
  return typeof value === "string"
    && BROWSER_DELIVERY_SURFACES.includes(value as BrowserDeliverySurface);
}

function ecbProviderUses(surface: BrowserDeliverySurface): readonly BrowserProviderUse[] {
  const purposes = surface === "lens_pdf_paid"
    ? PAID_PDF_PURPOSES
    : surface === "lens_pdf_basic"
      ? ["public_display", "commercial_product", "customer_delivery", "retention", "pdf_export"] as const
      : ["public_display", "commercial_product", "customer_delivery"] as const;
  return [Object.freeze({ providerId: "ecb_statistics", purposes })];
}

function derivedProviderUses(surface: BrowserDeliverySurface): readonly BrowserProviderUse[] {
  const purposes: readonly ProviderDeliveryPurpose[] = surface === "lens_pdf_paid"
    ? ["customer_delivery", "pdf_export", "derived_analytics_external", "paid_tier"]
    : surface === "lens_pdf_basic"
      ? ["customer_delivery", "pdf_export", "derived_analytics_external"]
      : ["customer_delivery", "derived_analytics_external", "public_display"];
  return [Object.freeze({ providerId: "velmere_derived_engine", purposes })];
}

function buildUnsignedPreflight(
  surface: BrowserDeliverySurface,
  requestedBinding?: unknown,
  nowMs = Date.now(),
) {
  const ecbBinding = normalizeR7BrowserEcbDeliveryBinding(requestedBinding);
  const derivedBinding = !ecbBinding ? normalizeBrowserDerivedDeliveryBinding(requestedBinding) : null;
  const configuredUses = ecbBinding
    ? ecbProviderUses(surface)
    : derivedBinding
      ? derivedProviderUses(surface)
      : BROWSER_PROVIDER_USES[surface];
  const providerUses = configuredUses.map((providerUse) => {
    const decisions = providerUse.purposes.map((purpose) => {
      if (ecbBinding) {
        return resolveR7BrowserEcbDeliveryRights({ purpose, nowMs, deliveryBinding: ecbBinding });
      }
      if (derivedBinding) {
        return resolveBrowserDerivedDeliveryRights({ purpose, providerId: providerUse.providerId });
      }
      return resolveProviderDeliveryRights({ providerId: providerUse.providerId, purpose, matrix: rightsMatrix });
    });
    return {
      providerId: providerUse.providerId,
      purposes: providerUse.purposes,
      decisions,
      allowed: decisions.every((decision) => decision.allowed),
    };
  });
  const allowed = providerUses.length > 0 && providerUses.every((providerUse) => providerUse.allowed);
  return {
    schemaVersion: BROWSER_DELIVERY_POLICY_ID,
    surface,
    state: allowed ? "READY" as const : "WITHHELD_RIGHTS_UNVERIFIED" as const,
    providerNetworkAllowed: allowed,
    customerDeliveryAllowed: allowed,
    liveClaimed: false as const,
    deliveryBinding: ecbBinding
      ? structuredClone(ecbBinding)
      : derivedBinding
        ? structuredClone(derivedBinding)
        : null,
    providerUses,
  };
}

export function buildBrowserDeliveryPreflight(
  surface: BrowserDeliverySurface,
  deliveryBinding?: unknown,
  nowMs = Date.now(),
): BrowserDeliveryPreflight {
  const unsigned = buildUnsignedPreflight(surface, deliveryBinding, nowMs);
  return { ...unsigned, decisionDigest: sha256Digest(canonicalJson(unsigned)) };
}

export function verifyBrowserDeliveryPreflight(
  decision: BrowserDeliveryPreflight,
  nowMs = Date.now(),
): boolean {
  if (!decision || !isBrowserDeliverySurface(decision.surface)) return false;
  try {
    return canonicalJson(decision) === canonicalJson(buildBrowserDeliveryPreflight(
      decision.surface,
      decision.deliveryBinding,
      nowMs,
    ));
  } catch {
    return false;
  }
}

export function toBrowserCustomerSafeWithheld(): BrowserCustomerSafeWithheld {
  return {
    schemaVersion: "velmere.current-execution.browser-customer-safe-withheld.v1",
    ok: false,
    mode: "withheld",
    availability: "WITHHELD",
    error: "browser_customer_data_delivery_unavailable",
    reason: "Customer-display and export rights for the required data are not verified.",
    results: [],
    report: null,
    renderToken: null,
    artifact: null,
    liveClaimed: false,
    retryAfter: null,
  };
}

export function projectBrowserCustomerDelivery(args: {
  decision: BrowserDeliveryPreflight;
  payload: unknown;
  status?: number;
  nowMs?: number;
}): BrowserCustomerProjection {
  if (
    !verifyBrowserDeliveryPreflight(args.decision, args.nowMs)
    || !args.decision.providerNetworkAllowed
    || !args.decision.customerDeliveryAllowed
  ) {
    return { allowed: false, status: 503, payload: toBrowserCustomerSafeWithheld() };
  }
  return { allowed: true, status: args.status ?? 200, payload: args.payload };
}
