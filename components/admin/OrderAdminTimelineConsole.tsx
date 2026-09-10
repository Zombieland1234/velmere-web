"use client";


import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { buildAdminSupportClipboardSummary, copyAdminSupportSummary } from "@/lib/security/browser-system-clipboard";
import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Copy, DatabaseZap, Loader2, PackageCheck, RefreshCw, Search, ShieldAlert } from "lucide-react";
import OrderProviderFulfilmentRetryPanel from "@/components/admin/OrderProviderFulfilmentRetryPanel";

type OrderEventSeverity = "info" | "review" | "warning" | "error";
type OrderEventStage = "checkout" | "payment" | "provider" | "fulfilment" | "support" | "audit";

type OrderEventReceipt = {
  schemaVersion: "velmere.order-event-ledger.v1";
  eventId: string;
  idempotencyKey: string;
  caseId: string;
  orderDraftId: string;
  stripeSessionId?: string;
  stripeEventId?: string;
  providerOrderId?: string;
  providerReservationId?: string;
  createdAt: string;
  eventType: string;
  stage: OrderEventStage;
  actor: string;
  sourceRoute: string;
  severity: OrderEventSeverity;
  statusBefore?: string;
  statusAfter?: string;
  progress: number;
  customerSafeLabel: string;
  operatorLabel: string;
  nextExpectedEvents: string[];
  lineItemCount: number;
  productIds: string[];
  providerIds: string[];
  receiptIds: {
    checkoutGuardReceiptId?: string;
    stockReservationReceiptId?: string;
    providerReservationId?: string;
  };
  reasonCodes: string[];
  evidence: Record<string, unknown>;
  checksum: string;
};

type OrderTimelineSummary = {
  schemaVersion: "velmere.order-event-timeline-summary.v1";
  orderDraftId: string;
  caseId: string;
  generatedAt: string;
  eventCount: number;
  latestStatus?: string;
  currentStage?: OrderEventStage;
  paymentConfirmed: boolean;
  providerDraftCreated: boolean;
  fulfilmentPending: boolean;
  failed: boolean;
  nextExpectedEvents: string[];
  timeline: OrderEventReceipt[];
  customerSafeBoundary: string;
};

type OrderEventAdminSnapshot = {
  schemaVersion: string;
  generatedAt: string;
  readiness: {
    mode: string;
    durableStorageReady: boolean;
    storageMode: string;
    storageProvider: string;
    pendingStorageWriteCount: number;
    eventCount: number;
    orderCount: number;
    productionBoundary: string;
  };
  storageReadiness: {
    mode: string;
    provider: string;
    hasUpstashUrl: boolean;
    hasUpstashToken: boolean;
    ledgerKeyConfigured: boolean;
    orderTimelinePrefixConfigured: boolean;
    pendingWriteCount: number;
    recentFailureCount: number;
    memoryEventCount: number;
    durableStorageReady: boolean;
    productionBoundary: string;
  };
  orderTimeline: OrderTimelineSummary | null;
  durableOrderTimeline: OrderEventReceipt[] | null;
  recentEvents: OrderEventReceipt[];
  durableRecentEvents: OrderEventReceipt[];
  productionBoundary: string;
};

type LoadState = "idle" | "loading" | "ready" | "error";
type StageFilter = "all" | OrderEventStage;

const copy = {
  pl: {
    eyebrow: "admin / order timeline",
    title: "Order timeline console",
    body: "Operator widzi gdzie stanęło zamówienie: checkout, płatność, provider, fulfilment lub support. Panel pokazuje tylko bezpieczne receipt IDs i redacted evidence — bez danych klienta i sekretów.",
    token: "Admin token",
    orderId: "Order draft ID",
    limit: "limit",
    loadRecent: "Załaduj ostatnie",
    loadOrder: "Załaduj zamówienie",
    loading: "czytam ledger…",
    noData: "Brak eventów w aktualnym runtime/storage. Po testowym checkout pojawi się timeline.",
    storage: "storage",
    durable: "durable",
    memory: "memory",
    pending: "pending writes",
    failures: "storage failures",
    events: "eventy",
    orders: "zamówienia",
    recent: "ostatnie eventy",
    timeline: "timeline zamówienia",
    supportPacket: "support-safe packet",
    next: "następne oczekiwane",
    blockers: "reason codes",
    receipts: "receipts",
    evidence: "redacted evidence",
    select: "otwórz timeline",
    refresh: "odśwież",
    all: "all",
    source: "source",
    boundary: "granica",
    copyId: "kopiuj ID",
    error: "Nie udało się pobrać order ledger.",
    authHint: "Endpoint wymaga tego samego ADMIN_IMPORT_TOKEN, którego używasz w imporcie produktów.",
  },
  de: {
    eyebrow: "admin / order timeline",
    title: "Order timeline console",
    body: "Der Operator sieht, wo eine Bestellung steht: Checkout, Zahlung, Provider, Fulfilment oder Support. Das Panel zeigt nur sichere Receipt IDs und redacted Evidence — keine Kundendaten und keine Secrets.",
    token: "Admin token",
    orderId: "Order draft ID",
    limit: "Limit",
    loadRecent: "Letzte laden",
    loadOrder: "Bestellung laden",
    loading: "Ledger wird gelesen…",
    noData: "Keine Events im aktuellen Runtime/Storage. Nach einem Test-Checkout erscheint die Timeline.",
    storage: "Storage",
    durable: "durable",
    memory: "memory",
    pending: "pending writes",
    failures: "storage failures",
    events: "Events",
    orders: "Bestellungen",
    recent: "letzte Events",
    timeline: "Bestell-Timeline",
    supportPacket: "support-safe packet",
    next: "nächste erwartet",
    blockers: "reason codes",
    receipts: "receipts",
    evidence: "redacted evidence",
    select: "Timeline öffnen",
    refresh: "aktualisieren",
    all: "all",
    source: "source",
    boundary: "Grenze",
    copyId: "ID kopieren",
    error: "Order Ledger konnte nicht geladen werden.",
    authHint: "Der Endpoint nutzt denselben ADMIN_IMPORT_TOKEN wie der Produktimport.",
  },
  en: {
    eyebrow: "admin / order timeline",
    title: "Order timeline console",
    body: "Operators can see where an order stopped: checkout, payment, provider, fulfilment or support. The panel shows only safe receipt IDs and redacted evidence — no customer data and no secrets.",
    token: "Admin token",
    orderId: "Order draft ID",
    limit: "limit",
    loadRecent: "Load recent",
    loadOrder: "Load order",
    loading: "reading ledger…",
    noData: "No events in the current runtime/storage yet. A test checkout will populate the timeline.",
    storage: "storage",
    durable: "durable",
    memory: "memory",
    pending: "pending writes",
    failures: "storage failures",
    events: "events",
    orders: "orders",
    recent: "recent events",
    timeline: "order timeline",
    supportPacket: "support-safe packet",
    next: "next expected",
    blockers: "reason codes",
    receipts: "receipts",
    evidence: "redacted evidence",
    select: "open timeline",
    refresh: "refresh",
    all: "all",
    source: "source",
    boundary: "boundary",
    copyId: "copy ID",
    error: "Could not load order ledger.",
    authHint: "This endpoint uses the same ADMIN_IMPORT_TOKEN as product import.",
  },
} as const;

function localeCopy(locale: string) {
  if (locale === "pl" || locale === "de") return copy[locale];
  return copy.en;
}

function toneForSeverity(severity: string) {
  if (severity === "error") return "border-red-400/25 bg-red-500/[0.065] text-red-100";
  if (severity === "warning") return "border-amber-300/25 bg-amber-400/[0.065] text-amber-100";
  if (severity === "review") return "border-velmere-gold/25 bg-velmere-gold/[0.075] text-velmere-gold";
  return "border-emerald-300/20 bg-emerald-400/[0.055] text-emerald-100";
}

function stageTone(stage: string) {
  if (stage === "payment") return "border-cyan-300/20 bg-cyan-400/[0.045] text-cyan-100";
  if (stage === "provider") return "border-purple-300/20 bg-purple-400/[0.045] text-purple-100";
  if (stage === "fulfilment") return "border-emerald-300/20 bg-emerald-400/[0.045] text-emerald-100";
  if (stage === "support") return "border-velmere-gold/25 bg-velmere-gold/[0.055] text-velmere-gold";
  return "border-white/[0.12] bg-white/[0.035] text-white/[0.72]";
}

function OrderEventIcon({ eventType, className }: { eventType: string; className: string }) {
  if (eventType.includes("payment")) return <CheckCircle2 className={className} aria-hidden="true" />;
  if (eventType.includes("provider") || eventType.includes("fulfilment")) return <PackageCheck className={className} aria-hidden="true" />;
  if (eventType.includes("failed") || eventType.includes("manual") || eventType.includes("unsupported")) return <ShieldAlert className={className} aria-hidden="true" />;
  return <Clock3 className={className} aria-hidden="true" />;
}

function shortId(value: string | undefined, length = 16) {
  if (!value) return "—";
  return value.length <= length ? value : `${value.slice(0, Math.floor(length / 2))}…${value.slice(-Math.floor(length / 2))}`;
}

function formatDate(value: string | undefined) {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function uniqueOrderIds(events: OrderEventReceipt[]) {
  return Array.from(new Set(events.map((event) => event.orderDraftId).filter(Boolean))).slice(0, 24);
}

function orderHealth(timeline: OrderEventReceipt[]) {
  if (timeline.some((event) => event.severity === "error" || event.eventType.includes("failed"))) return "error";
  if (timeline.some((event) => event.eventType === "manual_fulfilment_required")) return "review";
  if (timeline.some((event) => event.eventType === "fulfilled")) return "done";
  return "progress";
}

function buildSupportPacket(events: OrderEventReceipt[], summary: OrderTimelineSummary | null) {
  const latest = events[events.length - 1];
  return {
    orderDraftId: summary?.orderDraftId ?? latest?.orderDraftId ?? "",
    caseId: summary?.caseId ?? latest?.caseId ?? "",
    latestEvent: latest?.eventType ?? null,
    latestStatus: latest?.statusAfter ?? summary?.latestStatus ?? null,
    nextExpectedEvents: latest?.nextExpectedEvents ?? summary?.nextExpectedEvents ?? [],
    receiptIds: latest?.receiptIds ?? {},
    reasonCodes: Array.from(new Set(events.flatMap((event) => event.reasonCodes ?? []))).slice(0, 30),
    productIds: Array.from(new Set(events.flatMap((event) => event.productIds ?? []))).slice(0, 30),
    providerIds: Array.from(new Set(events.flatMap((event) => event.providerIds ?? []))).slice(0, 30),
    redactionBoundary: "No raw customer PII, provider payloads, auth headers, webhook signatures or secrets.",
  };
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/[0.24] p-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.36]">{label}</p>
      <p className="mt-2 font-mono text-xl text-white">{value}</p>
      {detail ? <p className="mt-2 text-[11px] leading-5 text-white/[0.46]">{detail}</p> : null}
    </div>
  );
}

function EventRow({ event, onOpen, label }: { event: OrderEventReceipt; onOpen: (orderDraftId: string) => void; label: string }) {
  return (
    <article className="rounded-[1.35rem] border border-white/[0.08] bg-white/[0.025] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.20)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-black/[0.26]">
            <OrderEventIcon eventType={event.eventType} className="h-4 w-4 text-velmere-gold" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] ${stageTone(event.stage)}`}>{event.stage}</span>
              <span className={`rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] ${toneForSeverity(event.severity)}`}>{event.severity}</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.36]">{formatDate(event.createdAt)}</span>
            </div>
            <h3 className="mt-2 break-words text-sm font-semibold tracking-[-0.02em] text-white">{event.eventType}</h3>
            <p className="mt-1 text-xs leading-6 text-white/[0.56]">{event.customerSafeLabel}</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.32]">{shortId(event.orderDraftId, 26)} · {shortId(event.eventId, 22)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpen(event.orderDraftId)}
          className="rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.06] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-velmere-gold transition hover:bg-velmere-gold/[0.12]"
        >
          {label}
        </button>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-velmere-gold/[0.72]" style={{ width: `${Math.max(4, Math.min(event.progress, 100))}%` }} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] bg-black/[0.20] p-3">
          <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.34]">status</p>
          <p className="mt-2 text-xs text-white/[0.62]">{event.statusBefore ?? "—"} → {event.statusAfter ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-black/[0.20] p-3">
          <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.34]">actor / source</p>
          <p className="mt-2 text-xs text-white/[0.62]">{event.actor} · {event.sourceRoute}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-black/[0.20] p-3">
          <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.34]">items / products</p>
          <p className="mt-2 text-xs text-white/[0.62]">{event.lineItemCount} · {event.productIds.map((id) => shortId(id, 12)).join(", ") || "—"}</p>
        </div>
      </div>
    </article>
  );
}

function TimelineEvent({ event, isLast }: { event: OrderEventReceipt; isLast: boolean }) {
  return (
    <div className="relative grid gap-4 md:grid-cols-[8rem_1fr]">
      {!isLast ? <div className="absolute left-5 top-11 h-[calc(100%-1.25rem)] w-px bg-white/[0.08] md:left-[9.25rem]" /> : null}
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.34] md:text-right">{formatDate(event.createdAt)}</div>
      <article className="relative rounded-[1.35rem] border border-white/[0.08] bg-black/[0.22] p-4">
        <div className="absolute -left-1 top-4 hidden h-10 w-10 items-center justify-center rounded-full border border-white/[0.10] bg-black text-velmere-gold md:flex">
          <OrderEventIcon eventType={event.eventType} className="h-4 w-4" />
        </div>
        <div className="md:pl-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] ${stageTone(event.stage)}`}>{event.stage}</span>
            <span className={`rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] ${toneForSeverity(event.severity)}`}>{event.severity}</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.34]">{event.progress}%</span>
          </div>
          <h3 className="mt-3 text-base font-semibold tracking-[-0.03em] text-white">{event.eventType}</h3>
          <p className="mt-1 text-xs leading-6 text-white/[0.56]">{event.customerSafeLabel}</p>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-velmere-gold/[0.70]">{event.operatorLabel}</p>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.34]">receipts</p>
              <p className="mt-2 break-words text-[11px] leading-5 text-white/[0.55]">
                checkout: {shortId(event.receiptIds.checkoutGuardReceiptId, 20)}<br />
                stock: {shortId(event.receiptIds.stockReservationReceiptId, 20)}<br />
                provider: {shortId(event.receiptIds.providerReservationId, 20)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.34]">reason codes</p>
              <p className="mt-2 break-words text-[11px] leading-5 text-white/[0.55]">{event.reasonCodes.join(" · ") || "—"}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.34]">next</p>
              <p className="mt-2 break-words text-[11px] leading-5 text-white/[0.55]">{event.nextExpectedEvents.join(" · ") || "—"}</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

export default function OrderAdminTimelineConsole({ locale }: { locale: string }) {
  const t = localeCopy(locale);
  const [token, setToken] = useState("");
  const [orderDraftId, setOrderDraftId] = useState("");
  const [limit, setLimit] = useState(80);
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [state, setState] = useState<LoadState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<OrderEventAdminSnapshot | null>(null);
  const [copied, setCopied] = useState(false);

  const allRecentEvents = useMemo(() => {
    const events = [...(snapshot?.recentEvents ?? []), ...(snapshot?.durableRecentEvents ?? [])];
    const seen = new Set<string>();
    return events.filter((event) => {
      if (seen.has(event.eventId)) return false;
      seen.add(event.eventId);
      return true;
    });
  }, [snapshot]);

  const visibleRecentEvents = useMemo(() => {
    return allRecentEvents.filter((event) => stageFilter === "all" || event.stage === stageFilter);
  }, [allRecentEvents, stageFilter]);

  const timelineEvents = useMemo(() => {
    const fromDurable = snapshot?.durableOrderTimeline ?? [];
    const fromMemory = snapshot?.orderTimeline?.timeline ?? [];
    const seen = new Set<string>();
    return [...fromMemory, ...fromDurable]
      .filter((event) => {
        if (seen.has(event.eventId)) return false;
        seen.add(event.eventId);
        return true;
      })
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }, [snapshot]);

  const recentOrderIds = useMemo(() => uniqueOrderIds(allRecentEvents), [allRecentEvents]);
  const health = orderHealth(timelineEvents);
  const supportPacket = useMemo(() => buildSupportPacket(timelineEvents, snapshot?.orderTimeline ?? null), [snapshot, timelineEvents]);
  const supportClipboardPacket = useMemo(() => buildAdminSupportClipboardSummary(supportPacket), [supportPacket]);
  const activeTimelineOrderDraftId = orderDraftId || snapshot?.orderTimeline?.orderDraftId || timelineEvents[0]?.orderDraftId || "";

  const loadLedger = async (nextOrderDraftId = orderDraftId) => {
    setState("loading");
    setMessage(null);
    try {
      const params = new URLSearchParams({ limit: String(Math.max(20, Math.min(limit, 200))) });
      if (nextOrderDraftId.trim()) params.set("orderDraftId", nextOrderDraftId.trim());
      const response = await fetch(`/api/admin/orders/event-ledger?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-admin-import-token": token,
        },
        cache: "no-store",
      });
      const data = await readJsonResponseBounded<OrderEventAdminSnapshot | { error?: string }>(response, 2 * 1024 * 1024).catch(() => null);
      if (!response.ok) throw new Error((data && "error" in data && data.error) || t.error);
      setSnapshot(data as OrderEventAdminSnapshot);
      setState("ready");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : t.error);
    }
  };

  const submitOrderSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadLedger(orderDraftId);
  };

  const openOrder = (id: string) => {
    setOrderDraftId(id);
    void loadLedger(id);
  };

  const copySupportPacket = async () => {
    try {
      await copyAdminSupportSummary(supportPacket);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-10 text-white md:px-10">
      <section className="mx-auto max-w-7xl rounded-[2.4rem] border border-white/[0.10] bg-[radial-gradient(circle_at_top_left,rgba(214,184,109,0.13),transparent_34%),rgba(255,255,255,0.025)] p-6 shadow-[0_32px_120px_rgba(0,0,0,0.45)] md:p-9">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-velmere-gold">{t.eyebrow}</p>
            <h1 className="mt-5 max-w-3xl font-serif text-4xl leading-none tracking-[-0.055em] text-white md:text-6xl">{t.title}</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/[0.58]">{t.body}</p>
            <p className="mt-5 rounded-2xl border border-velmere-gold/[0.16] bg-velmere-gold/[0.055] p-4 text-xs leading-6 text-velmere-gold/[0.82]">{t.authHint}</p>
          </div>

          <form onSubmit={submitOrderSearch} className="rounded-[2rem] border border-white/[0.08] bg-black/[0.22] p-5">
            <div className="grid gap-4 md:grid-cols-[1fr_0.72fr]">
              <label className="block">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.38]">{t.token}</span>
                <input
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  type="password"
                  className="mt-2 w-full rounded-2xl border border-white/[0.10] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/[0.24] focus:border-velmere-gold/[0.38]"
                  placeholder="ADMIN_IMPORT_TOKEN"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.38]">{t.limit}</span>
                <input
                  value={limit}
                  onChange={(event) => setLimit(Number(event.target.value) || 80)}
                  type="number"
                  min={20}
                  max={200}
                  className="mt-2 w-full rounded-2xl border border-white/[0.10] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition focus:border-velmere-gold/[0.38]"
                />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.38]">{t.orderId}</span>
              <div className="mt-2 flex gap-2">
                <input
                  value={orderDraftId}
                  onChange={(event) => setOrderDraftId(event.target.value)}
                  className="min-w-0 flex-1 rounded-2xl border border-white/[0.10] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/[0.24] focus:border-velmere-gold/[0.38]"
                  placeholder="ord_... / draft_..."
                />
                <button
                  type="submit"
                  disabled={state === "loading"}
                  className="inline-flex items-center gap-2 rounded-2xl border border-velmere-gold/[0.25] bg-velmere-gold/[0.09] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-velmere-gold transition hover:bg-velmere-gold/[0.15] disabled:opacity-50"
                >
                  {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                  {t.loadOrder}
                </button>
              </div>
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={state === "loading"}
                onClick={() => loadLedger("")}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.035] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.70] transition hover:bg-white/[0.06] disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {t.loadRecent}
              </button>
              {recentOrderIds.slice(0, 4).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => openOrder(id)}
                  className="rounded-full border border-white/[0.08] bg-black/[0.18] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.48] hover:text-white"
                >
                  {shortId(id, 18)}
                </button>
              ))}
            </div>
            {message ? (
              <div className="mt-4 flex gap-2 rounded-2xl border border-red-400/20 bg-red-500/[0.055] p-4 text-xs leading-6 text-red-100/80">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {message}
              </div>
            ) : null}
          </form>
        </div>
      </section>

      <section className="mx-auto mt-6 grid max-w-7xl gap-4 md:grid-cols-4">
        <MetricCard label={t.storage} value={snapshot?.storageReadiness.mode ?? "—"} detail={`${t.durable}: ${snapshot?.storageReadiness.durableStorageReady ? "yes" : "no"}`} />
        <MetricCard label={t.pending} value={snapshot?.storageReadiness.pendingWriteCount ?? "—"} detail={`${t.failures}: ${snapshot?.storageReadiness.recentFailureCount ?? "—"}`} />
        <MetricCard label={t.events} value={snapshot?.readiness.eventCount ?? allRecentEvents.length} detail={`durable recent: ${snapshot?.durableRecentEvents?.length ?? 0}`} />
        <MetricCard label={t.orders} value={snapshot?.readiness.orderCount ?? recentOrderIds.length} detail={`provider: ${snapshot?.storageReadiness.provider ?? "—"}`} />
      </section>

      {state === "loading" ? (
        <section className="mx-auto mt-6 max-w-7xl rounded-[2rem] border border-white/[0.08] bg-white/[0.025] p-8 text-sm text-white/[0.56]">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-velmere-gold" aria-hidden="true" /> {t.loading}
        </section>
      ) : null}

      {snapshot ? (
        <section className="mx-auto mt-6 grid max-w-7xl gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[2rem] border border-white/[0.08] bg-white/[0.025] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">{t.recent}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{visibleRecentEvents.length} events</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "checkout", "payment", "provider", "fulfilment", "support"] as StageFilter[]).map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setStageFilter(stage)}
                    className={`rounded-full border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] transition ${stageFilter === stage ? "border-velmere-gold/[0.28] bg-velmere-gold/[0.09] text-velmere-gold" : "border-white/[0.08] bg-black/[0.18] text-white/[0.42] hover:text-white"}`}
                  >
                    {stage === "all" ? t.all : stage}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {visibleRecentEvents.length ? visibleRecentEvents.map((event) => (
                <EventRow key={event.eventId} event={event} onOpen={openOrder} label={t.select} />
              )) : (
                <p className="rounded-2xl border border-white/[0.08] bg-black/[0.22] p-5 text-sm leading-7 text-white/[0.52]">{t.noData}</p>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/[0.08] bg-white/[0.025] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">{t.timeline}</p>
                <h2 className="mt-2 break-words text-2xl font-semibold tracking-[-0.04em] text-white">{shortId(orderDraftId || snapshot.orderTimeline?.orderDraftId, 34)}</h2>
              </div>
              <span className={`rounded-full border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] ${toneForSeverity(health === "error" ? "error" : health === "review" ? "review" : "info")}`}>{health}</span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <MetricCard label="payment" value={snapshot.orderTimeline?.paymentConfirmed ? "yes" : "no"} />
              <MetricCard label="provider" value={snapshot.orderTimeline?.providerDraftCreated ? "created" : "pending"} />
              <MetricCard label="failed" value={snapshot.orderTimeline?.failed ? "yes" : "no"} />
            </div>

            <OrderProviderFulfilmentRetryPanel
              locale={locale}
              token={token}
              orderDraftId={activeTimelineOrderDraftId}
              enabled={Boolean(activeTimelineOrderDraftId)}
              onRetried={() => loadLedger(activeTimelineOrderDraftId)}
            />

            <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/[0.22] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.36]">{t.supportPacket}</p>
                <button
                  type="button"
                  onClick={copySupportPacket}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.58] hover:text-white"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  {copied ? "copied" : t.copyId}
                </button>
              </div>
              <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/[0.28] p-3 text-[10px] leading-5 text-white/[0.52]">{JSON.stringify(supportClipboardPacket, null, 2)}</pre>
            </div>

            <div className="mt-6 grid gap-4">
              {timelineEvents.length ? timelineEvents.map((event, index) => (
                <TimelineEvent key={event.eventId} event={event} isLast={index === timelineEvents.length - 1} />
              )) : (
                <p className="rounded-2xl border border-white/[0.08] bg-black/[0.22] p-5 text-sm leading-7 text-white/[0.52]">{t.noData}</p>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="mx-auto mt-6 max-w-7xl rounded-[2rem] border border-white/[0.08] bg-white/[0.025] p-8 text-sm leading-7 text-white/[0.52]">
          <DatabaseZap className="mr-2 inline h-4 w-4 text-velmere-gold" aria-hidden="true" />
          {t.noData}
        </section>
      )}

      {snapshot ? (
        <section className="mx-auto mt-6 max-w-7xl rounded-[2rem] border border-white/[0.08] bg-black/[0.22] p-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.34]">{t.boundary}</p>
          <p className="mt-2 text-xs leading-6 text-white/[0.50]">{snapshot.productionBoundary}</p>
          <p className="mt-2 text-xs leading-6 text-white/[0.42]">{snapshot.storageReadiness.productionBoundary}</p>
        </section>
      ) : null}
    </main>
  );
}
