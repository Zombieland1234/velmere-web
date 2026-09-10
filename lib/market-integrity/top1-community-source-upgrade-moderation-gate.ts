export type Pass2825CommunityModerationDecision =
  | "public_read_only"
  | "publish_allowed"
  | "queued_for_review"
  | "blocked"
  | "source_upgrade_pending"
  | "source_upgrade_approved"
  | "source_upgrade_rejected";

export type Pass2825CommunitySourceUpgradeModerationGate = {
  schemaVersion: "pass2825_community_source_upgrade_moderation_gate_v1";
  surface: string;
  contentType: "community_post" | "research_note" | "project_reply" | "risk_observation" | "audit_discussion" | "source_request" | "pdf" | "api";
  decision: Pass2825CommunityModerationDecision;
  customerVisibleState: string;
  publishAllowed: boolean;
  sourceUpgradeAllowed: boolean;
  pdfSourceReceiptAllowed: boolean;
  moderationState: "public_read_only" | "queued" | "approved" | "blocked" | "escalated";
  authorBoundary: {
    accountBound: boolean;
    walletBound: boolean;
    role: "anonymous" | "member" | "verified_project" | "moderator" | "admin" | "operator";
    rule: string;
  };
  linkSafety: {
    linkCount: number;
    unsafeLinkBlocked: boolean;
    unsafeClaimBlocked: boolean;
    blockedReasons: string[];
    rule: string;
  };
  sourceUpgrade: {
    requested: boolean;
    status: "not_requested" | "pending_moderator_review" | "approved_with_receipt" | "rejected";
    sourceReceiptId: string | null;
    moderatorId: string | null;
    payloadHash: string | null;
    sourceReceiptRoot: string | null;
    rule: string;
  };
  antiSpamBudget: {
    firstPost: boolean;
    postsInWindow: number;
    maxPostsInWindow: number;
    status: "ok" | "review" | "blocked";
  };
  releaseGate: {
    status: "allow" | "review" | "block";
    reason: string;
  };
  pdfRenderRule: string;
  auditTrail: Array<{
    kind: "identity" | "moderation" | "link_safety" | "source_upgrade" | "pdf_boundary" | "anti_spam";
    status: string;
  }>;
};

export const PASS2825_COMMUNITY_SOURCE_UPGRADE_ACCEPTANCE_GATES = [
  "PASS2825: Community/Square posts are opinion or source requests by default; they cannot become PDF source receipts without moderator approval and source-upgrade receipt.",
  "PASS2825: Public read is allowed, but publishing requires account/session boundary and first-post/reputation moderation state.",
  "PASS2825: Unsafe links, private/internal URLs, seed/private-key text, buy/sell prompts and guaranteed-profit claims block publishing or force review.",
  "PASS2825: Verified-project and moderator roles can request source upgrade, but PDF/source-root use still requires receipt id, moderator id, payloadHash and sourceReceiptRoot binding.",
  "PASS2825: Community link/post content must never boost risk confidence, unlock paid evidence, or rewrite PDF truth without an explicit source-upgrade receipt.",
] as const;

function normalize(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function containsUnsafeCommunityClaim(text?: string | null) {
  const safe = text ?? "";
  const reasons: string[] = [];
  if (/seed\s*phrase|private\s*key|mnemonic|recovery\s*phrase/i.test(safe)) reasons.push("secret_material_detected");
  if (/\bbuy\s+now\b|\bsell\s+now\b|ape\s+now|guaranteed\s+(profit|return|pump)|risk[- ]?free|100%\s+safe/i.test(safe)) reasons.push("trade_prompt_or_guaranteed_claim");
  if (/<\s*script|javascript:|data:text\/html|onerror\s*=|onclick\s*=/i.test(safe)) reasons.push("script_or_html_injection_attempt");
  if (/\b(localhost|127\.0\.0\.1|0\.0\.0\.0|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)\b/i.test(safe)) reasons.push("private_network_reference");
  return reasons;
}

export function buildPass2825CommunitySourceUpgradeModerationGate(args: {
  surface: string;
  contentType?: Pass2825CommunitySourceUpgradeModerationGate["contentType"];
  body?: string | null;
  title?: string | null;
  tags?: string[];
  authorRole?: Pass2825CommunitySourceUpgradeModerationGate["authorBoundary"]["role"];
  accountBound?: boolean;
  walletBound?: boolean;
  firstPost?: boolean;
  postsInWindow?: number;
  maxPostsInWindow?: number;
  moderationState?: "public_read_only" | "queued" | "approved" | "blocked" | "escalated";
  unsafeLinkBlocked?: boolean;
  unsafeClaimBlocked?: boolean;
  linkCount?: number;
  requestedSourceUpgrade?: boolean;
  sourceReceiptId?: string | null;
  moderatorId?: string | null;
  payloadHash?: string | null;
  sourceReceiptRoot?: string | null;
  sourceUpgradeRejected?: boolean;
}): Pass2825CommunitySourceUpgradeModerationGate {
  const contentType = args.contentType ?? "community_post";
  const role = args.authorRole ?? (args.accountBound ? "member" : "anonymous");
  const firstPost = Boolean(args.firstPost);
  const postsInWindow = Math.max(0, Number(args.postsInWindow ?? 0));
  const maxPostsInWindow = Math.max(1, Number(args.maxPostsInWindow ?? 8));
  const rawText = `${args.title ?? ""}\n${args.body ?? ""}\n${(args.tags ?? []).join(" ")}`;
  const claimReasons = containsUnsafeCommunityClaim(rawText);
  const unsafeClaimBlocked = Boolean(args.unsafeClaimBlocked) || claimReasons.length > 0;
  const unsafeLinkBlocked = Boolean(args.unsafeLinkBlocked);
  const blockedReasons = [
    ...(unsafeLinkBlocked ? ["unsafe_link_blocked"] : []),
    ...claimReasons,
  ];
  const accountBound = Boolean(args.accountBound);
  const walletBound = Boolean(args.walletBound);
  const moderationState = args.moderationState ?? (!accountBound ? "public_read_only" : firstPost ? "queued" : "queued");
  const requested = Boolean(args.requestedSourceUpgrade);
  const sourceReceiptId = normalize(args.sourceReceiptId);
  const moderatorId = normalize(args.moderatorId);
  const payloadHash = normalize(args.payloadHash);
  const sourceReceiptRoot = normalize(args.sourceReceiptRoot);
  const roleCanRequestUpgrade = ["verified_project", "moderator", "admin", "operator"].includes(role);
  const sourceUpgradeApproved = requested && !args.sourceUpgradeRejected && Boolean(sourceReceiptId && moderatorId && payloadHash && sourceReceiptRoot) && roleCanRequestUpgrade;
  const antiSpamBlocked = postsInWindow > maxPostsInWindow;
  const antiSpamReview = firstPost || postsInWindow > Math.max(1, Math.floor(maxPostsInWindow * 0.6));
  let decision: Pass2825CommunityModerationDecision;
  if (!accountBound && contentType !== "pdf" && contentType !== "api") decision = "public_read_only";
  else if (unsafeLinkBlocked || unsafeClaimBlocked || moderationState === "blocked" || antiSpamBlocked) decision = "blocked";
  else if (requested && args.sourceUpgradeRejected) decision = "source_upgrade_rejected";
  else if (sourceUpgradeApproved) decision = "source_upgrade_approved";
  else if (requested) decision = "source_upgrade_pending";
  else if (moderationState === "approved" && !firstPost && !antiSpamReview) decision = "publish_allowed";
  else decision = "queued_for_review";
  const publishAllowed = decision === "publish_allowed" || decision === "source_upgrade_approved";
  const sourceUpgradeAllowed = decision === "source_upgrade_approved";
  const pdfSourceReceiptAllowed = sourceUpgradeAllowed;
  const releaseStatus = decision === "blocked" || decision === "source_upgrade_rejected" ? "block" : decision === "publish_allowed" || decision === "source_upgrade_approved" ? "allow" : "review";
  return {
    schemaVersion: "pass2825_community_source_upgrade_moderation_gate_v1",
    surface: args.surface,
    contentType,
    decision,
    customerVisibleState: decision === "public_read_only"
      ? "Square is public-read here; publishing requires account/session boundary."
      : decision === "blocked"
        ? "Community content is blocked by link/claim/moderation/anti-spam policy."
        : decision === "source_upgrade_approved"
          ? "Community item has moderator-approved source-upgrade receipt and may be referenced as a receipt-bound source."
          : decision === "source_upgrade_pending"
            ? "Community item is queued for moderator/source-upgrade review and cannot affect PDF truth yet."
            : decision === "publish_allowed"
              ? "Community item can publish as opinion/research note but remains non-source evidence until upgraded."
              : "Community item is queued for review before publishing.",
    publishAllowed,
    sourceUpgradeAllowed,
    pdfSourceReceiptAllowed,
    moderationState: decision === "blocked" ? "blocked" : decision === "publish_allowed" || decision === "source_upgrade_approved" ? "approved" : moderationState,
    authorBoundary: {
      accountBound,
      walletBound,
      role,
      rule: "Wallet/account identity can authorize posting context, but cannot upgrade a community claim into source truth without moderator receipt.",
    },
    linkSafety: {
      linkCount: Math.max(0, Number(args.linkCount ?? 0)),
      unsafeLinkBlocked,
      unsafeClaimBlocked,
      blockedReasons,
      rule: "Unsafe links, internal/private network references, scripts and trade-pressure claims are blocked or forced into review.",
    },
    sourceUpgrade: {
      requested,
      status: sourceUpgradeApproved ? "approved_with_receipt" : requested && args.sourceUpgradeRejected ? "rejected" : requested ? "pending_moderator_review" : "not_requested",
      sourceReceiptId,
      moderatorId,
      payloadHash,
      sourceReceiptRoot,
      rule: "A Square item can become source evidence only when sourceReceiptId, moderatorId, payloadHash and sourceReceiptRoot are bound together.",
    },
    antiSpamBudget: {
      firstPost,
      postsInWindow,
      maxPostsInWindow,
      status: antiSpamBlocked ? "blocked" : antiSpamReview ? "review" : "ok",
    },
    releaseGate: {
      status: releaseStatus,
      reason: releaseStatus === "allow"
        ? "Community item passed account/moderation/link/spam checks; source use is still receipt-bound."
        : releaseStatus === "review"
          ? "Community item requires moderator review or source-upgrade receipt before publishing/source use."
          : "Community item is blocked by unsafe link/claim/moderation/anti-spam policy.",
    },
    pdfRenderRule: "PDF/report/source roots may include community material only after moderator-approved source-upgrade receipt; otherwise render as opinion/source request metadata only.",
    auditTrail: [
      { kind: "identity", status: accountBound ? `account_bound:${role}` : "public_read_only" },
      { kind: "moderation", status: moderationState },
      { kind: "link_safety", status: unsafeLinkBlocked || unsafeClaimBlocked ? "blocked_or_review" : "clean" },
      { kind: "source_upgrade", status: sourceUpgradeApproved ? "approved_with_receipt" : requested ? "pending" : "not_requested" },
      { kind: "pdf_boundary", status: pdfSourceReceiptAllowed ? "receipt_allowed" : "metadata_only" },
      { kind: "anti_spam", status: antiSpamBlocked ? "blocked" : antiSpamReview ? "review" : "ok" },
    ],
  };
}
