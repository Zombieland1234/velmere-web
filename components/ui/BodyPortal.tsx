"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribeToClientAvailability = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function BodyPortal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribeToClientAvailability,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
