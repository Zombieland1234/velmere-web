"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BadgeCheck, Binary, Fingerprint, KeyRound, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { useLocale } from "next-intl";

import { Link } from "@/navigation";

const nodes = [
  [18, 28],
  [34, 62],
  [52, 38],
  [70, 24],
  [78, 66],
  [46, 78],
  [22, 72],
  [62, 52],
] as const;

const copy = {
  pl: {
    kicker: "Prywatny dostęp",
    subtitle: "Konto najpierw · portfel opcjonalnie · bez przechowywania środków",
    inspect: "Pokaż kolejną zasadę bezpieczeństwa",
    steps: [
      { key: "konto", title: "Oddzielone konto", body: "Logowanie nie uruchamia portfela ani podpisu. Każdy krok pozostaje osobną decyzją." },
      { key: "portfel", title: "Portfel opcjonalny", body: "Połączenie portfela pojawia się dopiero przy funkcji Web3, która go wymaga." },
      { key: "zgoda", title: "Jasna nazwa działania", body: "Przed podpisem widzisz dokładną akcję. Velmère nie prosi o seed phrase." },
    ],
  },
  de: {
    kicker: "Privater Zugang",
    subtitle: "Konto zuerst · Wallet optional · keine Verwahrung",
    inspect: "Nächste Sicherheitsregel anzeigen",
    steps: [
      { key: "konto", title: "Getrenntes Konto", body: "Anmeldung startet weder Wallet noch Signatur. Jeder Schritt bleibt sichtbar." },
      { key: "wallet", title: "Wallet optional", body: "Verbindung erscheint erst bei einer Funktion, die sie wirklich benötigt." },
      { key: "freigabe", title: "Klare Bezeichnung", body: "Vor einer Signatur siehst du die genaue Aktion. Velmère fragt nie nach Seed Phrase." },
    ],
  },
  en: {
    kicker: "Private access",
    subtitle: "Account first · wallet optional · no custody",
    inspect: "Show the next security principle",
    steps: [
      { key: "account", title: "Separated account", body: "Signing in does not trigger a wallet or signature. Every step is an independent choice." },
      { key: "wallet", title: "Wallet optional", body: "Wallet connection appears only when a Web3 feature genuinely needs it." },
      { key: "consent", title: "Named action", body: "Before signing, you see the exact intent. Velmère never asks for a seed phrase." },
    ],
  },
} as const;

const securityPackets = [
  { icon: LockKeyhole, label: "session", from: [18, 28], to: [52, 38], delay: 0 },
  { icon: KeyRound, label: "key", from: [22, 72], to: [62, 52], delay: 0.45 },
  { icon: WalletCards, label: "wallet", from: [78, 66], to: [46, 78], delay: 0.9 },
] as const;

export default function LoginSecurityVisual({ returnHomeText }: { returnHomeText?: string }) {
  const locale = useLocale() as keyof typeof copy;
  const t = copy[locale] ?? copy.en;
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const activeStep = t.steps[active] ?? t.steps[0];

  return (
    <div className="w-full relative flex flex-col justify-between overflow-hidden rounded-[1.75rem] border border-white/[0.09] bg-[#080a0d] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] md:p-6 min-h-[460px] lg:min-h-[580px] h-full">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(212,175,55,0.12),transparent_35%),linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:auto,36px_36px,36px_36px]" />
      
      {/* Header */}
      <div className="relative z-[1]">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-white/[0.45] transition hover:text-velmere-gold">
            <span aria-hidden="true">&larr;</span> {returnHomeText ?? "Wróć na stronę główną"}
          </Link>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-velmere-gold/[0.80]">{t.kicker}</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-white/[0.45]">{t.subtitle}</p>
      </div>

      {/* Security Mesh & Fingerprint */}
      <div className="relative z-[1] my-3 h-44 overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-black/[0.24] md:h-48">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <path
            d="M18 28 L52 38 L70 24 L78 66 L46 78 L22 72 L34 62 L18 28 M52 38 L62 52 L78 66 M34 62 L52 38"
            fill="none"
            stroke="rgba(245,240,232,0.18)"
            strokeWidth="0.35"
            strokeDasharray="2 3"
            className={reduced ? undefined : "velmere-dash-flow-slow"}
          />
          <path
            d="M22 72 C40 32, 60 86, 78 66 C60 26, 34 62, 70 24"
            fill="none"
            stroke="rgba(212,175,55,0.42)"
            strokeWidth="0.45"
            strokeDasharray="2 4"
            className={reduced ? undefined : "velmere-dash-flow"}
          />
        </svg>
        {nodes.map(([left, top], index) => (
          <motion.span
            key={`${left}-${top}`}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-velmere-gold/[0.30] bg-velmere-gold shadow-[0_0_20px_rgba(212,175,55,0.55)]"
            style={{ left: `${left}%`, top: `${top}%` }}
            animate={reduced ? undefined : { scale: [0.72, 1.22, 0.72], opacity: [0.35, 1, 0.35] }}
            transition={{ repeat: 999999, duration: 2.4, delay: index * 0.12, ease: "easeInOut" }}
          />
        ))}
        {securityPackets.map((packet) => {
          const Icon = packet.icon;
          return (
            <motion.span
              key={packet.label}
              aria-hidden="true"
              className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-velmere-gold/[0.25] bg-black/[0.70] text-velmere-gold shadow-[0_0_20px_rgba(212,175,55,0.28)] backdrop-blur"
              style={{ left: `${packet.from[0]}%`, top: `${packet.from[1]}%` }}
              animate={reduced ? undefined : { left: [`${packet.from[0]}%`, `${packet.to[0]}%`, `${packet.from[0]}%`], top: [`${packet.from[1]}%`, `${packet.to[1]}%`, `${packet.from[1]}%`], opacity: [0.34, 1, 0.34] }}
              transition={{ repeat: 999999, duration: 4.8, delay: packet.delay, ease: "easeInOut" }}
            >
              <Icon className="h-3 w-3" />
            </motion.span>
          );
        })}
        <motion.button
          type="button"
          onClick={() => setActive((current) => (current + 1) % t.steps.length)}
          className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-velmere-gold/[0.35] bg-black/[0.75] text-velmere-gold shadow-[0_0_40px_rgba(212,175,55,0.20)] transition hover:border-velmere-gold/[0.55] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-velmere-gold active:scale-95"
          animate={reduced ? undefined : { rotate: [0, 6, -4, 0], scale: [1, 1.03, 1] }}
          transition={{ repeat: 999999, duration: 5.2, ease: "easeInOut" }}
          aria-label={t.inspect}
        >
          <Fingerprint className="h-6 w-6" />
        </motion.button>
      </div>

      {/* 3 Steps Control */}
      <div className="relative z-[1] grid grid-cols-3 gap-2">
        {t.steps.map((step, index) => (
          <button
            type="button"
            key={step.key}
            onClick={() => setActive(index)}
            aria-pressed={active === index}
            className={`rounded-xl border px-2.5 py-2 text-left transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-velmere-gold active:scale-[0.98] ${active === index ? "border-velmere-gold/[0.35] bg-velmere-gold/[0.09]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]"}`}
          >
            <div className="flex items-center gap-1.5">
              {index === 0 ? <Binary className="h-3 w-3 text-velmere-gold" /> : <BadgeCheck className="h-3 w-3 text-velmere-gold" />}
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.68]">{step.key}</p>
            </div>
            <p className="mt-1 truncate text-[11px] font-medium text-white/[0.78]">{step.title}</p>
          </button>
        ))}
      </div>

      {/* Step Detail Explanation */}
      <div className="relative z-[1] mt-2.5 min-h-[4.5rem]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-velmere-gold/[0.16] bg-velmere-gold/[0.06] p-3"
          >
            <div className="flex items-start gap-2.5">
              <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-velmere-gold" />
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-velmere-gold">{activeStep.title}</p>
                <p className="mt-1 text-xs leading-5 text-white/[0.56]">{activeStep.body}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
