import { NextResponse } from "next/server";
import { verifyAdminImportRequest } from "@/lib/admin/auth";
import {
  buildProductPublishStateStorageReadiness,
  listProductPublishStateMemoryRecords,
  listProductPublishStateMemoryTimeline,
  listProductPublishStateStorageAttempts,
} from "@/lib/products/product-publish-state-storage";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = verifyAdminImportRequest(req);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    schemaVersion: "velmere.product.publish-state-admin-snapshot.v1",
    generatedAt: new Date().toISOString(),
    readiness: buildProductPublishStateStorageReadiness(),
    recentAttempts: listProductPublishStateStorageAttempts(30),
    memoryFallbackState: listProductPublishStateMemoryRecords(50),
    memoryFallbackTimeline: listProductPublishStateMemoryTimeline(12),
    productionBoundary:
      "This endpoint shows product publication-state storage readiness and in-process fallback rows. Durable public catalog read-through is a later commerce database gate.",
  });
}
