"use client";

import { useCallback, useSyncExternalStore } from "react";

export type InterfaceMode = "basic" | "pro";

const STORAGE_KEY = "vlm-interface-mode";

type ModeSnapshot = {
  mode: InterfaceMode;
  isProMode: boolean;
  setMode: (mode: InterfaceMode) => void;
  toggleMode: () => void;
};

const noop = () => undefined;
const serverSnapshot: ModeSnapshot = {
  mode: "basic",
  isProMode: false,
  setMode: noop,
  toggleMode: noop,
};

let currentMode: InterfaceMode = "basic";
let currentSnapshot: ModeSnapshot;
const listeners = new Set<() => void>();

function readStoredMode(): InterfaceMode {
  if (typeof window === "undefined") return "basic";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "pro" ? "pro" : "basic";
  } catch {
    return "basic";
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function setInterfaceMode(mode: InterfaceMode) {
  currentMode = mode;
  currentSnapshot = createSnapshot();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* localStorage may be unavailable in privacy modes */
    }
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    currentMode = readStoredMode();
    currentSnapshot = createSnapshot();
  }
  return () => listeners.delete(listener);
}

function createSnapshot(): ModeSnapshot {
  return {
    mode: currentMode,
    isProMode: currentMode === "pro",
    setMode: setInterfaceMode,
    toggleMode: () => setInterfaceMode(currentMode === "pro" ? "basic" : "pro"),
  };
}

currentSnapshot = createSnapshot();

function getSnapshot(): ModeSnapshot {
  return currentSnapshot;
}

function getServerSnapshot(): ModeSnapshot {
  return serverSnapshot;
}

export function useModeStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    ...snapshot,
    setBasicMode: useCallback(() => snapshot.setMode("basic"), [snapshot]),
    setProMode: useCallback(() => snapshot.setMode("pro"), [snapshot]),
  };
}

export { STORAGE_KEY as MODE_STORAGE_KEY };
