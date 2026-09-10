"use client";


import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CartItem } from "@/components/CartProvider";

export type CartCheckoutGuardLine = {
  lineId: string;
  outcome: "allowed" | "blocked";
  productId: string;
  slug?: string;
  variantId?: string;
  selectedSize?: string;
  quantity: number;
  title?: string;
  variantTitle?: string;
  status?: string;
  provider?: string;
  fulfilmentMode?: string;
  unitAmount?: number;
  currency?: string;
  displayPrice?: string;
  providerVariantId?: string;
  stockQuantity?: number | null;
  available?: boolean | null;
  customerVisibility: "purchasable" | "preview" | "hidden" | "unknown";
  reasonCodes: string[];
  message: string;
  evidence?: {
    publicCatalogReadthrough?: boolean;
    publicationStateApplied?: boolean;
    activeStatus?: boolean;
    priceReady?: boolean;
    variantReady?: boolean;
    providerMappingReady?: boolean;
    stockReady?: boolean;
    checkoutFulfilmentReady?: boolean;
  };
};

export type CartCheckoutGuardReceipt = {
  schemaVersion: "velmere.product.checkout-guard-receipt.v1";
  receiptId: string;
  generatedAt: string;
  mode: "add_to_cart" | "checkout";
  locale: "pl" | "en" | "de";
  ok: boolean;
  allowedCount: number;
  blockedCount: number;
  maxQuantityPerLine: number;
  catalogReadthrough?: {
    mode?: string;
    durableStorageReady?: boolean;
    visibleProductCount?: number;
    purchasableProductCount?: number;
    lastOverrideAt?: string | null;
    warnings?: string[];
  };
  lines: CartCheckoutGuardLine[];
  customerBoundary?: string;
};

export type CartCheckoutGuardStatus =
  | "idle"
  | "empty"
  | "checking"
  | "allowed"
  | "blocked"
  | "error";

export type CartCheckoutGuardState = {
  status: CartCheckoutGuardStatus;
  isChecking: boolean;
  receipt: CartCheckoutGuardReceipt | null;
  error: string | null;
  lastCheckedAt: string | null;
  recheck: () => Promise<CartCheckoutGuardReceipt | null>;
};

type CheckoutGuardApiPayload = {
  ok?: boolean;
  receipt?: CartCheckoutGuardReceipt;
  error?: string;
  details?: unknown;
};

function normalizeLocale(locale: unknown): "pl" | "en" | "de" {
  return locale === "en" || locale === "de" || locale === "pl" ? locale : "pl";
}

function toGuardItems(items: CartItem[]) {
  return items.map((item) => ({
    productId: item.id,
    variantId: item.variantId,
    selectedSize: item.size,
    size: item.size,
    quantity: item.quantity,
  }));
}

function fingerprintItems(items: CartItem[]) {
  return JSON.stringify(
    items.map((item) => ({
      id: item.id,
      variantId: item.variantId ?? "",
      size: item.size,
      quantity: item.quantity,
    })),
  );
}

function statusFromReceipt(receipt: CartCheckoutGuardReceipt | null) {
  if (!receipt) return "error" as const;
  if (receipt.lines.length === 0) return "empty" as const;
  return receipt.ok ? "allowed" as const : "blocked" as const;
}

export function findCheckoutGuardLineForItem(
  receipt: CartCheckoutGuardReceipt | null,
  item: Pick<CartItem, "id" | "variantId" | "size">,
) {
  if (!receipt) return null;
  return (
    receipt.lines.find(
      (line) =>
        line.productId === item.id &&
        (line.variantId === item.variantId || !item.variantId) &&
        (line.selectedSize === item.size || line.variantTitle === item.size),
    ) ??
    receipt.lines.find(
      (line) =>
        line.productId === item.id &&
        (line.selectedSize === item.size || line.variantTitle === item.size),
    ) ??
    receipt.lines.find((line) => line.productId === item.id) ??
    null
  );
}

export function summarizeCheckoutGuardBlock(
  receipt: CartCheckoutGuardReceipt | null,
  fallback: string,
) {
  const blocked = receipt?.lines.find((line) => line.outcome === "blocked");
  return blocked?.message ?? fallback;
}

export function useCartCheckoutGuard({
  items,
  locale,
  mode = "checkout",
  enabled = true,
}: {
  items: CartItem[];
  locale: string;
  mode?: "add_to_cart" | "checkout";
  enabled?: boolean;
}): CartCheckoutGuardState {
  const safeLocale = normalizeLocale(locale);
  const [status, setStatus] = useState<CartCheckoutGuardStatus>("idle");
  const [receipt, setReceipt] = useState<CartCheckoutGuardReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const itemsFingerprint = useMemo(() => fingerprintItems(items), [items]);

  const runGuard = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled || items.length === 0) {
        setStatus(items.length === 0 ? "empty" : "idle");
        setReceipt(null);
        setError(null);
        return null;
      }

      const sequence = requestSeqRef.current + 1;
      requestSeqRef.current = sequence;
      setStatus("checking");
      setError(null);

      try {
        const response = await fetch("/api/products/checkout-guard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locale: safeLocale,
            mode,
            items: toGuardItems(items),
          }),
          signal,
        });
        const payload = await readJsonResponseBounded<CheckoutGuardApiPayload>(response, 2 * 1024 * 1024).catch(() => null);
        if (signal?.aborted || sequence !== requestSeqRef.current) return null;

        const nextReceipt = payload?.receipt ?? null;
        setReceipt(nextReceipt);
        setLastCheckedAt(new Date().toISOString());

        if (!nextReceipt) {
          setStatus("error");
          setError(payload?.error ?? "checkout_guard_unavailable");
          return null;
        }

        const nextStatus = statusFromReceipt(nextReceipt);
        setStatus(nextStatus);
        setError(response.ok || nextStatus === "blocked" ? null : payload?.error ?? "checkout_guard_failed");
        return nextReceipt;
      } catch (requestError) {
        if (signal?.aborted || sequence !== requestSeqRef.current) return null;
        setStatus("error");
        setReceipt(null);
        setLastCheckedAt(new Date().toISOString());
        setError(requestError instanceof Error ? requestError.message : "checkout_guard_failed");
        return null;
      }
    },
    [enabled, items, mode, safeLocale],
  );

  const recheck = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return runGuard(controller.signal);
  }, [runGuard]);

  useEffect(() => {
    abortRef.current?.abort();
    if (!enabled || items.length === 0) {
      const timer = window.setTimeout(() => {
        setStatus(items.length === 0 ? "empty" : "idle");
        setReceipt(null);
        setError(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => {
      void runGuard(controller.signal);
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, items.length, itemsFingerprint, runGuard]);

  return {
    status,
    isChecking: status === "checking",
    receipt,
    error,
    lastCheckedAt,
    recheck,
  };
}
