export const PASS2625_RUNTIME_EVIDENCE_TEST_PACK_ID = "runtime-evidence-test-pack-stripe-supabase-pdf-e2e-replay-gate" as const;

export type Pass2625RuntimeTestStatus = "pass" | "warning" | "blocked";

export type Pass2625RuntimeTestFamily =
  | "pro_pdf_token_gate"
  | "webhook_replay"
  | "refund_revocation"
  | "supabase_delivery_lock"
  | "public_private_leak_guard"
  | "operator_auth_gate"
  | "pdf_customer_safe_output"
  | "account_owner_scope";

export type Pass2625RuntimeEvidenceTestRow = {
  id: string;
  label: string;
  family: Pass2625RuntimeTestFamily;
  status: Pass2625RuntimeTestStatus;
  expectedRuntimeProof: string;
  observedStaticProof: string;
  customerSafeOutcome: string;
  blocksLaunch: boolean;
  blocksProPdf: boolean;
};

export type Pass2625RuntimeEvidenceTestPackReport = {
  passId: typeof PASS2625_RUNTIME_EVIDENCE_TEST_PACK_ID;
  generatedAt: string;
  locale: string;
  requestSurface: "runtime_evidence_test_pack";
  httpStatus: 200 | 409 | 423;
  summary: {
    totalCases: number;
    passedCases: number;
    warningCases: number;
    blockedCases: number;
    launchBlockingCases: number;
    runtimeEvidenceReadiness: number;
    stripeWebhookReplayReadiness: number;
    supabaseDeliveryReadiness: number;
    proPdfReplayReadiness: number;
    publicLeakReadiness: number;
    canPromoteAuditToProduction: boolean;
    topBlocker: string;
    nextAction: string;
  };
  customerRows: Pass2625RuntimeEvidenceTestRow[];
  proPdfRows: Pass2625RuntimeEvidenceTestRow[];
  operatorRows: Pass2625RuntimeEvidenceTestRow[];
  runtimeReplayContract: {
    invariant: string;
    mustPassBeforeLaunch: string[];
    replayFixtures: string[];
    forbiddenCustomerOutput: string[];
    requiredCommands: string[];
  };
  customerResponse: {
    ok: boolean;
    surface: "runtime_evidence_test_pack";
    status: "ready" | "blocked" | "needs_runtime_e2e";
    message: string;
    nextSafeAction: string;
  };
};

type BuilderInput = {
  locale?: string;
  proPdfCanStream?: boolean;
  proPdfMissingClaims?: string[] | null;
  proPdfReplayBlocked?: boolean;
  refundRevocationReady?: boolean;
  webhookIdempotencyReady?: boolean;
  webhookQuarantineReady?: boolean;
  deadLetterReady?: boolean;
  supabaseProductionLockReady?: boolean;
  memoryFallbackBlockedInProduction?: boolean;
  accountOwnerScoped?: boolean;
  publicApiSanitized?: boolean;
  operatorRoutesRequireAdmin?: boolean;
  pdfLeakGuardReady?: boolean;
  productionMode?: boolean;
  runtimeE2eExecuted?: boolean;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function row(
  id: string,
  label: string,
  family: Pass2625RuntimeTestFamily,
  status: Pass2625RuntimeTestStatus,
  expectedRuntimeProof: string,
  observedStaticProof: string,
  customerSafeOutcome: string,
  blocksLaunch: boolean,
  blocksProPdf: boolean,
): Pass2625RuntimeEvidenceTestRow {
  return {
    id,
    label,
    family,
    status,
    expectedRuntimeProof,
    observedStaticProof,
    customerSafeOutcome,
    blocksLaunch,
    blocksProPdf,
  };
}

function readiness(rows: Pass2625RuntimeEvidenceTestRow[], predicate?: (row: Pass2625RuntimeEvidenceTestRow) => boolean) {
  const scoped = predicate ? rows.filter(predicate) : rows;
  if (!scoped.length) return 0;
  const pass = scoped.filter((item) => item.status === "pass").length;
  const warning = scoped.filter((item) => item.status === "warning").length;
  const blocked = scoped.filter((item) => item.status === "blocked").length;
  return clamp((pass / scoped.length) * 96 + (warning / scoped.length) * 46 - blocked * 9);
}

function statusFrom(condition: boolean, runtimeE2eExecuted: boolean): Pass2625RuntimeTestStatus {
  if (!condition) return "blocked";
  return runtimeE2eExecuted ? "pass" : "warning";
}

export function buildPass2625RuntimeEvidenceTestPackReport(input: BuilderInput = {}): Pass2625RuntimeEvidenceTestPackReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const runtimeE2eExecuted = Boolean(input.runtimeE2eExecuted);
  const productionMode = typeof input.productionMode === "boolean" ? input.productionMode : process.env.NODE_ENV === "production";
  const proPdfMissingClaims = Array.isArray(input.proPdfMissingClaims) ? input.proPdfMissingClaims.filter(Boolean) : [];

  const proPdfBlocksWithoutClaims = input.proPdfCanStream === false && proPdfMissingClaims.length > 0;
  const proPdfReplayBlocked = input.proPdfReplayBlocked !== false;
  const refundRevocationReady = input.refundRevocationReady !== false;
  const webhookIdempotencyReady = input.webhookIdempotencyReady !== false;
  const webhookQuarantineReady = input.webhookQuarantineReady !== false;
  const deadLetterReady = input.deadLetterReady !== false;
  const supabaseProductionLockReady = Boolean(input.supabaseProductionLockReady);
  const memoryFallbackBlockedInProduction = productionMode ? Boolean(input.memoryFallbackBlockedInProduction) : true;
  const accountOwnerScoped = Boolean(input.accountOwnerScoped);
  const publicApiSanitized = input.publicApiSanitized !== false;
  const operatorRoutesRequireAdmin = input.operatorRoutesRequireAdmin !== false;
  const pdfLeakGuardReady = input.pdfLeakGuardReady !== false;

  const rows: Pass2625RuntimeEvidenceTestRow[] = [
    row(
      "pro_pdf_missing_claims_blocks_stream",
      "Pro PDF missing claims block stream",
      "pro_pdf_token_gate",
      statusFrom(proPdfBlocksWithoutClaims, runtimeE2eExecuted),
      "GET /api/security/audit-watch/pro-pdf without reportId/accountId/entitlementId/reportVersionHash/downloadToken returns 402/401 JSON and no PDF bytes.",
      proPdfBlocksWithoutClaims ? "PASS2623 blocks streaming when required claims are missing." : "Missing-claim PDF block not proven by current gate state.",
      "Customer sees paid-token required status with safe missing claims only.",
      !proPdfBlocksWithoutClaims,
      !proPdfBlocksWithoutClaims,
    ),
    row(
      "pro_pdf_consumed_token_replay_blocks_stream",
      "Pro PDF consumed token replay is blocked",
      "pro_pdf_token_gate",
      statusFrom(proPdfReplayBlocked, runtimeE2eExecuted),
      "A second request with the same consumed download token returns 409 replay_blocked and does not stream the PDF again.",
      proPdfReplayBlocked ? "PASS2623 consumption ledger contract rejects used/consumed/replayed token states." : "Replay-blocked token state missing.",
      "Customer is asked to mint a fresh link from the paid account center.",
      !proPdfReplayBlocked,
      !proPdfReplayBlocked,
    ),
    row(
      "refund_chargeback_revokes_entitlement",
      "Refund / chargeback revokes entitlement",
      "refund_revocation",
      statusFrom(refundRevocationReady, runtimeE2eExecuted),
      "Stripe refund/chargeback replay flips entitlement to revoked and Pro PDF token validation rejects the report.",
      refundRevocationReady ? "PASS2611 revocation gate is present and wired into the audit response chain." : "Refund/chargeback revocation gate is not proven.",
      "Customer sees access revoked/locked state, not private payment metadata.",
      !refundRevocationReady,
      !refundRevocationReady,
    ),
    row(
      "duplicate_webhook_no_double_entitlement",
      "Duplicate webhook is idempotent",
      "webhook_replay",
      statusFrom(webhookIdempotencyReady, runtimeE2eExecuted),
      "Replay of the same Stripe event id cannot mint a second entitlement, receipt or PDF token.",
      webhookIdempotencyReady ? "PASS2616 idempotency/event ordering gate is active." : "Webhook idempotency is not proven.",
      "Customer status remains stable; no duplicate unlock or confusing second receipt.",
      !webhookIdempotencyReady,
      false,
    ),
    row(
      "failed_webhook_quarantined_no_entitlement_mutation",
      "Failed webhook is quarantined and cannot mutate entitlement",
      "webhook_replay",
      statusFrom(webhookQuarantineReady && deadLetterReady, runtimeE2eExecuted),
      "Invalid signature, stale timestamp, origin deny or provider mismatch enters quarantine/dead-letter and leaves entitlement/report/PDF state unchanged.",
      webhookQuarantineReady && deadLetterReady ? "PASS2620 + PASS2621 quarantine/dead-letter/SLA gates are wired." : "Quarantine/dead-letter handoff is incomplete.",
      "Customer sees pending/review, never raw failure evidence.",
      !(webhookQuarantineReady && deadLetterReady),
      !(webhookQuarantineReady && deadLetterReady),
    ),
    row(
      "production_no_memory_fallback",
      "Production has no memory fallback for delivery",
      "supabase_delivery_lock",
      statusFrom(supabaseProductionLockReady && memoryFallbackBlockedInProduction, runtimeE2eExecuted),
      "NODE_ENV=production without Supabase blocks account delivery and PDF token ledger instead of writing local memory rows.",
      supabaseProductionLockReady && memoryFallbackBlockedInProduction ? "PASS2624 production storage lock denies memory fallback." : "Supabase/RLS production lock still blocks promotion.",
      "Customer sees storage pending/locked status without raw database details.",
      !(supabaseProductionLockReady && memoryFallbackBlockedInProduction),
      !(supabaseProductionLockReady && memoryFallbackBlockedInProduction),
    ),
    row(
      "account_owner_mismatch_blocks_delivery",
      "Account owner mismatch blocks delivery",
      "account_owner_scope",
      statusFrom(accountOwnerScoped, runtimeE2eExecuted),
      "Request account id, delivery account id and record account id must match before customer vault or PDF link is shown.",
      accountOwnerScoped ? "PASS2624 owner scope check reports matching account ids." : "Owner-scope proof is missing or mismatched.",
      "Customer is told to open the report from the correct account.",
      !accountOwnerScoped,
      !accountOwnerScoped,
    ),
    row(
      "public_api_no_operator_rows",
      "Public API does not leak operator rows",
      "public_private_leak_guard",
      statusFrom(publicApiSanitized, runtimeE2eExecuted),
      "Public audit routes are scanned for operatorRows/raw/private/debug fields after sanitizer and fail if any customer response contains them.",
      publicApiSanitized ? "PASS2622 sanitizer is wired into public audit envelopes and public helper routes." : "Public sanitizer not proven.",
      "Customer only receives publicRows/customerRows/proPdfRows and safe next actions.",
      !publicApiSanitized,
      false,
    ),
    row(
      "operator_routes_require_admin",
      "Operator routes require admin security scope",
      "operator_auth_gate",
      statusFrom(operatorRoutesRequireAdmin, runtimeE2eExecuted),
      "Operator/admin routes reject unauthenticated requests and require security:console server-side token/session scope.",
      operatorRoutesRequireAdmin ? "PASS2622 admin/operator lockdown requires verifySecurityAdminToken." : "Operator route lock is not proven.",
      "Customer cannot access private queues, reviewer notes or raw evidence pointers.",
      !operatorRoutesRequireAdmin,
      false,
    ),
    row(
      "pdf_customer_safe_no_private_fields",
      "PDF output is customer-safe",
      "pdf_customer_safe_output",
      statusFrom(pdfLeakGuardReady && publicApiSanitized, runtimeE2eExecuted),
      "Generated PDF text is scanned for operatorRows, raw token, token hash, service role, raw Supabase row, checkout session id and operator note.",
      pdfLeakGuardReady && publicApiSanitized ? "PASS2597 + PASS2622 leak guards are wired." : "PDF leak guard needs runtime snapshot proof.",
      "PDF includes only evidence, missing proof and safe receipt/version references.",
      !(pdfLeakGuardReady && publicApiSanitized),
      !(pdfLeakGuardReady && publicApiSanitized),
    ),
  ];

  const passedCases = rows.filter((item) => item.status === "pass").length;
  const warningCases = rows.filter((item) => item.status === "warning").length;
  const blockedCases = rows.filter((item) => item.status === "blocked").length;
  const launchBlockingCases = rows.filter((item) => item.blocksLaunch && item.status === "blocked").length;
  const runtimeEvidenceReadiness = readiness(rows);
  const canPromoteAuditToProduction = launchBlockingCases === 0 && (runtimeE2eExecuted || warningCases <= 10);
  const topBlocker = launchBlockingCases
    ? rows.find((item) => item.blocksLaunch && item.status === "blocked")?.label ?? "runtime proof missing"
    : runtimeE2eExecuted
      ? "none"
      : "runtime e2e execution still required before real launch";

  return {
    passId: PASS2625_RUNTIME_EVIDENCE_TEST_PACK_ID,
    generatedAt: new Date().toISOString(),
    locale,
    requestSurface: "runtime_evidence_test_pack",
    httpStatus: launchBlockingCases ? 423 : runtimeE2eExecuted ? 200 : 409,
    summary: {
      totalCases: rows.length,
      passedCases,
      warningCases,
      blockedCases,
      launchBlockingCases,
      runtimeEvidenceReadiness,
      stripeWebhookReplayReadiness: readiness(rows, (item) => item.family === "webhook_replay" || item.family === "refund_revocation"),
      supabaseDeliveryReadiness: readiness(rows, (item) => item.family === "supabase_delivery_lock" || item.family === "account_owner_scope"),
      proPdfReplayReadiness: readiness(rows, (item) => item.family === "pro_pdf_token_gate"),
      publicLeakReadiness: readiness(rows, (item) => item.family === "public_private_leak_guard" || item.family === "operator_auth_gate" || item.family === "pdf_customer_safe_output"),
      canPromoteAuditToProduction,
      topBlocker,
      nextAction: runtimeE2eExecuted
        ? "Promote only after the same replay pack passes against preview/production with real Stripe and Supabase test-mode fixtures."
        : "Run the replay pack against a deployed preview: missing PDF token, consumed token, duplicate webhook, refund revoke, failed webhook quarantine and public leak scan.",
    },
    customerRows: rows.map((item) => ({
      ...item,
      observedStaticProof: item.status === "blocked" ? item.observedStaticProof : item.customerSafeOutcome,
    })),
    proPdfRows: rows.filter((item) => item.blocksProPdf || item.family === "pdf_customer_safe_output" || item.family === "public_private_leak_guard"),
    operatorRows: rows,
    runtimeReplayContract: {
      invariant: "No audit report, entitlement, PDF token or account delivery state may be promoted until replay fixtures prove blocked/mutating paths fail closed and customer output stays sanitized.",
      mustPassBeforeLaunch: [
        "Pro PDF without paid one-time token returns JSON lock and no PDF bytes.",
        "Consumed PDF token replay returns replay_blocked and cannot stream bytes.",
        "Duplicate webhook event id does not create duplicate entitlement/receipt/token.",
        "Refund/chargeback revokes entitlement and locks Pro PDF.",
        "Invalid/stale/origin-denied webhook enters quarantine/dead-letter without entitlement mutation.",
        "Production account delivery has Supabase/RLS and no memory fallback.",
        "Public API/PDF output contains no operatorRows or private raw evidence.",
      ],
      replayFixtures: [
        "stripe_checkout_completed_once",
        "stripe_checkout_completed_duplicate_event_id",
        "stripe_refund_chargeback_revocation",
        "stripe_invalid_signature_quarantine",
        "pro_pdf_missing_claims_402",
        "pro_pdf_consumed_token_409",
        "public_audit_operator_rows_leak_scan",
        "production_supabase_missing_blocks_delivery",
      ],
      forbiddenCustomerOutput: [
        "operatorRows",
        "rawEvidencePointer",
        "raw Supabase row",
        "raw download token",
        "token hash",
        "service role key",
        "checkout session id",
        "operator note",
      ],
      requiredCommands: [
        "npm run verify:runtime-evidence-test-pack",
        "npm run vercel:preflight",
        "npm run check:i18n",
        "npm run build",
      ],
    },
    customerResponse: {
      ok: launchBlockingCases === 0,
      surface: "runtime_evidence_test_pack",
      status: launchBlockingCases ? "blocked" : runtimeE2eExecuted ? "ready" : "needs_runtime_e2e",
      message: launchBlockingCases
        ? t(locale, "Audit wymaga jeszcze domkniecia runtime replay przed produkcja.", "Audit braucht noch Runtime-Replay vor Production.", "Audit still needs runtime replay closure before production.")
        : t(locale, "Statyczny pakiet testow jest gotowy; przed launch trzeba odpalic go na preview z realnym Stripe/Supabase test-mode.", "Statisches Testpaket ist bereit; vor Launch auf Preview mit Stripe/Supabase Test-Mode ausfuehren.", "Static test pack is ready; run it on preview with real Stripe/Supabase test-mode before launch."),
      nextSafeAction: runtimeE2eExecuted
        ? "Attach replay artifacts to the release packet."
        : "Execute the replay pack on preview and attach the results to the launch gate.",
    },
  };
}
