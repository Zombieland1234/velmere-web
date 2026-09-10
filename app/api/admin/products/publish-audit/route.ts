import { NextResponse } from "next/server";
import { verifyAdminImportRequest } from "@/lib/admin/auth";
import {
  buildProductPublishAuditStorageReadiness,
  listProductPublishAuditMemoryLedger,
  listProductPublishAuditStorageAttempts,
} from "@/lib/products/product-publish-audit-storage";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = verifyAdminImportRequest(req);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    schemaVersion: "velmere.product.publish-audit-admin-snapshot.v1",
    generatedAt: new Date().toISOString(),
    readiness: buildProductPublishAuditStorageReadiness(),
    recentAttempts: listProductPublishAuditStorageAttempts(30),
    memoryFallbackLedger: listProductPublishAuditMemoryLedger(12),
    productionBoundary:
      "This endpoint shows storage readiness and recent in-process fallback rows only. Durable Upstash read/export UI is the next pass.",
  });
}
