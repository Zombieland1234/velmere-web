"use client";

import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import {
  ArrowDownRight,
  BadgeCheck,
  Boxes,
  Gem,
  Leaf,
  LockKeyhole,
  Route,
  Scissors,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import AtelierThreeGlobe, {
  type AtelierFacility,
  type AtelierGlobeCopy,
} from "@/components/atelier/AtelierThreeGlobe";

type Copy = {
  mapKicker: string;
  titleLines: readonly [string, string, string];
  mapBody: string;
  nodeCountLabel: string;
  realPositioning: string;
  cta: string;
  cardsAria: string;
};

type DetailSlot = {
  id: string;
  icon: "tailor" | "material" | "construction" | "leaf";
  eyebrow: string;
  title: string;
  hint: string;
};

type FooterItem = {
  icon: "shield" | "diamond" | "badge" | "lock";
  label: string;
  sublabel: string;
};

type Props = {
  facilities: AtelierFacility[];
  copy: Copy;
  globeCopy: AtelierGlobeCopy;
  detailSlots: readonly DetailSlot[];
  footerItems: readonly FooterItem[];
};

const DETAIL_ICONS = {
  tailor: Scissors,
  material: Boxes,
  construction: Route,
  leaf: Leaf,
} as const;

const FOOTER_ICONS = {
  shield: ShieldCheck,
  diamond: Gem,
  badge: BadgeCheck,
  lock: LockKeyhole,
} as const;

export default function AtelierNetworkMap({
  facilities,
  copy,
  globeCopy,
  detailSlots,
  footerItems,
}: Props) {
  const scrollToCraftStandard = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById("velmere-atelier-craft-cards");
    if (!target) return;

    event.preventDefault();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", "#velmere-atelier-craft-cards");
  };

  return (
    <section
      className="relative isolate overflow-hidden border-y border-white/[0.055] bg-[#020405] px-4 text-white sm:px-6 md:px-9 xl:px-12"
      data-atelier-hero="earth-orbit"
    >
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_76%_30%,rgba(29,87,113,.18),transparent_29%),radial-gradient(circle_at_8%_15%,rgba(214,183,122,.095),transparent_25%),linear-gradient(180deg,#050708_0%,#020405_74%,#020303_100%)]" />
      <div className="pointer-events-none absolute inset-0 -z-20 opacity-[0.16] [background-image:radial-gradient(circle_at_center,rgba(255,255,255,.22)_0_.5px,transparent_.7px)] [background-size:28px_28px]" />
      <div className="pointer-events-none absolute left-[-4vw] top-[8rem] -z-10 select-none font-serif text-[clamp(9rem,20vw,25rem)] leading-none tracking-[-0.08em] text-white/[0.014]">
        A
      </div>
      <div className="pointer-events-none absolute right-[-2rem] top-[2rem] -z-10 h-[34rem] w-[34rem] rounded-full border border-velmere-gold/[0.045] md:h-[52rem] md:w-[52rem]" />
      <div className="pointer-events-none absolute right-[8%] top-[10rem] -z-10 h-[24rem] w-[24rem] rounded-full border border-white/[0.025] md:h-[38rem] md:w-[38rem]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-velmere-gold/25 to-transparent" />

      <div className="relative mx-auto max-w-[118rem] pb-8 pt-7 md:pb-10 md:pt-9 xl:pb-8 xl:pt-8">
        <div className="grid items-center gap-8 lg:min-h-[46rem] lg:grid-cols-[minmax(20rem,.72fr)_minmax(0,1.42fr)] lg:gap-5 xl:min-h-[48rem] xl:grid-cols-[minmax(23rem,.70fr)_minmax(0,1.5fr)]">
          <div className="atelier-copy-enter relative z-20 max-w-[37rem] lg:pb-8 xl:pl-2">
            <div className="atelier-kicker-enter flex items-center gap-3">
              <span className="h-px w-9 bg-velmere-gold/80" />
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.31em] text-velmere-gold/[0.88] sm:text-[9.5px]">
                {copy.mapKicker}
              </p>
              <Sparkles className="h-3 w-3 text-velmere-gold/70" aria-hidden="true" />
            </div>

            <h1 className="mt-8 max-w-[36rem] tracking-[-0.055em] sm:mt-9">
              <span className="atelier-title-line atelier-title-line-1 block font-sans text-[clamp(2rem,4.2vw,4.3rem)] font-light leading-[0.94] text-white/[0.82]">
                {copy.titleLines[0]}
              </span>
              <span className="atelier-title-line atelier-title-line-2 mt-1 block font-serif text-[clamp(4.15rem,8.2vw,8.1rem)] leading-[0.82] text-white">
                {copy.titleLines[1]}
              </span>
              <span className="atelier-title-line atelier-title-line-3 mt-4 block max-w-[31rem] font-serif text-[clamp(2.25rem,4.35vw,4.65rem)] italic leading-[0.92] text-velmere-gold/[0.92] sm:mt-5">
                {copy.titleLines[2]}
              </span>
            </h1>

            <p className="atelier-body-enter mt-7 max-w-[31rem] border-l border-white/10 pl-5 text-[0.86rem] leading-7 text-white/[0.56] sm:text-[0.95rem] sm:leading-8">
              {copy.mapBody}
            </p>

            <div className="atelier-meta-enter mt-7 flex flex-wrap items-stretch gap-x-7 gap-y-4 border-y border-white/[0.075] py-4 sm:gap-x-10">
              <div className="flex items-baseline gap-2.5">
                <strong className="font-serif text-3xl font-normal leading-none text-white">{String(facilities.length).padStart(2, "0")}</strong>
                <span className="max-w-[8rem] font-mono text-[9px] uppercase leading-4 tracking-[0.18em] text-white/[0.38] sm:text-[9.5px]">
                  {copy.nodeCountLabel}
                </span>
              </div>
              <div className="hidden w-px bg-white/[0.075] sm:block" />
              <div className="flex items-center gap-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.38] sm:text-[9.5px]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.65)]" />
                {copy.realPositioning}
              </div>
            </div>

            <a
              href="#velmere-atelier-craft-cards"
              aria-label={copy.cta}
              onClick={scrollToCraftStandard}
              className="atelier-cta-enter group mt-7 inline-flex min-h-12 w-full max-w-[18rem] items-center justify-between rounded-full border border-velmere-gold/[0.35] bg-velmere-gold/[0.06] px-5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.19em] text-velmere-gold transition duration-500 hover:border-velmere-gold/70 hover:bg-velmere-gold hover:text-[#17130c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-velmere-gold/[0.45] focus-visible:ring-offset-4 focus-visible:ring-offset-[#020405] sm:text-[10px]"
            >
              <span>{copy.cta}</span>
              <span className="grid h-7 w-7 place-items-center rounded-full border border-current/30 transition duration-500 group-hover:rotate-45">
                <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </a>
          </div>

          <div className="atelier-globe-enter relative z-10 mx-auto h-[min(22.5rem,calc(100vw-2rem))] w-full max-w-[42rem] min-w-0 sm:h-[34rem] sm:max-w-none md:h-[39rem] lg:mx-0 lg:h-[43rem] xl:h-[46rem]">
            <div className="pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle_at_center,rgba(42,120,157,.17),transparent_65%)] blur-2xl" />
            <AtelierThreeGlobe facilities={facilities} copy={globeCopy} />
          </div>
        </div>

        <div
          id="velmere-atelier-craft-cards"
          className="relative z-30 mt-7 grid scroll-mt-28 overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-white/[0.018] md:grid-cols-2 xl:mt-2 xl:grid-cols-4"
          aria-label={copy.cardsAria}
        >
          {detailSlots.map((slot, index) => {
            const Icon = DETAIL_ICONS[slot.icon];
            return (
              <article
                key={slot.id}
                className="atelier-craft-card group relative min-h-[16rem] overflow-hidden border-b border-white/[0.075] p-6 transition duration-500 hover:bg-white/[0.035] md:min-h-[17rem] md:border-r xl:border-b-0 xl:p-7 xl:last:border-r-0"
                style={{ "--atelier-card-delay": `${0.12 + index * 0.07}s` } as CSSProperties}
              >
                <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-velmere-gold/[0.10] opacity-0 blur-[70px] transition duration-700 group-hover:opacity-100" />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-11 w-11 place-items-center rounded-full border border-velmere-gold/[0.24] bg-black/20 text-velmere-gold transition duration-500 group-hover:scale-105 group-hover:border-velmere-gold/50 group-hover:bg-velmere-gold/10">
                      <Icon className="h-[1.15rem] w-[1.15rem] stroke-[1.35]" aria-hidden="true" />
                    </span>
                    <span className="font-serif text-4xl leading-none text-white/[0.06] transition duration-500 group-hover:text-velmere-gold/[0.12]">
                      0{index + 1}
                    </span>
                  </div>
                  <p className="mt-7 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-velmere-gold/[0.82]">
                    {slot.eyebrow}
                  </p>
                  <h2 className="mt-3 font-serif text-[1.75rem] leading-none tracking-[-0.035em] text-white/[0.92]">
                    {slot.title}
                  </h2>
                  <p className="mt-4 max-w-[19rem] text-xs leading-6 text-white/[0.46]">{slot.hint}</p>
                  <span className="mt-auto block h-px w-10 bg-velmere-gold/[0.55] transition-all duration-500 group-hover:w-full" />
                </div>
              </article>
            );
          })}
        </div>

        <div className="relative z-30 mt-4 grid gap-y-3 rounded-[1.15rem] border border-white/[0.06] bg-black/20 px-3 py-3 md:grid-cols-2 xl:grid-cols-4 xl:px-0">
          {footerItems.map((item) => {
            const Icon = FOOTER_ICONS[item.icon];
            return (
              <div key={item.label} className="flex min-h-14 items-center gap-4 px-4 xl:border-r xl:border-white/[0.07] xl:last:border-r-0">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-velmere-gold/[0.18] text-velmere-gold/75">
                  <Icon className="h-4 w-4 stroke-[1.35]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.62]">{item.label}</p>
                  <p className="mt-1 truncate text-[10px] text-white/[0.32]">{item.sublabel}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .atelier-copy-enter,
        .atelier-kicker-enter,
        .atelier-title-line,
        .atelier-body-enter,
        .atelier-meta-enter,
        .atelier-cta-enter,
        .atelier-globe-enter,
        .atelier-craft-card {
          animation-duration: 0.9s;
          animation-fill-mode: both;
          animation-timing-function: cubic-bezier(.22,.76,.24,1);
        }
        .atelier-copy-enter { animation-name: atelier-copy-in; }
        .atelier-kicker-enter { animation-name: atelier-rise-in; animation-delay: .06s; }
        .atelier-title-line { animation-name: atelier-title-in; }
        .atelier-title-line-1 { animation-delay: .11s; }
        .atelier-title-line-2 { animation-delay: .18s; }
        .atelier-title-line-3 { animation-delay: .25s; }
        .atelier-body-enter { animation-name: atelier-rise-in; animation-delay: .32s; }
        .atelier-meta-enter { animation-name: atelier-rise-in; animation-delay: .39s; }
        .atelier-cta-enter { animation-name: atelier-rise-in; animation-delay: .46s; }
        .atelier-globe-enter { animation-name: atelier-globe-in; animation-duration: 1.25s; animation-delay: .12s; }
        .atelier-craft-card { animation-name: atelier-rise-in; animation-delay: var(--atelier-card-delay); }
        @keyframes atelier-copy-in {
          from { opacity: 0; transform: translate3d(-22px,0,0); }
          to { opacity: 1; transform: translate3d(0,0,0); }
        }
        @keyframes atelier-rise-in {
          from { opacity: 0; transform: translate3d(0,20px,0); }
          to { opacity: 1; transform: translate3d(0,0,0); }
        }
        @keyframes atelier-title-in {
          from { opacity: 0; transform: translate3d(0,28px,0) skewY(1.5deg); filter: blur(4px); }
          to { opacity: 1; transform: translate3d(0,0,0) skewY(0); filter: blur(0); }
        }
        @keyframes atelier-globe-in {
          from { opacity: 0; transform: translate3d(0,16px,0) scale(.975); filter: blur(4px); }
          to { opacity: 1; transform: translate3d(0,0,0) scale(1); filter: blur(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .atelier-copy-enter,
          .atelier-kicker-enter,
          .atelier-title-line,
          .atelier-body-enter,
          .atelier-meta-enter,
          .atelier-cta-enter,
          .atelier-globe-enter,
          .atelier-craft-card {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
