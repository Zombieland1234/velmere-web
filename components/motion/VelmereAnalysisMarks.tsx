"use client";

import type { CSSProperties } from "react";
import styles from "./VelmereAnalysisMarks.module.css";

type MarkProps = {
  className?: string;
  monochrome?: boolean;
  size?: number | string;
};

function markStyle(size: MarkProps["size"]): CSSProperties {
  return {
    "--velmere-mark-size": typeof size === "number" ? `${size}px` : size ?? "80px",
  } as CSSProperties;
}

function markClass(base: string, className: string | undefined, monochrome: boolean | undefined) {
  return [styles.mark, base, monochrome ? styles.monochrome : "", className ?? ""].filter(Boolean).join(" ");
}

export function VShieldPulse({ className, monochrome = false, size = 80 }: MarkProps) {
  return (
    <span
      className={markClass(styles.shield, className, monochrome)}
      style={markStyle(size)}
      data-velmere-motion="v-shield-pulse"
      aria-hidden="true"
    >
      <span className={styles.shieldHalo} />
      <span className={styles.shieldOrbit}><i /><i /><i /></span>
      <svg viewBox="0 0 80 80" focusable="false">
        <path className={styles.shieldGhost} d="M40 8 64 18v18c0 16-9 27-24 36C25 63 16 52 16 36V18Z" />
        <path className={styles.shieldOutline} pathLength="1" d="M40 8 64 18v18c0 16-9 27-24 36C25 63 16 52 16 36V18Z" />
        <path className={styles.shieldV} pathLength="1" d="m28 30 12 24 13-26" />
      </svg>
      <span className={styles.shieldScan} />
      <span className={styles.shieldCore} />
    </span>
  );
}

export function ProofStamp({ className, monochrome = false, size = 80 }: MarkProps) {
  return (
    <span
      className={markClass(styles.proof, className, monochrome)}
      style={markStyle(size)}
      data-velmere-motion="proof-stamp-17"
      aria-hidden="true"
    >
      <span className={styles.proofGlow} />
      <svg viewBox="0 0 80 80" focusable="false">
        <circle className={styles.proofOuterGhost} cx="40" cy="40" r="30" />
        <circle className={styles.proofOuter} cx="40" cy="40" r="30" pathLength="1" />
        <circle className={styles.proofInner} cx="40" cy="40" r="21" pathLength="1" />
        <path className={styles.proofCheck} pathLength="1" d="m27 41 9 9 18-22" />
      </svg>
      <span className={styles.proofNode} />
    </span>
  );
}
