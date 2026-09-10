"use client";

import { useEffect } from "react";
import { Link } from "@/navigation";
import { ArrowLeft, Shield, Sparkles } from "lucide-react";

type Locale = "pl" | "en" | "de";

type ShieldProComingSoonProps = {
  locale: string;
};

const COPY: Record<
  Locale,
  {
    badge: string;
    title: string;
    message: string;
    details: string;
    goShield: string;
    backHome: string;
    statusLabel: string;
    statusValue: string;
  }
> = {
  en: {
    badge: "VELMÈRE SHIELD PRO · NEXT-GEN ARCHITECTURE",
    title: "COMING SOON",
    message:
      "Shield Pro is currently being rebuilt for a deeper next-generation analysis experience.",
    details:
      "All proprietary execution metrics, multi-chain mempool probes, and deep liquidity topology engines are undergoing comprehensive architectural and formal verification hardening.",
    goShield: "Go to Shield",
    backHome: "Back to Home",
    statusLabel: "Status",
    statusValue: "In Development · Offline for Public Access",
  },
  pl: {
    badge: "VELMÈRE SHIELD PRO · ARCHITEKTURA NOWEJ GENERACJI",
    title: "WKRÓTCE DOSTĘPNE",
    message:
      "Shield Pro jest obecnie przebudowywany z myślą o głębszym, nowej generacji doświadczeniu analitycznym.",
    details:
      "Instytucjonalny terminal ryzyka, silniki analityczne egzekucji oraz wielosieciowa kryminalistyka płynności przechodzą kompleksowe wzmocnienie architektoniczne i certyfikację formalną.",
    goShield: "Przejdź do Shield",
    backHome: "Wróć do strony głównej",
    statusLabel: "Status",
    statusValue: "W budowie · Dostęp publiczny tymczasowo wyłączony",
  },
  de: {
    badge: "VELMÈRE SHIELD PRO · ARCHITEKTUR DER NÄCHSTEN GENERATION",
    title: "DEMNÄCHST VERFÜGBAR",
    message:
      "Shield Pro wird derzeit für ein tieferes Analyseerlebnis der nächsten Generation neu aufgebaut.",
    details:
      "Unser institutionelles Risikoterminal, Ausführungs-Engines und Liquiditätsforensik werden umfassend architektonisch gehärtet und zertifiziert.",
    goShield: "Zu Shield",
    backHome: "Zur Startseite",
    statusLabel: "Status",
    statusValue: "In Entwicklung · Öffentlich vorübergehend deaktiviert",
  },
};

export default function ShieldProComingSoon({ locale }: ShieldProComingSoonProps) {
  const safeLocale: Locale = locale === "pl" || locale === "de" ? locale : "en";
  const t = COPY[safeLocale];

  // Shield Pro Scroll Lock (Requirement 9 in zadanie.txt)
  useEffect(() => {
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    const preventScroll = (e: WheelEvent | TouchEvent) => {
      // Allow scroll inside the coming soon container if on smaller viewports, but lock document body
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-scrollable-inner='true']")) {
        return;
      }
      e.preventDefault();
    };

    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.touchAction = originalTouchAction;
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-screen w-screen flex-col items-center justify-center bg-[#050507] px-6 text-velmere-ivory selection:bg-velmere-gold/20"
      style={{ minHeight: "100dvh" }}
      data-testid="shield-pro-coming-soon-root"
    >
      {/* Background glow and subtle geometry */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 45%, rgba(212, 175, 55, 0.08) 0%, transparent 60%), radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.03) 0%, transparent 50%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
        aria-hidden="true"
      />

      {/* Main Centered Content */}
      <div
        data-scrollable-inner="true"
        className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center"
      >
        {/* Subtle Brand Ribbon */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 text-[11px] font-medium tracking-widest text-velmere-gold uppercase backdrop-blur-md">
          <Sparkles className="h-3 w-3 text-velmere-gold" />
          <span>{t.badge}</span>
        </div>

        {/* Big Clean Title */}
        <h1 className="mb-4 text-4xl font-light tracking-tight text-white md:text-5xl lg:text-6xl">
          {t.title}
        </h1>

        {/* Required Primary Message */}
        <p className="mb-6 text-lg font-normal text-white/90 md:text-xl">
          {t.message}
        </p>

        {/* Secondary Technical Detail */}
        <p className="mb-10 text-sm leading-relaxed text-white/50 md:text-base">
          {t.details}
        </p>

        {/* Status indicator */}
        <div className="mb-10 inline-flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2 text-xs text-white/40">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <span className="font-semibold text-white/60">{t.statusLabel}:</span>
          <span>{t.statusValue}</span>
        </div>

        {/* Action Buttons: GO TO SHIELD and BACK TO HOME */}
        <div className="flex w-full flex-col items-center justify-center gap-3.5 sm:flex-row sm:gap-4">
          <Link
            href="/shield"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-velmere-ivory px-7 text-sm font-medium tracking-wide text-black transition-all duration-200 hover:bg-white hover:shadow-[0_0_24px_rgba(255,255,255,0.15)] sm:w-auto"
          >
            <Shield className="h-4 w-4" />
            <span>{t.goShield}</span>
          </Link>

          <Link
            href="/"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-7 text-sm font-medium tracking-wide text-white transition-all duration-200 hover:border-white/30 hover:bg-white/[0.08] sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4 text-white/70" />
            <span>{t.backHome}</span>
          </Link>
        </div>
      </div>

      {/* Footer subtle brand mark */}
      <div className="absolute bottom-6 z-10 text-[11px] tracking-widest text-white/20 uppercase">
        VELMÈRE · INSTITUTIONAL ASSURANCE
      </div>
    </div>
  );
}
