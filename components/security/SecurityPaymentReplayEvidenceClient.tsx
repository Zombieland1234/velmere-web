"use client";


import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { useMemo, useState } from "react";
import { KeyRound, Send, ShieldCheck, XCircle } from "lucide-react";
import type { StripeWebhookReplayScenario, StripeWebhookReplayScenarioStatus } from "@/lib/security/stripe-webhook-replay-qa";

type EvidenceStatus = "pass" | "manual" | "blocked";

type Props = {
  scenarios: StripeWebhookReplayScenario[];
};

type ApiPayload = {
  ok?: boolean;
  error?: string;
  record?: { id?: string; status?: string; label?: string; evidenceRef?: string; durableSource?: string; durableWrite?: boolean; auditQueueId?: string; accountMessageId?: string };
  snapshot?: { scenarioEvidenceCount?: number; averageProgress?: number };
};

const buttonCopy: Record<EvidenceStatus, string> = {
  pass: "record pass",
  manual: "manual evidence",
  blocked: "mark blocked",
};

const statusTone: Record<StripeWebhookReplayScenarioStatus | EvidenceStatus, string> = {
  pending: "border-white/[0.10] bg-white/[0.025] text-white/[0.46]",
  manual: "border-cyan-200/[0.16] bg-cyan-300/[0.045] text-cyan-100",
  pass: "border-emerald-300/[0.18] bg-emerald-300/[0.05] text-emerald-100",
  blocked: "border-rose-300/[0.18] bg-rose-300/[0.05] text-rose-100",
};

function cleanRef(value: string) {
  return value.trim().replace(/[<>{}[\\\]`$]/g, " ").slice(0, 160);
}

export default function SecurityPaymentReplayEvidenceClient({ scenarios }: Props) {
  const [token, setToken] = useState("");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [auditQueueId, setAuditQueueId] = useState("");
  const [accountMessageId, setAccountMessageId] = useState("");
  const [stripeEventId, setStripeEventId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const focusedScenarios = useMemo(() => scenarios.slice(0, 6), [scenarios]);

  async function recordScenario(scenario: StripeWebhookReplayScenario, status: EvidenceStatus) {
    setBusy(`${scenario.id}:${status}`);
    setResult("");
    try {
      const response = await fetch("/api/security/stripe-webhook-replay-qa", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token.trim() ? { "x-velmere-security-admin-token": token.trim() } : {}),
        },
        body: JSON.stringify({
          scenarioId: scenario.id,
          status,
          evidenceRef: cleanRef(evidenceRef) || `pass2366:${scenario.id}:operator-safe-evidence`,
          auditQueueId: cleanRef(auditQueueId),
          accountMessageId: cleanRef(accountMessageId),
          stripeEventId: cleanRef(stripeEventId),
          summary: `${scenario.label} marked ${status} from PASS2366 admin replay board. Expected: ${scenario.expected}`,
        }),
      });
      const payload = await readJsonResponseBounded<ApiPayload>(response, 2 * 1024 * 1024).catch(() => ({} as ApiPayload));
      if (!response.ok || !payload.ok) {
        setResult(payload.error ? `Evidence blocked: ${payload.error}` : "Evidence blocked by admin gate.");
        return;
      }
      setResult(
        `Saved ${payload.record?.status ?? status} · durable=${payload.record?.durableWrite ? "supabase" : payload.record?.durableSource ?? "memory"} · evidence=${payload.snapshot?.scenarioEvidenceCount ?? "n/a"} · avg=${payload.snapshot?.averageProgress ?? "n/a"}%`,
      );
    } catch {
      setResult("Evidence write failed locally. Check admin token, same-origin and console logs.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-[1.45rem] border border-white/[0.10] bg-black/[0.22] p-4" data-pass2365-evidence-client="stripe-replay-operator-buttons" data-pass2366-durable-evidence-client="account-message-audit-queue-linking">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.18] bg-velmere-gold/[0.055] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-velmere-gold">
            <KeyRound className="h-3.5 w-3.5" /> operator evidence
          </p>
          <p className="mt-3 max-w-2xl text-xs leading-6 text-white/[0.54]">
            Use these buttons after a real staging run. Store only safe references: Stripe event id, session id, entitlement id, auditQueueId, accountMessageId/requestId and HTTP status. Never paste raw webhook signatures, card data, BLIK codes or secrets.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:w-[42rem]">
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            type="password"
            placeholder="x-velmere-security-admin-token"
            className="rounded-2xl border border-white/[0.10] bg-white/[0.035] px-4 py-3 text-xs text-white outline-none transition placeholder:text-white/[0.28] focus:border-velmere-gold/[0.26]"
          />
          <input
            value={evidenceRef}
            onChange={(event) => setEvidenceRef(event.target.value)}
            placeholder="safe evidence ref, e.g. HTTP 200 / session id"
            className="rounded-2xl border border-white/[0.10] bg-white/[0.035] px-4 py-3 text-xs text-white outline-none transition placeholder:text-white/[0.28] focus:border-cyan-200/[0.26]"
          />
          <input
            value={auditQueueId}
            onChange={(event) => setAuditQueueId(event.target.value)}
            placeholder="auditQueueId / analysis queue id"
            className="rounded-2xl border border-white/[0.10] bg-white/[0.035] px-4 py-3 text-xs text-white outline-none transition placeholder:text-white/[0.28] focus:border-cyan-200/[0.26]"
          />
          <input
            value={accountMessageId}
            onChange={(event) => setAccountMessageId(event.target.value)}
            placeholder="accountMessageId / requestId"
            className="rounded-2xl border border-white/[0.10] bg-white/[0.035] px-4 py-3 text-xs text-white outline-none transition placeholder:text-white/[0.28] focus:border-cyan-200/[0.26]"
          />
          <input
            value={stripeEventId}
            onChange={(event) => setStripeEventId(event.target.value)}
            placeholder="Stripe event id only, never raw signature"
            className="rounded-2xl border border-white/[0.10] bg-white/[0.035] px-4 py-3 text-xs text-white outline-none transition placeholder:text-white/[0.28] focus:border-cyan-200/[0.26] sm:col-span-2"
          />
        </div>
      </div>

      {result ? <p className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 text-xs leading-6 text-white/[0.56]">{result}</p> : null}

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {focusedScenarios.map((scenario) => (
          <article key={scenario.id} className="rounded-[1.15rem] border border-white/[0.08] bg-white/[0.025] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-cyan-100/[0.62]">{scenario.id}</p>
                <h4 className="mt-2 text-sm font-semibold text-white/[0.86]">{scenario.label}</h4>
              </div>
              <span className={`rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] ${statusTone[scenario.status]}`}>{scenario.status} · {scenario.progress}%</span>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-white/[0.48]">{scenario.expected}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(Object.keys(buttonCopy) as EvidenceStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={busy === `${scenario.id}:${status}`}
                  onClick={() => void recordScenario(scenario, status)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] transition disabled:cursor-wait disabled:opacity-45 ${statusTone[status]}`}
                >
                  {status === "pass" ? <ShieldCheck className="h-3.5 w-3.5" /> : status === "blocked" ? <XCircle className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                  {busy === `${scenario.id}:${status}` ? "saving" : buttonCopy[status]}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
