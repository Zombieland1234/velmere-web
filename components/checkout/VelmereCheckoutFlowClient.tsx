"use client";


import { publicBrowserFailureCode, reportBrowserBoundaryFailure } from "@/lib/security/browser-error-redaction";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { assertCheckoutRedirectUrl } from "@/lib/security/navigation-redirect-boundary";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ChangeEvent as ReactChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  LockKeyhole,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Truck,
  WalletCards,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/navigation";
import { useCart, type CartItem } from "@/components/CartProvider";
import { formatMoney } from "@/lib/products/catalog";
import {
  getVlmPaidProduct,
  normalizeVlmPaidProductId,
  type VlmPaidAccessContext,
  type VlmPaidProductId,
} from "@/lib/commerce/vlm-paid-access";
import { writeVlmPaidCheckoutIntent } from "@/lib/commerce/vlm-paid-access-client";
import { purgeLegacyCheckoutPiiDrafts } from "@/lib/commerce/checkout-browser-privacy";
import {
  pass35PaidUiStopSellCopy,
  resolvePass35PaidUiStopSell,
} from "@/lib/commerce/pass35-paid-ui-stop-sell";
import { useWalletUiStore } from "@/store/useWalletUiStore";
import {
  getVlmCurrentSkuTruth,
  tierForVlmProductId,
  type VlmCurrentSkuTruth,
} from "@/lib/commerce/vlm-current-sku-truth";

type CheckoutStep = "cart" | "shipping" | "payment";
type PaymentMethod = "card" | "wallet";
type ServicePaymentRail = "stripe_checkout_card" | "stripe_checkout_blik";
type CheckoutStatus = {
  phase: "idle" | "loading" | "redirecting" | "wallet" | "error";
  title: string;
  body?: string;
  receipt?: string;
};

type CheckoutDraft = {
  step: CheckoutStep;
  paymentMethod: PaymentMethod;
  servicePaymentRail: ServicePaymentRail;
  fullName: string;
  email: string;
  address: string;
  city: string;
  country: string;
};

type PaymentMethodCard = {
  id: PaymentMethod;
  icon: typeof CreditCard;
  title: string;
  body: string;
};

const defaultDraft: CheckoutDraft = {
  step: "cart",
  paymentMethod: "card",
  servicePaymentRail: "stripe_checkout_card",
  fullName: "",
  email: "",
  address: "",
  city: "",
  country: "Germany",
};

function copyFor(locale: string) {
  if (locale === "de") {
    return {
      kicker: "Velmère Checkout",
      title: "Ein klarer Checkout vor der Zahlung.",
      body: "Du kannst Warenkorb, Lieferung und Zahlung testen. Live-Zahlung bleibt bis zur Business-/Stripe-Verifizierung gesperrt.",
      steps: { cart: "Warenkorb", shipping: "Lieferung", payment: "Zahlung" },
      card: "Karte / BLIK",
      cardBody: "Stripe Sandbox jetzt, Live nach Verifizierung.",
      serviceCardRail: "Karte",
      serviceBlikRail: "BLIK",
      serviceBlikBody: "BLIK braucht PLN-Line-Items und ein serverseitiges Stripe-Receipt. Ohne Konfiguration bleibt es gesperrt oder Demo.",
      serviceReplayHint: "Webhook replay: checkout completed → entitlement ledger → analysis queue.",
      wallet: "Connect Wallet / Web3",
      walletBody: "Wallet-Zahlung oder Access Proof über verbundenes Wallet.",
      shippingTitle: "Lieferdaten",
      paymentTitle: "Zahlungsart",
      summary: "Zusammenfassung",
      subtotal: "Zwischensumme",
      delivery: "Lieferung",
      tax: "Steuer",
      total: "Gesamt",
      empty: "Dein Warenkorb ist leer.",
      shop: "Zur Kollektion",
      next: "Weiter",
      back: "Zurück",
      pay: "Weiter zur Zahlung",
      locked: "Live-Zahlung gesperrt",
      saved: "Daten bleiben nur während dieses Checkout-Vorgangs im Arbeitsspeicher erhalten.",
      fields: {
        fullName: "Name",
        email: "E-Mail",
        address: "Adresse",
        city: "Stadt",
        country: "Land",
      },
      serviceAdvanced: "VLM Advanced Analysis",
      servicePdf: "VLM Advanced PDF",
      proofTitle: "Checkout-Status",
      proofBody:
        "Wenn Stripe Sandbox/Web3 bereit ist, leitet Velmère weiter. Advanced bleibt bis zum Server-Receipt gesperrt.",
      noClientUnlock: "Kein Client-only Unlock",
      noClientUnlockBody:
        "Advanced wird erst nach Server-Receipt freigeschaltet.",
      advancedCtaProofTitle: "CTA-Vertrag",
      advancedCtaProofBody:
        "Advanced bleibt entweder Missing-Proof-Map oder QA Preview, bis paid verdict + Server-Receipt explizit erlaubt sind.",
      receiptReplayProofTitle: "Receipt-Replay",
      receiptReplayProofBody:
        "Post-Payment Unlock braucht Server-Receipt, Product Scope, Context Hash und passenden PASS2490 Fingerprint.",
      artifactDeliveryProofTitle: "Artefaktbereitstellung",
      artifactDeliveryProofBody:
        "Paid report delivery braucht PDF Preview/Download Hash-Parität, Account Delivery ID und denselben Delivery Manifest Key.",
      digitalService: "Digitaler Zugang · kein Liefer-Schritt",
      serviceBody:
        "Du kaufst keinen Versandartikel, sondern einen serverseitig bestätigten Zugang für Advanced, PDF oder Audit. Checkout bleibt bis zum Receipt geschlossen.",
      serviceAccess: "Digitaler Zugang",
      serviceDelivery: "Nach Receipt",
      serviceTrust: ["Digital", "Server-Receipt", "Kein Client-Unlock"],
      serviceReady: "Service-Demo bereit",
      sandboxReady: "Sandbox bereit",
      physicalTrust: ["Lieferung", "14 Tage", "Sichere Zahlung"],
      serviceCartHint:
        "Nach dem Server-Receipt wird der Zugang serverseitig an das signierte Konto gebunden; Browser-Token und Checkout-PII werden nicht dauerhaft gespeichert.",
      serviceContext: "Zugriffskontext",
      serviceSurface: "Bereich",
      serviceAsset: "Asset",
      serviceScope: "Umfang",
    };
  }
  if (locale === "en") {
    return {
      kicker: "Velmère Checkout",
      title: "A clean checkout before payment.",
      body: "You can test cart, shipping and payment. Live payment stays locked until business / Stripe verification is ready.",
      steps: { cart: "Cart", shipping: "Shipping", payment: "Payment" },
      card: "Card / BLIK",
      cardBody: "Stripe sandbox now, live after verification.",
      serviceCardRail: "Card",
      serviceBlikRail: "BLIK",
      serviceBlikBody: "BLIK needs PLN line items and a server-side Stripe receipt. Without config it stays blocked or demo-only.",
      serviceReplayHint: "Webhook replay: checkout completed → entitlement ledger → analysis queue.",
      wallet: "Connect Wallet / Web3",
      walletBody: "Wallet payment or access proof through a connected wallet.",
      shippingTitle: "Shipping details",
      paymentTitle: "Payment method",
      summary: "Order summary",
      subtotal: "Subtotal",
      delivery: "Delivery",
      tax: "Tax",
      total: "Total",
      empty: "Your cart is empty.",
      shop: "Return to collection",
      next: "Continue",
      back: "Back",
      pay: "Continue to payment",
      locked: "Live payment locked",
      saved: "Data remains only in memory while this checkout stays open.",
      fields: {
        fullName: "Full name",
        email: "Email",
        address: "Address",
        city: "City",
        country: "Country",
      },
      serviceAdvanced: "VLM Advanced Analysis",
      servicePdf: "VLM Advanced PDF",
      proofTitle: "Checkout status",
      proofBody:
        "When Stripe Sandbox/Web3 is ready, Velmère redirects you. Advanced stays locked until a server receipt exists.",
      noClientUnlock: "No client-only unlock",
      noClientUnlockBody: "Advanced unlocks only after a server receipt.",
      advancedCtaProofTitle: "CTA contract",
      advancedCtaProofBody:
        "Advanced stays as a missing-proof map or QA preview until paid verdict + server receipt are explicitly allowed.",
      receiptReplayProofTitle: "Powtórzenie potwierdzenia",
      receiptReplayProofBody:
        "Post-payment unlock needs server receipt, product scope, context hash and matching PASS2490 fingerprint.",
      artifactDeliveryProofTitle: "Dostarczenie artefaktu",
      artifactDeliveryProofBody:
        "Paid report delivery needs PDF preview/download hash parity, account delivery ID and the same delivery manifest key.",
      digitalService: "Digital access · no shipping step",
      serviceBody:
        "You are not buying a shipped product here; this is server-verified access for Advanced, PDF or Audit. The paid layer remains locked until a receipt exists.",
      serviceAccess: "Digital access",
      serviceDelivery: "After receipt",
      serviceTrust: ["Digital", "Server receipt", "No client unlock"],
      serviceReady: "Service demo ready",
      sandboxReady: "Sandbox ready",
      physicalTrust: ["Delivery", "14 days", "Secure"],
      serviceCartHint:
        "After a server receipt, access is bound to the signed account on the server; the browser does not persist a paid token or checkout PII draft.",
      serviceContext: "Access context",
      serviceSurface: "Surface",
      serviceAsset: "Asset",
      serviceScope: "Scope",
    };
  }
  return {
    kicker: "Velmère Checkout",
    title: "Czysty checkout przed płatnością.",
    body: "Możesz testować koszyk, dostawę i płatność. Live payment zostaje zablokowany do czasu firmy / Stripe verification.",
    steps: { cart: "Koszyk", shipping: "Dostawa", payment: "Płatność" },
    card: "Karta / BLIK",
    cardBody: "Stripe sandbox teraz, live po weryfikacji.",
    serviceCardRail: "Karta",
    serviceBlikRail: "BLIK",
    serviceBlikBody: "BLIK wymaga line item w PLN i server-side Stripe receipt. Bez konfiguracji zostaje blokada albo demo.",
    serviceReplayHint: "Webhook replay: checkout completed → entitlement ledger → analysis queue.",
    wallet: "Connect Wallet / Web3",
    walletBody: "Płatność wallet albo access proof przez podłączony portfel.",
    shippingTitle: "Dane dostawy",
    paymentTitle: "Sposób płatności",
    summary: "Podsumowanie",
    subtotal: "Suma częściowa",
    delivery: "Dostawa",
    tax: "Podatek",
    total: "Razem",
    empty: "Koszyk jest pusty.",
    shop: "Wróć do kolekcji",
    next: "Dalej",
    back: "Wstecz",
    pay: "Przejdź do płatności",
    locked: "Live płatność zablokowana",
    saved: "Dane pozostają tylko w pamięci podczas otwartego checkoutu.",
    fields: {
      fullName: "Imię i nazwisko",
      email: "Email",
      address: "Adres",
      city: "Miasto",
      country: "Kraj",
    },
    serviceAdvanced: "VLM Advanced Analysis",
    servicePdf: "VLM Advanced PDF",
    proofTitle: "Status checkoutu",
    proofBody:
      "Gdy Stripe Sandbox/Web3 jest gotowy, Velmère przekieruje dalej. Advanced zostaje zamknięty do server receipt.",
    noClientUnlock: "Bez client-only unlock",
    noClientUnlockBody: "Advanced odblokowuje się dopiero po server receipt.",
    advancedCtaProofTitle: "Kontrakt CTA",
    advancedCtaProofBody:
      "Advanced zostaje missing-proof map albo QA preview, dopóki paid verdict + server receipt nie są jawnie dozwolone.",
    receiptReplayProofTitle: "Powtórzenie potwierdzenia",
    receiptReplayProofBody:
      "Unlock po płatności wymaga server receipt, product scope, context hash i zgodnego PASS2490 fingerprint.",
    artifactDeliveryProofTitle: "Dostarczenie artefaktu",
    artifactDeliveryProofBody:
      "Dostarczenie płatnego raportu wymaga PDF preview/download hash parity, account delivery ID i tego samego delivery manifest key.",
    digitalService: "Dostęp cyfrowy · bez kroku dostawy",
    serviceBody:
      "Tutaj nie kupujesz produktu z wysyłką, tylko dostęp server-side do Advanced, PDF albo Audit. Warstwa płatna zostaje zamknięta, dopóki nie istnieje receipt.",
    serviceAccess: "Dostęp cyfrowy",
    serviceDelivery: "Po receipt",
    serviceTrust: ["Digital", "Server receipt", "Bez client unlock"],
    serviceReady: "Demo usługi gotowe",
    sandboxReady: "Sandbox gotowy",
    physicalTrust: ["Dostawa", "14 dni", "Secure"],
    serviceCartHint: "Po server receipt dostęp jest związany z podpisanym kontem po stronie serwera; przeglądarka nie utrwala tokenu ani danych checkoutu.",
    serviceContext: "Kontekst dostępu",
    serviceSurface: "Moduł",
    serviceAsset: "Asset",
    serviceScope: "Zakres",
  };
}

function safeCheckoutLocale(locale: string): VlmPaidAccessContext["locale"] {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

function serviceProductFromQuery(value: string): VlmPaidProductId | null {
  const cleanValue = value.trim().toLowerCase();
  const exact = normalizeVlmPaidProductId(cleanValue);
  if (exact) return exact;
  if (cleanValue.includes("advanced-pdf")) return "vlm_advanced_pdf_single";
  if (cleanValue.includes("advanced-analysis"))
    return "vlm_advanced_analysis_single";
  if (cleanValue.includes("advanced-audit"))
    return "vlm_advanced_audit_human_review";
  return null;
}

function serviceLineFor(
  params: { get(name: string): string | null },
  locale: string,
) {
  const service = params.get("vlm_service") ?? "";
  const productId = serviceProductFromQuery(service);
  if (!productId) return null;
  const safeLocale = safeCheckoutLocale(locale);
  const rawAssetId = (params.get("assetId") ?? params.get("asset") ?? "").trim();
  const rawSymbol = (params.get("symbol") ?? params.get("asset") ?? rawAssetId).trim();
  const assetId = rawAssetId ? rawAssetId.toUpperCase() : "";
  const symbol = rawSymbol ? rawSymbol.toUpperCase() : "";
  const asset = symbol || assetId;
  const requestId = params.get("requestId") ?? undefined;
  const returnPath = params.get("return") ?? undefined;
  const expectedTier = productId.startsWith("vlm_pro_") ? "pro" : "advanced";
  const requestedTier = params.get("depth");
  const depth =
    requestedTier === "pro" || requestedTier === "advanced"
      ? requestedTier
      : expectedTier;
  const surfaceQuery = params.get("surface");
  const surface: VlmPaidAccessContext["surface"] =
    surfaceQuery === "real-markets" ||
    surfaceQuery === "browser" ||
    surfaceQuery === "audit" ||
    surfaceQuery === "shield"
      ? surfaceQuery
      : productId === "vlm_pro_pdf_single" ||
          productId === "vlm_advanced_pdf_single"
        ? "browser"
        : productId === "vlm_pro_audit_review" ||
            productId === "vlm_advanced_audit_human_review"
          ? "audit"
          : "shield";
  const context: Partial<VlmPaidAccessContext> = {
    surface,
    locale: safeLocale,
    assetId: assetId || asset || undefined,
    symbol: symbol || asset || undefined,
    depth,
    requestId,
    returnPath,
  };
  const requestedProductCellId = params.get("product_cell") ?? undefined;
  const productCellGate = resolvePass35PaidUiStopSell({
    productId,
    requestedProductCellId,
    surface: context.surface,
    tier: context.depth,
  });
  const product = getVlmPaidProduct(productId, safeLocale);
  const currentTier = tierForVlmProductId(productId);
  const currentSkuTruth: VlmCurrentSkuTruth = getVlmCurrentSkuTruth(currentTier ?? "advanced", safeLocale);
  return {
    name: `${product.label}${asset ? ` · ${asset}` : ""}`,
    amount: product.amount,
    label: product.priceLabel.replace("€", " EUR"),
    productId,
    checkoutCta: product.checkoutCta,
    shortLabel: product.shortLabel,
    accessScope: product.accessScope,
    boundaries: product.boundaries,
    currentSkuTruth,
    context,
    productCellGate,
  };
}

function checkoutStatusCopy(
  locale: string,
  key: "loading" | "redirecting" | "wallet" | "error" | "disabled",
) {
  if (locale === "de") {
    return {
      loading: "Checkout wird geprüft…",
      redirecting: "Weiterleitung zur sicheren Zahlung…",
      wallet:
        "Wallet-Panel geöffnet. Verbinde MetaMask, Phantom oder eine andere Wallet, dann bestätigen wir Access serverseitig.",
      error: "Checkout ist noch nicht bereit.",
      disabled:
        "Live Checkout ist blockiert, bis Business-, Stripe- und Store-Daten vollständig sind.",
    }[key];
  }
  if (locale === "en") {
    return {
      loading: "Checking checkout…",
      redirecting: "Redirecting to secure payment…",
      wallet:
        "Wallet panel opened. Connect MetaMask, Phantom or another wallet, then access is verified server-side.",
      error: "Checkout is not ready yet.",
      disabled:
        "Live checkout stays blocked until business, Stripe and store data are complete.",
    }[key];
  }
  return {
    loading: "Sprawdzam checkout…",
    redirecting: "Przekierowuję do bezpiecznej płatności…",
    wallet:
      "Otworzyłem panel wallet. Podłącz MetaMask, Phantom albo inny wallet — dostęp potwierdzamy server-side.",
    error: "Checkout nie jest jeszcze gotowy.",
    disabled:
      "Live checkout zostaje zablokowany, dopóki firma, Stripe i dane sklepu nie są kompletne.",
  }[key];
}

function compactCheckoutError(payload: unknown) {
  if (!payload || typeof payload !== "object") return "checkout_unavailable";
  const candidate = payload as { error?: unknown; details?: unknown };
  const error =
    typeof candidate.error === "string"
      ? candidate.error
      : "checkout_unavailable";
  if (Array.isArray(candidate.details)) {
    return `${error}: ${candidate.details.slice(0, 2).join(" · ")}`;
  }
  if (
    candidate.details &&
    typeof candidate.details === "object" &&
    "reasons" in candidate.details
  ) {
    const reasons = (candidate.details as { reasons?: unknown }).reasons;
    if (Array.isArray(reasons))
      return `${error}: ${reasons.slice(0, 2).join(" · ")}`;
  }
  return error;
}

export default function VelmereCheckoutFlowClient({
  locale,
  checkoutReady,
  serviceDemoReady = false,
}: {
  locale: string;
  checkoutReady: boolean;
  serviceDemoReady?: boolean;
}) {
  const c = copyFor(locale);
  const searchParams = useSearchParams();
  const serviceLine = useMemo(
    () => serviceLineFor(searchParams, locale),
    [locale, searchParams],
  );
  const serviceLineKey = serviceLine
    ? `${serviceLine.productId}:${serviceLine.context.surface}:${serviceLine.context.assetId ?? serviceLine.context.symbol ?? serviceLine.context.requestId ?? "generic"}`
    : "cart";
  const lastServiceLineKeyRef = useRef(serviceLineKey);
  const checkoutAbortRef = useRef<AbortController | null>(null);
  const checkoutRequestSeqRef = useRef(0);

  function abortActiveCheckoutRequest() {
    checkoutRequestSeqRef.current += 1;
    checkoutAbortRef.current?.abort();
    checkoutAbortRef.current = null;
  }
  const { items, subtotal, currency, addItem, setItemQuantity, removeItem } =
    useCart();
  const walletUi = useWalletUiStore();
  const [draft, setDraft] = useState<CheckoutDraft>(defaultDraft);
  const visibleItems: CartItem[] = serviceLine ? [] : items;
  const hasLines = visibleItems.length > 0 || Boolean(serviceLine);
  const displaySubtotal =
    (serviceLine ? 0 : subtotal) + (serviceLine?.amount ?? 0);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus>({
    phase: "idle",
    title: "",
  });
  const serviceStopSell = Boolean(
    serviceLine && (
      !serviceLine.productCellGate.checkoutAllowed ||
      !serviceLine.currentSkuTruth.publicCheckoutAllowed
    ),
  );
  const serviceCheckoutUsable = serviceLine
    ? serviceLine.productCellGate.checkoutAllowed &&
      serviceLine.currentSkuTruth.publicCheckoutAllowed &&
      (checkoutReady || serviceDemoReady)
    : checkoutReady;
  const pageBody = serviceLine ? serviceLine.currentSkuTruth.description : c.body;
  const trustLabels = serviceLine
    ? [...serviceLine.currentSkuTruth.boundaries].slice(0, 3)
    : c.physicalTrust;
  const trustIcons = serviceLine
    ? [LockKeyhole, ShieldCheck, CheckCircle2]
    : [Truck, RotateCcw, ShieldCheck];

  async function beginCheckout() {
    if (
      !hasLines ||
      checkoutStatus.phase === "loading" ||
      checkoutStatus.phase === "redirecting"
    )
      return;

    if (serviceLine && !serviceLine.productCellGate.ok) {
      setCheckoutStatus({
        phase: "error",
        title: checkoutStatusCopy(locale, "disabled"),
        body: pass35PaidUiStopSellCopy(locale),
      });
      return;
    }

    window.dispatchEvent(
      new CustomEvent("velmere:close-header-surfaces", {
        detail: { source: "checkout-begin", pass: "2275" },
      }),
    );
    const connectedWalletAddress = walletUi.connected ? walletUi.fullAddress : "";
    if (draft.paymentMethod === "wallet" && connectedWalletAddress) {
      window.dispatchEvent(
        new CustomEvent("velmere:close-wallet", {
          detail: { source: "checkout-payment-continue", connected: true },
        }),
      );
    }
    if (draft.paymentMethod === "wallet" && !connectedWalletAddress) {
      if (serviceLine) {
        writeVlmPaidCheckoutIntent({
          productId: serviceLine.productId,
          locale,
          context: serviceLine.context,
        });
      }
      window.dispatchEvent(
        new CustomEvent("velmere:open-wallet", {
          detail: {
            source: "checkout-payment-method",
            service: serviceLine?.productId ?? "cart",
            context: serviceLine?.context,
          },
        }),
      );
      setCheckoutStatus({
        phase: "wallet",
        title: c.proofTitle,
        body: checkoutStatusCopy(locale, "wallet"),
      });
      return;
    }

    abortActiveCheckoutRequest();
    const checkoutRequestId = checkoutRequestSeqRef.current + 1;
    checkoutRequestSeqRef.current = checkoutRequestId;
    const checkoutController = new AbortController();
    checkoutAbortRef.current = checkoutController;
    setCheckoutStatus({
      phase: "loading",
      title: checkoutStatusCopy(locale, "loading"),
      body: c.proofBody,
    });
    try {
      const isServiceCheckout = Boolean(serviceLine);
      if (serviceLine) {
        writeVlmPaidCheckoutIntent({
          productId: serviceLine.productId,
          locale,
          context: serviceLine.context,
        });
      }
      const response = await fetch(
        isServiceCheckout ? "/api/checkout/vlm-service" : "/api/checkout",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-velmere-client-request-id": `checkout-${checkoutRequestId}`,
          },
          signal: checkoutController.signal,
          body: JSON.stringify(
            isServiceCheckout
              ? {
                  productId: serviceLine?.productId,
                  productCellId: serviceLine?.productCellGate.ok
                    ? serviceLine.productCellGate.productCellId
                    : undefined,
                  locale,
                  context: serviceLine?.context,
                  paymentRail: draft.servicePaymentRail,
                }
              : {
                  locale,
                  paymentMethod: draft.paymentMethod,
                  walletAddress: connectedWalletAddress || null,
                  items: visibleItems.map((item: CartItem) => ({
                    productId: item.id,
                    variantId: item.variantId,
                    size: item.size,
                    selectedSize: item.size,
                    quantity: item.quantity,
                  })),
                },
          ),
        },
      );
      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? await readJsonResponseBounded<{
            url?: unknown;
            sessionId?: unknown;
            checkoutVerificationBindingToken?: unknown;
          }>(response, 2 * 1024 * 1024).catch(() => null)
        : null;
      if (checkoutController.signal.aborted || checkoutRequestSeqRef.current !== checkoutRequestId) return;
      const url = typeof payload?.url === "string" ? payload.url : "";
      const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : undefined;
      const checkoutVerificationBindingToken =
        typeof payload?.checkoutVerificationBindingToken === "string"
          ? payload.checkoutVerificationBindingToken
          : undefined;
      if (response.ok && url) {
        if (
          serviceLine
          && (
            !sessionId
            || !checkoutVerificationBindingToken
            || checkoutVerificationBindingToken.length > 4_096
          )
        ) {
          setCheckoutStatus({
            phase: "error",
            title: checkoutStatusCopy(locale, "error"),
            body: "checkout_verification_binding_missing",
          });
          return;
        }
        if (
          serviceLine
          && sessionId
          && checkoutVerificationBindingToken
        ) {
          writeVlmPaidCheckoutIntent({
            productId: serviceLine.productId,
            locale,
            context: serviceLine.context,
            sessionId,
            checkoutVerificationBindingToken,
          });
        }
        setCheckoutStatus({
          phase: "redirecting",
          title: checkoutStatusCopy(locale, "redirecting"),
          body: c.proofBody,
          receipt: sessionId,
        });
        window.location.assign(assertCheckoutRedirectUrl(url, window.location.origin));
        return;
      }
      setCheckoutStatus({
        phase: "error",
        title: checkoutStatusCopy(
          locale,
          serviceCheckoutUsable ? "error" : "disabled",
        ),
        body: compactCheckoutError(payload),
      });
    } catch (error) {
      if (checkoutController.signal.aborted || checkoutRequestSeqRef.current !== checkoutRequestId) return;
      reportBrowserBoundaryFailure({ event: "checkout_request_failed", error });
      setCheckoutStatus({
        phase: "error",
        title: checkoutStatusCopy(locale, "error"),
        body: publicBrowserFailureCode(
          error,
          ["checkout_network_error", "checkout_unavailable", "payment_required"],
          "checkout_network_error",
        ),
      });
    } finally {
      if (checkoutRequestSeqRef.current === checkoutRequestId) {
        checkoutAbortRef.current = null;
      }
    }
  }

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("velmere:close-header-surfaces", {
        detail: { source: "checkout-mounted", pass: "2275" },
      }),
    );
    return () => {
      abortActiveCheckoutRequest();
    };
  }, []);

  useEffect(() => {
    purgeLegacyCheckoutPiiDrafts();
  }, []);

  useEffect(() => {
    if (lastServiceLineKeyRef.current === serviceLineKey) return undefined;
    abortActiveCheckoutRequest();
    lastServiceLineKeyRef.current = serviceLineKey;
    const timer = window.setTimeout(() => {
      setCheckoutStatus({ phase: "idle", title: "" });
      setDraft((current: CheckoutDraft) => ({
        ...current,
        step: serviceLine
          ? "cart"
          : current.step === "shipping"
            ? "shipping"
            : "cart",
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [serviceLine, serviceLineKey]);

  useEffect(() => {
    if (!serviceLine || draft.step !== "shipping") return undefined;
    const timer = window.setTimeout(() => {
      setDraft((current: CheckoutDraft) => ({ ...current, step: "payment" }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draft.step, serviceLine, serviceLineKey]);

  const steps: CheckoutStep[] = serviceLine
    ? ["cart", "payment"]
    : ["cart", "shipping", "payment"];
  const nextStep: CheckoutStep =
    draft.step === "cart"
      ? serviceLine
        ? "payment"
        : "shipping"
      : draft.step === "shipping"
        ? "payment"
        : "payment";
  const previousStep: CheckoutStep =
    draft.step === "payment"
      ? serviceLine
        ? "cart"
        : "shipping"
      : draft.step === "shipping"
        ? "cart"
        : "cart";

  const methodCards = useMemo<PaymentMethodCard[]>(
    () => [
      {
        id: "card" as const,
        icon: CreditCard,
        title: c.card,
        body: c.cardBody,
      },
      {
        id: "wallet" as const,
        icon: WalletCards,
        title: c.wallet,
        body: c.walletBody,
      },
    ],
    [c.card, c.cardBody, c.wallet, c.walletBody],
  );
  const paymentCtaLabel = serviceLine?.checkoutCta ?? c.pay;
  const serviceAssetLabel =
    serviceLine?.context.symbol ||
    serviceLine?.context.assetId ||
    serviceLine?.context.requestId ||
    "—";

  return (
    <main
      className="velmere-public-page min-h-[100dvh] bg-velmere-black text-white"
      data-pass2255-checkout="two-method-server-gated-clickable-payment-proof"
      data-pass2256-checkout="real-endpoint-or-wallet-no-dead-click"
      data-pass2257-checkout="digital-services-skip-shipping-paid-access-return"
      data-pass2258-checkout="local-demo-service-receipt-loop-no-client-unlock"
      data-pass2259-checkout="surface-preserved-service-return"
      data-pass2260-checkout="digital-access-copy-receipt-first-no-shipping-noise"
      data-pass2261-checkout="service-context-price-copy-clean-trust-icons"
      data-pass2262-checkout="pending-intent-product-catalog-prices"
      data-pass2263-checkout="wallet-intent-service-safe-return-and-clean-receipt"
      data-pass2264-checkout="service-context-visible-and-product-cta"
      data-pass2265-checkout="service-asset-symbol-context-preserved"
      data-pass2267-checkout="service-payment-retry-receipt-flow-and-cart-runtime-qa"
      data-pass2268-checkout="bounded-service-receipt-retry-and-native-cart-hit-tests"
      data-pass2273-checkout="connected-wallet-does-not-reopen-panel-and-local-demo-redirect"
      data-pass2274-checkout="payment-cta-closes-stale-wallet-panel-and-demo-redirects"
      data-pass2364-checkout="stripe-test-blik-rail-and-webhook-replay-ready"
      data-pass2490-checkout="advanced-cta-entitlement-contract-visible"
      data-pass2491-checkout="entitlement-receipt-replay-parity-visible"
      data-pass2492-checkout="entitlement-artifact-delivery-ledger-visible"
    >
      <section className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        <div className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#050709] shadow-[0_34px_130px_rgba(0,0,0,0.55)]">
          <header className="border-b border-white/[0.07] px-5 py-5 md:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="luxury-kicker text-cyan-100/[0.78]">{c.kicker}</p>
                <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-[0.98] tracking-[-0.035em] md:text-6xl">
                  {c.title}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/[0.54]">
                  {pageBody}
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.055] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-velmere-gold/[0.82]">
                <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                {serviceCheckoutUsable
                  ? serviceDemoReady && serviceLine
                    ? c.serviceReady
                    : c.sandboxReady
                  : c.locked}
              </span>
            </div>

            <nav
              className="mt-7 flex flex-wrap gap-2"
              aria-label="Checkout steps"
            >
              {steps.map((step, index) => {
                const active = draft.step === step;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() =>
                      setDraft((current: CheckoutDraft) => ({ ...current, step }))
                    }
                    className={`min-h-11 rounded-full border px-4 font-mono text-[10px] uppercase tracking-[0.16em] transition ${active ? "border-cyan-200/[0.42] bg-cyan-300/[0.08] text-cyan-50" : "border-white/[0.08] bg-white/[0.025] text-white/[0.42] hover:text-white"}`}
                    data-pass2268-checkout-step={step}
                    data-testid={`velmere-checkout-step-${step}`}
                  >
                    {index + 1}. {c.steps[step]}
                  </button>
                );
              })}
            </nav>
          </header>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="min-h-[31rem] p-5 md:p-8 lg:p-10">
              {draft.step === "cart" ? (
                <div>
                  <h2 className="font-serif text-3xl text-white">
                    {c.steps.cart}
                  </h2>
                  {!hasLines ? (
                    <div className="mt-6 rounded-[1.4rem] border border-white/[0.07] bg-white/[0.025] p-6 text-center">
                      <ShoppingBag
                        className="mx-auto h-7 w-7 text-white/[0.38]"
                        aria-hidden="true"
                      />
                      <p className="mt-3 text-sm text-white/[0.56]">
                        {c.empty}
                      </p>
                      <Link
                        href="/shop"
                        className="velmere-command-pill mt-5 inline-flex min-h-11 px-5 text-[10px] text-black"
                        data-tone="gold"
                      >
                        {c.shop}
                      </Link>
                    </div>
                  ) : (
                    <ul className="mt-6 grid gap-3">
                      {visibleItems.map((item: CartItem) => (
                        <li
                          key={`${item.id}-${item.size}`}
                          className="grid gap-3 rounded-[1.35rem] border border-white/[0.07] bg-white/[0.025] p-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:items-center"
                        >
                          <div className="relative h-20 overflow-hidden rounded-xl bg-white/[0.04]">
                            {item.image ? (
                              <Image
                                src={item.image}
                                alt={item.name}
                                fill
                                sizes="80px"
                                className="object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="font-serif text-lg text-white/[0.90]">
                              {item.name}
                            </p>
                            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/[0.38]">
                              {item.size} ·{" "}
                              {formatMoney(
                                { amount: item.price, currency: item.currency },
                                locale,
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setItemQuantity(
                                  item.id,
                                  item.size,
                                  item.quantity - 1,
                                )
                              }
                              className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.07] text-white/[0.55]"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-7 text-center font-mono text-sm tabular-nums text-white/[0.72]">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => addItem({ ...item, quantity: 1 })}
                              className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.07] text-white/[0.55]"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id, item.size)}
                              className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.07] text-white/[0.40] hover:text-rose-200"
                            >
                              ×
                            </button>
                          </div>
                        </li>
                      ))}
                      {serviceLine ? (
                        <li
                          className="rounded-[1.35rem] border border-cyan-200/[0.18] bg-cyan-300/[0.045] p-4"
                          data-pass2261-service-line="receipt-scoped-digital-access"
                        >
                          <p className="font-serif text-lg text-white/[0.90]">
                            {serviceLine.name}
                          </p>
                          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-100/[0.62]">
                            {serviceLine.label}
                          </p>
                          <p className="mt-3 text-xs leading-5 text-white/[0.46]">
                            {c.serviceCartHint}
                          </p>
                          <dl
                            className="mt-3 grid gap-2 rounded-2xl border border-white/[0.06] bg-black/[0.18] p-3 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.36] sm:grid-cols-3"
                            data-pass2264-service-context="visible-before-payment"
                          >
                            <div>
                              <dt>{c.serviceSurface}</dt>
                              <dd className="mt-1 text-cyan-100/[0.70]">
                                {serviceLine.context.surface}
                              </dd>
                            </div>
                            <div>
                              <dt>{c.serviceAsset}</dt>
                              <dd className="mt-1 truncate text-white/[0.68]">
                                {serviceAssetLabel}
                              </dd>
                            </div>
                            <div>
                              <dt>{c.serviceScope}</dt>
                              <dd className="mt-1 truncate text-white/[0.68]">
                                {serviceLine.shortLabel}
                              </dd>
                            </div>
                          </dl>
                          <div
                            className="mt-3 rounded-2xl border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-3"
                            data-pass2490-service-cta-entitlement="advanced-copy-mode-server-receipt-required"
                          >
                            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-100/[0.72]">
                              {c.advancedCtaProofTitle}
                            </p>
                            <p className="mt-1 text-[10px] leading-5 text-white/[0.44]">
                              {c.advancedCtaProofBody}
                            </p>
                          </div>
                          <div
                            className="mt-3 rounded-2xl border border-violet-200/[0.12] bg-violet-300/[0.035] p-3"
                            data-pass2491-service-receipt-replay="server-receipt-product-scope-context-hash-required"
                          >
                            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-violet-100/[0.72]">
                              {c.receiptReplayProofTitle}
                            </p>
                            <p className="mt-1 text-[10px] leading-5 text-white/[0.44]">
                              {c.receiptReplayProofBody}
                            </p>
                          </div>
                          <div
                            className="mt-3 rounded-2xl border border-amber-200/[0.12] bg-amber-300/[0.035] p-3"
                            data-pass2492-service-artifact-delivery="pdf-preview-download-account-delivery-parity-required"
                          >
                            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-100/[0.72]">
                              {c.artifactDeliveryProofTitle}
                            </p>
                            <p className="mt-1 text-[10px] leading-5 text-white/[0.44]">
                              {c.artifactDeliveryProofBody}
                            </p>
                          </div>
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>
              ) : null}

              {draft.step === "shipping" ? (
                <div>
                  <h2 className="font-serif text-3xl text-white">
                    {c.shippingTitle}
                  </h2>
                  <p className="mt-3 text-sm text-white/[0.48]">{c.saved}</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {(
                      Object.keys(c.fields) as Array<keyof typeof c.fields>
                    ).map((field) => (
                      <label
                        key={field}
                        className={
                          field === "address"
                            ? "grid gap-2 md:col-span-2"
                            : "grid gap-2"
                        }
                      >
                        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.36]">
                          {c.fields[field]}
                        </span>
                        <input
                          value={draft[field]}
                          onChange={(event: ReactChangeEvent<HTMLInputElement>) =>
                            setDraft((current: CheckoutDraft) => ({
                              ...current,
                              [field]: event.target.value,
                            }))
                          }
                          className="min-h-12 rounded-2xl border border-white/[0.08] bg-black/[0.24] px-4 text-sm text-white outline-none focus:border-cyan-200/[0.35]"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {draft.step === "payment" ? (
                <div>
                  <h2 className="font-serif text-3xl text-white">
                    {c.paymentTitle}
                  </h2>
                  <p className="mt-3 text-sm text-white/[0.48]">{c.saved}</p>
                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    {methodCards.map(({ id, icon: Icon, title, body }: PaymentMethodCard) => {
                      const active = draft.paymentMethod === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            setDraft((current: CheckoutDraft) => ({
                              ...current,
                              paymentMethod: id,
                            }))
                          }
                          className={`rounded-[1.5rem] border p-5 text-left transition ${active ? "border-cyan-200/[0.42] bg-cyan-300/[0.06]" : "border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16]"}`}
                        >
                          <Icon
                            className={
                              active
                                ? "h-6 w-6 text-cyan-100"
                                : "h-6 w-6 text-velmere-gold/[0.82]"
                            }
                            aria-hidden="true"
                          />
                          <h3 className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-white">
                            {title}
                          </h3>
                          <p className="mt-2 text-xs leading-6 text-white/[0.48]">
                            {body}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  {serviceLine && draft.paymentMethod === "card" ? (
                    <div
                      className="mt-4 rounded-[1.2rem] border border-white/[0.07] bg-black/[0.18] p-3"
                      data-pass2364-vlm-service-payment-rail="card-blik-selectable-fail-closed"
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[
                          { id: "stripe_checkout_card" as const, label: c.serviceCardRail },
                          { id: "stripe_checkout_blik" as const, label: c.serviceBlikRail },
                        ].map((rail) => {
                          const active = draft.servicePaymentRail === rail.id;
                          return (
                            <button
                              key={rail.id}
                              type="button"
                              onClick={() =>
                                setDraft((current: CheckoutDraft) => ({
                                  ...current,
                                  servicePaymentRail: rail.id,
                                }))
                              }
                              className={`rounded-full border px-4 py-3 font-mono text-[9px] uppercase tracking-[0.16em] transition ${active ? "border-cyan-200/[0.42] bg-cyan-300/[0.065] text-cyan-50" : "border-white/[0.08] bg-white/[0.025] text-white/[0.44] hover:text-white"}`}
                            >
                              {rail.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-[11px] leading-5 text-white/[0.48]">
                        {draft.servicePaymentRail === "stripe_checkout_blik"
                          ? c.serviceBlikBody
                          : c.serviceReplayHint}
                      </p>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onPointerDownCapture={(event: ReactPointerEvent<HTMLButtonElement>) => {
                      event.currentTarget.dataset.pass4137CheckoutPointer = "owned";
                      window.dispatchEvent(
                        new CustomEvent("velmere:close-header-surfaces", {
                          detail: { source: "checkout-payment-cta-pointerdown", pass: "2275" },
                        }),
                      );
                    }}
                    onClick={() => void beginCheckout()}
                    disabled={
                      !hasLines ||
                      serviceStopSell ||
                      checkoutStatus.phase === "loading" ||
                      checkoutStatus.phase === "redirecting"
                    }
                    className="velmere-command-pill mt-7 flex min-h-13 w-full items-center justify-center gap-2 px-6 text-[10px] text-black disabled:cursor-not-allowed disabled:opacity-45"
                    data-tone="gold"
                    data-pass2255-payment-cta="clickable-proof-no-live-charge"
                    data-pass2256-payment-cta="real-endpoint-or-wallet-panel"
                    data-pass2258-payment-cta="service-demo-can-return-access-token"
                    data-pass2259-payment-cta="surface-preserved-paid-return"
                    data-pass2261-payment-cta="receipt-scoped-service-or-wallet"
                    data-pass2262-payment-cta="stores-pending-intent-before-redirect"
                    data-pass2263-payment-cta="wallet-and-card-persist-service-intent"
                    data-pass2264-payment-cta={
                      serviceLine
                        ? "service-product-specific-cta"
                        : "commerce-order-cta"
                    }
                    data-pass2267-payment-cta={
                      serviceLine
                        ? "service-receipt-retry-safe-payment"
                        : "commerce-payment-native-click"
                    }
                    data-pass2268-payment-cta={
                      serviceLine
                        ? "bounded-receipt-return-flow"
                        : "native-commerce-checkout-flow"
                    }
                    data-pass2274-payment-cta="wallet-connected-no-panel-reopen"
                    data-pass2275-payment-cta="closes-all-header-overlays-before-fetch"
                    data-pass2364-payment-cta="selected-service-payment-rail-sent-to-server"
                    data-testid="velmere-checkout-payment-cta"
                    data-pass35-paid-ui-stop-sell={
                      serviceLine
                        ? serviceLine.productCellGate.checkoutAllowed
                          ? "ready"
                          : "blocked"
                        : "not-applicable"
                    }
                  >
                    {checkoutStatus.phase === "loading" ||
                    checkoutStatus.phase === "redirecting" ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                    )}
                    {checkoutStatus.phase === "loading"
                      ? checkoutStatusCopy(locale, "loading")
                      : checkoutStatus.phase === "redirecting"
                        ? checkoutStatusCopy(locale, "redirecting")
                        : serviceStopSell
                          ? locale === "pl"
                            ? "Sprzedaż wstrzymana"
                            : locale === "de"
                              ? "Verkauf gesperrt"
                              : "Sale unavailable"
                          : paymentCtaLabel}
                  </button>
                  {serviceStopSell ? (
                    <p
                      className="mt-3 text-xs leading-6 text-amber-100/[0.72]"
                      role="status"
                      data-pass35-paid-ui-stop-sell-copy="catalog-readiness"
                    >
                      {pass35PaidUiStopSellCopy(locale)}
                    </p>
                  ) : null}
                  {checkoutStatus.phase !== "idle" ? (
                    <div
                      className={`velmere-checkout-proof-card-pass2255 velmere-checkout-status-pass2256 mt-4 rounded-[1.2rem] border p-4 ${checkoutStatus.phase === "error" ? "border-rose-200/[0.18] bg-rose-500/[0.045]" : "border-cyan-200/[0.16] bg-cyan-300/[0.045]"}`}
                      role="status"
                      data-pass2268-checkout-status={checkoutStatus.phase}
                    >
                      <div className="flex items-start gap-3">
                        {checkoutStatus.phase === "error" ? (
                          <AlertTriangle
                            className="mt-0.5 h-5 w-5 shrink-0 text-rose-200"
                            aria-hidden="true"
                          />
                        ) : checkoutStatus.phase === "loading" ? (
                          <Loader2
                            className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-cyan-100"
                            aria-hidden="true"
                          />
                        ) : (
                          <CheckCircle2
                            className="mt-0.5 h-5 w-5 shrink-0 text-cyan-100"
                            aria-hidden="true"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-100/[0.82]">
                            {checkoutStatus.title || c.proofTitle}
                          </p>
                          {checkoutStatus.body ? (
                            <p className="mt-2 text-xs leading-6 text-white/[0.58]">
                              {checkoutStatus.body}
                            </p>
                          ) : null}
                          {checkoutStatus.receipt ? (
                            <p className="mt-2 truncate font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.34]">
                              {checkoutStatus.receipt}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-8 flex flex-wrap gap-3">
                {draft.step !== "cart" ? (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((current: CheckoutDraft) => ({
                        ...current,
                        step: previousStep,
                      }))
                    }
                    className="velmere-command-pill min-h-11 px-5 text-[10px] text-white/[0.62]"
                  >
                    {c.back}
                  </button>
                ) : null}
                {draft.step !== "payment" ? (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((current: CheckoutDraft) => ({ ...current, step: nextStep }))
                    }
                    className="velmere-command-pill min-h-11 px-5 text-[10px] text-black"
                    data-tone="gold"
                    disabled={!hasLines}
                  >
                    {c.next}
                  </button>
                ) : null}
                {serviceLine ? (
                  <span
                    className="inline-flex min-h-11 items-center rounded-full border border-cyan-200/[0.12] bg-cyan-300/[0.035] px-4 font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-100/[0.58]"
                    data-pass2257-service-checkout="no-shipping-required"
                  >
                    {c.digitalService}
                  </span>
                ) : null}
              </div>
            </div>

            <aside className="border-t border-white/[0.06] bg-[#07090c] p-5 md:p-7 lg:border-l lg:border-t-0">
              <div className="rounded-[1.5rem] border border-white/[0.08] bg-black/[0.28] p-5">
                <h2 className="font-serif text-3xl text-velmere-gold/[0.92]">
                  {c.summary}
                </h2>
                <div className="mt-5 grid gap-3 text-sm text-white/[0.60]">
                  {visibleItems.map((item: CartItem) => (
                    <div
                      key={`${item.id}-${item.size}-summary`}
                      className="flex justify-between gap-3 border-b border-white/[0.05] pb-3"
                    >
                      <span className="min-w-0 truncate">
                        {item.quantity}× {item.name}
                      </span>
                      <span className="shrink-0 font-mono text-white/[0.76]">
                        {formatMoney(
                          {
                            amount: item.price * item.quantity,
                            currency: item.currency,
                          },
                          locale,
                        )}
                      </span>
                    </div>
                  ))}
                  {serviceLine ? (
                    <div className="flex justify-between gap-3 border-b border-white/[0.05] pb-3">
                      <span className="min-w-0 truncate">
                        {serviceLine.name}
                      </span>
                      <span className="shrink-0 font-mono text-white/[0.76]">
                        {serviceLine.label}
                      </span>
                    </div>
                  ) : null}
                </div>
                <dl className="mt-5 space-y-3 border-t border-white/[0.08] pt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.42]">
                  <div className="flex justify-between">
                    <dt>{c.subtotal}</dt>
                    <dd className="text-white/[0.74]">
                      {formatMoney(
                        { amount: displaySubtotal, currency },
                        locale,
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>{serviceLine ? c.serviceAccess : c.delivery}</dt>
                    <dd className="text-cyan-100/[0.74]">
                      {serviceLine ? c.serviceDelivery : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>{c.tax}</dt>
                    <dd>—</dd>
                  </div>
                  <div className="flex justify-between border-t border-white/[0.08] pt-4 text-white">
                    <dt>{c.total}</dt>
                    <dd>
                      {formatMoney(
                        { amount: displaySubtotal, currency },
                        locale,
                      )}
                    </dd>
                  </div>
                </dl>
                <div
                  className="mt-5 grid grid-cols-3 gap-2"
                  data-pass2260-service-summary="digital-access-trust-cards"
                  data-pass2261-service-trust-icons={
                    serviceLine ? "digital-receipt" : "physical-order"
                  }
                >
                  {trustIcons.map((Icon, index) => (
                    <div
                      key={trustLabels[index] ?? index}
                      className="rounded-xl border border-white/[0.055] bg-white/[0.025] px-2 py-2 text-center"
                    >
                      <Icon
                        className="mx-auto h-4 w-4 text-cyan-100/[0.7]"
                        aria-hidden="true"
                      />
                      <p className="mt-1 text-[9px] leading-4 text-white/[0.42]">
                        {trustLabels[index] ?? "—"}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-xl border border-white/[0.065] bg-white/[0.025] p-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-100/[0.70]">
                    {c.noClientUnlock}
                  </p>
                  <p className="mt-1 text-[10px] leading-5 text-white/[0.42]">
                    {c.noClientUnlockBody}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
