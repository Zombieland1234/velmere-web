import { runBoundExternalCommand, type ExternalCommandBoundary } from "@/lib/security/external-command-boundary";
import type { CommercialCohortTransparencyLeaf } from "@/lib/worldclass/commercial-cohort-transparency-publication";

export const PASS4812_TRANSPARENCY_PUBLISH_REQUEST_SCHEMA = "velmere.transparency-publish-request.v1" as const;
export const PASS4812_TRANSPARENCY_PUBLISH_RESPONSE_SCHEMA = "velmere.transparency-publish-response.v1" as const;

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,191}$/;
const MAX_OUTPUT_BYTES = 128 * 1024;

export type CommercialCohortTransparencyPublisherProvider =
  | "cloud-storage-worm"
  | "rekor-compatible"
  | "github-pages-append-only"
  | "custom-append-only"
  | "test-only";

export type CommercialCohortTransparencyPublishRequest = {
  schemaVersion: typeof PASS4812_TRANSPARENCY_PUBLISH_REQUEST_SCHEMA;
  environment: "staging" | "production";
  audience: string;
  sinkId: string;
  expectedPublicBaseUrl: string;
  leaf: CommercialCohortTransparencyLeaf;
};

export type CommercialCohortTransparencyPublishResponse = {
  schemaVersion: typeof PASS4812_TRANSPARENCY_PUBLISH_RESPONSE_SCHEMA;
  sinkId: string;
  provider: CommercialCohortTransparencyPublisherProvider;
  publicUrl: string;
  leafDigest: string;
  publishedAt: string;
  logIndex: string;
  immutableObjectVersion: string;
  publisherReceiptDigest: string;
};

export type CommercialCohortTransparencyPublisherCommand = ExternalCommandBoundary & {
  provider: CommercialCohortTransparencyPublisherProvider;
  timeoutMs?: number;
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

function publicUrl(value: unknown): URL {
  let url: URL;
  try { url = new URL(clean(value, 1024)); } catch { throw new Error("transparency_publisher_url_invalid"); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || !host || url.username || url.password || url.hash || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("transparency_publisher_url_invalid");
  }
  return url;
}

export function invokeCommercialCohortTransparencyPublisher(args: {
  request: CommercialCohortTransparencyPublishRequest;
  publisher: CommercialCohortTransparencyPublisherCommand;
}): CommercialCohortTransparencyPublishResponse {
  if (args.request.schemaVersion !== PASS4812_TRANSPARENCY_PUBLISH_REQUEST_SCHEMA) throw new Error("transparency_publisher_request_schema_invalid");
  if (args.request.environment === "production" && args.publisher.provider === "test-only") throw new Error("transparency_publisher_test_provider_forbidden_in_production");
  const expectedBase = publicUrl(args.request.expectedPublicBaseUrl);
  const timeout = Number(args.publisher.timeoutMs ?? 30_000);
  if (!Number.isFinite(timeout) || timeout < 1_000 || timeout > 120_000) throw new Error("transparency_publisher_timeout_invalid");
  const result = runBoundExternalCommand({
    boundary: args.publisher,
    input: `${JSON.stringify(args.request)}\n`,
    timeoutMs: timeout,
    maxOutputBytes: MAX_OUTPUT_BYTES,
    errorPrefix: "transparency_publisher",
  });
  let response: CommercialCohortTransparencyPublishResponse;
  try { response = JSON.parse(clean(result.stdout, MAX_OUTPUT_BYTES)) as CommercialCohortTransparencyPublishResponse; }
  catch { throw new Error("transparency_publisher_response_json_invalid"); }
  if (response.schemaVersion !== PASS4812_TRANSPARENCY_PUBLISH_RESPONSE_SCHEMA) throw new Error("transparency_publisher_response_schema_invalid");
  if (requiredId(response.sinkId, "transparency_publisher_sink_invalid") !== args.request.sinkId) throw new Error("transparency_publisher_sink_mismatch");
  if (response.provider !== args.publisher.provider) throw new Error("transparency_publisher_provider_mismatch");
  if (args.request.environment === "production" && response.provider === "test-only") throw new Error("transparency_publisher_test_provider_forbidden_in_production");
  if (requiredDigest(response.leafDigest, "transparency_publisher_leaf_digest_invalid") !== args.request.leaf.leafDigest) throw new Error("transparency_publisher_leaf_digest_mismatch");
  if (new Date(response.publishedAt).toISOString() !== new Date(args.request.leaf.publishedAt).toISOString()) throw new Error("transparency_publisher_time_mismatch");
  if (requiredId(response.logIndex, "transparency_publisher_log_index_invalid") !== args.request.leaf.logIndex) throw new Error("transparency_publisher_log_index_mismatch");
  requiredId(response.immutableObjectVersion, "transparency_publisher_object_version_invalid");
  requiredDigest(response.publisherReceiptDigest, "transparency_publisher_receipt_digest_invalid");
  const published = publicUrl(response.publicUrl);
  if (published.origin !== expectedBase.origin || !published.pathname.startsWith(expectedBase.pathname.endsWith("/") ? expectedBase.pathname : `${expectedBase.pathname}/`)) {
    throw new Error("transparency_publisher_public_url_outside_base");
  }
  return { ...response, publicUrl: published.toString() };
}
