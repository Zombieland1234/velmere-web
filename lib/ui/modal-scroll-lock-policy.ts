"use client";

export type ModalScrollCoordinates = Readonly<{
  scrollX: number;
  scrollY: number;
}>;

type PendingModalScrollRestore = ModalScrollCoordinates & {
  generation: number;
  frameId: number;
};

type ModalScrollRestoreRuntime = Readonly<{
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (frameId: number) => void;
  scrollTo: (scrollX: number, scrollY: number) => void;
  hasActiveLock: () => boolean;
}>;

let restoreGeneration = 0;
let pendingRestore: PendingModalScrollRestore | null = null;

function finiteCoordinate(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Consume a restore that has not painted yet. A rapid modal reopen uses the
 * original page coordinates for its next fixed-body snapshot instead of
 * capturing the temporary browser position left between unlock and RAF.
 */
export function consumePendingModalScrollRestore(
  runtime: Pick<ModalScrollRestoreRuntime, "cancelFrame">,
): ModalScrollCoordinates | null {
  const pending = pendingRestore;
  if (!pending) return null;
  pendingRestore = null;
  restoreGeneration += 1;
  runtime.cancelFrame(pending.frameId);
  return { scrollX: pending.scrollX, scrollY: pending.scrollY };
}

/**
 * Schedule the final page restore. The callback is generation-bound and may
 * not scroll while a newer modal owns the page. Stale callbacks become no-op.
 */
export function scheduleModalScrollRestore(
  coordinates: ModalScrollCoordinates,
  runtime: ModalScrollRestoreRuntime,
): number {
  const prior = pendingRestore;
  if (prior) runtime.cancelFrame(prior.frameId);

  const generation = restoreGeneration + 1;
  restoreGeneration = generation;
  const scrollX = finiteCoordinate(coordinates.scrollX);
  const scrollY = finiteCoordinate(coordinates.scrollY);
  const pending: PendingModalScrollRestore = {
    generation,
    frameId: -1,
    scrollX,
    scrollY,
  };
  pendingRestore = pending;
  pending.frameId = runtime.requestFrame(() => {
    if (pendingRestore !== pending || restoreGeneration !== generation) return;
    pendingRestore = null;
    if (runtime.hasActiveLock()) return;
    runtime.scrollTo(scrollX, scrollY);
  });
  return generation;
}

export function cancelPendingModalScrollRestore(
  runtime: Pick<ModalScrollRestoreRuntime, "cancelFrame">,
): void {
  const pending = pendingRestore;
  if (!pending) return;
  pendingRestore = null;
  restoreGeneration += 1;
  runtime.cancelFrame(pending.frameId);
}

export function getPendingModalScrollRestoreForTests():
  | (ModalScrollCoordinates & { generation: number })
  | null {
  return pendingRestore
    ? {
        generation: pendingRestore.generation,
        scrollX: pendingRestore.scrollX,
        scrollY: pendingRestore.scrollY,
      }
    : null;
}
