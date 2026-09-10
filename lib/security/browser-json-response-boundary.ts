"use client";

import { readTextResponseBounded } from "@/lib/network/fetch-with-deadline";
import { parseStrictJsonText } from "@/lib/security/strict-json-boundary";

export const PASS36_A102R17_BROWSER_JSON_RESPONSE_BOUNDARY_ID =
  "velmere.pass36.a102r17.browser-json-response-boundary.v1" as const;

const JSON_CONTENT_TYPE = /(^|[;/\s])application\/(?:[a-z0-9.+-]+\+)?json(?:[;\s]|$)/i;
const SAFE_PUBLIC_CODE = /^[a-z][a-z0-9_]{2,79}$/;

export type BrowserJsonResponseErrorCode =
  | "browser_response_content_type_invalid"
  | "browser_response_empty"
  | "browser_response_invalid_json"
  | "browser_response_too_large"
  | "browser_response_read_failed";

export type BrowserJsonResponseResult<T extends Record<string, unknown>> =
  | {
      ok: true;
      value: T;
      status: number;
      responseOk: boolean;
      boundaryId: typeof PASS36_A102R17_BROWSER_JSON_RESPONSE_BOUNDARY_ID;
    }
  | {
      ok: false;
      code: BrowserJsonResponseErrorCode;
      status: number;
      responseOk: boolean;
      rawBodyIncluded: false;
      boundaryId: typeof PASS36_A102R17_BROWSER_JSON_RESPONSE_BOUNDARY_ID;
    };

function invalidResult(
  response: Response,
  code: BrowserJsonResponseErrorCode,
): BrowserJsonResponseResult<never> {
  return {
    ok: false,
    code,
    status: response.status,
    responseOk: response.ok,
    rawBodyIncluded: false,
    boundaryId: PASS36_A102R17_BROWSER_JSON_RESPONSE_BOUNDARY_ID,
  };
}

function declaredContentLength(response: Response) {
  const raw = response.headers.get("content-length");
  if (!raw) return null;
  if (!/^\d{1,10}$/u.test(raw.trim())) return Number.NaN;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

export async function readBrowserJsonObject<T extends Record<string, unknown>>(
  response: Response,
  options: {
    maxBytes?: number;
    maxDepth?: number;
    maxNodes?: number;
    requireJsonContentType?: boolean;
  } = {},
): Promise<BrowserJsonResponseResult<T>> {
  const maxBytes = Math.max(1_024, Math.min(options.maxBytes ?? 512 * 1024, 4 * 1024 * 1024));
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (options.requireJsonContentType !== false && !JSON_CONTENT_TYPE.test(contentType)) {
    return invalidResult(response, "browser_response_content_type_invalid");
  }

  const declared = declaredContentLength(response);
  if (Number.isNaN(declared) || (declared !== null && declared > maxBytes)) {
    return invalidResult(response, "browser_response_too_large");
  }

  let raw: string;
  try {
    raw = await readTextResponseBounded(response, maxBytes);
  } catch {
    return invalidResult(response, "browser_response_read_failed");
  }
  if (!raw.trim()) return invalidResult(response, "browser_response_empty");

  try {
    const value = parseStrictJsonText<T>(raw, {
      maxBytes,
      maxDepth: options.maxDepth ?? 32,
      maxNodes: options.maxNodes ?? 50_000,
      requireObject: true,
    });
    return {
      ok: true,
      value,
      status: response.status,
      responseOk: response.ok,
      boundaryId: PASS36_A102R17_BROWSER_JSON_RESPONSE_BOUNDARY_ID,
    };
  } catch {
    return invalidResult(response, "browser_response_invalid_json");
  }
}

export function allowlistedBrowserServerCode(
  value: unknown,
  allowlist: readonly string[],
  fallback: string,
) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return SAFE_PUBLIC_CODE.test(normalized) && allowlist.includes(normalized)
    ? normalized
    : fallback;
}
