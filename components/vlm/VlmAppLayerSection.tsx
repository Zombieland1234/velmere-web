"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, DoorOpen, MessageSquare, Ruler, ShieldCheck, TicketCheck } from "lucide-react";
import { useLocale } from "next-intl";

const copy = {
  en: {
    kicker: "VELMÈRE APP / ACCESS MODULES",
    title: "Useful modules, not random apps.",
    body: "The app layer is planned as a practical member console: drops, signals, archive access, fit guidance, wallet safety and member passes. Nothing here asks for custody or seed phrases.",
    modules: [
      ["Drop Calendar", "Drop dates, restock windows and quiet reservation reminders."],
      ["Signal Studio", "Square publishing, moderation status and community notes."],
      ["Archive Rooms", "Private lookbooks, old drops and member-only references."],
      ["Fit Advisor", "Size guide, garment measurements and silhouette advice."],
      ["Wallet Safety", "Read-only wallet state, approval warnings and action labels."],
      ["Member Pass", "Account role, access history and eligibility state."],
    ],
  },
  pl: {
    kicker: "VELMÈRE APP / MODUŁY DOSTĘPU",
    title: "Użyteczne moduły, nie losowe aplikacje.",
    body: "Warstwa aplikacji ma działać jak praktyczna konsola membera: dropy, sygnały, archiwum, dobór rozmiaru, bezpieczeństwo portfela i member pass. Nic nie wymaga custody ani seed phrase.",
    modules: [
      ["Drop Calendar", "Daty dropów, okna restocku i ciche przypomnienia rezerwacji."],
      ["Signal Studio", "Publikacja w Square, status moderacji i notatki społeczności."],
      ["Archive Rooms", "Prywatne lookbooki, stare dropy i referencje dla memberów."],
      ["Fit Advisor", "Tabela rozmiarów, wymiary odzieży i podpowiedzi sylwetki."],
      ["Wallet Safety", "Read-only wallet state, ostrzeżenia approval i nazwy akcji."],
      ["Member Pass", "Rola konta, historia dostępu i status eligibility."],
    ],
  },
  de: {
    kicker: "VELMÈRE APP / ACCESS MODULES",
    title: "Nützliche Module, keine zufälligen Apps.",
    body: "Die App-Ebene ist als Member-Konsole geplant: Drops, Signale, Archivzugang, Fit-Hilfe, Wallet-Sicherheit und Member Pass. Keine Custody, keine Seed Phrase.",
    modules: [
      ["Drop Calendar", "Drop-Daten, Restock-Fenster und ruhige Reservierungs-Hinweise."],
      ["Signal Studio", "Square Publishing, Moderationsstatus und Community-Notizen."],
      ["Archive Rooms", "Private Lookbooks, alte Drops und Member-Referenzen."],
      ["Fit Advisor", "Größentabelle, Maße und Silhouetten-Hilfe."],
      ["Wallet Safety", "Read-only Wallet-State, Approval-Warnungen und Aktionslabels."],
      ["Member Pass", "Account-Rolle, Access-Historie und Eligibility-State."],
    ],
  },
} as const;

const icons = [CalendarDays, MessageSquare, DoorOpen, Ruler, ShieldCheck, TicketCheck] as const;

export default function VlmAppLayerSection() {
  const locale = useLocale() as keyof typeof copy;
  const t = copy[locale] ?? copy.en;
  const reduced = useReducedMotion();

  return (
    <section className="luxury-section pb-20">
      <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-stretch">
        <div className="rounded-[2rem] border border-white/[0.10] bg-[#111113] p-6 shadow-velmere-card md:p-8">
          <p className="velmere-label text-velmere-gold">{t.kicker}</p>
          <h2 className="mt-5 max-w-[12ch] font-serif text-5xl leading-[0.9] tracking-[-0.055em] md:text-7xl">
            {t.title}
          </h2>
          <p className="mt-6 max-w-xl text-sm leading-7 text-velmere-muted">{t.body}</p>
          <div className="relative mt-8 h-64 overflow-hidden rounded-[1.5rem] border border-white/[0.10] bg-black/[0.30]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.16),transparent_34%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:auto,38px_38px,38px_38px]" />
            {!reduced ? [0,1,2,3,4,5].map((item) => (
              <motion.span
                key={item}
                className="absolute h-2.5 w-2.5 rounded-full bg-velmere-gold shadow-[0_0_28px_rgba(212,175,55,0.72)]"
                style={{ left: `${18 + item * 13}%`, top: `${28 + ((item * 19) % 40)}%` }}
                animate={{ y: [0, -12, 0], opacity: [0.34, 1, 0.34], scale: [0.75, 1.25, 0.75] }}
                transition={{ repeat: 999999, duration: 2.4 + item * 0.16, ease: "easeInOut" }}
              />
            )) : null}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {t.modules.map(([title, body], index) => {
            const Icon = icons[index % icons.length];
            return (
              <motion.article
                key={title}
                initial={reduced ? false : { opacity: 0, y: 18 }}
                whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.48, delay: index * 0.045, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-[1.5rem] border border-white/[0.10] bg-[#111113] p-5 shadow-velmere-card transition hover:-translate-y-1 hover:border-velmere-gold/[0.24]"
              >
                <Icon className="h-5 w-5 text-velmere-gold" />
                <h3 className="mt-6 font-serif text-2xl leading-tight text-velmere-ivory">{title}</h3>
                <p className="mt-4 text-sm leading-7 text-velmere-muted">{body}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
