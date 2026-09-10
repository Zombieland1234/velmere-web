const DRAWER_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function pass4478FocusableElements(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(DRAWER_FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.getAttribute("aria-hidden") === "true") return false;
    if (element.closest("[aria-hidden='true']")) return false;
    if (element.tabIndex < 0) return false;
    const style = window.getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0;
  });
}

export function pass4478TrapTabKey(event: globalThis.KeyboardEvent, container: HTMLElement | null) {
  if (event.key !== "Tab") return false;
  const focusable = pass4478FocusableElements(container);
  if (!container || focusable.length === 0) {
    event.preventDefault();
    container?.focus({ preventScroll: true });
    return true;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (!active || !container.contains(active)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return true;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus({ preventScroll: true });
    return true;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return true;
  }
  return false;
}
