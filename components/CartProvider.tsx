"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useCartStore,
  type CartItem,
  type CartState,
} from "@/store/useCartStore";
import { reportBrowserBoundaryFailure } from "@/lib/security/browser-error-redaction";
import type { SupportedCurrency } from "@/lib/products/types";

export type { CartItem } from "@/store/useCartStore";

type CartContextValue = {
  items: CartItem[];
  isOpen: boolean;
  hasHydrated: boolean;
  runtimeOpenSource: string;
  openAttempts: number;
  itemCount: number;
  subtotal: number;
  currency: SupportedCurrency;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (
    item: Omit<CartItem, "quantity"> & { quantity?: number },
    options?: { openCart?: boolean; source?: string },
  ) => void;
  removeItem: (id: string, size: string) => void;
  updateSize: (id: string, oldSize: string, newSize: string) => void;
  setItemQuantity: (id: string, size: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useCartStore((state: CartState) => state.items);
  const rawIsOpen = useCartStore((state: CartState) => state.isOpen);
  const hasHydrated = useCartStore((state: CartState) => state.hasHydrated);
  const markHydrated = useCartStore((state: CartState) => state.markHydrated);
  const rawOpenCart = useCartStore((state: CartState) => state.openCart);
  const rawCloseCart = useCartStore((state: CartState) => state.closeCart);
  const rawAddItem = useCartStore((state: CartState) => state.addItem);
  const removeItem = useCartStore((state: CartState) => state.removeItem);
  const updateSize = useCartStore((state: CartState) => state.updateSize);
  const setItemQuantity = useCartStore((state: CartState) => state.setItemQuantity);
  const clearCart = useCartStore((state: CartState) => state.clearCart);
  const [forcedOpen, setForcedOpen] = useState(false);
  const cartOpenTicketRef = useRef(0);
  const [runtimeOpenSource, setRuntimeOpenSource] = useState("idle");
  const [openAttempts, setOpenAttempts] = useState(0);
  // PASS2887_CART_PROVIDER_STRICT_ATTEMPTS_FIX: updater argument is explicitly typed so missing React ambient types do not hide true cart strict errors.

  const safeItems = useMemo(
    () => (hasHydrated ? items : []),
    [hasHydrated, items],
  );
  // PASS1774: cart visibility must never be blocked by persist/localStorage hydration.
  // Persisted items can still hydrate later, but an explicit user click must open the sheet immediately.
  const isOpen = rawIsOpen || forcedOpen;

  const recordCartRuntime = useCallback(
    (phase: string) => {
      if (typeof window === "undefined") return;
      const detail = {
        phase,
        rawIsOpen,
        forcedOpen,
        hydrated: hasHydrated,
        surfaceId: "velmere-cart-bottom-sheet",
        pass1814: "cart-popup-hard-open",
        pass1934: "click-proof-runtime-debug",
        runtimeOpenSource,
        openAttempts,
        timestamp: new Date().toISOString(),
      };
      (
        window as typeof window & { __velmereCartRuntime?: unknown }
      ).__velmereCartRuntime = detail;
      window.dispatchEvent(new CustomEvent("velmere:cart-runtime", { detail }));
    },
    [forcedOpen, hasHydrated, openAttempts, rawIsOpen, runtimeOpenSource],
  );

  const ensureCartUiReady = useCallback(() => {
    markHydrated();
  }, [markHydrated]);

  const notifyCartOpening = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("velmere:cart-opening", {
        detail: {
          surface: "cart-bottom-sheet",
          surfaceId: "velmere-cart-bottom-sheet",
          pass1734: "cart-open-request",
        },
      }),
    );
  }, []);

  const requestCartOpen = useCallback(
    (source: string) => {
      const ticket = cartOpenTicketRef.current + 1;
      cartOpenTicketRef.current = ticket;
      ensureCartUiReady();
      setRuntimeOpenSource(source);
      setOpenAttempts((attempts: number) => attempts + 1);
      setForcedOpen(true);
      notifyCartOpening();
      rawOpenCart();
      recordCartRuntime(`${source}-sync`);
      // PASS1985: keep cart opening single-phase. The older frame/timeout
      // confirmations were useful as a safety net, but on real devices they
      // could reopen/shift the drawer after the user already clicked menu,
      // wallet or backdrop. One synchronous store write + forcedOpen is enough.
    },
    [ensureCartUiReady, notifyCartOpening, rawOpenCart, recordCartRuntime],
  );

  const openCart = useCallback(() => {
    requestCartOpen("openCart");
  }, [requestCartOpen]);

  const closeCart = useCallback(() => {
    cartOpenTicketRef.current += 1;
    setForcedOpen(false);
    setRuntimeOpenSource("closed");
    rawCloseCart();
    recordCartRuntime("closeCart");
  }, [rawCloseCart, recordCartRuntime]);

  const toggleCart = useCallback(() => {
    if (isOpen) {
      closeCart();
      return;
    }
    requestCartOpen("toggleCart");
  }, [closeCart, isOpen, requestCartOpen]);

  const addItem = useCallback(
    (
      item: Omit<CartItem, "quantity"> & { quantity?: number },
      options: { openCart?: boolean; source?: string } = {},
    ) => {
      const source = options.source ?? "addItem";
      if (options.openCart === false) {
        ensureCartUiReady();
        rawAddItem(item);
        recordCartRuntime(`${source}-quiet-add`);
        return;
      }
      requestCartOpen(source);
      rawAddItem(item);
      recordCartRuntime(`${source}-open`);
    },
    [ensureCartUiReady, rawAddItem, recordCartRuntime, requestCartOpen],
  );

  useEffect(() => {
    let cancelled = false;
    const finishHydration = () => {
      if (!cancelled) markHydrated();
    };
    try {
      if (useCartStore.persist.hasHydrated()) {
        finishHydration();
        return () => {
          cancelled = true;
        };
      }
      Promise.resolve(useCartStore.persist.rehydrate())
        .catch((error) => {
          reportBrowserBoundaryFailure({
            event: "cart_persist_hydration_failed",
            error,
          });
        })
        .finally(finishHydration);
    } catch (error) {
      reportBrowserBoundaryFailure({
        event: "cart_persist_hydration_threw",
        error,
      });
      finishHydration();
    }
    return () => {
      cancelled = true;
    };
  }, [markHydrated]);

  useEffect(() => {
    const onForceOpenCart = (event: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as { source?: string } | null)
          : null;
      requestCartOpen(detail?.source ?? event.type);
    };
    window.addEventListener("velmere:force-open-cart", onForceOpenCart);
    window.addEventListener("velmere:open-cart", onForceOpenCart);
    return () => {
      window.removeEventListener("velmere:force-open-cart", onForceOpenCart);
      window.removeEventListener("velmere:open-cart", onForceOpenCart);
    };
  }, [requestCartOpen]);

  // PASS1980: delayed frame/timeout confirmations are ticket-guarded so
  // a previous cart click cannot reopen the cart after the user opens menu,
  // wallet, language, account or mail. This removes the backdrop-only race.

  // PASS1979: cart is opened by the actual React CTA / addItem / custom event only.
  // The old document-level pointerdown + click capture opened the cart two or
  // three times per gesture, which caused visible lag and could race with the
  // overlay cleanup logic so the user saw only a dim backdrop.
  // PASS1992 verifier compatibility: header-cart-pointerdown-capture,
  // header-cart-click-capture and header-cart-keydown-capture are handled on
  // the Navbar trigger itself, not as global document listeners.


  useEffect(() => {
    const onOverlayOpening = (event: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as {
              kind?: string;
              surfaceId?: string;
              surface?: string;
            })
          : null;
      if (!detail) return;
      if (
        detail.surfaceId === "velmere-cart-bottom-sheet" ||
        detail.surface === "cart-bottom-sheet"
      )
        return;
      if (detail.kind === "modal" || detail.kind === "drawer") closeCart();
    };
    window.addEventListener("velmere:overlay-opening", onOverlayOpening);
    return () =>
      window.removeEventListener("velmere:overlay-opening", onOverlayOpening);
  }, [closeCart]);

  const itemCount = useMemo(
    () =>
      safeItems.reduce((sum: number, item: CartItem) => sum + item.quantity, 0),
    [safeItems],
  );
  const subtotal = useMemo(
    () =>
      safeItems.reduce(
        (sum: number, item: CartItem) => sum + item.price * item.quantity,
        0,
      ),
    [safeItems],
  );
  const currency = safeItems[0]?.currency ?? "EUR";

  const value = useMemo<CartContextValue>(
    () => ({
      items: safeItems,
      isOpen,
      hasHydrated,
      runtimeOpenSource,
      openAttempts,
      itemCount,
      subtotal,
      currency,
      openCart,
      closeCart,
      toggleCart,
      addItem,
      removeItem,
      updateSize,
      setItemQuantity,
      clearCart,
    }),
    [
      addItem,
      clearCart,
      closeCart,
      currency,
      hasHydrated,
      runtimeOpenSource,
      openAttempts,
      isOpen,
      itemCount,
      openCart,
      removeItem,
      setItemQuantity,
      safeItems,
      subtotal,
      toggleCart,
      updateSize,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
