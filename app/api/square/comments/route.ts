import { NextResponse } from "next/server";
import { applyApiRateLimit as applyPass2177SoftRateLimit, assertSameOriginRequest as assertPass2177SameOriginRequest, rejectLargeContentLength as rejectPass2177LargeContentLength } from "@/lib/security/api-guard";
import { z } from "zod";
import { createSquareComment } from "@/lib/db/square-service";
import { requireVelmereSession } from "@/lib/api/request-guards";
import { appendPass2178MutationReceipt } from "@/lib/security/mutation-receipt-vault";
import { completePass4394ClientRequestJsonResponse, registerPass4394ClientRequestMutation } from "@/lib/security/client-request-idempotency";
import { pass4396IdempotencyReplayResponse } from "@/lib/security/idempotency-replay-response";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { CustomerOwnedWriteBoundaryError, customerOwnedWriteErrorPayload } from "@/lib/db/customer-owned-write-boundary";

export const dynamic = "force-dynamic";

const commentSchema = z.object({
  postId: z.string().trim().min(1).max(96),
  body: z.string().trim().min(1).max(600),
});

export async function POST(request: Request) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(request, 64 * 1024);
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(request, { allowMissingOrigin: true });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(request, {
    keyPrefix: "pass2177-square-comments",
    limit: 30,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  try {
    const sessionGate = await requireVelmereSession(request);
    if (!sessionGate.session) return sessionGate.response;
    const session = sessionGate.session;

    const parsedBody = await readBoundedJsonBody<unknown>(request, 64 * 1024, { maxDepth: 10 });
    if (!parsedBody.ok) return parsedBody.response;
    const rawBody = parsedBody.value;
    const pass4394Idempotency = await registerPass4394ClientRequestMutation({
      request,
      action: "square_comment_create",
      targetType: "square_comment",
      actorId: session.id,
      body: rawBody,
    });
    if (!pass4394Idempotency.ok) {
      return pass4396IdempotencyReplayResponse({
        surface: "square_comment",
        pass4394Idempotency,
      });
    }

    const payload = commentSchema.parse(rawBody);
    const result = await createSquareComment(request, session.id, {
      postId: payload.postId,
      body: payload.body,
      authorName: session.displayName,
    });

    const mutationReceipt = await appendPass2178MutationReceipt({
      request,
      action: "square_comment_create",
      targetType: "square_comment",
      targetId: result.comment?.id ?? "square_comment:unknown",
      actorId: session.id,
      actorMode: "member",
      payload: { postId: payload.postId, bodyLength: payload.body.length, pass4394State: pass4394Idempotency.state, pass4394ClientRequestIdHash: pass4394Idempotency.clientRequestIdHash, pass4394IdempotencyKeyHash: pass4394Idempotency.idempotencyKeyHash },
      safeSummary: "Square comment creation wrote a redacted PASS2178 mutation receipt without storing comment body.",
    });

    return completePass4394ClientRequestJsonResponse({
      receipt: pass4394Idempotency,
      status: 201,
      body: { ...result, mutationReceipt, pass4394Idempotency },
    });
  } catch (error: unknown) {
    if (error instanceof CustomerOwnedWriteBoundaryError) {
      return NextResponse.json(customerOwnedWriteErrorPayload(error), { status: error.httpStatus });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_FAILED", issues: (error as { flatten: () => unknown }).flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "SQUARE_COMMENT_WRITE_UNAVAILABLE", retryable: true }, { status: 503 });
  }
}
