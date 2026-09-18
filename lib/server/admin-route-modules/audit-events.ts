import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { createAdminAuditWritePreview } from "@/lib/launch/admin-audit-write-contract";
import { applyApiRateLimit as applyPass2177SoftRateLimit, assertSameOriginRequest as assertPass2177SameOriginRequest, rejectLargeContentLength as rejectPass2177LargeContentLength } from "@/lib/security/api-guard";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET() {
  return jsonResponse(
    {
      ok: false,
      status: "locked_preview",
      route: "/api/admin/audit-events",
      reason: "Admin audit diagnostics are not exposed without an authenticated operator context.",
    },
    423,
  );
}

export async function POST(request: Request) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(request, 256 * 1024);
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(request, { allowMissingOrigin: true });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(request, {
    keyPrefix: "pass2177-admin-audit-events",
    limit: 24,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  const parsedBody = await readBoundedJsonBody<Record<string, unknown>>(request, 256 * 1024, { maxDepth: 16 });
  if (!parsedBody.ok) return parsedBody.response;

  const preview = createAdminAuditWritePreview(parsedBody.value);
  const {
    sessionPreview: _sessionPreview,
    permissionPreview: _permissionPreview,
    idempotencyPreview: _idempotencyPreview,
    ...publicPreview
  } = preview;
  return jsonResponse(
    {
      ...publicPreview,
      route: "/api/admin/audit-events",
      mode: "locked-contract-preview",
      storageWritePerformed: false,
    },
    preview.httpStatus,
  );
}
