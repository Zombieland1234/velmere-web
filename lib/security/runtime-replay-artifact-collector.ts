import type { Pass2625RuntimeEvidenceTestPackReport, Pass2625RuntimeEvidenceTestRow } from "@/lib/security/runtime-evidence-test-pack";

export const PASS2626_RUNTIME_REPLAY_ARTIFACT_COLLECTOR_ID = "runtime-replay-artifact-collector-launch-evidence-receipt-board" as const;

export type Pass2626ArtifactStatus = "attached" | "pending" | "blocked" | "operator_review";

export type Pass2626ArtifactFamily =
  | "pro_pdf_replay"
  | "stripe_webhook_replay"
  | "supabase_delivery_replay"
  | "public_leak_scan"
  | "operator_auth_scan"
  | "pdf_customer_safe_scan"
  | "release_build_gate"
  | "launch_receipt_board";

export type Pass2626RuntimeReplayArtifactRow = {
  id: string;
  label: string;
  family: Pass2626ArtifactFamily;
  status: Pass2626ArtifactStatus;
  sourceTestId: string;
  requiredArtifact: string;
  customerSafeEvidence: string;
  operatorEvidenceRef: string;
  blocksLaunch: boolean;
  blocksPdfRelease: boolean;
  blocksAdvancedRelease: boolean;
};

export type Pass2626RuntimeReplayArtifactCollectorReport = {
  passId: typeof PASS2626_RUNTIME_REPLAY_ARTIFACT_COLLECTOR_ID;
  generatedAt: string;
  locale: string;
  requestSurface: "runtime_replay_artifact_collector";
  httpStatus: 200 | 409 | 423;
  summary: {
    totalArtifacts: number;
    attachedArtifacts: number;
    pendingArtifacts: number;
    blockedArtifacts: number;
    operatorReviewArtifacts: number;
    launchBlockingArtifacts: number;
    pdfBlockingArtifacts: number;
    advancedBlockingArtifacts: number;
    launchEvidenceReadiness: number;
    proPdfArtifactReadiness: number;
    stripeWebhookArtifactReadiness: number;
    supabaseArtifactReadiness: number;
    publicLeakArtifactReadiness: number;
    canAttachToReleasePacket: boolean;
    canPromoteAuditLaunch: boolean;
    topBlocker: string;
    nextAction: string;
  };
  customerRows: Pass2626RuntimeReplayArtifactRow[];
  proPdfRows: Pass2626RuntimeReplayArtifactRow[];
  operatorRows: Pass2626RuntimeReplayArtifactRow[];
  launchEvidenceReceiptBoard: {
    invariant: string;
    requiredArtifactIds: string[];
    releaseAcceptanceRules: string[];
    forbiddenCustomerOutput: string[];
    boardColumns: string[];
    requiredCommands: string[];
  };
  customerResponse: {
    ok: boolean;
    surface: "runtime_replay_artifact_collector";
    status: "ready" | "needs_artifacts" | "blocked";
    message: string;
    nextSafeAction: string;
  };
};

type BuilderInput = {
  locale?: string;
  runtimeEvidenceTestPack?: Pass2625RuntimeEvidenceTestPackReport | null;
  runtimeE2eExecuted?: boolean;
  previewRunId?: string | null;
  proPdfMissingClaimsArtifactAttached?: boolean;
  proPdfConsumedTokenArtifactAttached?: boolean;
  stripeDuplicateWebhookArtifactAttached?: boolean;
  stripeRefundRevocationArtifactAttached?: boolean;
  stripeInvalidSignatureArtifactAttached?: boolean;
  supabaseProductionLockArtifactAttached?: boolean;
  accountOwnerMismatchArtifactAttached?: boolean;
  publicApiLeakScanArtifactAttached?: boolean;
  pdfLeakScanArtifactAttached?: boolean;
  operatorAuthArtifactAttached?: boolean;
  preflightArtifactAttached?: boolean;
  i18nArtifactAttached?: boolean;
  releaseBoardStored?: boolean;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function yes(value: boolean | undefined, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function artifactStatus(attached: boolean, source?: Pass2625RuntimeEvidenceTestRow | null): Pass2626ArtifactStatus {
  if (source?.status === "blocked") return "blocked";
  if (attached) return "attached";
  if (source?.status === "warning") return "pending";
  if (source?.status === "pass") return "operator_review";
  return "pending";
}

function findRow(pack: Pass2625RuntimeEvidenceTestPackReport | null | undefined, id: string) {
  return pack?.operatorRows.find((row) => row.id === id) ?? null;
}

function row(
  id: string,
  label: string,
  family: Pass2626ArtifactFamily,
  sourceTestId: string,
  source: Pass2625RuntimeEvidenceTestRow | null,
  attached: boolean,
  requiredArtifact: string,
  customerSafeEvidence: string,
  operatorEvidenceRef: string,
  blocksLaunch: boolean,
  blocksPdfRelease: boolean,
  blocksAdvancedRelease: boolean,
): Pass2626RuntimeReplayArtifactRow {
  const status = artifactStatus(attached, source);
  return {
    id,
    label,
    family,
    status,
    sourceTestId,
    requiredArtifact,
    customerSafeEvidence,
    operatorEvidenceRef,
    blocksLaunch,
    blocksPdfRelease,
    blocksAdvancedRelease,
  };
}

function syntheticRow(
  id: string,
  label: string,
  family: Pass2626ArtifactFamily,
  attached: boolean,
  requiredArtifact: string,
  customerSafeEvidence: string,
  operatorEvidenceRef: string,
  blocksLaunch: boolean,
  blocksPdfRelease: boolean,
  blocksAdvancedRelease: boolean,
): Pass2626RuntimeReplayArtifactRow {
  return {
    id,
    label,
    family,
    status: attached ? "attached" : "pending",
    sourceTestId: "pass2626_launch_evidence_board",
    requiredArtifact,
    customerSafeEvidence,
    operatorEvidenceRef,
    blocksLaunch,
    blocksPdfRelease,
    blocksAdvancedRelease,
  };
}

function readiness(rows: Pass2626RuntimeReplayArtifactRow[], predicate?: (row: Pass2626RuntimeReplayArtifactRow) => boolean) {
  const scoped = predicate ? rows.filter(predicate) : rows;
  if (!scoped.length) return 0;
  const attached = scoped.filter((item) => item.status === "attached").length;
  const review = scoped.filter((item) => item.status === "operator_review").length;
  const pending = scoped.filter((item) => item.status === "pending").length;
  const blocked = scoped.filter((item) => item.status === "blocked").length;
  return clamp((attached / scoped.length) * 98 + (review / scoped.length) * 72 + (pending / scoped.length) * 34 - blocked * 13);
}

function publicize(row: Pass2626RuntimeReplayArtifactRow): Pass2626RuntimeReplayArtifactRow {
  return {
    ...row,
    operatorEvidenceRef: row.status === "attached" ? "stored in launch evidence board" : "operator-only until attached",
  };
}

export function buildPass2626RuntimeReplayArtifactCollectorReport(input: BuilderInput = {}): Pass2626RuntimeReplayArtifactCollectorReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const pack = input.runtimeEvidenceTestPack ?? null;
  const runtimeE2eExecuted = yes(input.runtimeE2eExecuted, Boolean(pack?.summary.canPromoteAuditToProduction && pack.summary.warningCases === 0));
  const previewRunId = String(input.previewRunId ?? "preview-run-required").replace(/[<>\r\n]/g, " ").slice(0, 96);

  const proMissing = findRow(pack, "pro_pdf_missing_claims_blocks_stream");
  const proConsumed = findRow(pack, "pro_pdf_consumed_token_replay_blocks_stream");
  const duplicateWebhook = findRow(pack, "duplicate_webhook_no_double_entitlement");
  const refund = findRow(pack, "refund_chargeback_revokes_entitlement");
  const quarantine = findRow(pack, "failed_webhook_quarantined_no_entitlement_mutation");
  const supabaseLock = findRow(pack, "production_no_memory_fallback");
  const ownerMismatch = findRow(pack, "account_owner_mismatch_blocks_delivery");
  const publicLeak = findRow(pack, "public_api_no_operator_rows");
  const operatorAuth = findRow(pack, "operator_routes_require_admin");
  const pdfLeak = findRow(pack, "pdf_customer_safe_no_private_fields");

  const rows: Pass2626RuntimeReplayArtifactRow[] = [
    row(
      "artifact_pro_pdf_missing_claims_402",
      "Pro PDF missing claims 402/401 artifact",
      "pro_pdf_replay",
      "pro_pdf_missing_claims_blocks_stream",
      proMissing,
      runtimeE2eExecuted && yes(input.proPdfMissingClaimsArtifactAttached, false),
      "HTTP status, content-type JSON, zero PDF bytes, customer-safe missing claims list.",
      "Pro PDF stays locked until paid one-time token and required claims exist.",
      `${previewRunId}/pro-pdf/missing-claims-402.json`,
      true,
      true,
      false,
    ),
    row(
      "artifact_pro_pdf_consumed_token_409",
      "Pro PDF consumed token replay artifact",
      "pro_pdf_replay",
      "pro_pdf_consumed_token_replay_blocks_stream",
      proConsumed,
      runtimeE2eExecuted && yes(input.proPdfConsumedTokenArtifactAttached, false),
      "Second request with same token returns replay_blocked/409 and no PDF bytes.",
      "Consumed PDF links cannot be replayed from another tab or account.",
      `${previewRunId}/pro-pdf/consumed-token-409.json`,
      true,
      true,
      false,
    ),
    row(
      "artifact_stripe_duplicate_webhook_idempotency",
      "Duplicate Stripe webhook idempotency artifact",
      "stripe_webhook_replay",
      "duplicate_webhook_no_double_entitlement",
      duplicateWebhook,
      runtimeE2eExecuted && yes(input.stripeDuplicateWebhookArtifactAttached, false),
      "Same event id replay creates no duplicate entitlement, receipt or PDF token.",
      "Duplicate payment events do not double-unlock Advanced/PDF.",
      `${previewRunId}/stripe/duplicate-event-id.json`,
      true,
      false,
      true,
    ),
    row(
      "artifact_stripe_refund_revocation",
      "Refund / chargeback revocation artifact",
      "stripe_webhook_replay",
      "refund_chargeback_revokes_entitlement",
      refund,
      runtimeE2eExecuted && yes(input.stripeRefundRevocationArtifactAttached, false),
      "Refund/chargeback replay revokes entitlement and blocks existing PDF access token.",
      "Refunded access becomes locked with a customer-safe status.",
      `${previewRunId}/stripe/refund-chargeback-revocation.json`,
      true,
      true,
      true,
    ),
    row(
      "artifact_stripe_invalid_signature_quarantine",
      "Invalid webhook signature quarantine artifact",
      "stripe_webhook_replay",
      "failed_webhook_quarantined_no_entitlement_mutation",
      quarantine,
      runtimeE2eExecuted && yes(input.stripeInvalidSignatureArtifactAttached, false),
      "Invalid/stale/origin-denied webhook is quarantined/dead-lettered and cannot mutate entitlement/report/PDF state.",
      "Failed payment evidence is reviewed by operator, not exposed to customer.",
      `${previewRunId}/stripe/invalid-signature-quarantine.json`,
      true,
      true,
      true,
    ),
    row(
      "artifact_supabase_no_memory_fallback",
      "Production Supabase no-memory-fallback artifact",
      "supabase_delivery_replay",
      "production_no_memory_fallback",
      supabaseLock,
      runtimeE2eExecuted && yes(input.supabaseProductionLockArtifactAttached, false),
      "NODE_ENV=production without durable Supabase delivery blocks safely instead of writing memory rows.",
      "Report delivery waits for durable storage rather than creating a fake local receipt.",
      `${previewRunId}/supabase/no-memory-fallback-production.json`,
      true,
      true,
      true,
    ),
    row(
      "artifact_account_owner_mismatch",
      "Account owner mismatch delivery artifact",
      "supabase_delivery_replay",
      "account_owner_mismatch_blocks_delivery",
      ownerMismatch,
      runtimeE2eExecuted && yes(input.accountOwnerMismatchArtifactAttached, false),
      "Mismatched account/report/record ids block customer vault and PDF delivery.",
      "Only the report owner can open the delivered audit.",
      `${previewRunId}/supabase/account-owner-mismatch.json`,
      true,
      true,
      true,
    ),
    row(
      "artifact_public_api_no_operator_rows",
      "Public API operatorRows leak-scan artifact",
      "public_leak_scan",
      "public_api_no_operator_rows",
      publicLeak,
      runtimeE2eExecuted && yes(input.publicApiLeakScanArtifactAttached, false),
      "Public audit responses are scanned for operatorRows/raw/private/debug keys and fail closed on leak.",
      "Customer receives only public/customer/pro PDF-safe rows.",
      `${previewRunId}/leak-scan/public-api-no-operator-rows.json`,
      true,
      false,
      true,
    ),
    row(
      "artifact_pdf_no_private_fields",
      "PDF customer-safe leak-scan artifact",
      "pdf_customer_safe_scan",
      "pdf_customer_safe_no_private_fields",
      pdfLeak,
      runtimeE2eExecuted && yes(input.pdfLeakScanArtifactAttached, false),
      "PDF text snapshot contains no operatorRows, raw token/hash, service role key, checkout session id or operator note.",
      "Paid PDF contains evidence and missing-proof language only.",
      `${previewRunId}/leak-scan/pro-pdf-private-field-scan.json`,
      true,
      true,
      false,
    ),
    row(
      "artifact_operator_routes_require_admin",
      "Operator/admin route auth artifact",
      "operator_auth_scan",
      "operator_routes_require_admin",
      operatorAuth,
      runtimeE2eExecuted && yes(input.operatorAuthArtifactAttached, false),
      "Unauthenticated operator/admin route requests return 401/403 and never include reviewer notes or raw evidence pointers.",
      "Private operator queues stay unavailable to customers.",
      `${previewRunId}/operator/unauthenticated-route-scan.json`,
      true,
      false,
      true,
    ),
    syntheticRow(
      "artifact_vercel_preflight_pass",
      "Vercel preflight artifact",
      "release_build_gate",
      yes(input.preflightArtifactAttached, true),
      "npm run vercel:preflight output with zero errors.",
      "Static Vercel preflight is attached to the launch packet.",
      `${previewRunId}/build/vercel-preflight.txt`,
      true,
      false,
      false,
    ),
    syntheticRow(
      "artifact_i18n_pass",
      "PL/EN/DE i18n artifact",
      "release_build_gate",
      yes(input.i18nArtifactAttached, true),
      "npm run check:i18n output with zero locale drift errors.",
      "Audit copy and PDF appendix stay locale-safe.",
      `${previewRunId}/build/check-i18n.txt`,
      true,
      false,
      false,
    ),
    syntheticRow(
      "artifact_launch_evidence_board_stored",
      "Launch evidence receipt board stored",
      "launch_receipt_board",
      runtimeE2eExecuted && yes(input.releaseBoardStored, false),
      "All required artifact ids stored in an append-only release packet before production promotion.",
      "Launch is held until all replay artifacts are attached and reviewed.",
      `${previewRunId}/release/launch-evidence-receipt-board.json`,
      true,
      true,
      true,
    ),
  ];

  const attachedArtifacts = rows.filter((item) => item.status === "attached").length;
  const pendingArtifacts = rows.filter((item) => item.status === "pending").length;
  const blockedArtifacts = rows.filter((item) => item.status === "blocked").length;
  const operatorReviewArtifacts = rows.filter((item) => item.status === "operator_review").length;
  const launchBlockingArtifacts = rows.filter((item) => item.blocksLaunch && item.status !== "attached").length;
  const pdfBlockingArtifacts = rows.filter((item) => item.blocksPdfRelease && item.status !== "attached").length;
  const advancedBlockingArtifacts = rows.filter((item) => item.blocksAdvancedRelease && item.status !== "attached").length;
  const launchEvidenceReadiness = readiness(rows);
  const canAttachToReleasePacket = blockedArtifacts === 0 && pendingArtifacts <= 10;
  const canPromoteAuditLaunch = launchBlockingArtifacts === 0;
  const topBlocker = canPromoteAuditLaunch
    ? "none"
    : rows.find((item) => item.blocksLaunch && item.status !== "attached")?.label ?? "runtime replay artifact missing";

  return {
    passId: PASS2626_RUNTIME_REPLAY_ARTIFACT_COLLECTOR_ID,
    generatedAt: new Date().toISOString(),
    locale,
    requestSurface: "runtime_replay_artifact_collector",
    httpStatus: canPromoteAuditLaunch ? 200 : blockedArtifacts > 0 ? 423 : 409,
    summary: {
      totalArtifacts: rows.length,
      attachedArtifacts,
      pendingArtifacts,
      blockedArtifacts,
      operatorReviewArtifacts,
      launchBlockingArtifacts,
      pdfBlockingArtifacts,
      advancedBlockingArtifacts,
      launchEvidenceReadiness,
      proPdfArtifactReadiness: readiness(rows, (item) => item.family === "pro_pdf_replay" || item.family === "pdf_customer_safe_scan"),
      stripeWebhookArtifactReadiness: readiness(rows, (item) => item.family === "stripe_webhook_replay"),
      supabaseArtifactReadiness: readiness(rows, (item) => item.family === "supabase_delivery_replay"),
      publicLeakArtifactReadiness: readiness(rows, (item) => item.family === "public_leak_scan" || item.family === "operator_auth_scan" || item.family === "pdf_customer_safe_scan"),
      canAttachToReleasePacket,
      canPromoteAuditLaunch,
      topBlocker,
      nextAction: canPromoteAuditLaunch
        ? "Attach the release packet to production promotion and keep replay artifacts immutable."
        : "Run preview replay, attach every required artifact and store the launch evidence board before production promotion.",
    },
    customerRows: rows.map(publicize),
    proPdfRows: rows.filter((item) => item.blocksPdfRelease || item.family === "release_build_gate" || item.family === "launch_receipt_board").map(publicize),
    operatorRows: rows,
    launchEvidenceReceiptBoard: {
      invariant: "No audit launch, Advanced delivery or Pro PDF production streaming can be promoted without attached replay artifacts proving failure paths fail closed and customer output remains sanitized.",
      requiredArtifactIds: rows.filter((item) => item.blocksLaunch).map((item) => item.id),
      releaseAcceptanceRules: [
        "Every launch-blocking artifact must be attached, immutable and linked to a preview run id.",
        "Blocked source tests from PASS2625 override attached artifacts and hold launch.",
        "Public customer output may mention artifact status only; operator evidence refs stay private.",
        "A release board without PDF replay, webhook replay, Supabase lock and leak-scan artifacts cannot promote.",
      ],
      forbiddenCustomerOutput: [
        "raw artifact file path",
        "operatorEvidenceRef",
        "raw webhook payload",
        "token hash",
        "service role key",
        "reviewer note",
        "raw Supabase row",
      ],
      boardColumns: [
        "artifactId",
        "family",
        "status",
        "sourceTestId",
        "requiredArtifact",
        "customerSafeEvidence",
        "blocksLaunch",
        "blocksPdfRelease",
        "blocksAdvancedRelease",
      ],
      requiredCommands: [
        "npm run verify:runtime-replay-artifact-collector",
        "npm run verify:runtime-evidence-test-pack",
        "npm run vercel:preflight",
        "npm run check:i18n",
        "npm run build",
      ],
    },
    customerResponse: {
      ok: canPromoteAuditLaunch,
      surface: "runtime_replay_artifact_collector",
      status: canPromoteAuditLaunch ? "ready" : blockedArtifacts > 0 ? "blocked" : "needs_artifacts",
      message: canPromoteAuditLaunch
        ? t(locale, "Dowody replay sa podlaczone do boardu launchowego.", "Replay-Nachweise sind am Launch-Board angehaengt.", "Replay artifacts are attached to the launch board.")
        : t(locale, "Audit jest technicznie blisko, ale przed produkcja trzeba dolaczyc dowody replay.", "Audit ist technisch nah dran, aber vor Production muessen Replay-Nachweise angehaengt werden.", "Audit is technically close, but replay artifacts must be attached before production."),
      nextSafeAction: canPromoteAuditLaunch
        ? "Keep the evidence board immutable and promote only through the release gate."
        : "Attach preview replay artifacts for PDF, Stripe webhook, Supabase delivery, public leak scan and operator auth scan.",
    },
  };
}
