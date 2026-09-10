export type StrictVlmLocale = "pl" | "en" | "de";
export type StrictVlmDepth = "basic" | "pro" | "advanced";

export type VlmRouteBoundaryFailure = {
  code: string;
  field?: string;
  detail?: string;
};

export function validateOnlySearchParams(url: URL, allowed: readonly string[]): VlmRouteBoundaryFailure | null {
  const allowedSet = new Set(allowed);
  for (const key of url.searchParams.keys()) {
    if (!allowedSet.has(key)) return { code: "unknown_query_parameter", field: key };
  }
  for (const key of allowed) {
    if (url.searchParams.getAll(key).length > 1) return { code: "duplicate_query_parameter", field: key };
  }
  return null;
}

export function validateBodyObject(value: unknown, allowed: readonly string[]): VlmRouteBoundaryFailure | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { code: "body_object_required" };
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (!allowedSet.has(key)) return { code: "unknown_body_field", field: key };
  }
  return null;
}

export function rejectMixedBodyAndQuery(url: URL, body: Record<string, unknown>, fields: readonly string[]): VlmRouteBoundaryFailure | null {
  for (const field of fields) {
    if (url.searchParams.has(field) && Object.prototype.hasOwnProperty.call(body, field)) {
      return { code: "body_query_parameter_shadowing", field };
    }
  }
  return null;
}

export function parseStrictVlmLocale(value: unknown, fallback: StrictVlmLocale): { ok: true; value: StrictVlmLocale } | { ok: false; failure: VlmRouteBoundaryFailure } {
  if (value === undefined || value === null || value === "") return { ok: true, value: fallback };
  if (value === "pl" || value === "en" || value === "de") return { ok: true, value };
  return { ok: false, failure: { code: "locale_invalid", field: "locale" } };
}

export function parseStrictVlmDepth(value: unknown, fallback: StrictVlmDepth): { ok: true; value: StrictVlmDepth } | { ok: false; failure: VlmRouteBoundaryFailure } {
  if (value === undefined || value === null || value === "") return { ok: true, value: fallback };
  if (value === "basic" || value === "pro" || value === "advanced") return { ok: true, value };
  return { ok: false, failure: { code: "analysis_depth_invalid", field: "depth" } };
}

export function primitiveString(value: unknown, field: string, max: number, required = false): { ok: true; value: string | undefined } | { ok: false; failure: VlmRouteBoundaryFailure } {
  if (value === undefined || value === null) {
    if (required) return { ok: false, failure: { code: `${field}_required`, field } };
    return { ok: true, value: undefined };
  }
  if (typeof value !== "string") return { ok: false, failure: { code: `${field}_must_be_string`, field } };
  const normalized = value.trim();
  if (required && !normalized) return { ok: false, failure: { code: `${field}_required`, field } };
  if (Buffer.byteLength(normalized, "utf8") > max) return { ok: false, failure: { code: `${field}_too_large`, field } };
  return { ok: true, value: normalized || undefined };
}
