import { NextResponse } from "next/server";
import { mapWithConcurrencyLimit } from "@/lib/runtime/bounded-concurrency";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { applyApiRateLimit as applyPass2177SoftRateLimit, assertSameOriginRequest as assertPass2177SameOriginRequest, rejectLargeContentLength as rejectPass2177LargeContentLength } from "@/lib/security/api-guard";
import { verifyAdminImportRequest } from "@/lib/admin/auth";
import { importProductsFromProductCsv } from "@/lib/importers/csv-importer";
import { importProductFromUrl } from "@/lib/importers/url-importer";
import { applyVlmProductBrainToDrafts } from "@/lib/products/vlm-product-brain";
import { appendPass2178MutationReceipt } from "@/lib/security/mutation-receipt-vault";

export async function POST(req: Request) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(req, 1_000_000);
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(req, { allowMissingOrigin: true });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(req, {
    keyPrefix: "pass2177-admin-import-products",
    limit: 10,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  const auth = verifyAdminImportRequest(req);
  if (!auth.ok) return auth.response;

  const parsedBody = await readBoundedJsonBody<{ method?: "links" | "csv"; urls?: string; csv?: string }>(req, 1_000_000, { maxDepth: 8 });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;

  if (body.method === "csv") {
    const drafts = applyVlmProductBrainToDrafts(importProductsFromProductCsv(body.csv ?? ""));
    const mutationReceipt = await appendPass2178MutationReceipt({
      request: req,
      action: "product_import_csv",
      targetType: "product_drafts",
      targetId: `csv:${drafts.length}`,
      actorId: "admin:import",
      actorMode: "admin",
      payload: { method: body.method, draftCount: drafts.length },
      safeSummary: "Admin CSV import produced product drafts and wrote a redacted PASS2178 mutation receipt.",
    });
    return NextResponse.json({ drafts, persisted: false, brain: "vlm-product-brain-v2", mutationReceipt });
  }

  const urls = (body.urls ?? "")
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, 25);

  const drafts = applyVlmProductBrainToDrafts(await mapWithConcurrencyLimit(urls, 4, (url) => importProductFromUrl(url)));
  const mutationReceipt = await appendPass2178MutationReceipt({
    request: req,
    action: "product_import_links",
    targetType: "product_drafts",
    targetId: `links:${drafts.length}`,
    actorId: "admin:import",
    actorMode: "admin",
    payload: { method: body.method ?? "links", urlCount: urls.length, draftCount: drafts.length },
    safeSummary: "Admin URL import produced product drafts and wrote a redacted PASS2178 mutation receipt.",
  });
  return NextResponse.json({ drafts, persisted: false, brain: "vlm-product-brain-v2", mutationReceipt });
}
