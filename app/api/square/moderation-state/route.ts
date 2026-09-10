import { NextResponse } from "next/server";
import { PASS2825_COMMUNITY_SOURCE_UPGRADE_ACCEPTANCE_GATES, buildPass2825CommunitySourceUpgradeModerationGate } from "@/lib/market-integrity/top1-community-source-upgrade-moderation-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const gate = buildPass2825CommunitySourceUpgradeModerationGate({
    surface: "Square Moderation State",
    contentType: (url.searchParams.get("contentType") as "community_post" | "research_note" | "project_reply" | "risk_observation" | "audit_discussion" | "source_request" | "pdf" | "api" | null) ?? "community_post",
    title: url.searchParams.get("title") ?? "Square moderation diagnostic",
    body: url.searchParams.get("body"),
    tags: (url.searchParams.get("tags") ?? "square,moderation,source-upgrade").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 6),
    authorRole: (url.searchParams.get("role") as "anonymous" | "member" | "verified_project" | "moderator" | "admin" | "operator" | null) ?? (url.searchParams.get("accountBound") === "1" ? "member" : "anonymous"),
    accountBound: url.searchParams.get("accountBound") === "1",
    walletBound: url.searchParams.get("walletBound") === "1",
    firstPost: url.searchParams.get("firstPost") === "1",
    postsInWindow: Number(url.searchParams.get("postsInWindow") ?? 0),
    maxPostsInWindow: Number(url.searchParams.get("maxPostsInWindow") ?? 8),
    moderationState: url.searchParams.get("moderationState") === "approved" ? "approved" : url.searchParams.get("moderationState") === "blocked" ? "blocked" : "queued",
    unsafeLinkBlocked: url.searchParams.get("unsafeLink") === "1",
    linkCount: Number(url.searchParams.get("linkCount") ?? 0),
    requestedSourceUpgrade: url.searchParams.get("sourceUpgrade") === "1",
    sourceReceiptId: url.searchParams.get("sourceReceiptId"),
    moderatorId: url.searchParams.get("moderatorId"),
    payloadHash: url.searchParams.get("payloadHash"),
    sourceReceiptRoot: url.searchParams.get("sourceReceiptRoot"),
    sourceUpgradeRejected: url.searchParams.get("sourceUpgradeRejected") === "1",
  });

  return NextResponse.json({
    ok: gate.releaseGate.status !== "block",
    pass: 2825,
    gate,
    acceptanceGates: PASS2825_COMMUNITY_SOURCE_UPGRADE_ACCEPTANCE_GATES,
    customerSafeCopy: "Square is public-read, gated-publish and moderation-first. Community posts do not become source truth until source-upgrade receipt binds moderator, payloadHash and sourceReceiptRoot.",
  }, { headers: { "Cache-Control": "no-store" } });
}
