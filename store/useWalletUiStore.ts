"use client";

import { useSyncExternalStore } from "react";

export type WalletUiSnapshot = {
  connected: boolean;
  walletLabel: string;
  shortAddress: string;
  fullAddress: string;
  network: string;
  chainType: "evm" | "solana" | "unknown";
  tokenBalanceLabel: string;
  accessStatusLabel: string;
};

const defaultSnapshot: WalletUiSnapshot = {
  connected: false,
  walletLabel: "Wallet",
  shortAddress: "",
  fullAddress: "",
  network: "",
  chainType: "unknown",
  tokenBalanceLabel: "0.00 VLM",
  accessStatusLabel: "registry-gated",
};

let snapshot: WalletUiSnapshot = defaultSnapshot;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return defaultSnapshot;
}

export function setWalletUiSnapshot(next: Partial<WalletUiSnapshot>) {
  snapshot = { ...snapshot, ...next };
  emit();
}

export function clearWalletUiSnapshot() {
  snapshot = defaultSnapshot;
  emit();
}

export function useWalletUiStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
