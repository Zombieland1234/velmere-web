"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";
import {
  DIALOG_FOCUS_RETURN_OBSERVER_TIMEOUT_MS,
  beginDialogFocusSession,
  canRestoreDialogFocus,
  captureDialogFocusReturnEpoch,
  createDialogFocusSessionToken,
  endDialogFocusSession,
  isDialogFocusReturnEpochCurrent,
  isTopDialogFocusSession,
} from "@/lib/ui/dialog-focus-return-policy";

type DialogBoundaryOptions = {
  onClose?: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocus?: boolean;
  closeOnOutsidePointerDown?: boolean;
};

type FocusSnapshot = {
  element: HTMLElement | null;
  id: string | null;
  selector: string | null;
  text: string | null;
};

const FOCUSABLE = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function isFocusable(element: HTMLElement | null) {
  if (!element || !element.isConnected) return false;
  if (element.hasAttribute("disabled")) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  const style = window.getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none";
}

function focusSafely(element: HTMLElement | null) {
  if (!isFocusable(element)) return false;
  try {
    element?.focus({ preventScroll: true });
  } catch {
    element?.focus();
  }
  return document.activeElement === element;
}

function buildFocusSelector(element: HTMLElement | null) {
  if (!element) return null;
  const testId = element.getAttribute("data-testid");
  if (testId) return `[data-testid="${cssEscape(testId)}"]`;
  const control = element.getAttribute("data-pass470-keyboard-control");
  if (control) return `[data-pass470-keyboard-control="${cssEscape(control)}"]`;
  const overlayTrigger = element.getAttribute("data-velmere-overlay-trigger");
  if (overlayTrigger)
    return `[data-velmere-overlay-trigger="${cssEscape(overlayTrigger)}"]`;
  const ariaControls = element.getAttribute("aria-controls");
  if (ariaControls) return `[aria-controls="${cssEscape(ariaControls)}"]`;
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel && element.tagName)
    return `${element.tagName.toLowerCase()}[aria-label="${cssEscape(ariaLabel)}"]`;
  return null;
}

function captureFocusSnapshot(): FocusSnapshot {
  const element =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return {
    element,
    id: element?.id || null,
    selector: buildFocusSelector(element),
    text:
      element?.textContent && element.textContent.trim().length <= 80
        ? element.textContent.trim()
        : null,
  };
}

function resolveFocusSnapshot(snapshot: FocusSnapshot) {
  if (isFocusable(snapshot.element)) return snapshot.element;
  if (snapshot.id) {
    const byId = document.getElementById(snapshot.id);
    if (byId instanceof HTMLElement && isFocusable(byId)) return byId;
  }
  if (snapshot.selector) {
    const bySelector = document.querySelector(snapshot.selector);
    if (bySelector instanceof HTMLElement && isFocusable(bySelector)) return bySelector;
  }
  if (snapshot.text) {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        "button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])",
      ),
    );
    const byText = candidates.find(
      (candidate) => candidate.textContent?.trim() === snapshot.text,
    );
    if (byText && isFocusable(byText)) return byText;
  }
  return null;
}

function listFocusable(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) =>
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true" &&
      isFocusable(element),
  );
}

export function useDialogFocusBoundary(
  active: boolean,
  rootRef: RefObject<HTMLElement | null>,
  options: DialogBoundaryOptions = {},
) {
  const { onClose, initialFocus, returnFocus = true, closeOnOutsidePointerDown = false } =
    options;
  const openerSnapshotRef = useRef<FocusSnapshot | null>(null);
  const latestFocusSnapshotRef = useRef<FocusSnapshot | null>(null);
  const closeRef = useRef(onClose);
  const activeRef = useRef(active);
  const sessionTokenRef = useRef(createDialogFocusSessionToken());
  const returnFrameRef = useRef<number | null>(null);
  const returnTimeoutRef = useRef<number | null>(null);
  const returnObserverRef = useRef<MutationObserver | null>(null);

  const cancelPendingReturnFocus = () => {
    if (returnFrameRef.current !== null) {
      window.cancelAnimationFrame(returnFrameRef.current);
      returnFrameRef.current = null;
    }
    if (returnTimeoutRef.current !== null) {
      window.clearTimeout(returnTimeoutRef.current);
      returnTimeoutRef.current = null;
    }
    returnObserverRef.current?.disconnect();
    returnObserverRef.current = null;
  };

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (active) return undefined;
    latestFocusSnapshotRef.current = captureFocusSnapshot();
    const onFocusIn = () => {
      latestFocusSnapshotRef.current = captureFocusSnapshot();
    };
    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
  }, [active]);

  useLayoutEffect(() => {
    if (active && !openerSnapshotRef.current) {
      openerSnapshotRef.current =
        latestFocusSnapshotRef.current ?? captureFocusSnapshot();
    }
    if (!active) openerSnapshotRef.current = null;
  }, [active]);

  useLayoutEffect(() => {
    if (!active) return undefined;
    cancelPendingReturnFocus();
    const root = rootRef.current;
    const sessionToken = sessionTokenRef.current;
    beginDialogFocusSession(sessionToken, root);
    if (!root) {
      endDialogFocusSession(sessionToken);
      return undefined;
    }

    const focusInitial = () => {
      if (!isTopDialogFocusSession(sessionToken)) return;
      const target = initialFocus?.current ?? listFocusable(root)[0] ?? root;
      focusSafely(target);
    };

    const frame = window.requestAnimationFrame(focusInitial);

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopDialogFocusSession(sessionToken)) return;
      if (event.key === "Escape") {
        if (closeRef.current) {
          event.preventDefault();
          event.stopPropagation();
          closeRef.current();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const items = listFocusable(root);
      if (!items.length) {
        event.preventDefault();
        focusSafely(root);
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        focusSafely(last);
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        focusSafely(first);
      } else if (!root.contains(document.activeElement)) {
        event.preventDefault();
        focusSafely(event.shiftKey ? last : first);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!isTopDialogFocusSession(sessionToken)) return;
      if (!closeOnOutsidePointerDown || !closeRef.current) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      event.preventDefault();
      closeRef.current();
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      cancelPendingReturnFocus();
      endDialogFocusSession(sessionToken);

      if (!returnFocus) return;
      const snapshot = openerSnapshotRef.current;
      openerSnapshotRef.current = null;
      if (!snapshot) return;
      const returnEpoch = captureDialogFocusReturnEpoch();

      const restore = () => {
        if (activeRef.current || !isDialogFocusReturnEpochCurrent(returnEpoch)) return false;
        const target = resolveFocusSnapshot(snapshot);
        if (!target || !canRestoreDialogFocus(returnEpoch, target)) return false;
        return focusSafely(target);
      };

      returnFrameRef.current = window.requestAnimationFrame(() => {
        returnFrameRef.current = null;
        if (activeRef.current || !isDialogFocusReturnEpochCurrent(returnEpoch)) return;
        if (restore()) return;
        const observer = new MutationObserver(() => {
          if (activeRef.current || !isDialogFocusReturnEpochCurrent(returnEpoch)) {
            observer.disconnect();
            returnObserverRef.current = null;
            return;
          }
          if (restore()) {
            observer.disconnect();
            returnObserverRef.current = null;
          }
        });
        returnObserverRef.current = observer;
        observer.observe(document.body, { childList: true, subtree: true });
        returnTimeoutRef.current = window.setTimeout(() => {
          observer.disconnect();
          if (returnObserverRef.current === observer) returnObserverRef.current = null;
          returnTimeoutRef.current = null;
        }, DIALOG_FOCUS_RETURN_OBSERVER_TIMEOUT_MS);
      });
    };
  }, [active, closeOnOutsidePointerDown, initialFocus, returnFocus, rootRef]);
}
