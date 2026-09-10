import { ASCII_CONTROL_PATTERN } from "../security/ascii-control-characters";
import { parseStrictJsonBytes } from "../security/strict-json-boundary";

export const VELMERE_FETCH_TIMEOUTS = {
  provider: 8_000,
  storage: 5_000,
  media: 7_000,
  probe: 10_000,
} as const;

export class VelmereFetchDeadlineError extends Error {
  readonly code = "fetch_deadline_exceeded";
  readonly timeoutMs: number;
  readonly operation: string;

  constructor(operation: string, timeoutMs: number) {
    super(`${operation} exceeded ${timeoutMs}ms`);
    this.name = "VelmereFetchDeadlineError";
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

export class VelmereResponseBodyError extends Error {
  readonly code: "response_too_large" | "response_invalid_json" | "response_content_type";
  readonly status: number;

  constructor(code: VelmereResponseBodyError["code"], status: number, message: string) {
    super(message);
    this.name = "VelmereResponseBodyError";
    this.code = code;
    this.status = status;
  }
}

export class VelmereResponseBodyDeadlineError extends Error {
  readonly code = "response_body_deadline_exceeded";
  readonly status: number;
  readonly timeoutMs: number;
  readonly operation: string;

  constructor(status: number, operation: string, timeoutMs: number) {
    super(`${operation} response body exceeded ${timeoutMs}ms`);
    this.name = "VelmereResponseBodyDeadlineError";
    this.status = status;
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

export type VelmereResponseReadOptions = {
  timeoutMs?: number;
  operation?: string;
  jsonMaxDepth?: number;
  jsonMaxNodes?: number;
};

export type VelmereFetchRequestInit = RequestInit & {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
};

export function isSafeSameOriginRelativeRequest(input: RequestInfo | URL) {
  if (typeof input !== "string") return false;
  return input.startsWith("/")
    && !input.startsWith("//")
    && !input.includes("\\")
    && !ASCII_CONTROL_PATTERN.test(input);
}

export async function fetchSameOriginWithDeadline(
  input: RequestInfo | URL,
  init: VelmereFetchRequestInit = {},
  options: { timeoutMs?: number; operation?: string } = {},
) {
  if (!isSafeSameOriginRelativeRequest(input)) {
    throw new TypeError("same_origin_relative_request_required");
  }
  if (init.redirect && init.redirect !== "error") {
    throw new TypeError("same_origin_redirect_policy_must_be_error");
  }
  return fetchWithDeadline(input, { ...init, redirect: "error" }, {
    ...options,
    operation: options.operation?.trim() || "same_origin_fetch",
  });
}

export async function fetchWithDeadline(
  input: RequestInfo | URL,
  init: VelmereFetchRequestInit = {},
  options: { timeoutMs?: number; operation?: string } = {},
) {
  const timeoutMs = Math.max(250, Math.min(options.timeoutMs ?? VELMERE_FETCH_TIMEOUTS.provider, 60_000));
  const operation = options.operation?.trim() || "external_fetch";
  const controller = new AbortController();
  const externalSignal = init.signal ?? null;
  let deadlineReached = false;

  const abortFromExternal = () => controller.abort(externalSignal?.reason ?? new DOMException("Aborted", "AbortError"));
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

  const timer = globalThis.setTimeout(() => {
    deadlineReached = true;
    controller.abort(new DOMException(`${operation} timed out`, "TimeoutError"));
  }, timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (deadlineReached && !externalSignal?.aborted) throw new VelmereFetchDeadlineError(operation, timeoutMs);
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

function declaredLength(response: Response) {
  const value = Number(response.headers.get("content-length") ?? "");
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function readResponseBytesBounded(
  response: Response,
  maxBytes: number,
  options: VelmereResponseReadOptions = {},
) {
  const limit = Math.max(1_024, Math.min(maxBytes, 16_777_216));
  const declared = declaredLength(response);
  if (declared !== null && declared > limit) {
    throw new VelmereResponseBodyError("response_too_large", response.status, `Response exceeds ${limit} bytes`);
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const timeoutMs = Math.max(250, Math.min(options.timeoutMs ?? 30_000, 60_000));
  const operation = options.operation?.trim() || "response_body_read";
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = globalThis.setTimeout(() => {
      reject(new VelmereResponseBodyDeadlineError(response.status, operation, timeoutMs));
      void reader.cancel("response_body_deadline_exceeded").catch(() => undefined);
    }, timeoutMs);
  });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel("response_too_large").catch(() => undefined);
        throw new VelmereResponseBodyError("response_too_large", response.status, `Response exceeds ${limit} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    if (timer !== undefined) globalThis.clearTimeout(timer);
    try {
      reader.releaseLock();
    } catch {
      // A timed-out pending read owns the lock until cancellation settles.
    }
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function readBlobResponseBounded(response: Response, maxBytes = 8_388_608, options: VelmereResponseReadOptions = {}): Promise<Blob> {
  const bytes = await readResponseBytesBounded(response, maxBytes, options);
  const type = response.headers.get("content-type")?.split(";", 1)[0]?.trim() || "application/octet-stream";
  return new Blob([bytes], { type });
}

export async function readTextResponseBounded(response: Response, maxBytes = 1_048_576, options: VelmereResponseReadOptions = {}): Promise<string> {
  const bytes = await readResponseBytesBounded(response, maxBytes, options);
  return new TextDecoder().decode(bytes);
}

export async function readJsonResponseBounded<T>(response: Response, maxBytes = 1_048_576, options: VelmereResponseReadOptions = {}): Promise<T> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!/(^|[;/\s])application\/(?:[a-z0-9.+-]+\+)?json(?:[;\s]|$)/i.test(contentType)) {
    throw new VelmereResponseBodyError("response_content_type", response.status, "Expected a JSON response");
  }
  const bytes = await readResponseBytesBounded(response, maxBytes, options);
  try {
    const requestedMaxDepth = Number(options.jsonMaxDepth);
    const requestedMaxNodes = Number(options.jsonMaxNodes);
    return parseStrictJsonBytes<T>(bytes, {
      maxBytes: Math.max(1_024, Math.min(maxBytes, 16_777_216)),
      maxDepth: Number.isSafeInteger(requestedMaxDepth)
        ? Math.max(8, Math.min(requestedMaxDepth, 128))
        : 64,
      maxNodes: Number.isSafeInteger(requestedMaxNodes)
        ? Math.max(1_000, Math.min(requestedMaxNodes, 1_000_000))
        : 150_000,
    });
  } catch {
    throw new VelmereResponseBodyError("response_invalid_json", response.status, "Response declared JSON but could not be parsed");
  }
}
