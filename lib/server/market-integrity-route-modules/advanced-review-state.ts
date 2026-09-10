import { NextResponse } from "next/server";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import { buildReportAccessDecision } from "@/lib/market-integrity/top1-entitlement-report-access";
import {
  PASS2823_ADVANCED_HUMAN_REVIEW_ACCEPTANCE_GATES,
  buildPass2823AdvancedHumanReviewGate,
} from "@/lib/market-integrity/top1-advanced-human-review-signoff-gate";

function tierFromRequest(value: string | null): VelmereTier {
  const normalized = (value ?? "Advanced").toLowerCase();
  if (normalized === "basic") return "Basic";
  if (normalized === "pro") return "Pro";
  return "Advanced";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tier = tierFromRequest(url.searchParams.get("tier"));
  const account = await resolveRequestAccount(request);
  if (tier !== "Basic" && !account) {
    return NextResponse.json({ ok: false, error: "account_session_required", diagnosticOnly: true }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const accessContext = {
    tier: tier,
    accountId: account?.accountId ?? null,
    serverReceiptId: null,
    reportToken: null,
    payloadHash: null,
    manualReviewReceiptId: null,
    verification: {
      accountBound: Boolean(account),
      serverReceiptVerified: false,
      reportTokenVerified: false,
      payloadHashBound: false,
      manualReviewVerified: false,
      source: "diagnostic_only" as const,
    },
  };
  const accessDecision = buildReportAccessDecision(accessContext);
  const sourceReceiptRoot = url.searchParams.get("sourceReceiptRoot") ?? request.headers.get("x-velmere-source-receipt-root") ?? null;
  const gate = buildPass2823AdvancedHumanReviewGate({
    surface: "Advanced Review State",
    tier,
    paidEvidenceAllowed: accessDecision.paidEvidenceAllowed,
    manualReviewReceiptId: accessContext.manualReviewReceiptId,
    operatorId: url.searchParams.get("operatorId") ?? request.headers.get("x-velmere-operator-id"),
    operatorSignature: url.searchParams.get("operatorSignature") ?? request.headers.get("x-velmere-operator-signature"),
    payloadHash: accessContext.payloadHash,
    sourceReceiptRoot,
    reviewPayloadHash: url.searchParams.get("reviewPayloadHash") ?? request.headers.get("x-velmere-review-payload-hash"),
    reviewerNote: url.searchParams.get("reviewerNote"),
    generatedAt: url.searchParams.get("generatedAt"),
    reviewedAt: url.searchParams.get("reviewedAt"),
    reviewRejected: url.searchParams.get("reviewRejected") === "1",
    runtimeState: url.searchParams.get("runtimeState") ?? "degraded",
    tokenState: url.searchParams.get("tokenState"),
    expiresInMinutes: Number(url.searchParams.get("reviewExpiresInMinutes") ?? 1440),
  });

  return NextResponse.json(
    {
      ok: true,
      pass: 2823,
      accessDecision,
      advancedHumanReviewGate: gate,
      acceptanceGates: PASS2823_ADVANCED_HUMAN_REVIEW_ACCEPTANCE_GATES,
      customerSafeCopy: "Advanced Review State is diagnostic only: the automated Advanced SKU is not for sale, and legacy manual-QA addenda remain unavailable unless a separate approved product and receipt exist. This route creates no payment or release proof.",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
