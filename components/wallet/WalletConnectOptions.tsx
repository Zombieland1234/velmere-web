"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CheckCircle2,
  ExternalLink,
  QrCode,
  Search,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { useLocale } from "next-intl";
import { useWalletConnect } from "@/lib/wallet/useWalletConnect";
import { useWalletUiStore } from "@/store/useWalletUiStore";
import { buildPass634WalletConsentBoundary } from "@/lib/security/wallet-consent-boundary";
import BodyPortal from "@/components/ui/BodyPortal";
import { openSafeExternalBrowserWindow } from "@/lib/security/browser-external-navigation";

const copy = {
  en: {
    current: "Current wallet",
    empty: "No wallet connected.",
    safety:
      "Read-only connection. Velmère never asks for seed phrases or private keys.",
    oneOnly: "One wallet at a time. Disconnect before switching.",
    disconnect: "Disconnect wallet",
    extension: "Detected in this browser",
    mobile: "Mobile or QR connection",
    hardware: "Hardware wallet",
    other: "Other wallets",
    otherTitle: "Choose another wallet",
    otherSubtitle: "Choose another wallet (15+ supported)",
    otherBody:
      "Choose the wallet you already use. Available browser wallets connect here; mobile options open their trusted app or website.",
    notInstalled: "Install / open",
    statusReady: "Ready",
    statusPreview: "Open",
    primary: "Recommended",
    openOther: "See all supported wallets",
    closeOther: "Close wallet list",
    installHint:
      "When a wallet is not available in this browser, Velmère opens its official page in a new tab.",
    walletRoutes: "More wallets",
    solanaPreview: "Solana wallet",
    injectedEvm: "Available browser wallet",
    browserWallet: "Browser wallet",
    closeWalletPanel: "Close wallet list",
    readOnlyBadge: "Read-only connection",
    noSignature: "No signature",
    noTransaction: "No transaction",
    noApproval: "No token permission",
    searchPlaceholder: "Search wallets...",
    categoryAll: "All",
    categoryDetected: "Detected",
    categoryExtension: "Browser",
    categoryMobile: "Mobile / QR",
    categoryHardware: "Hardware",
  },
  pl: {
    current: "Aktualny portfel",
    empty: "Portfel nie jest połączony.",
    safety:
      "Połączenie read-only. Velmère nigdy nie prosi o seed phrase ani klucz prywatny.",
    oneOnly: "Jeden portfel naraz. Odłącz obecny portfel przed zmianą.",
    disconnect: "Odłącz portfel",
    extension: "Wykryty w tej przeglądarce",
    mobile: "Połączenie mobilne lub QR",
    hardware: "Portfel sprzętowy",
    other: "Inne portfele",
    otherTitle: "Wybierz inny portfel",
    otherSubtitle: "Wybierz inny portfel (15+ portfeli)",
    otherBody:
      "Wybierz portfel, którego już używasz. Dostępne portfele przeglądarkowe połączą się tutaj, a opcje mobilne otworzą zaufaną aplikację lub stronę.",
    notInstalled: "Zainstaluj / otwórz",
    statusReady: "Gotowe",
    statusPreview: "Otwórz",
    primary: "Polecane",
    openOther: "Zobacz wszystkie portfele",
    closeOther: "Zamknij listę portfeli",
    installHint:
      "Gdy portfel nie jest dostępny w tej przeglądarce, Velmère otworzy jego oficjalną stronę w nowej karcie.",
    walletRoutes: "Więcej portfeli",
    solanaPreview: "Portfel Solana",
    injectedEvm: "Dostępny portfel przeglądarkowy",
    browserWallet: "Portfel przeglądarkowy",
    closeWalletPanel: "Zamknij listę portfeli",
    readOnlyBadge: "Połączenie tylko do odczytu",
    noSignature: "Bez podpisu",
    noTransaction: "Bez transakcji",
    noApproval: "Bez uprawnień do tokenów",
    searchPlaceholder: "Szukaj portfela...",
    categoryAll: "Wszystkie",
    categoryDetected: "Wykryte",
    categoryExtension: "Przeglądarka",
    categoryMobile: "Mobilne / QR",
    categoryHardware: "Sprzętowe",
  },
  de: {
    current: "Aktuelles Wallet",
    empty: "Kein Wallet verbunden.",
    safety:
      "Read-only Verbindung. Velmère fragt nie nach Seed Phrase oder Private Key.",
    oneOnly:
      "Ein Wallet gleichzeitig. Trenne das aktuelle Wallet vor dem Wechsel.",
    disconnect: "Wallet trennen",
    extension: "In diesem Browser erkannt",
    mobile: "Mobile or QR connection",
    hardware: "Hardware-Wallet",
    other: "Weitere Wallets",
    otherTitle: "Weiteres Wallet wählen",
    otherSubtitle: "Weiteres Wallet wählen (15+ Wallets)",
    otherBody:
      "Wähle das Wallet, das du bereits nutzt. Verfügbare Browser-Wallets verbinden sich hier; mobile Optionen öffnen ihre vertrauenswürdige App oder Website.",
    notInstalled: "Installieren / öffnen",
    statusReady: "Bereit",
    statusPreview: "Öffnen",
    primary: "Empfohlen",
    openOther: "Alle Wallets anzeigen",
    closeOther: "Wallet-Liste schließen",
    installHint:
      "Wenn ein Wallet in diesem Browser nicht verfügbar ist, öffnet Velmère dessen offizielle Seite in einem neuen Tab.",
    walletRoutes: "Weitere Wallets",
    solanaPreview: "Solana-Wallet",
    injectedEvm: "Verfügbares Browser-Wallet",
    browserWallet: "Browser-Wallet",
    closeWalletPanel: "Wallet-Liste schließen",
    readOnlyBadge: "Nur-Lese-Verbindung",
    noSignature: "Keine Signatur",
    noTransaction: "Keine Transaktion",
    noApproval: "Keine Token-Berechtigung",
    searchPlaceholder: "Wallet suchen...",
    categoryAll: "Alle",
    categoryDetected: "Erkannt",
    categoryExtension: "Browser",
    categoryMobile: "Mobil / QR",
    categoryHardware: "Hardware",
  },
} as const;

type WalletConnectOptionsProps = {
  compact?: boolean;
  showStatus?: boolean;
  otherPanelSide?: "left" | "right" | "inline";
  affiliateSurfaceId?: string;
};

type WalletOption = {
  key: string;
  label: string;
  icon: string;
  description: string;
  category?: "extension" | "mobile" | "hardware" | "other";
  action: () => Promise<void> | void;
  fallbackHref?: string;
  available?: boolean;
  featured?: boolean;
};

function WalletMark({ icon }: { icon: string }) {
  const common = "h-7 w-7";
  if (icon === "metamask") {
    return (
      <Image
        src="/wallets/metamask.svg"
        alt=""
        width={28}
        height={28}
        className={`${common} object-contain`}
        aria-hidden="true"
        data-pass2028-wallet-real-icon="metamask"
      />
    );
  }
  if (icon === "walletconnect") {
    return (
      <Image
        src="/wallets/walletconnect.svg"
        alt=""
        width={28}
        height={28}
        className={`${common} object-contain`}
        aria-hidden="true"
      />
    );
  }
  if (icon === "coinbase") {
    return (
      <Image
        src="/wallets/coinbase.svg"
        alt=""
        width={28}
        height={28}
        className={`${common} object-contain`}
        aria-hidden="true"
      />
    );
  }
  if (icon === "okx") {
    return (
      <Image
        src="/wallets/okx.svg"
        alt=""
        width={28}
        height={28}
        className={`${common} object-contain`}
        aria-hidden="true"
      />
    );
  }
  if (icon === "rabby") {
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <rect x="6" y="8" width="36" height="32" rx="10" fill="#8B98A5" />
        <circle cx="16" cy="22" r="3.5" fill="#0B0E14" />
        <circle cx="32" cy="22" r="3.5" fill="#0B0E14" />
        <path d="M16 30c3 3 13 3 16 0" stroke="#0B0E14" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  if (icon === "trust") {
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <path d="M24 6l15 6v10c0 10-6 16-15 20C15 38 9 32 9 22V12l15-6Z" fill="#38bdf8" />
        <path d="M24 12v23c6-3 9-7 9-13v-6l-9-4Z" fill="#0ea5e9" />
      </svg>
    );
  }
  if (icon === "rainbow") {
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <path d="M8 36c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="#ff4136" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M12 36c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="#ffdc00" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M16 36c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="#0074d9" strokeWidth="4" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  if (icon === "bitget") {
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <rect width="48" height="48" rx="12" fill="#00f0ff" />
        <path d="M14 24l7 7 13-14" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }
  if (icon === "zerion") {
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <rect width="48" height="48" rx="12" fill="#2962ff" />
        <path d="M14 16h20L14 32h20" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }
  if (icon === "phantom") {
    return (
      <Image
        src="/wallets/phantom.svg"
        alt=""
        width={28}
        height={28}
        className={`${common} object-contain`}
        aria-hidden="true"
        data-pass2028-wallet-real-icon="phantom"
      />
    );
  }
  if (icon === "ledger") {
    return (
      <Image
        src="/wallets/ledger.svg"
        alt=""
        width={28}
        height={28}
        className={`${common} object-contain`}
        aria-hidden="true"
      />
    );
  }
  if (icon === "trezor") {
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <rect x="14" y="10" width="20" height="28" rx="5" fill="#0a84ff" />
        <circle cx="24" cy="20" r="4" fill="#fff" />
        <rect x="22" y="24" width="4" height="8" rx="2" fill="#fff" />
      </svg>
    );
  }
  if (icon === "exodus") {
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <rect width="48" height="48" rx="12" fill="#1b1c31" />
        <path d="M15 14l9 9-9 9m18-18l-9 9 9 9" stroke="#9050e9" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }
  if (icon === "brave") {
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <rect width="48" height="48" rx="12" fill="#fb542b" />
        <circle cx="24" cy="24" r="10" fill="#fff" />
        <circle cx="24" cy="24" r="6" fill="#fb542b" />
      </svg>
    );
  }
  if (icon === "safe") {
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <rect width="48" height="48" rx="12" fill="#12ff80" />
        <path d="M18 20v-4a6 6 0 0 1 12 0v4m-14 0h16v16H16z" stroke="#000" strokeWidth="3" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  if (icon === "uniswap") {
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <rect width="48" height="48" rx="12" fill="#ff007a" />
        <path d="M26 12c-2 4-8 8-10 12-1 2-1 5 1 7 2 2 6 2 8-1 2-3 2-6 4-9 1-2 3-5 5-7-3 0-6-1-8-2z" fill="#fff" />
        <circle cx="34" cy="20" r="3" fill="#fff" />
      </svg>
    );
  }
  if (icon === "1inch") {
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <rect width="48" height="48" rx="12" fill="#1b2839" />
        <path d="M14 34l8-20 4 8 8-4-6 16z" fill="#1e88e5" />
        <path d="M22 14l4 8-8 12z" fill="#d32f2f" />
      </svg>
    );
  }
  if (icon === "backpack") {
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <rect width="48" height="48" rx="12" fill="#e33e38" />
        <path d="M16 18c0-4 4-8 8-8s8 4 8 8v16c0 2-2 4-4 4H20c-2 0-4-2-4-4V18z" fill="#fff" opacity="0.9" />
        <rect x="20" y="24" width="8" height="8" rx="2" fill="#e33e38" />
      </svg>
    );
  }
  if (icon === "kraken") {
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <rect width="48" height="48" rx="12" fill="#5841d8" />
        <circle cx="20" cy="20" r="3" fill="#fff" />
        <circle cx="28" cy="20" r="3" fill="#fff" />
        <path d="M16 26c0 6 4 10 8 10s8-4 8-10" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M20 32v6m8-6v6" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
      <rect x="9" y="13" width="30" height="22" rx="8" fill="currentColor" opacity="0.82" />
      <circle cx="33" cy="24" r="3" fill="#08080a" />
    </svg>
  );
}

function WalletBadge({
  icon,
  label,
  featured = false,
}: {
  icon: string;
  label: string;
  featured?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${
        featured
          ? "border-velmere-gold/[0.35] bg-velmere-gold/[0.14] text-velmere-gold"
          : "border-white/[0.10] bg-white/[0.055] text-white/[0.82]"
      }`}
      title={label}
    >
      <WalletMark icon={icon} />
    </span>
  );
}

function WalletRow({
  option,
  readyLabel,
  previewLabel,
}: {
  option: WalletOption;
  readyLabel: string;
  previewLabel: string;
  key?: string;
}) {
  const runAction = () => {
    if (
      !option.available &&
      option.fallbackHref &&
      typeof window !== "undefined"
    ) {
      if (openSafeExternalBrowserWindow(option.fallbackHref, { profile: "wallet_install" })) return;
      return;
    }
    void option.action();
  };

  return (
    <button
      type="button"
      onClick={runAction}
      className={`velmere-interaction-pulse group grid min-h-[4.5rem] w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${
        option.featured
          ? "border-velmere-gold/[0.30] bg-[linear-gradient(135deg,rgba(200,169,106,0.18),rgba(255,255,255,0.045))] hover:border-velmere-gold/[0.45]"
          : "border-white/[0.10] bg-white/[0.034] hover:border-white/[0.20] hover:bg-white/[0.055]"
      }`}
    >
      <WalletBadge
        icon={option.icon}
        label={option.label}
        featured={option.featured}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-sans text-[0.92rem] font-semibold leading-5 text-white/[0.90] sm:text-[0.98rem]">
            {option.label}
          </span>
          {option.available ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Online
            </span>
          ) : null}
        </span>
        <span className="mt-1 block font-mono text-[9px] uppercase leading-4 tracking-[0.14em] text-white/[0.42]">
          {option.description}
        </span>
      </span>
      <span className="velmere-command-pill w-fit shrink-0 px-2.5 py-1 text-[8px] text-white/[0.42] group-hover:text-velmere-gold">
        {option.available ? (
          <CheckCircle2 className="h-3 w-3 text-velmere-gold" />
        ) : (
          <ExternalLink className="h-3 w-3" />
        )}
        {option.available ? readyLabel : previewLabel}
      </span>
    </button>
  );
}

function WalletConsentNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`grid gap-2 rounded-[1.35rem] border border-emerald-300/[0.16] bg-emerald-300/[0.055] p-3 text-xs leading-5 text-emerald-50/[0.76] ${compact ? "" : "mt-1"}`}
      data-wallet-read-only-warning="visible-before-wallet-choice"
      role="note"
    >
      <span className="inline-flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-100" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-emerald-50">Read-only.</strong>{" "}
          Velmère never asks for private keys, seed phrases, token approvals or transactions during wallet connection.
        </span>
      </span>
    </div>
  );
}

function OtherWalletPanel({
  open,
  onClose,
  title,
  body,
  hint,
  closeLabel,
  options,
  readyLabel,
  previewLabel,
  side = "right",
  affiliateSurfaceId,
  t,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  hint: string;
  closeLabel: string;
  options: WalletOption[];
  readyLabel: string;
  previewLabel: string;
  side?: "left" | "right" | "inline";
  affiliateSurfaceId?: string;
  panelStyle?: CSSProperties;
  t: (typeof copy)[keyof typeof copy];
}) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "detected" | "extension" | "mobile" | "hardware">("all");

  const filtered = useMemo(() => {
    return options.filter((opt) => {
      const matchSearch =
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        opt.description.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (activeTab === "detected") return opt.available;
      if (activeTab === "extension") return opt.category === "extension";
      if (activeTab === "mobile") return opt.category === "mobile";
      if (activeTab === "hardware") return opt.category === "hardware";
      return true;
    });
  }, [options, search, activeTab]);

  if (!open) return null;

  return (
    <BodyPortal>
      <div
        className="wallet-sidecar-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200"
        data-velmere-dropdown-affiliate={affiliateSurfaceId}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <section
          id="velmere-other-wallets-panel"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="wallet-sidecar-panel wallet-sidecar-panel-pass2201 wallet-sidecar-panel-pass2204 relative flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] border border-white/[0.14] bg-[#0A0D12] text-white shadow-[0_32px_120px_rgba(0,0,0,0.85)] animate-in zoom-in-95 duration-150"
          data-surface="wallet-other-list-sidecar"
          data-wallet-sidecar-panel="true"
          data-pass2204-wallet-scroll="bounded-sidecar-scrollable"
          data-wallet-other-side={side}
          data-velmere-dropdown-affiliate={affiliateSurfaceId}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] p-5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-velmere-gold">
                Velmère Wallet Gateway
              </p>
              <h3 className="mt-1 font-serif text-2xl font-medium tracking-[-0.03em] text-white">
                {title}
              </h3>
              <p className="mt-1 text-xs text-white/[0.55]">
                {body}
              </p>
            </div>
            <button
              type="button"
              onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
                event.preventDefault();
                event.stopPropagation();
                onClose();
              }}
              onClick={onClose}
              className="velmere-command-pill velmere-interaction-pulse grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.12] bg-white/[0.04] text-white/[0.60] hover:text-white"
              aria-label={closeLabel}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search & Categories */}
          <div className="border-b border-white/[0.06] bg-black/20 p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-white/[0.10] bg-white/[0.03] text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-velmere-gold/40 focus:bg-white/[0.06] transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 text-[10px] font-mono uppercase tracking-wider">
              {[
                { id: "all", label: t.categoryAll },
                { id: "detected", label: t.categoryDetected },
                { id: "extension", label: t.categoryExtension },
                { id: "mobile", label: t.categoryMobile },
                { id: "hardware", label: t.categoryHardware },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-3 py-1.5 rounded-lg border transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-velmere-gold/50 bg-velmere-gold/15 text-velmere-gold font-semibold"
                      : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Wallet List */}
          <div
            className="wallet-sidecar-scroll wallet-sidecar-scroll-pass2204 min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 luxury-scrollbar"
            data-modal-scroll-region="true"
            data-wallet-scroll-contract="bounded-nonmodal-sidecar"
          >
            {filtered.length > 0 ? (
              <div className="grid gap-2.5">
                {filtered.map((option) => (
                  <WalletRow
                    key={option.key}
                    option={option}
                    readyLabel={readyLabel}
                    previewLabel={previewLabel}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-white/40">
                Nie znaleziono portfela dla &ldquo;{search}&rdquo;. Wybierz WalletConnect dla 300+ aplikacji mobilnych.
              </div>
            )}

            <div
              className="velmere-readout-card mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 text-xs leading-5 text-white/[0.55]"
              data-tone="gold"
            >
              <div className="flex items-start gap-2">
                <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-velmere-gold" />
                <span>{hint}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </BodyPortal>
  );
}

export default function WalletConnectOptions({
  compact = false,
  showStatus = true,
  otherPanelSide = "right",
  affiliateSurfaceId,
}: WalletConnectOptionsProps) {
  const locale = useLocale() as keyof typeof copy;
  const t = copy[locale] ?? copy.en;
  const wallet = useWalletConnect();
  const walletUi = useWalletUiStore();
  const [otherOpen, setOtherOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const otherButtonRef = useRef<HTMLButtonElement | null>(null);
  const consentBoundary = buildPass634WalletConsentBoundary({
    action: "connect_read_only",
  });

  const openOtherWallets = () => setOtherOpen((current: boolean) => !current);

  useEffect(() => {
    if (!otherOpen) return undefined;
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOtherOpen(false);
      otherButtonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", closeFromKeyboard, true);
    return () => {
      document.removeEventListener("keydown", closeFromKeyboard, true);
    };
  }, [otherOpen]);

  // Comprehensive wallet detection
  const detected = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        metamask: false,
        phantom: false,
        rabby: false,
        coinbase: false,
        trust: false,
        rainbow: false,
        okx: false,
        bitget: false,
        zerion: false,
        brave: false,
        safe: false,
        backpack: false,
        uniswap: false,
      };
    }
    const win = window as unknown as Record<string, unknown>;
    const eth = win.ethereum as Record<string, unknown> | undefined;
    return {
      metamask: Boolean(eth?.isMetaMask && !eth?.isRabby),
      phantom: Boolean(win.phantom || (win.solana as { isPhantom?: boolean } | undefined)?.isPhantom),
      rabby: Boolean(eth?.isRabby || win.rabby),
      coinbase: Boolean(eth?.isCoinbaseWallet || win.coinbaseWalletExtension),
      trust: Boolean(eth?.isTrust || eth?.isTrustWallet),
      rainbow: Boolean(eth?.isRainbow),
      okx: Boolean(win.okxwallet),
      bitget: Boolean(win.bitkeep),
      zerion: Boolean(eth?.isZerion),
      brave: Boolean(eth?.isBraveWallet),
      safe: Boolean(win.safe),
      backpack: Boolean(win.backpack),
      uniswap: Boolean(eth?.isUniswapWallet),
    };
  }, []);

  const primaryOptions: WalletOption[] = [
    {
      key: "metamask",
      label: "MetaMask",
      icon: "metamask",
      description: t.extension,
      category: "extension",
      action: wallet.connectMetaMask,
      available: wallet.detectedWallets.metamask || detected.metamask,
      featured: true,
    },
    {
      key: "phantom",
      label: "Phantom",
      icon: "phantom",
      description: t.solanaPreview,
      category: "extension",
      action: wallet.connectPhantom,
      available: wallet.detectedWallets.phantom || detected.phantom,
      featured: true,
    },
  ];

  const otherOptions: WalletOption[] = [
    {
      key: "walletconnect",
      label: "WalletConnect",
      icon: "walletconnect",
      description: t.mobile,
      category: "mobile",
      action: wallet.connectWalletConnect,
      available: true,
      fallbackHref: "https://walletconnect.com/",
    },
    {
      key: "rabby",
      label: "Rabby Wallet",
      icon: "rabby",
      description: "DeFi & EVM Security First",
      category: "extension",
      action: wallet.connectMetaMask,
      available: detected.rabby,
      fallbackHref: "https://rabby.io/",
    },
    {
      key: "coinbase",
      label: "Coinbase Wallet",
      icon: "coinbase",
      description: "Coinbase Smart Wallet & App",
      category: "mobile",
      action: wallet.connectWalletConnect,
      available: detected.coinbase,
      fallbackHref: "https://www.coinbase.com/wallet",
    },
    {
      key: "okx",
      label: "OKX Wallet",
      icon: "okx",
      description: "Multi-Chain Web3 & DeFi",
      category: "extension",
      action: wallet.connectMetaMask,
      available: detected.okx,
      fallbackHref: "https://www.okx.com/web3",
    },
    {
      key: "trust",
      label: "Trust Wallet",
      icon: "trust",
      description: "Binance Official Web3",
      category: "mobile",
      action: wallet.connectWalletConnect,
      available: detected.trust,
      fallbackHref: "https://trustwallet.com/",
    },
    {
      key: "rainbow",
      label: "Rainbow",
      icon: "rainbow",
      description: "Fun & Simple Ethereum L2s",
      category: "mobile",
      action: wallet.connectWalletConnect,
      available: detected.rainbow,
      fallbackHref: "https://rainbow.me/",
    },
    {
      key: "bitget",
      label: "Bitget Wallet",
      icon: "bitget",
      description: "Global Multi-Chain Asset Hub",
      category: "mobile",
      action: wallet.connectMetaMask,
      available: detected.bitget,
      fallbackHref: "https://web3.bitget.com/",
    },
    {
      key: "zerion",
      label: "Zerion Wallet",
      icon: "zerion",
      description: "Smart Portfolio & Multichain",
      category: "extension",
      action: wallet.connectMetaMask,
      available: detected.zerion,
      fallbackHref: "https://zerion.io/",
    },
    {
      key: "ledger",
      label: "Ledger Live",
      icon: "ledger",
      description: t.hardware,
      category: "hardware",
      action: wallet.connectWalletConnect,
      available: true,
      fallbackHref: "https://www.ledger.com/ledger-live",
    },
    {
      key: "trezor",
      label: "Trezor Suite",
      icon: "trezor",
      description: t.hardware,
      category: "hardware",
      action: wallet.connectWalletConnect,
      available: true,
      fallbackHref: "https://trezor.io/trezor-suite",
    },
    {
      key: "exodus",
      label: "Exodus",
      icon: "exodus",
      description: "Multi-Asset Desktop & Mobile",
      category: "mobile",
      action: wallet.connectWalletConnect,
      available: false,
      fallbackHref: "https://www.exodus.com/",
    },
    {
      key: "brave",
      label: "Brave Wallet",
      icon: "brave",
      description: "Privacy Browser Native",
      category: "extension",
      action: wallet.connectMetaMask,
      available: detected.brave,
      fallbackHref: "https://brave.com/wallet/",
    },
    {
      key: "safe",
      label: "Safe (Gnosis)",
      icon: "safe",
      description: "Institutional Multi-Sig",
      category: "extension",
      action: wallet.connectWalletConnect,
      available: detected.safe,
      fallbackHref: "https://safe.global/",
    },
    {
      key: "uniswap",
      label: "Uniswap Wallet",
      icon: "uniswap",
      description: "DeFi Native & Self-Custody",
      category: "mobile",
      action: wallet.connectWalletConnect,
      available: detected.uniswap,
      fallbackHref: "https://wallet.uniswap.org/",
    },
    {
      key: "1inch",
      label: "1inch Wallet",
      icon: "1inch",
      description: "DEX Aggregator & Security",
      category: "mobile",
      action: wallet.connectWalletConnect,
      available: false,
      fallbackHref: "https://1inch.io/wallet/",
    },
    {
      key: "backpack",
      label: "Backpack",
      icon: "backpack",
      description: "Next-Gen xNFT & Multichain",
      category: "extension",
      action: wallet.connectMetaMask,
      available: detected.backpack,
      fallbackHref: "https://backpack.app/",
    },
    {
      key: "kraken",
      label: "Kraken Wallet",
      icon: "kraken",
      description: "Institutional Self-Custodial",
      category: "mobile",
      action: wallet.connectWalletConnect,
      available: false,
      fallbackHref: "https://www.kraken.com/wallet",
    },
  ];

  return (
    <div
      ref={rootRef}
      className="wallet-connect-options-root wallet-connect-options-root-pass2201 wallet-connect-options-root-pass2276 relative min-h-[16rem] space-y-3"
      data-pass1986-wallet-options-root="safe-nested-other-panel"
      data-pass2002-wallet-options-root="outside-click-escape-other-wallets"
      data-pass2276-wallet-selector="metamask-phantom-other-visible-when-disconnected"
    >
      {showStatus ? (
        <div className="velmere-command-shell overflow-hidden rounded-[1.65rem] border-velmere-gold/[0.10]">
          <div className="border-b border-white/[0.10] p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">
              {t.current}
            </p>
            <p className="mt-2 break-all text-sm leading-6 text-white/[0.70]">
              {walletUi.connected ? walletUi.fullAddress : t.empty}
            </p>
          </div>
          <div className="flex items-start gap-3 p-4 text-xs leading-6 text-white/[0.50]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-velmere-gold" />
            <span>{walletUi.connected ? t.oneOnly : t.safety}</span>
          </div>
          {!walletUi.connected ? (
            <div
              data-wallet-consent-boundary={consentBoundary.state}
              className="grid grid-cols-1 gap-2 border-t border-white/[0.08] bg-black/[0.18] p-4 sm:grid-cols-3"
            >
              {[t.noSignature, t.noTransaction, t.noApproval].map((label) => (
                <span
                  key={label}
                  className="velmere-command-pill min-h-9 gap-2 rounded-2xl border-emerald-300/[0.16] bg-emerald-300/[0.055] px-3 text-[9px] text-emerald-100/[0.72]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </span>
              ))}
              <span className="sr-only">
                {t.readOnlyBadge}: {consentBoundary.humanSummary}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {!walletUi.connected ? (
        <>
          {!showStatus ? <WalletConsentNotice compact={compact} /> : null}
          <p className="px-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/[0.68]">
            {t.primary}
          </p>
          <div className="grid gap-3">
            {primaryOptions.map((option) => (
              <WalletRow
                key={option.key}
                option={option}
                readyLabel={t.statusReady}
                previewLabel={t.notInstalled}
              />
            ))}
          </div>
          <button
            ref={otherButtonRef}
            type="button"
            onClick={openOtherWallets}
            data-pass1986-other-wallet-toggle="true"
            data-pass1983-other-wallet-toggle="true"
            data-pass1983-other-wallet-side={otherPanelSide}
            className={`velmere-command-shell velmere-interaction-pulse group flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.10] bg-white/[0.025] px-4 text-left transition hover:border-velmere-gold/[0.40] hover:bg-white/[0.05] ${compact ? "" : "mt-2"}`}
            aria-label={t.openOther}
            aria-expanded={otherOpen}
            aria-controls="velmere-other-wallets-panel"
          >
            <span className="inline-flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-velmere-gold/[0.25] bg-velmere-gold/[0.10] text-velmere-gold">
                <WalletCards className="h-4 w-4" />
              </span>
              <span>
                <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/[0.80] group-hover:text-white">
                  {t.other}
                </span>
                <span className="mt-0.5 block text-xs text-white/[0.40]">
                  {t.otherSubtitle}
                </span>
              </span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-white/[0.35] group-hover:text-velmere-gold" />
          </button>
          <OtherWalletPanel
            open={otherOpen}
            onClose={() => setOtherOpen(false)}
            title={t.otherTitle}
            body={t.otherBody}
            hint={t.installHint}
            closeLabel={t.closeWalletPanel}
            options={[...primaryOptions, ...otherOptions]}
            readyLabel={t.statusReady}
            previewLabel={t.statusPreview}
            side={otherPanelSide}
            affiliateSurfaceId={affiliateSurfaceId}
            t={t}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => wallet.disconnect()}
          className="velmere-command-pill velmere-interaction-pulse inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-[10px] text-white/[0.70] hover:border-red-300/[0.30] hover:text-red-200"
        >
          {t.disconnect}
        </button>
      )}
    </div>
  );
}
