"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import {
  BrainCircuit,
  Map,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { useLocale } from "next-intl";
import { useRouter } from "@/navigation";
import { useUiSounds } from "@/lib/audio/useUiSounds";
import { useWalletUiStore } from "@/store/useWalletUiStore";
import { ModalRoot } from "@/components/ui/OverlayPrimitives";

type CommandAction = {
  label: string;
  hint: string;
  keywords: string;
  perform: () => void;
  icon: React.ReactNode;
};

const copy = {
  pl: {
    title: "Szybkie przejście",
    placeholder: "Wpisz nazwę miejsca lub działania…",
    empty: "Nie znaleziono pasującego miejsca.",
    explore: "Odkrywaj",
    account: "Dostęp",
    close: "Zamknij szybkie przejście",
    keyboard: "Strzałki wybierają · Enter otwiera · Esc zamyka",
    shop: "Sklep",
    shopHint: "Kolekcja i produkty",
    lens: "Velmère Browser",
    lensHint: "Szybki raport i PDF",
    shield: "Velmère Shield",
    shieldHint: "Pełna analiza rynku",
    map: "Shield Map",
    mapHint: "Relacje i mapa ryzyka",
    angel: "Angel",
    angelHint: "Asystent Velmère",
    wallet: "Połącz portfel",
    walletHint: "Opcjonalny dostęp Web3",
    connected: "Połączono",
  },
  de: {
    title: "Schnellzugriff",
    placeholder: "Ort oder Aktion eingeben…",
    empty: "Kein passender Bereich gefunden.",
    explore: "Entdecken",
    account: "Zugang",
    close: "Schnellzugriff schließen",
    keyboard: "Pfeile wählen · Enter öffnet · Esc schließt",
    shop: "Shop",
    shopHint: "Kollektion und Produkte",
    lens: "Velmère Browser",
    lensHint: "Kompakter Bericht und PDF",
    shield: "Velmère Shield",
    shieldHint: "Vollständige Marktanalyse",
    map: "Shield Map",
    mapHint: "Beziehungen und Risikokarte",
    angel: "Angel",
    angelHint: "Velmère Assistent",
    wallet: "Wallet verbinden",
    walletHint: "Optionaler Web3-Zugang",
    connected: "Verbunden",
  },
  en: {
    title: "Quick access",
    placeholder: "Type a destination or action…",
    empty: "No matching destination found.",
    explore: "Explore",
    account: "Access",
    close: "Close quick access",
    keyboard: "Arrows select · Enter opens · Esc closes",
    shop: "Shop",
    shopHint: "Collection and products",
    lens: "Velmère Browser",
    lensHint: "Compact report and PDF",
    shield: "Velmère Shield",
    shieldHint: "Full market analysis",
    map: "Shield Map",
    mapHint: "Relationships and risk map",
    angel: "Angel",
    angelHint: "Velmère assistant",
    wallet: "Connect wallet",
    walletHint: "Optional Web3 access",
    connected: "Connected",
  },
} as const;

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const locale = useLocale() as keyof typeof copy;
  const t = copy[locale] ?? copy.en;
  const walletUi = useWalletUiStore();
  const { playHover, playClick } = useUiSounds();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        playClick();
        return;
      }
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [playClick]);

  const exploreCommands = useMemo<CommandAction[]>(
    () => [
      {
        label: t.shop,
        hint: t.shopHint,
        keywords: "shop collection clothing sklep kolekcja",
        icon: <ShoppingBag className="h-4 w-4" aria-hidden="true" />,
        perform: () => router.push("/shop"),
      },
      {
        label: t.lens,
        hint: t.lensHint,
        keywords: "lens browser search pdf report wyszukiwarka raport",
        icon: <Search className="h-4 w-4" aria-hidden="true" />,
        perform: () => router.push("/search"),
      },
      {
        label: t.shield,
        hint: t.shieldHint,
        keywords: "shield market risk analysis analiza ryzyko",
        icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
        perform: () => router.push("/market-integrity"),
      },
      {
        label: t.map,
        hint: t.mapHint,
        keywords: "shield map orbit risk mapa relacje",
        icon: <Map className="h-4 w-4" aria-hidden="true" />,
        perform: () => router.push("/shield-map"),
      },
    ],
    [router, t],
  );

  const accessCommands = useMemo<CommandAction[]>(
    () => [
      {
        label: t.angel,
        hint: t.angelHint,
        keywords: "angel assistant concierge pomoc",
        icon: <Sparkles className="h-4 w-4" aria-hidden="true" />,
        perform: () => window.dispatchEvent(new Event("velmere:angel:open")),
      },
      {
        label: t.wallet,
        hint: walletUi.connected
          ? `${t.connected} · ${walletUi.shortAddress}`
          : t.walletHint,
        keywords: "wallet web3 connect portfel",
        icon: <WalletCards className="h-4 w-4" aria-hidden="true" />,
        perform: () => window.dispatchEvent(new Event("velmere:open-wallet")),
      },
    ],
    [t, walletUi.connected, walletUi.shortAddress],
  );

  const run = (command: CommandAction) => {
    playClick();
    command.perform();
    setOpen(false);
  };

  const renderCommand = (command: CommandAction) => (
    <Command.Item
      key={command.label}
      value={`${command.label} ${command.hint} ${command.keywords}`}
      onMouseEnter={playHover}
      onSelect={() => run(command)}
      className="velmere-command-item group mb-2 grid min-h-[4.65rem] cursor-pointer grid-cols-[2.8rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.25rem] border border-white/[0.06] bg-black/[0.16] px-3.5 text-left outline-none transition-all duration-300 data-[selected=true]:border-velmere-gold/[0.28] data-[selected=true]:bg-velmere-gold/[0.07]"
    >
      <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-white/[0.58] transition group-data-[selected=true]:border-velmere-gold/[0.24] group-data-[selected=true]:text-velmere-gold">
        {command.icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-white/[0.82] transition group-data-[selected=true]:text-white">
          {command.label}
        </span>
        <span className="mt-1 block truncate text-xs text-white/[0.38] group-data-[selected=true]:text-white/[0.55]">
          {command.hint}
        </span>
      </span>
      <span className="hidden h-8 w-8 place-items-center rounded-full border border-white/[0.07] text-white/[0.28] transition group-data-[selected=true]:border-velmere-gold/[0.20] group-data-[selected=true]:text-velmere-gold sm:grid">
        <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </Command.Item>
  );

  return (
    <ModalRoot
      open={open}
      onClose={() => setOpen(false)}
      closeLabel={t.close}
      ariaLabel={t.title}
      surfaceClassName="velmere-command-shell flex w-full max-w-[44rem] flex-col overflow-hidden rounded-[1.75rem] border-velmere-gold/[0.16] shadow-[0_42px_140px_rgba(0,0,0,0.68)] sm:max-h-[min(46rem,calc(100dvh-4rem))] sm:rounded-[2rem]"
      surfaceData={{ surface: "command-palette" }}
    >
      <Command className="flex min-h-0 flex-1 flex-col bg-transparent text-white">
        <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-5">
          <Search
            className="h-4 w-4 shrink-0 text-velmere-gold/[0.72]"
            aria-hidden="true"
          />
          <Command.Input
            autoFocus
            placeholder={t.placeholder}
            className="h-12 min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/[0.28]"
          />
          <span className="hidden rounded-full border border-white/[0.08] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.34] sm:block">
            ⌘ K
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.025] text-white/[0.45] transition hover:border-white/[0.16] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-velmere-gold/[0.55]"
            aria-label={t.close}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <Command.List
          data-modal-scroll-region="true"
          className="luxury-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4"
        >
          <Command.Empty className="px-4 py-12 text-center text-sm text-white/[0.38]">
            {t.empty}
          </Command.Empty>
          <Command.Group
            heading={t.explore}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.2em] [&_[cmdk-group-heading]]:text-white/[0.30]"
          >
            {exploreCommands.map(renderCommand)}
          </Command.Group>
          <Command.Separator className="my-3 h-px bg-white/[0.07]" />
          <Command.Group
            heading={t.account}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.2em] [&_[cmdk-group-heading]]:text-white/[0.30]"
          >
            {accessCommands.map(renderCommand)}
          </Command.Group>
        </Command.List>

        <div className="hidden shrink-0 border-t border-white/[0.07] px-5 py-3 text-center font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.26] sm:block">
          {t.keyboard}
        </div>
      </Command>
    </ModalRoot>
  );
}
