import type { SupabaseClient } from "@supabase/supabase-js";
import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import {
  parseP84AuditCustomerArtifactLinkRow,
  type P84AuditCustomerArtifactLinkRecord,
} from "@/lib/account/audit-account-messages";
import {
  parsePass4822AccountCustomerArtifactSnapshotRow,
} from "@/lib/reporting/account-customer-artifact-store";
import {
  isPass4824ExactPdfAccountCustomerArtifactSnapshot,
  type AccountCustomerArtifactSnapshot,
} from "@/lib/reporting/account-customer-artifact-snapshot";

export const P85_OWNER_VISIBLE_CUSTOMER_ARTIFACT_READ_ID =
  "p85-owner-visible-customer-artifact-read-v1" as const;
export const P85_OWNER_VISIBLE_CUSTOMER_ARTIFACT_LIST_RPC =
  "velmere_list_owner_visible_customer_artifacts_v1" as const;
export const P85_OWNER_VISIBLE_CUSTOMER_ARTIFACT_GET_RPC =
  "velmere_get_owner_visible_customer_artifact_v1" as const;
export const P85_OWNER_VISIBLE_CUSTOMER_ARTIFACT_BOUNDARY_REQUIRED =
  "VELMERE_P85_OWNER_VISIBLE_CUSTOMER_ARTIFACT_BOUNDARY_REQUIRED" as const;

const P85_ROW_KEYS = [
  "visibility_schema_version",
  "publication_state",
  "publication_link",
  "snapshot_id",
  "account_id",
  "account_id_hash",
  "surface",
  "payload_kind",
  "report_id",
  "artifact_digest",
  "snapshot_digest",
  "pdf_storage",
  "snapshot",
  "generated_at",
] as const;

export type P85OwnerVisibleCustomerArtifact = {
  visibilitySchemaVersion: typeof P85_OWNER_VISIBLE_CUSTOMER_ARTIFACT_READ_ID;
  publicationState: "p84_exact_link" | "not_applicable";
  publicationLink: P84AuditCustomerArtifactLinkRecord | null;
  snapshot: AccountCustomerArtifactSnapshot;
};

function assertExactKeys(row: Record<string, unknown>) {
  const actual = Object.keys(row).sort();
  const expected = [...P85_ROW_KEYS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error("owner_visible_customer_artifact_row_shape_invalid");
  }
}

function parseOwnerVisibleRow(
  row: Record<string, unknown>,
  expectedAccountId: string,
): P85OwnerVisibleCustomerArtifact {
  assertExactKeys(row);
  if (row.visibility_schema_version !== P85_OWNER_VISIBLE_CUSTOMER_ARTIFACT_READ_ID) {
    throw new Error("owner_visible_customer_artifact_schema_invalid");
  }
  const snapshot = parsePass4822AccountCustomerArtifactSnapshotRow(row, expectedAccountId);
  if (snapshot.accountIdHash !== hashVelmereAccountBinding(expectedAccountId)) {
    throw new Error("owner_visible_customer_artifact_owner_hash_invalid");
  }

  if (snapshot.surface === "audit") {
    if (row.publication_state !== "p84_exact_link"
      || !row.publication_link
      || typeof row.publication_link !== "object"
      || Array.isArray(row.publication_link)
      || !isPass4824ExactPdfAccountCustomerArtifactSnapshot(snapshot)) {
      throw new Error("owner_visible_audit_artifact_publication_missing");
    }
    const link = parseP84AuditCustomerArtifactLinkRow(
      row.publication_link as Record<string, unknown>,
      { accountId: expectedAccountId, snapshotId: snapshot.snapshotId },
    );
    if (link.accountIdHash !== snapshot.accountIdHash
      || link.artifactSnapshotDigest !== snapshot.snapshotDigest
      || link.artifactDigest !== snapshot.canonicalArtifact.artifactDigest
      || link.pdfDigest !== snapshot.canonicalArtifact.pdfDigest) {
      throw new Error("owner_visible_audit_artifact_publication_mismatch");
    }
    return {
      visibilitySchemaVersion: P85_OWNER_VISIBLE_CUSTOMER_ARTIFACT_READ_ID,
      publicationState: "p84_exact_link",
      publicationLink: link,
      snapshot,
    };
  }

  if (row.publication_state !== "not_applicable" || row.publication_link !== null) {
    throw new Error("owner_visible_non_audit_publication_state_invalid");
  }
  return {
    visibilitySchemaVersion: P85_OWNER_VISIBLE_CUSTOMER_ARTIFACT_READ_ID,
    publicationState: "not_applicable",
    publicationLink: null,
    snapshot,
  };
}

function assertOwnerVisibleOrder(rows: readonly P85OwnerVisibleCustomerArtifact[]) {
  const ids = new Set<string>();
  for (let index = 0; index < rows.length; index += 1) {
    const current = rows[index]!;
    if (ids.has(current.snapshot.snapshotId)) {
      throw new Error("owner_visible_customer_artifact_duplicate_snapshot");
    }
    ids.add(current.snapshot.snapshotId);
    if (index === 0) continue;
    const previous = rows[index - 1]!;
    const previousTime = Date.parse(previous.snapshot.generatedAt);
    const currentTime = Date.parse(current.snapshot.generatedAt);
    if (previousTime < currentTime
      || (previousTime === currentTime && previous.snapshot.snapshotId < current.snapshot.snapshotId)) {
      throw new Error("owner_visible_customer_artifact_order_invalid");
    }
  }
}

function requireClient(client: SupabaseClient | null | undefined) {
  if (!client) throw new Error(P85_OWNER_VISIBLE_CUSTOMER_ARTIFACT_BOUNDARY_REQUIRED);
  return client;
}

export async function listP85OwnerVisibleCustomerArtifacts(args: {
  accountId: string;
  limit?: number;
  client: SupabaseClient | null | undefined;
}) {
  const accountId = String(args.accountId ?? "").trim();
  const limit = Number(args.limit ?? 24);
  if (!/^[A-Za-z0-9][A-Za-z0-9:._-]{5,119}$/u.test(accountId) || accountId.startsWith("preview:")) {
    throw new Error("owner_visible_customer_artifact_account_invalid");
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("owner_visible_customer_artifact_limit_invalid");
  }
  const client = requireClient(args.client);
  const { data, error } = await client.rpc(P85_OWNER_VISIBLE_CUSTOMER_ARTIFACT_LIST_RPC, {
    p_limit: limit,
  });
  if (error) throw new Error(`owner_visible_customer_artifact_list_failed:${error.message}`);
  if (!Array.isArray(data) || data.length > limit) {
    throw new Error("owner_visible_customer_artifact_list_response_invalid");
  }
  const artifacts = data.map((row) => parseOwnerVisibleRow(
    row as Record<string, unknown>,
    accountId,
  ));
  assertOwnerVisibleOrder(artifacts);
  return {
    schemaVersion: P85_OWNER_VISIBLE_CUSTOMER_ARTIFACT_READ_ID,
    source: "supabase" as const,
    artifacts,
  };
}

export async function getP85OwnerVisibleCustomerArtifact(args: {
  accountId: string;
  snapshotId: string;
  client: SupabaseClient | null | undefined;
}) {
  const accountId = String(args.accountId ?? "").trim();
  const snapshotId = String(args.snapshotId ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9:._-]{5,119}$/u.test(accountId) || accountId.startsWith("preview:")) {
    throw new Error("owner_visible_customer_artifact_account_invalid");
  }
  if (!/^[A-Za-z0-9._:-]{8,160}$/u.test(snapshotId)) {
    throw new Error("owner_visible_customer_artifact_snapshot_id_invalid");
  }
  const client = requireClient(args.client);
  const { data, error } = await client.rpc(P85_OWNER_VISIBLE_CUSTOMER_ARTIFACT_GET_RPC, {
    p_snapshot_id: snapshotId,
  });
  if (error) throw new Error(`owner_visible_customer_artifact_get_failed:${error.message}`);
  if (!Array.isArray(data) || data.length > 1) {
    throw new Error("owner_visible_customer_artifact_get_response_invalid");
  }
  if (data.length === 0) return null;
  const artifact = parseOwnerVisibleRow(data[0] as Record<string, unknown>, accountId);
  if (artifact.snapshot.snapshotId !== snapshotId) {
    throw new Error("owner_visible_customer_artifact_get_identity_mismatch");
  }
  return {
    schemaVersion: P85_OWNER_VISIBLE_CUSTOMER_ARTIFACT_READ_ID,
    source: "supabase" as const,
    artifact,
  };
}
