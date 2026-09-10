import {
  PASS627_LUXURY_EASE,
  resolvePass627MotionProfile,
} from "@/lib/ui/motion-constitution";

export const luxuryEase = PASS627_LUXURY_EASE;

const defaultMotion = resolvePass627MotionProfile();

export const fadeUp = {
  initial: false,
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: defaultMotion.distance.micro },
  transition: { duration: defaultMotion.duration.emphasis, ease: luxuryEase },
};

export const drawerMotion = {
  initial: { x: "-100%" },
  animate: { x: "0%" },
  exit: { x: "-100%" },
  transition: { duration: defaultMotion.duration.emphasis, ease: luxuryEase },
};
