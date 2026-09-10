// PASS35 A34: restored low-emphasis evidence labels without changing launch status.
import { squareVlmLaunchControl, getSquareVlmLaunchControlSummary } from "@/lib/launch/square-vlm-launch-control";

type Props = {
  locale: string;
  surface: "square" | "vlm" | "community";
};

const copy = {
  pl: {
    eyebrow: "launch control / square + vlm",
    title: "Square i VLM mają być jasne, bez hype’u.",
    body: "Ta warstwa pilnuje, żeby użytkownik rozumiał różnicę: ubrania kupujesz normalnie, Square czytasz jak społecznościowy board, a VLM pozostaje utility/access layer bez obietnic ceny, zysku lub listingów.",
    average: "średni postęp",
    blocked: "blokery",
    next: "następny krok",
    boundary: "granica bezpieczeństwa",
    promise: "co ma zrozumieć użytkownik",
  },
  de: {
    eyebrow: "launch control / square + vlm",
    title: "Square und VLM müssen klar bleiben, ohne Hype.",
    body: "Diese Ebene trennt Commerce, Community und Access: Kleidung bleibt normaler Shop, Square ist ein Community Board und VLM bleibt eine Utility-/Access-Ebene ohne Preis-, Gewinn- oder Listing-Versprechen.",
    average: "Durchschnitt",
    blocked: "Blocker",
    next: "nächster Schritt",
    boundary: "Sicherheitsgrenze",
    promise: "was Nutzer verstehen sollen",
  },
  en: {
    eyebrow: "launch control / square + vlm",
    title: "Square and VLM need clarity, not hype.",
    body: "This layer keeps commerce, community and access separated: clothing stays normal checkout, Square reads as a community board and VLM remains a utility/access layer with no price, profit or listing promise.",
    average: "average progress",
    blocked: "blockers",
    next: "next step",
    boundary: "safety boundary",
    promise: "user understanding",
  },
} as const;

function localeCopy(locale: string) {
  if (locale === "pl" || locale === "de") return copy[locale];
  return copy.en;
}

function statusTone(status: string) {
  if (status === "blocked") return "border-red-400/20 bg-red-500/[0.045] text-red-100/70";
  if (status === "launch_control") return "border-velmere-gold/25 bg-velmere-gold/[0.055] text-velmere-gold";
  if (status === "ready") return "border-emerald-300/20 bg-emerald-400/[0.045] text-emerald-100/70";
  return "border-cyan-300/18 bg-cyan-400/[0.035] text-cyan-100/65";
}

export default function SquareVlmLaunchControl({ locale, surface }: Props) {
  const t = localeCopy(locale);
  const summary = getSquareVlmLaunchControlSummary();
  const visibleItems = squareVlmLaunchControl.filter((item) => {
    if (surface === "vlm") return item.id.startsWith("vlm") || item.id === "member-cockpit";
    if (surface === "square") return item.id.startsWith("square") || item.id === "member-cockpit";
    return item.id !== "vlm-faq";
  });

  return (
    <section className="mx-auto max-w-7xl px-6 pb-24 md:px-12">
      <div className="rounded-[2rem] border border-white/[0.10] bg-white/[0.025] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.32)] md:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.4fr]">
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
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.36]">routes</p>
                <p className="mt-2 font-mono text-xl text-white">{summary.total}</p>
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
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.34]">{item.route}</p>
                    <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white">{item.label}</h3>
                  </div>
                  <span className={`rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${statusTone(item.status)}`}>
                    {item.status.replaceAll("_", " ")} · {item.progress}%
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                    <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-velmere-gold/[0.72]">{t.promise}</p>
                    <p className="mt-2 text-xs leading-6 text-white/[0.56]">{item.userPromise}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                    <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-velmere-gold/[0.72]">{t.boundary}</p>
                    <p className="mt-2 text-xs leading-6 text-white/[0.56]">{item.safetyBoundary}</p>
                  </div>
                </div>
                <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.34]">
                  {item.launchBlockers.slice(0, 3).join(" · ")}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
