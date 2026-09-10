import { parseStrictJsonText } from "@/lib/security/strict-json-boundary";

export const ASSET_DETAIL_REQUEST_TIMEOUT_MS = 12_000;
export const ASSET_DETAIL_MAX_JSON_BYTES = 1_048_576;

export class AssetDetailRequestError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, status: number | null = null, message = code) {
    super(message);
    this.name = "AssetDetailRequestError";
    this.code = code;
    this.status = status;
  }
}

export type AssetDetailJsonResult<T> = {
  response: Response;
  payload: T | null;
  contentType: string;
};

function isJsonContentType(contentType: string) {
  return /(^|[;/\s])application\/(?:[a-z0-9.+-]+\+)?json(?:[;\s]|$)/i.test(contentType);
}

function declaredContentLength(response: Response) {
  const raw = response.headers.get("content-length");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

async function readBoundedResponseText(response: Response, maxBytes: number) {
  const declared = declaredContentLength(response);
  if (declared !== null && declared > maxBytes) {
    throw new AssetDetailRequestError("response_too_large", response.status, `Response exceeds ${maxBytes} bytes`);
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const chunks: string[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("response_too_large").catch(() => undefined);
        throw new AssetDetailRequestError("response_too_large", response.status, `Response exceeds ${maxBytes} bytes`);
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } finally {
    reader.releaseLock();
  }
}

export async function fetchAssetDetailJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: { timeoutMs?: number; signal?: AbortSignal; maxJsonBytes?: number } = {},
): Promise<AssetDetailJsonResult<T>> {
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? ASSET_DETAIL_REQUEST_TIMEOUT_MS);
  const maxJsonBytes = Math.max(16_384, Math.min(options.maxJsonBytes ?? ASSET_DETAIL_MAX_JSON_BYTES, 4_194_304));
  const controller = new AbortController();
  const externalSignal = options.signal ?? init.signal ?? null;
  const abortFromExternal = () => controller.abort(externalSignal?.reason ?? new DOMException("Aborted", "AbortError"));

  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

  const timer = globalThis.setTimeout(() => {
    controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, "TimeoutError"));
  }, timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!isJsonContentType(contentType)) return { response, payload: null, contentType };

    const raw = await readBoundedResponseText(response, maxJsonBytes);
    if (!raw.trim()) return { response, payload: null, contentType };
    try {
      return {
        response,
        payload: parseStrictJsonText<T>(raw, {
          maxBytes: maxJsonBytes,
          maxDepth: 48,
          maxNodes: 100_000,
        }),
        contentType,
      };
    } catch {
      throw new AssetDetailRequestError("response_invalid_json", response.status, "response_invalid_json");
    }
  } catch (error) {
    if (error instanceof AssetDetailRequestError) throw error;
    if (controller.signal.aborted && !externalSignal?.aborted) {
      throw new AssetDetailRequestError("request_timeout", null, `Request timed out after ${timeoutMs}ms`);
    }
    if (externalSignal?.aborted) {
      throw new AssetDetailRequestError("request_aborted", null, "Request aborted");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}
