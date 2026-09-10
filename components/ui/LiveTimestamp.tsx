"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMounted } from "@/lib/hooks/useMounted";

const INITIAL_CLOCK_TEXT = "UTC:--:--:-- // EPOCH:--------";

function stableOffset(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % (1000 * 60 * 60 * 24 * 12);
}

function format(epoch: number) {
  const date = new Date(epoch);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `UTC:${hh}:${mm}:${ss} // EPOCH:${epoch}`;
}

export default function LiveTimestamp({ seed, className = "" }: { seed: string; className?: string }) {
  const mounted = useMounted();
  const base = useMemo(() => stableOffset(seed), [seed]);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!mounted) return;

    const anchor = Date.now() - base;
    let frame = 0;
    let lastSecond = -1;
    const tick = () => {
      const now = Date.now();
      const second = Math.floor(now / 1000);
      if (second !== lastSecond && ref.current) {
        lastSecond = second;
        ref.current.textContent = format(anchor + (now % 1000));
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [base, mounted]);

  return <span ref={ref} suppressHydrationWarning className={className}>{INITIAL_CLOCK_TEXT}</span>;
}
