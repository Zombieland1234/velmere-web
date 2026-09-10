"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useVelmereMotionProfile } from "@/components/ui/useVelmereMotionProfile";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const motionProfile = useVelmereMotionProfile();
  const reducedMotion = motionProfile.duration.standard === 0;
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const element = surfaceRef.current;
    if (!element || reducedMotion) return;
    const animation = element.animate(
      [
        { opacity: 0.985, transform: `translateY(${motionProfile.distance.micro}px)` },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: Math.min(motionProfile.duration.standard, 0.34) * 1000,
        easing: `cubic-bezier(${motionProfile.easing.join(",")})`,
        fill: "both",
      },
    );
    return () => animation.cancel();
  }, [motionProfile.distance.micro, motionProfile.duration.standard, motionProfile.easing, pathname, reducedMotion]);

  return (
    <motion.div
      ref={surfaceRef}
      // Keep the server-rendered route visible by default. A failed or delayed
      // motion hydration must never leave the whole page at opacity: 0.
      initial={false}
      className="velmere-page-transition relative z-10 flex-grow overflow-x-clip"
      data-velmere-route-path={pathname}
    >
      {!reducedMotion ? <span key={pathname} className="velmere-route-wash" aria-hidden="true" /> : null}
      {children}
    </motion.div>
  );
}
