"use client";

import { motion, useReducedMotion } from "framer-motion";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

const nodes = [
  { id: "wallet", x: 18, y: 58, r: 6 },
  { id: "access", x: 42, y: 38, r: 8 },
  { id: "archive", x: 64, y: 61, r: 5 },
  { id: "drop", x: 78, y: 32, r: 6 },
  { id: "audit", x: 54, y: 78, r: 4 },
];

export default function VlmAccessVisual() {
  const t = useTranslations("VlmVisual");
  const reducedMotion = useReducedMotion();

  return (
    <section className="mobile-scroll-safe-canvas relative aspect-square max-h-[360px] w-full overflow-hidden rounded-[2rem] border border-white/[0.10] bg-[radial-gradient(circle_at_50%_42%,rgba(200,169,106,0.16),rgba(255,255,255,0.03)_35%,rgba(0,0,0,0)_70%)] text-white touch-pan-y md:aspect-[4/3] md:max-h-none lg:aspect-square">
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(245,240,232,0.09),rgba(255,255,255,0.018)_34%,rgba(0,0,0,0.18)),repeating-linear-gradient(90deg,rgba(255,255,255,0.025)_0,rgba(255,255,255,0.025)_1px,transparent_1px,transparent_58px),repeating-linear-gradient(0deg,rgba(255,255,255,0.02)_0,rgba(255,255,255,0.02)_1px,transparent_1px,transparent_58px)]" />
      <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2 md:left-6 md:top-6">
        {["evm", "sol", "sui"].map((network, index) => (
          <motion.span
            key={network}
            className={`rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] ${
              network === "evm"
                ? "border-velmere-gold/[0.35] bg-velmere-gold/[0.08] text-velmere-gold"
                : "border-white/[0.12] bg-black/[0.36] text-white/[0.52]"
            }`}
            animate={reducedMotion ? undefined : { opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 3.8, delay: index * 0.35, repeat: 999999, ease: "easeInOut" }}
          >
            {network.toUpperCase()} / {t("planned")}
          </motion.span>
        ))}
      </div>

      <svg
        viewBox="0 0 900 560"
        preserveAspectRatio="xMidYMid meet"
        className="pointer-events-none absolute inset-0 h-full w-full"
        role="img"
        aria-label={t("aria")}
      >
        <defs>
          <linearGradient id="vlmAccessLine" x1="0" x2="1">
            <stop offset="0%" stopColor="rgba(245,240,232,0.18)" />
            <stop offset="70%" stopColor="rgba(200,169,106,0.62)" />
            <stop offset="100%" stopColor="rgba(245,240,232,0.44)" />
          </linearGradient>
          <filter id="vlmSoftGlow" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform="translate(70 80) scale(1.04)">
          <motion.circle
            cx="420"
            cy="230"
            r="154"
            fill="none"
            stroke="rgba(245,240,232,0.11)"
            strokeWidth="1"
            strokeDasharray="4 14"
            animate={reducedMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 32, repeat: 999999, ease: "linear" }}
            style={{ transformOrigin: "420px 230px" }}
          />
          <motion.circle
            cx="420"
            cy="230"
            r="112"
            fill="rgba(245,240,232,0.025)"
            stroke="rgba(200,169,106,0.26)"
            strokeWidth="1.4"
            animate={reducedMotion ? undefined : { scale: [1, 1.025, 1], opacity: [0.82, 1, 0.82] }}
            transition={{ duration: 6, repeat: 999999, ease: "easeInOut" }}
            style={{ transformOrigin: "420px 230px" }}
          />
          <path
            d="M110 285 C230 136 318 294 420 230 C522 166 580 318 710 168"
            fill="none"
            stroke="url(#vlmAccessLine)"
            strokeWidth="2"
            strokeDasharray="8 10"
            className={reducedMotion ? undefined : "velmere-dash-flow"}
          />

          {nodes.map((node, index) => (
            <motion.g
              key={node.id}
              animate={reducedMotion ? undefined : { y: [0, index % 2 ? 8 : -8, 0] }}
              transition={{ duration: 6 + index * 0.35, repeat: 999999, ease: "easeInOut" }}
            >
              <circle
                cx={node.x * 8}
                cy={node.y * 4.5}
                r={node.r * 3}
                fill={node.id === "audit" ? "rgba(245,240,232,0.55)" : "rgba(200,169,106,0.74)"}
                filter="url(#vlmSoftGlow)"
              />
              <circle
                cx={node.x * 8}
                cy={node.y * 4.5}
                r={node.r * 5}
                fill="none"
                stroke="rgba(245,240,232,0.14)"
              />
            </motion.g>
          ))}
        </g>
      </svg>

      <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-white/[0.10] bg-black/[0.62] p-4 backdrop-blur-xl md:p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-velmere-gold">{t("title")}</p>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-white/[0.56] md:text-sm">{t("body")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.12] px-4 text-[10px] uppercase tracking-[0.16em] text-white/[0.52]">
              <LockKeyhole className="h-3.5 w-3.5 text-velmere-gold" aria-hidden="true" />
              {t("notDeployed")}
            </span>
            <span className="hidden h-10 items-center gap-2 rounded-full border border-white/[0.12] px-4 text-[10px] uppercase tracking-[0.16em] text-white/[0.52] sm:inline-flex">
              <ShieldAlert className="h-3.5 w-3.5 text-velmere-gold" aria-hidden="true" />
              {t("auditRequired")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
