import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function secureTokenEqual(expected: string, provided: string) {
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  const providedHash = createHash("sha256").update(provided, "utf8").digest();
  return timingSafeEqual(expectedHash, providedHash);
}

export function verifyAdminImportRequest(req: Request) {
  // A shared bearer token has no individual identity, RBAC, MFA, revocation,
  // or freshness proof. Until the server-side operator session contract is
  // wired to these routes, production admin mutations stay unavailable.
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Production admin session with RBAC and recent authentication is required." },
        { status: 503, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } },
      ),
    };
  }
  const token = process.env.ADMIN_IMPORT_TOKEN;
  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Development admin access is not configured." },
        { status: 503, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } },
      ),
    };
  }

  const authorization = req.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  const headerToken = req.headers.get("x-admin-import-token") ?? "";
  const provided = bearer || headerToken;

  if (!provided || !secureTokenEqual(token, provided)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Invalid development admin access." }, { status: 401, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } }),
    };
  }

  return { ok: true as const };
}
