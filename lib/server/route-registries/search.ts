import type { LazyRouteRegistry } from "@/lib/server/lazy-route-dispatch";

export const SEARCH_ROUTES = {
  "bridge": { methods: ["GET"] as const, load: () => import("@/lib/server/search-route-modules/bridge") },
  "lens-report": { methods: ["GET", "POST"] as const, load: () => import("@/lib/server/search-route-modules/lens-report") },
  "lens-route": { methods: ["GET"] as const, load: () => import("@/lib/server/search-route-modules/lens-route") },
  "live-preview": { methods: ["GET"] as const, load: () => import("@/lib/server/search-route-modules/live-preview") },
  "token-metadata": { methods: ["GET"] as const, load: () => import("@/lib/server/search-route-modules/token-metadata") },
} as const satisfies LazyRouteRegistry;
