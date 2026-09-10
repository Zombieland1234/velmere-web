import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import {
  verifyVlmAnalysisReceipt,
  type VlmAnalysisReceipt,
} from "@/lib/ai/vlm-analysis-receipt";
import type { VlmBrainOutput } from "@/lib/ai/vlm-contract";
import type { VlmCanonicalFactPacket } from "@/lib/ai/vlm-fact-packet";
import { consumeVlmReceiptOnce } from "@/lib/ai/vlm-receipt-replay";
import { recordVlmPolicyRejection } from "@/lib/ai/vlm-security-events";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
  securityJson,
} from "@/lib/security/api-guard";

type VerificationBody = {
  receipt?: VlmAnalysisReceipt;
  facts?: VlmCanonicalFactPacket;
  output?: VlmBrainOutput;
  consume?: boolean;
};

export async function POST(request: Request) {
  const sizeGuard = rejectLargeContentLength(request, 96 * 1024);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: true });
  if (originGuard) return originGuard;
  const rateLimit = await applyApiRateLimit(request, {
    keyPrefix: "vlm-receipt-verify",
    limit: 40,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const parsedBody = await readBoundedJsonBody<VerificationBody>(request, 96 * 1024, { maxDepth: 16 });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;
  if (!body.receipt || !body.facts || !body.output) {
    return securityJson({ ok: false, error: "verification_payload_required" }, { status: 400 });
  }

  try {
    const verification = verifyVlmAnalysisReceipt({
      receipt: body.receipt,
      facts: body.facts,
      output: body.output,
    });
    if (!verification.valid) {
      recordVlmPolicyRejection({
        vector: "receipt",
        reason: verification.reasons.join(",") || "receipt_invalid",
        score: verification.signatureValid === false ? 96 : 84,
        route: "/api/market-integrity/vlm/verify",
      });
    }
    if (verification.valid && body.consume === true) {
      const consumption = consumeVlmReceiptOnce(body.receipt.receiptId, body.receipt.expiresAt);
      if (!consumption.ok) {
        recordVlmPolicyRejection({
          vector: "receipt",
          reason: consumption.reason,
          score: 96,
          route: "/api/market-integrity/vlm/verify",
        });
        return securityJson({
          ok: false,
          verification: {
            ...verification,
            valid: false,
            reasons: [...verification.reasons, consumption.reason],
          },
        }, { status: 409 });
      }
    }
    return securityJson({
      ok: verification.valid,
      verification,
      consumed: verification.valid && body.consume === true,
    }, { status: verification.valid ? 200 : 422 });
  } catch {
    recordVlmPolicyRejection({
      vector: "receipt",
      reason: "receipt_malformed",
      score: 90,
      route: "/api/market-integrity/vlm/verify",
    });
    return securityJson({ ok: false, error: "receipt_malformed" }, { status: 400 });
  }
}
