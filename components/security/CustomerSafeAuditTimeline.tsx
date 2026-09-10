import type { Pass2368AuditTimeline, Pass2368AuditTimelineStepState } from "@/lib/security/customer-safe-audit-timeline";

function toneClass(state: Pass2368AuditTimelineStepState) {
  if (state === "done") return "border-emerald-200/[0.16] bg-emerald-300/[0.045] text-emerald-100";
  if (state === "active") return "border-cyan-200/[0.18] bg-cyan-300/[0.055] text-cyan-100";
  if (state === "blocked") return "border-rose-200/[0.18] bg-rose-300/[0.055] text-rose-100";
  return "border-white/[0.08] bg-white/[0.025] text-white/[0.38]";
}

function dotClass(state: Pass2368AuditTimelineStepState) {
  if (state === "done") return "bg-emerald-200/[0.82] shadow-[0_0_22px_rgba(167,243,208,0.20)]";
  if (state === "active") return "bg-cyan-100/[0.90] shadow-[0_0_26px_rgba(207,250,254,0.24)]";
  if (state === "blocked") return "bg-rose-200/[0.85] shadow-[0_0_24px_rgba(254,205,211,0.22)]";
  return "bg-white/[0.18]";
}

export default function CustomerSafeAuditTimeline({
  timeline,
  compact = false,
}: {
  timeline: Pass2368AuditTimeline;
  compact?: boolean;
}) {
  return (
    <section
      className={`rounded-[1.35rem] border border-white/[0.09] bg-black/[0.18] ${compact ? "p-3" : "p-4 md:p-5"}`}
      data-customer-safe-audit-timeline={timeline.passId}
      data-pass2368-timeline-steps="access-analysis-queue-report-ready"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-100/[0.70]">{timeline.title}</p>
          {!compact ? <p className="mt-2 max-w-2xl text-xs leading-6 text-white/[0.48]">{timeline.body}</p> : null}
        </div>
        <p className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.35]">
          customer-safe
        </p>
      </div>
      <div className={`mt-4 grid gap-2 ${compact ? "sm:grid-cols-3" : "md:grid-cols-3"}`}>
        {timeline.steps.map((step, index) => (
          <article
            key={step.id}
            className={`relative rounded-[1.05rem] border p-3 ${toneClass(step.state)}`}
            data-pass2368-timeline-step={step.id}
            data-pass2368-timeline-state={step.state}
          >
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass(step.state)}`} aria-hidden="true" />
              <p className="font-mono text-[8px] uppercase tracking-[0.14em]">0{index + 1} · {step.state}</p>
            </div>
            <h3 className="mt-2 text-sm font-semibold tracking-[-0.02em] text-white">{step.label}</h3>
            {!compact ? <p className="mt-2 text-xs leading-5 text-white/[0.52]">{step.body}</p> : null}
            {step.meta ? <p className="mt-2 break-all font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.36]">{step.meta}</p> : null}
          </article>
        ))}
      </div>
      {!compact ? <p className="mt-3 text-[11px] leading-5 text-white/[0.34]">{timeline.boundary}</p> : null}
    </section>
  );
}
