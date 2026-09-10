import { NextResponse } from "next/server";
import { applyApiRateLimit as applyPass2177SoftRateLimit, assertSameOriginRequest as assertPass2177SameOriginRequest, rejectLargeContentLength as rejectPass2177LargeContentLength } from "@/lib/security/api-guard";
import { verifyAdminImportRequest } from "@/lib/admin/auth";
import { syncPrintfulProducts } from "@/lib/importers/printful-importer";
import { applyVlmProductBrainToDrafts } from "@/lib/products/vlm-product-brain";
import { appendPass2178MutationReceipt } from "@/lib/security/mutation-receipt-vault";
import { rejectUnexpectedRequestBody } from "@/lib/security/payment-webhook-guard";

export async function POST(req: Request) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(req, 256 * 1024);
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(req, { allowMissingOrigin: true });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(req, {
    keyPrefix: "pass2177-admin-sync-printful",
    limit: 8,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  const bodyGuard = await rejectUnexpectedRequestBody(req);
  if (bodyGuard) return bodyGuard;

  const auth = verifyAdminImportRequest(req);
  if (!auth.ok) return auth.response;

  const drafts = applyVlmProductBrainToDrafts(await syncPrintfulProducts());
  const mutationReceipt = await appendPass2178MutationReceipt({
    request: req,
    action: "provider_sync_printful",
    targetType: "product_drafts",
    targetId: `printful:${drafts.length}`,
    actorId: "admin:provider-sync",
    actorMode: "admin",
    payload: { provider: "printful", draftCount: drafts.length },
    safeSummary: "Printful sync produced product drafts and wrote a redacted PASS2178 mutation receipt.",
  });
  return NextResponse.json({ drafts, persisted: false, brain: "vlm-product-brain-v2", mutationReceipt });
}
