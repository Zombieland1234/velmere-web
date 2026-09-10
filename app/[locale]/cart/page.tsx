"use client";

import { use } from "react";
import Image from "next/image";
import { ArrowRight, ShieldCheck, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import LuxurySection from "@/components/layout/LuxurySection";
import { useCart, type CartItem } from "@/components/CartProvider";
import { Link } from "@/navigation";
import { formatMoney } from "@/lib/products/catalog";
import { buildPublicLaunchSurfaceGate } from "@/lib/market-integrity/public-launch-surface-gate";
import { buildPublicFirstPurchaseFlowGate } from "@/lib/market-integrity/public-first-purchase-flow-gate";
import { buildPublicAtelierTrustRibbonGate } from "@/lib/market-integrity/public-atelier-trust-ribbon-gate";
import { buildPublicCopyPolishGate } from "@/lib/market-integrity/public-copy-polish-gate";
import { buildPublicProductPathwayReceiptGate } from "@/lib/market-integrity/public-product-pathway-receipt-gate";
import { buildPublicProvenanceDropConciergeGate } from "@/lib/market-integrity/public-provenance-drop-concierge-gate";
import { buildPublicSizeConfidenceConciergeGate } from "@/lib/market-integrity/public-size-confidence-concierge-gate";
import { CartGuardStatusPanel } from "@/components/cart/CartGuardStatusPanel";
import {
  findCheckoutGuardLineForItem,
  useCartCheckoutGuard,
} from "@/components/cart/useCartCheckoutGuard";
import { CustomerSafeStatusSurface } from "@/components/status/CustomerSafeStatusSurface";
import { buildPass2196CustomerSafeStatusSurface, type Pass2196CustomerLocale } from "@/lib/ui/customer-safe-status-surface";

function customerLocale(locale: string): Pass2196CustomerLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

export default function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const t = useTranslations("Cart");
  const cart = useCart();
  const items: CartItem[] = cart.items as CartItem[];
  const { itemCount, subtotal, currency, hasHydrated, openCart } = cart;
  const copy =
    locale === "pl"
      ? {
          label: "Twój wybór",
          title: "Koszyk czeka na pierwszy produkt.",
          body: "Dodaj wybrany krój i rozmiar. Wszystkie informacje o materiale, dostawie i zwrocie pozostają widoczne przed przejściem dalej.",
          readiness: "Przed zakupem zobaczysz",
          steps: ["dopasowanie i materiał", "dostawę i zwrot", "pochodzenie produktu"],
          browse: "Przejdź do kolekcji",
          review: "Otwórz koszyk",
          calm: "Bez presji. Portfel pozostaje opcjonalny.",
          filledLabel: "Twój koszyk",
          filledTitle: "Sprawdź wybór przed płatnością.",
          filledBody: "Rozmiar, ilość i subtotal pochodzą bezpośrednio z Twojego koszyka. Dostawa i podatki zostaną obliczone po podaniu adresu.",
          subtotal: "Suma częściowa",
          edit: "Edytuj rozmiar i ilość",
          loading: "Wczytywanie koszyka",
        }
      : locale === "de"
        ? {
            label: "Deine Auswahl",
            title: "Der Warenkorb wartet auf dein erstes Produkt.",
            body: "Füge Schnitt und Größe hinzu. Material, Lieferung und Rückgabe bleiben sichtbar, bevor du fortfährst.",
            readiness: "Vor dem Kauf siehst du",
            steps: ["Passform und Material", "Lieferung und Rückgabe", "Produktherkunft"],
            browse: "Kollektion öffnen",
            review: "Warenkorb öffnen",
            calm: "Ohne Druck. Eine Wallet bleibt optional.",
            filledLabel: "Dein Warenkorb",
            filledTitle: "Prüfe deine Auswahl vor der Zahlung.",
            filledBody: "Größe, Menge und Zwischensumme stammen direkt aus deinem Warenkorb. Versand und Steuern werden nach Eingabe der Adresse berechnet.",
            subtotal: "Zwischensumme",
            edit: "Größe und Menge bearbeiten",
            loading: "Warenkorb wird geladen",
          }
        : {
            label: "Your selection",
            title: "Your bag is ready for its first piece.",
            body: "Add the cut and size you want. Material, delivery and return details stay visible before you continue.",
            readiness: "Before purchase you will see",
            steps: ["fit and material", "delivery and returns", "product provenance"],
            browse: "Browse collection",
            review: "Open bag",
            calm: "No pressure. A wallet remains optional.",
            filledLabel: "Your cart",
            filledTitle: "Review your selection before payment.",
            filledBody: "Size, quantity and subtotal come directly from your cart. Shipping and taxes are calculated after the delivery address is entered.",
            subtotal: "Subtotal",
            edit: "Edit size and quantity",
            loading: "Loading cart",
          };

  const cartGuard = useCartCheckoutGuard({
    items,
    locale,
    mode: "checkout",
    enabled: hasHydrated && items.length > 0,
  });
  const cartHasItems = items.length > 0;
  const cartCheckoutReady = cartGuard.status === "allowed";
  const cartCustomerStatusSurface = buildPass2196CustomerSafeStatusSurface(
    cartHasItems ? (cartCheckoutReady ? "order_status_safe" : "provider_proof_missing") : "receipt_missing",
    customerLocale(locale),
  );

  const publicLaunchGate = buildPublicLaunchSurfaceGate({ surface: "cart", locale });
  const firstPurchaseFlow = buildPublicFirstPurchaseFlowGate({
    surface: "cart",
    selectedSize: cartHasItems,
    checkoutReady: cartCheckoutReady,
    waitlistReady: true,
    dppTraceabilityReady: true,
    productProofScore: 62,
    sourceConfidence: 68,
    liveWindowSeconds: 360,
    walletRequired: false,
    scarcityPressure: 0,
    copyDensity: "minimal",
  });
  const atelierTrustRibbon = buildPublicAtelierTrustRibbonGate({
    surface: "cart",
    fitProofVisible: cartHasItems,
    materialProofVisible: true,
    deliveryPromiseReady: false,
    returnRightsVisible: true,
    checkoutReady: cartCheckoutReady,
    walletRequired: false,
    dppTraceabilityScore: 62,
    sourceFreshnessSeconds: 360,
    scarcityPressure: 0,
    operatorCopyVisible: false,
  });
  const publicCopyPolish = buildPublicCopyPolishGate({
    surface: "cart",
    passLabelsVisible: 0,
    rawScoresVisible: 0,
    operatorTermsVisible: 0,
    walletPressure: false,
    checkoutReady: cartCheckoutReady,
    fitPathVisible: false,
    deliveryReturnVisible: true,
    dppTraceabilityScore: atelierTrustRibbon.customerTrustScore,
    mexcFreshnessSeconds: 360,
    scarcityPressure: 0,
  });
  const productPathwayReceipt = buildPublicProductPathwayReceiptGate({
    surface: "cart",
    productVisible: cartHasItems,
    fitGuideVisible: false,
    materialVisible: true,
    deliveryReturnVisible: true,
    checkoutReady: cartCheckoutReady,
    waitlistReady: true,
    walletRequired: false,
    operatorNoiseItems: 0,
    copyBlocksVisible: 1,
    mexcFreshnessSeconds: 360,
    dppTraceabilityScore: atelierTrustRibbon.customerTrustScore,
    scarcityPressure: 0,
  });
  const provenanceDropConcierge = buildPublicProvenanceDropConciergeGate({
    surface: "cart",
    productPathVisible: cartHasItems,
    fitVisible: cartHasItems,
    materialVisible: true,
    deliveryReturnVisible: true,
    checkoutReady: cartCheckoutReady,
    waitlistReady: true,
    walletRequired: false,
    mexcLiveWindowSeconds: 360,
    dppTraceabilityScore: atelierTrustRibbon.customerTrustScore,
    receiptReady: Boolean(cartGuard.receipt?.receiptId),
    operatorNoiseItems: 0,
    scarcityPressure: 0,
  });
  const sizeConfidenceConcierge = buildPublicSizeConfidenceConciergeGate({
    surface: "cart",
    garmentMeasurementsVisible: cartHasItems,
    selectedSize: cartHasItems,
    materialCareVisible: true,
    deliveryReturnVisible: true,
    checkoutReady: cartCheckoutReady,
    waitlistReady: true,
    walletRequired: false,
    bodyComparisonCopyVisible: false,
    mexcLiveWindowSeconds: 360,
    dppProductInfoScore: atelierTrustRibbon.customerTrustScore,
    operatorNoiseItems: 0,
    scarcityPressure: 0,
  });

  void publicLaunchGate;
  void firstPurchaseFlow;
  void publicCopyPolish;
  void productPathwayReceipt;
  void provenanceDropConcierge;
  void sizeConfidenceConcierge;

  return (
    <main
      className="velmere-public-page min-h-[100dvh] bg-velmere-black text-white"
      data-pass317-public-launch-surface="cart"
      data-pass318-public-storefront-focus="cart"
      data-pass319-public-first-purchase-flow="cart"
      data-pass320-public-atelier-trust-ribbon="cart"
      data-pass321-public-copy-polish="cart"
      data-pass322-public-product-pathway-receipt="cart"
      data-pass323-public-provenance-drop-concierge="cart"
      data-pass324-public-size-confidence-concierge="cart"
    >
      <span className="sr-only">Trust before checkout · Atelier product receipt · Provenance concierge</span>
      <span className="sr-only">{atelierTrustRibbon.ribbonSteps.join(" · ")} · {productPathwayReceipt.receiptSteps.join(" · ")} · {provenanceDropConcierge.conciergeSteps.join(" · ")}</span>
      <LuxurySection className="py-24 md:py-36">
        {!hasHydrated ? (
          <section className="pass2009-cart-loading mx-auto min-h-[28rem] max-w-4xl rounded-[1.5rem] border border-white/[0.08] bg-[#090b0e] p-6 md:p-10" aria-busy="true" aria-live="polite">
            <span className="sr-only">{copy.loading}</span>
            <div className="velmere-skeleton h-3 w-28 rounded-full" />
            <div className="velmere-skeleton mt-7 h-14 max-w-xl rounded-xl" />
            <div className="velmere-skeleton mt-8 h-24 w-full rounded-xl" />
            <div className="velmere-skeleton mt-3 h-24 w-full rounded-xl" />
          </section>
        ) : items.length > 0 ? (
          <section className="pass2009-cart-filled mx-auto max-w-5xl rounded-[1.5rem] border border-white/[0.08] bg-[#090b0e] p-6 shadow-velmere-card md:p-10">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-100/[0.72]">{copy.filledLabel}</p>
            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
              <div>
                <h1 className="max-w-3xl font-serif text-4xl leading-[0.96] tracking-[-0.045em] text-white md:text-6xl">{copy.filledTitle}</h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-white/[0.56]">{copy.filledBody}</p>
              </div>
              <div className="border-l border-white/[0.08] pl-5">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.38]">{copy.subtotal}</p>
                <strong className="mt-2 block font-mono text-2xl tabular-nums text-white">{formatMoney({ amount: subtotal, currency }, locale)}</strong>
                <p className="mt-2 text-xs text-white/[0.38]">{itemCount} {t("units")}</p>
              </div>
            </div>

            <ul className="mt-9 divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {items.map((item: CartItem) => {
                const guardLine = findCheckoutGuardLineForItem(cartGuard.receipt, item);
                return (
                <li
                  key={`${item.id}-${item.size}`}
                  className="grid gap-4 py-5 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="relative h-20 overflow-hidden rounded-xl border border-white/[0.08] bg-white">
                    {item.image ? <Image src={item.image} alt={item.name} fill sizes="80px" className="object-contain p-1" /> : null}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-white">{item.name}</h2>
                    <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.42]">
                      {t("size")}: {item.size} · {t("qty")}: {item.quantity}
                    </p>
                    {guardLine?.outcome === "blocked" ? (
                      <p className="mt-3 rounded-xl border border-amber-200/[0.14] bg-amber-300/[0.055] px-3 py-2 text-xs leading-5 text-amber-50/[0.72]">
                        {guardLine.message}
                      </p>
                    ) : guardLine?.outcome === "allowed" ? (
                      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-100/[0.48]">
                        Server check · ok
                      </p>
                    ) : null}
                  </div>
                  <p className="font-mono text-sm tabular-nums text-white">
                    {formatMoney({ amount: item.price * item.quantity, currency: item.currency }, locale)}
                  </p>
                </li>
                );
              })}
            </ul>

            <div className="mt-6">
              <CartGuardStatusPanel guard={cartGuard} locale={locale} />
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={openCart} className="velmere-button-primary">{copy.edit}</button>
              <Link href="/shop" className="velmere-button-secondary">{copy.browse}</Link>
            </div>
          </section>
        ) : (
        <section className="velmere-empty-state pass2009-cart-empty mx-auto max-w-4xl overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-[#090b0e] p-6 shadow-velmere-card md:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,.7fr)] lg:items-center">
            <div>
              <div className="velmere-empty-state-icon flex h-16 w-16 items-center justify-center rounded-full border border-cyan-200/[0.16] bg-cyan-300/[0.05]">
                <ShoppingBag className="h-7 w-7 text-cyan-100/[0.78]" aria-hidden="true" />
              </div>
              <p className="luxury-kicker mt-7 text-velmere-gold/[0.82]">{copy.label}</p>
              <h1 className="mt-4 max-w-2xl font-serif text-4xl leading-[0.98] tracking-[-0.045em] text-white md:text-6xl">{copy.title}</h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/[0.58] md:text-base">{copy.body}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/shop" className="velmere-button-primary group">
                  {copy.browse}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                </Link>
              </div>
              <p className="mt-5 text-xs leading-6 text-white/[0.38]">{copy.calm}</p>
            </div>

            <aside className="velmere-empty-state-rail rounded-[1.6rem] border border-white/[0.08] bg-white/[0.025] p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-velmere-gold">{copy.readiness}</p>
              <div className="mt-5 grid gap-3">
                {copy.steps.map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/[0.20] px-4 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-velmere-gold/[0.16] bg-velmere-gold/[0.05] font-mono text-[9px] text-velmere-gold">0{index + 1}</span>
                    <span className="text-sm text-white/[0.68]">{step}</span>
                    <ShieldCheck className="ml-auto h-4 w-4 text-white/[0.24]" aria-hidden="true" />
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
        )}
      </LuxurySection>
    </main>
  );
}

/* PASS2270 public surface trim markers: quiet cart review */
