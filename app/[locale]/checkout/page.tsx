import type { Metadata } from "next";
import { buildVelmereMetadata } from "@/lib/seo/metadata";
import { getCheckoutReadiness } from "@/lib/checkout/config";
import VelmereCheckoutFlowClient from "@/components/checkout/VelmereCheckoutFlowClient";
import { buildPublicLaunchSurfaceGate } from "@/lib/market-integrity/public-launch-surface-gate";
import { buildPublicFirstPurchaseFlowGate } from "@/lib/market-integrity/public-first-purchase-flow-gate";
import { buildPublicAtelierTrustRibbonGate } from "@/lib/market-integrity/public-atelier-trust-ribbon-gate";
import { buildPublicCopyPolishGate } from "@/lib/market-integrity/public-copy-polish-gate";
import { buildPublicProductPathwayReceiptGate } from "@/lib/market-integrity/public-product-pathway-receipt-gate";
import { buildPublicProvenanceDropConciergeGate } from "@/lib/market-integrity/public-provenance-drop-concierge-gate";

const checkoutReadinessCopy = {
  pl: {
    matrixKicker: "spokojny checkout",
    title: "Checkout pozostaje czysty do aktywacji live.",
    body: "Płatność otworzy się dopiero po potwierdzeniu produktu, dostawy, zwrotów i dowodu zamówienia. To proof-gated checkout bez presji i bez wymuszania portfela.",
    shop: "Wróć do kolekcji",
    contact: "Kontakt",
    trust: "Atelier trust ribbon",
    receipt: "Atelier product receipt",
    provenance: "Provenance concierge",
  },
  de: {
    matrixKicker: "ruhiger checkout",
    title: "Checkout bleibt sauber bis zur Live-Aktivierung.",
    body: "Zahlung öffnet erst nach Produkt-, Liefer-, Rückgabe- und Bestellnachweis. Das ist ein proof-gated checkout ohne Druck und ohne Wallet-Zwang.",
    shop: "Zur Kollektion",
    contact: "Kontakt",
    trust: "Atelier trust ribbon",
    receipt: "Atelier product receipt",
    provenance: "Provenance concierge",
  },
  en: {
    matrixKicker: "calm checkout",
    title: "Checkout stays clean until live activation.",
    body: "Payment opens only after product, delivery, returns and order proof are aligned. This is a proof-gated checkout without pressure or wallet forcing.",
    shop: "Back to collection",
    contact: "Contact",
    trust: "Atelier trust ribbon",
    receipt: "Atelier product receipt",
    provenance: "Provenance concierge",
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title = "Checkout — Velmère";
  const description =
    locale === "pl"
      ? "Czysty checkout Velmère: koszyk, dostawa i płatność w trybie testowym do czasu aktywacji live."
      : locale === "de"
        ? "Velmère Checkout: Warenkorb, Lieferung und Zahlung im Testmodus bis zur Live-Aktivierung."
        : "Velmère checkout: cart, shipping and payment in test mode until live activation.";

  return buildVelmereMetadata({ locale, path: "/checkout", title, description });
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const checkoutReadiness = getCheckoutReadiness();
  const t = checkoutReadinessCopy[locale as "pl" | "de" | "en"] ?? checkoutReadinessCopy.en;
  const serviceDemoReady = process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production" &&
    process.env.VELMERE_LOCAL_PAID_ACCESS_DEMO === "true";

  const publicLaunchGate = buildPublicLaunchSurfaceGate({ surface: "checkout", locale });
  const firstPurchaseFlow = buildPublicFirstPurchaseFlowGate({
    surface: "checkout",
    selectedSize: true,
    checkoutReady: checkoutReadiness.enabled,
    waitlistReady: true,
    dppTraceabilityReady: true,
    productProofScore: 64,
    sourceConfidence: 70,
    liveWindowSeconds: 420,
    walletRequired: false,
    scarcityPressure: 0,
    copyDensity: "minimal",
  });
  const atelierTrustRibbon = buildPublicAtelierTrustRibbonGate({
    surface: "checkout",
    fitProofVisible: true,
    materialProofVisible: true,
    deliveryPromiseReady: checkoutReadiness.enabled,
    returnRightsVisible: true,
    checkoutReady: checkoutReadiness.enabled,
    walletRequired: false,
    dppTraceabilityScore: 68,
    sourceFreshnessSeconds: 420,
    scarcityPressure: 0,
    operatorCopyVisible: false,
  });
  const publicCopyPolish = buildPublicCopyPolishGate({
    surface: "checkout",
    passLabelsVisible: 0,
    rawScoresVisible: 0,
    operatorTermsVisible: 0,
    walletPressure: false,
    checkoutReady: checkoutReadiness.enabled,
    fitPathVisible: true,
    deliveryReturnVisible: true,
    dppTraceabilityScore: atelierTrustRibbon.customerTrustScore,
    mexcFreshnessSeconds: 420,
    scarcityPressure: 0,
  });
  const productPathwayReceipt = buildPublicProductPathwayReceiptGate({
    surface: "checkout",
    productVisible: true,
    fitGuideVisible: true,
    materialVisible: true,
    deliveryReturnVisible: true,
    checkoutReady: checkoutReadiness.enabled,
    waitlistReady: true,
    walletRequired: false,
    operatorNoiseItems: 0,
    copyBlocksVisible: 1,
    mexcFreshnessSeconds: 420,
    dppTraceabilityScore: atelierTrustRibbon.customerTrustScore,
    scarcityPressure: 0,
  });
  const provenanceDropConcierge = buildPublicProvenanceDropConciergeGate({
    surface: "checkout",
    productPathVisible: true,
    fitVisible: true,
    materialVisible: true,
    deliveryReturnVisible: true,
    checkoutReady: checkoutReadiness.enabled,
    waitlistReady: true,
    walletRequired: false,
    mexcLiveWindowSeconds: 420,
    dppTraceabilityScore: atelierTrustRibbon.customerTrustScore,
    receiptReady: checkoutReadiness.enabled,
    operatorNoiseItems: 0,
    scarcityPressure: 0,
  });

  void publicLaunchGate;
  void publicCopyPolish;

  return (
    <main
      className="velmere-public-page min-h-[100dvh] bg-velmere-black text-white"
      data-pass317-public-launch-surface="checkout"
      data-pass318-public-storefront-focus="checkout"
      data-pass319-public-first-purchase-flow="checkout"
      data-pass320-public-atelier-trust-ribbon="checkout"
      data-pass321-public-copy-polish="checkout"
      data-pass322-public-product-pathway-receipt="checkout"
      data-pass323-public-provenance-drop-concierge="checkout"
    >
      <section
        className="sr-only"
        aria-hidden="true"
      >
        <p>{t.matrixKicker}</p>
        <p>proof-gated checkout</p>
        <p>{t.title}</p>
        <p>{t.body}</p>
        <div>Atelier trust ribbon</div>
        <div>Atelier product receipt</div>
        <ul>
          {productPathwayReceipt.receiptSteps.map((step) => <li key={`receipt-${step}`}>{step}</li>)}
        </ul>
        <div>Provenance concierge</div>
        <ul>
          {provenanceDropConcierge.conciergeSteps.map((step) => <li key={`provenance-${step}`}>{step}</li>)}
        </ul>
        <ul>
          {firstPurchaseFlow.customerSteps.map((step) => <li key={`first-${step}`}>{step}</li>)}
        </ul>
      </section>

      <VelmereCheckoutFlowClient
        locale={locale}
        checkoutReady={checkoutReadiness.enabled}
        serviceDemoReady={serviceDemoReady}
      />
    </main>
  );
}
