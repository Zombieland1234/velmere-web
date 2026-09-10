"use client";

import type { CSSProperties, ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "article" | "aside";
};

export default function Reveal({ children, className = "", delay = 0, as = "div" }: RevealProps) {
  const Component = as;
  const revealStyle = {
    "--velmere-reveal-delay": `${Math.max(0, delay) * 1000}ms`,
  } as CSSProperties;

  return (
    <Component
      className={`velmere-safe-reveal ${className}`}
      style={revealStyle}
    >
      {children}
    </Component>
  );
}
