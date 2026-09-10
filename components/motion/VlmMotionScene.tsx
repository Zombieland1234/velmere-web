"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./VlmMotionScene.module.css";

type VlmMotionSceneProps = {
  variant?: number;
  active?: boolean;
  compact?: boolean;
  monochrome?: boolean;
  className?: string;
};

const nodes = [78, 112, 148, 186, 226, 268, 312, 354, 394, 434, 472, 510, 548, 586, 624, 662, 700, 734];

export function VlmMotionScene({
  variant = 1,
  active,
  compact = false,
  monochrome = false,
  className = "",
}: VlmMotionSceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(active ?? false);
  const rawId = useId();
  const gradientId = `vlm-motion-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const safeVariant = Math.max(1, Math.min(10, Math.round(variant)));
  const isVisible = active ?? visible;

  useEffect(() => {
    if (active !== undefined) return;
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio > 0.16),
      { threshold: [0, 0.16, 0.55] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);

  return (
    <div
      ref={rootRef}
      className={`${styles.scene} ${compact ? styles.compact : ""} ${className}`}
      data-active={isVisible ? "true" : "false"}
      data-monochrome={monochrome ? "true" : undefined}
      data-variant={safeVariant}
      aria-hidden="true"
    >
      <svg viewBox="0 0 820 220" preserveAspectRatio="xMidYMid meet" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset=".18" stopColor="currentColor" stopOpacity=".78" />
            <stop offset=".5" stopColor="var(--motion-warm)" stopOpacity=".98" />
            <stop offset=".82" stopColor="currentColor" stopOpacity=".78" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          <filter id={`${gradientId}-soft`} x="-25%" y="-55%" width="150%" height="210%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
        </defs>

        <g className={styles.ambient}>
          <path d="M54 110H766" />
          <path d="M164 72C260 20 560 20 656 72" />
          <path d="M164 148C260 200 560 200 656 148" />
        </g>

        <g className={styles.wave} fill="none" stroke={`url(#${gradientId})`}>
          <path d="M54 110C142 110 158 60 240 73S340 148 410 110 510 72 580 145 678 110 766 110" />
          <path d="M54 110C142 110 166 148 248 139S340 72 410 110 510 145 580 77 678 110 766 110" />
          <path d="M54 110C152 110 176 86 258 91S345 129 410 110 500 91 566 130 672 110 766 110" />
        </g>

        <g className={styles.vector} fill="none" stroke={`url(#${gradientId})`}>
          <path d="M80 50L410 166 740 50" />
          <path d="M106 64L410 153 714 64" />
          <path d="M134 79L410 140 686 79" />
        </g>

        <g className={styles.orbit} fill="none">
          <circle cx="410" cy="110" r="31" />
          <circle cx="410" cy="110" r="55" />
          <ellipse cx="410" cy="110" rx="126" ry="44" transform="rotate(-12 410 110)" />
          <ellipse cx="410" cy="110" rx="126" ry="44" transform="rotate(12 410 110)" />
        </g>

        <g className={styles.depth} fill="none" stroke={`url(#${gradientId})`}>
          <path d="M62 58H142V66H201V78H255V91H307V105H361V118H410" />
          <path d="M410 118H461V105H513V92H566V78H620V66H678V58H758" />
          <path d="M62 162H142V154H201V142H255V129H307V116H361V103H410" />
          <path d="M410 103H461V116H513V129H566V142H620V154H678V162H758" />
        </g>

        <g className={styles.helix} fill="none" stroke={`url(#${gradientId})`}>
          <path d="M62 110C116 44 170 44 224 110S332 176 386 110 494 44 548 110 656 176 758 110" />
          <path d="M62 110C116 176 170 176 224 110S332 44 386 110 494 176 548 110 656 44 758 110" />
          {nodes.slice(1, 17).map((x, index) => <path key={x} d={`M${x} ${74 + (index % 2) * 72}V${146 - (index % 2) * 72}`} />)}
        </g>

        <g className={styles.lattice}>
          {nodes.map((x, index) => <circle key={x} cx={x} cy={74 + ((index * 37) % 74)} r="1.7" />)}
          {nodes.slice(0, -1).map((x, index) => <path key={x} d={`M${x} ${74 + ((index * 37) % 74)}L${nodes[index + 1]} ${74 + (((index + 1) * 37) % 74)}`} />)}
        </g>

        <g className={styles.rain}>
          {nodes.slice(2, 16).map((x, index) => <path key={x} d={`M${x} ${28 + (index % 4) * 8}V${70 + (index % 5) * 13}`} />)}
          <path d="M250 70L410 166 570 70" />
        </g>

        <g className={styles.corridor} fill="none" stroke={`url(#${gradientId})`}>
          <path d="M48 110H772" />
          <path d="M48 92C180 92 262 48 410 110 558 172 640 128 772 128" />
          <path d="M48 128C180 128 262 172 410 110 558 48 640 92 772 92" />
        </g>

        <g className={styles.phase} fill="none">
          <path d="M120 110H325L356 110 375 68 394 152 414 82 433 134 452 110H700" />
          <circle cx="410" cy="110" r="68" />
          <circle cx="410" cy="110" r="93" />
        </g>

        <g className={styles.scan}>
          <rect x="120" y="41" width="580" height="138" rx="7" />
          <path d="M150 75H670M150 110H670M150 145H670M220 55V165M315 55V165M410 55V165M505 55V165M600 55V165" />
          <path className={styles.scanLine} d="M165 42V178" />
        </g>

        <g className={styles.core}>
          <circle className={styles.coreGlow} cx="410" cy="110" r="27" filter={`url(#${gradientId}-soft)`} />
          <circle cx="410" cy="110" r="19" />
          <path d="M391 110H400L405 94 412 127 419 101 424 110H431" />
        </g>
      </svg>
    </div>
  );
}
