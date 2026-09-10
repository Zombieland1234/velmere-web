"use client";

import { useSyncExternalStore } from "react";

const subscribeToClientRuntime = () => () => undefined;
const readClientRuntime = () => true;
const readServerRuntime = () => false;

export function useMounted() {
  return useSyncExternalStore(
    subscribeToClientRuntime,
    readClientRuntime,
    readServerRuntime,
  );
}
