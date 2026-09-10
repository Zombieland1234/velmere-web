type ScrollLockSnapshot = {
  bodyOverflow: string;
  htmlOverflow: string;
  bodyOverscroll: string;
  htmlOverscroll: string;
  bodyPaddingRight: string;
};

let activeAssetDetailLocks = 0;
let scrollLockSnapshot: ScrollLockSnapshot | null = null;

export function acquireAssetDetailScrollLock() {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  if (activeAssetDetailLocks === 0) {
    const body = document.body;
    const html = document.documentElement;
    scrollLockSnapshot = {
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyPaddingRight: body.style.paddingRight,
    };
    const scrollbar = Math.max(0, window.innerWidth - html.clientWidth);
    const currentPadding = Number.parseFloat(window.getComputedStyle(body).paddingRight || "0") || 0;
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    html.style.overscrollBehavior = "none";
    if (scrollbar > 0) body.style.paddingRight = `${currentPadding + scrollbar}px`;
  }

  activeAssetDetailLocks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeAssetDetailLocks = Math.max(0, activeAssetDetailLocks - 1);
    if (activeAssetDetailLocks !== 0 || !scrollLockSnapshot) return;
    const snapshot = scrollLockSnapshot;
    scrollLockSnapshot = null;
    document.body.style.overflow = snapshot.bodyOverflow;
    document.documentElement.style.overflow = snapshot.htmlOverflow;
    document.body.style.overscrollBehavior = snapshot.bodyOverscroll;
    document.documentElement.style.overscrollBehavior = snapshot.htmlOverscroll;
    document.body.style.paddingRight = snapshot.bodyPaddingRight;
  };
}

export function assetDetailOwnsScrollTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('[data-modal-wheel-owner="true"]'));
}

export function preventAssetDetailBackgroundScroll(event: Event) {
  if (assetDetailOwnsScrollTarget(event.target)) return;
  event.preventDefault();
}
