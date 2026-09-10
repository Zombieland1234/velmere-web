"use client";


import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, RotateCcw, ShieldAlert, Truck } from "lucide-react";

type RetryOutcome = "ready" | "created" | "blocked" | "failed";
type RetryMode = "preview" | "execute";
type QueueState = "queued" | "replay_started" | "replay_created" | "replay_blocked" | "replay_failed" | "discarded";
type QueueAction = "enqueue" | "replay" | "discard";

type RetryReceipt = {
  schemaVersion: "velmere.provider-fulfilment-retry.v1";
  receiptId: string;
  caseId: string;
  orderDraftId: string;
  createdAt: string;
  mode: RetryMode;
  outcome: RetryOutcome;
  canRetry: boolean;
  executed: boolean;
  provider: "printful" | "manual" | "mixed" | "none";
  currentStatus?: string;
  stripeSessionId?: string;
  printfulOrderId?: string;
  providerStatus?: string;
  confirmOrders: boolean;
  strictMode: boolean;
  readiness: {
    orderInMemory: boolean;
    paymentConfirmed: boolean;
    alreadyFulfilled: boolean;
    providerDraftAlreadyCreated: boolean;
    hasStripeSessionId: boolean;
    printfulConfigured: boolean;
    automaticPrintfulLineCount: number;
    manualLineCount: number;
    missingProviderVariantCount: number;
    totalQuantity: number;
  };
  reasonCodes: string[];
  eventIds: string[];
  nextAction: "retry_execute" | "open_order_timeline" | "manual_fulfilment" | "configure_provider" | "stop_already_done";
  checksum: string;
};

type SnapshotIntegrity = {
  schemaVersion: "velmere.order-replay-snapshot-integrity.v1";
  snapshotId: string | null;
  status: "verified" | "warning" | "failed" | "missing";
  canRestore: boolean;
  checksum: string | null;
  reasonCodes: string[];
  warnings: string[];
  coverage: {
    hasStripeSessionId: boolean;
    hasLineItems: boolean;
    lineItemCount: number;
    automaticProviderLineCount: number;
    missingProviderVariantCount: number;
  };
};

type RestoreGate = {
  schemaVersion: "velmere.order-replay-snapshot-restore-gate.v1";
  canRestore: boolean;
  blocked: boolean;
  status: SnapshotIntegrity["status"];
  checksum: string | null;
  reasonCodes: string[];
  nextAction: "restore_and_replay" | "use_live_order" | "queue_requires_manual_review";
};

type QueueItem = {
  schemaVersion: "velmere.provider-fulfilment-retry-queue.v1";
  queueId: string;
  orderDraftId: string;
  createdAt: string;
  updatedAt: string;
  state: QueueState;
  replayCount: number;
  maxReplayCount: number;
  nextReplayAfter?: string;
  lastReplayAt?: string;
  lastEventIds: string[];
  latestRetryReceipt?: RetryReceipt;
  initialPreviewReceipt: RetryReceipt;
  snapshotIntegrity?: SnapshotIntegrity;
  replayRestoreGate?: RestoreGate;
  reasonCodes: string[];
  checksum: string;
};

type RetryResponse = {
  generatedAt: string;
  mode: RetryMode;
  receipt?: RetryReceipt;
  error?: string;
  productionBoundary?: string;
};

type QueueResponse = {
  generatedAt?: string;
  latestForOrder?: QueueItem | null;
  recentQueue?: QueueItem[];
  result?: {
    item?: QueueItem | null;
    previewReceipt?: RetryReceipt;
    retryReceipt?: RetryReceipt | null;
    restoreGate?: RestoreGate;
    error?: string | null;
    duplicate?: boolean;
  };
  error?: string;
  productionBoundary?: string;
};

type PanelState = "idle" | "loading" | "ready" | "executing" | "queueing" | "replaying" | "discarding" | "error";

const copy = {
  pl: {
    eyebrow: "provider retry",
    title: "Fulfilment retry console",
    body: "Bezpieczne ponowienie stworzenia draftu u providera. Execute działa tylko gdy płatność jest potwierdzona, order jest w runtime, ma Stripe Session ID, Printful token i wszystkie provider variant IDs.",
    preview: "sprawdź retry",
    execute: "wykonaj retry",
    queue: "dodaj do kolejki",
    replay: "odtwórz z kolejki",
    discard: "zamknij kolejkę",
    running: "sprawdzam…",
    executing: "ponawiam…",
    queueing: "kolejkuję…",
    replaying: "odtwarzam…",
    discarding: "zamykam…",
    noOrder: "Najpierw otwórz timeline konkretnego orderDraftId.",
    canRetry: "retry gotowe",
    blocked: "retry zablokowane",
    created: "provider draft utworzony",
    failed: "retry failed",
    queued: "retry queued",
    replayCreated: "queue replay created",
    replayBlocked: "queue replay blocked",
    replayFailed: "queue replay failed",
    discarded: "queue discarded",
    reasons: "reason codes",
    receipt: "receipt",
    provider: "provider",
    readiness: "readiness",
    queueState: "retry queue",
    snapshot: "snapshot replay",
    boundary: "granica bezpieczeństwa",
  },
  de: {
    eyebrow: "provider retry",
    title: "Fulfilment retry console",
    body: "Sicherer erneuter Versuch, einen Provider-Draft zu erstellen. Execute läuft nur bei bestätigter Zahlung, Runtime-Order, Stripe Session ID, Printful Token und vollständigen Provider Variant IDs.",
    preview: "Retry prüfen",
    execute: "Retry ausführen",
    queue: "in Queue legen",
    replay: "Queue replay",
    discard: "Queue schließen",
    running: "prüfe…",
    executing: "retry läuft…",
    queueing: "queued…",
    replaying: "replay…",
    discarding: "schließe…",
    noOrder: "Öffne zuerst die Timeline einer konkreten orderDraftId.",
    canRetry: "retry bereit",
    blocked: "retry blockiert",
    created: "Provider-Draft erstellt",
    failed: "retry failed",
    queued: "retry queued",
    replayCreated: "queue replay created",
    replayBlocked: "queue replay blocked",
    replayFailed: "queue replay failed",
    discarded: "queue discarded",
    reasons: "reason codes",
    receipt: "receipt",
    provider: "provider",
    readiness: "readiness",
    queueState: "retry queue",
    snapshot: "snapshot replay",
    boundary: "Sicherheitsgrenze",
  },
  en: {
    eyebrow: "provider retry",
    title: "Fulfilment retry console",
    body: "Safely retry creating a provider draft. Execute only runs when payment is confirmed, the order is in runtime, Stripe Session ID exists, Printful is configured and every provider variant ID is present.",
    preview: "preview retry",
    execute: "execute retry",
    queue: "queue retry",
    replay: "replay queued",
    discard: "discard queue",
    running: "checking…",
    executing: "retrying…",
    queueing: "queueing…",
    replaying: "replaying…",
    discarding: "discarding…",
    noOrder: "Open a specific orderDraftId timeline first.",
    canRetry: "retry ready",
    blocked: "retry blocked",
    created: "provider draft created",
    failed: "retry failed",
    queued: "retry queued",
    replayCreated: "queue replay created",
    replayBlocked: "queue replay blocked",
    replayFailed: "queue replay failed",
    discarded: "queue discarded",
    reasons: "reason codes",
    receipt: "receipt",
    provider: "provider",
    readiness: "readiness",
    queueState: "retry queue",
    snapshot: "snapshot replay",
    boundary: "safety boundary",
  },
} as const;

function tFor(locale: string) {
  if (locale === "pl" || locale === "de") return copy[locale];
  return copy.en;
}

function shortId(value: string | undefined, length = 18) {
  if (!value) return "—";
  return value.length <= length ? value : `${value.slice(0, Math.floor(length / 2))}…${value.slice(-Math.floor(length / 2))}`;
}

function tone(outcome: RetryOutcome | undefined, canRetry: boolean | undefined) {
  if (outcome === "created") return "border-emerald-300/25 bg-emerald-400/[0.075] text-emerald-100";
  if (outcome === "failed") return "border-red-400/25 bg-red-500/[0.075] text-red-100";
  if (outcome === "blocked" || canRetry === false) return "border-amber-300/25 bg-amber-400/[0.075] text-amber-100";
  return "border-velmere-gold/[0.24] bg-velmere-gold/[0.065] text-velmere-gold";
}

function queueTone(state: QueueState | undefined) {
  if (state === "replay_created") return "border-emerald-300/25 bg-emerald-400/[0.075] text-emerald-100";
  if (state === "replay_failed") return "border-red-400/25 bg-red-500/[0.075] text-red-100";
  if (state === "replay_blocked" || state === "discarded") return "border-amber-300/25 bg-amber-400/[0.075] text-amber-100";
  return "border-velmere-gold/[0.24] bg-velmere-gold/[0.065] text-velmere-gold";
}

function statusText(receipt: RetryReceipt | undefined, labels: ReturnType<typeof tFor>) {
  if (!receipt) return labels.preview;
  if (receipt.outcome === "created") return labels.created;
  if (receipt.outcome === "failed") return labels.failed;
  if (receipt.canRetry) return labels.canRetry;
  return labels.blocked;
}

function queueStatusText(item: QueueItem | null | undefined, labels: ReturnType<typeof tFor>) {
  if (!item) return labels.queue;
  if (item.state === "replay_created") return labels.replayCreated;
  if (item.state === "replay_failed") return labels.replayFailed;
  if (item.state === "replay_blocked") return labels.replayBlocked;
  if (item.state === "discarded") return labels.discarded;
  return labels.queued;
}

export default function OrderProviderFulfilmentRetryPanel({
  locale,
  token,
  orderDraftId,
  enabled,
  onRetried,
}: {
  locale: string;
  token: string;
  orderDraftId: string;
  enabled: boolean;
  onRetried?: () => void;
}) {
  const t = tFor(locale);
  const [state, setState] = useState<PanelState>("idle");
  const [response, setResponse] = useState<RetryResponse | null>(null);
  const [queueResponse, setQueueResponse] = useState<QueueResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const receipt = response?.receipt ?? queueResponse?.result?.retryReceipt ?? queueResponse?.result?.previewReceipt;
  const latestQueue = queueResponse?.result?.item ?? queueResponse?.latestForOrder ?? null;
  const canExecute = Boolean(enabled && token && receipt?.canRetry && state !== "executing" && state !== "replaying");
  const canQueue = Boolean(enabled && token && orderDraftId.trim() && state !== "queueing" && state !== "replaying");
  const canReplay = Boolean(enabled && token && latestQueue && latestQueue.state !== "discarded" && state !== "replaying" && state !== "executing");
  const headline = useMemo(() => statusText(receipt, t), [receipt, t]);
  const queueHeadline = useMemo(() => queueStatusText(latestQueue, t), [latestQueue, t]);

  const refreshQueue = useCallback(async () => {
    if (!enabled || !token || !orderDraftId.trim()) return;
    try {
      const res = await fetch(`/api/admin/orders/fulfilment-retry-queue?orderDraftId=${encodeURIComponent(orderDraftId.trim())}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await readJsonResponseBounded<QueueResponse>(res, 2 * 1024 * 1024);
      if (res.ok) setQueueResponse(data);
    } catch {
      // silent refresh only
    }
  }, [enabled, orderDraftId, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshQueue();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshQueue]);

  const callRetry = async (mode: RetryMode) => {
    if (!enabled || !orderDraftId.trim()) {
      setMessage(t.noOrder);
      return;
    }
    setState(mode === "execute" ? "executing" : "loading");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/orders/fulfilment-retry", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderDraftId: orderDraftId.trim(), mode }),
      });
      const data = await readJsonResponseBounded<RetryResponse>(res, 2 * 1024 * 1024);
      setResponse(data);
      if (!res.ok && data.error) setMessage(data.error);
      if (mode === "execute" && res.ok) onRetried?.();
      setState(res.ok || data.receipt ? "ready" : "error");
      await refreshQueue();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider retry failed.");
      setState("error");
    }
  };

  const callQueue = async (action: QueueAction) => {
    if (!enabled || !orderDraftId.trim()) {
      setMessage(t.noOrder);
      return;
    }
    setState(action === "enqueue" ? "queueing" : action === "replay" ? "replaying" : "discarding");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/orders/fulfilment-retry-queue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, orderDraftId: orderDraftId.trim(), queueId: latestQueue?.queueId }),
      });
      const data = await readJsonResponseBounded<QueueResponse>(res, 2 * 1024 * 1024);
      setQueueResponse(data);
      if (!res.ok && (data.error || data.result?.error)) setMessage(data.error ?? data.result?.error ?? "Retry queue action failed.");
      if (action === "replay" && data.result?.retryReceipt?.outcome === "created") onRetried?.();
      setState(res.ok || data.result?.item ? "ready" : "error");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retry queue action failed.");
      setState("error");
    }
  };

  return (
    <section className="mt-5 rounded-[1.6rem] border border-white/[0.08] bg-black/[0.22] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-velmere-gold">{t.eyebrow}</p>
          <h3 className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-[-0.04em] text-white">
            <Truck className="h-4 w-4 text-velmere-gold" aria-hidden="true" />
            {t.title}
          </h3>
          <p className="mt-2 text-xs leading-6 text-white/[0.52]">{t.body}</p>
        </div>
        <span className={`rounded-full border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] ${tone(receipt?.outcome, receipt?.canRetry)}`}>{headline}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!enabled || !token || state === "loading" || state === "executing" || state === "replaying"}
          onClick={() => callRetry("preview")}
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.035] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.72] transition hover:bg-white/[0.06] disabled:opacity-45"
        >
          {state === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
          {state === "loading" ? t.running : t.preview}
        </button>
        <button
          type="button"
          disabled={!canExecute}
          onClick={() => callRetry("execute")}
          className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.25] bg-velmere-gold/[0.09] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-velmere-gold transition hover:bg-velmere-gold/[0.15] disabled:opacity-45"
        >
          {state === "executing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
          {state === "executing" ? t.executing : t.execute}
        </button>
        <button
          type="button"
          disabled={!canQueue}
          onClick={() => callQueue("enqueue")}
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.035] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.72] transition hover:bg-white/[0.06] disabled:opacity-45"
        >
          {state === "queueing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
          {state === "queueing" ? t.queueing : t.queue}
        </button>
        <button
          type="button"
          disabled={!canReplay}
          onClick={() => callQueue("replay")}
          className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.055] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-velmere-gold/80 transition hover:bg-velmere-gold/[0.12] disabled:opacity-45"
        >
          {state === "replaying" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
          {state === "replaying" ? t.replaying : t.replay}
        </button>
        {latestQueue ? (
          <button
            type="button"
            disabled={state === "discarding" || latestQueue.state === "discarded"}
            onClick={() => callQueue("discard")}
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/[0.22] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.44] transition hover:text-white disabled:opacity-40"
          >
            {state === "discarding" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />}
            {state === "discarding" ? t.discarding : t.discard}
          </button>
        ) : null}
      </div>

      {!enabled ? (
        <div className="mt-4 flex gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-xs leading-6 text-white/[0.50]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-velmere-gold" aria-hidden="true" />
          {t.noOrder}
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 flex gap-2 rounded-2xl border border-amber-300/20 bg-amber-400/[0.055] p-4 text-xs leading-6 text-amber-100/80">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {message}
        </div>
      ) : null}

      {latestQueue ? (
        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.34]">{t.queueState}</p>
            <span className={`rounded-full border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.12em] ${queueTone(latestQueue.state)}`}>{queueHeadline}</span>
          </div>
          <p className="mt-2 break-words text-[11px] leading-5 text-white/[0.58]">
            queue: {shortId(latestQueue.queueId, 28)} · replays: {latestQueue.replayCount}/{latestQueue.maxReplayCount}<br />
            updated: {latestQueue.updatedAt} · receipt: {shortId(latestQueue.latestRetryReceipt?.receiptId ?? latestQueue.initialPreviewReceipt.receiptId, 24)}<br />
            {latestQueue.nextReplayAfter ? `next replay after: ${latestQueue.nextReplayAfter}` : "ready for guarded replay"}
          </p>
        </div>
      ) : null}

      {latestQueue?.snapshotIntegrity ? (
        <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.34]">{t.snapshot}</p>
            <span className={`rounded-full border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.12em] ${latestQueue.replayRestoreGate?.blocked ? "border-amber-300/25 bg-amber-400/[0.075] text-amber-100" : "border-emerald-300/25 bg-emerald-400/[0.075] text-emerald-100"}`}>
              {latestQueue.snapshotIntegrity.status} · {latestQueue.replayRestoreGate?.nextAction ?? "restore gate"}
            </span>
          </div>
          <p className="mt-2 break-words text-[11px] leading-5 text-white/[0.58]">
            checksum: {shortId(latestQueue.snapshotIntegrity.checksum ?? undefined, 26)} · restore: {latestQueue.replayRestoreGate?.canRestore ? "yes" : "no"}<br />
            lines: {latestQueue.snapshotIntegrity.coverage.lineItemCount} · auto: {latestQueue.snapshotIntegrity.coverage.automaticProviderLineCount} · missing provider variants: {latestQueue.snapshotIntegrity.coverage.missingProviderVariantCount}
          </p>
          {latestQueue.snapshotIntegrity.reasonCodes.length ? (
            <p className="mt-2 break-words text-[10px] leading-5 text-amber-100/70">{latestQueue.snapshotIntegrity.reasonCodes.join(" · ")}</p>
          ) : null}
        </div>
      ) : null}

      {receipt ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.34]">{t.receipt}</p>
            <p className="mt-2 break-words text-[11px] leading-5 text-white/[0.58]">
              {shortId(receipt.receiptId, 26)}<br />
              case: {shortId(receipt.caseId, 20)}<br />
              outcome: {receipt.outcome}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.34]">{t.provider}</p>
            <p className="mt-2 break-words text-[11px] leading-5 text-white/[0.58]">
              {receipt.provider} · confirm: {receipt.confirmOrders ? "yes" : "no"}<br />
              printful: {receipt.readiness.printfulConfigured ? "configured" : "missing"}<br />
              provider order: {shortId(receipt.printfulOrderId, 18)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.34]">{t.readiness}</p>
            <p className="mt-2 break-words text-[11px] leading-5 text-white/[0.58]">
              paid: {receipt.readiness.paymentConfirmed ? "yes" : "no"}<br />
              auto lines: {receipt.readiness.automaticPrintfulLineCount}<br />
              missing variants: {receipt.readiness.missingProviderVariantCount}
            </p>
          </div>
        </div>
      ) : null}

      {receipt?.reasonCodes.length || latestQueue?.reasonCodes.length ? (
        <div className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-400/[0.045] p-3">
          <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-amber-100/60">{t.reasons}</p>
          <p className="mt-2 break-words text-[11px] leading-5 text-amber-100/72">{(receipt?.reasonCodes.length ? receipt.reasonCodes : latestQueue?.reasonCodes ?? []).join(" · ")}</p>
        </div>
      ) : null}

      {receipt?.eventIds.length || latestQueue?.lastEventIds.length ? (
        <div className="mt-3 flex gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.045] p-3 text-[11px] leading-5 text-emerald-100/72">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {(receipt?.eventIds.length ? receipt.eventIds : latestQueue?.lastEventIds ?? []).map((id: string) => shortId(id, 18)).join(" · ")}
        </div>
      ) : null}

      <p className="mt-3 text-[10px] leading-5 text-white/[0.34]">
        {t.boundary}: {queueResponse?.productionBoundary ?? response?.productionBoundary ?? "No raw customer PII, provider payloads, API tokens or webhook secrets are stored by retry receipts or queue entries."}
      </p>
    </section>
  );
}
