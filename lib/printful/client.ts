import { createHash } from "node:crypto";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import {
  readJsonResponseBounded,
  readResponseBytesBounded,
  VelmereResponseBodyDeadlineError,
  VelmereResponseBodyError,
} from "@/lib/network/fetch-with-deadline";
import { VelmereEgressPolicyError } from "@/lib/network/safe-egress";

const PRINTFUL_API_BASE = "https://api.printful.com";
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RESPONSE_BYTES = 262_144;
const MAX_SAFE_READ_ATTEMPTS = 3;

export type PrintfulFailureCode =
  | "missing_configuration"
  | "not_found"
  | "authentication_rejected"
  | "request_rejected"
  | "rate_limited"
  | "provider_unavailable"
  | "deadline_exceeded"
  | "network_failure"
  | "response_too_large"
  | "response_invalid_json"
  | "response_content_type"
  | "unexpected_failure";

export type PrintfulFailureClassification = {
  code: PrintfulFailureCode;
  status?: number;
  retryable: boolean;
  ambiguous: boolean;
  severity: "warning" | "error" | "critical";
  operatorAction: "retry_with_backoff" | "check_provider_credentials" | "manual_review" | "stop_not_found";
  retryAfterMs?: number;
  responseFingerprint?: string;
};

export class PrintfulRequestError extends Error {
  readonly name = "PrintfulRequestError";

  constructor(
    public readonly classification: PrintfulFailureClassification,
    public readonly attempts: number,
  ) {
    super(`Printful request failed: ${classification.code}${classification.status ? ` (${classification.status})` : ""}`);
  }

  get status() {
    return this.classification.status ?? 0;
  }

  get code() {
    return this.classification.code;
  }

  get retryable() {
    return this.classification.retryable;
  }

  get ambiguous() {
    return this.classification.ambiguous;
  }
}

export type PrintfulRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  revalidate?: number;
  timeoutMs?: number;
  maxResponseBytes?: number;
  operation?: string;
  retryMode?: "safe_read" | "single_attempt";
};

type NextFetchInit = RequestInit & {
  next?: {
    revalidate: number;
  };
};

function boundedInt(value: number | undefined, fallback: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.max(min, Math.min(Math.trunc(value as number), max)) : fallback;
}

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function parseRetryAfter(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.trunc(seconds * 1000), 10_000);
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return undefined;
  return Math.max(0, Math.min(at - Date.now(), 10_000));
}

function classifyHttpFailure(status: number, method: "GET" | "POST", retryAfterMs?: number, responseFingerprint?: string): PrintfulFailureClassification {
  if (status === 404) {
    return { code: "not_found", status, retryable: false, ambiguous: false, severity: "warning", operatorAction: "stop_not_found", responseFingerprint };
  }
  if (status === 401 || status === 403) {
    return { code: "authentication_rejected", status, retryable: false, ambiguous: false, severity: "critical", operatorAction: "check_provider_credentials", responseFingerprint };
  }
  if (status === 429) {
    return { code: "rate_limited", status, retryable: true, ambiguous: false, severity: "warning", operatorAction: "retry_with_backoff", retryAfterMs, responseFingerprint };
  }
  if (status >= 500) {
    return { code: "provider_unavailable", status, retryable: true, ambiguous: method === "POST", severity: "error", operatorAction: "retry_with_backoff", retryAfterMs, responseFingerprint };
  }
  return { code: "request_rejected", status, retryable: false, ambiguous: false, severity: "error", operatorAction: "manual_review", responseFingerprint };
}

function classifyThrownFailure(error: unknown, method: "GET" | "POST"): PrintfulFailureClassification {
  if (error instanceof PrintfulRequestError) return error.classification;
  if (error instanceof VelmereEgressPolicyError) {
    if (error.code === "egress_timeout") {
      return { code: "deadline_exceeded", retryable: true, ambiguous: method === "POST", severity: "error", operatorAction: "retry_with_backoff" };
    }
    if (error.code === "egress_response_too_large") {
      return { code: "response_too_large", retryable: false, ambiguous: method === "POST", severity: "error", operatorAction: "manual_review" };
    }
    if (error.code === "egress_dns_failed") {
      return { code: "network_failure", retryable: true, ambiguous: method === "POST", severity: "error", operatorAction: "retry_with_backoff" };
    }
    return { code: "unexpected_failure", retryable: false, ambiguous: method === "POST", severity: "critical", operatorAction: "manual_review" };
  }
  if (error instanceof VelmereResponseBodyDeadlineError) {
    return { code: "deadline_exceeded", status: error.status, retryable: true, ambiguous: method === "POST", severity: "error", operatorAction: "retry_with_backoff" };
  }
  if (error instanceof VelmereResponseBodyError) {
    return {
      code: error.code,
      status: error.status,
      retryable: false,
      ambiguous: method === "POST",
      severity: "error",
      operatorAction: "manual_review",
    };
  }
  if (error instanceof Error && /missing printful_api_token/i.test(error.message)) {
    return { code: "missing_configuration", retryable: false, ambiguous: false, severity: "critical", operatorAction: "check_provider_credentials" };
  }
  if (error instanceof TypeError || (error instanceof Error && /fetch|network|socket|econn|enotfound|reset/i.test(error.message))) {
    return { code: "network_failure", retryable: true, ambiguous: method === "POST", severity: "error", operatorAction: "retry_with_backoff" };
  }
  return { code: "unexpected_failure", retryable: false, ambiguous: method === "POST", severity: "error", operatorAction: "manual_review" };
}

export function classifyPrintfulFailure(error: unknown): PrintfulFailureClassification {
  if (error instanceof PrintfulRequestError) return error.classification;
  return classifyThrownFailure(error, "POST");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(ms, 2_000))));
}

export function isPrintfulConfigured() {
  return Boolean(process.env.PRINTFUL_API_TOKEN);
}

export async function printfulRequest<T>(path: string, options: PrintfulRequestOptions = {}) {
  const token = process.env.PRINTFUL_API_TOKEN;
  if (!token) {
    throw new PrintfulRequestError(
      { code: "missing_configuration", retryable: false, ambiguous: false, severity: "critical", operatorAction: "check_provider_credentials" },
      0,
    );
  }

  const method = options.method ?? "GET";
  const retryMode = options.retryMode ?? (method === "GET" ? "safe_read" : "single_attempt");
  const maxAttempts = retryMode === "safe_read" ? MAX_SAFE_READ_ATTEMPTS : 1;
  const timeoutMs = boundedInt(options.timeoutMs, DEFAULT_TIMEOUT_MS, 500, 20_000);
  const maxResponseBytes = boundedInt(options.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES, 4_096, 1_048_576);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  if (process.env.PRINTFUL_STORE_ID) headers["X-PF-Store-Id"] = process.env.PRINTFUL_STORE_ID;

  const init: NextFetchInit = {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  };
  if (method === "GET") init.next = { revalidate: options.revalidate ?? 3600 };
  else init.cache = "no-store";

  let lastError: PrintfulRequestError | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await brokeredEgressFetch(`${PRINTFUL_API_BASE}${path}`, init, {
        profile: "printful",
        timeoutMs,
        maxRequestBytes: method === "POST" ? 4_194_304 : 0,
        maxResponseBytes,
        operation: options.operation ?? `printful_${method.toLowerCase()}`,
      });

      if (!response.ok) {
        const bytes = await readResponseBytesBounded(response, Math.min(maxResponseBytes, 32_768));
        const preview = new TextDecoder().decode(bytes).slice(0, 2_048);
        const classification = classifyHttpFailure(
          response.status,
          method,
          parseRetryAfter(response.headers.get("retry-after")),
          preview ? fingerprint(preview) : undefined,
        );
        const typed = new PrintfulRequestError(classification, attempt);
        if (attempt < maxAttempts && classification.retryable) {
          await delay(classification.retryAfterMs ?? 150 * 2 ** (attempt - 1));
          continue;
        }
        throw typed;
      }

      try {
        return await readJsonResponseBounded<T>(response, maxResponseBytes);
      } catch (error) {
        throw new PrintfulRequestError(classifyThrownFailure(error, method), attempt);
      }
    } catch (error) {
      const typed = error instanceof PrintfulRequestError
        ? error
        : new PrintfulRequestError(classifyThrownFailure(error, method), attempt);
      lastError = typed;
      if (attempt < maxAttempts && typed.retryable) {
        await delay(typed.classification.retryAfterMs ?? 150 * 2 ** (attempt - 1));
        continue;
      }
      throw typed;
    }
  }

  throw lastError ?? new PrintfulRequestError(
    { code: "unexpected_failure", retryable: false, ambiguous: method === "POST", severity: "error", operatorAction: "manual_review" },
    maxAttempts,
  );
}
