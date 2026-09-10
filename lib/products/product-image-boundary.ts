const SAFE_LOCAL_PRODUCT_IMAGE =
  /^\/(?:products|images)\/[A-Za-z0-9._/-]+\.(?:avif|jpe?g|png|webp)$/u;

export function normalizeCustomerProductImageUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (
    !candidate ||
    candidate.length > 320 ||
    candidate.includes("\\") ||
    candidate.includes("%") ||
    candidate.includes("//") ||
    candidate.includes("?") ||
    candidate.includes("#") ||
    !SAFE_LOCAL_PRODUCT_IMAGE.test(candidate)
  ) return null;
  if (candidate.split("/").some((segment) => segment === "." || segment === "..")) return null;
  return candidate;
}
