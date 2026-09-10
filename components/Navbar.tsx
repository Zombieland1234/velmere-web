"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Globe2,
  LogOut,
  Map as MapIcon,
  Menu,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Unplug,
  User,
  Wallet,
  X,
} from "lucide-react";
import { useLocale } from "next-intl";
import { Link, usePathname } from "@/navigation";
import { useCart } from "@/components/CartProvider";
import {
  clearWalletUiSnapshot,
  useWalletUiStore,
} from "@/store/useWalletUiStore";
import WalletConnectDrawer from "@/components/wallet/WalletConnectDrawer";
import {
  deleteVelmereAccountSession,
  useVelmereAuth,
} from "@/components/auth/AuthGate";
import { useProfile } from "@/lib/hooks/useProfile";
import type { ProfileRecord } from "@/lib/db/profile-service";
import { DrawerRoot, DropdownRoot } from "@/components/ui/OverlayPrimitives";
import { pass628LayerStyle } from "@/lib/ui/pass628-overlay-constitution";

const LOCALES = ["en", "pl", "de"] as const;

const navLabels = {
  en: {
    collection: "Shop",
    atelier: "Atelier",
    men: "Men's collection",
    women: "Women's collection",
    square: "Square",
    lookbook: "Lookbook",
    community: "Community",
    support: "Support",
    login: "Login",
    contact: "Contact",
    shield: "Shield",
    shieldPro: "SHIELD PRO",
    realMarkets: "REAL MARKETS",
    research: "Research Lab",
    security: "Security",
    audits: "Audit",
    auditBrowser: "Browser",
  },
  pl: {
    collection: "Sklep",
    atelier: "Atelier",
    men: "Kolekcja męska",
    women: "Kolekcja damska",
    square: "Square",
    lookbook: "Lookbook",
    community: "Społeczność",
    support: "Pomoc",
    login: "Logowanie",
    contact: "Kontakt",
    shield: "Shield",
    shieldPro: "SHIELD PRO",
    realMarkets: "REAL MARKETS",
    research: "Laboratorium analiz",
    security: "Bezpieczeństwo",
    audits: "Audyt",
    auditBrowser: "Browser",
  },
  de: {
    collection: "Shop",
    atelier: "Atelier",
    men: "Herrenkollektion",
    women: "Damenkollektion",
    square: "Square",
    lookbook: "Lookbook",
    community: "Community",
    support: "Support",
    login: "Login",
    contact: "Kontakt",
    shield: "Shield",
    shieldPro: "SHIELD PRO",
    realMarkets: "REAL MARKETS",
    research: "Analyselabor",
    security: "Sicherheit",
    audits: "Audit",
    auditBrowser: "Browser",
  },
} as const;

const navCopy = {
  en: {
    account: "Account",
    login: "Login",
    privateConsole: "Private member area",
    consoleShort: "Console",
    memberLabel: "Member",
    walletPending: "wallet pending",
    connect: "Connect",
    menu: "Menu",
    wallet: "Wallet",
    optionalWallet:
      "Optional wallet connection. Every action stays clearly named and confirmed in your wallet.",
    disconnect: "Disconnect wallet",
    logout: "Log out",
    memberConsole: "Private member area",
    noWalletConnected: "No wallet connected",
    walletConnected: "Wallet connected",
    close: "Close wallet",
    closeMenu: "Close menu",
    walletSafetyTitle: "Wallet boundary",
    walletSafetyBody:
      "Read-only connection. Velmère never asks for private keys or seed phrases.",
    legalTitle: "Legal",
    languageTitle: "Language",
    openMenu: "Open menu",
    primaryNavigation: "Primary navigation",
    marketNavigation: "Market navigation",
    home: "Velmère home",
    changeLanguage: "Change language",
    openCart: "Open cart",
    menuNavigation: "Menu navigation",
    marketSystems: "VELMÈRE MARKET SYSTEMS",
    sourceBoundIntelligence: "SOURCE-BOUND INTELLIGENCE",
  },
  pl: {
    account: "Konto",
    login: "Logowanie",
    privateConsole: "Prywatna strefa użytkownika",
    consoleShort: "Konsola",
    memberLabel: "Użytkownik",
    walletPending: "portfel niepodłączony",
    connect: "Połącz",
    menu: "Menu",
    wallet: "Portfel",
    optionalWallet:
      "Opcjonalne połączenie portfela. Każda akcja jest nazwana i potwierdzana bezpośrednio w portfelu.",
    disconnect: "Odłącz portfel",
    logout: "Wyloguj",
    memberConsole: "Prywatna strefa użytkownika",
    noWalletConnected: "Portfel niepodłączony",
    walletConnected: "Portfel połączony",
    close: "Zamknij portfel",
    closeMenu: "Zamknij menu",
    walletSafetyTitle: "Granica portfela",
    walletSafetyBody:
      "Połączenie tylko do odczytu. Velmère nigdy nie prosi o klucze prywatne ani frazę odzyskiwania.",
    legalTitle: "Dokumenty",
    languageTitle: "Język",
    openMenu: "Otwórz menu",
    primaryNavigation: "Nawigacja główna",
    marketNavigation: "Nawigacja rynkowa",
    home: "Strona główna Velmère",
    changeLanguage: "Zmień język",
    openCart: "Otwórz koszyk",
    menuNavigation: "Nawigacja menu",
    marketSystems: "SYSTEMY RYNKOWE VELMÈRE",
    sourceBoundIntelligence: "ANALIZA OPARTA NA ŹRÓDŁACH",
  },
  de: {
    account: "Konto",
    login: "Login",
    privateConsole: "Privater Member-Bereich",
    consoleShort: "Konsole",
    memberLabel: "Mitglied",
    walletPending: "Wallet nicht verbunden",
    connect: "Verbinden",
    menu: "Menü",
    wallet: "Wallet",
    optionalWallet:
      "Optionale Wallet-Verbindung. Jede Aktion wird klar benannt und direkt im Wallet bestätigt.",
    disconnect: "Wallet trennen",
    logout: "Ausloggen",
    memberConsole: "Privater Member-Bereich",
    noWalletConnected: "Wallet nicht verbunden",
    walletConnected: "Wallet verbunden",
    close: "Wallet schließen",
    closeMenu: "Menü schließen",
    walletSafetyTitle: "Wallet-Grenze",
    walletSafetyBody:
      "Nur-Lese-Verbindung. Velmère fragt nie nach Private Keys oder Seed Phrases.",
    legalTitle: "Rechtliches",
    languageTitle: "Sprache",
    openMenu: "Menü öffnen",
    primaryNavigation: "Hauptnavigation",
    marketNavigation: "Marktnavigation",
    home: "Velmère Startseite",
    changeLanguage: "Sprache ändern",
    openCart: "Warenkorb öffnen",
    menuNavigation: "Menünavigation",
    marketSystems: "VELMÈRE MARKTSYSTEME",
    sourceBoundIntelligence: "QUELLENGEBUNDENE ANALYSE",
  },
} as const;

const legalLinksByLocale = {
  en: [
    { href: "/impressum", label: "Impressum / Legal Notice" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms" },
    { href: "/returns", label: "Returns / Right of Withdrawal" },
    { href: "/shipping", label: "Shipping" },
    { href: "/contact", label: "Contact" },
  ],
  pl: [
    { href: "/impressum", label: "Impressum / dane sprzedawcy" },
    { href: "/privacy", label: "Polityka prywatności" },
    { href: "/terms", label: "Regulamin" },
    { href: "/returns", label: "Zwroty / prawo odstąpienia" },
    { href: "/shipping", label: "Dostawa" },
    { href: "/contact", label: "Kontakt" },
  ],
  de: [
    { href: "/impressum", label: "Impressum / Anbieterangaben" },
    { href: "/privacy", label: "Datenschutzerklärung" },
    { href: "/terms", label: "AGB" },
    { href: "/returns", label: "Rückgabe / Widerrufsrecht" },
    { href: "/shipping", label: "Versand" },
    { href: "/contact", label: "Kontakt" },
  ],
} as const;

function truncateAddress(value: string) {
  if (!value) return "Connect";
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

export default function Navbar() {
  const locale = useLocale();
  const pathname = usePathname();
  const { itemCount, isOpen: cartOpen, openCart, closeCart } = useCart();
  const walletUi = useWalletUiStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletDrawerExpanded, setWalletDrawerExpanded] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const headerSurfaceTicketRef = useRef(0);
  const walletButtonRef = useRef<HTMLButtonElement | null>(null);
  const languageButtonRef = useRef<HTMLButtonElement | null>(null);
  const memberButtonRef = useRef<HTMLButtonElement | null>(null);
  const { ready: authReady, authenticated, localProfile } = useVelmereAuth();
  const fallbackProfile = useMemo<ProfileRecord>(
    () => ({
      displayName: "Velmère Member",
      handle: "velmere.member",
      bio: "",
      lastNameChange: "2026-05-01T00:00:00.000Z",
    }),
    [],
  );
  const { data: profileData } = useProfile(
    fallbackProfile,
    authReady && authenticated,
  );

  const closeHeaderSurfaces = useCallback(() => {
    headerSurfaceTicketRef.current += 1;
    setMenuOpen(false);
    setWalletOpen(false);
    setWalletDrawerExpanded(false);
    setLanguageOpen(false);
    setMemberOpen(false);
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  useEffect(() => {
    closeHeaderSurfaces();
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const timer = window.setTimeout(() => {
      closeHeaderSurfaces();
      if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [closeHeaderSurfaces, pathname]);

  useEffect(() => {
    const closeHeaderOverlays = closeHeaderSurfaces;
    const onOpenWallet = () => {
      closeCart();
      setMenuOpen(false);
      setLanguageOpen(false);
      setMemberOpen(false);
      setWalletDrawerExpanded(false);
      setWalletOpen(true);
    };
    const onOverlayOpening = (event: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as {
              kind?: string;
              surfaceId?: string;
              surface?: string;
            })
          : null;
      if (!detail) return;
      if (
        detail.kind === "modal" ||
        (detail.kind === "drawer" &&
          detail.surfaceId !== "velmere-main-menu-drawer" &&
          detail.surfaceId !== "velmere-other-wallets-drawer" &&
          detail.surfaceId !== "velmere-header-wallet-menu")
      ) {
        closeHeaderSurfaces();
      }
    };
    const onCloseWallet = () => { setWalletDrawerExpanded(false); setWalletOpen(false); };
    window.addEventListener("velmere:open-wallet", onOpenWallet);
    window.addEventListener("velmere:close-wallet", onCloseWallet);
    window.addEventListener("velmere:close-header-surfaces", closeHeaderOverlays);
    window.addEventListener("velmere:cart-opening", closeHeaderOverlays);
    window.addEventListener("velmere:overlay-opening", onOverlayOpening);
    return () => {
      window.removeEventListener("velmere:open-wallet", onOpenWallet);
      window.removeEventListener("velmere:close-wallet", onCloseWallet);
      window.removeEventListener("velmere:close-header-surfaces", closeHeaderOverlays);
      window.removeEventListener("velmere:cart-opening", closeHeaderOverlays);
      window.removeEventListener("velmere:overlay-opening", onOverlayOpening);
    };
  }, [closeCart, closeHeaderSurfaces]);


  useEffect(() => {
    if (!walletOpen) return undefined;
    document.documentElement.dataset.velmereWalletOpen = "true";
    return () => {
      delete document.documentElement.dataset.velmereWalletOpen;
    };
  }, [walletOpen]);

  const t = navCopy[locale as keyof typeof navCopy] ?? navCopy.en;
  const labels = navLabels[locale as keyof typeof navLabels] ?? navLabels.en;
  const walletLabel = walletUi.connected
    ? truncateAddress(walletUi.fullAddress)
    : t.connect;
  const isMemberActive = authReady && authenticated;
  const profile = profileData?.profile ?? fallbackProfile;
  const memberDisplayName = localProfile?.displayName ?? profile.displayName;
  const accountLabel = isMemberActive ? t.account : t.login;

  const disconnectWallet = () => {
    clearWalletUiSnapshot();
    setMemberOpen(false);
  };

  const logoutMember = () => {
    clearWalletUiSnapshot();
    setMemberOpen(false);
    void deleteVelmereAccountSession();
  };

  const openExclusiveHeaderSurface = useCallback(
    (surface: "menu" | "language" | "wallet" | "account" | "cart") => {
      const alreadyOpen =
        (surface === "menu" && menuOpen) ||
        (surface === "language" && languageOpen) ||
        (surface === "wallet" && walletOpen) ||
        (surface === "account" && memberOpen) ||
        (surface === "cart" && cartOpen);
      const ticket = headerSurfaceTicketRef.current + 1;
      headerSurfaceTicketRef.current = ticket;

      // PASS1988: header triggers are toggles, not one-way openers. This
      // prevents a visible backdrop/panel from feeling stuck when the user
      // taps the same icon again, while still keeping every surface exclusive.
      if (alreadyOpen) {
        setMenuOpen(false);
        setLanguageOpen(false);
        setWalletOpen(false);
        setWalletDrawerExpanded(false);
        setMemberOpen(false);
        if (surface === "cart") closeCart();
        return;
      }

      if (surface !== "cart") closeCart();

      // PASS1982: one synchronous state commit only. Previous passes used
      // requestAnimationFrame + timeout hard-open confirmations; they fixed
      // hidden panels but also created stale delayed work and visible lag.
      // OverlayPrimitives now owns outside-click/escape, so header surfaces
      // can open cleanly without delayed replays.
      if (headerSurfaceTicketRef.current !== ticket) return;
      setMenuOpen(surface === "menu");
      setLanguageOpen(surface === "language");
      setWalletDrawerExpanded(false);
      setWalletOpen(surface === "wallet");
      setMemberOpen(surface === "account");

      if (surface === "cart") {
        openCart();
      }
    },
    [cartOpen, closeCart, languageOpen, memberOpen, menuOpen, openCart, walletOpen],
  );

  const closeMenuPanel = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const activeLocale: (typeof LOCALES)[number] = LOCALES.includes(locale as (typeof LOCALES)[number])
    ? (locale as (typeof LOCALES)[number])
    : "pl";
  const legalLinks = legalLinksByLocale[activeLocale];
  const localizedAccountHref = `/${activeLocale}/account`;
  const localizedLoginHref = `/${activeLocale}/login`;
  const languageMenuId = "velmere-header-language-menu";
  const walletMenuId = "velmere-header-wallet-menu";
  const accountMenuId = "velmere-header-account-menu";
  const isAuditHeader = Boolean(
    pathname === "/security/audits" || pathname?.startsWith("/security/audits/"),
  );

  const desktopPrimaryLinks = [
      { href: "/security/audits", label: "AUDIT" },
      { href: "/search", label: "BROWSER" },
      { href: "/intelligence", label: "INTELLIGENCE" },
      { href: "/atelier", label: "ATELIER" },
    ];
  const marketLinks = [
    {
      href: "/market-integrity",
      label: "Velmère Shield",
      eyebrow: "CORE 01",
      description:
        activeLocale === "pl"
          ? "Integralność rynku i ryzyko aktywów"
          : activeLocale === "de"
            ? "Marktintegrität und Asset-Risiko"
            : "Market integrity and asset risk",
      icon: ShieldCheck,
    },
    {
      href: "/shield-pro",
      label: "Shield Pro",
      eyebrow: activeLocale === "pl" ? "WKRÓTCE" : activeLocale === "de" ? "DEMNÄCHST" : "COMING SOON",
      description:
        activeLocale === "pl"
          ? "Przebudowa architektury nowej generacji"
          : activeLocale === "de"
            ? "Neubau der nächsten Generation"
            : "Next-generation architecture rebuild",
      icon: Activity,
    },
    {
      href: "/real-markets",
      label: "Real Markets",
      eyebrow: "REFERENCE 03",
      description:
        activeLocale === "pl"
          ? "Podgląd międzyrynkowy — dane live niepotwierdzone"
          : activeLocale === "de"
            ? "Asset-übergreifende Vorschau — Live-Daten nicht belegt"
            : "Cross-asset preview — live data not proven",
      icon: BarChart3,
    },
    {
      href: "/shield-map",
      label: "Shield Map",
      eyebrow: "MAP 04",
      description:
        activeLocale === "pl"
          ? "Mapa relacji, przepływów i dowodów"
          : activeLocale === "de"
            ? "Karte für Beziehungen und Evidenz"
            : "Relationship, flow and evidence map",
      icon: MapIcon,
    },
    {
      href: "/risk-management",
      label: "Risk Management",
      eyebrow: "METHOD 05",
      description:
        activeLocale === "pl"
          ? "Architektura i metodologia pomiaru ryzyka"
          : activeLocale === "de"
            ? "Risikomanagement und Methodik-Architektur"
            : "Risk measurement architecture and methodology",
      icon: Shield,
    },
    {
      href: "/verified-audits",
      label: "Verified Audits",
      eyebrow: "REGISTRY 06",
      description:
        activeLocale === "pl"
          ? "Rejestr audytów z dynamiczną detekcją zmian kodu"
          : activeLocale === "de"
            ? "Verifizierte Audits mit Codeänderungserkennung"
            : "Audit registry with dynamic code-change detection",
      icon: ShieldCheck,
    },
  ];
  const localizedPrimaryLinks = [...desktopPrimaryLinks, ...marketLinks];
  const toLocalizedHref = useCallback(
    (href: string) => {
      if (!href.startsWith("/")) return href;
      if (LOCALES.some((item) => href === `/${item}` || href.startsWith(`/${item}/`))) return href;
      return `/${activeLocale}${href === "/" ? "" : href}`;
    },
    [activeLocale],
  );

  const accountMenuLinks = [
    {
      href: isMemberActive ? localizedAccountHref : localizedLoginHref,
      label: isMemberActive ? t.privateConsole : labels.login,
      id: isMemberActive ? "member-console" : "login",
    },
    { href: localizedAccountHref, label: t.account, id: "account" },
    { href: "/contact", label: labels.contact, id: "contact" },
  ].filter(
    (link, index, list) =>
      index === list.findIndex((candidate) => candidate.href === link.href),
  );
  const isNavLinkActive = useCallback(
    (href: string) => {
      if (!pathname) return false;
      if (href === "/security") return pathname === "/security";
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname],
  );

  const marketNavActive = marketLinks.some((link) => isNavLinkActive(link.href));

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 border-b border-white/[0.075] bg-[#060709]/[0.985] text-velmere-ivory shadow-[0_12px_42px_rgba(0,0,0,0.34)]"
        style={pass628LayerStyle("header")}
        data-pass1734-runtime-cleanliness="popup-cart-minimalism"
        data-current-surface={pathname || "/"}
        data-audit-header={isAuditHeader ? "simplified" : undefined}
      >
        <div
          className="relative mx-auto flex min-h-[68px] w-full max-w-none items-center gap-2 px-3 pt-[env(safe-area-inset-top)] md:h-20 md:gap-3 md:px-8 md:pt-0 xl:px-[4.75rem]"
          data-velmere-header-shell="true"
        >
          {!isAuditHeader ? <div className="velmere-header-left-cluster">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-label={t.openMenu}
              onClick={() => openExclusiveHeaderSurface("menu")}
              className="velmere-command-pill velmere-interaction-pulse relative z-[12] h-10 w-10 shrink-0 px-0 text-[10px] text-white/[0.62] sm:h-11 sm:min-w-[5.6rem] sm:px-4"
              data-velmere-overlay-trigger="header-menu"
              data-testid="velmere-header-menu-trigger"
              data-pass1976-header-trigger="menu-click-to-open"
            >
              <Menu className="h-4 w-4" />
              <span className="hidden sm:inline">{t.menu}</span>
            </button>

            <nav
              aria-label={t.primaryNavigation}
              className="velmere-desktop-nav relative z-[9] hidden min-w-0 items-center gap-1 xl:flex"
            >
              {desktopPrimaryLinks.map((link, linkIndex) => (
                <a
                  key={`desktop:${link.href}:${link.label}:${linkIndex}`}
                  href={toLocalizedHref(link.href)}
                  aria-current={isNavLinkActive(link.href) ? "page" : undefined}
                  onClick={() => {
                    closeHeaderSurfaces();
                  }}
                  className={`pointer-events-auto inline-flex shrink-0 items-center rounded-full px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${isNavLinkActive(link.href) ? "bg-white/[0.07] text-white" : "text-white/[0.5] hover:bg-white/[0.045] hover:text-white"}`}
                  data-header-route={link.href}
                >
                  {link.label}
                </a>
              ))}
              <div className="velmere-market-nav" data-active={marketNavActive || undefined}>
                <button
                  type="button"
                  className="velmere-market-nav-trigger"
                  aria-haspopup="menu"
                  aria-label={t.marketNavigation}
                >
                  <Shield aria-hidden="true" />
                  <span>MARKET</span>
                  <i aria-hidden="true" />
                </button>
                <div className="velmere-market-nav-menu" role="menu" aria-label={t.marketNavigation}>
                  <div className="velmere-market-nav-surface">
                    <div className="velmere-market-nav-head">
                      <span>{t.marketSystems}</span>
                      <em><i aria-hidden="true" /> REFERENCE</em>
                    </div>
                    <div className="velmere-market-nav-list">
                      {marketLinks.map((link) => {
                        const MarketIcon = link.icon;
                        return (
                          <a
                            key={`market:${link.href}`}
                            href={toLocalizedHref(link.href)}
                            role="menuitem"
                            aria-current={isNavLinkActive(link.href) ? "page" : undefined}
                            data-active={isNavLinkActive(link.href) || undefined}
                            onClick={() => {
                              closeHeaderSurfaces();
                              if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
                                document.activeElement.blur();
                              }
                            }}
                          >
                            <span className="velmere-market-nav-icon"><MarketIcon aria-hidden="true" /></span>
                            <span className="velmere-market-nav-copy">
                              <small>{link.eyebrow}</small>
                              <strong>{link.label}</strong>
                              <em>{link.description}</em>
                            </span>
                            <ArrowUpRight className="velmere-market-nav-arrow" aria-hidden="true" />
                          </a>
                        );
                      })}
                    </div>
                    <div className="velmere-market-nav-foot">
                      <span><i aria-hidden="true" /> {t.sourceBoundIntelligence}</span>
                    </div>
                  </div>
                </div>
              </div>
            </nav>
          </div> : null}

          <Link
            href="/"
            aria-label={t.home}
            className="velmere-header-brand-link pointer-events-auto absolute left-1/2 z-[10] -translate-x-1/2 rounded-full px-3 py-2 font-sans text-[1.02rem] font-semibold uppercase tracking-[0.20em] text-white transition hover:text-velmere-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/[0.35] max-[360px]:text-[0.88rem] max-[360px]:tracking-[0.14em] sm:text-[1.28rem] md:text-[1.62rem] xl:text-[1.7rem]"
            data-velmere-header-brand="true"
          >
            VELMÈRE
          </Link>

          <div
            className="velmere-header-actions relative z-[12] ml-auto flex shrink-0 items-center justify-end gap-1.5 md:gap-2"
            data-velmere-header-actions="true"
          >
            <div className="relative hidden sm:block">
              <button
                ref={languageButtonRef}
                type="button"
                aria-expanded={languageOpen}
                aria-controls={languageMenuId}
                aria-haspopup="menu"
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openExclusiveHeaderSurface("language");
                }}
                data-pass1976-header-trigger="language-click-to-open"
                aria-label={t.changeLanguage}
                data-testid="velmere-header-language-trigger"
                data-velmere-overlay-trigger="header-language"
                data-pass1454-header-trigger="language-anchor-bounded"
                data-pass1734-popup-trigger="language-exclusive"
                className="velmere-command-pill velmere-interaction-pulse h-10 gap-1.5 px-2.5 text-white/[0.62] sm:h-11 sm:px-3"
              >
                <Globe2 className="h-4 w-4" />
                <span className="font-mono text-[9px] uppercase tracking-[0.12em]">
                  {locale}
                </span>
              </button>
            </div>

            <div className="relative block">
              <button
                ref={walletButtonRef}
                type="button"
                aria-expanded={walletOpen}
                aria-controls={walletMenuId}
                aria-haspopup="dialog"
                aria-label={t.wallet}
                title={walletLabel}
                onClick={() => openExclusiveHeaderSurface("wallet")}
                data-pass1976-header-trigger="wallet-click-to-open"
                data-testid="velmere-header-wallet-trigger"
                data-velmere-overlay-trigger="header-wallet"
                data-pass1454-header-trigger="wallet-right-drawer"
                data-pass1734-popup-trigger="wallet-drawer-exclusive"
                data-velmere-mobile-wallet-anchor="visible"
                className="velmere-command-pill velmere-interaction-pulse h-10 w-10 shrink-0 gap-2 px-0 text-[9px] text-velmere-gold sm:h-11 sm:w-11 md:w-auto md:px-3"
                data-tone="gold"
              >
                <Wallet className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{walletLabel}</span>
              </button>
            </div>

            <button
              ref={memberButtonRef}
              type="button"
              aria-expanded={memberOpen}
              aria-controls={accountMenuId}
              aria-haspopup="menu"
              aria-label={accountLabel}
              title={accountLabel}
              onClick={() => openExclusiveHeaderSurface("account")}
              data-pass1976-header-trigger="account-click-to-open"
              data-testid="velmere-header-account-trigger"
              data-velmere-overlay-trigger="header-account"
              data-pass1454-header-trigger="account-anchor-bounded"
              data-pass1734-popup-trigger="account-exclusive"
              className={`velmere-command-pill velmere-interaction-pulse h-10 w-10 shrink-0 gap-2 px-0 text-white/[0.62] sm:h-11 sm:w-11 ${isAuditHeader ? "md:w-auto md:px-3" : ""}`}
            >
              <User className="h-4 w-4" />
              {isAuditHeader ? <span className="hidden font-mono text-[9px] uppercase tracking-[0.12em] md:inline">{accountLabel}</span> : null}
            </button>
            {!isAuditHeader ? <Link
              href="/cart"
              aria-label={t.openCart}
              data-testid="velmere-header-cart-trigger"
              data-pass1976-header-trigger="cart-page-link-no-mini-drawer"
              data-pass2293-cart-rule="old-mini-cart-drawer-removed"
              className="velmere-command-pill velmere-interaction-pulse relative h-10 w-10 shrink-0 px-0 text-white/[0.78] sm:h-11 sm:w-11"
              onClick={() => closeHeaderSurfaces()}
            >
              <ShoppingBag className="h-4 w-4" />
              {itemCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-black bg-velmere-gold px-1 text-[10px] font-semibold text-black">
                  {itemCount}
                </span>
              ) : null}
            </Link> : null}
          </div>
        </div>
      </header>

      <DropdownRoot
        id={languageMenuId}
        open={languageOpen}
        onClose={() => setLanguageOpen(false)}
        anchorRef={languageButtonRef}
        ariaLabel={t.changeLanguage}
        width={152}
        align="end"
        surfaceData={{
          surface: "language-selector-anchored",
          pass1734: "popup-visible-bounded",
          pass2002: "solid-no-blur-cyan-focus",
          pass2012: "flat-language-list-no-ring",
        }}
        className="min-w-36 border border-white/[0.085] bg-[#07090c] shadow-[0_18px_60px_rgba(0,0,0,0.62)]"
      >
        {LOCALES.map((item) => (
          <Link
            key={item}
            href={pathname || "/"}
            locale={item}
            onClick={() => {
              setLanguageOpen(false);
              languageButtonRef.current?.focus({ preventScroll: true });
            }}
            role="menuitem"
            className={`border-b border-white/[0.065] px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-[0.18em] transition-colors last:border-b-0 ${locale === item ? "bg-cyan-300/[0.08] text-cyan-50" : "text-white/[0.58] hover:bg-white/[0.035] hover:text-white"}`}
          >
            {item.toUpperCase()}
          </Link>
        ))}
      </DropdownRoot>

      <DrawerRoot
        open={walletOpen}
        motionPreset="right"
        motionDuration={0.42}
        lockScroll={true}
        onClose={() => { setWalletDrawerExpanded(false); setWalletOpen(false); }}
        closeLabel={t.close ?? "Close wallet"}
        ariaLabel={t.wallet}
        surfaceId={walletMenuId}
        surfaceClassName={`velmere-wallet-side-drawer-pass2292 velmere-wallet-side-drawer-pass2293 velmere-wallet-side-drawer-pass2294 velmere-wallet-side-drawer-pass2295 velmere-wallet-side-drawer-pass2297 velmere-wallet-side-drawer-pass4137 fixed bottom-[2cm] right-4 top-[2cm] flex overflow-hidden rounded-[2rem] transition-[width] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] border border-white/[0.105] text-white shadow-[0_34px_140px_rgba(0,0,0,0.82)] max-md:bottom-4 max-md:left-3 max-md:right-3 max-md:top-4 max-md:w-auto ${walletDrawerExpanded ? "w-[min(44.9rem,calc(100vw-2.25rem))]" : "w-[min(30.85rem,calc(100vw-2.25rem))]"}`}
        surfaceData={{
          surface: "wallet-connect-drawer",
          pass1413: "read-only-no-seed",
          pass1734: "right-side-wallet-drawer",
          pass2276: "wallet-selector-restored-metamask-phantom-other",
          pass2292: "screenshot-inspired-slow-right-drawer-rounded-top-bottom-2cm",
          pass2293: "current-mini-cart-removed-connect-wallet-gray-drawer",
          pass2294: "wallet-drawer-1to1-reference-two-column-gray-surface",
          pass2295: "drawer-expands-when-other-wallets-open-fit-without-scroll",
          pass2296: "faster-50-percent-smoother-expand-animation-less-scroll",
          pass2298: "staggered-other-wallet-buttons-bottom-security-fit",
          pass2299: "final-spacing-tighten-no-bottom-cut",
          pass2304: "centered-inner-panel-height-font-width-only",
          pass4137: "wallet-drawer-locks-scroll-safe-area-and-no-click-theft",
        }}
      >
        <WalletConnectDrawer onClose={() => { setWalletDrawerExpanded(false); setWalletOpen(false); }} onExpansionChange={setWalletDrawerExpanded} />
      </DrawerRoot>

      <DropdownRoot
        id={accountMenuId}
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        anchorRef={memberButtonRef}
        ariaLabel={t.account}
        width={356}
        align="end"
        surfaceData={{
          surface: "member-menu",
          pass1734: "popup-visible-bounded",
          pass2002: "solid-no-blur-cyan-focus",
          pass2012: "flat-account-list-no-nested-card",
          pass2203: "premium-member-zone-redesign",
          pass2204: "microinteraction-final-sweep",
        }}
        className="velmere-account-dropdown-pass2201 velmere-account-dropdown-pass2203 velmere-account-dropdown-pass2204 w-[min(22.25rem,calc(100vw-1.5rem))] overflow-hidden border border-white/[0.095] bg-[#06090c] p-0 shadow-[0_34px_110px_rgba(0,0,0,0.78)]"
      >
        <div className="relative overflow-hidden border-b border-white/[0.075] px-5 pb-5 pt-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(212,175,55,0.14),transparent_38%),radial-gradient(circle_at_92%_10%,rgba(34,211,238,0.10),transparent_32%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-velmere-gold/[0.90]">
                 {isMemberActive
                   ? locale === "pl"
                     ? "Strefa Velmère"
                     : locale === "de"
                       ? "Velmère Mitglied"
                       : "Velmère Member"
                   : t.account}
              </p>
              <p className="mt-2 font-serif text-xl sm:text-2xl tracking-[-0.035em] text-white">
                {isMemberActive ? memberDisplayName : t.privateConsole}
              </p>
            </div>
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-cyan-200/[0.14] bg-cyan-300/[0.055] text-cyan-50/[0.82]"
              aria-hidden="true"
            >
              <User className="h-4 w-4" />
            </span>
          </div>
          <p className="relative mt-3 text-xs leading-6 text-white/[0.54]">
            {isMemberActive
              ? walletUi.connected
                ? walletUi.fullAddress
                : t.noWalletConnected
               : locale === "pl" ? "Konto, zamówienia i dostęp są oddzielone od portfela. Logowanie nie wymaga frazy odzyskiwania." : locale === "de" ? "Konto, Bestellungen und Zugang bleiben vom Wallet getrennt. Beim Login wird nie nach der Seed Phrase gefragt." : "Account, orders and access stay separate from wallet actions. Login never asks for a seed phrase."}
          </p>
        </div>
        <div className="grid gap-2 p-2.5">
          <a
            href={isMemberActive ? localizedAccountHref : localizedLoginHref}
            className="velmere-account-action-pass2203"
            role="menuitem"
            onClick={() => setMemberOpen(false)}
          >
            <span className="velmere-account-action-icon-pass2203"><ShieldCheck className="h-4 w-4" /></span>
            <span>
              <strong>{isMemberActive ? t.memberConsole : t.login}</strong>
              <small>{locale === "pl" ? "Prywatna strefa, zamówienia i dostęp." : locale === "de" ? "Private Zone, Bestellungen und Zugang." : "Private zone, orders and access."}</small>
            </span>
          </a>
          <button
            type="button"
            onClick={disconnectWallet}
            disabled={!walletUi.connected}
            className="velmere-account-action-pass2203 disabled:cursor-not-allowed disabled:opacity-45"
            role="menuitem"
          >
            <span className="velmere-account-action-icon-pass2203"><Unplug className="h-4 w-4" /></span>
            <span>
              <strong>{walletUi.connected ? t.disconnect : t.noWalletConnected}</strong>
               <small>{locale === "pl" ? "Portfel jest opcjonalny i działa tylko do odczytu." : locale === "de" ? "Das Wallet bleibt optional und schreibgeschützt." : "Wallet remains optional and read-only."}</small>
            </span>
          </button>
          {isMemberActive ? (
            <button
              type="button"
              onClick={logoutMember}
              className="velmere-account-action-pass2203"
              role="menuitem"
            >
              <span className="velmere-account-action-icon-pass2203"><LogOut className="h-4 w-4" /></span>
              <span>
                <strong>{t.logout}</strong>
                <small>{locale === "pl" ? "Zakończ lokalną sesję Velmère." : locale === "de" ? "Lokale Velmère-Session beenden." : "End the local Velmère session."}</small>
              </span>
            </button>
          ) : null}
        </div>
      </DropdownRoot>

      <DrawerRoot
        open={menuOpen}
        motionPreset="left"
        motionDuration={0.42}
        lockScroll={true}
        onClose={closeMenuPanel}
        closeLabel={t.closeMenu}
        ariaLabel={t.menu}
        surfaceClassName="velmere-command-shell velmere-side-drawer-panel velmere-menu-side-drawer-pass4640 fixed bottom-[2cm] left-4 top-[2cm] flex w-[min(30.85rem,calc(100vw-2.25rem))] flex-col overflow-hidden rounded-[2rem] border border-white/[0.105] text-velmere-ivory shadow-[0_34px_140px_rgba(0,0,0,0.82)] max-md:bottom-4 max-md:left-3 max-md:right-3 max-md:top-4 max-md:w-auto"
        surfaceId="velmere-main-menu-drawer"
        surfaceData={{ surface: "main-menu", pass1734: "exclusive-drawer", pass1999: "scroll-locked-solid-surface", pass2002: "card-links-no-row-lines", pass4640: "wallet-parity-left-drawer", motion: "wallet-parity" }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.10] px-6 py-5">
          <Link
            href="/"
            onClick={closeMenuPanel}
            className="rounded-sm font-sans text-2xl font-semibold uppercase tracking-[0.22em] focus-visible:outline-none focus-visible:text-velmere-gold focus-visible:underline focus-visible:underline-offset-4"
          >
            VELMÈRE
          </Link>
          <button
            type="button"
            aria-label={t.closeMenu}
            onClick={closeMenuPanel}
            className="grid h-11 w-11 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/[0.62] transition duration-300 hover:border-white/[0.18] hover:bg-white/[0.055] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-velmere-gold/[0.25]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          data-modal-scroll-region="true"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] touch-pan-y luxury-scrollbar"
        >
          <p className="velmere-label text-velmere-gold">
            {locale === "pl"
              ? "Katalog Platformy"
              : locale === "de"
                ? "Plattformverzeichnis"
                : "Platform Directory"}
          </p>
          <nav className="mt-4 grid gap-6" aria-label={t.menuNavigation}>
            {[
              {
                title:
                  locale === "pl" ? "GŁÓWNE MODUŁY" : locale === "de" ? "KERNMODULE" : "CORE MODULES",
                links: [
                  ...localizedPrimaryLinks,
                  { href: "/faq", label: labels.support },
                ],
              },
              {
                title:
                  locale === "pl"
                    ? "SPOŁECZNOŚĆ"
                    : locale === "de"
                      ? "COMMUNITY"
                      : "COMMUNITY",
                links: [
                  { href: "/square", label: labels.square },
                  { href: "/community", label: labels.community },
                ],
              },
              {
                title:
                  locale === "pl"
                    ? "BEZPIECZEŃSTWO / ANALIZY"
                    : locale === "de"
                      ? "SICHERHEIT / RESEARCH"
                      : "SECURITY / RESEARCH",
                links: [
                  { href: "/security", label: labels.security },
                  { href: "/security/audits", label: labels.audits },
                  { href: "/research-lab", label: labels.research },
                ],
              },
              {
                title:
                  locale === "pl"
                    ? "KONTO"
                    : locale === "de"
                      ? "KONTO"
                      : "ACCOUNT",
                links: accountMenuLinks,
              },
            ].map((group) => (
              <div key={group.title}>
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-white/[0.35]">
                  {group.title}
                </p>
                <div className="mt-2 grid">
                  {group.links.map((link, linkIndex) => {
                    const stableLinkKey = `${group.title}:${link.href}:${link.label}:${linkIndex}`;
                    const isHardLocaleHref = link.href.startsWith(
                      `/${activeLocale}/`,
                    );
                    const className =
                      "border-b border-white/[0.07] px-1 py-3.5 text-sm font-semibold uppercase tracking-[0.16em] text-white/[0.68] transition-colors last:border-b-0 hover:text-cyan-50 focus-visible:outline-none focus-visible:text-cyan-50";

                    return (
                      <a
                        key={stableLinkKey}
                        href={isHardLocaleHref ? link.href : toLocalizedHref(link.href)}
                        onClick={closeMenuPanel}
                        className={className}
                      >
                        {link.label}
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-8 border-t border-white/[0.08] pt-6">
            <p className="velmere-label text-velmere-gold">
              {t.walletSafetyTitle}
            </p>
            <p className="mt-3 text-xs leading-6 text-white/[0.46]">
              {t.walletSafetyBody}
            </p>
          </div>

          <div className="mt-8">
            <p className="velmere-label text-velmere-gold">{t.legalTitle}</p>
            <div className="mt-4 grid gap-3">
              {legalLinks.map((link, linkIndex) => (
                <Link
                  key={`legal:${link.href}:${link.label}:${linkIndex}`}
                  href={link.href}
                  onClick={closeMenuPanel}
                  className="text-xs uppercase tracking-[0.16em] text-white/[0.44] transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <p className="velmere-label text-velmere-gold">{t.languageTitle}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {LOCALES.map((item) => (
                <Link
                  key={item}
                  href={pathname || "/"}
                  locale={item}
                  onClick={closeMenuPanel}
                  aria-current={locale === item ? "page" : undefined}
                  className={`inline-flex h-10 items-center rounded-full border px-4 text-[11px] uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/[0.30] ${locale === item ? "border-cyan-200/[0.26] text-cyan-100" : "border-white/[0.10] text-white/[0.48] hover:text-white"}`}
                >
                  {item.toUpperCase()}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </DrawerRoot>
    </>
  );
}
