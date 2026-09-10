"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SupportedCurrency } from "@/lib/products/types";

export type CartItem = {
  id: string;
  variantId?: string;
  name: string;
  price: number;
  currency: SupportedCurrency;
  size: string;
  image: string;
  quantity: number;
};

const MAX_QUANTITY_PER_LINE = 10;

function clampQuantity(value: unknown) {
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.min(MAX_QUANTITY_PER_LINE, numeric));
}

export type CartState = {
  items: CartItem[];
  isOpen: boolean;
  hasHydrated: boolean;
  markHydrated: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (id: string, size: string) => void;
  updateSize: (id: string, oldSize: string, newSize: string) => void;
  setItemQuantity: (id: string, size: string, quantity: number) => void;
  clearCart: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set: (partial: Partial<CartState> | ((state: CartState) => Partial<CartState> | CartState)) => void) => ({
      items: [],
      isOpen: false,
      hasHydrated: false,
      markHydrated: () => set({ hasHydrated: true }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state: CartState) => ({ isOpen: !state.isOpen })),
      addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => set((state: CartState) => {
        const quantity = clampQuantity(item.quantity ?? 1);
        const existing = state.items.find((entry: CartItem) => entry.id === item.id && entry.size === item.size);
        if (existing) {
          return {
            isOpen: true,
            items: state.items.map((entry: CartItem) =>
              entry.id === item.id && entry.size === item.size
                ? { ...entry, quantity: clampQuantity(entry.quantity + quantity) }
                : entry,
            ),
          };
        }
        return { isOpen: true, items: [...state.items, { ...item, quantity }] };
      }),
      removeItem: (id: string, size: string) => set((state: CartState) => ({
        items: state.items.filter((entry: CartItem) => !(entry.id === id && entry.size === size)),
      })),
      updateSize: (id: string, oldSize: string, newSize: string) => set((state: CartState) => {
        const target = state.items.find((entry: CartItem) => entry.id === id && entry.size === oldSize);
        if (!target) return state;
        const duplicate = state.items.find((entry: CartItem) => entry.id === id && entry.size === newSize);
        if (duplicate) {
          return {
            items: state.items
              .filter((entry: CartItem) => !(entry.id === id && entry.size === oldSize))
              .map((entry: CartItem) => entry.id === id && entry.size === newSize
                ? { ...entry, quantity: clampQuantity(entry.quantity + target.quantity) }
                : entry),
          };
        }
        return {
          items: state.items.map((entry: CartItem) =>
            entry.id === id && entry.size === oldSize
              ? { ...entry, size: newSize, variantId: undefined }
              : entry,
          ),
        };
      }),
      setItemQuantity: (id: string, size: string, quantity: number) => set((state: CartState) => {
        const nextQuantity = Math.floor(Number(quantity));
        if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
          return {
            items: state.items.filter((entry: CartItem) => !(entry.id === id && entry.size === size)),
          };
        }
        return {
          items: state.items.map((entry: CartItem) =>
            entry.id === id && entry.size === size
              ? { ...entry, quantity: clampQuantity(nextQuantity) }
              : entry,
          ),
        };
      }),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: "velmere-cart-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state: CartState) => ({ items: state.items }),
      skipHydration: true,
      onRehydrateStorage: () => (state: CartState | undefined) => {
        state?.markHydrated();
      },
    },
  ),
);
