import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { Pass2626RuntimeReplayArtifactCollectorReport, Pass2626RuntimeReplayArtifactRow } from "@/lib/security/runtime-replay-artifact-collector";

import { canonicalJson } from "@/lib/security/canonical-json";
export const PASS2627_RUNTIME_REPLAY_ARTIFACT_STORAGE_ADAPTER_ID = "runtime-replay-artifact-storage-adapter-immutable-release-board-persistence" as const;

export type Pass2627StorageStatus = "persisted" | "pending" | "blocked" | "operator_review";
export type Pass2627StorageLane =
  | "storage_adapter"
  | "immutable_board"
  | "release_packet"
  | "production_fallback"
  | "customer_boundary";

export type Pass2627StorageRow = {
  id: string;
  label: string;
  lane: Pass2627StorageLane;
  status: Pass2627StorageStatus;
  customerSafeOutcome: string;
  requiredProof: string;
  blocksLaunch: boolean;
  blocksPdfRelease: boolean;
  blocksAdvancedRelease: boolean;
};

export type Pass2627RuntimeReplayArtifactStorageAdapterReport = {
  passId: typeof PASS2627_RUNTIME_REPLAY_ARTIFACT_STORAGE_ADAPTER_ID;
  generatedAt: string;
  locale: string;
  requestSurface: "runtime_replay_artifact_storage_adapter";
  httpStatus: 200 | 409 | 423;
  summary: {
    storageRows: number;
    persistedRows: number;
    pendingRows: number;
    blockedRows: number;
    operatorReviewRows: number;
    storageReadiness: number;
    immutableBoardReadiness: number;
    releasePacketReadiness: number;
    productionFallbackReadiness: number;
    customerBoundaryReadiness: number;
    launchBlockingRows: number;
    pdfBlockingRows: number;
    advancedBlockingRows: number;
    releaseBoardHash: string;
    releaseBoardVersion: string;
    canPersistReleaseBoard: boolean;
    canPromoteAuditLaunch: boolean;
    topBlocker: string;
    nextAction: string;
  };
  customerRows: Pass2627StorageRow[];
  proPdfRows: Pass2627StorageRow[];
  operatorRows: Pass2627StorageRow[];
  storageAdapterContract: {
    invariant: string;
    durableTable: string;
    appendOnlyColumns: string[];
    forbiddenProductionFallbacks: string[];
    customerVisibleFields: string[];
    privateOperatorFields: string[];
    releaseAcceptanceRules: string[];
  };
  customerResponse: {
    ok: boolean;
    surface: "runtime_replay_artifact_storage_adapter";
    status: "ready" | "needs_storage" | "blocked";
    message: string;
    nextSafeAction: string;
  };
};

type BuilderInput = {
  locale?: string;
  runtimeReplayArtifactCollector?: Pass2626RuntimeReplayArtifactCollectorReport | null;
  productionMode?: boolean;
  supabaseConfigured?: boolean;
  releaseBoardStored?: boolean;
  appendOnlyLedgerReady?: boolean;
  immutableHashVerified?: boolean;
  artifactPointersStored?: boolean;
  storageOwnerScoped?: boolean;
  noMemoryFallbackInProduction?: boolean;
  customerPublicStatusStored?: boolean;
  operatorPrivateRefsStored?: boolean;
  releasePacketSealed?: boolean;
  releaseBoardVersion?: string | null;
  previewRunId?: string | null;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function yes(value: boolean | undefined, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function safe(value: string | null | undefined, fallback: string, max = 96) {
  const clean = String(value ?? fallback).replace(C0_OR_TEMPLATE_META_PATTERN, " ").replace(/\s+/g, " ").trim();
  return (clean || fallback).slice(0, max);
}

const stableStringify = canonicalJson;

function stableHash(value: unknown) {
  return `vlm-${sha256Token(stableStringify(value), 24)}`;
}

function statusFrom(ok: boolean, blocked = false, review = false): Pass2627StorageStatus {
  if (blocked) return "blocked";
  if (ok) return "persisted";
  if (review) return "operator_review";
  return "pending";
}

function row(
  id: string,
  label: string,
  lane: Pass2627StorageLane,
  status: Pass2627StorageStatus,
  customerSafeOutcome: string,
  requiredProof: string,
  blocksLaunch: boolean,
  blocksPdfRelease: boolean,
  blocksAdvancedRelease: boolean,
): Pass2627StorageRow {
  return { id, label, lane, status, customerSafeOutcome, requiredProof, blocksLaunch, blocksPdfRelease, blocksAdvancedRelease };
}

function readiness(rows: Pass2627StorageRow[], predicate?: (row: Pass2627StorageRow) => boolean) {
  const scoped = predicate ? rows.filter(predicate) : rows;
  if (!scoped.length) return 0;
  const persisted = scoped.filter((item) => item.status === "persisted").length;
  const review = scoped.filter((item) => item.status === "operator_review").length;
  const pending = scoped.filter((item) => item.status === "pending").length;
  const blocked = scoped.filter((item) => item.status === "blocked").length;
  return clamp((persisted / scoped.length) * 98 + (review / scoped.length) * 70 + (pending / scoped.length) * 30 - blocked * 15);
}

function publicize(row: Pass2627StorageRow): Pass2627StorageRow {
  return {
    ...row,
    requiredProof: row.status === "persisted" ? "stored release proof attached" : "operator/storage proof required before launch",
  };
}

function collectorHasBlockingArtifacts(collector: Pass2626RuntimeReplayArtifactCollectorReport | null | undefined) {
  return Boolean(collector && collector.summary.launchBlockingArtifacts > 0);
}

function collectorRows(collector: Pass2626RuntimeReplayArtifactCollectorReport | null | undefined): Pass2626RuntimeReplayArtifactRow[] {
  return collector?.operatorRows ?? [];
}

export function buildPass2627RuntimeReplayArtifactStorageAdapterReport(input: BuilderInput = {}): Pass2627RuntimeReplayArtifactStorageAdapterReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const productionMode = yes(input.productionMode, process.env.NODE_ENV === "production");
  const supabaseConfigured = yes(input.supabaseConfigured, Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY));
  const releaseBoardVersion = safe(input.releaseBoardVersion, "release-board-v1");
  const previewRunId = safe(input.previewRunId, "preview-run-required");
  const collector = input.runtimeReplayArtifactCollector ?? null;
  const collectorBlocking = collectorHasBlockingArtifacts(collector);
  const collectorAttached = collectorRows(collector).filter((item) => item.status === "attached").length;
  const collectorTotal = collectorRows(collector).length;

  const releaseBoardStored = yes(input.releaseBoardStored, false);
  const appendOnlyLedgerReady = yes(input.appendOnlyLedgerReady, false);
  const immutableHashVerified = yes(input.immutableHashVerified, false);
  const artifactPointersStored = yes(input.artifactPointersStored, false);
  const storageOwnerScoped = yes(input.storageOwnerScoped, false);
  const noMemoryFallbackInProduction = yes(input.noMemoryFallbackInProduction, productionMode ? supabaseConfigured : true);
  const customerPublicStatusStored = yes(input.customerPublicStatusStored, false);
  const operatorPrivateRefsStored = yes(input.operatorPrivateRefsStored, false);
  const releasePacketSealed = yes(input.releasePacketSealed, false);
  const productionStorageBlocked = productionMode && !supabaseConfigured;

  const releaseBoardHash = stableHash({
    pass: PASS2627_RUNTIME_REPLAY_ARTIFACT_STORAGE_ADAPTER_ID,
    releaseBoardVersion,
    previewRunId,
    collectorAttached,
    collectorTotal,
    collectorBlocking,
  });

  const rows: Pass2627StorageRow[] = [
    row(
      "storage_release_board_row",
      "Release evidence board storage row",
      "storage_adapter",
      statusFrom(releaseBoardStored, productionStorageBlocked),
      t(locale,
        "Tablica dowodów launchowych musi być zapisana trwale przed promocją audytu.",
        "Das Launch-Evidence-Board muss vor Promotion dauerhaft gespeichert werden.",
        "The launch evidence board must be durably stored before audit promotion."),
      `${previewRunId}/release/${releaseBoardVersion}.json`,
      true,
      true,
      true,
    ),
    row(
      "storage_append_only_ledger",
      "Append-only artifact ledger",
      "storage_adapter",
      statusFrom(appendOnlyLedgerReady, productionStorageBlocked),
      "Replay artifacts are appended as immutable receipts; update/delete is not a launch path.",
      "database policy: insert-only artifact receipts with actor, timestamp and version hash",
      true,
      true,
      true,
    ),
    row(
      "storage_immutable_hash_verified",
      "Immutable release board hash verification",
      "immutable_board",
      statusFrom(immutableHashVerified && releaseBoardStored, false, releaseBoardStored && !immutableHashVerified),
      `Release board has a stable customer-safe hash: ${releaseBoardHash}.`,
      "stored hash must match recomputed board hash before PDF/Advanced promotion",
      true,
      true,
      true,
    ),
    row(
      "storage_artifact_pointers_stored",
      "Artifact pointers stored without raw leakage",
      "immutable_board",
      statusFrom(artifactPointersStored, productionStorageBlocked),
      "Only redacted artifact pointers are stored for customer status; raw proof remains operator-only.",
      "redacted pointer list with raw private evidence refs excluded from customer output",
      true,
      true,
      true,
    ),
    row(
      "storage_owner_scoped_release_board",
      "Owner-scoped release board access",
      "release_packet",
      statusFrom(storageOwnerScoped, false, !storageOwnerScoped && releaseBoardStored),
      "Release evidence can be opened only by the report owner or authorized operator scope.",
      "owner account id + report id + entitlement id binding check",
      true,
      true,
      true,
    ),
    row(
      "storage_no_memory_fallback_production",
      "No memory fallback in production",
      "production_fallback",
      statusFrom(noMemoryFallbackInProduction, productionStorageBlocked),
      "Production launch blocks instead of storing replay artifacts in memory/local process state.",
      "NODE_ENV=production without durable Supabase storage returns locked status",
      true,
      true,
      true,
    ),
    row(
      "storage_customer_public_status",
      "Customer-safe board status stored",
      "customer_boundary",
      statusFrom(customerPublicStatusStored, productionStorageBlocked),
      "Customer output stores only readiness, blocker count, safe next action and release hash.",
      "customer-safe status row: status/readiness/topBlocker/hash only",
      true,
      false,
      false,
    ),
    row(
      "storage_operator_private_refs",
      "Operator private artifact refs stored separately",
      "customer_boundary",
      statusFrom(operatorPrivateRefsStored, productionStorageBlocked),
      "Operator proof references are separated from public/customer/PDF envelopes.",
      "private operator refs table with admin scope, no public route exposure",
      true,
      true,
      true,
    ),
    row(
      "storage_release_packet_sealed",
      "Immutable release packet sealed",
      "release_packet",
      statusFrom(releasePacketSealed && !collectorBlocking, collectorBlocking, releaseBoardStored && !releasePacketSealed),
      collectorBlocking
        ? "Launch stays blocked until PASS2626 artifact collector has zero launch blockers."
        : "Release packet can be sealed only after board storage, hash verification and replay artifacts are attached.",
      "sealed release packet with board hash, artifact ids and reviewer signoff",
      true,
      true,
      true,
    ),
  ];

  const persistedRows = rows.filter((item) => item.status === "persisted").length;
  const pendingRows = rows.filter((item) => item.status === "pending").length;
  const blockedRows = rows.filter((item) => item.status === "blocked").length;
  const operatorReviewRows = rows.filter((item) => item.status === "operator_review").length;
  const launchBlockingRows = rows.filter((item) => item.blocksLaunch && item.status !== "persisted").length;
  const pdfBlockingRows = rows.filter((item) => item.blocksPdfRelease && item.status !== "persisted").length;
  const advancedBlockingRows = rows.filter((item) => item.blocksAdvancedRelease && item.status !== "persisted").length;
  const storageReadiness = readiness(rows);
  const canPersistReleaseBoard = !productionStorageBlocked && releaseBoardStored && appendOnlyLedgerReady && immutableHashVerified;
  const canPromoteAuditLaunch = launchBlockingRows === 0 && !collectorBlocking;
  const topBlocker = productionStorageBlocked
    ? "Production durable Supabase storage is not configured; memory fallback is denied."
    : canPromoteAuditLaunch
      ? "none"
      : rows.find((item) => item.blocksLaunch && item.status !== "persisted")?.label ?? "PASS2626 artifacts still block release packet sealing";

  return {
    passId: PASS2627_RUNTIME_REPLAY_ARTIFACT_STORAGE_ADAPTER_ID,
    generatedAt: new Date().toISOString(),
    locale,
    requestSurface: "runtime_replay_artifact_storage_adapter",
    httpStatus: canPromoteAuditLaunch ? 200 : blockedRows > 0 ? 423 : 409,
    summary: {
      storageRows: rows.length,
      persistedRows,
      pendingRows,
      blockedRows,
      operatorReviewRows,
      storageReadiness,
      immutableBoardReadiness: readiness(rows, (item) => item.lane === "immutable_board"),
      releasePacketReadiness: readiness(rows, (item) => item.lane === "release_packet"),
      productionFallbackReadiness: readiness(rows, (item) => item.lane === "production_fallback"),
      customerBoundaryReadiness: readiness(rows, (item) => item.lane === "customer_boundary"),
      launchBlockingRows,
      pdfBlockingRows,
      advancedBlockingRows,
      releaseBoardHash,
      releaseBoardVersion,
      canPersistReleaseBoard,
      canPromoteAuditLaunch,
      topBlocker,
      nextAction: canPromoteAuditLaunch
        ? "Keep the release board immutable and attach the sealed packet to production promotion."
        : "Persist the release board in durable storage, verify hash, store redacted pointers and seal the release packet only after PASS2626 launch blockers reach zero.",
    },
    customerRows: rows.map(publicize),
    proPdfRows: rows.filter((item) => item.blocksPdfRelease || item.lane === "customer_boundary" || item.lane === "release_packet").map(publicize),
    operatorRows: rows,
    storageAdapterContract: {
      invariant: "Runtime replay artifacts are not launch proof until the release board is stored in durable append-only storage with a stable hash, owner scope and no production memory fallback.",
      durableTable: "velmere_audit_release_evidence_boards",
      appendOnlyColumns: [
        "id",
        "report_id",
        "account_id",
        "entitlement_id",
        "preview_run_id",
        "release_board_version",
        "release_board_hash",
        "customer_status",
        "artifact_pointer_count",
        "created_at",
        "created_by_operator_id",
      ],
      forbiddenProductionFallbacks: [
        "in-memory release board",
        "localStorage launch proof",
        "unstamped PDF artifact",
        "raw webhook payload in customer output",
        "operatorEvidenceRef in public JSON",
      ],
      customerVisibleFields: [
        "customer_status",
        "storage_readiness",
        "top_blocker",
        "release_board_hash",
        "next_safe_action",
      ],
      privateOperatorFields: [
        "raw_artifact_ref",
        "operator_evidence_ref",
        "supabase_row_id",
        "reviewer_note",
        "webhook_payload_pointer",
      ],
      releaseAcceptanceRules: [
        "Production mode must deny memory fallback when durable storage is missing.",
        "Release board hash must be recomputed from the stored artifact manifest before promotion.",
        "Customer/PDF output may show readiness and hash only; raw artifact pointers stay operator-only.",
        "A sealed release packet requires PASS2626 launch blockers to be zero.",
      ],
    },
    customerResponse: {
      ok: canPromoteAuditLaunch,
      surface: "runtime_replay_artifact_storage_adapter",
      status: canPromoteAuditLaunch ? "ready" : blockedRows > 0 ? "blocked" : "needs_storage",
      message: canPromoteAuditLaunch
        ? "Replay artifacts are stored, hashed and sealed for launch."
        : "Replay artifacts still need durable storage, hash verification or sealed release packet proof before launch.",
      nextSafeAction: topBlocker === "none" ? "Promote with sealed evidence packet attached." : topBlocker,
    },
  };
}
