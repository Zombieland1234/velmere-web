import type { Metadata } from "next";
import { XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import LuxurySection from "@/components/layout/LuxurySection";
import { CustomerSafeStatusSurface } from "@/components/status/CustomerSafeStatusSurface";
import { buildPass2196CustomerSafeStatusSurface, type Pass2196CustomerLocale } from "@/lib/ui/customer-safe-status-surface";

function customerLocale(locale: string): Pass2196CustomerLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CheckoutCancelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Checkout" });
  const statusSurface = buildPass2196CustomerSafeStatusSurface("advanced_checkout_error", customerLocale(locale));
  const labels = locale === "pl"
    ? { receipt: "Sesja checkout", status: "Przerwana", note: "Checkout został przerwany. Jeśli widzisz obciążenie lub blokadę środków, sprawdź potwierdzenie operatora płatności albo skontaktuj się ze wsparciem." }
    : locale === "de"
      ? { receipt: "Checkout-Sitzung", status: "Abgebrochen", note: "Der Checkout wurde abgebrochen. Falls eine Belastung oder Reservierung sichtbar ist, prüfe die Bestätigung des Zahlungsanbieters oder kontaktiere den Support." }
      : { receipt: "Checkout session", status: "Stopped", note: "Checkout was stopped. If you see a charge or authorization hold, check the payment provider confirmation or contact support." };

  return (
    <main className="min-h-[100dvh] bg-velmere-black text-white">
      <LuxurySection className="py-28 md:py-36">
        <section className="mx-auto max-w-3xl rounded-none border border-white/[0.10] bg-white/[0.025] p-0 text-center shadow-[0_40px_140px_rgba(0,0,0,0.55)]">
          <div className="border-b border-white/[0.10] px-6 py-4 font-mono text-[10px] uppercase tracking-[0.24em] text-white/[0.38] sm:flex sm:items-center sm:justify-between">
            <span>{labels.receipt}</span>
            <span className="tabular-nums">{labels.status}</span>
          </div>
          <div className="p-7 md:p-10">
            <XCircle className="mx-auto h-12 w-12 text-white/[0.42]" aria-hidden="true" />
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-100/[0.68]">{t("cancelKicker")}</p>
            <h1 className="mt-4 font-serif text-4xl tracking-[0.08em] text-white md:text-5xl">{t("cancelTitle")}</h1>
            <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-white/[0.56]">{t("cancelBody")}</p>

            <div className="mx-auto mt-8 max-w-xl border-y border-white/[0.05] py-4 font-mono text-[10px] uppercase tracking-[0.18em] text-white/[0.42]">
              <p>{labels.note}</p>
            </div>

            <div className="mx-auto mt-8 max-w-xl text-left">
              <CustomerSafeStatusSurface surface={statusSurface} compact />
            </div>

            <Link
              href="/shop"
              data-magnetic
              className="velmere-button-primary mt-8 inline-flex"
            >
              {t("backToShop")}
            </Link>
          </div>
        </section>
      </LuxurySection>
    </main>
  );
}
