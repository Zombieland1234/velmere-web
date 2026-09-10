"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/navigation";
import { readBrowserConsent, writeBrowserConsent } from "@/lib/privacy/consent";
import { pass628LayerStyle } from "@/lib/ui/overlay-constitution";

export default function CookieConsent() {
  const pathname = usePathname();
  const t = useTranslations("CookieConsent");
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const choice = readBrowserConsent(window.localStorage);
      setAnalytics(choice?.analytics ?? false);
      setMarketing(choice?.marketing ?? false);
      setIsVisible(!choice);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const choose = (preferences: { analytics: boolean; marketing: boolean }) => {
    const saved = writeBrowserConsent(window.localStorage, preferences);
    setAnalytics(saved?.analytics ?? false);
    setMarketing(saved?.marketing ?? false);
    setIsVisible(!saved);
  };

  const isAssetPage = Boolean(pathname?.includes("/assets/"));

  return (
    <AnimatePresence>
      {isVisible && !isAssetPage ? (
        <motion.aside
          initial={{ y: 28, opacity: 0, scale: 0.985 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 24, opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="velmere-command-shell fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-auto w-[calc(100vw-1.5rem)] overflow-hidden rounded-[1.55rem] border-white/[0.09] p-4 text-white shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:left-5 sm:right-auto sm:w-[min(31rem,calc(100vw-2.5rem))] sm:p-5"
          style={pass628LayerStyle("floatingAction")}
          role="dialog"
          aria-labelledby="velmere-cookie-title"
          aria-describedby="velmere-cookie-description"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/[0.28] to-transparent" aria-hidden="true" />

          <div className="flex items-start gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-200/[0.16] bg-cyan-200/[0.055] text-cyan-100">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p id="velmere-cookie-title" className="text-sm font-semibold text-white/[0.86]">{t("title")}</p>
              <p id="velmere-cookie-description" className="mt-2 text-xs leading-6 text-white/[0.48]">{t("message")}</p>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {showSettings ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-4 rounded-[1.2rem] border border-white/[0.07] bg-black/[0.16] p-3.5">
                  <p className="text-xs leading-6 text-white/[0.46]">{t("settingsIntro")}</p>
                  <div className="mt-3 grid gap-2">
                    <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.055] bg-white/[0.02] px-3 py-2.5 text-xs leading-5 text-white/[0.48]">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-emerald-300/[0.28] bg-emerald-300/[0.08] text-emerald-200">
                        <Check className="h-2.5 w-2.5" aria-hidden="true" />
                      </span>
                      {t("necessary")}
                    </div>
                    {([
                      ["analytics", analytics, setAnalytics],
                      ["marketing", marketing, setMarketing],
                    ] as const).map(([key, enabled, setter]) => (
                      <button
                        key={key}
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        onClick={() => setter(!enabled)}
                        className="flex w-full items-start gap-2.5 rounded-xl border border-white/[0.055] bg-white/[0.02] px-3 py-2.5 text-left text-xs leading-5 text-white/[0.48] transition hover:border-white/[0.10] hover:text-white/[0.65]"
                      >
                        <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${enabled ? "border-cyan-200/[0.32] bg-cyan-200/[0.10] text-cyan-100" : "border-white/[0.10] text-white/[0.26]"}`}>
                          {enabled ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : null}
                        </span>
                        {t(key)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => choose({ analytics, marketing })}
                      className="velmere-button-secondary mt-1 min-h-10 w-full px-4 text-[10px]"
                    >
                      {t("save")}
                    </button>
                  </div>
                  <Link href="/privacy" className="mt-3 inline-flex text-xs text-cyan-100 underline-offset-4 transition hover:underline">
                    {t("privacyLink")}
                  </Link>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={() => choose({ analytics: false, marketing: false })}
              className="velmere-button-secondary min-h-11 px-4 text-[10px] sm:flex-1"
            >
              {t("decline")}
            </button>
            <button
              type="button"
              onClick={() => choose({ analytics: true, marketing: true })}
              className="velmere-button-primary min-h-11 px-4 text-[10px] sm:flex-1"
            >
              {t("accept")}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings((value: boolean) => !value)}
              className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/[0.38] transition hover:bg-white/[0.035] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/[0.38] sm:order-first sm:min-w-full"
              aria-expanded={showSettings}
            >
              {t("settings")}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${showSettings ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
