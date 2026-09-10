import { abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { securityJson } from "@/lib/security/api-guard";
import { verifySecurityAdminToken } from "@/lib/security/security-admin-auth";
import { buildPass2365AdminReplayBoard, PASS2365_ADMIN_REPLAY_BOARD_ID } from "@/lib/security/admin-replay-board";
import { buildPass2366PaymentEvidenceSnapshot, parsePaymentEvidenceFilterFromUrl } from "@/lib/security/durable-payment-evidence-store";

const PASS2365_AUDIT_BOUNDARY =
  "admin-replay-board: admin-only payment replay readiness endpoint; exposes redacted scenario state and safe blockers only, no Stripe secrets or raw webhook payloads" as const;

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "security", {
    keyPrefix: "admin-replay-board",
    queryParam: "q",
    allowEmptyQuery: true,
  });
  if (!shield.ok) return shield.response;

  const admin = verifySecurityAdminToken(request, ["security:events"]);
  if (!admin.ok) return admin.response;

  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") || "en";
  const board = buildPass2365AdminReplayBoard(locale);
  const evidenceFilter = parsePaymentEvidenceFilterFromUrl(url);
  const durableEvidence = await buildPass2366PaymentEvidenceSnapshot(evidenceFilter);

  return securityJson({
    ok: board.status !== "blocked",
    passId: PASS2365_ADMIN_REPLAY_BOARD_ID,
    auditBoundary: PASS2365_AUDIT_BOUNDARY,
    board,
    durableEvidence,
    evidenceFilter,
    securityAdminGate: admin.snapshot,
    operator: admin.operator,
    ...abuseShieldResponseMeta(shield),
  }, { status: board.status === "blocked" ? 424 : 200 });
}
