"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "@/navigation";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Globe2,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";

const labCards = [
  ["01", "Kernel boot", "Tryb VLM otwiera się krótkim scanem i kończy w stanie gotowości.", "kernel"],
  ["02", "Soft unlock glow", "Karta dostaje luksusowy złoty rim po odblokowaniu, bez neonowego krypto efektu.", "unlock"],
  ["03", "Garment hover label", "Zdjęcie produktu odsłania pasek care-label i materiał po najechaniu.", "garment"],
  ["04", "Square signal toast", "Błąd publikacji wyjeżdża z górnej krawędzi i spokojnie zanika.", "toast"],
  ["05", "Wallet safety preview", "Przed connect / sign / approve / send podświetla się tylko bieżący krok.", "safety"],
  ["06", "Archive entitlement map", "Subtelna mapa łączy access, archive i drop rooms.", "map"],
  ["07", "Claim pending pulse", "CTA oddycha delikatnym pulsem, zamiast migać.", "pulse"],
  ["08", "Order-book cart", "Pozycje koszyka zachowują się jak wiersze przydzielonego inventory.", "cart"],
  ["09", "Angel handoff", "Angel chowa się pod modalami i wraca jako kompaktowy chip operatora.", "angel"],
  ["10", "Page dissolve", "Przejścia stron znikają przez black fade z lekkim pionowym liftem.", "dissolve"],
  ["11", "AMU baseline tick", "AMU pojawia się tylko w VLM labels i receiptach z mikro ruchem tick.", "amu"],
  ["12", "Mobius path", "Delikatna pętla rysuje flow routingu w sekcji Pro.", "mobius"],
  ["13", "Prime lattice", "Siatka punktów bezpieczeństwa pulsuje jak lattice walidacyjny.", "lattice"],
  ["14", "Protocol rename", "Publiczny copy może przełączać się między Velmère access a AMU protocol.", "rename"],
  ["15", "Swap read-only shell", "Shell future swapa pokazuje disabled states bez udawania live kontraktu.", "swap"],
  ["16", "Incident banner", "Mini banner maintenance/security pokazuje się wyłącznie gdy trzeba.", "banner"],
  ["17", "Member room reveal", "Pokoje Square wchodzą po zalogowaniu krótkim staggerem.", "reveal"],
  ["18", "Size guide drawer", "Tabela rozmiarów wysuwa się nad Angel jako boczna karta.", "drawer"],
  ["19", "Language globe", "Global language picker jest widoczny, spokojny i zrozumiały.", "globe"],
  ["20", "Reduced motion fallback", "Każda animacja ma instant fallback bez chaosu.", "reduced"],
] as const;

const appConcepts = [
  {
    title: "Drop Calendar",
    body: "Kalendarz dropów, countdowny, restock window i priorytet dla VLM access.",
  },
  {
    title: "Signal Studio",
    body: "Square publishing, komentarze, status moderacji i panel live notices.",
  },
  {
    title: "Archive Rooms",
    body: "Prywatne pokoje z lookbookami, historią dropów i ekskluzywnymi notatkami.",
  },
  {
    title: "Fit Advisor",
    body: "Przewodnik rozmiarów, długości, rekomendacje fitu i porównanie sylwetek.",
  },
  {
    title: "Wallet Safety",
    body: "Widok read-only, typ akcji, sieć, koszty i ryzyko przed jakimkolwiek podpisem.",
  },
  {
    title: "Member Pass",
    body: "Panel konta z rolami, claimami, korzyściami i historią accessu.",
  },
] as const;

const appConceptRoutes = [
  "/community",
  "/square",
  "/archive",
  "/shop",
  "/vlm-token",
  "/account",
] as const;

type PreviewKind = (typeof labCards)[number][3];

function PreviewWindow({ kind, active }: { kind: PreviewKind; active: boolean }) {
  const reducedMotion = useReducedMotion();
  const duration = reducedMotion ? 0 : 1;

  if (kind === "kernel") {
    return (
      <div className="relative h-full overflow-hidden rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10]">
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(212,175,55,0.24),transparent_48%)]"
          animate={reducedMotion ? undefined : { opacity: [0.35, 0.8, 0.35] }}
          transition={{ repeat: 999999, duration: 2.4, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute inset-x-5 top-0 h-10 bg-gradient-to-b from-[#d4af37]/[0.45] to-transparent"
          animate={reducedMotion ? undefined : { y: [0, 132, 0] }}
          transition={{ repeat: 999999, duration: 2.6, ease: "easeInOut" }}
        />
        <div className="absolute inset-x-4 bottom-4 rounded-xl border border-white/[0.10] bg-black/[0.45] px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">VLM boot</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.10]">
            <motion.div
              className="h-full rounded-full bg-velmere-gold"
              animate={reducedMotion ? { width: "72%" } : { width: ["12%", "72%", "44%"] }}
              transition={{ repeat: 999999, duration: 2.4, ease: "easeInOut" }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (kind === "unlock") {
    return (
      <div className="grid h-full place-items-center rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10] px-4">
        <motion.div
          className="w-full max-w-[14rem] rounded-[1.2rem] border border-white/[0.12] bg-[#141417] p-5"
          animate={reducedMotion ? undefined : { boxShadow: ["0 0 0 rgba(212,175,55,0.0)", "0 0 0 1px rgba(212,175,55,0.18), 0 0 40px rgba(212,175,55,0.18)", "0 0 0 rgba(212,175,55,0.0)"] }}
          transition={{ repeat: 999999, duration: 2.8, ease: "easeInOut" }}
        >
          <LockKeyhole className="h-5 w-5 text-velmere-gold" />
          <p className="mt-4 font-serif text-2xl text-white">Unlocked layer</p>
          <p className="mt-2 text-xs leading-6 text-white/[0.52]">Soft gold edge after access.</p>
        </motion.div>
      </div>
    );
  }

  if (kind === "garment") {
    return (
      <div className="relative h-full overflow-hidden rounded-[1.2rem] border border-white/[0.10] bg-[linear-gradient(135deg,#1c1c1f,#0b0b0d)]">
        <div className="absolute inset-6 rounded-[1.4rem] border border-white/[0.10] bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.12),transparent_26%),linear-gradient(180deg,#2b2b30,#111113)]" />
        <motion.div
          className="absolute inset-x-6 bottom-6 rounded-[1rem] border border-velmere-gold/[0.20] bg-black/[0.70] px-4 py-3"
          animate={reducedMotion ? { y: 0 } : { y: [60, 0, 0, 60] }}
          transition={{ repeat: 999999, duration: 3.2, ease: "easeInOut" }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">Heavy cotton / 480 gsm</p>
          <p className="mt-2 text-xs text-white/[0.60]">Care-label spec reveal on hover.</p>
        </motion.div>
      </div>
    );
  }

  if (kind === "toast") {
    return (
      <div className="relative h-full overflow-hidden rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10]">
        <motion.div
          className="absolute left-1/2 top-4 w-[calc(100%-2rem)] max-w-xs -translate-x-1/2 rounded-full border border-red-500/[0.25] bg-[#271313] px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-red-200"
          animate={reducedMotion ? { y: 0, opacity: 1 } : { y: [-30, 0, 0, -30], opacity: [0, 1, 1, 0] }}
          transition={{ repeat: 999999, duration: 2.8, ease: "easeInOut" }}
        >
          Login required before publishing.
        </motion.div>
        <div className="absolute inset-x-8 bottom-12 h-px bg-gradient-to-r from-transparent via-[#d4af37]/[0.55] to-transparent" />
      </div>
    );
  }

  if (kind === "safety") {
    const labels = ["Connect", "Sign", "Approve", "Send"];
    return (
      <div className="grid h-full grid-cols-2 gap-3 rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10] p-4">
        {labels.map((label, index) => (
          <motion.div
            key={label}
            className="rounded-[1rem] border border-white/[0.10] bg-white/[0.03] p-3"
            animate={reducedMotion ? undefined : { borderColor: ["rgba(255,255,255,0.1)", index === 1 ? "rgba(212,175,55,0.45)" : "rgba(255,255,255,0.14)", "rgba(255,255,255,0.1)"] }}
            transition={{ repeat: 999999, duration: 2.2, ease: "easeInOut", delay: index * 0.12 }}
          >
            <ShieldCheck className={`h-4 w-4 ${index === 1 ? "text-velmere-gold" : "text-white/[0.42]"}`} />
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.60]">{label}</p>
          </motion.div>
        ))}
      </div>
    );
  }

  if (kind === "map") {
    const points = ["Drop", "Archive", "Access", "Signal"];
    return (
      <div className="relative h-full rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10]">
        <svg viewBox="0 0 280 180" className="absolute inset-0 h-full w-full">
          <path d="M60 120 L140 70 L220 110" fill="none" stroke="rgba(245,240,232,0.2)" strokeWidth="1.5" strokeDasharray="5 8" className={reducedMotion ? undefined : "velmere-dash-flow-slow"} />
          <path d="M60 120 L110 40 L200 42" fill="none" stroke="rgba(212,175,55,0.28)" strokeWidth="1.5" strokeDasharray="5 8" className={reducedMotion ? undefined : "velmere-dash-flow"} />
        </svg>
        {[[60,120],[140,70],[220,110],[110,40],[200,42]].map(([left, top], index) => (
          <motion.div key={`${left}-${top}`} className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-velmere-gold" style={{ left, top }}
            animate={reducedMotion ? undefined : { scale: [1, 1.45, 1], opacity: [0.7, 1, 0.7] }} transition={{ repeat: 999999, duration: 2.2, delay: index * 0.14 }} />
        ))}
        <div className="absolute bottom-4 left-4 flex gap-2">
          {points.map((point) => <span key={point} className="rounded-full border border-white/[0.10] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.46]">{point}</span>)}
        </div>
      </div>
    );
  }

  if (kind === "pulse") {
    return (
      <div className="grid h-full place-items-center rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10]">
        <motion.button
          type="button"
          className="rounded-full border border-velmere-gold/[0.25] bg-velmere-gold/[0.10] px-8 py-4 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-velmere-gold"
          animate={reducedMotion ? undefined : { scale: [1, 1.04, 1], boxShadow: ["0 0 0 rgba(212,175,55,0)", "0 0 30px rgba(212,175,55,0.18)", "0 0 0 rgba(212,175,55,0)"] }}
          transition={{ repeat: 999999, duration: 2.4, ease: "easeInOut" }}
        >
          Claim pending
        </motion.button>
      </div>
    );
  }

  if (kind === "cart") {
    return (
      <div className="space-y-3 rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10] p-4">
        {[0, 1, 2].map((row) => (
          <div key={row} className="rounded-[1rem] border border-white/[0.10] bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white/[0.76]">Inventory row {row + 1}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/[0.42]">reserved stock</p>
              </div>
              <motion.div
                className="h-2.5 w-24 overflow-hidden rounded-full bg-white/[0.10]"
              >
                <motion.div
                  className="h-full rounded-full bg-velmere-gold"
                  animate={reducedMotion ? { width: "68%" } : { width: ["20%", "68%", "42%"] }}
                  transition={{ repeat: 999999, duration: 2.8, delay: row * 0.12, ease: "easeInOut" }}
                />
              </motion.div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (kind === "angel") {
    return (
      <div className="relative h-full rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10]">
        <motion.div
          className="absolute inset-x-6 top-8 rounded-[1rem] border border-white/[0.10] bg-[#17171B] p-5"
          animate={reducedMotion ? undefined : { y: [0, 0, 8, 8, 0], opacity: [1, 1, 0.24, 0.24, 1] }}
          transition={{ repeat: 999999, duration: 3.1, ease: "easeInOut" }}
        >
          <p className="font-serif text-2xl text-white">Signal modal</p>
        </motion.div>
        <motion.div
          className="absolute bottom-5 right-5 rounded-full border border-velmere-gold/[0.28] bg-black/[0.92] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-velmere-gold"
          animate={reducedMotion ? undefined : { scale: [0.95, 1, 1], opacity: [0.5, 1, 1] }}
          transition={{ repeat: 999999, duration: 3.1, ease: "easeInOut" }}
        >
          Angel
        </motion.div>
      </div>
    );
  }

  if (kind === "dissolve") {
    return (
      <div className="relative h-full overflow-hidden rounded-[1.2rem] border border-white/[0.10] bg-black">
        <motion.div className="absolute inset-0 bg-[linear-gradient(135deg,#17171B,#0B0B0D)]"
          animate={reducedMotion ? undefined : { opacity: [1, 0.3, 1] }} transition={{ repeat: 999999, duration: 2.6 }} />
        <motion.div className="absolute inset-5 rounded-[1.2rem] border border-white/[0.10] bg-white/[0.035]"
          animate={reducedMotion ? undefined : { y: [10, 0, 10] }} transition={{ repeat: 999999, duration: 2.6, ease: "easeInOut" }} />
      </div>
    );
  }

  if (kind === "amu") {
    return (
      <div className="grid h-full place-items-center rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10]">
        <motion.div className="rounded-[1.2rem] border border-white/[0.10] bg-[#16161A] px-8 py-6 text-center"
          animate={reducedMotion ? undefined : { y: [0, -3, 0] }} transition={{ repeat: 999999, duration: 1.8 }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-velmere-gold">AMU BASELINE</p>
          <motion.p className="mt-4 font-serif text-4xl text-white"
            animate={reducedMotion ? undefined : { opacity: [0.7, 1, 0.7] }} transition={{ repeat: 999999, duration: 1.8 }}>
            3162.27
          </motion.p>
        </motion.div>
      </div>
    );
  }

  if (kind === "mobius") {
    return (
      <div className="grid h-full place-items-center rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10]">
        <svg viewBox="0 0 160 100" className="h-28 w-44">
          <path d="M18 50 C45 12, 115 12, 142 50 C115 88, 45 88, 18 50 Z" fill="none" stroke="rgba(212,175,55,0.65)" strokeWidth="2" strokeDasharray="7 10" className={reducedMotion ? undefined : "velmere-dash-flow"} />
          <circle cx="80" cy="50" r="4" fill="rgba(245,240,232,0.8)" className={reducedMotion ? undefined : "velmere-pulse-dot"} />
        </svg>
      </div>
    );
  }

  if (kind === "lattice") {
    const cells = new Array(20).fill(0);
    return (
      <div className="grid h-full grid-cols-5 gap-2 rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10] p-4">
        {cells.map((_, index) => (
          <motion.span
            key={index}
            className="aspect-square rounded-full border border-white/[0.10] bg-white/[0.04]"
            animate={reducedMotion ? undefined : { backgroundColor: ["rgba(255,255,255,0.04)", index % 3 === 0 ? "rgba(212,175,55,0.35)" : "rgba(255,255,255,0.12)", "rgba(255,255,255,0.04)"] }}
            transition={{ repeat: 999999, duration: 2.4, delay: index * 0.05 }}
          />
        ))}
      </div>
    );
  }

  if (kind === "rename") {
    return (
      <div className="grid h-full place-items-center rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10] p-4 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={active ? "active" : "idle"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 * duration, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[1.2rem] border border-white/[0.10] bg-[#16161A] px-6 py-5"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">Public naming</p>
            <motion.p className="mt-4 font-serif text-3xl text-white"
              animate={reducedMotion ? undefined : { opacity: [1, 0.35, 1] }} transition={{ repeat: 999999, duration: 2.8 }}>
              Velmère Access / AMU Protocol
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  if (kind === "swap") {
    return (
      <div className="rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10] p-4">
        <div className="rounded-[1rem] border border-white/[0.10] bg-[#141417] p-4 opacity-85">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/[0.45]">Read-only swap</p>
          <div className="mt-4 grid gap-3">
            {['VLM', 'ETH', 'SOL'].map((item) => (
              <div key={item} className="rounded-full border border-white/[0.10] px-4 py-3 text-sm text-white/[0.66]">{item}</div>
            ))}
          </div>
          <button type="button" disabled className="mt-4 w-full rounded-full border border-white/[0.10] bg-white/[0.04] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.30]">Pending contract</button>
        </div>
      </div>
    );
  }

  if (kind === "banner") {
    return (
      <div className="relative h-full overflow-hidden rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10]">
        <motion.div className="absolute inset-x-5 top-5 rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.08] px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-velmere-gold"
          animate={reducedMotion ? undefined : { y: [-24, 0, 0, -24], opacity: [0, 1, 1, 0] }} transition={{ repeat: 999999, duration: 3.2, ease: "easeInOut" }}>
          Maintenance window / security notice
        </motion.div>
      </div>
    );
  }

  if (kind === "reveal") {
    return (
      <div className="grid h-full grid-cols-2 gap-3 rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10] p-4">
        {["Drop room", "Archive", "Styling", "Members"].map((room, index) => (
          <motion.div key={room} className="rounded-[1rem] border border-white/[0.10] bg-[#16161A] p-3"
            initial={false}
            animate={reducedMotion ? { opacity: 1, y: 0 } : { opacity: [0.35, 1, 1], y: [10, 0, 0] }}
            transition={{ repeat: 999999, duration: 2.8, delay: index * 0.18, ease: "easeInOut" }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-velmere-gold">room</p>
            <p className="mt-4 text-sm text-white/[0.72]">{room}</p>
          </motion.div>
        ))}
      </div>
    );
  }

  if (kind === "drawer") {
    return (
      <div className="relative h-full overflow-hidden rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10]">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#17171B,#0D0D10)]" />
        <motion.div className="absolute right-3 top-3 bottom-3 w-[65%] rounded-[1rem] border border-white/[0.10] bg-[#18181B] p-4"
          animate={reducedMotion ? undefined : { x: [120, 0, 0, 120] }} transition={{ repeat: 999999, duration: 3.2, ease: "easeInOut" }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">Size guide</p>
          <div className="mt-4 space-y-2">
            {["S / 70", "M / 72", "L / 74"].map((row) => <div key={row} className="rounded-full border border-white/[0.10] px-3 py-2 text-xs text-white/[0.60]">{row}</div>)}
          </div>
        </motion.div>
      </div>
    );
  }

  if (kind === "globe") {
    return (
      <div className="relative h-full rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10]">
        <motion.div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full border border-white/[0.10] bg-[#16161A] p-4"
          animate={reducedMotion ? undefined : { rotate: [0, 180, 360] }} transition={{ repeat: 999999, duration: 6, ease: "linear" }}>
          <Globe2 className="h-6 w-6 text-velmere-gold" />
        </motion.div>
        <div className="absolute inset-x-8 bottom-5 grid gap-2">
          {['EN', 'PL', 'DE'].map((item, index) => (
            <motion.div key={item} className="rounded-full border border-white/[0.10] bg-white/[0.03] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.58]"
              animate={reducedMotion ? undefined : { opacity: [0.45, index === 1 ? 1 : 0.7, 0.45] }} transition={{ repeat: 999999, duration: 2.4, delay: index * 0.15 }}>
              {item}
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full place-items-center rounded-[1.2rem] border border-white/[0.10] bg-[#0D0D10] p-4">
      <div className="w-full max-w-[14rem] rounded-[1rem] border border-white/[0.10] bg-[#16161A] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/[0.42]">Reduced motion</p>
        <p className="mt-4 text-sm leading-6 text-white/[0.66]">Instant readable state, no motion required.</p>
      </div>
    </div>
  );
}

export default function VelmereMotionLabClient() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [activeApp, setActiveApp] = useState(0);
  const activeConcept = useMemo(() => appConcepts[activeApp] ?? appConcepts[0], [activeApp]);

  return (
    <main className="min-h-[100dvh] bg-velmere-black pt-28 text-velmere-ivory md:pt-32">
      <section className="luxury-section pb-10 md:pb-14">
        <div className="rounded-[2rem] border border-white/[0.10] bg-[#111113] p-6 shadow-velmere-card md:p-10">
          <p className="velmere-label text-velmere-gold">VELMÈRE / MOTION LAB</p>
          <h1 className="mt-5 max-w-5xl font-serif text-[clamp(3rem,7vw,7rem)] leading-[0.88] tracking-[-0.055em]">
            Tu już widać ruch, nie sam opis.
          </h1>
          <p className="mt-6 max-w-3xl text-sm leading-7 text-velmere-muted">
            To jest nowa karta testowa do wyboru animacji i interakcji. Każda karta ma żywy preview, żebyś mógł ocenić klimat, a nie tylko czytać opis. Jeśli któryś ruch wybierzesz, przenosimy go potem do produkcji.
          </p>
        </div>
      </section>

      <section className="luxury-section pb-14 md:pb-18">
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-white/[0.10] bg-[#111113] p-6 shadow-velmere-card md:p-8">
            <p className="velmere-label text-velmere-gold">VLM / APPS CONCEPT</p>
            <h2 className="mt-5 font-serif text-5xl leading-[0.92] tracking-[-0.05em] md:text-6xl">
              Warstwa aplikacji i slajdów.
            </h2>
            <p className="mt-5 text-sm leading-7 text-velmere-muted">
              Zamiast przypadkowych „apek”, VLM może mieć własne moduły: dropy, access, safety, archive i fit. Klikasz koncept po prawej, a lewy panel pokazuje główny slajd tego modułu.
            </p>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeConcept.title}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="mt-8 overflow-hidden rounded-[1.5rem] border border-white/[0.10] bg-[linear-gradient(135deg,#17374a,#0f6f91_35%,#d3c487)] p-5 text-black shadow-[0_20px_80px_rgba(0,0,0,0.34)] md:p-7"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-black/[0.60]">featured module</p>
                    <h3 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">{activeConcept.title}</h3>
                  </div>
                  <div className="rounded-full bg-black/[0.10] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-black/[0.70]">Slide {String(activeApp + 1).padStart(2, "0")}</div>
                </div>
                <div className="mt-8 rounded-[1.25rem] border border-black/[0.10] bg-white/[0.86] p-4 shadow-xl">
                  <div className="grid gap-4 md:grid-cols-[0.92fr_1.08fr] md:items-center">
                    <div className="space-y-3">
                      {["Status", "Members", "Access"].map((item, index) => (
                        <motion.div key={item} className="rounded-full border border-black/[0.08] bg-black/[0.05] px-4 py-3 text-sm"
                          animate={reducedMotion ? undefined : { x: [0, index === 1 ? 6 : 0, 0] }} transition={{ repeat: 999999, duration: 2.8, delay: index * 0.18 }}>
                          {item}
                        </motion.div>
                      ))}
                    </div>
                    <div>
                      <p className="text-sm leading-7 text-black/[0.72]">{activeConcept.body}</p>
                      <button type="button" onClick={() => router.push(appConceptRoutes[activeApp] ?? "/community")} className="mt-5 inline-flex items-center gap-2 rounded-full bg-black px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white" data-pass1977-open-concept="route-bound">Open concept <ArrowRight className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {appConcepts.map((concept, index) => (
              <button
                key={concept.title}
                type="button"
                onClick={() => setActiveApp(index)}
                className={`rounded-[1.5rem] border p-5 text-left shadow-velmere-card transition duration-300 ${activeApp === index ? "border-velmere-gold/[0.30] bg-[#17171A]" : "border-white/[0.10] bg-[#111113] hover:border-white/[0.16] hover:bg-[#151518]"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">0{index + 1}</span>
                  {index % 2 === 0 ? <Wallet className="h-4 w-4 text-white/[0.40]" /> : index % 3 === 0 ? <Bell className="h-4 w-4 text-white/[0.40]" /> : <Sparkles className="h-4 w-4 text-white/[0.40]" />}
                </div>
                <h3 className="mt-5 font-serif text-2xl leading-tight text-velmere-ivory">{concept.title}</h3>
                <p className="mt-4 text-sm leading-7 text-velmere-muted">{concept.body}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="luxury-section pb-24">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="velmere-label text-velmere-gold">20 LIVE PREVIEWS</p>
            <h2 className="mt-4 font-serif text-4xl leading-[0.94] tracking-[-0.05em] md:text-6xl">
              Wybierasz ruchem, nie opisem.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-velmere-muted">
            Każda karta ma okno preview, tytuł i opis tego, co ma wejść do produkcji. Możesz później powiedzieć po numerach, które zostają.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {labCards.map(([id, title, body, kind], index) => {
            const Icon = [Sparkles, ShieldCheck, LockKeyhole, Radio, Zap, CheckCircle2][index % 6];
            return (
              <motion.article
                key={id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: reducedMotion ? 0 : 0.42, delay: reducedMotion ? 0 : (index % 4) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className="group overflow-hidden rounded-[1.65rem] border border-white/[0.10] bg-[#111113] shadow-velmere-card transition duration-500 hover:-translate-y-1 hover:border-velmere-gold/[0.28] hover:bg-[#151518]"
              >
                <div className="h-52 p-4">
                  <PreviewWindow kind={kind} active />
                </div>
                <div className="border-t border-white/[0.10] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-velmere-gold">{id}</span>
                    <Icon className="h-4 w-4 text-white/[0.42] group-hover:text-velmere-gold" />
                  </div>
                  <h3 className="mt-5 font-serif text-2xl leading-tight text-velmere-ivory">{title}</h3>
                  <p className="mt-4 text-sm leading-7 text-velmere-muted">{body}</p>
                  <p className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.36] group-hover:text-white/[0.62]">
                    Candidate for production <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
