"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, Cpu, Lock } from "lucide-react";

type Locale = "pl" | "en" | "de";

interface VelmereHeroBrandProps {
  locale?: string;
}

const BRAND_TEXTS: Record<
  Locale,
  {
    subBadge: string;
    tagline: string;
    telemetry: {
      status: string;
      assets: string;
      provenance: string;
      verification: string;
      engine: string;
    };
  }
> = {
  pl: {
    subBadge: "AUTONOMICZNY PROTOKÓŁ OCHRONY ON-CHAIN",
    tagline: "DETERMINISTYCZNA ANALIZA RYZYKA • KRYPTOGRAFICZNE DOWODY",
    telemetry: {
      status: "OBRONA AKTYWNA",
      assets: "50+ MONITOROWANYCH AKTYWÓW",
      provenance: "ZERO ZMYŚLONYCH DANYCH",
      verification: "AUDYT BAJTKODU EVM",
      engine: "CVSS v3.1 CZASU RZECZYWISTEGO",
    },
  },
  en: {
    subBadge: "AUTONOMOUS ON-CHAIN DEFENSE PROTOCOL",
    tagline: "DETERMINISTIC RISK INTELLIGENCE • CRYPTOGRAPHIC PROVENANCE",
    telemetry: {
      status: "DEFENSE ACTIVE",
      assets: "50+ MONITORED ASSETS",
      provenance: "ZERO FABRICATED DATA",
      verification: "EVM BYTECODE AUDIT",
      engine: "REAL-TIME CVSS v3.1",
    },
  },
  de: {
    subBadge: "AUTONOMES ON-CHAIN SICHERHEITSPROTOKOLL",
    tagline: "DETERMINISTISCHE RISIKOINTELLIGENZ • KRYPTOGRAFISCHE NACHWEISE",
    telemetry: {
      status: "ABWEHR AKTIV",
      assets: "50+ ÜBERWACHTE ASSETS",
      provenance: "NULL SYNTHETISCHE DATEN",
      verification: "EVM-BYTECODE-AUDIT",
      engine: "ECHTZEIT-CVSS v3.1",
    },
  },
};

export default function VelmereHeroBrand({ locale = "en" }: VelmereHeroBrandProps) {
  const safeLocale: Locale = locale === "pl" || locale === "de" ? locale : "en";
  const t = BRAND_TEXTS[safeLocale];
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative mx-auto mb-6 flex w-full max-w-5xl flex-col items-center justify-center text-center select-none">
      {/* 1. Subtle Radial Glow Background */}
      <div
        className="pointer-events-none absolute -top-12 h-44 w-96 rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(ellipse at center, rgba(212, 175, 55, 0.45), rgba(56, 189, 248, 0.15), transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* 2. THE MAJESTIC VELMÈRE TYPOGRAPHY */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 15 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        <h2 className="font-serif text-4xl font-normal tracking-[0.24em] uppercase text-transparent sm:text-6xl md:text-7xl lg:text-8xl">
          <span
            className="bg-gradient-to-r from-[#FFF5DC] via-[#E8C258] to-[#FFF5DC] bg-clip-text drop-shadow-[0_4px_28px_rgba(212,175,55,0.45)]"
            style={{
              backgroundSize: "200% auto",
            }}
          >
            VELMÈRE
          </span>
        </h2>

        {/* Elegant Gold Accent Line with Central Jewel */}
        <div className="mx-auto mt-2 flex h-[1px] w-52 items-center justify-center sm:w-80">
          <div className="h-full w-full bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
          <div className="absolute h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_#fde047]" />
        </div>
      </motion.div>

      {/* 3. MODERN, HIGH-TECH BRAND KICKER */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="mt-3.5 flex flex-col items-center gap-1.5"
      >
        <p className="text-[10px] font-semibold tracking-[0.26em] uppercase text-amber-300/95 sm:text-[12px] sm:tracking-[0.32em]">
          {t.subBadge}
        </p>
        <p className="text-[9px] font-mono tracking-[0.18em] uppercase text-white/50 sm:text-[10px]">
          {t.tagline}
        </p>
      </motion.div>

      {/* 4. LIVE TELEMETRY RADAR STATUS CAPSULE */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="mt-5 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-amber-400/20 bg-amber-950/[0.12] px-4 py-2 text-[10px] font-mono shadow-[0_0_24px_rgba(212,175,55,0.06)] backdrop-blur-md sm:gap-3.5 sm:px-6 sm:text-[11px]"
      >
        {/* Radar Pulse Node */}
        <div className="inline-flex items-center gap-1.5 text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-semibold text-emerald-300 tracking-wider">{t.telemetry.status}</span>
        </div>

        <span className="text-white/20" aria-hidden="true">•</span>

        <div className="inline-flex items-center gap-1.5 text-white/80">
          <Activity className="h-3 w-3 text-cyan-400" />
          <span>{t.telemetry.assets}</span>
        </div>

        <span className="hidden text-white/20 sm:inline" aria-hidden="true">•</span>

        <div className="hidden items-center gap-1.5 text-white/80 sm:inline-flex">
          <Lock className="h-3 w-3 text-amber-300" />
          <span>{t.telemetry.verification}</span>
        </div>

        <span className="hidden text-white/20 md:inline" aria-hidden="true">•</span>

        <div className="hidden items-center gap-1.5 text-white/80 md:inline-flex">
          <Cpu className="h-3 w-3 text-indigo-400" />
          <span>{t.telemetry.engine}</span>
        </div>
      </motion.div>
    </div>
  );
}
