import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { NextResponse } from "next/server";
import { applyApiRateLimit as applyPass2177SoftRateLimit, assertSameOriginRequest as assertPass2177SameOriginRequest, rejectLargeContentLength as rejectPass2177LargeContentLength } from "@/lib/security/api-guard";
import { verifyAdminImportRequest } from "@/lib/admin/auth";
import type { ProductImportDraft } from "@/lib/products/types";
import { reviewVlmProductBrainDraftsAfterOperatorEdits } from "@/lib/products/vlm-product-brain";
import { appendPass2178MutationReceipt } from "@/lib/security/mutation-receipt-vault";

export const runtime = "nodejs";


export async function POST(req: Request) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(req, 8 * 1024 * 1024);
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(req, { allowMissingOrigin: true });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(req, {
    keyPrefix: "pass2177-admin-products-brain-review",
    limit: 24,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  const auth = verifyAdminImportRequest(req);
  if (!auth.ok) return auth.response;

  const parsedBody = await readBoundedJsonBody<{ drafts?: ProductImportDraft[] }>(req, 8 * 1024 * 1024, { maxDepth: 20 });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;
  if (!body.drafts?.length) {
    return NextResponse.json({ error: "No drafts were provided for Product Brain review." }, { status: 400 });
  }

  const drafts = reviewVlmProductBrainDraftsAfterOperatorEdits(body.drafts);
  const summary = {
    reviewed: drafts.length,
    ready: drafts.filter((draft) => draft.brain?.readiness.level === "ready").length,
    review: drafts.filter((draft) => draft.brain?.readiness.level === "review").length,
    blocked: drafts.filter((draft) => draft.brain?.readiness.level === "blocked").length,
  };

  const mutationReceipt = await appendPass2178MutationReceipt({
    request: req,
    action: "product_brain_review",
    targetType: "product_drafts",
    targetId: `reviewed:${summary.reviewed}`,
    actorId: "admin:product-brain",
    actorMode: "admin",
    payload: summary,
    safeSummary: "Operator Product Brain review wrote a redacted PASS2178 mutation receipt with readiness counts only.",
  });

  return NextResponse.json({ drafts, summary, brain: "vlm-product-brain-v2-operator-review", mutationReceipt });
}
