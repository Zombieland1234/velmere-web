export const ROUTE_PREFETCH_CACHE_LIMIT = 48;
export const ROUTE_HASH_MAX_LENGTH = 512;
export const ROUTE_HASH_TARGET_WAIT_MS = 1_800;

export type RouteTransitionHashClassification =
  | { kind: "none"; value: null }
  | { kind: "invalid"; value: null }
  | { kind: "valid"; value: string };

export function isRouteTransitionSelfTarget(target: string | null | undefined): boolean {
  const normalized = (target ?? "").trim().toLowerCase();
  return normalized === "" || normalized === "_self";
}

export function rememberBoundedRoutePrefetchKey(
  cache: Set<string>,
  key: string,
  limit = ROUTE_PREFETCH_CACHE_LIMIT,
): boolean {
  const normalizedKey = key.trim();
  if (!normalizedKey || cache.has(normalizedKey)) return false;
  if (!Number.isInteger(limit) || limit < 1) return false;

  cache.add(normalizedKey);
  while (cache.size > limit) {
    const oldest = cache.values().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
  return true;
}

export function classifyRouteTransitionHash(
  hash: string | null | undefined,
): RouteTransitionHashClassification {
  if (!hash) return { kind: "none", value: null };
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw || raw.length > ROUTE_HASH_MAX_LENGTH) {
    return { kind: "invalid", value: null };
  }

  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded || decoded.length > ROUTE_HASH_MAX_LENGTH) {
      return { kind: "invalid", value: null };
    }
    if ([...decoded].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 0x20 || codePoint === 0x7f;
    })) {
      return { kind: "invalid", value: null };
    }
    return { kind: "valid", value: decoded };
  } catch {
    return { kind: "invalid", value: null };
  }
}

export function decodeRouteTransitionHash(hash: string | null | undefined): string | null {
  const classified = classifyRouteTransitionHash(hash);
  return classified.kind === "valid" ? classified.value : null;
}
