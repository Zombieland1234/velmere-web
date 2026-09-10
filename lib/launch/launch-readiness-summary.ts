export type LaunchReadinessSummaryItem = {
  status: string;
  progress: number;
  nextStep?: string;
};

export type LaunchReadinessSummary = {
  total: number;
  averageProgress: number;
  blockedCount: number;
  reviewCount: number;
  nextCriticalStep?: string;
};

export type LaunchReadinessSummaryOptions<T extends LaunchReadinessSummaryItem> = {
  reviewStatus?: string;
  nextStep?: (item: T) => string | undefined;
};

/**
 * One canonical implementation for the readiness summaries exposed by the
 * launch control modules. Keeping the calculation here prevents the same
 * blocked/review precedence contract from drifting across modules.
 */
export function summarizeLaunchReadiness<T extends LaunchReadinessSummaryItem>(
  items: readonly T[],
  options: LaunchReadinessSummaryOptions<T> = {},
): LaunchReadinessSummary {
  const total = items.length;
  const averageProgress = total === 0
    ? 0
    : Math.round(items.reduce((sum, item) => sum + item.progress, 0) / total);
  const blocked = items.filter((item) => item.status === "blocked");
  const review = items.filter((item) => item.status === (options.reviewStatus ?? "manual_review"));
  const nextStep = options.nextStep ?? ((item: T) => item.nextStep);
  return {
    total,
    averageProgress,
    blockedCount: blocked.length,
    reviewCount: review.length,
    nextCriticalStep: blocked[0]
      ? nextStep(blocked[0])
      : review[0]
        ? nextStep(review[0])
        : items[0]
          ? nextStep(items[0])
          : undefined,
  };
}
