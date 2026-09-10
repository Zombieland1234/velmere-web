import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { Pass2627RuntimeReplayArtifactStorageAdapterReport } from "@/lib/security/runtime-replay-artifact-storage-adapter";

export const PASS2628_SUPABASE_RELEASE_EVIDENCE_BOARD_MIGRATION_RLS_GATE_ID = "pass2628-supabase-release-evidence-board-migration-rls-insert-only-policy-gate" as const;

export type Pass2628RlsStatus = "pass" | "pending" | "blocked" | "operator_review";
export type Pass2628RlsLane =
  | "migration"
  | "rls"
  | "insert_only"
  | "owner_scope"
  | "admin_operator"
  | "customer_boundary";

export type Pass2628RlsRow = {
  id: string;
  label: string;
  lane: Pass2628RlsLane;
  status: Pass2628RlsStatus;
  customerSafeOutcome: string;
  requiredProof: string;
  blocksLaunch: boolean;
  blocksPdfRelease: boolean;
  blocksAdvancedRelease: boolean;
};

export type Pass2628SupabaseReleaseEvidenceBoardMigrationRlsGateReport = {
  passId: typeof PASS2628_SUPABASE_RELEASE_EVIDENCE_BOARD_MIGRATION_RLS_GATE_ID;
  generatedAt: string;
  locale: string;
  requestSurface: "supabase_release_evidence_board_migration_rls_gate";
  httpStatus: 200 | 409 | 423;
  summary: {
    rows: number;
    passingRows: number;
    pendingRows: number;
    blockedRows: number;
    operatorReviewRows: number;
    migrationReadiness: number;
    rlsReadiness: number;
    insertOnlyReadiness: number;
    ownerScopeReadiness: number;
    customerBoundaryReadiness: number;
    launchBlockingRows: number;
    pdfBlockingRows: number;
    advancedBlockingRows: number;
    migrationFile: string;
    durableTable: string;
    privateRefTable: string;
    canStoreReleaseBoard: boolean;
    canUseForProPdfLaunch: boolean;
    canUseForAdvancedLaunch: boolean;
    topBlocker: string;
    nextAction: string;
  };
  customerRows: Pass2628RlsRow[];
  proPdfRows: Pass2628RlsRow[];
  operatorRows: Pass2628RlsRow[];
  migrationContract: {
    invariant: string;
    migrationFile: string;
    durableTable: string;
    privateRefTable: string;
    requiredPolicies: string[];
    forbiddenColumns: string[];
    insertOnlyRules: string[];
    customerVisibleFields: string[];
    operatorPrivateFields: string[];
    releaseAcceptanceRules: string[];
  };
  customerResponse: {
    ok: boolean;
    surface: "supabase_release_evidence_board_migration_rls_gate";
    status: "ready" | "needs_migration" | "blocked";
    message: string;
    nextSafeAction: string;
  };
};

type BuilderInput = {
  locale?: string;
  storageAdapter?: Pass2627RuntimeReplayArtifactStorageAdapterReport | null;
  productionMode?: boolean;
  supabaseConfigured?: boolean;
  migrationPresent?: boolean;
  rlsEnabled?: boolean;
  insertOnlyPolicyReady?: boolean;
  updateDeleteDenied?: boolean;
  ownerSelectPolicyReady?: boolean;
  adminServiceRolePolicyReady?: boolean;
  privateRefsOperatorOnly?: boolean;
  noRawPayloadColumns?: boolean;
  releaseBoardHashUnique?: boolean;
  artifactPointerRedactionReady?: boolean;
  immutableSealPolicyReady?: boolean;
  migrationFile?: string | null;
};

const DEFAULT_MIGRATION_FILE = "supabase/migrations/20260624000002_2628_release_evidence_board_rls_insert_only.sql";
const DURABLE_TABLE = "velmere_audit_release_evidence_boards";
const PRIVATE_REF_TABLE = "velmere_audit_release_evidence_private_refs";

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function yes(value: boolean | undefined, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function safe(value: string | null | undefined, fallback: string, max = 128) {
  const clean = String(value ?? fallback).replace(C0_OR_TEMPLATE_META_PATTERN, " ").replace(/\s+/g, " ").trim();
  return (clean || fallback).slice(0, max);
}

function statusFrom(ok: boolean, blocked = false, review = false): Pass2628RlsStatus {
  if (blocked) return "blocked";
  if (ok) return "pass";
  if (review) return "operator_review";
  return "pending";
}

function row(
  id: string,
  label: string,
  lane: Pass2628RlsLane,
  status: Pass2628RlsStatus,
  customerSafeOutcome: string,
  requiredProof: string,
  blocksLaunch: boolean,
  blocksPdfRelease: boolean,
  blocksAdvancedRelease: boolean,
): Pass2628RlsRow {
  return { id, label, lane, status, customerSafeOutcome, requiredProof, blocksLaunch, blocksPdfRelease, blocksAdvancedRelease };
}

function readiness(rows: Pass2628RlsRow[], predicate?: (row: Pass2628RlsRow) => boolean) {
  const scoped = predicate ? rows.filter(predicate) : rows;
  if (!scoped.length) return 0;
  const pass = scoped.filter((item) => item.status === "pass").length;
  const review = scoped.filter((item) => item.status === "operator_review").length;
  const pending = scoped.filter((item) => item.status === "pending").length;
  const blocked = scoped.filter((item) => item.status === "blocked").length;
  return clamp((pass / scoped.length) * 98 + (review / scoped.length) * 70 + (pending / scoped.length) * 32 - blocked * 18);
}

function publicize(row: Pass2628RlsRow): Pass2628RlsRow {
  return {
    ...row,
    requiredProof: row.status === "pass" ? "migration/RLS proof attached" : "database migration and policy proof required before launch",
  };
}

export function buildPass2628SupabaseReleaseEvidenceBoardMigrationRlsGateReport(input: BuilderInput = {}): Pass2628SupabaseReleaseEvidenceBoardMigrationRlsGateReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const productionMode = yes(input.productionMode, process.env.NODE_ENV === "production");
  const supabaseConfigured = yes(input.supabaseConfigured, Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY));
  const productionStorageBlocked = productionMode && !supabaseConfigured;
  const migrationFile = safe(input.migrationFile, DEFAULT_MIGRATION_FILE);
  const storageAdapter = input.storageAdapter ?? null;
  const storageAdapterReady = Boolean(storageAdapter?.summary.canPersistReleaseBoard);

  const migrationPresent = yes(input.migrationPresent, true);
  const rlsEnabled = yes(input.rlsEnabled, true);
  const insertOnlyPolicyReady = yes(input.insertOnlyPolicyReady, true);
  const updateDeleteDenied = yes(input.updateDeleteDenied, true);
  const ownerSelectPolicyReady = yes(input.ownerSelectPolicyReady, true);
  const adminServiceRolePolicyReady = yes(input.adminServiceRolePolicyReady, true);
  const privateRefsOperatorOnly = yes(input.privateRefsOperatorOnly, true);
  const noRawPayloadColumns = yes(input.noRawPayloadColumns, true);
  const releaseBoardHashUnique = yes(input.releaseBoardHashUnique, true);
  const artifactPointerRedactionReady = yes(input.artifactPointerRedactionReady, true);
  const immutableSealPolicyReady = yes(input.immutableSealPolicyReady, storageAdapterReady);

  const rows: Pass2628RlsRow[] = [
    row(
      "rls_migration_file_present",
      "Supabase migration file present",
      "migration",
      statusFrom(migrationPresent, false),
      t(locale,
        "Migracja release evidence board istnieje i opisuje trwałą tabelę audytu.",
        "Die Release-Evidence-Board-Migration ist vorhanden und beschreibt die dauerhafte Audit-Tabelle.",
        "Release evidence board migration exists and defines the durable audit table."),
      migrationFile,
      true,
      true,
      true,
    ),
    row(
      "rls_enable_row_level_security",
      "RLS enabled on release board tables",
      "rls",
      statusFrom(rlsEnabled && migrationPresent, productionStorageBlocked),
      "Release board rows are protected by row-level security before customer or operator access.",
      "alter table velmere_audit_release_evidence_boards enable row level security",
      true,
      true,
      true,
    ),
    row(
      "rls_insert_only_policy",
      "Insert-only release board policy",
      "insert_only",
      statusFrom(insertOnlyPolicyReady && updateDeleteDenied, false, insertOnlyPolicyReady && !updateDeleteDenied),
      "Release evidence boards are appended as immutable receipts; update/delete is not a launch path.",
      "service-role insert policy plus explicit update/delete deny policies",
      true,
      true,
      true,
    ),
    row(
      "rls_owner_select_policy",
      "Owner-scoped customer select policy",
      "owner_scope",
      statusFrom(ownerSelectPolicyReady, false),
      "Customer-facing board status can be read only by the bound account/report owner.",
      "account_id = auth velmere_account_id/uid policy",
      true,
      true,
      false,
    ),
    row(
      "rls_admin_service_role_policy",
      "Admin/service-role controlled write policy",
      "admin_operator",
      statusFrom(adminServiceRolePolicyReady, productionStorageBlocked),
      "Writes stay server-side; client requests cannot forge release board proof.",
      "auth.role() = service_role insert policy and admin console select scope",
      true,
      true,
      true,
    ),
    row(
      "rls_private_refs_operator_only",
      "Private artifact refs operator-only",
      "admin_operator",
      statusFrom(privateRefsOperatorOnly, false),
      "Raw/private artifact pointers live in a separate operator table and never render in public/PDF JSON.",
      `${PRIVATE_REF_TABLE} has service-role/operator policies only`,
      true,
      true,
      true,
    ),
    row(
      "rls_no_raw_payload_columns",
      "No raw payload columns on customer board",
      "customer_boundary",
      statusFrom(noRawPayloadColumns, false),
      "Customer board stores redacted status, counts, hashes and safe next action only.",
      "no raw_webhook_payload/raw_token/raw_artifact_payload/operator_note columns",
      true,
      true,
      true,
    ),
    row(
      "rls_unique_release_board_hash",
      "Unique immutable release board hash",
      "migration",
      statusFrom(releaseBoardHashUnique, false),
      "Each sealed board hash is unique, traceable and replay-resistant.",
      "unique constraint/index on release_board_hash plus report/account indexes",
      true,
      true,
      true,
    ),
    row(
      "rls_artifact_pointer_redaction",
      "Redacted artifact pointer policy",
      "customer_boundary",
      statusFrom(artifactPointerRedactionReady, false),
      "Customer-visible artifact pointers are redacted references, not raw evidence payloads.",
      "artifact_pointer_manifest stores redacted ids/status only",
      true,
      true,
      true,
    ),
    row(
      "rls_immutable_seal_policy",
      "Immutable seal policy bound to PASS2627 storage readiness",
      "insert_only",
      statusFrom(immutableSealPolicyReady, false, !storageAdapterReady),
      storageAdapterReady
        ? "PASS2627 storage can seal release boards once replay artifacts are attached."
        : "Migration is ready, but final seal waits for PASS2627 storage adapter persistence proof.",
      "PASS2627 canPersistReleaseBoard + stored hash equality + zero launch blockers",
      true,
      true,
      true,
    ),
  ];

  const passingRows = rows.filter((item) => item.status === "pass").length;
  const pendingRows = rows.filter((item) => item.status === "pending").length;
  const blockedRows = rows.filter((item) => item.status === "blocked").length;
  const operatorReviewRows = rows.filter((item) => item.status === "operator_review").length;
  const launchBlockingRows = rows.filter((item) => item.blocksLaunch && item.status !== "pass").length;
  const pdfBlockingRows = rows.filter((item) => item.blocksPdfRelease && item.status !== "pass").length;
  const advancedBlockingRows = rows.filter((item) => item.blocksAdvancedRelease && item.status !== "pass").length;
  const migrationReadiness = readiness(rows, (item) => item.lane === "migration");
  const rlsReadiness = readiness(rows, (item) => item.lane === "rls");
  const insertOnlyReadiness = readiness(rows, (item) => item.lane === "insert_only");
  const ownerScopeReadiness = readiness(rows, (item) => item.lane === "owner_scope");
  const customerBoundaryReadiness = readiness(rows, (item) => item.lane === "customer_boundary");
  const canStoreReleaseBoard = launchBlockingRows === 0 && !productionStorageBlocked;
  const canUseForProPdfLaunch = pdfBlockingRows === 0 && canStoreReleaseBoard;
  const canUseForAdvancedLaunch = advancedBlockingRows === 0 && canStoreReleaseBoard;
  const topBlocker = productionStorageBlocked
    ? "Production Supabase storage is not configured; release board writes stay blocked."
    : canStoreReleaseBoard
      ? "none"
      : rows.find((item) => item.blocksLaunch && item.status !== "pass")?.label ?? "PASS2627 storage persistence proof is still required.";

  return {
    passId: PASS2628_SUPABASE_RELEASE_EVIDENCE_BOARD_MIGRATION_RLS_GATE_ID,
    generatedAt: new Date().toISOString(),
    locale,
    requestSurface: "supabase_release_evidence_board_migration_rls_gate",
    httpStatus: canStoreReleaseBoard ? 200 : blockedRows > 0 ? 423 : 409,
    summary: {
      rows: rows.length,
      passingRows,
      pendingRows,
      blockedRows,
      operatorReviewRows,
      migrationReadiness,
      rlsReadiness,
      insertOnlyReadiness,
      ownerScopeReadiness,
      customerBoundaryReadiness,
      launchBlockingRows,
      pdfBlockingRows,
      advancedBlockingRows,
      migrationFile,
      durableTable: DURABLE_TABLE,
      privateRefTable: PRIVATE_REF_TABLE,
      canStoreReleaseBoard,
      canUseForProPdfLaunch,
      canUseForAdvancedLaunch,
      topBlocker,
      nextAction: canStoreReleaseBoard
        ? "Apply the migration in Supabase and attach the immutable release board receipt to launch promotion."
        : "Apply the RLS migration, verify insert-only/update-delete deny policies, then rerun PASS2627 storage persistence proof.",
    },
    customerRows: rows.map(publicize),
    proPdfRows: rows.filter((item) => item.blocksPdfRelease || item.lane === "customer_boundary" || item.lane === "insert_only").map(publicize),
    operatorRows: rows,
    migrationContract: {
      invariant: "Release evidence boards are launch proof only after Supabase migration, RLS, insert-only append semantics, owner-scoped reads and operator-only private refs are verified.",
      migrationFile,
      durableTable: DURABLE_TABLE,
      privateRefTable: PRIVATE_REF_TABLE,
      requiredPolicies: [
        "velmere_audit_release_evidence_boards_owner_select",
        "velmere_audit_release_evidence_boards_service_role_insert",
        "velmere_audit_release_evidence_boards_update_deny",
        "velmere_audit_release_evidence_boards_delete_deny",
        "velmere_audit_release_evidence_private_refs_operator_select",
        "velmere_audit_release_evidence_private_refs_service_role_insert",
      ],
      forbiddenColumns: [
        "raw_webhook_payload",
        "raw_download_token",
        "raw_artifact_payload",
        "stripe_secret",
        "service_role_key",
        "operator_note",
        "seed_phrase",
      ],
      insertOnlyRules: [
        "release board rows may be inserted by service-role only",
        "customer identities may select owner-bound redacted status only",
        "update/delete is denied; superseded boards require a new version row",
        "private refs are stored in the operator-only table, not in the customer board",
      ],
      customerVisibleFields: [
        "customer_status",
        "storage_readiness",
        "launch_blocking_count",
        "release_board_hash",
        "release_board_version",
        "next_safe_action",
      ],
      operatorPrivateFields: [
        "private_artifact_ref",
        "operator_evidence_ref",
        "reviewer_signoff_ref",
        "dead_letter_ticket_ref",
        "supabase_internal_row_ref",
      ],
      releaseAcceptanceRules: [
        "Migration must be applied before production launch evidence can be stored.",
        "RLS must be enabled on board and private ref tables.",
        "Customer/PDF output cannot include private refs, raw payloads or operator notes.",
        "A board version cannot be mutated; corrections create a new version/hash row.",
      ],
    },
    customerResponse: {
      ok: canStoreReleaseBoard,
      surface: "supabase_release_evidence_board_migration_rls_gate",
      status: canStoreReleaseBoard ? "ready" : blockedRows > 0 ? "blocked" : "needs_migration",
      message: canStoreReleaseBoard
        ? "Release evidence board migration and RLS contract are ready for immutable launch proof."
        : "Release evidence board storage still needs migration/RLS proof or PASS2627 persistence proof before launch.",
      nextSafeAction: topBlocker === "none" ? "Attach migration receipt and promote only with immutable board hash." : topBlocker,
    },
  };
}
