export type ActionReportSource = "asset-detail" | "shield-pro";

export function cleanActionReportValue(
  value: unknown,
  fallback = "unknown",
  max = 180,
): string {
  const boundedMax = Math.min(2_000, Math.max(1, Math.trunc(max)));
  const text = String(value ?? fallback)
    .replace(/[<>{}\r\n]/g, " ")
    .trim();
  return (text || fallback).slice(0, boundedMax);
}

export function slugActionReportValue(
  value: unknown,
  fallback: string,
  max = 260,
): string {
  const normalized = cleanActionReportValue(value, fallback, max)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function normalizeActionReportSource(value: unknown): ActionReportSource {
  return cleanActionReportValue(value, "asset-detail", 64).includes("shield-pro")
    ? "shield-pro"
    : "asset-detail";
}
