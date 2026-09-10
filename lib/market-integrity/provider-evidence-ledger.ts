import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredConfiguredOriginFetch } from "@/lib/network/brokered-egress";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readDurableJsonBounded, writeDurableJsonAtomic } from "@/lib/security/durable-file-boundary";
import {
  isPass4644CommerciallyFreshReceipt,
  pass4644CanonicalReceiptDigest,
} from "./provider-evidence-receipt";
import type {
  Pass4644ProviderEvidenceReceipt,
  Pass4644ProviderSurface,
  Pass4645AnalysisDepth,
  Pass4645LedgerPersistence,
  Pass4645ProviderEvidenceLedger,
  Pass4645ProviderEvidenceLedgerEntry,
} from "./provider-evidence-contract";

// Keep legacy imports working while making provider-evidence-contract.ts the
// only authoritative structural definition for receipt and ledger DTOs.
export type {
  Pass4645AnalysisDepth,
  Pass4645LedgerPersistence,
  Pass4645LedgerStorageMode,
  Pass4645ProviderEvidenceLedger,
  Pass4645ProviderEvidenceLedgerEntry,
} from "./provider-evidence-contract";

export type Pass4645SupabaseLedgerRow = {
  ledger_id?: unknown;
  requested_identity?: unknown;
  surface?: unknown;
  depth?: unknown;
  head_hash?: unknown;
  receipt_count?: unknown;
  eligible_receipt_count?: unknown;
  signed?: unknown;
  payload?: unknown;
};

export type Pass4645LedgerVerification = {
  valid: boolean;
  chainValid: boolean;
  signatureValid: boolean;
  premiumValid: boolean;
  blockers: string[];
};

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`).join(",")}}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanIdentity(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9:._^=\-/]+/g, "").slice(0, 180) || "unknown";
}

function hmac(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function signatureMatches(value: string, signature: string, secret: string) {
  const expected = Buffer.from(hmac(value, secret), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function normalizedSigningSecret(value: string | null | undefined): string | null {
  const secret = String(value ?? "").trim();
  return Buffer.byteLength(secret, "utf8") >= 32 ? secret : null;
}

function ledgerIdFor(args: {
  requestedIdentity: string;
  surface: Pass4644ProviderSurface;
  depth: Pass4645AnalysisDepth;
  generatedAt: string;
  receiptIds: string[];
}) {
  return `p4645_${sha256(stableSerialize({
    requestedIdentity: args.requestedIdentity,
    surface: args.surface,
    depth: args.depth,
    generatedAt: args.generatedAt,
    receipts: args.receiptIds,
  })).slice(0, 28)}`;
}

function canonicalIso(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function buildPass4645ProviderEvidenceLedger(args: {
  receipts?: Pass4644ProviderEvidenceReceipt[] | null;
  requestedIdentity: string;
  surface: Pass4644ProviderSurface;
  depth: Pass4645AnalysisDepth;
  generatedAt?: string | Date;
  retentionDays?: number;
  signingSecret?: string | null;
}): Pass4645ProviderEvidenceLedger {
  const generatedAt = args.generatedAt instanceof Date ? args.generatedAt : args.generatedAt ? new Date(args.generatedAt) : new Date();
  const safeGeneratedAt = Number.isFinite(generatedAt.getTime()) ? generatedAt : new Date();
  const retentionDays = Math.max(1, Math.min(3650, Math.round(args.retentionDays ?? 365)));
  const requestedIdentity = cleanIdentity(args.requestedIdentity);
  const signingSecret = normalizedSigningSecret(args.signingSecret);
  const sortedReceipts = [...(args.receipts ?? [])].sort((a, b) => a.receiptId.localeCompare(b.receiptId));
  const ledgerId = ledgerIdFor({
    requestedIdentity,
    surface: args.surface,
    depth: args.depth,
    generatedAt: safeGeneratedAt.toISOString(),
    receiptIds: sortedReceipts.map((receipt) => receipt.receiptId),
  });
  let previousEntryHash: string | null = null;
  const entries = sortedReceipts.map((receipt, index): Pass4645ProviderEvidenceLedgerEntry => {
    const persistedAt = safeGeneratedAt.toISOString();
    const retentionExpiresAt = new Date(safeGeneratedAt.getTime() + retentionDays * 86_400_000).toISOString();
    const unsigned = {
      schemaVersion: "pass4645_provider_evidence_ledger_entry_v1" as const,
      ledgerId,
      sequence: index + 1,
      previousEntryHash,
      requestedIdentity,
      surface: args.surface,
      depth: args.depth,
      receiptId: receipt.receiptId,
      providerId: receipt.providerId,
      providerFamily: receipt.providerFamily,
      payloadHash: receipt.payloadHash,
      receiptCanonicalDigest: pass4644CanonicalReceiptDigest(receipt),
      commercialEvidenceEligible: isPass4644CommerciallyFreshReceipt(receipt, safeGeneratedAt),
      timestampProvenance: receipt.timestampProvenance,
      observedAt: receipt.observedAt,
      receivedAt: receipt.receivedAt,
      persistedAt,
      retentionExpiresAt,
    };
    const entryHash = sha256(stableSerialize(unsigned));
    const signature = signingSecret ? hmac(entryHash, signingSecret) : null;
    const entry = { ...unsigned, entryHash, signature };
    previousEntryHash = entryHash;
    return entry;
  });
  return {
    schemaVersion: "pass4645_provider_evidence_ledger_v1",
    ledgerId,
    requestedIdentity,
    surface: args.surface,
    depth: args.depth,
    generatedAt: safeGeneratedAt.toISOString(),
    receiptCount: entries.length,
    eligibleReceiptCount: sortedReceipts.filter((receipt) => isPass4644CommerciallyFreshReceipt(receipt, safeGeneratedAt)).length,
    headHash: entries.at(-1)?.entryHash ?? null,
    signed: entries.length > 0 && entries.every((entry) => Boolean(entry.signature)),
    entries,
  };
}

export function verifyPass4645ProviderEvidenceLedger(
  ledger: Pass4645ProviderEvidenceLedger,
  signingSecret?: string | null,
): Pass4645LedgerVerification {
  if (!ledger || typeof ledger !== "object" || !Array.isArray(ledger.entries)
    || ledger.entries.some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry))) {
    return {
      valid: false,
      chainValid: false,
      signatureValid: false,
      premiumValid: false,
      blockers: ["ledger_payload_invalid"],
    };
  }
  const blockers: string[] = [];
  const suppliedSigningSecret = signingSecret !== null && signingSecret !== undefined && String(signingSecret).length > 0;
  const verifiedSigningSecret = normalizedSigningSecret(signingSecret);
  if (suppliedSigningSecret && !verifiedSigningSecret) blockers.push("signature_secret_too_short");
  const validSurfaces: Pass4644ProviderSurface[] = ["crypto", "real_markets", "contract_audit"];
  const validDepths: Pass4645AnalysisDepth[] = ["basic", "pro", "advanced"];
  const receiptIds = ledger.entries.map((entry) => entry.receiptId);
  const canonicalReceiptIds = receiptIds.slice().sort((left, right) => left.localeCompare(right));
  const metadataCanonical = ledger.requestedIdentity === cleanIdentity(ledger.requestedIdentity)
    && validSurfaces.includes(ledger.surface)
    && validDepths.includes(ledger.depth)
    && canonicalIso(ledger.generatedAt);
  if (ledger.schemaVersion !== "pass4645_provider_evidence_ledger_v1") blockers.push("ledger_schema_invalid");
  if (ledger.requestedIdentity !== cleanIdentity(ledger.requestedIdentity)) blockers.push("ledger_requested_identity_not_canonical");
  if (!validSurfaces.includes(ledger.surface)) blockers.push("ledger_surface_invalid");
  if (!validDepths.includes(ledger.depth)) blockers.push("ledger_depth_invalid");
  if (!canonicalIso(ledger.generatedAt)) blockers.push("ledger_generated_at_invalid");
  if (receiptIds.some((receiptId, index) => receiptId !== canonicalReceiptIds[index])) blockers.push("receipt_order_not_canonical");
  if (new Set(receiptIds).size !== receiptIds.length) blockers.push("duplicate_receipt_id");
  if (metadataCanonical) {
    const expectedLedgerId = ledgerIdFor({
      requestedIdentity: ledger.requestedIdentity,
      surface: ledger.surface,
      depth: ledger.depth,
      generatedAt: ledger.generatedAt,
      receiptIds: canonicalReceiptIds,
    });
    if (ledger.ledgerId !== expectedLedgerId) blockers.push("ledger_id_mismatch");
  } else if (!/^p4645_[a-f0-9]{28}$/i.test(ledger.ledgerId)) {
    blockers.push("ledger_id_invalid");
  }
  let previousEntryHash: string | null = null;
  for (const [index, entry] of ledger.entries.entries()) {
    if (entry.schemaVersion !== "pass4645_provider_evidence_ledger_entry_v1") blockers.push(`entry_schema_invalid:${index + 1}`);
    if (entry.sequence !== index + 1) blockers.push(`sequence_mismatch:${index + 1}`);
    if (entry.previousEntryHash !== previousEntryHash) blockers.push(`chain_mismatch:${entry.sequence}`);
    if (entry.ledgerId !== ledger.ledgerId) blockers.push(`entry_ledger_id_mismatch:${entry.sequence}`);
    if (entry.requestedIdentity !== ledger.requestedIdentity) blockers.push(`entry_requested_identity_mismatch:${entry.sequence}`);
    if (entry.surface !== ledger.surface) blockers.push(`entry_surface_mismatch:${entry.sequence}`);
    if (entry.depth !== ledger.depth) blockers.push(`entry_depth_mismatch:${entry.sequence}`);
    if (entry.persistedAt !== ledger.generatedAt || !canonicalIso(entry.persistedAt)) blockers.push(`entry_persisted_at_mismatch:${entry.sequence}`);
    if (!canonicalIso(entry.retentionExpiresAt) || Date.parse(entry.retentionExpiresAt) <= Date.parse(entry.persistedAt)) blockers.push(`entry_retention_invalid:${entry.sequence}`);
    if (typeof entry.receiptId !== "string" || !entry.receiptId.trim()) blockers.push(`entry_receipt_id_missing:${entry.sequence}`);
    if (typeof entry.providerId !== "string" || !entry.providerId.trim()
      || typeof entry.providerFamily !== "string" || !entry.providerFamily.trim()) blockers.push(`entry_provider_identity_missing:${entry.sequence}`);
    if (!/^[a-f0-9]{64}$/i.test(entry.payloadHash)) blockers.push(`entry_payload_hash_invalid:${entry.sequence}`);
    if (!/^[a-f0-9]{64}$/i.test(entry.receiptCanonicalDigest)) blockers.push(`entry_receipt_digest_invalid:${entry.sequence}`);
    if (typeof entry.commercialEvidenceEligible !== "boolean") blockers.push(`entry_commercial_flag_invalid:${entry.sequence}`);
    if (!canonicalIso(entry.receivedAt)) blockers.push(`entry_received_at_invalid:${entry.sequence}`);
    if (entry.timestampProvenance === "provider" && !canonicalIso(entry.observedAt)) blockers.push(`entry_observed_at_invalid:${entry.sequence}`);
    if (!["provider", "transport_received", "missing", "invalid"].includes(entry.timestampProvenance)) blockers.push(`entry_timestamp_provenance_invalid:${entry.sequence}`);
    if (entry.commercialEvidenceEligible === true && entry.timestampProvenance !== "provider") blockers.push(`entry_commercial_provenance_invalid:${entry.sequence}`);
    if (entry.commercialEvidenceEligible === true && canonicalIso(entry.observedAt) && canonicalIso(entry.receivedAt)
      && Date.parse(entry.observedAt) > Date.parse(entry.receivedAt) + 120_000) blockers.push(`entry_commercial_timestamp_future:${entry.sequence}`);
    const { entryHash, signature, ...unsigned } = entry;
    const expectedHash = sha256(stableSerialize(unsigned));
    if (entryHash !== expectedHash) blockers.push(`entry_hash_mismatch:${entry.sequence}`);
    if (!/^[a-f0-9]{64}$/i.test(entryHash)) blockers.push(`entry_hash_invalid:${entry.sequence}`);
    if (signature !== null && !/^[a-f0-9]{64}$/i.test(signature)) blockers.push(`signature_format_invalid:${entry.sequence}`);
    if (verifiedSigningSecret && (!signature || !signatureMatches(entryHash, signature, verifiedSigningSecret))) blockers.push(`signature_mismatch:${entry.sequence}`);
    previousEntryHash = entry.entryHash;
  }
  if (ledger.receiptCount !== ledger.entries.length) blockers.push("receipt_count_mismatch");
  const expectedEligibleReceiptCount = ledger.entries.filter((entry) => entry.commercialEvidenceEligible === true).length;
  if (ledger.eligibleReceiptCount !== expectedEligibleReceiptCount) blockers.push("eligible_receipt_count_mismatch");
  if (ledger.headHash !== (ledger.entries.at(-1)?.entryHash ?? null)) blockers.push("head_hash_mismatch");
  const signaturesPresent = ledger.entries.filter((entry) => entry.signature !== null).length;
  const expectedSigned = ledger.entries.length > 0 && signaturesPresent === ledger.entries.length;
  if (ledger.signed !== expectedSigned) blockers.push("signed_flag_mismatch");
  if (signaturesPresent > 0 && signaturesPresent < ledger.entries.length) blockers.push("mixed_signature_state");
  if (expectedSigned && !verifiedSigningSecret && !suppliedSigningSecret) blockers.push("signature_verification_secret_missing");
  if (ledger.depth !== "basic" && !expectedSigned) blockers.push("premium_ledger_signature_required");
  return {
    valid: blockers.length === 0,
    chainValid: blockers.every((item) => !item.startsWith("chain_") && !item.startsWith("entry_hash_") && item !== "head_hash_mismatch"),
    signatureValid: blockers.every((item) => !item.startsWith("signature_")),
    premiumValid: blockers.length === 0 && ledger.depth !== "basic" && expectedSigned && Boolean(verifiedSigningSecret),
    blockers,
  };
}

export function verifyPass4645LedgerReadBackExact(args: {
  stored: unknown;
  expected: Pass4645ProviderEvidenceLedger;
  signingSecret?: string | null;
  blockerPrefix: "filesystem" | "supabase";
}) {
  const blockers: string[] = [];
  if (stableSerialize(args.stored) !== stableSerialize(args.expected)) {
    blockers.push(`${args.blockerPrefix}_payload_exact_mismatch`);
  }
  const verification = verifyPass4645ProviderEvidenceLedger(
    args.stored as Pass4645ProviderEvidenceLedger,
    args.signingSecret,
  );
  if (!verification.valid) {
    blockers.push(`${args.blockerPrefix}_payload_ledger_invalid:${verification.blockers.join("|")}`);
  }
  return { valid: blockers.length === 0, blockers } as const;
}

export function verifyPass4645SupabaseLedgerReadBack(args: {
  rows: Pass4645SupabaseLedgerRow[];
  expected: Pass4645ProviderEvidenceLedger;
  signingSecret?: string | null;
}) {
  const blockers: string[] = [];
  const rows = Array.isArray(args.rows) ? args.rows : [];
  if (!Array.isArray(args.rows)) blockers.push("supabase_rows_payload_invalid");
  if (rows.length !== 1) blockers.push(`supabase_row_count_mismatch:${rows.length}/1`);
  const row = rows[0];
  if (!row) return { valid: false, blockers } as const;
  if (row.ledger_id !== args.expected.ledgerId) blockers.push("supabase_ledger_id_mismatch");
  if (row.requested_identity !== args.expected.requestedIdentity) blockers.push("supabase_requested_identity_mismatch");
  if (row.surface !== args.expected.surface) blockers.push("supabase_surface_mismatch");
  if (row.depth !== args.expected.depth) blockers.push("supabase_depth_mismatch");
  if (row.head_hash !== args.expected.headHash) blockers.push("supabase_head_hash_mismatch");
  if (row.receipt_count !== args.expected.receiptCount) blockers.push("supabase_receipt_count_mismatch");
  if (row.eligible_receipt_count !== args.expected.eligibleReceiptCount) blockers.push("supabase_eligible_count_mismatch");
  if (row.signed !== args.expected.signed) blockers.push("supabase_signed_flag_mismatch");
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : null;
  if (!payload) blockers.push("supabase_payload_missing_or_invalid");
  if (payload) {
    blockers.push(...verifyPass4645LedgerReadBackExact({
      stored: payload,
      expected: args.expected,
      signingSecret: args.signingSecret,
      blockerPrefix: "supabase",
    }).blockers);
  }
  return { valid: blockers.length === 0, blockers } as const;
}

async function persistToFilesystem(ledger: Pass4645ProviderEvidenceLedger, directory: string, signingSecret?: string | null): Promise<Pass4645LedgerPersistence> {
  const verification = verifyPass4645ProviderEvidenceLedger(ledger, signingSecret);
  if (!verification.valid) {
    return { schemaVersion: "pass4645_provider_evidence_persistence_v1", durable: false, mode: "filesystem", ledgerId: ledger.ledgerId, headHash: ledger.headHash, recordCount: ledger.entries.length, readBackVerified: false, persistedAt: null, locator: null, blockers: verification.blockers };
  }
  try {
    const fileName = `${ledger.ledgerId}.json`;
    const boundary = {
      rootDirectory: directory,
      fileName,
      maximumBytes: 16 * 1024 * 1024,
      label: "provider-evidence-ledger",
    } as const;
    const writeReceipt = await writeDurableJsonAtomic(boundary, ledger);
    const stored = await readDurableJsonBounded<unknown>(boundary);
    const readBack = verifyPass4645LedgerReadBackExact({
      stored,
      expected: ledger,
      signingSecret,
      blockerPrefix: "filesystem",
    });
    return {
      schemaVersion: "pass4645_provider_evidence_persistence_v1",
      durable: readBack.valid && writeReceipt.readBackVerified,
      mode: "filesystem",
      ledgerId: ledger.ledgerId,
      headHash: ledger.headHash,
      recordCount: ledger.entries.length,
      readBackVerified: readBack.valid && writeReceipt.readBackVerified,
      persistedAt: readBack.valid ? new Date().toISOString() : null,
      locator: readBack.valid ? writeReceipt.filePath : null,
      blockers: readBack.blockers,
    };
  } catch {
    return { schemaVersion: "pass4645_provider_evidence_persistence_v1", durable: false, mode: "filesystem", ledgerId: ledger.ledgerId, headHash: ledger.headHash, recordCount: ledger.entries.length, readBackVerified: false, persistedAt: null, locator: null, blockers: ["filesystem_persistence_or_readback_failed"] };
  }
}

async function persistToSupabase(ledger: Pass4645ProviderEvidenceLedger, url: string, serviceRoleKey: string, signingSecret?: string | null): Promise<Pass4645LedgerPersistence> {
  const verification = verifyPass4645ProviderEvidenceLedger(ledger, signingSecret);
  if (!verification.valid) return { schemaVersion: "pass4645_provider_evidence_persistence_v1", durable: false, mode: "supabase", ledgerId: ledger.ledgerId, headHash: ledger.headHash, recordCount: ledger.entries.length, readBackVerified: false, persistedAt: null, locator: null, blockers: verification.blockers };
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/provider_evidence_ledgers`;
  const response = await brokeredConfiguredOriginFetch(endpoint, {
    method: "POST",
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json", prefer: "return=representation" },
    body: JSON.stringify({ ledger_id: ledger.ledgerId, requested_identity: ledger.requestedIdentity, surface: ledger.surface, depth: ledger.depth, head_hash: ledger.headHash, receipt_count: ledger.receiptCount, eligible_receipt_count: ledger.eligibleReceiptCount, signed: ledger.signed, payload: ledger }),
    cache: "no-store",
  }, { configuredProfile: "supabase", operation: "provider_evidence_ledger_write", timeoutMs: 5_000 });
  if (!response.ok) return { schemaVersion: "pass4645_provider_evidence_persistence_v1", durable: false, mode: "supabase", ledgerId: ledger.ledgerId, headHash: ledger.headHash, recordCount: ledger.entries.length, readBackVerified: false, persistedAt: null, locator: null, blockers: [`supabase_http_${response.status}`] };
  const insertedRows = await readJsonResponseBounded<Pass4645SupabaseLedgerRow[]>(response, 2_000_000).catch(() => []);
  const insertedVerification = verifyPass4645SupabaseLedgerReadBack({ rows: insertedRows, expected: ledger, signingSecret });
  if (!insertedVerification.valid) {
    return { schemaVersion: "pass4645_provider_evidence_persistence_v1", durable: false, mode: "supabase", ledgerId: ledger.ledgerId, headHash: ledger.headHash, recordCount: ledger.entries.length, readBackVerified: false, persistedAt: null, locator: null, blockers: insertedVerification.blockers };
  }
  const readBackUrl = `${endpoint}?ledger_id=eq.${encodeURIComponent(ledger.ledgerId)}&select=ledger_id,requested_identity,surface,depth,head_hash,receipt_count,eligible_receipt_count,signed,payload`;
  const readBackResponse = await brokeredConfiguredOriginFetch(readBackUrl, {
    method: "GET",
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, accept: "application/json" },
    cache: "no-store",
  }, { configuredProfile: "supabase", operation: "provider_evidence_ledger_readback", timeoutMs: 5_000 });
  if (!readBackResponse.ok) return { schemaVersion: "pass4645_provider_evidence_persistence_v1", durable: false, mode: "supabase", ledgerId: ledger.ledgerId, headHash: ledger.headHash, recordCount: ledger.entries.length, readBackVerified: false, persistedAt: null, locator: null, blockers: [`supabase_readback_http_${readBackResponse.status}`] };
  const storedRows = await readJsonResponseBounded<Pass4645SupabaseLedgerRow[]>(readBackResponse, 2_000_000).catch(() => []);
  const storedVerification = verifyPass4645SupabaseLedgerReadBack({ rows: storedRows, expected: ledger, signingSecret });
  const readBackVerified = storedVerification.valid;
  return { schemaVersion: "pass4645_provider_evidence_persistence_v1", durable: readBackVerified, mode: "supabase", ledgerId: ledger.ledgerId, headHash: ledger.headHash, recordCount: ledger.entries.length, readBackVerified, persistedAt: readBackVerified ? new Date().toISOString() : null, locator: readBackVerified ? `supabase:provider_evidence_ledgers:${ledger.ledgerId}` : null, blockers: storedVerification.blockers };
}

export async function persistPass4645ProviderEvidenceLedger(ledger: Pass4645ProviderEvidenceLedger): Promise<Pass4645LedgerPersistence> {
  const signingSecret = process.env.VELMERE_PROVIDER_RECEIPT_SIGNING_SECRET?.trim() || null;
  const directory = process.env.VELMERE_PROVIDER_RECEIPT_STORE_DIR?.trim();
  if (directory) return persistToFilesystem(ledger, directory, signingSecret);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (supabaseUrl && serviceRoleKey) return persistToSupabase(ledger, supabaseUrl, serviceRoleKey, signingSecret);
  return { schemaVersion: "pass4645_provider_evidence_persistence_v1", durable: false, mode: "not_configured", ledgerId: ledger.ledgerId, headHash: ledger.headHash, recordCount: ledger.entries.length, readBackVerified: false, persistedAt: null, locator: null, blockers: ["durable_provider_receipt_store_not_configured"] };
}
