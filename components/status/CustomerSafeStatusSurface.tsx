import type { Pass2196CustomerSafeStatusSurface } from "@/lib/ui/customer-safe-status-surface";

type CustomerSafeStatusSurfaceProps = {
  surface: Pass2196CustomerSafeStatusSurface;
  compact?: boolean;
};

function toneClass(tone: Pass2196CustomerSafeStatusSurface["tone"]) {
  if (tone === "ready") return "border-emerald-300/[0.22] bg-emerald-500/[0.055] text-emerald-50";
  if (tone === "locked") return "border-amber-300/[0.24] bg-amber-500/[0.06] text-amber-50";
  if (tone === "error") return "border-red-300/[0.24] bg-red-500/[0.06] text-red-50";
  if (tone === "warning") return "border-sky-300/[0.22] bg-sky-500/[0.055] text-sky-50";
  return "border-white/[0.12] bg-white/[0.035] text-white";
}

export function CustomerSafeStatusSurface({ surface, compact = false }: CustomerSafeStatusSurfaceProps) {
  return (
    <section
      className={`rounded-[1.5rem] border p-4 shadow-[0_18px_70px_rgba(0,0,0,0.28)] ${toneClass(surface.tone)}`}
      data-pass2196-customer-safe-status={surface.stateCode}
      data-pass2196-receipt-code={surface.receiptCode}
      data-customer-visible-status={surface.customerVisibleStatus}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/[0.44]">Status</p>
          <h3 className="mt-1 text-base font-semibold leading-tight text-white">{surface.headline}</h3>
        </div>
        <span className="rounded-full border border-white/[0.14] bg-black/[0.18] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.68]">
          {surface.customerVisibleStatus}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/[0.70]">{surface.body}</p>
      {!compact ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.08] bg-black/[0.12] p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.40]">Visible</p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-white/[0.62]">
              {surface.customerCanSee.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-black/[0.12] p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.40]">Protected</p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-white/[0.62]">
              {surface.customerCannotSee.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full border border-white/[0.10] px-3 py-1.5 text-xs text-white/[0.66]">{surface.actionLabel}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.32]">receipt · {surface.receiptCode}</span>
      </div>
    </section>
  );
}
