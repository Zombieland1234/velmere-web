/* PASS2561: wallet drawer visual contract restored from PASS2402 atelier calibrated map scene; customer UI must not render PASS/debug proof rails. */
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import {
  CheckCircle2,
  ChevronRight,
  Grid2X2,
  ShieldCheck,
  Unplug,
  WalletCards,
  X,
} from "lucide-react";
import { useWalletConnect } from "@/lib/wallet/useWalletConnect";
import { useWalletUiStore } from "@/store/useWalletUiStore";
import { openSafeExternalBrowserWindow } from "@/lib/security/browser-external-navigation";

export const PASS3501_WALLET_IDENTITY_NOT_PAYMENT = "wallet_identity_is_not_payment_receipt";
export const PASS3603_WALLET_IS_IDENTITY_ONLY = "wallet_signature_never_unlocks_paid_depth_without_server_receipt";

type WalletConnectDrawerProps = {
  onClose: () => void;
  onExpansionChange?: (expanded: boolean) => void;
};

type DrawerCopy = {
  title: string;
  step: string;
  heroTitle: string;
  heroBody: string;
  recommended: string;
  otherKicker: string;
  otherTitle: string;
  otherBody: string;
  securityTitle: string;
  missingTitle: string;
  missingBody: string;
  walletConnect: string;
  connectedTitle: string;
  connectedBody: string;
  disconnect: string;
  close: string;
};

type SecuritySlide = {
  title: string;
  body: string;
};

const copy: Record<"en" | "pl" | "de", DrawerCopy> = {
  en: {
    title: "CONNECT WALLET",
    step: "STEP 1 OF 2",
    heroTitle: "Connect your wallet",
    heroBody:
      "Choose your preferred wallet to continue and unlock exclusive Velmère experiences.",
    recommended: "Recommended",
    otherKicker: "Other wallets",
    otherTitle: "Other Wallets",
    otherBody: "View more wallets",
    securityTitle: "Your security comes first",
    missingTitle: "Don’t see your wallet?",
    missingBody: "We support WalletConnect.",
    walletConnect: "Connect via WalletConnect",
    connectedTitle: "Wallet connected",
    connectedBody:
      "Your wallet is connected read-only. Account, orders and checkout remain separated from wallet actions.",
    disconnect: "Disconnect wallet",
    close: "Close wallet",
  },
  pl: {
    title: "CONNECT WALLET",
    step: "KROK 1 Z 2",
    heroTitle: "Połącz portfel",
    heroBody:
      "Wybierz portfel, aby kontynuować i odblokować funkcje Velmère wymagające wallet access.",
    recommended: "Polecane",
    otherKicker: "Inne portfele",
    otherTitle: "Other Wallets",
    otherBody: "Zobacz więcej portfeli",
    securityTitle: "Bezpieczeństwo najpierw",
    missingTitle: "Nie widzisz swojego portfela?",
    missingBody: "Obsługujemy WalletConnect.",
    walletConnect: "Połącz przez WalletConnect",
    connectedTitle: "Portfel połączony",
    connectedBody:
      "Portfel jest połączony read-only. Konto, zamówienia i checkout pozostają oddzielone od akcji wallet.",
    disconnect: "Odłącz portfel",
    close: "Zamknij portfel",
  },
  de: {
    title: "CONNECT WALLET",
    step: "SCHRITT 1 VON 2",
    heroTitle: "Wallet verbinden",
    heroBody:
      "Wähle dein bevorzugtes Wallet, um fortzufahren und exklusive Velmère-Funktionen freizuschalten.",
    recommended: "Empfohlen",
    otherKicker: "Weitere Wallets",
    otherTitle: "Other Wallets",
    otherBody: "Weitere Wallets anzeigen",
    securityTitle: "Sicherheit zuerst",
    missingTitle: "Wallet nicht dabei?",
    missingBody: "Wir unterstützen WalletConnect.",
    walletConnect: "Über WalletConnect verbinden",
    connectedTitle: "Wallet verbunden",
    connectedBody:
      "Dein Wallet ist read-only verbunden. Konto, Bestellungen und Checkout bleiben von Wallet-Aktionen getrennt.",
    disconnect: "Wallet trennen",
    close: "Wallet schließen",
  },
};

const securitySlidesByLocale: Record<"en" | "pl" | "de", SecuritySlide[]> = {
  en: [
    {
      title: "Your security comes first",
      body: "Velmère never stores your keys. We only request access to the information needed for transactions.",
    },
    {
      title: "Read-only by design",
      body: "Connecting a wallet does not give checkout, orders or account management automatic wallet control.",
    },
    {
      title: "Clear wallet routing",
      body: "MetaMask and Phantom stay direct. Additional wallets route through WalletConnect for a calmer flow.",
    },
    {
      title: "Calm checkout separation",
      body: "Commerce, member access and wallet identity remain separated so the experience stays clean and understandable.",
    },
  ],
  pl: [
    {
      title: "Bezpieczeństwo najpierw",
      body: "Velmère nigdy nie przechowuje kluczy. Prosimy tylko o dostęp do informacji potrzebnych do transakcji.",
    },
    {
      title: "Tryb read-only",
      body: "Połączenie walleta nie daje automatycznej kontroli nad checkoutem, zamówieniami ani kontem.",
    },
    {
      title: "Jasny routing walletów",
      body: "MetaMask i Phantom są bezpośrednie. Dodatkowe portfele lecą przez WalletConnect dla spokojniejszego flow.",
    },
    {
      title: "Oddzielony checkout",
      body: "Commerce, member access i wallet identity są rozdzielone, żeby całość była czysta i zrozumiała.",
    },
  ],
  de: [
    {
      title: "Sicherheit zuerst",
      body: "Velmère speichert niemals deine Schlüssel. Wir fragen nur nach den Informationen, die für Transaktionen nötig sind.",
    },
    {
      title: "Read-only Zugriff",
      body: "Die Wallet-Verbindung gibt Checkout, Bestellungen oder Konto nicht automatisch Wallet-Kontrolle.",
    },
    {
      title: "Klare Wallet-Routen",
      body: "MetaMask und Phantom bleiben direkt. Weitere Wallets laufen über WalletConnect für einen ruhigeren Flow.",
    },
    {
      title: "Getrennter Checkout",
      body: "Commerce, Member-Zugang und Wallet-Identität bleiben getrennt, damit die Oberfläche klar bleibt.",
    },
  ],
};

type DrawerWalletOption = {
  key: string;
  label: string;
  icon: string;
  description?: string;
  action: () => Promise<void> | void;
  fallbackHref?: string;
  available?: boolean;
};

function WalletGlyph({ icon }: { icon: string }) {
  const imageClass = "h-8 w-8 object-contain";

  if (icon === "metamask") {
    return <Image src="/wallets/metamask.svg" alt="" width={40} height={40} className={imageClass} aria-hidden="true" />;
  }
  if (icon === "phantom") {
    return <Image src="/wallets/phantom.svg" alt="" width={40} height={40} className={imageClass} aria-hidden="true" />;
  }
  if (icon === "coinbase") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden="true">
        <circle cx="24" cy="24" r="18" fill="#2563eb" />
        <rect x="17" y="17" width="14" height="14" rx="3" fill="white" />
      </svg>
    );
  }
  if (icon === "trust") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden="true">
        <path d="M24 6l15 6v10c0 10-6 16-15 20C15 38 9 32 9 22V12l15-6Z" fill="#60a5fa" />
        <path d="M24 12v23c6-3 9-7 9-13v-6l-9-4Z" fill="#2563eb" />
      </svg>
    );
  }
  if (icon === "rainbow") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden="true">
        <defs>
          <linearGradient id="velmere-wallet-rainbow" x1="8" x2="40" y1="40" y2="8">
            <stop offset="0" stopColor="#22c55e" />
            <stop offset="0.34" stopColor="#0ea5e9" />
            <stop offset="0.68" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <rect x="9" y="9" width="30" height="30" rx="9" fill="url(#velmere-wallet-rainbow)" />
        <path d="M15 29c2-7 7-11 14-11 2.5 0 4.6.6 6.5 1.8" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.78" />
      </svg>
    );
  }
  if (icon === "okx") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden="true">
        <rect x="10" y="10" width="10" height="10" fill="white" />
        <rect x="28" y="10" width="10" height="10" fill="white" />
        <rect x="19" y="19" width="10" height="10" fill="white" />
        <rect x="10" y="28" width="10" height="10" fill="white" />
        <rect x="28" y="28" width="10" height="10" fill="white" />
      </svg>
    );
  }
  if (icon === "ledger") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden="true">
        <path d="M10 10h11v5h-6v6h-5V10Zm17 0h11v11h-5v-6h-6v-5ZM10 27h5v6h6v5H10V27Zm23 0h5v11H27v-5h6v-6Z" fill="#e5e7eb" />
      </svg>
    );
  }
  if (icon === "safe") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden="true">
        <rect x="9" y="9" width="30" height="30" rx="9" fill="#22c55e" />
        <path d="M17 25h14M24 18v14" stroke="white" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "zerion") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden="true">
        <rect x="9" y="9" width="30" height="30" rx="9" fill="#3b82f6" />
        <path d="M16 17h16l-9 14h9" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon === "walletconnect") {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden="true">
        <path d="M9 21c8-8 22-8 30 0l-5 5c-5-5-15-5-20 0l-5-5Z" fill="#38bdf8" />
        <path d="M16 28c4-4 12-4 16 0l-4 4c-2-2-6-2-8 0l-4-4Z" fill="#67e8f9" />
      </svg>
    );
  }

  return <WalletCards className="h-7 w-7" aria-hidden="true" />;
}

function openFallback(href?: string) {
  return openSafeExternalBrowserWindow(href, { profile: "wallet_install" });
}

function FeaturedWalletCard({ option, recommendedLabel }: { option: DrawerWalletOption; recommendedLabel: string; key?: string }) {
  const handleClick = () => {
    if (!option.available && openFallback(option.fallbackHref)) return;
    void option.action();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group grid min-h-[4.85rem] w-full grid-cols-[3.3rem_minmax(0,1fr)_0.9rem] items-center gap-3.5 rounded-[1.12rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.028))] px-3.5 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-300 hover:border-white/[0.16] hover:bg-white/[0.065] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-velmere-gold/[0.24]"
    >
      <span className="grid h-[2.85rem] w-[2.85rem] place-items-center rounded-[0.9rem] border border-white/[0.085] bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <WalletGlyph icon={option.icon} />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5">
          <strong className="font-sans text-[0.98rem] tracking-[-0.018em] text-white/[0.92]">{option.label}</strong>
          <span className="rounded-full border border-velmere-gold/[0.18] bg-velmere-gold/[0.08] px-2 py-1 font-mono text-[0.39rem] font-black uppercase tracking-[0.14em] text-velmere-gold/[0.86]">
            {recommendedLabel}
          </span>
        </span>
        <span className="mt-1.5 block max-w-[11.25rem] text-[10.5px] leading-[1.1rem] text-white/[0.5]">{option.description}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-white/[0.38] transition duration-300 group-hover:translate-x-0.5 group-hover:text-velmere-gold" />
    </button>
  );
}

function OtherWalletRow({ option, index, visible }: { option: DrawerWalletOption; index: number; visible: boolean; key?: string }) {
  const handleClick = () => {
    if (!option.available && openFallback(option.fallbackHref)) return;
    void option.action();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{ transitionDelay: visible ? `${120 + index * 85}ms` : `0ms` }}
      className={`group grid min-h-[2.96rem] w-full grid-cols-[2.5rem_minmax(0,1fr)_0.85rem] items-center gap-2.5 rounded-[0.92rem] border border-white/[0.075] bg-white/[0.035] px-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-[320ms] ease-out hover:border-white/[0.15] hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-velmere-gold/[0.20] ${visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
    >
      <span className="grid h-[2.2rem] w-[2.2rem] place-items-center rounded-[0.76rem] border border-white/[0.08] bg-white/[0.04]">
        <WalletGlyph icon={option.icon} />
      </span>
      <strong className="truncate text-[0.9rem] font-medium tracking-[-0.012em] text-white/[0.9]">{option.label}</strong>
      <ChevronRight className="h-4 w-4 text-white/[0.38] transition duration-300 group-hover:translate-x-0.5 group-hover:text-velmere-gold" />
    </button>
  );
}

export default function WalletConnectDrawer({ onClose, onExpansionChange }: WalletConnectDrawerProps) {
  const locale = useLocale();
  const resolvedLocale = (locale.startsWith("pl") ? "pl" : locale.startsWith("de") ? "de" : "en") as "en" | "pl" | "de";
  const t = copy[resolvedLocale];
  const wallet = useWalletConnect();
  const walletUi = useWalletUiStore();
  const securitySlides = securitySlidesByLocale[resolvedLocale];

  const [securityIndex, setSecurityIndex] = useState(0);
  const [otherWalletsRequested, setOtherWalletsRequested] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [otherWalletsVisible, setOtherWalletsVisible] = useState(false);

  useEffect(() => {
    onExpansionChange?.(drawerExpanded);
  }, [drawerExpanded, onExpansionChange]);

  useEffect(() => {
    if (!walletUi.connected) return undefined;
    const frame = window.requestAnimationFrame(() => {
      setOtherWalletsRequested(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [walletUi.connected]);

  useEffect(() => {
    if (otherWalletsRequested) {
      const id = window.setTimeout(() => setOtherWalletsVisible(true), 255);
      return () => window.clearTimeout(id);
    }

    const frame = window.requestAnimationFrame(() => setOtherWalletsVisible(false));
    const id = window.setTimeout(() => setDrawerExpanded(false), 170);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(id);
    };
  }, [otherWalletsRequested]);

  const toggleOtherWallets = () => {
    const requested = !otherWalletsRequested;
    setOtherWalletsRequested(requested);
    if (requested) setDrawerExpanded(true);
  };

  useEffect(() => {
    return () => {
      onExpansionChange?.(false);
    };
  }, [onExpansionChange]);

  useEffect(() => {
    if (walletUi.connected) return;
    const id = window.setInterval(() => {
      setSecurityIndex((current: number) => (current + 1) % securitySlides.length);
    }, 3400);
    return () => window.clearInterval(id);
  }, [securitySlides.length, walletUi.connected]);

  const primaryOptions: DrawerWalletOption[] = useMemo(
    () => [
      {
        key: "metamask",
        label: "MetaMask",
        icon: "metamask",
        description: "Connect using the world’s most popular Ethereum wallet.",
        action: wallet.connectMetaMask,
        available: wallet.detectedWallets.metamask,
        fallbackHref: "https://metamask.io/download/",
      },
      {
        key: "phantom",
        label: "Phantom",
        icon: "phantom",
        description: "Connect on Solana with a fast and secure experience.",
        action: wallet.connectPhantom,
        available: wallet.detectedWallets.phantom,
        fallbackHref: "https://phantom.app/download",
      },
    ],
    [wallet.connectMetaMask, wallet.connectPhantom, wallet.detectedWallets.metamask, wallet.detectedWallets.phantom],
  );

  const otherOptions: DrawerWalletOption[] = useMemo(
    () => [
      { key: "trust", label: "Trust Wallet", icon: "trust", action: wallet.connectWalletConnect, available: wallet.detectedWallets.walletconnect, fallbackHref: "https://trustwallet.com/" },
      { key: "coinbase", label: "Coinbase Wallet", icon: "coinbase", action: wallet.connectWalletConnect, available: wallet.detectedWallets.walletconnect, fallbackHref: "https://www.coinbase.com/wallet/downloads" },
      { key: "rainbow", label: "Rainbow", icon: "rainbow", action: wallet.connectWalletConnect, available: wallet.detectedWallets.walletconnect, fallbackHref: "https://rainbow.me/" },
      { key: "okx", label: "OKX Wallet", icon: "okx", action: wallet.connectWalletConnect, available: wallet.detectedWallets.walletconnect, fallbackHref: "https://www.okx.com/web3" },
      { key: "ledger", label: "Ledger Live", icon: "ledger", action: wallet.connectWalletConnect, available: wallet.detectedWallets.walletconnect, fallbackHref: "https://www.ledger.com/ledger-live" },
      { key: "safe", label: "Safe", icon: "safe", action: wallet.connectWalletConnect, available: wallet.detectedWallets.walletconnect, fallbackHref: "https://app.safe.global/" },
      { key: "zerion", label: "Zerion", icon: "zerion", action: wallet.connectWalletConnect, available: wallet.detectedWallets.walletconnect, fallbackHref: "https://zerion.io/" },
    ],
    [wallet.connectWalletConnect, wallet.detectedWallets.walletconnect],
  );

  const connectWalletConnect = () => {
    if (!wallet.detectedWallets.walletconnect && openFallback("https://walletconnect.com/")) return;
    void wallet.connectWalletConnect();
  };

  const activeSlide = securitySlides[securityIndex] ?? securitySlides[0];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_10%_0%,rgba(255,255,255,0.06),transparent_30%),radial-gradient(circle_at_15%_18%,rgba(203,171,107,0.1),transparent_28%),radial-gradient(circle_at_100%_8%,rgba(95,136,215,0.08),transparent_30%),linear-gradient(135deg,#20252d_0%,#171b22_42%,#0d1015_100%)]" data-pass3401-wallet-identity-not-payment="server-entitlement-required" data-pass3401-wallet-drawer-provider-coverage="metamask-phantom-walletconnect-other" data-pass3501-wallet-identity-not-payment={PASS3501_WALLET_IDENTITY_NOT_PAYMENT} data-pass3701-wallet-identity-not-payment="server-entitlement-required" data-pass3703-wallet-paid-depth="blocked-without-server-receipt" data-pass4137-wallet-overlay-mobile-safe-area="wallet-drawer-readonly-scroll-click-safe">
      <header className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4 max-md:px-5 max-md:py-4">
        <h2 className="font-mono text-[0.83rem] font-black uppercase tracking-[0.32em] text-white/[0.92]">{t.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/[0.62] transition duration-300 hover:border-white/[0.18] hover:bg-white/[0.055] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-velmere-gold/[0.25]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 luxury-scrollbar lg:overflow-y-hidden max-md:px-5 max-md:py-4">
        <section className="max-w-[24.75rem] shrink-0">
          <p className="font-mono text-[0.61rem] font-black uppercase tracking-[0.26em] text-velmere-gold/[0.88]">{t.step}</p>
          <h3 className="mt-2.5 font-serif text-[1.76rem] leading-[0.96] tracking-[-0.045em] text-white max-md:text-[1.5rem]">
            {walletUi.connected ? t.connectedTitle : t.heroTitle}
          </h3>
          <p className="mt-2 max-w-[22.75rem] text-[0.89rem] leading-[1.5rem] text-white/[0.58] max-md:text-sm max-md:leading-6">
            {walletUi.connected ? t.connectedBody : t.heroBody}
          </p>
          <div
            className="hidden"
            aria-hidden="true"
            data-pass2560-wallet-customer-debug-rail-hidden="true"
            data-pass2561-customer-debug-metadata-hidden="true"
          />
        </section>

        {walletUi.connected ? (
          <section className="mt-5 rounded-[1.35rem] border border-white/[0.09] bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="flex items-start gap-4">
              <span className="grid h-[3rem] w-[3rem] place-items-center rounded-2xl border border-emerald-300/[0.18] bg-emerald-300/[0.075] text-emerald-100">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-emerald-100/[0.74]">{walletUi.walletLabel}</p>
                <p className="mt-2 break-all text-sm leading-6 text-white/[0.76]">{walletUi.fullAddress}</p>
                <p className="mt-2 text-xs leading-5 text-white/[0.45]">{walletUi.network} · {walletUi.tokenBalanceLabel}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => wallet.disconnect()}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-300/[0.18] bg-red-300/[0.055] px-5 font-mono text-[0.65rem] font-black uppercase tracking-[0.18em] text-red-100/[0.82] transition hover:border-red-200/[0.28] hover:bg-red-300/[0.09]"
            >
              <Unplug className="h-4 w-4" aria-hidden="true" />
              {t.disconnect}
            </button>
          </section>
        ) : (
          <div className={`mt-4 flex min-h-0 ${drawerExpanded ? "items-stretch gap-3.5" : "items-start justify-center gap-0"}`}>
            <section className={`relative flex min-w-0 flex-col rounded-[1.42rem] border border-white/[0.10] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.028))] p-[0.9rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_70px_rgba(0,0,0,0.28)] ${drawerExpanded ? "min-h-[33.2rem] flex-1" : "left-1/2 min-h-[31.8rem] w-[105%] max-w-[105%] -translate-x-1/2"}`}>
              <div className="space-y-2.5">
                {primaryOptions.map((option) => (
                  <FeaturedWalletCard key={option.key} option={option} recommendedLabel={t.recommended} />
                ))}
              </div>

              <div className="mt-3">
                <p className="font-mono text-[0.59rem] font-black uppercase tracking-[0.24em] text-velmere-gold/[0.84]">{t.otherKicker}</p>
                <button
                  type="button"
                  onClick={toggleOtherWallets}
                  className="group mt-2.5 grid min-h-[3.8rem] w-full grid-cols-[2.75rem_minmax(0,1fr)_1rem] items-center gap-3 rounded-[1.02rem] border border-white/[0.08] bg-black/[0.16] px-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition duration-300 hover:border-white/[0.16] hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-velmere-gold/[0.20]"
                >
                  <span className="grid h-[2.2rem] w-[2.2rem] place-items-center rounded-[0.84rem] border border-white/[0.08] bg-white/[0.05] text-white">
                    <Grid2X2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <strong className="block text-[0.99rem] font-medium tracking-[-0.015em] text-white/[0.88]">{t.otherTitle}</strong>
                    <small className="mt-1 block text-[11.5px] text-white/[0.42]">{t.otherBody}</small>
                  </span>
                  <ChevronRight className={`h-4 w-4 text-white/[0.36] transition-all duration-300 ${otherWalletsRequested ? "translate-x-0 rotate-90 text-velmere-gold" : "group-hover:translate-x-0.5 group-hover:text-velmere-gold"}`} />
                </button>
              </div>

              <div className="mt-auto rounded-[1.08rem] border border-white/[0.08] bg-white/[0.035] p-[0.9rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
                <div className="flex items-start gap-2.5">
                  <span className="grid h-[2.2rem] w-[2.2rem] shrink-0 place-items-center rounded-[0.9rem] border border-velmere-gold/[0.18] bg-velmere-gold/[0.08] text-velmere-gold">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.8rem] font-semibold text-white/[0.86]">{activeSlide.title}</p>
                    <p className="mt-1 text-[10px] leading-[1rem] text-white/[0.48]">{activeSlide.body}</p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2 pl-[2.55rem] pb-[0.02rem]" aria-label="Security information slides">
                  {securitySlides.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-label={`Security slide ${index + 1}`}
                      onClick={() => setSecurityIndex(index)}
                      className={`h-2.5 w-2.5 rounded-full transition ${index === securityIndex ? "bg-velmere-gold" : "bg-white/[0.12] hover:bg-white/[0.22]"}`}
                    />
                  ))}
                </div>
              </div>
            </section>

            <div
              className={`min-h-0 overflow-hidden transition-[width] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${drawerExpanded ? "w-[19.5rem]" : "w-0"}`}
            >
              <section
                className={`flex h-full min-h-[23.5rem] w-[19.5rem] flex-col rounded-[1.42rem] border border-white/[0.10] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.028))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_70px_rgba(0,0,0,0.28)] transition-[opacity,transform] duration-[520ms] ease-out ${otherWalletsVisible ? "translate-x-0 opacity-100" : "translate-x-5 opacity-0 pointer-events-none"}`}
              >
                <div className="pb-1.5">
                  <p className="font-mono text-[0.59rem] font-black uppercase tracking-[0.24em] text-white/[0.64]">{t.otherTitle}</p>
                </div>

                <div className="grid gap-[0.46rem]">
                  {otherOptions.map((option, index) => (
                    <OtherWalletRow key={option.key} option={option} index={index} visible={otherWalletsVisible} />
                  ))}
                </div>

                <div className="mt-auto pt-2.5">
                  <p className="text-[11px] font-semibold text-velmere-gold/[0.84]">{t.missingTitle}</p>
                  <p className="mt-1 text-[10.5px] leading-[1rem] text-white/[0.42]">{t.missingBody}</p>
                  <button
                    type="button"
                    onClick={connectWalletConnect}
                    className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-full border border-velmere-gold/[0.22] bg-velmere-gold/[0.06] px-4 font-mono text-[0.56rem] font-black uppercase tracking-[0.16em] text-white/[0.90] transition duration-300 hover:border-velmere-gold/[0.36] hover:bg-velmere-gold/[0.11]"
                  >
                    <WalletGlyph icon="walletconnect" />
                    {t.walletConnect}
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export const PASS3807_WALLET_NONCE_REPLAY_MARKER = "data-pass3807-wallet-nonce-replay";

// PASS3901-4000 wallet marker: wallet connect is identity only, never a paid entitlement receipt.
export const PASS3901_WALLET_IDENTITY_ONLY_MARKER = "wallet-identity-not-payment-prepared";

export const PASS4001_WALLET_RELEASE_BARRIER_MARKER = "wallet-identity-only-nonce-replay-required-pass4100";
