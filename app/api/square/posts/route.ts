import { NextResponse } from "next/server";
import { applyApiRateLimit as applyPass2177SoftRateLimit, assertSameOriginRequest as assertPass2177SameOriginRequest, rejectLargeContentLength as rejectPass2177LargeContentLength } from "@/lib/security/api-guard";
import { z } from "zod";
import { createSquarePost, getOwnSquarePosts, getSquarePosts } from "@/lib/db/square-service";
import { requireVelmereSession } from "@/lib/api/request-guards";
import { appendPass2178MutationReceipt } from "@/lib/security/mutation-receipt-vault";
import { completePass4394ClientRequestJsonResponse, registerPass4394ClientRequestMutation } from "@/lib/security/client-request-idempotency";
import { pass4396IdempotencyReplayResponse } from "@/lib/security/idempotency-replay-response";
import { buildPass2814CommunityLinkSafety } from "@/lib/market-integrity/top1-source-poisoning-ssrf-firewall";
import { buildPass2815CommunityModerationVault } from "@/lib/market-integrity/top1-report-integrity-vault";
import { buildPass2816CommunityModerationObservability } from "@/lib/market-integrity/top1-runtime-observability-ledger";
import { buildPass2825CommunitySourceUpgradeModerationGate } from "@/lib/market-integrity/top1-community-source-upgrade-moderation-gate";
import { buildPass2826CustomerSafeNarrativeGate } from "@/lib/market-integrity/top1-customer-safe-narrative-gate";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { CustomerOwnedWriteBoundaryError, customerOwnedWriteErrorPayload } from "@/lib/db/customer-owned-write-boundary";

export const dynamic = "force-dynamic";

const LOCALES = new Set(["en", "pl", "de"]);

const postSchema = z.object({
  locale: z.string().default("en").transform((value: string) => (LOCALES.has(value) ? value : "en")),
  title: z.string().trim().min(2).max(96).default("Velmère Square Signal"),
  body: z.string().trim().min(1).max(1200),
  imageUrl: z.string().url().max(500).optional().or(z.literal("").transform(() => undefined)),
  tags: z.array(z.string().trim().max(32)).max(6).default([]),
});

const PASS2806_BLOCKED_SQUARE_PATTERNS = [
  /seed\s*phrase/i,
  /private\s*key/i,
  /\bbuy\s+now\b/i,
  /\bsell\s+now\b/i,
  /guaranteed\s+(profit|return|pump)/i,
  /<\s*script/i,
  /javascript\s*:/i,
] as const;

function sanitizeSquareText(value: string) {
  const withoutControls = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127 ? " " : character;
  }).join("");
  return withoutControls
    .replace(/[<>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPass2806SquareSafety(payload: z.infer<typeof postSchema>) {
  const title = sanitizeSquareText(payload.title);
  const body = sanitizeSquareText(payload.body);
  const tags = payload.tags.map(sanitizeSquareText).filter(Boolean).slice(0, 6);
  const joined = `${title}
${body}
${tags.join(" ")}`;
  const blocked = PASS2806_BLOCKED_SQUARE_PATTERNS.find((pattern) => pattern.test(joined));
  const pass2814LinkSafety = buildPass2814CommunityLinkSafety({ body, imageUrl: payload.imageUrl, tags });
  const pass2815CommunityModerationVault = buildPass2815CommunityModerationVault({
    moderationState: pass2814LinkSafety.moderationState,
    linkState: pass2814LinkSafety.moderationState,
    bodyLength: body.length,
    tagCount: tags.length,
  });
  const pass2816CommunityModerationObservability = buildPass2816CommunityModerationObservability({
    moderationState: blocked || pass2814LinkSafety.moderationState === "blocked" ? "blocked" : "queued_for_review",
    bodyLength: body.length,
    tagCount: tags.length,
    unsafeLinkBlocked: pass2814LinkSafety.moderationState === "blocked",
  });
  const pass2825CommunitySourceUpgradeGate = buildPass2825CommunitySourceUpgradeModerationGate({
    surface: "Square POST",
    contentType: tags.includes("source-request") ? "source_request" : "community_post",
    title,
    body,
    tags,
    authorRole: "member",
    accountBound: true,
    walletBound: false,
    firstPost: true,
    postsInWindow: 1,
    maxPostsInWindow: 8,
    moderationState: blocked || pass2814LinkSafety.moderationState === "blocked" ? "blocked" : "queued",
    unsafeLinkBlocked: pass2814LinkSafety.moderationState === "blocked",
    linkCount: payload.imageUrl ? 1 : 0,
    requestedSourceUpgrade: tags.includes("source-request"),
    payloadHash: pass2815CommunityModerationVault.moderationHash,
    sourceReceiptRoot: pass2815CommunityModerationVault.moderationHash,
  });
  const pass2826CustomerSafeNarrativeGate = buildPass2826CustomerSafeNarrativeGate({
    surface: "Square POST",
    tier: "Basic",
    assetFamily: "community",
    locale: payload.locale as "en" | "pl" | "de",
    narrativeText: `${title} ${body}`,
    riskScorePresent: false,
    confidenceScorePresent: false,
    sourceFamilyCount: tags.includes("source-request") ? 0 : 1,
    missingEvidenceCount: tags.includes("source-request") ? 1 : 0,
    providerConflictCount: 0,
    topDriversCount: 0,
    mitigatorsCount: 0,
    confidenceCapReason: "Community posts are opinion/source requests until moderation/source-upgrade receipts exist.",
    paidEvidenceAllowed: false,
    advancedReviewAllowed: false,
    sourceReceiptPresent: false,
    methodologyLinked: true,
    missingEvidenceShown: true,
    tierBoundaryShown: true,
    notAdviceShown: true,
    localePure: true,
  });
  return {
    ok: !blocked && pass2814LinkSafety.moderationState !== "blocked" && pass2825CommunitySourceUpgradeGate.releaseGate.status !== "block" && pass2826CustomerSafeNarrativeGate.releaseGate.status !== "block",
    title,
    body,
    tags,
    moderationState: pass2825CommunitySourceUpgradeGate.moderationState === "approved" ? "approved" as const : "queued_for_review" as const,
    claimBoundary: "Community content is treated as opinion/source request until a moderator source-upgrade receipt binds it to payloadHash and sourceReceiptRoot.",
    blockedReason: blocked ? "unsafe_or_manipulative_square_claim" : pass2814LinkSafety.moderationState === "blocked" ? "unsafe_or_private_link_blocked" : pass2825CommunitySourceUpgradeGate.releaseGate.status === "block" ? "pass2825_community_source_upgrade_blocked" : pass2826CustomerSafeNarrativeGate.releaseGate.status === "block" ? "pass2826_customer_safe_narrative_blocked" : null,
    pass2814LinkSafety,
    pass2815CommunityModerationVault,
    pass2816CommunityModerationObservability,
    pass2825CommunitySourceUpgradeGate,
    pass2826CustomerSafeNarrativeGate,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") ?? "en";
  const scope = searchParams.get("scope") === "mine" ? "mine" : "public";
  try {
    if (scope === "mine") {
      const sessionGate = await requireVelmereSession(request);
      if (!sessionGate.session) return sessionGate.response;
      const result = await getOwnSquarePosts(request, sessionGate.session.id, locale);
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store", "Vary": "Cookie, Authorization" } });
    }
    const result = await getSquarePosts(locale);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CustomerOwnedWriteBoundaryError) {
      return NextResponse.json(customerOwnedWriteErrorPayload(error), { status: error.httpStatus });
    }
    return NextResponse.json({ error: "SQUARE_READ_UNAVAILABLE", retryable: true }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(request, 96 * 1024);
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(request, { allowMissingOrigin: true });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(request, {
    keyPrefix: "pass2177-square-posts",
    limit: 20,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  try {
    const sessionGate = await requireVelmereSession(request);
    if (!sessionGate.session) return sessionGate.response;
    const session = sessionGate.session;

    const parsedBody = await readBoundedJsonBody<unknown>(request, 96 * 1024, { maxDepth: 12 });
    if (!parsedBody.ok) return parsedBody.response;
    const rawBody = parsedBody.value;
    const pass4394Idempotency = await registerPass4394ClientRequestMutation({
      request,
      action: "square_post_create",
      targetType: "square_post",
      actorId: session.id,
      body: rawBody,
    });
    if (!pass4394Idempotency.ok) {
      return pass4396IdempotencyReplayResponse({
        surface: "square_post",
        pass4394Idempotency,
      });
    }

    const payload = postSchema.parse(rawBody);
    const squareSafety = buildPass2806SquareSafety(payload);
    if (!squareSafety.ok) {
      return NextResponse.json(
        { error: "SQUARE_POST_REQUIRES_REVIEW", reason: squareSafety.blockedReason, claimBoundary: squareSafety.claimBoundary, pass2814LinkSafety: squareSafety.pass2814LinkSafety, pass2815CommunityModerationVault: squareSafety.pass2815CommunityModerationVault, pass2816CommunityModerationObservability: squareSafety.pass2816CommunityModerationObservability, pass2825CommunitySourceUpgradeGate: squareSafety.pass2825CommunitySourceUpgradeGate, pass2826CustomerSafeNarrativeGate: squareSafety.pass2826CustomerSafeNarrativeGate },
        { status: 400 },
      );
    }
    const result = await createSquarePost(request, session.id, {
      locale: payload.locale,
      title: squareSafety.title,
      body: squareSafety.body,
      authorName: session.displayName,
      authorHandle: session.handle,
      imageUrl: payload.imageUrl,
      tags: squareSafety.tags,
    });

    const mutationReceipt = await appendPass2178MutationReceipt({
      request,
      action: "square_post_create",
      targetType: "square_post",
      targetId: result.post?.id ?? "square_post:unknown",
      actorId: session.id,
      actorMode: "member",
      payload: { locale: payload.locale, tagCount: squareSafety.tags.length, hasImage: Boolean(payload.imageUrl), bodyLength: squareSafety.body.length, moderationState: squareSafety.moderationState, pass2814LinkState: squareSafety.pass2814LinkSafety.moderationState, pass2815ModerationHash: squareSafety.pass2815CommunityModerationVault.moderationHash, pass2816RuntimeState: squareSafety.pass2816CommunityModerationObservability.runtimeState, pass2825Decision: squareSafety.pass2825CommunitySourceUpgradeGate.decision, pass2825SourceUpgradeStatus: squareSafety.pass2825CommunitySourceUpgradeGate.sourceUpgrade.status, pass2826NarrativeDecision: squareSafety.pass2826CustomerSafeNarrativeGate.decision, pass4394State: pass4394Idempotency.state, pass4394ClientRequestIdHash: pass4394Idempotency.clientRequestIdHash, pass4394IdempotencyKeyHash: pass4394Idempotency.idempotencyKeyHash },
      safeSummary: "Square post creation wrote a redacted PASS2178 mutation receipt without storing post body.",
    });

    return completePass4394ClientRequestJsonResponse({
      receipt: pass4394Idempotency,
      status: 201,
      body: { ...result, mutationReceipt, pass4394Idempotency, moderationState: squareSafety.moderationState, claimBoundary: squareSafety.claimBoundary, pass2814LinkSafety: squareSafety.pass2814LinkSafety, pass2815CommunityModerationVault: squareSafety.pass2815CommunityModerationVault, pass2816CommunityModerationObservability: squareSafety.pass2816CommunityModerationObservability, pass2825CommunitySourceUpgradeGate: squareSafety.pass2825CommunitySourceUpgradeGate, pass2826CustomerSafeNarrativeGate: squareSafety.pass2826CustomerSafeNarrativeGate },
    });
  } catch (error: unknown) {
    if (error instanceof CustomerOwnedWriteBoundaryError) {
      return NextResponse.json(customerOwnedWriteErrorPayload(error), { status: error.httpStatus });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_FAILED", issues: (error as { flatten: () => unknown }).flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "SQUARE_POST_WRITE_UNAVAILABLE", retryable: true }, { status: 503 });
  }
}
