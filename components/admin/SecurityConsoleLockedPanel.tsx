import { LockKeyhole, ShieldAlert } from "lucide-react";
import { buildSecurityAdminGateReadiness } from "@/lib/security/security-admin-auth";

type Locale = "pl" | "de" | "en";

const copy = {
  pl: {
    eyebrow: "admin security gate",
    title: "Security Console jest zablokowana do czasu server auth.",
    body: "To celowe. Panel bezpieczeństwa pokazuje eventy, alerty i eksport, więc publiczna trasa nie może ujawniać danych operacyjnych. Ustaw server-side gate i token zanim odblokujesz widok.",
    missing: "brakuje",
    next: "następny krok",
    boundary: "granica",
  },
  de: {
    eyebrow: "admin security gate",
    title: "Security Console bleibt bis Server Auth gesperrt.",
    body: "Absichtlich. Die Security Console zeigt Events, Alerts und Export, daher darf die öffentliche Route keine operativen Daten zeigen. Richte Server Gate und Token ein, bevor du sie öffnest.",
    missing: "fehlend",
    next: "nächster Schritt",
    boundary: "Grenze",
  },
  en: {
    eyebrow: "admin security gate",
    title: "Security Console is locked until server auth is ready.",
    body: "This is intentional. The console shows events, alerts and export, so the public route must not reveal operational data. Configure the server-side gate and token before unlocking it.",
    missing: "missing",
    next: "next step",
    boundary: "boundary",
  },
} as const;

function resolveLocale(locale: string): Locale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

export default function SecurityConsoleLockedPanel({ locale }: { locale: string }) {
  const c = copy[resolveLocale(locale)];
  const gate = buildSecurityAdminGateReadiness();

  return (
    <main className="min-h-screen bg-velmere-black px-6 py-20 text-white md:px-12">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-red-300/[0.16] bg-red-500/[0.045] p-6 md:p-9">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-200/[0.16] bg-black/[0.18] px-3 py-1.5 text-red-100/[0.78]">
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-mono text-[9px] uppercase tracking-[0.18em]">{c.eyebrow}</span>
        </div>
        <h1 className="mt-5 font-serif text-4xl leading-none tracking-[-0.045em] md:text-6xl">{c.title}</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-white/[0.62]">{c.body}</p>

        <div className="mt-7 grid gap-3 md:grid-cols-2">
          <article className="rounded-[1.25rem] border border-white/[0.09] bg-black/[0.24] p-4">
            <div className="flex items-center gap-2 text-velmere-gold">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              <p className="font-mono text-[9px] uppercase tracking-[0.16em]">{c.missing}</p>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-6 text-white/[0.58]">
              {gate.missing.length ? gate.missing.map((item) => <li key={item}>• {item}</li>) : <li>• gate configured but console visibility is disabled</li>}
            </ul>
          </article>
          <article className="rounded-[1.25rem] border border-white/[0.09] bg-black/[0.24] p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-velmere-gold">{c.next}</p>
            <p className="mt-3 text-xs leading-6 text-white/[0.58]">{gate.nextCriticalStep}</p>
            <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.32]">
              status · {gate.status} · console visible {String(gate.consoleVisible)}
            </p>
          </article>
        </div>

        <p className="mt-5 rounded-[1rem] border border-white/[0.08] bg-black/[0.20] p-4 text-xs leading-6 text-white/[0.48]">
          {c.boundary}: {gate.productionBoundary}
        </p>
      </section>
    </main>
  );
}
