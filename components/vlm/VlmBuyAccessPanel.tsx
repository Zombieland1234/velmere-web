"use client";

import { useState } from "react";
import { ArrowRight, ChevronRight, ShieldCheck, X } from "lucide-react";
import { useLocale } from "next-intl";
import { useWalletUiStore } from "@/store/useWalletUiStore";
import WalletSafetyExplainer from "@/components/vlm/WalletSafetyExplainer";
import WalletConnectOptions from "@/components/wallet/WalletConnectOptions";
import { DrawerRoot } from "@/components/ui/OverlayPrimitives";
import { pass628LayerStyle } from "@/lib/ui/overlay-constitution";

const copy = {
  en: {
    trigger: "Access route",
    kicker: "VLM / ACCESS ROUTE",
    title: "Token access panel.",
    body: "VLM is not active for purchase yet. This panel prepares the future swap, claim and wallet-check flow without pretending that a live contract exists.",
    wallet: "Wallet route",
    swap: "Swap preview",
    security: "Security notes",
    noCustody: "No custody. No seed phrase. No price promise.",
    metamask: "MetaMask route",
    phantom: "Phantom route",
    connect: "Connect wallet",
    waitlist: "Join waitlist",
    close: "Close VLM access panel",
    pending:
      "Contract address, ABI, audit and legal copy must be added before enabling real purchase or swap actions.",
  },
  pl: {
    trigger: "Ścieżka dostępu",
    kicker: "VLM / ŚCIEŻKA DOSTĘPU",
    title: "Panel dostępu tokena.",
    body: "VLM nie jest jeszcze aktywny do zakupu. Ten panel przygotowuje przyszły flow wymiany, claimu i sprawdzania portfela bez udawania, że kontrakt już działa.",
    wallet: "Ścieżka portfela",
    swap: "Podgląd wymiany",
    security: "Notatki bezpieczeństwa",
    noCustody: "Bez custody. Bez seed phrase. Bez obietnicy ceny.",
    metamask: "MetaMask",
    phantom: "Phantom",
    connect: "Połącz portfel",
    waitlist: "Dołącz do listy",
    close: "Zamknij panel VLM",
    pending:
      "Adres kontraktu, ABI, audyt i tekst prawny muszą zostać dodane przed prawdziwym zakupem albo wymianą.",
  },
  de: {
    trigger: "Zugangsroute",
    kicker: "VLM / ZUGANGSROUTE",
    title: "Token-Zugangspanel.",
    body: "VLM ist noch nicht zum Kauf aktiv. Dieses Panel bereitet Swap-, Claim- und Wallet-Check-Flows vor, ohne einen Live-Vertrag vorzutäuschen.",
    wallet: "Wallet-Route",
    swap: "Swap-Vorschau",
    security: "Sicherheitshinweise",
    noCustody: "Keine Verwahrung. Keine Seed Phrase. Kein Preisversprechen.",
    metamask: "MetaMask",
    phantom: "Phantom",
    connect: "Wallet verbinden",
    waitlist: "Zur Liste",
    close: "VLM-Zugangspanel schließen",
    pending:
      "Contract-Adresse, ABI, Audit und Legal Copy müssen ergänzt werden, bevor echte Kauf- oder Swap-Aktionen möglich sind.",
  },
} as const;

export default function VlmBuyAccessPanel() {
  const locale = useLocale() as keyof typeof copy;
  const t = copy[locale] ?? copy.en;
  const walletUi = useWalletUiStore();
  const [open, setOpen] = useState(false);

  const openWaitlist = () => {
    setOpen(false);
    window.requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent("velmere:open-mail", {
          detail: { source: "vlm-waitlist", pass1977: true },
        }),
      );
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.trigger}
        className="fixed left-0 top-[calc(50%+5.2rem)] hidden -translate-y-1/2 items-center gap-2 rounded-r-2xl border border-l-0 border-cyan-200/[0.18] bg-[#090b0e] px-3 py-5 text-cyan-100/[0.82] shadow-[0_24px_70px_rgba(0,0,0,0.55)] transition-colors duration-150 hover:bg-[#0d1116] active:scale-95 md:flex"
        data-pass2004-vlm-floating-access="solid-no-blur-low-lag"
        style={pass628LayerStyle("floatingAction")}
      >
        <ChevronRight className="h-5 w-5" />
        <span className="[writing-mode:vertical-rl] rotate-180 font-mono text-[9px] font-black uppercase tracking-[0.2em]">
          VLM
        </span>
      </button>

      <DrawerRoot
        open={open}
        motionPreset="left"
        onClose={() => setOpen(false)}
        closeLabel={t.close}
        ariaLabelledBy="vlm-access-panel-title"
        ariaLabel={t.trigger}
        surfaceClassName="fixed bottom-0 left-0 top-0 flex h-[100dvh] w-full max-w-[36rem] flex-col overscroll-contain border-r border-white/[0.10] bg-[#111113] text-velmere-ivory shadow-[40px_0_140px_rgba(0,0,0,0.74)]"
        surfaceData={{ surface: "vlm-access-panel", pass2004: "solid-owned-scroll-low-lag" }}
      >
        <div
          data-modal-scroll-region="true"
          className="min-h-0 flex-1 overflow-y-auto p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)] md:p-8 luxury-scrollbar"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="velmere-label text-velmere-gold">{t.kicker}</p>
              <h2
                id="vlm-access-panel-title"
                className="mt-5 font-serif text-[clamp(3rem,8vw,5.8rem)] leading-[0.9] tracking-[-0.055em]"
              >
                {t.title}
              </h2>
            </div>
            <button
              type="button"
              aria-label={t.close}
              onPointerDown={(event) => { event.preventDefault(); setOpen(false); }}
              onClick={() => setOpen(false)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.10] text-white/[0.50] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-6 text-sm leading-7 text-velmere-muted">{t.body}</p>

          <div className="mt-8 grid gap-3">
            {[
              [
                t.wallet,
                walletUi.connected ? walletUi.shortAddress : t.connect,
              ],
              [
                t.swap,
                locale === "pl"
                  ? "VLM / ETH / SOL — podgląd rynku"
                  : locale === "de"
                    ? "VLM / ETH / SOL — Marktvorschau"
                    : "VLM / ETH / SOL — market preview",
              ],
              [t.security, t.noCustody],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/[0.10] bg-black/[0.25] p-4"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/[0.40]">
                  {label}
                </p>
                <p className="mt-2 break-all text-sm leading-6 text-white/[0.70]">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <WalletConnectOptions showStatus={false} />
            <button
              type="button"
              onClick={openWaitlist}
              className="velmere-button-primary mt-3 w-full"
              data-pass1977-vlm-waitlist="opens-mail-drawer"
            >
              {t.waitlist}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6">
            <WalletSafetyExplainer />
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-cyan-200/[0.14] bg-cyan-300/[0.055] p-4 text-xs leading-6 text-white/[0.60]">
            <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-cyan-100/[0.82]" />
            <span>{t.pending}</span>
          </div>
        </div>
      </DrawerRoot>
    </>
  );
}
