import type { Metadata } from "next";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { getTranslations } from "next-intl/server";
import LuxurySection from "@/components/layout/LuxurySection";
import VlmServiceCheckoutSuccessClient from "@/components/checkout/VlmServiceCheckoutSuccessClient";
import { buildVlmPaidReturnPath, getVlmPaidProduct, normalizeVlmPaidProductId } from "@/lib/commerce/vlm-paid-access";
import { CustomerSafeStatusSurface } from "@/components/status/CustomerSafeStatusSurface";
import { buildPass2196CustomerSafeStatusSurface, type Pass2196CustomerLocale } from "@/lib/ui/customer-safe-status-surface";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

function customerLocale(locale: string): Pass2196CustomerLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ session_id?: string; vlm_service?: string; return?: string; auditCaseRef?: string }>;
};

export default async function CheckoutSuccessPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const t = await getTranslations({ locale, namespace: "Checkout" });
  const sessionId = resolvedSearchParams.session_id;
  const vlmService = resolvedSearchParams.vlm_service;
  const returnPath = resolvedSearchParams.return;
  const auditCaseRef = resolvedSearchParams.auditCaseRef;
  const normalizedService = normalizeVlmPaidProductId(vlmService);
  const serviceProduct = normalizedService
    ? getVlmPaidProduct(normalizedService, locale)
    : null;
  const isVlmServiceReceipt = Boolean(serviceProduct);
  const reference = sessionId ? `…${sessionId.slice(-10)}` : "unavailable";
  const statusSurface = buildPass2196CustomerSafeStatusSurface("order_status_safe", customerLocale(locale));
  const labels = locale === "pl"
    ? isVlmServiceReceipt
      ? { receipt: "Potwierdzenie dostępu VLM", status: "Weryfikacja receipt", reference: "Referencja", fulfilment: "Dostęp cyfrowy", fulfilmentValue: "Zapis po server verify", orderStatus: "Access", statusValue: "Po server verify", serviceKicker: "VLM service receipt", serviceTitle: serviceProduct?.shortLabel ?? "Dostęp VLM", serviceBody: "Potwierdzamy receipt i zapisujemy dostęp na tym urządzeniu. Advanced/PDF/Audit nie odblokowują się client-only.", back: "Wróć do analizy" }
      : { receipt: "Potwierdzenie zamówienia", status: "Oczekuje na weryfikację", reference: "Referencja", fulfilment: "Realizacja", fulfilmentValue: "Rozpocznie się po potwierdzeniu płatności", orderStatus: "Status", statusValue: "Weryfikacja płatności", serviceKicker: t("successKicker"), serviceTitle: t("successTitle"), serviceBody: t("successBody"), back: t("backToShop") }
    : locale === "de"
      ? isVlmServiceReceipt
        ? { receipt: "VLM Access Receipt", status: "Receipt-Prüfung", reference: "Referenz", fulfilment: "Digitaler Zugang", fulfilmentValue: "Speicherung nach Server-Verify", orderStatus: "Access", statusValue: "Nach Server-Verify", serviceKicker: "VLM service receipt", serviceTitle: serviceProduct?.shortLabel ?? "VLM Access", serviceBody: "Velmère prüft das Receipt und speichert Access auf diesem Gerät. Advanced/PDF/Audit werden nicht client-only freigeschaltet.", back: "Zur Analyse zurück" }
        : { receipt: "Bestellbestätigung", status: "Prüfung ausstehend", reference: "Referenz", fulfilment: "Fulfilment", fulfilmentValue: "Beginnt nach Zahlungsbestätigung", orderStatus: "Status", statusValue: "Zahlungsprüfung", serviceKicker: t("successKicker"), serviceTitle: t("successTitle"), serviceBody: t("successBody"), back: t("backToShop") }
      : isVlmServiceReceipt
        ? { receipt: "VLM access receipt", status: "Receipt verification", reference: "Reference", fulfilment: "Digital access", fulfilmentValue: "Saved after server verify", orderStatus: "Access", statusValue: "After server verify", serviceKicker: "VLM service receipt", serviceTitle: serviceProduct?.shortLabel ?? "VLM access", serviceBody: "Velmère verifies the receipt and saves access on this device. Advanced/PDF/Audit never unlock client-only.", back: "Return to analysis" }
        : { receipt: "Order receipt", status: "Verification pending", reference: "Reference", fulfilment: "Fulfilment", fulfilmentValue: "Starts after payment confirmation", orderStatus: "Status", statusValue: "Payment verification", serviceKicker: t("successKicker"), serviceTitle: t("successTitle"), serviceBody: t("successBody"), back: t("backToShop") };
  const backHref = isVlmServiceReceipt
    ? buildVlmPaidReturnPath({ returnPath }, `/${locale}`)
    : "/shop";
  const serviceProofCards = locale === "pl"
    ? ["Weryfikacja serwera", "Kontekst powiązany", "Brak odblokowania po stronie klienta", "Kontrola ponowienia", "Powiązanie artefaktu"]
    : locale === "de"
      ? ["Server-Prüfung", "Kontext gebunden", "Keine clientseitige Freigabe", "Wiederholungsprüfung", "Artefaktbindung"]
      : ["Server verification", "Context bound", "No client-side unlock", "Replay check", "Artifact binding"];

  return (
    <main
      className="min-h-[100dvh] bg-velmere-black text-white"
    >
      <LuxurySection className="py-28 md:py-36">
        <section className="mx-auto max-w-3xl rounded-none border border-white/[0.10] bg-white/[0.025] p-0 text-center shadow-[0_40px_140px_rgba(0,0,0,0.55)]">
          <div className="border-b border-white/[0.10] px-6 py-4 font-mono text-[10px] uppercase tracking-[0.24em] text-white/[0.38] sm:flex sm:items-center sm:justify-between">
            <span>{labels.receipt}</span>
            <span className="tabular-nums">{labels.status}</span>
          </div>
          <div className="p-7 md:p-10">
            {isVlmServiceReceipt ? (
              <LockKeyhole
                className="mx-auto h-12 w-12 text-cyan-100/[0.78]"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="mx-auto h-12 w-12 text-cyan-100/[0.78]"
                aria-hidden="true"
              />
            )}
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-100/[0.72]">{labels.serviceKicker}</p>
            <h1 className="mt-4 font-serif text-4xl tracking-[0.08em] text-white md:text-5xl">{labels.serviceTitle}</h1>
            <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-white/[0.56]">{labels.serviceBody}</p>

            <dl className="mx-auto mt-8 grid max-w-xl divide-y divide-white/[0.05] border-y border-white/[0.05] text-left font-mono text-[10px] uppercase tracking-[0.18em] text-white/[0.45]">
              <div className="grid gap-2 py-3 sm:grid-cols-[0.4fr_1fr]">
                <dt>{labels.reference}</dt>
                <dd className="break-all text-white/[0.72] tabular-nums">{reference}</dd>
              </div>
              <div className="grid gap-2 py-3 sm:grid-cols-[0.4fr_1fr]">
                <dt>{labels.fulfilment}</dt>
                <dd className="text-white/[0.72]">{labels.fulfilmentValue}</dd>
              </div>
              <div className="grid gap-2 py-3 sm:grid-cols-[0.4fr_1fr]">
                <dt>{labels.orderStatus}</dt>
                <dd className="text-cyan-100/[0.72]">{labels.statusValue}</dd>
              </div>
            </dl>

            {isVlmServiceReceipt ? (
              <div
                className="mx-auto mt-8 grid max-w-xl gap-2 text-left sm:grid-cols-5"
                data-pass2491-vlm-access-proof="true"
                data-pass2492-artifact-delivery-ledger="true"
              >
                {serviceProofCards.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-cyan-200/[0.12] bg-cyan-300/[0.04] p-3 font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-100/[0.66]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mx-auto mt-8 max-w-xl text-left">
                <CustomerSafeStatusSurface surface={statusSurface} compact />
              </div>
            )}

            <VlmServiceCheckoutSuccessClient
              locale={locale}
              sessionId={sessionId}
              productId={vlmService}
              returnPath={returnPath}
              auditCaseRef={auditCaseRef}
            />

            {!isVlmServiceReceipt ? (
              <a
                href={backHref}
                data-magnetic
                className="velmere-button-primary mt-8 inline-flex"
              >
                {labels.back}
              </a>
            ) : null}
          </div>
        </section>
      </LuxurySection>
    </main>
  );
}
