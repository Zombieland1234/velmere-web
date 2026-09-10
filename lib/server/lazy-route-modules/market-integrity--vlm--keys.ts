import { listVlmReceiptPublicKeys } from "@/lib/ai/vlm-analysis-receipt";
import { applyApiRateLimit, rejectOversizedUrl, securityJson } from "@/lib/security/api-guard";

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 1024);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, {
    keyPrefix: "vlm-receipt-keys",
    limit: 60,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const keys = listVlmReceiptPublicKeys();
  return securityJson({
    schemaVersion: "velmere.vlm.receipt.keys.v1",
    algorithm: "Ed25519",
    keys,
    configured: keys.length > 0,
  });
}
