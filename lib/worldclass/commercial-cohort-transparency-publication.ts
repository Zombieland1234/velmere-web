import { isIP } from "node:net";
import { readTextResponseBounded } from "@/lib/network/fetch-with-deadline";
import { isPublicNetworkAddress, safeEgressFetch } from "@/lib/network/safe-egress";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  commercialCohortCheckpointCoreDigest,
  commercialCohortReleaseSignatureRoot,
  type CommercialCohortExternalWitness,
  type CommercialCohortPublicCheckpoint,
} from "@/lib/worldclass/commercial-cohort-public-checkpoint";

export const PASS4812_TRANSPARENCY_PUBLICATION_POLICY_ID = "pass4812-independent-transparency-publication-v1" as const;
export const PASS4812_TRANSPARENCY_LEAF_SCHEMA = "velmere.commercial-cohort-transparency-leaf.v1" as const;

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,191}$/;
const MAX_PUBLICATION_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 8_000;
const CLOCK_SKEW_MS = 60_000;

export type CommercialCohortTransparencyLeaf = {
  schemaVersion: typeof PASS4812_TRANSPARENCY_LEAF_SCHEMA;
  policyVersion: typeof PASS4812_TRANSPARENCY_PUBLICATION_POLICY_ID;
  environment: "staging" | "production";
  audience: string;
  sequence: number;
  sinkId: string;
  logIndex: string;
  previousEntryDigest: string | null;
  checkpointCoreDigest: string;
  releaseSignatureRoot: string;
  publishedAt: string;
  leafDigest: string;
};

export type CommercialCohortTransparencyPublicationVerification = {
  verified: boolean;
  sinkId: string | null;
  publicUrl: string | null;
  leafDigest: string | null;
  blockers: string[];
};

function clean(value: unknown, max = 4096): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function requiredId(value: unknown, code: string): string {
  const text = clean(value, 192);
  if (!SAFE_ID.test(text)) throw new Error(code);
  return text;
}

function requiredDigest(value: unknown, code: string): string {
  const text = clean(value, 80).toLowerCase();
  if (!DIGEST.test(text)) throw new Error(code);
  return text;
}

function parseDate(value: unknown, code: string): Date {
  const text = clean(value, 64);
  const date = new Date(text);
  if (!text || !Number.isFinite(date.getTime())) throw new Error(code);
  return date;
}

function leafCore(leaf: Omit<CommercialCohortTransparencyLeaf, "leafDigest">) {
  return leaf;
}

function checkpointCore(checkpoint: CommercialCohortPublicCheckpoint) {
  const {
    releaseSignatures: _releaseSignatures,
    externalWitnesses: _externalWitnesses,
    checkpointDigest: _checkpointDigest,
    ...core
  } = checkpoint;
  return core;
}

function hostIsPublicLiteral(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  const kind = isIP(host);
  return kind === 0 || isPublicNetworkAddress(host);
}

function normalizePublicUrl(value: unknown): URL {
  let url: URL;
  try {
    url = new URL(clean(value, 1024));
  } catch {
    throw new Error("transparency_publication_url_invalid");
  }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.port || url.hash || !hostIsPublicLiteral(url.hostname)) {
    throw new Error("transparency_publication_url_invalid");
  }
  return url;
}

function transparencyWitnessAllowedHosts() {
  return (process.env.VELMERE_TRANSPARENCY_WITNESS_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
}

async function fetchPinnedHttpsJson(url: URL, timeoutMs: number): Promise<string> {
  const allowedHosts = transparencyWitnessAllowedHosts();
  if (!allowedHosts.length) throw new Error("transparency_publication_allowlist_missing");
  const response = await safeEgressFetch(url, {
    headers: { accept: "application/json", "user-agent": "Velmere-PASS4812-Transparency-Verifier/1" },
  }, {
    allowedHosts,
    allowSubdomains: false,
    allowedMethods: ["GET"],
    maxRedirects: 0,
    timeoutMs,
    maxResponseBytes: MAX_PUBLICATION_BYTES,
    operation: "commercial_cohort_transparency_verification",
  });
  if (!response.ok) throw new Error(`transparency_publication_http_status:${response.status}`);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) throw new Error("transparency_publication_content_type_invalid");
  return readTextResponseBounded(response, MAX_PUBLICATION_BYTES);
}

export function buildCommercialCohortTransparencyLeaf(args: {
  checkpoint: Pick<CommercialCohortPublicCheckpoint, "environment" | "audience" | "sequence" | "issuedAt" | "expiresAt" | "releaseSignatures"> &
    Omit<CommercialCohortPublicCheckpoint, "externalWitnesses" | "checkpointDigest">;
  sinkId: string;
  logIndex: string;
  previousEntryDigest?: string | null;
  publishedAt: Date;
}): CommercialCohortTransparencyLeaf {
  const checkpoint = args.checkpoint as CommercialCohortPublicCheckpoint;
  const issuedAt = parseDate(checkpoint.issuedAt, "transparency_checkpoint_issued_at_invalid");
  const expiresAt = parseDate(checkpoint.expiresAt, "transparency_checkpoint_expires_at_invalid");
  if (args.publishedAt.getTime() < issuedAt.getTime() || args.publishedAt.getTime() > expiresAt.getTime()) {
    throw new Error("transparency_publication_time_outside_checkpoint");
  }
  const core = {
    schemaVersion: PASS4812_TRANSPARENCY_LEAF_SCHEMA,
    policyVersion: PASS4812_TRANSPARENCY_PUBLICATION_POLICY_ID,
    environment: checkpoint.environment,
    audience: requiredId(checkpoint.audience, "transparency_audience_invalid"),
    sequence: checkpoint.sequence,
    sinkId: requiredId(args.sinkId, "transparency_sink_id_invalid"),
    logIndex: requiredId(args.logIndex, "transparency_log_index_invalid"),
    previousEntryDigest: args.previousEntryDigest == null ? null : requiredDigest(args.previousEntryDigest, "transparency_previous_entry_digest_invalid"),
    checkpointCoreDigest: commercialCohortCheckpointCoreDigest(checkpointCore(checkpoint)),
    releaseSignatureRoot: commercialCohortReleaseSignatureRoot(checkpoint.releaseSignatures),
    publishedAt: args.publishedAt.toISOString(),
  } as const;
  return { ...core, leafDigest: sha256Digest(canonicalJson(leafCore(core))) };
}

export function verifyCommercialCohortTransparencyLeaf(args: {
  checkpoint: CommercialCohortPublicCheckpoint;
  witness: CommercialCohortExternalWitness;
  leaf: CommercialCohortTransparencyLeaf;
  now?: Date;
}): CommercialCohortTransparencyPublicationVerification {
  const blockers: string[] = [];
  let sinkId: string | null = null;
  let leafDigest: string | null = null;
  let publicUrl: string | null = null;
  try {
    const leaf = args.leaf;
    if (leaf.schemaVersion !== PASS4812_TRANSPARENCY_LEAF_SCHEMA || leaf.policyVersion !== PASS4812_TRANSPARENCY_PUBLICATION_POLICY_ID) {
      throw new Error("transparency_leaf_schema_invalid");
    }
    sinkId = requiredId(leaf.sinkId, "transparency_leaf_sink_invalid");
    if (sinkId !== requiredId(args.witness.sinkId, "transparency_witness_sink_invalid")) blockers.push("transparency_leaf_sink_mismatch");
    if (leaf.environment !== args.checkpoint.environment || leaf.audience !== args.checkpoint.audience || leaf.sequence !== args.checkpoint.sequence) {
      blockers.push("transparency_leaf_checkpoint_identity_mismatch");
    }
    if (leaf.logIndex !== args.witness.logIndex) blockers.push("transparency_leaf_log_index_mismatch");
    const publishedAt = parseDate(leaf.publishedAt, "transparency_leaf_published_at_invalid");
    if (publishedAt.toISOString() !== new Date(args.witness.publishedAt).toISOString()) blockers.push("transparency_leaf_published_at_mismatch");
    const now = args.now ?? new Date();
    if (publishedAt.getTime() > now.getTime() + CLOCK_SKEW_MS) blockers.push("transparency_leaf_published_in_future");
    const expectedCoreDigest = commercialCohortCheckpointCoreDigest(checkpointCore(args.checkpoint));
    const expectedReleaseRoot = commercialCohortReleaseSignatureRoot(args.checkpoint.releaseSignatures);
    if (requiredDigest(leaf.checkpointCoreDigest, "transparency_leaf_core_digest_invalid") !== expectedCoreDigest) blockers.push("transparency_leaf_core_digest_mismatch");
    if (requiredDigest(leaf.releaseSignatureRoot, "transparency_leaf_release_root_invalid") !== expectedReleaseRoot) blockers.push("transparency_leaf_release_root_mismatch");
    const { leafDigest: _leafDigest, ...core } = leaf;
    leafDigest = sha256Digest(canonicalJson(leafCore(core)));
    if (requiredDigest(leaf.leafDigest, "transparency_leaf_digest_invalid") !== leafDigest) blockers.push("transparency_leaf_digest_mismatch");
    if (leafDigest !== requiredDigest(args.witness.receiptDigest, "transparency_witness_receipt_digest_invalid")) blockers.push("transparency_leaf_witness_receipt_mismatch");
    publicUrl = normalizePublicUrl(args.witness.publicUrl).toString();
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "transparency_leaf_verification_failed");
  }
  const uniqueBlockers = Array.from(new Set(blockers.filter(Boolean))).sort();
  return { verified: uniqueBlockers.length === 0, sinkId, publicUrl, leafDigest, blockers: uniqueBlockers };
}

export async function fetchAndVerifyCommercialCohortTransparencyLeaf(args: {
  checkpoint: CommercialCohortPublicCheckpoint;
  witness: CommercialCohortExternalWitness;
  timeoutMs?: number;
  now?: Date;
}): Promise<CommercialCohortTransparencyPublicationVerification> {
  const blockers: string[] = [];
  let leaf: CommercialCohortTransparencyLeaf | null = null;
  let url: URL | null = null;
  try {
    url = normalizePublicUrl(args.witness.publicUrl);
    const timeoutMs = Number(args.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) throw new Error("transparency_publication_timeout_invalid");
    const text = await fetchPinnedHttpsJson(url, timeoutMs);
    leaf = JSON.parse(text) as CommercialCohortTransparencyLeaf;
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "transparency_publication_fetch_failed");
  }
  if (!leaf) {
    return { verified: false, sinkId: args.witness.sinkId ?? null, publicUrl: url?.toString() ?? null, leafDigest: null, blockers: Array.from(new Set(blockers)).sort() };
  }
  const verification = verifyCommercialCohortTransparencyLeaf({ checkpoint: args.checkpoint, witness: args.witness, leaf, now: args.now });
  return { ...verification, blockers: Array.from(new Set([...blockers, ...verification.blockers])).sort(), verified: blockers.length === 0 && verification.verified };
}
