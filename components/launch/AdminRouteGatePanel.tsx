"use client";

import { adminRouteGateMatrix, getAdminRouteGateSummary } from "@/lib/launch/admin-route-gate";

type Props = {
  locale: string;
  surface: "admin" | "ops";
};

const copy = {
  pl: {
    eyebrow: "admin route gate",
    title: "Admin tooling musi być prywatne i zablokowane przed publicznym startem.",
    body: "Ta warstwa pilnuje auth, environment gate, publish permission, audit trail i redakcji sekretów. Import produktów nie może działać jak publiczna funkcja klienta.",
    average: "średni postęp",
    blocked: "blokery",
    review: "review",
    next: "następny krok",
    promise: "co widzi operator",
    boundary: "granica bezpieczeństwa",
    blockers: "braki",
  },
  de: {
    eyebrow: "admin route gate",
    title: "Admin-Tools müssen vor öffentlichem Start privat und gesperrt sein.",
    body: "Diese Ebene prüft Auth, Environment Gate, Publish Permission, Audit Trail und Secret-Redaktion. Produktimport darf nicht wie eine Kundenfunktion wirken.",
    average: "Durchschnitt",
    blocked: "Blocker",
    review: "Review",
    next: "nächster Schritt",
    promise: "Operator-Versprechen",
    boundary: "Sicherheitsgrenze",
    blockers: "fehlend",
  },
  en: {
    eyebrow: "admin route gate",
    title: "Admin tooling must stay private and gated before public launch.",
    body: "This layer tracks auth, environment gate, publish permission, audit trail and secret redaction. Product import must not behave like a customer feature.",
    average: "average progress",
    blocked: "blocked",
    review: "review",
    next: "next step",
    promise: "operator promise",
    boundary: "safety boundary",
    blockers: "missing",
  },
} as const;

function localeCopy(locale: string) {
  if (locale === "pl" || locale === "de") return copy[locale];
  return copy.en;
}

function tone(status: string) {
  if (status === "blocked") return "border-red-400/20 bg-red-500/[0.045] text-red-100/75";
  if (status === "manual_review") return "border-velmere-gold/25 bg-velmere-gold/[0.055] text-velmere-gold";
  if (status === "ready") return "border-emerald-300/20 bg-emerald-400/[0.045] text-emerald-100/70";
  return "border-cyan-300/18 bg-cyan-400/[0.035] text-cyan-100/65";
}

export default function AdminRouteGatePanel({ locale, surface }: Props) {
  const t = localeCopy(locale);
  const summary = getAdminRouteGateSummary();
  const visibleItems = adminRouteGateMatrix.filter((item) => {
    if (surface === "admin") return ["admin-auth", "environment-gate", "publish-permission", "import-audit", "secret-redaction", "public-route-fallback"].includes(item.id);
    return ["admin-auth", "environment-gate", "import-audit", "secret-redaction"].includes(item.id);
  });

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 md:px-12">
      <div className="rounded-[2rem] border border-white/[0.10] bg-white/[0.025] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.32)] md:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.45fr]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-velmere-gold">{t.eyebrow}</p>
            <h2 className="mt-5 max-w-2xl font-serif text-3xl leading-tight tracking-[-0.04em] text-white md:text-5xl">{t.title}</h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/[0.58]">{t.body}</p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/[0.08] bg-black/[0.22] p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.36]">{t.average}</p>
                <p className="mt-2 font-mono text-xl text-white">{summary.averageProgress}%</p>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-black/[0.22] p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.36]">{t.blocked}</p>
                <p className="mt-2 font-mono text-xl text-white">{summary.blockedCount}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-black/[0.22] p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.36]">{t.review}</p>
                <p className="mt-2 font-mono text-xl text-white">{summary.reviewCount}</p>
              </div>
            </div>
            <p className="mt-5 rounded-2xl border border-velmere-gold/[0.16] bg-velmere-gold/[0.055] p-4 text-xs leading-6 text-velmere-gold/[0.82]">
              {t.next}: {summary.nextCriticalStep}
            </p>
          </div>

          <div className="grid gap-3">
            {visibleItems.map((item) => (
              <article key={item.id} className="rounded-[1.35rem] border border-white/[0.08] bg-black/[0.22] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.34]">{item.route} · {item.sourceMode}</p>
                    <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white">{item.label}</h3>
                  </div>
                  <span className={`rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${tone(item.status)}`}>
                    {item.status.replaceAll("_", " ")} · {item.progress}%
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                    <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-velmere-gold/[0.72]">{t.promise}</p>
                    <p className="mt-2 text-xs leading-6 text-white/[0.56]">{item.operatorPromise}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                    <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-velmere-gold/[0.72]">{t.boundary}</p>
                    <p className="mt-2 text-xs leading-6 text-white/[0.56]">{item.safetyBoundary}</p>
                  </div>
                </div>
                <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.34]">
                  {t.blockers}: {item.blockers.join(" · ")}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
