"use client";


import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { useMemo, useState } from "react";
import { ArrowRightCircle, Database, Filter, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { buildPass2370AuditInboxHref, PASS2370_ADMIN_REPLAY_AUDIT_LINK_ID } from "@/lib/security/admin-replay-audit-link";

type EvidenceStatus = "all" | "pass" | "fail" | "manual" | "blocked";
type EvidenceArea = "all" | "checkout" | "stripe_webhook" | "idempotency" | "order_persistence" | "fulfilment" | "refund_support" | "vlm_service" | "release_gate";
type LinkMode = "all" | "auditQueue" | "accountMessage" | "account" | "unlinked";

type ScenarioOption = { id: string; label: string };

type EvidenceRow = {
  id?: string;
  area?: string;
  status?: string;
  label?: string;
  summary?: string;
  evidenceRef?: string;
  createdAt?: string;
  scenarioId?: string;
  auditQueueId?: string;
  accountMessageId?: string;
  accountId?: string;
  stripeEventId?: string;
  stripeSessionId?: string;
  entitlementId?: string;
  operator?: string;
};

type EvidenceSnapshot = {
  durableSource?: string;
  durableRecordCount?: number;
  linkedAuditQueueCount?: number;
  linkedAccountMessageCount?: number;
  statusCounts?: Partial<Record<Exclude<EvidenceStatus, "all">, number>>;
  recent?: EvidenceRow[];
};

type ApiPayload = {
  ok?: boolean;
  error?: string;
  durableEvidence?: EvidenceSnapshot;
  evidenceFilter?: Record<string, unknown>;
};

type Props = {
  locale: string;
  scenarioOptions: ScenarioOption[];
};

const statusOptions: EvidenceStatus[] = ["all", "pass", "manual", "blocked", "fail"];
const areaOptions: EvidenceArea[] = ["all", "stripe_webhook", "vlm_service", "checkout", "idempotency", "order_persistence", "fulfilment", "refund_support", "release_gate"];
const linkOptions: LinkMode[] = ["all", "auditQueue", "accountMessage", "account", "unlinked"];

const statusTone: Record<string, string> = {
  pass: "border-emerald-300/[0.18] bg-emerald-300/[0.05] text-emerald-100",
  manual: "border-cyan-200/[0.16] bg-cyan-300/[0.045] text-cyan-100",
  blocked: "border-rose-300/[0.18] bg-rose-300/[0.05] text-rose-100",
  fail: "border-rose-300/[0.18] bg-rose-300/[0.05] text-rose-100",
  default: "border-white/[0.10] bg-white/[0.025] text-white/[0.46]",
};

function cleanQuery(value: string) {
  return value.trim().replace(/[<>{}[\]`$\\]/g, " ").replace(/\s+/g, " ").slice(0, 120);
}

function displayDate(value?: string) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 19);
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function matchesLinkMode(row: EvidenceRow, mode: LinkMode) {
  if (mode === "all") return true;
  if (mode === "auditQueue") return Boolean(row.auditQueueId);
  if (mode === "accountMessage") return Boolean(row.accountMessageId);
  if (mode === "account") return Boolean(row.accountId);
  return !row.auditQueueId && !row.accountMessageId && !row.accountId;
}

function truncate(value?: string, max = 76) {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export default function SecurityPaymentEvidenceLiveRowsClient({ locale, scenarioOptions }: Props) {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<EvidenceStatus>("all");
  const [area, setArea] = useState<EvidenceArea>("all");
  const [scenarioId, setScenarioId] = useState("all");
  const [linkMode, setLinkMode] = useState<LinkMode>("all");
  const [q, setQ] = useState("");
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const rows = useMemo(() => (payload?.durableEvidence?.recent ?? []).filter((row) => matchesLinkMode(row, linkMode)).slice(0, 20), [payload, linkMode]);
  const statusCounts = payload?.durableEvidence?.statusCounts ?? {};

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "40" });
      if (status !== "all") params.set("status", status);
      if (area !== "all") params.set("area", area);
      if (scenarioId !== "all") params.set("scenarioId", scenarioId);
      const cleaned = cleanQuery(q);
      if (cleaned) params.set("q", cleaned);

      const response = await fetch(`/api/security/admin-replay-board?${params.toString()}`, {
        cache: "no-store",
        headers: token.trim() ? { "x-velmere-security-admin-token": token.trim() } : {},
      });
      const next = await readJsonResponseBounded<ApiPayload>(response, 2 * 1024 * 1024).catch(() => ({} as ApiPayload));
      setPayload(next);
      if (!response.ok || !next.durableEvidence) {
        setError(next.error ? `Live rows blocked: ${next.error}` : "Live rows blocked by admin token gate or readiness status.");
      }
    } catch {
      setError("Live rows request failed locally. Check token, admin gate and route logs.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-[1.45rem] border border-cyan-200/[0.12] bg-cyan-300/[0.032] p-4" data-pass2367-live-payment-evidence-rows="admin-replay-board-filter-table" data-admin-replay-audit-link={PASS2370_ADMIN_REPLAY_AUDIT_LINK_ID}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.18] bg-black/[0.18] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-100">
            <Database className="h-3.5 w-3.5" /> Live evidence rows
          </p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">Durable payment evidence table with safe filters.</h3>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-white/[0.54]">
            Read-only admin view for redacted evidence rows. Filter by status, rail area, replay scenario and linkage to auditQueueId/accountMessageId. Click a linked row to open the matching Audit Inbox request. It never exposes Stripe raw payloads, signatures, card data or BLIK codes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-200/[0.18] bg-cyan-300/[0.045] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100 transition hover:border-cyan-200/[0.32] disabled:cursor-wait disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> {busy ? "loading" : "refresh live rows"}
        </button>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
        <input
          value={token}
          onChange={(event) => setToken(event.target.value)}
          type="password"
          placeholder="admin token"
          className="rounded-2xl border border-white/[0.10] bg-black/[0.20] px-4 py-3 text-xs text-white outline-none placeholder:text-white/[0.28] focus:border-velmere-gold/[0.30]"
        />
        <select value={status} onChange={(event) => setStatus(event.target.value as EvidenceStatus)} className="rounded-2xl border border-white/[0.10] bg-black/[0.20] px-4 py-3 text-xs text-white outline-none focus:border-cyan-200/[0.30]">
          {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={area} onChange={(event) => setArea(event.target.value as EvidenceArea)} className="rounded-2xl border border-white/[0.10] bg-black/[0.20] px-4 py-3 text-xs text-white outline-none focus:border-cyan-200/[0.30]">
          {areaOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)} className="rounded-2xl border border-white/[0.10] bg-black/[0.20] px-4 py-3 text-xs text-white outline-none focus:border-cyan-200/[0.30]">
          <option value="all">all scenarios</option>
          {scenarioOptions.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.id}</option>)}
        </select>
        <select value={linkMode} onChange={(event) => setLinkMode(event.target.value as LinkMode)} className="rounded-2xl border border-white/[0.10] bg-black/[0.20] px-4 py-3 text-xs text-white outline-none focus:border-cyan-200/[0.30]">
          {linkOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="q / event / queue / message"
          className="rounded-2xl border border-white/[0.10] bg-black/[0.20] px-4 py-3 text-xs text-white outline-none placeholder:text-white/[0.28] focus:border-cyan-200/[0.30]"
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-white/[0.08] bg-black/[0.16] p-3"><p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">source</p><p className="mt-1 text-sm text-white/[0.72]">{payload?.durableEvidence?.durableSource ?? "not loaded"}</p></div>
        <div className="rounded-2xl border border-white/[0.08] bg-black/[0.16] p-3"><p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">records</p><p className="mt-1 text-sm text-white/[0.72]">{payload?.durableEvidence?.durableRecordCount ?? 0}</p></div>
        <div className="rounded-2xl border border-white/[0.08] bg-black/[0.16] p-3"><p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">auditQueue linked</p><p className="mt-1 text-sm text-white/[0.72]">{payload?.durableEvidence?.linkedAuditQueueCount ?? 0}</p></div>
        <div className="rounded-2xl border border-white/[0.08] bg-black/[0.16] p-3"><p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">account linked</p><p className="mt-1 text-sm text-white/[0.72]">{payload?.durableEvidence?.linkedAccountMessageCount ?? 0}</p></div>
        <div className="rounded-2xl border border-white/[0.08] bg-black/[0.16] p-3"><p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]">pass/manual/blocked</p><p className="mt-1 text-sm text-white/[0.72]">{statusCounts.pass ?? 0}/{statusCounts.manual ?? 0}/{statusCounts.blocked ?? 0}</p></div>
      </div>

      {error ? <p className="mt-4 rounded-2xl border border-rose-300/[0.14] bg-rose-300/[0.045] p-3 text-xs leading-6 text-rose-100/[0.74]"><XCircle className="mr-2 inline h-4 w-4" />{error}</p> : null}

      <div className="mt-5 overflow-hidden rounded-[1.15rem] border border-white/[0.08] bg-black/[0.18]">
        <div className="grid grid-cols-[8rem_7rem_10rem_minmax(14rem,1fr)_12rem] gap-3 border-b border-white/[0.07] px-4 py-3 font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34] max-xl:hidden">
          <span>time</span><span>status</span><span>area/scenario</span><span>safe evidence</span><span>links</span>
        </div>
        {rows.length === 0 ? (
          <div className="p-5 text-xs leading-6 text-white/[0.48]"><Filter className="mr-2 inline h-4 w-4" />No live rows loaded yet. Add admin token and refresh, or adjust filters.</div>
        ) : (
          <div className="divide-y divide-white/[0.07]">
            {rows.map((row) => (
              <article key={row.id ?? `${row.scenarioId}-${row.createdAt}`} className="grid gap-3 px-4 py-3 text-xs text-white/[0.58] xl:grid-cols-[8rem_7rem_10rem_minmax(14rem,1fr)_12rem] xl:items-center">
                <p className="font-mono text-[10px] text-white/[0.42]">{displayDate(row.createdAt)}</p>
                <span className={`w-fit rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] ${statusTone[row.status ?? "default"] ?? statusTone.default}`}>{row.status ?? "manual"}</span>
                <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-cyan-100/[0.62]">{row.area ?? "area"}<br /><span className="text-white/[0.34]">{row.scenarioId ?? "no scenario"}</span></p>
                <div>
                  <p className="font-semibold text-white/[0.76]">{truncate(row.label, 88)}</p>
                  <p className="mt-1 leading-5 text-white/[0.44]">{truncate(row.summary || row.evidenceRef, 120)}</p>
                </div>
                <div className="grid gap-1 font-mono text-[9px] text-white/[0.42]">
                  <p>{row.auditQueueId ? <ShieldCheck className="mr-1 inline h-3 w-3 text-emerald-100" /> : null}q: {truncate(row.auditQueueId, 38)}</p>
                  <p>m: {truncate(row.accountMessageId, 38)}</p>
                  <p>a: {truncate(row.accountId, 38)}</p>
                  {row.auditQueueId || row.accountMessageId || row.accountId ? (
                    <a
                      href={buildPass2370AuditInboxHref(locale, row)}
                      className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-cyan-200/[0.14] bg-cyan-300/[0.045] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-cyan-100/[0.76] transition hover:border-cyan-200/[0.30] hover:text-cyan-100"
                      data-pass2370-open-audit-inbox-row={row.id ?? row.auditQueueId ?? row.accountMessageId ?? "linked-evidence"}
                    >
                      <ArrowRightCircle className="h-3 w-3" /> open inbox
                    </a>
                  ) : (
                    <span className="mt-1 inline-flex w-fit rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[8px] uppercase tracking-[0.12em] text-white/[0.28]">unlinked</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
