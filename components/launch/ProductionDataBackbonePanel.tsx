import { Activity, Database, FileWarning, LockKeyhole, ShieldCheck } from "lucide-react";
import { createTelemetryEventPreview, telemetryReadinessChecklist } from "@/lib/launch/ops-telemetry";
import {
  createProductionDataBackboneSnapshot,
  getProductionDataBackboneSummary,
  productionDataBackboneMatrix,
} from "@/lib/launch/production-data-backbone";

type Surface = "admin" | "account" | "shield" | "checkout" | "ops";

const copy = {
  pl: {
    eyebrow: "production data backbone",
    title: "Teraz spinamy backend, audit ledger, source freshness i telemetry.",
    body: "Ten panel pokazuje realną warstwę produkcyjną: co musi być zapisane po stronie serwera, które źródła mają timestampy, co wolno mierzyć analityką i gdzie nadal jest blokada.",
    average: "średni postęp",
    p0: "P0 otwarte",
    blocked: "blokady",
    next: "następny krok",
    missing: "braki",
    boundary: "granica produkcji",
    telemetry: "safe telemetry preview",
    checklist: "telemetry checklist",
    snapshot: "readiness snapshot",
  },
  de: {
    eyebrow: "production data backbone",
    title: "Jetzt verbinden wir Backend, Audit Ledger, Source Freshness und Telemetrie.",
    body: "Dieses Panel zeigt die echte Produktionsschicht: was serverseitig gespeichert werden muss, welche Quellen Zeitstempel haben, was Analytics messen darf und wo weiterhin Blocker stehen.",
    average: "Durchschnitt",
    p0: "P0 offen",
    blocked: "Blocker",
    next: "nächster Schritt",
    missing: "fehlend",
    boundary: "Produktionsgrenze",
    telemetry: "safe telemetry preview",
    checklist: "telemetry checklist",
    snapshot: "readiness snapshot",
  },
  en: {
    eyebrow: "production data backbone",
    title: "Now we connect backend, audit ledger, source freshness and telemetry.",
    body: "This panel shows the real production layer: what must be stored server-side, which sources have timestamps, what analytics may measure and where launch is still blocked.",
    average: "average progress",
    p0: "P0 open",
    blocked: "blocked",
    next: "next step",
    missing: "missing",
    boundary: "production boundary",
    telemetry: "safe telemetry preview",
    checklist: "telemetry checklist",
    snapshot: "readiness snapshot",
  },
} as const;

function localeCopy(locale: string) {
  if (locale === "pl" || locale === "de") return copy[locale];
  return copy.en;
}

function statusTone(status: string) {
  if (status === "blocked") return "pdb-status-blocked";
  if (status === "manual_review") return "pdb-status-review";
  return "pdb-status-ready";
}

function priorityTone(priority: string) {
  if (priority === "P0") return "pdb-priority-p0";
  if (priority === "P1") return "pdb-priority-p1";
  return "pdb-priority-p2";
}

export default function ProductionDataBackbonePanel({
  locale,
  surface = "ops",
}: {
  locale: string;
  surface?: Surface;
}) {
  const t = localeCopy(locale);
  const summary = getProductionDataBackboneSummary();
  const snapshot = createProductionDataBackboneSnapshot();
  const telemetryPreview = createTelemetryEventPreview("surface_readiness_viewed", {
    surface,
    locale,
    mode: "preview",
    status: summary.p0Open > 0 ? "blocked" : "review",
    target: "production-data-backbone",
    score: summary.averageProgress,
    email: "operator@example.com",
    seedPhrase: "never-store-this",
  });
  const visibleItems = surface === "admin" || surface === "ops"
    ? productionDataBackboneMatrix
    : productionDataBackboneMatrix.filter((item) => item.priority === "P0" || item.area === "source_freshness" || item.area === "analytics");

  const HeroIcon = surface === "shield" ? ShieldCheck : surface === "checkout" ? FileWarning : surface === "account" ? LockKeyhole : Database;

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 md:px-12">
      <div className="pdb-shell">
        <div className="grid gap-8 xl:grid-cols-[0.82fr_1.18fr] xl:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.18] bg-velmere-gold/[0.065] px-3 py-1.5 text-velmere-gold">
              <HeroIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-mono text-[9px] uppercase tracking-[0.18em]">{t.eyebrow}</span>
            </div>
            <h2 className="mt-5 font-serif text-4xl leading-none tracking-[-0.045em] text-white md:text-6xl">{t.title}</h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/[0.58]">{t.body}</p>

            <div className="mt-7 grid grid-cols-3 gap-3">
              <div className="pdb-stat">
                <p>{t.average}</p>
                <strong>{summary.averageProgress}%</strong>
              </div>
              <div className="pdb-stat">
                <p>{t.p0}</p>
                <strong>{summary.p0Open}</strong>
              </div>
              <div className="pdb-stat">
                <p>{t.blocked}</p>
                <strong>{summary.blockedCount}</strong>
              </div>
            </div>

            <div className="mt-5 rounded-[1.25rem] border border-red-300/[0.14] bg-red-500/[0.045] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-red-100/[0.62]">{t.next}</p>
              <p className="mt-2 text-xs leading-6 text-red-100/[0.76]">{summary.nextCriticalStep}</p>
            </div>

            <div className="mt-5 rounded-[1.25rem] border border-white/[0.08] bg-black/[0.22] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-100/[0.54]">{t.snapshot}</p>
              <p className="mt-2 font-mono text-[10px] leading-5 text-white/[0.42]">{snapshot.schemaVersion} · {snapshot.mode}</p>
              <p className="mt-2 text-xs leading-6 text-white/[0.52]">{snapshot.exportNote}</p>
            </div>
          </div>

          <div className="grid gap-3">
            {visibleItems.map((item) => (
              <article key={item.id} className="pdb-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`pdb-priority ${priorityTone(item.priority)}`}>{item.priority}</span>
                      <span className={`pdb-status ${statusTone(item.status)}`}>{item.status.replace("_", " ")}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-white/[0.88]">{item.title}</h3>
                    <p className="mt-2 text-xs leading-6 text-white/[0.56]">{item.promise}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-2xl text-velmere-gold">{item.progress}%</p>
                    <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.30]">{item.area.replace("_", " ")}</p>
                  </div>
                </div>

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <span className="block h-full rounded-full bg-velmere-gold/[0.75]" style={{ width: `${item.progress}%` }} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.07] bg-black/[0.22] p-3">
                    <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">{t.missing}</p>
                    <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-white/[0.52]">
                      {item.missing.map((missing) => <li key={missing}>• {missing}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-black/[0.22] p-3">
                    <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">{t.boundary}</p>
                    <p className="mt-2 text-[11px] leading-5 text-white/[0.52]">{item.productionBoundary}</p>
                  </div>
                </div>
              </article>
            ))}

            <article className="pdb-card pdb-card-telemetry">
              <div className="flex items-center gap-2 text-cyan-100/[0.78]">
                <Activity className="h-4 w-4" aria-hidden="true" />
                <p className="font-mono text-[9px] uppercase tracking-[0.16em]">{t.telemetry}</p>
              </div>
              <p className="mt-3 font-mono text-[10px] leading-5 text-white/[0.48]">{telemetryPreview.schemaVersion} · {telemetryPreview.mode} · {telemetryPreview.name}</p>
              <p className="mt-3 text-xs leading-6 text-white/[0.56]">{telemetryPreview.privacyBoundary}</p>
              <div className="mt-4 rounded-xl border border-cyan-200/[0.10] bg-cyan-300/[0.035] p-3">
                <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-cyan-100/[0.52]">{t.checklist}</p>
                <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-cyan-100/[0.64]">
                  {telemetryReadinessChecklist.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
