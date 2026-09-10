"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/navigation";
import AngelPanel from "@/components/angel/AngelPanel";
import { useCart } from "@/components/CartProvider";
import { VShieldPulse } from "@/components/motion/VelmereAnalysisMarks";

export default function AngelTeaser() {
  const pathname = usePathname();
  const t = useTranslations("Angel");
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [handoffMessage, setHandoffMessage] = useState<string | null>(null);
  const { closeCart } = useCart();

  useEffect(() => {
    const closeAngel = () => setOpen(false);
    const openAngelFromCommand = (event?: Event) => {
      closeCart();
      window.dispatchEvent(new Event("velmere:close-square-panels"));
      const detail = event instanceof CustomEvent ? event.detail as { handoffMessage?: string } | null : null;
      if (detail?.handoffMessage) setHandoffMessage(detail.handoffMessage);
      setOpen(true);
    };
    window.addEventListener("velmere:close-angel", closeAngel);
    const onVisibility = (event: Event) => {
      const detail = (event as CustomEvent<{ hidden?: boolean }>).detail;
      setHidden(Boolean(detail?.hidden));
      if (detail?.hidden) setOpen(false);
    };
    window.addEventListener("velmere:angel:open", openAngelFromCommand);
    window.addEventListener("velmere:angel-visibility", onVisibility);
    return () => {
      window.removeEventListener("velmere:close-angel", closeAngel);
      window.removeEventListener("velmere:angel:open", openAngelFromCommand);
      window.removeEventListener("velmere:angel-visibility", onVisibility);
    };
  }, [closeCart]);

  const openAngel = () => {
    closeCart();
    window.dispatchEvent(new Event("velmere:close-square-panels"));
    setOpen(true);
  };

  const isAssetPage = Boolean(pathname?.includes("/assets/"));
  const shouldRender = !hidden && !isAssetPage;

  return (
    <>
      {shouldRender ? (
        <button
          type="button"
          onClick={openAngel}
          aria-label={t("openLabel")}
          className="velmere-floating-utility velmere-floating-utility--angel velmere-floating-utility--angel-clean-pass2383 group fixed flex h-12 w-12 items-center justify-center gap-2 rounded-full border border-[#d4af37]/[0.32] bg-[#0B0C0E]/[0.96] p-0 text-[#d4af37] shadow-[0_16px_48px_rgba(0,0,0,0.48)] ring-1 ring-white/[0.08] transition hover:border-[#d4af37]/[0.52] hover:bg-[#15161A] active:scale-95 md:h-auto md:w-auto md:min-h-12 md:justify-start md:bg-[#1A1A1C]/[0.95] md:px-4"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d4af37]/[0.10] text-[#d4af37]">
            <VShieldPulse size={23} />
          </span>
          <span className="hidden font-mono text-[10px] font-black uppercase tracking-[0.22em] text-white/[0.70] md:inline">
            Angel
          </span>
        </button>
      ) : null}
      <AngelPanel open={open && shouldRender} handoffMessage={handoffMessage} onClose={() => setOpen(false)} />
    </>
  );
}
