import { NextResponse } from "next/server";
import { listVlmPaidProducts, normalizeVlmPaidProductId } from "@/lib/commerce/vlm-paid-access";
import { evaluateVlmCommercialReadiness, type VlmCommercialProductFamily } from "@/lib/commerce/vlm-commercial-readiness";
import { buildCurrentP36CommercialEvidence } from "@/lib/commerce/vlm-current-commercial-evidence";
import {
  buildCurrentVlmTierEligibility,
  buildPublicVlmTierEligibility,
  VLM_PUBLIC_SERVICE_READINESS_SCHEMA,
} from "@/lib/commerce/vlm-evidence-availability";
import { tierForVlmProductId } from "@/lib/commerce/vlm-current-sku-truth";
import { applyApiRateLimit, assertSameOriginRequest, rejectLargeContentLength } from "@/lib/security/api-guard";
import {
  buildVlmServicePaymentRailReadiness,
  normalizeVlmServicePaymentRail,
} from "@/lib/checkout/stripe-blik-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReadinessSurface = "shield" | "shield-pro" | "real-markets" | "browser" | "audit" | "unknown";

function normalizeReadinessSurface(value: string | null): ReadinessSurface {
  return value === "shield" || value === "shield-pro" || value === "real-markets" || value === "browser" || value === "audit" ? value : "unknown";
}

function commercialFamilyForProductId(productId: string, surface: ReadinessSurface): VlmCommercialProductFamily | null {
  if (productId.includes("_audit_")) return "audit";
  // "shield" surface is ambiguous between Shield and Shield Pro for generic legacy paid IDs.
  // Without an explicit product-cell/family identity we fail closed instead of guessing.
  if (surface === "shield") return null;
  if (surface === "shield-pro") return "shield-pro";
  if (surface === "real-markets") return "real-markets";
  if (surface === "browser") return "browser";
  if (surface === "audit") return "audit";
  // Generic legacy analysis/PDF ids are artifact/access ids, not customer product families.
  // Without explicit surface context the endpoint remains fail-closed.
  return null;
}

export async function GET(request: Request) {
  const sizeGuard = rejectLargeContentLength(request, 8 * 1024);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: process.env.NODE_ENV !== "production" });
  if (originGuard) return originGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "vlm-service-readiness", limit: 60, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const url = new URL(request.url);
  const localeParam = url.searchParams.get("locale");
  const locale: "pl" | "en" | "de" = localeParam === "pl" || localeParam === "de" ? localeParam : "en";
  const rail = normalizeVlmServicePaymentRail(url.searchParams.get("paymentRail"));
  const surface = normalizeReadinessSurface(url.searchParams.get("surface"));
  const productId = normalizeVlmPaidProductId(url.searchParams.get("productId"));
  const products = productId ? listVlmPaidProducts(locale).filter((product) => product.id === productId) : listVlmPaidProducts(locale);
  const evaluatedAt = new Date().toISOString();

  return NextResponse.json({
    ok: true,
    schemaVersion: VLM_PUBLIC_SERVICE_READINESS_SCHEMA,
    paymentRail: rail,
    evaluatedAt,
    products: products.map((product) => {
      const tier = tierForVlmProductId(product.id);
      const family = commercialFamilyForProductId(product.id, surface);
      const commercial = tier && family
        ? evaluateVlmCommercialReadiness({
            family,
            tier,
            locale,
            evidence: buildCurrentP36CommercialEvidence(family),
          })
        : null;
      const eligibilityReceipt = commercial
        ? buildCurrentVlmTierEligibility({ commercial, subjectId: product.id, evaluatedAt })
        : null;
      const eligibility = eligibilityReceipt ? buildPublicVlmTierEligibility(eligibilityReceipt, locale) : null;
      const payment = buildVlmServicePaymentRailReadiness({ product, paymentRail: rail });
      return {
        product: {
          id: product.id,
          label: product.label,
          shortLabel: product.shortLabel,
          description: product.description,
          boundaries: product.boundaries,
          publicPrice: product.publicPrice,
          publicCheckoutAllowed: product.publicCheckoutAllowed,
          customerDecision: product.customerDecision,
        },
        eligibility,
        commercialFamily: family,
        artifactOnlyOrUnscopedLegacyProduct: family === null,
        payment: {
          paymentRail: rail,
          available: Boolean(eligibility?.saleEligible && payment.enabledForStripeSession),
          displayPrice: product.priceLabel,
          customerState: eligibility?.availabilityState ?? "TEMPORARILY_UNAVAILABLE",
        },
      };
    }),
    boundary: "Eligibility is deterministic and server-authoritative. Payment configuration, client state or a payment proof cannot override catalog truth, evidence sufficiency, freshness, rights, runtime health or material tier value. Unknown restoration time remains null.",
  }, {
    headers: {
      "cache-control": "no-store",
      "x-velmere-contract": VLM_PUBLIC_SERVICE_READINESS_SCHEMA,
      "x-content-type-options": "nosniff",
    },
  });
}
