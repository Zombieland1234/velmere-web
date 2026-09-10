import type { LazyRouteRegistry } from "@/lib/server/lazy-route-dispatch";

export const REAL_MARKETS_ROUTES = {
  "catalog": { methods: ["GET"] as const, load: () => import("@/lib/server/real-markets-route-modules/catalog") },
  "provider-contract": { methods: ["GET"] as const, load: () => import("@/lib/server/real-markets-route-modules/provider-contract") },
  "search": { methods: ["GET"] as const, load: () => import("@/lib/server/real-markets-route-modules/search") },
} as const satisfies LazyRouteRegistry;
