const MAX_REPORTS = 10;
const SAFE_DIRECTIVE = /^[a-z][a-z0-9-]{0,63}$/u;
const SAFE_DISPOSITION = new Set(["enforce", "report"]);
const SPECIAL_BLOCKED_URLS = new Set(["inline", "eval", "data", "blob"]);

export type SanitizedCspViolation = {
  documentPath: string;
  blockedResource: string;
  effectiveDirective: string;
  violatedDirective: string;
  disposition: "enforce" | "report" | "unknown";
  sourcePath: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  statusCode: number | null;
};

function boundedInteger(value: unknown, maximum: number) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 && number <= maximum ? number : null;
}

function directive(value: unknown) {
  const token = String(value ?? "").trim().split(/\s+/u)[0]?.toLowerCase() ?? "";
  return SAFE_DIRECTIVE.test(token) ? token : "unknown";
}

function safeUrl(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  const special = text.toLowerCase().replace(/:$/u, "");
  if (SPECIAL_BLOCKED_URLS.has(special)) return special;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return url.protocol.replace(/:$/u, "") || fallback;
    return `${url.origin}${url.pathname}`.slice(0, 384);
  } catch {
    return fallback;
  }
}

function normalizeLegacy(value: Record<string, unknown>): SanitizedCspViolation {
  return {
    documentPath: safeUrl(value["document-uri"], "unknown"),
    blockedResource: safeUrl(value["blocked-uri"], "unknown"),
    effectiveDirective: directive(value["effective-directive"]),
    violatedDirective: directive(value["violated-directive"]),
    disposition: SAFE_DISPOSITION.has(String(value.disposition))
      ? String(value.disposition) as "enforce" | "report"
      : "unknown",
    sourcePath: value["source-file"] ? safeUrl(value["source-file"], "unknown") : null,
    lineNumber: boundedInteger(value["line-number"], 10_000_000),
    columnNumber: boundedInteger(value["column-number"], 10_000_000),
    statusCode: boundedInteger(value["status-code"], 999),
  };
}

function normalizeReportingApi(value: Record<string, unknown>): SanitizedCspViolation | null {
  if (value.type !== "csp-violation" || !value.body || typeof value.body !== "object" || Array.isArray(value.body)) return null;
  const body = value.body as Record<string, unknown>;
  return {
    documentPath: safeUrl(body.documentURL ?? value.url, "unknown"),
    blockedResource: safeUrl(body.blockedURL, "unknown"),
    effectiveDirective: directive(body.effectiveDirective),
    violatedDirective: directive(body.effectiveDirective),
    disposition: SAFE_DISPOSITION.has(String(body.disposition))
      ? String(body.disposition) as "enforce" | "report"
      : "unknown",
    sourcePath: body.sourceFile ? safeUrl(body.sourceFile, "unknown") : null,
    lineNumber: boundedInteger(body.lineNumber, 10_000_000),
    columnNumber: boundedInteger(body.columnNumber, 10_000_000),
    statusCode: boundedInteger(body.statusCode, 999),
  };
}

export function parseAndSanitizeCspReports(value: unknown): SanitizedCspViolation[] {
  const rows = Array.isArray(value) ? value : [value];
  const reports: SanitizedCspViolation[] = [];
  for (const row of rows.slice(0, MAX_REPORTS)) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    if (record["csp-report"] && typeof record["csp-report"] === "object" && !Array.isArray(record["csp-report"])) {
      reports.push(normalizeLegacy(record["csp-report"] as Record<string, unknown>));
      continue;
    }
    const normalized = normalizeReportingApi(record);
    if (normalized) reports.push(normalized);
  }
  return reports;
}
