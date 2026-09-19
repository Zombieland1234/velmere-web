import { NextRequest, NextResponse } from "next/server";
import { verifyLocalPublishedAudit } from "@/lib/security/evidence-vault/public-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await verifyLocalPublishedAudit(id);
  return NextResponse.json(result, {
    status: result.ok ? 200 : result.httpStatus,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
