import type { LazyRouteRegistry } from "@/lib/server/lazy-route-dispatch";

export const MARKET_INTEGRITY_VLM_ROUTES = {
  "access-policy": { methods: ["GET"] as const, load: () => import("@/lib/server/market-integrity-vlm-route-modules/access-policy") },
  "keys": { methods: ["GET"] as const, load: () => import("@/lib/server/lazy-route-modules/market-integrity--vlm--keys") },
  "verify": { methods: ["POST"] as const, load: () => import("@/lib/server/lazy-route-modules/market-integrity--vlm--verify") },
} as const satisfies LazyRouteRegistry;
