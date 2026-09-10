"use client";

import { AlertTriangle, CheckCircle2, FileSignature, Network, ShieldCheck, WalletCards } from "lucide-react";
import { useLocale } from "next-intl";

const copy = {
  en: {
    kicker: "WALLET SAFETY",
    title: "Before any wallet action, the interface must explain what happens.",
    body: "VLM is read-only in this build. No purchase, approval or claim is live until a verified contract, audit link and legal review are published.",
    items: [
      ["Connect wallet", "Reads public address and network only. No asset movement."],
      ["Sign message", "Proves ownership. It must show the exact message before signing."],
      ["Approve token", "Allows a contract to spend tokens. Disabled until contract registry is verified."],
      ["Send transaction", "Moves assets onchain. Disabled in this preview build."],
    ],
    risk: "Never enter a seed phrase. Velmère will never ask for private keys.",
  },
  pl: {
    kicker: "BEZPIECZEŃSTWO PORTFELA",
    title: "Przed każdą akcją wallet UI musi wyjaśniać, co się stanie.",
    body: "VLM w tej wersji jest tylko podglądem read-only. Zakup, approval i claim nie są aktywne, dopóki nie ma zweryfikowanego kontraktu, audytu i przeglądu prawnego.",
    items: [
      ["Połącz portfel", "Odczytuje tylko publiczny adres i sieć. Bez ruchu aktywów."],
      ["Podpisz wiadomość", "Potwierdza własność. UI musi pokazać dokładną treść przed podpisem."],
      ["Zatwierdź token", "Daje kontraktowi prawo użycia tokenów. Wyłączone do czasu weryfikacji rejestru."],
      ["Wyślij transakcję", "Przenosi aktywa onchain. Wyłączone w tej wersji podglądowej."],
    ],
    risk: "Nigdy nie wpisuj seed phrase. Velmère nigdy nie poprosi o klucze prywatne.",
  },
  de: {
    kicker: "WALLET-SICHERHEIT",
    title: "Vor jeder Wallet-Aktion muss das Interface erklären, was passiert.",
    body: "VLM ist in diesem Build read-only. Kauf, Approval oder Claim sind nicht live, bis Vertrag, Audit-Link und Rechtsprüfung veröffentlicht sind.",
    items: [
      ["Wallet verbinden", "Liest nur öffentliche Adresse und Netzwerk. Keine Asset-Bewegung."],
      ["Nachricht signieren", "Beweist Besitz. Die exakte Nachricht muss vor dem Signieren sichtbar sein."],
      ["Token freigeben", "Erlaubt einem Vertrag Token auszugeben. Bis zur Registry-Prüfung deaktiviert."],
      ["Transaktion senden", "Bewegt Assets onchain. In diesem Preview-Build deaktiviert."],
    ],
    risk: "Gib niemals eine Seed Phrase ein. Velmère fragt nie nach privaten Schlüsseln.",
  },
} as const;

export default function WalletSafetyExplainer({ variant = "compact" }: { variant?: "compact" | "full" }) {
  const locale = useLocale() as keyof typeof copy;
  const t = copy[locale] ?? copy.en;
  const icons = [WalletCards, FileSignature, ShieldCheck, Network];
  return (
    <section className={`overflow-hidden rounded-[2rem] border border-white/[0.10] bg-[#111113] shadow-velmere-card ${variant === "full" ? "p-6 md:p-8" : "p-5"}`}>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-velmere-gold/[0.25] bg-velmere-gold/[0.10] text-velmere-gold">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="velmere-label text-velmere-gold">{t.kicker}</p>
          <h3 className="mt-3 max-w-3xl font-serif text-3xl leading-[0.95] tracking-[-0.035em] text-velmere-ivory md:text-5xl">{t.title}</h3>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-velmere-muted">{t.body}</p>
        </div>
      </div>
      <div className="mt-7 grid gap-3 md:grid-cols-4">
        {t.items.map(([label, body], index) => {
          const Icon = icons[index] ?? CheckCircle2;
          return (
            <div key={label} className="rounded-2xl border border-white/[0.10] bg-black/[0.24] p-4">
              <Icon className="h-4 w-4 text-velmere-gold" aria-hidden="true" />
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-ivory">{label}</p>
              <p className="mt-2 text-xs leading-6 text-velmere-muted">{body}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-velmere-danger/[0.20] bg-velmere-danger/[0.10] p-4 text-xs leading-6 text-red-100/[0.80]">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t.risk}</span>
      </div>
    </section>
  );
}
