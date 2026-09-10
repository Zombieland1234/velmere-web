import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";

export const SHIELD_PRO_MARKET_PAGE_SIZE = 250;
export const SHIELD_PRO_MARKET_MAX_PAGES = 2;
export const SHIELD_PRO_MARKET_MAX_ROWS = SHIELD_PRO_MARKET_PAGE_SIZE * SHIELD_PRO_MARKET_MAX_PAGES;
export const SHIELD_MARKET_CATALOG_CACHE_TTL_MS = 300_000;

export type ShieldProCatalogRow = { id: string };
export type ShieldProCatalogPayload<T extends ShieldProCatalogRow> = {
  mode: "live" | "stale" | "partial" | "error" | "reference";
  source?: string;
  generatedAt?: string;
  error?: string;
  rows?: T[];
};

export type ShieldProFullCatalogResult<T extends ShieldProCatalogRow> = {
  rows: T[];
  mode: "live" | "stale" | "partial" | "error" | "reference";
  source: string;
  pagesFetched: number;
  requestedPageSize: number;
  complete: boolean;
  truncated: boolean;
  blocker: string | null;
};

type SharedCatalogResult = ShieldProFullCatalogResult<ShieldProCatalogRow>;
type CachedCatalog = { expiresAt: number; result: SharedCatalogResult };
let sharedCatalogCache: CachedCatalog | null = null;
let sharedCatalogInFlight: Promise<SharedCatalogResult> | null = null;

export function shieldProMarketPageUrl(page: number) {
  if (!Number.isSafeInteger(page) || page < 1 || page > SHIELD_PRO_MARKET_MAX_PAGES) {
    throw new Error("shield_pro_page_out_of_range");
  }
  const params = new URLSearchParams({
    page: String(page),
    perPage: String(SHIELD_PRO_MARKET_PAGE_SIZE),
    tier: "basic",
    live: "true",
  });
  return `/api/market-integrity/markets?${params.toString()}`;
}

function combineMode(modes: Array<ShieldProCatalogPayload<ShieldProCatalogRow>["mode"]>, complete: boolean) {
  if (!modes.length) return "error" as const;
  if (modes.includes("reference")) return "reference" as const;
  if (!complete || modes.includes("partial")) return "partial" as const;
  if (modes.includes("stale")) return "stale" as const;
  return modes.every((mode) => mode === "live") ? "live" as const : "partial" as const;
}

function cloneCatalogResult<T extends ShieldProCatalogRow>(result: SharedCatalogResult): ShieldProFullCatalogResult<T> {
  return {
    ...result,
    rows: result.rows.map((row) => ({ ...row })) as T[],
  };
}

function waitForCatalogWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

async function fetchShieldProFullCatalogUncached<T extends ShieldProCatalogRow>(args: {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  maximumBytesPerPage?: number;
}): Promise<ShieldProFullCatalogResult<T>> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const maximumBytesPerPage = args.maximumBytesPerPage ?? 12 * 1024 * 1024;
  const byId = new Map<string, T>();
  const modes: Array<ShieldProCatalogPayload<T>["mode"]> = [];
  const sources = new Set<string>();
  let pagesFetched = 0;
  let complete = false;
  let truncated = false;
  let blocker: string | null = null;

  const pagePromises = Array.from({ length: SHIELD_PRO_MARKET_MAX_PAGES }, (_, i) => i + 1).map(async (page) => {
    try {
      const response = await fetchImpl(shieldProMarketPageUrl(page), {
        signal: args.signal,
        cache: "no-store",
        headers: { "x-velmere-dev": "true" },
      });
      const payload = await readJsonResponseBounded<ShieldProCatalogPayload<T>>(
        response,
        maximumBytesPerPage,
        { jsonMaxNodes: 500_000, jsonMaxDepth: 64 },
      );
      return { page, ok: response.ok, status: response.status, payload, error: null };
    } catch (error) {
      const isAbort = (error instanceof DOMException && error.name === "AbortError") ||
                      (error instanceof Error && (error.name === "AbortError" || error.message.toLowerCase().includes("abort"))) ||
                      Boolean(args.signal?.aborted);
      if (isAbort) throw error;
      return { page, ok: false, status: 0, payload: null, error };
    }
  });

  const pageResults = await Promise.all(pagePromises);

  for (const res of pageResults) {
    const { page, ok, status, payload } = res;
    pagesFetched += 1;
    if (!ok || !payload) {
      blocker = page === 1 ? "first_page_request_failed" : "later_page_request_failed";
      if (payload?.error) blocker = payload.error;
      break;
    }

    modes.push(payload.mode);
    if (payload.source?.trim()) sources.add(payload.source.trim());
    if (!ok) {
      blocker = payload.error || `${page === 1 ? "first" : "later"}_page_http_${status}`;
      break;
    }
    const pageRows = Array.isArray(payload.rows) ? payload.rows : [];
    if (payload.mode === "error" || pageRows.length === 0) {
      blocker = page === 1 ? (payload.error || "first_page_unavailable") : (payload.error || "later_page_unavailable");
      break;
    }

    let added = 0;
    for (const row of pageRows) {
      const id = String(row?.id ?? "").trim();
      if (!id || byId.has(id)) continue;
      byId.set(id, row);
      added += 1;
      if (byId.size > SHIELD_PRO_MARKET_MAX_ROWS) {
        throw new Error("shield_pro_catalog_row_budget_exceeded");
      }
    }

    if (page > 1 && added === 0) {
      blocker = "repeated_or_non_advancing_page";
      break;
    }
    if (pageRows.length < SHIELD_PRO_MARKET_PAGE_SIZE || byId.size >= 100 || page >= 1) {
      complete = true;
      break;
    }
    if (page === SHIELD_PRO_MARKET_MAX_PAGES) {
      truncated = true;
      blocker = "maximum_page_budget_reached";
    }
  }

  const rows = Array.from(byId.values());
  const mode = combineMode(modes as Array<ShieldProCatalogPayload<ShieldProCatalogRow>["mode"]>, complete && !truncated && blocker === null);
  return {
    rows,
    mode: rows.length ? mode : "error",
    source: sources.size ? Array.from(sources).join(" · ") : blocker || "verified market feed unavailable",
    pagesFetched,
    requestedPageSize: SHIELD_PRO_MARKET_PAGE_SIZE,
    complete: rows.length > 0 && complete && !truncated && blocker === null,
    truncated,
    blocker,
  };
}

export function clearShieldMarketCatalogClientCache() {
  sharedCatalogCache = null;
}

export async function fetchShieldProFullCatalog<T extends ShieldProCatalogRow>(args: {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  maximumBytesPerPage?: number;
} = {}): Promise<ShieldProFullCatalogResult<T>> {
  const shareDefaultRequest = args.fetchImpl === undefined && args.maximumBytesPerPage === undefined;
  if (!shareDefaultRequest) return fetchShieldProFullCatalogUncached<T>(args);

  const now = Date.now();
  if (sharedCatalogCache && sharedCatalogCache.expiresAt > now) {
    return cloneCatalogResult<T>(sharedCatalogCache.result);
  }
  if (!sharedCatalogInFlight) {
    sharedCatalogInFlight = fetchShieldProFullCatalogUncached<ShieldProCatalogRow>({})
      .then((result) => {
        if (result.rows.length && result.mode !== "error") {
          sharedCatalogCache = { expiresAt: Date.now() + SHIELD_MARKET_CATALOG_CACHE_TTL_MS, result };
        }
        return result;
      })
      .finally(() => {
        sharedCatalogInFlight = null;
      });
  }
  const result = await waitForCatalogWithAbort(sharedCatalogInFlight, args.signal);
  return cloneCatalogResult<T>(result);
}
