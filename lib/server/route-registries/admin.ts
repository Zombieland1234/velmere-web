import type { LazyRouteRegistry } from "@/lib/server/lazy-route-dispatch";

export const ADMIN_ROUTES = {
  "audit-events": { methods: ["GET", "POST"] as const, load: () => import("@/lib/server/admin-route-modules/audit-events") },
  "import-products": { methods: ["POST"] as const, load: () => import("@/lib/server/admin-route-modules/import-products") },
  "sync-printful": { methods: ["POST"] as const, load: () => import("@/lib/server/admin-route-modules/sync-printful") },
} as const satisfies LazyRouteRegistry;
