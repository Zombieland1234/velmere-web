import { summarizeLaunchReadiness } from "@/lib/launch/launch-readiness-summary";

export type SquareVlmLaunchControlItem = {
  id: string;
  label: string;
  route: string;
  progress: number;
  status: "ready" | "partial" | "blocked" | "launch_control";
  userPromise: string;
  safetyBoundary: string;
  launchBlockers: string[];
  nextBuildStep: string;
};

export const squareVlmLaunchControl: SquareVlmLaunchControlItem[] = [
  {
    id: "vlm-access",
    label: "VLM access layer",
    route: "/[locale]/vlm-token",
    progress: 56,
    status: "launch_control",
    userPromise: "Explain VLM as a utility/access layer for private drops, Square areas and future member features.",
    safetyBoundary: "No ROI, no price promise, no public sale claim, no custody and no seed phrase flow.",
    launchBlockers: ["session gating", "contract/audit status", "legal review", "wallet safety proof"],
    nextBuildStep: "Add production session proof and keep all VLM copy utility-only before activation.",
  },
  {
    id: "vlm-faq",
    label: "VLM FAQ",
    route: "/[locale]/vlm-token/faq",
    progress: 50,
    status: "partial",
    userPromise: "Give clear answers about what VLM is, what it is not and why clothing commerce remains separate.",
    safetyBoundary: "No investment framing, no guaranteed features, no listing/liquidity promise.",
    launchBlockers: ["final legal copy", "contract status labels", "localized FAQ expansion"],
    nextBuildStep: "Expand FAQ with activation status, wallet safety, feature-change policy and member access rules.",
  },
  {
    id: "square-public",
    label: "Velmère Square public board",
    route: "/[locale]/square",
    progress: 46,
    status: "partial",
    userPromise: "Public users can read a clean signal board without needing Web3 knowledge.",
    safetyBoundary: "Publishing and member rooms stay gated; moderation must exist before public posting.",
    launchBlockers: ["moderation flow", "abuse controls", "post persistence policy", "member room rules"],
    nextBuildStep: "Make Square read-first, add moderation policy and keep wallet/member access clearly separated.",
  },
  {
    id: "square-community",
    label: "Community bridge",
    route: "/[locale]/community",
    progress: 44,
    status: "partial",
    userPromise: "Explain how clothing, Square, waitlist and VLM access connect without mixing commerce with token claims.",
    safetyBoundary: "Community perks must not become investment or yield language.",
    launchBlockers: ["final public copy", "waitlist provider", "member rules", "anti-spam policy"],
    nextBuildStep: "Tighten community landing copy and add a simple public/private feature split.",
  },
  {
    id: "member-cockpit",
    label: "Member cockpit",
    route: "/[locale]/member",
    progress: 39,
    status: "blocked",
    userPromise: "Future private dashboard for access state, saved cases, drops and Square controls.",
    safetyBoundary: "Must not expose fake balances, fake eligibility or unlocked private features without real session proof.",
    launchBlockers: ["auth/session gating", "wallet signature policy", "data storage", "audit logs"],
    nextBuildStep: "Keep member route redirected or locked until account/session proof is production ready.",
  },
];

export function getSquareVlmLaunchControlSummary() {
  const summary = summarizeLaunchReadiness(squareVlmLaunchControl, {
    reviewStatus: "launch_control",
    nextStep: (item) => item.nextBuildStep,
  });
  return {
    total: summary.total,
    averageProgress: summary.averageProgress,
    blockedCount: summary.blockedCount,
    launchControlCount: summary.reviewCount,
    nextCriticalStep: summary.nextCriticalStep,
  };
}
