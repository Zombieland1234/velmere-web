import { Database, FileClock, LockKeyhole, PackageCheck, ShieldCheck } from "lucide-react";
import {
  createStorageWritePreview,
  getStorageAdapterSummary,
  storageAdapterMatrix,
  type StorageRecordKind,
} from "@/lib/launch/server-storage-adapter";

type Surface = "admin" | "account" | "checkout" | "shield" | "ops";

const copy = {
  pl: {
    eyebrow: "storage adapter readiness",
    title: "Bez durable storage nie ma prawdziwego audytu.",
    body: "Ten panel pokazuje, które zapisy muszą przejść przez server-only adapter: audit events, source snapshots, order timeline, operator cases i telemetry preview.",
    average: "średni postęp",
    p0: "P0 otwarte",
    blocked: "blokady",
    next: "następny krok",
    missing: "blokuje",
    boundary: "granica",
    preview: "write preview",
  },
  de: {
    eyebrow: "storage adapter readiness",
    title: "Ohne Durable Storage gibt es keinen echten Audit.",
    body: "Dieses Panel zeigt, welche Writes über einen server-only Adapter laufen müssen: Audit Events, Source Snapshots, Order Timeline, Operator Cases und Telemetry Preview.",
    average: "Durchschnitt",
    p0: "P0 offen",
    blocked: "Blocker",
    next: "nächster Schritt",
    missing: "blockiert",
    boundary: "Grenze",
    preview: "write preview",
  },
  en: {
    eyebrow: "storage adapter readiness",
    title: "No durable storage means no real audit.",
    body: "This panel shows which writes must go through a server-only adapter: audit events, source snapshots, order timeline, operator cases and telemetry preview.",
    average: "average progress",
    p0: "P0 open",
    blocked: "blocked",
    next: "next step",
    missing: "blocking",
    boundary: "boundary",
    preview: "write preview",
  },
} as const;

function localeCopy(locale: string) {
  if (locale === "pl" || locale === "de") return copy[locale];
  return copy.en;
}

function statusClass(status: string) {
  if (status === "blocked") return "sar-status-blocked";
  if (status === "manual_review") return "sar-status-review";
  return "sar-status-ready";
}

function priorityClass(priority: string) {
  if (priority === "P0") return "sar-priority-p0";
  if (priority === "P1") return "sar-priority-p1";
  return "sar-priority-p2";
}

function iconForKind(kind: StorageRecordKind) {
  if (kind === "audit_event") return ShieldCheck;
  if (kind === "source_snapshot") return Database;
  if (kind === "order_event") return PackageCheck;
  if (kind === "operator_case") return LockKeyhole;
  return FileClock;
}

export default function StorageAdapterReadinessPanel({
  locale,
  surface = "ops",
}: {
  locale: string;
  surface?: Surface;
}) {
  const t = localeCopy(locale);
  const summary = getStorageAdapterSummary();
  const visibleItems =
    surface === "admin" || surface === "ops"
      ? storageAdapterMatrix
      : storageAdapterMatrix.filter((item) => item.priority === "P0" || item.kind === "order_event" || item.kind === "source_snapshot");
  const preview = createStorageWritePreview({
    kind: surface === "checkout" ? "order_event" : surface === "shield" ? "source_snapshot" : "audit_event",
    operatorId: "operator:preview",
    targetId: `${surface}:draft`,
    payload: {
      surface,
      status: summary.p0Open > 0 ? "blocked" : "review",
      token: "secret-will-be-dropped",
      email: "operator@example.com",
      seedPhrase: "never-store",
    },
  });

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 md:px-12">
      <div className="sar-shell">
        <div className="grid gap-8 xl:grid-cols-[0.82fr_1.18fr] xl:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.18] bg-velmere-gold/[0.065] px-3 py-1.5 text-velmere-gold">
              <Database className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-mono text-[9px] uppercase tracking-[0.18em]">{t.eyebrow}</span>
            </div>
            <h2 className="mt-5 font-serif text-4xl leading-none tracking-[-0.045em] text-white md:text-6xl">{t.title}</h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/[0.58]">{t.body}</p>
            <div className="mt-7 grid grid-cols-3 gap-3">
              <div className="sar-stat"><p>{t.average}</p><strong>{summary.averageProgress}%</strong></div>
              <div className="sar-stat"><p>{t.p0}</p><strong>{summary.p0Open}</strong></div>
              <div className="sar-stat"><p>{t.blocked}</p><strong>{summary.blockedCount}</strong></div>
            </div>
            <div className="mt-5 rounded-[1.25rem] border border-red-300/[0.14] bg-red-500/[0.045] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-red-100/[0.62]">{t.next}</p>
              <p className="mt-2 text-xs leading-6 text-red-100/[0.76]">{summary.nextCriticalStep}</p>
            </div>
            <div className="mt-5 rounded-[1.25rem] border border-white/[0.08] bg-black/[0.22] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-100/[0.54]">{t.preview}</p>
              <p className="mt-2 font-mono text-[10px] leading-5 text-white/[0.42]">{preview.schemaVersion} · {preview.mode} · {preview.kind}</p>
              <p className="mt-2 text-xs leading-6 text-white/[0.52]">{preview.productionBoundary}</p>
            </div>
          </div>

          <div className="grid gap-3">
            {visibleItems.map((item) => {
              const Icon = iconForKind(item.kind);
              return (
                <article key={item.id} className="sar-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon className="h-4 w-4 text-velmere-gold" aria-hidden="true" />
                        <span className={`sar-priority ${priorityClass(item.priority)}`}>{item.priority}</span>
                        <span className={`sar-status ${statusClass(item.status)}`}>{item.status.replace("_", " ")}</span>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-white/[0.88]">{item.title}</h3>
                      <p className="mt-2 text-xs leading-6 text-white/[0.56]">{item.serverPromise}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-2xl text-velmere-gold">{item.progress}%</p>
                      <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.30]">{item.kind.replace("_", " ")}</p>
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <span className="block h-full rounded-full bg-velmere-gold/[0.75]" style={{ width: `${item.progress}%` }} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.07] bg-black/[0.22] p-3">
                      <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">{t.missing}</p>
                      <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-white/[0.52]">
                        {item.blockedBy.map((missing) => <li key={missing}>• {missing}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-black/[0.22] p-3">
                      <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">{t.boundary}</p>
                      <p className="mt-2 text-[11px] leading-5 text-white/[0.52]">{item.nextStep}</p>
                      <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.30]">{item.retention}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
