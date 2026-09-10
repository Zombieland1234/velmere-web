"use client";

import { getAdminEnvironmentGateLaunchNote, type AdminEnvironmentGateSnapshot } from "@/lib/launch/admin-environment-gate";

type Props = {
  locale: string;
  gate: AdminEnvironmentGateSnapshot;
};

const copy = {
  pl: {
    eyebrow: "admin tools locked",
    title: "Import produktów jest schowany za environment gate.",
    body: "Ten ekran nie pokazuje formularzy importu, publikacji ani provider sync, dopóki admin tools nie są jawnie odblokowane w bezpiecznym środowisku. To nie jest finalny auth — to dodatkowa warstwa launch-control.",
    status: "status",
    env: "środowisko",
    reason: "powód blokady",
    next: "następny krok",
    note: "notatka bezpieczeństwa",
  },
  de: {
    eyebrow: "admin tools locked",
    title: "Produktimport liegt hinter einem Environment Gate.",
    body: "Dieser Screen zeigt keine Import-, Publish- oder Provider-Sync-Tools, bis Admin Tools in einer sicheren Umgebung explizit freigeschaltet sind. Das ist noch kein finales Auth — nur eine zusätzliche Launch-Control-Schicht.",
    status: "Status",
    env: "Umgebung",
    reason: "Sperrgrund",
    next: "nächster Schritt",
    note: "Sicherheitsnotiz",
  },
  en: {
    eyebrow: "admin tools locked",
    title: "Product import is hidden behind an environment gate.",
    body: "This screen does not show import forms, publish actions or provider sync tools until admin tools are explicitly unlocked in a safe environment. This is not final auth — it is an extra launch-control layer.",
    status: "status",
    env: "environment",
    reason: "lock reason",
    next: "next step",
    note: "safety note",
  },
} as const;

function localeCopy(locale: string) {
  if (locale === "pl" || locale === "de") return copy[locale];
  return copy.en;
}

export default function AdminToolsLockedPanel({ locale, gate }: Props) {
  const t = localeCopy(locale);
  return (
    <section className="rounded-[2rem] border border-red-400/[0.18] bg-red-500/[0.045] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.32)] md:p-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-red-100/[0.72]">{t.eyebrow}</p>
      <h1 className="mt-5 max-w-4xl font-serif text-4xl leading-tight tracking-[-0.04em] text-white md:text-6xl">{t.title}</h1>
      <p className="mt-5 max-w-3xl text-sm leading-7 text-white/[0.62]">{t.body}</p>

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-black/[0.22] p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.36]">{t.status}</p>
          <p className="mt-2 font-mono text-xl uppercase text-white">{gate.status}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-black/[0.22] p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.36]">{t.env}</p>
          <p className="mt-2 font-mono text-xl uppercase text-white">{gate.activeEnvironment}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-black/[0.22] p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.36]">source</p>
          <p className="mt-2 font-mono text-xl uppercase text-white">{gate.sourceMode}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-black/[0.22] p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-velmere-gold/[0.82]">{t.reason}</p>
          <p className="mt-3 text-sm leading-7 text-white/[0.58]">{gate.reasons.join(" · ")}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-black/[0.22] p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-velmere-gold/[0.82]">{t.next}</p>
          <p className="mt-3 text-sm leading-7 text-white/[0.58]">{gate.nextStep}</p>
        </div>
      </div>

      <p className="mt-5 rounded-2xl border border-velmere-gold/[0.16] bg-velmere-gold/[0.055] p-4 text-xs leading-6 text-velmere-gold/[0.82]">
        {t.note}: {getAdminEnvironmentGateLaunchNote()}
      </p>
    </section>
  );
}
