import { NextRequest } from "next/server";
import { buildWhaleWatchCustomerTruth } from "@/lib/market-integrity/whale-watch-customer-truth";
import { applyApiRateLimit, rejectOversizedUrl, securityJson } from "@/lib/security/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCT_ID = "whale-watch" as const;
const BLOCKERS = [
  "WHALE_LIVE_EVIDENCE_NOT_AUTHORIZED",
  "VERIFIED_WALLET_LABEL_REGISTRY_REQUIRED",
  "CONTINUOUS_MONITORING_NOT_OPERATIONALLY_PROVEN",
] as const;

type Locale = "pl" | "en" | "de";
function locale(value: string | null): Locale | null {
  return value === "pl" || value === "en" || value === "de" ? value : null;
}
function asset(value: string | null) {
  const clean = (value ?? "").trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9:._-]{1,80}$/.test(clean) ? clean : "";
}
function unavailableMessage(value: Locale) {
  if (value === "pl") return "Whale Watch nie publikuje teraz danych liczbowych. Zweryfikowane dane live, ciągły monitoring i aktualny rejestr etykiet nie są jeszcze autoryzowane do wydania klientowi.";
  if (value === "de") return "Whale Watch veröffentlicht derzeit keine Zahlen. Verifizierte Live-Daten, kontinuierliches Monitoring und ein aktuelles Label-Register sind noch nicht für die Kundenausgabe autorisiert.";
  return "Whale Watch is not publishing numeric data right now. Verified live evidence, continuous monitoring and a current label registry are not yet authorized for customer delivery.";
}

export async function GET(request: NextRequest) {
  const oversized = rejectOversizedUrl(request, 2_048);
  if (oversized) return oversized;
  const rate = await applyApiRateLimit(request, { keyPrefix: "r7-whale-watch-public", limit: 20, windowMs: 60_000 });
  if (!rate.ok) return rate.response;
  const selectedLocale = locale(request.nextUrl.searchParams.get("locale"));
  const assetKey = asset(request.nextUrl.searchParams.get("assetKey"));
  if (!selectedLocale) return securityJson({ ok: false, error: "locale_invalid" }, { status: 400 });
  if (!assetKey) return securityJson({ ok: false, error: "asset_key_invalid" }, { status: 400 });

  const truth = buildWhaleWatchCustomerTruth({
    locale: selectedLocale,
    reportContextDepth: "basic",
    evidenceStatus: "unavailable",
    providerFamilies: [],
    holderCount: 0,
    verifiedLabelHolderCount: 0,
    unclassifiedHolderCount: 0,
    verifiedLabelArtifactCount: 0,
    transferCount: 0,
    flowWindows: [],
    alerts: [],
    blockers: [...BLOCKERS],
    labelErrors: [],
  });

  return securityJson({
    ok: false,
    productId: PRODUCT_ID,
    productName: "Whale Watch",
    availability: "WITHHELD",
    mode: "customer_safe_unavailable",
    assetKey,
    locale: selectedLocale,
    liveClaimed: false,
    numbersPublished: false,
    providerTopologyDisclosed: false,
    transferIsTradeClaimAllowed: false,
    buyOrSellIntentClaimAllowed: false,
    unverifiedDisplayLabel: "UNCLASSIFIED",
    customerMessage: unavailableMessage(selectedLocale),
    customerTruth: {
      schemaVersion: truth.schemaVersion,
      productId: truth.productId,
      truthState: truth.truthState,
      confidenceClass: truth.confidenceClass,
      probabilityClaimAllowed: truth.probabilityClaimAllowed,
      investmentRecommendationAllowed: truth.investmentRecommendationAllowed,
      leverageRecommendationAllowed: truth.leverageRecommendationAllowed,
      guaranteedOutcomeClaimAllowed: truth.guaranteedOutcomeClaimAllowed,
      transferIsTradeClaimAllowed: truth.transferIsTradeClaimAllowed,
      buyOrSellIntentClaimAllowed: truth.buyOrSellIntentClaimAllowed,
      verifiedEntityAttributionRequiresSignedArtifact: truth.verifiedEntityAttributionRequiresSignedArtifact,
      unverifiedDisplayLabel: truth.unverifiedDisplayLabel,
      labelExpiryEnforced: truth.labelExpiryEnforced,
      labelSignatureEnforced: truth.labelSignatureEnforced,
      monitoringContinuityStatus: truth.monitoringContinuityStatus,
      limitations: truth.limitations,
      nextSafeCheck: truth.nextSafeCheck,
    },
    blockers: [...BLOCKERS],
  }, {
    status: 424,
    headers: {
      "cache-control": "no-store, max-age=0",
      "x-velmere-product": PRODUCT_ID,
      "x-velmere-whale-watch-state": "withheld",
    },
  });
}
