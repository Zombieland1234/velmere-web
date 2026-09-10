export const PASS317_PUBLIC_LAUNCH_SURFACE_GATE = "PASS317_PUBLIC_LAUNCH_SURFACE_GATE" as const;

type PublicLaunchSurface = "home" | "cart" | "checkout" | "vlm" | "security" | "community" | "legal";

type BuildPublicLaunchSurfaceGateInput = {
  surface: PublicLaunchSurface;
  locale?: string;
};

export type PublicLaunchSurfaceGate = {
  marker: typeof PASS317_PUBLIC_LAUNCH_SURFACE_GATE;
  surface: PublicLaunchSurface;
  customerMode: "clean_customer_path" | "locked_checkout_notice" | "trust_brief";
  hiddenOperatorPanels: string[];
  customerLabel: string;
  customerSummary: string;
  publicRule: "product_or_action_first";
  auditBoundary: string;
};

const localizedCopy = {
  pl: {
    cartLabel: "koszyk / spokojny status",
    cartSummary: "Koszyk pozostaje prosty: produkty, rozmiary i status checkoutu. Szczegóły providerów, webhooków i order ledger zostają poza widokiem klienta.",
    checkoutLabel: "checkout / ochrona klienta",
    checkoutSummary: "Płatność otworzy się dopiero po potwierdzeniu produktu, dostawy, zwrotów i zamówienia. Klient widzi jasny status, nie operatorową checklistę.",
    trustLabel: "publiczny brief",
    trustSummary: "Strona publiczna pokazuje tylko sens i następny krok. Launch-control, blokery i techniczne dowody zostają w adminie oraz guardach.",
  },
  de: {
    cartLabel: "warenkorb / ruhiger status",
    cartSummary: "Der Warenkorb bleibt einfach: Produkte, Größen und Checkout-Status. Provider-, Webhook- und Order-Ledger-Details bleiben außerhalb der Kundenoberfläche.",
    checkoutLabel: "checkout / kundenschutz",
    checkoutSummary: "Zahlung öffnet erst nach Bestätigung von Produkt, Lieferung, Rückgabe und Bestellung. Kundinnen und Kunden sehen Status, keine Operator-Checkliste.",
    trustLabel: "public brief",
    trustSummary: "Die öffentliche Seite zeigt nur Sinn und nächsten Schritt. Launch-Control, Blocker und technische Proofs bleiben in Admin und Guards.",
  },
  en: {
    cartLabel: "cart / calm status",
    cartSummary: "Cart stays simple: products, sizes and checkout status. Provider, webhook and order-ledger details stay outside the customer surface.",
    checkoutLabel: "checkout / customer protection",
    checkoutSummary: "Payment opens only after product, delivery, returns and order state are confirmed. The customer sees clear status, not an operator checklist.",
    trustLabel: "public brief",
    trustSummary: "Public pages show meaning and one next step only. Launch-control, blockers and technical proof stay in admin and guard lanes.",
  },
} as const;

function resolveLocale(locale?: string): keyof typeof localizedCopy {
  if (locale === "pl" || locale === "de") return locale;
  return "en";
}

export function buildPublicLaunchSurfaceGate(input: BuildPublicLaunchSurfaceGateInput): PublicLaunchSurfaceGate {
  const copy = localizedCopy[resolveLocale(input.locale)];
  const isCheckout = input.surface === "checkout";
  const isCart = input.surface === "cart";

  return {
    marker: PASS317_PUBLIC_LAUNCH_SURFACE_GATE,
    surface: input.surface,
    customerMode: isCheckout ? "locked_checkout_notice" : input.surface === "security" ? "trust_brief" : "clean_customer_path",
    hiddenOperatorPanels: [
      "FullSurfaceReadinessIndex",
      "CommerceLaunchControl",
      "PaymentOrderReadinessPanel",
      "OrderEventLedgerPanel",
      "ProductionDataBackbonePanel",
      "StorageAdapterReadinessPanel",
      "SecurityOperationsChecklistPanel",
      "ShippingReturnsTruthPanel",
    ],
    customerLabel: isCheckout ? copy.checkoutLabel : isCart ? copy.cartLabel : copy.trustLabel,
    customerSummary: isCheckout ? copy.checkoutSummary : isCart ? copy.cartSummary : copy.trustSummary,
    publicRule: "product_or_action_first",
    auditBoundary: "PASS317 keeps launch readiness, provider proof, storage state, WAF, PDF, wallet and order-ledger details out of the customer scroll path while preserving them for admin/guard review.",
  };
}
