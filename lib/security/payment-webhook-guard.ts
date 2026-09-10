import { NextResponse } from "next/server";

export type PaymentGuardDecision =
  | { ok: true }
  | { ok: false; response: NextResponse };

function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

function contentLength(request: Request) {
  const value = request.headers.get("content-length");
  if (!value) return { present: false, valid: true, value: 0 } as const;
  if (!/^(?:0|[1-9]\d*)$/u.test(value)) {
    return { present: true, valid: false, value: 0 } as const;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return { present: true, valid: false, value: 0 } as const;
  }
  return { present: true, valid: true, value: parsed } as const;
}

function hasAmbiguousTransferFraming(request: Request) {
  return ["transfer-encoding", "content-transfer-encoding", "te"]
    .some((name) => Boolean(request.headers.get(name)?.trim()));
}

function containsAsciiControl(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
}

function isStrictJsonContentType(value: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw || raw.length > 96 || containsAsciiControl(raw) || raw.includes(",")) return false;
  if (raw === "application/json") return true;
  return /^application\/json\s*;\s*charset\s*=\s*"?utf-8"?$/u.test(raw);
}

function strictFormMediaType(value: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > 240 || containsAsciiControl(raw) || raw.includes(",")) return null;
  if (raw.toLowerCase() === "application/x-www-form-urlencoded") return "urlencoded" as const;
  if ((raw.match(/\bboundary\s*=/giu)?.length ?? 0) !== 1) return null;
  const match = raw.match(
    /^multipart\/form-data\s*;\s*boundary\s*=\s*(?:"([0-9A-Za-z'()+_./:=?-]+)"|([0-9A-Za-z'()+_./:=?-]+))\s*$/iu,
  );
  const boundary = match?.[1] ?? match?.[2] ?? "";
  if (!boundary || boundary.length > 70) return null;
  return "multipart" as const;
}

export function validateCheckoutRequestBoundary(request: Request): PaymentGuardDecision {
  const length = contentLength(request);

  if (!length.valid || hasAmbiguousTransferFraming(request)) {
    return { ok: false, response: jsonError("Checkout request framing is ambiguous.", 400) };
  }

  if (length.value > 64_000) {
    return { ok: false, response: jsonError("Checkout payload is too large.", 413) };
  }

  if (!isStrictJsonContentType(request.headers.get("content-type"))) {
    return { ok: false, response: jsonError("Checkout expects application/json.", 415) };
  }

  return { ok: true };
}

export function validateStripeWebhookBoundary(request: Request): PaymentGuardDecision {
  const length = contentLength(request);
  const signature = request.headers.get("stripe-signature");

  if (!length.valid || hasAmbiguousTransferFraming(request)) {
    return { ok: false, response: jsonError("Webhook request framing is ambiguous.", 400) };
  }

  if (length.value > 1_000_000) {
    return { ok: false, response: jsonError("Webhook payload is too large.", 413) };
  }

  if (!isStrictJsonContentType(request.headers.get("content-type"))) {
    return { ok: false, response: jsonError("Stripe webhook expects application/json.", 415) };
  }

  const contentEncoding = request.headers.get("content-encoding");
  if (contentEncoding && contentEncoding.trim().toLowerCase() !== "identity") {
    return { ok: false, response: jsonError("Compressed Stripe webhook bodies are not accepted.", 415) };
  }

  if (!signature) {
    return { ok: false, response: jsonError("Missing Stripe signature.", 400) };
  }

  if (signature.length > 2_500) {
    return { ok: false, response: jsonError("Stripe signature header is too large.", 413) };
  }

  return { ok: true };
}

export const paymentWebhookGuardReadiness = {
  schemaVersion: "velmere-payment-webhook-guard-v3",
  checkoutMaxBytes: 64_000,
  webhookMaxBytes: 1_000_000,
  signatureHeaderMaxBytes: 2_500,
  streamingLimitEnforced: true,
  strictJsonObjectBoundary: true,
  duplicateJsonKeysRejected: true,
  dangerousJsonKeysRejected: true,
  boundary:
    "Payment guards reject oversized checkout/webhook payloads using actual streamed bytes, require JSON checkout/webhook input plus Stripe signature headers, reject compressed webhook bodies, and reject ambiguous payment JSON objects. They do not replace Stripe signature verification.",
} as const;

export type BoundedBodyBytesResult =
  | { ok: true; bytes: Uint8Array; byteLength: number }
  | { ok: false; response: NextResponse };

export async function readBoundedBodyBytes(
  request: Request,
  maxBytes: number,
): Promise<BoundedBodyBytesResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError("maxBytes must be a non-negative safe integer");
  }

  const declaredLength = contentLength(request);
  if (!declaredLength.valid || hasAmbiguousTransferFraming(request)) {
    return {
      ok: false,
      response: jsonError("Request framing is ambiguous.", 400),
    };
  }
  if (declaredLength.value > maxBytes) {
    return {
      ok: false,
      response: jsonError("Request payload is too large.", 413, {
        maxBytes,
        declaredBytes: declaredLength.value,
      }),
    };
  }

  if (!request.body) {
    if (declaredLength.present && declaredLength.value !== 0) {
      return { ok: false, response: jsonError("Content-Length does not match request body.", 400) };
    }
    return { ok: true, bytes: new Uint8Array(0), byteLength: 0 };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (!(value instanceof Uint8Array)) {
        await reader.cancel("payload_chunk_type_invalid").catch(() => undefined);
        return { ok: false, response: jsonError("Unable to read request body.", 400) };
      }

      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel("payload_limit_exceeded").catch(() => undefined);
        return {
          ok: false,
          response: jsonError("Request payload is too large.", 413, {
            maxBytes,
            actualBytesAtAbort: byteLength,
          }),
        };
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel("payload_read_failed").catch(() => undefined);
    return { ok: false, response: jsonError("Unable to read request body.", 400) };
  } finally {
    reader.releaseLock();
  }

  if (declaredLength.present && declaredLength.value !== byteLength) {
    return {
      ok: false,
      response: jsonError("Content-Length does not match request body.", 400, {
        declaredBytes: declaredLength.value,
        actualBytes: byteLength,
      }),
    };
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, bytes, byteLength };
}

/**
 * Rejects request bodies for POST-style commands whose contract is entirely
 * header/query driven. A Content-Length check alone is not sufficient because
 * HTTP/2 and chunked requests may omit it. Reusing the streaming reader with a
 * zero-byte allowance makes the first actual byte fail closed and cancels the
 * remaining stream without buffering it.
 */
export async function rejectUnexpectedRequestBody(
  request: Request,
): Promise<NextResponse | null> {
  const body = await readBoundedBodyBytes(request, 0);
  if (body.ok) return null;
  body.response.headers.set("x-velmere-request-body-policy", "body-forbidden");
  body.response.headers.set("cache-control", "no-store");
  return body.response;
}

export type BoundedFormDataBodyResult =
  | { ok: true; value: FormData; byteLength: number }
  | { ok: false; response: NextResponse };

export async function readBoundedFormDataBody(
  request: Request,
  maxBytes: number,
): Promise<BoundedFormDataBodyResult> {
  if (strictFormMediaType(request.headers.get("content-type")) === null) {
    return {
      ok: false,
      response: jsonError("Request expects form data.", 415),
    };
  }

  const body = await readBoundedBodyBytes(request, maxBytes);
  if (!body.ok) return body;

  try {
    const replayBytes = new Uint8Array(body.byteLength);
    replayBytes.set(body.bytes);
    const replay = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: replayBytes.buffer,
    });
    const value = await replay.formData();
    return { ok: true, value, byteLength: body.byteLength };
  } catch {
    return { ok: false, response: jsonError("Invalid form-data payload.", 400) };
  }
}

type JsonScanIssue =
  | { kind: "duplicate_key"; key: string }
  | { kind: "forbidden_key"; key: string }
  | { kind: "depth_exceeded"; depth: number };

function scanJsonObjectKeys(
  raw: string,
  options: { maxDepth: number; forbiddenKeys: ReadonlySet<string> },
): JsonScanIssue | null {
  let index = 0;
  let issue: JsonScanIssue | null = null;

  const skipWhitespace = () => {
    while (index < raw.length && /\s/.test(raw[index] ?? "")) index += 1;
  };

  const parseString = (): string => {
    const start = index;
    index += 1;
    while (index < raw.length) {
      const char = raw[index];
      if (char === "\\") {
        index += 2;
        continue;
      }
      index += 1;
      if (char === '"') break;
    }
    return JSON.parse(raw.slice(start, index)) as string;
  };

  const parsePrimitive = () => {
    while (index < raw.length && !/[\s,}\]]/.test(raw[index] ?? "")) index += 1;
  };

  const parseValue = (depth: number): void => {
    if (issue) return;
    if (depth > options.maxDepth) {
      issue = { kind: "depth_exceeded", depth };
      return;
    }
    skipWhitespace();
    const char = raw[index];
    if (char === "{") {
      parseObject(depth);
      return;
    }
    if (char === "[") {
      parseArray(depth);
      return;
    }
    if (char === '"') {
      parseString();
      return;
    }
    parsePrimitive();
  };

  const parseObject = (depth: number): void => {
    index += 1;
    skipWhitespace();
    const keys = new Set<string>();
    if (raw[index] === "}") {
      index += 1;
      return;
    }
    while (index < raw.length && !issue) {
      skipWhitespace();
      if (raw[index] !== '"') return;
      const key = parseString();
      if (keys.has(key)) {
        issue = { kind: "duplicate_key", key };
        return;
      }
      if (options.forbiddenKeys.has(key)) {
        issue = { kind: "forbidden_key", key };
        return;
      }
      keys.add(key);
      skipWhitespace();
      if (raw[index] !== ":") return;
      index += 1;
      parseValue(depth + 1);
      skipWhitespace();
      if (raw[index] === ",") {
        index += 1;
        continue;
      }
      if (raw[index] === "}") {
        index += 1;
        return;
      }
      return;
    }
  };

  const parseArray = (depth: number): void => {
    index += 1;
    skipWhitespace();
    if (raw[index] === "]") {
      index += 1;
      return;
    }
    while (index < raw.length && !issue) {
      parseValue(depth + 1);
      skipWhitespace();
      if (raw[index] === ",") {
        index += 1;
        continue;
      }
      if (raw[index] === "]") {
        index += 1;
        return;
      }
      return;
    }
  };

  parseValue(0);
  return issue;
}

export type StrictJsonBodyOptions = {
  requireObject?: boolean;
  rejectDuplicateKeys?: boolean;
  rejectDangerousKeys?: boolean;
  maxDepth?: number;
};

export type BoundedJsonBodyResult<T> =
  | { ok: true; value: T; byteLength: number; raw: string }
  | { ok: false; response: NextResponse };

export async function readBoundedJsonBody<T>(
  request: Request,
  maxBytes: number,
  options: StrictJsonBodyOptions = {},
): Promise<BoundedJsonBodyResult<T>> {
  if (!isStrictJsonContentType(request.headers.get("content-type"))) {
    return {
      ok: false,
      response: jsonError("Request expects application/json.", 415),
    };
  }

  const body = await readBoundedBodyBytes(request, maxBytes);
  if (!body.ok) return body;

  let raw: string;
  try {
    raw = new TextDecoder("utf-8", { fatal: true }).decode(body.bytes);
  } catch {
    return { ok: false, response: jsonError("Invalid UTF-8 payload.", 400) };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, response: jsonError("Invalid JSON payload.", 400) };
  }

  const requireObject = options.requireObject ?? true;
  if (
    requireObject &&
    (!value || typeof value !== "object" || Array.isArray(value))
  ) {
    return {
      ok: false,
      response: jsonError("JSON payload must be an object.", 400),
    };
  }

  if (
    options.rejectDuplicateKeys !== false ||
    options.rejectDangerousKeys !== false
  ) {
    const issue = scanJsonObjectKeys(raw, {
      maxDepth: options.maxDepth ?? 32,
      forbiddenKeys:
        options.rejectDangerousKeys === false
          ? new Set<string>()
          : new Set(["__proto__", "prototype", "constructor"]),
    });
    if (issue?.kind === "duplicate_key") {
      return {
        ok: false,
        response: jsonError("Duplicate JSON object key.", 400, {
          key: issue.key,
        }),
      };
    }
    if (issue?.kind === "forbidden_key") {
      return {
        ok: false,
        response: jsonError("Forbidden JSON object key.", 400, {
          key: issue.key,
        }),
      };
    }
    if (issue?.kind === "depth_exceeded") {
      return {
        ok: false,
        response: jsonError("JSON nesting is too deep.", 400, {
          maxDepth: options.maxDepth ?? 32,
        }),
      };
    }
  }

  return {
    ok: true,
    value: value as T,
    byteLength: body.byteLength,
    raw,
  };
}
