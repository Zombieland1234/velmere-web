import { securityJson } from "@/lib/security/api-guard";

export const PASS36_A89_EXACT_REQUEST_BOUNDARY_ID = "velmere.pass36.a89.exact-request-boundary.v1" as const;

export type ExactObjectKeyResult =
  | { ok: true; keys: string[] }
  | { ok: false; response: Response; unknownKeys: string[] };

export function validateExactObjectKeys(
  value: unknown,
  allowedKeys: readonly string[],
): ExactObjectKeyResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      unknownKeys: [],
      response: securityJson({ ok: false, error: "json_object_required" }, { status: 400 }),
    };
  }
  const allowed = new Set(allowedKeys);
  const keys = Object.keys(value as Record<string, unknown>);
  const unknownKeys = keys.filter((key) => !allowed.has(key)).sort();
  if (unknownKeys.length) {
    return {
      ok: false,
      unknownKeys,
      response: securityJson({ ok: false, error: "unknown_body_field", fields: unknownKeys }, { status: 400 }),
    };
  }
  return { ok: true, keys: keys.sort() };
}

export type ExactSearchParamResult =
  | { ok: true; values: Readonly<Record<string, string | null>> }
  | { ok: false; response: Response; code: "unknown_query_parameter" | "duplicate_query_parameter" };

export function validateExactSearchParams(
  url: URL,
  allowedKeys: readonly string[],
): ExactSearchParamResult {
  const allowed = new Set(allowedKeys);
  for (const key of Array.from(url.searchParams.keys())) {
    if (!allowed.has(key)) {
      return {
        ok: false,
        code: "unknown_query_parameter",
        response: securityJson({ ok: false, error: "unknown_query_parameter", parameter: key }, { status: 400 }),
      };
    }
    if (url.searchParams.getAll(key).length !== 1) {
      return {
        ok: false,
        code: "duplicate_query_parameter",
        response: securityJson({ ok: false, error: "duplicate_query_parameter", parameter: key }, { status: 400 }),
      };
    }
  }
  return {
    ok: true,
    values: Object.fromEntries(allowedKeys.map((key) => [key, url.searchParams.get(key)])),
  };
}

export function isProductionLikeEnvironment(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}
