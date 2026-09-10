import { NextResponse } from "next/server";
import { applyApiRateLimit, assertSameOriginRequest, rejectLargeContentLength } from "@/lib/security/api-guard";
import { buildProductCheckoutGuard, redactProductCheckoutGuardResult, type ProductCheckoutGuardRequestItem } from "@/lib/products/checkout-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";

export const runtime = "nodejs";

type CheckoutGuardRequestBody = {
  item?: ProductCheckoutGuardRequestItem;
  items?: ProductCheckoutGuardRequestItem[];
  locale?: string;
  mode?: "add_to_cart" | "checkout";
};

export async function POST(req: Request) {
  const sizeGuard = rejectLargeContentLength(req, 24 * 1024);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(req, { allowMissingOrigin: true });
  if (originGuard) return originGuard;
  const rateLimit = await applyApiRateLimit(req, { keyPrefix: "products-checkout-guard", limit: 48, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const parsedBody = await readBoundedJsonBody<CheckoutGuardRequestBody>(req, 24 * 1024, { maxDepth: 10 });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;
  const items = Array.isArray(body.items) ? body.items : body.item ? [body.item] : [];
  const result = await buildProductCheckoutGuard({
    items,
    locale: body.locale,
    mode: body.mode ?? "add_to_cart",
  });

  return NextResponse.json(redactProductCheckoutGuardResult(result), {
    status: result.ok ? 200 : 409,
    headers: {
      "x-velmere-checkout-guard": result.receipt.receiptId,
      "x-velmere-checkout-guard-ok": result.ok ? "1" : "0",
    },
  });
}
