"use client";

import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useLocale } from "next-intl";
import { Link } from "@/navigation";
import { createBrowserErrorReference, reportBrowserBoundaryFailure } from "@/lib/security/browser-error-redaction";

const copy = {
  pl: {
    kicker: "Chwilowa przerwa",
    title: "Ten widok potrzebuje ponownego uruchomienia.",
    body: "Nie pokazujemy tutaj danych technicznych ani wrażliwych szczegółów. Spróbuj ponownie albo wróć na stronę główną.",
    retry: "Spróbuj ponownie",
    home: "Wróć na stronę główną",
    status: "Kontrolowane odzyskiwanie widoku",
    detail: "Kod pomocniczy",
  },
  de: {
    kicker: "Kurze Unterbrechung",
    title: "Diese Ansicht muss neu gestartet werden.",
    body: "Technische und sensible Details werden hier nicht angezeigt. Versuche es erneut oder kehre zur Startseite zurück.",
    retry: "Erneut versuchen",
    home: "Zur Startseite",
    status: "Kontrollierte Wiederherstellung",
    detail: "Referenzcode",
  },
  en: {
    kicker: "A brief interruption",
    title: "This view needs a fresh start.",
    body: "Technical and sensitive details are not shown here. Try again or return to the home page.",
    retry: "Try again",
    home: "Return home",
    status: "Controlled view recovery",
    detail: "Reference code",
  },
} as const;

export default function LocaleErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale() as keyof typeof copy;
  const t = copy[locale] ?? copy.en;

  const reference = useMemo(() => createBrowserErrorReference(error.digest), [error.digest]);

  useEffect(() => {
        reportBrowserBoundaryFailure({
      event: "locale_view_recovery",
      error,
      digest: reference,
    });
  }, [error, reference]);

  return (
    <main
      className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#08090b] px-4 py-24 text-white sm:px-6"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-x-[12%] top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-200/[0.16] to-transparent" />
      </div>

      <motion.section
        initial={{ opacity: 0, y: 20, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="pass2007-error-shell relative w-full max-w-[46rem] overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-[#090b0e] p-6 shadow-[0_30px_110px_rgba(0,0,0,0.50)] sm:p-9 md:p-12"
      >
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/[0.36] to-transparent"
          aria-hidden="true"
        />

        <div className="flex items-start justify-between gap-6">
          <div className="max-w-[35rem]">
            <p className="velmere-label text-cyan-100/[0.78]">{t.kicker}</p>
            <h1 className="mt-5 font-serif text-[clamp(2.45rem,7vw,5.4rem)] leading-[0.92] tracking-[-0.045em] text-velmere-ivory">
              {t.title}
            </h1>
            <p className="mt-6 max-w-[34rem] text-sm leading-7 text-white/[0.56] sm:text-base sm:leading-8">
              {t.body}
            </p>
          </div>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-cyan-200/[0.16] bg-cyan-300/[0.05] text-cyan-100">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="velmere-button-primary flex-1"
          >
            {t.retry}
          </button>
          <Link href="/" className="velmere-button-secondary flex-1">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t.home}
          </Link>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-5">
          <span className="inline-flex items-center gap-2 text-xs text-white/[0.40]">
            <span
              className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.6)]"
              aria-hidden="true"
            />
            {t.status}
          </span>
          <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.24]">
            {t.detail}: {reference}
          </span>
        </div>
      </motion.section>
    </main>
  );
}
